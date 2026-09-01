import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '@/components/ui/action-button';
import { Input } from '@/components/form/fields';
import { getModuleSettings } from '@/hooks/useModuleSettings';

const emptyForm = {
  name: '',
  barcode: '',
  category: '',
  unit: 'pcs',
  purchase_price: '',
  price: '',
  stock: '',
  carton_qty: '',
  box_qty: '',
  piece_name: 'piece',
  wholesale_price: '',
};

export default function ProductFormModal({ open, onClose, onSubmit, product, categoryOptions = [] }) {
  const [form, setForm] = useState(emptyForm);
  const [stockMode, setStockMode] = useState('pcs');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const wholesaleOn = getModuleSettings().wholesale_module_enabled;

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || '',
        barcode: product.barcode || '',
        category: product.category || '',
        unit: product.unit || 'pcs',
        purchase_price: product.purchase_price ?? '',
        price: product.price ?? '',
        stock: product.stock ?? '',
        carton_qty: product.carton_qty ?? '',
        box_qty: product.box_qty ?? '',
        piece_name: product.piece_name || 'piece',
        wholesale_price: product.wholesale_price ?? '',
      });
      setStockMode('pcs');
    } else {
      setForm(emptyForm);
      setStockMode('pcs');
    }
    setError('');
  }, [product, open]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const cq = Number(form.carton_qty) || 0;
      const bq = Number(form.box_qty) || 0;
      const pcsPerCarton = bq > 0 ? cq * bq : cq;
      const payload = {
        ...form,
        purchase_price: Number(form.purchase_price) || 0,
        price: Number(form.price) || 0,
        stock: (() => {
          const raw = Number(form.stock) || 0;
          if (product || !wholesaleOn) return raw;
          if (stockMode === 'cartons' && pcsPerCarton > 0) return raw * pcsPerCarton;
          if (stockMode === 'boxes' && bq > 0) return raw * bq;
          return raw;
        })(),
        carton_qty: wholesaleOn ? cq : (product?.carton_qty || 0),
        box_qty: wholesaleOn ? bq : (product?.box_qty || 0),
        piece_name: wholesaleOn ? ((form.piece_name || 'piece').trim() || 'piece') : (product?.piece_name || 'piece'),
        wholesale_price: wholesaleOn ? (Number(form.wholesale_price) || null) : (product?.wholesale_price || null),
      };
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Unable to save product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? 'Edit Product' : 'Add Product'}
      width="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Save Product'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Product name" required className="sm:col-span-2" value={form.name} onChange={update('name')} />
        <Input label="Barcode" value={form.barcode} onChange={update('barcode')} />
        <div>
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Category</span>
          <input
            list="smodal-product-categories"
            value={form.category}
            onChange={update('category')}
            placeholder="e.g. Beverages"
            className="w-full rounded-lg border border-border px-3 py-1.5 text-sm outline-none focus:border-brand-blue"
          />
          <datalist id="smodal-product-categories">
            {categoryOptions.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>

        <Input label="Unit" value={form.unit} onChange={update('unit')} placeholder="pcs, kg…" />
        <Input label="Cost price" type="number" min="0" step="0.01" required value={form.purchase_price} onChange={update('purchase_price')} />
        <Input label="Retail price (per piece)" type="number" min="0" step="0.01" required value={form.price} onChange={update('price')} />

        {/* Opening stock with mode toggle */}
        {(() => {
          const cq = Number(form.carton_qty) || 0;
          const bq = Number(form.box_qty) || 0;
          const pcsPerCarton = bq > 0 ? cq * bq : cq;
          const pn = (form.piece_name || 'piece').toLowerCase();
          const modes = [
            { key: 'pcs', label: `${pn.charAt(0).toUpperCase()}${pn.slice(1)}s` },
            ...(wholesaleOn && cq > 0 ? [{ key: 'cartons', label: 'Cartons' }] : []),
            ...(wholesaleOn && bq > 0 ? [{ key: 'boxes', label: 'Boxes' }] : []),
          ];
          const hint = (() => {
            const raw = Number(form.stock) || 0;
            if (!raw) return null;
            if (stockMode === 'cartons' && pcsPerCarton > 0) return `${raw} cartons × ${pcsPerCarton} = ${raw * pcsPerCarton} ${pn}s`;
            if (stockMode === 'boxes' && bq > 0) return `${raw} boxes × ${bq} = ${raw * bq} ${pn}s`;
            return null;
          })();
          return (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">Opening stock</span>
                {!product && modes.length > 1 && (
                  <div className="flex rounded border border-sky-400/40 overflow-hidden text-[10px] font-semibold">
                    {modes.map((m) => (
                      <button key={m.key} type="button" onClick={() => setStockMode(m.key)}
                        className={`px-2 py-0.5 transition-colors ${stockMode === m.key ? 'bg-sky-600 text-white' : 'bg-transparent text-sky-600 hover:bg-sky-500/10'}`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Input type="number" min="0" disabled={Boolean(product)} value={form.stock} onChange={update('stock')} />
              {hint && !product && <p className="text-[10px] text-sky-600 mt-1">{hint}</p>}
            </div>
          );
        })()}

        {/* Wholesale section */}
        {wholesaleOn && (() => {
          const cq = Number(form.carton_qty) || 0;
          const bq = Number(form.box_qty) || 0;
          const pn = (form.piece_name || 'piece').toLowerCase();
          const cp = Number(form.wholesale_price) || 0;
          const pcsPerCarton = bq > 0 ? cq * bq : cq;
          const boxPrice = bq > 0 && cq > 0 ? cp / cq : null;
          const pcPrice  = pcsPerCarton > 0 ? cp / pcsPerCarton : null;
          const boxOn = form.box_qty !== '' && form.box_qty !== '0' && form.box_qty !== 0 && form.box_qty != null;
          return (
            <>
              <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 px-2">📦 Wholesale</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Piece name */}
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Individual unit name</span>
                <input list="smodal-piece-opts"
                  value={form.piece_name || 'piece'}
                  onChange={(e) => setForm((f) => ({ ...f, piece_name: e.target.value }))}
                  placeholder="piece"
                  className="w-full rounded-lg border border-border px-3 py-1.5 text-sm outline-none focus:border-sky-500"
                />
                <datalist id="smodal-piece-opts">
                  {['piece', 'bar', 'jar', 'pouch', 'sachet', 'can', 'bottle', 'packet', 'bag', 'stick', 'roll'].map((t) => <option key={t} value={t} />)}
                </datalist>
              </div>

              {/* Carton qty */}
              <Input
                label={`${pn.charAt(0).toUpperCase()}${pn.slice(1)}s per carton`}
                type="number" min="1" step="1" placeholder="e.g. 12"
                value={form.carton_qty}
                onChange={update('carton_qty')}
              />

              {/* Carton price */}
              <Input
                label="Carton price (PKR)"
                type="number" min="0" step="0.01" placeholder="e.g. 3000"
                value={form.wholesale_price}
                onChange={update('wholesale_price')}
              />

              {/* Box level toggle */}
              <div className="sm:col-span-2 flex items-center gap-2">
                <input type="checkbox" id="smodal-box-toggle"
                  checked={boxOn}
                  onChange={(e) => setForm((f) => ({ ...f, box_qty: e.target.checked ? (Number(f.box_qty) > 0 ? f.box_qty : '') : 0 }))}
                  className="rounded"
                />
                <label htmlFor="smodal-box-toggle" className="text-xs text-muted-foreground cursor-pointer">
                  Has box level (carton → boxes → {pn}s)
                </label>
              </div>

              {/* Box qty */}
              {boxOn && (
                <Input
                  label={`${pn.charAt(0).toUpperCase()}${pn.slice(1)}s per box`}
                  type="number" min="1" step="1" placeholder="e.g. 24"
                  value={form.box_qty === 0 || form.box_qty === '0' ? '' : form.box_qty}
                  onChange={update('box_qty')}
                />
              )}

              {/* Live breakdown preview */}
              {cq > 0 && cp > 0 && (
                <p className="sm:col-span-2 text-xs text-sky-600 bg-sky-50 dark:bg-sky-900/20 rounded-lg px-3 py-2">
                  1 carton = {bq > 0 ? `${cq} boxes = ${pcsPerCarton}` : cq} {pn}s
                  {boxPrice != null && ` · Box ≈ PKR ${boxPrice.toFixed(0)}`}
                  {pcPrice  != null && ` · Per ${pn} ≈ PKR ${pcPrice.toFixed(2)}`}
                </p>
              )}
            </>
          );
        })()}

        {error && <p className="text-sm text-brand-red sm:col-span-2">{error}</p>}
      </form>
    </Modal>
  );
}
