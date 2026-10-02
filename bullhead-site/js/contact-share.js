(function () {
  var btn = document.getElementById('shareOrderBtn');
  var hint = document.getElementById('shareOrderHint');
  if (!btn || !hint || typeof getCart !== 'function') return;

  function encodeCart(cart) {
    return Object.entries(cart).map(function (pair) {
      return pair[0] + ':' + pair[1];
    }).join(',');
  }

  btn.addEventListener('click', function () {
    var cart = getCart();
    if (!cart || Object.keys(cart).length === 0) {
      hint.hidden = false;
      hint.textContent = "Nothing to share yet — build an order on the Menu first.";
      return;
    }
    var url = window.location.origin + '/menu?order=' + encodeURIComponent(encodeCart(cart));

    if (navigator.share) {
      navigator.share({ title: 'Bullhead order', url: url }).catch(function () {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        hint.hidden = false;
        hint.textContent = 'Link copied — paste it to whoever\'s ordering: ' + url;
      }).catch(function () {
        hint.hidden = false;
        hint.textContent = url;
      });
    } else {
      hint.hidden = false;
      hint.textContent = url;
    }
  });
})();
