/* ═══════════════════════════════════════════════════════════════════════════
   STORAGE — Section 5
   localStorage: settings, inputs, history index (small, sync)
   IndexedDB:    full script records (large, async) — custom adapter, no library
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── localStorage keys ─────────────────────────────────────────────────── */
export const KF_KEYS = {
  settings: 'kf_settings',
  groqKey: 'kf_groq_key',
  lastInputs: 'kf_last_inputs',
  historyIndex: 'kf_history_index',
  theme: 'kf_theme',
  installDismissed: 'kf_install_dismissed',
  onboardingDone: 'kf_onboarding_done',
};

export const HISTORY_MAX = 50;

/* ── Defaults — Section 5.2 ────────────────────────────────────────────── */
export const DEFAULT_SETTINGS = {
  theme: 'system', // 'system' | 'dark' | 'light'
  defaultLength: 90, // 30 | 60 | 90 | 120
  defaultTone: 'professional', // 'professional' | 'casual' | 'energetic' | 'technical'
  defaultVideoTool: 'any', // 'any'|'runway'|'pika'|'heygen'|'synthesia'|'capcut'
  reducedMotion: false,
  lastUpdated: null,
};

export const DEFAULT_LAST_INPUTS = {
  url: '',
  features: '',
  length: 90,
  tone: 'professional',
  videoTool: 'any',
  savedAt: null,
};

/* ═══════════════════════════════════════════════════════════════════════════
   localStorage helpers (all reads/writes wrapped in try/catch)
   ═══════════════════════════════════════════════════════════════════════════ */

export function readLS(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    return raw;
  } catch (err) {
    console.warn(`[Keyframe] localStorage read failed for "${key}"`, err);
    return fallback;
  }
}

export function readJSON(key, fallback = null) {
  const raw = readLS(key, null);
  if (raw === null) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || parsed === undefined) return fallback;
    return parsed;
  } catch (err) {
    console.warn(`[Keyframe] Corrupt JSON in "${key}" — using fallback.`, err);
    return fallback;
  }
}

export function writeLS(key, value) {
  try {
    window.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`[Keyframe] localStorage write failed for "${key}"`, err);
    return false;
  }
}

export function writeJSON(key, value) {
  return writeLS(key, JSON.stringify(value));
}

export function removeLS(key) {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (err) {
    console.warn(`[Keyframe] localStorage remove failed for "${key}"`, err);
    return false;
  }
}

/** Removes every kf_* key. Used by "Clear All Data". */
export function clearAllLocalStorage() {
  try {
    const keys = Object.keys(window.localStorage).filter((k) => k.startsWith('kf_'));
    keys.forEach((k) => window.localStorage.removeItem(k));
    return keys.length;
  } catch (err) {
    console.warn('[Keyframe] Failed to clear localStorage', err);
    return 0;
  }
}

/* ── Typed convenience readers ─────────────────────────────────────────── */

export function readSettings() {
  const stored = readJSON(KF_KEYS.settings, {});
  return { ...DEFAULT_SETTINGS, ...(stored && typeof stored === 'object' ? stored : {}) };
}

export function readLastInputs() {
  const stored = readJSON(KF_KEYS.lastInputs, {});
  return { ...DEFAULT_LAST_INPUTS, ...(stored && typeof stored === 'object' ? stored : {}) };
}

export function readHistoryIndex() {
  const stored = readJSON(KF_KEYS.historyIndex, []);
  return Array.isArray(stored) ? stored : [];
}

export function readGroqKey() {
  const key = readLS(KF_KEYS.groqKey, '');
  return typeof key === 'string' ? key.trim() : '';
}

/* ═══════════════════════════════════════════════════════════════════════════
   IndexedDB adapter — Section 5.4
   DB: 'keyframe-db' v1 · store: 'scripts' · index: createdAt, url
   ═══════════════════════════════════════════════════════════════════════════ */

export const DB_NAME = 'keyframe-db';
export const DB_VERSION = 1;
export const STORE = 'scripts';

let dbPromise = null;
/* In-memory fallback keeps the app functional where IndexedDB is blocked
   (some private-browsing modes). Data is lost on reload but nothing crashes. */
let memoryStore = new Map();

function hasIDB() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch (err) {
    return false;
  }
}

export function openDB() {
  if (!hasIDB()) {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(err);
      return;
    }

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('url', 'input.url', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      db.onversionchange = () => {
        try {
          db.close();
        } catch (err) {
          /* noop */
        }
      };
      resolve(db);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error('Failed to open IndexedDB'));
    };

    request.onblocked = () => {
      console.warn('[Keyframe] IndexedDB upgrade blocked by another tab.');
    };
  });

  return dbPromise;
}

async function withStore(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(STORE, mode);
    } catch (err) {
      reject(err);
      return;
    }
    const store = tx.objectStore(STORE);
    let result;
    try {
      result = fn(store);
    } catch (err) {
      reject(err);
      return;
    }
    tx.oncomplete = () => resolve(result && result.__value !== undefined ? result.__value : result);
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** saveScript(record) — adds a full script record. */
export async function saveScript(record) {
  if (!record || !record.id) throw new Error('saveScript requires a record with an id');
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return true;
  } catch (err) {
    console.warn('[Keyframe] saveScript fell back to memory store:', err);
    memoryStore.set(record.id, record);
    return true;
  }
}

/** getScript(id) — single record. */
export async function getScript(id) {
  try {
    const db = await openDB();
    // IndexedDB resolves a miss with `undefined`; the fallback path below
    // answers with `null`. Normalise so callers can test one value.
    const record = await withStore('readonly', (store) => requestToPromise(store.get(id)));
    return record === undefined ? null : record;
  } catch (err) {
    return memoryStore.get(id) || null;
  }
}

/** getAllScripts() — every record, newest first (for export + pruning checks). */
export async function getAllScripts() {
  try {
    const db = await openDB();
    const all = await withStore('readonly', (store) => requestToPromise(store.getAll()));
    return (all || []).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (err) {
    return [...memoryStore.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
}

/** deleteScript(id) — removes one record. */
export async function deleteScript(id) {
  try {
    const db = await openDB();
    await withStore('readwrite', (store) => {
      store.delete(id);
      return { __value: true };
    });
    return true;
  } catch (err) {
    memoryStore.delete(id);
    return true;
  }
}

/** clearAllScripts() — wipes the store. */
export async function clearAllScripts() {
  memoryStore = new Map();
  try {
    const db = await openDB();
    await withStore('readwrite', (store) => {
      store.clear();
      return { __value: true };
    });
    return true;
  } catch (err) {
    return true;
  }
}

export async function countScripts() {
  try {
    const db = await openDB();
    const n = await withStore('readonly', (store) => requestToPromise(store.count()));
    return typeof n === 'number' ? n : 0;
  } catch (err) {
    return memoryStore.size;
  }
}

/**
 * pruneOldScripts(max = 50) — walk the 'createdAt' index oldest-first and delete
 * everything past the newest `max` records.
 */
export async function pruneOldScripts(max = HISTORY_MAX) {
  try {
    const db = await openDB();
    const total = await withStore('readonly', (store) => requestToPromise(store.count()));
    if (typeof total !== 'number' || total <= max) return 0;

    const excess = total - max;

    /*
     * Two passes on purpose. Deleting the record a cursor is currently sitting
     * on and then calling continue() makes the cursor skip its next record —
     * verified in the browser: five deletions landed on the wrong rows and the
     * single oldest script survived. So collect the doomed keys first (key
     * cursors, read-only), then delete them in a second transaction.
     */
    const doomedKeys = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const index = tx.objectStore(STORE).index('createdAt');
      const keys = [];
      const req = index.openKeyCursor(null, 'next'); // ascending = oldest first
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor || keys.length >= excess) return;
        keys.push(cursor.primaryKey);
        cursor.continue();
      };
      tx.oncomplete = () => resolve(keys);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });

    if (!doomedKeys.length) return 0;

    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      doomedKeys.forEach((key) => store.delete(key));
      tx.oncomplete = () => resolve(doomedKeys.length);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[Keyframe] pruneOldScripts failed:', err);
    return 0;
  }
}
