import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '@/components/ui/action-button';
import { Input, Select } from '@/components/form/fields';

export default function TransferModal({ open, onClose, onSubmit, accounts = [], fromAccount }) {
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFromId(fromAccount?.id ? String(fromAccount.id) : '');
      setToId('');
      setAmount('');
      setNote('');
      setError('');
    }
  }, [open, fromAccount]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const amt = Number(amount);
    if (!fromId || !toId || fromId === toId) {
      setError('Select two different accounts');
      return;
    }
    if (!amt || amt <= 0) {
      setError('Enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ fromId, toId, amount: amt, note: note || 'Internal Transfer' });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to transfer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Transfer Between Accounts"
      width="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Transferring…' : 'Transfer'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select label="From" value={fromId} onChange={(e) => setFromId(e.target.value)}>
          <option value="">Select account</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <Select label="To" value={toId} onChange={(e) => setToId(e.target.value)}>
          <option value="">Select account</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <Input label="Amount" type="number" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal Transfer" />
        {error && <p className="text-sm text-brand-red">{error}</p>}
      </form>
    </Modal>
  );
}
