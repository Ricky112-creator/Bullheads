// ============================================
// BULLHEAD — contact page: show order summary,
// take name/location/notes, send to WhatsApp
// ============================================

const ORDER_WHATSAPP_NUMBER = '254720707323';

document.addEventListener('DOMContentLoaded', () => {
  const summaryEl = document.getElementById('orderSummary');
  const emptyEl = document.getElementById('orderEmpty');
  const totalEl = document.getElementById('orderTotal');
  const totalRowEl = document.getElementById('orderTotalRow');
  const form = document.getElementById('orderForm');
  const tableBannerEl = document.getElementById('tableBanner');
  if (!summaryEl) return;

  const activeTable = typeof getActiveTable === 'function' ? getActiveTable() : null;
  if (activeTable && tableBannerEl) {
    tableBannerEl.hidden = false;
    tableBannerEl.textContent = `Ordering for Table ${activeTable}`;
  }

  // --- Order type toggle ---
  const orderTypeInput = document.getElementById('orderType');
  const typeButtons = document.querySelectorAll('.order-type-btn');
  const fieldPartySize = document.getElementById('field-partySize');
  const fieldAddress = document.getElementById('field-address');
  const fieldPickupTime = document.getElementById('field-pickupTime');
  const fieldReserveDateTime = document.getElementById('field-reserveDateTime');
  const fieldEta = document.getElementById('field-eta');
  const reserveDateInput = document.getElementById('reserveDate');

  const today = new Date().toISOString().split('T')[0];
  if (reserveDateInput) reserveDateInput.min = today;

  const FIELD_VISIBILITY = {
    'dine-in':       { partySize: true,  address: false, pickupTime: true,  reserveDateTime: false },
    'delivery':      { partySize: false, address: true,  pickupTime: false, reserveDateTime: false },
    'drive-through': { partySize: false, address: false, pickupTime: true,  reserveDateTime: false },
    'reserve':       { partySize: true,  address: false, pickupTime: false, reserveDateTime: true  },
    'on-the-way':    { partySize: false, address: false, pickupTime: false, reserveDateTime: false },
  };

  function applyOrderType(type) {
    orderTypeInput.value = type;
    typeButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.type === type));
    const v = FIELD_VISIBILITY[type];
    fieldPartySize.hidden = !v.partySize;
    fieldAddress.hidden = !v.address;
    fieldPickupTime.hidden = !v.pickupTime;
    fieldReserveDateTime.hidden = !v.reserveDateTime;
    if (fieldEta) fieldEta.hidden = type !== 'on-the-way';

    // required attributes follow visibility, so hidden fields never block submit
    document.getElementById('address').required = v.address;
    document.getElementById('partySize').required = type === 'reserve';
    document.getElementById('reserveDate').required = v.reserveDateTime;
    document.getElementById('reserveTime').required = v.reserveDateTime;
  }

  typeButtons.forEach((btn) => {
    btn.addEventListener('click', () => applyOrderType(btn.dataset.type));
  });
  applyOrderType('dine-in');

  function render() {
    const cart = getCart();
    const lines = cartLines(cart);

    if (lines.length === 0) {
      summaryEl.hidden = true;
      emptyEl.hidden = false;
      totalRowEl.hidden = true;
      return;
    }
    summaryEl.hidden = false;
    emptyEl.hidden = true;
    totalRowEl.hidden = false;

    summaryEl.innerHTML = lines
      .map((l) => {
        const qtyText = l.unit === 'kg'
          ? `${l.qty.toFixed(1).replace(/\.0$/, '')} kg`
          : `${l.qty} ×`;
        return `
      <div class="order-line" data-id="${l.id}">
        <span class="order-line-name">${qtyText} ${l.name}</span>
        <span class="order-line-total">${formatKES(l.lineTotal)}</span>
        <button type="button" class="order-line-remove" aria-label="Remove ${l.name}">×</button>
      </div>`;
      })
      .join('');

    totalEl.textContent = formatKES(cartTotal(cart));
  }

  summaryEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.order-line-remove');
    if (!btn) return;
    const id = btn.closest('.order-line').dataset.id;
    const cart = getCart();
    delete cart[id];
    setCart(cart);
    render();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.textContent : '';

    const cart = getCart();
    const lines = cartLines(cart);
    const type = orderTypeInput.value;
    const name = form.name.value.trim();
    const location = form.location.value;
    const notes = form.notes.value.trim();
    const partySize = form.partySize.value;
    const address = form.address.value.trim();
    const pickupTime = form.pickupTime.value;
    const reserveDate = form.reserveDate.value;
    const reserveTime = form.reserveTime.value;

    const TYPE_LABELS = {
      'dine-in': 'Dine In',
      'delivery': 'Delivery',
      'drive-through': 'Drive-Through Pickup',
      'reserve': 'Table Reservation',
      'on-the-way': 'ON MY WAY (pre-order)',
    };

    let liveLocationUrl = '';

    // If order is Delivery, request live GPS location coordinates
    if (type === 'delivery' && 'geolocation' in navigator) {
      if (submitBtn) submitBtn.textContent = 'Getting location...';
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 8000
          });
        });
        const { latitude, longitude } = position.coords;
        liveLocationUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
      } catch (err) {
        console.warn('Geolocation permission denied or timed out:', err);
      } finally {
        if (submitBtn) submitBtn.textContent = originalBtnText;
      }
    }

    let message = `Hi Bullhead, I'd like to place an order.\n`;
    message += `\nType: ${TYPE_LABELS[type]}`;
    if (activeTable) message += `\nTable: ${activeTable}`;

    if (type === 'dine-in' && partySize) message += `\nParty size: ${partySize}`;
    if (type === 'dine-in' && pickupTime) message += `\nArriving at: ${pickupTime}`;
    if (type === 'delivery' && address) message += `\nDelivery address: ${address}`;
    if (liveLocationUrl) message += `\nGoogle Maps Location: ${liveLocationUrl}`;
    if (type === 'drive-through' && pickupTime) message += `\nArriving at: ${pickupTime}`;
    const etaEl = form.querySelector('input[name="eta"]:checked');
    const etaMinutes = type === 'on-the-way' && etaEl ? Number(etaEl.value) : 0;
    if (etaMinutes) message += `\nArriving in about: ${etaMinutes} min`;
    if (type === 'reserve') {
      if (partySize) message += `\nParty size: ${partySize}`;
      if (reserveDate) message += `\nDate: ${reserveDate}`;
      if (reserveTime) message += `\nTime: ${reserveTime}`;
    }

    if (lines.length) {
      message += `\n\nOrder:\n`;
      lines.forEach((l) => {
        const qtyText = l.unit === 'kg' ? `${l.qty.toFixed(1).replace(/\.0$/, '')}kg` : `${l.qty}x`;
        message += `- ${qtyText} ${l.name} (${formatKES(l.lineTotal)})\n`;
      });
      message += `\nTotal: ${formatKES(cartTotal(cart))}`;

      // Snapshot this order so a returning visitor can repeat it later.
      try {
        localStorage.setItem('bullheadLastOrder', JSON.stringify({ items: cart, ts: Date.now() }));
      } catch (e) {}
    } else {
      message += `\n\n(No items selected on the Menu page — just reaching out.)`;
    }

    message += `\n\nCounter: ${location}`;
    if (name) message += `\nName: ${name}`;
    if (notes) message += `\nCustom instructions: ${notes}`;

    // Also drop the order on the owner's dashboard (fire-and-forget; WhatsApp stays the source of truth).
    try {
      fetch('/api/orders', {
        method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type, name, notes, table: activeTable || '', counter: location, partySize, address,
          arriving: pickupTime || (reserveDate ? reserveDate + ' ' + reserveTime : ''), etaMinutes,
          items: lines.map((l) => ({ id: l.id, name: l.name, qty: l.qty, unit: l.unit || '', lineTotal: l.lineTotal })),
        }),
      }).catch(() => {});
    } catch (e) {}

    const url = `https://wa.me/${ORDER_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener');

    if (lines.length) {
      clearCart();
      render();
    }

    form.reset();
    applyOrderType('dine-in');

    const locationHint = document.getElementById('locationHint');
    if (locationHint) locationHint.hidden = true;
    const shareOrderHint = document.getElementById('shareOrderHint');
    if (shareOrderHint) shareOrderHint.hidden = true;
  });

  render();
  applyMenuOverrides().then(render); // live prices / sold-out
});
