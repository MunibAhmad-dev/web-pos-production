import React, { useMemo, useState, useRef } from 'react';
import { usePagination } from '../../hooks/usePagination';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Truck, Pencil, Trash2, Phone,
  X, ArrowRight, RefreshCw,
  Wallet, Download, BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import CustomBillsPanel from '../../components/vendors/CustomBillsPanel';
import GlobalCustomBillsOverlay from '../../components/vendors/GlobalCustomBillsOverlay';
import { vendorBalances, khataBalances } from '@/lib/ledger';

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
  const [customBillsVendor, setCustomBillsVendor] = useState(null);
  const [showGlobalBills, setShowGlobalBills] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  const vendors = list('vendor');
  const allPurchases = list('purchase');
  const allPayments = list('vendor_payment');
  const allReturns = list('purchase_return');
  const allVendorKhatas = list('vendor_khata');
  const allVendorKhataPayments = list('vendor_khata_payment');

  // Desktop get-vendors rule + open custom bills (Vendors.tsx shows balance + khata_balance).
  const vendorBalanceMap = useMemo(() => {
    const purchaseBal = vendorBalances({ purchases: allPurchases, vendorPayments: allPayments, purchaseReturns: allReturns });
    const khataBal = khataBalances(allVendorKhatas, allVendorKhataPayments, 'vendor_id');
    const m = new Map();
    for (const v of vendors) {
      const vid = String(v.id);
      m.set(vid, Math.max(0, (purchaseBal.get(vid) || 0) + (khataBal.get(vid) || 0)));
    }
    return m;
  }, [vendors, allPurchases, allPayments, allReturns, allVendorKhatas, allVendorKhataPayments]);

  // Sorted by balance desc then alphabetically
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors
      .filter((v) => !q || v.name?.toLowerCase().includes(q) || v.phone?.includes(q))
      .sort((a, b) => {
        const ba = vendorBalanceMap.get(String(a.id)) || 0;
        const bb = vendorBalanceMap.get(String(b.id)) || 0;
        if (bb !== ba) return bb - ba;
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [vendors, search, vendorBalanceMap]);

  const { paged, page, pageCount, setPage } = usePagination(filtered, 30);

  const handleExportVendorsPDF = async () => {
    if (exportingPDF || filtered.length === 0) return;
    setExportingPDF(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const allSettings = list('settings');
      const storeName = allSettings?.[0]?.store_name || allSettings?.[0]?.business_name || 'My Store';
      const rows = filtered.map((v) => {
        const balance = vendorBalanceMap.get(String(v.id)) || 0;
        return `<tr>
          <td>${v.name || '—'}</td>
          <td>${v.phone || '—'}</td>
          <td>${v.email || '—'}</td>
          <td>${v.address || '—'}</td>
          <td class="num ${balance > 0 ? 'due' : 'ok'}">${balance > 0 ? 'PKR ' + Math.round(balance).toLocaleString('en-PK') : 'Settled'}</td>
        </tr>`;
      }).join('');
      const totalBalance = filtered.reduce((s, v) => s + (vendorBalanceMap.get(String(v.id)) || 0), 0);
      const el = document.createElement('div');
      el.innerHTML = `
        <style>
          body { font-family: Arial, sans-serif; font-size: 11px; color: #111; }
          h2 { font-size: 16px; margin: 0 0 2px; }
          p.sub { font-size: 10px; color: #666; margin: 0 0 12px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #4c1d95; color: #fff; padding: 7px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; }
          td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) td { background: #faf5ff; }
          .num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }
          .ok { color: #16a34a; }
          .due { color: #b91c1c; }
          .summary { margin-top: 14px; padding-top: 10px; border-top: 2px solid #4c1d95; font-size: 11px; display: flex; gap: 24px; }
          .summary .item { display: flex; flex-direction: column; gap: 2px; }
          .summary .label { font-size: 9px; text-transform: uppercase; color: #666; letter-spacing: .05em; }
          .summary .val { font-size: 14px; font-weight: 700; }
        </style>
        <h2>${storeName} — Vendors Directory</h2>
        <p class="sub">Generated ${new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' })} · ${filtered.length} vendors</p>
        <table>
          <thead><tr>
            <th>Vendor Name</th><th>Phone</th><th>Email</th><th>Address</th>
            <th style="text-align:right">Outstanding Balance</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="summary">
          <div class="item"><span class="label">Total Vendors</span><span class="val">${filtered.length}</span></div>
          <div class="item"><span class="label">With Balance</span><span class="val">${filtered.filter(v => (vendorBalanceMap.get(String(v.id)) || 0) > 0.5).length}</span></div>
          <div class="item"><span class="label">Total Outstanding</span><span class="val" style="color:#b91c1c">PKR ${Math.round(totalBalance).toLocaleString('en-PK')}</span></div>
        </div>`;
      await html2pdf().set({
        margin: 10,
        filename: `Vendors-${new Date().toISOString().slice(0, 10)}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      }).from(el).save();
    } catch (err) {
      console.error('PDF export failed', err);
    } finally {
      setExportingPDF(false);
    }
  };

  const openAdd = () => { setFormInitial({ name: '', phone: '', email: '', address: '' }); setIsEditing(false); setShowForm(true); };
  const openEdit = (v, e) => { e?.stopPropagation(); setFormInitial({ ...v }); setIsEditing(true); setShowForm(true); };

  const handleDelete = async (id) => {
    const balance = vendorBalanceMap.get(String(id)) || 0;
    if (balance > 0.5) { showToast('Cannot delete a vendor with an outstanding balance', 'error'); setDeleteConfirmId(null); return; }
    await pushEntity('vendor', 'delete', { id });
    showToast('Vendor deleted');
    setDeleteConfirmId(null);
  };

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Vendor List ── */}
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
            <div className="flex items-center gap-2">
              <button onClick={() => setShowGlobalBills(true)}
                className="flex items-center gap-2 h-10 px-4 rounded-xl border border-amber-400 bg-amber-500/5 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm font-semibold transition-colors">
                <Wallet size={15} /> All Custom Bills
              </button>
              <button onClick={handleExportVendorsPDF} disabled={exportingPDF || filtered.length === 0}
                className="flex items-center gap-2 h-10 px-4 rounded-xl border border-border bg-background hover:bg-muted text-sm font-semibold transition-colors disabled:opacity-40">
                {exportingPDF ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                {exportingPDF ? 'Exporting…' : 'PDF'}
              </button>
              <button onClick={() => navigate('/vendor-reports')} className="flex items-center gap-2 h-10 px-4 rounded-xl border border-border bg-background hover:bg-muted text-sm font-semibold transition-colors">
                <BarChart3 size={14} /><span className="hidden sm:inline">Reports</span>
              </button>
              <button onClick={openAdd} className="flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold transition-colors shadow-sm">
                <Plus size={15} /> New Vendor
              </button>
            </div>
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
                return (
                  <motion.div
                    key={v.id} custom={i} variants={fadeUp} initial="hidden" animate="visible"
                    onClick={() => navigate('/vendors/' + v.id)}
                    className="flex items-center justify-between px-5 py-4 cursor-pointer transition-all border-b border-border/30 last:border-0 hover:bg-muted/25"
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
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25">{fmtPKR(balance)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">Settled</span>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); setCustomBillsVendor(v); }}
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 transition-colors" title="Custom Bills">
                        <Wallet size={13} />
                      </button>
                      <button onClick={(e) => openEdit(v, e)} className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(v.id); }} className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 size={13} />
                      </button>
                      <ArrowRight size={14} className="text-muted-foreground/40" />
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
