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

## Before you take real money

Two things are intentionally mocked so you can run this immediately —
swap them out before launching for real:

1. **Payments.** Checkout currently just records the order — no card is
   charged. Add [Stripe Checkout](https://stripe.com/docs/checkout/quickstart)
   or similar in `server.js`'s `/api/orders` route before going live.
2. **Supplier fulfillment.** Orders are just written to a JSON file. For
   real dropshipping, connect a supplier with an API or plugin —
   e.g. AliExpress via [CJdropshipping](https://cjdropshipping.com) or
   [Spocket](https://www.spocket.co) — so orders forward automatically.

## Customize

- Swap products in `data/products.json` — add real supplier images and pricing
- Brand colors and type live at the top of `public/styles.css` (`:root` block)
- Deploy anywhere that runs Node: Render, Railway, Fly.io, or a VPS
