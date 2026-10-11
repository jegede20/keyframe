import { useState } from 'react';
import { Download, Share, X } from 'lucide-react';

/**
 * Section 8.7 — install banner (Chrome/Android) + manual iOS instructions.
 */
export default function InstallPrompt({ isIOSManual, onInstall, onDismiss, onToast }) {
  const [busy, setBusy] = useState(false);

  const install = async () => {
    setBusy(true);
    const result = await onInstall?.();
    setBusy(false);
    if (result === 'accepted') onToast?.('Keyframe installed — find it on your home screen.', 'success');
    if (result === 'dismissed') onDismiss?.();
  };

  return (
    <div
      role="region"
      aria-label="Install Keyframe"
      className="kf-anim-fade kf-install-banner"
      style={{
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderLeft: '3px solid var(--accent-primary)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--card-shadow)',
        flexWrap: 'wrap',
      }}
    >
      <span aria-hidden="true" style={{ color: 'var(--accent-primary)', display: 'inline-flex' }}>
        <Download size={18} />
      </span>

      <div style={{ flex: 1, minWidth: 200 }}>
        <p className="kf-small" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
          Install Keyframe as an app — works offline, always one tap away.
        </p>
        {isIOSManual && (
          <p className="kf-caption" style={{ color: 'var(--text-secondary)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Share size={14} aria-hidden="true" style={{ color: 'var(--accent-primary)' }} />
            Tap Share in Safari, then “Add to Home Screen”.
          </p>
        )}
      </div>

      {!isIOSManual && (
        <button type="button" className="kf-btn kf-btn--primary kf-btn--sm" onClick={install} disabled={busy}>
          {busy ? 'Installing…' : 'Install'}
        </button>
      )}
      <button type="button" className="kf-btn kf-btn--ghost kf-btn--sm" onClick={onDismiss}>
        Not now
      </button>
      <button
        type="button"
        className="kf-icon-btn kf-icon-btn--sm"
        onClick={onDismiss}
        aria-label="Dismiss install banner"
      >
        <X size={15} />
      </button>
    </div>
  );
}
