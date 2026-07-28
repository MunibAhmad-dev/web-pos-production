import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '@/components/ui/action-button';
import { Input, Select } from '@/components/form/fields';
import { DatePicker } from '@/components/form/date-picker';

const categories = ['Rent', 'Utilities', 'Salaries', 'Supplies', 'Maintenance', 'Marketing', 'Transport', 'Other'];

export default function ExpenseFormModal({ open, onClose, onSubmit }) {
  const [form, setForm] = useState({ category: categories[0], amount: '', description: '', date: new Date().toISOString().slice(0, 10) });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSubmit({ ...form, amount: Number(form.amount) });
      setForm({ category: categories[0], amount: '', description: '', date: new Date().toISOString().slice(0, 10) });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to save expense');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Expense"
      width="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Save Expense'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select label="Category" value={form.category} onChange={update('category')}>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Input label="Amount" type="number" min="0" required value={form.amount} onChange={update('amount')} />
        <Input label="Description (optional)" value={form.description} onChange={update('description')} />
        <DatePicker label="Date" value={form.date} onChange={update('date')} />
        {error && <p className="text-sm text-brand-red">{error}</p>}
      </form>
    </Modal>
  );
}
