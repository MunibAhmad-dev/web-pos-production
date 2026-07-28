import React, { useMemo, useState } from 'react';
import { usePagination } from '../../hooks/usePagination';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Package, Truck, Receipt, X, CheckCircle,
  ShoppingCart, Tag, History, ChevronRight, Briefcase,
  Building2, Wallet, Trash2, Eye, Ban, PackageCheck,
  HandCoins, AlertCircle, CreditCard, RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtPKR = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtPoRef = (id, date) => {
  const d = new Date(date);
  return `PO-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(id).padStart(4, '0')}`;
};

const SPARKLINE_PATH = 'M0,14 L8,10 L16,16 L24,6 L32,12 L40,4 L48,10 L56,2';
function Sparkline({ color }) {
  return (
    <svg width="56" height="20" viewBox="0 0 56 20" fill="none" className="shrink-0">
      <path d={SPARKLINE_PATH} stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function StatCard({ icon: Icon, label, value, sub, tint }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', tint.bg)}><Icon size={18} className={tint.icon} /></div>
        <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-muted-foreground">{sub}</p>
        <Sparkline color={tint.spark} />
      </div>
    </div>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: Math.min(i, 5) * 0.055, ease: [0.23, 1, 0.32, 1] } }),
};

// ─── Checkout Modal ───────────────────────────────────────────────────────────
function CheckoutModal({ isOpen, cart, vendors, onClose, onConfirm }) {
  const [vendorId, setVendorId] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [billNo, setBillNo] = useState('');
  const [discount, setDiscount] = useState('');
  const [transport, setTransport] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (isOpen) { setVendorId(''); setVendorSearch(''); setBillNo(''); setDiscount(''); setTransport(''); setAmountPaid(''); setSaving(false); }
  }, [isOpen]);

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    return vendors.filter((v) => !q || v.name.toLowerCase().includes(q));
  }, [vendors, vendorSearch]);

  const subtotal = cart.reduce((s, i) => s + i.qty * i.purchasePrice, 0);
  const disc = Number(discount) || 0;
  const trans = Number(transport) || 0;
  const grandTotal = Math.max(0, subtotal - disc + trans);
  const paid = Math.min(Number(amountPaid) || 0, grandTotal);
  const due = grandTotal - paid;

  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => !saving && onClose()}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.22 }}
        className="w-full max-w-lg bg-card rounded-2xl shadow-2xl border border-border/50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="relative p-6 border-b" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1a3a5c 100%)' }}>
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/20 border border-emerald-400/30 p-2.5 rounded-xl"><PackageCheck size={18} className="text-emerald-300" /></div>
              <div>
                <h2 className="text-white text-lg font-bold">Process Purchase</h2>
                <p className="text-emerald-300/70 text-xs mt-0.5">{cart.length} item type{cart.length !== 1 ? 's' : ''} · {fmtPKR(grandTotal)} total</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/50 hover:text-white/90 p-1 rounded-lg hover:bg-white/10"><X size={18} /></button>
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Cart summary */}
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <div className="bg-muted/20 px-4 py-2.5 border-b text-xs font-bold text-muted-foreground uppercase tracking-wide">Cart Summary</div>
            <div className="divide-y divide-border/20">
              {cart.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="font-medium truncate mr-2">{item.name}</span>
                  <span className="font-mono text-muted-foreground shrink-0">{item.qty} × {fmtPKR(item.purchasePrice)} = {fmtPKR(item.qty * item.purchasePrice)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Vendor */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Vendor <span className="text-muted-foreground font-normal">(optional)</span></label>
            <select className="w-full h-10 px-3 text-sm rounded-md border border-border bg-background focus:outline-none" value={vendorId} onChange={(e) => setVendorId(e.target.value)} disabled={saving}>
              <option value="">— Walk-in / No Vendor —</option>
              {filteredVendors.map((v) => <option key={v.id} value={v.id}>{v.name}{v.phone ? ` · ${v.phone}` : ''}</option>)}
            </select>
          </div>

          {/* Bill No */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Bill / Invoice Number <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="Vendor's invoice #" disabled={saving}
              className="w-full h-10 px-3 text-sm rounded-md border border-border bg-background focus:outline-none" />
          </div>

          {/* Discount + Transport */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Discount (PKR)</label>
              <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">−</span>
                <input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" disabled={saving}
                  className="w-full h-10 pl-8 pr-3 text-sm rounded-md border border-border bg-background focus:outline-none" /></div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Transport (PKR)</label>
              <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">+</span>
                <input type="number" min="0" value={transport} onChange={(e) => setTransport(e.target.value)} placeholder="0" disabled={saving}
                  className="w-full h-10 pl-8 pr-3 text-sm rounded-md border border-border bg-background focus:outline-none" /></div>
            </div>
          </div>

          {/* Grand Total */}
          <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-2">
            {[['Subtotal', fmtPKR(subtotal)], disc > 0 && ['Discount', `− ${fmtPKR(disc)}`], trans > 0 && ['Transport', `+ ${fmtPKR(trans)}`]].filter(Boolean).map(([label, val]) => (
              <div key={label} className="flex justify-between text-sm"><span className="text-muted-foreground">{label}</span><span className="font-semibold font-mono">{val}</span></div>
            ))}
            <div className="flex justify-between text-base font-black border-t border-border/40 pt-2"><span>Grand Total</span><span className="text-primary font-mono">{fmtPKR(grandTotal)}</span></div>
          </div>

          {/* Amount Paid */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Amount Paid Now</label>
            <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">PKR</span>
              <input type="number" min="0" max={grandTotal} value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder={String(Math.round(grandTotal))} disabled={saving}
                className="w-full h-10 pl-11 pr-3 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            {due > 0 && <p className="text-xs text-amber-600 font-semibold">Credit balance due to vendor: {fmtPKR(due)}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 pb-5 pt-3 border-t border-border/40">
          <button onClick={onClose} disabled={saving} className="h-9 px-4 text-sm rounded-lg border border-border bg-background hover:bg-muted transition-colors">Cancel</button>
          <button
            disabled={saving || cart.length === 0}
            onClick={async () => {
              setSaving(true);
              try { await onConfirm({ vendorId: vendorId || null, billNo, discount: disc, transport: trans, amountPaid: paid, grandTotal }); onClose(); }
              catch (err) { console.error(err); }
              finally { setSaving(false); }
            }}
            className="h-9 px-4 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Processing…' : `Receive & Save · ${fmtPKR(grandTotal)}`}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

// ─── Purchase Detail Modal ────────────────────────────────────────────────────
function PurchaseDetailModal({ purchase, vendors, purchaseItems, purchaseReturns, onClose, onPay, onCancel }) {
  const vendor = vendors.find((v) => String(v.id) === String(purchase?.vendor_id));
  const items = purchaseItems.filter((pi) => String(pi.purchase_id) === String(purchase?.id));
  const returns = purchaseReturns.filter((pr) => String(pr.purchase_id) === String(purchase?.id));
  const [payAmt, setPayAmt] = useState('');
  const [paying, setPaying] = useState(false);

  const subtotal = items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.purchase_price || i.unit_cost || 0), 0);
  const paid = Number(purchase?.amount_paid || 0);
  const due = Math.max(0, (Number(purchase?.grand_total || purchase?.total || 0)) - paid);

  if (!purchase) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.15 }}
        className="relative z-10 bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-bold">{fmtPoRef(purchase.id, purchase.date_created)}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full border', purchase.status === 'received' || purchase.status === 'paid' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25' : purchase.status === 'cancelled' ? 'bg-rose-500/10 text-rose-700 border-rose-500/25' : 'bg-amber-500/10 text-amber-700 border-amber-500/25')}>{purchase.status?.toUpperCase()}</span>
              {vendor && <span className="text-sm text-muted-foreground">{vendor.name}</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Items */}
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <div className="bg-muted/20 px-4 py-2.5 border-b text-xs font-bold text-muted-foreground uppercase tracking-wide">Items ({items.length})</div>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No items recorded</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="bg-muted/10">
                  <th className="text-left text-xs font-semibold text-muted-foreground py-2 pl-4">Product</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground py-2">Qty</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground py-2 pr-4">Cost</th>
                </tr></thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} className="border-t border-border/20">
                      <td className="py-2 pl-4 font-medium text-sm">{i.product_name || i.name || `Product #${i.product_id}`}</td>
                      <td className="py-2 text-right font-mono text-sm">{i.quantity}</td>
                      <td className="py-2 pr-4 text-right font-mono text-sm">{fmtPKR(Number(i.quantity || 0) * Number(i.purchase_price || i.unit_cost || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Totals */}
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: 'Grand Total', value: fmtPKR(purchase.grand_total || purchase.total || 0), color: 'text-foreground' },
              { label: 'Amount Paid', value: fmtPKR(paid), color: 'text-emerald-600' },
              { label: 'Balance Due', value: fmtPKR(due), color: due > 0 ? 'text-amber-600' : 'text-emerald-600' },
              { label: 'Date', value: fmtDate(purchase.date_created), color: 'text-muted-foreground' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl bg-muted/20 border border-border/30 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className={cn('font-bold text-sm mt-0.5', color)}>{value}</p>
              </div>
            ))}
          </div>

          {/* Returns */}
          {returns.length > 0 && (
            <div className="rounded-xl border border-violet-500/25 overflow-hidden">
              <div className="bg-violet-500/5 px-4 py-2.5 border-b text-xs font-bold text-violet-700 uppercase tracking-wide flex items-center gap-2"><RotateCcw size={11} /> Returns ({returns.length})</div>
              {returns.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm border-t border-border/20 first:border-0">
                  <span className="text-muted-foreground">{fmtDate(r.date_created)}</span>
                  <span className="font-semibold text-violet-600">+{fmtPKR(r.total_returned)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Pay Action */}
          {due > 0 && purchase.status !== 'cancelled' && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <p className="text-xs font-bold text-primary">Record Payment to Vendor</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">PKR</span>
                  <input type="number" min="1" max={due} value={payAmt} onChange={(e) => setPayAmt(e.target.value)} placeholder={String(Math.round(due))}
                    className="w-full h-9 pl-10 pr-2 text-sm rounded-lg border border-border bg-background focus:outline-none" />
                </div>
                <button onClick={async () => { if (!payAmt || Number(payAmt) <= 0) return; setPaying(true); try { await onPay(purchase, Number(payAmt)); setPayAmt(''); } finally { setPaying(false); } }}
                  disabled={paying || !payAmt} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50">
                  {paying ? '…' : 'Pay'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t bg-muted/10 shrink-0">
          {purchase.status === 'pending' && (
            <button onClick={() => onCancel(purchase)} className="h-8 px-3 text-xs rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 flex items-center gap-1.5"><Ban size={12} /> Cancel PO</button>
          )}
          <button onClick={onClose} className="h-8 px-4 text-xs rounded-lg border border-border bg-background hover:bg-muted ml-auto">Close</button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PurchasesPage() {
  const { list, pushEntity, pushBatch, nextId } = useDataStore();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('new');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');
  const [historyDetail, setHistoryDetail] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const products = list('product');
  const vendors = list('vendor');
  const purchases = list('purchase');
  const purchaseItems = list('purchase_item');
  const purchaseReturns = list('purchase_return');
  const vendorPayments = list('vendor_payment');

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = purchases.filter((p) => new Date(p.date_created || 0) >= monthStart && p.status !== 'cancelled');
    const totalPurchasesMonth = thisMonth.reduce((s, p) => s + (Number(p.grand_total || p.total || 0)), 0);
    const pending = purchases.filter((p) => p.status === 'pending' || (p.status === 'received' && (() => {
      const paid = vendorPayments.filter((vp) => String(vp.purchase_id) === String(p.id)).reduce((s, vp) => s + Number(vp.amount || 0), 0);
      return paid < (Number(p.grand_total || p.total || 0)) - 0.5;
    })()));
    const pendingAmount = pending.reduce((s, p) => {
      const paid = vendorPayments.filter((vp) => String(vp.purchase_id) === String(p.id)).reduce((s2, vp) => s2 + Number(vp.amount || 0), 0);
      return s + Math.max(0, Number(p.grand_total || p.total || 0) - paid);
    }, 0);
    return { totalPurchasesMonth, totalOrdersMonth: thisMonth.length, totalVendors: vendors.length, pendingAmount, pendingOrders: pending.length };
  }, [purchases, vendorPayments, vendors]);

  // Filtered product list
  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return products.filter((p) => !q || p.name?.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q));
  }, [products, searchTerm]);

  // Cart actions
  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => String(i.productId) === String(product.id));
      if (existing) return prev.map((i) => String(i.productId) === String(product.id) ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { productId: product.id, name: product.name, purchasePrice: product.purchase_price || 0, sellingPrice: product.price || 0, qty: 1, unit: product.unit || '' }];
    });
  };

  const updateCartQty = (productId, qty) => {
    const n = parseFloat(qty) || 0;
    if (n <= 0) setCart((prev) => prev.filter((i) => String(i.productId) !== String(productId)));
    else setCart((prev) => prev.map((i) => String(i.productId) === String(productId) ? { ...i, qty: n } : i));
  };

  const updateCartPrice = (productId, price) => {
    setCart((prev) => prev.map((i) => String(i.productId) === String(productId) ? { ...i, purchasePrice: Number(price) || 0 } : i));
  };

  const removeFromCart = (productId) => setCart((prev) => prev.filter((i) => String(i.productId) !== String(productId)));

  const cartTotal = cart.reduce((s, i) => s + i.qty * i.purchasePrice, 0);

  // Handle checkout
  const handleCheckout = async ({ vendorId, billNo, discount, transport, amountPaid, grandTotal }) => {
    const now = new Date().toISOString();
    const purchaseId = nextId();
    const events = [];

    // Create purchase
    events.push({
      entityType: 'purchase',
      operation: 'create',
      payload: {
        id: purchaseId,
        vendor_id: vendorId ? Number(vendorId) : null,
        bill_no: billNo || '',
        discount: discount || 0,
        transport_charges: transport || 0,
        grand_total: grandTotal,
        amount_paid: amountPaid,
        status: 'received',
        date_created: now,
        updated_at: now,
      },
    });

    // Create purchase items + update product stock
    for (const item of cart) {
      const piId = nextId();
      const product = products.find((p) => String(p.id) === String(item.productId));
      events.push({
        entityType: 'purchase_item',
        operation: 'create',
        payload: {
          id: piId,
          purchase_id: purchaseId,
          product_id: item.productId,
          product_name: item.name,
          quantity: item.qty,
          purchase_price: item.purchasePrice,
          selling_price: item.sellingPrice,
          date_created: now,
        },
      });
      if (product) {
        events.push({
          entityType: 'product',
          operation: 'update',
          payload: {
            ...product,
            stock: Number(product.stock || 0) + item.qty,
            purchase_price: item.purchasePrice || product.purchase_price,
            updated_at: now,
          },
        });
      }
    }

    // Vendor payment if paid
    if (amountPaid > 0 && vendorId) {
      events.push({
        entityType: 'vendor_payment',
        operation: 'create',
        payload: {
          id: nextId(),
          vendor_id: Number(vendorId),
          purchase_id: purchaseId,
          amount: amountPaid,
          date_created: now,
          notes: `Payment for ${fmtPoRef(purchaseId, now)}`,
        },
      });
    }

    await pushBatch(events);
    showToast(`Purchase received · ${fmtPKR(grandTotal)}`);
    setCart([]);
    setActiveTab('history');
  };

  // Pay vendor
  const handlePay = async (purchase, amount) => {
    const now = new Date().toISOString();
    await pushEntity('vendor_payment', 'create', {
      id: nextId(),
      vendor_id: purchase.vendor_id,
      purchase_id: purchase.id,
      amount,
      date_created: now,
      notes: `Payment for ${fmtPoRef(purchase.id, purchase.date_created)}`,
    });
    showToast(`${fmtPKR(amount)} recorded`);
  };

  // Cancel purchase
  const handleCancel = async (purchase) => {
    const now = new Date().toISOString();
    const events = [{ entityType: 'purchase', operation: 'update', payload: { ...purchase, status: 'cancelled', updated_at: now } }];
    // Reverse stock
    const items = purchaseItems.filter((pi) => String(pi.purchase_id) === String(purchase.id));
    for (const pi of items) {
      const product = products.find((p) => String(p.id) === String(pi.product_id));
      if (product) events.push({ entityType: 'product', operation: 'update', payload: { ...product, stock: Math.max(0, Number(product.stock || 0) - Number(pi.quantity || 0)), updated_at: now } });
    }
    await pushBatch(events);
    showToast('Purchase cancelled and stock reversed');
    setHistoryDetail(null);
  };

  // History rows
  const historyRows = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    const payByPO = new Map();
    for (const vp of vendorPayments) {
      const pid = String(vp.purchase_id);
      payByPO.set(pid, (payByPO.get(pid) || 0) + Number(vp.amount || 0));
    }
    const vendorMap = new Map(vendors.map((v) => [String(v.id), v]));
    return purchases
      .map((p) => {
        const paid = payByPO.get(String(p.id)) || 0;
        const due = Math.max(0, Number(p.grand_total || p.total || 0) - paid);
        const vendor = vendorMap.get(String(p.vendor_id));
        return { ...p, amountPaid: paid, due, vendorName: vendor?.name || '—' };
      })
      .filter((p) => {
        if (historyStatusFilter === 'pending' && p.status !== 'pending') return false;
        if (historyStatusFilter === 'received' && (p.status === 'cancelled' || p.due <= 0.5 && p.status === 'received')) return false;
        if (historyStatusFilter === 'paid' && p.due > 0.5) return false;
        if (historyStatusFilter === 'cancelled' && p.status !== 'cancelled') return false;
        if (q) {
          const pool = [String(p.id), p.vendorName, p.bill_no || ''].join(' ').toLowerCase();
          if (!pool.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0));
  }, [purchases, vendorPayments, vendors, historySearch, historyStatusFilter]);

  const { paged: pagedHistory, page: histPage, pageCount: histPageCount, setPage: setHistPage } = usePagination(historyRows, 30);

  return (
    <div className="flex flex-col gap-6 w-full">

      {/* ── Page Header ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
            <span>Home</span><ChevronRight size={12} /><span className="text-foreground font-medium">Purchases / POs</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Purchases / POs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create and manage purchase orders from your vendors</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {cart.length > 0 && activeTab === 'new' && (
            <button onClick={() => setShowCheckout(true)} className="flex items-center gap-2 h-9 px-4 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-medium transition-colors">
              <CheckCircle size={14} /> Process Purchase · {fmtPKR(cartTotal)}
            </button>
          )}
          <button onClick={() => setActiveTab('history')} className={cn('flex items-center gap-2 h-9 px-4 text-sm rounded-lg border font-medium transition-colors', activeTab === 'history' ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background hover:bg-muted')}>
            <History size={14} /> History
          </button>
          <button onClick={() => setActiveTab('new')} className={cn('flex items-center gap-2 h-9 px-4 text-sm rounded-lg border font-medium transition-colors', activeTab === 'new' ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background hover:bg-muted')}>
            <Plus size={14} /> New Purchase
          </button>
        </div>
      </motion.div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Briefcase, label: 'Purchases (Month)', value: fmtPKR(stats.totalPurchasesMonth), sub: 'This Month', tint: { icon: 'text-blue-500', bg: 'bg-blue-500/10', spark: '#3b82f6' } },
          { icon: Truck, label: 'Total Orders', value: stats.totalOrdersMonth, sub: 'This Month', tint: { icon: 'text-emerald-500', bg: 'bg-emerald-500/10', spark: '#10b981' } },
          { icon: Building2, label: 'Vendors', value: stats.totalVendors, sub: 'Active Vendors', tint: { icon: 'text-violet-500', bg: 'bg-violet-500/10', spark: '#8b5cf6' } },
          { icon: Wallet, label: 'Pending Amount', value: fmtPKR(stats.pendingAmount), sub: `From ${stats.pendingOrders} orders`, tint: { icon: 'text-amber-500', bg: 'bg-amber-500/10', spark: '#f59e0b' } },
        ].map((c, i) => (
          <motion.div key={c.label} variants={fadeUp} initial="hidden" animate="visible" custom={i + 1}>
            <StatCard icon={c.icon} label={c.label} value={c.value} sub={c.sub} tint={c.tint} />
          </motion.div>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'new' ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 min-h-[50vh]">

          {/* Product catalog */}
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b bg-muted/10 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-base font-bold flex items-center gap-2"><Receipt size={15} className="text-primary" /> Select Products</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Click a product to add to the order</p>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by name or barcode..."
                  className="w-full h-9 pl-9 pr-8 text-sm rounded-lg border border-border bg-muted/20 focus:outline-none" />
                {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={12} /></button>}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2"><Package size={32} className="opacity-20" /><p className="text-sm">{searchTerm ? 'No products found' : 'No products yet'}</p></div>
              ) : (
                <div className="divide-y divide-border/20">
                  {filteredProducts.map((p) => {
                    const inCart = cart.find((i) => String(i.productId) === String(p.id));
                    return (
                      <div key={p.id} onClick={() => addToCart(p)}
                        className={cn('flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/25 transition-colors', inCart && 'bg-primary/5')}
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{p.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {p.category && <span className="text-[10px] font-mono bg-muted/50 border border-border/30 px-1.5 py-0.5 rounded">{p.category}</span>}
                            {p.barcode && <span className="text-[10px] text-muted-foreground font-mono">{p.barcode}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-xs font-bold text-muted-foreground">Cost: {fmtPKR(p.purchase_price || 0)}</p>
                          <p className="text-xs text-muted-foreground">Stock: {p.stock ?? 0} {p.unit}</p>
                          {inCart && <span className="text-[10px] text-primary font-bold">In cart ({inCart.qty})</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Cart */}
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b bg-muted/10 shrink-0 flex items-center justify-between">
              <div>
                <p className="text-base font-bold flex items-center gap-2"><ShoppingCart size={15} className="text-emerald-500" /> Cart</p>
                <p className="text-xs text-muted-foreground">{cart.length} product type{cart.length !== 1 ? 's' : ''}</p>
              </div>
              {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-muted-foreground hover:text-destructive">Clear all</button>}
            </div>

            {cart.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2 py-12">
                <ShoppingCart size={36} className="opacity-15" />
                <p className="text-sm">Cart is empty</p>
                <p className="text-xs opacity-70">Click products to add them</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto divide-y divide-border/20 p-3 space-y-2">
                  {cart.map((item) => (
                    <div key={item.productId} className="rounded-xl border border-border/40 bg-muted/10 p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm truncate mr-2">{item.name}</p>
                        <button onClick={() => removeFromCart(item.productId)} className="text-muted-foreground hover:text-destructive shrink-0"><Trash2 size={13} /></button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">Qty</label>
                          <input type="number" min="1" value={item.qty} onChange={(e) => updateCartQty(item.productId, e.target.value)}
                            className="w-full h-8 px-2 text-sm rounded-md border border-border bg-background focus:outline-none mt-1 font-mono text-center" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">Cost Price</label>
                          <div className="relative mt-1"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-muted-foreground">PKR</span>
                            <input type="number" min="0" value={item.purchasePrice} onChange={(e) => updateCartPrice(item.productId, e.target.value)}
                              className="w-full h-8 pl-7 pr-2 text-sm rounded-md border border-border bg-background focus:outline-none font-mono text-right" />
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-muted-foreground">
                        <span>Subtotal</span><span className="font-mono">{fmtPKR(item.qty * item.purchasePrice)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t shrink-0">
                  <div className="flex items-center justify-between font-bold text-base mb-3">
                    <span>Total</span><span className="font-mono text-primary">{fmtPKR(cartTotal)}</span>
                  </div>
                  <button onClick={() => setShowCheckout(true)}
                    className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                    <CheckCircle size={15} /> Process Purchase
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* History */
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
            {/* Filters */}
            <div className="p-5 border-b bg-muted/10 flex flex-wrap gap-3 items-center justify-between">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                <input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="Search by vendor, PO number..."
                  className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-border bg-muted/20 focus:outline-none" />
              </div>
              <div className="flex gap-1 p-1 rounded-xl bg-muted/60 border border-border/40">
                {[['all', 'All'], ['pending', 'Pending'], ['received', 'Received'], ['paid', 'Paid'], ['cancelled', 'Cancelled']].map(([val, label]) => (
                  <button key={val} onClick={() => setHistoryStatusFilter(val)}
                    className={cn('px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200', historyStatusFilter === val ? 'bg-background text-foreground shadow-sm border border-border/60' : 'text-muted-foreground hover:text-foreground')}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted/25 border-b">
                  <th className="text-left text-xs font-semibold text-muted-foreground py-3 pl-5">PO #</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground py-3">Vendor</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground py-3">Total</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground py-3">Paid</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground py-3">Balance</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground py-3">Date</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground py-3 pr-5">Actions</th>
                </tr></thead>
                <tbody>
                  {historyRows.length === 0 ? (
                    <tr><td colSpan={8} className="h-40 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground"><Truck size={28} className="opacity-20" /><p className="text-sm">No purchase orders found</p></div>
                    </td></tr>
                  ) : pagedHistory.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/25 transition-colors border-b border-border/30 last:border-0 group">
                      <td className="py-3 pl-5">
                        <p className="font-bold text-sm font-mono">{fmtPoRef(p.id, p.date_created)}</p>
                        {p.bill_no && <p className="text-[10px] text-muted-foreground">#{p.bill_no}</p>}
                      </td>
                      <td className="py-3"><span className="font-medium">{p.vendorName}</span></td>
                      <td className="py-3 text-right font-mono font-semibold">{fmtPKR(p.grand_total || p.total || 0)}</td>
                      <td className="py-3 text-right font-mono text-emerald-600">{fmtPKR(p.amountPaid)}</td>
                      <td className="py-3 text-right">
                        {p.due > 0.5 ? (
                          <span className="inline-flex items-center rounded-md border bg-amber-500/10 text-amber-700 border-amber-500/25 px-2 py-0.5 text-xs font-mono font-bold">{fmtPKR(p.due)}</span>
                        ) : <span className="text-emerald-600 text-xs font-bold">Settled</span>}
                      </td>
                      <td className="py-3">
                        <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase',
                          p.status === 'received' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25' :
                          p.status === 'cancelled' ? 'bg-rose-500/10 text-rose-700 border-rose-500/25' :
                          'bg-amber-500/10 text-amber-700 border-amber-500/25')}>{p.status}</span>
                      </td>
                      <td className="py-3 text-muted-foreground text-xs">{fmtDate(p.date_created)}</td>
                      <td className="py-3 pr-5">
                        <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setHistoryDetail(p)} className="h-7 w-7 flex items-center justify-center rounded-lg text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors">
                            <Eye size={13} />
                          </button>
                          {p.due > 0.5 && p.status !== 'cancelled' && (
                            <button onClick={() => setHistoryDetail(p)} title="Pay vendor" className="h-7 w-7 flex items-center justify-center rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                              <HandCoins size={13} />
                            </button>
                          )}
                          {deleteConfirmId === p.id ? (
                            <div className="flex items-center gap-1 bg-destructive/8 px-2 rounded-lg border border-destructive/20 animate-in fade-in">
                              <span className="text-[10px] font-semibold text-destructive">Sure?</span>
                              <button onClick={() => handleCancel(p)} className="h-5 px-1.5 text-[10px] rounded bg-destructive text-white">Yes</button>
                              <button onClick={() => setDeleteConfirmId(null)} className="h-5 px-1.5 text-[10px] rounded hover:bg-muted">No</button>
                            </div>
                          ) : p.status === 'pending' && (
                            <button onClick={() => setDeleteConfirmId(p.id)} className="h-7 w-7 flex items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 transition-colors">
                              <Ban size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {histPageCount > 1 && (
              <div className="flex items-center justify-between px-5 py-2.5 border-t border-border/30 bg-muted/20">
                <span className="text-xs text-muted-foreground">{historyRows.length} orders · page {histPage} of {histPageCount}</span>
                <div className="flex gap-1">
                  <button onClick={() => setHistPage(p => Math.max(1, p - 1))} disabled={histPage === 1}
                    className="h-7 w-7 rounded-lg border border-border text-base flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors">‹</button>
                  <button onClick={() => setHistPage(p => Math.min(histPageCount, p + 1))} disabled={histPage === histPageCount}
                    className="h-7 w-7 rounded-lg border border-border text-base flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors">›</button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Checkout Modal ── */}
      <CheckoutModal isOpen={showCheckout} cart={cart} vendors={vendors} onClose={() => setShowCheckout(false)} onConfirm={handleCheckout} />

      {/* ── Detail Modal ── */}
      <AnimatePresence>
        {historyDetail && (
          <PurchaseDetailModal
            purchase={historyDetail}
            vendors={vendors}
            purchaseItems={purchaseItems}
            purchaseReturns={purchaseReturns}
            onClose={() => setHistoryDetail(null)}
            onPay={async (po, amount) => { await handlePay(po, amount); setHistoryDetail((prev) => ({ ...prev, amountPaid: Number(prev.amountPaid || 0) + amount })); }}
            onCancel={(po) => handleCancel(po)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
