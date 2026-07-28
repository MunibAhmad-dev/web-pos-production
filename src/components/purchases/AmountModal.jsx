import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '@/components/ui/action-button';
import { Input, Select } from '@/components/form/fields';

export default function AmountModal({ open, onClose, onSubmit, title, description, maxAmount, defaultAmount = '', submitLabel = 'Confirm' }) {
  const [amount, setAmount] = useState(defaultAmount);
  const [method, setMethod] = useState('cash');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(defaultAmount);
      setMethod('cash');
      setError('');
    }
  }, [open, defaultAmount]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSubmit({ amount: Number(amount) || 0, method });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : submitLabel}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        <Input label="Amount" type="number" min="0" max={maxAmount} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Select label="Method" value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="bank">Bank</option>
        </Select>
        {error && <p className="text-sm text-brand-red">{error}</p>}
      </form>
    </Modal>
  );
}
