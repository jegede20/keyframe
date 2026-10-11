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
 *
 * Layout note: the meta used to be one non-wrapping inline-flex line of six
 * separate nodes, so on a 390px phone the row overflowed the card — "3" and
 * "features" wrapped independently and the Edit/Redo controls were pushed
 * clean off screen. Each meta item is now its own nowrap chip, the URL is the
 * only element that shrinks (with an ellipsis), and the meta drops to its own
 * row on narrow screens.
 */
export default function InputSummary({ input, onEdit, onRedo, busy = false }) {
  const host = (() => {
    try {
      return new URL(input.url).hostname.replace(/^www\./, '');
    } catch (err) {
      return input.url;
    }
  })();

  const chips = [`${featureCount(input.features)} features`, `${input.length}s`, TONE_LABELS[input.tone] || input.tone];

  return (
    <div className="kf-card kf-summary kf-anim-collapse">
      <div className="kf-summary__main">
        <Link2 size={14} aria-hidden="true" className="kf-summary__icon" />
        <span className="kf-mono kf-summary__host kf-truncate" title={input.url}>
          {host}
        </span>
      </div>

      <div className="kf-summary__meta kf-mono">
        {chips.map((chip, index) => (
          <span key={chip} className="kf-summary__chip">
            {index > 0 && (
              <span aria-hidden="true" className="kf-summary__dot">
                ·
              </span>
            )}
            <span className="kf-nowrap">{chip}</span>
          </span>
        ))}
      </div>

      <div className="kf-summary__actions">
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
