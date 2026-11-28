// Live coverage dots on the language picker (network + roster online counts).
// Served as an external file because the site CSP forbids inline scripts.
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
                var dot = document.createElement('span');
                dot.className = 'live-dot' + (info.interpreters_online > 0 ? ' on' : '');
                dot.title = 'Online now: ' + info.interpreters_online + ' interpreter(s) in the network' +
                    (info.roster_interpreters_online ? ' - ' + info.roster_interpreters_online + ' on the MVHLSP roster' : '') +
                    (info.interpreters_online ? '' : ' (standby)');
                btn.appendChild(dot);
            });
        })
        .catch(function () {});
})();