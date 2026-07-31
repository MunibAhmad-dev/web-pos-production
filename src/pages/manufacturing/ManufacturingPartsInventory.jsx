import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Boxes, Search, Plus, X, RefreshCw, AlertCircle,
  RotateCcw, Clock, Pencil, Trash2, BarChart2,
  ChevronUp, ChevronDown,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import {
  mfgGetParts,
  mfgCreatePart,
  mfgUpdatePart,
  mfgAdjustPartStock,
  mfgDeletePart,
} from '../../api/manufacturingApi';

const fmt = n =>
  `Rs. ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const UNITS = ['pc', 'pcs', 'kg', 'g', 'm', 'cm', 'pair', 'box', 'set', 'roll', 'sheet'];

const EMPTY_FORM = {
  name: '', category: '', unit: 'pc',
  cost_price: '', selling_price: '',
  stock: '', low_stock_threshold: '5',
};

export default function ManufacturingPartsInventory() {
  const navigate = useNavigate();

  const [parts, setParts]           = useState([]);
  const [lowStockCount, setLow]     = useState(0);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [search, setSearch]         = useState('');
  const [sortKey, setSortKey]       = useState('name');
  const [sortDir, setSortDir]       = useState('asc');

  // Dialogs
  const [partDialog, setPartDialog]   = useState({ open: false, mode: 'add', part: null });
  const [stockDialog, setStockDialog] = useState({ open: false, part: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, part: null });
  const [historyDialog, setHistoryDialog] = useState({ open: false, part: null });

  const [form, setForm]               = useState(EMPTY_FORM);
  const [newStock, setNewStock]       = useState('');
  const [submitting, setSubmitting]   = useState(false);

  const fetchParts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await mfgGetParts();
      setParts(res.parts || []);
      setLow(res.low_stock_count || 0);
    } catch (err) {
      setError(err.message || 'Failed to load parts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchParts(); }, [fetchParts]);

  // ── derived list ────────────────────────────────────────────────────────────
  const displayed = useMemo(() => {
    let list = [...parts];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let av = a[sortKey] ?? '';
      let bv = b[sortKey] ?? '';
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [parts, search, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  function SortIcon({ col }) {
    if (sortKey !== col) return <ChevronUp size={10} className="opacity-20" />;
    return sortDir === 'asc'
      ? <ChevronUp size={10} className="text-indigo-500" />
      : <ChevronDown size={10} className="text-indigo-500" />;
  }

  const categories = useMemo(() => {
    const cats = new Set(parts.map(p => p.category).filter(Boolean));
    return [...cats].sort();
  }, [parts]);

  // ── Add / Edit ───────────────────────────────────────────────────────────────
  function openAdd() {
    setForm(EMPTY_FORM);
    setPartDialog({ open: true, mode: 'add', part: null });
  }

  function openEdit(part) {
    setForm({
      name:                part.name,
      category:            part.category || '',
      unit:                part.unit || 'pc',
      cost_price:          String(part.cost_price),
      selling_price:       String(part.selling_price),
      stock:               String(part.stock),
      low_stock_threshold: String(part.low_stock_threshold || 5),
    });
    setPartDialog({ open: true, mode: 'edit', part });
  }

  async function handleSavePart() {
    if (!form.name.trim()) { toast.error('Part name is required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        name:                form.name.trim(),
        category:            form.category.trim(),
        unit:                form.unit,
        cost_price:          Number(form.cost_price  || 0),
        selling_price:       Number(form.selling_price || 0),
        stock:               Number(form.stock        || 0),
        low_stock_threshold: Number(form.low_stock_threshold || 5),
      };

      if (partDialog.mode === 'add') {
        const res = await mfgCreatePart(payload);
        setParts(prev => [res.part, ...prev]);
        toast.success('Part created');
      } else {
        const res = await mfgUpdatePart(partDialog.part.id, payload);
        setParts(prev => prev.map(p => p.id === partDialog.part.id ? { ...p, ...res.part } : p));
        toast.success('Part updated');
      }

      setPartDialog({ open: false, mode: 'add', part: null });
    } catch (err) {
      toast.error(err.message || 'Failed to save part');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Adjust Stock ─────────────────────────────────────────────────────────────
  function openAdjustStock(part) {
    setNewStock(String(part.stock));
    setStockDialog({ open: true, part });
  }

  async function handleAdjustStock() {
    const val = Number(newStock);
    if (isNaN(val) || val < 0) { toast.error('Enter a valid stock quantity'); return; }
    setSubmitting(true);
    try {
      const res = await mfgAdjustPartStock(stockDialog.part.id, val);
      setParts(prev => prev.map(p =>
        p.id === stockDialog.part.id ? { ...p, stock: val, value: val * p.cost_price } : p
      ));
      toast.success('Stock updated');
      setStockDialog({ open: false, part: null });
    } catch (err) {
      toast.error(err.message || 'Failed to update stock');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  async function handleDelete() {
    setSubmitting(true);
    try {
      await mfgDeletePart(deleteDialog.part.id);
      setParts(prev => prev.filter(p => p.id !== deleteDialog.part.id));
      toast.success('Part deleted');
      setDeleteDialog({ open: false, part: null });
    } catch (err) {
      toast.error(err.message || 'Failed to delete part');
    } finally {
      setSubmitting(false);
    }
  }

  // ── UI ───────────────────────────────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-56px)] overflow-y-auto">

      {/* ── Page header ── */}
      <div className="px-6 py-5 border-b bg-background">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
              <Boxes size={20} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Parts Inventory</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Raw materials and components used to build air coolers
              </p>
              <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                <span><strong className="text-foreground">{parts.length}</strong> parts tracked</span>
                <span>
                  <strong className={lowStockCount > 0 ? 'text-amber-600' : 'text-foreground'}>
                    {lowStockCount}
                  </strong>{' '}
                  low stock
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={fetchParts} disabled={loading}>
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </Button>
            <Button
              size="sm" variant="outline"
              onClick={() => navigate('/manufacturing/reports')}
              className="gap-1.5"
            >
              <BarChart2 size={13} /> Report
            </Button>
            <Button
              size="sm"
              onClick={openAdd}
              className="gap-1.5"
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}
            >
              <Plus size={13} /> Add Part
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4 relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search parts…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-400">
          <AlertCircle size={13} /> {error}
          <Button size="sm" variant="ghost" className="ml-auto h-5 px-2 text-xs text-red-700" onClick={fetchParts}>
            Retry
          </Button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm border-b">
            <tr>
              {[
                { key: 'name',          label: 'Name' },
                { key: 'category',      label: 'Category' },
                { key: 'cost_price',    label: 'Purchase Price' },
                { key: 'selling_price', label: 'Selling Price' },
                { key: 'stock',         label: 'Free / Available' },
                { key: null,            label: 'Used (Lifetime)' },
                { key: 'value',         label: 'Value (Free Stock)' },
              ].map(col => (
                <th
                  key={col.label}
                  onClick={col.key ? () => toggleSort(col.key) : undefined}
                  className={`px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap select-none ${col.key ? 'cursor-pointer hover:text-foreground' : ''}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.key && <SortIcon col={col.key} />}
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b animate-pulse">
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} className="px-4 py-4">
                      <div className="h-3 rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))
            ) : displayed.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-muted-foreground text-sm">
                  <Boxes size={32} className="mx-auto mb-3 opacity-25" />
                  {search ? `No parts match "${search}"` : 'No parts synced yet. Add your first part below.'}
                  {!search && (
                    <div className="mt-3">
                      <Button size="sm" onClick={openAdd} className="gap-1.5">
                        <Plus size={12} /> Add Part
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              displayed.map(part => {
                const usedTotal = (part.used_in_coolers || 0) + (part.sold_loose || 0);
                const isLow     = part.stock <= part.low_stock_threshold && part.stock > 0;
                const isOut     = part.stock === 0;
                return (
                  <tr key={part.id} className="border-b hover:bg-muted/20 transition-colors">
                    {/* Name */}
                    <td className="px-4 py-3.5">
                      <span className="font-medium text-sm">{part.name}</span>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3.5 text-sm text-muted-foreground">
                      {part.category || <span className="opacity-40">—</span>}
                    </td>

                    {/* Purchase price */}
                    <td className="px-4 py-3.5 text-sm tabular-nums">
                      {part.cost_price > 0 ? fmt(part.cost_price) : <span className="text-muted-foreground opacity-40">—</span>}
                    </td>

                    {/* Selling price */}
                    <td className="px-4 py-3.5 text-sm tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                      {part.selling_price > 0 ? fmt(part.selling_price) : <span className="text-muted-foreground opacity-40">—</span>}
                    </td>

                    {/* Free / Available */}
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        isOut
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          : isLow
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                          : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      }`}>
                        {part.stock} {part.unit || 'pcs'}
                      </span>
                    </td>

                    {/* Used lifetime */}
                    <td className="px-4 py-3.5">
                      {usedTotal === 0 ? (
                        <span className="text-sm text-muted-foreground opacity-40">—</span>
                      ) : (
                        <div>
                          <span className="text-sm font-semibold">{usedTotal} pcs</span>
                          <div className="text-xs text-muted-foreground mt-0.5 space-x-1">
                            {part.used_in_coolers > 0 && <span>{part.used_in_coolers} in coolers</span>}
                            {part.used_in_coolers > 0 && part.sold_loose > 0 && <span>,</span>}
                            {part.sold_loose > 0 && <span>{part.sold_loose} sold loose</span>}
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Value */}
                    <td className="px-4 py-3.5 text-sm tabular-nums font-medium">
                      {fmt(part.value)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openAdjustStock(part)}
                          title="Adjust Stock"
                          className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                        >
                          <RotateCcw size={15} />
                        </button>
                        <button
                          onClick={() => setHistoryDialog({ open: true, part })}
                          title="History"
                          className="p-1.5 rounded text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                        >
                          <Clock size={15} />
                        </button>
                        <button
                          onClick={() => openEdit(part)}
                          title="Edit"
                          className="p-1.5 rounded text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteDialog({ open: true, part })}
                          title="Delete"
                          className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Add / Edit Part Dialog ── */}
      <Dialog open={partDialog.open} onOpenChange={v => setPartDialog(d => ({ ...d, open: v }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Boxes size={16} className="text-indigo-500" />
              {partDialog.mode === 'add' ? 'Add New Part' : `Edit — ${partDialog.part?.name}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs">Part Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. Motor, Kabla, Blade…"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="h-9 text-sm"
                autoFocus
              />
            </div>

            {/* Category + Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Input
                  placeholder="Optional"
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="h-9 text-sm"
                  list="part-cat-list"
                />
                <datalist id="part-cat-list">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unit</Label>
                <select
                  value={form.unit}
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            {/* Prices */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Purchase Price (Rs.)</Label>
                <Input
                  type="number" min="0" placeholder="0"
                  value={form.cost_price}
                  onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Selling Price (Rs.)</Label>
                <Input
                  type="number" min="0" placeholder="0"
                  value={form.selling_price}
                  onChange={e => setForm(f => ({ ...f, selling_price: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Stock + threshold */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {partDialog.mode === 'add' ? 'Initial Stock' : 'Stock'}
                </Label>
                <Input
                  type="number" min="0" placeholder="0"
                  value={form.stock}
                  onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Low Stock Alert</Label>
                <Input
                  type="number" min="0" placeholder="5"
                  value={form.low_stock_threshold}
                  onChange={e => setForm(f => ({ ...f, low_stock_threshold: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Value preview */}
            {Number(form.cost_price) > 0 && Number(form.stock) > 0 && (
              <div className="rounded-lg bg-muted/40 px-4 py-2.5 flex justify-between text-sm">
                <span className="text-muted-foreground">Stock Value</span>
                <span className="font-bold tabular-nums">
                  {fmt(Number(form.stock) * Number(form.cost_price))}
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPartDialog(d => ({ ...d, open: false }))} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSavePart}
              disabled={submitting || !form.name.trim()}
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}
            >
              {submitting
                ? <><RefreshCw size={13} className="animate-spin" /> Saving…</>
                : partDialog.mode === 'add' ? 'Add Part' : 'Save Changes'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Adjust Stock Dialog ── */}
      <Dialog open={stockDialog.open} onOpenChange={v => setStockDialog(d => ({ ...d, open: v }))}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw size={16} className="text-emerald-500" />
              Adjust Stock
            </DialogTitle>
          </DialogHeader>
          {stockDialog.part && (
            <div className="space-y-4 py-1">
              <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm">
                <p className="font-semibold">{stockDialog.part.name}</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Current stock: <strong>{stockDialog.part.stock} {stockDialog.part.unit}</strong>
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">New Stock Quantity</Label>
                <Input
                  type="number" min="0" autoFocus
                  value={newStock}
                  onChange={e => setNewStock(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setStockDialog({ open: false, part: null })} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleAdjustStock}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting ? <RefreshCw size={13} className="animate-spin" /> : 'Update Stock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── History Dialog ── */}
      <Dialog open={historyDialog.open} onOpenChange={v => setHistoryDialog(d => ({ ...d, open: v }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock size={16} className="text-blue-500" />
              {historyDialog.part?.name} — History
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center text-sm text-muted-foreground">
            <Clock size={28} className="mx-auto mb-3 opacity-25" />
            Stock history is tracked on the desktop app.
            <br />
            Cloud sync events are append-only — detailed history coming soon.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryDialog({ open: false, part: null })}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog open={deleteDialog.open} onOpenChange={v => setDeleteDialog(d => ({ ...d, open: v }))}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 size={16} /> Delete Part
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Delete <strong className="text-foreground">{deleteDialog.part?.name}</strong>?
            This will push a delete sync event — the part will be removed from the cloud and
            hidden from the desktop on next sync.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, part: null })} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {submitting ? <RefreshCw size={13} className="animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
