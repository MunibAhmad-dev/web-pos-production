import Modal from '../ui/Modal';
import Button from '@/components/ui/action-button';
import { formatCurrency, formatDateTime } from '../../utils/format';

export default function ReceiptModal({ open, onClose, sale, businessName, currency }) {
  if (!sale) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sale Complete"
      width="max-w-sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => window.print()}>Print Receipt</Button>
        </>
      }
    >
      <div id="receipt" className="flex flex-col gap-3 text-sm">
        <div className="text-center">
          <p className="font-semibold text-ink">{businessName}</p>
          <p className="text-xs text-muted-foreground">{sale.invoiceNo}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(sale.createdAt || Date.now())}</p>
        </div>
        <div className="divide-y divide-border border-y border-border">
          {sale.items.map((item, idx) => (
            <div key={item.product || `custom-${idx}`} className="flex justify-between py-1.5">
              <span>
                {item.name} × {item.qty}
              </span>
              <span>{formatCurrency(item.lineTotal, currency)}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatCurrency(sale.subtotal, currency)}</span>
          </div>
          {sale.discount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Discount</span>
              <span>-{formatCurrency(sale.discount, currency)}</span>
            </div>
          )}
          {sale.tax > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Tax</span>
              <span>{formatCurrency(sale.tax, currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold text-ink">
            <span>Total</span>
            <span>{formatCurrency(sale.total, currency)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Paid ({sale.paymentMethod})</span>
            <span>{formatCurrency(sale.amountPaid, currency)}</span>
          </div>
          {sale.dueAmount > 0 && (
            <div className="flex justify-between font-medium text-brand-orange">
              <span>Due</span>
              <span>{formatCurrency(sale.dueAmount, currency)}</span>
            </div>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground">Thank you for your purchase!</p>
      </div>
    </Modal>
  );
}
