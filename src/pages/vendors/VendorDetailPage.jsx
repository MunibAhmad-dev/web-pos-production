import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Phone, Mail, MapPin, CreditCard, ShoppingCart, Undo2, History,
  MessageCircle, ChevronDown, ChevronRight, Plus,
  Trash2, Check, Clock, FileText, TrendingUp, Package, ArrowLeft, X,
  Boxes, DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtPKR = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtDateShort = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }) : '—';

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
  const [tab, setTab] = useState('purchases');
  const [posPage, setPosPage] = useState(1);
  const [expandedPoId, setExpandedPoId] = useState(null);
  const [payingPoId, setPayingPoId] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
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

  const recordPayment = async (purchaseId) => {
    const amt = Number(purchaseId ? payAmount : genPayAmount);
    if (!amt || amt <= 0) { showToast('Enter a valid amount', 'error'); return; }
    try {
      await pushEntity('vendor_payment', 'create', {
        vendor_id: vendor.id,
        amount: amt,
        notes: (purchaseId ? payNotes : genPayNotes) || '',
        purchase_id: purchaseId || null,
        date_added: new Date().toISOString(),
      });
      showToast('Payment recorded');
      if (purchaseId) { setPayingPoId(null); setPayAmount(''); setPayNotes(''); }
      else { setGenPayAmount(''); setGenPayNotes(''); }
    } catch { showToast('Failed to record payment', 'error'); }
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
  const visiblePOs = purchases.slice(0, posPage * POS_PER_PAGE);
  const hasMorePOs = visiblePOs.length < purchases.length;
  const settledCount = purchases.filter((p) => p.remaining <= 0.5 && p.status !== 'Cancelled').length;
  const pendingCount = purchases.filter((p) => p.remaining > 0.5 && p.status !== 'Cancelled').length;

  const poNumber = (po) => {
    const d = po.date_created ? new Date(po.date_created) : new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `PO-${ymd}-${String(po.id).slice(-5).toUpperCase()}`;
  };

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-4rem)]">
      {/* Back bar */}
      <div className="flex items-center gap-2 px-1 pb-4">
        <button onClick={() => navigate('/vendors')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={14} /> Vendors
        </button>
        <ChevronRight size={12} className="text-muted-foreground/50" />
        <span className="text-sm font-semibold">{vendor.name}</span>
      </div>

      <div className="flex flex-1 min-h-0 gap-0 border border-border rounded-2xl overflow-hidden bg-card shadow-sm">

        {/* ── LEFT SIDEBAR ── */}
        <div className="w-[260px] shrink-0 border-r border-border flex flex-col overflow-y-auto">

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

          {/* Quick payment */}
          {balance > 0.5 && (
            <div className="px-5 py-4 border-b border-border">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Record Payment</p>
              <div className="space-y-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground font-bold">PKR</span>
                  <input type="number" min="0" value={genPayAmount} onChange={(e) => setGenPayAmount(e.target.value)} placeholder="Amount"
                    className="w-full pl-11 h-8 text-sm rounded-md border border-border bg-background focus:outline-none" />
                </div>
                <input value={genPayNotes} onChange={(e) => setGenPayNotes(e.target.value)} placeholder="Notes (optional)"
                  className="w-full px-3 h-8 text-xs rounded-md border border-border bg-background focus:outline-none" />
                <div className="flex gap-1.5">
                  <button disabled={!genPayAmount} onClick={() => recordPayment(null)}
                    className="flex-1 h-8 text-xs gap-1 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center">
                    <Check size={12} /> Log Payment
                  </button>
                  <button onClick={() => setGenPayAmount(String(Math.round(balance)))}
                    className="h-8 px-3 text-xs rounded-lg border border-border bg-background hover:bg-muted">Full</button>
                </div>
              </div>
            </div>
          )}

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
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
            <div className="border-b border-border px-6 pt-4 pb-0 shrink-0">
              <TabsList className="h-9 mb-0">
                {[
                  ['purchases', ShoppingCart, 'Purchases', purchases.length],
                  ['products',  Package,      'Products',  products.length],
                  ['payments',  CreditCard,   'Payments',  payments.length],
                  ['returns',   Undo2,        'Returns',   returns.length],
                  ['activity',  History,      'Activity',  0],
                ].map(([val, Icon, lbl, cnt]) => (
                  <TabsTrigger key={val} value={val} className="gap-1.5 text-xs">
                    <Icon size={12} /> {lbl}
                    {cnt > 0 && <span className="ml-1 bg-muted text-muted-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full">{cnt}</span>}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* PURCHASES */}
            <TabsContent value="purchases" className="flex-1 overflow-y-auto m-0 p-5 space-y-2">
              {purchases.length === 0 ? <EmptyState icon={<ShoppingCart size={36} />} text="No purchase orders yet" /> : (
                <>
                  <div className="hidden md:grid grid-cols-[24px_1fr_96px_100px_100px_100px_72px] gap-3 px-3 pb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border">
                    <span /><span>PO Number</span><span className="text-right">Total</span><span className="text-right">Paid</span><span className="text-right">Due</span><span className="text-center">Method</span><span className="text-center">Status</span>
                  </div>
                  {visiblePOs.map((po) => {
                    const st = poStatus(po);
                    const isExpanded = expandedPoId === po.id;
                    return (
                      <div key={po.id} className={cn('border rounded-xl overflow-hidden transition-all duration-150', isExpanded ? 'border-primary/40 shadow-sm' : 'border-border/60 hover:border-border')}>
                        <button className="w-full grid grid-cols-[24px_1fr_96px_100px_100px_100px_72px] gap-3 items-center px-3 py-3.5 hover:bg-muted/20 transition-colors text-left"
                          onClick={() => setExpandedPoId(isExpanded ? null : po.id)}>
                          <ChevronRight size={14} className={cn('text-muted-foreground/50 transition-transform shrink-0', isExpanded && 'rotate-90 text-primary')} />
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate font-mono">{poNumber(po)}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(po.date_created)}{po.items?.length > 0 && <span className="ml-1.5 text-muted-foreground/60">· {po.items.length} item{po.items.length !== 1 ? 's' : ''}</span>}</p>
                          </div>
                          <p className="text-xs font-bold text-right tabular-nums">{fmtPKR(po.total)}</p>
                          <p className="text-xs font-semibold text-right text-emerald-600 tabular-nums">{fmtPKR(po.amountPaid)}</p>
                          <p className={cn('text-xs font-bold text-right tabular-nums', po.remaining > 0.5 ? 'text-rose-600' : 'text-muted-foreground')}>{fmtPKR(Math.max(0, po.remaining))}</p>
                          <p className="text-[10px] text-center text-muted-foreground font-medium capitalize">{po.payment_method === 'credit' ? 'Credit' : po.payment_method === 'online' ? 'Online' : 'Cash'}</p>
                          <div className="flex justify-center"><span className={cn('text-[10px] font-bold px-2.5 py-0.5 rounded-full', st.cls)}>{st.label}</span></div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-border/40 bg-muted/10">
                            {/* Items */}
                            {po.items?.length > 0 && (
                              <div className="px-5 pt-4 pb-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2"><Package size={10} className="inline mr-1" /> Items</p>
                                <table className="w-full">
                                  <thead><tr className="text-[10px] text-muted-foreground border-b border-border/40">
                                    <th className="text-left pb-1.5 font-semibold">Product</th>
                                    <th className="text-center pb-1.5 font-semibold w-16">Added</th>
                                    <th className="text-center pb-1.5 font-semibold w-20">Remaining</th>
                                    <th className="text-right pb-1.5 font-semibold w-24">Cost</th>
                                    <th className="text-right pb-1.5 font-semibold w-28">Total</th>
                                  </tr></thead>
                                  <tbody>{po.items.map((item) => (
                                    <tr key={item.id} className="text-xs border-b border-border/20 last:border-0">
                                      <td className="py-1.5 pr-2 font-medium">{item.product_name}</td>
                                      <td className="py-1.5 text-center text-muted-foreground">{item.quantity}</td>
                                      <td className="py-1.5 text-center text-muted-foreground">{item.remaining_quantity ?? item.quantity}</td>
                                      <td className="py-1.5 text-right text-muted-foreground tabular-nums">{fmtPKR(item.cost_price || item.purchase_price)}</td>
                                      <td className="py-1.5 text-right font-semibold tabular-nums">{fmtPKR((Number(item.cost_price || item.purchase_price || 0)) * Number(item.quantity))}</td>
                                    </tr>
                                  ))}</tbody>
                                </table>
                                <div className="mt-2 pt-2 border-t border-border/40 space-y-1 text-xs">
                                  {po.amountReturned > 0 && <div className="flex justify-between text-muted-foreground"><span>Returned</span><span className="text-amber-600">−{fmtPKR(po.amountReturned)}</span></div>}
                                  <div className="flex justify-between font-bold pt-0.5 border-t border-border/40"><span>Grand Total</span><span>{fmtPKR(po.total)}</span></div>
                                  <div className="flex justify-between text-emerald-600"><span>Paid</span><span>{fmtPKR(po.amountPaid)}</span></div>
                                  {po.remaining > 0.5 && <div className="flex justify-between font-bold text-rose-600"><span>Remaining</span><span>{fmtPKR(po.remaining)}</span></div>}
                                </div>
                              </div>
                            )}

                            {/* Linked payments */}
                            {po.linkedPayments?.length > 0 && (
                              <div className="px-5 py-3 border-t border-border/30">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2"><CreditCard size={10} className="inline mr-1" /> Payments on this order</p>
                                <div className="space-y-1.5">
                                  {po.linkedPayments.map((p) => (
                                    <div key={p.id} className="flex items-center justify-between text-xs rounded-lg bg-emerald-500/5 border border-emerald-500/15 px-3 py-1.5">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                        <span className="text-muted-foreground">{fmtDateShort(p.date_added)}</span>
                                        {p.notes && <span className="text-muted-foreground/60 truncate">· {p.notes}</span>}
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0 ml-3">
                                        <span className="font-bold text-emerald-600 tabular-nums">{fmtPKR(p.amount)}</span>
                                        <button onClick={() => deletePayment(p.id)} className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"><Trash2 size={11} /></button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Linked returns */}
                            {po.linkedReturns?.length > 0 && (
                              <div className="px-5 py-3 border-t border-border/30">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2"><Undo2 size={10} className="inline mr-1" /> Returns on this order</p>
                                <div className="space-y-1.5">
                                  {po.linkedReturns.map((r) => (
                                    <div key={r.id} className="flex items-center justify-between text-xs rounded-lg bg-amber-500/5 border border-amber-500/15 px-3 py-1.5">
                                      <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                        <span className="text-muted-foreground">{fmtDateShort(r.date_created)}</span>
                                        {r.reason && <span className="text-muted-foreground/60">· {r.reason}</span>}
                                      </div>
                                      <span className="font-bold text-amber-600 tabular-nums">{fmtPKR(r.total_returned)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Inline pay */}
                            {po.remaining > 0.5 && po.status !== 'Cancelled' && (
                              <div className="px-5 py-3 border-t border-border/30">
                                {payingPoId === po.id ? (
                                  <div className="flex gap-2 items-center">
                                    <div className="relative flex-1">
                                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold">PKR</span>
                                      <input type="number" autoFocus min="0" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder={`Due: ${Math.round(po.remaining).toLocaleString()}`}
                                        className="w-full pl-10 h-8 text-xs rounded-md border border-border bg-background focus:outline-none" />
                                    </div>
                                    <input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Notes"
                                      className="flex-1 px-2 h-8 text-xs rounded-md border border-border bg-background focus:outline-none" />
                                    <button disabled={!payAmount} onClick={() => recordPayment(po.id)}
                                      className="h-8 px-3 text-xs bg-primary text-primary-foreground rounded-lg font-semibold disabled:opacity-50 flex items-center gap-1 shrink-0">
                                      <Check size={11} /> Pay
                                    </button>
                                    <button onClick={() => { setPayingPoId(null); setPayAmount(''); setPayNotes(''); }}
                                      className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center"><X size={12} /></button>
                                  </div>
                                ) : (
                                  <button className="text-xs font-semibold text-primary hover:underline flex items-center gap-1.5"
                                    onClick={() => { setPayingPoId(po.id); setPayAmount(String(Math.round(po.remaining))); }}>
                                    <Plus size={12} /> Record payment for this order
                                  </button>
                                )}
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
                        <ChevronDown size={13} /> Load {Math.min(POS_PER_PAGE, purchases.length - visiblePOs.length)} more orders
                      </button>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* PRODUCTS */}
            <TabsContent value="products" className="flex-1 overflow-y-auto m-0 p-5">
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
            <TabsContent value="payments" className="flex-1 overflow-y-auto m-0 p-5">
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
            <TabsContent value="returns" className="flex-1 overflow-y-auto m-0 p-5">
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
            <TabsContent value="activity" className="flex-1 overflow-y-auto m-0 p-5">
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
