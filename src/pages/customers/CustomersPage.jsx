import React, { useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Users, Pencil, Trash2, Phone, MessageCircle,
  X, ArrowRight, ShoppingBag, RefreshCw,
  ChevronRight, Receipt, CreditCard, RotateCcw, MoreVertical, ExternalLink, Eye, Printer,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { usePagination } from '../../hooks/usePagination';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtPKR = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ─── Animations ───────────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.38, delay: Math.min(i, 5) * 0.045, ease: [0.23, 1, 0.32, 1] } }),
};
const slideIn = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] } },
  exit: { opacity: 0, x: 24, transition: { duration: 0.2 } },
};

// ─── Avatar ───────────────────────────────────────────────────────────────────
const GRADIENTS = [
  { a: '#3b82f6', b: '#8b5cf6' }, { a: '#06b6d4', b: '#3b82f6' },
  { a: '#10b981', b: '#06b6d4' }, { a: '#f59e0b', b: '#ef4444' },
  { a: '#ec4899', b: '#8b5cf6' }, { a: '#6366f1', b: '#a78bfa' },
];
const getGrad = (name = '') => GRADIENTS[name.charCodeAt(0) % GRADIENTS.length];

function Avatar({ name = '', size = 'md' }) {
  const { a, b } = getGrad(name);
  const sz = size === 'lg' ? 'w-14 h-14 text-2xl rounded-2xl' : size === 'sm' ? 'w-8 h-8 text-sm rounded-xl' : 'w-11 h-11 text-lg rounded-2xl';
  return (
    <div className={cn('flex items-center justify-center text-white font-black shrink-0 shadow-md', sz)} style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Customer Form Modal ──────────────────────────────────────────────────────
function CustomerFormModal({ isOpen, isEditing, initial, onClose, onSaved }) {
  const { pushEntity } = useDataStore();
  const { showToast } = useToast();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef(null);

  React.useEffect(() => {
    if (isOpen) { setForm({ ...initial }); setSaving(false); setTimeout(() => nameRef.current?.focus(), 80); }
  }, [isOpen]);

  const submit = async (e) => {
    e.preventDefault();
    const name = form.name?.trim();
    if (!name) { showToast('Customer name is required', 'error'); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      if (isEditing && initial.id) {
        await pushEntity('customer', 'update', { ...initial, ...form, name, id: initial.id, updated_at: now });
        showToast('Customer updated');
      } else {
        await pushEntity('customer', 'create', { name, phone: form.phone || '', email: form.email || '', address: form.address || '', created_at: now, updated_at: now });
        showToast('Customer added');
      }
      onClose(); onSaved?.();
    } catch (err) { showToast(err.message || 'Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => !saving && onClose()}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.22 }}
        className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border/50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={submit}>
          <div className="relative p-6 border-b" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1a3a5c 100%)' }}>
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500/20 border border-blue-400/30 p-2.5 rounded-xl"><Users size={18} className="text-blue-300" /></div>
                <div>
                  <h2 className="text-white text-lg font-bold">{isEditing ? 'Edit Customer' : 'New Customer'}</h2>
                  <p className="text-blue-300/70 text-xs mt-0.5">{isEditing ? 'Update customer info' : 'Add to your customer directory'}</p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="text-white/50 hover:text-white/90 p-1 rounded-lg hover:bg-white/10"><X size={18} /></button>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Full Name <span className="text-destructive">*</span></label>
              <input ref={nameRef} required value={form.name || ''} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} disabled={saving}
                placeholder="Customer name" className="w-full h-10 px-3 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Phone</label>
                <input value={form.phone || ''} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} disabled={saving}
                  placeholder="e.g. 0300-1234567" className="w-full h-10 px-3 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Email</label>
                <input type="email" value={form.email || ''} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} disabled={saving}
                  placeholder="Optional" className="w-full h-10 px-3 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Address</label>
              <textarea value={form.address || ''} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} disabled={saving} rows={2}
                placeholder="Delivery / billing address (optional)"
                className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div className="flex justify-end gap-3 px-6 pb-5">
            <button type="button" onClick={onClose} disabled={saving} className="h-9 px-4 text-sm rounded-lg border border-border bg-background hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="h-9 px-4 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors">
              {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Customer'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const { list, pushEntity } = useDataStore();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formInitial, setFormInitial] = useState({ name: '', phone: '', email: '', address: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paying, setPaying] = useState(false);
  const [perCardAmts, setPerCardAmts] = useState({});
  const [detailSale, setDetailSale] = useState(null);

  const customers = list('customer');
  const allSales = list('sale');
  const allSaleItems = list('sale_item');
  const allPayments = list('customer_payment');
  const allReturns = list('sale_return');

  // Filtered customer list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .filter((c) => !q || c.name?.toLowerCase().includes(q) || c.phone?.includes(q))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [customers, search]);

  // Compute details for selected customer
  const customerDetails = useMemo(() => {
    if (!selectedCustomer?.id) return null;
    const cid = String(selectedCustomer.id);

    const sales = allSales
      .filter((s) => String(s.customer_id) === cid && s.status !== 'Cancelled')
      .sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0));

    const payments = allPayments
      .filter((p) => String(p.customer_id) === cid)
      .sort((a, b) => new Date(b.date_added || b.created_at || 0) - new Date(a.date_added || a.created_at || 0));

    const returns = allReturns
      .filter((r) => String(r.customer_id) === cid || sales.some((s) => String(s.id) === String(r.sale_id)))
      .sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0));

    const totalTaken = sales.reduce((s, x) => s + (Number(x.total) || 0), 0);
    const totalPaid = payments.reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const totalReturned = returns.reduce((s, x) => s + (Number(x.total_returned) || 0), 0);
    const balance = Math.max(0, totalTaken - totalPaid - totalReturned);

    // Build a unified timeline (sales + payments + returns)
    const timeline = [
      ...sales.map((s) => {
        const remaining = Math.max(0, Number(s.total) - payments.filter((p) => String(p.sale_id) === String(s.id)).reduce((a, p) => a + Number(p.amount), 0));
        return { kind: 'sale', id: String(s.id), date: s.date_created, sale: s, remaining };
      }),
      ...payments.map((p) => ({ kind: 'payment', id: `p-${p.id}`, date: p.date_added || p.created_at, payment: p })),
      ...returns.map((r) => ({ kind: 'return', id: `r-${r.id}`, date: r.date_created, ret: r })),
    ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    return { sales, payments, returns, totalTaken, totalPaid, totalReturned, balance, timeline };
  }, [selectedCustomer, allSales, allPayments, allReturns]);

  const openAdd = () => { setFormInitial({ name: '', phone: '', email: '', address: '' }); setIsEditing(false); setShowForm(true); };
  // Precompute all customer balances once — avoids O(n²) per-row filter in the render loop
  const balanceMap = useMemo(() => {
    const m = new Map();
    for (const c of customers) {
      const cid = String(c.id);
      const taken = allSales.filter(s => String(s.customer_id) === cid && s.status !== 'Cancelled').reduce((a, s) => a + (Number(s.total) || 0), 0);
      const paid  = allPayments.filter(p => String(p.customer_id) === cid).reduce((a, p) => a + (Number(p.amount) || 0), 0);
      const ret   = allReturns.filter(r => String(r.customer_id) === cid).reduce((a, r) => a + (Number(r.total_returned) || 0), 0);
      m.set(cid, Math.max(0, taken - paid - ret));
    }
    return m;
  }, [customers, allSales, allPayments, allReturns]);

  const { paged, page, pageCount, setPage } = usePagination(filtered, 30);

  const openEdit = (c, e) => { e?.stopPropagation(); setFormInitial({ ...c }); setIsEditing(true); setShowForm(true); };
  const openCustomer = (c) => { setSelectedCustomer(c); setPerCardAmts({}); };
  const closeCustomer = () => { setSelectedCustomer(null); setPerCardAmts({}); };

  const handleDelete = async (id) => {
    await pushEntity('customer', 'delete', { id });
    showToast('Customer deleted');
    setDeleteConfirmId(null);
    if (selectedCustomer?.id === id) closeCustomer();
  };

  const sendWhatsApp = (sale = null) => {
    if (!selectedCustomer?.phone) { showToast("Customer doesn't have a phone number", 'error'); return; }
    let num = selectedCustomer.phone.replace(/[^0-9]/g, '');
    if (num.startsWith('0')) num = '92' + num.substring(1);
    const bal = customerDetails?.balance || 0;
    let msg = '';
    if (sale) {
      const rem = Math.max(0, Math.round(Number(sale.total || 0) - payments?.reduce?.((a, p) => a + (String(p.sale_id) === String(sale.id) ? Number(p.amount) : 0), 0) || 0));
      msg = `*Sale Update — Our Store*\n\nHello *${selectedCustomer.name}*,\nOrder: #${sale.id}\nTotal: PKR ${Math.round(sale.total).toLocaleString()}\n*Balance: PKR ${rem.toLocaleString()}*\n\nThank you!`;
    } else {
      msg = `*Account Summary — Our Store*\n\nHello *${selectedCustomer.name}*,\nTotal Purchases: PKR ${Math.round(customerDetails?.totalTaken || 0).toLocaleString()}\nTotal Paid: PKR ${Math.round(customerDetails?.totalPaid || 0).toLocaleString()}\n*Balance Due: PKR ${Math.round(bal).toLocaleString()}*\n\nPlease clear dues. Thank you!`;
    }
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handlePerCardPayment = async (saleId, remaining) => {
    const amount = Number(perCardAmts[saleId] || 0);
    if (!amount || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
    if (amount > remaining + 0.5) { showToast(`Cannot exceed ${fmtPKR(remaining)}`, 'error'); return; }
    setPaying(true);
    try {
      await pushEntity('customer_payment', 'create', {
        customer_id: selectedCustomer.id,
        amount,
        date_added: new Date().toISOString(),
        notes: `Payment for Invoice #${saleId}`,
        sale_id: saleId,
      });
      await pushEntity('customer', 'update', {
        ...selectedCustomer,
        outstanding_balance: Math.max(0, Number(selectedCustomer.outstanding_balance || 0) - amount),
        updated_at: new Date().toISOString(),
      });
      showToast(`${fmtPKR(amount)} recorded`);
      setPerCardAmts(prev => ({ ...prev, [saleId]: '' }));
    } catch (err) { showToast(err.message || 'Failed', 'error'); }
    finally { setPaying(false); }
  };

  const printInvoice = (sale, items) => {
    const win = window.open('', '_blank', 'width=420,height=600');
    if (!win) return;
    const invNo = `INV-${String(sale.id).slice(-6).toUpperCase()}`;
    win.document.write(`<html><head><title>${invNo}</title><style>body{font-family:monospace;margin:24px;font-size:12px}.hdr{text-align:center;border-bottom:1px dashed #000;padding-bottom:10px;margin-bottom:10px}h2{margin:0;font-size:16px}p{margin:3px 0}.row{display:flex;justify-content:space-between;margin:4px 0}.tot{font-weight:bold;border-top:1px dashed #000;padding-top:6px;margin-top:6px}</style></head><body><div class="hdr"><h2>${invNo}</h2><p>${fmtDate(sale.date_created)}</p></div>${items.map(si => `<div class="row"><span>${si.product_name || si.name} × ${si.quantity}</span><span>PKR ${Math.round((si.price || 0) * (si.quantity || 0)).toLocaleString()}</span></div>`).join('')}<div class="row tot"><span>TOTAL</span><span>PKR ${Math.round(Number(sale.total) || 0).toLocaleString()}</span></div></body></html>`);
    win.document.close();
    win.print();
  };

  const getSaleItems = (saleId) => allSaleItems.filter((si) => String(si.sale_id) === String(saleId));

  return (
    <div className="h-full flex gap-5 min-h-0">

      {/* ── Left: Customer List ── */}
      <div className="flex-1 flex flex-col min-w-0 rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-border/40 shrink-0">
          <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible" className="flex items-center justify-between mb-5">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/15"><Users size={18} className="text-blue-500" /></div>
                <h1 className="text-2xl font-black tracking-tight">Customers</h1>
              </div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest ml-[52px]">{customers.length} total customers</p>
            </div>
            <button onClick={openAdd} className="flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold transition-colors shadow-sm">
              <Plus size={15} /> New Customer
            </button>
          </motion.div>

          <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible" className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
            <input
              placeholder="Search by name or phone..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 text-sm border border-border/60 rounded-xl bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </motion.div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3 text-muted-foreground">
              <Users size={48} className="opacity-15" />
              <div className="text-center">
                <p className="font-semibold text-sm">{search ? 'No matching customers' : 'No customers yet'}</p>
                <p className="text-xs mt-0.5 opacity-70">Click "New Customer" to get started</p>
              </div>
            </div>
          ) : (
            <>
              <div>
              {paged.map((c, i) => {
                const balance = balanceMap.get(String(c.id)) || 0;
                const isSelected = String(selectedCustomer?.id) === String(c.id);
                return (
                  <motion.div
                    key={c.id} custom={i} variants={fadeUp} initial="hidden" animate="visible"
                    onClick={() => openCustomer(c)}
                    className={cn(
                      'flex items-center justify-between px-5 py-4 cursor-pointer transition-all border-b border-border/30 last:border-0',
                      'hover:bg-muted/25 border-l-[3px]',
                      isSelected ? 'bg-primary/5 border-l-primary pl-[17px]' : 'border-l-transparent'
                    )}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <Avatar name={c.name} size="md" />
                      <div className="min-w-0">
                        <h4 className="font-bold text-[15px] truncate">{c.name}</h4>
                        {c.phone && <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5"><Phone size={10} /> {c.phone}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {balance > 0 && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/25">{fmtPKR(balance)}</span>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); openEdit(c, e); }} className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                        <Pencil size={13} />
                      </button>
                      {deleteConfirmId === c.id ? (
                        <div className="flex items-center gap-1 bg-destructive/8 px-2 py-1 rounded-lg border border-destructive/20 animate-in fade-in" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[10px] font-semibold text-destructive">Sure?</span>
                          <button onClick={() => handleDelete(c.id)} className="text-[10px] px-1.5 py-0.5 rounded bg-destructive text-white">Yes</button>
                          <button onClick={() => setDeleteConfirmId(null)} className="text-[10px] px-1.5 py-0.5 rounded hover:bg-muted">No</button>
                        </div>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(c.id); }} className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                      <ArrowRight size={14} className={cn('transition-colors', isSelected ? 'text-primary' : 'text-muted-foreground/30')} />
                    </div>
                  </motion.div>
                );
              })}
              </div>
              {pageCount > 1 && (
                <div className="flex items-center justify-between px-5 py-2.5 border-t border-border/30 shrink-0 bg-muted/20">
                  <span className="text-xs text-muted-foreground">{filtered.length} customers · page {page} of {pageCount}</span>
                  <div className="flex gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="h-7 w-7 rounded-lg border border-border text-base flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors">‹</button>
                    <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount}
                      className="h-7 w-7 rounded-lg border border-border text-base flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors">›</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Right: Customer Detail Panel ── */}
      <AnimatePresence>
        {selectedCustomer && (
          <motion.div
            key="detail"
            variants={slideIn}
            initial="hidden" animate="visible" exit="exit"
            className="w-[340px] min-w-[280px] xl:w-[420px] shrink-0 flex flex-col rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden"
          >
            {/* Panel Header */}
            <div className="relative border-b border-border/40">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 via-violet-500 to-blue-400" />
              <div className="px-5 pt-6 pb-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={selectedCustomer.name} size="lg" />
                    <div>
                      <h2 className="text-lg font-black leading-tight">{selectedCustomer.name}</h2>
                      {selectedCustomer.phone && <span className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5"><Phone size={10} /> {selectedCustomer.phone}</span>}
                      {selectedCustomer.address && <span className="text-xs text-muted-foreground block truncate max-w-[180px]">{selectedCustomer.address}</span>}
                    </div>
                  </div>
                  <button onClick={closeCustomer} className="h-8 w-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0">
                    <X size={16} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => sendWhatsApp()} className="flex items-center justify-center gap-1.5 h-9 w-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm shrink-0">
                    <MessageCircle size={13} />
                  </button>
                  <button onClick={() => navigate('/sales')} className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold transition-colors">
                    <ShoppingBag size={13} /> New Sale
                  </button>
                  <button onClick={() => openEdit(selectedCustomer)} className="flex items-center justify-center h-9 w-9 rounded-xl border border-border bg-background hover:bg-muted transition-colors shrink-0">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => navigate(`/customers/${selectedCustomer.id}`)} className="flex items-center justify-center h-9 w-9 rounded-xl border border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary transition-colors shrink-0" title="View Full Profile">
                    <ExternalLink size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* Panel Body */}
            {!customerDetails ? (
              <div className="flex-1 flex items-center justify-center min-h-[300px]">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center"><RefreshCw size={22} className="animate-spin text-primary" /></div>
                  <p className="text-sm font-semibold">Loading…</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">

                {/* Balance Banner */}
                <div className={cn('mx-4 mt-4 mb-2 rounded-xl border p-4 text-center', customerDetails.balance > 0 ? 'bg-amber-500/8 border-amber-500/25' : 'bg-emerald-500/8 border-emerald-500/25')}>
                  <p className={cn('text-2xl font-black', customerDetails.balance > 0 ? 'text-amber-600' : 'text-emerald-600')}>
                    {fmtPKR(customerDetails.balance)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{customerDetails.balance > 0 ? 'Outstanding Balance' : 'No outstanding balance'}</p>
                </div>

                {/* Summary Stats */}
                <div className="px-4 pb-3">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Purchases', value: fmtPKR(customerDetails.totalTaken), icon: Receipt, color: 'text-blue-500' },
                      { label: 'Paid', value: fmtPKR(customerDetails.totalPaid), icon: CreditCard, color: 'text-emerald-500' },
                      { label: 'Returns', value: fmtPKR(customerDetails.totalReturned), icon: RotateCcw, color: 'text-violet-500' },
                    ].map(({ label, value, icon: Icon, color }) => (
                      <div key={label} className="rounded-xl bg-muted/30 border border-border/30 p-3 text-center">
                        <Icon size={14} className={cn('mx-auto mb-1.5', color)} />
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">{label}</p>
                        <p className="text-xs font-black mt-0.5 font-mono">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeline */}
                <div className="px-4 pb-4">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Transaction History</p>
                  {customerDetails.timeline.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">No transactions yet</div>
                  ) : (
                    <div className="space-y-2">
                      {customerDetails.timeline.map((row) => {
                        if (row.kind === 'sale') {
                          const s = row.sale;
                          const items = getSaleItems(s.id);
                          const isPending = row.remaining > 0.5;
                          const amtPaid = Number(s.total || 0) - row.remaining;
                          const paidPct = Number(s.total) > 0 ? Math.min(100, Math.round((amtPaid / Number(s.total)) * 100)) : 0;
                          const invNo = `INV-${String(s.id).slice(-6).toUpperCase()}`;
                          const linkedPayments = (customerDetails?.payments || []).filter(pay => String(pay.sale_id) === String(s.id));
                          return (
                            <div key={row.id} className="rounded-xl border border-border/50 overflow-hidden bg-card">
                              <div className="h-[2px] bg-gradient-to-r from-blue-500 to-violet-500" />
                              {/* Header */}
                              <div className="flex items-center justify-between px-3 pt-2.5 pb-1 gap-2">
                                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                  <span className="text-xs font-black font-mono">{invNo}</span>
                                  <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0', isPending ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400')}>
                                    {isPending ? 'Partial' : 'Paid'}
                                  </span>
                                  {items.length > 0 && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-400/25 text-blue-700 dark:text-blue-400 shrink-0">
                                      {items.length} item{items.length !== 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                                <button onClick={() => setDetailSale({ sale: s, items, payments: linkedPayments })}
                                  className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0">
                                  <Eye size={12} />
                                </button>
                              </div>
                              <p className="px-3 pb-1 text-[10px] text-muted-foreground">{fmtDate(s.date_created)}</p>
                              {/* TOTAL / PAID / REMAINING */}
                              <div className="grid grid-cols-3 px-3 pb-1.5 text-center">
                                <div>
                                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Total</p>
                                  <p className="text-[11px] font-black tabular-nums">{fmtPKR(s.total)}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Paid</p>
                                  <p className="text-[11px] font-black text-emerald-600 tabular-nums">{fmtPKR(amtPaid)}</p>
                                </div>
                                <div>
                                  <p className={cn('text-[9px] font-black uppercase tracking-widest', isPending ? 'text-rose-600' : 'text-emerald-600')}>Remaining</p>
                                  <p className={cn('text-[11px] font-black tabular-nums', isPending ? 'text-rose-600' : 'text-emerald-600')}>{fmtPKR(Math.max(0, row.remaining))}</p>
                                </div>
                              </div>
                              {/* Progress bar */}
                              <div className="px-3 pb-1.5">
                                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={cn('h-full rounded-full transition-all', isPending && paidPct > 0 ? 'bg-amber-500' : isPending ? 'bg-rose-400' : 'bg-emerald-500')}
                                    style={{ width: `${paidPct}%` }}
                                  />
                                </div>
                                <p className="text-[9px] text-muted-foreground mt-0.5">{paidPct}% paid</p>
                              </div>
                              {/* Items inline — capped at 3, overflow hidden */}
                              {items.length > 0 && (
                                <div className="mx-3 mb-2 px-2.5 py-1.5 rounded-lg bg-muted/30 border border-border/30">
                                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">≡ Items</p>
                                  <p className="text-[10px] text-muted-foreground leading-snug truncate">
                                    {items.slice(0, 3).map((it, idx) => (
                                      <span key={idx}>
                                        {idx > 0 && <span className="text-muted-foreground/40"> · </span>}
                                        {it.product_name || it.name} <span className="font-semibold text-foreground/80">×{it.quantity}</span>
                                      </span>
                                    ))}
                                    {items.length > 3 && <span className="text-muted-foreground/50"> +{items.length - 3} more</span>}
                                  </p>
                                </div>
                              )}
                              {/* Action bar */}
                              <div className="flex items-center gap-1.5 px-3 pb-2.5">
                                {isPending && (
                                  <>
                                    <div className="relative flex-1">
                                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground font-bold pointer-events-none">PKR</span>
                                      <input
                                        type="number" min="0"
                                        value={perCardAmts[s.id] || ''}
                                        onChange={(e) => setPerCardAmts(prev => ({ ...prev, [s.id]: e.target.value }))}
                                        placeholder={Math.round(row.remaining).toLocaleString()}
                                        className="h-7 pl-7 pr-2 w-full text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-emerald-500/40 tabular-nums"
                                      />
                                    </div>
                                    <button
                                      disabled={!perCardAmts[s.id] || paying}
                                      onClick={() => handlePerCardPayment(s.id, row.remaining)}
                                      className="h-7 px-3 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-40 shrink-0 transition-colors">
                                      Pay
                                    </button>
                                  </>
                                )}
                                {selectedCustomer?.phone && (
                                  <button onClick={() => sendWhatsApp(s)}
                                    className="w-7 h-7 rounded-full bg-[#25d366] flex items-center justify-center text-white hover:bg-[#1fba57] transition-colors shrink-0">
                                    <MessageCircle size={11} />
                                  </button>
                                )}
                                <button onClick={() => printInvoice(s, items)}
                                  className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors shrink-0">
                                  <Printer size={11} />
                                </button>
                                {isPending && (
                                  <button onClick={() => setPerCardAmts(prev => ({ ...prev, [s.id]: '' }))}
                                    className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 transition-colors shrink-0 text-xs font-bold">
                                    ×
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        }
                        if (row.kind === 'payment') {
                          const p = row.payment;
                          return (
                            <div key={row.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                              <div className="flex items-center gap-2">
                                <CreditCard size={13} className="text-emerald-600 shrink-0" />
                                <div>
                                  <p className="text-xs font-bold text-emerald-700">Payment Received</p>
                                  <p className="text-[10px] text-muted-foreground">{fmtDate(p.date_added || p.created_at)}{p.notes ? ` · ${p.notes}` : ''}</p>
                                </div>
                              </div>
                              <span className="text-xs font-black text-emerald-600 font-mono">+{fmtPKR(p.amount)}</span>
                            </div>
                          );
                        }
                        if (row.kind === 'return') {
                          const r = row.ret;
                          return (
                            <div key={row.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-violet-500/20 bg-violet-500/5">
                              <div className="flex items-center gap-2">
                                <RotateCcw size={13} className="text-violet-600 shrink-0" />
                                <div>
                                  <p className="text-xs font-bold text-violet-700">Return</p>
                                  <p className="text-[10px] text-muted-foreground">{fmtDate(r.date_created)}</p>
                                </div>
                              </div>
                              <span className="text-xs font-black text-violet-600 font-mono">+{fmtPKR(r.total_returned)}</span>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sale Detail Modal ── */}
      {detailSale && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setDetailSale(null)}>
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-[480px] max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-border/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Receipt size={16} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-black">Invoice #{detailSale.sale.id}</p>
                  <p className="text-[10px] text-muted-foreground">{fmtDate(detailSale.sale.date_created)}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Grand Total</p>
                <p className="text-base font-black text-rose-600 tabular-nums">{fmtPKR(detailSale.sale.total)}</p>
                {detailSale.sale.total - (detailSale.payments.reduce((s, p) => s + Number(p.amount), 0)) > 0.5 ? (
                  <p className="text-[10px] font-bold text-amber-600">Due: {fmtPKR(Math.max(0, Number(detailSale.sale.total) - detailSale.payments.reduce((s, p) => s + Number(p.amount), 0)))}</p>
                ) : (
                  <p className="text-[10px] font-bold text-emerald-600">Fully Paid</p>
                )}
              </div>
            </div>
            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 px-5 py-3 space-y-4">
              {/* Payment History */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <RefreshCw size={11} className="text-muted-foreground" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payment History</p>
                </div>
                {detailSale.payments.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">No payments recorded for this invoice.</p>
                ) : (
                  <div className="space-y-1.5">
                    {detailSale.payments.map(pay => (
                      <div key={pay.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-muted/40 border border-border/30">
                        <span className="text-[10px] text-muted-foreground">{fmtDate(pay.date_added || pay.created_at)}</span>
                        <span className="text-[11px] font-bold text-emerald-600 tabular-nums">{fmtPKR(pay.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Items Table */}
              {detailSale.items.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Items</p>
                  <div className="rounded-xl border border-border/40 overflow-hidden">
                    <table className="w-full text-[10px]">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-2.5 py-1.5 font-bold text-muted-foreground">#</th>
                          <th className="text-left px-2.5 py-1.5 font-bold text-muted-foreground">Product</th>
                          <th className="text-right px-2.5 py-1.5 font-bold text-muted-foreground">Qty</th>
                          <th className="text-right px-2.5 py-1.5 font-bold text-muted-foreground">Price</th>
                          <th className="text-right px-2.5 py-1.5 font-bold text-muted-foreground">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {detailSale.items.map((it, idx) => (
                          <tr key={it.id ?? idx} className="hover:bg-muted/20">
                            <td className="px-2.5 py-1.5 text-muted-foreground">{idx + 1}</td>
                            <td className="px-2.5 py-1.5 font-medium">{it.product_name || it.name}</td>
                            <td className="px-2.5 py-1.5 text-right tabular-nums">{it.quantity}</td>
                            <td className="px-2.5 py-1.5 text-right tabular-nums">{fmtPKR(it.price || it.unit_price || 0)}</td>
                            <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums">{fmtPKR((it.price || it.unit_price || 0) * (it.quantity || 0))}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/30 border-t border-border/40">
                        <tr>
                          <td colSpan={4} className="px-2.5 py-1.5 text-right font-black text-[11px]">Grand Total</td>
                          <td className="px-2.5 py-1.5 text-right font-black text-[11px] tabular-nums text-rose-600">{fmtPKR(detailSale.sale.total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
            {/* Modal Footer */}
            <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border/40 shrink-0">
              <div className="flex items-center gap-2">
                <button onClick={() => setDetailSale(null)}
                  className="h-8 px-3.5 text-xs rounded-lg border border-border bg-background hover:bg-muted/60 font-semibold transition-colors">
                  Close
                </button>
                <button onClick={() => { setDetailSale(null); navigate('/returns'); }}
                  className="h-8 px-3.5 text-xs rounded-lg bg-amber-500/10 border border-amber-400/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 font-bold transition-colors">
                  Return Items
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => printInvoice(detailSale.sale, detailSale.items)}
                  className="h-8 px-3.5 text-xs rounded-lg bg-primary/10 text-primary hover:bg-primary/20 font-bold transition-colors">
                  Print Invoice
                </button>
                {selectedCustomer?.phone && (
                  <button onClick={() => sendWhatsApp(detailSale.sale)}
                    className="h-8 px-3.5 text-xs rounded-lg bg-[#25d366] hover:bg-[#1fba57] text-white font-bold transition-colors">
                    WhatsApp
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Form Modal ── */}
      <CustomerFormModal
        isOpen={showForm}
        isEditing={isEditing}
        initial={formInitial}
        onClose={() => setShowForm(false)}
        onSaved={() => {}}
      />
    </div>
  );
}
