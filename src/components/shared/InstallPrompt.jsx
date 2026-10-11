import { useState } from 'react';
import { Download, Share, X } from 'lucide-react';

/**
 * Section 8.7 — install banner (Chrome/Android) + manual iOS instructions.
 *
 * Deliberately compact: it floats over the page, so every pixel it takes is a
 * pixel of content hidden. Icon · two short lines · Install · dismiss, all in
 * one row at phone widths (~64px tall instead of ~137px).
 */
export default function InstallPrompt({ isIOSManual, onInstall, onDismiss, onToast, raised = false }) {
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
      className={`kf-anim-fade kf-install-banner${raised ? ' kf-install-banner--raised' : ''}`}
      style={{
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderLeft: '3px solid var(--accent-primary)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      <span aria-hidden="true" className="kf-install-banner__icon">
        <Download size={17} />
      </span>

      <div className="kf-install-banner__text">
        <p className="kf-install-banner__title">Install Keyframe</p>
        <p className="kf-install-banner__sub">
          {isIOSManual ? (
            <>
              <Share size={12} aria-hidden="true" className="kf-install-banner__share" />
              Tap Share, then “Add to Home Screen”.
            </>
          ) : (
            'Works offline · one tap away'
          )}
        </p>
      </div>

      {!isIOSManual && (
        <button
          type="button"
          className="kf-btn kf-btn--primary kf-btn--sm kf-install-banner__cta"
          onClick={install}
          disabled={busy}
        >
          {busy ? 'Installing…' : 'Install'}
        </button>
      )}
      <button
        type="button"
        className="kf-btn kf-btn--ghost kf-btn--sm kf-install-banner__later"
        onClick={onDismiss}
      >
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

      <style>{`
        .kf-install-banner__icon {
          color: var(--accent-primary);
          display: inline-flex;
          flex-shrink: 0;
        }
        .kf-install-banner__text {
          flex: 1;
          min-width: 0;
        }
        .kf-install-banner__title {
          font-family: var(--font-body);
          font-weight: 600;
          font-size: 13.5px;
          line-height: 1.3;
          color: var(--text-primary);
        }
        .kf-install-banner__sub {
          font-family: var(--font-body);
          font-size: 12px;
          line-height: 1.35;
          color: var(--text-secondary);
          margin-top: 1px;
        }
        .kf-install-banner__share {
          color: var(--accent-primary);
          vertical-align: -2px;
          margin-right: 4px;
        }
        /* Phones: the X is the dismissal. "Not now" would add a second row. */
        @media (max-width: 767px) {
          .kf-install-banner { gap: 8px; }
          .kf-install-banner__later { display: none; }
          .kf-install-banner__cta { padding: 0 12px; }
        }
      `}</style>
    </div>
  );
}
