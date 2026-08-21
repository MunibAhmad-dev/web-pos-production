import { useEffect, useMemo, useState } from 'react';
import { usePagination } from '../../hooks/usePagination';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCcw, ShoppingCart, Package, ChevronDown, ChevronUp,
  ArrowLeftRight, TrendingDown, User, Building2, Search,
  CalendarDays, Plus, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../utils/format';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtPKR = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1], delay: Math.min(i, 5) * 0.05} }),
};

const DATE_FILTERS = [
  { key: 'today', label: 'Today' },
  { key: 'weekly', label: 'This Week' },
  { key: 'monthly', label: 'This Month' },
  { key: 'all', label: 'All' },
  { key: 'custom', label: 'Custom' },
];

function isInRange(d, filter, fromDate, toDate) {
  const date = new Date(d);
  if (isNaN(date.getTime())) return false;
  const now = new Date();
  if (filter === 'today') return date.toDateString() === now.toDateString();
  if (filter === 'weekly') {
    const start = new Date(now); start.setDate(now.getDate() - 6); start.setHours(0, 0, 0, 0);
    return date >= start;
  }
  if (filter === 'monthly') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  if (filter === 'all') return true;
  if (filter === 'custom') {
    if (fromDate && date < new Date(fromDate + 'T00:00:00')) return false;
    if (toDate && date > new Date(toDate + 'T23:59:59')) return false;
  }
  return true;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color, delay = 0 }) {
  return (
    <motion.div variants={fadeUp} custom={delay} initial="hidden" animate="show">
      <div className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
        <div className="p-4 flex items-center gap-4">
          <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', color)}><Icon size={20} /></div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-xl font-bold leading-tight truncate">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Expandable Row ────────────────────────────────────────────────────────────
function ReturnRow({ ret, type, getItems, customerById, vendorById, saleById, purchaseById }) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState(null);

  const toggle = () => {
    if (!expanded && items === null) {
      setItems(getItems(ret.id, type));
    }
    setExpanded((v) => !v);
  };

  const isSale = type === 'sale';
  const partyName = isSale
    ? (customerById.get(String(saleById.get(String(ret.sale_id))?.customer_id))?.name || 'Walk-in Customer')
    : (ret.vendor_id ? vendorById.get(String(ret.vendor_id))?.name || 'Unknown Vendor' : 'Unknown Vendor');
  const refNum = isSale ? `Sale #${ret.sale_id}` : `PO #${ret.purchase_id}`;
  const amount = Number(ret.total_returned || ret.total || 0);

  return (
    <>
      <tr className="border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer group" onClick={toggle}>
        <td className="px-4 py-3 text-sm"><span className="font-mono text-muted-foreground text-xs bg-muted/50 px-2 py-0.5 rounded">{refNum}</span></td>
        <td className="px-4 py-3 text-sm">
          <div className="flex items-center gap-1.5">
            {isSale ? <User size={12} className="text-muted-foreground" /> : <Building2 size={12} className="text-muted-foreground" />}
            <span className="font-medium truncate max-w-[140px]">{partyName}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm">
          <span className={cn('font-bold font-mono', isSale ? 'text-rose-600' : 'text-amber-600')}>{fmtPKR(amount)}</span>
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px]">
          <span className="truncate block">{ret.reason || <em className="opacity-50">—</em>}</span>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(ret.date_created)}</td>
        <td className="px-4 py-3 text-right">
          {expanded ? <ChevronUp size={14} className="text-muted-foreground inline" /> : <ChevronDown size={14} className="text-muted-foreground inline opacity-0 group-hover:opacity-100 transition-opacity" />}
        </td>
      </tr>
      <AnimatePresence>
        {expanded && items && (
          <motion.tr key="items" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <td colSpan={6} className="px-0 py-0">
              <div className="bg-muted/15 border-b border-border/30 px-6 py-3">
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-1">No item details available.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-muted-foreground">
                      <th className="text-left font-medium pb-1.5 pr-4">Product</th>
                      <th className="text-right font-medium pb-1.5 pr-4">Qty</th>
                      <th className="text-right font-medium pb-1.5 pr-4">Unit Price</th>
                      <th className="text-right font-medium pb-1.5">Subtotal</th>
                    </tr></thead>
                    <tbody>
                      {items.map((item, i) => {
                        const price = item.price || item.unit_cost || item.purchase_price || 0;
                        const qty = item.quantity || item.qty || 0;
                        return (
                          <tr key={i} className="border-t border-border/20">
                            <td className="py-1.5 pr-4">{item.product_name || item.name || `Product #${item.product_id}`}</td>
                            <td className="py-1.5 pr-4 text-right text-muted-foreground">{qty}</td>
                            <td className="py-1.5 pr-4 text-right text-muted-foreground">{fmtPKR(price)}</td>
                            <td className={cn('py-1.5 text-right font-bold font-mono', isSale ? 'text-rose-600' : 'text-amber-600')}>{fmtPKR(price * qty)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ReturnsPage() {
  const { list, pushBatch, nextId } = useDataStore();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const preselectSaleId = searchParams.get('saleId');

  const [historyTab, setHistoryTab] = useState('sale');
  const [dateFilter, setDateFilter] = useState('monthly');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [historySearch, setHistorySearch] = useState('');

  // New return form
  const [formTab, setFormTab] = useState('sale');
  const [selectedId, setSelectedId] = useState(preselectSaleId || '');
  const [qtyMap, setQtyMap] = useState({});
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const sales = list('sale');
  const saleItems = list('sale_item');
  const purchases = list('purchase');
  const customers = list('customer');
  const vendors = list('vendor');
  const products = list('product');
  const saleReturns = list('sale_return');
  const saleReturnItems = list('sale_return_item');
  const purchaseReturns = list('purchase_return');
  const purchaseReturnItems = list('purchase_return_item');

  useEffect(() => {
    if (preselectSaleId) { setFormTab('sale'); setSelectedId(preselectSaleId); setShowForm(true); }
  }, [preselectSaleId]);

  useEffect(() => { setQtyMap({}); }, [selectedId, formTab]);

  const customerById = useMemo(() => new Map(customers.map((c) => [String(c.id), c])), [customers]);
  const vendorById = useMemo(() => new Map(vendors.map((v) => [String(v.id), v])), [vendors]);
  const saleById = useMemo(() => new Map(sales.map((s) => [String(s.id), s])), [sales]);
  const purchaseById = useMemo(() => new Map(purchases.map((p) => [String(p.id), p])), [purchases]);

  const getItems = (returnId, type) => {
    if (type === 'sale') return saleReturnItems.filter((i) => String(i.return_id) === String(returnId));
    return purchaseReturnItems.filter((i) => String(i.return_id) === String(returnId));
  };

  // Stats
  const now = new Date();
  const thisMonthSaleReturns = saleReturns.filter((r) => { const d = new Date(r.date_created); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  const thisMonthPurchaseReturns = purchaseReturns.filter((r) => { const d = new Date(r.date_created); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  const totalSaleReturnsMonth = thisMonthSaleReturns.reduce((s, r) => s + Number(r.total_returned || r.total || 0), 0);
  const totalPurchaseReturnsMonth = thisMonthPurchaseReturns.reduce((s, r) => s + Number(r.total_returned || r.total || 0), 0);

  // Filtered history
  const filteredSaleReturns = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return saleReturns.filter((r) => {
      if (!isInRange(r.date_created, dateFilter, fromDate, toDate)) return false;
      if (!q) return true;
      const pool = [String(r.sale_id), r.reason || '', customerById.get(String(saleById.get(String(r.sale_id))?.customer_id))?.name || ''].join(' ').toLowerCase();
      return pool.includes(q);
    }).sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0));
  }, [saleReturns, dateFilter, fromDate, toDate, historySearch, customerById, saleById]);

  const filteredPurchaseReturns = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return purchaseReturns.filter((r) => {
      if (!isInRange(r.date_created, dateFilter, fromDate, toDate)) return false;
      if (!q) return true;
      const pool = [String(r.purchase_id), r.reason || '', vendorById.get(String(r.vendor_id))?.name || ''].join(' ').toLowerCase();
      return pool.includes(q);
    }).sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0));
  }, [purchaseReturns, dateFilter, fromDate, toDate, historySearch, vendorById]);

  const { paged: pagedSaleReturns, page: srPage, pageCount: srPageCount, setPage: setSrPage } = usePagination(filteredSaleReturns, 30);
  const { paged: pagedPurchaseReturns, page: prPage, pageCount: prPageCount, setPage: setPrPage } = usePagination(filteredPurchaseReturns, 30);

  // Form: returnable documents
  const returnableSales = useMemo(() => sales.filter((s) => s.status === 'Completed'), [sales]);
  const returnablePurchases = useMemo(() => purchases.filter((p) => p.status === 'received'), [purchases]);

  const selectedDoc = useMemo(() => {
    if (!selectedId) return null;
    if (formTab === 'sale') return sales.find((s) => String(s.id) === String(selectedId));
    return purchases.find((p) => String(p.id) === String(selectedId));
  }, [selectedId, formTab, sales, purchases]);

  const formItems = useMemo(() => {
    if (!selectedDoc) return [];
    if (formTab === 'sale') {
      return saleItems.filter((i) => String(i.sale_id) === String(selectedDoc.id) && i.product_id != null)
        .map((i) => ({ product_id: i.product_id, name: i.product_name || i.name, qty: i.quantity, price: i.price }));
    }
    const piItems = list('purchase_item').filter((pi) => String(pi.purchase_id) === String(selectedDoc.id));
    return piItems.map((i) => ({
      product_id: i.product_id,
      name: i.product_name || products.find((p) => String(p.id) === String(i.product_id))?.name || `#${i.product_id}`,
      qty: i.quantity,
      price: i.purchase_price || i.unit_cost || 0,
    }));
  }, [selectedDoc, formTab, saleItems, products, list]);

  const totalRefund = useMemo(() => formItems.reduce((s, item) => s + Number(qtyMap[item.product_id] || 0) * item.price, 0), [formItems, qtyMap]);

  const handleSubmit = async () => {
    const returnItems = formItems.filter((item) => Number(qtyMap[item.product_id] || 0) > 0);
    if (returnItems.length === 0) { showToast('Enter return quantity for at least one item', 'error'); return; }
    const invalids = returnItems.filter((item) => Number(qtyMap[item.product_id]) > item.qty);
    if (invalids.length > 0) { showToast(`Cannot return more than sold for: ${invalids.map((i) => i.name).join(', ')}`, 'error'); return; }
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const returnId = nextId ? nextId() : Date.now() * 1000 + Math.floor(Math.random() * 1000);
      const events = [];

      if (formTab === 'sale') {
        events.push({ entityType: 'sale_return', operation: 'create', payload: { id: returnId, sale_id: selectedDoc.id, customer_id: selectedDoc.customer_id, date_created: now, reason, total_returned: totalRefund } });
        for (const item of returnItems) {
          events.push({ entityType: 'sale_return_item', operation: 'create', payload: { return_id: returnId, product_id: item.product_id, product_name: item.name, quantity: Number(qtyMap[item.product_id]), price: item.price, date_created: now } });
          const product = products.find((p) => String(p.id) === String(item.product_id));
          if (product) events.push({ entityType: 'product', operation: 'update', payload: { ...product, stock: Number(product.stock || 0) + Number(qtyMap[item.product_id]), updated_at: now } });
        }
      } else {
        events.push({ entityType: 'purchase_return', operation: 'create', payload: { id: returnId, purchase_id: selectedDoc.id, vendor_id: selectedDoc.vendor_id, date_created: now, reason, total_returned: totalRefund } });
        for (const item of returnItems) {
          events.push({ entityType: 'purchase_return_item', operation: 'create', payload: { return_id: returnId, product_id: item.product_id, product_name: item.name, quantity: Number(qtyMap[item.product_id]), unit_cost: item.price, date_created: now } });
          const product = products.find((p) => String(p.id) === String(item.product_id));
          if (product) events.push({ entityType: 'product', operation: 'update', payload: { ...product, stock: Math.max(0, Number(product.stock || 0) - Number(qtyMap[item.product_id])), updated_at: now } });
        }
      }

      await pushBatch(events);
      showToast('Return processed successfully');
      setSelectedId(''); setReason(''); setQtyMap({}); setShowForm(false);
    } catch (err) { showToast(err.message || 'Unable to process return', 'error'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl">

      {/* ── Page Header ── */}
      <motion.div variants={fadeUp} custom={0} initial="hidden" animate="show" className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <RotateCcw size={17} className="text-rose-500" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Returns</h1>
          </div>
          <p className="text-sm text-muted-foreground pl-[48px]">Process and view customer sale returns and vendor purchase returns</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)}
          className={cn('flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold shadow-sm transition-all',
            showForm ? 'bg-muted text-foreground border border-border hover:bg-muted/80' : 'bg-rose-600 hover:bg-rose-700 text-white')}>
          {showForm ? <><X size={14} /> Cancel</> : <><Plus size={14} /> New Return</>}
        </button>
      </motion.div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={ArrowLeftRight} label="Sale Returns (Month)" value={fmtPKR(totalSaleReturnsMonth)} sub={`${thisMonthSaleReturns.length} returns`} color="bg-rose-500/10 text-rose-500 border border-rose-500/20" delay={1} />
        <StatCard icon={TrendingDown} label="Purchase Returns (Month)" value={fmtPKR(totalPurchaseReturnsMonth)} sub={`${thisMonthPurchaseReturns.length} returns`} color="bg-amber-500/10 text-amber-500 border border-amber-500/20" delay={2} />
        <StatCard icon={ShoppingCart} label="Total Sale Returns" value={saleReturns.length} sub="All time" color="bg-violet-500/10 text-violet-500 border border-violet-500/20" delay={3} />
        <StatCard icon={Package} label="Total Purchase Returns" value={purchaseReturns.length} sub="All time" color="bg-blue-500/10 text-blue-500 border border-blue-500/20" delay={4} />
      </div>

      {/* ── New Return Form ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div key="form" initial={{ opacity: 0, scale: 0.97, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
            <div className="rounded-2xl border border-rose-500/25 bg-card shadow-lg overflow-hidden">
              <div className="bg-rose-500/5 border-b border-rose-500/15 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/25 flex items-center justify-center"><RotateCcw size={15} className="text-rose-500" /></div>
                  <div>
                    <p className="font-semibold text-sm">Process Return</p>
                    <p className="text-xs text-muted-foreground">Select a document then enter return quantities</p>
                  </div>
                </div>
                <div className="flex gap-1 p-1 rounded-xl bg-muted/60 border border-border/40">
                  {[['sale', 'Sale Return'], ['purchase', 'Purchase Return']].map(([val, label]) => (
                    <button key={val} onClick={() => { setFormTab(val); setSelectedId(''); }}
                      className={cn('px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all', formTab === val ? 'bg-background text-foreground shadow-sm border border-border/60' : 'text-muted-foreground hover:text-foreground')}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5 space-y-4">
                <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none">
                  <option value="">{formTab === 'sale' ? 'Select a completed sale…' : 'Select a received purchase order…'}</option>
                  {(formTab === 'sale' ? returnableSales : returnablePurchases).map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {formTab === 'sale'
                        ? `Sale #${doc.id} — ${customerById.get(String(doc.customer_id))?.name || 'Walk-in'} — ${fmtPKR(doc.total)}`
                        : `PO #${doc.id} — ${vendorById.get(String(doc.vendor_id))?.name || 'Unknown'} — ${fmtPKR(doc.grand_total || doc.total || 0)}`}
                    </option>
                  ))}
                </select>

                {selectedDoc && (
                  <>
                    {formItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No returnable items found.</p>
                    ) : (
                      <div className="space-y-2">
                        {formItems.map((item) => (
                          <div key={item.product_id} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-4 py-3 hover:bg-muted/20 transition-colors">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm truncate">{item.name}</p>
                              <p className="text-xs text-muted-foreground">Sold: {item.qty} × {fmtPKR(item.price)}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {Number(qtyMap[item.product_id] || 0) > 0 && (
                                <span className="text-xs font-mono text-rose-600 font-bold">{fmtPKR(Number(qtyMap[item.product_id]) * item.price)}</span>
                              )}
                              <input type="number" min="0" max={item.qty} placeholder="Qty" value={qtyMap[item.product_id] || ''}
                                onChange={(e) => setQtyMap((p) => ({ ...p, [item.product_id]: e.target.value }))}
                                className="w-20 h-9 px-2 text-sm rounded-lg border border-border bg-background focus:outline-none text-center font-mono" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for return (optional)"
                      className="w-full h-10 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none" />

                    <div className="flex items-center justify-between border-t border-border/40 pt-4">
                      <div>
                        <p className="text-sm font-semibold">Refund Total</p>
                        <p className="text-xl font-black text-rose-600 font-mono">{fmtPKR(totalRefund)}</p>
                      </div>
                      <button onClick={handleSubmit} disabled={submitting || totalRefund === 0}
                        className="flex items-center gap-2 h-10 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors">
                        <RotateCcw size={14} /> {submitting ? 'Processing…' : 'Process Return'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── History ── */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
        {/* History Controls */}
        <div className="p-5 border-b bg-muted/10 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-1 p-1 rounded-xl bg-muted/60 border border-border/40">
            {[['sale', 'Sale Returns'], ['purchase', 'Purchase Returns']].map(([val, label]) => (
              <button key={val} onClick={() => setHistoryTab(val)}
                className={cn('px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all', historyTab === val ? 'bg-background text-foreground shadow-sm border border-border/60' : 'text-muted-foreground hover:text-foreground')}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 p-1 rounded-xl bg-muted/60 border border-border/40">
              {DATE_FILTERS.map((f) => (
                <button key={f.key} onClick={() => setDateFilter(f.key)}
                  className={cn('px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all', dateFilter === f.key ? 'bg-background text-foreground shadow-sm border border-border/60' : 'text-muted-foreground hover:text-foreground')}>
                  {f.label}
                </button>
              ))}
            </div>
            {dateFilter === 'custom' && (
              <div className="flex gap-2">
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 px-2 text-xs rounded-lg border border-border bg-background" />
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 px-2 text-xs rounded-lg border border-border bg-background" />
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={12} />
              <input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="Search..." className="h-8 pl-8 pr-3 text-xs rounded-lg border border-border bg-muted/20 focus:outline-none w-36" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-muted/20 border-b border-border/40">
              <th className="text-left text-xs font-semibold text-muted-foreground py-3 px-4">{historyTab === 'sale' ? 'Sale' : 'Purchase'} #</th>
              <th className="text-left text-xs font-semibold text-muted-foreground py-3 px-4">{historyTab === 'sale' ? 'Customer' : 'Vendor'}</th>
              <th className="text-left text-xs font-semibold text-muted-foreground py-3 px-4">Refunded</th>
              <th className="text-left text-xs font-semibold text-muted-foreground py-3 px-4">Reason</th>
              <th className="text-left text-xs font-semibold text-muted-foreground py-3 px-4">Date</th>
              <th className="py-3 px-4" />
            </tr></thead>
            <tbody>
              {(historyTab === 'sale' ? filteredSaleReturns : filteredPurchaseReturns).length === 0 ? (
                <tr><td colSpan={6} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground"><RotateCcw size={28} className="opacity-20" /><p className="text-sm">No returns recorded</p></div>
                </td></tr>
              ) : (historyTab === 'sale' ? pagedSaleReturns : pagedPurchaseReturns).map((ret) => (
                <ReturnRow key={ret.id} ret={ret} type={historyTab}
                  getItems={getItems} customerById={customerById} vendorById={vendorById} saleById={saleById} purchaseById={purchaseById} />
              ))}
            </tbody>
          </table>
        </div>
        {(() => {
          const count = historyTab === 'sale' ? filteredSaleReturns.length : filteredPurchaseReturns.length;
          const pg = historyTab === 'sale' ? srPage : prPage;
          const pgCount = historyTab === 'sale' ? srPageCount : prPageCount;
          const setPg = historyTab === 'sale' ? setSrPage : setPrPage;
          if (pgCount <= 1) return null;
          return (
            <div className="flex items-center justify-between px-5 py-2.5 border-t border-border/30 bg-muted/20">
              <span className="text-xs text-muted-foreground">{count} returns · page {pg} of {pgCount}</span>
              <div className="flex gap-1">
                <button onClick={() => setPg(p => Math.max(1, p - 1))} disabled={pg === 1}
                  className="h-7 w-7 rounded-lg border border-border text-base flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors">‹</button>
                <button onClick={() => setPg(p => Math.min(pgCount, p + 1))} disabled={pg === pgCount}
                  className="h-7 w-7 rounded-lg border border-border text-base flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors">›</button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
