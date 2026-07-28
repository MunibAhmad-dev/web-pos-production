import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '@/components/ui/action-button';
import { Input, Select } from '@/components/form/fields';

export default function StockAdjustModal({ open, onClose, onSubmit, product }) {
  const [type, setType] = useState('increase');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSubmit({ type, quantity: Number(quantity), reason });
      setQuantity('');
      setReason('');
      setType('increase');
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to adjust stock');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Adjust Stock — ${product?.name || ''}`}
      width="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Apply Adjustment'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">Current stock: {product?.stock ?? 0}</p>
        <Select label="Adjustment type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="increase">Increase (restock / correction)</option>
          <option value="decrease">Decrease (damage / loss / correction)</option>
        </Select>
        <Input label="Quantity" type="number" min="1" required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <Input label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged in storage" />
        {error && <p className="text-sm text-brand-red">{error}</p>}
      </form>
    </Modal>
  );
}
