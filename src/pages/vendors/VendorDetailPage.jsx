import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Phone, Mail, MapPin, CreditCard, ShoppingCart, Undo2, History,
  MessageCircle, ChevronDown, ChevronRight, Plus, Printer, Download,
  Trash2, Check, Clock, FileText, TrendingUp, Package, ArrowLeft, X,
  Boxes, DollarSign, CheckCircle2, Eye, Tag, CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { getReceiptSettings, printInvoice, downloadInvoicePdf } from '../../utils/receipt';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtPKR = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtDateShort = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }) : '—';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const GRADIENTS = ['from-indigo-500 to-blue-500', 'from-violet-500 to-purple-500', 'from-orange-500 to-amber-500', 'from-teal-500 to-emerald-500', 'from-rose-500 to-pink-500'];
const getGrad = (name = '') => GRADIENTS[name.charCodeAt(0) % GRADIENTS.length];
// gram products: stock is in grams, price is per-kg — divide by 1000 for value calculations.
// Also caps raw stock to guard against astronomically wrong cloud data.
const stockBaseQty = (p) => {
  const raw = Math.max(0, Number(p.stock || 0));
  return p.unit_type === 'gram' ? Math.min(raw, 100_000_000) / 1000 : Math.min(raw, 1_000_000);
};
// stock cost value per product, capped at 5M PKR (mirrors Electron guard)
const stockProductVal = (p) => {
  const retailPP = Math.min(Number(p.price || 0), 500_000);
  const pp = Math.min(Number(p.purchase_price || 0), retailPP);
  return Math.min(stockBaseQty(p) * pp, 5_000_000);
};

function poStatus(po) {
  if (po.status === 'Cancelled') return { label: 'Cancelled', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' };
  if (po.remaining <= 0.5) return { label: 'Settled', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' };
  if (po.amountPaid <= 0) return { label: 'Unpaid', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400' };
  return { label: 'Partial', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' };
}

function EmptyState({ icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
      <div className="text-muted-foreground/20">{icon}</div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

const POS_PER_PAGE = 10;

export default function VendorDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { list, pushEntity } = useDataStore();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [tab, setTab] = useState('purchases');
  const [posPage, setPosPage] = useState(1);
  const [poFilter, setPoFilter] = useState('all');
  const [payAmounts, setPayAmounts] = useState({});
  const [payNotesByPO, setPayNotesByPO] = useState({});
  const [expandedPoId, setExpandedPoId] = useState(null);
  const [genPayAmount, setGenPayAmount] = useState('');
  const [genPayNotes, setGenPayNotes] = useState('');

  const vendor = list('vendor').find((v) => String(v.id) === String(id));
  const allPurchases = list('purchase');
  const allPurchaseItems = list('purchase_item');
  const allPayments = list('vendor_payment');
  const allReturns = list('purchase_return');
  const allProducts = list('product');

  const data = useMemo(() => {
    if (!vendor) return null;
    const vid = String(vendor.id);
    const vendPurchases = allPurchases
      .filter((p) => String(p.vendor_id) === vid)
      .sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0));

    const poIds = new Set(vendPurchases.map((p) => String(p.id)));
    const vendPayments = allPayments.filter((p) => String(p.vendor_id) === vid)
      .sort((a, b) => new Date(b.date_added || 0) - new Date(a.date_added || 0));
    const vendReturns = allReturns.filter((r) => poIds.has(String(r.purchase_id)))
      .sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0));

    const vendorProducts = allProducts.filter((p) => String(p.vendor_id) === vid);

    const totalPurchased = vendPurchases.filter((p) => p.status !== 'Cancelled').reduce((s, p) => s + Number(p.total || 0), 0);
    const totalPaid = vendPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalReturned = vendReturns.reduce((s, r) => s + Number(r.total_returned || 0), 0);
    const balance = Math.max(0, totalPurchased - totalPaid - totalReturned);

    const enhancedPOs = vendPurchases.map((po) => {
      const items = allPurchaseItems.filter((i) => String(i.purchase_id) === String(po.id));
      const linkedPayments = vendPayments.filter((p) => String(p.purchase_id) === String(po.id));
      const linkedReturns = vendReturns.filter((r) => String(r.purchase_id) === String(po.id));
      const amountPaid = linkedPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
      const amountReturned = linkedReturns.reduce((s, r) => s + Number(r.total_returned || 0), 0);
      const remaining = Math.max(0, Number(po.total || 0) - amountPaid - amountReturned);
      return { ...po, items, linkedPayments, linkedReturns, amountPaid, amountReturned, remaining };
    });

    const stockCostValue = vendorProducts.reduce((s, p) => s + stockProductVal(p), 0);
    const totalStock = vendorProducts.reduce((s, p) => s + stockBaseQty(p), 0);

    const activity = [
      ...vendPurchases.map((p) => ({ type: 'PURCHASE', date: p.date_created, notes: `Purchase Order — ${fmtPKR(p.total)}`, amount: Number(p.total || 0), id: p.id })),
      ...vendPayments.map((p) => ({ type: 'PAYMENT_ADDED', date: p.date_added, notes: `Payment made — ${fmtPKR(p.amount)}`, amount: Number(p.amount || 0), id: p.id })),
      ...vendReturns.map((r) => ({ type: 'RETURN', date: r.date_created, notes: `Return — ${fmtPKR(r.total_returned)}`, amount: Number(r.total_returned || 0), id: r.id })),
    ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    return { purchases: enhancedPOs, payments: vendPayments, returns: vendReturns, products: vendorProducts, activity, totalPurchased, totalPaid, totalReturned, balance, stockCostValue, totalStock };
  }, [vendor, allPurchases, allPurchaseItems, allPayments, allReturns, allProducts]);

  const timeline = useMemo(() => {
    if (!data) return [];
    const filteredPOs = data.purchases.filter((p) => {
      if (poFilter === 'all') return true;
      if (poFilter === 'cancelled') return p.status === 'Cancelled';
      if (p.status === 'Cancelled') return false;
      if (poFilter === 'settled') return p.remaining <= 0.5;
      if (poFilter === 'partial') return p.remaining > 0.5 && p.amountPaid > 0;
      if (poFilter === 'unpaid') return p.remaining > 0.5 && p.amountPaid <= 0;
      return true;
    });
    const pagedPOs = filteredPOs.slice(0, posPage * POS_PER_PAGE);
    return [
      ...pagedPOs.map((p) => ({ ...p, _type: 'purchase', _sortDate: new Date(p.date_created || 0).getTime() })),
      ...data.payments.map((p) => ({ ...p, _type: 'payment', _sortDate: new Date(p.date_added || 0).getTime() })),
    ].sort((a, b) => b._sortDate - a._sortDate);
  }, [data, poFilter, posPage]);

  const recordPayment = async (purchaseId) => {
    const amt = Number(payAmounts[purchaseId]);
    if (!amt || amt <= 0) { showToast('Enter a valid amount', 'error'); return; }
    try {
      await pushEntity('vendor_payment', 'create', {
        vendor_id: vendor.id,
        amount: amt,
        notes: payNotesByPO[purchaseId] || '',
        purchase_id: purchaseId,
        date_added: new Date().toISOString(),
      });
      showToast('Payment recorded');
      setPayAmounts((prev) => { const n = { ...prev }; delete n[purchaseId]; return n; });
      setPayNotesByPO((prev) => { const n = { ...prev }; delete n[purchaseId]; return n; });
    } catch { showToast('Failed to record payment', 'error'); }
  };

  const cancelPO = async (po) => {
    if (!window.confirm(`Cancel ${poNumber(po)}? This cannot be undone.`)) return;
    try {
      await pushEntity('purchase', 'update', { ...po, status: 'Cancelled', updated_at: new Date().toISOString() });
      showToast('Purchase order cancelled');
    } catch { showToast('Failed to cancel order', 'error'); }
  };

  const deletePayment = async (paymentId) => {
    await pushEntity('vendor_payment', 'delete', { id: paymentId });
    showToast('Payment removed');
  };

  if (!vendor) {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <p className="text-muted-foreground">Vendor not found</p>
        <button onClick={() => navigate('/vendors')} className="text-sm text-primary hover:underline">← Back to Vendors</button>
      </div>
    );
  }
  if (!data) return null;

  const { purchases, payments, returns, products, activity, totalPurchased, totalPaid, totalReturned, balance, stockCostValue, totalStock } = data;
  const filteredPOs = purchases.filter((p) => {
    if (poFilter === 'all') return true;
    if (poFilter === 'cancelled') return p.status === 'Cancelled';
    if (p.status === 'Cancelled') return false;
    if (poFilter === 'settled') return p.remaining <= 0.5;
    if (poFilter === 'partial') return p.remaining > 0.5 && p.amountPaid > 0;
    if (poFilter === 'unpaid') return p.remaining > 0.5 && p.amountPaid <= 0;
    return true;
  });
  const hasMorePOs = filteredPOs.length > posPage * POS_PER_PAGE;
  const settledCount = purchases.filter((p) => p.remaining <= 0.5 && p.status !== 'Cancelled').length;
  const pendingCount = purchases.filter((p) => p.remaining > 0.5 && p.status !== 'Cancelled').length;

  const poNumber = (po) => {
    const d = po.date_created ? new Date(po.date_created) : new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `PO-${ymd}-${String(po.id).slice(-5).toUpperCase()}`;
  };

  // PO → invoice data for the shared print/PDF builders (vendor is the bill-to)
  const poInvoiceData = (po) => {
    const settings = getReceiptSettings();
    return {
      saleId: po.id,
      items: (po.items || []).map((i) => ({ name: i.product_name, qty: Number(i.quantity), price: Number(i.cost_price || i.purchase_price || 0) })),
      subtotal: Number(po.total),
      discount: 0,
      total: Number(po.total),
      paymentMethod: po.payment_method || 'cash',
      settings: { ...settings, store_name: settings.store_name || user?.store_name || 'My Store' },
      date: new Date(po.date_created || Date.now()).toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      customerName: vendor?.name,
      customerPhone: vendor?.phone,
      amountPaid: po.amountPaid,
      balance: po.remaining > 0.5 ? po.remaining : 0,
    };
  };

  // WhatsApp the current payment status of a PO to the vendor
  const waPoStatus = (po) => {
    if (!vendor?.phone) return;
    const storeName = getReceiptSettings().store_name || user?.store_name || 'Store';
    let msg = `🧾 *${poNumber(po)}* — ${storeName}\n📅 ${fmtDate(po.date_created)}\n───────────────\n`;
    msg += `💰 Total: ${fmtPKR(po.total)}\n✅ Paid: ${fmtPKR(po.amountPaid)}\n`;
    msg += po.remaining > 0.5 ? `🔴 Remaining: ${fmtPKR(po.remaining)}\n` : `🟢 Fully settled\n`;
    let phone = String(vendor.phone).replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '92' + phone.substring(1);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="flex flex-col">
      {/* Back bar */}
      <div className="flex items-center gap-2 px-1 pb-4">
        <button onClick={() => navigate('/vendors')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={14} /> Vendors
        </button>
        <ChevronRight size={12} className="text-muted-foreground/50" />
        <span className="text-sm font-semibold">{vendor.name}</span>
      </div>

      <div className="flex flex-col lg:flex-row lg:flex-1 lg:min-h-0 border border-border rounded-2xl overflow-hidden bg-card shadow-sm">

        {/* ── LEFT SIDEBAR ── */}
        <div className="border-b border-border lg:border-b-0 lg:w-[260px] lg:shrink-0 lg:border-r lg:flex lg:flex-col lg:overflow-y-auto">

          {/* Profile */}
          <div className="p-6 text-center border-b border-border">
            <div className={cn('w-20 h-20 rounded-2xl mx-auto flex items-center justify-center text-3xl font-black text-white mb-4 bg-gradient-to-br', getGrad(vendor.name))}>
              {(vendor.name || '?')[0].toUpperCase()}
            </div>
            <h2 className="text-base font-black leading-tight">{vendor.name}</h2>
            {vendor.company && <p className="text-xs text-muted-foreground mt-0.5 font-medium">{vendor.company}</p>}
            <p className="text-[11px] text-muted-foreground mt-1">
              {vendor.created_at ? `Vendor since ${new Date(vendor.created_at).toLocaleDateString('en-PK', { month: 'short', year: 'numeric' })}` : 'Vendor'}
            </p>
            <div className="mt-4 space-y-2 text-left">
              {vendor.phone && <div className="flex items-center gap-2 text-sm"><Phone size={12} className="text-muted-foreground shrink-0" /><span className="font-medium">{vendor.phone}</span></div>}
              {vendor.email && <div className="flex items-center gap-2 text-sm"><Mail size={12} className="text-muted-foreground shrink-0" /><span className="text-xs truncate">{vendor.email}</span></div>}
              {vendor.address && <div className="flex items-start gap-2 text-sm"><MapPin size={12} className="text-muted-foreground shrink-0 mt-0.5" /><span className="text-xs break-words leading-relaxed">{vendor.address}</span></div>}
            </div>
            {vendor.phone && (
              <button onClick={() => window.open(`https://wa.me/92${vendor.phone.replace(/^0/, '')}`, '_blank')}
                className="mt-4 w-full h-8 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 text-xs font-semibold flex items-center justify-center gap-2 transition-colors">
                <MessageCircle size={13} /> Open WhatsApp
              </button>
            )}
          </div>

          {/* Balance */}
          <div className="px-5 pt-5 pb-3 border-b border-border">
            <div className={cn('rounded-xl p-4 border text-center', balance > 0.5 ? 'bg-rose-500/8 border-rose-500/20' : 'bg-emerald-500/8 border-emerald-500/20')}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Amount Owed (Baqi)</p>
              <p className={cn('text-2xl font-black', balance > 0.5 ? 'text-rose-600' : 'text-emerald-600')}>{fmtPKR(balance)}</p>
              {balance <= 0.5 && <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">All clear ✓</p>}
            </div>
          </div>

          {/* Stats */}
          <div className="px-5 py-4 border-b border-border">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Lifetime Stats</p>
            <div className="space-y-2.5">
              {[
                { icon: TrendingUp, label: 'Total Purchased',   value: fmtPKR(totalPurchased),             color: 'text-foreground' },
                { icon: Check,      label: 'Total Paid',        value: fmtPKR(totalPaid),                  color: 'text-emerald-600' },
                { icon: Undo2,      label: 'Total Returned',    value: fmtPKR(totalReturned),              color: 'text-amber-600' },
                { icon: FileText,   label: 'Total Orders',      value: String(purchases.length),           color: 'text-foreground' },
                { icon: Check,      label: 'Settled Orders',    value: `${settledCount} / ${purchases.length}`, color: 'text-emerald-600' },
                { icon: Clock,      label: 'Pending Orders',    value: String(pendingCount),               color: pendingCount > 0 ? 'text-rose-600' : 'text-foreground' },
                { icon: Package,    label: 'Products Supplied', value: String(products.length),            color: 'text-foreground' },
                { icon: Boxes,      label: 'Stock Cost Value',  value: fmtPKR(stockCostValue),             color: 'text-primary' },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                    <Icon size={12} className="shrink-0" /><span className="truncate">{label}</span>
                  </div>
                  <span className={cn('text-xs font-bold shrink-0 ml-2', color)}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Count pills */}
          <div className="px-5 py-4 mt-auto">
            <div className="flex gap-2 text-[11px]">
              {[['Payments', payments.length], ['Returns', returns.length], ['Events', activity.length]].map(([lbl, cnt]) => (
                <div key={lbl} className="flex-1 rounded-lg bg-muted/50 px-3 py-2 text-center">
                  <p className="font-black">{cnt}</p><p className="text-muted-foreground">{lbl}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div className="flex flex-col lg:flex-1 lg:min-w-0 lg:overflow-hidden">
          <Tabs value={tab} onValueChange={setTab} className="flex flex-col lg:flex-1 lg:overflow-hidden">
            <div className="border-b border-border px-6 pt-4 pb-0 shrink-0">
              <TabsList className="h-9 mb-0">
                {[
                  ['purchases', ShoppingCart, 'Transactions', purchases.length],
                  ['products',  Package,      'Products',     products.length],
                  ['payments',  CreditCard,   'Ledger',       payments.length],
                  ['returns',   Undo2,        'Returns',      returns.length],
                  ['activity',  History,      'Activity Log', 0],
                ].map(([val, Icon, lbl, cnt]) => (
                  <TabsTrigger key={val} value={val} className="gap-1.5 text-xs">
                    <Icon size={12} /> {lbl}
                    {cnt > 0 && <span className="ml-1 bg-muted text-muted-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full">{cnt}</span>}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* TRANSACTIONS — mixed timeline of POs + payments */}
            <TabsContent value="purchases" className="lg:flex-1 lg:overflow-y-auto m-0 p-4">
              {purchases.length === 0 ? <EmptyState icon={<ShoppingCart size={36} />} text="No purchase orders yet" /> : (
                <div className="space-y-3">
                  {/* Status filter pills */}
                  <div className="flex gap-1.5 pb-1 overflow-x-auto scrollbar-none" style={{ scrollbarWidth: 'none' }}>
                    {[['all', 'All'], ['unpaid', 'Unpaid'], ['partial', 'Partial'], ['settled', 'Settled'], ['cancelled', 'Cancelled']].map(([val, lbl]) => (
                      <button key={val} onClick={() => { setPoFilter(val); setPosPage(1); }}
                        className={cn('px-3 py-1.5 text-xs font-semibold rounded-full transition-colors shrink-0',
                          poFilter === val ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/60 text-muted-foreground hover:text-foreground')}>
                        {lbl}
                      </button>
                    ))}
                    <span className="ml-auto text-xs text-muted-foreground self-center shrink-0 pl-2">{filteredPOs.length} order{filteredPOs.length !== 1 ? 's' : ''}</span>
                  </div>

                  {timeline.map((item) => {
                    if (item._type === 'payment') {
                      return (
                        <div key={`pay-${item.id}`} className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20 px-4 py-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                            <CheckCircle2 size={18} className="text-emerald-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-black tracking-wide text-emerald-700 dark:text-emerald-400">PAYMENT MADE</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDateTime(item.date_added)}</p>
                            {item.notes && <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">{item.notes}</p>}
                          </div>
                          <p className="text-sm font-black text-emerald-600 tabular-nums shrink-0">{fmtPKR(item.amount)}</p>
                          <button onClick={() => deletePayment(item.id)} className="ml-1 text-muted-foreground/30 hover:text-destructive transition-colors shrink-0">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    }

                    // PO card
                    const po = item;
                    const st = poStatus(po);
                    const paidPct = Math.min(100, Math.round(Number(po.total) > 0 ? (po.amountPaid / Number(po.total)) * 100 : 0));
                    const isExpanded = expandedPoId === po.id;
                    return (
                      <div key={`po-${po.id}`} className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
                        {/* Gradient top accent */}
                        <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-violet-500" />

                        {/* Header */}
                        <div className="flex items-start justify-between px-4 pt-3 pb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black font-mono">{poNumber(po)}</span>
                              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', st.cls)}>{st.label}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                              <CalendarDays size={11} />
                              {fmtDate(po.date_created)}
                            </div>
                          </div>
                          <button
                            onClick={() => setExpandedPoId(isExpanded ? null : po.id)}
                            className={cn('w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
                              isExpanded ? 'bg-primary/10 text-primary' : 'text-muted-foreground/50 hover:text-foreground hover:bg-muted')}>
                            <Eye size={15} />
                          </button>
                        </div>

                        {/* TOTAL / PAID / BALANCE */}
                        <div className="grid grid-cols-3 gap-2 px-4 pb-3">
                          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-center">
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Total</p>
                            <p className="text-xs font-black mt-0.5 tabular-nums">{fmtPKR(po.total)}</p>
                          </div>
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30 px-3 py-2 text-center">
                            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Paid</p>
                            <p className="text-xs font-black mt-0.5 text-emerald-600 tabular-nums">{fmtPKR(po.amountPaid)}</p>
                          </div>
                          <div className={cn('rounded-lg px-3 py-2 text-center border', po.remaining > 0.5 ? 'border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30' : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30')}>
                            <p className={cn('text-[9px] font-black uppercase tracking-widest', po.remaining > 0.5 ? 'text-rose-600' : 'text-emerald-600')}>Balance</p>
                            <p className={cn('text-xs font-black mt-0.5 tabular-nums', po.remaining > 0.5 ? 'text-rose-600' : 'text-emerald-600')}>{fmtPKR(po.remaining)}</p>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="px-4 pb-3">
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${paidPct}%` }} />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{paidPct}% paid</p>
                        </div>

                        {/* Items summary */}
                        {po.items?.length > 0 && (
                          <div className="mx-4 mb-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              <span className="font-bold text-foreground">≡ Items: </span>
                              {po.items.map((i, idx) => (
                                <span key={idx}>
                                  {idx > 0 && <span className="text-muted-foreground/40">, </span>}
                                  {i.product_name} <span className="font-semibold text-foreground/80">×{i.quantity}</span>
                                </span>
                              ))}
                            </p>
                          </div>
                        )}

                        {/* Action bar */}
                        <div className="flex items-center gap-2 px-4 pb-4">
                          {po.remaining > 0.5 && po.status !== 'Cancelled' && (
                            <>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground font-bold pointer-events-none">PKR</span>
                                <input
                                  type="number" min="0"
                                  value={payAmounts[po.id] ?? ''}
                                  onChange={(e) => setPayAmounts((prev) => ({ ...prev, [po.id]: e.target.value }))}
                                  placeholder={Math.round(po.remaining).toLocaleString()}
                                  className="h-9 pl-9 pr-2 w-28 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 tabular-nums"
                                />
                              </div>
                              <button
                                disabled={!payAmounts[po.id] || Number(payAmounts[po.id]) <= 0}
                                onClick={() => recordPayment(po.id)}
                                className="h-9 px-4 text-xs rounded-lg bg-primary text-primary-foreground font-bold disabled:opacity-40 shrink-0 transition-opacity"
                              >
                                Pay
                              </button>
                            </>
                          )}
                          <div className="flex items-center gap-1.5 ml-auto">
                            <button
                              onClick={() => setExpandedPoId(isExpanded ? null : po.id)}
                              title="View details"
                              className={cn('w-8 h-8 rounded-lg border flex items-center justify-center transition-colors',
                                isExpanded ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted')}>
                              <Eye size={14} />
                            </button>
                            {po.status !== 'Cancelled' && (
                              <button
                                onClick={() => cancelPO(po)}
                                title="Cancel order"
                                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 transition-colors">
                                <X size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => navigate('/returns')}
                              title="Record return"
                              className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-amber-600 hover:border-amber-400/40 hover:bg-amber-500/10 transition-colors">
                              <Undo2 size={14} />
                            </button>
                            {vendor.phone && (
                              <button
                                onClick={() => waPoStatus(po)}
                                title="Send status via WhatsApp"
                                className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white hover:bg-emerald-600 transition-colors">
                                <MessageCircle size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => printInvoice(poInvoiceData(po))}
                              title="Print order"
                              className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors">
                              <Printer size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Expanded detail section */}
                        {isExpanded && (
                          <div className="border-t border-border/40 bg-muted/10 px-4 py-3 space-y-3">
                            {po.items?.length > 0 && (
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Items Breakdown</p>
                                <div className="space-y-1.5">
                                  {po.items.map((item, idx) => (
                                    <div key={idx} className="flex items-center text-xs gap-2">
                                      <span className="font-medium flex-1 min-w-0 truncate">{item.product_name}</span>
                                      <span className="text-muted-foreground shrink-0">×{item.quantity}</span>
                                      <span className="text-muted-foreground shrink-0 tabular-nums w-20 text-right">{fmtPKR(item.cost_price || item.purchase_price)}</span>
                                      <span className="font-bold shrink-0 tabular-nums w-24 text-right">{fmtPKR(Number(item.cost_price || item.purchase_price || 0) * Number(item.quantity))}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-2 pt-2 border-t border-border/40 space-y-1 text-xs">
                                  {po.amountReturned > 0 && (
                                    <div className="flex justify-between text-muted-foreground">
                                      <span>Returns</span><span className="text-amber-600 tabular-nums">−{fmtPKR(po.amountReturned)}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between font-bold border-t border-border/40 pt-1 mt-1">
                                    <span>Grand Total</span><span className="tabular-nums">{fmtPKR(po.total)}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                            {po.linkedReturns?.length > 0 && (
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Returns on this Order</p>
                                <div className="space-y-1">
                                  {po.linkedReturns.map((r) => (
                                    <div key={r.id} className="flex items-center justify-between text-xs rounded-lg bg-amber-500/5 border border-amber-500/15 px-3 py-1.5">
                                      <span className="text-muted-foreground">{fmtDate(r.date_created)}</span>
                                      {r.reason && <span className="text-muted-foreground/60 truncate mx-2">{r.reason}</span>}
                                      <span className="font-bold text-amber-600 tabular-nums">{fmtPKR(r.total_returned)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {hasMorePOs && (
                    <div className="flex justify-center pt-2 pb-4">
                      <button onClick={() => setPosPage((p) => p + 1)}
                        className="flex items-center gap-2 h-8 px-4 text-xs rounded-lg border border-border bg-background hover:bg-muted">
                        <ChevronDown size={13} /> Load {Math.min(POS_PER_PAGE, filteredPOs.length - posPage * POS_PER_PAGE)} more
                      </button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* PRODUCTS */}
            <TabsContent value="products" className="lg:flex-1 lg:overflow-y-auto m-0 p-5">
              {products.length === 0 ? <EmptyState icon={<Package size={36} />} text="No products from this vendor" /> : (
                <div>
                  {/* 3-stat banner */}
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      { label: 'Products', value: String(products.length), color: 'text-foreground' },
                      { label: 'Total In Stock', value: totalStock.toLocaleString(), color: 'text-primary' },
                      { label: 'Stock Cost Value', value: fmtPKR(stockCostValue), color: 'text-emerald-600' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
                        <p className={cn('text-lg font-black mt-0.5', color)}>{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-[1fr_80px_80px_100px_110px] gap-3 px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border">
                    <span>Product</span><span className="text-center">Purchased</span><span className="text-center">In Stock</span><span className="text-right">Cost Price</span><span className="text-right">Stock Value</span>
                  </div>
                  <div className="divide-y divide-border/20 mt-1">
                    {products.map((p) => {
                      const stockValue = stockProductVal(p);
                      const totalBought = allPurchaseItems
                        .filter((i) => String(i.product_id) === String(p.id))
                        .reduce((s, i) => s + Number(i.quantity || 0), 0);
                      return (
                        <div key={p.id} className="grid grid-cols-[1fr_80px_80px_100px_110px] gap-3 items-center px-3 py-3 hover:bg-muted/20 transition-colors rounded-xl">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{p.name}</p>
                            {p.barcode && <p className="text-[10px] text-muted-foreground font-mono">{p.barcode}</p>}
                          </div>
                          <p className="text-xs font-bold text-center text-muted-foreground">{totalBought}</p>
                          <p className={cn('text-xs font-bold text-center', Number(p.stock || 0) === 0 ? 'text-rose-600' : Number(p.stock || 0) <= (p.low_stock_threshold || 5) ? 'text-amber-600' : 'text-foreground')}>
                            {Number(p.stock || 0)}
                          </p>
                          <p className="text-xs font-semibold text-right text-muted-foreground tabular-nums">{fmtPKR(p.purchase_price)}</p>
                          <p className="text-sm font-bold text-right text-primary tabular-nums">{fmtPKR(stockValue)}</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-4 border-t border-border flex justify-between text-sm font-bold">
                    <span className="text-muted-foreground">{products.length} product{products.length !== 1 ? 's' : ''} total</span>
                    <span className="text-primary">{fmtPKR(stockCostValue)} total value</span>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* PAYMENTS */}
            <TabsContent value="payments" className="lg:flex-1 lg:overflow-y-auto m-0 p-5">
              {payments.length === 0 ? <EmptyState icon={<CreditCard size={36} />} text="No payments recorded yet" /> : (
                <div>
                  <div className="grid grid-cols-[1fr_130px_120px_40px] gap-3 px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border">
                    <span>Date & Notes</span><span className="text-right">Amount</span><span className="text-center">PO Ref</span><span />
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {payments.map((p) => (
                      <div key={p.id} className="grid grid-cols-[1fr_130px_120px_40px] gap-3 items-center px-3 py-2.5 rounded-xl hover:bg-muted/30 transition-colors group">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold">{fmtDate(p.date_added)}</p>
                          {p.notes && <p className="text-[10px] text-muted-foreground truncate">{p.notes}</p>}
                        </div>
                        <p className="text-sm font-black text-emerald-600 text-right tabular-nums">{fmtPKR(p.amount)}</p>
                        <p className="text-xs text-muted-foreground text-center">
                          {p.purchase_id ? <span className="bg-muted px-2 py-0.5 rounded-md font-mono text-[10px]">#{p.purchase_id}</span> : <span className="text-muted-foreground/50">General</span>}
                        </p>
                        <button onClick={() => deletePayment(p.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-border flex justify-between text-sm font-bold">
                    <span className="text-muted-foreground">{payments.length} payment{payments.length !== 1 ? 's' : ''} total</span>
                    <span className="text-emerald-600">{fmtPKR(payments.reduce((s, p) => s + Number(p.amount || 0), 0))}</span>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* RETURNS */}
            <TabsContent value="returns" className="lg:flex-1 lg:overflow-y-auto m-0 p-5">
              {returns.length === 0 ? <EmptyState icon={<Undo2 size={36} />} text="No returns recorded" /> : (
                <div className="space-y-2">
                  {returns.map((r) => (
                    <div key={r.id} className="border border-border/60 rounded-xl px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold font-mono">PO #{r.purchase_id}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(r.date_created)}</p>
                          {r.reason && <p className="text-xs text-muted-foreground mt-2 bg-muted/50 rounded-lg px-3 py-1.5 inline-block">"{r.reason}"</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-black text-amber-600 tabular-nums">{fmtPKR(r.total_returned)}</p>
                          <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 px-2 py-0.5 rounded-full">Returned</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-border flex justify-between text-sm font-bold">
                    <span className="text-muted-foreground">{returns.length} return{returns.length !== 1 ? 's' : ''} total</span>
                    <span className="text-amber-600">{fmtPKR(returns.reduce((s, r) => s + Number(r.total_returned || 0), 0))}</span>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ACTIVITY */}
            <TabsContent value="activity" className="lg:flex-1 lg:overflow-y-auto m-0 p-5">
              {activity.length === 0 ? <EmptyState icon={<History size={36} />} text="No activity recorded" /> : (
                <div className="relative pl-4">
                  <div className="absolute left-[18px] top-3 bottom-3 w-px bg-border/50" />
                  <div className="space-y-1">
                    {activity.map((h, idx) => {
                      const dot = h.type === 'PAYMENT_ADDED' ? { bg: 'bg-emerald-500', icon: <Check size={10} /> } :
                        h.type === 'RETURN' ? { bg: 'bg-amber-500', icon: <Undo2 size={9} /> } :
                          { bg: 'bg-primary', icon: <Clock size={10} /> };
                      return (
                        <div key={idx} className="flex gap-4 py-2">
                          <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 relative z-10', dot.bg)}>{dot.icon}</div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-xs font-semibold leading-snug">{h.notes}</p>
                              <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap shrink-0">{fmtDateShort(h.date)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
