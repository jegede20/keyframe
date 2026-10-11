"""
Browser verification for Keyframe (dev server on :5173).
Launches Chrome via choreographer/CDP, captures console + page errors,
runs DOM assertions, screenshots desktop and mobile viewports.
"""
import asyncio
import base64
import json
import os
import sys

from choreographer import Browser

# Base URL is overridable so the same suite can be pointed at the built
# bundle (npm run preview -- --port 4173) — see KF_BASE.
BASE = os.environ.get("KF_BASE", "http://localhost:5173").rstrip("/")
URL = BASE + "/"
OUT = os.path.join(os.path.dirname(__file__), "..", "artifacts")
os.makedirs(OUT, exist_ok=True)

results = []
console_errors = []


skipped = []


def skip(name, why):
    skipped.append((name, why))
    print(f"  SKIP  {name} — {why}")


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("  PASS  " if ok else "  FAIL  ") + name + (f" — {detail}" if detail else ""))


async def evaluate(tab, expression):
    res = await tab.send_command(
        "Runtime.evaluate",
        {"expression": expression, "returnByValue": True, "awaitPromise": True},
    )
    return (res.get("result") or {}).get("result", {}).get("value")


async def screenshot(tab, filename):
    res = await tab.send_command("Page.captureScreenshot", {"format": "png"})
    payload = (res.get("result") or {}).get("data") or res.get("data")
    path = os.path.join(OUT, filename)
    with open(path, "wb") as fh:
        fh.write(base64.b64decode(payload))
    print(f"  shot: {path}")
    return path


async def main():
    async with Browser(headless=True) as browser:
        print("Chrome launched")
        tab = await browser.create_tab(URL)
        await asyncio.sleep(1.0)
        # The dev-only harness and source-module imports (/src/...) only exist
        # while Vite serves the app. Against the built bundle these checks are
        # skipped rather than failed — the harness is deliberately excluded
        # from production builds.
        DEV = bool(
            await evaluate(
                tab,
                "!!document.querySelector('script[src*=\"@vite/client\"]')",
            )
        )
        print(f"(target: {BASE} — {'dev server' if DEV else 'production build'})")

        # ── collect console + exceptions ─────────────────────────────
        async def on_console(payload):
            params = payload.get("params", {})
            if params.get("type") in ("error", "warning"):
                text = params.get("args", [{}])
                msg = text[0].get("value") or text[0].get("description") or ""
                if params["type"] == "error":
                    console_errors.append(msg)
                print(f"  [{params['type']}] {msg}")

        async def on_exception(payload):
            details = payload.get("params", {}).get("exceptionDetails", {})
            desc = details.get("exception", {}).get("description") or details.get("text")
            console_errors.append(f"UNCAUGHT: {desc}")
            print(f"  [uncaught] {desc}")

        tab.subscribe("Runtime.consoleAPICalled", on_console)
        tab.subscribe("Runtime.exceptionThrown", on_exception)
        await tab.send_command("Runtime.enable")
        await tab.send_command("Page.enable")

        # ── load ─────────────────────────────────────────────────────
        await tab.send_command("Page.navigate", {"url": URL})
        await asyncio.sleep(3.5)

        print("\n1. Landing page render")
        title = await evaluate(tab, "document.title")
        check("title set", title.startswith("Keyframe"), title)
        check(
            "design token applied",
            await evaluate(tab, "getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim()"),
            "accent token readable",
        )
        check("hero headline present", await evaluate(tab, "!!document.querySelector('h1')"))
        hero_text = await evaluate(tab, "document.querySelector('h1')?.textContent || ''")
        check("hero mentions demo script", "demo script" in hero_text.lower(), hero_text[:70])
        check("hero url input present", await evaluate(tab, "!!document.getElementById('kf-hero-url')"))
        check("generate button present", await evaluate(tab, "!!document.querySelector('button[type=submit]')"))
        check("trust bar rendered", await evaluate(tab, "document.body.innerText.includes('No account needed')"))
        check("how it works rendered", await evaluate(tab, "document.body.innerText.includes('Paste your link')"))
        check("bento features rendered", await evaluate(tab, "document.body.innerText.includes('Shot-by-Shot Script')"))
        check("output preview rendered", await evaluate(tab, "document.body.innerText.includes('This is what you get back')"))
        check("faq rendered", await evaluate(tab, "document.body.innerText.includes('Is Keyframe really free?')"))
        check(
            "footer rendered",
            await evaluate(
                tab,
                """(() => {
                  const base = document.querySelector('.kf-footer-base');
                  return !!base
                    && document.body.innerText.includes('Start a script')
                    && document.body.innerText.includes('No tracking');
                })()""",
            ),
        )
        check("footer has no GitHub link", await evaluate(tab, "![...document.querySelectorAll('footer a')].some(a => /github/i.test(a.textContent))"))
        # The 780px default viewport is below the desktop breakpoint: section
        # links belong in the drawer, not stacked into the header.
        check(
            "header shows no section links below 1200px",
            await evaluate(tab, """getComputedStyle(document.querySelector('.kf-nav-center')).display === 'none'"""),
        )
        check("no console errors on load", len(console_errors) == 0, "; ".join(console_errors[:2]))

        await screenshot(tab, "01-landing-desktop.png")

        # ── FAQ accordion ────────────────────────────────────────────
        print("\n2. FAQ accordion")
        faq_before = await evaluate(
            tab,
            """(() => {
              const btns = [...document.querySelectorAll('button[aria-controls^="kf-faq-"]')];
              return btns.map(b => b.getAttribute('aria-expanded')).join(',');
            })()""",
        )
        await evaluate(
            tab,
            """(() => {
              const btns = [...document.querySelectorAll('button[aria-controls^="kf-faq-"]')];
              btns[2].click();
              return true;
            })()""",
        )
        await asyncio.sleep(0.4)
        faq_after = await evaluate(
            tab,
            """(() => [...document.querySelectorAll('button[aria-controls^="kf-faq-"]')].map(b => b.getAttribute('aria-expanded')).join(','))()""",
        )
        check("accordion toggles", faq_before != faq_after, f"{faq_before} → {faq_after}")

        # ── Output preview tabs ──────────────────────────────────────
        print("\n3. Output preview tabs")
        check(
            "cut list tab switches",
            await evaluate(
                tab,
                """(() => {
                  const tab = [...document.querySelectorAll('button[role=tab]')].find(b => b.textContent.includes('Cut List'));
                  tab.click();
                  return true;
                })()""",
            ),
        )
        await asyncio.sleep(0.4)
        check(
            "cut list content visible",
            await evaluate(tab, "document.body.innerText.includes('Integrations directory')"),
        )

        # ── Settings modal ───────────────────────────────────────────
        print("\n4. Settings modal")
        await evaluate(
            tab,
            """(() => {
              const btn = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Settings');
              btn.click();
              return true;
            })()""",
        )
        await asyncio.sleep(0.5)
        check("settings opened", await evaluate(tab, "document.body.innerText.includes('Default Script Length')"))
        check("settings has no API-key section", await evaluate(tab, "!document.body.innerText.includes('API Key')"))
        check("theme select present", await evaluate(tab, """!!document.querySelector('select')"""))
        # switch theme to light
        await evaluate(
            tab,
            """(() => {
              const selects = [...document.querySelectorAll('select')];
              const theme = selects[0];
              const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
              setter.call(theme, 'light');
              theme.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            })()""",
        )
        await asyncio.sleep(0.5)
        theme_attr = await evaluate(tab, "document.documentElement.getAttribute('data-theme')")
        check("theme switch applies", theme_attr == "light", f"data-theme={theme_attr}")
        stored = await evaluate(tab, "JSON.parse(localStorage.getItem('kf_settings') || '{}').theme")
        check("theme persisted to localStorage", stored == "light", f"kf_settings.theme={stored}")
        await screenshot(tab, "02-settings-light.png")
        # back to dark
        await evaluate(
            tab,
            """(() => {
              const theme = document.querySelectorAll('select')[0];
              const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
              setter.call(theme, 'dark');
              theme.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            })()""",
        )
        await asyncio.sleep(0.3)
        await evaluate(
            tab,
            """(() => {
              const btn = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Close settings');
              btn.click();
              return true;
            })()""",
        )
        await asyncio.sleep(0.4)

        # ── History drawer ───────────────────────────────────────────
        print("\n5. History drawer")
        await evaluate(
            tab,
            """(() => {
              const btn = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '').startsWith('Script history'));
              btn.click();
              return true;
            })()""",
        )
        await asyncio.sleep(0.5)
        check("drawer opened", await evaluate(tab, "document.body.innerText.includes('Script History')"))
        check("empty state message", await evaluate(tab, "document.body.innerText.includes('Nothing here yet')"))
        check("drawer note present", await evaluate(tab, "document.body.innerText.includes('stored only on this device')"))
        await screenshot(tab, "03-history-empty.png")
        await evaluate(tab, """(() => { const b=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Close history'); b.click(); return true; })()""")
        await asyncio.sleep(0.3)

        # ── Dev console harness (offline suite) ─────────────────────
        print("\n6. Dev harness — offline suite")
        if DEV:
            harness_ok = await evaluate(tab, "typeof window.__keyframeTest === 'object'")
            check("__keyframeTest installed", harness_ok)
            if harness_ok:
                suite = await evaluate(
                    tab,
                    """(async () => { const r = await window.__keyframeTest.offline(); return JSON.stringify(r); })()""",
                )
                data = json.loads(suite) if suite else {}
                check("offline suite passes", data.get("failed", 1) == 0, f"{data.get('passed')} passed / {data.get('failed')} failed")
        else:
            skip("__keyframeTest installed", "dev-only harness, excluded from production builds")
            skip("offline suite passes", "dev-only harness, excluded from production builds")

        # ── IndexedDB roundtrip (storage adapter in the real browser) ──
        print("\n7. Storage roundtrip (IndexedDB + localStorage via app modules)")
        if DEV:
            rt = await evaluate(
                tab,
                """(async () => {
                  const mod = await import('/src/store/storage.js');
                  const rec = {
                    id: 'browser-test-1',
                    input: { url: 'https://example.com', features: 'x', length: 60, tone: 'casual', videoTool: 'any' },
                    output: { meta: { appName: 'Test', totalSeconds: 60, shotCount: 5, estimatedWordCount: 40, tone: 'casual' }, script: [{ shotNumber: 1 }], cutList: [], videoPrompt: { target: 'any', fullPrompt: 'x' } },
                    createdAt: new Date().toISOString(),
                    generation: { model: 'test', inputTokens: 1, outputTokens: 1, generationMs: 5 },
                  };
                  await mod.saveScript(rec);
                  const back = await mod.getScript('browser-test-1');
                  const count = await mod.countScripts();
                  await mod.deleteScript('browser-test-1');
                  const after = await mod.getScript('browser-test-1');
                  mod.writeJSON('kf_settings', { theme: 'dark', defaultLength: 90 });
                  const s = mod.readSettings();
                  return JSON.stringify({ saved: !!back, appName: back?.output?.meta?.appName, count, deleted: after === null || after === undefined, settingsMerged: s.defaultTone === 'professional' });
                })()""",
            )
            rt_data = json.loads(rt) if rt else {}
            check("IndexedDB save/read", rt_data.get("saved") and rt_data.get("appName") == "Test", str(rt_data))
            check("IndexedDB delete", rt_data.get("deleted"), str(rt_data.get("deleted")))
            check("settings merge with defaults", rt_data.get("settingsMerged"))

            # ── History cap (acceptance: prune past 50) ───────────────
            # Saves 55 records one second apart so the createdAt index has a
            # real order, then checks the oldest five are gone and the newest
            # five survived.
            prune = await evaluate(
                tab,
                """(async () => {
                  const mod = await import('/src/store/storage.js');
                  const base = Date.now() - 60000;
                  for (let i = 0; i < 55; i += 1) {
                    await mod.saveScript({
                      id: 'prune-' + String(i).padStart(2, '0'),
                      input: { url: 'https://example.com', features: 'x', length: 60, tone: 'casual', videoTool: 'any' },
                      output: { meta: { appName: 'P' + i, totalSeconds: 60, shotCount: 1, estimatedWordCount: 1, tone: 'casual' },
                                script: [{ shotNumber: 1 }], cutList: [], videoPrompt: { target: 'any', fullPrompt: 'x' } },
                      createdAt: new Date(base + i * 1000).toISOString(),
                      generation: { model: 'test', inputTokens: 1, outputTokens: 1, generationMs: 1 },
                    });
                  }
                  const before = await mod.countScripts();
                  const removed = await mod.pruneOldScripts();
                  const after = await mod.countScripts();
                  const oldestGone = (await mod.getScript('prune-00')) === null;
                  const newestKept = !!(await mod.getScript('prune-54'));
                  // clean up so later sections see a tidy store
                  for (let i = 0; i < 55; i += 1) await mod.deleteScript('prune-' + String(i).padStart(2, '0'));
                  return JSON.stringify({ before, removed, after, oldestGone, newestKept });
                })()""",
            )
            pr = json.loads(prune) if prune else {}
            check("55 records written", pr.get("before") == 55, str(pr.get("before")))
            check("prune removes the excess", pr.get("removed") == 5, f"removed {pr.get('removed')}")
            check("exactly 50 survive", pr.get("after") == 50, str(pr.get("after")))
            check("oldest records dropped first", pr.get("oldestGone") is True)
            check("newest record kept", pr.get("newestKept") is True)

        else:
            skip("IndexedDB save/read", "imports a source module — dev server only")
            skip("IndexedDB delete", "imports a source module — dev server only")
            skip("settings merge with defaults", "imports a source module — dev server only")
            skip("history prune (55 → 50)", "imports a source module — dev server only")
            skip("prune keeps the newest records", "imports a source module — dev server only")

        # ── Validation + inputs persistence ──────────────────────────
        print("\n8. Input validation + persistence (Step 43/46/47)")
        await evaluate(tab, """(() => { localStorage.removeItem('kf_last_inputs'); return true; })()""")
        await tab.send_command("Page.navigate", {"url": URL})
        await asyncio.sleep(3)
        await evaluate(
            tab,
            """(() => {
              const input = document.getElementById('kf-hero-url');
              const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
              setter.call(input, 'not-a-url');
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('blur', { bubbles: true }));
              return true;
            })()""",
        )
        await asyncio.sleep(0.4)
        check("invalid url blocks generate", await evaluate(tab, "document.querySelector('button[type=submit]').disabled"))
        await evaluate(
            tab,
            """(() => {
              const input = document.getElementById('kf-hero-url');
              input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
              return true;
            })()""",
        )
        await asyncio.sleep(0.3)
        check("inline url error shown", await evaluate(tab, "document.body.innerText.includes('Enter a full web address')"))
        await evaluate(
            tab,
            """(() => {
              const input = document.getElementById('kf-hero-url');
              const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
              setter.call(input, 'https://tailwindcss.com');
              input.dispatchEvent(new Event('input', { bubbles: true }));
              return true;
            })()""",
        )
        await asyncio.sleep(0.6)
        check("valid url enables generate", not await evaluate(tab, "document.querySelector('button[type=submit]').disabled"))
        persisted = await evaluate(tab, "JSON.parse(localStorage.getItem('kf_last_inputs') || '{}').url")
        check("last input persisted", persisted == "https://tailwindcss.com", str(persisted))

        # ── Error path — the only mocked call in this suite, so the 401
        #    branch stays deterministic and never touches the real quota.
        print("\n9. Hero entry → workspace, then error path (401 from Groq)")
        await evaluate(
            tab,
            """(() => {
              window.__kfRealFetch = window.__kfRealFetch || window.fetch.bind(window);
              window.fetch = (input, init) => {
                const url = typeof input === 'string' ? input : (input && input.url) || '';
                if (url.includes('api.groq.com')) {
                  return Promise.resolve(new Response(
                    JSON.stringify({ error: { message: 'stubbed 401 for browser-check' } }),
                    { status: 401, headers: { 'Content-Type': 'application/json' } }
                  ));
                }
                if (url.includes('r.jina.ai')) {
                  const md = [
                    '# Stub Boards - project tracking for small teams',
                    '',
                    '## Home dashboard',
                    'Live tiles for every project, updated in real time for the whole team to see.',
                    '',
                    '## Board view',
                    'Drag cards between columns and every status change syncs instantly across devices.',
                    '',
                    '## Reports',
                    'Filter by squad or sprint and spot bottlenecks before they slow the release down.',
                    '',
                    '## Settings',
                    'Workspace preferences, notifications and billing all live on this screen.',
                  ].join('\\n');
                  return Promise.resolve(new Response(md, { status: 200, headers: { 'Content-Type': 'text/markdown' } }));
                }
                return window.__kfRealFetch(input, init);
              };
              document.querySelector('button[type=submit]').click();
              return true;
            })()""",
        )
        await asyncio.sleep(1.2)
        check("hero submit enters workspace", await evaluate(tab, "!!document.getElementById('kf-main-features')"))
        # fill features
        await evaluate(
            tab,
            """(() => {
              const ta = document.getElementById('kf-main-features');
              const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
              setter.call(ta, 'One-click export, real-time collaboration');
              ta.dispatchEvent(new Event('input', { bubbles: true }));
              return true;
            })()""",
        )
        await asyncio.sleep(0.5)
        check("counter updates", await evaluate(tab, "document.body.innerText.includes('/500')"))
        await evaluate(
            tab,
            """(() => {
              const cards = [...document.querySelectorAll('form')];
              const form = cards.find(f => f.querySelector('#kf-main-features'));
              form.querySelector('button[type=submit]').click();
              return true;
            })()""",
        )
        await asyncio.sleep(9)
        state_txt = await evaluate(tab, "document.body.innerText")
        check("error box shown on 401", "AI key rejected" in state_txt)
        check("error box offers Retry action", "Try Again" in state_txt)
        check(
            "inputs preserved after error",
            await evaluate(tab, "document.getElementById('kf-main-url') ? document.getElementById('kf-main-url').value : ''") == "https://tailwindcss.com",
            str(await evaluate(tab, "document.getElementById('kf-main-url') ? document.getElementById('kf-main-url').value : 'missing'")),
        )
        await screenshot(tab, "04-error-401.png")

        # ── Mobile viewport ──────────────────────────────────────────
        print("\n10. Mobile viewport (390×844)")
        await tab.send_command(
            "Emulation.setDeviceMetricsOverride",
            {"width": 390, "height": 844, "deviceScaleFactor": 3, "mobile": True},
        )
        await tab.send_command("Page.navigate", {"url": URL})
        await asyncio.sleep(3)
        check("hamburger visible on mobile", await evaluate(tab, """(() => { const el = document.querySelector('.kf-hamburger'); return !!el && getComputedStyle(el).display !== 'none'; })()"""))
        check("desktop cta hidden on mobile", await evaluate(tab, """(() => { const el = document.querySelector('.kf-cta-desktop'); return !!el && getComputedStyle(el).display === 'none'; })()"""))
        # The phone header is logo + hamburger only: no section links, no
        # history/settings icons (everything lives in the drawer).
        check(
            "header keeps only logo + hamburger on a phone",
            await evaluate(
                tab,
                """(() => {
                  const hidden = el => !el || getComputedStyle(el).display === 'none';
                  const header = document.querySelector('header');
                  const visible = [...header.querySelectorAll('a,button')].filter(el => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0);
                  return hidden(document.querySelector('.kf-nav-center'))
                    && hidden(document.querySelector('.kf-nav-icons'))
                    && visible.length === 2
                    && header.scrollWidth <= window.innerWidth;
                })()""",
            ),
        )
        check(
            "hamburger touch target ≥44px",
            await evaluate(
                tab,
                """(() => { const b = document.querySelector('.kf-hamburger'); const r = b.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })()""",
            ),
        )
        # The sticky Generate bar is a workspace control — never on the landing.
        check(
            "no sticky action bar on the landing",
            await evaluate(tab, "!document.querySelector('.kf-bottombar')"),
        )
        await screenshot(tab, "05-mobile-landing.png")

        # ── Install banner geometry ──────────────────────────────────
        # Guards the CLS fix: the banner must float (position: fixed), never
        # cover the hero headline, clear the mobile action bar, and sit in the
        # same bottom band as the toasts (76px mobile / 24px desktop).
        # headless Chrome never fires beforeinstallprompt, so synthesize the
        # event the hook listens for — the banner is otherwise never rendered.
        await evaluate(
            tab,
            "(() => { window.dispatchEvent(new Event('beforeinstallprompt')); return true; })()",
        )
        await asyncio.sleep(0.6)
        banner = await evaluate(
            tab,
            """(() => {
              const b = document.querySelector('.kf-install-banner');
              const h1 = document.querySelector('h1');
              if (!b || !h1) return { shown: false };
              const rb = b.getBoundingClientRect(), rh = h1.getBoundingClientRect();
              const bar = document.querySelector('.kf-bottombar');
              const barShown = !!bar && getComputedStyle(bar).display !== 'none' && bar.getBoundingClientRect().height > 0;
              const rbar = barShown ? bar.getBoundingClientRect() : null;
              const hit = (a, c) => a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom;
              return {
                shown: true,
                position: getComputedStyle(b).position,
                coversHero: hit(rb, rh),
                inside: rb.top >= -1 && rb.bottom <= window.innerHeight + 1,
                bottomGap: Math.round(window.innerHeight - rb.bottom),
                hitsBar: rbar ? hit(rb, rbar) : false,
                gapAboveBar: rbar ? Math.round(rbar.top - rb.bottom) : null,
              };
            })()""",
        )
        bd = banner or {}
        check("install banner appears on beforeinstallprompt", bd.get("shown") is True)
        check("install banner is fixed, not in flow", bd.get("position") == "fixed", str(bd.get("position")))
        check(
            "install banner never covers the hero headline",
            bd.get("coversHero") is False and bd.get("inside") is True,
            f"{bd.get('bottomGap')}px above the viewport bottom",
        )
        # No action bar on the landing, so the banner takes the low 24px band.
        check(
            "install banner sits in the 24px band on the landing",
            bd.get("hitsBar") is False and abs((bd.get("bottomGap") or 0) - 24) <= 2,
            f"{bd.get('bottomGap')}px above the viewport bottom",
        )
        # …and drops to the 24px band once the mobile bar hides (≥768px)
        await tab.send_command(
            "Emulation.setDeviceMetricsOverride",
            {"width": 1440, "height": 900, "deviceScaleFactor": 1, "mobile": False},
        )
        await asyncio.sleep(0.4)
        desk = await evaluate(
            tab,
            """(() => {
              const b = document.querySelector('.kf-install-banner');
              if (!b) return { shown: false };
              return { shown: true, gap: Math.round(window.innerHeight - b.getBoundingClientRect().bottom), fixed: getComputedStyle(b).position === 'fixed' };
            })()""",
        )
        dk = desk or {}
        check(
            "install banner anchors to the desktop 24px band",
            dk.get("shown") is True and dk.get("fixed") is True and abs((dk.get("gap") or 0) - 24) <= 2,
            f"{dk.get('gap')}px",
        )
        # back to mobile, open the drawer, and walk into the workspace through
        # it — there the sticky action bar exists and the banner must clear it
        await tab.send_command(
            "Emulation.setDeviceMetricsOverride",
            {"width": 390, "height": 844, "deviceScaleFactor": 3, "mobile": True},
        )
        await asyncio.sleep(0.4)
        await evaluate(tab, """document.querySelector('.kf-hamburger').click()""")
        await asyncio.sleep(0.5)
        check("hamburger drawer opens", await evaluate(tab, "document.body.innerText.includes('Menu') && document.body.innerText.includes('How It Works')"))
        check(
            "drawer carries the header's controls",
            await evaluate(
                tab,
                """(() => {
                  const t = document.body.innerText;
                  return t.includes('Script History') && t.includes('Settings') && t.includes('Get Started');
                })()""",
            ),
        )
        await screenshot(tab, "06-mobile-menu.png")
        await evaluate(
            tab,
            """(() => { const b = [...document.querySelectorAll('nav[aria-label="Menu"] button')].find(x => x.textContent.includes('Get Started')); b.click(); return true; })()""",
        )
        await asyncio.sleep(1.0)
        check("drawer's Get Started enters the workspace", await evaluate(tab, "!!document.getElementById('kf-main-url')"))
        check("bottom bar returns in the workspace", await evaluate(tab, """(() => { const el = document.querySelector('.kf-bottombar'); return !!el && getComputedStyle(el).display !== 'none'; })()"""))
        check(
            "touch targets ≥44px (bottom bar)",
            await evaluate(
                tab,
                """(() => {
                  const btns = [...document.querySelectorAll('.kf-bottombar button')];
                  return btns.length > 0 && btns.every(b => b.getBoundingClientRect().height >= 44);
                })()""",
            ),
        )
        raised = await evaluate(
            tab,
            """(() => {
              const b = document.querySelector('.kf-install-banner');
              const bar = document.querySelector('.kf-bottombar');
              if (!b || !bar || getComputedStyle(bar).display === 'none') return { ok: false };
              const rb = b.getBoundingClientRect(), rc = bar.getBoundingClientRect();
              const overlaps = rb.top < rc.bottom && rc.top < rb.bottom && rb.left < rc.right && rc.left < rb.right;
              return { ok: true, gap: Math.round(window.innerHeight - rb.bottom), hitsBar: overlaps, clear: Math.round(rc.top - rb.bottom) };
            })()""",
        )
        ri = raised or {}
        check(
            "install banner rises to the 76px band above the action bar",
            ri.get("ok") is True and ri.get("hitsBar") is False and abs((ri.get("gap") or 0) - 76) <= 2,
            f"{ri.get('gap')}px band, {ri.get('clear')}px clear of the bar",
        )
        # dismiss through the real control so nothing downstream inherits a
        # floating overlay
        await evaluate(
            tab,
            """(() => { const b = document.querySelector('.kf-install-banner button[aria-label="Dismiss install banner"]'); if (b) b.click(); return true; })()""",
        )
        await asyncio.sleep(0.3)

        # ── Clear All Data (destructive, so it runs last) ────────────
        print("\n11. Clear All Data")
        await tab.send_command(
            "Emulation.setDeviceMetricsOverride",
            {"width": 1440, "height": 900, "deviceScaleFactor": 1, "mobile": False},
        )
        await tab.send_command("Page.navigate", {"url": URL})
        await asyncio.sleep(2.5)
        if DEV:
            seeded = await evaluate(
                tab,
                """(async () => {
                  const mod = await import('/src/store/storage.js');
                  await mod.saveScript({
                    id: 'wipe-test-1',
                    input: { url: 'https://example.com', features: 'x', length: 60, tone: 'casual', videoTool: 'any' },
                    output: { meta: { appName: 'Wipe', totalSeconds: 60, shotCount: 1, estimatedWordCount: 1, tone: 'casual' },
                              script: [{ shotNumber: 1 }], cutList: [], videoPrompt: { target: 'any', fullPrompt: 'x' } },
                    createdAt: new Date().toISOString(),
                    generation: { model: 'test', inputTokens: 1, outputTokens: 1, generationMs: 1 },
                  });
                  mod.writeJSON('kf_last_inputs', { url: 'https://seed.example' });
                  mod.writeJSON('kf_settings', { theme: 'dark' });
                  return JSON.stringify({
                    count: await mod.countScripts(),
                    keys: Object.keys(localStorage).filter(k => k.startsWith('kf_')).length,
                  });
                })()""",
            )
            seed_data = json.loads(seeded) if seeded else {}
            check("seeded a script + settings before the wipe", seed_data.get("count", 0) >= 1 and seed_data.get("keys", 0) >= 2, str(seed_data))
            await evaluate(tab, """(() => { const b = [...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Settings'); b.click(); return true; })()""")
            await asyncio.sleep(0.5)
            await evaluate(tab, """(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Clear All Data')); b.click(); return true; })()""")
            await asyncio.sleep(0.5)
            dialog_copy = (await evaluate(tab, "document.body.innerText")) or ""
            check("clear-all dialog never mentions a key", "API key" not in dialog_copy)
            await evaluate(tab, """(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Delete Everything')); b.click(); return true; })()""")
            await asyncio.sleep(1.2)
            wiped = await evaluate(
                tab,
                """(async () => {
                  const mod = await import('/src/store/storage.js');
                  return JSON.stringify({
                    keys: Object.keys(localStorage).filter(k => k.startsWith('kf_')).length,
                    scripts: await mod.countScripts(),
                    toast: document.body.innerText.includes('All Keyframe data removed'),
                  });
                })()""",
            )
            wipe = json.loads(wiped) if wiped else {}
            check("every kf_* key wiped", wipe.get("keys") == 0, f"{wipe.get('keys')} left")
            check("history emptied", wipe.get("scripts") == 0, f"{wipe.get('scripts')} left")
            check("user is told what happened", wipe.get("toast"), str(wipe.get("toast")))
        else:
            for name in ("seeded a script + settings before the wipe", "clear-all dialog never mentions a key",
                         "every kf_* key wiped", "history emptied", "user is told what happened"):
                skip(name, "the wipe test seeds storage through a source-module import — dev server only")

        print("\n" + "─" * 60)
        passed = sum(1 for _, ok, _ in results if ok)
        failed = [(n, d) for n, ok, d in results if not ok]
        print(f"Browser check: {passed}/{len(results)} passed" + (f", {len(skipped)} skipped" if skipped else ""))
        if console_errors:
            print("Console errors captured:")
            for e in console_errors[:8]:
                print("   -", e)
        if failed:
            print("Failures:")
            for n, d in failed:
                print(f"   - {n} {d}")
        sys.exit(1 if failed or console_errors else 0)


asyncio.run(main())
