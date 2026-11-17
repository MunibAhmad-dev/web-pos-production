import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, ChevronLeft, ChevronDown, Printer, FileDown, MessageCircle, Undo2, PencilLine, Ban,
  ArrowUpRight, ArrowDownLeft, FileText, Minus, Plus, ExternalLink, Lock,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import EditSaleModal from '../../components/sales/EditSaleModal';
import { isCancelled, saleStatus, buildCancelSaleEvents, buildSaleRefundTxn } from '@/lib/ledger';
import { buildCustomerAccount, parseDate, localStamp } from '@/lib/customerAccount';
import { getReceiptSettings, printInvoice, downloadInvoicePdf, buildWhatsAppLink, formatInvoiceId } from '../../utils/receipt';

/* ── Formatting ───────────────────────────────────────────────────────────── */
const num = (v) => Number(v) || 0;
const r2 = (v) => Math.round(v * 100) / 100;
const rs = (n) => 'Rs. ' + Math.round(num(n)).toLocaleString('en-PK');
const ts = (raw) => parseDate(raw)?.getTime() || 0;
const fmtDay = (raw) => { const d = parseDate(raw); return d && !isNaN(d) ? d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; };
const fmtTime = (raw) => { const d = parseDate(raw); return d && !isNaN(d) ? d.toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' }) : ''; };
const qtyFmt = (n) => num(n).toLocaleString('en-PK', { maximumFractionDigits: 3 });

function dayLabel(raw) {
  const d = parseDate(raw);
  if (!d || isNaN(d)) return 'Undated';
  const sod = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((sod(new Date()) - sod(d)) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

const PERIODS = [['all', 'All time'], ['today', 'Today'], ['week', 'Last 7 days'], ['month', 'This month'], ['custom', 'Custom']];
function periodStart(period, from) {
  const n = new Date();
  if (period === 'today') return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  if (period === 'week') return new Date(n.getFullYear(), n.getMonth(), n.getDate() - 6);
  if (period === 'month') return new Date(n.getFullYear(), n.getMonth(), 1);
  if (period === 'custom' && from) return new Date(`${from}T00:00:00`);
  return null;
}

const STATE = {
  paid: ['Paid', 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', 'text-emerald-600 border-emerald-600/40'],
  partial: ['Part paid', 'bg-amber-500/12 text-amber-800 dark:text-amber-400', 'text-amber-600 border-amber-600/40'],
  unpaid: ['Unpaid', 'bg-rose-500/10 text-rose-700 dark:text-rose-400', 'text-rose-600 border-rose-600/40'],
  returned: ['Returned', 'bg-muted text-muted-foreground', 'text-muted-foreground border-border'],
  cancelled: ['Cancelled', 'bg-muted text-muted-foreground', 'text-muted-foreground border-border'],
};
const STATUS_FILTERS = [['all', 'All'], ['unpaid', 'Unpaid'], ['partial', 'Part paid'], ['paid', 'Paid'], ['returned', 'Returned'], ['cancelled', 'Cancelled']];

/* ── Line display: weighed items in kg, wholesale in boxes ───────────────── */
function lineView(it, product) {
  const q = num(it.quantity); const price = num(it.price);
  if (String(product?.unit_type || it.unit_type || '').toLowerCase() === 'gram') {
    return { qty: `${qtyFmt(q / 1000)} kg`, rate: `${rs(price * 1000)}/kg`, amount: q * price };
  }
  const unit = it.box_name || (num(it.carton_qty) > 0 ? 'box' : (product?.unit && product.unit !== 'pcs' ? product.unit : ''));
  return { qty: `${qtyFmt(q)}${unit ? ` ${unit}` : ''}`, rate: rs(price), amount: q * price };
}

/* ── Rows (desktop get-invoices rules) ────────────────────────────────────── */
function useInvoiceRows() {
  const { list } = useDataStore();
  const sales = list('sale'); const saleItems = list('sale_item'); const payments = list('customer_payment');
  const returns = list('sale_return'); const returnItems = list('sale_return_item'); const customers = list('customer'); const products = list('product');
  const purchases = list('purchase'); const purchaseItems = list('purchase_item'); const batches = list('inventory_batch');
  const vendorPayments = list('vendor_payment'); const purchaseReturns = list('purchase_return'); const vendors = list('vendor');

  return useMemo(() => {
    const byId = (arr) => new Map(arr.map((x) => [String(x.id), x]));
    const cust = byId(customers); const vend = byId(vendors); const prod = byId(products);
    const group = (arr, key) => { const m = new Map(); for (const x of arr) { const k = String(x[key]); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };
    const sum = (arr, key, f = 'amount') => { const m = new Map(); for (const x of arr) { if (x[key] == null) continue; const k = String(x[key]); m.set(k, (m.get(k) || 0) + num(x[f])); } return m; };
    const items = group(saleItems, 'sale_id'); const paid = sum(payments, 'sale_id');
    const retQty = sum(returnItems, 'sale_item_id', 'quantity');
    const ret = sum(returns, 'sale_id', 'total_returned'); const refund = sum(returns, 'sale_id', 'cash_refunded');

    const saleRows = sales.map((s) => {
      const k = String(s.id); const customer = s.customer_id != null ? cust.get(String(s.customer_id)) || null : null;
      const st = saleStatus(s); const cancelled = isCancelled(s);
      const total = num(s.total); const p = paid.get(k) || 0; const returned = ret.get(k) || 0; const writeOff = num(s.write_off_amount);
      const remaining = (cancelled || !s.customer_id || ['returned', 'paid'].includes(st)) ? 0 : Math.max(0, total - p - returned - writeOff);
      const state = cancelled ? 'cancelled' : (st === 'returned' || (returned > 0 && returned >= total - 0.5)) ? 'returned'
        : remaining <= 0.5 ? 'paid' : (p > 0 || returned > 0) ? 'partial' : 'unpaid';
      const lines = items.get(k) || [];
      return {
        kind: 'sale', key: `s${k}`, id: s.id, raw: s, no: formatInvoiceId(s.id, s.date_created), date: s.date_created,
        party: customer?.name || 'Walk-in customer', phone: customer?.phone || '', customer, total, subtotal: num(s.subtotal ?? s.total), discount: num(s.discount),
        paid: !s.customer_id && !cancelled ? total : p, returned, refunded: refund.get(k) || 0, writeOff, remaining: r2(remaining), state,
        method: s.payment_method || '', lines: lines.map((it) => ({ ...it, returnedQty: retQty.get(String(it.id)) || 0, view: lineView(it, prod.get(String(it.product_id))) })),
        search: `${formatInvoiceId(s.id, s.date_created)} ${s.id} ${customer?.name || 'walk-in'} ${customer?.phone || ''} ${lines.map((l) => l.product_name).join(' ')}`.toLowerCase(),
      };
    });

    const pItems = group(purchaseItems, 'purchase_id'); const pBatches = group(batches, 'purchase_id');
    const vPaid = sum(vendorPayments, 'purchase_id'); const pRet = sum(purchaseReturns, 'purchase_id', 'total_returned');
    const purchaseRows = purchases.map((pu) => {
      const k = String(pu.id); const vendor = vend.get(String(pu.vendor_id));
      let embedded = pu.items;
      if (typeof embedded === 'string') { try { embedded = JSON.parse(embedded); } catch { embedded = null; } }
      const src = pItems.get(k) || (Array.isArray(embedded) && embedded.length ? embedded : null) || pBatches.get(k) || [];
      const lines = src.map((it, i) => {
        const product = prod.get(String(it.product_id));
        const quantity = num(it.quantity ?? it.quantity_added); const price = num(it.purchase_price ?? it.unit_cost ?? it.cost_price);
        return { id: it.id ?? `${k}-${i}`, product_name: it.product_name || product?.name || 'Item', quantity, price, view: { qty: qtyFmt(quantity), rate: rs(price), amount: quantity * price } };
      });
      const st = String(pu.status || '').toLowerCase(); const total = num(pu.grand_total ?? pu.total);
      const p = vPaid.get(k) || 0; const returned = pRet.get(k) || 0;
      const remaining = ['cancelled', 'returned'].includes(st) ? 0 : Math.max(0, total - p - returned);
      const state = st === 'cancelled' ? 'cancelled' : st === 'returned' ? 'returned' : remaining <= 0.5 ? 'paid' : (p > 0 || returned > 0) ? 'partial' : 'unpaid';
      return {
        kind: 'purchase', key: `p${k}`, id: pu.id, raw: pu, no: pu.bill_no ? `Bill ${pu.bill_no}` : `PO #${pu.id}`, date: pu.date_created,
        party: vendor?.name || 'Unknown vendor', phone: vendor?.phone || '', total, subtotal: total + num(pu.discount), discount: num(pu.discount),
        paid: p, returned, refunded: 0, writeOff: 0, remaining: r2(remaining), state, method: '', lines,
        search: `po #${pu.id} ${pu.bill_no || ''} ${vendor?.name || ''} ${lines.map((l) => l.product_name).join(' ')}`.toLowerCase(),
      };
    });
    return [...saleRows, ...purchaseRows].sort((a, b) => ts(b.date) - ts(a.date) || num(b.id) - num(a.id));
  }, [sales, saleItems, payments, returns, returnItems, customers, products, purchases, purchaseItems, batches, vendorPayments, purchaseReturns, vendors]);
}

/* ── Return items ─────────────────────────────────────────────────────────── */
function ReturnDialog({ row, onClose }) {
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
        events.push({ entityType: 'customer', operation: 'update', payload: { ...row.customer, outstanding_balance: r2(acct.totals.invoiceBalance - (refund - cash)), updated_at: now } });
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
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)"
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

/* ── Invoice document ─────────────────────────────────────────────────────── */
function InvoiceDocument({ row, store }) {
  const s = { ...getReceiptSettings(), ...store };
  const [label, , stamp] = STATE[row.state];
  const isSale = row.kind === 'sale';
  return (
    <article className="relative mx-auto w-full max-w-[640px] rounded-2xl bg-white text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,.06),0_12px_32px_-12px_rgba(0,0,0,.18)] ring-1 ring-black/5 dark:bg-zinc-50">
      <div className="h-1.5 rounded-t-2xl bg-gradient-to-r from-primary via-primary/70 to-primary/40" aria-hidden="true" />
      <div className="px-6 sm:px-9 pt-7 pb-8">
        <header className="flex flex-col-reverse gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-display text-lg font-extrabold tracking-tight">{s.store_name || 'My Store'}</p>
            {s.store_address && <p className="mt-0.5 text-xs text-zinc-500">{s.store_address}</p>}
            {s.store_phone && <p className="text-xs text-zinc-500 tabular-nums">{s.store_phone}</p>}
          </div>
          <div className="sm:text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{isSale ? 'Sale invoice' : 'Purchase bill'}</p>
            <p className="mt-1 font-mono text-base font-semibold tabular-nums">{row.no}</p>
            <p className="text-xs text-zinc-500 tabular-nums">{fmtDay(row.date)} · {fmtTime(row.date)}</p>
          </div>
        </header>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-y border-dashed border-zinc-200 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{isSale ? 'Billed to' : 'From vendor'}</p>
            <p className="mt-1 text-sm font-semibold">{row.party}</p>
            {row.phone && <p className="text-xs text-zinc-500 tabular-nums">{row.phone}</p>}
          </div>
          <span className={cn('rotate-[-4deg] rounded-md border-2 px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-[0.12em]', stamp)}>{label}</span>
        </div>

        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.08em] text-zinc-500">
                <th className="py-2.5 text-left font-semibold">Item</th>
                <th className="py-2.5 px-2 text-right font-semibold">Qty</th>
                <th className="hidden sm:table-cell py-2.5 px-2 text-right font-semibold">Rate</th>
                <th className="py-2.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {row.lines.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-xs text-zinc-500">Item lines for this bill haven’t synced to the web yet.</td></tr>}
              {row.lines.map((it) => (
                <tr key={it.id}>
                  <td className="py-2.5 pr-2">{it.product_name}{it.returnedQty > 0 && <span className="ml-2 rounded bg-zinc-100 px-1.5 py-px text-[10px] font-semibold text-zinc-600 tabular-nums">{qtyFmt(it.returnedQty)} returned</span>}<span className="block sm:hidden text-[11px] text-zinc-500 tabular-nums">{it.view.rate} each</span></td>
                  <td className="py-2.5 px-2 text-right tabular-nums whitespace-nowrap">{it.view.qty}</td>
                  <td className="hidden sm:table-cell py-2.5 px-2 text-right tabular-nums whitespace-nowrap text-zinc-600">{it.view.rate}</td>
                  <td className="py-2.5 text-right tabular-nums whitespace-nowrap font-medium">{rs(it.view.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="mt-4 ml-auto w-full max-w-[280px] grid gap-1.5 text-sm">
          {row.discount > 0 && <>
            <div className="flex justify-between text-zinc-600"><dt>Subtotal</dt><dd className="tabular-nums">{rs(row.subtotal)}</dd></div>
            <div className="flex justify-between text-zinc-600"><dt>Discount</dt><dd className="tabular-nums">− {rs(row.discount)}</dd></div>
          </>}
          <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-bold"><dt>Total</dt><dd className="tabular-nums">{rs(row.total)}</dd></div>
          {row.state !== 'cancelled' && <>
            <div className="flex justify-between text-zinc-600"><dt>Paid</dt><dd className="tabular-nums">{rs(row.paid)}</dd></div>
            {row.returned > 0 && <div className="flex justify-between text-zinc-600"><dt>Returned</dt><dd className="tabular-nums">− {rs(row.returned)}</dd></div>}
            {row.refunded > 0 && <div className="flex justify-between text-zinc-500 text-xs"><dt>of which cash given back</dt><dd className="tabular-nums">{rs(row.refunded)}</dd></div>}
            {row.writeOff > 0 && <div className="flex justify-between text-zinc-600"><dt>Written off</dt><dd className="tabular-nums">− {rs(row.writeOff)}</dd></div>}
            <div className={cn('mt-1 flex justify-between rounded-lg px-3 py-2 font-semibold', row.remaining > 0.5 ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800')}>
              <dt>{row.remaining > 0.5 ? 'Balance due' : 'Nothing due'}</dt><dd className="tabular-nums">{rs(row.remaining)}</dd>
            </div>
          </>}
        </dl>
        {isSale && row.method && <p className="mt-6 text-xs text-zinc-500">Payment method: {String(row.method).toLowerCase()}{s.receipt_footer ? ` · ${s.receipt_footer}` : ''}</p>}
      </div>
    </article>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */

export default function InvoicesPage() {
  const navigate = useNavigate();
  const { list, get, pushBatch } = useDataStore();
  const { showToast } = useToast();
  const { user } = useAuth();
  const rows = useInvoiceRows();
  // Shop details: receipt settings on this browser, else what the counter app synced
  const store = useMemo(() => {
    const local = getReceiptSettings(); const synced = list('settings')?.[0] || {};
    return {
      store_name: local.store_name || synced.store_name || user?.store_name || 'My Store',
      store_address: local.store_address || synced.store_address || '',
      store_phone: local.store_phone || synced.store_phone || '',
    };
  }, [list, user]);

  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [period, setPeriod] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(80);
  const [selectedKey, setSelectedKey] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [returning, setReturning] = useState(null);
  const [editing, setEditing] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const start = periodStart(period, from);
    const end = period === 'custom' && to ? new Date(`${to}T23:59:59`) : null;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (type !== 'all' && r.kind !== type) return false;
      if (status !== 'all' && r.state !== status) return false;
      if (start || end) { const d = parseDate(r.date); if (!d || (start && d < start) || (end && d > end)) return false; }
      return !q || r.search.includes(q);
    });
  }, [rows, type, status, period, from, to, search]);
  useEffect(() => setShown(80), [type, status, period, from, to, search]);

  const summary = useMemo(() => {
    const live = filtered.filter((r) => r.state !== 'cancelled');
    const sales = live.filter((r) => r.kind === 'sale'); const buys = live.filter((r) => r.kind === 'purchase');
    const tot = (a, f) => a.reduce((s, r) => s + r[f], 0);
    return {
      salesCount: sales.length, billed: tot(sales, 'total') - tot(sales, 'returned'), due: tot(sales, 'remaining'), dueCount: sales.filter((r) => r.remaining > 0.5).length,
      buyCount: buys.length, bought: tot(buys, 'total') - tot(buys, 'returned'), owed: tot(buys, 'remaining'),
    };
  }, [filtered]);

  const groups = useMemo(() => {
    const out = [];
    for (const r of filtered.slice(0, shown)) {
      const l = dayLabel(r.date);
      if (!out.length || out[out.length - 1].label !== l) out.push({ label: l, rows: [] });
      out[out.length - 1].rows.push(r);
    }
    return out;
  }, [filtered, shown]);

  const selected = rows.find((r) => r.key === selectedKey) || (typeof window !== 'undefined' && window.innerWidth >= 1024 ? filtered[0] : null);
  const pick = (r) => { setSelectedKey(r.key); setMobileOpen(true); };

  const invoiceData = (r) => {
    const settings = getReceiptSettings();
    return {
      saleId: r.id, items: r.lines.map((i) => ({ name: i.product_name, qty: num(i.quantity), price: num(i.price), lineTotal: i.view.amount })),
      subtotal: r.subtotal, discount: r.discount, total: r.total, paymentMethod: r.method || 'cash',
      settings: { ...settings, ...store },
      date: `${fmtDay(r.date)} ${fmtTime(r.date)}`, customerName: r.customer?.name, customerPhone: r.customer?.phone,
      amountPaid: r.paid, balance: r.remaining,
    };
  };

  const doCancel = async () => {
    const r = confirmCancel; setConfirmCancel(null);
    if (!r) return;
    setBusy(true);
    try {
      const events = buildCancelSaleEvents({
        sale: get('sale', r.id) || r.raw, items: r.lines, customer: r.customer, products: list('product'),
        payments: list('customer_payment'), returns: list('sale_return'), returnItems: list('sale_return_item'), now: localStamp(),
      });
      if (!events) { showToast('This invoice is already cancelled', 'error'); return; }
      await pushBatch(events);
      showToast(`${r.no} cancelled · stock restored`);
    } catch (e) { showToast(e?.message || 'Could not cancel', 'error'); }
    finally { setBusy(false); }
  };

  // Edit items — stock follows the change and the customer's balance moves by the difference
  const saveEdit = async ({ lines, subtotal, discount, total }) => {
    const r = editing; const now = localStamp();
    const sale = get('sale', r.id) || r.raw;
    const events = [{ entityType: 'sale', operation: 'update', payload: { ...sale, subtotal, discount, total, edited_at: now } }];
    const originals = r.lines; const byId = new Map(originals.map((i) => [String(i.id), i]));
    const kept = new Set(lines.filter((l) => l.saleItemId != null).map((l) => String(l.saleItemId)));
    const delta = new Map();
    for (const o of originals) {
      if (kept.has(String(o.id))) continue;
      events.push({ entityType: 'sale_item', operation: 'delete', payload: { id: o.id } });
      if (o.product_id != null) delta.set(String(o.product_id), (delta.get(String(o.product_id)) || 0) + num(o.quantity));
    }
    for (const l of lines) {
      const o = l.saleItemId != null ? byId.get(String(l.saleItemId)) : null;
      // eslint-disable-next-line no-unused-vars
      const { view, ...base } = o || {};
      if (l.product_id != null) { const d = (o ? num(o.quantity) : 0) - num(l.qty); if (d) delta.set(String(l.product_id), (delta.get(String(l.product_id)) || 0) + d); }
      events.push({ entityType: 'sale_item', operation: o ? 'update' : 'create', payload: {
        ...base, id: l.saleItemId ?? undefined, sale_id: r.id, product_id: l.product_id, product_name: l.name, quantity: l.qty, price: l.price,
        purchase_price: l.purchase_price, is_custom: l.isCustom ? 1 : 0, created_at: o?.created_at || now, date_created: o?.date_created || now,
      } });
    }
    const products = list('product');
    for (const [pid, d] of delta) {
      if (!d) continue;
      const p = products.find((x) => String(x.id) === pid);
      if (p) events.push({ entityType: 'product', operation: 'update', payload: { ...p, stock: Math.max(0, num(p.stock) + d), updated_at: now } });
    }
    if (r.customer && Math.abs(total - r.total) > 0.005) {
      const acct = buildCustomerAccount({ customer: r.customer, sales: list('sale'), payments: list('customer_payment'), returns: list('sale_return') });
      events.push({ entityType: 'customer', operation: 'update', payload: { ...r.customer, outstanding_balance: r2(acct.totals.invoiceBalance + (total - r.total)), updated_at: now } });
    }
    await pushBatch(events);
    showToast(`${r.no} updated`);
  };

  const sel = selected;
  const canAct = sel && sel.kind === 'sale' && sel.state !== 'cancelled';
  const editLocked = sel && sel.returned > 0;

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100dvh-8.5rem)]">
      {/* Header */}
      <header className={cn('flex-col gap-4', mobileOpen && sel ? 'hidden lg:flex' : 'flex')}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">Invoices</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Every sale invoice and purchase bill, in one place</p>
          </div>
          <div className="inline-flex self-start sm:self-auto rounded-xl border border-border bg-card p-1" role="tablist" aria-label="Invoice type">
            {[['all', 'All'], ['sale', 'Sales'], ['purchase', 'Purchases']].map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={type === k} onClick={() => setType(k)}
                className={cn('h-8 px-3.5 rounded-lg text-sm font-medium transition-colors', type === k ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>{l}</button>
            ))}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 lg:grid-cols-4">
          {[
            ['Sales billed', rs(summary.billed), `${summary.salesCount.toLocaleString('en-PK')} invoices · net of returns`],
            ['Still to collect', rs(summary.due), `${summary.dueCount} unpaid or part paid`, summary.due > 0.5 && 'text-amber-700 dark:text-amber-400'],
            ['Purchases', rs(summary.bought), `${summary.buyCount.toLocaleString('en-PK')} bills`],
            ['You owe vendors', rs(summary.owed), 'On these bills', summary.owed > 0.5 && 'text-rose-700 dark:text-rose-400'],
          ].map(([l, v, sub, tone]) => (
            <div key={l} className="bg-card px-4 py-3.5">
              <dt className="text-xs text-muted-foreground">{l}</dt>
              <dd className={cn('mt-1 text-lg font-bold tabular-nums tracking-tight text-foreground', tone)}>{v}</dd>
              <dd className="text-[11px] text-muted-foreground">{sub}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="flex-1 min-h-0 grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]">
        {/* List */}
        <section className={cn('min-h-0 flex-col rounded-2xl border border-border/70 bg-card overflow-hidden', mobileOpen && sel ? 'hidden lg:flex' : 'flex')}>
          <div className="p-3 border-b border-border/70 grid gap-2.5">
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Invoice no, customer, item" aria-label="Search invoices"
                  className="w-full h-10 rounded-xl border border-border bg-background pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary" />
                {search && <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded inline-flex items-center justify-center text-muted-foreground hover:bg-muted" aria-label="Clear search"><X size={14} /></button>}
              </div>
              <div className="relative shrink-0">
                <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period"
                  className="h-10 appearance-none rounded-xl border border-border bg-background pl-3 pr-7 text-xs font-medium outline-none">
                  {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            {period === 'custom' && (
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" className="h-9 rounded-lg border border-border bg-background px-2 text-xs" />
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" className="h-9 rounded-lg border border-border bg-background px-2 text-xs" />
              </div>
            )}
            <div className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
              {STATUS_FILTERS.map(([k, l]) => (
                <button key={k} type="button" onClick={() => setStatus(k)}
                  className={cn('h-7 shrink-0 rounded-full px-2.5 text-xs font-medium border transition-colors',
                    status === k ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground')}>{l}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-6 py-16 text-center">
                <FileText size={20} className="mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">{rows.length ? 'No invoice matches' : 'No invoices yet'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{rows.length ? 'Try another search or period.' : 'Sales you make show up here.'}</p>
              </div>
            )}
            {groups.map((g) => (
              <div key={g.label}>
                <p className="sticky top-0 z-[1] bg-card/95 backdrop-blur px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground border-b border-border/50">{g.label}</p>
                <ul className="divide-y divide-border/50">
                  {g.rows.map((r) => {
                    const on = sel?.key === r.key;
                    const [label, chip] = STATE[r.state];
                    return (
                      <li key={r.key}>
                        <button type="button" onClick={() => pick(r)} aria-current={on ? 'true' : undefined}
                          className={cn('relative w-full flex items-center gap-3 px-4 py-3 text-left transition-colors', on ? 'bg-primary/[0.07]' : 'hover:bg-muted/50')}>
                          {on && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary" aria-hidden="true" />}
                          <span className={cn('h-9 w-9 rounded-lg inline-flex items-center justify-center shrink-0',
                            r.kind === 'sale' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400' : 'bg-violet-500/10 text-violet-600 dark:text-violet-400')}>
                            {r.kind === 'sale' ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground truncate">{r.party}</span>
                            </span>
                            <span className="block text-xs text-muted-foreground truncate tabular-nums">{r.no} · {fmtTime(r.date)}</span>
                          </span>
                          <span className="text-right shrink-0">
                            <span className={cn('block text-sm font-semibold tabular-nums', r.state === 'cancelled' ? 'text-muted-foreground line-through' : 'text-foreground')}>{rs(r.total)}</span>
                            <span className={cn('mt-0.5 inline-block rounded px-1.5 py-px text-[10px] font-semibold', chip)}>{r.remaining > 0.5 && r.state === 'partial' ? `${rs(r.remaining)} due` : label}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {filtered.length > shown && (
              <div className="p-3 text-center">
                <button type="button" onClick={() => setShown((n) => n + 80)} className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground">Show more · {(filtered.length - shown).toLocaleString('en-PK')} left</button>
              </div>
            )}
          </div>
        </section>

        {/* Detail */}
        <section className={cn('min-h-0 flex-col rounded-2xl border border-border/70 bg-muted/30 overflow-hidden', mobileOpen && sel ? 'flex' : 'hidden lg:flex')}>
          {sel ? (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-card px-3 sm:px-4 py-2.5">
                <button type="button" onClick={() => setMobileOpen(false)} className="lg:hidden h-9 w-9 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:bg-muted" aria-label="Back to invoices"><ChevronLeft size={18} /></button>
                <p className="mr-auto min-w-0 text-sm font-semibold text-foreground truncate">{sel.no}</p>
                {sel.kind === 'sale' ? (
                  <>
                    <button type="button" onClick={() => printInvoice(invoiceData(sel))} className="h-9 px-3 rounded-lg inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:bg-muted" title="Print"><Printer size={15} /><span className="hidden sm:inline">Print</span></button>
                    <button type="button" onClick={async () => { try { await downloadInvoicePdf(invoiceData(sel)); } catch { showToast('Could not create the PDF', 'error'); } }} className="h-9 px-3 rounded-lg inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:bg-muted" title="Download PDF"><FileDown size={15} /><span className="hidden sm:inline">PDF</span></button>
                    {sel.phone && <a href={buildWhatsAppLink(invoiceData(sel))} target="_blank" rel="noopener noreferrer" className="h-9 px-3 rounded-lg inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10" title="Send on WhatsApp"><MessageCircle size={15} /><span className="hidden sm:inline">WhatsApp</span></a>}
                  </>
                ) : (
                  <button type="button" onClick={() => navigate('/purchases')} className="h-9 px-3 rounded-lg inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:bg-muted"><ExternalLink size={15} /> Open in Purchases</button>
                )}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto px-3 py-5 sm:px-6 sm:py-8">
                <InvoiceDocument row={sel} store={store} />
                {canAct && (
                  <div className="mx-auto mt-5 flex w-full max-w-[640px] flex-wrap gap-2">
                    <button type="button" onClick={() => setReturning(sel)} disabled={busy || sel.state === 'returned' || !sel.lines.length}
                      className="h-10 px-4 rounded-xl border border-border bg-card text-sm font-medium inline-flex items-center gap-2 hover:bg-muted disabled:opacity-50"><Undo2 size={15} /> Return items</button>
                    <button type="button" onClick={() => setEditing(sel)} disabled={busy || editLocked || !sel.lines.length}
                      title={editLocked ? 'Items were returned on this invoice, so it can’t be edited' : 'Edit items'}
                      className="h-10 px-4 rounded-xl border border-border bg-card text-sm font-medium inline-flex items-center gap-2 hover:bg-muted disabled:opacity-50">
                      {editLocked ? <Lock size={15} /> : <PencilLine size={15} />} Edit items
                    </button>
                    <button type="button" onClick={() => setConfirmCancel(sel)} disabled={busy}
                      className="ml-auto h-10 px-4 rounded-xl text-sm font-medium inline-flex items-center gap-2 text-rose-600 hover:bg-rose-500/10 disabled:opacity-50"><Ban size={15} /> Cancel invoice</button>
                    {editLocked && <p className="basis-full text-xs text-muted-foreground">Editing is locked because items were returned on this invoice — the same rule as the counter app.</p>}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center px-6">
              <span className="h-12 w-12 rounded-full bg-muted inline-flex items-center justify-center mb-3"><FileText size={20} className="text-muted-foreground" /></span>
              <p className="text-sm font-medium text-foreground">Choose an invoice</p>
              <p className="text-xs text-muted-foreground mt-1">It opens here, ready to print or share.</p>
            </div>
          )}
        </section>
      </div>

      {returning && <ReturnDialog row={returning} onClose={() => setReturning(null)} />}
      <EditSaleModal open={!!editing} onClose={() => setEditing(null)} sale={editing?.raw} items={editing?.lines || []} products={list('product')} onSave={saveEdit} />
      <Dialog open={!!confirmCancel} onOpenChange={(v) => !v && setConfirmCancel(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Cancel {confirmCancel?.no}?</DialogTitle>
          <DialogDescription>Stock goes back, payments on it are reversed and it stops counting in sales. This can’t be undone.</DialogDescription>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmCancel(null)} className="h-9 px-4 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted">Keep it</button>
            <button type="button" onClick={doCancel} className="h-9 px-4 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700">Cancel invoice</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
