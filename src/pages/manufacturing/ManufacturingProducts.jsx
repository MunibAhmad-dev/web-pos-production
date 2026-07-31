import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Package2, Plus, X, RefreshCw, AlertCircle,
  Pencil, Trash2, Search, ChevronDown, ChevronUp,
  Boxes, Wrench, Truck, DollarSign, CheckCircle2,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import {
  mfgGetProducts, mfgCreateProduct, mfgUpdateProduct, mfgDeleteProduct,
} from '../../api/manufacturingApi';
import { mfgGetParts } from '../../api/manufacturingApi';

const Rs = n =>
  `Rs. ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const EMPTY_FORM = {
  name: '', description: '', category: '',
  labor_cost: '', transport_cost: '',
  profit_margin_pct: '', selling_price: '',
  stock: '0', allocated_units: '0',
  components: [],  // [{ part_id, part_name, quantity, unit_cost, unit }]
};

export default function ManufacturingProducts() {
  const [products, setProducts]   = useState([]);
  const [parts, setParts]         = useState([]);   // for BOM selector
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [search, setSearch]       = useState('');

  const [dialog, setDialog]       = useState({ open: false, mode: 'add', product: null });
  const [deleteDialog, setDel]    = useState({ open: false, product: null });
  const [form, setForm]           = useState(EMPTY_FORM);
  const [submitting, setSub]      = useState(false);

  // part selector in the form
  const [partSearch, setPartSearch] = useState('');
  const [showPartDrop, setShowPartDrop] = useState(false);

  // ── fetch ────────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [pRes, partsRes] = await Promise.all([
        mfgGetProducts(),
        mfgGetParts(),
      ]);
      setProducts(pRes.products || []);
      setParts(partsRes.parts || []);
    } catch (err) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── derived ──────────────────────────────────────────────────────────────────
  const displayed = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
    );
  }, [products, search]);

  // ── cost preview ─────────────────────────────────────────────────────────────
  const formMaterialCost = form.components.reduce(
    (s, c) => s + Number(c.quantity || 0) * Number(c.unit_cost || 0), 0
  );
  const formLaborCost     = Number(form.labor_cost     || 0);
  const formTransportCost = Number(form.transport_cost || 0);
  const formCostPerUnit   = formMaterialCost + formLaborCost + formTransportCost;
  const formSellingPrice  = Number(form.selling_price || 0);
  const formMarginAmt     = formSellingPrice - formCostPerUnit;
  const formMarginPct     = formCostPerUnit > 0
    ? ((formMarginAmt / formCostPerUnit) * 100).toFixed(1)
    : '—';

  // ── dialog helpers ───────────────────────────────────────────────────────────
  function openAdd() {
    setForm(EMPTY_FORM);
    setPartSearch('');
    setDialog({ open: true, mode: 'add', product: null });
  }

  function openEdit(product) {
    setForm({
      name:              product.name,
      description:       product.description || '',
      category:          product.category || '',
      labor_cost:        String(product.labor_cost),
      transport_cost:    String(product.transport_cost),
      profit_margin_pct: String(product.profit_margin_pct),
      selling_price:     String(product.selling_price),
      stock:             String(product.stock),
      allocated_units:   String(product.allocated_units ?? 0),
      components:        (product.components || []).map(c => ({ ...c })),
    });
    setPartSearch('');
    setDialog({ open: true, mode: 'edit', product });
  }

  // ── component (BOM) helpers ──────────────────────────────────────────────────
  function addComponent(part) {
    if (form.components.some(c => String(c.part_id) === String(part.id))) {
      toast.info('Part already added');
      return;
    }
    setForm(f => ({
      ...f,
      components: [
        ...f.components,
        {
          part_id:   part.id,
          part_name: part.name,
          unit:      part.unit || 'pc',
          quantity:  1,
          unit_cost: part.cost_price || 0,
        },
      ],
    }));
    setPartSearch('');
    setShowPartDrop(false);
  }

  function updateComp(idx, field, val) {
    setForm(f => ({
      ...f,
      components: f.components.map((c, i) =>
        i === idx ? { ...c, [field]: field === 'quantity' || field === 'unit_cost' ? Number(val) : val } : c
      ),
    }));
  }

  function removeComp(idx) {
    setForm(f => ({ ...f, components: f.components.filter((_, i) => i !== idx) }));
  }

  // Auto-compute selling price from margin%
  function applyMargin() {
    const pct = Number(form.profit_margin_pct || 0);
    if (formCostPerUnit > 0 && pct > 0) {
      setForm(f => ({ ...f, selling_price: String(Math.ceil(formCostPerUnit * (1 + pct / 100))) }));
    }
  }

  // ── save ─────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.name.trim()) { toast.error('Product name is required'); return; }
    setSub(true);
    try {
      const payload = {
        name:              form.name.trim(),
        description:       form.description.trim(),
        category:          form.category.trim(),
        labor_cost:        Number(form.labor_cost     || 0),
        transport_cost:    Number(form.transport_cost || 0),
        profit_margin_pct: Number(form.profit_margin_pct || 0),
        selling_price:     Number(form.selling_price  || 0),
        stock:             Number(form.stock          || 0),
        allocated_units:   Number(form.allocated_units ?? 0),
        components:        form.components,
      };

      if (dialog.mode === 'add') {
        const res = await mfgCreateProduct(payload);
        // Re-fetch to get computed fields (buildable, etc.)
        const fresh = await mfgGetProducts();
        setProducts(fresh.products || []);
        toast.success('Product created');
      } else {
        await mfgUpdateProduct(dialog.product.id, payload);
        const fresh = await mfgGetProducts();
        setProducts(fresh.products || []);
        toast.success('Product updated');
      }
      setDialog({ open: false, mode: 'add', product: null });
    } catch (err) {
      toast.error(err.message || 'Failed to save product');
    } finally {
      setSub(false);
    }
  }

  // ── delete ───────────────────────────────────────────────────────────────────
  async function handleDelete() {
    setSub(true);
    try {
      await mfgDeleteProduct(deleteDialog.product.id);
      setProducts(prev => prev.filter(p => p.id !== deleteDialog.product.id));
      toast.success('Product deleted');
      setDel({ open: false, product: null });
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setSub(false);
    }
  }

  // ── part selector dropdown ────────────────────────────────────────────────────
  const filteredParts = useMemo(() => {
    const q = partSearch.toLowerCase();
    return parts.filter(p =>
      (!q || p.name.toLowerCase().includes(q)) &&
      !form.components.some(c => String(c.part_id) === String(p.id))
    );
  }, [parts, partSearch, form.components]);

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-56px)] overflow-y-auto">

      {/* Header */}
      <div className="px-6 py-5 border-b bg-background">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
              <Package2 size={20} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Products (Air Coolers)</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Define cooler models as a recipe of parts — sellable stock is calculated automatically
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                <strong className="text-foreground">{products.length}</strong> model{products.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={fetchAll} disabled={loading}>
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </Button>
            <Button
              size="sm"
              onClick={openAdd}
              className="gap-1.5"
              style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
            >
              <Plus size={13} /> New Product
            </Button>
          </div>
        </div>

        {products.length > 0 && (
          <div className="mt-4 relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X size={13} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-400">
          <AlertCircle size={13} /> {error}
          <Button size="sm" variant="ghost" className="ml-auto h-5 px-2 text-xs" onClick={fetchAll}>Retry</Button>
        </div>
      )}

      {/* Product grid */}
      <div className="p-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2].map(i => (
              <div key={i} className="rounded-xl border p-5 space-y-3 animate-pulse">
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="h-3 w-20 rounded bg-muted" />
                <div className="space-y-2 mt-4">
                  {[1,2,3,4].map(j => <div key={j} className="h-3 rounded bg-muted" />)}
                </div>
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-56 gap-3 text-muted-foreground text-sm">
            <Package2 size={36} className="opacity-25" />
            {search
              ? `No products match "${search}"`
              : 'No product models yet. Create your first cooler model.'}
            {!search && (
              <Button size="sm" onClick={openAdd} className="gap-1.5 mt-1">
                <Plus size={12} /> New Product
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayed.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onEdit={() => openEdit(product)}
                onDelete={() => setDel({ open: true, product })}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Add/Edit Dialog ── */}
      <Dialog open={dialog.open} onOpenChange={v => setDialog(d => ({ ...d, open: v }))}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package2 size={16} className="text-blue-500" />
              {dialog.mode === 'add' ? 'New Product (Air Cooler)' : `Edit — ${dialog.product?.name}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">

            {/* ── Basic info ── */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Basic Info</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Product Name <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="e.g. Air Cooler 12-inch"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="h-9 text-sm"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Category</Label>
                  <Input
                    placeholder="Optional"
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Input
                    placeholder="Optional"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* ── Bill of Materials ── */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Boxes size={12} /> Bill of Materials (Components)
              </h3>

              {form.components.length > 0 && (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-xs text-muted-foreground">
                        <th className="px-3 py-2 text-left">Part</th>
                        <th className="px-3 py-2 text-center w-20">Qty</th>
                        <th className="px-3 py-2 text-right w-24">Unit Cost</th>
                        <th className="px-3 py-2 text-right w-24">Line Cost</th>
                        <th className="w-8 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {form.components.map((comp, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">
                            <div className="font-medium">{comp.part_name}</div>
                            <div className="text-xs text-muted-foreground">{comp.unit}</div>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number" min="0.01" step="0.01"
                              value={comp.quantity}
                              onChange={e => updateComp(i, 'quantity', e.target.value)}
                              className="w-full h-7 rounded border bg-background px-2 text-center text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number" min="0"
                              value={comp.unit_cost}
                              onChange={e => updateComp(i, 'unit_cost', e.target.value)}
                              className="w-full h-7 rounded border bg-background px-2 text-right text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums text-indigo-600">
                            {Rs(comp.quantity * comp.unit_cost)}
                          </td>
                          <td className="pr-2 py-2">
                            <button onClick={() => removeComp(i)} className="text-muted-foreground hover:text-red-500 transition-colors">
                              <X size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t bg-muted/20">
                        <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-muted-foreground">Material Cost</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums">{Rs(formMaterialCost)}</td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Part selector */}
              <div className="relative">
                <div
                  className="flex items-center gap-2 h-9 rounded-lg border bg-background px-3 cursor-text"
                  onClick={() => setShowPartDrop(true)}
                >
                  <Plus size={13} className="text-muted-foreground shrink-0" />
                  <input
                    placeholder="Search parts to add to recipe…"
                    value={partSearch}
                    onChange={e => { setPartSearch(e.target.value); setShowPartDrop(true); }}
                    onFocus={() => setShowPartDrop(true)}
                    className="flex-1 text-sm bg-transparent focus:outline-none"
                  />
                </div>
                {showPartDrop && filteredParts.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-lg border bg-popover shadow-lg max-h-48 overflow-y-auto">
                    {filteredParts.map(p => (
                      <button
                        key={p.id}
                        onClick={() => addComponent(p)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 text-sm text-left"
                      >
                        <span className="font-medium">{p.name}</span>
                        <span className="text-xs text-muted-foreground">
                          Stock: {p.stock} {p.unit} · {Rs(p.cost_price)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {showPartDrop && (
                  <div className="fixed inset-0 z-40" onClick={() => setShowPartDrop(false)} />
                )}
              </div>

              {parts.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No parts synced yet. Add parts in Parts Inventory first.
                </p>
              )}
            </div>

            {/* ── Costs ── */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Wrench size={12} /> Additional Costs (per unit)
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Wrench size={10} /> Labor Cost (Rs.)</Label>
                  <Input
                    type="number" min="0" placeholder="0"
                    value={form.labor_cost}
                    onChange={e => setForm(f => ({ ...f, labor_cost: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Truck size={10} /> Transport / Bilty (Rs.)</Label>
                  <Input
                    type="number" min="0" placeholder="0"
                    value={form.transport_cost}
                    onChange={e => setForm(f => ({ ...f, transport_cost: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {/* Cost preview */}
              {formCostPerUnit > 0 && (
                <div className="rounded-lg bg-muted/40 px-4 py-3 space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Material</span><span className="tabular-nums">{Rs(formMaterialCost)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Labor</span><span className="tabular-nums">{Rs(formLaborCost)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Transport</span><span className="tabular-nums">{Rs(formTransportCost)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1.5 mt-1">
                    <span>Cost / Unit</span><span className="tabular-nums">{Rs(formCostPerUnit)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Pricing ── */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <DollarSign size={12} /> Pricing
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Profit Margin %</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number" min="0" placeholder="0"
                      value={form.profit_margin_pct}
                      onChange={e => setForm(f => ({ ...f, profit_margin_pct: e.target.value }))}
                      className="h-9 text-sm"
                    />
                    <Button size="sm" variant="outline" className="h-9 px-3 shrink-0" onClick={applyMargin} title="Apply margin to selling price">
                      Apply
                    </Button>
                  </div>
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
              {formSellingPrice > 0 && formCostPerUnit > 0 && (
                <p className={`text-xs ${formMarginAmt >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  Margin: {Rs(formMarginAmt)} ({formMarginPct}%)
                  {formMarginAmt < 0 && ' — selling below cost!'}
                </p>
              )}
            </div>

            {/* ── Stock / Allocation ── */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Stock & Allocation
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Pre-built Stock</Label>
                  <Input
                    type="number" min="0" placeholder="0"
                    value={form.stock}
                    onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                    className="h-9 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Already assembled units in warehouse</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Allocated Units</Label>
                  <Input
                    type="number" min="0" placeholder="0"
                    value={form.allocated_units}
                    onChange={e => setForm(f => ({ ...f, allocated_units: e.target.value }))}
                    className="h-9 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Cap on units committed for sale (0 = none available)</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialog(d => ({ ...d, open: false }))} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={submitting || !form.name.trim()}
              style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
              className="gap-2"
            >
              {submitting
                ? <><RefreshCw size={13} className="animate-spin" /> Saving…</>
                : <><CheckCircle2 size={14} /> {dialog.mode === 'add' ? 'Create Product' : 'Save Changes'}</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete dialog ── */}
      <Dialog open={deleteDialog.open} onOpenChange={v => setDel(d => ({ ...d, open: v }))}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 size={16} /> Delete Product
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Delete <strong className="text-foreground">{deleteDialog.product?.name}</strong>?
            This pushes a delete sync event — the product will disappear from the cloud.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDel({ open: false, product: null })} disabled={submitting}>Cancel</Button>
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

/* ── Product Card ─────────────────────────────────────────────────────────────── */
function ProductCard({ product, onEdit, onDelete }) {
  const hasComponents = product.components && product.components.length > 0;
  const availableToSell = product.available_to_sell ?? 0;
  const moreBuildable   = product.more_buildable   ?? 0;
  const allocatedUnits  = product.allocated_units  ?? 0;

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4 hover:shadow-sm transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-base truncate">{product.name}</h3>
          <p className="text-sm text-muted-foreground truncate">
            {product.category || product.description || 'none'}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Cost breakdown */}
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Material Cost</span>
          <span className="tabular-nums">{Rs(product.material_cost)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Labor Cost</span>
          <span className="tabular-nums">{Rs(product.labor_cost)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Transport Cost</span>
          <span className="tabular-nums">{Rs(product.transport_cost)}</span>
        </div>
      </div>

      {/* Key metrics */}
      <div className="space-y-1.5 text-sm border-t pt-3">
        <div className="flex justify-between font-semibold">
          <span>Cost / Unit</span>
          <span className="tabular-nums">{Rs(product.cost_per_unit)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span className="text-emerald-600 dark:text-emerald-400">Selling Price</span>
          <span className="tabular-nums text-emerald-600 dark:text-emerald-400">{Rs(product.selling_price)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Available to Sell</span>
          <span className={`font-bold tabular-nums ${availableToSell === 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {availableToSell} unit{availableToSell !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Buildable note */}
      <div className="text-xs text-muted-foreground">
        {hasComponents ? (
          <span>
            Allocated: <strong className="text-foreground">{allocatedUnits}</strong>
            {moreBuildable > 0 && (
              <> · <span className="text-amber-600 font-medium">{moreBuildable} more buildable</span> if you raise the allocation</>
            )}
          </span>
        ) : (
          <span className="italic">No BOM — add components to see buildable count</span>
        )}
      </div>

      {/* Components mini list (collapsed) */}
      {hasComponents && (
        <ComponentsList components={product.components} />
      )}
    </div>
  );
}

function ComponentsList({ components }) {
  const [expanded, setExpanded] = useState(false);
  const SHOW = 2;
  const visible = expanded ? components : components.slice(0, SHOW);

  return (
    <div className="border-t pt-3 space-y-1">
      <button
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <Boxes size={11} />
        {components.length} component{components.length !== 1 ? 's' : ''}
        {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>
      {expanded && (
        <div className="space-y-1 mt-1">
          {visible.map((c, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{c.part_name}</span>
              <span className="tabular-nums">{c.quantity} {c.unit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
