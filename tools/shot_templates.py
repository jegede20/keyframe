"""Static HTML templates for og-image + store screenshots (self-contained, no CDN)."""

FONT = "font-family: -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;"
MONO = "font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;"

OG_HTML = f"""<!doctype html><html><head><meta charset="utf-8"><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ width: 1200px; height: 630px; background: #0A0A0F; color: #F0F0F5; {FONT}
  display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }}
.glow {{ position: absolute; top: -260px; left: 50%; transform: translateX(-50%); width: 1100px; height: 700px;
  background: radial-gradient(ellipse at center, #6C5CE7 0%, transparent 62%); opacity: .22; }}
.grid {{ position: absolute; inset: 0; opacity: .05;
  background-image: linear-gradient(to right, #F0F0F5 1px, transparent 1px), linear-gradient(to bottom, #F0F0F5 1px, transparent 1px);
  background-size: 64px 64px; }}
.wrap {{ position: relative; display: flex; gap: 56px; align-items: center; padding: 86px 72px 0; }}
.left {{ max-width: 560px; }}
.badge {{ display: inline-flex; gap: 8px; align-items: center; padding: 8px 16px; border-radius: 999px;
  background: #12121A; border: 1px solid #1E1E2E; color: #9494A8; font-size: 15px; font-weight: 500; margin-bottom: 26px; }}
h1 {{ font-size: 58px; line-height: 1.08; letter-spacing: -.5px; font-weight: 800; }}
h1 span {{ color: #6C5CE7; }}
p {{ margin-top: 20px; color: #9494A8; font-size: 20px; line-height: 1.5; }}
.urlbar {{ margin-top: 30px; display: flex; gap: 12px; }}
.urlinput {{ flex: 1; height: 54px; border-radius: 12px; background: #12121A; border: 1px solid #1E1E2E;
  color: #5C5C72; font-size: 16px; padding: 0 16px; display: flex; align-items: center; }}
.btn {{ height: 54px; padding: 0 26px; border-radius: 999px; background: #6C5CE7; color: #fff; font-weight: 700;
  font-size: 16px; display: flex; align-items: center; box-shadow: 0 0 40px rgba(108,92,231,.45); }}
.shotcard {{ width: 380px; background: #12121A; border: 1px solid #1E1E2E; border-radius: 18px; padding: 24px; }}
.label {{ color: #6C5CE7; font-size: 12px; font-weight: 700; letter-spacing: 1.4px; margin-bottom: 8px; }}
.shothead {{ display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #1E1E2E; padding-bottom: 12px; }}
.shothead b {{ color: #6C5CE7; font-size: 14px; letter-spacing: 1.2px; }}
.shothead time {{ color: #5C5C72; font-size: 13px; {MONO} }}
.row {{ margin-top: 14px; font-size: 14px; color: #9494A8; }}
.row b {{ color: #5C5C72; font-weight: 600; margin-right: 6px; }}
.say {{ font-style: italic; color: #F0F0F5; }}
.pace {{ margin-top: 16px; color: #5C5C72; font-size: 12px; {MONO} }}
.logo {{ position: absolute; top: 40px; left: 72px; display: flex; gap: 10px; align-items: center; }}
.logo b {{ font-size: 24px; font-weight: 800; letter-spacing: -.4px; }}
</style></head><body>
<div class="glow"></div><div class="grid"></div>
<div class="logo"><svg width="22" height="22" viewBox="0 0 32 32" fill="none" style="flex-shrink:0"><path d="M3.6 16h24.8" stroke="#8B7CF6" stroke-width="2.2" stroke-linecap="round" opacity=".45"/><circle cx="5.4" cy="16" r="1.75" fill="#8B7CF6" opacity=".7"/><circle cx="26.6" cy="16" r="1.75" fill="#8B7CF6" opacity=".7"/><path d="M16 8.8 23.2 16 16 23.2 8.8 16Z" fill="#F0F0F5"/></svg><b>Keyframe</b></div>
<div class="wrap">
  <div class="left">
    <div class="badge">⚡ Free · No sign-up</div>
    <h1>Turn any app into a <span>demo script</span> you can shoot today</h1>
    <p>Paste a link, list your features — get a shot-by-shot script with timing, narration, a cut list and a video AI prompt.</p>
    <div class="urlbar"><div class="urlinput">https://your-app.com</div><div class="btn">✦ Generate Script</div></div>
  </div>
  <div class="shotcard">
    <div class="label">FEATURE 1</div>
    <div class="shothead"><b>SHOT 2</b><time>0:08–0:22 · 14s</time></div>
    <div class="row"><b>Screen:</b> Board view</div>
    <div class="row"><b>Action:</b> Drag a card from In Progress to Done.</div>
    <div class="row say"><b>Say:</b> “Drag a card and the status syncs for everyone watching.”</div>
    <div class="pace">15w / 30w max</div>
  </div>
</div></body></html>"""

DESKTOP_HTML = f"""<!doctype html><html><head><meta charset="utf-8"><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ width: 1280px; height: 720px; background: #0A0A0F; color: #F0F0F5; {FONT} overflow: hidden; }}
.nav {{ height: 64px; display: flex; align-items: center; justify-content: space-between; padding: 0 56px;
  border-bottom: 1px solid #1E1E2E; background: rgba(10,10,15,.85); }}
.nav .links {{ display: flex; gap: 28px; color: #9494A8; font-size: 14px; font-weight: 500; }}
.logo {{ display: flex; gap: 8px; align-items: center; font-weight: 800; font-size: 20px; }}
.cta {{ background: #6C5CE7; color: #fff; padding: 10px 20px; border-radius: 999px; font-weight: 600; font-size: 14px; }}
.main {{ position: relative; padding: 70px 56px 0; text-align: center; }}
.glow {{ position: absolute; top: -220px; left: 50%; transform: translateX(-50%); width: 900px; height: 560px;
  background: radial-gradient(ellipse at center, #6C5CE7 0%, transparent 62%); opacity: .16; }}
h1 {{ position: relative; font-size: 52px; line-height: 1.1; font-weight: 800; letter-spacing: -.8px; }}
h1 span {{ color: #6C5CE7; }}
.sub {{ position: relative; color: #9494A8; font-size: 17px; margin: 18px auto 30px; max-width: 620px; line-height: 1.55; }}
.card {{ position: relative; max-width: 760px; margin: 0 auto; background: #12121A; border: 1px solid #1E1E2E;
  border-radius: 18px; padding: 26px; text-align: left; }}
.card h3 {{ font-size: 19px; margin-bottom: 16px; font-weight: 600; }}
.field {{ height: 50px; border-radius: 12px; border: 1px solid #3B3B5C; background: #0A0A0F; color: #F0F0F5;
  display: flex; align-items: center; padding: 0 16px; font-size: 15px; }}
.ta {{ height: 92px; border-radius: 12px; border: 1px solid #1E1E2E; background: #0A0A0F; color: #9494A8;
  padding: 14px 16px; font-size: 14px; margin-top: 14px; line-height: 1.5; }}
.btn {{ margin-top: 18px; height: 52px; border-radius: 999px; background: #6C5CE7; color: #fff; font-weight: 700;
  display: flex; align-items: center; justify-content: center; box-shadow: 0 0 34px rgba(108,92,231,.5); }}
.trust {{ display: flex; justify-content: space-between; max-width: 760px; margin: 22px auto 0; color: #9494A8;
  font-size: 13px; background: #12121A; border: 1px solid #1E1E2E; border-radius: 12px; padding: 14px 22px; }}
</style></head><body>
<div class="nav">
  <div class="logo"><svg width="22" height="22" viewBox="0 0 32 32" fill="none" style="flex-shrink:0"><path d="M3.6 16h24.8" stroke="#8B7CF6" stroke-width="2.2" stroke-linecap="round" opacity=".45"/><circle cx="5.4" cy="16" r="1.75" fill="#8B7CF6" opacity=".7"/><circle cx="26.6" cy="16" r="1.75" fill="#8B7CF6" opacity=".7"/><path d="M16 8.8 23.2 16 16 23.2 8.8 16Z" fill="#F0F0F5"/></svg>Keyframe</div>
  <div class="links"><span>How It Works</span><span>Features</span><span>FAQ</span></div>
  <div class="cta">Get Started →</div>
</div>
<div class="main">
  <div class="glow"></div>
  <h1>Turn any app into a <span>demo script</span> you can shoot today</h1>
  <p class="sub">Paste a link, list the features that matter, get a shot-by-shot 1–2 minute script with timing, narration, cut list and video prompt.</p>
  <div class="card">
    <h3>🎬 What are we demoing?</h3>
    <div class="field">🔗 https://your-app.com</div>
    <div class="ta">e.g. One-click export, real-time collab, AI suggestions...</div>
    <div class="btn">✦ Generate Script</div>
  </div>
  <div class="trust"><span>🔒 No account needed</span><span>⚡ Free forever</span><span>📱 Any device</span><span>🛡️ Data stays local</span></div>
</div></body></html>"""

MOBILE_HTML = f"""<!doctype html><html><head><meta charset="utf-8"><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ width: 390px; height: 844px; background: #0A0A0F; color: #F0F0F5; {FONT}; overflow: hidden; }}
.nav {{ height: 56px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; border-bottom: 1px solid #1E1E2E; }}
.logo {{ display: flex; gap: 7px; align-items: center; font-weight: 800; font-size: 17px; }}
.icons {{ display: flex; gap: 14px; color: #9494A8; font-size: 17px; }}
.summary {{ margin: 12px 16px; border: 1px solid #1E1E2E; border-radius: 12px; background: #12121A; padding: 11px 14px;
  display: flex; justify-content: space-between; align-items: center; color: #9494A8; font-size: 12px; {MONO} }}
.summary b {{ color: #6C5CE7; font-weight: 600; {FONT} font-size: 13px; }}
.tabs {{ display: flex; margin: 6px 16px 0; border-bottom: 1px solid #1E1E2E; }}
.tab {{ flex: 1; text-align: center; padding: 12px 0; font-size: 13px; font-weight: 500; color: #5C5C72; }}
.tab.on {{ color: #F0F0F5; border-bottom: 2px solid #6C5CE7; font-weight: 600; }}
.stats {{ margin: 14px 16px 10px; display: inline-block; padding: 6px 12px; border-radius: 999px; background: #12121A;
  border: 1px solid #1E1E2E; color: #5C5C72; font-size: 11px; {MONO} }}
.card {{ margin: 0 16px 12px; background: #12121A; border: 1px solid #1E1E2E; border-radius: 16px; padding: 16px; }}
.label {{ color: #6C5CE7; font-size: 11px; font-weight: 700; letter-spacing: 1.2px; }}
.shothead {{ display: flex; justify-content: space-between; align-items: baseline; margin-top: 4px; border-bottom: 1px solid #1E1E2E; padding-bottom: 10px; }}
.shothead b {{ color: #6C5CE7; font-size: 12px; letter-spacing: 1px; }}
.shothead time {{ color: #5C5C72; font-size: 12px; {MONO} }}
.row {{ margin-top: 11px; font-size: 13.5px; color: #9494A8; line-height: 1.45; }}
.row b {{ color: #5C5C72; font-weight: 600; margin-right: 5px; }}
.say {{ font-style: italic; color: #F0F0F5; }}
.pace {{ margin-top: 12px; color: #5C5C72; font-size: 11px; {MONO} }}
.bottombar {{ position: fixed; bottom: 0; left: 0; right: 0; height: 62px; background: #0A0A0F; border-top: 1px solid #1E1E2E;
  display: flex; gap: 10px; padding: 9px 16px; }}
.b1, .b2 {{ flex: 1; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; }}
.b1 {{ background: #6C5CE7; color: #fff; }}
.b2 {{ background: #12121A; border: 1px solid #1E1E2E; color: #F0F0F5; }}
</style></head><body>
<div class="nav"><div class="logo"><svg width="22" height="22" viewBox="0 0 32 32" fill="none" style="flex-shrink:0"><path d="M3.6 16h24.8" stroke="#8B7CF6" stroke-width="2.2" stroke-linecap="round" opacity=".45"/><circle cx="5.4" cy="16" r="1.75" fill="#8B7CF6" opacity=".7"/><circle cx="26.6" cy="16" r="1.75" fill="#8B7CF6" opacity=".7"/><path d="M16 8.8 23.2 16 16 23.2 8.8 16Z" fill="#F0F0F5"/></svg>Keyframe</div><div class="icons"><span>🕐</span><span>⚙️</span><span>☰</span></div></div>
<div class="summary"><span>acme.example · 3 features · 90s</span><b>✏️ Edit</b></div>
<div class="tabs"><div class="tab on">Script</div><div class="tab">Cut List (3)</div><div class="tab">Prompt</div></div>
<div class="stats">TOTAL: 90s · 8 shots · ~112 words</div>
<div class="card">
  <div class="label">OPENING</div>
  <div class="shothead"><b>SHOT 1</b><time>0:00–0:08 · 8s</time></div>
  <div class="row"><b>Screen:</b> Home dashboard</div>
  <div class="row"><b>Action:</b> Land on the dashboard with live project tiles.</div>
  <div class="row say"><b>Say:</b> “Every project your team owns, on one screen.”</div>
  <div class="pace">13w / 17w max</div>
</div>
<div class="card">
  <div class="label">FEATURE 1</div>
  <div class="shothead"><b>SHOT 2</b><time>0:08–0:22 · 14s</time></div>
  <div class="row"><b>Screen:</b> Board view</div>
  <div class="row"><b>Action:</b> Drag a card from In Progress to Done.</div>
  <div class="row say"><b>Say:</b> “Drag a card and the status syncs for everyone watching.”</div>
  <div class="pace">15w / 30w max</div>
</div>
<div class="bottombar"><div class="b1">📋 Copy All</div><div class="b2">＋ New Script</div></div>
</body></html>"""
