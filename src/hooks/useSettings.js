import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  KF_KEYS,
  readSettings,
  writeJSON,
  removeLS,
  writeLS,
} from '../store/storage.js';

function resolveTheme(themeSetting) {
  if (themeSetting === 'light') return 'light';
  if (themeSetting === 'dark') return 'dark';
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch (err) {
    return 'dark';
  }
}

function applyTheme(themeSetting) {
  const resolved = resolveTheme(themeSetting);
  document.documentElement.setAttribute('data-theme', resolved);
  writeLS(KF_KEYS.theme, resolved); // fast-access mirror
  return resolved;
}

/** Section 5.5 — settings persisted to localStorage, theme applied to <html>. */
export default function useSettings() {
  const [settings, setSettings] = useState(() => readSettings());
  const [resolvedTheme, setResolvedTheme] = useState(() =>
    document.documentElement.getAttribute('data-theme') || 'dark'
  );

  // Persist + apply on every change.
  useEffect(() => {
    writeJSON(KF_KEYS.settings, settings);
    setResolvedTheme(applyTheme(settings.theme));
  }, [settings]);

  // Follow the OS when theme === 'system'.
  useEffect(() => {
    if (settings.theme !== 'system') return undefined;
    let mql;
    try {
      mql = window.matchMedia('(prefers-color-scheme: dark)');
    } catch (err) {
      return undefined;
    }
    const onChange = () => setResolvedTheme(applyTheme('system'));
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else if (mql.addListener) mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else if (mql.removeListener) mql.removeListener(onChange);
    };
  }, [settings.theme]);

  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
      lastUpdated: new Date().toISOString(),
    }));
  }, []);

  const updateSettings = useCallback((patch) => {
    setSettings((prev) => ({
      ...prev,
      ...patch,
      lastUpdated: new Date().toISOString(),
    }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS, lastUpdated: new Date().toISOString() });
  }, []);

  const hardReset = useCallback(() => {
    removeLS(KF_KEYS.settings);
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  return {
    settings,
    resolvedTheme,
    updateSetting,
    updateSettings,
    resetSettings,
    hardReset,
  };
}
