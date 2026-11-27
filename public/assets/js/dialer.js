
        // State variables
        let callStartTime = null;
        let callTimerInterval = null;
        let activeEncounterId = null;
        let activeModality = 'audio';
        let activeReference = '';

        // Executive Admin State
        const ADMIN_STORAGE_KEY = 'mvhlsp_admin_key';
        let isAdminAuthenticated = false;
        let adminTestModeEnabled = true;

        function getStoredAdminKey() {
            try { localStorage.removeItem(ADMIN_STORAGE_KEY); } catch (e) {}
        return sessionStorage.getItem(ADMIN_STORAGE_KEY) || '';
        }

        function checkAdminAuthOnLoad() {
            const key = getStoredAdminKey();
            if (key) {
                isAdminAuthenticated = true;
                updateAdminUIState(true);
            } else {
                isAdminAuthenticated = false;
                updateAdminUIState(false);
            }
        }

        function updateAdminUIState(isAuth) {
            const btnLabel = document.getElementById('admin-header-label');
            const headerBtn = document.getElementById('admin-header-btn');
            const banner = document.getElementById('admin-active-banner');
            const loginView = document.getElementById('admin-login-view');
            const consoleView = document.getElementById('admin-console-view');

            if (isAuth) {
                if (btnLabel) btnLabel.textContent = 'Admin (Active)';
                if (headerBtn) {
                    headerBtn.className = 'px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-500 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs';
                }
                if (banner) banner.classList.remove('hidden');
                if (loginView) loginView.classList.add('hidden');
                if (consoleView) consoleView.classList.remove('hidden');
            } else {
                if (btnLabel) btnLabel.textContent = 'Admin';
                if (headerBtn) {
                    headerBtn.className = 'px-3 py-1.5 bg-slate-900 hover:bg-[#115C7B] text-white border border-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs';
                }
                if (banner) banner.classList.add('hidden');
                if (loginView) loginView.classList.remove('hidden');
                if (consoleView) consoleView.classList.add('hidden');
            }
        }

        function handleAdminHeaderClick() {
            const modal = document.getElementById('admin-modal');
            if (modal) modal.classList.remove('hidden');
        }

        function openAdminConsoleModal() {
            const modal = document.getElementById('admin-modal');
            if (modal) modal.classList.remove('hidden');
        }

        function closeAdminModal() {
            const modal = document.getElementById('admin-modal');
            if (modal) modal.classList.add('hidden');
        }

        async function handleAdminLogin(e) {
            e.preventDefault();
            const keyInput = document.getElementById('admin-access-key');
            const errBox = document.getElementById('admin-login-error');
            const submitBtn = document.getElementById('admin-login-submit');
            const keyVal = keyInput.value.trim();

            if (!keyVal) return;

            submitBtn.disabled = true;
            submitBtn.textContent = 'Verifying...';
            if (errBox) errBox.classList.add('hidden');

            try {
                const res = await fetch('/api/admin/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ admin_key: keyVal })
                });

                const data = await res.json();
                if (res.ok && data.success) {
                    sessionStorage.setItem(ADMIN_STORAGE_KEY, keyVal);
                    isAdminAuthenticated = true;
                    updateAdminUIState(true);
                    keyInput.value = '';
                } else {
                    throw new Error(data.error || 'Invalid Admin Access Key');
                }
            } catch (err) {
                if (errBox) {
                    errBox.textContent = err.message || 'Authentication failed. Please verify executive access key.';
                    errBox.classList.remove('hidden');
                }
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Authenticate & Unlock';
            }
        }

        function toggleAdminTestMode(chk) {
            adminTestModeEnabled = chk.checked;
        }

        function adminLogout() {
            localStorage.removeItem(ADMIN_STORAGE_KEY);
            sessionStorage.removeItem(ADMIN_STORAGE_KEY);
            isAdminAuthenticated = false;
            updateAdminUIState(false);
            closeAdminModal();
        }

        // Close encounter window immediately without browser prompt
        function forceCloseEncounterWindow() {
            if (callTimerInterval) {
                clearInterval(callTimerInterval);
                callTimerInterval = null;
            }
            const screen = document.getElementById('encounter-active-screen');
            const iframe = document.getElementById('encounter-iframe');
            if (iframe) iframe.src = 'about:blank';
            if (screen) screen.classList.add('hidden');
            
            const timerDisplay = document.getElementById('active-timer-display');
            if (timerDisplay) timerDisplay.textContent = '00:00:00';
            
            const submitBtn = document.getElementById('dashboard-submit-btn');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span> <span>Connect a Medical Interpreter Now</span>';
            }
            
            const alertBox = document.getElementById('dashboard-dispatch-alert');
            if (alertBox) alertBox.classList.add('hidden');

            const form = document.getElementById('dashboard-dispatch-form');
            if (form) form.scrollIntoView({ behavior: 'smooth' });
        }

        // 1. Availability check on page mount
        async function fetchLiveAvailability() {
            try {
                const res = await fetch('/api/availability');
                if (res.ok) {
                    const data = await res.json();
                    const statusText = document.getElementById('header-status-text');
                    let count = 1049;
                    if (data && data.data && data.data[0] && data.data[0].interpreters_total) {
                        count = data.data[0].interpreters_total;
                    }
                    if (statusText) {
                        statusText.textContent = 'OPI & VRI Standby';
                    }
                }
            } catch (e) {
                // Silently keep default high-availability badge
            }
        }
        fetchLiveAvailability();
        setInterval(fetchLiveAvailability, 30000);

        // 2. URL Parameter pre-selection (e.g., /dashboard?type=video) & Admin auth check
        window.addEventListener('DOMContentLoaded', () => {
            checkAdminAuthOnLoad();

            const urlParams = new URLSearchParams(window.location.search);
            // No admin popup on arrival. The console opens only when this tab is already
            // signed in (you reached it from the padlock sign-in on the main site).
            if (getStoredAdminKey()) {
                handleAdminHeaderClick();
            }

            const typeParam = urlParams.get('type');
            if (typeParam === 'video') {
                const videoRadio = document.querySelector('input[name="call_type"][value="video"]');
                if (videoRadio) videoRadio.checked = true;
            } else if (typeParam === 'audio') {
                const audioRadio = document.querySelector('input[name="call_type"][value="audio"]');
                if (audioRadio) audioRadio.checked = true;
            }
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeAdminModal();
                closeBaaModal();
                closeLanguagePicker();
            }
        });

        // Signed BAA flow
        function openBaaModal() {
            document.getElementById('baa-form-container').classList.remove('hidden');
            document.getElementById('baa-success-container').classList.add('hidden');
            document.getElementById('baa-modal').classList.remove('hidden');
        }
        function closeBaaModal() {
            document.getElementById('baa-modal').classList.add('hidden');
        }
        function handleBaaSubmit(e) {
            e.preventDefault();
            document.getElementById('baa-confirmed-org').textContent = document.getElementById('baa-org-name').value.trim();
            document.getElementById('baa-confirmed-name').textContent = document.getElementById('baa-contact-name').value.trim();
            document.getElementById('baa-confirmed-email').textContent = document.getElementById('baa-email').value.trim();
            document.getElementById('baa-form-container').classList.add('hidden');
            document.getElementById('baa-success-container').classList.remove('hidden');
        }


        // Resume the pulse if the browser froze animations while the tab was hidden
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) return;
            document.querySelectorAll('.alive-a > div, .alive-b > div').forEach(function (el) {
                el.getAnimations().forEach(function (a) { if (a.playState === 'paused') a.play(); });
            });
        });


        // Soft alternating motion for the two critical modality cards (anime.js)
        (function initSoftCardPulse() {
            if (!window.anime) return;
            if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
            var cards = document.querySelectorAll('.alive-a > div, .alive-b > div');
            if (cards.length < 2) return;
            var motion = {
                translateY: [0, -4],
                scale: [1, 1.012],
                boxShadow: [
                    '0 0 0 0px rgba(17,92,123,0)',
                    '0 0 0 7px rgba(17,92,123,0.18)'
                ],
                duration: 1700,
                easing: 'easeInOutSine',
                direction: 'alternate',
                loop: true
            };
            anime(Object.assign({ targets: cards[0], delay: 0 }, motion));
            anime(Object.assign({ targets: cards[1], delay: 1700 }, motion));
        })();

        // 3. Language picker (opened by the Connect button)
        function openLanguagePicker() {
            const modal = document.getElementById('language-picker');
            if (modal) modal.classList.remove('hidden');
            const search = document.getElementById('language-search');
            if (search) { search.value = ''; filterLanguages(''); }
        }
        function closeLanguagePicker() {
            const modal = document.getElementById('language-picker');
            if (modal) modal.classList.add('hidden');
        }
        function filterLanguages(q) {
            const needle = (q || '').toLowerCase().trim();
            document.querySelectorAll('.lang-btn').forEach(function (b) {
                const name = b.getAttribute('data-name') || '';
                b.classList.toggle('hidden', needle ? name.indexOf(needle) === -1 : false);
            });
        }
        function chooseLanguage(pairCode, name, btn) {
            closeLanguagePicker();
            const alertBox = document.getElementById('dashboard-dispatch-alert');
            if (alertBox) {
                alertBox.classList.remove('hidden', 'bg-rose-100', 'text-rose-800');
                alertBox.classList.add('bg-cyan-50', 'text-cyan-800', 'border', 'border-cyan-200');
                alertBox.textContent = 'Requesting a ' + name + ' interpreter...';
            }
            runDispatch(pairCode);
        }

        // 3. Form Dispatch Handler
        let pendingDispatch = null;

        document.getElementById('dashboard-dispatch-form').addEventListener('submit', function(e) {
            e.preventDefault();
            pendingDispatch = {
                callType: document.querySelector('input[name="call_type"]:checked').value,
                refVal: document.getElementById('dispatch-client-ref').value.trim() || 'Clinic Station 1',
                department: document.getElementById('dispatch-department').value
            };
            openLanguagePicker();
        });

        async function runDispatch(pairCode) {
            const btn = document.getElementById('dashboard-submit-btn');
            const alertBox = document.getElementById('dashboard-dispatch-alert');
            const callType = pendingDispatch.callType;
            const refVal = pendingDispatch.refVal;
            const department = pendingDispatch.department;

            activeModality = callType;
            activeReference = refVal;

            btn.disabled = true;
            btn.innerHTML = '<span class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span> <span>Contacting Switchboard...</span>';
            
            alertBox.classList.remove('hidden', 'bg-rose-100', 'text-rose-800');
            alertBox.classList.add('bg-cyan-50', 'text-cyan-800', 'border', 'border-cyan-200');
            alertBox.textContent = 'Allocating encrypted channel to frontline medical interpreter...';

            const adminKey = getStoredAdminKey();
            const headers = { 'Content-Type': 'application/json' };
            const useAdminTestMinutes = Boolean(isAdminAuthenticated && adminTestModeEnabled && adminKey);
            if (useAdminTestMinutes) {
                headers['x-admin-key'] = adminKey;
            }

            try {
                const response = await fetch('/api/dispatch', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        call_type: callType,
                        client_name: refVal,
                        notes: `Department: ${department} • Dispatched from MVHLSP Clinical Dashboard`,
                        external_reference: `MV-${Date.now()}`,
                        language_pair: pairCode,
                        test_call: useAdminTestMinutes
                    })
                });

                const data = await response.json();
                if (!response.ok || !data.join_url) {
                    throw new Error(data.error || 'Switchboard did not issue a secure encounter token.');
                }

                activeEncounterId = data.id || `ENC-${Date.now()}`;
                
                alertBox.classList.remove('bg-cyan-50', 'text-cyan-800', 'border-cyan-200');
                alertBox.classList.add('bg-emerald-50', 'text-emerald-800', 'border', 'border-emerald-200');
                alertBox.textContent = 'Encounter allocated! Launching secure clinical room...';

                // Transition UI to the Active Encounter Screen (In-Page)
                launchActiveEncounter(data.join_url);

            } catch (err) {
                alertBox.classList.remove('bg-cyan-50', 'text-cyan-800', 'border-cyan-200', 'bg-rose-50', 'text-rose-800', 'border-rose-200');
                const errMsg = (err.message || '').toLowerCase();
                const isPaymentNeeded = errMsg.includes('payment') || errMsg.includes('card') || errMsg.includes('balance') || errMsg.includes('credit') || errMsg.includes('invoice');

                if (isPaymentNeeded) {
                    // Trigger cordial Standby Active reassurance modal
                    openStandbyActiveModal();
                    alertBox.classList.add('bg-cyan-50', 'text-[#115C7B]', 'border', 'border-cyan-200');
                    alertBox.innerHTML = `
                        <div class="flex items-center justify-between text-left gap-2">
                            <div>
                                <span class="font-bold flex items-center gap-1.5 text-emerald-700">
                                    <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <span>Standby Active:</span> Channel Ready.
                                </span>
                                <span class="text-[11px] text-slate-600 block mt-0.5">Please kindly add a payment method to connect with your interpreter. Zero upfront fee.</span>
                            </div>
                            <button type="button" data-standby-open class="alive shrink-0 px-3 py-1.5 rounded-lg bg-[#115C7B] hover:bg-[#0C4659] text-white text-[11px] font-bold cursor-pointer transition">
                                Complete Setup
                            </button>
                        </div>
                    `;
                    // Inline on* handlers are blocked by the site CSP: wire the
                    // dynamically inserted button with addEventListener instead.
                    const standbyOpenBtn = alertBox.querySelector('[data-standby-open]');
                    if (standbyOpenBtn) standbyOpenBtn.addEventListener('click', openStandbyActiveModal);
                } else {
                    alertBox.classList.add('bg-rose-50', 'text-rose-800', 'border', 'border-rose-200');
                    alertBox.innerHTML = `<span>Notice: ${err.message}</span><br><span class="text-[11px] mt-1 inline-block text-slate-600">Clinical Support Desk: <a href="mailto:info@mvhlsp.site" class="underline font-bold text-[#115C7B]">info@mvhlsp.site</a></span>`;
                }
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span> <span>Connect a Medical Interpreter Now</span>';
            }
        }

        
        function openStandbyActiveModal() {
            const modal = document.getElementById('standby-active-modal');
            if (modal) modal.classList.remove('hidden');
        }
        function closeStandbyActiveModal() {
            const modal = document.getElementById('standby-active-modal');
            if (modal) modal.classList.add('hidden');
        }

        function openSecurePaymentLayer() {
            const w = 560;
            const h = 760;
            const left = Math.max(0, (window.screen.width - w) / 2);
            const top = Math.max(0, (window.screen.height - h) / 2);
            const win = window.open(
                'https://www.proz.com/remoto/b/mvhlsp/connect',
                'MVHLSPSecureStripeGateway',
                `width=${w},height=${h},top=${top},left=${left},status=no,toolbar=no,menubar=no,location=yes,resizable=yes,scrollbars=yes`
            );
            if (win) {
                win.focus();
            }
        }

        // Printable BAA generator
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

        // 4. In-Page Encounter Launcher
        function launchActiveEncounter(joinUrl) {
            const screen = document.getElementById('encounter-active-screen');
            const iframe = document.getElementById('encounter-iframe');
            const overlay = document.getElementById('iframe-loading-overlay');
            const badge = document.getElementById('active-modality-badge');
            const refText = document.getElementById('active-ref-text');
            const sessId = document.getElementById('active-session-id');

            badge.textContent = activeModality === 'video' ? 'Video (VRI)' : 'Audio (OPI)';
            badge.className = activeModality === 'video' 
                ? 'text-[10px] uppercase font-black px-2 py-0.5 rounded bg-cyan-900 text-cyan-200 border border-cyan-500/50' 
                : 'text-[10px] uppercase font-black px-2 py-0.5 rounded bg-emerald-900 text-emerald-200 border border-emerald-500/50';
            
            refText.textContent = activeReference;
            sessId.textContent = activeEncounterId;

            // Show active encounter screen and smoothly scroll into view
            screen.classList.remove('hidden');
            overlay.classList.remove('hidden', 'opacity-0');
            screen.scrollIntoView({ behavior: 'smooth' });

            iframe.src = joinUrl;
            iframe.onload = () => {
                setTimeout(() => {
                    overlay.classList.add('opacity-0');
                    setTimeout(() => overlay.classList.add('hidden'), 300);
                }, 1000);
            };

            // Start encounter timer
            startTimer();
        }

        // 5. Timer Engine
        function startTimer() {
            callStartTime = Date.now();
            const timerDisplay = document.getElementById('active-timer-display');
            if (callTimerInterval) clearInterval(callTimerInterval);

            callTimerInterval = setInterval(() => {
                const elapsedSec = Math.floor((Date.now() - callStartTime) / 1000);
                const hrs = String(Math.floor(elapsedSec / 3600)).padStart(2, '0');
                const mins = String(Math.floor((elapsedSec % 3600) / 60)).padStart(2, '0');
                const secs = String(elapsedSec % 60).padStart(2, '0');
                timerDisplay.textContent = `${hrs}:${mins}:${secs}`;
            }, 1000);
        }

        function stopTimer() {
            if (callTimerInterval) {
                clearInterval(callTimerInterval);
                callTimerInterval = null;
            }
            if (!callStartTime) return '00:00';
            const totalSec = Math.floor((Date.now() - callStartTime) / 1000);
            const mins = String(Math.floor(totalSec / 60)).padStart(2, '0');
            const secs = String(totalSec % 60).padStart(2, '0');
            return `${mins}:${secs}`;
        }

        // 6. End Encounter Action
        document.getElementById('end-encounter-btn').addEventListener('click', () => {
            if (confirm('Are you sure you want to conclude this clinical interpretation encounter?')) {
                concludeEncounter();
            }
        });

        function concludeEncounter() {
            const finalDuration = stopTimer();

            // Log encounter locally
            addEncounterToLog({
                id: activeEncounterId,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                ref: activeReference,
                modality: activeModality.toUpperCase(),
                duration: finalDuration
            });

            forceCloseEncounterWindow();
            alert(`Clinical encounter concluded.\nTotal Duration: ${finalDuration}\nSession logged.`);
        }

        