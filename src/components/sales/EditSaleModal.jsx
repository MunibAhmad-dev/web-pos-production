import { useEffect, useMemo, useState } from 'react';
import { Plus, Minus, Trash2 } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '@/components/ui/action-button';
import { Select, Input } from '@/components/form/fields';
import { formatCurrency } from '../../utils/format';

// Matches the desktop's EditSaleModal constraints: quantity +/- and item
// add/remove and discount only — no price, customer or payment-method edits.
export default function EditSaleModal({ open, onClose, sale, items, products, onSave }) {
  const [lines, setLines] = useState([]);
  const [discount, setDiscount] = useState('');
  const [addingProductId, setAddingProductId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && sale) {
      setLines(
        (items || []).map((i) => ({
          saleItemId: i.id,
          product_id: i.product_id,
          name: i.product_name,
          price: Number(i.price || 0),
          purchase_price: Number(i.purchase_price || 0),
          qty: Number(i.quantity || 0),
          isCustom: Boolean(i.is_custom),
        }))
      );
      setDiscount(String(sale.discount || 0));
      setError('');
    }
  }, [open, sale, items]);

  const subtotal = useMemo(() => lines.reduce((sum, l) => sum + l.price * l.qty, 0), [lines]);
  const discountAmount = Math.min(Number(discount) || 0, subtotal);
  const total = Math.max(subtotal - discountAmount, 0);

  const updateQty = (idx, delta) => {
    setLines((prev) =>
      prev
        .map((l, i) => (i === idx ? { ...l, qty: Math.max(0, l.qty + delta) } : l))
        .filter((l) => l.qty > 0)
    );
  };

  const removeLine = (idx) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const handleAddProduct = (e) => {
    const productId = e.target.value;
    setAddingProductId('');
    if (!productId) return;
    const product = products.find((p) => String(p.id) === String(productId));
    if (!product) return;
    setLines((prev) => {
      const existingIdx = prev.findIndex((l) => String(l.product_id) === String(product.id));
      if (existingIdx >= 0) {
        return prev.map((l, i) => (i === existingIdx ? { ...l, qty: l.qty + 1 } : l));
      }
      return [
        ...prev,
        { saleItemId: null, product_id: product.id, name: product.name, price: Number(product.price || 0), purchase_price: Number(product.purchase_price || 0), qty: 1, isCustom: false },
      ];
    });
  };

  const handleSave = async () => {
    if (lines.length === 0) {
      setError('A sale must have at least one item — remove the whole sale from history instead.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({ lines, subtotal, discount: discountAmount, total });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (!sale) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit INV-${String(sale.id).slice(-6)}`}
      width="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Select label="Add a product" value={addingProductId} onChange={handleAddProduct}>
          <option value="">Search &amp; add product…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>

        <div className="flex flex-col gap-2">
          {lines.map((line, idx) => (
            <div key={`${line.product_id}-${idx}`} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {line.name}
                  {line.isCustom && <span className="ml-1.5 text-[10px] text-brand-purple">Custom</span>}
                </p>
                <p className="text-xs text-muted-foreground">{formatCurrency(line.price)} each</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => updateQty(idx, -1)} className="rounded-md border border-border p-1 hover:bg-muted">
                  <Minus size={12} />
                </button>
                <span className="w-6 text-center text-sm">{line.qty}</span>
                <button onClick={() => updateQty(idx, 1)} className="rounded-md border border-border p-1 hover:bg-muted">
                  <Plus size={12} />
                </button>
                <button onClick={() => removeLine(idx)} className="ml-1 rounded-md p-1 text-destructive hover:bg-destructive/10">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          {lines.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No items — add a product above.</p>}
        </div>

        <Input label="Discount" type="number" min="0" max={subtotal} value={discount} onChange={(e) => setDiscount(e.target.value)} />

        <div className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-1 font-semibold text-ink">
            <span>New Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        {error && <p className="text-sm text-brand-red">{error}</p>}
      </div>
    </Modal>
  );
}
