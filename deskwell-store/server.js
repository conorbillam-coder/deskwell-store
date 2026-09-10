require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Stripe is only initialized if a secret key is set, so the app can still
// run (with checkout disabled) before you've configured it.
const stripe = process.env.STRIPE_SECRET_KEY
  ? require('stripe')(process.env.STRIPE_SECRET_KEY)
  : null;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const productsPath = path.join(__dirname, 'data', 'products.json');
const ordersPath = path.join(__dirname, 'data', 'orders.json');

function readProducts() {
  return JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
}

function readOrders() {
  if (!fs.existsSync(ordersPath)) return [];
  return JSON.parse(fs.readFileSync(ordersPath, 'utf-8'));
}

function writeOrders(orders) {
  fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
}

function saveOrderFromSession(session) {
  const orders = readOrders();

  // Avoid saving the same paid session twice (e.g. if the success page reloads)
  const existing = orders.find(o => o.stripeSessionId === session.id);
  if (existing) return { order: existing, isNew: false };

  const items = JSON.parse(session.metadata.items || '[]');
  const order = {
    id: 'ord_' + Date.now(),
    stripeSessionId: session.id,
    createdAt: new Date().toISOString(),
    customer: {
      name: session.metadata.customerName,
      email: session.customer_details?.email || session.metadata.customerEmail,
      address: session.metadata.customerAddress
    },
    items,
    total: Number((session.amount_total / 100).toFixed(2)),
    status: 'paid' // becomes 'placed_with_supplier' once you forward it to CJ
  };

  orders.push(order);
  writeOrders(orders);
  return { order, isNew: true };
}

// Emails you (NOTIFY_EMAIL) whenever a new paid order comes in, using Resend.
// Silently does nothing if RESEND_API_KEY isn't set, so this is optional.
async function sendOrderNotification(order) {
  const apiKey = process.env.RESEND_API_KEY;
  const notifyEmail = process.env.NOTIFY_EMAIL;
  if (!apiKey || !notifyEmail) return;

  const itemLines = order.items
    .map(i => `${i.qty}x ${i.name} — $${(i.price * i.qty).toFixed(2)}`)
    .join('<br>');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM_EMAIL || 'Deskwell <onboarding@resend.dev>',
        to: notifyEmail,
        subject: `New order ${order.id} — $${order.total.toFixed(2)}`,
        html: `
          <h2>New order: ${order.id}</h2>
          <p><strong>Total:</strong> $${order.total.toFixed(2)}</p>
          <p><strong>Items:</strong><br>${itemLines}</p>
          <p><strong>Ship to:</strong><br>
            ${order.customer.name}<br>
            ${order.customer.email}<br>
            ${order.customer.address.replace(/\n/g, '<br>')}
          </p>
          <p>Place the matching order(s) on CJdropshipping using each product's cjUrl.</p>
        `
      })
    });
    if (!res.ok) {
      console.error('Resend email failed:', res.status, await res.text());
    }
  } catch (err) {
    console.error('Could not send order notification email:', err.message);
  }
}

// GET all products
app.get('/api/products', (req, res) => {
  res.json(readProducts());
});

// GET a single product
app.get('/api/products/:id', (req, res) => {
  const product = readProducts().find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// POST create a Stripe Checkout session.
// The browser is redirected to session.url, where Stripe hosts the actual
// payment page -- card details never touch this server.
app.post('/api/create-checkout-session', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({
      error: 'Stripe is not configured. Set STRIPE_SECRET_KEY -- see README.'
    });
  }

  const { items, customer } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }
  if (!customer || !customer.name || !customer.email || !customer.address) {
    return res.status(400).json({ error: 'Missing customer details' });
  }

  const products = readProducts();
  const lineItems = [];
  const orderItems = [];

  for (const item of items) {
    const product = products.find(p => p.id === item.id);
    if (!product) return res.status(400).json({ error: `Unknown product: ${item.id}` });
    const qty = Math.max(1, item.qty || 1);

    lineItems.push({
      quantity: qty,
      price_data: {
        currency: 'usd',
        unit_amount: Math.round(product.price * 100), // Stripe uses cents
        product_data: { name: product.name }
      }
    });
    orderItems.push({ id: product.id, name: product.name, price: product.price, qty });
  }

  const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/`,
      customer_email: customer.email,
      metadata: {
        customerName: customer.name,
        customerEmail: customer.email,
        customerAddress: customer.address,
        items: JSON.stringify(orderItems)
      }
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe session creation failed:', err.message);
    res.status(500).json({ error: 'Could not start checkout. Please try again.' });
  }
});

// GET confirm a completed Stripe session and save the order.
// Called by success.html right after Stripe redirects the customer back.
app.get('/api/checkout-session/:sessionId', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe is not configured.' });
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment not completed' });
    }
    const { order, isNew } = saveOrderFromSession(session);
    if (isNew) sendOrderNotification(order); // don't block the response on email sending
    res.json(order);
  } catch (err) {
    console.error('Could not retrieve Stripe session:', err.message);
    res.status(500).json({ error: 'Could not confirm order.' });
  }
});

// GET all orders (simple owner view -- add auth before deploying publicly)
app.get('/api/orders', (req, res) => {
  res.json(readOrders());
});

app.listen(PORT, () => {
  console.log(`Deskwell running at http://localhost:${PORT}`);
  if (!stripe) {
    console.log('Note: STRIPE_SECRET_KEY is not set -- checkout will be disabled until you add it.');
  }
});
