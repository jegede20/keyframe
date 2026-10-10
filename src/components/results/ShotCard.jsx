import { Clapperboard, MousePointerClick, MessageSquareQuote } from 'lucide-react';
import CopyButton from '../shared/CopyButton.jsx';
import { formatShot } from '../../utils/formatScript.js';
import { checkNarration } from '../../utils/wordCount.js';

function Row({ icon, label, children, italic = false }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 12 }}>
      <span aria-hidden="true" style={{ color: 'var(--text-tertiary)', marginTop: 3, flexShrink: 0 }}>
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <span className="kf-caption" style={{ color: 'var(--text-tertiary)', marginRight: 6 }}>
          {label}
        </span>
        <span
          className="kf-small"
          style={{
            color: 'var(--text-primary)',
            fontStyle: italic ? 'italic' : 'normal',
          }}
        >
          {children}
        </span>
      </div>
    </div>
  );
}

/** Section 8.5 — one shot: header, screen, action, narration, per-shot copy. */
export default function ShotCard({ shot, index }) {
  const narrationCheck = checkNarration(shot.narration, shot.durationSeconds);
  const paceWarn = !narrationCheck.fits && narrationCheck.words > 0;

  return (
    <article
      className="kf-card kf-hover-lift"
      style={{
        padding: 20,
        borderColor: 'var(--border-subtle)',
        transition: 'border-color 180ms ease, transform 180ms ease',
      }}
    >
      {/* Label */}
      <p
        className="kf-caption"
        style={{
          color: 'var(--accent-text)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 6,
          fontWeight: 600,
        }}
      >
        {shot.label || (index === 0 ? 'OPENING' : 'SHOT')}
      </p>

      {/* Header row */}
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 14,
            letterSpacing: '0.06em',
            color: 'var(--accent-text)',
            textTransform: 'uppercase',
          }}
        >
          Shot {shot.shotNumber}
        </h2>
        <span className="kf-mono" style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
          {shot.timeStart}–{shot.timeEnd} · {shot.durationSeconds}s
        </span>
      </header>

      <div className="kf-divider" style={{ margin: '12px 0 4px' }} />

      <Row icon={<Clapperboard size={15} />} label="Screen:">
        {shot.screen}
      </Row>
      <Row icon={<MousePointerClick size={15} />} label="Action:">
        {shot.action}
      </Row>
      <Row icon={<MessageSquareQuote size={15} />} label="Say:" italic>
        “{shot.narration || '—'}”
      </Row>

      <footer
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginTop: 16,
        }}
      >
        <span
          className="kf-mono"
          style={{
            fontSize: 11,
            color: paceWarn ? 'var(--accent-warning)' : 'var(--text-tertiary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
          title={paceWarn ? `Narration is ${narrationCheck.words - narrationCheck.max} words too long for ${shot.durationSeconds}s at 130 wpm` : 'Narration fits the shot length at 130 wpm'}
        >
          {narrationCheck.words}w / {narrationCheck.max}w max{paceWarn ? ' ⚠' : ''}
        </span>
        <CopyButton
          id={`shot-${shot.shotNumber}`}
          text={formatShot(shot)}
          label="Copy shot"
          copiedLabel="Copied!"
          variant="ghost"
          size="sm"
        />
      </footer>
    </article>
  );
}
