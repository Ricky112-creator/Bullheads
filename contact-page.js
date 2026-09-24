// ============================================
// BULLHEAD — contact page: show order summary,
// take name/location/notes, send to WhatsApp
// ============================================

const ORDER_WHATSAPP_NUMBER = '254720707323';

// Item names can be typed in by the owner (custom dishes), so escape them before they go into innerHTML.
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
  const fieldPhone = document.getElementById('field-phone');
  const phoneInput = document.getElementById('phone');
  const phoneErr = document.getElementById('phoneErr');

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

    // A phone number is needed for everything except an order from a table QR code (they're already in the room).
    const needPhone = !(type === 'dine-in' && activeTable);
    if (fieldPhone) fieldPhone.hidden = !needPhone;
    if (phoneInput) phoneInput.required = needPhone;
    if (phoneErr) phoneErr.hidden = true;
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
      <div class="order-line" data-id="${esc(l.id)}">
        <span class="order-line-name">${qtyText} ${esc(l.name)}</span>
        <span class="order-line-total">${formatKES(l.lineTotal)}</span>
        <button type="button" class="order-line-remove" aria-label="Remove ${esc(l.name)}">×</button>
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

    // Phone number: needed unless this is a table-QR dine-in order. Checked BEFORE anything else so the
    // customer fixes it straight away, and staff always have a way to reach someone who never presses Send.
    // (A message with no items, no note and no reservation is just a chat opener: nothing is recorded, so no number is needed.)
    const willRecord = lines.length > 0 || notes || type === 'reserve';
    const needPhone = willRecord && !(type === 'dine-in' && activeTable);
    const phone = normPhoneKE(form.phone.value);
    if (needPhone && !phone) {
      if (phoneErr) { phoneErr.textContent = 'Please enter a valid Kenyan phone number, e.g. 0712 345 678 · Weka nambari sahihi ya simu.'; phoneErr.hidden = false; }
      phoneInput.focus();
      return;
    }
    if (phoneErr) phoneErr.hidden = true;
    if (submitBtn) submitBtn.disabled = true;      // no double-taps while we work

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

    // The id is made here (not on the server) so the code and tracking link can go into the WhatsApp message.
    // An order with no items still counts if it has a note, or if it's a table reservation.
    const trackId = willRecord ? makeTrackId() : '';
    const code = trackId ? orderCode(trackId) : '';

    let message = `Hi Bullhead, I'd like to place an order.${code ? ` (Order #${code})` : ''}\n`;
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

    // Tracking link.
    if (trackId) message += `\n\nTrack your order live: ${window.location.origin}/track?o=${trackId}`;
    const waUrl = `https://wa.me/${ORDER_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

    // 1) Record the order on the dashboard FIRST and wait for the answer, so the customer is never told
    //    "sent" when it wasn't. The dashboard is the order; the WhatsApp message is the receipt.
    let recorded = false;
    if (trackId) {
      if (submitBtn) submitBtn.textContent = 'Sending…';
      const payload = JSON.stringify({
        id: trackId, type, name, phone, notes, table: activeTable || '', counter: location, partySize, address, pin: liveLocationUrl,
        arriving: pickupTime || (reserveDate ? reserveDate + ' ' + reserveTime : ''), etaMinutes,
        items: lines.map((l) => ({ id: l.id, name: l.name, qty: l.qty, unit: l.unit || '', lineTotal: l.lineTotal })),
      });
      for (let attempt = 0; attempt < 2 && !recorded; attempt++) {
        try {
          const ctl = new AbortController();
          const timer = setTimeout(() => ctl.abort(), 8000);
          const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, signal: ctl.signal });
          clearTimeout(timer);
          if (res.ok || res.status === 409) { recorded = true; break; }        // 409: an earlier try had already saved it
          const d = await res.json().catch(() => ({}));
          if (res.status === 400) {                                            // something to fix: tell them, don't open WhatsApp
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalBtnText; }
            if (d.field === 'phone' && phoneErr) { phoneErr.textContent = d.error; phoneErr.hidden = false; phoneInput.focus(); }
            else alert(d.error || 'Something is wrong with this order. Please check it and try again.');
            return;
          }
          if (res.status < 500) break;                                         // 429 etc.: trying again won't help
        } catch (err) { /* network hiccup: one more try */ }
      }
      if (submitBtn) submitBtn.textContent = originalBtnText;
    }
    if (submitBtn) submitBtn.disabled = false;

    // 2) Open WhatsApp with the same order (+ code + tracking link).
    const wa = window.open(waUrl, '_blank');
    if (wa) { try { wa.opener = null; } catch (err) {} }

    const banner = () => {
      let tb = document.getElementById('trackBanner');
      if (!tb) {
        tb = document.createElement('a');
        tb.id = 'trackBanner';
        tb.style.cssText = 'display:block;margin-top:18px;padding:16px 18px;border-radius:14px;background:var(--green);color:#fff;text-align:center;font-weight:600;text-decoration:none;';
        form.after(tb);
      }
      return tb;
    };

    if (recorded) {
      const tb = banner();
      tb.style.background = 'var(--green)';
      tb.href = `/track?o=${trackId}`;
      tb.textContent = `✅ Order #${code} recorded. Press Send in WhatsApp so we can confirm it · Bonyeza Tuma kwenye WhatsApp →`;
      // The tracking page has a "Send on WhatsApp" button too, so this works even if the browser blocked the pop-up.
      setTimeout(() => { window.location.assign(`/track?o=${trackId}`); }, wa ? 1200 : 300);
      if (lines.length) { clearCart(); render(); }
    } else if (trackId) {
      // Not saved: keep the cart and the form so nothing is lost, and be honest about what counts.
      const tb = banner();
      tb.style.background = '#b3261e';
      tb.href = waUrl; tb.target = '_blank'; tb.rel = 'noopener';
      tb.textContent = `⚠️ We couldn't save order #${code} on our screen. Your WhatsApp message is your order: please press Send there. Tap here to open WhatsApp again.`;
      return;
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
