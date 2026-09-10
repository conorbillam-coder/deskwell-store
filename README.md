# Deskwell — a simple dropshipping storefront

A minimal, working e-commerce store: product catalog, cart, and checkout,
built with plain HTML/CSS/JS on the frontend and a small Express API on
the backend. No build tools required. This is a **starter you sell from**,
not a demo — but two things are stubbed out on purpose (see "Before you
take real money" below).

## What's included

- `server.js` — Express API: product listing, single product lookup, order creation
- `data/products.json` — your product catalog (edit this to change what you sell)
- `public/` — the storefront itself (HTML/CSS/JS, no framework)
- Cart persists in the browser via `localStorage`
- Orders are saved to `data/orders.json` on checkout (gitignored — it's local data, not code)

## Run it locally

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

## Push it to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Deskwell storefront"
gh repo create deskwell-store --private --source=. --push
```

(No `gh` CLI? Create an empty repo on github.com, then:
`git remote add origin <your-repo-url>` and `git push -u origin main`.)

## How the dropshipping model works here

Each product in `data/products.json` has both a `price` (what you charge)
and a `supplierCost` (what you'd pay a supplier) — that gap is your margin.
When an order comes in:

1. It's saved via `POST /api/orders` (see `data/orders.json`)
2. You (or an automation) place the matching order with your supplier,
   shipping directly to the customer's address from the order
3. You keep the difference between `price` and `supplierCost`

## Set up Stripe (real payments)

Checkout uses [Stripe Checkout](https://stripe.com/docs/payments/checkout) —
Stripe hosts the actual payment page, so card numbers never touch this
server.

1. Create a free account at [stripe.com](https://stripe.com).
2. In the Stripe Dashboard, make sure you're in **Test mode** (toggle top
   right) and go to **Developers → API keys**. Copy the **Secret key**
   (starts with `sk_test_...`).
3. Locally: copy `.env.example` to `.env` and paste your key in:
   ```
   STRIPE_SECRET_KEY=sk_test_your_real_key_here
   ```
   `.env` is gitignored — it never gets pushed to GitHub.
4. On Render (or wherever you deployed): open your service → **Environment**
   → add an environment variable named `STRIPE_SECRET_KEY` with the same
   value. Redeploy after adding it.
5. Test with Stripe's test card: card number `4242 4242 4242 4242`, any
   future expiry date, any 3-digit CVC, any postal code. This simulates a
   successful payment without charging anyone.

**Going live:** once you're ready to accept real cards, finish Stripe's
account activation (business details, bank account for payouts), switch
the Dashboard to **Live mode**, and swap in your `sk_live_...` key in place
of the test key — both locally and on Render.

## Supplier fulfillment

Orders are saved to `data/orders.json` once Stripe confirms payment. Each
product in `data/products.json` also carries a `cjUrl` pointing at its real
CJdropshipping listing — when an order comes in, open that link and place
the matching order with the customer's shipping address from the order
record. See the margin note above for how `price` vs `supplierCost` works.

For higher order volume, this is the point where you'd connect a supplier
API (CJdropshipping has one) to place that order automatically instead of
by hand.

## Customize

- Swap products in `data/products.json` — add real supplier images and pricing
- Brand colors and type live at the top of `public/styles.css` (`:root` block)
- Deploy anywhere that runs Node: Render, Railway, Fly.io, or a VPS
