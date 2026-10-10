# ▶ Keyframe — Demo Video Scripter & Prompter

Turn any app's URL into a ready-to-shoot demo video script. Paste a link, list the
features that matter, and Keyframe returns a shot-by-shot 1–2 minute script with
timing, what to click, what to say — plus a cut list of what was left out and a
ready-to-paste prompt for video creation tools.

**Free · No sign-up · No backend · No database.** Everything runs in the browser;
history and settings live on your device.

---

## How it works

```
        ┌────────────┐     ┌──────────────┐     ┌───────────────┐
URL ───▶│  r.jina.ai │────▶│  prompt 4    │────▶│  api.groq.com │───▶ script
        │  (reader)  │     │  layers      │     │ llama-3.3-70b │     JSON
        └────────────┘     └──────────────┘     └───────────────┘
              ▲                                        │
              └──────── both calls go straight from the browser ────────┘
```

1. **`r.jina.ai/{url}`** — reads the page as markdown (no API key needed).
2. **Cleaning pass** — strips cookie banners, share widgets, anchors, duplicate
   lines; caps at 48,000 chars; extracts H1–H3 headings as candidate "screens".
3. **Four-layer prompt** — system director rules, scraped context, your brief
   (features, length, tone, video tool), and a strict JSON output contract.
4. **Groq** — `llama-3.3-70b-versatile`, `temperature 0.4`, JSON mode,
   auto-fallback to `llama3-8b-8192` on `429`.
5. **Validator + timing repair** — the parser guarantees durations sum to the
   exact requested length, fills missing fields with placeholders instead of
   crashing, and re-derives every `timeStart`/`timeEnd` from 0:00.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | React 18 + Vite 5 (plain JavaScript, no TypeScript) |
| Styling | Tailwind CSS + CSS custom properties (design tokens in `src/styles/globals.css`) |
| PWA | Custom `sw.js` + `vite-plugin-pwa` (`injectManifest`) |
| Storage | `localStorage` (settings, inputs, history index) + IndexedDB (full scripts, custom adapter) |
| URL reading | Jina AI Reader — `https://r.jina.ai/{url}` |
| AI | Groq — `llama-3.3-70b-versatile` (fallback `llama3-8b-8192`) |
| Icons | Lucide React |
| Hosting | Cloudflare Pages (free tier) |

## Running locally

```bash
npm install
cp .env.example .env      # then paste your key into VITE_GROQ_API_KEY
npm run dev               # http://localhost:5173
npm run build && npm run preview
```

### The API key

`VITE_GROQ_API_KEY` is the app's built-in key (bundled into the client, so it is
public — get one free at <https://console.groq.com/keys>). Users can paste their
own key in **Settings → API Key**; it is validated with a tiny test call and kept
in `localStorage` on their device only. A user key always wins over the built-in one.

> Without any key the app still runs; the first generation shows the
> "Invalid API key — check it in Settings" error box instead of crashing.

## Dev console test harness (Step 33)

In dev mode only, `src/dev/consoleTests.js` installs `window.__keyframeTest`:

```js
__keyframeTest.all()                       // offline suite + live Jina read
__keyframeTest.jina('https://tailwindcss.com')
__keyframeTest.groq('gsk_...', 90)         // live generation checks (needs a key)
__keyframeTest.groq('gsk_...', 60, 'energetic')
```

The Groq suite asserts: shot count inside the spec range, durations summing
exactly to the target, first shot at `0:00`, final `timeEnd` on the total, every
narrator line inside 130 wpm, cut list length 2–8, prompt length, and no filler
opening line.

## Automated verification (`tools/`)

Everything below runs without any paid service. Chrome is pulled by
`choreo_get_chrome`; the offline wrapper is described in `DEPLOY.md` → Verification.

| Command | What it proves |
| --- | --- |
| `node tools/run-pipeline-test.mjs` | 79 checks: URL validation, all six cleaning passes, live Jina read, 4-layer prompt assembly, timing repair, 130 wpm math, parser repair paths, error classification. Add `GROQ_API_KEY=gsk_…` to run the live-generation checks. |
| `python3 tools/browser-check.py` | 42 checks against the dev server: landing render, FAQ accordion, output preview tabs, settings + theme persistence (FOUC script), history drawer, IndexedDB round-trip, URL validation, hero → workspace entry, error box with preserved inputs, mobile layout + 44px touch targets, hamburger drawer. |
| `python3 tools/e2e-check.py` | 42 checks with **mocked Jina + Groq**: full generation, stepper, cancel (inputs preserved), 8 shot cards, timeline connectors, pace chips, all three tabs, real clipboard contents for Copy All / per-shot copy, New Script → auto-save → history → reload, "+ Add to Script" regeneration, reduced-motion. |
| `python3 tools/pwa-check.py` | 27 checks on the production build: SW lifecycle, versioned caches, precache contents, `503 {"error":"offline"}` payloads for both API hosts, `offline.html` fallback, cached-shell boot with the server stopped, `_headers`/`_redirects`/manifest. |
| `python3 tools/a11y-check.py` | axe-core 4.10.2 audit of landing, workspace, results, overlays and mobile — **0 serious/critical violations** in dark and light themes (`KF_THEME=light`). |

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
