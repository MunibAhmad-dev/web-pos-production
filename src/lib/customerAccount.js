/**
 * Customer account maths, following the desktop app exactly:
 *  - balance  = Σ(non-cancelled invoice total − write-off) − Σ(all payments) − Σ(returns − cash refunded)
 *               (can be negative = the customer has credit)
 *  - invoice remaining = total − payments linked to it − its returns − write-off, then lump payments
 *    (not tied to any invoice) cover the oldest invoices first
 *  - custom bills (khata) are tracked separately and added on top
 */
import { isCancelled, saleStatus } from '@/lib/ledger';

export const parseDate = (raw) => (raw ? new Date(String(raw).replace(' ', 'T')) : null);
const ts = (raw) => parseDate(raw)?.getTime() || 0;
const num = (v) => Number(v) || 0;
const round2 = (v) => Math.round(v * 100) / 100;

/** Local "YYYY-MM-DD HH:MM:SS" — the format the desktop stores and filters on. */
export function localStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function newPaymentGroupId() {
  return `sp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Open custom bills for one customer, with what's left on each. */
export function customerKhatas(customerId, khatas = [], khataPayments = []) {
  const paidBy = new Map();
  for (const p of khataPayments) paidBy.set(String(p.khata_id), (paidBy.get(String(p.khata_id)) || 0) + num(p.amount));
  return khatas
    .filter((k) => String(k.customer_id) === String(customerId))
    .map((k) => {
      const paid = paidBy.get(String(k.id)) || 0;
      const closed = String(k.status || '').toLowerCase() === 'closed';
      return { ...k, paid, remaining: closed ? 0 : Math.max(0, num(k.total_amount) - paid) };
    })
    .sort((a, b) => ts(b.date_created || b.created_at) - ts(a.date_created || a.created_at));
}

/** Everything the customer screen needs for one customer. */
export function buildCustomerAccount({ customer, sales = [], saleItems = [], payments = [], returns = [], khatas = [], khataPayments = [] }) {
  const cid = String(customer.id);
  const custSales = sales.filter((s) => String(s.customer_id) === cid);
  const saleIds = new Set(custSales.map((s) => String(s.id)));
  const custPayments = payments.filter((p) => String(p.customer_id) === cid);
  const custReturns = returns.filter((r) => saleIds.has(String(r.sale_id)));

  const itemsBySale = new Map();
  for (const it of saleItems) {
    const k = String(it.sale_id);
    if (!saleIds.has(k)) continue;
    if (!itemsBySale.has(k)) itemsBySale.set(k, []);
    itemsBySale.get(k).push(it);
  }
  const paidBySale = new Map();
  let unlinkedPool = 0;
  for (const p of custPayments) {
    if (p.sale_id == null || p.sale_id === '') unlinkedPool += num(p.amount);
    else paidBySale.set(String(p.sale_id), (paidBySale.get(String(p.sale_id)) || 0) + num(p.amount));
  }
  const retBySale = new Map(); const refundBySale = new Map();
  for (const r of custReturns) {
    const k = String(r.sale_id);
    retBySale.set(k, (retBySale.get(k) || 0) + num(r.total_returned));
    refundBySale.set(k, (refundBySale.get(k) || 0) + num(r.cash_refunded));
  }

  // Per-invoice remaining before lump payments
  const invoices = custSales.map((s) => {
    const k = String(s.id);
    const st = saleStatus(s);
    const cancelled = isCancelled(s);
    const total = num(s.total);
    const paid = paidBySale.get(k) || 0;
    const returned = retBySale.get(k) || 0;
    const writeOff = num(s.write_off_amount);
    const raw = (cancelled || st === 'returned') ? 0 : Math.max(0, total - paid - returned - writeOff);
    return { ...s, items: itemsBySale.get(k) || [], total, paid, returned, refunded: refundBySale.get(k) || 0, writeOff, cancelled, rawRemaining: raw };
  });
  // Lump payments cover the oldest open invoices first
  let pool = unlinkedPool;
  const byOldest = [...invoices].sort((a, b) => ts(a.date_created) - ts(b.date_created) || num(a.id) - num(b.id));
  const lumpCredit = new Map();
  for (const inv of byOldest) {
    if (pool <= 0.01) break;
    if (inv.rawRemaining <= 0.01) continue;
    const take = Math.min(pool, inv.rawRemaining);
    lumpCredit.set(String(inv.id), take);
    pool -= take;
  }
  for (const inv of invoices) {
    inv.remaining = round2(Math.max(0, inv.rawRemaining - (lumpCredit.get(String(inv.id)) || 0)));
    inv.state = inv.cancelled ? 'cancelled' : saleStatus(inv) === 'returned' ? 'returned'
      : inv.remaining <= 0.5 ? 'paid' : (inv.paid > 0 || lumpCredit.has(String(inv.id))) ? 'partial' : 'unpaid';
  }
  invoices.sort((a, b) => ts(b.date_created) - ts(a.date_created));

  // Totals (desktop recomputeCustomerBalance)
  const active = invoices.filter((i) => !i.cancelled);
  const purchased = active.reduce((s, i) => s + i.total - i.writeOff, 0);
  const paidTotal = custPayments.reduce((s, p) => s + num(p.amount), 0);
  const activeIds = new Set(active.map((i) => String(i.id)));
  const returnedNet = custReturns.filter((r) => activeIds.has(String(r.sale_id)))
    .reduce((s, r) => s + num(r.total_returned) - num(r.cash_refunded), 0);
  const invoiceBalance = round2(purchased - paidTotal - returnedNet);

  const bills = customerKhatas(cid, khatas, khataPayments);
  const khataDue = round2(bills.reduce((s, k) => s + k.remaining, 0));
  const billIds = new Set(bills.map((k) => String(k.id)));
  const billPayments = khataPayments.filter((p) => billIds.has(String(p.khata_id)));

  // Ledger: debit raises what they owe, credit lowers it
  const ledger = [];
  for (const i of invoices) {
    if (i.cancelled) continue;
    ledger.push({ key: `s${i.id}`, date: i.date_created, type: 'Invoice', ref: i.id, detail: i.items.length ? `${i.items.length} item${i.items.length === 1 ? '' : 's'}` : '', debit: i.total, credit: 0 });
    if (i.writeOff > 0) ledger.push({ key: `w${i.id}`, date: i.date_created, type: 'Write-off', ref: i.id, detail: 'Balance written off', debit: 0, credit: i.writeOff });
  }
  for (const p of custPayments) {
    ledger.push({ key: `p${p.id}`, date: p.date_added || p.date_created, type: 'Payment', ref: p.sale_id || null, detail: p.notes || p.payment_method || '', debit: 0, credit: num(p.amount), group: p.payment_group || null });
  }
  for (const r of custReturns) {
    if (!activeIds.has(String(r.sale_id))) continue;
    ledger.push({ key: `r${r.id}`, date: r.date_created, type: 'Return', ref: r.sale_id, detail: r.reason || '', debit: 0, credit: num(r.total_returned) });
    if (num(r.cash_refunded) > 0) ledger.push({ key: `rf${r.id}`, date: r.date_created, type: 'Refund', ref: r.sale_id, detail: 'Cash given back', debit: num(r.cash_refunded), credit: 0 });
  }
  for (const k of bills) {
    ledger.push({ key: `k${k.id}`, date: k.date_created || k.created_at, type: 'Custom bill', ref: null, detail: k.title || k.notes || '', debit: num(k.total_amount), credit: 0 });
  }
  for (const p of billPayments) {
    ledger.push({ key: `kp${p.id}`, date: p.date_created || p.created_at, type: 'Bill payment', ref: null, detail: p.note || p.notes || '', debit: 0, credit: num(p.amount) });
  }
  ledger.sort((a, b) => ts(a.date) - ts(b.date) || (a.debit ? -1 : 1));
  let running = 0;
  for (const row of ledger) { running = round2(running + row.debit - row.credit); row.balance = running; }

  return {
    invoices,
    payments: [...custPayments].sort((a, b) => ts(b.date_added || b.date_created) - ts(a.date_added || a.date_created)),
    returns: custReturns,
    bills,
    ledger,
    totals: {
      purchased: round2(purchased), paid: round2(paidTotal), returned: round2(returnedNet),
      invoiceBalance, khataDue, totalDue: round2(invoiceBalance + khataDue),
      openInvoices: invoices.filter((i) => i.remaining > 0.5).length,
    },
  };
}

/** Same oldest-first spread the desktop's Smart Pay uses: invoices and custom bills together. */
export function planPayment(account, amount) {
  const open = [
    ...account.invoices.filter((i) => i.remaining > 0.5).map((i) => ({ kind: 'invoice', id: i.id, date: i.date_created, remaining: i.remaining, label: i.id })),
    ...account.bills.filter((k) => k.remaining > 0.5).map((k) => ({ kind: 'bill', id: k.id, date: k.date_created || k.created_at, remaining: k.remaining, label: k.title || 'Custom bill' })),
  ].sort((a, b) => ts(a.date) - ts(b.date));
  let left = round2(amount);
  const allocations = [];
  for (const o of open) {
    if (left <= 0.01) break;
    const take = round2(Math.min(left, o.remaining));
    allocations.push({ ...o, amount: take, clears: take >= o.remaining - 0.5 });
    left = round2(left - take);
  }
  return { allocations, advance: left > 0.01 ? left : 0 };
}

/** Sync events for a received payment (customer payments + bill payments + cash/bank entries + statuses). */
export function buildPaymentEvents({ account, customer, amount, note, accountId, method, nextId, sales = [] }) {
  const now = localStamp();
  const group = newPaymentGroupId();
  const memo = (note || '').trim() || 'Smart Pay';
  const { allocations, advance } = planPayment(account, amount);
  const events = [];
  let customerCash = 0;
  for (const a of allocations) {
    if (a.kind === 'invoice') {
      customerCash += a.amount;
      events.push({ entityType: 'customer_payment', operation: 'create', payload: {
        id: nextId(), customer_id: customer.id, amount: a.amount, notes: memo, sale_id: a.id,
        account_id: accountId ? Number(accountId) : null, payment_method: method, date_added: now, payment_group: group,
      } });
      const sale = sales.find((s) => String(s.id) === String(a.id));
      if (sale) events.push({ entityType: 'sale', operation: 'update', payload: { ...sale, status: a.clears ? 'paid' : 'partial' } });
    } else {
      events.push({ entityType: 'customer_khata_payment', operation: 'create', payload: {
        id: nextId(), khata_id: a.id, amount: a.amount, note: memo, date_created: now,
      } });
      if (accountId) events.push({ entityType: 'account_txn', operation: 'create', payload: {
        id: nextId(), account_id: Number(accountId), type: 'in', amount: a.amount, category: 'sale',
        note: `Custom Bill Payment Received — ${a.label} — ${memo}`, date_created: now,
      } });
    }
  }
  if (advance > 0) {
    customerCash += advance;
    events.push({ entityType: 'customer_payment', operation: 'create', payload: {
      id: nextId(), customer_id: customer.id, amount: advance, notes: memo, sale_id: null,
      account_id: accountId ? Number(accountId) : null, payment_method: method, date_added: now, payment_group: group,
    } });
  }
  if (customerCash > 0.005 && accountId) {
    events.push({ entityType: 'account_txn', operation: 'create', payload: {
      id: nextId(), account_id: Number(accountId), type: 'in', amount: round2(customerCash), category: 'sale',
      note: `Customer payment received — ${memo} [SPG:${group}]`, date_created: now,
    } });
  }
  if (customerCash > 0.005) {
    events.push({ entityType: 'customer', operation: 'update', payload: {
      ...customer, outstanding_balance: round2(account.totals.invoiceBalance - customerCash), updated_at: now,
    } });
  }
  return { events, allocations, advance };
}
