import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';

/**
 * Section 8.7 — listens for 'sw-update-available', offers an immediate reload.
 */
export default function UpdateBanner({ onToast }) {
  const [waiting, setWaiting] = useState(null);
  const [hidden, setHidden] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const onUpdate = (event) => {
      setWaiting(event.detail?.registration || null);
      setHidden(false);
    };
    window.addEventListener('sw-update-available', onUpdate);
    return () => window.removeEventListener('sw-update-available', onUpdate);
  }, []);

  useEffect(() => {
    if (!updating) return undefined;
    const reload = () => window.location.reload();
    let navigated = false;
    const onController = () => {
      navigated = true;
      reload();
    };
    navigator.serviceWorker?.addEventListener('controllerchange', onController);
    // Safety net: reload anyway if the controllerchange never fires.
    const fallback = setTimeout(() => {
      if (!navigated) reload();
    }, 2500);
    return () => {
      navigator.serviceWorker?.removeEventListener('controllerchange', onController);
      clearTimeout(fallback);
    };
  }, [updating]);

  if (!waiting || hidden) return null;

  const updateNow = () => {
    setUpdating(true);
    onToast?.('Updating to the latest version…', 'info');
    const worker = waiting.waiting || waiting.active;
    if (worker) worker.postMessage({ type: 'SKIP_WAITING' });
    else window.location.reload();
  };

  return (
    <div
      role="status"
      className="kf-anim-fade"
      style={{
        position: 'sticky',
        top: 64,
        zIndex: 190,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        background: 'var(--accent-primary)',
        color: '#fff',
        fontFamily: 'var(--font-body)',
        fontSize: 14,
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Sparkles size={16} /> A new version of Keyframe is ready
      </span>
      <button
        type="button"
        className="kf-btn kf-btn--sm"
        style={{ background: '#fff', color: 'var(--accent-primary)' }}
        onClick={updateNow}
        disabled={updating}
      >
        {updating ? 'Updating…' : 'Update Now'}
      </button>
      <button
        type="button"
        className="kf-btn kf-btn--sm kf-btn--ghost"
        style={{ color: '#fff' }}
        onClick={() => setHidden(true)}
      >
        Later
      </button>
    </div>
  );
}
