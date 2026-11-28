// Live coverage dots on the language picker.
// Every published language is always serviceable (roster first, then the Remoto network),
// so no language is ever greyed out. Green = interpreter online right now; hollow teal =
// network standby: Remoto alerts recently active interpreters and connects when one is online.
(function coverageDots() {
    var buttons = document.querySelectorAll('.lang-btn');
    if (!buttons.length) return;
    var map = { zho: 'chi', hat: 'hc' };
    fetch('/api/availability/all')
        .then(function (r) { return r.json(); })
        .then(function (p) {
            var pairs = (p && p.pairs) || {};
            Array.prototype.forEach.call(buttons, function (btn) {
                var lang = btn.getAttribute('data-lang');
                if (!lang) return;
                var info = pairs['eng_' + (map[lang] || lang)];
                if (!info) return;
                var online = info.interpreters_online || 0;
                var roster = info.roster_interpreters_online || 0;
                var dot = document.createElement('span');
                dot.className = 'live-dot' + (online > 0 ? '' : ' standby');
                if (online > 0) {
                    dot.title = online + ' interpreter(s) online right now' +
                        (roster ? ' (' + roster + ' from the MVHLSP roster)' : '') +
                        ' - covered by the MVHLSP roster and Remoto network.';
                } else {
                    dot.title = 'Covered by the Remoto network: no interpreter online this second, ' +
                        'Remoto alerts recently active interpreters and connects as soon as one is online.';
                }
                btn.appendChild(dot);
            });
        })
        .catch(function () {});
})();