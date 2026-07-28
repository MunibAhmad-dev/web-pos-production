import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '@/components/ui/action-button';
import { Input, Select, Textarea } from '@/components/form/fields';

export default function PaySalaryModal({ open, onClose, onSubmit, employee, accounts = [] }) {
  const [amount, setAmount] = useState('');
  const [month, setMonth] = useState('');
  const [accountId, setAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(employee?.monthly_salary ?? '');
      setMonth('');
      setAccountId('');
      setNotes('');
      setError('');
    }
  }, [open, employee]);

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
      await onSubmit({ amount: amt, month, notes, accountId: accountId || null });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to record payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Pay Salary — ${employee?.name || ''}`}
      width="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Pay Salary'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Amount" type="number" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input label="Month (optional)" value={month} onChange={(e) => setMonth(e.target.value)} placeholder="e.g. July 2026" />
        {accounts.length > 0 && (
          <Select label="Pay from account (optional)" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Don&apos;t record against an account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        )}
        <Textarea label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        {error && <p className="text-sm text-brand-red">{error}</p>}
      </form>
    </Modal>
  );
}
