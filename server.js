const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

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

// POST a new order (checkout)
// This is a MOCK checkout: no real payment is processed here.
// Swap in Stripe/PayPal before going live -- see README.
app.post('/api/orders', (req, res) => {
  const { items, customer } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }
  if (!customer || !customer.name || !customer.email || !customer.address) {
    return res.status(400).json({ error: 'Missing customer details' });
  }

  const products = readProducts();
  let total = 0;
  const lineItems = items.map(item => {
    const product = products.find(p => p.id === item.id);
    if (!product) throw new Error(`Unknown product: ${item.id}`);
    const qty = Math.max(1, item.qty || 1);
    total += product.price * qty;
    return { id: product.id, name: product.name, price: product.price, qty };
  });

  const order = {
    id: 'ord_' + Date.now(),
    createdAt: new Date().toISOString(),
    customer,
    items: lineItems,
    total: Number(total.toFixed(2)),
    status: 'received' // becomes 'placed_with_supplier' once you forward it
  };

  const orders = readOrders();
  orders.push(order);
  writeOrders(orders);

  res.status(201).json(order);
});

// GET all orders (simple owner view -- add auth before deploying publicly)
app.get('/api/orders', (req, res) => {
  res.json(readOrders());
});

app.listen(PORT, () => {
  console.log(`Deskwell running at http://localhost:${PORT}`);
});
