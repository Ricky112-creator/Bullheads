// ============================================
// BULLHEAD — cart (localStorage-backed, no server)
// ============================================

const CART_KEY = 'bullheadCart';

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

function setCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function changeQty(id, delta) {
  const cart = getCart();
  const next = Math.max(0, Math.round(((cart[id] || 0) + delta) * 100) / 100);
  if (next === 0) {
    delete cart[id];
  } else {
    cart[id] = next;
  }
  setCart(cart);
  return cart;
}

function clearCart() {
  localStorage.removeItem(CART_KEY);
}

function cartCount(cart) {
  return Object.values(cart).reduce((a, b) => a + b, 0);
}

function cartLines(cart) {
  return Object.entries(cart)
    .map(([id, qty]) => {
      const item = MENU_ITEMS.find((i) => i.id === id);
      if (!item || typeof item.price !== 'number' || item.soldOut) return null;
      return { ...item, qty, lineTotal: item.price * qty };
    })
    .filter(Boolean);
}

function cartTotal(cart) {
  return cartLines(cart).reduce((sum, l) => sum + l.lineTotal, 0);
}

function formatKES(n) {
  return 'KES ' + n.toLocaleString('en-KE');
}

// Owner's live menu board (/api/menu): price changes, sold-out / back-at, today's special.
// Applies the overrides onto MENU_ITEMS in place; resolves either way so pages never break.
function applyMenuOverrides() {
  return fetch('/api/menu')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const o = (d && d.menu) || {};
      const now = Date.now();
      // Dishes the owner added from the dashboard: re-sync them on every refresh.
      for (let i = MENU_ITEMS.length - 1; i >= 0; i--) if (MENU_ITEMS[i].custom) MENU_ITEMS.splice(i, 1);
      ((d && d.custom) || []).forEach((c) => {
        if (!MENU_ITEMS.some((x) => x.id === c.id)) MENU_ITEMS.push({ id: c.id, category: c.category, name: c.name, price: c.price, unit: c.unit || undefined, custom: true });
      });
      MENU_ITEMS.forEach((it) => {
        const m = o[it.id] || {};
        if (typeof m.price === 'number') it.price = m.price;
        it.special = !!m.special;
        const until = m.until ? new Date(m.until).getTime() : 0;
        it.soldOut = !!m.soldOut && (!until || until > now);
        it.backAt = it.soldOut && until ? m.until : null;
      });
      const cart = getCart();
      let changed = false;
      MENU_ITEMS.forEach((it) => { if (it.soldOut && cart[it.id]) { delete cart[it.id]; changed = true; } });
      if (changed) setCart(cart);
    })
    .catch(() => {});
}
