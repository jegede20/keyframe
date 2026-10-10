import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

const ACCENTS = {
  success: 'var(--accent-secondary)',
  error: 'var(--accent-danger)',
  info: 'var(--accent-primary)',
};

/** Section 8.7 — one toast. `leaving` drives the slide-out animation. */
export default function Toast({ toast, onDismiss, leaving = false }) {
  const Icon = ICONS[toast.type] || Info;

  return (
    <div
      role="status"
      aria-live="polite"
      className={leaving ? 'kf-anim-toast-out' : 'kf-anim-toast-in'}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        minWidth: 260,
        maxWidth: 360,
        padding: '12px 14px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderLeft: `3px solid ${ACCENTS[toast.type] || ACCENTS.info}`,
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--toast-shadow)',
        pointerEvents: 'auto',
      }}
    >
      <Icon size={17} color={ACCENTS[toast.type] || ACCENTS.info} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
      <p className="kf-small" style={{ flex: 1, color: 'var(--text-primary)', margin: 0 }}>
        {toast.message}
      </p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="kf-icon-btn kf-icon-btn--sm"
        style={{ margin: -6, flexShrink: 0 }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
