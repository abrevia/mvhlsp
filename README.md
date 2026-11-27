# MVHLSP — mvhlsp.site

Public site (Cloudflare Worker `mvhlsp` + static assets) and the small clinical
dispatch API it exposes.

## What is in here

| Path | Purpose |
| --- | --- |
| `worker.js` | Cloudflare Worker: routes (`/`, `/pricing`, `/partner`, `/privacy`, `/terms`, `/baa-print`), dispatch/admin API, rate limits, security headers + CSP |
| `public/` | Static assets uploaded with the Worker (`ASSETS` binding) |
| `public/index.html` | Marketing / per-pair pricing page (`/pricing`) |
| `public/dashboard.html` | Service dashboard served at the root URL (identical copies: `connect.html`, `quickdial.html`, `connect/index.html`, `dashboard/index.html`) |
| `public/baa-print.html` | Printable HIPAA BAA, filled from query parameters |
| `public/assets/css/` | Page CSS + the **precompiled** Tailwind bundle (`tailwind.css`) |
| `public/assets/js/` | Page scripts and the generated `*-handlers.js` listener maps |
| `src/tailwind.css` | Tailwind entry point (build source) |
| `tailwind.config.js` | Tailwind theme (same palette/fonts/shadows the Play CDN used to receive at runtime) |
| `package.json` | Build tooling only; the deployed Worker has no npm dependencies |

## Build & deploy

```powershell
npm install          # once
npm run build:css    # regenerates public/assets/tailwind.css (run after editing classes/config)
npx wrangler deploy  # deploys worker.js + public/ to the mvhlsp Worker
```

Always deploy from a fresh clone of `abrevia/mvhlsp` (never from the old
`D:\02 PROJECTS\mvhlsp` checkout).

## CSP / security notes

The site runs a strict Content-Security-Policy with **no** `'unsafe-inline'` or
`'unsafe-eval'`:

```
default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self';
form-action 'self'; script-src 'self' https://static.cloudflareinsights.com;
style-src 'self'; font-src 'self'; img-src 'self' data:;
connect-src 'self' https://cloudflareinsights.com
```

Rules that keep it that way:

1. **No inline `<script>` / `<style>`** — everything lives in `public/assets/…`.
2. **No `on*="…"` attributes** — elements use `data-c`, `data-s`, `data-i`,
   `data-ch` attributes; `public/assets/js/<page>-handlers.js` maps them to the
   page's global functions with `addEventListener`.
3. **No inline `style="…"` attributes** — use classes from the page CSS.
4. **No remote CSS/JS/fonts** — Tailwind is precompiled, fonts are self-hosted
   in `public/fonts/`.
5. The only third party allowed is Cloudflare's Web Analytics beacon, which
   Cloudflare injects automatically.

## Editing the dashboard copies

The dashboard page is served at `/` and several legacy URLs. `connect.html`,
`quickdial.html`, `connect/index.html` and `dashboard/index.html` must stay
byte-identical copies of `dashboard.html`.
