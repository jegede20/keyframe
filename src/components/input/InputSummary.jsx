import { Link2, Pencil, RotateCw } from 'lucide-react';

function featureCount(features) {
  return String(features || '')
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

const TONE_LABELS = {
  professional: 'Professional',
  casual: 'Casual',
  energetic: 'Energetic',
  technical: 'Technical',
};

/**
 * Section 8.3 — slim bar that replaces InputCard while results are visible.
 * 🔗 url · N features · Ns · Tone   [✏️ Edit] [🔄 Redo]
 */
export default function InputSummary({ input, onEdit, onRedo, busy = false }) {
  const host = (() => {
    try {
      return new URL(input.url).hostname.replace(/^www\./, '');
    } catch (err) {
      return input.url;
    }
  })();

  return (
    <div
      className="kf-card kf-anim-collapse"
      style={{
        maxWidth: 820,
        margin: '0 auto',
        padding: '0 16px',
        minHeight: 48,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <span
        className="kf-mono"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--text-secondary)',
          fontSize: 12,
          minWidth: 0,
          flex: 1,
          padding: '12px 0',
        }}
      >
        <Link2 size={14} aria-hidden="true" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        <span className="kf-truncate" style={{ maxWidth: 260 }} title={input.url}>
          {host}
        </span>
        <span aria-hidden="true" style={{ color: 'var(--text-tertiary)' }}>·</span>
        {featureCount(input.features)} features
        <span aria-hidden="true" style={{ color: 'var(--text-tertiary)' }}>·</span>
        {input.length}s
        <span aria-hidden="true" style={{ color: 'var(--text-tertiary)' }}>·</span>
        {TONE_LABELS[input.tone] || input.tone}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 0' }}>
        <button
          type="button"
          className="kf-btn kf-btn--ghost kf-btn--sm"
          onClick={onEdit}
          disabled={busy}
          aria-label="Edit inputs"
          title="Edit inputs"
        >
          <Pencil size={14} /> <span className="copy-label">Edit</span>
        </button>
        <button
          type="button"
          className="kf-icon-btn kf-icon-btn--sm"
          onClick={onRedo}
          disabled={busy}
          title="Regenerate with the same inputs"
          aria-label="Regenerate with the same inputs"
        >
          <RotateCw size={15} />
        </button>
      </div>
    </div>
  );
}
