import { Copy, Loader, Plus, RotateCcw, Sparkles, X } from 'lucide-react';
import { STATES } from '../../hooks/useAppState.js';

/**
 * Section 8.1 + 9 — mobile-only sticky action bar.
 * empty   → Generate
 * loading → Cancel
 * results → Copy All + New Script
 * error   → Try Again + Edit Inputs
 */
export default function BottomBar({
  state,
  onGenerate,
  onCancel,
  onCopyAll,
  onNewScript,
  onRetry,
  onEditInputs,
  canGenerate = false,
  copied = false,
}) {
  const buttons = [];

  if (state === STATES.LOADING) {
    buttons.push(
      <button key="cancel" type="button" className="kf-btn kf-btn--secondary" onClick={onCancel} style={{ flex: 1 }}>
        <X size={17} /> Cancel
      </button>
    );
  } else if (state === STATES.RESULTS) {
    buttons.push(
      <button key="copy" type="button" className="kf-btn kf-btn--primary" onClick={onCopyAll} style={{ flex: 1 }}>
        <Copy size={17} /> {copied ? 'Copied! ✓' : 'Copy All'}
      </button>,
      <button key="new" type="button" className="kf-btn kf-btn--secondary" onClick={onNewScript} style={{ flex: 1 }}>
        <Plus size={17} /> New Script
      </button>
    );
  } else if (state === STATES.ERROR) {
    buttons.push(
      <button key="retry" type="button" className="kf-btn kf-btn--primary" onClick={onRetry} style={{ flex: 1 }}>
        <RotateCcw size={17} /> Try Again
      </button>,
      <button key="edit" type="button" className="kf-btn kf-btn--secondary" onClick={onEditInputs} style={{ flex: 1 }}>
        Edit Inputs
      </button>
    );
  } else {
    buttons.push(
      <button
        key="generate"
        type="button"
        className={`kf-btn kf-btn--primary ${canGenerate ? 'kf-anim-glow' : ''}`}
        style={{ flex: 1 }}
        onClick={onGenerate}
        disabled={!canGenerate}
      >
        {state === STATES.EMPTY ? <Sparkles size={17} /> : <Loader size={17} />} Generate Script
      </button>
    );
  }

  return (
    <nav
      className="kf-bottombar"
      aria-label="Quick actions"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 210,
        minHeight: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px',
        paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
        background: 'var(--bg-primary)',
        borderTop: '1px solid var(--border-subtle)',
      }}
    >
      {buttons}
      {/* The desktop build uses the in-page action bars instead. */}
      <style>{`
        .kf-bottombar { display: flex; }
        @media (min-width: 768px) { .kf-bottombar { display: none !important; } }
      `}</style>
    </nav>
  );
}
