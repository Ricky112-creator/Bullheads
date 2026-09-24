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

Staff codes are made in `/tools` (owner only). Staff can see orders, confirm them and move them along. Nothing else.

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
