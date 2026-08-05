import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import cloudApi from '../api/cloudClient';
import { pushEvents, nextId } from '../api/syncClient';

const DataStoreContext = createContext(null);

// GET /instances/export returns plural table-name keys; GET /instances/pull-data
// returns singular entity_type keys. Collections here are always keyed by the
// singular entity_type (matches what POST /api/sync expects when pushing).
const PLURAL_TO_SINGULAR = {
  products: 'product',
  customers: 'customer',
  vendors: 'vendor',
  employees: 'employee',
  employee_advances: 'employee_advance',
  sales: 'sale',
  sale_items: 'sale_item',
  sale_returns: 'sale_return',
  sale_return_items: 'sale_return_item',
  purchases: 'purchase',
  inventory_batches: 'inventory_batch',
  purchase_returns: 'purchase_return',
  purchase_return_items: 'purchase_return_item',
  stock_adjustments: 'stock_adjustment',
  customer_payments: 'customer_payment',
  vendor_payments: 'vendor_payment',
  expenses: 'expense',
  accounts: 'account',
  account_txns: 'account_txn',
  registers: 'register',
  financial_transactions: 'financial_transaction',
  warranty_claims: 'warranty_claim',
};
const ENTITY_TYPES = Object.values(PLURAL_TO_SINGULAR);
const FULL_RESYNC_INTERVAL_MS = 10 * 60 * 1000; // catches deletions incremental pull can miss
const INCREMENTAL_REFRESH_MS = 45 * 1000;

function emptyCollections() {
  const state = {};
  for (const type of ENTITY_TYPES) state[type] = new Map();
  return state;
}

export function DataStoreProvider({ children }) {
  const [collections, setCollections] = useState(emptyCollections);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [loading, setLoading] = useState(false);
  const lastSyncRef = useRef(null);

  const applyExport = useCallback((exportData) => {
    setCollections(() => {
      const next = emptyCollections();
      for (const [plural, singular] of Object.entries(PLURAL_TO_SINGULAR)) {
        const rows = exportData[plural];
        if (!Array.isArray(rows)) continue;
        for (const row of rows) {
          if (row?.id == null) continue;
          next[singular].set(String(row.id), row);
        }
      }
      return next;
    });
  }, []);

  const applyIncoming = useCallback((byEntityType) => {
    if (!byEntityType) return;
    setCollections((prev) => {
      const next = { ...prev };
      for (const [entityType, rows] of Object.entries(byEntityType)) {
        if (!ENTITY_TYPES.includes(entityType) || !Array.isArray(rows)) continue;
        const map = new Map(prev[entityType]);
        for (const row of rows) {
          if (row?.id == null) continue;
          map.set(String(row.id), row);
        }
        next[entityType] = map;
      }
      return next;
    });
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await cloudApi.get('/instances/export');
      applyExport(data);
      lastSyncRef.current = data.exported_at || new Date().toISOString();
      setBootstrapped(true);
    } finally {
      setLoading(false);
    }
  }, [applyExport]);

  const refresh = useCallback(async () => {
    if (!lastSyncRef.current) return;
    const since = lastSyncRef.current;
    const { data } = await cloudApi.get('/instances/pull-data', { params: { since } });
    applyIncoming(data.data);
    lastSyncRef.current = data.pulled_at || new Date().toISOString();
  }, [applyIncoming]);

  useEffect(() => {
    if (!bootstrapped) return undefined;
    const incrementalTimer = setInterval(() => {
      refresh().catch(() => {});
    }, INCREMENTAL_REFRESH_MS);
    const fullResyncTimer = setInterval(() => {
      bootstrap().catch(() => {});
    }, FULL_RESYNC_INTERVAL_MS);
    const onFocus = () => refresh().catch(() => {});
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(incrementalTimer);
      clearInterval(fullResyncTimer);
      window.removeEventListener('focus', onFocus);
    };
  }, [bootstrapped, refresh, bootstrap]);

  const applyLocal = useCallback((entityType, operation, payload) => {
    setCollections((prev) => {
      const map = new Map(prev[entityType]);
      const key = String(payload.id);
      if (operation === 'delete') map.delete(key);
      else map.set(key, payload);
      return { ...prev, [entityType]: map };
    });
  }, []);

  /** Push one entity mutation, assigning a synthetic id on create if not already set. */
  const pushEntity = useCallback(
    async (entityType, operation, payload) => {
      const finalPayload = payload.id != null ? payload : { ...payload, id: nextId() };
      applyLocal(entityType, operation, finalPayload);
      try {
        await pushEvents([{ entity_type: entityType, operation, payload: finalPayload, local_id: finalPayload.id }]);
      } catch (err) {
        applyLocal(entityType, 'delete', finalPayload); // roll back optimistic write on failure
        throw err;
      }
      return finalPayload;
    },
    [applyLocal]
  );

  /** Push several related events atomically as one /api/sync call (e.g. sale + its sale_items). */
  const pushBatch = useCallback(
    async (events) => {
      const prepared = events.map((e) => ({
        entityType: e.entityType,
        operation: e.operation,
        payload: e.payload.id != null ? e.payload : { ...e.payload, id: nextId() },
      }));
      for (const e of prepared) applyLocal(e.entityType, e.operation, e.payload);
      try {
        await pushEvents(
          prepared.map((e) => ({ entity_type: e.entityType, operation: e.operation, payload: e.payload, local_id: e.payload.id }))
        );
      } catch (err) {
        for (const e of prepared) applyLocal(e.entityType, 'delete', e.payload);
        throw err;
      }
      return prepared.map((e) => e.payload);
    },
    [applyLocal]
  );

  const list = useCallback((entityType) => Array.from(collections[entityType]?.values() || []), [collections]);
  const get = useCallback((entityType, id) => collections[entityType]?.get(String(id)), [collections]);

  const value = {
    collections,
    bootstrapped,
    loading,
    bootstrap,
    refresh,
    pushEntity,
    pushBatch,
    list,
    get,
    nextId,
  };

  return <DataStoreContext.Provider value={value}>{children}</DataStoreContext.Provider>;
}

export function useDataStore() {
  const ctx = useContext(DataStoreContext);
  if (!ctx) throw new Error('useDataStore must be used within DataStoreProvider');
  return ctx;
}
