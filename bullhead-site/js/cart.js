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
  const next = Math.max(0, (cart[id] || 0) + delta);
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
      if (!item) return null;
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
