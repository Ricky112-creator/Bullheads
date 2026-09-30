# Bullhead — setup, limits and upkeep (free tier only)

Everything here runs on Cloudflare Pages + GitHub free plans. Nothing below needs a paid product.

## Cloudflare Pages project
- Connect the GitHub repo. Framework preset **None**, build command **empty**, build output directory **`bullhead-site`**, root directory **blank** (so `functions/` at the repo root is picked up).
- `bullhead-site/_routes.json` keeps images, CSS and JS out of the Functions request count. Leave it.

## Bindings (Pages → Settings → Functions)
| Name | Type | Used for |
|---|---|---|
| `DB` | D1 database | orders, staff logins, photos, push subscriptions, tap counts, rate limits. Tables create themselves on first use |
| `UPDATES_KV` | KV namespace | owner "updates" bar and the menu board overrides |
| `AI` | Workers AI (optional) | the "Draft it for me" Swahili button. Without it the button says it isn't enabled |

## Secrets (Pages → Settings → Variables and Secrets)
| Name | What |
|---|---|
| `ADMIN_TOKEN` | the owner's access code. Make it long and random (20+ characters), not a phrase |
| `VAPID_PUBLIC`, `VAPID_PRIVATE` | phone-alert keys. Generate once, free: `npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | optional `mailto:` or `https:` contact for the push service |

### Changing the owner code from the dashboard
Dashboard → gear icon (top right) → **Change access code**. The new code (8+ characters) is stored in D1, hashed with a random salt, and **replaces** `ADMIN_TOKEN`: the old code stops working at once and every other phone signed in with it is signed out. Staff codes are not affected.

If the owner ever forgets the new code: Cloudflare → Storage & Databases → D1 → the database → Console, run `DELETE FROM settings WHERE k = 'owner_code';`. The `ADMIN_TOKEN` secret works again.

Staff codes are made in `admin.bullheadhotels.co.ke/tools` (owner only). Staff can see orders, confirm them and move them along. Nothing else.

## How an order moves
`unconfirmed → new → preparing → ready → done` (or `cancelled`)
- The website records the order first, then opens WhatsApp. Both carry the same short code (`#K7Q2M`).
- Staff confirm an unconfirmed order once its WhatsApp message arrives (match the code), or after calling / messaging the customer from the card.
- Table-QR dine-in orders (`?table=N`) start as `new`.
- An unconfirmed order nobody touched for 24 hours is cancelled automatically.
- Daily summary and dashboard "sales" count only orders marked **done**.

## Privacy housekeeping (automatic, runs when new orders arrive)
- Phone, address and delivery pin are removed from an order 30 days after it was placed.
- The address fingerprint used for rate limiting is removed after one day.

## Free-tier ceilings to keep in mind
- **Functions:** 100,000 requests a day. Every `/api/*` call counts. The tracking page polls every 15 s while a customer waits, and pages pause polling when hidden.
- **KV:** 1,000 writes a day. Only the owner's menu and update saves write to KV. The public site never does.
- **D1:** generous for this use. Public writes are rate limited (orders, taps, wrong codes).
- **Builds:** Pages allows 500 builds a month on the free plan. Each push to `main` (and each preview branch push) is a build, so batch commits and push once.
- **Photos** are stored in D1 (max 60, about 450 KB each) with a small thumbnail each, and served through the Cache API on the custom domain. If the gallery ever outgrows this, move images to Cloudflare R2 (needs a card on file, so only with the client's OK).

## Optional, free: one Cloudflare rate-limiting rule
Cloudflare dashboard → the domain → Security → WAF → Rate limiting rules. One rule is free. Suggested: URI path starts with `/api/`, more than 100 requests per 10 seconds per IP → block for 10 minutes. It protects the daily Functions quota from a single noisy client.

## Keeping WhatsApp and the dashboard in step (no WhatsApp Cloud API)
There is no way for a website to know whether a `wa.me` message was sent, edited or ignored, so the design avoids needing to know: the dashboard order is the source of truth, the phone number lets staff reach people who never pressed Send, and the code links any WhatsApp message back to its order. If the client ever wants automatic two-way sync, that is the WhatsApp Business Platform (Cloud API), which needs Meta business verification and a dedicated number.

## Branch sites (branch1. and branch2.)
One repo, one Pages project, one database. Three addresses serve the same files:
`bullheadhotels.co.ke` (both counters, customer picks one), `branch1.bullheadhotels.co.ke` (Bullhead One), `branch2.bullheadhotels.co.ke` (Bullhead Two).

**To switch them on (nothing else to create or pay for):**
1. Cloudflare → Workers & Pages → the project → **Custom domains** → add `branch1.bullheadhotels.co.ke`, then `branch2.bullheadhotels.co.ke`. DNS records are added for you because the domain is on Cloudflare.
2. Dashboard → Tools → **Staff logins**: make one login per branch (pick the branch when you create it). Logins made before branches existed still see both branches until you move them with the dropdown next to their name.
3. On each branch's staff phone: open `admin.bullheadhotels.co.ke`, sign in with that branch's code, tap the bell. On your own phone pick "All branches" in the box next to the bell.
4. Print each counter's table QR posters from `admin.bullheadhotels.co.ke/qr`, choosing that branch in the **For** picker, so scans land on the right site.
5. Google Business Profile: set each branch's website to its own address, e.g. `https://branch1.bullheadhotels.co.ke/?utm_source=google&utm_medium=organic&utm_campaign=gbp`.
6. Search Console: a Domain property for `bullheadhotels.co.ke` already covers subdomains. Submit `https://branch1.bullheadhotels.co.ke/sitemap.xml` and the `branch2` one (each is generated for its own address).

**How it behaves**
- The hostname decides the branch. An order placed on `branch2.` is a Bullhead Two order whatever the browser sends. On the main site the counter the customer picks decides; "Either" orders have no branch and show to every branch (whoever confirms it first takes it).
- A branch staff login sees and moves only its branch's orders and gets only that branch's phone alerts. The owner sees everything, or one branch with the Both / One / Two chips on the Orders tab. Insights has a "By counter" block; the daily summary in `/tools` can be run for both or one branch.
- Menu board: **Menu tab → Editing the board for**. "Both" is the shared board. Saving a board for one branch overrides the shared one on that branch's site only (e.g. sold out of tilapia at Bullhead Two). The main site always shows the shared board.
- Updates bar: each notice can be shown on both sites or one branch. The main site shows all of them.
- Numbers and tills that can differ per branch live in `js/branches.js` (WhatsApp number, phone, M-Pesa till). Change them there and order messages, call/WhatsApp links and the pay-ahead card follow.
- Search engines get per-branch canonical URLs, one Restaurant entry per site, and a sitemap/robots/manifest for the branch's own address. This is done in `functions/_middleware.js` before the page leaves Cloudflare, so it works without JavaScript.
- Preview before DNS is ready: open any preview deployment with `?branch=one` (or `two`; `?branch=off` to leave). It only works on `localhost` and `*.pages.dev`.

**Limits to know about**
- The cart is stored per address, so a cart started on the main site does not follow a customer to a branch site.
- Every page view on a branch address still counts once against the 100,000 daily Functions requests (as the main site already did), and all three addresses share that quota.
- To add a third branch: `functions/_lib/branches.js`, `js/branches.js`, a Custom domain, and mark its blocks with `data-branch` / `data-only`.

