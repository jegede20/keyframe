import { AlertTriangle, Pencil, RefreshCw, Settings } from 'lucide-react';

/**
 * Section 8.7 — error surface for all failure types.
 * Actions map to the `action` field from errorClassifier.normalizeError().
 */
export default function ErrorBox({ error, onRetry, onEditInputs, onOpenSettings, onDismiss }) {
  if (!error) return null;

  const { title = 'Something went wrong', userMsg = '', suggestion = null, action = 'RETRY' } = error;

  const actions = [];
  if (action === 'RETRY' || action === 'RETRY_ONLINE') {
    actions.push(
      <button key="retry" type="button" className="kf-btn kf-btn--primary kf-btn--sm" onClick={onRetry}>
        <RefreshCw size={15} /> Try Again
      </button>
    );
  }
  if (action === 'OPEN_SETTINGS') {
    actions.push(
      <button key="settings" type="button" className="kf-btn kf-btn--primary kf-btn--sm" onClick={onOpenSettings}>
        <Settings size={15} /> Open Settings
      </button>
    );
    actions.push(
      <button key="retry2" type="button" className="kf-btn kf-btn--ghost kf-btn--sm" onClick={onRetry}>
        <RefreshCw size={15} /> Try Again
      </button>
    );
  }
  if (action === 'EDIT_INPUTS' || action === 'RETRY' || action === 'RETRY_ONLINE') {
    actions.push(
      <button key="edit" type="button" className="kf-btn kf-btn--secondary kf-btn--sm" onClick={onEditInputs}>
        <Pencil size={15} /> Edit Inputs
      </button>
    );
  }

  return (
    <div
      role="alert"
      className="kf-anim-fade"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderLeft: '3px solid var(--accent-danger)',
        borderRadius: 'var(--radius-md)',
        padding: '18px 20px',
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 1 }}>
        <AlertTriangle size={20} color="var(--accent-warning)" aria-hidden="true" />
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 16,
            marginBottom: 4,
            color: 'var(--text-primary)',
          }}
        >
          {title}
        </h3>
        <p className="kf-small" style={{ color: 'var(--text-secondary)', marginBottom: suggestion ? 6 : 14 }}>
          {userMsg}
        </p>
        {suggestion && (
          <p className="kf-caption" style={{ color: 'var(--text-tertiary)', marginBottom: 14 }}>
            {suggestion}
          </p>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {actions}
          {onDismiss && (
            <button type="button" className="kf-btn kf-btn--ghost kf-btn--sm" onClick={onDismiss}>
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
