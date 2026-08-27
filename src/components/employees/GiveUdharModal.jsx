import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '@/components/ui/action-button';
import { Input, Select } from '@/components/form/fields';
import { formatCurrency } from '../../utils/format';

export default function GiveUdharModal({ open, onClose, onSubmit, employee }) {
  const [type, setType] = useState('advance');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [deductFromSalary, setDeductFromSalary] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setType('advance');
      setAmount('');
      setDescription('');
      setDeductFromSalary(false);
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
      await onSubmit({ type, amount: amt, description, deduct_from_salary: type === 'advance' && deductFromSalary ? 1 : 0 });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to record');
    } finally {
      setSaving(false);
    }
  };

  const balance = Number(employee?.outstanding_balance || 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Udhar — ${employee?.name || ''}`}
      width="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Record'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Balance strip */}
        {balance !== 0 && (
          <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${balance > 0 ? 'bg-rose-500/5 border border-rose-500/20' : 'bg-emerald-500/5 border border-emerald-500/20'}`}>
            <span className={`text-xs font-semibold ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {balance > 0 ? 'Currently owes' : 'Credit balance'}
            </span>
            <span className={`text-sm font-bold font-mono ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {formatCurrency(Math.abs(balance))}
            </span>
          </div>
        )}

        <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="advance">Took Goods / Cash (advance)</option>
          <option value="repayment">Repaid / Returned</option>
        </Select>

        <Input label="Amount" type="number" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Ration for home" />

        {type === 'advance' && (
          <label className="flex items-center gap-3 cursor-pointer select-none rounded-xl border border-border px-4 py-3 hover:bg-muted/40 transition-colors">
            <input
              type="checkbox"
              checked={deductFromSalary}
              onChange={(e) => setDeductFromSalary(e.target.checked)}
              className="w-4 h-4 accent-emerald-600"
            />
            <div>
              <p className="text-sm font-medium text-ink">Deduct from next salary</p>
              <p className="text-xs text-muted-foreground">Will appear as a pending deduction when paying salary</p>
            </div>
          </label>
        )}

        {error && <p className="text-sm text-brand-red">{error}</p>}
      </form>
    </Modal>
  );
}
