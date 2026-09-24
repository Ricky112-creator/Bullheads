# Bullhead — prototype site

Static pages plus Cloudflare Pages Functions (`../functions`) for orders, tracking, the owner dashboard, gallery and push alerts. No build step and nothing to install: GSAP and Lenis load from CDN in the browser. **Everything runs on free tiers. See [SETUP.md](SETUP.md) for the bindings, secrets and limits.**

## Preview locally
Run a local server from this folder (don't just double-click index.html — the order/cart flow needs a real origin to work correctly):
```
python3 -m http.server 8000
```
then visit `http://localhost:8000`

## Push to GitHub
```
git init
git add .
git commit -m "Bullhead prototype"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

## Deploy on Cloudflare Pages
1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git
2. Select this repo
3. Build settings: **Framework preset: None**, **Build command: (leave empty)**, **Build output directory: `bullhead-site`**, root directory blank (so `functions/` sits at the repo root). Then add the bindings and secrets in [SETUP.md](SETUP.md)
4. Deploy — you'll get a `*.pages.dev` URL immediately, and can attach a custom domain after

## Pages
- `index.html` — Home (hero + always-on strip + condensed story + look-around teasers)
- `menu.html` — interactive menu: tap +/− to build an order, floating bar shows running total
- `visit.html` — both locations with real embedded Google Maps, hours, contact, till number
- `contact.html` — order summary carried over from Menu, name/location/notes form, sends the whole order to WhatsApp as a pre-filled message

Nav and footer are duplicated in each file (no build tool, no templating — plain static pages). If you add a page or change the nav links, update all four files.

## The ordering flow (menu.html → contact.html → track.html)
- Item data and prices live in `js/menu-data.js`; the owner can override prices / sold-out / specials from the dashboard (`/api/menu`)
- Cart logic (`js/cart.js`) keeps selections in the browser's localStorage under `bullheadCart`
- On Contact, the form records the order (`POST /api/orders`, and waits for the answer), THEN opens `wa.me` with the same order plus a short order code (`#K7Q2M`) and a tracking link. The customer still has to press Send in WhatsApp
- **The dashboard is the order; the WhatsApp message is the receipt.** Orders that only have the website's word for it start as `unconfirmed`; staff confirm them (they see the code in WhatsApp, or call/WhatsApp the customer from the card). Table-QR orders (`?table=N`, dine-in) start as `new`
- The tracking page (`/track?o=<id>`) shows progress and keeps a "Send on WhatsApp" button while the order is unconfirmed, so a blocked pop-up or a closed tab loses nothing
- A phone number is required (except for table-QR orders). It is wiped from the database 30 days after the order

## What's placeholder right now (swap once real assets/details land)
- All images in `assets/img/` are your phone shots — every one gets replaced with final photography
- Menu prices in `js/menu-data.js` — confirm with the client
- Google Maps "Get directions" links use name-search URLs; the embedded maps use the real Place IDs already
- Kitchen section captions describe the room, not dishes — once food photography exists, swap in actual plated shots
- **Delivery as an order type is on the Contact page now — confirm with the client whether they actually run delivery (own riders, boda partnership, etc.) before this ships. If they don't, remove the "Delivery" button in `contact.html`'s order-type group and its field block, or the form will collect orders nobody can fulfill.**

## What NOT to touch without checking first
- `.strip` section text-reveal in `main.js` is tied to word-splitting the exact sentence in each page's `.strip-line` element — if you edit that sentence, the reveal still works, it just re-splits on spaces automatically
- The Ken Burns hero zoom and the word-by-word strip reveal are deliberately the *only* two scroll-triggered animation moments — resist adding a fade-in to every section, that's what makes it look hand-built instead of templated
- Script load order in `menu.html` and `contact.html` matters: `menu-data.js` → `cart.js` → the page-specific script → `main.js`. Moving these will break the cart.
