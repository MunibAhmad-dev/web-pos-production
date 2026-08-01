import { useMemo, useState } from 'react';
import { usePagination } from '../../hooks/usePagination';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  ReceiptText, TrendingUp, Tag, AlertCircle, Search, X, ChevronDown,
  Printer, Monitor, Download, Undo2, MoreVertical, Eye, Ban, CheckCircle2,
  RefreshCw, User, MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  getReceiptSettings, formatInvoiceId, printInvoice, openInvoiceInTab,
  downloadInvoicePdf, buildWhatsAppLink,
} from '../../utils/receipt';

const fmtPKR = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const fmtDate = (d) => d ? new Date(String(d).replace(' ', 'T')).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtTime = (d) => d ? new Date(String(d).replace(' ', 'T')).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }) : '';

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: Math.min(i, 5) * 0.055, ease: [0.23, 1, 0.32, 1] } }),
};

const METHOD_STYLE = {
  cash:   'bg-slate-700 text-white',
  online: 'bg-blue-600 text-white',
  credit: 'bg-violet-600 text-white',
  udhaar: 'bg-violet-600 text-white',
  card:   'bg-cyan-600 text-white',
};

function PayBadge({ label }) {
  const cls = label === 'Paid'
    ? 'bg-emerald-500 text-white'
    : label === 'Partial'
      ? 'bg-amber-500 text-white'
      : 'bg-rose-500 text-white';
  return <span className={cn('inline-block text-[10px] font-bold px-3 py-0.5 rounded-full', cls)}>{label}</span>;
}

export default function TransactionsPage() {
  const { list, pushBatch } = useDataStore();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('today'); // today | weekly | monthly | custom
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [statusMenuId, setStatusMenuId] = useState(null);
  const [actionMenuId, setActionMenuId] = useState(null);
  const [detailSale, setDetailSale] = useState(null);
  const [returnSale, setReturnSale] = useState(null);
  const [returnQty, setReturnQty] = useState({});
  const [returnReason, setReturnReason] = useState('');
  const [busy, setBusy] = useState(false);

  const sales = list('sale');
  const saleItems = list('sale_item');
  const customers = list('customer');
  const payments = list('customer_payment');
  const saleReturns = list('sale_return');
  const products = list('product');

  const customerById = useMemo(() => {
    const m = new Map();
    for (const c of customers) m.set(String(c.id), c);
    return m;
  }, [customers]);

  const rows = useMemo(() => {
    const itemsBySale = new Map();
    for (const it of saleItems) {
      const k = String(it.sale_id);
      if (!itemsBySale.has(k)) itemsBySale.set(k, []);
      itemsBySale.get(k).push(it);
    }
    const paidBySale = new Map();
    for (const p of payments) {
      if (p.sale_id == null) continue;
      const k = String(p.sale_id);
      paidBySale.set(k, (paidBySale.get(k) || 0) + Number(p.amount || 0));
    }
    const returnedBySale = new Map();
    for (const r of saleReturns) {
      const k = String(r.sale_id);
      returnedBySale.set(k, (returnedBySale.get(k) || 0) + Number(r.total_returned || 0));
    }
    return sales.map((s) => {
      const k = String(s.id);
      const items = itemsBySale.get(k) || [];
      const customer = s.customer_id != null ? customerById.get(String(s.customer_id)) : null;
      const returned = returnedBySale.get(k) || 0;
      let paid = paidBySale.get(k) || 0;
      // Walk-in sales never create customer_payment rows — a completed non-credit
      // walk-in sale is fully paid by definition (same as the desktop).
      if (!customer && s.status !== 'Cancelled' && (s.payment_method || 'cash') !== 'credit') paid = Number(s.total || 0);
      const due = Math.max(0, Number(s.total || 0) - paid - returned);
      const payLabel = s.status === 'Cancelled' ? null : due <= 0.5 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid';
      return {
        ...s, items, customer, paid, returned, due, payLabel,
        invoiceNo: formatInvoiceId(s.id, s.date_created),
        itemsSummary: items.map((i) => `${i.product_name} (x${i.quantity})`).join(','),
      };
    }).sort((a, b) => new Date(String(b.date_created || 0).replace(' ', 'T')) - new Date(String(a.date_created || 0).replace(' ', 'T')));
  }, [sales, saleItems, payments, saleReturns, customerById]);

  const filtered = useMemo(() => {
    const now = new Date();
    let start = null, end = null;
    if (period === 'today') { start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); }
    else if (period === 'weekly') { start = new Date(now.getTime() - 7 * 86400000); }
    else if (period === 'monthly') { start = new Date(now.getFullYear(), now.getMonth(), 1); }
    else if (period === 'custom') {
      if (from) start = new Date(from);
      if (to) end = new Date(new Date(to).getTime() + 86400000);
    }
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (start || end) {
        const d = new Date(String(r.date_created || 0).replace(' ', 'T'));
        if (start && d < start) return false;
        if (end && d > end) return false;
      }
      if (!q) return true;
      return (
        r.invoiceNo.toLowerCase().includes(q) ||
        String(r.id).includes(q) ||
        (r.payment_method || '').toLowerCase().includes(q) ||
        (r.customer?.name || '').toLowerCase().includes(q) ||
        r.itemsSummary.toLowerCase().includes(q)
      );
    });
  }, [rows, search, period, from, to]);

  const { paged, page, pageCount, setPage } = usePagination(filtered, 30);

  const stats = useMemo(() => ({
    completed: filtered.filter((r) => r.status === 'Completed').length,
    revenue: filtered.filter((r) => r.status !== 'Cancelled').reduce((s, r) => s + Number(r.total || 0), 0),
    discounts: filtered.filter((r) => r.status !== 'Cancelled').reduce((s, r) => s + Number(r.discount || 0), 0),
    pending: filtered.filter((r) => r.status !== 'Cancelled' && r.due > 0.5).length,
  }), [filtered]);

  const invoiceDataFor = (r) => {
    const settings = getReceiptSettings();
    return {
      saleId: r.id,
      items: r.items.map((i) => ({ name: i.product_name, qty: Number(i.quantity), price: Number(i.price) })),
      subtotal: Number(r.subtotal ?? r.total),
      discount: Number(r.discount || 0),
      total: Number(r.total),
      paymentMethod: r.payment_method || 'cash',
      settings: { ...settings, store_name: settings.store_name || user?.store_name || 'My Store' },
      date: new Date(String(r.date_created || Date.now()).replace(' ', 'T')).toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      customerName: r.customer?.name,
      customerPhone: r.customer?.phone,
      amountPaid: r.paid,
      balance: r.due > 0.5 ? r.due : 0,
    };
  };

  // ── Cancel / restore a sale ──────────────────────────────────────────────────
  const setSaleStatus = async (r, newStatus) => {
    if (r.status === newStatus) { setStatusMenuId(null); return; }
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const events = [{ entityType: 'sale', operation: 'update', payload: { ...r, items: undefined, customer: undefined, status: newStatus, updated_at: now } }];
      // strip helper fields from payload
      const clean = { ...r };
      ['items', 'customer', 'paid', 'returned', 'due', 'payLabel', 'invoiceNo', 'itemsSummary'].forEach((f) => delete clean[f]);
      events[0].payload = { ...clean, status: newStatus, updated_at: now };

      const dir = newStatus === 'Cancelled' ? 1 : -1; // cancel restocks, restore re-deducts
      for (const it of r.items) {
        if (!it.product_id) continue;
        const product = products.find((p) => String(p.id) === String(it.product_id));
        if (!product) continue;
        events.push({
          entityType: 'product', operation: 'update',
          payload: { ...product, stock: Number(product.stock || 0) + dir * Number(it.quantity || 0), updated_at: now },
        });
      }
      // Reverse (or re-apply) the credit this sale put on the customer
      if (r.customer && r.due > 0.5) {
        events.push({
          entityType: 'customer', operation: 'update',
          payload: {
            ...r.customer,
            outstanding_balance: Math.max(0, Number(r.customer.outstanding_balance || 0) - dir * r.due),
            updated_at: now,
          },
        });
      }
      await pushBatch(events);
      showToast(newStatus === 'Cancelled' ? 'Sale cancelled — stock restored' : 'Sale restored to Completed');
    } catch (err) {
      showToast(err?.message || 'Failed to update status', 'error');
    } finally {
      setBusy(false);
      setStatusMenuId(null);
    }
  };

  // ── Item return ──────────────────────────────────────────────────────────────
  const openReturn = (r) => {
    setReturnSale(r);
    setReturnQty({});
    setReturnReason('');
    setActionMenuId(null);
  };

  const submitReturn = async () => {
    const r = returnSale;
    const picked = r.items.filter((i) => Number(returnQty[i.id] || 0) > 0);
    if (picked.length === 0) { showToast('Select at least one item quantity', 'error'); return; }
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const totalRefund = picked.reduce((s, i) => s + Number(returnQty[i.id]) * Number(i.price || 0), 0);
      const returnId = Date.now();
      const events = [{
        entityType: 'sale_return', operation: 'create',
        payload: { id: returnId, sale_id: r.id, customer_id: r.customer_id ?? null, date_created: now, reason: returnReason || '', total_returned: totalRefund },
      }];
      for (const it of picked) {
        const qty = Number(returnQty[it.id]);
        events.push({
          entityType: 'sale_return_item', operation: 'create',
          payload: { return_id: returnId, product_id: it.product_id, product_name: it.product_name, quantity: qty, price: it.price, date_created: now },
        });
        const product = products.find((p) => String(p.id) === String(it.product_id));
        if (product) {
          events.push({ entityType: 'product', operation: 'update', payload: { ...product, stock: Number(product.stock || 0) + qty, updated_at: now } });
        }
      }
      // Returning reduces what the customer still owes on this bill
      if (r.customer && r.due > 0.5) {
        const reduce = Math.min(r.due, totalRefund);
        events.push({
          entityType: 'customer', operation: 'update',
          payload: { ...r.customer, outstanding_balance: Math.max(0, Number(r.customer.outstanding_balance || 0) - reduce), updated_at: now },
        });
      }
      await pushBatch(events);
      showToast(`Return recorded — ${fmtPKR(totalRefund)} · stock restored`);
      setReturnSale(null);
    } catch (err) {
      showToast(err?.message || 'Failed to record return', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadPdf = async (r) => {
    showToast('Generating PDF…');
    try { await downloadInvoicePdf(invoiceDataFor(r)); }
    catch (err) { showToast(err?.message || 'PDF failed', 'error'); }
  };

  return (
    <div className="flex flex-col gap-6" onClick={() => { setStatusMenuId(null); setActionMenuId(null); }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><ReceiptText size={20} /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {rows.length} transactions loaded</p>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Completed Sales', value: stats.completed, icon: ReceiptText, color: 'text-primary bg-primary/10', valueCls: '' },
          { label: 'Revenue (Loaded)', value: fmtPKR(stats.revenue), icon: TrendingUp, color: 'text-emerald-600 bg-emerald-500/10', valueCls: 'text-emerald-600' },
          { label: 'Total Discounts', value: fmtPKR(stats.discounts), icon: Tag, color: 'text-amber-600 bg-amber-500/10', valueCls: 'text-amber-600' },
          { label: 'Pending Payments', value: stats.pending, icon: AlertCircle, color: 'text-rose-600 bg-rose-500/10', valueCls: 'text-rose-600' },
        ].map(({ label, value, icon: Icon, color, valueCls }) => (
          <div key={label} className="rounded-2xl border border-border/50 bg-card shadow-sm p-5">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', color)}><Icon size={18} /></div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className={cn('text-xl font-black font-mono mt-1', valueCls)}>{value}</p>
          </div>
        ))}
      </motion.div>

      {/* Search + period */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2} className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by ID, payment method, or item name…"
            className="w-full h-10 pl-9 pr-8 text-sm rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/30" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={13} /></button>}
        </div>
        <div className="flex rounded-xl bg-muted/40 border border-border/30 p-0.5 gap-0.5">
          {[['today', 'Today'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['custom', 'Custom']].map(([val, lbl]) => (
            <button key={val} onClick={() => setPeriod(val)}
              className={cn('px-4 h-9 rounded-lg text-sm font-semibold transition-all', period === val ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {lbl}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 px-2.5 rounded-lg border border-border bg-background text-xs" />
            <span className="text-muted-foreground text-xs">—</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 px-2.5 rounded-lg border border-border bg-background text-xs" />
          </div>
        )}
      </motion.div>

      {/* Table */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3}>
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-visible">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/20 border-b border-border/40">
                {['Invoice No', 'Date & Time', 'Items', 'Method', 'Status', 'Subtotal', 'Disc.', 'Total', 'Actions'].map((h, i) => (
                  <th key={h} className={cn('text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3',
                    i === 0 ? 'text-left pl-5' : i >= 5 ? 'text-right' : 'text-left', i === 8 && 'text-right pr-5')}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr><td colSpan={9} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground"><ReceiptText size={28} className="opacity-20" /><p className="text-sm">No transactions found</p></div>
                  </td></tr>
                ) : paged.map((r) => (
                  <tr key={r.id} className="border-b border-border/20 last:border-0 hover:bg-muted/15 transition-colors">
                    {/* Invoice */}
                    <td className="py-4 pl-5">
                      <span className="font-mono text-xs font-bold bg-muted/60 px-2 py-1 rounded-md">{r.invoiceNo}</span>
                      <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                        <User size={10} /> {r.customer ? <span className="text-primary font-semibold">{r.customer.name}</span> : 'Walk-in'}
                      </p>
                    </td>
                    {/* Date */}
                    <td className="py-4">
                      <p className="text-xs font-semibold">{fmtDate(r.date_created)}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{fmtTime(r.date_created)}</p>
                    </td>
                    {/* Items */}
                    <td className="py-4 max-w-[220px]">
                      <p className="text-xs text-muted-foreground truncate">{r.itemsSummary || '—'}</p>
                    </td>
                    {/* Method */}
                    <td className="py-4">
                      <span className={cn('inline-block text-[10px] font-bold px-3 py-1.5 rounded-full uppercase', METHOD_STYLE[(r.payment_method || 'cash').toLowerCase()] || 'bg-slate-600 text-white')}>
                        {r.payment_method || 'cash'}
                      </span>
                    </td>
                    {/* Status dropdown + payment badge */}
                    <td className="py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="relative inline-block">
                        <button
                          onClick={() => setStatusMenuId(statusMenuId === r.id ? null : r.id)}
                          disabled={busy}
                          className={cn('flex items-center gap-1.5 text-[11px] font-bold px-3.5 py-1.5 rounded-full text-white transition-transform hover:scale-[1.03]',
                            r.status === 'Cancelled' ? 'bg-rose-600' : 'bg-emerald-600')}
                        >
                          {r.status === 'Cancelled' ? 'Cancelled' : 'Completed'} <ChevronDown size={11} />
                        </button>
                        {statusMenuId === r.id && (
                          <div className="absolute top-full left-0 mt-1 w-40 bg-popover border border-border rounded-xl shadow-xl overflow-hidden z-50">
                            <button onClick={() => setSaleStatus(r, 'Completed')} className="w-full px-3 py-2.5 text-xs text-left hover:bg-muted flex items-center gap-2 font-medium">
                              <CheckCircle2 size={12} className="text-emerald-600" /> Completed
                            </button>
                            <button onClick={() => setSaleStatus(r, 'Cancelled')} className="w-full px-3 py-2.5 text-xs text-left hover:bg-muted flex items-center gap-2 font-medium border-t border-border/40">
                              <Ban size={12} className="text-rose-600" /> Cancelled
                            </button>
                          </div>
                        )}
                      </div>
                      {r.payLabel && <div className="mt-1.5"><PayBadge label={r.payLabel} /></div>}
                    </td>
                    {/* Subtotal */}
                    <td className="py-4 text-right font-mono text-xs">{fmtPKR(r.subtotal ?? r.total)}</td>
                    {/* Discount */}
                    <td className="py-4 text-right font-mono text-xs">
                      {Number(r.discount) > 0 ? <span className="text-rose-600">−{fmtPKR(r.discount)}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    {/* Total */}
                    <td className="py-4 text-right">
                      <p className="font-mono font-black text-sm text-primary">{fmtPKR(r.total)}</p>
                      {r.due > 0.5 && r.status !== 'Cancelled' && <p className="text-[10px] font-bold text-rose-600 mt-0.5">Owed: {fmtPKR(r.due)}</p>}
                    </td>
                    {/* Actions */}
                    <td className="py-4 pr-5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button title="Direct Print" onClick={() => printInvoice(invoiceDataFor(r))}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-600 hover:bg-blue-500/10 transition-colors"><Printer size={14} /></button>
                        <button title="Open in Browser" onClick={() => openInvoiceInTab(invoiceDataFor(r))}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-violet-600 hover:bg-violet-500/10 transition-colors"><Monitor size={14} /></button>
                        <button title="Download PDF" onClick={() => handleDownloadPdf(r)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-600 hover:bg-emerald-500/10 transition-colors"><Download size={14} /></button>
                        <button title="Return Items" onClick={() => openReturn(r)} disabled={r.status === 'Cancelled'}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-amber-600 hover:bg-amber-500/10 transition-colors disabled:opacity-30"><Undo2 size={14} /></button>
                        <div className="relative">
                          <button onClick={() => setActionMenuId(actionMenuId === r.id ? null : r.id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"><MoreVertical size={14} /></button>
                          {actionMenuId === r.id && (
                            <div className="absolute top-full right-0 mt-1 w-48 bg-popover border border-border rounded-xl shadow-xl overflow-hidden z-50">
                              <button onClick={() => { setDetailSale(r); setActionMenuId(null); }}
                                className="w-full px-3 py-2.5 text-xs text-left hover:bg-muted flex items-center gap-2 font-medium">
                                <Eye size={12} className="text-violet-500" /> View Details
                              </button>
                              {r.customer?.phone && (
                                <button onClick={() => { const url = buildWhatsAppLink(invoiceDataFor(r)); if (url) window.open(url, '_blank'); setActionMenuId(null); }}
                                  className="w-full px-3 py-2.5 text-xs text-left hover:bg-muted flex items-center gap-2 font-medium border-t border-border/40">
                                  <MessageCircle size={12} className="text-emerald-500" /> WhatsApp to Customer
                                </button>
                              )}
                              <button onClick={() => { openReturn(r); }} disabled={r.status === 'Cancelled'}
                                className="w-full px-3 py-2.5 text-xs text-left hover:bg-muted flex items-center gap-2 font-medium border-t border-border/40 disabled:opacity-40">
                                <Undo2 size={12} className="text-amber-500" /> Return Items
                              </button>
                              <button onClick={() => { setActionMenuId(null); setSaleStatus(r, r.status === 'Cancelled' ? 'Completed' : 'Cancelled'); }}
                                className="w-full px-3 py-2.5 text-xs text-left hover:bg-muted flex items-center gap-2 font-medium border-t border-border/40">
                                {r.status === 'Cancelled'
                                  ? <><CheckCircle2 size={12} className="text-emerald-600" /> Restore Sale</>
                                  : <><Ban size={12} className="text-rose-600" /> Cancel Sale</>}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pageCount > 1 && (
            <div className="flex items-center justify-between px-5 py-2.5 border-t border-border/30 bg-muted/20">
              <span className="text-xs text-muted-foreground">{filtered.length} records · page {page} of {pageCount}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="h-7 w-7 rounded-lg border border-border flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors">‹</button>
                <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount}
                  className="h-7 w-7 rounded-lg border border-border flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors">›</button>
              </div>
            </div>
          )}
          {pageCount <= 1 && filtered.length > 0 && (
            <p className="text-center text-xs text-muted-foreground py-3 border-t border-border/30">All {filtered.length} transactions loaded.</p>
          )}
        </div>
      </motion.div>

      {/* ── Detail modal (eye) — mirrors the Electron sale detail ── */}
      {detailSale && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setDetailSale(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.2 }}
            className="w-full max-w-lg bg-card rounded-2xl shadow-2xl border border-border/50 overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b shrink-0">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2"><ReceiptText size={17} className="text-primary" /> Sale #{detailSale.id}</h2>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>{fmtDate(detailSale.date_created)}, {fmtTime(detailSale.date_created)}</span>
                  <span className="bg-muted px-2 py-0.5 rounded-full font-semibold">{detailSale.payment_method || 'cash'}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Grand Total</p>
                <p className="text-xl font-black text-rose-600 font-mono">{fmtPKR(detailSale.total)}</p>
                {detailSale.due > 0.5 && <p className="text-[11px] font-bold text-rose-500">Due: {fmtPKR(detailSale.due)}</p>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Payment logs */}
              <div className="px-6 py-4 bg-emerald-500/5 border-b border-border/40">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-2"><RefreshCw size={11} /> Payment Logs</p>
                {payments.filter((p) => String(p.sale_id) === String(detailSale.id)).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No payments collected for this bill yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {payments.filter((p) => String(p.sale_id) === String(detailSale.id)).map((p) => (
                      <div key={p.id} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{fmtDate(p.date_added)}{p.notes ? ` · ${p.notes}` : ''}</span>
                        <span className="font-bold text-emerald-600 font-mono">{fmtPKR(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Items table */}
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border/40 bg-muted/10">
                  <th className="text-left text-[10px] font-bold text-muted-foreground uppercase py-2.5 pl-6 w-10">#</th>
                  <th className="text-left text-[10px] font-bold text-muted-foreground uppercase py-2.5">Item</th>
                  <th className="text-center text-[10px] font-bold text-muted-foreground uppercase py-2.5 w-14">Qty</th>
                  <th className="text-right text-[10px] font-bold text-muted-foreground uppercase py-2.5 w-24">Unit Price</th>
                  <th className="text-right text-[10px] font-bold text-muted-foreground uppercase py-2.5 pr-6 w-28">Subtotal</th>
                </tr></thead>
                <tbody>
                  {detailSale.items.map((it, idx) => (
                    <tr key={it.id ?? idx} className={cn('border-b border-border/20', idx % 2 === 1 && 'bg-muted/10')}>
                      <td className="py-2.5 pl-6 text-xs text-muted-foreground">{idx + 1}</td>
                      <td className="py-2.5 text-xs font-semibold">{it.product_name}</td>
                      <td className="py-2.5 text-center text-xs font-mono">{it.quantity}</td>
                      <td className="py-2.5 text-right text-xs font-mono text-muted-foreground">{fmtPKR(it.price)}</td>
                      <td className="py-2.5 pr-6 text-right text-xs font-mono font-bold text-primary">{fmtPKR(Number(it.price) * Number(it.quantity))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer actions */}
            <div className="px-6 py-4 border-t shrink-0 space-y-3">
              <div className="flex gap-3">
                <button onClick={() => setDetailSale(null)} className="flex-1 h-10 rounded-xl border border-border bg-background hover:bg-muted text-sm font-semibold">Close</button>
                <button onClick={() => { openReturn(detailSale); setDetailSale(null); }} disabled={detailSale.status === 'Cancelled'}
                  className="flex-1 h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40">
                  <Undo2 size={14} /> Return Items
                </button>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Print Options</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => printInvoice(invoiceDataFor(detailSale))}
                  className="h-9 rounded-xl border border-blue-400/40 text-blue-600 hover:bg-blue-500/10 text-xs font-semibold flex items-center justify-center gap-1.5"><Printer size={12} /> Direct Print</button>
                <button onClick={() => openInvoiceInTab(invoiceDataFor(detailSale))}
                  className="h-9 rounded-xl border border-violet-400/40 text-violet-600 hover:bg-violet-500/10 text-xs font-semibold flex items-center justify-center gap-1.5"><Monitor size={12} /> Browser</button>
                <button onClick={() => handleDownloadPdf(detailSale)}
                  className="h-9 rounded-xl border border-emerald-400/40 text-emerald-600 hover:bg-emerald-500/10 text-xs font-semibold flex items-center justify-center gap-1.5"><Download size={12} /> Save PDF</button>
                {detailSale.customer?.phone ? (
                  <button onClick={() => { const url = buildWhatsAppLink(invoiceDataFor(detailSale)); if (url) window.open(url, '_blank'); }}
                    className="h-9 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5"><MessageCircle size={12} /> WhatsApp to Customer</button>
                ) : (
                  <button disabled className="h-9 rounded-xl border border-border text-muted-foreground/50 text-xs font-semibold flex items-center justify-center gap-1.5"><MessageCircle size={12} /> No customer phone</button>
                )}
              </div>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* ── Return modal ── */}
      {returnSale && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !busy && setReturnSale(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.2 }}
            className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border/50 overflow-hidden flex flex-col" style={{ maxHeight: '88vh' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
              <h2 className="font-bold flex items-center gap-2"><Undo2 size={16} className="text-amber-500" /> Return Items — {returnSale.invoiceNo}</h2>
              <button onClick={() => setReturnSale(null)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {returnSale.items.map((it) => {
                const q = Number(returnQty[it.id] || 0);
                return (
                  <div key={it.id} className="rounded-xl border border-border/50 px-4 py-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{it.product_name}</p>
                      <p className="text-[11px] text-muted-foreground">Sold: {it.quantity} × {fmtPKR(it.price)}</p>
                    </div>
                    <input
                      type="number" min="0" max={it.quantity} value={returnQty[it.id] ?? ''}
                      placeholder="0"
                      onChange={(e) => setReturnQty((m) => ({ ...m, [it.id]: Math.min(Number(it.quantity), Math.max(0, Number(e.target.value) || 0)) }))}
                      className="w-20 h-9 text-center text-sm font-bold rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    />
                    <span className="w-24 text-right text-xs font-mono font-bold">{q > 0 ? fmtPKR(q * Number(it.price || 0)) : '—'}</span>
                  </div>
                );
              })}
              <input value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder="Reason (optional)"
                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none" />
            </div>
            <div className="px-5 py-4 border-t flex items-center justify-between shrink-0">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Refund Total</p>
                <p className="text-lg font-black font-mono text-amber-600">
                  {fmtPKR(returnSale.items.reduce((s, i) => s + Number(returnQty[i.id] || 0) * Number(i.price || 0), 0))}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setReturnSale(null)} disabled={busy} className="h-10 px-4 rounded-xl border border-border bg-background hover:bg-muted text-sm font-semibold">Cancel</button>
                <button onClick={submitReturn} disabled={busy}
                  className="h-10 px-5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50">
                  {busy ? <RefreshCw size={13} className="animate-spin" /> : <Undo2 size={14} />} Confirm Return
                </button>
              </div>
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </div>
  );
}
