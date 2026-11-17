/**
 * Vendor account maths, following the desktop app:
 *  - purchase balance = Σ per active bill max(0, total − payments linked to it − its returns)
 *                       − Σ unlinked payments (lump Smart Pay, advances, custom-bill share)
 *  - unlinked payments cover the oldest bills first (desktop fifoSpreadCredit)
 *  - open custom bills (vendor khata) are added on top
 *  - Smart Pay (smart-pay-unified-vendor): oldest bills and custom bills first; one payment per
 *    bill plus one unlinked row for the custom-bill share and any extra, sharing payment_group;
 *    one cash/bank 'out' entry tagged [SPG:group]
 */
import { isCancelled, vendorBalances } from '@/lib/ledger';
import { parseDate, localStamp, newPaymentGroupId } from '@/lib/customerAccount';

const ts = (raw) => parseDate(raw)?.getTime() || 0;
const num = (v) => Number(v) || 0;
const r2 = (v) => Math.round(v * 100) / 100;
const unlinked = (p) => p.purchase_id == null || p.purchase_id === '' || Number(p.purchase_id) === 0;

export function purchaseNo(p) { return p.bill_no ? `Bill ${p.bill_no}` : `PO #${p.id}`; }

export function buildVendorAccount({ vendor, purchases = [], purchaseItems = [], batches = [], products = [], payments = [], returns = [], khatas = [], khataPayments = [] }) {
  const vid = String(vendor.id);
  const vPurchases = purchases.filter((p) => String(p.vendor_id) === vid);
  const ids = new Set(vPurchases.map((p) => String(p.id)));
  const vPayments = payments.filter((p) => String(p.vendor_id) === vid);
  const vReturns = returns.filter((r) => ids.has(String(r.purchase_id)));
  const prod = new Map(products.map((p) => [String(p.id), p]));

  const group = (arr) => { const m = new Map(); for (const x of arr) { const k = String(x.purchase_id); if (!ids.has(k)) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };
  const pItems = group(purchaseItems); const pBatches = group(batches);
  const paidBy = new Map(); let pool = 0;
  for (const p of vPayments) { if (unlinked(p)) pool += num(p.amount); else paidBy.set(String(p.purchase_id), (paidBy.get(String(p.purchase_id)) || 0) + num(p.amount)); }
  const retBy = new Map();
  for (const r of vReturns) retBy.set(String(r.purchase_id), (retBy.get(String(r.purchase_id)) || 0) + num(r.total_returned ?? r.total));

  const bills = vPurchases.map((pu) => {
    const k = String(pu.id);
    let embedded = pu.items;
    if (typeof embedded === 'string') { try { embedded = JSON.parse(embedded); } catch { embedded = null; } }
    const src = pItems.get(k) || (Array.isArray(embedded) && embedded.length ? embedded : null) || pBatches.get(k) || [];
    const lines = src.map((it, i) => {
      const quantity = num(it.quantity ?? it.quantity_added); const price = num(it.purchase_price ?? it.unit_cost ?? it.cost_price);
      return { id: it.id ?? `${k}-${i}`, name: it.product_name || prod.get(String(it.product_id))?.name || 'Item', quantity, price, amount: quantity * price };
    });
    const cancelled = isCancelled(pu); const total = num(pu.grand_total ?? pu.total);
    const paid = paidBy.get(k) || 0; const returned = retBy.get(k) || 0;
    return { ...pu, no: purchaseNo(pu), lines, total, paid, returned, cancelled, rawRemaining: cancelled ? 0 : Math.max(0, total - paid - returned) };
  });
  // Unlinked payments cover the oldest open bills first
  const credit = new Map(); let left = pool;
  for (const b of [...bills].sort((a, b2) => ts(a.date_created) - ts(b2.date_created) || num(a.id) - num(b2.id))) {
    if (left <= 0.01) break;
    if (b.rawRemaining <= 0.01) continue;
    const take = Math.min(left, b.rawRemaining); credit.set(String(b.id), take); left -= take;
  }
  for (const b of bills) {
    b.remaining = r2(Math.max(0, b.rawRemaining - (credit.get(String(b.id)) || 0)));
    b.state = b.cancelled ? 'cancelled' : (b.returned > 0 && b.returned >= b.total - 0.5) ? 'returned' : b.remaining <= 0.5 ? 'paid' : (b.paid > 0 || credit.has(String(b.id)) || b.returned > 0) ? 'partial' : 'unpaid';
  }
  bills.sort((a, b) => ts(b.date_created) - ts(a.date_created) || num(b.id) - num(a.id));

  // Same formula as the desktop's get-vendors
  const purchaseBalance = r2(vendorBalances({ purchases: vPurchases, vendorPayments: vPayments, purchaseReturns: vReturns }).get(vid) || 0);

  const paidByKhata = new Map();
  for (const p of khataPayments) paidByKhata.set(String(p.khata_id), (paidByKhata.get(String(p.khata_id)) || 0) + num(p.amount));
  const customBills = khatas.filter((k) => String(k.vendor_id) === vid).map((k) => {
    const paid = paidByKhata.get(String(k.id)) || 0; const closed = String(k.status || '').toLowerCase() === 'closed';
    return { ...k, paid, remaining: closed ? 0 : Math.max(0, num(k.total_amount) - paid) };
  }).sort((a, b) => ts(b.date_created || b.created_at) - ts(a.date_created || a.created_at));
  const khataDue = r2(customBills.reduce((s, k) => s + k.remaining, 0));
  const kIds = new Set(customBills.map((k) => String(k.id)));

  const active = bills.filter((b) => !b.cancelled);
  const activeIds = new Set(active.map((b) => String(b.id)));
  const ledger = [];
  for (const b of active) ledger.push({ key: `p${b.id}`, date: b.date_created, type: 'Purchase', ref: b.no, detail: b.lines.length ? `${b.lines.length} item${b.lines.length === 1 ? '' : 's'}` : '', debit: b.total, credit: 0 });
  for (const p of vPayments) {
    const bill = !unlinked(p) ? bills.find((b) => String(b.id) === String(p.purchase_id)) : null;
    if (bill?.cancelled) continue;
    ledger.push({ key: `v${p.id}`, date: p.date_created || p.date_added, type: 'Payment', ref: bill ? bill.no : null, detail: p.notes || '', debit: 0, credit: num(p.amount) });
  }
  for (const r of vReturns) if (activeIds.has(String(r.purchase_id))) ledger.push({ key: `r${r.id}`, date: r.date_created, type: 'Return', ref: `PO #${r.purchase_id}`, detail: r.reason || '', debit: 0, credit: num(r.total_returned ?? r.total) });
  for (const k of customBills) ledger.push({ key: `k${k.id}`, date: k.date_created || k.created_at, type: 'Custom bill', ref: null, detail: k.title || k.description || '', debit: num(k.total_amount), credit: 0 });
  for (const p of khataPayments) if (kIds.has(String(p.khata_id))) ledger.push({ key: `kp${p.id}`, date: p.date_created || p.created_at, type: 'Bill payment', ref: null, detail: p.note || p.notes || '', debit: 0, credit: num(p.amount) });
  ledger.sort((a, b) => ts(a.date) - ts(b.date) || (a.debit ? -1 : 1));
  let run = 0;
  for (const row of ledger) { run = r2(run + row.debit - row.credit); row.balance = run; }

  const purchased = active.reduce((s, b) => s + b.total, 0);
  const paid = vPayments.filter((p) => unlinked(p) || activeIds.has(String(p.purchase_id))).reduce((s, p) => s + num(p.amount), 0);
  const returned = vReturns.filter((r) => activeIds.has(String(r.purchase_id))).reduce((s, r) => s + num(r.total_returned ?? r.total), 0);
  return {
    bills, payments: [...vPayments].sort((a, b) => ts(b.date_created || b.date_added) - ts(a.date_created || a.date_added)),
    customBills, ledger,
    totals: { purchased: r2(purchased), paid: r2(paid), returned: r2(returned), purchaseBalance, khataDue, totalDue: r2(purchaseBalance + khataDue), openBills: bills.filter((b) => b.remaining > 0.5).length },
  };
}

export function planVendorPayment(account, amount) {
  const open = [
    ...account.bills.filter((b) => b.remaining > 0.5).map((b) => ({ kind: 'purchase', id: b.id, date: b.date_created, remaining: b.remaining, label: b.no })),
    ...account.customBills.filter((k) => k.remaining > 0.5).map((k) => ({ kind: 'bill', id: k.id, date: k.date_created || k.created_at, remaining: k.remaining, label: k.title || 'Custom bill' })),
  ].sort((a, b) => ts(a.date) - ts(b.date));
  let left = r2(amount); const allocations = [];
  for (const o of open) {
    if (left <= 0.01) break;
    const take = r2(Math.min(left, o.remaining));
    allocations.push({ ...o, amount: take, clears: take >= o.remaining - 0.5 });
    left = r2(left - take);
  }
  return { allocations, advance: left > 0.01 ? left : 0 };
}

export function buildVendorPaymentEvents({ account, vendor, amount, note, accountId, nextId }) {
  const now = localStamp(); const group = newPaymentGroupId(); const memo = (note || '').trim() || 'Smart Pay';
  const { allocations, advance } = planVendorPayment(account, amount);
  const events = []; let linked = 0;
  for (const a of allocations) {
    if (a.kind !== 'purchase') continue;
    linked += a.amount;
    events.push({ entityType: 'vendor_payment', operation: 'create', payload: { id: nextId(), vendor_id: vendor.id, amount: a.amount, notes: memo, purchase_id: a.id, date_created: now, payment_group: group, account_id: accountId ? Number(accountId) : null } });
  }
  const rest = r2(amount - linked); // custom-bill share + anything extra (desktop keeps it unlinked)
  if (rest > 0.005) events.push({ entityType: 'vendor_payment', operation: 'create', payload: { id: nextId(), vendor_id: vendor.id, amount: rest, notes: memo, purchase_id: null, date_created: now, payment_group: group, account_id: accountId ? Number(accountId) : null } });
  if (accountId) events.push({ entityType: 'account_txn', operation: 'create', payload: { id: nextId(), account_id: Number(accountId), type: 'out', amount: r2(amount), category: 'purchase', note: `Vendor payment — ${memo} [SPG:${group}]`, date_created: now } });
  return { events, allocations, advance };
}
