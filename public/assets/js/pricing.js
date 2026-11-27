
        (function () {
            'use strict';

            var REMOTO_FALLBACK = 'https://www.proz.com/remoto/b/mvhlsp/connect';
            var pendingJoinUrl = REMOTO_FALLBACK;
            var lastFocused = null;

            function byId(id) { return document.getElementById(id); }

            /* ---------- Mobile menu ---------- */
            var menuToggle = byId('menu-toggle');
            var mobileMenu = byId('mobile-menu');

            if (menuToggle && mobileMenu) {
                menuToggle.addEventListener('click', function () {
                    var isHidden = mobileMenu.classList.toggle('hidden');
                    menuToggle.setAttribute('aria-expanded', isHidden ? 'false' : 'true');
                    menuToggle.setAttribute('aria-label', isHidden ? 'Open menu' : 'Close menu');
                });
                mobileMenu.querySelectorAll('a').forEach(function (link) {
                    link.addEventListener('click', function () {
                        mobileMenu.classList.add('hidden');
                        menuToggle.setAttribute('aria-expanded', 'false');
                        menuToggle.setAttribute('aria-label', 'Open menu');
                    });
                });
            }

            /* ---------- Generic modal helpers ---------- */
            function openModal(id) {
                var modal = byId(id);
                if (!modal) return;
                lastFocused = document.activeElement;
                modal.classList.remove('hidden');
                modal.classList.add('flex');
                document.body.style.overflow = 'hidden';
                var target = modal.querySelector('[data-autofocus]') || modal.querySelector('button, a, input, select');
                if (target) {
                    window.setTimeout(function () { target.focus(); }, 40);
                }
            }

            function closeModal(id) {
                var modal = byId(id);
                if (!modal) return;
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                document.body.style.overflow = '';
                if (lastFocused && typeof lastFocused.focus === 'function') {
                    lastFocused.focus();
                }
            }

            window.closeModal = closeModal;

            // Backdrop + Escape close
            document.addEventListener('click', function (event) {
                var closer = event.target.closest ? event.target.closest('[data-close]') : null;
                if (closer) {
                    closeModal(closer.getAttribute('data-close'));
                }
            });

            document.addEventListener('keydown', function (event) {
                if (event.key !== 'Escape') return;
                ['activate-modal', 'baa-modal', 'terms-modal', 'privacy-modal', 'admin-login-modal'].forEach(function (id) {
                    var modal = byId(id);
                    if (modal && !modal.classList.contains('hidden')) closeModal(id);
                });
            });

            /* ---------- Activation flow (overflow dispatch) ---------- */
            function setActivateState(state) {
                var pending = byId('activate-pending');
                var ready = byId('activate-ready');
                if (!pending || !ready) return;
                if (state === 'ready') {
                    pending.classList.add('hidden');
                    ready.classList.remove('hidden');
                    var btn = ready.querySelector('[data-autofocus]');
                    if (btn) btn.focus();
                } else {
                    ready.classList.add('hidden');
                    pending.classList.remove('hidden');
                }
            }

            window.activateBackup = async function activateBackup(triggerBtn) {
                var original = triggerBtn ? triggerBtn.innerHTML : '';
                if (triggerBtn) {
                    triggerBtn.disabled = true;
                    triggerBtn.innerHTML = 'Connecting&hellip;';
                }

                openModal('activate-modal');
                setActivateState('pending');

                var pairSelect = byId('activate-pair');
                var languagePair = pairSelect ? pairSelect.value : 'eng_spa';
                var modalitySelect = byId('activate-modality');
                var callType = modalitySelect ? modalitySelect.value : 'audio';
                var stationInput = byId('activate-station');
                var station = stationInput ? stationInput.value.trim() : '';

                try {
                    var res = await fetch('/api/dispatch', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            call_type: callType,
                            language_pair: languagePair,
                            client_name: 'MVHLSP Overflow Activation',
                            notes: station ? ('Station: ' + station) : 'Overflow activation from mvhlsp.site'
                        })
                    });
                    var data = await res.json().catch(function () { return {}; });
                    pendingJoinUrl = (res.ok && data && data.join_url) ? data.join_url : REMOTO_FALLBACK;
                } catch (err) {
                    pendingJoinUrl = REMOTO_FALLBACK;
                } finally {
                    if (triggerBtn) {
                        triggerBtn.disabled = false;
                        triggerBtn.innerHTML = original;
                    }
                    setActivateState('ready');
                }
            };

            window.requestPair = function requestPair(triggerBtn) {
                return window.activateBackup(triggerBtn);
            };

            window.proceedToSession = function proceedToSession() {
                closeModal('activate-modal');
                var sessionWindow = window.open(pendingJoinUrl, 'MVHLSP_Clinical_Encounter', 'width=1100,height=800,menubar=no,toolbar=no,location=no,status=no');
                if (!sessionWindow) {
                    window.location.href = pendingJoinUrl;
                }
            };

            // Backwards-compatible alias for any legacy links to the old dispatch helper
            window.launchInterpreterSession = window.activateBackup;

            /* ---------- BAA modal ---------- */
            window.openBaaModal = function openBaaModal(requestType) {
                var form = byId('baa-form-container');
                var success = byId('baa-success-container');
                var select = byId('baa-entity-type');

                if (form) form.classList.remove('hidden');
                if (success) success.classList.add('hidden');
                if (select) {
                    if (requestType) {
                        select.value = requestType;
                    }
                    if (!select.value) select.selectedIndex = 0;
                }
                openModal('baa-modal');
            };

            window.handleBaaSubmit = function handleBaaSubmit(event) {
                event.preventDefault();

                var form = byId('baa-request-form');
                var org = byId('baa-org-name').value.trim();
                var name = byId('baa-contact-name').value.trim();
                var email = byId('baa-email').value.trim();
                var phone = byId('baa-phone') ? byId('baa-phone').value.trim() : '';
                var pairField = byId('baa-pair');
                var pair = pairField ? pairField.value : 'not specified';
                var requestType = byId('baa-entity-type').value;

                byId('baa-confirmed-org').textContent = org;
                byId('baa-confirmed-name').textContent = name;
                byId('baa-confirmed-email').textContent = email;

                // The landing page is fully static, so the request is handed to the
                // clinic's own mail client instead of being silently discarded.
                var subject = 'MVHLSP ' + requestType + ' — ' + org;
                var body = [
                    'Request type: ' + requestType,
                    'Clinic / organization: ' + org,
                    'Contact: ' + name,
                    'Email: ' + email,
                    'Phone: ' + (phone || 'not provided'),
                    'Language pair: ' + pair,
                    '',
                    'Please send the pre-signed HIPAA BAA and clinic onboarding details.'
                ].join('\n');
                var mailLink = byId('baa-mail-link');
                if (mailLink) {
                    mailLink.href = 'mailto:info@mvhlsp.site?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
                }

                byId('baa-form-container').classList.add('hidden');
                byId('baa-success-container').classList.remove('hidden');
                if (form) form.reset();
            };

            /* ---------- Admin sign-in (footer padlock) ---------- */
            window.openAdminSignIn = function openAdminSignIn() {
                var err = byId('admin-signin-error');
                if (err) err.classList.add('hidden');
                openModal('admin-login-modal');
            };

            window.handleAdminSignInSubmit = async function handleAdminSignInSubmit(event) {
                event.preventDefault();
                var keyInput = byId('admin-signin-key');
                var err = byId('admin-signin-error');
                var submit = byId('admin-signin-submit');
                var key = keyInput ? keyInput.value.trim() : '';
                if (!key) return;

                if (submit) { submit.disabled = true; submit.textContent = 'Verifying…'; }
                try {
                    var res = await fetch('/api/admin/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ admin_key: key })
                    });
                    var data = await res.json().catch(function () { return {}; });
                    if (res.ok && data && data.success) {
                        try { sessionStorage.setItem('mvhlsp_admin_key', key); } catch (e) {}
                        window.location.href = '/';
                        return;
                    }
                    if (err) {
                        err.textContent = (data && data.error) ? data.error : 'Invalid access key.';
                        err.classList.remove('hidden');
                    }
                } catch (e2) {
                    if (err) {
                        err.textContent = 'Sign-in is temporarily unavailable. Try again in a moment.';
                        err.classList.remove('hidden');
                    }
                } finally {
                    if (submit) { submit.disabled = false; submit.textContent = 'Sign in to console'; }
                }
            };

            /* ---------- Terms modal ---------- */
            window.openTermsModal = function openTermsModal() {
                openModal('terms-modal');
            };

            /* ---------- Privacy modal ---------- */
            window.openPrivacyModal = function openPrivacyModal() {
                openModal('privacy-modal');
            };

                    // Printable BAA Generator
        function downloadBaaDocument() {
            const orgEl = document.getElementById('baa-confirmed-org');
            const nameEl = document.getElementById('baa-confirmed-name');
            const emailEl = document.getElementById('baa-confirmed-email');
            const org = (orgEl && orgEl.textContent) || 'Healthcare Organization';
            const name = (nameEl && nameEl.textContent) || 'Authorized Clinician';
            const email = (emailEl && emailEl.textContent) || 'info@mvhlsp.site';
            const query = new URLSearchParams({ org: org, name: name, email: email }).toString();
            window.open('/baa-print.html?' + query, '_blank', 'noopener');
        }
            window.downloadBaaDocument = downloadBaaDocument;
        })();
    