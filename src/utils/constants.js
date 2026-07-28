// The synced product schema (shared with the desktop app) has no per-product
// reorder-threshold field, so "low stock" uses a single store-wide threshold
// instead — kept as a browser-local preference (the cloud has nowhere to
// store it) and broadcast via a custom event so every mounted page picks up
// a change immediately.
const KEY = 'low_stock_threshold';
const DEFAULT_THRESHOLD = 5;
const EVENT = 'lowstock-threshold-changed';

export function getLowStockThreshold() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw != null ? Number(raw) : DEFAULT_THRESHOLD;
  } catch {
    return DEFAULT_THRESHOLD;
  }
}

export function setLowStockThreshold(value) {
  try {
    localStorage.setItem(KEY, String(value));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* ignore */
  }
}

export const LOW_STOCK_THRESHOLD_EVENT = EVENT;
