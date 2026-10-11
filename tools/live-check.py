#!/usr/bin/env python3
"""
LIVE check — the only suite that touches the real services.

Everything else in tools/ runs against mocks or fixtures; this one drives the
actual UI in a browser with the real bundled key, so it proves the whole chain
end to end: r.jina.ai → cleaning → 4-layer prompt → api.groq.com → parser →
rendered shot cards → clipboard → history.

  python3 tools/live-check.py                 # uses https://tailwindcss.com
  python3 tools/live-check.py https://x.com   # any public URL

Requirements: dev server on :5173 (npm run dev), Chrome + LD_LIBRARY_PATH,
a real VITE_GROQ_API_KEY in .env, and roughly 5-6k tokens of free-tier quota.

Because it spends real quota, it is NOT part of the routine battery — run it
before a release, after changing the prompt builder, parser, or model config.
"""
import asyncio
import os
import sys

from choreographer import Browser
from choreographer.browsers.chromium import ChromeNotFoundError

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

BASE = (os.environ.get("KF_BASE", "http://localhost:5173").rstrip("/")) + "/"
TARGET = sys.argv[1] if len(sys.argv) > 1 else "https://tailwindcss.com"
FEATURES = "Utility-first CSS, responsive variants, dark mode"
TIMEOUT_S = 180

passed = 0
failed = 0
failures = []


def check(name, ok, detail=""):
    global passed, failed
    if ok:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed += 1
        failures.append(f"{name} {detail}")
        print(f"  FAIL  {name} {detail}")


async def ev(tab, expression, await_promise=True):
    result = await tab.send_command(
        "Runtime.evaluate",
        {"expression": expression, "returnByValue": True, "awaitPromise": await_promise},
    )
    inner = result.get("result") or {}
    if "exceptionDetails" in inner:
        return None
    return inner.get("result", {}).get("value")


async def main():
    try:
        async with Browser(headless=True) as browser:
            tab = await browser.create_tab(BASE)
            try:
                await tab.send_command(
                    "Browser.grantPermissions",
                    {
                        "origin": BASE.rstrip("/"),
                        "permissions": ["clipboardReadWrite", "clipboardSanitizedWrite"],
                    },
                )
            except Exception as exc:  # noqa: BLE001 - permission API varies by build
                print(f"  (clipboard permission not granted: {exc})")
            await tab.send_command("Emulation.setFocusEmulationEnabled", {"enabled": True})
            await tab.send_command(
                "Emulation.setDeviceMetricsOverride",
                {"width": 1440, "height": 1000, "deviceScaleFactor": 1, "mobile": False},
            )
            await asyncio.sleep(2.5)

            print(f"live target: {TARGET}")

            # ── Fill the workspace and start a real generation ────────────
            await ev(
                tab,
                """(() => {
                  const set = (el, v) => {
                    const proto = el.tagName === 'TEXTAREA'
                      ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
                    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    return true;
                  };
                  set(document.getElementById('kf-hero-url'), %s);
                  document.querySelector('.kf-hero-form button[type=submit], button[type=submit]').click();
                  return true;
                })()""" % repr(TARGET).replace("'", '"'),
            )
            await asyncio.sleep(1.2)
            check("entered the workspace", await ev(tab, "!!document.getElementById('kf-main-features')"))
            await ev(
                tab,
                """(() => {
                  const ta = document.getElementById('kf-main-features');
                  Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')
                    .set.call(ta, %s);
                  ta.dispatchEvent(new Event('input', { bubbles: true }));
                  return true;
                })()""" % repr(FEATURES).replace("'", '"'),
            )
            await asyncio.sleep(0.4)
            await ev(
                tab,
                """(() => {
                  const form = [...document.querySelectorAll('form')]
                    .find(f => f.querySelector('#kf-main-features'));
                  form.querySelector('button[type=submit]').click();
                  return true;
                })()""",
            )

            # ── Wait for real results ─────────────────────────────────────
            print(f"\n1. Real generation (Jina → Groq, up to {TIMEOUT_S}s)")
            body = ""
            for _ in range(TIMEOUT_S):
                await asyncio.sleep(1)
                body = (await ev(tab, "document.body ? document.body.innerText : ''")) or ""
                if "SHOT 1" in body or "Try Again" in body or "went wrong" in body:
                    break

            errored = "Try Again" in body and "SHOT 1" not in body
            check("generation produced results", "SHOT 1" in body, "error card shown" if errored else "")
            if errored:
                snippet = (await ev(tab, "document.body.innerText.slice(0, 400)")) or ""
                print("  --- error card ---")
                print("  " + snippet.replace("\n", "\n  ")[:700])
                print("  ------------------")
                raise SystemExit(1)

            shot_count = await ev(tab, "(document.body.innerText.match(/SHOT \\d+/g) || []).length")
            total = await ev(
                tab,
                """(() => {
                  const m = document.body.innerText.match(/TOTAL:\\s*(\\d+)s/i);
                  return m ? Number(m[1]) : null;
                })()""",
            )
            # each shot appears in the list and again in the timeline chips on some builds
            unique_shots = await ev(
                tab,
                """(() => {
                  const labels = [...document.querySelectorAll('h2')]
                    .map(h => h.textContent.trim()).filter(t => /^shot [0-9]+$/i.test(t));
                  return new Set(labels).size;
                })()""",
            )
            check("shot cards rendered (2–12)", isinstance(unique_shots, int) and 2 <= unique_shots <= 12, f"{unique_shots} cards")
            check("total duration is one of the spec lengths", total in (30, 60, 90, 120), f"TOTAL {total}s")
            check("narration present", "“" in body or "'" in body)

            print("\n2. Video prompt tab (real model output)")
            await ev(tab, """[...document.querySelectorAll('[role=tab]')].find(t=>/Video Prompt/i.test(t.textContent)).click()""")
            await asyncio.sleep(1.0)
            prompt_words = await ev(
                tab,
                """(() => {
                  const panel = document.querySelector('[id^=kf-tabpanel-]');
                  return panel ? panel.innerText.trim().split(/\\s+/).length : 0;
                })()""",
            )
            check("video prompt within 300–600 words", isinstance(prompt_words, int) and 290 <= prompt_words <= 620, f"{prompt_words} words")

            print("\n3. Cut list tab")
            await ev(tab, """[...document.querySelectorAll('[role=tab]')].find(t=>/Cut List/i.test(t.textContent)).click()""")
            await asyncio.sleep(0.8)
            cut_cards = await ev(
                tab,
                """(() => {
                  const panel = document.querySelector('[id^=kf-tabpanel-]');
                  return panel ? (panel.innerText.match(/Add to Script/g) || []).length : 0;
                })()""",
            )
            check("cut list has 2–8 entries", isinstance(cut_cards, int) and 2 <= cut_cards <= 8, f"{cut_cards} entries")

            print("\n4. Clipboard from the real clipboard API")
            await ev(tab, """[...document.querySelectorAll('[role=tab]')].find(t=>/^Script/i.test(t.textContent)).click()""")
            await asyncio.sleep(0.6)
            await ev(tab, """[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Copy All')).click()""")
            await asyncio.sleep(1.0)
            clip = await ev(tab, """(async () => { try { return await Promise.race([navigator.clipboard.readText(), new Promise(r => setTimeout(() => r('TIMEOUT'), 8000))]); } catch (e) { return 'ERR:' + e.message; } })()""")
            check("Copy All writes a full script", isinstance(clip, str) and "SHOT 1" in (clip or ""), f"{len(clip or '')} chars")
            check("clipboard holds the cut list too", "CUT LIST" in (clip or ""))
            check("clipboard holds the video prompt too", "VIDEO AI PROMPT" in (clip or ""))

            print("\n5. History persisted the real script")
            await ev(tab, """[...document.querySelectorAll('button')].find(b=>b.textContent.includes('New Script')).click()""")
            await asyncio.sleep(1.5)
            badge = await ev(tab, """document.querySelector('[aria-label^="Script history"]')?.getAttribute('aria-label')""")
            check("history badge shows an entry", bool(badge and "1" in badge), str(badge))

            print("\n" + "─" * 60)
            print(f"Live check: {passed} passed, {failed} failed")
            if failures:
                print("Failures:")
                for f in failures:
                    print(f"  - {f}")
    except ChromeNotFoundError as err:
        print("Chrome not found:", err)
        print("Run: choreo_get_chrome && bash tools/fetch-chrome-libs.sh")
        raise SystemExit(2)


if __name__ == "__main__":
    asyncio.run(main())
