import { CheckCircle2, Circle, Loader2, X } from 'lucide-react';

export const STEP_LABELS = [
  'Reading app URL',
  'Identifying screens & flows',
  'Writing demo script',
  'Building cut list',
  'Creating video prompt',
];

/**
 * Section 8.4 — 5-step progress list with a filling timeline.
 * `activeStep` is 0-based; steps before it are complete.
 */
export default function LoadingStepper({ activeStep = 0, onCancel, note = null }) {
  const total = STEP_LABELS.length;
  const safeStep = Math.max(0, Math.min(total, activeStep));
  const progress = total > 1 ? Math.min(1, safeStep / (total - 1)) : 0;

  return (
    <section
      aria-label="Generating your script"
      aria-live="polite"
      className="kf-card kf-anim-expand"
      style={{
        width: '100%',
        maxWidth: 820,
        margin: '0 auto',
        padding: '28px 32px 24px',
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 20,
          color: 'var(--text-primary)',
          marginBottom: 4,
        }}
      >
        Rolling camera…
      </h2>
      <p className="kf-small" style={{ color: 'var(--text-secondary)', marginBottom: 22 }}>
        {note || 'Keyframe is reading your app and writing the shot list. This takes about 10–30 seconds.'}
      </p>

      <ol style={{ position: 'relative', paddingLeft: 4 }}>
        {/* vertical rail */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 15,
            top: 14,
            bottom: 14,
            width: 2,
            background: 'var(--border-subtle)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              display: 'block',
              width: '100%',
              height: `${progress * 100}%`,
              background: 'var(--accent-secondary)',
              transition: 'height 200ms ease',
            }}
          />
        </span>

        {STEP_LABELS.map((label, index) => {
          const done = index < safeStep;
          const active = index === safeStep;
          return (
            <li
              key={label}
              className={active ? 'kf-anim-step' : ''}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                minHeight: 44,
                position: 'relative',
                zIndex: 1,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 24,
                  height: 24,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--bg-surface)',
                  borderRadius: '50%',
                  flexShrink: 0,
                }}
              >
                {done && <CheckCircle2 size={20} color="var(--accent-secondary)" />}
                {active && <Loader2 size={20} color="var(--accent-primary)" className="kf-anim-spin" />}
                {!done && !active && <Circle size={18} color="var(--text-tertiary)" />}
              </span>
              <span
                className="kf-small"
                style={{
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: active ? 500 : 400,
                  transition: 'color 200ms ease',
                }}
              >
                {label}
              </span>
              {done && <span className="sr-only">complete</span>}
            </li>
          );
        })}
      </ol>

      {onCancel && (
        <button
          type="button"
          className="kf-btn kf-btn--ghost kf-btn--sm"
          onClick={onCancel}
          style={{ marginTop: 18 }}
        >
          <X size={15} /> Cancel
        </button>
      )}
    </section>
  );
}
