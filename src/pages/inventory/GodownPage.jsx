import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Warehouse, Plus, ArrowDownToLine, ArrowUpFromLine, Search,
  Trash2, X, RefreshCw, Package, ArrowLeft,
} from 'lucide-react';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { cn } from '@/lib/utils';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtPKR(n) {
  return `PKR ${Math.round(Number(n) || 0).toLocaleString('en-PK')}`;
}

function AddEntryModal({ products, onClose, onSave }) {
  const [type, setType] = useState('in');
  const [productId, setProductId] = useState('');
  const [customItem, setCustomItem] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedProduct = products.find(p => String(p.id) === productId);
  const itemLabel = selectedProduct ? selectedProduct.name : (customItem || '');

  const handleSave = async () => {
    if (!itemLabel.trim() || !qty) return;
    setSaving(true);
    await onSave({ type, product_id: productId || null, item_name: itemLabel.trim(), qty: Number(qty), unit, notes: notes.trim() });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Warehouse size={16} className="text-primary" />
            New Godown Entry
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          {/* Type */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Entry Type</label>
            <div className="flex gap-2">
              <button onClick={() => setType('in')}
                className={cn('flex-1 h-9 rounded-xl border text-sm font-semibold transition-colors flex items-center justify-center gap-2',
                  type === 'in' ? 'bg-emerald-500 text-white border-emerald-500' : 'border-border bg-background hover:bg-muted text-muted-foreground')}>
                <ArrowDownToLine size={14} /> Stock In
              </button>
              <button onClick={() => setType('out')}
                className={cn('flex-1 h-9 rounded-xl border text-sm font-semibold transition-colors flex items-center justify-center gap-2',
                  type === 'out' ? 'bg-rose-500 text-white border-rose-500' : 'border-border bg-background hover:bg-muted text-muted-foreground')}>
                <ArrowUpFromLine size={14} /> Stock Out
              </button>
            </div>
          </div>

          {/* Item */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Item</label>
            <select value={productId} onChange={e => { setProductId(e.target.value); if (e.target.value) setCustomItem(''); }}
              className="w-full h-9 pl-3 pr-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 mb-2">
              <option value="">— Enter custom item —</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {!productId && (
              <input value={customItem} onChange={e => setCustomItem(e.target.value)} placeholder="Item name…"
                className="w-full h-9 pl-3 pr-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            )}
          </div>

          {/* Qty + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Quantity</label>
              <input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" min="0"
                className="w-full h-9 pl-3 pr-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Unit</label>
              <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="pcs"
                className="w-full h-9 pl-3 pr-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Source, purpose, etc."
              className="w-full pl-3 pr-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
        </div>
        <div className="flex items-center gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 h-9 rounded-xl border border-border bg-background hover:bg-muted text-sm transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={(!productId && !customItem.trim()) || !qty || saving}
            className={cn('flex-1 h-9 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-40 flex items-center justify-center gap-2',
              type === 'in' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600')}>
            {saving ? <RefreshCw size={13} className="animate-spin" /> : (type === 'in' ? <ArrowDownToLine size={13} /> : <ArrowUpFromLine size={13} />)}
            {saving ? 'Saving…' : (type === 'in' ? 'Record In' : 'Record Out')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GodownPage() {
  const navigate = useNavigate();
  const { list, pushEntity, nextId } = useDataStore();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const entries = list('godown_entry');
  const products = list('product');

  const filtered = useMemo(() => {
    let rows = entries;
    if (typeFilter !== 'all') rows = rows.filter(r => r.type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.item_name?.toLowerCase().includes(q) || r.notes?.toLowerCase().includes(q));
    }
    return rows.sort((a, b) => (b.date_created || '').localeCompare(a.date_created || ''));
  }, [entries, typeFilter, search]);

  const stockMap = useMemo(() => {
    const m = {};
    for (const e of entries) {
      const key = e.product_id ? String(e.product_id) : e.item_name;
      if (!m[key]) m[key] = { name: e.item_name, qty: 0 };
      m[key].qty += e.type === 'in' ? Number(e.qty || 0) : -Number(e.qty || 0);
    }
    return m;
  }, [entries]);

  const totalItems = Object.keys(stockMap).length;
  const totalIn  = entries.filter(e => e.type === 'in').reduce((s, e) => s + Number(e.qty || 0), 0);
  const totalOut = entries.filter(e => e.type === 'out').reduce((s, e) => s + Number(e.qty || 0), 0);

  const handleAdd = async ({ type, product_id, item_name, qty, unit, notes }) => {
    await pushEntity('godown_entry', 'create', {
      id: nextId(),
      type,
      product_id,
      item_name,
      qty,
      unit: unit || 'pcs',
      notes: notes || null,
      date_created: new Date().toISOString(),
    });
    showToast(`Godown ${type === 'in' ? 'IN' : 'OUT'} recorded`, 'success');
  };

  const handleDelete = async (id) => {
    await pushEntity('godown_entry', 'delete', { id });
    setDeleteId(null);
    showToast('Entry deleted', 'success');
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/expenses')}
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-border bg-background hover:bg-muted transition-colors text-muted-foreground"
            title="Back to Expenses">
            <ArrowLeft size={16} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Warehouse size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Godown</h1>
            <p className="text-xs text-muted-foreground">Warehouse holding entries</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
          <Plus size={14} /> New Entry
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Unique Items', value: totalItems, color: 'text-primary',      bg: 'bg-primary/10 border-primary/20',        icon: Package },
          { label: 'Total In',    value: totalIn,    color: 'text-emerald-600',   bg: 'bg-emerald-500/10 border-emerald-500/20', icon: ArrowDownToLine },
          { label: 'Total Out',   value: totalOut,   color: 'text-rose-600',      bg: 'bg-rose-500/10 border-rose-500/20',       icon: ArrowUpFromLine },
        ].map(c => (
          <div key={c.label} className="rounded-2xl border border-border/60 bg-card p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
            <div className={cn('p-2.5 rounded-xl border', c.bg)}>
              <c.icon size={16} className={c.color} />
            </div>
            <div>
              <p className={cn('text-2xl font-black tabular-nums', c.color)}>{c.value}</p>
              <p className="text-[11px] text-muted-foreground font-medium">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Current stock summary */}
      {Object.keys(stockMap).length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b bg-muted/20 flex items-center justify-between">
            <p className="text-sm font-bold">Current Godown Stock</p>
            <span className="text-xs text-muted-foreground">{Object.values(stockMap).filter(v => v.qty > 0).length} items</span>
          </div>
          <div className="divide-y divide-border/30">
            {Object.entries(stockMap).filter(([, v]) => v.qty > 0).map(([key, v]) => (
              <div key={key} className="flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-sm font-medium">{v.name}</span>
                </div>
                <span className="text-sm font-bold text-emerald-600 tabular-nums bg-emerald-500/10 px-2.5 py-0.5 rounded-full">{v.qty}</span>
              </div>
            ))}
            {Object.values(stockMap).filter(v => v.qty > 0).length === 0 && (
              <p className="px-5 py-4 text-sm text-muted-foreground">No stock currently in godown</p>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex gap-1.5">
          {[
            { key: 'all', label: 'All Entries' },
            { key: 'in',  label: 'Stock In' },
            { key: 'out', label: 'Stock Out' },
          ].map(t => (
            <button key={t.key} onClick={() => setTypeFilter(t.key)}
              className={cn('h-8 px-3 rounded-xl text-xs font-semibold border transition-colors',
                typeFilter === t.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background hover:bg-muted text-muted-foreground')}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-56">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entries…"
            className="w-full h-9 pl-8 pr-3 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
      </div>

      {/* Entry log */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Warehouse size={32} className="text-muted-foreground/30 mb-3" />
          <p className="font-semibold text-muted-foreground">No entries yet</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Record stock in/out movements for your godown</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="text-left text-xs font-semibold text-muted-foreground py-3 pl-5">Item</th>
                <th className="text-center text-xs font-semibold text-muted-foreground py-3">Type</th>
                <th className="text-right text-xs font-semibold text-muted-foreground py-3">Qty</th>
                <th className="text-left text-xs font-semibold text-muted-foreground py-3 pl-4">Notes</th>
                <th className="text-right text-xs font-semibold text-muted-foreground py-3 pr-5">Date</th>
                <th className="py-3 pr-3" />
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {filtered.map(e => (
                  <motion.tr key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="border-t border-border/30 hover:bg-muted/20 group">
                    <td className="py-3 pl-5 font-medium">{e.item_name}</td>
                    <td className="py-3 text-center">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border',
                        e.type === 'in'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-700')}>
                        {e.type === 'in' ? <ArrowDownToLine size={9} /> : <ArrowUpFromLine size={9} />}
                        {e.type === 'in' ? 'IN' : 'OUT'}
                      </span>
                    </td>
                    <td className="py-3 text-right font-mono font-bold tabular-nums">{e.qty} <span className="text-muted-foreground font-normal text-xs">{e.unit}</span></td>
                    <td className="py-3 pl-4 text-muted-foreground text-xs max-w-[160px] truncate">{e.notes || '—'}</td>
                    <td className="py-3 pr-5 text-right text-muted-foreground text-xs">{fmtDate(e.date_created)}</td>
                    <td className="py-3 pr-3">
                      {deleteId === e.id ? (
                        <div className="flex items-center gap-1 bg-destructive/8 px-2 rounded-lg border border-destructive/20">
                          <span className="text-[11px] font-semibold text-destructive">Sure?</span>
                          <button onClick={() => handleDelete(e.id)} className="h-5 px-1.5 text-[10px] rounded bg-destructive text-white hover:bg-destructive/90">Yes</button>
                          <button onClick={() => setDeleteId(null)} className="h-5 px-1.5 text-[10px] rounded hover:bg-muted">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteId(e.id)}
                          className="opacity-0 group-hover:opacity-100 h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10 flex items-center justify-center transition-all">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {showAdd && <AddEntryModal products={products} onClose={() => setShowAdd(false)} onSave={handleAdd} />}
      </AnimatePresence>
    </div>
  );
}
