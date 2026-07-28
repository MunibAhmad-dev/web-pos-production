import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, CheckCircle2, Undo2, Wallet, Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Button from '@/components/ui/action-button';
import { Input } from '@/components/form/fields';
import Badge from '@/components/ui/status-badge';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { computeVendorLedger } from '../../utils/vendorStats';
import { formatCurrency, formatDateTime } from '../../utils/format';

const KpiCard = ({ icon: Icon, label, value, tone }) => (
  <div className="rounded-xl border border-border p-3">
    <div className={`mb-2 flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}>
      <Icon size={14} />
    </div>
    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="mt-0.5 text-sm font-semibold text-ink">{value}</p>
  </div>
);

export default function VendorRecordsSheet({ open, onClose, vendor }) {
  const { list, pushEntity } = useDataStore();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState('transactions');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paying, setPaying] = useState(false);

  const purchases = list('purchase');
  const vendorPayments = list('vendor_payment');
  const purchaseReturns = list('purchase_return');

  const ledger = useMemo(
    () => (vendor ? computeVendorLedger(vendor.id, purchases, vendorPayments, purchaseReturns) : null),
    [vendor, purchases, vendorPayments, purchaseReturns]
  );

  const timeline = useMemo(() => {
    if (!ledger) return [];
    const events = [
      ...ledger.purchases.map((po) => ({ type: 'purchase', date: po.date_created, po })),
      ...ledger.payments.map((p) => ({ type: 'payment', date: p.date_created, p })),
      ...ledger.returns.map((r) => ({ type: 'return', date: r.date_created, r })),
    ];
    return events.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [ledger]);

  const ledgerRows = useMemo(() => {
    if (!ledger) return [];
    const events = [
      ...ledger.purchases.filter((p) => p.status !== 'cancelled').map((po) => ({ label: `PO-${String(po.id).slice(-6)}`, date: po.date_created, debit: Number(po.total || 0), credit: 0 })),
      ...ledger.payments.map((p) => ({ label: 'Payment', date: p.date_created, debit: 0, credit: Number(p.amount || 0) })),
      ...ledger.returns.map((r) => ({ label: r.reason || 'Return', date: r.date_created, debit: 0, credit: Number(r.total || 0) })),
    ].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    let balance = 0;
    const withBalance = events.map((e) => {
      balance += e.debit - e.credit;
      return { ...e, balance };
    });
    return withBalance.reverse();
  }, [ledger]);

  const handleRecordPayment = async () => {
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }
    setPaying(true);
    try {
      await pushEntity('vendor_payment', 'create', {
        vendor_id: vendor.id,
        amount,
        date_created: new Date().toISOString(),
        notes: '',
        purchase_id: null,
      });
      showToast('Payment recorded');
      setPaymentAmount('');
    } finally {
      setPaying(false);
    }
  };

  if (!vendor || !ledger) return null;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[440px]">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
              {vendor.name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <SheetTitle>{vendor.name}</SheetTitle>
              <p className="truncate text-xs text-muted-foreground">
                {vendor.phone || '—'} {vendor.address ? `· ${vendor.address}` : ''}
              </p>
            </div>
          </div>
          <Button size="sm" variant="secondary" className="mt-2 w-fit" onClick={() => navigate(`/purchases?vendor_id=${vendor.id}`)}>
            <Plus size={13} /> New PO
          </Button>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="mb-4 flex items-center justify-end">
            <Badge tone={ledger.balance > 0.5 ? 'orange' : 'green'}>{ledger.balance > 0.5 ? 'Unpaid Balance' : 'Fully Settled'}</Badge>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2">
            <KpiCard icon={ShoppingBag} label="Total Purchased" value={formatCurrency(ledger.totalPurchased)} tone="bg-brand-blue/10 text-brand-blue" />
            <KpiCard icon={CheckCircle2} label="Total Paid" value={formatCurrency(ledger.totalPaid)} tone="bg-brand-green/10 text-brand-green" />
            <KpiCard icon={Undo2} label="Stock Returns" value={formatCurrency(ledger.totalReturned)} tone="bg-brand-orange/10 text-brand-orange" />
            <KpiCard
              icon={Wallet}
              label="Net Balance"
              value={formatCurrency(ledger.balance)}
              tone={ledger.balance > 0.5 ? 'bg-brand-red/10 text-brand-red' : 'bg-brand-green/10 text-brand-green'}
            />
          </div>

          <div className="mb-4 flex items-end gap-2">
            <Input
              label="Record payment sent"
              type="number"
              min="0"
              placeholder="Amount"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="flex-1"
            />
            <Button size="sm" onClick={handleRecordPayment} disabled={paying}>
              {paying ? 'Logging…' : 'Log'}
            </Button>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="ledger">Ledger</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="mt-3">
            {tab === 'transactions' && (
              <div className="flex flex-col gap-2">
                {timeline.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>}
                {timeline.map((e, idx) => {
                  if (e.type === 'purchase') {
                    const po = e.po;
                    return (
                      <div key={`po-${po.id}`} className="rounded-lg border border-border p-3 text-xs">
                        <div className="flex justify-between font-medium text-ink">
                          <span>PO-{String(po.id).slice(-6)}</span>
                          <span>{formatCurrency(po.total)}</span>
                        </div>
                        <p className="mt-0.5 text-muted-foreground">{formatDateTime(po.date_created)} · Remaining {formatCurrency(po.remaining)}</p>
                      </div>
                    );
                  }
                  if (e.type === 'payment') {
                    return (
                      <div key={`pay-${idx}`} className="flex items-center justify-between rounded-lg bg-brand-green/5 px-3 py-2 text-xs">
                        <span className="text-brand-green">Payment Sent</span>
                        <span className="font-medium text-brand-green">{formatCurrency(e.p.amount)}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={`ret-${idx}`} className="flex items-center justify-between rounded-lg bg-brand-orange/5 px-3 py-2 text-xs">
                      <span className="text-brand-orange">Return Processed</span>
                      <span className="font-medium text-brand-orange">-{formatCurrency(e.r.total)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === 'ledger' && (
              <div className="text-xs">
                <div className="grid grid-cols-4 gap-2 border-b border-border pb-1.5 font-semibold text-muted-foreground uppercase">
                  <span>Details</span>
                  <span className="text-right">Debit</span>
                  <span className="text-right">Credit</span>
                  <span className="text-right">Balance</span>
                </div>
                {ledgerRows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-4 gap-2 border-b border-border py-1.5">
                    <span className="truncate text-ink">{row.label}</span>
                    <span className="text-right text-brand-red">{row.debit ? formatCurrency(row.debit) : '—'}</span>
                    <span className="text-right text-brand-green">{row.credit ? formatCurrency(row.credit) : '—'}</span>
                    <span className="text-right font-medium text-ink">{formatCurrency(row.balance)}</span>
                  </div>
                ))}
                {ledgerRows.length === 0 && <p className="py-6 text-center text-muted-foreground">No ledger entries yet.</p>}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
