# Deploying Keyframe

The build is a static bundle (`dist/`). Nothing runs server-side; both API calls
go straight from the visitor's browser to Jina and Groq.

**Vercel** hosts the live instance (below); **Cloudflare Pages** is a drop-in
alternative that also honours `public/_headers` (section 2).

## 1. The live instance (Vercel)

| | |
| --- | --- |
| URL | <https://keyframe-nine.vercel.app> |
| Source | <https://github.com/jegede20/keyframe> (`main`) |
| Project | `keyframe` — preset **Vite**, build `npm run build`, output `dist` |

The project is **Git-connected**: a push to `main` deploys to production and
other branches become preview deployments. Build settings are pinned in
`vercel.json` instead of left to auto-detection, so CLI and Git deploys are
identical.

### The environment variable (required)

| Name | Value | Targets |
| --- | --- | --- |
| `VITE_GROQ_API_KEY` | your `gsk_…` key from console.groq.com | production, preview, development |

**This one is required.** It is the key every visitor generates with, and there
is no in-app field to paste one — without it, generation always ends in the
"key rejected" card. Vite inlines `VITE_*` at **build time**, so the variable
must exist before the build that produces the deployment; changing it later
needs a redeploy, not a restart.

### Headers and routing

`vercel.json` mirrors every rule from `public/_headers`, because **Vercel does
not read `_headers`**:

- `/sw.js` → `Cache-Control: no-cache, no-store, must-revalidate` — the rule
  that matters most (Rule 12); without it a stale service worker can win and
  updates never land.
- `/assets/*` and `/fonts/*` → immutable for a year (content-hashed bundles,
  frozen font files).
- `/manifest.json`, `/icons/*`, `/screenshots/*` → revalidated daily.
- Site-wide: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.
- Unknown paths fall back to `index.html` automatically (Vite SPA), so no extra
  rewrite rule is needed.

> **Deployment Protection must stay off** (Project → Settings → Deployment
> Protection). With Vercel Authentication on, every visitor meets a Vercel
> login wall even on a public deployment. It is off now.

### Deploy from scratch

```bash
npm i -g vercel
vercel login
vercel link --project keyframe                 # create or pick the project
vercel env add VITE_GROQ_API_KEY production    # repeat for preview / development
vercel --prod
```

`.vercel/` — the CLI's local project link — is git-ignored; `vercel.json` is
committed. `.env` is git-ignored too — never commit a real key.

## 2. Alternative: Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
2. Pick the repo.
3. Build settings: framework preset `Vite`, build command `npm run build`,
   output directory `dist`, `NODE_VERSION=20`.
4. Environment variables (Production *and* Preview): `VITE_GROQ_API_KEY`, same
   as above.
5. Deploy. You get `https://<project>.pages.dev` (HTTPS included).

Here `public/_headers` and `public/_redirects` are copied into `dist/` and
picked up automatically (there, `vercel.json` is simply ignored — the two hosts
read different config files, which is why both exist).

## 3. Post-deploy checklist

- [ ] The URL loads, the hero renders in Space Grotesk (self-hosted from `/fonts`), and DevTools → Network shows **no third-party requests**.
- [ ] Chrome desktop shows the **Install** icon in the address bar (PWA installable).
- [ ] DevTools → Application → Service Workers shows `sw.js` **activated** and running.
- [ ] DevTools → Application → Cache Storage shows `keyframe-v1.0.0-shell` (24 entries).
- [ ] DevTools → Network → set **Offline**, reload `/?action=history` — the app boots
      offline from cache and history still works; unknown routes render `offline.html`.
- [ ] Generate a real script end to end, then Settings → Export History (JSON) downloads.
- [ ] Mobile: Android Chrome install prompt appears; iOS Safari shows the
      "Add to Home Screen" instructions banner instead.
- [ ] Push a trivial change → the **"Update available"** dropdown appears under the
      header in an already-open tab within ~60 min (or on next focus); Update Now
      reloads into the new build.

Both hosts produce the same artifact, so a local `npm run build` is a faithful
rehearsal — section 5 walks the same checks against `:4173` and against the
deployment.

## 4. Custom domain (optional, free)

**Vercel:** project → Settings → Domains → add the domain and the DNS record it
asks for; HTTPS is provisioned automatically and `*.vercel.app` stays valid.
**Cloudflare Pages:** project → Custom domains — same idea.

## 5. Verification (this repo)

Local suites mirror the checklist above (needs a Chrome binary — run
`choreo_get_chrome` once, and `LD_LIBRARY_PATH` pointing at the local libs).

The same browser suites accept `KF_BASE`, so they run unchanged against the
deployment that ships:

```bash
KF_BASE=https://keyframe-nine.vercel.app python3 tools/e2e-check.py    # 74/74
KF_BASE=https://keyframe-nine.vercel.app python3 tools/live-check.py   # 11/11, real APIs
```

```bash
# 0. one-time browser setup
choreo_get_chrome                     # prints the chrome path
bash tools/fetch-chrome-libs.sh       # extracts the few system libs Chrome needs

# 1. dev server for the interaction suites
npm run dev -- --port 5173 --host 0.0.0.0
python3 tools/browser-check.py        # 82 checks
python3 tools/e2e-check.py            # 74 checks (mocked APIs)

# 1b. …or the same suites against the built bundle (what actually deploys)
npm run build && npm run preview -- --port 4173 &
KF_BASE=http://localhost:4173 python3 tools/browser-check.py   # 67 checks + 12 dev-only skips
KF_BASE=http://localhost:4173 python3 tools/e2e-check.py       # 74 checks
python3 tools/a11y-check.py           # axe-core, dark theme
KF_THEME=light python3 tools/a11y-check.py

# 2. production bundle for the PWA suite
npm run build
python3 tools/pwa-check.py            # 27 checks, serves dist/ itself

# 2b. Lighthouse acceptance (PWA 100 / a11y ≥ 95 / LCP < 2.5s / CLS < 0.1)
npm run lighthouse                    # finds Chrome itself; CHROME_PATH=… overrides

# 3. pipeline (no browser needed)
node tools/run-pipeline-test.mjs      # 90 checks
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
