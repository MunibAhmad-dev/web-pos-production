import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '@/components/ui/action-button';
import { Input } from '@/components/form/fields';
import { getModuleSettings } from '@/hooks/useModuleSettings';

// Field names match the desktop app's `products` SQLite table exactly (see
// pos-backend-cloud sync payloads) — no separate `category`/`sku` tables,
// category is a free-text column on the product row itself.
const emptyForm = {
  name: '',
  barcode: '',
  category: '',
  unit: 'pcs',
  purchase_price: '',
  price: '',
  stock: '',
  box_qty: '',
  wholesale_price: '',
  wholesale_price_mode: 'per_piece',
};

export default function ProductFormModal({ open, onClose, onSubmit, product, categoryOptions = [] }) {
  const [form, setForm] = useState(emptyForm);
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
        box_qty: product.box_qty ?? '',
        wholesale_price: product.wholesale_price ?? '',
        wholesale_price_mode: product.wholesale_price_mode || 'per_piece',
      });
    } else {
      setForm(emptyForm);
    }
    setError('');
  }, [product, open]);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        purchase_price: Number(form.purchase_price) || 0,
        price: Number(form.price) || 0,
        stock: Number(form.stock) || 0,
        box_qty: wholesaleOn ? (Number(form.box_qty) || 0) : (product?.box_qty || 0),
        wholesale_price: wholesaleOn ? (Number(form.wholesale_price) || 0) : (product?.wholesale_price || 0),
        wholesale_price_mode: wholesaleOn ? (form.wholesale_price_mode || 'per_piece') : (product?.wholesale_price_mode || 'per_piece'),
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
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
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
            list="product-categories"
            value={form.category}
            onChange={update('category')}
            placeholder="e.g. Beverages"
            className="w-full rounded-lg border border-border px-3 py-1.5 text-sm outline-none focus:border-brand-blue"
          />
          <datalist id="product-categories">
            {categoryOptions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <Input label="Unit" value={form.unit} onChange={update('unit')} placeholder="pcs, kg, box…" />
        <Input label="Cost price" type="number" min="0" step="0.01" required value={form.purchase_price} onChange={update('purchase_price')} />
        <Input label="Retail price (per piece)" type="number" min="0" step="0.01" required value={form.price} onChange={update('price')} />
        <Input label="Opening stock" type="number" min="0" disabled={Boolean(product)} value={form.stock} onChange={update('stock')} />

        {wholesaleOn && (
          <>
            <div className="sm:col-span-2 flex items-center gap-2 pt-1">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 px-2">📦 Wholesale</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <Input
              label="Pieces per box / carton"
              type="number"
              min="0"
              step="1"
              placeholder="e.g. 24"
              value={form.box_qty}
              onChange={update('box_qty')}
            />
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {(form.wholesale_price_mode || 'per_piece') === 'per_box' ? 'Wholesale price per box' : 'Wholesale price per piece'}
                </span>
                <div className="flex rounded border border-sky-400/40 overflow-hidden text-[10px] font-semibold">
                  <button type="button"
                    onClick={() => setForm({ ...form, wholesale_price_mode: 'per_piece' })}
                    className={`px-2 py-0.5 transition-colors ${(form.wholesale_price_mode || 'per_piece') === 'per_piece' ? 'bg-sky-600 text-white' : 'bg-transparent text-sky-600 hover:bg-sky-500/10'}`}
                  >Per Piece</button>
                  <button type="button"
                    onClick={() => setForm({ ...form, wholesale_price_mode: 'per_box' })}
                    className={`px-2 py-0.5 transition-colors ${form.wholesale_price_mode === 'per_box' ? 'bg-sky-600 text-white' : 'bg-transparent text-sky-600 hover:bg-sky-500/10'}`}
                  >Per Box</button>
                </div>
              </div>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder={(form.wholesale_price_mode || 'per_piece') === 'per_box' ? 'e.g. 500 per box' : 'Leave blank to use retail price'}
                value={form.wholesale_price}
                onChange={update('wholesale_price')}
              />
            </div>
            {Number(form.box_qty) > 0 && (() => {
              const bq = Number(form.box_qty);
              const ws = Number(form.wholesale_price) || 0;
              const mode = form.wholesale_price_mode || 'per_piece';
              const boxPrice = mode === 'per_box' ? ws : (ws || Number(form.price) || 0) * bq;
              const pcPrice  = mode === 'per_box' ? (bq > 0 ? ws / bq : 0) : (ws || Number(form.price) || 0);
              return (
                <p className="sm:col-span-2 text-xs text-sky-600 bg-sky-50 dark:bg-sky-900/20 rounded-lg px-3 py-2">
                  1 box = {bq} {form.unit || 'pcs'} ·{' '}
                  {mode === 'per_box'
                    ? <>Box price = PKR {Math.round(boxPrice).toLocaleString()} · Per piece ≈ PKR {pcPrice.toFixed(1)}</>
                    : <>Box price ≈ PKR {Math.round(boxPrice).toLocaleString()}</>
                  }
                </p>
              );
            })()}
          </>
        )}

        {error && <p className="text-sm text-brand-red sm:col-span-2">{error}</p>}
      </form>
    </Modal>
  );
}
