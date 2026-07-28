import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '@/components/ui/action-button';
import { Select, Textarea } from '@/components/form/fields';
import { formatCurrency } from '../../utils/format';

export default function PurchaseOrderFormModal({ open, onClose, onSubmit, vendors, products }) {
  const [vendor, setVendor] = useState('');
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setVendor('');
      setItems([]);
      setNotes('');
      setError('');
    }
  }, [open]);

  const addItem = () => setItems((prev) => [...prev, { product: '', qty: 1, unitCost: 0 }]);
  const updateItem = (idx, field, value) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };
  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const total = items.reduce((sum, it) => sum + Number(it.qty || 0) * Number(it.unitCost || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!vendor) {
      setError('Select a vendor');
      return;
    }
    if (items.length === 0 || items.some((it) => !it.product || it.qty <= 0)) {
      setError('Add at least one valid item');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        vendor,
        notes,
        items: items.map((it) => ({ product: it.product, qty: Number(it.qty), unitCost: Number(it.unitCost) })),
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to create purchase order');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Purchase Order"
      width="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creating…' : 'Create Purchase Order'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select label="Vendor" required value={vendor} onChange={(e) => setVendor(e.target.value)}>
          <option value="">Select vendor</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </Select>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Items</span>
            <Button type="button" size="sm" variant="secondary" onClick={addItem}>
              <Plus size={13} /> Add Item
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select className="flex-1" value={item.product} onChange={(e) => updateItem(idx, 'product', e.target.value)}>
                  <option value="">Select product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                <input
                  type="number"
                  min="1"
                  placeholder="Qty"
                  value={item.qty}
                  onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                  className="w-20 rounded-lg border border-border px-2 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Unit cost"
                  value={item.unitCost}
                  onChange={(e) => updateItem(idx, 'unitCost', e.target.value)}
                  className="w-28 rounded-lg border border-border px-2 py-2 text-sm"
                />
                <button type="button" onClick={() => removeItem(idx)} className="rounded-lg p-2 text-brand-red hover:bg-brand-red/10">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {items.length === 0 && <p className="py-3 text-center text-sm text-muted-foreground">No items added yet.</p>}
          </div>
        </div>

        <Textarea label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />

        <div className="flex justify-end text-sm font-semibold text-ink">Total: {formatCurrency(total)}</div>

        {error && <p className="text-sm text-brand-red">{error}</p>}
      </form>
    </Modal>
  );
}
