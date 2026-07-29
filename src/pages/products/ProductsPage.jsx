import React, { useMemo, useRef, useState } from 'react';
import { usePagination } from '../../hooks/usePagination';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import JsBarcode from 'jsbarcode';
import {
  Plus, Pencil, Trash2, Search, Package, Layers, BarChart2,
  TrendingUp, TrendingDown, AlertCircle, X, Upload, Download,
  FileSpreadsheet, CheckCircle2, ChevronDown, ChevronRight,
  Archive, Eye, ShoppingCart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../utils/format';

// ─── Format helper ────────────────────────────────────────────────────────────
const fmtPKR = (n) => 'PKR ' + Math.round(n ?? 0).toLocaleString('en-PK');

// ─── Fade-up animation ───────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.4, delay: Math.min(i, 5) * 0.055, ease: [0.23, 1, 0.32, 1] },
  }),
};

// ─── Sparkline ───────────────────────────────────────────────────────────────
const SPARKLINE_PATH = 'M0,14 L8,10 L16,16 L24,6 L32,12 L40,4 L48,10 L56,2';
function Sparkline({ color }) {
  return (
    <svg width="56" height="20" viewBox="0 0 56 20" fill="none" className="shrink-0">
      <path d={SPARKLINE_PATH} stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── KPI Stat Card ────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, tint }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', tint.bg)}>
          <Icon size={18} className={tint.icon} />
        </div>
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

// ─── Excel Import field definitions ──────────────────────────────────────────
const IMPORTABLE_FIELDS = [
  { key: 'name', label: 'Product Name ✱' },
  { key: 'price', label: 'Selling Price ✱' },
  { key: 'purchase_price', label: 'Purchase / Cost Price' },
  { key: 'stock', label: 'Stock / Quantity' },
  { key: 'category', label: 'Category' },
  { key: 'barcode', label: 'Barcode / SKU' },
  { key: 'unit', label: 'Unit (pcs, kg…)' },
];

const FIELD_ALIASES = {
  name: ['name', 'product name', 'item name', 'product', 'title', 'item', 'naam'],
  price: ['price', 'selling price', 'sale price', 'retail price', 'mrp', 'rate', 'sp'],
  purchase_price: ['purchase price', 'cost', 'cost price', 'buy price', 'cp', 'pp', 'purchase_price'],
  stock: ['stock', 'quantity', 'qty', 'inventory', 'units', 'pieces', 'pcs', 'count', 'available'],
  category: ['category', 'cat', 'type', 'group', 'department', 'section'],
  barcode: ['barcode', 'sku', 'code', 'product code', 'item code', 'upc', 'ean'],
  unit: ['unit', 'uom', 'unit of measure', 'measure', 'pack'],
};

function autoDetectMapping(headers) {
  const result = {};
  const usedFields = new Set();
  for (const header of headers) {
    const norm = header.toLowerCase().trim().replace(/[-_/]/g, ' ');
    let bestField = '__skip__';
    let bestScore = 0;
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (usedFields.has(field)) continue;
      for (const alias of aliases) {
        if (norm === alias) { bestField = field; bestScore = 3; break; }
        if (norm.includes(alias) || alias.includes(norm)) { if (2 > bestScore) { bestField = field; bestScore = 2; } }
      }
      if (bestScore === 3) break;
    }
    result[header] = bestField;
    if (bestField !== '__skip__') usedFields.add(bestField);
  }
  return result;
}

// ─── Product Form Modal ───────────────────────────────────────────────────────
function ProductFormModal({ isOpen, isEditing, initialProduct, vendors, categories, onClose, onSaved }) {
  const { pushEntity } = useDataStore();
  const { showToast } = useToast();
  const [current, setCurrent] = useState(initialProduct);
  const [isSaving, setIsSaving] = useState(false);
  const [marginInput, setMarginInput] = useState('');
  const [stockStr, setStockStr] = useState('');
  const [showBarcode2, setShowBarcode2] = useState(false);
  const nameRef = useRef(null);

  React.useEffect(() => {
    if (isOpen) {
      setCurrent({ ...initialProduct });
      setShowBarcode2(!!(initialProduct.barcode2));
      setIsSaving(false);
      setMarginInput('');
      setStockStr(isEditing && (initialProduct.stock ?? 0) !== 0 ? String(initialProduct.stock) : '');
      setTimeout(() => nameRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!current.name?.trim()) { showToast('Product name is required', 'error'); nameRef.current?.focus(); return; }
    const price = Number(current.price);
    if (isNaN(price) || price <= 0) { showToast('Selling price must be a positive number', 'error'); return; }
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const data = {
        name: current.name.trim(),
        price,
        purchase_price: Number(current.purchase_price) || 0,
        stock: isEditing ? current.stock : (Number(current.stock) || 0),
        category: (current.category || '').trim(),
        barcode: (current.barcode || '').trim(),
        barcode2: (current.barcode2 || '').trim(),
        unit: (current.unit || '').trim(),
        description: (current.description || '').trim(),
        vendor_id: current.vendor_id || null,
        metadata: current.metadata || {},
      };
      if (isEditing && current.id) {
        await pushEntity('product', 'update', { ...current, ...data, id: current.id, updated_at: now });
        showToast('Product updated');
      } else {
        await pushEntity('product', 'create', { ...data, created_at: now, updated_at: now });
        showToast('Product added');
      }
      onClose();
      onSaved();
    } catch (err) {
      showToast(err.message || 'Failed to save product', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex items-start justify-center p-4 sm:p-8 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={() => !isSaving && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        className="relative w-full max-w-lg my-auto bg-card rounded-2xl shadow-2xl border border-border/50 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="relative p-6 border-b" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1a3a5c 100%)' }}>
            <div className="pointer-events-none absolute top-0 right-0 w-32 h-32 rounded-full bg-blue-500/10 blur-2xl" />
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500/20 border border-blue-400/30 p-2.5 rounded-xl">
                  <Package size={19} className="text-blue-300" />
                </div>
                <div>
                  <h2 className="text-white text-lg font-bold">{isEditing ? 'Edit Product' : 'Add New Product'}</h2>
                  <p className="text-blue-300/70 text-xs mt-0.5">
                    {isEditing ? 'Update product details below.' : 'Fill in details to add to catalogue.'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="text-white/50 hover:text-white/90 transition-colors p-1 rounded-lg hover:bg-white/10">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="space-y-5 pt-6 pb-1 px-6 max-h-[65vh] overflow-y-auto">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Product Name <span className="text-destructive">*</span></label>
              <input
                ref={nameRef}
                required
                value={current.name || ''}
                onChange={(e) => setCurrent((p) => ({ ...p, name: e.target.value }))}
                placeholder="Enter product name"
                disabled={isSaving}
                className="w-full h-10 px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Prices */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Cost / Purchase Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">PKR</span>
                  <input
                    type="number" min="0" step="1"
                    value={current.purchase_price || ''}
                    onChange={(e) => setCurrent((p) => ({ ...p, purchase_price: parseFloat(e.target.value) || 0 }))}
                    placeholder="0" className="w-full h-10 pl-11 pr-3 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    disabled={isSaving}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Selling Price <span className="text-destructive">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">PKR</span>
                  <input
                    type="number" min="1" step="1" required
                    value={current.price || ''}
                    onChange={(e) => setCurrent((p) => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
                    placeholder="0" className="w-full h-10 pl-11 pr-3 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    disabled={isSaving}
                  />
                </div>
              </div>
            </div>

            {/* Margin calculator */}
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Margin % <span className="font-normal">(optional)</span></label>
                <div className="relative">
                  <input
                    type="number" min="0" max="100" step="0.1"
                    value={marginInput}
                    onChange={(e) => {
                      const pct = e.target.value;
                      setMarginInput(pct);
                      const m = parseFloat(pct);
                      if (isNaN(m) || m < 0 || m >= 100) return;
                      setCurrent((p) => {
                        if (p.price > 0 && !(p.purchase_price > 0)) return { ...p, purchase_price: Math.round(p.price * (1 - m / 100)) };
                        if (p.purchase_price > 0 && !(p.price > 0)) return { ...p, price: Math.round(p.purchase_price / (1 - m / 100)) };
                        return p;
                      });
                    }}
                    placeholder="e.g. 30"
                    className="w-full h-10 px-3 pr-8 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    disabled={isSaving}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">%</span>
                </div>
              </div>
              {current.purchase_price > 0 && current.price > 0 && (
                <div className={cn(
                  'flex-[2] text-xs px-3 py-2.5 rounded-xl border font-medium self-end',
                  current.price > current.purchase_price
                    ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-600'
                    : 'bg-destructive/8 border-destructive/20 text-destructive'
                )}>
                  {current.price > current.purchase_price
                    ? `✓ Margin: ${(((current.price - current.purchase_price) / current.price) * 100).toFixed(1)}% — PKR ${Math.round(current.price - current.purchase_price).toLocaleString('en-PK')}/unit`
                    : '⚠ Selling price is BELOW cost price!'}
                </div>
              )}
            </div>

            {/* Stock + Unit */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">{isEditing ? 'Stock' : 'Opening Stock'}</label>
                <input
                  type="number" min="0" step="1"
                  value={isEditing ? (current.stock ?? '') : stockStr}
                  onChange={(e) => {
                    if (isEditing) setCurrent((p) => ({ ...p, stock: parseInt(e.target.value) || 0 }));
                    else { setStockStr(e.target.value); setCurrent((p) => ({ ...p, stock: parseInt(e.target.value) || 0 })); }
                  }}
                  placeholder="0" disabled={isSaving}
                  className="w-full h-10 px-3 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Unit of Measure</label>
                <select
                  className="w-full h-10 px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none"
                  value={current.unit || ''}
                  onChange={(e) => setCurrent((p) => ({ ...p, unit: e.target.value }))}
                  disabled={isSaving}
                >
                  <option value="">— select —</option>
                  <option value="pcs">pcs</option>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="box">box</option>
                  <option value="set">set</option>
                  <option value="roll">roll</option>
                  <option value="metre">metre</option>
                  <option value="litre">litre</option>
                  <option value="ml">ml</option>
                  <option value="pack">pack</option>
                  <option value="dozen">dozen</option>
                  <option value="strip">strip</option>
                  <option value="bottle">bottle</option>
                </select>
              </div>
            </div>

            {/* Category + Barcode */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Category</label>
                <input
                  type="text" value={current.category || ''}
                  onChange={(e) => setCurrent((p) => ({ ...p, category: e.target.value }))}
                  placeholder="e.g. Dry Goods" list="cat-list" disabled={isSaving}
                  className="w-full h-10 px-3 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <datalist id="cat-list">
                  {categories.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold">Barcode / SKU</label>
                  {!showBarcode2 && (
                    <button type="button" onClick={() => setShowBarcode2(true)} className="text-[10px] text-primary hover:underline font-medium">
                      + Alt barcode
                    </button>
                  )}
                </div>
                <input
                  type="text" value={current.barcode || ''}
                  onChange={(e) => setCurrent((p) => ({ ...p, barcode: e.target.value }))}
                  placeholder="Scan or type" disabled={isSaving}
                  className="w-full h-10 px-3 text-sm font-mono rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                {showBarcode2 && (
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-muted-foreground">Alternate Barcode</label>
                      <button type="button" onClick={() => { setShowBarcode2(false); setCurrent((p) => ({ ...p, barcode2: '' })); }} className="text-[10px] text-muted-foreground hover:text-destructive">remove</button>
                    </div>
                    <input
                      type="text" value={current.barcode2 || ''}
                      onChange={(e) => setCurrent((p) => ({ ...p, barcode2: e.target.value }))}
                      placeholder="Alternate barcode" disabled={isSaving} autoFocus
                      className="w-full h-10 px-3 text-sm font-mono rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Vendor */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Preferred Supplier (Optional)</label>
              <select
                className="w-full h-10 px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none"
                value={current.vendor_id || ''}
                onChange={(e) => setCurrent((p) => ({ ...p, vendor_id: e.target.value ? e.target.value : null }))}
                disabled={isSaving}
              >
                <option value="">— None —</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>

            {/* Custom Fields */}
            <div className="space-y-3 pt-2 border-t border-border/40">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Custom Fields (Optional)</div>
                <button
                  type="button" disabled={isSaving}
                  onClick={() => {
                    const list = Array.isArray(current.metadata?.customFields) ? current.metadata.customFields : [];
                    setCurrent((p) => ({ ...p, metadata: { ...p.metadata, customFields: [...list, { id: `${Date.now()}`, name: '', value: '', notes: '' }] } }));
                  }}
                  className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <Plus size={13} /> Add Field
                </button>
              </div>
              {(current.metadata?.customFields || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Add any extra detail as a name/value pair — e.g. "Color: Red".</p>
              ) : (
                <div className="space-y-2">
                  {current.metadata.customFields.map((f) => (
                    <div key={f.id} className="flex items-start gap-2 rounded-xl border border-border/50 p-2.5">
                      <div className="grid grid-cols-2 gap-2 flex-1 min-w-0">
                        <input
                          type="text" value={f.name} placeholder="Field name" disabled={isSaving}
                          onChange={(e) => setCurrent((p) => ({ ...p, metadata: { ...p.metadata, customFields: p.metadata.customFields.map((x) => x.id === f.id ? { ...x, name: e.target.value } : x) } }))}
                          className="h-9 px-3 text-sm rounded-md border border-border bg-background focus:outline-none"
                        />
                        <input
                          type="text" value={f.value} placeholder="Value" disabled={isSaving}
                          onChange={(e) => setCurrent((p) => ({ ...p, metadata: { ...p.metadata, customFields: p.metadata.customFields.map((x) => x.id === f.id ? { ...x, value: e.target.value } : x) } }))}
                          className="h-9 px-3 text-sm rounded-md border border-border bg-background focus:outline-none"
                        />
                        <input
                          type="text" value={f.notes} placeholder="Notes (optional)" disabled={isSaving}
                          onChange={(e) => setCurrent((p) => ({ ...p, metadata: { ...p.metadata, customFields: p.metadata.customFields.map((x) => x.id === f.id ? { ...x, notes: e.target.value } : x) } }))}
                          className="h-9 px-3 text-sm rounded-md border border-border bg-background focus:outline-none col-span-2"
                        />
                      </div>
                      <button
                        type="button" disabled={isSaving}
                        onClick={() => setCurrent((p) => ({ ...p, metadata: { ...p.metadata, customFields: p.metadata.customFields.filter((x) => x.id !== f.id) } }))}
                        className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-border/50 bg-muted/10">
            <button type="button" onClick={onClose} disabled={isSaving} className="h-9 px-4 text-sm rounded-lg border border-border bg-background hover:bg-muted transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="h-9 px-4 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium">
              {isSaving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Product'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  );
}

// ─── Product Detail Modal ─────────────────────────────────────────────────────
const STOCK_HISTORY_LABELS = {
  sale: 'Sold',
  purchase: 'Stock In (Purchase)',
  return: 'Return (Stock Restored)',
  sale_return: 'Sale Return',
  adjustment: 'Manual Adjustment',
};

function ProductDetailModal({ product, onClose }) {
  const { list } = useDataStore();
  const barcodeRef = useRef(null);
  const barcode = product.barcode || product.barcode2 || '';

  const margin = product.purchase_price > 0
    ? (((product.price - product.purchase_price) / product.price) * 100).toFixed(0)
    : null;

  // Render barcode SVG
  React.useEffect(() => {
    if (barcode && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, barcode, {
          format: 'CODE128', lineColor: '#000', background: 'transparent',
          width: 2, height: 60, displayValue: false, margin: 8,
        });
      } catch (_) {}
    }
  }, [barcode]);

  // Build stock history from sale_items and purchase_items
  const stockHistory = useMemo(() => {
    const pid = String(product.id);
    const events = [];
    const sales = list('sale');
    const saleMap = Object.fromEntries(sales.map((s) => [String(s.id), s]));

    list('sale_item')
      .filter((si) => String(si.product_id) === pid)
      .forEach((si) => {
        const sale = saleMap[String(si.sale_id)];
        if (sale?.status === 'cancelled') return;
        events.push({ type: 'sale', amount: -Number(si.quantity || 0), createdAt: sale?.date_created || '' });
      });

    const purchases = list('purchase');
    const purchaseMap = Object.fromEntries(purchases.map((p) => [String(p.id), p]));
    list('purchase_item')
      .filter((pi) => String(pi.product_id) === pid)
      .forEach((pi) => {
        const po = purchaseMap[String(pi.purchase_id)];
        if (po?.status === 'received' || po?.status === 'paid') {
          events.push({ type: 'purchase', amount: Number(pi.quantity || 0), createdAt: po?.date_created || '' });
        }
      });

    list('sale_return_item')
      .filter((ri) => String(ri.product_id) === pid)
      .forEach((ri) => {
        events.push({ type: 'sale_return', amount: Number(ri.quantity || 0), createdAt: ri.date_created || '' });
      });

    return events.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);
  }, [product.id]);

  const detailRows = [
    ['Unit', product.unit],
    ['Category', product.category],
    ['Barcode', product.barcode],
  ].filter(([, v]) => !!v);

  if (Array.isArray(product.metadata?.customFields)) {
    product.metadata.customFields.filter((f) => f.name || f.value).forEach((f) => {
      detailRows.push([f.name || '—', f.value + (f.notes ? ` (${f.notes})` : '')]);
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.15 }}
        className="relative z-10 bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-border/50 shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            <h2 className="text-xl font-bold leading-tight truncate">{product.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">{product.category || 'No category'}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Price / stock grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-emerald-600 p-3.5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-white/90 mb-1.5">Sale Price</p>
              <p className="text-2xl font-black text-white tabular-nums">Rs {(product.price ?? 0).toLocaleString()}</p>
            </div>
            <div className="rounded-xl bg-muted/30 border border-border/40 p-3.5">
              <p className="text-xs font-bold uppercase tracking-wide text-foreground/70 mb-1.5">Purchase Price</p>
              <p className="text-2xl font-black tabular-nums">
                {product.purchase_price > 0 ? `Rs ${product.purchase_price.toLocaleString()}` : '—'}
              </p>
            </div>
            <div className="rounded-xl bg-muted/30 border border-border/40 p-3.5">
              <p className="text-xs font-bold uppercase tracking-wide text-foreground/70 mb-1.5">Stock</p>
              <p className="text-2xl font-black tabular-nums">
                {product.stock ?? 0}
                <span className="text-sm font-normal text-muted-foreground ml-1">{product.unit || 'pcs'}</span>
              </p>
            </div>
            {margin !== null && (
              <div className="rounded-xl bg-blue-600 p-3.5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-white/90 mb-1.5">Margin</p>
                <p className="text-2xl font-black text-white tabular-nums">{margin}%</p>
              </div>
            )}
          </div>

          {/* Detail rows */}
          {detailRows.length > 0 && (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              {detailRows.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between px-4 py-3 text-sm odd:bg-muted/20 even:bg-transparent border-b border-border/20 last:border-0">
                  <span className="text-xs uppercase tracking-wide font-bold text-foreground/70 w-32 shrink-0">{label}</span>
                  <span className="font-semibold text-right">{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Barcode */}
          <div className="rounded-xl border border-border/50 bg-white dark:bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-muted/10">
              <p className="text-xs font-bold uppercase tracking-wide text-foreground/70">Barcode</p>
              {barcode && <span className="font-mono text-base font-bold tracking-wider">{barcode}</span>}
            </div>
            <div className="p-4 flex justify-center bg-white dark:bg-neutral-900 min-h-[80px]">
              {barcode ? (
                <svg ref={barcodeRef} className="max-w-full" />
              ) : (
                <p className="text-sm text-muted-foreground self-center">No barcode assigned</p>
              )}
            </div>
          </div>

          {/* Stock History */}
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/30 bg-muted/10">
              <p className="text-xs font-bold uppercase tracking-wide text-foreground/70">Stock History</p>
            </div>
            <div className="max-h-56 overflow-y-auto divide-y divide-border/20">
              {stockHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No recorded stock changes yet.</p>
              ) : stockHistory.map((h, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{STOCK_HISTORY_LABELS[h.type] || h.type}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {h.createdAt ? new Date(h.createdAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                    </p>
                  </div>
                  <span className={cn('font-mono font-bold text-base shrink-0 ml-2', h.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                    {h.amount >= 0 ? '+' : ''}{h.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border/50 bg-muted/10 shrink-0">
          <button type="button" onClick={onClose} className="h-8 px-4 text-xs rounded-lg border border-border bg-background hover:bg-muted transition-colors">
            Close
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

// ─── Main Products Page ───────────────────────────────────────────────────────
export default function ProductsPage() {
  const { list, pushEntity } = useDataStore();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [initialProduct, setInitialProduct] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [viewProduct, setViewProduct] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Import state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importPhase, setImportPhase] = useState('upload');
  const [importRawHeaders, setImportRawHeaders] = useState([]);
  const [importRawRows, setImportRawRows] = useState([]);
  const [importColumnMap, setImportColumnMap] = useState({});
  const [importRows, setImportRows] = useState([]);
  const [importProgress, setImportProgress] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const importFileInputRef = useRef(null);

  const products = list('product');
  const vendors = list('vendor');
  const saleItems = list('sale_item');
  const sales = list('sale');
  const purchaseItems = list('purchase_item');

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(),
    [products]
  );

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name?.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)
    );
  }, [products, searchTerm]);

  const { paged: pagedProducts, page: prodPage, pageCount: prodPageCount, setPage: setProdPage } = usePagination(filtered, 50);

  // Grouped by category (from current page only)
  const grouped = useMemo(() => {
    return pagedProducts.reduce((acc, p) => {
      const cat = p.category || 'Uncategorized';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {});
  }, [pagedProducts]);

  // KPI stats
  const stats = useMemo(() => {
    const LOW = 10;
    return {
      total: products.length,
      categories: categories.length,
      totalStock: products.reduce((s, p) => {
        const st = Math.max(0, p.stock || 0);
        return s + (p.unit_type === 'gram' ? st / 1000 : st);
      }, 0),
      lowStock: products.filter((p) => (p.stock || 0) > 0 && (p.stock || 0) <= LOW).length,
      negativeStock: products.filter((p) => (p.stock || 0) < 0).length,
    };
  }, [products, categories]);

  // Analytics (computed lazily when analytics section is opened)
  const analytics = useMemo(() => {
    if (!showAnalytics || !products.length) return null;
    const completedSaleIds = new Set(
      sales.filter((s) => s.status !== 'cancelled').map((s) => String(s.id))
    );
    const saleMap = Object.fromEntries(sales.map((s) => [String(s.id), s]));

    const productSales = {};
    saleItems
      .filter((si) => completedSaleIds.has(String(si.sale_id)))
      .forEach((si) => {
        const pid = String(si.product_id);
        if (!productSales[pid]) productSales[pid] = { qty: 0, profit: 0 };
        const qty = Number(si.quantity || 0);
        const profit = qty * (Number(si.price || 0) - Number(si.purchase_price || 0));
        productSales[pid].qty += qty;
        productSales[pid].profit += profit;
      });

    const stockQty = (p) => {
      const isGram = p.unit_type === 'gram';
      const raw = Math.max(0, p.stock || 0);
      return isGram ? Math.min(raw, 100_000_000) / 1000 : Math.min(raw, 1_000_000);
    };
    const productVal = (p) => Math.min(stockQty(p) * Math.min(p.purchase_price || 0, p.price || 0, 500_000), 5_000_000);
    const productRetail = (p) => Math.min(stockQty(p) * Math.min(p.price || 0, 500_000), 5_000_000);
    const totalStockValue = products.reduce((s, p) => s + productVal(p), 0);
    const totalRetailValue = products.reduce((s, p) => s + productRetail(p), 0);
    const totalProfit = Object.values(productSales).reduce((s, v) => s + v.profit, 0);

    const topProfitable = [...products]
      .filter((p) => productSales[String(p.id)])
      .sort((a, b) => (productSales[String(b.id)]?.profit || 0) - (productSales[String(a.id)]?.profit || 0))
      .slice(0, 10)
      .map((p) => ({ ...p, total_sold: productSales[String(p.id)]?.qty || 0, total_profit: productSales[String(p.id)]?.profit || 0 }));

    const slowMovers = products.filter((p) => !productSales[String(p.id)] || productSales[String(p.id)].qty === 0);
    const negativeStock = products.filter((p) => (p.stock || 0) < 0).sort((a, b) => (a.stock || 0) - (b.stock || 0));
    const outOfStock = products.filter((p) => (p.stock || 0) === 0);

    const categoryBreakdown = Object.entries(
      products.reduce((acc, p) => {
        const cat = p.category || 'Uncategorized';
        if (!acc[cat]) acc[cat] = { value: 0, retail: 0, count: 0 };
        acc[cat].value += productVal(p);
        acc[cat].retail += productRetail(p);
        acc[cat].count++;
        return acc;
      }, {})
    ).map(([category, data]) => ({ category, ...data }));

    return {
      totalStockValue, totalRetailValue, totalProfit,
      topProfitable,
      slowMoversCount: slowMovers.length, slowMovers: slowMovers.slice(0, 30),
      negativeStockCount: negativeStock.length, negativeStock: negativeStock.slice(0, 30),
      outOfStockCount: outOfStock.length, outOfStock: outOfStock.slice(0, 30),
      categoryBreakdown,
    };
  }, [showAnalytics, products, saleItems, sales]);

  const openAdd = () => { setInitialProduct({ metadata: {} }); setIsEditing(false); setShowDialog(true); };
  const openEdit = (p) => { setInitialProduct({ ...p }); setIsEditing(true); setShowDialog(true); };

  const margin = (p) => {
    if (!p.purchase_price || p.purchase_price <= 0) return null;
    return (((p.price - p.purchase_price) / p.price) * 100).toFixed(0);
  };

  const handleDelete = async (id) => {
    if (!id) return;
    try {
      await pushEntity('product', 'delete', { id });
      showToast('Product deleted');
      setDeleteConfirmId(null);
    } catch (err) {
      showToast(err.message || 'Failed to delete', 'error');
      setDeleteConfirmId(null);
    }
  };

  // ── Excel Export ──────────────────────────────────────────────────────────
  const exportToExcel = () => {
    if (products.length === 0) { showToast('No products to export', 'error'); return; }
    const data = products.map((p) => ({
      Name: p.name,
      Category: p.category || '',
      'Barcode/SKU': p.barcode || '',
      Unit: p.unit || '',
      'Cost Price (PKR)': p.purchase_price || 0,
      'Selling Price (PKR)': p.price,
      Stock: p.stock ?? 0,
      'Margin (%)': p.purchase_price > 0 ? Number((((p.price - p.purchase_price) / p.price) * 100).toFixed(1)) : '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 18 }, { wch: 20 }, { wch: 10 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `products_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`${data.length} products exported`);
  };

  const downloadTemplate = () => {
    const template = [{ name: 'Sample Product', purchase_price: 100, price: 150, stock: 50, category: 'General', barcode: '1234567890', unit: 'pcs' }];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Import Template');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'products_import_template.xlsx';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Excel Import ──────────────────────────────────────────────────────────
  const resetImport = () => {
    setImportPhase('upload'); setImportRawHeaders([]); setImportRawRows([]);
    setImportColumnMap({}); setImportRows([]); setImportProgress(null);
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!raw.length) { showToast('No data rows found in the file', 'error'); return; }
        const headers = Object.keys(raw[0]);
        setImportRawHeaders(headers);
        setImportRawRows(raw);
        setImportColumnMap(autoDetectMapping(headers));
        setImportPhase('mapping');
      } catch (_) { showToast('Could not read file. Ensure it is a valid .xlsx format', 'error'); }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const applyColumnMapAndPreview = () => {
    const parsed = importRawRows.map((rawRow) => {
      const mapped = {};
      for (const [header, field] of Object.entries(importColumnMap)) {
        if (field !== '__skip__') mapped[field] = rawRow[header];
      }
      const errors = [];
      const name = String(mapped.name ?? '').trim();
      const price = parseFloat(String(mapped.price ?? '0')) || 0;
      const purchase_price = parseFloat(String(mapped.purchase_price ?? '0')) || 0;
      const stock = parseInt(String(mapped.stock ?? '0')) || 0;
      const category = String(mapped.category ?? '').trim();
      const barcode = String(mapped.barcode ?? '').trim();
      const unit = String(mapped.unit ?? '').trim();
      if (!name) errors.push('Name required');
      if (price <= 0) errors.push('Price must be > 0');
      const existingByBarcode = barcode ? products.find((p) => p.barcode === barcode) : null;
      const existingByName = products.find((p) => p.name?.toLowerCase() === name.toLowerCase());
      const existing = existingByBarcode || existingByName;
      return { name, price, purchase_price, stock, category, barcode, unit, _valid: errors.length === 0, _errors: errors, _isUpdate: !!existing, _existingId: existing?.id };
    }).filter((r) => r.name !== '');
    setImportRows(parsed);
    setImportPhase('preview');
  };

  const executeImport = async () => {
    const validRows = importRows.filter((r) => r._valid);
    if (!validRows.length) return;
    setIsImporting(true); setImportPhase('progress');
    setImportProgress({ done: 0, total: validRows.length, errors: [] });
    const errors = [];
    let done = 0;
    const now = new Date().toISOString();
    for (const row of validRows) {
      try {
        if (row._isUpdate && row._existingId) {
          const existing = products.find((p) => String(p.id) === String(row._existingId));
          await pushEntity('product', 'update', { ...existing, stock: (existing?.stock ?? 0) + row.stock, ...(row.purchase_price > 0 && { purchase_price: row.purchase_price }), ...(row.price > 0 && { price: row.price }), ...(row.barcode && { barcode: row.barcode }), updated_at: now });
        } else {
          await pushEntity('product', 'create', { name: row.name, price: row.price, purchase_price: row.purchase_price, stock: row.stock, category: row.category, barcode: row.barcode, unit: row.unit, metadata: {}, created_at: now, updated_at: now });
        }
        done++;
        setImportProgress({ done, total: validRows.length, errors: [...errors] });
      } catch (err) {
        errors.push(`${row.name}: ${err.message}`);
        done++;
        setImportProgress({ done, total: validRows.length, errors: [...errors] });
      }
    }
    setIsImporting(false);
    if (errors.length === 0) showToast(`${done} products imported`);
    else showToast(`${done - errors.length} imported, ${errors.length} failed`, 'error');
  };

  return (
    <div className="flex flex-col gap-6 w-full">

      {/* ── Page Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
            <span>Home</span><ChevronRight size={12} /><span className="text-foreground font-medium">Products</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Products</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage products, categories and inventory</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowImportDialog(true)} className="flex items-center gap-2 h-9 px-3 text-sm rounded-lg border border-border bg-background hover:bg-muted transition-colors">
            <Upload size={15} /> Import Excel
          </button>
          <button onClick={exportToExcel} className="flex items-center gap-2 h-9 px-3 text-sm rounded-lg border border-border bg-background hover:bg-muted transition-colors">
            <Download size={15} /> Export Excel
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 h-9 px-4 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium">
            <Plus size={15} /> Add Product
          </button>
        </div>
      </motion.div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Package, label: 'Total Products', value: products.length.toLocaleString(), sub: 'All time', tint: { icon: 'text-blue-500', bg: 'bg-blue-500/10', spark: '#3b82f6' }, delay: 1 },
          { icon: Layers, label: 'Categories', value: stats.categories, sub: 'All time', tint: { icon: 'text-violet-500', bg: 'bg-violet-500/10', spark: '#8b5cf6' }, delay: 2 },
          { icon: Archive, label: 'In Stock', value: stats.totalStock.toLocaleString(), sub: 'Total units', tint: { icon: 'text-emerald-500', bg: 'bg-emerald-500/10', spark: '#10b981' }, delay: 3 },
          stats.negativeStock > 0
            ? { icon: TrendingDown, label: 'Negative Stock', value: stats.negativeStock, sub: 'Needs attention', tint: { icon: 'text-red-500', bg: 'bg-red-500/10', spark: '#ef4444' }, delay: 4 }
            : { icon: AlertCircle, label: 'Low Stock', value: stats.lowStock, sub: stats.lowStock > 0 ? 'Needs attention' : 'All good', tint: stats.lowStock > 0 ? { icon: 'text-amber-500', bg: 'bg-amber-500/10', spark: '#f59e0b' } : { icon: 'text-muted-foreground', bg: 'bg-muted/40', spark: '#94a3b8' }, delay: 4 },
        ].map((card) => (
          <motion.div key={card.label} variants={fadeUp} initial="hidden" animate="visible" custom={card.delay}>
            <StatCard icon={card.icon} label={card.label} value={card.value} sub={card.sub} tint={card.tint} />
          </motion.div>
        ))}
      </div>

      {/* ── Products Table ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}>
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
          {/* Table header / search */}
          <div className="p-5 border-b bg-muted/10">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                <input
                  placeholder="Search by name, category, barcode..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-9 pl-9 pr-9 text-sm rounded-lg border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X size={13} />
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground shrink-0">
                <span className="font-semibold text-foreground">{filtered.length}</span> of <span className="font-semibold text-foreground">{products.length}</span> products
              </p>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/25 border-b border-border">
                  <th className="text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide py-3 pl-5">Product</th>
                  <th className="text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide py-3">Category</th>
                  <th className="text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide py-3">Unit</th>
                  <th className="text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide py-3">Cost</th>
                  <th className="text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide py-3">Price</th>
                  <th className="text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide py-3">Margin</th>
                  <th className="text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide py-3">Stock</th>
                  <th className="text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide py-3 pr-5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="h-40 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="bg-muted/40 p-4 rounded-2xl"><Package size={28} className="opacity-40" /></div>
                        <div>
                          <p className="font-medium text-sm">{searchTerm ? 'No matching products' : 'No products yet'}</p>
                          <p className="text-xs mt-0.5 opacity-70">{searchTerm ? 'Try adjusting your search' : 'Click "Add Product" or import an Excel file'}</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  Object.entries(grouped).map(([cat, prods]) => (
                    <React.Fragment key={cat}>
                      {/* Category Row */}
                      <tr className="bg-gradient-to-r from-primary/5 via-primary/3 to-transparent border-y border-primary/10">
                        <td colSpan={8} className="py-2.5 pl-5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-1 h-4 rounded-full bg-primary/50" />
                            <span className="font-bold text-primary/70 uppercase tracking-wider text-[11px]">{cat}</span>
                            <span className="text-[10px] font-mono border border-primary/20 text-primary/50 rounded px-1.5 py-0.5">{prods.length}</span>
                          </div>
                        </td>
                      </tr>
                      {/* Product rows */}
                      {prods.map((p) => {
                        const m = margin(p);
                        const stockVal = p.stock ?? 0;
                        const isNeg = stockVal < 0;
                        const isLow = !isNeg && stockVal <= 10 && stockVal > 0;
                        const isOut = stockVal === 0;
                        return (
                          <tr key={p.id} className="hover:bg-muted/30 transition-colors group border-b border-border/30 last:border-0">
                            <td className="py-3 pl-5">
                              <div className="font-semibold text-sm text-foreground">{p.name}</div>
                              {p.barcode && <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{p.barcode}</div>}
                            </td>
                            <td className="py-3">
                              {p.category ? (
                                <span className="inline-flex items-center rounded-md border bg-secondary px-2 py-0.5 text-xs font-mono">{p.category}</span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="py-3">
                              {p.unit ? (
                                <span className="inline-flex items-center rounded-md border border-blue-400/40 text-blue-600 px-2 py-0.5 text-xs font-mono">{p.unit}</span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="py-3 text-right text-muted-foreground font-mono text-sm">{p.purchase_price > 0 ? fmtPKR(p.purchase_price) : '—'}</td>
                            <td className="py-3 text-right font-bold text-primary font-mono text-sm">{fmtPKR(p.price)}</td>
                            <td className="py-3 text-right">
                              {m ? (
                                <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-mono',
                                  Number(m) >= 20 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25' : 'bg-orange-500/10 text-orange-600 border-orange-500/25'
                                )}>{m}%</span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="py-3 text-right">
                              {isNeg ? (
                                <span className="inline-flex items-center gap-1 font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-red-600/15 text-red-600 border border-red-500/40">
                                  <TrendingDown size={9} />{stockVal}
                                </span>
                              ) : isOut ? (
                                <span className="inline-flex items-center font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-600">OUT</span>
                              ) : (
                                <span className={cn('inline-flex items-center font-mono text-xs px-2 py-0.5 rounded-full border',
                                  isLow ? 'bg-amber-500/10 text-amber-600 border-amber-500/25' : 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                                )}>{stockVal}</span>
                              )}
                            </td>
                            <td className="py-3 pr-5">
                              <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setViewProduct(p)} title="View details"
                                  className="h-8 w-8 flex items-center justify-center rounded-lg text-violet-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors">
                                  <Eye size={13} />
                                </button>
                                <button onClick={() => openEdit(p)}
                                  className="h-8 w-8 flex items-center justify-center rounded-lg text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                  <Pencil size={13} />
                                </button>
                                {deleteConfirmId === p.id ? (
                                  <div className="flex items-center gap-1 bg-destructive/8 px-2 rounded-lg border border-destructive/20 animate-in fade-in">
                                    <span className="text-[11px] font-semibold text-destructive">Sure?</span>
                                    <button onClick={() => handleDelete(p.id)} className="h-6 px-2 text-[10px] rounded bg-destructive text-white hover:bg-destructive/90">Yes</button>
                                    <button onClick={() => setDeleteConfirmId(null)} className="h-6 px-2 text-[10px] rounded hover:bg-muted">No</button>
                                  </div>
                                ) : (
                                  <button onClick={() => setDeleteConfirmId(p.id)}
                                    className="h-8 w-8 flex items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 transition-colors">
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {prodPageCount > 1 && (
            <div className="flex items-center justify-between px-5 py-2.5 border-t border-border/30 shrink-0 bg-muted/20">
              <span className="text-xs text-muted-foreground">{filtered.length} products · page {prodPage} of {prodPageCount}</span>
              <div className="flex gap-1">
                <button onClick={() => setProdPage(p => Math.max(1, p - 1))} disabled={prodPage === 1}
                  className="h-7 w-7 rounded-lg border border-border text-base flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors">‹</button>
                <button onClick={() => setProdPage(p => Math.min(prodPageCount, p + 1))} disabled={prodPage === prodPageCount}
                  className="h-7 w-7 rounded-lg border border-border text-base flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors">›</button>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Analytics Toggle ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={6}>
        <div
          className="flex items-center justify-between px-1 cursor-pointer group"
          onClick={() => setShowAnalytics((v) => !v)}
        >
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-xl"><BarChart2 size={17} className="text-primary" /></div>
            <div>
              <h2 className="text-base font-bold">Product Analytics</h2>
              <p className="text-xs text-muted-foreground">Stock valuation &amp; performance insights</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors bg-muted/50 hover:bg-muted px-3 py-1.5 rounded-lg border border-border/40">
            <ChevronDown size={14} className={cn('transition-transform duration-300', showAnalytics && 'rotate-180')} />
            {showAnalytics ? 'Hide' : 'Show'}
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showAnalytics && analytics && (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            className="flex flex-col gap-5 overflow-hidden"
          >
            {/* Summary strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Stock Cost', value: fmtPKR(analytics.totalStockValue), color: 'text-cyan-600', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', icon: Layers },
                { label: 'Retail Value', value: fmtPKR(analytics.totalRetailValue), color: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: TrendingUp },
                { label: 'Potential Profit', value: fmtPKR(analytics.totalRetailValue - analytics.totalStockValue), color: 'text-green-600', bg: 'bg-green-500/10', border: 'border-green-500/20', icon: TrendingUp },
                { label: 'Realised Profit', value: fmtPKR(analytics.totalProfit), color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20', icon: BarChart2 },
              ].map((c) => (
                <div key={c.label} className={cn('rounded-2xl border bg-card shadow-sm p-5', c.border)}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{c.label}</p>
                    <div className={cn('p-1.5 rounded-lg', c.bg)}><c.icon className={cn('h-3.5 w-3.5', c.color)} /></div>
                  </div>
                  <p className={cn('text-lg font-bold', c.color)}>{c.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Most Profitable */}
              <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                <div className="border-b bg-emerald-500/5 py-4 px-5">
                  <p className="text-sm font-semibold flex items-center gap-2 text-emerald-700 dark:text-emerald-400"><TrendingUp size={15} /> Most Profitable Products</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Based on total profit from sales</p>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="bg-muted/20">
                    <th className="text-left text-xs font-semibold text-muted-foreground py-2 pl-5">Product</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground py-2">Sold</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground py-2 pr-5">Profit</th>
                  </tr></thead>
                  <tbody>
                    {analytics.topProfitable.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/30 border-t border-border/20">
                        <td className="font-semibold py-2 pl-5">{p.name}</td>
                        <td className="text-right py-2"><span className="inline-flex items-center rounded-md border bg-secondary px-2 py-0.5 text-xs font-mono">{p.total_sold || 0}</span></td>
                        <td className="text-right py-2 pr-5 font-bold text-emerald-600 font-mono text-sm">{fmtPKR(p.total_profit || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Slow Movers + Issues */}
              <div className="flex flex-col gap-4">
                <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                  <div className="border-b bg-orange-500/5 py-4 px-5">
                    <p className="text-sm font-semibold flex items-center gap-2 text-orange-600"><TrendingDown size={15} /> Slow Movers</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{analytics.slowMoversCount} products with zero sales</p>
                  </div>
                  {analytics.slowMoversCount === 0 ? (
                    <div className="py-6 text-center text-muted-foreground text-sm">
                      <CheckCircle2 size={20} className="text-emerald-500 mx-auto mb-1.5" />All products have been sold!
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <tbody>
                        {analytics.slowMovers.map((p) => (
                          <tr key={p.id} className="hover:bg-muted/30 border-t border-border/20">
                            <td className="font-semibold py-2 pl-5">{p.name}</td>
                            <td className="text-right text-muted-foreground text-xs py-2">{p.category || '—'}</td>
                            <td className="text-right pr-5 py-2"><span className="inline-flex items-center rounded-md border bg-secondary px-2 py-0.5 text-xs font-mono">Stock: {p.stock}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {analytics.negativeStockCount > 0 && (
                  <div className="rounded-2xl border border-red-500/40 bg-card shadow-sm overflow-hidden">
                    <div className="border-b bg-red-500/5 py-4 px-5">
                      <p className="text-sm font-semibold flex items-center gap-2 text-red-600"><TrendingDown size={15} /> Negative Stock ({analytics.negativeStockCount})</p>
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        {analytics.negativeStock.map((p) => (
                          <tr key={p.id} className="hover:bg-red-500/5 border-t border-border/20">
                            <td className="font-semibold py-2 pl-5">{p.name}</td>
                            <td className="text-right pr-5 py-2">
                              <span className="inline-flex items-center gap-1 font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-red-600/15 text-red-600 border border-red-500/40">
                                <TrendingDown size={9} />{p.stock}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {analytics.outOfStockCount > 0 && (
                  <div className="rounded-2xl border border-destructive/25 bg-card shadow-sm overflow-hidden">
                    <div className="border-b bg-destructive/5 py-4 px-5">
                      <p className="text-sm font-semibold flex items-center gap-2 text-destructive"><AlertCircle size={15} /> Out of Stock ({analytics.outOfStockCount})</p>
                    </div>
                    <div className="p-5 flex flex-wrap gap-2">
                      {analytics.outOfStock.map((p) => (
                        <span key={p.id} className="inline-flex items-center rounded-md bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 text-xs">{p.name}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Category Breakdown */}
            {analytics.categoryBreakdown.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                <div className="border-b py-4 px-5">
                  <p className="text-sm font-semibold flex items-center gap-2"><Layers size={14} /> Stock Value by Category</p>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="bg-muted/20">
                    <th className="text-left text-xs font-semibold text-muted-foreground py-2 pl-5">Category</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground py-2">Products</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground py-2">Cost Value</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground py-2 pr-5">Retail Value</th>
                  </tr></thead>
                  <tbody>
                    {analytics.categoryBreakdown.map(({ category, value, retail, count }) => (
                      <tr key={category} className="hover:bg-muted/30 border-t border-border/20">
                        <td className="py-2 pl-5"><span className="inline-flex items-center rounded-md border bg-secondary px-2 py-0.5 text-xs font-mono">{category}</span></td>
                        <td className="text-right text-muted-foreground text-sm py-2">{count}</td>
                        <td className="text-right font-semibold text-cyan-600 font-mono text-sm py-2">{fmtPKR(value)}</td>
                        <td className="text-right pr-5 font-bold text-emerald-600 font-mono text-sm py-2">{fmtPKR(retail)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Product Detail Modal ── */}
      <AnimatePresence>
        {viewProduct && <ProductDetailModal product={viewProduct} onClose={() => setViewProduct(null)} />}
      </AnimatePresence>

      {/* ── Add / Edit Form Modal ── */}
      <ProductFormModal
        isOpen={showDialog}
        isEditing={isEditing}
        initialProduct={initialProduct}
        vendors={vendors}
        categories={categories}
        onClose={() => setShowDialog(false)}
        onSaved={() => {}}
      />

      {/* ── Import Dialog ── */}
      {showImportDialog && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-8 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => !isImporting && (setShowImportDialog(false), resetImport())}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="w-full max-w-2xl bg-card rounded-2xl shadow-2xl border border-border/50 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative p-6 border-b" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 50%, #0f172a 100%)' }}>
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-500/20 border border-emerald-400/30 p-2.5 rounded-xl"><FileSpreadsheet size={20} className="text-emerald-300" /></div>
                  <div>
                    <h2 className="text-white text-lg font-bold">Import Products from Excel</h2>
                    <p className="text-emerald-300/70 text-xs mt-0.5">Bulk import or update inventory via spreadsheet</p>
                  </div>
                </div>
                <button onClick={() => { setShowImportDialog(false); resetImport(); }} className="text-white/50 hover:text-white/90 p-1 rounded-lg hover:bg-white/10">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Phase 1: Upload */}
              {importPhase === 'upload' && (
                <>
                  <div onClick={() => importFileInputRef.current?.click()} className="border-2 border-dashed border-border/50 hover:border-primary/50 rounded-xl p-10 text-center cursor-pointer transition-all hover:bg-muted/20">
                    <div className="bg-primary/8 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-primary/20"><Upload size={24} className="text-primary" /></div>
                    <p className="font-semibold text-sm mb-1">Click to upload Excel file</p>
                    <p className="text-xs text-muted-foreground">Any column names — we'll help you map them</p>
                    <input ref={importFileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImportFile} className="hidden" />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/30">
                    <div>
                      <p className="text-sm font-semibold">Need a template?</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Download pre-formatted Excel with correct headers</p>
                    </div>
                    <button onClick={downloadTemplate} className="flex items-center gap-2 h-8 px-3 text-sm rounded-lg border border-border bg-background hover:bg-muted ml-4">
                      <Download size={13} /> Template
                    </button>
                  </div>
                </>
              )}

              {/* Phase 2: Column Mapping */}
              {importPhase === 'mapping' && (
                <>
                  <div>
                    <p className="text-sm font-semibold">Map Your Columns</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Auto-detected {Object.values(importColumnMap).filter((v) => v !== '__skip__').length} of {importRawHeaders.length} columns. Adjust if needed.</p>
                  </div>
                  <div className="border border-border/50 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-muted/40">
                        <th className="text-left text-xs text-muted-foreground py-2.5 pl-4">Your Column</th>
                        <th className="text-left text-xs text-muted-foreground py-2.5">Sample Values</th>
                        <th className="text-left text-xs text-muted-foreground py-2.5 pr-4 w-48">Maps To</th>
                      </tr></thead>
                      <tbody>
                        {importRawHeaders.map((header) => {
                          const mapped = importColumnMap[header] || '__skip__';
                          const sample = importRawRows.slice(0, 3).map((r) => String(r[header] ?? '')).filter(Boolean).join(', ');
                          return (
                            <tr key={header} className="border-t border-border/20">
                              <td className="pl-4 py-2"><span className="font-mono bg-muted/60 px-1.5 py-0.5 rounded text-[11px]">{header}</span></td>
                              <td className="py-2 max-w-[130px]"><span className="text-[11px] text-muted-foreground truncate block">{sample.substring(0, 36) || '—'}</span></td>
                              <td className="pr-4 py-2">
                                <select
                                  value={mapped}
                                  onChange={(e) => setImportColumnMap((prev) => ({ ...prev, [header]: e.target.value }))}
                                  className={cn('h-7 w-44 text-xs px-2 rounded border bg-background focus:outline-none',
                                    mapped !== '__skip__' ? 'border-emerald-500/50 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300' : 'text-muted-foreground border-border'
                                  )}
                                >
                                  <option value="__skip__">— Skip column —</option>
                                  {IMPORTABLE_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={resetImport} className="flex-1 h-9 rounded-lg border border-border bg-background hover:bg-muted text-sm transition-colors">Cancel</button>
                    <button
                      onClick={applyColumnMapAndPreview}
                      disabled={!Object.values(importColumnMap).includes('name')}
                      className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      Preview Import →
                    </button>
                  </div>
                </>
              )}

              {/* Phase 3: Preview */}
              {importPhase === 'preview' && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">
                        <span className="text-emerald-600">{importRows.filter((r) => r._valid).length} ready</span>
                        {importRows.filter((r) => !r._valid).length > 0 && <span className="text-muted-foreground"> · {importRows.filter((r) => !r._valid).length} will be skipped</span>}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        <span className="text-primary font-medium">{importRows.filter((r) => r._valid && r._isUpdate).length} updates</span> · <span className="text-emerald-600 font-medium">{importRows.filter((r) => r._valid && !r._isUpdate).length} new</span>
                      </p>
                    </div>
                    <button onClick={() => setImportPhase('mapping')} className="text-xs font-semibold text-primary hover:underline">← Edit Mapping</button>
                  </div>
                  <div className="border border-border/50 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-muted/40">
                        <th className="text-left text-xs text-muted-foreground py-2.5 pl-4">Name</th>
                        <th className="text-right text-xs text-muted-foreground py-2.5">Sell Price</th>
                        <th className="text-right text-xs text-muted-foreground py-2.5">Cost</th>
                        <th className="text-right text-xs text-muted-foreground py-2.5">Stock</th>
                        <th className="text-right text-xs text-muted-foreground py-2.5 pr-4">Status</th>
                      </tr></thead>
                      <tbody>
                        {importRows.map((row, i) => (
                          <tr key={i} className={cn('border-t border-border/20', !row._valid && 'opacity-50 bg-destructive/5')}>
                            <td className="pl-4 py-2">
                              <p className="text-xs font-medium">{row.name || '—'}</p>
                              {row._isUpdate && row._valid && <span className="text-[10px] bg-amber-500/15 text-amber-700 px-1.5 py-0.5 rounded font-bold">UPDATE</span>}
                              {!row._isUpdate && row._valid && <span className="text-[10px] bg-emerald-500/15 text-emerald-700 px-1.5 py-0.5 rounded font-bold">NEW</span>}
                            </td>
                            <td className="text-xs text-right font-mono py-2">{row.price > 0 ? fmtPKR(row.price) : <span className="text-destructive">—</span>}</td>
                            <td className="text-xs text-right font-mono py-2 text-muted-foreground">{row.purchase_price > 0 ? fmtPKR(row.purchase_price) : '—'}</td>
                            <td className="text-xs text-right font-mono py-2">{row.stock}</td>
                            <td className="text-right pr-4 py-2">
                              {row._valid ? <CheckCircle2 size={14} className="text-emerald-500 ml-auto" /> : (
                                <div className="flex items-center gap-1 justify-end"><AlertCircle size={13} className="text-destructive" /><span className="text-[10px] text-destructive">{row._errors[0]}</span></div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={resetImport} className="flex-1 h-9 rounded-lg border border-border bg-background hover:bg-muted text-sm transition-colors">Cancel</button>
                    <button onClick={executeImport} disabled={importRows.filter((r) => r._valid).length === 0 || isImporting} className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                      <Upload size={14} /> Import {importRows.filter((r) => r._valid).length} Products
                    </button>
                  </div>
                </>
              )}

              {/* Phase 4: Progress */}
              {importPhase === 'progress' && importProgress && (
                <div className="space-y-5 py-2">
                  <div className="text-center">
                    {isImporting ? (
                      <>
                        <div className="w-14 h-14 rounded-full border-2 border-primary/25 border-t-primary animate-spin mx-auto mb-4" />
                        <p className="font-semibold">Importing products...</p>
                        <p className="text-xs text-muted-foreground mt-1">{importProgress.done} of {importProgress.total} done</p>
                      </>
                    ) : (
                      <>
                        <div className="bg-emerald-500/10 border border-emerald-500/20 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CheckCircle2 size={26} className="text-emerald-500" />
                        </div>
                        <p className="font-bold text-base">Import Complete!</p>
                        <p className="text-sm text-muted-foreground mt-1">{importProgress.done - importProgress.errors.length} products imported{importProgress.errors.length > 0 && `, ${importProgress.errors.length} failed`}</p>
                      </>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${(importProgress.done / importProgress.total) * 100}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground text-right">{Math.round((importProgress.done / importProgress.total) * 100)}%</p>
                  </div>
                  {!isImporting && (
                    <button className="w-full h-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium" onClick={() => { setShowImportDialog(false); resetImport(); }}>
                      Done
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </div>
  );
}
