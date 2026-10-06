// Menu structured data (schema.org Menu) for the /menu page.
// Built on every request from the SAME sources the site itself uses: the price list in menu-data.js, plus the owner's
// saved board in KV (price changes, sold-out items, dishes added from the dashboard). So what search engines read
// always matches what customers see. Any problem returns '' and the page is served exactly as before.
import menuData from '../../bullhead-site/js/menu-data.js';

const parse = (raw, fallback) => { try { return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; } };

export async function menuJsonLd(env, branch, origin) {
  const [shared, own, cust] = await Promise.all([
    env.UPDATES_KV.get('menu'),
    branch ? env.UPDATES_KV.get('menu:' + branch) : null,
    env.UPDATES_KV.get('menu-custom'),
  ]);
  const board = parse(own || shared, {});            // same rule as GET /api/menu: the branch's board wins, else the shared one
  const custom = parse(cust, []);
  const now = Date.now();
  const sections = new Map();

  for (const base of [...menuData.MENU_ITEMS, ...(Array.isArray(custom) ? custom : [])]) {
    if (!base || !base.name || !base.category) continue;
    const m = board[base.id] || {};
    const until = m.until ? Date.parse(m.until) : 0;
    if (m.soldOut && (!until || until > now)) continue;   // sold out right now: not offered
    const price = typeof m.price === 'number' ? m.price : base.price;
    const item = { '@type': 'MenuItem', name: String(base.name) };
    if (typeof price === 'number') {
      item.offers = base.unit === 'kg'
        ? { '@type': 'Offer', priceCurrency: 'KES', priceSpecification: { '@type': 'UnitPriceSpecification', price: String(price), priceCurrency: 'KES', referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'KGM' } } }
        : { '@type': 'Offer', price: String(price), priceCurrency: 'KES' };
    }
    if (!sections.has(base.category)) sections.set(base.category, []);
    sections.get(base.category).push(item);
  }
  if (!sections.size) return '';

  const doc = {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    name: 'Bullhead menu',
    url: origin + '/menu',
    inLanguage: 'en',
    hasMenuSection: [...sections].map(([name, items]) => ({ '@type': 'MenuSection', name, hasMenuItem: items })),
  };
  // '<' escaped so no dish name can ever close the script tag early
  return '<script type="application/ld+json">' + JSON.stringify(doc).replace(/</g, '\\u003c') + '</script>';
}
