// ============================================
// BULLHEAD — contact page: show order summary,
// take name/location/notes, send to WhatsApp
// ============================================

const ORDER_WHATSAPP_NUMBER = '254720707323';

// Random id for one order. Made here (not on the server) so the tracking link can be
// put into the WhatsApp message the instant the customer taps send.
function makeTrackId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

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

    // Tracking link. (`location` above is the counter the customer picked, so use window.location.)
    // Mirrors the server: an order with no items still counts if it has a note.
    const trackId = lines.length > 0 || notes ? makeTrackId() : '';
    if (trackId) message += `\n\nTrack your order live: ${window.location.origin}/track?o=${trackId}`;

    // Also drop the order on the owner's dashboard (fire-and-forget; WhatsApp stays the source of truth).
    try {
      fetch('/api/orders', {
        method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: trackId || undefined, type, name, notes, table: activeTable || '', counter: location, partySize, address,
          arriving: pickupTime || (reserveDate ? reserveDate + ' ' + reserveTime : ''), etaMinutes,
          items: lines.map((l) => ({ id: l.id, name: l.name, qty: l.qty, unit: l.unit || '', lineTotal: l.lineTotal })),
        }),
      }).catch(() => {});
    } catch (e) {}

    const url = `https://wa.me/${ORDER_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener');

    if (trackId) {
      let tb = document.getElementById('trackBanner');
      if (!tb) {
        tb = document.createElement('a');
        tb.id = 'trackBanner';
        tb.style.cssText = 'display:block;margin-top:18px;padding:16px 18px;border-radius:14px;background:var(--green);color:#fff;text-align:center;font-weight:600;text-decoration:none;';
        form.after(tb);
      }
      tb.href = `/track?o=${trackId}`;
      tb.textContent = '✅ Order sent. Track it live · Fuatilia oda yako →';

      // Optional pay-ahead card with the Till number and the exact amount.
      const oldPay = document.getElementById('mpesaCard');
      if (oldPay) oldPay.remove();
      const orderTotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
      if (orderTotal > 0 && typeof mpesaCard === 'function') tb.after(mpesaCard(orderTotal));

      // The tracking page IS the confirmation. WhatsApp opens in its own tab/app; this tab moves
      // on to the live status page, so wherever the customer returns to, their order is on screen.
      // (The banner above stays as a fallback. The order POST uses keepalive so it survives this.)
      setTimeout(() => { window.location.assign(`/track?o=${trackId}`); }, 1200);
    }

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
