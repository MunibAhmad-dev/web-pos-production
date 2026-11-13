// Shared money/status rules — mirror the desktop POS (src/main/main.ts) so every
// screen agrees with it. Desktop writes statuses in mixed case
// ('Completed', 'paid', 'Partial', 'Cancelled', 'Returned'), so always compare lowercased.

export const saleStatus = (s) => String(s?.status ?? 'completed').toLowerCase();
export const isCancelled = (row) => String(row?.status ?? '').toLowerCase() === 'cancelled';
/** Sales that count as revenue on the desktop: completed / paid / partial. */
export const isActiveSale = (s) => ['completed', 'paid', 'partial', ''].includes(saleStatus(s));

/**
 * Vendor payable, desktop get-vendors formula: per non-cancelled purchase
 * max(0, total − payments linked to it − its returns), minus payments not tied
 * to any purchase (cheques, unified smart-pay, advances). Can go negative (credit).
 */
export function vendorBalances({ purchases = [], vendorPayments = [], purchaseReturns = [] }) {
  const paidByPurchase = new Map();
  const unlinkedByVendor = new Map();
  for (const p of vendorPayments) {
    const amt = Number(p.amount) || 0;
    const pid = p.purchase_id;
    if (pid == null || pid === '' || Number(pid) === 0) {
      const vid = String(p.vendor_id ?? '');
      unlinkedByVendor.set(vid, (unlinkedByVendor.get(vid) || 0) + amt);
    } else {
      paidByPurchase.set(String(pid), (paidByPurchase.get(String(pid)) || 0) + amt);
    }
  }
  const retByPurchase = new Map();
  for (const r of purchaseReturns) {
    const pid = String(r.purchase_id ?? '');
    retByPurchase.set(pid, (retByPurchase.get(pid) || 0) + (Number(r.total_returned ?? r.total) || 0));
  }
  const bal = new Map();
  for (const p of purchases) {
    if (isCancelled(p)) continue;
    const vid = String(p.vendor_id ?? '');
    if (!vid) continue;
    const pid = String(p.id);
    const rem = Math.max(0, (Number(p.grand_total || p.total) || 0) - (paidByPurchase.get(pid) || 0) - (retByPurchase.get(pid) || 0));
    bal.set(vid, (bal.get(vid) || 0) + rem);
  }
  for (const [vid, amt] of unlinkedByVendor) bal.set(vid, (bal.get(vid) || 0) - amt);
  return bal;
}

// UI-only fields pages attach to a sale row — must never be pushed into the sales table.
const SALE_UI_FIELDS = ['items', 'customer', 'paid', 'returned', 'due', 'payLabel', 'invoiceNo', 'itemsSummary',
  'linkedPayments', 'linkedReturns', 'amountPaid', 'amountReturned', 'remaining', 'rawRemaining'];

/**
 * Events that cancel a sale exactly like the desktop's cancel-sale:
 * restock only what wasn't already returned (returns restocked it once), delete the
 * payments recorded against this sale, and take the sale's still-owed part off the
 * customer's balance (total − write-off − its payments − returns not refunded in cash).
 * Returns null when the sale is already cancelled (a second cancel would restock twice).
 */
export function buildCancelSaleEvents({ sale, items = [], customer, products = [], payments = [], returns = [], returnItems = [], now }) {
  if (!sale || isCancelled(sale)) return null;
  const sid = String(sale.id);
  const clean = { ...sale };
  for (const f of SALE_UI_FIELDS) delete clean[f];
  const events = [{ entityType: 'sale', operation: 'update', payload: { ...clean, status: 'Cancelled', updated_at: now } }];

  const saleReturns = returns.filter((r) => String(r.sale_id) === sid);
  const returnIds = new Set(saleReturns.map((r) => String(r.id)));
  const returnedQty = new Map();
  for (const ri of returnItems) {
    if (!returnIds.has(String(ri.return_id))) continue;
    const k = String(ri.sale_item_id ?? '');
    returnedQty.set(k, (returnedQty.get(k) || 0) + (Number(ri.quantity) || 0));
  }
  const stockDelta = new Map();
  for (const it of items) {
    if (it.product_id == null) continue;
    const qty = Math.max(0, (Number(it.quantity) || 0) - (returnedQty.get(String(it.id)) || 0));
    if (qty > 0) stockDelta.set(String(it.product_id), (stockDelta.get(String(it.product_id)) || 0) + qty);
  }
  for (const [pid, qty] of stockDelta) {
    const product = products.find((p) => String(p.id) === pid);
    if (product) events.push({ entityType: 'product', operation: 'update', payload: { ...product, stock: Number(product.stock || 0) + qty, updated_at: now } });
  }

  const salePayments = payments.filter((p) => String(p.sale_id) === sid);
  for (const p of salePayments) events.push({ entityType: 'customer_payment', operation: 'delete', payload: { id: p.id } });

  if (customer) {
    const paid = salePayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const credited = saleReturns.reduce((s, r) => s + (Number(r.total_returned) || 0) - (Number(r.cash_refunded) || 0), 0);
    const owedPart = (Number(sale.total) || 0) - (Number(sale.write_off_amount) || 0) - paid - credited;
    if (Math.abs(owedPart) > 0.009) {
      const { balance: _ui, ...custRow } = customer;
      events.push({ entityType: 'customer', operation: 'update', payload: {
        ...custRow, outstanding_balance: Math.max(0, Number(customer.outstanding_balance || 0) - owedPart), updated_at: now,
      } });
    }
  }
  return events;
}

/**
 * Account entry for cash handed back on a sale return, picking the account like the desktop:
 * the account the sale was paid into, then one that took a payment for this invoice, then the default.
 * Returns { event, accountId } or null when nothing is refunded or no account exists.
 */
export function buildSaleRefundTxn({ saleId, amount, accounts = [], accountTxns = [], now }) {
  const amt = Math.round((Number(amount) || 0) * 100) / 100;
  if (amt <= 0.009) return null;
  const sid = String(saleId);
  const newest = (pred) => accountTxns.filter(pred).sort((a, b) => Number(b.id) - Number(a.id))[0];
  const sold = newest((t) => t.type === 'in' && t.category === 'sale' && String(t.note ?? '').endsWith(`Sale #${sid}`));
  const paid = sold ? null : newest((t) => t.type === 'in' && String(t.note ?? '').includes(`INV #${sid}`));
  const exists = (id) => id != null && accounts.some((a) => String(a.id) === String(id));
  const accountId = [sold?.account_id, paid?.account_id, accounts.find((a) => Number(a.is_default) === 1 || a.is_default === true)?.id].find(exists);
  if (accountId == null) return null;
  return {
    accountId,
    event: { entityType: 'account_txn', operation: 'create', payload: {
      account_id: accountId, type: 'out', amount: amt, category: 'sale_return', note: `Return for Sale #${sid}`, date_created: now,
    } },
  };
}

/** Open custom-bill (khata) balance per party; closed bills don't count (desktop rule). */
export function khataBalances(khatas = [], khataPayments = [], partyKey = 'customer_id') {
  const paid = new Map();
  for (const p of khataPayments) {
    const kid = String(p.khata_id ?? '');
    paid.set(kid, (paid.get(kid) || 0) + (Number(p.amount) || 0));
  }
  const bal = new Map();
  for (const k of khatas) {
    if (String(k.status ?? '').toLowerCase() === 'closed') continue;
    const pid = String(k[partyKey] ?? '');
    if (!pid) continue;
    const rem = Math.max(0, (Number(k.total_amount) || 0) - (paid.get(String(k.id)) || 0));
    bal.set(pid, (bal.get(pid) || 0) + rem);
  }
  return bal;
}
