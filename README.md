# ▶ Keyframe — Demo Video Scripter & Prompter

Turn any app's URL into a ready-to-shoot demo video script. Paste a link, list the
features that matter, and Keyframe returns a shot-by-shot 1–2 minute script with
timing, what to click, what to say — plus a cut list of what was left out and a
ready-to-paste prompt for video creation tools.

**Free · No sign-up · No backend · No database.** Everything runs in the browser;
history and settings live on your device.

**Live:** <https://keyframe-nine.vercel.app> · **Source:** <https://github.com/jegede20/keyframe>

---

## How it works

```
        ┌────────────┐     ┌──────────────┐     ┌───────────────┐
URL ───▶│  r.jina.ai │────▶│  prompt 4    │────▶│  api.groq.com │───▶ script
        │  (reader)  │     │  layers      │     │ gpt-oss-120b  │     JSON
        └────────────┘     └──────────────┘     └───────────────┘
              ▲                                        │
              └──────── both calls go straight from the browser ────────┘
```

1. **`r.jina.ai/{url}`** — reads the page as markdown (no API key needed).
2. **Cleaning pass** — strips cookie banners, share widgets, anchors, duplicate
   lines; caps at 48,000 chars; extracts H1–H3 headings as candidate "screens".
3. **Four-layer prompt** — system director rules, scraped context, your brief
   (features, length, tone, video tool), and a strict JSON output contract.
4. **Groq** — `openai/gpt-oss-120b`, `temperature 0.4`, JSON mode, and
   `reasoning_effort: 'low'` so the model's thinking budget can't crowd out the
   script. A `429` walks down to `openai/gpt-oss-20b` (a separate quota bucket).
   *(Groq retired the llama-3.3-70b-versatile / llama3-8b-8192 pair the original
   spec named — the gpt-oss family is what the free tier serves now.)*
5. **Validator + timing repair** — the parser guarantees durations sum to the
   exact requested length, fills missing fields with placeholders instead of
   crashing, and re-derives every `timeStart`/`timeEnd` from 0:00.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | React 18 + Vite 5 (plain JavaScript, no TypeScript) |
| Styling | Tailwind CSS + CSS custom properties (design tokens in `src/styles/globals.css`) |
| Fonts | Self-hosted (Space Grotesk / Inter / JetBrains Mono, latin subsets) with metric-matched fallback faces — zero third-party requests |
| PWA | Custom `sw.js` + `vite-plugin-pwa` (`injectManifest`) |
| Storage | `localStorage` (settings, inputs, history index) + IndexedDB (full scripts, custom adapter) |
| URL reading | Jina AI Reader — `https://r.jina.ai/{url}` |
| AI | Groq — `openai/gpt-oss-120b` (fallback `openai/gpt-oss-20b`) |
| Icons | Lucide React |
| Hosting | Vercel (free tier) — <https://keyframe-nine.vercel.app> |

## Running locally

```bash
npm install
cp .env.example .env      # then paste your key into VITE_GROQ_API_KEY
npm run dev               # http://localhost:5173
npm run build && npm run preview
```

### The API key

`VITE_GROQ_API_KEY` is the app's key (bundled into the client, so it is public —
get one free at <https://console.groq.com/keys>). There is no key field in the
UI: visitors just generate. Put a real key in `.env` (or the host's environment
variables) before building or every generation fails with the "key rejected"
error card.

**Free-tier budget.** TPM is 8,000 per model, and Groq counts prompt +
`max_tokens` against it, so the two budgets compete for one ceiling. Measured on
a real page: 17,905 prompt characters cost 5,443 tokens, and the completion's
allowance paid for 1,372 *reasoning* tokens before a single word of script — the
old 3,000-token cap left roughly 1,600 tokens for a 90-second script, and
responses occasionally stopped mid-JSON as a result. Keyframe now trims the
scraped page to ~9k characters (body prose only — headings, which become screen
names, always survive) and asks for at most 3,600 completion tokens, keeping the
pair near 7,500 of the 8,000 ceiling. A `429` on the 120b model retries on the
20b model automatically; a response that stops at the ceiling (`finish_reason:
"length"`) is reported as a cut-short error with a one-tap retry instead of
being mistaken for a missing section.

## Dev console test harness (Step 33)

In dev mode only, `src/dev/consoleTests.js` installs `window.__keyframeTest`:

```js
__keyframeTest.all()                       // offline suite + live Jina read
__keyframeTest.jina('https://tailwindcss.com')
__keyframeTest.groq()                      // live generation, bundled key
__keyframeTest.groq(60, 'energetic')       // 60-second script
```

The Groq suite asserts: shot count inside the spec range, durations summing
exactly to the target, first shot at `0:00`, final `timeEnd` on the total, every
narrator line inside 130 wpm, cut list length 2–8, prompt length, and no filler
opening line.

## Performance

Measured on the production build with Lighthouse 11 (mobile, simulated 4G throttling), median of three passes:

| Metric | Result | Spec target |
| --- | --- | --- |
| PWA | **100** | 100 |
| Accessibility | **100** | ≥ 95 |
| Best practices | **100** | — |
| LCP | **~2.3 s** | < 2.5 s |
| CLS | **0.000** | < 0.1 |
| Performance | 86–97 (TBT varies on shared CPUs) | — |

Three changes got it there, each verified by measurement:

1. **Self-hosted fonts.** The Google Fonts `<link>` cost two cross-origin round trips before the hero could paint, and left the page with no webfont at all when offline. The same latin subsets are now served from `/fonts` with `font-display: swap` and preloaded. Replaced third-party requests: **0**.
2. **Metric-matched fallbacks.** Six extra `@font-face` blocks (two per brand face, tuned against Arial/Helvetica and DejaVu Sans) with `size-adjust`/`ascent-override` computed from each font's own OS/2 + hhea tables. Text no longer reflows when the webfont arrives.
3. **Critical CSS inlined + a floating install banner.** The stylesheet (~7 kB) is inlined into `index.html` at build time (the emitted file stays in precache), removing a blocking round trip; and the PWA install banner — which appears ~2 s in, once the service worker activates — is `position: fixed` instead of sitting in the document flow, so it no longer pushes the hero down. That banner was responsible for the *entire* pre-fix CLS of 0.148. It is anchored low in the viewport — a fixed banner pinned under the navbar sat straight over the hero headline on a phone — and the band depends on what is below it: **24 px** on the landing, where nothing sits at the bottom of the screen, and the toast band’s **76 px** only inside the workspace, where the mobile action bar is present and the banner is checked to clear it by 11 px. The landing keeps no sticky action bar at all: its Generate lives in the hero and the closing CTA.

> One thing tried and rejected: `content-visibility: auto` on the below-fold sections. Measured against the same build it moved nothing (LCP 2.3 s either way) and broke text-based assertions, so it was removed rather than shipped on faith.

Run the acceptance checks yourself with `npm run lighthouse` (see `tools/lighthouse.mjs`) after `npm run build && npm run preview` — or point it at the live site with `LH_URL=https://keyframe-nine.vercel.app/`, which measures **98 / 100 / 100 / 100** with LCP 1.93 s and CLS 0.000 (median of 3).

### Running the suites against the built bundle

Every browser suite accepts `KF_BASE`, so the same checks can be pointed at the artifact that actually ships — the one with inlined CSS, hashed assets and a live service worker:

```bash
npm run build && npm run preview -- --port 4173 &
KF_BASE=http://localhost:4173 python3 tools/browser-check.py   # 51/51 (12 dev-only skips)
KF_BASE=http://localhost:4173 python3 tools/e2e-check.py       # 59/59
KF_BASE=http://localhost:4173 python3 tools/live-check.py      # 11/11, real APIs
```

The twelve skips are all dev-only: the console harness (2 checks), the
source-module storage round-trip and prune tests (5), and the storage seeding
behind Clear All Data (5). Those paths import `src/` modules directly, so they
skip rather than fail when the target is a built bundle.

## Automated verification (`tools/`)

Everything below runs without any paid service. Chrome is pulled by
`choreo_get_chrome`; the offline wrapper is described in `DEPLOY.md` → Verification.
A requirement-by-requirement map of the standing rules and quality gates, with
the evidence for each, lives in [`VERIFICATION.md`](VERIFICATION.md).

| Command | What it proves |
| --- | --- |
| `node tools/run-pipeline-test.mjs` | 90 checks: URL validation, all six cleaning passes, live Jina read, 4-layer prompt assembly, timing repair, 130 wpm math, parser repair paths, error classification, and a stubbed `finish_reason: "length"` response that must surface as a retryable truncation without spending a second model. Add `GROQ_API_KEY=gsk_…` to run the live-generation checks. |
| `python3 tools/browser-check.py` | 66 checks against the dev server (12 are skipped on the production build, where there is no source-module import, dev harness or seeded storage): landing render, FAQ accordion, output preview tabs, settings + theme persistence (FOUC script), history drawer, IndexedDB round-trip, URL validation, hero → workspace entry, error box with preserved inputs, **the responsive header** (a phone shows logo + hamburger only, no section links, 44px target), the mobile layout + 44px touch targets, **the landing having no sticky action bar** while the workspace does, **install-banner geometry** (floats, clears the hero, 24px band on the landing, 76px band above the workspace's action bar), hamburger drawer (carrying history/settings/Get Started), and **Clear All Data** (seeds a script + settings, walks the confirm dialog, then proves every `kf_*` key and every record is gone). |
| `python3 tools/e2e-check.py` | 59 checks with **mocked Jina + Groq**: full generation, stepper, cancel (inputs preserved), 8 shot cards, timeline connectors, pace chips, all three tabs, real clipboard contents for Copy All / per-shot copy, New Script → auto-save → history → reload, "+ Add to Script" regeneration, reduced-motion, **both rate-limit paths** (primary 429 → second model + toast; both limited → error card with provider detail, inputs preserved, Try Again re-issues), **generation while offline**, and **responses that stop early** (a cut-short response → named card, inputs preserved, one model call on retry; an incomplete one naming the missing section). |
| `python3 tools/motion-audit.py` | **Rule 8, exhaustively.** Walks every element on landing / workspace / results / settings / history / toast in both motion states and asserts that with `prefers-reduced-motion: reduce` nothing has a running duration or delay — including the inline JSX `transition:` styles a stylesheet gate cannot reach — that reveals stay readable, and that motion-allowed users still get their animations. |
| `python3 tools/pwa-check.py` | 27 checks on the production build: SW lifecycle, versioned caches, precache contents, `503 {"error":"offline"}` payloads for both API hosts, `offline.html` fallback, cached-shell boot with the server stopped, `_headers`/`_redirects`/manifest. |
| `python3 tools/a11y-check.py` | axe-core 4.10.2 audit of landing, workspace, results, overlays and mobile — **0 serious/critical violations** in dark and light themes (`KF_THEME=light`). |
| `python3 tools/live-check.py [url]` | **The only live suite.** Drives the real UI against real r.jina.ai + api.groq.com: generation, shot cards, 300–600 word video prompt, cut list, clipboard contents, history — 11 checks. Spends real free-tier quota, so run it before a release rather than in the routine loop. |
| `npm run lighthouse` | Three Lighthouse passes on the production build, medians reported, and the four acceptance thresholds enforced (PWA 100 · a11y ≥ 95 · LCP < 2.5 s · CLS < 0.1). |
| `node tools/css-audit.mjs` | Stylesheet coverage: every `kf-*` class a component applies is defined somewhere, and no dead rules are left behind (`npm run audit:css`). |

## Project layout

```
public/           manifest.json, sw.js, offline.html, _headers, _redirects,
                  icons/ (11 PNGs), og-image.png, screenshots/
src/
  components/     layout · landing · input · loading · results · overlays · shared
  hooks/          useAppState · useHistory · useSettings · useToast · useCopy ·
                  usePWAInstall · useOnlineStatus
  services/       jina · groq · promptBuilder · outputParser · errorClassifier
  store/          storage.js (localStorage + IndexedDB adapter)
  styles/         reset.css · globals.css (tokens) · animations.css
  utils/          timing · wordCount · exportHistory · formatScript
  dev/            consoleTests.js (dev-only harness)
tools/            test suites + icon/screenshot generators
```

## The five states

`empty → loading → results` — with `error` and `history` alongside. There is no
routing; the app is one canvas. Inputs are **never** lost on failure, and
`New Script` auto-saves to history before clearing.

## Privacy

No backend, no database, no sign-up, no analytics. Two outbound requests exist,
both direct from the browser: the URL you typed goes to Jina to be read, and the
scraped text plus your brief goes to Groq to be written. Everything else — settings,
inputs, full scripts — stays in your browser's storage.

---

MIT licensed. Built with ☕ and free tiers.
