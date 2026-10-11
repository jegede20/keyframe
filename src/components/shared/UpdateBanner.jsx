import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

/**
 * Section 8.7 — listens for 'sw-update-available', offers an immediate reload.
 *
 * Shaped as a small dropdown anchored under the header (fixed, right-aligned
 * on desktop, full-width-with-margins on phones) rather than a sticky
 * full-bleed bar: an update notice is not part of the page, so it must not sit
 * in the landing page's flow, push the hero down, or be mistaken for content.
 * Escape and “Later” both dismiss it for this session.
 */
export default function UpdateBanner({ onToast }) {
  const [waiting, setWaiting] = useState(null);
  const [hidden, setHidden] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const onUpdate = (event) => {
      // The event itself is the signal; the registration is only needed to
      // message the waiting worker, so an event without one still shows the
      // dropdown (and Update Now falls back to a plain reload).
      setWaiting(event.detail?.registration ?? {});
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

  const visible = Boolean(waiting) && !hidden;

  useEffect(() => {
    if (!visible) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setHidden(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible]);

  if (!visible) return null;

  const updateNow = () => {
    setUpdating(true);
    onToast?.('Updating to the latest version…', 'info');
    const worker = waiting.waiting || waiting.active;
    if (worker) worker.postMessage({ type: 'SKIP_WAITING' });
    else window.location.reload();
  };

  return (
    <div
      role="region"
      aria-label="App update available"
      className="kf-update-pop kf-anim-drop"
    >
      <span aria-hidden="true" className="kf-update-pop__icon">
        <Sparkles size={16} />
      </span>

      <div className="kf-update-pop__text">
        <p className="kf-update-pop__title">Update available</p>
        <p className="kf-update-pop__body">A new version of Keyframe is ready.</p>
      </div>

      <div className="kf-update-pop__actions">
        <button
          type="button"
          className="kf-btn kf-btn--primary kf-btn--sm"
          onClick={updateNow}
          disabled={updating}
        >
          {updating ? 'Updating…' : 'Update Now'}
        </button>
        <button
          type="button"
          className="kf-btn kf-btn--ghost kf-btn--sm"
          onClick={() => setHidden(true)}
        >
          Later
        </button>
      </div>
    </div>
  );
}
