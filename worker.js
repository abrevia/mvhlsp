/**
 * MVHLSP edge worker — public site assets + clinical dispatch API.
 *
 * Security posture:
 *  - No debug/introspection routes.
 *  - Admin auth fails CLOSED when ADMIN_KEY is not configured (no hardcoded fallback).
 *  - Constant-time credential comparison + best-effort per-IP rate limiting.
 *  - CORS restricted to MVHLSP origins instead of '*'.
 *  - Hardened response headers (HSTS, CSP on HTML, nosniff, frame-ancestors, etc.).
 *  - Dispatch accepts only validated language pairs from the published rate card.
 */

const ALLOWED_ORIGINS = [
  'https://mvhlsp.site',
  'https://www.mvhlsp.site',
  'https://mvhlsp.serviciosadg-mx.workers.dev',
];

const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

// Strict CSP: the site ships precompiled Tailwind CSS (/assets/tailwind.css),
// external per-page JS/CSS, data-* driven event listeners (no inline on*
// handlers) and self-hosted fonts, so no 'unsafe-inline' or 'unsafe-eval' is
// needed. The only third party is Cloudflare's Web Analytics beacon, which
// Cloudflare injects into HTML automatically.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "script-src 'self' https://static.cloudflareinsights.com",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self' https://cloudflareinsights.com",
].join('; ');

// Keep this list identical to the language pairs configured in Remoto.
// If a pair is added/removed in Remoto, update this list and the site pickers.
const DISPATCH_TARGETS = new Set(['spa', 'ara', 'zho', 'vie', 'hat', 'por', 'rus']);

function resolveLanguagePair(input) {
  const raw = String(input || '').trim().toLowerCase();
  const match = /^eng_([a-z]{3})$/.exec(raw) || /^([a-z]{3})_eng$/.exec(raw);
  if (!match) return null;
  const target = match[1];
  if (!DISPATCH_TARGETS.has(target)) return null;
  return { source: 'eng', target: target };
}

function constantTimeEqual(a, b) {
  const encoder = new TextEncoder();
  const left = encoder.encode(String(a));
  const right = encoder.encode(String(b));
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(data, status, request, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(request),
      ...extraHeaders,
    },
  });
}

function isAdmin(request, body, env) {
  const expected = (env.ADMIN_KEY || '').trim();
  if (!expected) return false;
  const headerKey = request.headers.get('x-admin-key') || '';
  const bodyKey = (body && body.admin_key) || '';
  const provided = (headerKey || bodyKey).toString().trim();
  if (!provided) return false;
  return constantTimeEqual(provided, expected);
}

// Best-effort, per-colo rate limiting (defense in depth; not a durable quota).
async function allowRequest(request, bucket, limit, windowSeconds) {
  try {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const cacheKey = new Request(`https://mvhlsp.site/__ratelimit/${bucket}/${encodeURIComponent(ip)}`);
    const cached = await caches.default.match(cacheKey);
    const used = cached ? parseInt(await cached.text(), 10) || 0 : 0;
    if (used >= limit) return false;
    await caches.default.put(cacheKey, new Response(String(used + 1), {
      headers: { 'Cache-Control': `max-age=${windowSeconds}` },
    }));
    return true;
  } catch (err) {
    return true;
  }
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const host = (request.headers.get('host') || url.hostname).toLowerCase();
  const path = url.pathname.toLowerCase();

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  // ------------------------------------------------------------------ health
  if (path === '/api/health') {
    return json({
      status: 'healthy',
      service: 'MVHLSP Clinical Language Switchboard',
      worker: 'mvhlsp',
      domain: 'mvhlsp.site',
      timestamp: new Date().toISOString(),
    }, 200, request);
  }

  // ------------------------------------------------- availability (read-only)
  // Optional ?pair=eng_spa (or ?source=eng&target=spa). Live coverage per
  // published pair is exposed at /api/availability/all for the language picker.
  if ((path === '/api/availability' || path === '/api/availability/all') && request.method === 'GET') {
    const apiKey = env.REMOTO_API_KEY;
    if (!apiKey) {
      return json({
        status: 'ok',
        data: [],
        notice: 'Live availability feed is not configured on this deployment.',
      }, 200, request, { 'Cache-Control': 'public, max-age=15' });
    }

    // Remoto's availability feed uses its own language codes (spa, chi, hc...).
    const AVAILABILITY_PAIRS = {
      eng_spa: ['eng', 'spa'],
      eng_ara: ['eng', 'ara'],
      eng_chi: ['eng', 'chi'],
      eng_vie: ['eng', 'vie'],
      eng_por: ['eng', 'por'],
      eng_hc: ['eng', 'hc'],
      eng_rus: ['eng', 'rus'],
    };

    const fetchAvailability = async (source, target) => {
      const resp = await fetch(`https://www.proz.com/remoto/api/v1/availability?source=${source}&target=${target}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'MVHLSP-ClinicalSwitchboard/2.0',
          'Accept': 'application/json',
        },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error('availability upstream error');
      return data;
    };

    try {
      if (path === '/api/availability/all') {
        const keys = Object.keys(AVAILABILITY_PAIRS);
        const results = await Promise.all(keys.map((key) => {
          const [source, target] = AVAILABILITY_PAIRS[key];
          return fetchAvailability(source, target)
            .then((data) => [key, (data.data && data.data[0]) || null])
            .catch(() => [key, null]);
        }));
        const pairs = {};
        for (const [key, value] of results) pairs[key] = value;
        return json({ object: 'list', pairs }, 200, request, { 'Cache-Control': 'public, max-age=15' });
      }

      let key = String(url.searchParams.get('pair') || '').toLowerCase();
      if (!key) {
        const source = String(url.searchParams.get('source') || 'eng').toLowerCase();
        const target = String(url.searchParams.get('target') || 'spa').toLowerCase();
        key = `${source}_${target}`;
      }
      const pair = AVAILABILITY_PAIRS[key];
      if (!pair) {
        return json({ error: 'Unsupported language pair for availability.', support: 'info@mvhlsp.site' }, 400, request);
      }
      const data = await fetchAvailability(pair[0], pair[1]);
      return json(data, 200, request, { 'Cache-Control': 'public, max-age=15' });
    } catch (err) {
      return json({ status: 'ok', data: [], warning: 'Availability feed temporarily unavailable.' }, 200, request);
    }
  }

  // ------------------------------------------------------- admin verification
  if (path === '/api/admin/verify' && request.method === 'POST') {
    const expected = (env.ADMIN_KEY || '').trim();
    if (!expected) {
      return json({ success: false, error: 'Admin access is not configured on this deployment.' }, 503, request);
    }
    if (!(await allowRequest(request, 'admin-verify', 5, 60))) {
      return json({ success: false, error: 'Too many attempts. Try again in a minute.' }, 429, request);
    }

    let body = {};
    try { body = await request.json(); } catch (err) { body = {}; }
    const provided = (body.admin_key || request.headers.get('x-admin-key') || '').toString().trim();

    if (!provided || !constantTimeEqual(provided, expected)) {
      return json({ success: false, error: 'Invalid Executive Admin Key' }, 401, request);
    }

    return json({
      success: true,
      user: 'Captain Alex',
      title: 'Managing Director & Founder',
      role: 'executive_admin',
      business_id: env.REMOTO_BUSINESS_ID || '6aedbc5e989cef6a80b751ff',
      slug: env.REMOTO_SLUG || 'mvhlsp',
    }, 200, request);
  }

  // ------------------------------------------------------------- dispatch call
  if (path === '/api/dispatch' && request.method === 'POST') {
    const origin = request.headers.get('Origin');
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return json({ error: 'Origin not allowed', support: 'info@mvhlsp.site' }, 403, request);
    }
    if (!(await allowRequest(request, 'dispatch', 12, 60))) {
      return json({ error: 'Too many requests. Please wait a moment and try again.', support: 'info@mvhlsp.site' }, 429, request);
    }

    const apiKey = env.REMOTO_API_KEY;
    if (!apiKey) {
      return json({
        error: 'Switchboard key unconfigured on edge worker. Support: info@mvhlsp.site',
        support: 'info@mvhlsp.site',
      }, 503, request);
    }

    try {
      let body = {};
      try { body = await request.json(); } catch (err) { body = {}; }

      const callType = body.call_type === 'video' ? 'video' : 'audio';
      const clientName = (body.client_name || 'Clinic Station 1').toString().trim().slice(0, 80);
      const notes = (body.notes || 'On-demand dispatch from mvhlsp.site').toString().trim().slice(0, 2000);
      const extRef = (body.external_reference || `MV-${Date.now()}`).toString().trim().slice(0, 64);

      const requestedPair = (body.language_pair || 'eng_spa').toString().trim();
      const languagePair = resolveLanguagePair(requestedPair);
      if (!languagePair) {
        return json({ error: 'That language pair is not available yet. Contact support: info@mvhlsp.site', support: 'info@mvhlsp.site' }, 400, request);
      }

      // Free test minutes are only available to an authenticated executive key.
      const isTestCall = isAdmin(request, body, env) && body.test_call === true;

      const payload = {
        language_pair: languagePair,
        call_type: callType,
        client_name: clientName,
        notes: notes,
        external_reference: extRef,
        test_call: isTestCall,
      };

      const resp = await fetch('https://www.proz.com/remoto/api/v1/call-requests', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'MVHLSP-ClinicalSwitchboard/2.0',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await resp.json();
      if (!resp.ok) {
        const errMsg = (data.error && data.error.message) || (typeof data.error === 'string' ? data.error : 'Dispatch switchboard error');
        return json({ error: errMsg, code: resp.status, support: 'info@mvhlsp.site' }, resp.status, request);
      }

      // Only what the browser needs: no client_secret echo.
      return json({
        success: true,
        id: data.id,
        join_url: data.join_url,
        status: data.status,
        call_type: data.call_type,
        language_pair: `${languagePair.source}_${languagePair.target}`,
      }, 200, request);
    } catch (err) {
      console.error('dispatch failed:', err && err.message ? err.message : String(err));
      return json({ error: 'Dispatch temporarily unavailable. Support: info@mvhlsp.site', support: 'info@mvhlsp.site' }, 500, request);
    }
  }

  // ------------------------------------------------------------ static routing
  const resolveAsset = async (assetPath) => {
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      try {
        const newHeaders = new Headers(request.headers);
        newHeaders.set('host', 'mvhlsp.site');
        const assetReq = new Request(`https://mvhlsp.site${assetPath}`, {
          method: request.method,
          headers: newHeaders,
        });
        const assetRes = await env.ASSETS.fetch(assetReq);
        if (assetRes.status >= 200 && assetRes.status < 300) {
          return assetRes;
        }
      } catch (e) {
        // fall through
      }
    }
    return null;
  };

  if (host.includes('adg') || path === '/adg' || path === '/alex') {
    if (path === '/' || path === '' || path === '/adg' || path === '/alex') {
      const res = await resolveAsset('/adg.html');
      if (res) return res;
    }
  }

  // Everything lives at the root URL now. Legacy service URLs, old /dashboard
  // links and ?admin=true shortcuts all canonicalise to https://mvhlsp.site/.
  if (path === '/connect' || path === '/quickdial' || path === '/dashboard') {
    return Response.redirect(new URL('/', request.url).toString(), 301);
  }

  // Clean a stray ?admin=true (or any admin param) from the root URL.
  if ((path === '/' || path === '') && url.searchParams.has('admin')) {
    return Response.redirect(new URL('/', request.url).toString(), 301);
  }

  // Printable HIPAA BAA (static page; filled from query parameters client-side)
  if (path === '/baa-print' || path === '/baa-print.html') {
    const res = await resolveAsset('/baa-print.html');
    if (res) return res;
  }

  if (path === '/partner') {
    const res = await resolveAsset('/partner.html');
    if (res) return res;
  }

  if (path === '/privacy') {
    const res = await resolveAsset('/privacy.html');
    if (res) return res;
  }

  // Legal pages
  if (path === '/terms' || path === '/terms.html') {
    const res = await resolveAsset('/terms.html');
    if (res) return res;
  }

  // Marketing / pricing page
  if (path === '/pricing' || path === '/index.html') {
    const res = await resolveAsset('/index.html');
    if (res) return res;
  }

  // Root = the live service dashboard (trust strip, language picker, signed BAA)
  if (path === '/' || path === '') {
    const res = await resolveAsset('/dashboard.html');
    if (res) return res;
  }

  if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
    try {
      return await env.ASSETS.fetch(request);
    } catch (e) {
      // fall through
    }
  }

  return new Response('MVHLSP Clinical Language Access Portal is initializing. Please reload or Support: info@mvhlsp.site.', {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=UTF-8' },
  });
}

function harden(request, response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  const contentType = headers.get('Content-Type') || '';
  if (contentType.includes('text/html')) {
    headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  }
  if (headers.get('Access-Control-Allow-Origin') === '*') {
    headers.delete('Access-Control-Allow-Origin');
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const response = await handleRequest(request, env);
    return harden(request, response);
  },

  // Cron trigger: nudge the GitHub Actions "MVHLSP automations" workflow via
  // workflow_dispatch, so the 30-min applicant intake + morning-inspiration
  // engine keeps running even if GitHub's own schedule trigger stalls.
  async scheduled(event, env, ctx) {
    const pat = env.GH_PAT;
    if (!pat) {
      console.warn('MVHLSP cron: GH_PAT secret not set; skipping workflow_dispatch');
      return;
    }
    try {
      const resp = await fetch(
        'https://api.github.com/repos/abrevia/mvhlsp-ops-backup/actions/workflows/mvhlsp-automations.yml/dispatches',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + pat,
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'mvhlsp-cron-worker',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({ ref: 'main' }),
        }
      );
      if (resp.ok) {
        console.log('MVHLSP cron: workflow_dispatch accepted');
      } else {
        console.warn('MVHLSP cron: workflow_dispatch failed ' + resp.status + ' ' + (await resp.text()));
      }
    } catch (e) {
      console.warn('MVHLSP cron: error ' + (e && e.message ? e.message : String(e)));
    }
  },
};
