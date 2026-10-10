import { useEffect, useRef, useState } from 'react';

/** Section 5.5 — tracks navigator.onLine, dispatches 'keyframe-back-online'. */
export default function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false
  );
  const wasOffline = useRef(false);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      if (wasOffline.current) {
        window.dispatchEvent(new CustomEvent('keyframe-back-online'));
      }
      wasOffline.current = false;
    };

    const goOffline = () => {
      wasOffline.current = true;
      setIsOnline(false);
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    // Sync once on mount in case the status changed before listeners attached.
    if (navigator.onLine === false) goOffline();

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return { isOnline };
}
