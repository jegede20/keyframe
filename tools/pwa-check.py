"""
Production PWA verification.
Serves dist/ on :4174 with a local static server that this script starts, kills and
restarts itself, and uses a Chrome launched with external DNS blackholed so that
service-worker fetches to r.jina.ai / api.groq.com fail exactly like an outage
(CDP's Network.emulateNetworkConditions does not reach SW network traffic).

Checks: SW lifecycle, precache, cache strategies, offline API payload,
offline navigation fallbacks, build headers.
"""
import asyncio
import json
import os
import signal
import socket
import subprocess
import sys
import time

from choreographer import Browser

HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, "..", "dist")
PORT = 4174
BASE = f"http://localhost:{PORT}/"
CHROME_WRAPPER = "/tmp/chrome-offline.sh"

results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("  PASS  " if ok else "  FAIL  ") + name + (f" — {detail}" if detail else ""))


async def ev(tab, expression):
    res = await tab.send_command(
        "Runtime.evaluate",
        {"expression": expression, "returnByValue": True, "awaitPromise": True},
    )
    out = res.get("result") or {}
    if "exceptionDetails" in out:
        return None
    return out.get("result", {}).get("value")


def start_server():
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1", "--directory", DIST],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    for _ in range(40):
        try:
            with socket.create_connection(("127.0.0.1", PORT), timeout=0.3):
                return proc
        except OSError:
            time.sleep(0.15)
    raise RuntimeError("static server did not start")


def stop_server(proc):
    try:
        os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
    except ProcessLookupError:
        pass


async def main():
    server = start_server()
    print(f"static server serving {DIST} on {BASE}")
    try:
        async with Browser(path=CHROME_WRAPPER, headless=True) as browser:
            tab = await browser.create_tab(BASE)
            await tab.send_command("Emulation.setFocusEmulationEnabled", {"enabled": True})
            await tab.send_command("Page.enable")
            await tab.send_command("Runtime.enable")
            # Wait for the install precache to settle (20 parallel cache.add calls).
            for _ in range(30):
                await asyncio.sleep(1)
                count = await ev(
                    tab,
                    "caches.open('keyframe-v1.0.0-shell').then(c => c.keys()).then(a => a.length).catch(() => 0)",
                )
                if isinstance(count, int) and count >= 15:
                    break
            print(f"  (precache entries after settle: {count})")

            print("\n1. Service worker lifecycle")
            info_raw = await ev(
                tab,
                """(async () => {
                  const reg = await navigator.serviceWorker.getRegistration();
                  if (!reg) return 'none';
                  await navigator.serviceWorker.ready;
                  return JSON.stringify({
                    scope: reg.scope,
                    state: reg.active && reg.active.state,
                    controller: !!navigator.serviceWorker.controller,
                    updateViaCache: reg.updateViaCache,
                  });
                })()""",
            )
            info = json.loads(info_raw or "{}")
            check("SW registered, activated, scope '/'", info.get("state") == "activated" and info.get("scope", "").endswith("/"), str(info))
            check("page is controlled by the SW", info.get("controller") is True)
            check("registration bypasses HTTP cache for sw.js", info.get("updateViaCache") in ("imports", "none"), str(info.get("updateViaCache")))

            print("\n2. Precache + cache contents")
            # Pull one static asset through the SW so the lazy static cache exists.
            await ev(tab, "(async () => { await fetch('/icons/icon-72x72.png'); return true; })()")
            cache_raw = await ev(
                tab,
                """(async () => {
                  const names = await caches.keys();
                  const out = {};
                  for (const n of names) {
                    const keys = await (await caches.open(n)).keys();
                    out[n] = keys.map(r => new URL(r.url).pathname);
                  }
                  return JSON.stringify(out);
                })()""",
            )
            cache_map = json.loads(cache_raw or "{}")
            shell = next((v for k, v in cache_map.items() if k.endswith("-shell")), [])
            all_cached = [p for paths in cache_map.values() for p in paths]
            check("cache names versioned per spec", "keyframe-v1.0.0-shell" in cache_map and "keyframe-v1.0.0-static" in cache_map, str(list(cache_map.keys())))
            check("shell precached", "/index.html" in shell and "/" in shell and "/manifest.json" in shell)
            check("offline.html precached", "/offline.html" in shell)
            check("hashed bundles + css precached", sum(1 for p in all_cached if p.startswith("/assets/")) >= 3, ", ".join([p for p in all_cached if p.startswith("/assets/")][:4]))
            check("all icon sizes precached", sum(1 for p in all_cached if p.startswith("/icons/icon-")) >= 8)

            print("\n3. Offline API behaviour (external hosts unreachable)")
            api_raw = await ev(
                tab,
                """(async () => {
                  const tryFetch = async (url) => {
                    try {
                      const res = await fetch(url);
                      return { status: res.status, body: await res.json() };
                    } catch (e) { return { error: String(e) }; }
                  };
                  return JSON.stringify({
                    jina: await tryFetch('https://r.jina.ai/https://example.com'),
                    groq: await tryFetch('https://api.groq.com/openai/v1/chat/completions'),
                  });
                })()""",
            )
            api = json.loads(api_raw or "{}")
            jina, groq = api.get("jina", {}), api.get("groq", {})
            check("Jina call → 503 while offline", jina.get("status") == 503, str(jina)[:70])
            check("Groq call → 503 while offline", groq.get("status") == 503, str(groq)[:70])
            check(
                "503 payload exactly matches spec",
                jina.get("body", {}).get("error") == "offline"
                and jina.get("body", {}).get("message") == "No internet connection."
                and groq.get("body", {}).get("message") == "No internet connection.",
                json.dumps(jina.get("body", {})),
            )
            check("no API host ever cached", not any("jina.ai" in p or "groq.com" in p for p in all_cached))

            print("\n4. Full outage (static server stopped)")
            stop_server(server)
            await asyncio.sleep(1.2)

            await tab.send_command("Page.navigate", {"url": BASE + "some-route-not-cached"})
            await asyncio.sleep(3)
            offline_txt = (await ev(tab, "document.body ? document.body.innerText : ''")) or ""
            check("unknown route → offline.html", "You're offline" in offline_txt, offline_txt[:40].replace("\n", " "))
            check("offline.html shows Try Again", "Try Again" in offline_txt)
            check("offline.html mentions offline history", "history works offline" in offline_txt)

            await tab.send_command("Page.navigate", {"url": BASE})
            await asyncio.sleep(4)
            app_txt = (await ev(tab, "document.body ? document.body.innerText : ''")) or ""
            href = await ev(tab, "location.href")
            check("cached shell boots with no server", "Turn any app into a" in app_txt, f"{href} :: {app_txt[:40].replace(chr(10), ' ')}")
            check("app interactive offline", await ev(tab, "!!document.getElementById('kf-hero-url')") is True)
            # navigator.onLine stays true under the DNS trick, so drive the same
            # event the browser fires on a real disconnect.
            banner = await ev(
                tab,
                """(async () => {
                  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
                  window.dispatchEvent(new Event('offline'));
                  await new Promise(r => setTimeout(r, 600));
                  const txt = document.body.innerText;
                  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
                  window.dispatchEvent(new Event('online'));
                  return txt.includes("You're offline");
                })()""",
            )
            check("offline banner appears on disconnect", banner is True)

            print("\n5. Build output headers + manifest")
            headers = open(os.path.join(DIST, "_headers")).read()
            check("sw.js is never cached by the CDN", "/sw.js" in headers and "no-cache, no-store, must-revalidate" in headers)
            check("assets are immutable", "/assets/*" in headers and "immutable" in headers)
            check("security headers present", "X-Frame-Options: DENY" in headers and "nosniff" in headers and "Referrer-Policy" in headers)
            check("SPA redirect rule", open(os.path.join(DIST, "_redirects")).read().strip() == "/*    /index.html    200")
            manifest = json.load(open(os.path.join(DIST, "manifest.json")))
            check("manifest: standalone + theme color", manifest["display"] == "standalone" and manifest["theme_color"] == "#6C5CE7")
            check("manifest: 9+ icons incl. maskable", len(manifest["icons"]) >= 9 and any(i["purpose"] == "maskable" for i in manifest["icons"]))
            check("manifest: 2 screenshots", len(manifest["screenshots"]) == 2)
            check("manifest: 2 shortcuts with actions", [s["url"] for s in manifest["shortcuts"]] == ["/?action=new", "/?action=history"])
            sw = open(os.path.join(DIST, "sw.js")).read()
            check("sw.js precaches workbox manifest", sw.count('"revision"') >= 15, f"{sw.count('revision')} entries")

    finally:
        stop_server(server)

    print("\n" + "─" * 60)
    passed = sum(1 for _, ok, _ in results if ok)
    failed = [(n, d) for n, ok, d in results if not ok]
    print(f"PWA check: {passed}/{len(results)} passed")
    for n, d in failed:
        print(f"   - {n} {d}")
    sys.exit(1 if failed else 0)


asyncio.run(main())
