# ▶ Keyframe — verification map

Every standing rule and quality gate, and the automated check that proves it.
Commands and thresholds live in [`README.md`](README.md) → *Automated
verification*; this page maps **requirement → evidence → result**.

Last full run: **2026-10-11**, all suites green (numbers below are from that run).

---

## The critical rules

| # | Rule | Where it lives | What proves it |
| --- | --- | --- | --- |
| 1 | No backend, database, sign-up, auth or sessions | `src/store/storage.js` (localStorage + a hand-written IndexedDB adapter, with an in-memory fallback when storage is blocked) | The repo has no server code at all (top level is Vite + `src/` + `tools/`); `e2e` §10 generates while offline with an explanation instead of a network error; `pwa-check` boots the cached shell with the server stopped |
| 2 | Plain JavaScript, no TypeScript | `src/**` is `.js` / `.jsx`; `package.json` has no TS tooling | The build (`vite build`) and every suite would fail on a type-only file; dependencies are `react`, `react-dom`, `lucide-react`, `uuid` |
| 3 | All API calls go browser → Jina / Groq with direct `fetch()`, no proxy | `src/services/jina.js` → `https://r.jina.ai/…`; `src/services/groq.js` → `https://api.groq.com/openai/v1/chat/completions` | `e2e` mocks exactly those two origins inside the page; `live-check` drives the real ones from the UI; there is no serverless directory and `public/_redirects` only does the SPA fallback |
| 4 | Groq key bundled via Vite env var, never logged, never sent anywhere else | `.env` (git-ignored) → `VITE_GROQ_API_KEY`; `resolveApiKey()` reads **only** that | `git grep` across all commits finds placeholders only (`gsk_…`, `gsk_your_groq_api_key_here`); the real key exists only in `.env`; `browser-check` §4 asserts the settings modal has no API-key section; both browser suites fail on unexpected `console` errors, so a logged key would break the build checks |
| 5 | User data never leaves the device except those two calls; no analytics | No analytics dependency; the service worker is **network-only** for `r.jina.ai` and `api.groq.com` | Third-party request count **0**, verified in-browser (`artifacts/40-…png`); `pwa-check` asserts the SW answers `503 {"error":"offline"}` for both API hosts rather than serving anything cached |
| 6 | Inputs are always preserved on error | `ErrorBox` (Try Again / Edit Inputs) keeps the workspace state; generation never clears the fields | `e2e` §9 (429 on one/both models) and §11 (cut-short, incomplete) assert the URL and features survive; `browser-check` §9 does the same for a mocked `401` |
| 7 | `AbortController` on both calls, wired to Cancel, independently | `App.jsx` keeps `jinaAbort` and `groqAbort` refs — each live only during its own phase — and `cancelGeneration()` aborts both | `e2e` cancels mid-generation and asserts the inputs are untouched and the stepper stops |
| 8 | `prefers-reduced-motion: reduce` disables **all** animation | `src/styles/animations.css`: every transition sits inside `@media (prefers-reduced-motion: no-preference)`, plus a universal reduce block that zeroes durations/delays, collapses iterations and forces reveals visible; `src/utils/motion.js` branches the four JS smooth scrolls | `tools/motion-audit.py` walks **every element** on landing / workspace / results / settings / history / toast in both motion states and fails on a single running duration or delay under reduce — 14/14; the same run confirms motion-allowed users still get 45 animated elements |
| 9 | 44 × 44 px minimum touch targets on mobile | Padding, not bigger visuals | `browser-check` §10 measures every bottom-bar button on a 390 px viewport (≥ 44 px), and axe reports no target-size findings |
| 10 | History auto-saves on “New Script”; the user never saves manually | `App.jsx` → `useHistory` → `saveScript()` on the New Script click | `e2e` walks New Script → history → reload and finds the script; `browser-check` §7 round-trips the storage adapter directly |
| 11 | Service worker caching for API calls is **network only** | `public/sw.js` → `networkOnly()` for both API hosts | `pwa-check` asserts offline API requests resolve to the `503 {"error":"offline"}` payload — stale scripts can never be served |
| 12 | `/sw.js` ships `Cache-Control: no-cache` | `public/_headers` | `pwa-check` parses `_headers` and fails if the rule is missing |
| 13 | All 125 features ship; nothing deferred | — | No `TODO`/`FIXME`/stub markers anywhere in `src/`; css-audit is strict-clean (0 used-but-undefined **and** 0 dead rules); every surface is exercised by at least one suite below |

## Quality gates

| Criterion | Threshold | Result (median of 3, prod build) | Gate |
| --- | --- | --- | --- |
| Lighthouse PWA | 100 | 100 | PASS |
| Accessibility (Lighthouse) | ≥ 95 | 100 | PASS |
| axe-core | 0 serious/critical | **0 violations at any impact**, dark **and** light | PASS |
| Largest Contentful Paint | < 2.5 s | 2.27 s | PASS |
| Cumulative Layout Shift | < 0.1 | 0.000 | PASS |
| Total Blocking Time | — (tracked) | 145–457 ms across runs (shared-CPU noise) | — |

## The battery

| Suite | What it is | Dev `:5173` | Prod `:4173` |
| --- | --- | --- | --- |
| `tools/pipeline-test.mjs` | 90 checks, no browser: cleaning passes, prompt assembly, timing, parser repair, error classification, stubbed truncation | 90 pass / 5 skipped (live-only) | — |
| `tools/browser-check.py` | 54 checks of the real UI, incl. IndexedDB round-trip, prune at the 50-record cap, Clear All Data | 54/54 | 39/39 + 12 skips |
| `tools/e2e-check.py` | 59 checks with mocked Jina + Groq: full generation, cancel, clipboard, history, rate limits, offline, cut-short, incomplete | 59/59 | 59/59 |
| `tools/motion-audit.py` | 14 checks: every element, both motion states | 14/14 | 14/14 |
| `tools/a11y-check.py` | axe-core 4.10.2 across 7 surfaces, per theme | 0 violations (dark, light) | — |
| `tools/pwa-check.py` | 27 checks: SW lifecycle, precache, offline payloads, `offline.html`, boot with the server down | — | 27/27 |
| `tools/css-audit.mjs` | stylesheet coverage; `--strict` exits 0 | 0 + 0 | — |
| `tools/live-check.py` | **the only live suite** — real r.jina.ai + api.groq.com through the built bundle | — | 11/11 ×2 |
| `npm run lighthouse` | the four thresholds above, medians enforced | — | PASS |

## Live evidence

* **`live-check` 11/11 twice in a row** on the production bundle against the
  real APIs — separate runs ~75 s apart because the free tier meters tokens
  per minute.
* The same run is what caught the completion budget problem: measured at the
  API, a real page cost **5,443 prompt tokens** and the completion spent
  **1,372 of its allowance on reasoning** before writing a word of script, so
  the original 3,000-token cap left ~1,600 for a 90-second script. Page trim
  and `max_tokens` were retuned around that (see README → *Free-tier budget*),
  and a response that stops at the ceiling now reports itself as cut short
  instead of masquerading as a missing section.
* Observed in the wild and handled: `429` (falls through to the second model,
  or explains the wait), `401` (service-side key message, nothing to re-enter),
  `413` (momentary edge rejection — retryable), `finish_reason: "length"`.

## The deployed instance

Everything above is about a local build; the numbers also hold on the
deployment that actually ships — `KF_BASE=https://keyframe-nine.vercel.app`:

* `e2e-check.py` **59/59** against the Vercel deployment (mocked Jina + Groq:
  full generation, cancel, offline path, rate limits, history round-trip).
* `live-check.py` **11/11** against the Vercel deployment — a real `r.jina.ai`
  fetch and a real Groq generation with the bundled key, driven from a browser,
  no proxy in between. That is Rules 3, 4 and 6 proven end to end on the host.
* `/sw.js` answers `cache-control: no-cache, no-store, must-revalidate` on
  `vercel.app` — the `vercel.json` mirror of `public/_headers` (Rule 12), and
  hashed `/assets/*` answer `immutable`.
* The served HTML references **no third-party origin**: every `src`/`href` is
  same-origin, and the only outbound calls are the two API hosts at
  generation time (Rule 5).
* The key is readable in the deployed bundle **by design** (Rule 4) — see
  `DEPLOY.md` → Notes for the quota story.

## Reproduce

```bash
npm install && npm run build
npm run preview -- --port 4173          # the suites default to :5173 (dev)
python3 tools/browser-check.py
python3 tools/e2e-check.py
KF_BASE=http://localhost:4173 python3 tools/e2e-check.py
python3 tools/motion-audit.py && python3 tools/a11y-check.py
python3 tools/pwa-check.py && npm run lighthouse
python3 tools/live-check.py             # spends real free-tier quota
KF_BASE=https://keyframe-nine.vercel.app python3 tools/e2e-check.py   # 59/59
KF_BASE=https://keyframe-nine.vercel.app python3 tools/live-check.py  # 11/11
```

## Known limits

* **Lighthouse composite scores are noisy on a shared CPU** (86–97 observed;
  TBT swings 145–457 ms between runs on the same build):
  compare LCP / CLS / TBT and the enforced gates, not the single perf number.
* **Live runs share one free tier**: a `429` mid-run is handled behaviour, not
  a defect. `live-check` is a pre-release check, not part of the routine loop.
* **`artifacts/*.png` are captured by the suites** — `browser-check` and
  `e2e-check` write their screenshots on every run, so those files churn in
  git by design.
* The in-sandbox Chrome needs its unpacked libraries
  (`bash tools/fetch-chrome-libs.sh`, then `LD_LIBRARY_PATH`); `npm run
  lighthouse` finds both Chrome and the libraries itself.
