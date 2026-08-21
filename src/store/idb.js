/**
 * IndexedDB backing store for the POS data layer.
 *
 * Why IDB and not localStorage:
 *   - No 5 MB cap — a busy shop accumulates hundreds of MB of sales history
 *   - Async reads don't block the main thread
 *   - Index-range queries let us load only recent records into React state
 *
 * Strategy
 *   - Catalog types (products, customers, vendors …) → always fully in memory
 *   - History types (sales, purchases, expenses …)   → last WINDOW_DAYS in memory,
 *     everything in IDB, "load older" queries IDB on demand
 */

const DB_NAME    = 'osatech_pos';
const DB_VERSION = 1;

export const WINDOW_DAYS = 60;

export const WINDOWED_TYPES = new Set([
  'sale', 'sale_item',
  'sale_return', 'sale_return_item',
  'purchase', 'purchase_item', 'inventory_batch',
  'purchase_return', 'purchase_return_item',
  'expense',
  'financial_transaction', 'account_txn',
]);

// All entity types that get an IDB object store
export const ALL_IDB_TYPES = [
  'product', 'customer', 'vendor', 'employee', 'employee_advance',
  'sale', 'sale_item', 'sale_return', 'sale_return_item',
  'purchase', 'purchase_item', 'inventory_batch', 'purchase_return', 'purchase_return_item',
  'stock_adjustment', 'customer_payment', 'vendor_payment',
  'expense', 'account', 'account_txn', 'register', 'financial_transaction',
  'warranty_claim', 'vendor_khata', 'vendor_khata_payment',
];

// ── DB lifecycle ──────────────────────────────────────────────────────────────

let _db       = null;
let _dbPromise = null;

export function openPosDB() {
  if (_db) return Promise.resolve(_db);
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onerror = () => { _dbPromise = null; reject(req.error); };

    req.onsuccess = () => {
      _db = req.result;
      _db.onclose = () => { _db = null; _dbPromise = null; };
      resolve(_db);
    };

    req.onupgradeneeded = (e) => {
      const db     = e.target.result;
      const txn    = e.target.transaction;

      for (const type of ALL_IDB_TYPES) {
        let store;
        if (!db.objectStoreNames.contains(type)) {
          store = db.createObjectStore(type, { keyPath: 'id' });
        } else {
          store = txn.objectStore(type);
        }

        // Date index for time-window queries (windowed types only)
        if (WINDOWED_TYPES.has(type) && !store.indexNames.contains('by_date')) {
          store.createIndex('by_date', 'date_created', { unique: false });
        }

        // sale_id index for efficient item lookups
        if (type === 'sale_item' && !store.indexNames.contains('by_sale_id')) {
          store.createIndex('by_sale_id', 'sale_id', { unique: false });
        }
      }
    };
  });

  return _dbPromise;
}

// ── Write ─────────────────────────────────────────────────────────────────────

/** Upsert many records of one entity type. */
export function idbPutMany(db, type, records) {
  if (!records?.length) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(type, 'readwrite');
    const store = tx.objectStore(type);
    for (const r of records) store.put({ ...r, id: String(r.id) });
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}

// ── Read ──────────────────────────────────────────────────────────────────────

/** Read every record of a type (catalog types). */
export function idbGetAll(db, type) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(type, 'readonly');
    const req = tx.objectStore(type).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/** Read records where date_created >= since (uses by_date index). */
export function idbGetSince(db, type, since) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(type, 'readonly');
    const store = tx.objectStore(type);
    if (!store.indexNames.contains('by_date')) {
      // No index — return everything (shouldn't happen for windowed types)
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
      return;
    }
    const req = store.index('by_date').getAll(IDBKeyRange.lowerBound(since));
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/**
 * Read up to `limit` records with date_created < before, newest first.
 * Used for "load older" pagination.
 */
export function idbGetBefore(db, type, before, limit = 100) {
  return new Promise((resolve, reject) => {
    const results = [];
    const tx      = db.transaction(type, 'readonly');
    const store   = tx.objectStore(type);
    if (!store.indexNames.contains('by_date')) { resolve(results); return; }

    const range = IDBKeyRange.upperBound(before, true); // exclusive upper bound
    const req   = store.index('by_date').openCursor(range, 'prev'); // newest → oldest

    req.onsuccess = (ev) => {
      const cursor = ev.target.result;
      if (!cursor || results.length >= limit) { resolve(results); return; }
      results.push(cursor.value);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Fetch sale_items for a set of sale IDs using the by_sale_id index.
 * All queries run inside a single transaction for efficiency.
 */
export function idbGetSaleItems(db, saleIds) {
  if (!saleIds.size) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const results = [];
    const tx      = db.transaction('sale_item', 'readonly');
    const index   = tx.objectStore('sale_item').index('by_sale_id');
    let pending   = saleIds.size;

    for (const sid of saleIds) {
      const req = index.getAll(String(sid));
      req.onsuccess = () => {
        results.push(...req.result);
        if (--pending === 0) resolve(results);
      };
      req.onerror = () => reject(req.error);
    }
  });
}

// ── Metadata ──────────────────────────────────────────────────────────────────
// Store the last-sync timestamp in localStorage (tiny string, no need for IDB).

const META_KEY = 'pos_idb_meta_v1';

export function getIdbMeta()        { try { return JSON.parse(localStorage.getItem(META_KEY) || 'null'); } catch { return null; } }
export function setIdbMeta(meta)    { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch {} }
export function clearIdbMeta()      { try { localStorage.removeItem(META_KEY); } catch {} }

// ── Logout / account switch ───────────────────────────────────────────────────

/** Wipe all IDB stores and the sync meta (called on logout). */
export async function idbClearAll() {
  clearIdbMeta();
  try {
    const db  = await openPosDB();
    const names = [...db.objectStoreNames];
    await new Promise((resolve, reject) => {
      const tx = db.transaction(names, 'readwrite');
      for (const n of names) tx.objectStore(n).clear();
      tx.oncomplete = resolve;
      tx.onerror    = () => reject(tx.error);
    });
  } catch {} // private browsing / IDB unavailable — ignore
}
