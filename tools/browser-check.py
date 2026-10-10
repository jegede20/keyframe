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

URL = "http://localhost:5173/"
OUT = os.path.join(os.path.dirname(__file__), "..", "artifacts")
os.makedirs(OUT, exist_ok=True)

results = []
console_errors = []


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
        check("footer rendered", await evaluate(tab, "document.body.innerText.includes('free tiers')"))
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
        check("settings opened", await evaluate(tab, "document.body.innerText.includes('Groq API Key')"))
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
        harness_ok = await evaluate(tab, "typeof window.__keyframeTest === 'object'")
        check("__keyframeTest installed", harness_ok)
        if harness_ok:
            suite = await evaluate(
                tab,
                """(async () => { const r = await window.__keyframeTest.offline(); return JSON.stringify(r); })()""",
            )
            data = json.loads(suite) if suite else {}
            check("offline suite passes", data.get("failed", 1) == 0, f"{data.get('passed')} passed / {data.get('failed')} failed")

        # ── IndexedDB roundtrip (storage adapter in the real browser) ──
        print("\n7. Storage roundtrip (IndexedDB + localStorage via app modules)")
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

        # ── Missing-key error path (no Groq key configured) ───────────
        print("\n9. Hero entry → workspace, then error path (missing API key)")
        await evaluate(
            tab,
            """(() => {
              localStorage.removeItem('kf_groq_key');
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
        check("error box shown for missing key", "Invalid API key" in state_txt)
        check("error box offers Settings action", "Open Settings" in state_txt)
        check(
            "inputs preserved after error",
            await evaluate(tab, "document.getElementById('kf-main-url') ? document.getElementById('kf-main-url').value : ''") == "https://tailwindcss.com",
            str(await evaluate(tab, "document.getElementById('kf-main-url') ? document.getElementById('kf-main-url').value : 'missing'")),
        )
        await screenshot(tab, "04-error-missing-key.png")

        # ── Mobile viewport ──────────────────────────────────────────
        print("\n10. Mobile viewport (390×844)")
        await tab.send_command(
            "Emulation.setDeviceMetricsOverride",
            {"width": 390, "height": 844, "deviceScaleFactor": 3, "mobile": True},
        )
        await tab.send_command("Page.navigate", {"url": URL})
        await asyncio.sleep(3)
        check("bottom bar visible on mobile", await evaluate(tab, """(() => { const el = document.querySelector('.kf-bottombar'); return !!el && getComputedStyle(el).display !== 'none'; })()"""))
        check("hamburger visible on mobile", await evaluate(tab, """(() => { const el = document.querySelector('.kf-hamburger'); return !!el && getComputedStyle(el).display !== 'none'; })()"""))
        check("desktop cta hidden on mobile", await evaluate(tab, """(() => { const el = document.querySelector('.kf-cta-desktop'); return !!el && getComputedStyle(el).display === 'none'; })()"""))
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
        await screenshot(tab, "05-mobile-landing.png")

        # hamburger drawer
        await evaluate(tab, """document.querySelector('.kf-hamburger').click()""")
        await asyncio.sleep(0.5)
        check("hamburger drawer opens", await evaluate(tab, "document.body.innerText.includes('Menu') && document.body.innerText.includes('How It Works')"))
        await screenshot(tab, "06-mobile-menu.png")

        print("\n" + "─" * 60)
        passed = sum(1 for _, ok, _ in results if ok)
        failed = [(n, d) for n, ok, d in results if not ok]
        print(f"Browser check: {passed}/{len(results)} passed")
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
