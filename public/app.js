document.getElementById('year').textContent = new Date().getFullYear();

let products = [];
let cart = JSON.parse(localStorage.getItem('deskwell_cart') || '{}'); // { id: qty }

const productGrid = document.getElementById('productGrid');
const cartItemsEl = document.getElementById('cartItems');
const cartTotalEl = document.getElementById('cartTotal');
const cartCountEl = document.getElementById('cartCount');
const checkoutTotalEl = document.getElementById('checkoutTotal');

function saveCart() {
  localStorage.setItem('deskwell_cart', JSON.stringify(cart));
}

function cartLines() {
  return Object.entries(cart)
    .map(([id, qty]) => ({ product: products.find(p => p.id === id), qty }))
    .filter(line => line.product);
}

function cartTotal() {
  return cartLines().reduce((sum, l) => sum + l.product.price * l.qty, 0);
}

function renderProducts() {
  productGrid.innerHTML = products.map(p => `
    <article class="product-card">
      <div class="product-media">
        <img src="${p.image}" alt="${p.name}" loading="lazy" />
        ${p.tag ? `<span class="product-tag">${p.tag}</span>` : ''}
      </div>
      <div class="product-body">
        <div class="product-category">${p.category}</div>
        <h3 class="product-name">${p.name}</h3>
        <p class="product-desc">${p.description}</p>
        <div class="product-footer">
          <span class="product-price">$${p.price.toFixed(2)}</span>
          <button class="add-btn" data-id="${p.id}">Add to cart</button>
        </div>
      </div>
    </article>
  `).join('');

  productGrid.querySelectorAll('.add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      cart[id] = (cart[id] || 0) + 1;
      saveCart();
      renderCart();
      openCart();
    });
  });
}

function renderCart() {
  const lines = cartLines();
  cartCountEl.textContent = lines.reduce((n, l) => n + l.qty, 0);

  if (lines.length === 0) {
    cartItemsEl.innerHTML = '<p class="cart-empty">Your cart is empty.</p>';
  } else {
    cartItemsEl.innerHTML = lines.map(l => `
      <div class="cart-item">
        <img src="${l.product.image}" alt="${l.product.name}" />
        <div class="cart-item-info">
          <div class="cart-item-name">${l.product.name}</div>
          <div class="cart-item-qty">
            <button data-id="${l.product.id}" data-delta="-1">−</button>
            <span>${l.qty}</span>
            <button data-id="${l.product.id}" data-delta="1">+</button>
            <button class="cart-item-remove" data-id="${l.product.id}" data-remove="1">Remove</button>
          </div>
        </div>
        <span>$${(l.product.price * l.qty).toFixed(2)}</span>
      </div>
    `).join('');
  }

  const total = cartTotal();
  cartTotalEl.textContent = `$${total.toFixed(2)}`;
  checkoutTotalEl.textContent = `$${total.toFixed(2)}`;

  cartItemsEl.querySelectorAll('button[data-delta]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const delta = Number(btn.dataset.delta);
      cart[id] = Math.max(0, (cart[id] || 0) + delta);
      if (cart[id] === 0) delete cart[id];
      saveCart();
      renderCart();
    });
  });
  cartItemsEl.querySelectorAll('button[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      delete cart[btn.dataset.id];
      saveCart();
      renderCart();
    });
  });
}

// Cart drawer open/close
const cartDrawer = document.getElementById('cartDrawer');
const scrim = document.getElementById('scrim');
function openCart() {
  cartDrawer.classList.add('open');
  scrim.classList.add('active');
}
function closeCart() {
  cartDrawer.classList.remove('open');
  scrim.classList.remove('active');
}
document.getElementById('cartToggle').addEventListener('click', openCart);
document.getElementById('cartClose').addEventListener('click', closeCart);
scrim.addEventListener('click', () => { closeCart(); closeCheckout(); });

// Checkout modal
const checkoutModal = document.getElementById('checkoutModal');
const checkoutForm = document.getElementById('checkoutForm');
const orderConfirmation = document.getElementById('orderConfirmation');

function openCheckout() {
  if (cartLines().length === 0) return;
  checkoutForm.hidden = false;
  orderConfirmation.hidden = true;
  checkoutModal.classList.add('open');
  scrim.classList.add('active');
}
function closeCheckout() {
  checkoutModal.classList.remove('open');
  scrim.classList.remove('active');
}
document.getElementById('checkoutBtn').addEventListener('click', () => {
  closeCart();
  openCheckout();
});
document.getElementById('checkoutClose').addEventListener('click', closeCheckout);

checkoutForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(checkoutForm);
  const customer = {
    name: formData.get('name'),
    email: formData.get('email'),
    address: formData.get('address')
  };
  const items = cartLines().map(l => ({ id: l.product.id, qty: l.qty }));

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, customer })
    });
    if (!res.ok) throw new Error('Order failed');
    const order = await res.json();

    cart = {};
    saveCart();
    renderCart();

    checkoutForm.hidden = true;
    orderConfirmation.hidden = false;
    document.getElementById('confirmationText').textContent =
      `Order ${order.id} placed for $${order.total.toFixed(2)}. A confirmation would normally be emailed to ${customer.email}.`;
  } catch (err) {
    alert('Something went wrong placing the order. Please try again.');
  }
});

document.getElementById('confirmationClose').addEventListener('click', closeCheckout);

// Init
fetch('/api/products')
  .then(res => res.json())
  .then(data => {
    products = data;
    renderProducts();
    renderCart();
  })
  .catch(() => {
    productGrid.innerHTML = '<p>Could not load products. Is the server running?</p>';
  });
