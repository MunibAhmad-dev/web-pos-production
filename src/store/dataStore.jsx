import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import cloudApi from '../api/cloudClient';
import { pushEvents, nextId } from '../api/syncClient';
import {
  openPosDB, idbPutMany, idbDeleteMany, idbReplaceAll, idbGetAll, idbGetSince, idbGetBefore, idbGetSaleItems,
  idbClearAll, getIdbMeta, setIdbMeta,
  ALL_IDB_TYPES, WINDOWED_TYPES, WINDOW_DAYS,
} from './idb';

const DataStoreContext = createContext(null);

// Plural export key → singular entity_type (matches POST /api/sync)
const PLURAL_TO_SINGULAR = {
  products:              'product',
  customers:             'customer',
  vendors:               'vendor',
  employees:             'employee',
  employee_advances:     'employee_advance',
  sales:                 'sale',
  sale_items:            'sale_item',
  sale_returns:          'sale_return',
  sale_return_items:     'sale_return_item',
  purchases:             'purchase',
  purchase_items:        'purchase_item',
  inventory_batches:     'inventory_batch',
  purchase_returns:      'purchase_return',
  purchase_return_items: 'purchase_return_item',
  stock_adjustments:     'stock_adjustment',
  customer_payments:     'customer_payment',
  vendor_payments:       'vendor_payment',
  expenses:              'expense',
  accounts:              'account',
  account_txns:          'account_txn',
  registers:             'register',
  financial_transactions:'financial_transaction',
  warranty_claims:       'warranty_claim',
  vendor_khatas:          'vendor_khata',
  vendor_khata_payments:  'vendor_khata_payment',
  customer_khatas:        'customer_khata',
  customer_khata_payments:'customer_khata_payment',
  payment_reminders:      'payment_reminder',
  attendances:            'attendance',
  godown_entries:         'godown_entry',
  repair_jobs:            'repair_job',
  // Shop settings synced from the desktop (module switches, store name…) — pages read list('settings').
  settings:               'settings',
  // Names used by the newer cloud export (desktop table names).
  customer_khata:         'customer_khata',
  vendor_khata:           'vendor_khata',
  product_batches:        'product_batch',
};
const ENTITY_TYPES = Object.values(PLURAL_TO_SINGULAR);

const FULL_RESYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 min
const INCREMENTAL_REFRESH_MS  = 45 * 1000;       // 45 s

// ── Helpers ───────────────────────────────────────────────────────────────────

function windowCutoff() {
  return new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
}

function emptyCollections() {
  const s = {};
  for (const t of ENTITY_TYPES) s[t] = new Map();
  return s;
}

/** Migrate and remove any old localStorage cache keys from the previous implementation. */
function cleanLegacyCache() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('pos_cache_v1_') || key.startsWith('pos_cache_ts_v1_')) {
        localStorage.removeItem(key);
      }
    }
  } catch {}
}

// ── Context provider ──────────────────────────────────────────────────────────

export function DataStoreProvider({ children }) {
  const [collections, setCollections] = useState(emptyCollections);
  const collectionsRef = useRef(emptyCollections());
  useEffect(() => { collectionsRef.current = collections; }, [collections]);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [loading, setLoading]           = useState(false);
  const lastSyncRef = useRef(null);

  // Clean up legacy localStorage cache on first mount
  useEffect(() => { cleanLegacyCache(); }, []);

  // ── Apply helpers ─────────────────────────────────────────────────────────

  /**
   * Hydrate React state from a raw export payload.
   * Catalog types: load fully.
   * Windowed types: only load records within the recent time window.
   */
  const applyExportWindowed = useCallback((exportData) => {
    const cutoff = windowCutoff();
    setCollections(() => {
      const next = emptyCollections();
      for (const [plural, singular] of Object.entries(PLURAL_TO_SINGULAR)) {
        const rows = exportData[plural];
        if (!Array.isArray(rows)) continue;
        for (const row of rows) {
          if (row?.id == null) continue;
          if (WINDOWED_TYPES.has(singular) && row.date_created && row.date_created < cutoff) continue;
          next[singular].set(String(row.id), row);
        }
      }
      return next;
    });
  }, []);

  /** Merge incremental pull-data changes (upserts + deletes) into React state. */
  const applyIncoming = useCallback((byEntityType, deletedByType) => {
    if (!byEntityType && !deletedByType) return;
    setCollections((prev) => {
      const next = { ...prev };
      for (const [entityType, ids] of Object.entries(deletedByType || {})) {
        if (!ENTITY_TYPES.includes(entityType) || !Array.isArray(ids)) continue;
        const map = new Map(next[entityType]);
        for (const id of ids) map.delete(String(id));
        next[entityType] = map;
      }
      for (const [entityType, rows] of Object.entries(byEntityType || {})) {
        if (!ENTITY_TYPES.includes(entityType) || !Array.isArray(rows)) continue;
        const map = new Map(next[entityType]);
        for (const row of rows) {
          if (row?.id == null) continue;
          map.set(String(row.id), row);
        }
        next[entityType] = map;
      }
      return next;
    });
  }, []);

  /** Load windowed slice from IDB into React state (used on cached startup). */
  const hydrateFromIdb = useCallback(async (db) => {
    const cutoff = windowCutoff();
    const next   = emptyCollections();
    await Promise.all(
      Object.entries(PLURAL_TO_SINGULAR).map(async ([, singular]) => {
        try {
          const rows = WINDOWED_TYPES.has(singular)
            ? await idbGetSince(db, singular, cutoff)
            : await idbGetAll(db, singular);
          for (const row of rows) {
            if (row?.id == null) continue;
            next[singular].set(String(row.id), row);
          }
        } catch {} // skip store on error
      })
    );
    setCollections(next);
  }, []);

  /** Write a full export payload to IDB in the background. */
  const persistExportToIdb = useCallback(async (exportData) => {
    try {
      const db = await openPosDB();
      for (const [plural, singular] of Object.entries(PLURAL_TO_SINGULAR)) {
        const rows = exportData[plural];
        if (!Array.isArray(rows)) continue;
        await idbReplaceAll(db, singular, rows.filter(r => r?.id != null)).catch(() => {});
      }
    } catch {} // IDB unavailable (e.g. private browsing) — continue
  }, []);

  /** Write incremental changes (upserts + deletes) to IDB in the background. */
  const persistIncomingToIdb = useCallback(async (byEntityType, deletedByType) => {
    try {
      const db = await openPosDB();
      for (const [entityType, ids] of Object.entries(deletedByType || {})) {
        if (!ENTITY_TYPES.includes(entityType) || !Array.isArray(ids) || !ids.length) continue;
        await idbDeleteMany(db, entityType, ids).catch(() => {});
      }
      for (const [entityType, rows] of Object.entries(byEntityType || {})) {
        if (!ENTITY_TYPES.includes(entityType) || !Array.isArray(rows) || !rows.length) continue;
        await idbPutMany(db, entityType, rows.map(r => ({ ...r, id: String(r.id) }))).catch(() => {});
      }
    } catch {}
  }, []);

  /**
   * Pull every change since the cursor. The server caps a page at 3000 events and
   * signals hasMore — jumping straight to "now" after one page silently dropped the rest.
   */
  const pullSince = useCallback(async (meta) => {
    let params = meta?.lastId != null ? { sinceId: meta.lastId } : { since: meta?.savedAt };
    let lastId = meta?.lastId ?? null;
    let pulledAt = null;
    for (let page = 0; page < 200; page++) {
      const { data } = await cloudApi.get('/instances/pull-data', { params });
      if (data?.data || data?.deleted) {
        applyIncoming(data.data, data.deleted);
        void persistIncomingToIdb(data.data, data.deleted);
      }
      pulledAt = pulledAt || data?.pulled_at || new Date().toISOString();
      // An empty date-based page reports lastId 0 — adopting it would make the next pull re-fetch all history.
      if (Number(data?.lastId) > Number(lastId || 0)) lastId = Number(data.lastId);
      if (!data?.hasMore || data?.lastId == null) break;
      params = { sinceId: data.lastId };
    }
    const next = { savedAt: pulledAt || new Date().toISOString(), lastId };
    lastSyncRef.current = next;
    setIdbMeta(next);
  }, [applyIncoming, persistIncomingToIdb]);

  // ── bootstrap ─────────────────────────────────────────────────────────────
  //   force=false (default): try IDB cache first
  //   force=true:  full network export (periodic resync, ignores cache)

  const bootstrap = useCallback(async ({ force = false } = {}) => {
    setLoading(true);
    try {
      // ── 1. Try IDB cache (skip on forced resync) ──
      if (!force) {
        const meta = getIdbMeta();
        if (meta?.savedAt) {
          try {
            const db = await openPosDB();
            await hydrateFromIdb(db);
            lastSyncRef.current = meta;
            setBootstrapped(true);
            setLoading(false);

            // Background catch-up — fire and forget
            void pullSince(meta).catch(() => {});
            return;
          } catch {} // IDB read failed — fall through to network
        }
      }

      // ── 2. Full network export ──
      const { data: exportData } = await cloudApi.get('/instances/export');
      const savedAt = exportData.exported_at || new Date().toISOString();

      applyExportWindowed(exportData);
      lastSyncRef.current = { savedAt, lastId: null };
      setIdbMeta({ savedAt, lastId: null });
      setBootstrapped(true);

      // Write everything to IDB in background (doesn't block the UI)
      void persistExportToIdb(exportData);

    } finally {
      setLoading(false);
    }
  }, [applyExportWindowed, hydrateFromIdb, persistExportToIdb, pullSince]);

  // ── incremental refresh ── every 45 s + window focus
  const refresh = useCallback(async () => {
    if (!lastSyncRef.current) return;
    await pullSince(lastSyncRef.current);
  }, [pullSince]);

  useEffect(() => {
    if (!bootstrapped) return undefined;
    const incTimer  = setInterval(() => refresh().catch(() => {}), INCREMENTAL_REFRESH_MS);
    const fullTimer = setInterval(() => bootstrap({ force: true }).catch(() => {}), FULL_RESYNC_INTERVAL_MS);
    const onFocus   = () => refresh().catch(() => {});
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(incTimer);
      clearInterval(fullTimer);
      window.removeEventListener('focus', onFocus);
    };
  }, [bootstrapped, refresh, bootstrap]);

  // ── on-demand older records ───────────────────────────────────────────────

  /**
   * Load up to `limit` sales (and their items) created before `before` from IDB,
   * and merge them into the in-memory store.
   * Returns the count of sales loaded (0 = no more older records).
   */
  const loadOlderSales = useCallback(async (before, limit = 100) => {
    try {
      const db         = await openPosDB();
      const olderSales = await idbGetBefore(db, 'sale', before, limit);
      if (!olderSales.length) return 0;

      const saleIds   = new Set(olderSales.map(s => String(s.id)));
      const olderItems = await idbGetSaleItems(db, saleIds);

      setCollections(prev => {
        const saleMap = new Map(prev.sale);
        const itemMap = new Map(prev.sale_item);
        for (const s of olderSales) saleMap.set(String(s.id), s);
        for (const i of olderItems) itemMap.set(String(i.id), i);
        return { ...prev, sale: saleMap, sale_item: itemMap };
      });

      return olderSales.length;
    } catch { return 0; }
  }, []);

  // ── local optimistic mutations ────────────────────────────────────────────

  const applyLocal = useCallback((entityType, operation, payload) => {
    setCollections((prev) => {
      const map = new Map(prev[entityType]);
      const key = String(payload.id);
      if (operation === 'delete') map.delete(key);
      else map.set(key, payload);
      return { ...prev, [entityType]: map };
    });
  }, []);

  const pushEntity = useCallback(
    async (entityType, operation, payload) => {
      const final = payload.id != null ? payload : { ...payload, id: nextId() };
      const snapshot = collectionsRef.current[entityType]?.get(String(final.id));
      applyLocal(entityType, operation, final);
      try {
        const res = await pushEvents([{ entity_type: entityType, operation, payload: final, local_id: final.id }]);
        const itemErr = res?.results?.find?.(r => r && r.success === false);
        if (itemErr) throw new Error(itemErr.error || 'Cloud rejected the change');
        // Persist to IDB so it survives a refresh (a delete must be removed, not re-stored)
        void openPosDB().then(db => operation === 'delete'
          ? idbDeleteMany(db, entityType, [final.id])
          : idbPutMany(db, entityType, [{ ...final, id: String(final.id) }])).catch(() => {});
      } catch (err) {
        // Restore previous state on error — don't delete entities that already existed
        if (snapshot != null) applyLocal(entityType, 'update', snapshot);
        else applyLocal(entityType, 'delete', final);
        throw err;
      }
      return final;
    },
    [applyLocal]
  );

  const pushBatch = useCallback(
    async (events) => {
      const prepared = events.map(e => ({
        entityType: e.entityType,
        operation:  e.operation,
        payload:    e.payload.id != null ? e.payload : { ...e.payload, id: nextId() },
      }));
      const snapshots = prepared.map(e => collectionsRef.current[e.entityType]?.get(String(e.payload.id)));
      for (const e of prepared) applyLocal(e.entityType, e.operation, e.payload);
      try {
        const res = await pushEvents(
          prepared.map(e => ({ entity_type: e.entityType, operation: e.operation, payload: e.payload, local_id: e.payload.id }))
        );
        const itemErr = res?.results?.find?.(r => r && r.success === false);
        if (itemErr) throw new Error(itemErr.error || 'Cloud rejected part of the change');
        void openPosDB().then(db =>
          Promise.all(prepared.map(e => (e.operation === 'delete'
            ? idbDeleteMany(db, e.entityType, [e.payload.id])
            : idbPutMany(db, e.entityType, [{ ...e.payload, id: String(e.payload.id) }])).catch(() => {})))
        ).catch(() => {});
      } catch (err) {
        for (let i = 0; i < prepared.length; i++) {
          const snapshot = snapshots[i];
          if (snapshot != null) applyLocal(prepared[i].entityType, 'update', snapshot);
          else applyLocal(prepared[i].entityType, 'delete', prepared[i].payload);
        }
        throw err;
      }
      return prepared.map(e => e.payload);
    },
    [applyLocal]
  );

  const list = useCallback((entityType) => Array.from(collections[entityType]?.values() || []), [collections]);
  const get  = useCallback((entityType, id) => collections[entityType]?.get(String(id)), [collections]);

  return (
    <DataStoreContext.Provider value={{
      collections, bootstrapped, loading,
      bootstrap, refresh,
      pushEntity, pushBatch,
      list, get, nextId,
      loadOlderSales,
    }}>
      {children}
    </DataStoreContext.Provider>
  );
}

export function useDataStore() {
  const ctx = useContext(DataStoreContext);
  if (!ctx) throw new Error('useDataStore must be used within DataStoreProvider');
  return ctx;
}

/** Called on logout — wipes IDB and the sync cursor. */
export async function clearDataCache() {
  await idbClearAll();
}
