(function () {
  var el = document.getElementById('rightnow'); if (!el) return;
  var b = el.getAttribute('data-branch') || '';
  var p = new Intl.DateTimeFormat('en-KE', { timeZone: 'Africa/Nairobi', hour: 'numeric', minute: '2-digit', hour12: true, hourCycle: 'h12' }).formatToParts(new Date()), h = 0, txt = '';
  p.forEach(function (x) { if (x.type === 'hour') h = +x.value; });
  var pm = p.filter(function (x) { return x.type === 'dayPeriod'; })[0]; pm = pm && /p/i.test(pm.value);
  h = (h % 12) + (pm ? 12 : 0);
  txt = p.map(function (x) { return x.value; }).join('').replace(/\s?(am|pm)/i, function (m, a) { return ' ' + a.toLowerCase(); });
  var meat = { one: 'meat off the choma zone', two: 'chicken and fresh beef' }[b] || 'fresh meat from the butchery';
  var eve = { one: 'Choma, chips and ugali, straight from the counter.', two: 'Chicken, tilapia and ugali at a proper table.' }[b] || 'Ugali, meat and chai to end the day well.';
  var s = h >= 5 && h < 10 ? ['Breakfast is on.', 'Hot chai, andazi, chapati and porridge. Start the day right.']
    : h < 15 && h >= 10 ? ['Lunch is on.', 'Ugali, pilau, githeri and ' + meat + '.']
    : h >= 15 && h < 19 ? ['Tea time.', 'Chai, chapati and something warm while the day winds down.']
    : h >= 19 && h < 23 ? ['Supper is on.', eve]
    : ['The night shift is on.', 'Long road ahead? The kitchen is awake and the tea is hot.'];
  el.querySelector('.rn-time').textContent = txt + ' in Emali';
  el.querySelector('.rn-line').innerHTML = '<b></b> <span></span>';
  el.querySelector('.rn-line b').textContent = s[0]; el.querySelector('.rn-line span').textContent = s[1];
})();
