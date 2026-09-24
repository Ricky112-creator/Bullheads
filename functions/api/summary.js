// GET /api/summary?date=YYYY-MM-DD -> owner only: the day's numbers (Nairobi time) + a WhatsApp-ready text
import { ensureSchema } from './push.js';
import { json, requireRole } from '../_lib/auth.js';
const TZ = 3 * 3600e3, TYPE = { 'dine-in': 'Dine in', delivery: 'Delivery', 'drive-through': 'Drive-through', reserve: 'Reservation', 'on-the-way': 'On my way' };

export async function onRequestGet({ request, env }) {
  const g = await requireRole(request, env, ['owner']);
  if (g.res) return g.res;
  let date = new URL(request.url).searchParams.get('date') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = new Date(Date.now() + TZ).toISOString().slice(0, 10);
  const start = Date.parse(date + 'T00:00:00Z') - TZ;
  try {
    await ensureSchema(env);
    const { results } = await env.DB.prepare('SELECT status, body FROM orders WHERE ts >= ? AND ts < ?').bind(new Date(start).toISOString(), new Date(start + 864e5).toISOString()).all();
    // Cancelled orders are ignored. Sales and top items count only orders staff marked DONE, because the
    // totals come from the customer's browser: an order nobody served (or a fake one) must not inflate the day.
    const rows = results.map((r) => ({ ...JSON.parse(r.body), status: r.status })).filter((o) => o.status !== 'cancelled');
    const orders = rows, done = rows.filter((o) => o.status === 'done');
    const types = {}, items = {}, hours = {};
    let sales = 0;
    orders.forEach((o) => {
      types[o.type] = (types[o.type] || 0) + 1;
      const h = new Date(Date.parse(o.ts) + TZ).getUTCHours(); hours[h] = (hours[h] || 0) + 1;
    });
    done.forEach((o) => {
      sales += o.total || 0;
      (o.items || []).forEach((i) => { items[i.name] = (items[i.name] || 0) + i.qty; });
    });
    const top = Object.entries(items).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const busy = Object.entries(hours).sort((a, b) => b[1] - a[1])[0];
    const pad = (h) => String(h).padStart(2, '0') + ':00';
    let text = `📊 Bullhead summary, ${new Date(start + TZ).toUTCString().slice(0, 16)}\nOrders: ${orders.length} (${done.length} completed)\nSales: KES ${sales.toLocaleString('en-KE')} (completed orders)`;
    if (orders.length) {
      text += '\n\nBy type:\n' + Object.entries(types).map(([t, n]) => `• ${TYPE[t] || t || 'Other'}: ${n}`).join('\n');
      if (top.length) text += '\n\nTop items (completed orders):\n' + top.map(([n, q], i) => `${i + 1}. ${n} (${q})`).join('\n');
      if (busy) text += `\n\nBusiest hour: ${pad(busy[0])} to ${pad(+busy[0] + 1)} (${busy[1]} orders)`;
    } else text += '\n\nNo orders sent through the website this day.';
    text += '\n\n(Website orders only. Walk-in sales are not counted. Orders count as sales once marked Done.)';
    return json({ date, orders: orders.length, completed: done.length, sales, text });
  } catch (e) { return json({ error: String(e.message || e) }, { status: 500 }); }
}
