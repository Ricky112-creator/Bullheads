// ============================================
// BULLHEAD — small helpers shared by the order form, the tracking page and the dashboard
// ============================================

// Short code for an order, worked out from its id: the same id always gives the same code, on every
// page. It goes into the WhatsApp message, the tracking page and the dashboard card, so a message the
// customer edited (or resent) can still be matched to the right order at a glance. 32^5 = 33 million codes.
function orderCode(id) {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';           // no I, O, 0, 1
  let n = parseInt(String(id || '').replace(/-/g, '').slice(0, 10), 16);
  if (!isFinite(n)) return '';
  let s = '';
  for (let i = 0; i < 5; i++) { s = A[n % 32] + s; n = Math.floor(n / 32); }
  return s;
}

// A Kenyan mobile number in any usual spelling (0712 345 678, +254 712 345 678, 712345678...)
// -> '254712345678', or '' if it doesn't look like one. Keep in step with normPhone() in functions/api/orders.js.
function normPhoneKE(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.indexOf('254') === 0) d = d.slice(3);
  else if (d.indexOf('0') === 0) d = d.slice(1);
  return /^[17]\d{8}$/.test(d) ? '254' + d : '';
}
