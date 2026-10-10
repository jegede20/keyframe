import { Ban, Plus } from 'lucide-react';

/** Section 8.5 — one excluded screen, with the "add back" action. */
export default function CutCard({ item, onAddToScript, busy = false }) {
  return (
    <article
      className="kf-card kf-hover-lift"
      style={{ padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}
    >
      <span aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
        <Ban size={18} color="var(--accent-warning)" />
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 16,
            color: 'var(--text-primary)',
            marginBottom: 4,
          }}
        >
          {item.screenName}
        </h2>
        <p className="kf-small" style={{ color: 'var(--text-secondary)' }}>
          <span className="kf-caption" style={{ color: 'var(--text-tertiary)', marginRight: 6 }}>
            Reason:
          </span>
          {item.reason}
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button
            type="button"
            className="kf-btn kf-btn--ghost kf-btn--sm"
            style={{ color: 'var(--accent-text)' }}
            onClick={() => onAddToScript?.(item.screenName)}
            disabled={busy}
          >
            <Plus size={14} /> {busy ? 'Regenerating…' : 'Add to Script'}
          </button>
        </div>
      </div>
    </article>
  );
}
