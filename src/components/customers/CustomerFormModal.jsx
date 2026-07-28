import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '@/components/ui/action-button';
import { Input, Textarea } from '@/components/form/fields';

const emptyForm = { name: '', phone: '', email: '', address: '', notes: '' };

export default function CustomerFormModal({ open, onClose, onSubmit, customer }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(
      customer
        ? { name: customer.name || '', phone: customer.phone || '', email: customer.email || '', address: customer.address || '', notes: customer.notes || '' }
        : emptyForm
    );
    setError('');
  }, [customer, open]);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? 'Edit Customer' : 'Add Customer'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Save Customer'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Name" required className="sm:col-span-2" value={form.name} onChange={update('name')} />
        <Input label="Phone" value={form.phone} onChange={update('phone')} />
        <Input label="Email" type="email" value={form.email} onChange={update('email')} />
        <Input label="Address" className="sm:col-span-2" value={form.address} onChange={update('address')} />
        <Textarea label="Notes" className="sm:col-span-2" value={form.notes} onChange={update('notes')} rows={2} />
        {error && <p className="text-sm text-brand-red sm:col-span-2">{error}</p>}
      </form>
    </Modal>
  );
}
