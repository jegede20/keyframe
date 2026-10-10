import { useCallback, useEffect, useState } from 'react';
import {
  HISTORY_MAX,
  KF_KEYS,
  clearAllScripts,
  deleteScript,
  getAllScripts,
  getScript,
  pruneOldScripts,
  readHistoryIndex,
  saveScript,
  writeJSON,
} from '../store/storage.js';
import { downloadJSON } from '../utils/exportHistory.js';

/** Builds the lightweight index entry from a full record — Section 5.2. */
function toIndexEntry(record) {
  const meta = record.output?.meta || {};
  return {
    id: record.id,
    url: record.input?.url || '',
    appName: meta.appName || 'Untitled app',
    features: (record.input?.features || '').slice(0, 100),
    totalSeconds: meta.totalSeconds || 0,
    shotCount: meta.shotCount ?? (record.output?.script?.length || 0),
    wordCount: meta.estimatedWordCount || 0,
    tone: record.input?.tone || meta.tone || 'professional',
    videoTool: record.input?.videoTool || 'any',
    createdAt: record.createdAt,
  };
}

/** Section 5.5 — history index in localStorage, full records in IndexedDB. */
export default function useHistory() {
  const [historyIndex, setHistoryIndex] = useState(() => readHistoryIndex());

  // Keep in-memory index in sync if another tab writes it.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === KF_KEYS.historyIndex) setHistoryIndex(readHistoryIndex());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const persistIndex = useCallback((entries) => {
    const trimmed = entries.slice(0, HISTORY_MAX);
    setHistoryIndex(trimmed);
    writeJSON(KF_KEYS.historyIndex, trimmed);
    return trimmed;
  }, []);

  /**
   * addToHistory(input, output, generation)
   * Saves the full record to IndexedDB, prepends the index entry, prunes >50.
   */
  const addToHistory = useCallback(
    async (record) => {
      if (!record || !record.id) return null;

      try {
        await saveScript(record);
      } catch (err) {
        console.warn('[Keyframe] Could not save script to IndexedDB:', err);
      }

      const entry = toIndexEntry(record);
      const next = [entry, ...readHistoryIndex().filter((e) => e.id !== record.id)];
      persistIndex(next);

      try {
        await pruneOldScripts(HISTORY_MAX);
      } catch (err) {
        /* pruning is best-effort */
      }
      return entry;
    },
    [persistIndex]
  );

  const loadScript = useCallback(async (id) => {
    const record = await getScript(id);
    if (!record) throw new Error('That script is no longer in your history.');
    return record;
  }, []);

  const deleteHistoryItem = useCallback(
    async (id) => {
      try {
        await deleteScript(id);
      } catch (err) {
        console.warn('[Keyframe] deleteScript failed:', err);
      }
      persistIndex(readHistoryIndex().filter((entry) => entry.id !== id));
      return true;
    },
    [persistIndex]
  );

  const clearHistory = useCallback(async () => {
    try {
      await clearAllScripts();
    } catch (err) {
      console.warn('[Keyframe] clearAllScripts failed:', err);
    }
    persistIndex([]);
    return true;
  }, [persistIndex]);

  /** exportHistory() — downloads keyframe-history-YYYY-MM-DD.json */
  const exportHistory = useCallback(async () => {
    const records = await getAllScripts();
    const payload = {
      app: 'Keyframe',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      count: records.length,
      scripts: records,
    };
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJSON(`keyframe-history-${stamp}.json`, payload);
    return records.length;
  }, []);

  return {
    historyIndex,
    addToHistory,
    loadScript,
    deleteHistoryItem,
    clearHistory,
    exportHistory,
    reloadIndex: () => setHistoryIndex(readHistoryIndex()),
  };
}
