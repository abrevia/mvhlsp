// Live counter: interpreters online right now across the languages MVHLSP serves.
// Includes the whole Remoto network (not only MVHLSP roster). Refreshes every 30 s.
(function networkLiveCounter() {
    var countEl = document.getElementById('live-network-count');
    var badge = document.getElementById('live-network-badge');
    if (!countEl || !badge) return;

    function render(data) {
        if (!data) return;
        var online = (typeof data.online === 'number') ? data.online : 0;
        var roster = (typeof data.rosterOnline === 'number') ? data.rosterOnline : 0;
        countEl.textContent = String(online);
        if (online === 0) {
            countEl.textContent = '0';
            badge.title = 'No interpreter is online for the languages MVHLSP serves this second. The Remoto network alerts recently active interpreters and connects as soon as one is online.';
        } else {
            badge.title = online + ' interpreter(s) online right now across the languages MVHLSP serves (whole Remoto network)' +
                (roster > 0 ? ' - ' + roster + ' from the MVHLSP roster.' : '.');
        }
    }

    function refresh() {
        fetch('/api/network-online', { cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .then(render)
            .catch(function () {});
    }

    refresh();
    setInterval(refresh, 20000);
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) refresh();
    });
})();