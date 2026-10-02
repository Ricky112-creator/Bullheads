(function () {
  var BRANCHES = [
    { value: 'Bullhead One', label: 'Bullhead One', lat: -2.078670, lng: 37.469386 },
    { value: 'Bullhead Two', label: 'Bullhead Two', lat: -2.079304, lng: 37.473449 }
  ];

  function distanceKm(lat1, lng1, lat2, lng2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  var btn = document.getElementById('useLocationBtn');
  var hint = document.getElementById('locationHint');
  var select = document.getElementById('location');
  if (!btn || !hint || !select) return;

  btn.addEventListener('click', function () {
    if (!('geolocation' in navigator)) {
      hint.hidden = false;
      hint.textContent = "Your browser doesn't support location — pick manually above.";
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Finding you…';
    function reset() {
      btn.textContent = 'Use my location to pick the closer one';
      btn.disabled = false;
    }
    function say(msg) { hint.hidden = false; hint.textContent = msg; }
    navigator.geolocation.getCurrentPosition(function (pos) {
      var lat = pos.coords.latitude, lng = pos.coords.longitude;
      var acc = pos.coords.accuracy || 0;
      var withDist = BRANCHES.map(function (b) {
        return { branch: b, km: distanceKm(lat, lng, b.lat, b.lng) };
      }).sort(function (a, b) { return a.km - b.km; });
      var closest = withDist[0];
      // The two counters are ~450 m apart, so a fix coarser than ~250 m (typical of a laptop's Wi-Fi/IP
      // guess) cannot tell them apart, and one that lands many km away is simply wrong. Don't pretend.
      if (acc > 250 || closest.km > 10) {
        say("This device could only guess your location roughly" +
          (closest.km > 10 ? " (it put you about " + Math.round(closest.km) + " km away)" : "") +
          ", which isn't accurate enough to choose a counter. Please pick one above. Phones with GPS on work best.");
        reset();
        return;
      }
      select.value = closest.branch.value;
      say(closest.branch.label + ' is closer to you — about ' +
        (closest.km < 1 ? Math.round(closest.km * 1000) + ' m' : closest.km.toFixed(1) + ' km') + ' away. Selected it above.');
      reset();
    }, function () {
      say("Couldn't get your location — pick manually above.");
      reset();
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  });
})();
