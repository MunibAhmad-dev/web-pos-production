import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '@/components/ui/action-button';
import { Input, Select } from '@/components/form/fields';
import { formatCurrency } from '../../utils/format';

export default function GiveUdharModal({ open, onClose, onSubmit, employee }) {
  const [type, setType] = useState('advance');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setType('advance');
      setAmount('');
      setDescription('');
      setError('');
    }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError('Enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ type, amount: amt, description });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to record');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Udhar — ${employee?.name || ''}`}
      width="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Record'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">Current balance: {formatCurrency(employee?.outstanding_balance)}</p>
        <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="advance">Took Goods/Cash (advance)</option>
          <option value="repayment">Repaid</option>
        </Select>
        <Input label="Amount" type="number" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        {error && <p className="text-sm text-brand-red">{error}</p>}
      </form>
    </Modal>
  );
}
