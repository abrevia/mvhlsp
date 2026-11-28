// Live count inside the header standby badge: interpreters online right now across
// the languages MVHLSP serves (whole Remoto network, not only our roster).
// Polls every 20 s and refreshes when the tab regains focus.
(function networkLiveCounter() {
    var countEl = document.getElementById('header-online-count');
    var badge = document.getElementById('header-status-badge');
    if (!countEl || !badge) return;

    function render(data) {
        if (!data) return;
        var online = (typeof data.online === 'number') ? data.online : 0;
        var roster = (typeof data.rosterOnline === 'number') ? data.rosterOnline : 0;
        countEl.textContent = online + ' online \u00b7';
        if (online === 0) {
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
