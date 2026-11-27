/* Printable BAA: fills the document from query parameters and opens the print
 * dialog. Static page + external CSS/JS so the site CSP needs no
 * 'unsafe-inline' (the previous version used document.write, which inherited
 * the opener's CSP and would have been blocked). */
(function () {
    'use strict';

    var params = new URLSearchParams(window.location.search);
    var org = (params.get('org') || 'Healthcare Organization').slice(0, 200);
    var name = (params.get('name') || 'Authorized Clinician').slice(0, 200);
    var email = (params.get('email') || 'info@mvhlsp.site').slice(0, 200);
    var today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    function set(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    set('baa-org', org);
    set('baa-org-2', org);
    set('baa-name', name);
    set('baa-name-2', name);
    set('baa-email', email);
    set('baa-date', today);
    set('baa-date-2', today);
    set('baa-date-3', today);

    document.title = 'HIPAA BAA - ' + org + ' & MVHLSP';

    window.addEventListener('load', function () {
        window.print();
    });
})();
