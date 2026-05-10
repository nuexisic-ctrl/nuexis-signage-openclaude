import fpPromise from '@fingerprintjs/fingerprintjs';

const IDB_DB_NAME = 'nuexis_device_store';
const IDB_STORE_NAME = 'identity';
const IDB_KEY = 'device_id';
const LS_KEY = 'nuexis_hardware_id';

// ─── IndexedDB helpers ──────────────────────────────────────────────────────

function openIDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(IDB_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function idbSet(db: IDBDatabase, key: string, value: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns a stable, persistent device identifier using a 3-tier strategy:
 *
 * 1. **IndexedDB** (primary) — survives "Clear Cache" in most browsers.
 * 2. **localStorage** (secondary) — fallback for edge-case browsers.
 * 3. **FingerprintJS** (last resort) — generates a new visitorId if both
 *    storage mechanisms are empty (truly first visit or full wipe).
 *
 * Once resolved, the ID is written back to all available storage tiers
 * so future loads resolve instantly without hitting the fingerprint library.
 */
export async function getHardwareId(): Promise<string> {
  // ── Tier 1: IndexedDB ──────────────────────────────────────────────────
  const db = await openIDB();
  if (db) {
    const idbId = await idbGet(db, IDB_KEY);
    if (idbId) {
      // Also ensure localStorage is in sync
      try { localStorage.setItem(LS_KEY, idbId); } catch { /* noop */ }
      return idbId;
    }
  }

  // ── Tier 2: localStorage ───────────────────────────────────────────────
  if (typeof window !== 'undefined') {
    const lsId = localStorage.getItem(LS_KEY);
    if (lsId) {
      // Write back to IndexedDB for durability
      if (db) await idbSet(db, IDB_KEY, lsId);
      return lsId;
    }
  }

  // ── Tier 3: Generate new UUID, use fingerprint as entropy seed ─────────
  let deviceId: string;
  try {
    const fp = await fpPromise.load();
    const result = await fp.get();
    // Prefix with a random UUID portion to guarantee uniqueness even on
    // identical hardware, but append the fingerprint for traceability.
    deviceId = `${crypto.randomUUID()}-fp-${result.visitorId.slice(0, 8)}`;
  } catch {
    // If FingerprintJS fails entirely, fall back to pure UUID
    deviceId = crypto.randomUUID();
  }

  // Persist to all tiers
  if (db) await idbSet(db, IDB_KEY, deviceId);
  try { localStorage.setItem(LS_KEY, deviceId); } catch { /* noop */ }

  return deviceId;
}
