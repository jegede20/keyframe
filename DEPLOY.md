# Deploying Keyframe to Cloudflare Pages

The build is a static bundle (`dist/`). Nothing runs server-side; both API calls
go straight from the visitor's browser to Jina and Groq.

## 1. Push to GitHub

```bash
cd keyframe
git add -A
git commit -m "Keyframe v1.0.0"
git remote add origin git@github.com:<you>/keyframe.git
git push -u origin main
```

`.env` is gitignored — never commit a real key.

## 2. Create the Pages project

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
2. Pick the repo.
3. Build settings:
   - **Framework preset:** `Vite`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version:** 20 or newer (`NODE_VERSION=20`)
4. **Environment variables** (Production *and* Preview):

   | Name | Value |
   | --- | --- |
   | `VITE_GROQ_API_KEY` | your `gsk_…` key from console.groq.com |

   **This one is required.** It is the key every visitor generates with, and
   there is no in-app field to paste one — without it, generation always ends in
   the "key rejected" card.

5. Deploy. You get `https://<project>.pages.dev` (HTTPS included).

`public/_headers` and `public/_redirects` are copied into `dist/` and are picked
up automatically: `sw.js` is served `no-cache, no-store`, hashed assets are
immutable for a year, `/assets/*` etc. The SPA redirect rewrites everything to
`index.html`.

## 3. Post-deploy checklist

- [ ] `https://<project>.pages.dev` loads, the hero renders in Space Grotesk (self-hosted from `/fonts`), and DevTools → Network shows **no third-party requests**.
- [ ] Chrome desktop shows the **Install** icon in the address bar (PWA installable).
- [ ] DevTools → Application → Service Workers shows `sw.js` **activated** and running.
- [ ] DevTools → Application → Cache Storage shows `keyframe-v1.0.0-shell` (21 entries).
- [ ] DevTools → Network → set **Offline**, reload `/?action=history` — the app boots
      offline from cache and history still works; unknown routes render `offline.html`.
- [ ] Generate a real script end to end, then Settings → Export History (JSON) downloads.
- [ ] Mobile: Android Chrome install prompt appears; iOS Safari shows the
      "Add to Home Screen" instructions banner instead.
- [ ] Push a trivial change → the **"A new version of Keyframe is ready"** banner
      appears in an already-open tab within ~60 min (or on next focus).

## 4. Custom domain (optional, free)

Pages → your project → **Custom domains → Set up a domain**. Add the DNS record
Cloudflare asks for; HTTPS is provisioned automatically. `*.pages.dev` remains
valid, so no config changes are needed.

## 5. Verification (this repo)

Local suites that mirror the checklist above (needs a Chrome binary — run
`choreo_get_chrome` once, and `LD_LIBRARY_PATH` pointing at the local libs):

```bash
# 0. one-time browser setup
choreo_get_chrome                     # prints the chrome path
bash tools/fetch-chrome-libs.sh       # extracts the few system libs Chrome needs

# 1. dev server for the interaction suites
npm run dev -- --port 5173 --host 0.0.0.0
python3 tools/browser-check.py        # 42 checks
python3 tools/e2e-check.py            # 42 checks (mocked APIs)
python3 tools/a11y-check.py           # axe-core, dark theme
KF_THEME=light python3 tools/a11y-check.py

# 2. production bundle for the PWA suite
npm run build
python3 tools/pwa-check.py            # 27 checks, serves dist/ itself

# 2b. Lighthouse acceptance (PWA 100 / a11y ≥ 95 / LCP < 2.5s / CLS < 0.1)
CHROME_PATH=… npm run lighthouse

# 3. pipeline (no browser needed)
node tools/run-pipeline-test.mjs      # 86 checks
GROQ_API_KEY=gsk_… node tools/run-pipeline-test.mjs   # + live Groq checks

# 4. the one live end-to-end suite (spends real quota — run before a release)
python3 tools/live-check.py https://tailwindcss.com   # 11 checks
node tools/css-audit.mjs                              # stylesheet coverage
```

`tools/pwa-check.py` launches Chrome through `/tmp/chrome-offline.sh`, a wrapper
that blackholes external DNS so service-worker fetches to `r.jina.ai` and
`api.groq.com` fail exactly like a real outage (CDP's
`Network.emulateNetworkConditions` does not reach service-worker traffic):

```bash
#!/bin/bash
exec <chrome-path> \
  --host-resolver-rules="MAP * 127.0.0.1, EXCLUDE localhost" \
  --disable-features=DnsOverHttps,AsyncDns,UseDnsHttpsSvcb \
  --dns-over-https-mode=off \
  "$@"
```

## Notes

- **The bundled key is public.** Anything prefixed `VITE_` ends up in the JS
  bundle, so anyone can read it out. It is rate-limited to the free tier, and
  Keyframe's own guardrails (≈3.5k-token prompt, 3,000-token cap) keep each
  generation inside an 8,000 TPM model budget. Rotate it if it ever gets abused.
- **Model choice.** `openai/gpt-oss-120b` writes the script; a `429` falls back
  to `openai/gpt-oss-20b`. If Groq retires either model, edit `GROQ_MODELS` in
  `src/services/groq.js` — the rest of the pipeline is model-agnostic.
- **Updating the SW version:** bump `SW_VERSION` in `public/sw.js` (e.g.
  `keyframe-v1.0.1`). The activate handler deletes every older `keyframe-*` cache.
