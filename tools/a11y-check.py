"""
Accessibility audit with axe-core (injected from unpkg into the running build).
Covers the landing page, the input workspace, the results view and the mobile
viewport, then reports violations with impact.

Targets the dev server by default; KF_BASE points it at the built bundle or a
deployment, like the other browser suites. Theme via KF_THEME.
"""
import asyncio
import json
import os
import sys

from choreographer import Browser

# Base URL is overridable (KF_BASE), e.g. https://keyframe-nine.vercel.app
BASE = (os.environ.get("KF_BASE") or "http://localhost:5173").rstrip("/") + "/"
AXE = "https://unpkg.com/axe-core@4.10.2/axe.min.js"

SAMPLE_OUTPUT = {
    "meta": {"appName": "Acme Boards", "appPurpose": "Team project tracking.", "totalSeconds": 60, "shotCount": 5, "estimatedWordCount": 100, "tone": "professional"},
    "script": [
        {"shotNumber": i, "label": label, "screen": f"Screen {i}", "timeStart": f"0:{i*12:02d}", "timeEnd": f"0:{(i+1)*12:02d}", "durationSeconds": 12, "action": f"Action {i}", "narration": "Narration line that fits the shot."}
        for i, label in enumerate(["OPENING", "FEATURE 1", "FEATURE 2", "FEATURE 3", "CLOSING"], start=1)
    ],
    "cutList": [{"screenName": "Mobile app", "reason": "Needs its own vertical cut."}, {"screenName": "Billing", "reason": "Prices change; handled in sales."}],
    "videoPrompt": {"target": "any", "fullPrompt": "A 60-second demo prompt. " * 12},
}


async def ev(tab, expression):
    res = await tab.send_command("Runtime.evaluate", {"expression": expression, "returnByValue": True, "awaitPromise": True})
    out = res.get("result") or {}
    if "exceptionDetails" in out:
        return None
    return out.get("result", {}).get("value")


async def run_axe(tab, label):
    report = await ev(
        tab,
        """(async () => {
          const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice'] } });
          return JSON.stringify(r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })));
        })()""",
    )
    violations = json.loads(report or "[]")
    print(f"\n{label}")
    if not violations:
        print("  PASS  no axe violations")
    for v in violations:
        mark = "FAIL " if v["impact"] in ("serious", "critical") else "WARN "
        print(f"  {mark} [{v['impact']}] {v['id']} × {v['nodes']} — {v['help']}")
    return violations


async def main():
    violations_all = []
    async with Browser(headless=True) as browser:
        tab = await browser.create_tab(BASE)
        await tab.send_command("Emulation.setFocusEmulationEnabled", {"enabled": True})
        await tab.send_command("Page.enable")
        await tab.send_command("Runtime.enable")
        await asyncio.sleep(3)
        # Theme under audit: KF_THEME=dark (default) or KF_THEME=light
        wanted = os.environ.get("KF_THEME", "dark")
        await ev(tab, f"localStorage.setItem('kf_settings', JSON.stringify({{theme:'{wanted}'}}))")
        await tab.send_command("Page.navigate", {"url": BASE})
        await asyncio.sleep(2.5)
        await ev(tab, f"(async () => {{ const s=document.createElement('script'); s.src='{AXE}'; document.head.appendChild(s); await new Promise(r => s.onload=r); return !!window.axe; }})()")
        theme = await ev(tab, "document.documentElement.getAttribute('data-theme')")
        print(f"auditing theme: {theme}")

        violations_all += await run_axe(tab, "1. Landing page (desktop)")

        # workspace state
        await ev(tab, """(() => {
          const i=document.getElementById('kf-hero-url');
          const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
          s.call(i,'https://acme.example'); i.dispatchEvent(new Event('input',{bubbles:true}));
          document.querySelector('button[type=submit]').click(); return true;
        })()""")
        await asyncio.sleep(1)
        violations_all += await run_axe(tab, "2. Input workspace")

        # results state via mocked APIs
        await ev(tab, """
        (() => {
          window.__mock = %s;
          const realFetch = window.fetch.bind(window);
          window.fetch = async (input, init) => {
            const url = typeof input === 'string' ? input : (input && input.url) || '';
            if (url.startsWith('https://r.jina.ai/')) return new Response('# App\\n\\n## Screens\\n' + 'word '.repeat(120), {status:200});
            if (url.startsWith('https://api.groq.com/')) return new Response(JSON.stringify({choices:[{message:{content: JSON.stringify(window.__mock)}}]}), {status:200});
            return realFetch(input, init);
          };
          return true;
        })()""" % json.dumps(SAMPLE_OUTPUT))
        await ev(tab, """(() => { const ta=document.getElementById('kf-main-features'); const s=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set; s.call(ta,'export, boards'); ta.dispatchEvent(new Event('input',{bubbles:true})); return true; })()""")
        await asyncio.sleep(0.4)
        await ev(tab, """(() => { const f=[...document.querySelectorAll('form')].find(f=>f.querySelector('#kf-main-features')); f.querySelector('button[type=submit]').click(); return true; })()""")
        for _ in range(30):
            await asyncio.sleep(0.5)
            if await ev(tab, """!!document.querySelector('[role=tablist][aria-label="Script output sections"]')"""):
                break
        violations_all += await run_axe(tab, "3. Results view (script tab)")
        await ev(tab, """[...document.querySelectorAll('button[role=tab]')].find(b=>b.textContent.includes('Cut List')).click()""")
        await asyncio.sleep(0.5)
        violations_all += await run_axe(tab, "4. Results view (cut list tab)")

        # overlays
        await ev(tab, """[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Script history')).click()""")
        await asyncio.sleep(0.6)
        violations_all += await run_axe(tab, "5. History drawer")
        await ev(tab, """[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Close history').click()""")
        await asyncio.sleep(0.4)
        await ev(tab, """[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Settings').click()""")
        await asyncio.sleep(0.6)
        violations_all += await run_axe(tab, "6. Settings modal")
        await ev(tab, """[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Close settings').click()""")
        await asyncio.sleep(0.4)

        # mobile
        await tab.send_command("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 3, "mobile": True})
        await asyncio.sleep(1)
        violations_all += await run_axe(tab, "7. Results on mobile (390px)")

    print("\n" + "─" * 60)
    serious = [v for v in violations_all if v["impact"] in ("serious", "critical")]
    if violations_all:
        print(f"axe-core: {len(violations_all)} violations ({len(serious)} serious/critical)")
        for v in violations_all:
            print(f"   - [{v['impact']}] {v['id']} × {v['nodes']}")
    else:
        print("axe-core: 0 violations at any impact ✓")
    sys.exit(1 if violations_all else 0)


asyncio.run(main())
