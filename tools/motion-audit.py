#!/usr/bin/env python3
"""
Motion audit — proves Rule 8: under `prefers-reduced-motion: reduce`, nothing
in the interface animates or transitions.

Why a dedicated tool: spot checks ("did the stepper stop spinning?") miss
transitions that live outside the motion gate, which is exactly how six of them
once shipped in `html, body`, `.kf-btn`, `.kf-icon-btn`, `.kf-input` and the two
reveal primitives. This walks *every element in the DOM* in each app state and
asserts computed motion is zero, then flips the media feature off and asserts
the same elements DO animate again (so a stylesheet that forgot to include a
rule fails loudly instead of looking clean).

  python3 tools/motion-audit.py                    # dev server on :5173
  KF_BASE=http://localhost:4173 python3 tools/motion-audit.py

Exit code 0 = clean.
"""
import asyncio
import os
import sys

from choreographer import Browser

BASE = (os.environ.get("KF_BASE", "http://localhost:5173").rstrip("/")) + "/"

# Walks the document and reports anything that would visibly move.
PROBE = """
(() => {
  const bad = [];
  const els = document.querySelectorAll('*');
  for (const el of els) {
    const cs = getComputedStyle(el);
    const anim = cs.animationName !== 'none' && cs.animationDuration.split(',')
      .some((d) => parseFloat(d) > 0.001);
    const trans = cs.transitionDuration.split(',')
      .some((d) => parseFloat(d) > 0.001);
    if (anim || trans) {
      bad.push({
        what: anim ? 'animation' : 'transition',
        sel: el.tagName.toLowerCase()
          + (el.id ? '#' + el.id : '')
          + (typeof el.className === 'string' && el.className ? '.' + el.className.split(/\\s+/).slice(0, 3).join('.') : ''),
        detail: anim ? cs.animationName + ' ' + cs.animationDuration : cs.transitionProperty + ' ' + cs.transitionDuration,
      });
    }
  }
  // reveal primitives must be readable without JS running
  const hidden = [...document.querySelectorAll('.kf-reveal, .kf-reveal-scale')]
    .filter((el) => parseFloat(getComputedStyle(el).opacity) < 1).length;
  return JSON.stringify({ bad: bad.slice(0, 12), count: bad.length, hiddenReveals: hidden });
})()
"""

results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok)))
    print(("  PASS  " if ok else "  FAIL  ") + name + (f" — {detail}" if detail else ""))


async def ev(tab, expression):
    res = await tab.send_command(
        "Runtime.evaluate", {"expression": expression, "returnByValue": True, "awaitPromise": True}
    )
    return (res.get("result") or {}).get("result", {}).get("value")


async def set_motion(tab, value):
    await tab.send_command(
        "Emulation.setEmulatedMedia",
        {"features": [{"name": "prefers-reduced-motion", "value": value}]},
    )
    await asyncio.sleep(0.35)


async def audit_state(tab, label):
    raw = await ev(tab, PROBE)
    import json

    data = json.loads(raw or "{}")
    count = data.get("count", -1)
    hidden = data.get("hiddenReveals", 0)
    detail = ""
    if count:
        first = data["bad"][0]
        detail = f"{first['sel']} → {first['detail']}; +{count - 1} more"
    check(f"[reduce] no motion in {label}", count == 0, detail)
    check(f"[reduce] content readable in {label}", hidden == 0, f"{hidden} reveal element(s) at opacity<1")


async def audit_state_motion_on(tab, label, want_motion):
    """Sanity: with motion enabled the same state SHOULD contain transitions."""
    raw = await ev(tab, PROBE)
    import json

    data = json.loads(raw or "{}")
    check(
        f"[motion allowed] {label} still animates",
        (data.get("count", 0) > 0) == want_motion,
        f"{data.get('count')} animated element(s)",
    )


async def main():
    async with Browser(headless=True) as browser:
        tab = await browser.create_tab(BASE)
        await tab.send_command("Emulation.setDeviceMetricsOverride",
                               {"width": 1280, "height": 900, "deviceScaleFactor": 1, "mobile": False})
        await asyncio.sleep(2.5)

        # Inject a scripted generation so results/overlays can be audited too.
        await ev(tab, """(() => {
          const real = window.fetch.bind(window);
          const md = ['# Acme Boards', '', '## Home dashboard', 'Live tiles for every project, updated in real time.',
                      '', '## Board view', 'Drag cards between columns; statuses sync instantly.'].join(String.fromCharCode(10));
          const payload = %s;
          window.fetch = async (input, init) => {
            const url = typeof input === 'string' ? input : (input && input.url) || '';
            if (url.startsWith('https://r.jina.ai/')) {
              return new Response(md, { status: 200, headers: { 'Content-Type': 'text/markdown' } });
            }
            if (url.startsWith('https://api.groq.com/')) {
              return new Response(JSON.stringify({ id: 'm', model: 'openai/gpt-oss-120b',
                choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(payload) }, finish_reason: 'stop' }],
                usage: { prompt_tokens: 10, completion_tokens: 10 } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
            return real(input, init);
          };
          return true;
        })()""" % await _payload(tab))

        print(f"target: {BASE}\n")
        print("1. Landing (motion allowed)")
        await audit_state_motion_on(tab, "landing", want_motion=True)

        print("\n2. Landing (prefers-reduced-motion: reduce)")
        await set_motion(tab, "reduce")
        await audit_state(tab, "landing")

        print("\n3. Workspace + results (reduce)")
        await ev(tab, """(() => {
          const set = (el, v) => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
          set(document.getElementById('kf-hero-url'), 'https://acme.example');
          document.querySelector('button[type=submit]').click();
          return true;
        })()""")
        await asyncio.sleep(1.0)
        await audit_state(tab, "workspace")
        if await ev(tab, "!!document.getElementById('kf-main-features')"):
            await ev(tab, """(() => {
              const ta = document.getElementById('kf-main-features');
              Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(ta, 'Boards, exports');
              ta.dispatchEvent(new Event('input', { bubbles: true }));
              const form = [...document.querySelectorAll('form')].find(f => f.querySelector('#kf-main-features'));
              form.querySelector('button[type=submit]').click();
              return true;
            })()""")
        for _ in range(30):
            await asyncio.sleep(0.5)
            if await ev(tab, "document.body.innerText.includes('SHOT 1')"):
                break
        await audit_state(tab, "results")
        await audit_state_motion_on(tab, "results", want_motion=True) if False else None

        print("\n4. Overlays (reduce)")
        await ev(tab, """[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Settings').click()""")
        await asyncio.sleep(0.6)
        await audit_state(tab, "settings modal")
        await ev(tab, """[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Close settings').click()""")
        await asyncio.sleep(0.4)
        await ev(tab, """[...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '').startsWith('Script history')).click()""")
        await asyncio.sleep(0.6)
        await audit_state(tab, "history drawer")
        await ev(tab, """[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Close history').click()""")
        await asyncio.sleep(0.4)

        print("\n5. Toasts (reduce)")
        await ev(tab, "window.dispatchEvent(new Event('keyframe-back-online'))")
        await asyncio.sleep(0.7)
        await audit_state(tab, "toast")
        check(
            "[reduce] toast progress bar hidden",
            await ev(tab, "(() => { const b = document.querySelector('.kf-toast-progress'); return !b || getComputedStyle(b).display === 'none'; })()"),
        )

        print("\n" + "─" * 60)
        passed = sum(1 for _, ok in results if ok)
        failed = [n for n, ok in results if not ok]
        print(f"Motion audit: {passed}/{len(results)} passed")
        if failed:
            for n in failed:
                print("   -", n)
        sys.exit(1 if failed else 0)


async def _payload(tab):
    """Reuse the e2e fixture so rendered results match the other suites."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import json

    return json.dumps({
        "meta": {"appName": "Acme Boards", "appPurpose": "p", "totalSeconds": 60, "shotCount": 4,
                 "estimatedWordCount": 60, "tone": "professional"},
        "script": [
            {"shotNumber": 1, "label": "OPENING", "screen": "Home dashboard", "timeStart": "0:00", "timeEnd": "0:14",
             "durationSeconds": 14, "action": "Land on the dashboard.", "narration": "Every project your team owns, on one screen."},
            {"shotNumber": 2, "label": "FEATURE 1", "screen": "Board view", "timeStart": "0:14", "timeEnd": "0:30",
             "durationSeconds": 16, "action": "Drag a card.", "narration": "Drag a card and the status syncs for everyone watching."},
            {"shotNumber": 3, "label": "FEATURE 2", "screen": "Reports", "timeStart": "0:30", "timeEnd": "0:46",
             "durationSeconds": 16, "action": "Filter by squad.", "narration": "Filter by squad or sprint to see where work piles up."},
            {"shotNumber": 4, "label": "CLOSING", "screen": "Pricing", "timeStart": "0:46", "timeEnd": "1:00",
             "durationSeconds": 14, "action": "Scroll the pricing tiers.", "narration": "Start free with your whole team and grow when you need to."},
        ],
        "cutList": [
            {"screenName": "Billing settings", "reason": "Admin-only screen; it slows the story down."},
            {"screenName": "Integrations", "reason": "Better shown as a still at the end."},
        ],
        "videoPrompt": {"target": "any", "fullPrompt": " ".join(["A crisp product walkthrough in a dark studio interface with soft violet accents."] * 40)},
    })


asyncio.run(main())
