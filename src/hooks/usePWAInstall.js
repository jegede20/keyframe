import { useCallback, useEffect, useState } from 'react';
import { KF_KEYS, readLS, writeLS } from '../store/storage.js';

function detectIOSManual() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIOSDevice =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  return isIOSDevice && isSafari && !standalone;
}

/** Section 5.5 — install prompt capture, iOS manual path, dismissal memory. */
export default function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(() => {
    try {
      return (
        window.matchMedia?.('(display-mode: standalone)').matches ||
        window.navigator.standalone === true
      );
    } catch (err) {
      return false;
    }
  });
  const [isDismissed, setIsDismissed] = useState(
    () => readLS(KF_KEYS.installDismissed, 'false') === 'true'
  );

  useEffect(() => {
    const onBeforeInstall = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    // iOS Safari never fires beforeinstallprompt — expose the manual path.
    if (detectIOSManual()) {
      setInstallPrompt({ type: 'ios-manual' });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installPrompt || installPrompt.type === 'ios-manual') return 'manual';
    try {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        setIsInstalled(true);
        setInstallPrompt(null);
        return 'accepted';
      }
      return choice?.outcome || 'dismissed';
    } catch (err) {
      console.warn('[Keyframe] Install prompt failed:', err);
      return 'error';
    }
  }, [installPrompt]);

  const dismissInstall = useCallback(() => {
    writeLS(KF_KEYS.installDismissed, 'true');
    setIsDismissed(true);
  }, []);

  const isIOSManual = installPrompt?.type === 'ios-manual';
  const shouldShowInstall = !isInstalled && !isDismissed && installPrompt !== null;

  return {
    shouldShowInstall,
    isInstalled,
    isIOSManual,
    promptInstall,
    dismissInstall,
  };
}
