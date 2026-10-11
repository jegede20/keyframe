import { useState } from 'react';
import { Clapperboard, Scissors, Video, Ban } from 'lucide-react';
import Badge from '../shared/Badge.jsx';

/* Static demo data — shows the shape of the output before the user generates. */
const SAMPLE_SCRIPT = [
  { shotNumber: 1, label: 'OPENING', time: '0:00–0:08', screen: 'Home dashboard', action: 'Land on the dashboard with live project tiles visible.', narration: 'Every project, every owner, one screen — updated the second anything changes.' },
  { shotNumber: 2, label: 'FEATURE 1', time: '0:08–0:26', screen: 'Board view', action: 'Drag a card from In Progress to Done.', narration: 'Drag a task across the board and the status syncs to everyone watching. No refresh, no “did you see my update?”.' },
  { shotNumber: 3, label: 'FEATURE 2', time: '0:26–0:44', screen: 'Reports', action: 'Filter the report by squad, then by sprint.', narration: 'Filter by squad or sprint to see where work is piling up, then turn that view into a one-click export.' },
  { shotNumber: 4, label: 'CLOSING', time: '0:44–1:00', screen: 'Pricing', action: 'Scroll the three tiers, pause on the middle plan.', narration: 'Start free with your whole team. Upgrade only when your projects outgrow the plan.' },
];

const SAMPLE_CUTS = [
  { screenName: 'Integrations directory', reason: '40+ integrations read as a wall of logos on video; the two your buyer uses are better shown inside a real workflow.' },
  { screenName: 'Mobile app tour', reason: 'The desktop flow demonstrates the same features faster — mobile deserves its own 30-second cut.' },
  { screenName: 'Admin & billing settings', reason: 'Buyers rarely decide on billing screens, and it would eat ten seconds of a sixty-second demo.' },
];

const TABS = [
  { id: 'script', label: 'Script', short: 'Script', icon: Clapperboard },
  { id: 'cut', label: 'Cut List', short: 'Cut List', icon: Scissors },
  { id: 'prompt', label: 'Video Prompt', short: 'Prompt', icon: Video },
];

/** Section 8.2 — fake tabbed preview, same visual language as the real results. */
export default function OutputPreview() {
  const [tab, setTab] = useState('script');

  return (
    <section className="kf-container" style={{ paddingTop: 48, paddingBottom: 48 }}>
      <h2 className="kf-section-headline" style={{ textAlign: 'center', marginBottom: 12 }}>
        This is what you get back
      </h2>
      <p className="kf-small" style={{ textAlign: 'center', color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto 28px' }}>
        A 60-second sample. Every generation returns the script, the cut list, and the video prompt.
      </p>

      <div className="kf-card" style={{ maxWidth: 860, margin: '0 auto', padding: '20px 20px 26px' }}>
        {/* Tabs */}
        <div role="tablist" aria-label="Sample output sections" className="kf-tabs" style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border-subtle)', marginBottom: 18, overflowX: 'auto' }}>
          {TABS.map(({ id, label, short, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setTab(id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  minHeight: 44,
                  padding: '0 14px',
                  flex: '1 0 auto',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  fontSize: 14,
                  color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  borderBottom: `2px solid ${active ? 'var(--accent-primary)' : 'transparent'}`,
                  marginBottom: -1,
                }}
              >
                <Icon size={15} aria-hidden="true" />
                <span className="kf-tab-label-full">
                  {label}
                  {id === 'cut' ? ` (${SAMPLE_CUTS.length})` : ''}
                </span>
                <span className="kf-tab-label-short">
                  {short}
                  {id === 'cut' ? ` (${SAMPLE_CUTS.length})` : ''}
                </span>
              </button>
            );
          })}
        </div>

        <div key={tab} className="kf-anim-tab">
          {tab === 'script' && (
            <div>
              <span className="kf-mono-pill" style={{ marginBottom: 14, display: 'inline-flex' }}>
                TOTAL: 60s · 4 shots · ~46 words
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {SAMPLE_SCRIPT.map((shot) => (
                  <div
                    key={shot.shotNumber}
                    style={{
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 16px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                      <span className="kf-caption" style={{ color: 'var(--accent-text)', fontWeight: 600, letterSpacing: '0.07em' }}>
                        {shot.label} · SHOT {shot.shotNumber}
                      </span>
                      <span className="kf-mono" style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                        {shot.time}
                      </span>
                    </div>
                    <p className="kf-caption" style={{ color: 'var(--text-tertiary)', marginTop: 8 }}>
                      Screen: <span style={{ color: 'var(--text-secondary)' }}>{shot.screen}</span>
                    </p>
                    <p className="kf-small" style={{ color: 'var(--text-primary)', marginTop: 4 }}>
                      {shot.action}
                    </p>
                    <p className="kf-small" style={{ color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: 6 }}>
                      “{shot.narration}”
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'cut' && (
            <div>
              <p className="kf-small" style={{ color: 'var(--text-secondary)', marginBottom: 14 }}>
                {SAMPLE_CUTS.length} screens excluded from this script
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {SAMPLE_CUTS.map((cut) => (
                  <div
                    key={cut.screenName}
                    style={{
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 16px',
                      display: 'flex',
                      gap: 12,
                    }}
                  >
                    <Ban size={17} color="var(--accent-warning)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                    <div>
                      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 15, color: 'var(--text-primary)' }}>
                        {cut.screenName}
                      </p>
                      <p className="kf-small" style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                        {cut.reason}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'prompt' && (
            <div>
              <div style={{ marginBottom: 12 }}>
                <Badge variant="accent">Runway</Badge>
              </div>
              <div
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: 18,
                  maxHeight: 300,
                  overflowY: 'auto',
                }}
              >
                <pre className="kf-mono" style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.7, color: 'var(--text-primary)', margin: 0 }}>
{`Create a 60-second product demo of a project management app.
Camera: slow zoom → static shot → pan left between scenes.

SCENE 1 (0:00–0:08) — Slow zoom into a dark dashboard.
Tiles show live project counts. UI accent colour: violet #6C5CE7.

SCENE 2 (0:08–0:26) — Static screen capture. A task card is
dragged from "In Progress" to "Done"; a toast confirms the sync.

SCENE 3 (0:26–0:44) — Dolly in on a filtered report; bars animate
in as the squad filter changes.

SCENE 4 (0:44–1:00) — Pan left onto three pricing tiers, hold on
the middle plan, fade to logo on the dark background.

Style: clean, modern SaaS, soft shadows, violet accent, minimal
chrome, no people on screen.`}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
