import React, { useMemo, useState, useRef } from 'react';
import { usePagination } from '../../hooks/usePagination';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Truck, Pencil, Trash2, Phone, MessageCircle,
  X, ArrowRight, ShoppingCart, RefreshCw,
  ChevronRight, Receipt, CreditCard, RotateCcw, MoreVertical, ExternalLink, Wallet, Printer, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import CustomBillsPanel from '../../components/vendors/CustomBillsPanel';
import GlobalCustomBillsOverlay from '../../components/vendors/GlobalCustomBillsOverlay';

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
  { a: '#6366f1', b: '#8b5cf6' }, { a: '#0ea5e9', b: '#6366f1' },
  { a: '#10b981', b: '#0ea5e9' }, { a: '#f59e0b', b: '#f97316' },
  { a: '#ec4899', b: '#a855f7' }, { a: '#14b8a6', b: '#6366f1' },
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

// ─── Vendor Form Modal ────────────────────────────────────────────────────────
function VendorFormModal({ isOpen, isEditing, initial, onClose, onSaved }) {
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
    if (!name) { showToast('Vendor name is required', 'error'); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      if (isEditing && initial.id) {
        await pushEntity('vendor', 'update', { ...initial, ...form, name, id: initial.id, updated_at: now });
        showToast('Vendor updated');
      } else {
        await pushEntity('vendor', 'create', { name, phone: form.phone || '', email: form.email || '', address: form.address || '', created_at: now, updated_at: now });
        showToast('Vendor added');
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
          <div className="relative p-6 border-b" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)' }}>
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="bg-violet-500/20 border border-violet-400/30 p-2.5 rounded-xl"><Truck size={18} className="text-violet-300" /></div>
                <div>
                  <h2 className="text-white text-lg font-bold">{isEditing ? 'Edit Vendor' : 'New Vendor'}</h2>
                  <p className="text-violet-300/70 text-xs mt-0.5">{isEditing ? 'Update vendor info' : 'Add to your vendor directory'}</p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="text-white/50 hover:text-white/90 p-1 rounded-lg hover:bg-white/10"><X size={18} /></button>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Business / Vendor Name <span className="text-destructive">*</span></label>
              <input ref={nameRef} required value={form.name || ''} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} disabled={saving}
                placeholder="Vendor name" className="w-full h-10 px-3 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
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
                placeholder="Vendor address (optional)"
                className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div className="flex justify-end gap-3 px-6 pb-5">
            <button type="button" onClick={onClose} disabled={saving} className="h-9 px-4 text-sm rounded-lg border border-border bg-background hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="h-9 px-4 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors">
              {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Vendor'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function VendorsPage() {
  const { list, pushEntity } = useDataStore();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formInitial, setFormInitial] = useState({ name: '', phone: '', email: '', address: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [paying, setPaying] = useState(false);
  const [perCardAmts, setPerCardAmts] = useState({});
  const [expandedCards, setExpandedCards] = useState({});
  const [itemVisibleCounts, setItemVisibleCounts] = useState({});
  const [customBillsVendor, setCustomBillsVendor] = useState(null);
  const [showGlobalBills, setShowGlobalBills] = useState(false);

  const vendors = list('vendor');
  const allPurchases = list('purchase');
  const allPurchaseItems = list('purchase_item');
  const allPayments = list('vendor_payment');
  const allReturns = list('purchase_return');

  const vendorBalanceMap = useMemo(() => {
    const m = new Map();
    for (const v of vendors) {
      const vid = String(v.id);
      const total = allPurchases.filter((p) => String(p.vendor_id) === vid && p.status !== 'Cancelled').reduce((s, p) => s + Number(p.total || 0), 0);
      const paid  = allPayments.filter((p) => String(p.vendor_id) === vid).reduce((s, p) => s + Number(p.amount || 0), 0);
      const ret   = allReturns.filter((r) => String(r.vendor_id) === vid).reduce((s, r) => s + Number(r.total_returned || 0), 0);
      m.set(vid, Math.max(0, total - paid - ret));
    }
    return m;
  }, [vendors, allPurchases, allPayments, allReturns]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors
      .filter((v) => !q || v.name?.toLowerCase().includes(q) || v.phone?.includes(q))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [vendors, search]);

  const { paged, page, pageCount, setPage } = usePagination(filtered, 30);

  // Compute full details for selected vendor
  const vendorDetails = useMemo(() => {
    if (!selectedVendor?.id) return null;
    const vid = String(selectedVendor.id);
    const purchases = allPurchases
      .filter((p) => String(p.vendor_id) === vid && p.status !== 'Cancelled')
      .sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0));

    const payments = allPayments
      .filter((p) => String(p.vendor_id) === vid)
      .sort((a, b) => new Date(b.date_added || 0) - new Date(a.date_added || 0));

    const returns = allReturns
      .filter((r) => String(r.vendor_id) === vid)
      .sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0));

    const totalPurchased = purchases.reduce((s, p) => s + Number(p.total || 0), 0);
    const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalReturned = returns.reduce((s, r) => s + Number(r.total_returned || 0), 0);
    const balance = Math.max(0, totalPurchased - totalPaid - totalReturned);

    const timeline = [
      ...purchases.map((p) => {
        const remaining = Math.max(0, Number(p.total || 0) - payments.filter((pay) => String(pay.purchase_id) === String(p.id)).reduce((a, pay) => a + Number(pay.amount), 0));
        return { kind: 'purchase', id: String(p.id), date: p.date_created, purchase: p, remaining };
      }),
      ...payments.map((p) => ({ kind: 'payment', id: `p-${p.id}`, date: p.date_added, payment: p })),
      ...returns.map((r) => ({ kind: 'return', id: `r-${r.id}`, date: r.date_created, ret: r })),
    ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    return { purchases, payments, returns, totalPurchased, totalPaid, totalReturned, balance, timeline };
  }, [selectedVendor, allPurchases, allPayments, allReturns]);

  const openAdd = () => { setFormInitial({ name: '', phone: '', email: '', address: '' }); setIsEditing(false); setShowForm(true); };
  const openEdit = (v, e) => { e?.stopPropagation(); setFormInitial({ ...v }); setIsEditing(true); setShowForm(true); };
  const openVendor = (v) => { setSelectedVendor(v); setPerCardAmts({}); };
  const closeVendor = () => { setSelectedVendor(null); setPerCardAmts({}); };

  const handleDelete = async (id) => {
    const balance = computeBalance(id);
    if (balance > 0.5) { showToast('Cannot delete a vendor with an outstanding balance', 'error'); setDeleteConfirmId(null); return; }
    await pushEntity('vendor', 'delete', { id });
    showToast('Vendor deleted');
    setDeleteConfirmId(null);
    if (selectedVendor?.id === id) closeVendor();
  };

  const handlePerCardPoPayment = async (poId, remaining) => {
    const amount = Number(perCardAmts[poId] || 0);
    if (!amount || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
    if (amount > remaining + 0.5) { showToast(`Cannot exceed ${fmtPKR(remaining)}`, 'error'); return; }
    setPaying(true);
    try {
      await pushEntity('vendor_payment', 'create', {
        vendor_id: selectedVendor.id,
        amount,
        date_added: new Date().toISOString(),
        notes: `Payment for PO #${poId}`,
        purchase_id: poId,
      });
      showToast(`${fmtPKR(amount)} recorded`);
      setPerCardAmts(prev => ({ ...prev, [poId]: '' }));
    } catch (err) { showToast(err.message || 'Failed', 'error'); }
    finally { setPaying(false); }
  };

  const printPO = (po, items) => {
    const win = window.open('', '_blank', 'width=420,height=600');
    if (!win) return;
    const poNum = `PO-${String(po.id).slice(-6).toUpperCase()}`;
    win.document.write(`<html><head><title>${poNum}</title><style>body{font-family:monospace;margin:24px;font-size:12px}.hdr{text-align:center;border-bottom:1px dashed #000;padding-bottom:10px;margin-bottom:10px}h2{margin:0;font-size:16px}p{margin:3px 0}.row{display:flex;justify-content:space-between;margin:4px 0}.tot{font-weight:bold;border-top:1px dashed #000;padding-top:6px;margin-top:6px}</style></head><body><div class="hdr"><h2>${poNum}</h2><p>${fmtDate(po.date_created)}</p></div>${items.map(it => `<div class="row"><span>${it.product_name || it.name} × ${it.quantity}</span><span>PKR ${Math.round((it.price || it.cost || 0) * (it.quantity || 0)).toLocaleString()}</span></div>`).join('')}<div class="row tot"><span>TOTAL</span><span>PKR ${Math.round(Number(po.total) || 0).toLocaleString()}</span></div></body></html>`);
    win.document.close();
    win.print();
  };

  const getPurchaseItems = (poId) => allPurchaseItems.filter((i) => String(i.purchase_id) === String(poId));

  return (
    <div className="h-full flex gap-5 min-h-0">

      {/* ── Left: Vendor List ── */}
      <div className="flex-1 flex flex-col min-w-0 rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-border/40 shrink-0">
          <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible" className="flex items-center justify-between mb-5">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/15"><Truck size={18} className="text-violet-500" /></div>
                <h1 className="text-2xl font-black tracking-tight">Vendors</h1>
              </div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest ml-[52px]">{vendors.length} total vendors</p>
            </div>
            <button onClick={() => setShowGlobalBills(true)}
              className="flex items-center gap-2 h-10 px-4 rounded-xl border border-amber-400 bg-amber-500/5 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm font-semibold transition-colors">
              <Wallet size={15} /> All Custom Bills
            </button>
            <button onClick={openAdd} className="flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold transition-colors shadow-sm">
              <Plus size={15} /> New Vendor
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
              <Truck size={48} className="opacity-15" />
              <div className="text-center">
                <p className="font-semibold text-sm">{search ? 'No matching vendors' : 'No vendors yet'}</p>
                <p className="text-xs mt-0.5 opacity-70">Click "New Vendor" to get started</p>
              </div>
            </div>
          ) : (
            <div>
              {paged.map((v, i) => {
                const balance = vendorBalanceMap.get(String(v.id)) || 0;
                const isSelected = String(selectedVendor?.id) === String(v.id);
                return (
                  <motion.div
                    key={v.id} custom={i} variants={fadeUp} initial="hidden" animate="visible"
                    onClick={() => openVendor(v)}
                    className={cn(
                      'flex items-center justify-between px-5 py-4 cursor-pointer transition-all border-b border-border/30 last:border-0 group',
                      'hover:bg-muted/25 border-l-[3px]',
                      isSelected ? 'bg-primary/5 border-l-primary pl-[17px]' : 'border-l-transparent'
                    )}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <Avatar name={v.name} size="md" />
                      <div className="min-w-0">
                        <h4 className="font-bold text-[15px] truncate">{v.name}</h4>
                        {v.phone && <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5"><Phone size={10} /> {v.phone}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {balance > 0 ? (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/25">{fmtPKR(balance)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">Settled</span>
                      )}

                      {/* 3-dots dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button onClick={(e) => e.stopPropagation()}
                            className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100">
                            <MoreVertical size={14} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/vendors/${v.id}`); }}>
                            <ExternalLink size={13} className="mr-2" /> View Full Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(v, e); }}>
                            <Pencil size={13} className="mr-2" /> Edit Vendor
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(v.id); }}
                          >
                            <Trash2 size={13} className="mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <ArrowRight size={14} className={cn('transition-colors', isSelected ? 'text-primary' : 'text-muted-foreground/30')} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
        {pageCount > 1 && (
          <div className="flex items-center justify-between px-5 py-2.5 border-t border-border/30 shrink-0 bg-muted/20">
            <span className="text-xs text-muted-foreground">{filtered.length} vendors · page {page} of {pageCount}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="h-7 w-7 rounded-lg border border-border text-base flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors">‹</button>
              <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount}
                className="h-7 w-7 rounded-lg border border-border text-base flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors">›</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Right: Vendor Detail Panel ── */}
      <AnimatePresence>
        {selectedVendor && (
          <motion.div
            key="detail"
            variants={slideIn}
            initial="hidden" animate="visible" exit="exit"
            className="w-[340px] min-w-[280px] xl:w-[420px] shrink-0 flex flex-col rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden"
          >
            {/* Panel Header */}
            <div className="relative border-b border-border/40">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-400" />
              <div className="px-5 pt-6 pb-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={selectedVendor.name} size="lg" />
                    <div>
                      <h2 className="text-lg font-black leading-tight">{selectedVendor.name}</h2>
                      {selectedVendor.phone && <span className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5"><Phone size={10} /> {selectedVendor.phone}</span>}
                      {selectedVendor.address && <span className="text-xs text-muted-foreground block truncate max-w-[180px]">{selectedVendor.address}</span>}
                    </div>
                  </div>
                  <button onClick={closeVendor} className="h-8 w-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0">
                    <X size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => selectedVendor.phone && window.open(`https://wa.me/92${selectedVendor.phone.replace(/^0/, '')}`, '_blank')}
                    disabled={!selectedVendor.phone}
                    className="flex items-center justify-center gap-1.5 h-9 rounded-xl bg-[#25d366] hover:bg-[#1fba57] disabled:opacity-40 text-white text-xs font-semibold transition-colors shadow-sm">
                    <MessageCircle size={13} /> WhatsApp
                  </button>
                  <button onClick={() => navigate('/purchases')} className="flex items-center justify-center gap-1.5 h-9 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold transition-colors">
                    <ShoppingCart size={13} /> New PO
                  </button>
                  <button onClick={() => setCustomBillsVendor(selectedVendor)}
                    className="flex items-center justify-center gap-1.5 h-9 rounded-xl border border-amber-400 bg-amber-500/5 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-semibold transition-colors">
                    <Wallet size={13} /> Custom Bills
                  </button>
                </div>
              </div>
            </div>

            {/* Panel Body */}
            {!vendorDetails ? (
              <div className="flex-1 flex items-center justify-center min-h-[300px]">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center"><RefreshCw size={22} className="animate-spin text-primary" /></div>
                  <p className="text-sm font-semibold">Loading…</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">

                {/* Balance Banner */}
                <div className={cn('mx-4 mt-4 mb-2 rounded-xl border p-4 text-center', vendorDetails.balance > 0 ? 'bg-rose-500/8 border-rose-500/25' : 'bg-emerald-500/8 border-emerald-500/25')}>
                  <p className={cn('text-2xl font-black', vendorDetails.balance > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                    {fmtPKR(vendorDetails.balance)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{vendorDetails.balance > 0 ? 'Amount Owed (Baqi)' : 'No outstanding balance'}</p>
                </div>

                {/* Summary Stats */}
                <div className="px-4 pb-3">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Purchases', value: fmtPKR(vendorDetails.totalPurchased), icon: Receipt, color: 'text-violet-500' },
                      { label: 'Paid', value: fmtPKR(vendorDetails.totalPaid), icon: CreditCard, color: 'text-emerald-500' },
                      { label: 'Returns', value: fmtPKR(vendorDetails.totalReturned), icon: RotateCcw, color: 'text-amber-500' },
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
                  {vendorDetails.timeline.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">No transactions yet</div>
                  ) : (
                    <div className="space-y-2">
                      {vendorDetails.timeline.map((row) => {
                        if (row.kind === 'purchase') {
                          const p = row.purchase;
                          const items = getPurchaseItems(p.id);
                          const paidAmt = row.amountPaid ?? (Number(p.total) - row.remaining);
                          const paidPct = Math.min(100, Math.round(Number(p.total) > 0 ? (paidAmt / Number(p.total)) * 100 : 0));
                          const stLabel = p.status || (row.remaining > 0.5 ? 'Pending' : 'Settled');
                          const stCls = stLabel === 'Settled' || stLabel === 'Paid' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : stLabel === 'Cancelled' ? 'bg-muted text-muted-foreground' : 'bg-rose-500/10 text-rose-700 dark:text-rose-400';
                          const isExpanded = expandedCards[p.id] || false;
                          const visibleCount = itemVisibleCounts[p.id] || 10;
                          const linkedPoPayments = (vendorDetails?.payments || []).filter(pay => String(pay.purchase_id) === String(p.id));
                          return (
                            <div key={row.id} className="rounded-xl border border-border/50 overflow-hidden bg-card">
                              <div className="h-[2px] bg-gradient-to-r from-indigo-500 to-violet-500" />
                              {/* Header */}
                              <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 gap-2">
                                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                  <span className="text-xs font-black font-mono">PO #{p.id}</span>
                                  <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0', stCls)}>{stLabel}</span>
                                  {items.length > 0 && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-400/25 text-amber-700 dark:text-amber-400 shrink-0">
                                      {items.length} item{items.length !== 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-[10px] text-muted-foreground">{fmtDate(p.date_created)}</span>
                                  <button onClick={() => printPO(p, items)}
                                    className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                                    <Printer size={12} />
                                  </button>
                                  <button onClick={() => setExpandedCards(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                                    className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                                    <Eye size={12} />
                                  </button>
                                </div>
                              </div>
                              {/* Total / Paid / Remaining plain text */}
                              <div className="grid grid-cols-3 px-3 pb-1.5 text-center">
                                <div>
                                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Total</p>
                                  <p className="text-[11px] font-black tabular-nums">{fmtPKR(p.total)}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Paid</p>
                                  <p className="text-[11px] font-black text-emerald-600 tabular-nums">{fmtPKR(paidAmt)}</p>
                                </div>
                                <div>
                                  <p className={cn('text-[9px] font-black uppercase tracking-widest', row.remaining > 0.5 ? 'text-rose-600' : 'text-emerald-600')}>Remaining</p>
                                  <p className={cn('text-[11px] font-black tabular-nums', row.remaining > 0.5 ? 'text-rose-600' : 'text-emerald-600')}>{fmtPKR(row.remaining)}</p>
                                </div>
                              </div>
                              {/* Progress bar */}
                              <div className="px-3 pb-1.5">
                                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${paidPct}%` }} />
                                </div>
                                <p className="text-[9px] text-muted-foreground mt-0.5">{paidPct}% paid</p>
                              </div>
                              {/* Items inline (collapsed view) */}
                              {items.length > 0 && !isExpanded && (
                                <div className="px-3 pb-1.5">
                                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                                    <span className="font-bold text-foreground/50">≡ </span>
                                    {items.map((it, idx) => (
                                      <span key={idx}>
                                        {idx > 0 && <span className="text-muted-foreground/40">, </span>}
                                        {it.product_name || it.name} <span className="font-semibold text-foreground/80">×{it.quantity}</span>
                                      </span>
                                    ))}
                                  </p>
                                </div>
                              )}
                              {/* Action bar */}
                              {row.remaining > 0.5 && stLabel !== 'Cancelled' && (
                                <div className="flex items-center gap-1.5 px-3 pb-2.5">
                                  <div className="relative flex-1">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground font-bold pointer-events-none">PKR</span>
                                    <input
                                      type="number" min="0"
                                      value={perCardAmts[p.id] || ''}
                                      onChange={(e) => setPerCardAmts(prev => ({ ...prev, [p.id]: e.target.value }))}
                                      placeholder={Math.round(row.remaining).toLocaleString()}
                                      className="h-7 pl-7 pr-2 w-full text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-emerald-500/40 tabular-nums"
                                    />
                                  </div>
                                  <button
                                    disabled={!perCardAmts[p.id] || paying}
                                    onClick={() => handlePerCardPoPayment(p.id, row.remaining)}
                                    className="h-7 px-3 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-40 shrink-0 transition-colors">
                                    Pay
                                  </button>
                                  {selectedVendor?.phone && (
                                    <button onClick={() => window.open(`https://wa.me/92${selectedVendor.phone.replace(/^0/, '')}`, '_blank')}
                                      className="w-7 h-7 rounded-full bg-[#25d366] flex items-center justify-center text-white hover:bg-[#1fba57] transition-colors shrink-0">
                                      <MessageCircle size={11} />
                                    </button>
                                  )}
                                </div>
                              )}
                              {/* Expanded view: Items Breakdown + Payments */}
                              {isExpanded && (
                                <div className="border-t border-border/20">
                                  {items.length > 0 && (
                                    <div className="px-3 pt-2 pb-2">
                                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Items Breakdown</p>
                                      <div className="space-y-1">
                                        {items.slice(0, visibleCount).map((it) => (
                                          <div key={it.id} className="flex justify-between items-center text-[11px]">
                                            <span className="text-muted-foreground">{it.product_name || it.name} <span className="text-foreground">×{it.quantity}</span></span>
                                            <span className="font-semibold font-mono">{fmtPKR((it.price || it.cost || 0) * (it.quantity || 0))}</span>
                                          </div>
                                        ))}
                                        {items.length > visibleCount && (
                                          <button
                                            onClick={() => setItemVisibleCounts(prev => ({ ...prev, [p.id]: (prev[p.id] || 10) + 10 }))}
                                            className="w-full mt-1 text-[10px] text-primary font-semibold hover:underline text-center py-0.5">
                                            Load {Math.min(10, items.length - visibleCount)} more…
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  {linkedPoPayments.length > 0 && (
                                    <div className="px-3 pb-2.5 border-t border-border/20 pt-2">
                                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Payments on this Order</p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {linkedPoPayments.map((pay) => (
                                          <span key={pay.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                                            {fmtPKR(pay.amount)} · {fmtDate(pay.date_added)}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
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
                                  <p className="text-xs font-bold text-emerald-700">Payment Made</p>
                                  <p className="text-[10px] text-muted-foreground">{fmtDate(p.date_added)}{p.notes ? ` · ${p.notes}` : ''}</p>
                                </div>
                              </div>
                              <span className="text-xs font-black text-emerald-600 font-mono">+{fmtPKR(p.amount)}</span>
                            </div>
                          );
                        }
                        if (row.kind === 'return') {
                          const r = row.ret;
                          return (
                            <div key={row.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5">
                              <div className="flex items-center gap-2">
                                <RotateCcw size={13} className="text-amber-600 shrink-0" />
                                <div>
                                  <p className="text-xs font-bold text-amber-700">Purchase Return</p>
                                  <p className="text-[10px] text-muted-foreground">{fmtDate(r.date_created)}</p>
                                </div>
                              </div>
                              <span className="text-xs font-black text-amber-600 font-mono">{fmtPKR(r.total_returned)}</span>
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

      {/* ── Form Modal ── */}
      <VendorFormModal
        isOpen={showForm}
        isEditing={isEditing}
        initial={formInitial}
        onClose={() => setShowForm(false)}
        onSaved={() => {}}
      />

      {/* ── Delete confirm ── */}
      {deleteConfirmId && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirmId(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.18 }}
            className="w-full max-w-sm bg-card rounded-2xl border border-border/50 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b" style={{ background: 'linear-gradient(135deg, #1a0a0a 0%, #3a0a0a 100%)' }}>
              <h3 className="text-white font-bold">Delete Vendor?</h3>
            </div>
            <div className="p-5">
              <p className="text-sm text-muted-foreground">Vendors with outstanding balances cannot be deleted. This action cannot be undone.</p>
            </div>
            <div className="flex justify-end gap-3 px-5 pb-5">
              <button onClick={() => setDeleteConfirmId(null)} className="h-9 px-4 text-sm rounded-lg border border-border bg-background hover:bg-muted">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirmId)} className="h-9 px-4 text-sm rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold">Delete</button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* ── Per-vendor Custom Bills Panel ── */}
      <AnimatePresence>
        {customBillsVendor && (
          <CustomBillsPanel vendor={customBillsVendor} onClose={() => setCustomBillsVendor(null)} />
        )}
      </AnimatePresence>

      {/* ── Global Custom Bills Overlay ── */}
      {showGlobalBills && (
        <GlobalCustomBillsOverlay onClose={() => setShowGlobalBills(false)} />
      )}
    </div>
  );
}
