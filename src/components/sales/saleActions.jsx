/* eslint-disable react-refresh/only-export-components */
/**
 * Shared sale logic for the Invoices and Transactions screens — one place for the desktop's
 * rules on what a sale still owes, and for return / edit / cancel events.
 */
import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { isCancelled, saleStatus, buildCancelSaleEvents, buildSaleRefundTxn } from '@/lib/ledger';
import { buildCustomerAccount, parseDate, localStamp } from '@/lib/customerAccount';
import { formatInvoiceId } from '../../utils/receipt';

export const num = (v) => Number(v) || 0;
export const r2 = (v) => Math.round(v * 100) / 100;
export const rs = (n) => 'Rs. ' + Math.round(num(n)).toLocaleString('en-PK');
export const qtyFmt = (n) => num(n).toLocaleString('en-PK', { maximumFractionDigits: 3 });
export const ts = (raw) => parseDate(raw)?.getTime() || 0;
export const fmtDay = (raw) => { const d = parseDate(raw); return d && !isNaN(d) ? d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; };
export const fmtTime = (raw) => { const d = parseDate(raw); return d && !isNaN(d) ? d.toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' }) : ''; };

/** Line display: weighed items in kg (price per kg), wholesale in boxes. */
export function lineView(it, product) {
  const q = num(it.quantity); const price = num(it.price);
  if (String(product?.unit_type || it.unit_type || '').toLowerCase() === 'gram') {
    return { qty: `${qtyFmt(q / 1000)} kg`, rate: `${rs(price * 1000)}/kg`, amount: q * price };
  }
  const unit = it.box_name || (num(it.carton_qty) > 0 ? 'box' : (product?.unit && product.unit !== 'pcs' ? product.unit : ''));
  return { qty: `${qtyFmt(q)}${unit ? ` ${unit}` : ''}`, rate: rs(price), amount: q * price };
}

/** Sale rows with the desktop get-invoices / get-sales rules for paid, returned and remaining. */
export function useSaleRows() {
  const { list } = useDataStore();
  const sales = list('sale'); const saleItems = list('sale_item'); const payments = list('customer_payment');
  const returns = list('sale_return'); const returnItems = list('sale_return_item');
  const customers = list('customer'); const products = list('product');

  return useMemo(() => {
    const cust = new Map(customers.map((c) => [String(c.id), c]));
    const prod = new Map(products.map((p) => [String(p.id), p]));
    const items = new Map();
    for (const it of saleItems) { const k = String(it.sale_id); if (!items.has(k)) items.set(k, []); items.get(k).push(it); }
    const sum = (arr, key, f = 'amount') => { const m = new Map(); for (const x of arr) { if (x[key] == null) continue; const k = String(x[key]); m.set(k, (m.get(k) || 0) + num(x[f])); } return m; };
    const paid = sum(payments, 'sale_id'); const ret = sum(returns, 'sale_id', 'total_returned');
    const refund = sum(returns, 'sale_id', 'cash_refunded'); const retQty = sum(returnItems, 'sale_item_id', 'quantity');

    return sales.map((s) => {
      const k = String(s.id); const customer = s.customer_id != null ? cust.get(String(s.customer_id)) || null : null;
      const st = saleStatus(s); const cancelled = isCancelled(s);
      const total = num(s.total); const p = paid.get(k) || 0; const returned = ret.get(k) || 0; const writeOff = num(s.write_off_amount);
      const remaining = (cancelled || !s.customer_id || ['returned', 'paid'].includes(st)) ? 0 : Math.max(0, total - p - returned - writeOff);
      const fullyReturned = st === 'returned' || (returned > 0 && returned >= total - 0.5);
      const state = cancelled ? 'cancelled' : fullyReturned ? 'returned' : remaining <= 0.5 ? 'paid' : (p > 0 || returned > 0) ? 'partial' : 'unpaid';
      const lines = (items.get(k) || []).map((it) => ({ ...it, returnedQty: retQty.get(String(it.id)) || 0, view: lineView(it, prod.get(String(it.product_id))) }));
      const no = formatInvoiceId(s.id, s.date_created);
      return {
        kind: 'sale', key: `s${k}`, id: s.id, raw: s, no, date: s.date_created,
        party: customer?.name || 'Walk-in customer', phone: customer?.phone || '', customer,
        total, subtotal: num(s.subtotal ?? s.total), discount: num(s.discount),
        paid: !s.customer_id && !cancelled ? total : p, returned, refunded: refund.get(k) || 0, writeOff,
        remaining: r2(remaining), state, edited: !!s.edited_at,
        method: s.payment_method || '', lines,
        itemsSummary: lines.map((l) => `${l.product_name} ×${qtyFmt(l.quantity)}`).join(', '),
        search: `${no} ${s.id} ${customer?.name || 'walk-in'} ${customer?.phone || ''} ${s.payment_method || ''} ${lines.map((l) => l.product_name).join(' ')}`.toLowerCase(),
      };
    }).sort((a, b) => ts(b.date) - ts(a.date) || num(b.id) - num(a.id));
  }, [sales, saleItems, payments, returns, returnItems, customers, products]);
}

/** Edit items and cancel — stock follows the change; the customer's balance moves with the total. */
export function useSaleActions() {
  const { list, get, pushBatch } = useDataStore();
  const { showToast } = useToast();

  const cancelSale = async (row) => {
    const events = buildCancelSaleEvents({
      sale: get('sale', row.id) || row.raw, items: row.lines, customer: row.customer, products: list('product'),
      payments: list('customer_payment'), returns: list('sale_return'), returnItems: list('sale_return_item'), now: localStamp(),
    });
    if (!events) { showToast('This invoice is already cancelled', 'error'); return; }
    // Desktop recomputeCustomerBalance after cancel: rebuild from the data as it will be, not from
    // the stored (possibly stale) balance, and allow credit (negative).
    if (row.customer) {
      const gone = new Set(events.filter((e) => e.entityType === 'customer_payment' && e.operation === 'delete').map((e) => String(e.payload.id)));
      const acct = buildCustomerAccount({
        customer: row.customer,
        sales: list('sale').map((s) => (String(s.id) === String(row.id) ? { ...s, status: 'Cancelled' } : s)),
        payments: list('customer_payment').filter((p) => !gone.has(String(p.id))),
        returns: list('sale_return'),
      });
      const ev = events.find((e) => e.entityType === 'customer' && String(e.payload.id) === String(row.customer.id));
      if (ev) ev.payload = { ...ev.payload, outstanding_balance: r2(acct.totals.invoiceBalance) };
      else events.push({ entityType: 'customer', operation: 'update', payload: { ...row.customer, outstanding_balance: r2(acct.totals.invoiceBalance), updated_at: localStamp() } });
    }
    await pushBatch(events);
    showToast(`${row.no} cancelled · stock restored`);
  };

  const saveEdit = async (row, { lines, subtotal, discount, total }) => {
    const now = localStamp();
    const sale = get('sale', row.id) || row.raw;
    const events = [{ entityType: 'sale', operation: 'update', payload: { ...sale, subtotal, discount, total, edited_at: now } }];
    const byId = new Map(row.lines.map((i) => [String(i.id), i]));
    const kept = new Set(lines.filter((l) => l.saleItemId != null).map((l) => String(l.saleItemId)));
    const delta = new Map();
    const bump = (pid, d) => { if (pid != null && d) delta.set(String(pid), (delta.get(String(pid)) || 0) + d); };
    for (const o of row.lines) {
      if (kept.has(String(o.id))) continue;
      events.push({ entityType: 'sale_item', operation: 'delete', payload: { id: o.id } });
      bump(o.product_id, num(o.quantity));
    }
    for (const l of lines) {
      const o = l.saleItemId != null ? byId.get(String(l.saleItemId)) : null;
      // eslint-disable-next-line no-unused-vars
      const { view, returnedQty, ...base } = o || {};
      bump(l.product_id, (o ? num(o.quantity) : 0) - num(l.qty));
      events.push({ entityType: 'sale_item', operation: o ? 'update' : 'create', payload: {
        ...base, id: l.saleItemId ?? undefined, sale_id: row.id, product_id: l.product_id, product_name: l.name, quantity: l.qty, price: l.price,
        purchase_price: l.purchase_price, is_custom: l.isCustom ? 1 : 0, created_at: o?.created_at || now, date_created: o?.date_created || now,
      } });
    }
    const products = list('product');
    for (const [pid, d] of delta) {
      const p = products.find((x) => String(x.id) === pid);
      if (p && d) events.push({ entityType: 'product', operation: 'update', payload: { ...p, stock: Math.max(0, num(p.stock) + d), updated_at: now } });
    }
    if (row.customer && Math.abs(total - row.total) > 0.005) {
      const acct = buildCustomerAccount({ customer: row.customer, sales: list('sale'), payments: list('customer_payment'), returns: list('sale_return') });
      events.push({ entityType: 'customer', operation: 'update', payload: { ...row.customer, outstanding_balance: r2(acct.totals.invoiceBalance + (total - row.total)), updated_at: now } });
    }
    await pushBatch(events);
    showToast(`${row.no} updated`);
  };

  return { cancelSale, saveEdit };
}

export function CancelSaleDialog({ row, onClose, onConfirm }) {
  return (
    <Dialog open={!!row} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogTitle>Cancel {row?.no}?</DialogTitle>
        <DialogDescription>Stock goes back, payments on it are reversed and it stops counting in sales. This can’t be undone.</DialogDescription>
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted">Keep it</button>
          <button type="button" onClick={onConfirm} className="h-9 px-4 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700">Cancel invoice</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Return items: credit comes off what the customer still owes first, the rest is cash back. */
export function ReturnDialog({ row, onClose }) {
  const { list, pushBatch, nextId } = useDataStore();
  const { showToast } = useToast();
  const [qty, setQty] = useState({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setQty({}); setReason(''); }, [row]);

  const returnedOf = useMemo(() => {
    if (!row) return () => 0;
    const ids = new Set(list('sale_return').filter((x) => String(x.sale_id) === String(row.id)).map((x) => String(x.id)));
    const prior = list('sale_return_item').filter((ri) => ids.has(String(ri.return_id)));
    return (it) => prior.filter((ri) => (ri.sale_item_id != null ? String(ri.sale_item_id) === String(it.id) : String(ri.product_id) === String(it.product_id)))
      .reduce((a, ri) => a + num(ri.quantity), 0);
  }, [row, list]);

  if (!row) return null;
  const lines = row.lines.map((it) => ({ ...it, left: Math.max(0, num(it.quantity) - returnedOf(it)) }));
  const lineTotal = lines.reduce((s, it) => s + Math.min(num(qty[it.id]), it.left) * num(it.price), 0);
  const refund = r2(Math.max(0, Math.min(lineTotal, row.total - row.returned)));
  const offBalance = row.customer ? r2(Math.min(row.remaining, refund)) : 0;
  const cash = r2(refund - offBalance);
  const step = (it, d) => setQty((q) => ({ ...q, [it.id]: Math.max(0, Math.min(it.left, r2(num(q[it.id]) + d))) }));

  const submit = async () => {
    const picked = lines.filter((it) => num(qty[it.id]) > 0);
    if (!picked.length) return showToast('Choose what is coming back', 'error');
    setBusy(true);
    try {
      const now = localStamp();
      const returnId = nextId();
      const refundTxn = buildSaleRefundTxn({ saleId: row.id, amount: cash, accounts: list('account'), accountTxns: list('account_txn'), now });
      const events = [{ entityType: 'sale_return', operation: 'create', payload: {
        id: returnId, sale_id: row.id, customer_id: row.raw.customer_id ?? null, date_created: now, reason: reason.trim(),
        total_returned: refund, cash_refunded: cash, refund_account_id: refundTxn?.accountId ?? null,
      } }];
      if (refundTxn) events.push(refundTxn.event);
      const products = list('product');
      for (const it of picked) {
        const q = Math.min(num(qty[it.id]), it.left);
        events.push({ entityType: 'sale_return_item', operation: 'create', payload: {
          return_id: returnId, sale_item_id: it.id, product_id: it.product_id, product_name: it.product_name, quantity: q, price: it.price, date_created: now,
        } });
        const p = products.find((x) => String(x.id) === String(it.product_id));
        if (p) events.push({ entityType: 'product', operation: 'update', payload: { ...p, stock: num(p.stock) + q, updated_at: now } });
      }
      if (row.customer && offBalance > 0.009) {
        const acct = buildCustomerAccount({ customer: row.customer, sales: list('sale'), payments: list('customer_payment'), returns: list('sale_return') });
        events.push({ entityType: 'customer', operation: 'update', payload: { ...row.customer, outstanding_balance: r2(acct.totals.invoiceBalance - offBalance), updated_at: now } });
      }
      await pushBatch(events);
      showToast(`Return saved · ${rs(refund)}`);
      onClose();
    } catch (e) { showToast(e?.message || 'Could not save the return', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="w-full max-w-[520px] gap-0 p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="text-base font-semibold">Return items</DialogTitle>
          <DialogDescription className="mt-0.5 text-xs">{row.no} · {row.party}</DialogDescription>
        </div>
        <ul className="max-h-[46vh] overflow-y-auto divide-y divide-border/60 px-6">
          {lines.map((it) => (
            <li key={it.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{it.product_name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{it.view.rate} · {it.left > 0 ? `${qtyFmt(it.left)} can come back` : 'All returned'}</p>
              </div>
              <div className={cn('inline-flex items-center rounded-lg border border-border', it.left <= 0 && 'opacity-40 pointer-events-none')}>
                <button type="button" onClick={() => step(it, -1)} className="h-8 w-8 inline-flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label={`Less ${it.product_name}`}><Minus size={14} /></button>
                <input inputMode="decimal" value={qty[it.id] ?? ''} placeholder="0" aria-label={`Return quantity for ${it.product_name}`}
                  onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ''); setQty((q) => ({ ...q, [it.id]: v === '' ? '' : Math.min(it.left, num(v)) })); }}
                  className="w-12 h-8 bg-transparent text-center text-sm font-semibold tabular-nums outline-none" />
                <button type="button" onClick={() => step(it, 1)} className="h-8 w-8 inline-flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label={`More ${it.product_name}`}><Plus size={14} /></button>
              </div>
            </li>
          ))}
        </ul>
        <div className="px-6 py-4 border-t border-border grid gap-3">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional) — e.g. damaged, wrong size"
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/25" />
          {refund > 0 && (
            <div className="rounded-xl bg-muted/40 px-4 py-3 text-sm grid gap-1">
              <div className="flex justify-between font-semibold text-foreground"><span>Return value</span><span className="tabular-nums">{rs(refund)}</span></div>
              {offBalance > 0 && <div className="flex justify-between text-muted-foreground"><span>Comes off their balance</span><span className="tabular-nums">{rs(offBalance)}</span></div>}
              {cash > 0 && <div className="flex justify-between text-muted-foreground"><span>Cash to give back</span><span className="tabular-nums">{rs(cash)}</span></div>}
              {lineTotal > refund + 0.5 && <p className="text-xs text-muted-foreground">Capped at what’s left of the bill after its discount and earlier returns.</p>}
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="h-11 px-4 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted">Cancel</button>
            <button type="button" onClick={submit} disabled={busy || refund <= 0}
              className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">{busy ? 'Saving…' : `Save return${refund > 0 ? ` · ${rs(refund)}` : ''}`}</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
