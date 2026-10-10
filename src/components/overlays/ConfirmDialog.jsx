import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Section 8.7 — reusable confirm modal.
 * Props: title, message, confirmLabel, cancelLabel, confirmVariant, onConfirm, onCancel, busy.
 */
export default function ConfirmDialog({
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
  busy = false,
}) {
  const confirmRef = useRef(null);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCancel?.();
      }
      if (event.key === 'Enter' && !busy) {
        event.preventDefault();
        onConfirm?.();
      }
    };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => confirmRef.current?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [onCancel, onConfirm, busy]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel?.();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        className="kf-anim-modal"
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
          <AlertTriangle size={20} color="var(--accent-warning)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 18,
                color: 'var(--text-primary)',
                marginBottom: 6,
              }}
            >
              {title}
            </h2>
            {message && (
              <p className="kf-small" style={{ color: 'var(--text-secondary)' }}>
                {message}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" className="kf-btn kf-btn--secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`kf-btn kf-btn--${confirmVariant === 'danger' ? 'danger' : 'primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
