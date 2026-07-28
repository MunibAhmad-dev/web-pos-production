import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '@/components/ui/action-button';
import { Input, Select, Textarea } from '@/components/form/fields';

const emptyForm = { type: 'cash', name: '', opening_balance: '', bank_name: '', account_number: '', notes: '' };

export default function AccountFormModal({ open, onClose, onSubmit, account }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(
      account
        ? {
            type: account.type || 'cash',
            name: account.name || '',
            opening_balance: account.opening_balance ?? '',
            bank_name: account.bank_name || '',
            account_number: account.account_number || '',
            notes: account.notes || '',
          }
        : emptyForm
    );
    setError('');
  }, [account, open]);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ ...form, opening_balance: Number(form.opening_balance) || 0 });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to save account');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={account ? 'Edit Account' : 'Add Account'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Save Account'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select label="Type" value={form.type} onChange={update('type')} disabled={Boolean(account)} className="sm:col-span-2">
          <option value="cash">Cash in Hand</option>
          <option value="bank">Bank Account</option>
        </Select>
        <Input label="Name" required className="sm:col-span-2" value={form.name} onChange={update('name')} />
        <Input label="Opening balance" type="number" min="0" disabled={Boolean(account)} value={form.opening_balance} onChange={update('opening_balance')} />
        {form.type === 'bank' && (
          <>
            <Input label="Bank name" value={form.bank_name} onChange={update('bank_name')} />
            <Input label="Account number" className="sm:col-span-2" value={form.account_number} onChange={update('account_number')} />
          </>
        )}
        <Textarea label="Notes" className="sm:col-span-2" value={form.notes} onChange={update('notes')} rows={2} />
        {error && <p className="text-sm text-brand-red sm:col-span-2">{error}</p>}
      </form>
    </Modal>
  );
}
