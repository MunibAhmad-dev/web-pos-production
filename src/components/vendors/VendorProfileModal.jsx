import { useMemo, useState } from 'react';
import { ChevronRight, ShoppingBag, CheckCircle2, Undo2, Package, Layers } from 'lucide-react';
import Modal from '../ui/Modal';
import Badge from '@/components/ui/status-badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDataStore } from '../../store/dataStore';
import { computeVendorLedger } from '../../utils/vendorStats';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format';

const StatRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-center justify-between py-1.5 text-xs">
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <Icon size={12} /> {label}
    </span>
    <span className="font-medium text-ink">{value}</span>
  </div>
);

function PurchaseRow({ po }) {
  const [open, setOpen] = useState(false);
  const status = po.status === 'cancelled' ? 'Cancelled' : po.remaining <= 0.5 ? 'Settled' : po.paidAgainstOrder > 0 ? 'Partial' : 'Unpaid';
  const tone = { Settled: 'green', Partial: 'orange', Unpaid: 'red', Cancelled: 'gray' }[status];

  return (
    <div className="border-b border-border last:border-0">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between py-2.5 text-left text-sm hover:bg-muted/40">
        <div className="flex items-center gap-2">
          <ChevronRight size={14} className={`text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
          <div>
            <p className="font-medium text-ink">PO-{String(po.id).slice(-6)}</p>
            <p className="text-xs text-muted-foreground">{formatDate(po.date_created)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span>{formatCurrency(po.total)}</span>
          <span className="text-brand-green">{formatCurrency(po.paidAgainstOrder)}</span>
          <span className="text-brand-orange">{formatCurrency(po.remaining)}</span>
          <Badge tone={tone}>{status}</Badge>
        </div>
      </button>
      {open && (
        <div className="mb-2 ml-5 rounded-lg bg-muted/30 p-3 text-xs">
          {(po.items || []).map((item, idx) => (
            <div key={idx} className="flex justify-between py-1">
              <span>Product #{item.product_id} × {item.qty}</span>
              <span>{formatCurrency(item.qty * item.unit_cost)}</span>
            </div>
          ))}
          {(po.items || []).length === 0 && <p className="text-muted-foreground">No line items recorded.</p>}
        </div>
      )}
    </div>
  );
}

export default function VendorProfileModal({ open, onClose, vendor }) {
  const { list } = useDataStore();
  const [tab, setTab] = useState('purchases');

  const purchases = list('purchase');
  const vendorPayments = list('vendor_payment');
  const purchaseReturns = list('purchase_return');

  const ledger = useMemo(
    () => (vendor ? computeVendorLedger(vendor.id, purchases, vendorPayments, purchaseReturns) : null),
    [vendor, purchases, vendorPayments, purchaseReturns]
  );

  if (!vendor || !ledger) return null;

  return (
    <Modal open={open} onClose={onClose} title={vendor.name} width="max-w-4xl">
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="flex w-full flex-col gap-4 sm:w-56 sm:shrink-0">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
              {vendor.name?.charAt(0).toUpperCase()}
            </div>
            <p className="font-semibold text-ink">{vendor.name}</p>
            <p className="text-xs text-muted-foreground">Vendor since {formatDate(vendor.created_at)}</p>
            {vendor.phone && <p className="text-xs text-muted-foreground">{vendor.phone}</p>}
            {vendor.address && <p className="text-xs text-muted-foreground">{vendor.address}</p>}
          </div>

          <div className="rounded-xl border border-border p-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Amount Owed</p>
            <p className={`mt-1 text-lg font-semibold ${ledger.balance > 0.5 ? 'text-brand-red' : 'text-brand-green'}`}>
              {ledger.balance > 0.5 ? formatCurrency(ledger.balance) : 'All settled ✓'}
            </p>
          </div>

          <div className="rounded-xl border border-border p-3">
            <p className="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Lifetime Stats</p>
            <StatRow icon={ShoppingBag} label="Total Purchased" value={formatCurrency(ledger.totalPurchased)} />
            <StatRow icon={CheckCircle2} label="Total Paid" value={formatCurrency(ledger.totalPaid)} />
            <StatRow icon={Undo2} label="Total Returned" value={formatCurrency(ledger.totalReturned)} />
            <StatRow icon={Layers} label="Total Orders" value={ledger.totalOrders} />
            <StatRow icon={CheckCircle2} label="Settled Orders" value={`${ledger.settledOrders} / ${ledger.totalOrders}`} />
            <StatRow icon={Package} label="Products Supplied" value={ledger.productsSupplied} />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="purchases">Purchases ({ledger.totalOrders})</TabsTrigger>
              <TabsTrigger value="payments">Payments ({ledger.payments.length})</TabsTrigger>
              <TabsTrigger value="returns">Returns ({ledger.returns.length})</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="mt-3">
            {tab === 'purchases' && (
              <div>
                {ledger.purchases.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No purchase orders yet.</p>}
                {ledger.purchases.map((po) => (
                  <PurchaseRow key={po.id} po={po} />
                ))}
              </div>
            )}
            {tab === 'payments' && (
              <div className="divide-y divide-border">
                {ledger.payments.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No payments recorded yet.</p>}
                {ledger.payments.map((p) => (
                  <div key={p.id} className="flex justify-between py-2 text-sm">
                    <span className="text-muted-foreground">{formatDateTime(p.date_created)}</span>
                    <span className="font-medium text-brand-green">{formatCurrency(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            {tab === 'returns' && (
              <div className="divide-y divide-border">
                {ledger.returns.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No returns yet.</p>}
                {ledger.returns.map((r) => (
                  <div key={r.id} className="flex justify-between py-2 text-sm">
                    <div>
                      <p className="text-ink">{r.reason || 'Return'}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(r.date_created)}</p>
                    </div>
                    <span className="font-medium text-brand-orange">{formatCurrency(r.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
