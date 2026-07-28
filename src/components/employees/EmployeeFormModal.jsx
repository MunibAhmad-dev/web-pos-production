import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '@/components/ui/action-button';
import { Input, Textarea } from '@/components/form/fields';

const emptyForm = { name: '', role: '', monthly_salary: '', phone: '', notes: '' };

export default function EmployeeFormModal({ open, onClose, onSubmit, employee }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(
      employee
        ? {
            name: employee.name || '',
            role: employee.role || '',
            monthly_salary: employee.monthly_salary ?? '',
            phone: employee.phone || '',
            notes: employee.notes || '',
          }
        : emptyForm
    );
    setError('');
  }, [employee, open]);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSubmit({ ...form, monthly_salary: Number(form.monthly_salary) || 0 });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to save employee');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={employee ? 'Edit Employee' : 'Add Employee'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Save Employee'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Name" required className="sm:col-span-2" value={form.name} onChange={update('name')} />
        <Input label="Role" value={form.role} onChange={update('role')} placeholder="e.g. Cashier" />
        <Input label="Monthly salary" type="number" min="0" value={form.monthly_salary} onChange={update('monthly_salary')} />
        <Input label="Phone" value={form.phone} onChange={update('phone')} />
        <Textarea label="Notes" className="sm:col-span-2" value={form.notes} onChange={update('notes')} rows={2} />
        {error && <p className="text-sm text-brand-red sm:col-span-2">{error}</p>}
      </form>
    </Modal>
  );
}
