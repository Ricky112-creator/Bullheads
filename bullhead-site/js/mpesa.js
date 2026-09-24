// ============================================
// BULLHEAD — M-Pesa "pay ahead" card
// One place for the Till number. Used by the order confirmation (contact.html)
// and the tracking page (track.html). Change the number here and both update.
// (visit.html still has its own copy of the number in its text.)
// ============================================

const MPESA_TILL = '3502492'; // Lipa na M-Pesa, Buy Goods Till

// Returns a ready-made <div> card. `total` is the order amount in KES (0 = don't show an amount).
function mpesaCard(total) {
  const el = (tag, css, text) => {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  };

  const card = el('div', 'margin-top:16px;padding:18px;border-radius:16px;background:#fff;border:2px solid var(--green);color:var(--ink);text-align:left;');
  card.id = 'mpesaCard';

  card.appendChild(el('div', 'font-weight:700;font-size:1.02rem;', '💚 Pay ahead with M-Pesa (optional)'));
  card.appendChild(el('div', 'color:var(--cognac);font-weight:600;font-size:.86rem;margin-bottom:12px;', 'Lipa mapema kwa M-Pesa (si lazima)'));
  card.appendChild(el('div', 'font-size:.9rem;color:var(--ink-soft);', 'M-Pesa → Lipa na M-Pesa → Buy Goods and Services'));

  const row = el('div', 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0 4px;padding:12px 14px;border-radius:12px;background:var(--cream);');
  const left = el('div');
  left.appendChild(el('div', 'font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-soft);', 'Till number'));
  left.appendChild(el('div', 'font-family:var(--font-display);font-size:1.7rem;font-weight:700;letter-spacing:.06em;line-height:1.2;', MPESA_TILL));
  row.appendChild(left);

  const btn = el('button', 'flex:none;padding:10px 16px;border:0;border-radius:999px;background:var(--green);color:#fff;font-weight:600;font-size:.9rem;cursor:pointer;', 'Copy');
  btn.type = 'button';
  const flash = () => { btn.textContent = 'Copied ✓'; setTimeout(() => { btn.textContent = 'Copy'; }, 1800); };
  const fallback = () => {
    const t = document.createElement('textarea');
    t.value = MPESA_TILL; t.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(t); t.select();
    try { if (document.execCommand('copy')) flash(); } catch (e) {}
    t.remove();
  };
  btn.addEventListener('click', () => {
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(MPESA_TILL).then(flash, fallback);
    else fallback();
  });
  row.appendChild(btn);
  card.appendChild(row);

  if (total > 0) {
    card.appendChild(el('div', 'margin-top:8px;font-weight:700;', 'Amount: KES ' + Number(total).toLocaleString('en-KE')));
  }
  card.appendChild(el('div', 'margin-top:8px;font-size:.82rem;color:var(--ink-soft);', 'Prefer to pay at the counter? That works too. Karibu.'));
  return card;
}
