(function () {
  function encodeCart(cart) {
    return Object.entries(cart).map(function (p) { return p[0] + ':' + p[1]; }).join(',');
  }
  function decodeCart(str) {
    var cart = {};
    str.split(',').forEach(function (pair) {
      var parts = pair.split(':');
      var id = parts[0];
      var qty = parseFloat(parts[1]);
      if (id && !isNaN(qty) && qty > 0 && MENU_ITEMS.some(function (i) { return i.id === id; })) {
        cart[id] = qty;
      }
    });
    return cart;
  }

  var params = new URLSearchParams(window.location.search);
  var orderParam = params.get('order');
  var loadedSharedOrder = false;

  if (orderParam) {
    var shared = decodeCart(orderParam);
    if (Object.keys(shared).length > 0) {
      setCart(shared);
      loadedSharedOrder = true;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var banner = document.getElementById('repeatOrderBanner');
    if (!banner) return;

    if (loadedSharedOrder) {
      banner.hidden = false;
      banner.textContent = 'Order loaded from a shared link — review it below.';
      return;
    }

    var current = getCart();
    if (Object.keys(current).length > 0) return;

    var raw = localStorage.getItem('bullheadLastOrder');
    if (!raw) return;
    try {
      var saved = JSON.parse(raw);
      var items = saved.items || {};
      if (Object.keys(items).length === 0) return;

      banner.hidden = false;
      banner.innerHTML = 'Order the same as last time? <button type="button" id="repeatOrderBtn" style="margin-left:8px; text-decoration:underline; background:none; border:none; cursor:pointer; color:inherit;">Repeat order</button>';
      document.getElementById('repeatOrderBtn').addEventListener('click', function () {
        setCart(items);
        window.location.reload();
      });
    } catch (e) {}
  });
})();
