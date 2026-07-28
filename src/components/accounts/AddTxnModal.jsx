import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '@/components/ui/action-button';
import { Input, Select } from '@/components/form/fields';
import { cn } from '@/lib/utils';

const QUICK_CATEGORIES = {
  in: ['Sale Income', 'Loan Received', 'Investment', 'Other Income'],
  out: ['Purchase', 'Expense', 'Salary', 'Withdrawal', 'Other'],
};

export default function AddTxnModal({ open, onClose, onSubmit, account }) {
  const [type, setType] = useState('in');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setType('in');
      setAmount('');
      setCategory('');
      setNote('');
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
      await onSubmit({ type, amount: amt, category: category || 'manual', note });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to record transaction');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Add Transaction — ${account?.name || ''}`}
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
        <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="in">Money In</option>
          <option value="out">Money Out</option>
        </Select>
        <Input label="Amount" type="number" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        <div>
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Category</span>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {QUICK_CATEGORIES[type].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                  category === c ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category"
            className="w-full rounded-lg border border-border px-3 py-1.5 text-sm outline-none focus:border-brand-blue"
          />
        </div>
        <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        {error && <p className="text-sm text-brand-red">{error}</p>}
      </form>
    </Modal>
  );
}
