// ============================================
// BULLHEAD — menu page: render items, handle qty,
// keep the floating order bar in sync
// ============================================

// Item names/categories can be typed in by the owner (custom dishes), so escape them before they go into innerHTML.
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('menuList');
  const barEl = document.getElementById('orderBar');
  const barCountEl = document.getElementById('orderBarCount');
  const barTotalEl = document.getElementById('orderBarTotal');
  if (!listEl) return;

  let categories = [];

  function soldLabel(item) {
    if (!item.backAt) return 'Sold out';
    return 'Back at ' + new Date(item.backAt).toLocaleTimeString('en-KE', { timeZone: 'Africa/Nairobi', hour: 'numeric', minute: '2-digit' });
  }

  function priceLabel(item) {
    if (typeof item.price !== 'number') return 'Ask staff';
    return item.unit === 'kg' ? `${formatKES(item.price)} / kg` : formatKES(item.price);
  }

  function qtyLabel(item, qty) {
    if (item.unit === 'kg') return qty.toFixed(1).replace(/\.0$/, '') + ' kg';
    return String(qty);
  }

  function draw() {
  categories = [...new Set(MENU_ITEMS.map((i) => i.category))];
  listEl.innerHTML = categories
    .map((cat) => {
      const items = MENU_ITEMS.filter((i) => i.category === cat).sort((a, b) => (b.special ? 1 : 0) - (a.special ? 1 : 0));
      return `
        <div class="menu-category">
          <h3 class="menu-category-title">${esc(cat)}</h3>
          <div class="menu-items">
            ${items
              .map((item) => {
                const unpriced = typeof item.price !== 'number';
                return `
              <div class="menu-item${item.soldOut ? ' is-sold' : ''}${item.special ? ' is-special' : ''}" data-id="${esc(item.id)}">
                <div class="menu-item-info">
                  <p class="menu-item-name">${esc(item.name)}${item.special ? ' <span class="tag-special">★ Today\'s special</span>' : ''}</p>
                  <p class="menu-item-price${unpriced ? ' unpriced' : ''}">${priceLabel(item)}</p>
                </div>
                ${item.soldOut
                  ? `<span class="menu-item-unavailable sold-tag">${soldLabel(item)}</span>`
                  : unpriced
                  ? `<span class="menu-item-unavailable">Not yet orderable — ask staff</span>`
                  : `<div class="qty-stepper" data-id="${esc(item.id)}" data-unit="${item.unit || ''}">
                      <button class="qty-btn qty-minus" aria-label="Remove ${item.unit === 'kg' ? 'half a kg of' : 'one'} ${esc(item.name)}">−</button>
                      <span class="qty-count">${item.unit === 'kg' ? '0 kg' : '0'}</span>
                      <button class="qty-btn qty-plus" aria-label="Add ${item.unit === 'kg' ? 'half a kg of' : 'one'} ${esc(item.name)}">+</button>
                    </div>`
                }
              </div>`;
              })
              .join('')}
          </div>
        </div>`;
    })
    .join('');
  }

  function syncUI() {
    const cart = getCart();
    listEl.querySelectorAll('.qty-stepper').forEach((stepper) => {
      const id = stepper.dataset.id;
      const item = MENU_ITEMS.find((i) => i.id === id);
      const qty = cart[id] || 0;
      stepper.querySelector('.qty-count').textContent = item ? qtyLabel(item, qty) : qty;
    });
    const itemCount = Object.keys(cart).length;
    const total = cartTotal(cart);
    if (barEl) {
      barEl.classList.toggle('visible', itemCount > 0);
      if (barCountEl) barCountEl.textContent = itemCount + (itemCount === 1 ? ' item' : ' items');
      if (barTotalEl) barTotalEl.textContent = formatKES(total);
    }
  }

  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.qty-btn');
    if (!btn) return;
    const stepper = btn.closest('.qty-stepper');
    const id = stepper.dataset.id;
    const step = stepper.dataset.unit === 'kg' ? 0.5 : 1;
    changeQty(id, btn.classList.contains('qty-plus') ? step : -step);
    syncUI();
  });

  draw();
  syncUI();
  // Pull the owner's live menu board now, then every 30s while the page is open.
  const refreshBoard = () => document.hidden ? Promise.resolve() : applyMenuOverrides().then(() => { draw(); syncUI(); });
  refreshBoard();
  setInterval(refreshBoard, 30000);
});
