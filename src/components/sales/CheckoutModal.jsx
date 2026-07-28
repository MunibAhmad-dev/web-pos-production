import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '@/components/ui/action-button';
import { Select, Input } from '@/components/form/fields';
import Badge from '@/components/ui/status-badge';
import { formatCurrency } from '../../utils/format';

const paymentOptions = [
  { key: 'cash', label: 'Cash' },
  { key: 'online', label: 'Online' },
  { key: 'credit', label: 'Udhaar' },
];

// Matches the desktop checkout modal: Amount Paid is editable for Cash/Online
// (partial payment allowed, remainder goes to the customer's Qaraz/credit
// balance — requires a customer, blocked for walk-in), and forced to 0 for
// Udhaar (full credit only).
export default function CheckoutModal({ open, onClose, onConfirm, total, customers, onAddCustomer }) {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customerId, setCustomerId] = useState('');
  const [amountPaid, setAmountPaid] = useState(String(total));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setPaymentMethod('cash');
      setCustomerId('');
      setAmountPaid(String(total));
      setError('');
    }
  }, [open, total]);

  useEffect(() => {
    if (paymentMethod === 'credit') setAmountPaid('0');
    else setAmountPaid(String(total));
  }, [paymentMethod, total]);

  const paid = Number(amountPaid) || 0;
  const remaining = Math.max(0, total - paid);

  const handleConfirm = async () => {
    setError('');
    if (paid > total) {
      setError('Amount paid cannot exceed the total');
      return;
    }
    if (remaining > 0.01 && !customerId) {
      setError(paymentMethod === 'credit' ? 'Udhaar requires a customer' : "Walk-in customers can't have partial payments — select a customer or pay in full");
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm({ paymentMethod, customerId, amountPaid: paid });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Complete Sale"
      width="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Processing…' : 'Complete Sale'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-1.5">
          {paymentOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setPaymentMethod(opt.key)}
              className={`rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
                paymentMethod === opt.key
                  ? 'border-primary bg-primary text-primary-foreground'
                  : opt.key === 'credit'
                    ? 'border-border text-destructive hover:bg-destructive/5'
                    : 'border-border text-foreground hover:bg-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} label="Customer">
              <option value="">Walk-in Customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="button" variant="secondary" onClick={onAddCustomer}>
            + New
          </Button>
        </div>
        {!customerId && <Badge tone="gray">Guest</Badge>}

        <div className="rounded-lg border border-border p-3">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Total Amount</span>
            <span className="font-semibold text-ink">{formatCurrency(total)}</span>
          </div>
          <div className="mt-2">
            <Input
              label="Amount Paid (PKR)"
              type="number"
              min="0"
              max={total}
              disabled={paymentMethod === 'credit'}
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
            />
          </div>
          {remaining > 0.01 && (
            <p className="mt-2 text-xs text-brand-orange">
              Remaining {formatCurrency(remaining)} → {customerId ? "customer's Qaraz" : 'select a customer'}
            </p>
          )}
        </div>

        {error && <p className="text-sm text-brand-red">{error}</p>}
      </div>
    </Modal>
  );
}
