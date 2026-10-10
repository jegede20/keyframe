"""
End-to-end browser verification with mocked Jina + Groq responses.
Drives the real app: input -> loading -> results -> tabs -> copy -> history -> reload.

Usage:  LD_LIBRARY_PATH=... python3 tools/e2e-check.py
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
ALLOWED_ERRORS = ("[Keyframe] Generation failed:",)


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("  PASS  " if ok else "  FAIL  ") + name + (f" — {detail}" if detail else ""))


async def ev(tab, expression):
    res = await tab.send_command(
        "Runtime.evaluate",
        {"expression": expression, "returnByValue": True, "awaitPromise": True},
    )
    return (res.get("result") or {}).get("result", {}).get("value")


async def shot(tab, name):
    res = await tab.send_command("Page.captureScreenshot", {"format": "png"})
    path = os.path.join(OUT, name)
    with open(path, "wb") as fh:
        fh.write(base64.b64decode((res.get("result") or {})["data"]))
    print(f"  shot: {path}")


SAMPLE_OUTPUT = {
    "meta": {
        "appName": "Acme Boards",
        "appPurpose": "Team project tracking with live boards and reports.",
        "totalSeconds": 90,
        "shotCount": 8,
        "estimatedWordCount": 168,
        "tone": "professional",
    },
    "script": [
        {"shotNumber": 1, "label": "OPENING", "screen": "Home dashboard", "timeStart": "0:00", "timeEnd": "0:08", "durationSeconds": 8, "action": "Land on the dashboard with live project tiles.", "narration": "Every project your team owns, on one screen, updated the second anything changes."},
        {"shotNumber": 2, "label": "FEATURE 1", "screen": "Board view", "timeStart": "0:08", "timeEnd": "0:22", "durationSeconds": 14, "action": "Drag a card from In Progress to Done.", "narration": "Drag a card and the status syncs for everyone watching. No refresh, no follow-up message."},
        {"shotNumber": 3, "label": "FEATURE 2", "screen": "Reports", "timeStart": "0:22", "timeEnd": "0:36", "durationSeconds": 14, "action": "Filter the report by squad, then by sprint.", "narration": "Filter by squad or sprint to see where work is piling up before it becomes a problem."},
        {"shotNumber": 4, "label": "FEATURE 3", "screen": "Automations", "timeStart": "0:36", "timeEnd": "0:50", "durationSeconds": 14, "action": "Create a rule: when a card moves to Done, notify the channel.", "narration": "Build a rule in one line: move a card, ping the channel, and close the loop automatically."},
        {"shotNumber": 5, "label": "FEATURE 4", "screen": "Export", "timeStart": "0:50", "timeEnd": "1:02", "durationSeconds": 12, "action": "Click Export and show the CSV landing in the downloads bar.", "narration": "Export the exact view you are looking at to CSV, ready for the Monday report."},
        {"shotNumber": 6, "label": "FEATURE 5", "screen": "Integrations", "timeStart": "1:02", "timeEnd": "1:14", "durationSeconds": 12, "action": "Toggle the Slack integration on.", "narration": "Connect Slack in two clicks so updates land where your team already talks."},
        {"shotNumber": 7, "label": "FEATURE 6", "screen": "Team settings", "timeStart": "1:14", "timeEnd": "1:24", "durationSeconds": 10, "action": "Invite a teammate and set their role.", "narration": "Invite the whole team and set permissions per person, not per plan."},
        {"shotNumber": 8, "label": "CLOSING", "screen": "Pricing", "timeStart": "1:24", "timeEnd": "1:30", "durationSeconds": 6, "action": "Scroll the three tiers, pause on the middle plan.", "narration": "Start free today, upgrade when your projects outgrow the plan."},
    ],
    "cutList": [
        {"screenName": "Mobile app", "reason": "The desktop flow demonstrates the same features faster, and mobile needs its own vertical cut to be legible."},
        {"screenName": "Admin audit log", "reason": "Powerful for enterprise buyers but too dense to read at video resolution in a 90-second demo."},
        {"screenName": "Billing settings", "reason": "Prices change and buyers rarely decide on a billing screen; better handled in the sales call."},
    ],
    "videoPrompt": {
        "target": "any",
        "fullPrompt": (
            "Create a 90-second product demo video for a team project management app. "
            "Open with a slow zoom into a dark dashboard with violet accents (#6C5CE7), live tiles "
            "showing project counts. Cut to a static screen capture of a kanban board where a task "
            "card is dragged from In Progress to Done, with a toast confirming the sync. Pan left to "
            "a report view, animate bars in as filters change. Show a one-line automation rule being "
            "typed, then a notification appearing in a side channel. Match-cut to a CSV export "
            "dropping into a downloads bar. Show a two-click Slack connection banner, then invite a "
            "teammate with a role dropdown. Close on three pricing tiers, holding on the middle plan, "
            "fading to the logo on the dark background. Style: clean modern SaaS, soft shadows, "
            "minimal chrome, no people on screen, captions bottom-centre in a clean geometric sans, "
            "music warm and mid-tempo with a soft kick on each cut."
        ) * 1,
    },
}


async def main():
    async with Browser(headless=True) as browser:
        tab = await browser.create_tab(URL)
        async def on_console(payload):
            _on_console(payload)

        async def on_exception(payload):
            _on_exception(payload)

        tab.subscribe("Runtime.consoleAPICalled", on_console)
        tab.subscribe("Runtime.exceptionThrown", on_exception)
        try:
            await tab.send_command(
                "Browser.grantPermissions",
                {"origin": "http://localhost:5173", "permissions": ["clipboardReadWrite", "clipboardSanitizedWrite"]},
            )
        except Exception as exc:  # noqa: BLE001 - permission API varies by Chrome build
            print(f"  (clipboard permission not granted: {exc})")
        await tab.send_command("Emulation.setFocusEmulationEnabled", {"enabled": True})
        await tab.send_command("Runtime.enable")
        await tab.send_command("Page.enable")
        await tab.send_command(
            "Emulation.setDeviceMetricsOverride",
            {"width": 1440, "height": 900, "deviceScaleFactor": 2, "mobile": False},
        )

        # Fresh profile state
        await ev(tab, """localStorage.clear(); indexedDB.deleteDatabase('keyframe-db'); true""")
        await tab.send_command("Page.navigate", {"url": URL})
        await asyncio.sleep(3)

        print("\n1. Desktop layout at 1440px")
        check(
            "desktop nav links visible",
            await ev(tab, """getComputedStyle(document.querySelector('.kf-nav-center')).display !== 'none'"""),
        )
        check(
            "Get Started CTA visible",
            await ev(tab, """getComputedStyle(document.querySelector('.kf-cta-desktop')).display !== 'none'"""),
        )
        check(
            "hamburger hidden",
            await ev(tab, """getComputedStyle(document.querySelector('.kf-hamburger')).display === 'none'"""),
        )
        check(
            "bottom bar hidden",
            await ev(tab, """getComputedStyle(document.querySelector('.kf-bottombar')).display === 'none'"""),
        )
        resolved = await ev(tab, "document.documentElement.getAttribute('data-theme')")
        system_dark = await ev(tab, "window.matchMedia('(prefers-color-scheme: dark)').matches")
        check("theme follows system default", resolved == ("dark" if system_dark else "light"), f"data-theme={resolved}, system dark={system_dark}")
        await ev(
            tab,
            """(() => {
              localStorage.setItem('kf_settings', JSON.stringify({ theme: 'dark', defaultLength: 90, defaultTone: 'professional', defaultVideoTool: 'any' }));
              return true;
            })()""",
        )
        await tab.send_command("Page.navigate", {"url": URL})
        await asyncio.sleep(2.5)
        check("explicit dark theme applies", await ev(tab, "document.documentElement.getAttribute('data-theme')") == "dark")
        await shot(tab, "10-landing-dark-1440.png")

        print("\n2. Reduced motion honoured")
        await tab.send_command(
            "Emulation.setEmulatedMedia",
            {"features": [{"name": "prefers-reduced-motion", "value": "reduce"}]},
        )
        await asyncio.sleep(0.4)
        rm = await ev(
            tab,
            """(() => {
              const el = document.querySelector('.kf-anim-glow') || document.querySelector('.kf-generate') || document.querySelector('.kf-anim-hero');
              const cs = getComputedStyle(el);
              return JSON.stringify({ name: cs.animationName, dur: cs.animationDuration });
            })()""",
        )
        check("animations disabled under reduce", json.loads(rm)["name"] == "none", rm)
        await tab.send_command("Emulation.setEmulatedMedia", {"features": []})

        print("\n3. Mocked end-to-end generation")
        # stub the external APIs, keep everything else real
        stub = """
        (() => {
          window.__mock = %s;
          const realFetch = window.fetch.bind(window);
          window.fetch = async (input, init) => {
            const url = typeof input === 'string' ? input : (input && input.url) || '';
            const sleep = (ms) => new Promise(r => setTimeout(r, ms));
            if (url.startsWith('https://r.jina.ai/')) {
              await sleep(1200);
              const md = [
                '# Acme Boards — project tracking',
                '',
                '## Home dashboard',
                'Live tiles for every project, updated in real time for the whole team.',
                '',
                '## Board view',
                'Drag cards between columns; statuses sync instantly across devices.',
                '',
                '## Reports',
                'Filter by squad or sprint and spot bottlenecks before they bite.',
                '',
                '## Automations',
                'One-line rules: trigger, condition, action.',
                '',
                '## Export',
                'Export any view to CSV with one click.',
                '',
                '## Integrations',
                'Connect Slack, GitHub and Google Drive in two clicks.',
                '',
                '## Team settings',
                'Invite teammates and set per-person permissions.',
                '',
                '## Pricing',
                'Free for small teams. Paid tiers add automation limits and audit logs.',
                '',
                '## Mobile app',
                'Native apps for iOS and Android.',
                '',
                '## Admin audit log',
                'Every action recorded, exportable for compliance.',
                '',
                '## Billing settings',
                'Manage invoices, seats and plan changes.'
              ].join('\\n');
              return new Response(md, { status: 200, headers: { 'Content-Type': 'text/plain' } });
            }
            if (url.startsWith('https://api.groq.com/')) {
              await sleep(2400);
              return new Response(JSON.stringify({
                id: 'mock',
                model: 'llama-3.3-70b-versatile',
                choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(window.__mock) }, finish_reason: 'stop' }],
                usage: { prompt_tokens: 4310, completion_tokens: 2890 }
              }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
            return realFetch(input, init);
          };
          localStorage.setItem('kf_groq_key', 'gsk_mock_key_for_e2e_verification');
          return true;
        })()
        """ % json.dumps(SAMPLE_OUTPUT)

        # entry via the hero, then features, then generate
        await ev(
            tab,
            """(() => {
              const input = document.getElementById('kf-hero-url');
              const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
              setter.call(input, 'https://acme.example');
              input.dispatchEvent(new Event('input', { bubbles: true }));
              return true;
            })()""",
        )
        await ev(tab, stub)
        await asyncio.sleep(0.3)
        await ev(tab, """document.querySelector('button[type=submit]').click()""")
        await asyncio.sleep(0.9)
        check("workspace input card shown", await ev(tab, "!!document.getElementById('kf-main-features')"))
        await ev(
            tab,
            """(() => {
              const ta = document.getElementById('kf-main-features');
              const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
              setter.call(ta, 'One-click export, real-time boards, Slack integration');
              ta.dispatchEvent(new Event('input', { bubbles: true }));
              return true;
            })()""",
        )
        await asyncio.sleep(0.5)
        # advanced options
        await ev(tab, """document.querySelector('button[aria-controls=kf-advanced]').click()""")
        await asyncio.sleep(0.5)
        check(
            "advanced options expand",
            await ev(tab, """document.querySelector('#kf-advanced').style.maxHeight !== '0px'"""),
        )
        check("three selects present", await ev(tab, "document.querySelectorAll('#kf-advanced select').length") == 3)
        await shot(tab, "11-input-card-dark.png")

        await ev(
            tab,
            """(() => {
              const form = [...document.querySelectorAll('form')].find(f => f.querySelector('#kf-main-features'));
              form.querySelector('button[type=submit]').click();
              return true;
            })()""",
        )
        await asyncio.sleep(0.8)
        check("loading stepper appears", await ev(tab, "document.body.innerText.includes('Reading app URL')"))
        check("five steps listed", await ev(tab, "['Reading app URL','Identifying screens & flows','Writing demo script','Building cut list','Creating video prompt'].every(s => document.body.innerText.includes(s))"))
        check("input dimmed while loading", await ev(tab, """(() => { const el = document.querySelector('section[aria-label="Demo script inputs"]'); return el && parseFloat(getComputedStyle(el).opacity) < 0.8; })()"""))
        check("cancel button available", await ev(tab, "(document.body.innerText||'').includes('Cancel')"))
        await shot(tab, "12-loading-stepper.png")

        # Rule 7: Cancel aborts both fetches and preserves inputs
        await ev(tab, """[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Cancel').click()""")
        await asyncio.sleep(0.8)
        check("cancel returns to input", await ev(tab, "!!document.getElementById('kf-main-features')"))
        check("cancel preserves inputs", await ev(tab, "document.getElementById('kf-main-url').value") == "https://acme.example")
        check("no results after cancel", not await ev(tab, "document.body.innerText.includes('Copy Full Script')"))

        # generate for real this time
        await ev(
            tab,
            """(() => {
              const form = [...document.querySelectorAll('form')].find(f => f.querySelector('#kf-main-features'));
              form.querySelector('button[type=submit]').click();
              return true;
            })()""",
        )
        # wait for results
        for _ in range(40):
            await asyncio.sleep(0.5)
            if await ev(tab, "document.body.innerText.includes('Copy Full Script')"):
                break
        print("\n4. Results view")
        check("results rendered", await ev(tab, "document.body.innerText.includes('Copy Full Script')"))
        check("stats bar shows totals", await ev(tab, "document.body.innerText.includes('TOTAL: 90s')"))
        check("8 shot cards", await ev(tab, "document.querySelectorAll('article').length") >= 8)
        check("timeline connectors between shots", await ev(tab, "document.querySelectorAll('.kf-timeline-connector').length") == 7)
        check("narration pace chips rendered", await ev(tab, "(document.body.innerText.match(/w \/ \\d+w max/g)||[]).length") >= 8)
        check("input collapsed to summary", await ev(tab, "!!document.getElementById('kf-main-features') === false") and await ev(tab, "document.body.innerText.includes('3 features')"))
        check("per-shot copy present", await ev(tab, "document.body.innerText.includes('Copy shot')"))
        await shot(tab, "13-results-script.png")

        print("\n5. Tabs")
        await ev(tab, """[...document.querySelectorAll('button[role=tab]')].find(b=>b.textContent.includes('Cut List')).click()""")
        await asyncio.sleep(0.5)
        check("cut list renders", await ev(tab, "document.body.innerText.includes('Admin audit log')"))
        check("cut count badge", await ev(tab, "document.body.innerText.includes('Cut List (3)')"))
        check("add-to-script buttons", await ev(tab, "(document.body.innerText.match(/Add to Script/g)||[]).length === 3"))
        await shot(tab, "14-results-cutlist.png")

        await ev(tab, """[...document.querySelectorAll('button[role=tab]')].find(b=>b.textContent.includes('Video Prompt')).click()""")
        await asyncio.sleep(0.5)
        check("video prompt renders", await ev(tab, "document.body.innerText.includes('Ready-to-paste prompt')"))
        await shot(tab, "15-results-prompt.png")

        print("\n6. Copy All + New Script + history")
        await ev(tab, """[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Copy All')).click()""")
        await asyncio.sleep(1.0)
        check("copy all feedback label", await ev(tab, "(document.body.innerText||'').includes('Copied!')"))
        clip = await ev(tab, "(async () => { try { return await navigator.clipboard.readText(); } catch (e) { return 'ERR:' + e.message; } })()")
        clip_ok = isinstance(clip, str) and clip.startswith("KEYFRAME DEMO SCRIPT")
        check("clipboard holds full output", clip_ok, (clip or "")[:60].replace("\n", " "))
        check("clipboard contains all three sections", clip_ok and all(k in clip for k in ("CUT LIST", "VIDEO AI PROMPT", "SHOT 8")))

        # per-shot copy (switch back to the Script tab first)
        await ev(tab, """[...document.querySelectorAll('button[role=tab]')].find(b=>b.textContent.includes('Script')).click()""")
        await asyncio.sleep(0.5)
        await ev(tab, """[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Copy shot')).click()""")
        await asyncio.sleep(0.9)
        shot_clip = await ev(tab, "(async () => { try { return await navigator.clipboard.readText(); } catch (e) { return 'ERR'; } })()")
        check("per-shot copy holds one shot", isinstance(shot_clip, str) and shot_clip.startswith("SHOT 1") and "SHOT 2" not in shot_clip, (shot_clip or "")[:40])
        await ev(tab, """[...document.querySelectorAll('button')].find(b=>b.textContent.includes('New Script')).click()""")
        await asyncio.sleep(1.2)
        check("returns to input after New Script", await ev(tab, "!!document.getElementById('kf-main-features')"))
        check("inputs kept for next run", await ev(tab, "document.getElementById('kf-main-url').value") == "https://acme.example")

        await ev(tab, """[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Script history')).click()""")
        await asyncio.sleep(0.7)
        hist_text = await ev(tab, "document.body.innerText")
        check("history entry saved", "Acme Boards" in hist_text, "app name in history")
        check("history stats shown", "90s · 8 shots" in hist_text)
        await shot(tab, "16-history-with-entry.png")

        # load it back
        await ev(tab, """[...document.querySelectorAll('[role=button]')].find(el=>el.innerText.includes('Acme Boards')).click()""")
        await asyncio.sleep(1.0)
        check("history item loads results", await ev(tab, "document.body.innerText.includes('Copy Full Script')"))

        print("\n7. Regenerate with a cut-list screen (Add to Script)")
        await ev(tab, """[...document.querySelectorAll('button[role=tab]')].find(b=>b.textContent.includes('Cut List')).click()""")
        await asyncio.sleep(0.5)
        await ev(tab, """[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Add to Script')).click()""")
        await asyncio.sleep(1.0)
        check(
            "regen notice shown during generation",
            await ev(tab, "document.body.innerText.includes('Regenerating with')"),
            "loading stepper carries the notice",
        )
        for _ in range(40):
            await asyncio.sleep(0.5)
            if await ev(tab, "document.body.innerText.includes('Copy Full Script')"):
                break
        check("results returned after regen", await ev(tab, "document.body.innerText.includes('Copy Full Script')"))

        print("\n8. Persistence across reload")
        await tab.send_command("Page.navigate", {"url": URL})
        await asyncio.sleep(3)
        check("inputs restored on reload", await ev(tab, "document.getElementById('kf-hero-url')?.value") == "https://acme.example")
        check("landing shown again (fresh session view)", await ev(tab, "document.body.innerText.includes('Turn any app into a')"))
        check("nav history badge shows 1", await ev(tab, """(() => { const b = [...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Script history')); return b ? /1/.test(b.textContent) : false; })()"""))

        print("\n" + "─" * 60)
        passed = sum(1 for _, ok, _ in results if ok)
        failed = [(n, d) for n, ok, d in results if not ok]
        print(f"E2E check: {passed}/{len(results)} passed")
        errs = [e for e in console_errors if not any(a in e for a in ALLOWED_ERRORS)]
        if errs:
            print("Unexpected console errors:")
            for e in errs[:6]:
                print("   -", e)
        if failed:
            print("Failures:")
            for n, d in failed:
                print(f"   - {n} {d}")
        sys.exit(1 if failed or errs else 0)


def _on_console(payload):
    params = payload.get("params", {})
    if params.get("type") != "error":
        return
    args = params.get("args", [{}])
    msg = args[0].get("value") or args[0].get("description") or ""
    console_errors.append(msg)
    print(f"  [console.error] {msg}")


def _on_exception(payload):
    details = payload.get("params", {}).get("exceptionDetails", {})
    desc = details.get("exception", {}).get("description") or details.get("text")
    console_errors.append(f"UNCAUGHT: {desc}")
    print(f"  [uncaught] {desc}")


asyncio.run(main())
