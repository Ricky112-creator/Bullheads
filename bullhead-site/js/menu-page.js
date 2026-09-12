// ============================================
// BULLHEAD — menu page: render items, handle qty,
// keep the floating order bar in sync
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('menuList');
  const barEl = document.getElementById('orderBar');
  const barCountEl = document.getElementById('orderBarCount');
  const barTotalEl = document.getElementById('orderBarTotal');
  if (!listEl) return;

  const categories = [...new Set(MENU_ITEMS.map((i) => i.category))];

  listEl.innerHTML = categories
    .map((cat) => {
      const items = MENU_ITEMS.filter((i) => i.category === cat);
      return `
        <div class="menu-category">
          <h3 class="menu-category-title">${cat}</h3>
          <div class="menu-items">
            ${items
              .map(
                (item) => `
              <div class="menu-item" data-id="${item.id}">
                <div class="menu-item-info">
                  <p class="menu-item-name">${item.name}</p>
                  <p class="menu-item-price">${formatKES(item.price)}</p>
                </div>
                <div class="qty-stepper" data-id="${item.id}">
                  <button class="qty-btn qty-minus" aria-label="Remove one ${item.name}">−</button>
                  <span class="qty-count">0</span>
                  <button class="qty-btn qty-plus" aria-label="Add one ${item.name}">+</button>
                </div>
              </div>`
              )
              .join('')}
          </div>
        </div>`;
    })
    .join('');

  function syncUI() {
    const cart = getCart();
    listEl.querySelectorAll('.qty-stepper').forEach((stepper) => {
      const id = stepper.dataset.id;
      stepper.querySelector('.qty-count').textContent = cart[id] || 0;
    });
    const count = cartCount(cart);
    const total = cartTotal(cart);
    if (barEl) {
      barEl.classList.toggle('visible', count > 0);
      if (barCountEl) barCountEl.textContent = count + (count === 1 ? ' item' : ' items');
      if (barTotalEl) barTotalEl.textContent = formatKES(total);
    }
  }

  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.qty-btn');
    if (!btn) return;
    const stepper = btn.closest('.qty-stepper');
    const id = stepper.dataset.id;
    changeQty(id, btn.classList.contains('qty-plus') ? 1 : -1);
    syncUI();
  });

  syncUI();
});
