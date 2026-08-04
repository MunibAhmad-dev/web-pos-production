import { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Scale, Search, X,
  ChevronRight, ArrowDownLeft, ArrowUpRight, CreditCard,
  Phone, User, Truck,
} from 'lucide-react';
import { useDataStore } from '../../store/dataStore';
import { pushEntity, nextId } from '../../api/syncClient';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';
import { computeVendorLedger } from '../../utils/vendorStats';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtPKR = (n) =>
  'PKR ' + Math.round(Math.abs(n || 0)).toLocaleString('en-PK');

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ── Balance computation helpers ──────────────────────────────────────────────
function computeCustomerBalance(customerId, allSales, allPayments, allReturns) {
  const cid = String(customerId);
  const taken = allSales
    .filter((s) => String(s.customer_id) === cid && s.status !== 'cancelled' && s.status !== 'Cancelled')
    .reduce((a, s) => a + (Number(s.total) || 0), 0);
  const paid = allPayments
    .filter((p) => String(p.customer_id) === cid)
    .reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const ret = allReturns
    .filter((r) => String(r.customer_id) === cid)
    .reduce((a, r) => a + (Number(r.total_returned) || 0), 0);
  return Math.max(0, taken - paid - ret);
}

function computeCustomerDetail(customerId, allSales, allPayments, allReturns) {
  const cid = String(customerId);
  const sales = allSales
    .filter((s) => String(s.customer_id) === cid && s.status !== 'cancelled' && s.status !== 'Cancelled')
    .sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0));
  const payments = allPayments
    .filter((p) => String(p.customer_id) === cid)
    .sort((a, b) => new Date(b.date_added || b.created_at || 0) - new Date(a.date_added || a.created_at || 0));
  const returns = allReturns
    .filter((r) => String(r.customer_id) === cid || sales.some((s) => String(s.id) === String(r.sale_id)))
    .sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0));
  const totalTaken = sales.reduce((a, s) => a + (Number(s.total) || 0), 0);
  const totalPaid  = payments.reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const totalRet   = returns.reduce((a, r) => a + (Number(r.total_returned) || 0), 0);
  return { sales, payments, returns, totalTaken, totalPaid, totalReturned: totalRet, balance: Math.max(0, totalTaken - totalPaid - totalRet) };
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, Icon, color }) {
  return (
    <div className={cn('rounded-2xl border p-4 flex items-center gap-4', color.bg, color.border)}>
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', color.iconBg)}>
        <Icon size={18} className={color.icon} />
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className={cn('text-xl font-black tabular-nums', color.text)}>{value}</p>
      </div>
    </div>
  );
}

// ── Detail Panel (slide-in from right) ───────────────────────────────────────
function CustomerDetailPanel({ customer, detail, onClose, onPaymentRecorded }) {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handlePay = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    if (amt > detail.balance + 0.5) { alert(`Cannot exceed balance of ${fmtPKR(detail.balance)}`); return; }
    setSaving(true);
    try {
      const id = nextId();
      await pushEntity('customer_payment', 'create', {
        id, customer_id: customer.id, amount: amt,
        notes: notes.trim() || `Payment from ${customer.name}`,
        date_added: new Date().toISOString(),
      });
      onPaymentRecorded();
      setAmount(''); setNotes('');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md h-full bg-background border-l border-border/60 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <User size={15} className="text-amber-600" />
            </div>
            <div>
              <p className="font-bold text-sm">{customer.name}</p>
              {customer.phone && <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Phone size={10} />{customer.phone}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Balance banner */}
        <div className={cn('mx-4 mt-4 mb-2 rounded-xl border p-3 text-center', detail.balance > 0 ? 'bg-amber-500/8 border-amber-500/25' : 'bg-emerald-500/8 border-emerald-500/25')}>
          <p className={cn('text-2xl font-black tabular-nums', detail.balance > 0 ? 'text-amber-600' : 'text-emerald-600')}>{fmtPKR(detail.balance)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{detail.balance > 0 ? 'Outstanding' : 'Settled'}</p>
          <div className="flex justify-center gap-4 mt-2 text-[11px] text-muted-foreground">
            <span>Taken: <strong className="text-foreground">{fmtPKR(detail.totalTaken)}</strong></span>
            <span>Paid: <strong className="text-emerald-600">{fmtPKR(detail.totalPaid)}</strong></span>
            {detail.totalReturned > 0 && <span>Returned: <strong className="text-blue-600">{fmtPKR(detail.totalReturned)}</strong></span>}
          </div>
        </div>

        {/* Quick pay */}
        {detail.balance > 0 && (
          <div className="mx-4 mb-3 bg-muted/30 rounded-xl border border-border/40 p-3 space-y-2 shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Record Payment</p>
            <div className="flex gap-2">
              <Input
                type="number" min="1" max={detail.balance}
                value={amount} onChange={e => setAmount(e.target.value)}
                placeholder={String(Math.round(detail.balance))}
                className="h-9 text-sm flex-1"
              />
              <Button size="sm" onClick={handlePay} disabled={saving || !amount} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white h-9 shrink-0">
                {saving ? 'Saving…' : 'Receive'}
              </Button>
            </div>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" className="h-8 text-xs" />
          </div>
        )}

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-1">History</p>
          {[
            ...detail.sales.map(s => ({ kind: 'sale', date: s.date_created, id: s.id, amount: s.total, remaining: Math.max(0, Number(s.total) - detail.payments.filter(p => String(p.sale_id) === String(s.id)).reduce((a, p) => a + Number(p.amount), 0)) })),
            ...detail.payments.map(p => ({ kind: 'payment', date: p.date_added || p.created_at, id: p.id, amount: p.amount })),
            ...detail.returns.map(r => ({ kind: 'return', date: r.date_created, id: r.id, amount: r.total_returned })),
          ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).map((row) => (
            <div key={`${row.kind}-${row.id}`} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border/30 bg-card">
              <div className="flex items-center gap-2">
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                  row.kind === 'payment' ? 'bg-emerald-500/10' : row.kind === 'return' ? 'bg-blue-500/10' : 'bg-amber-500/10')}>
                  {row.kind === 'payment' ? <ArrowDownLeft size={12} className="text-emerald-600" /> :
                   row.kind === 'return' ? <ArrowUpRight size={12} className="text-blue-600" /> :
                   <CreditCard size={12} className="text-amber-600" />}
                </div>
                <div>
                  <p className="text-xs font-semibold capitalize">
                    {row.kind === 'sale' ? `Sale #${row.id}` : row.kind === 'payment' ? 'Payment received' : 'Return refund'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{fmtDate(row.date)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn('text-xs font-bold tabular-nums', row.kind === 'payment' ? 'text-emerald-600' : row.kind === 'return' ? 'text-blue-600' : 'text-amber-600')}>
                  {row.kind === 'payment' ? '+' : ''}{fmtPKR(row.amount)}
                </p>
                {row.kind === 'sale' && row.remaining > 0.5 && (
                  <p className="text-[10px] text-muted-foreground">Due: {fmtPKR(row.remaining)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VendorDetailPanel({ vendor, ledger, onClose, onPaymentRecorded }) {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handlePay = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    if (amt > ledger.balance + 0.5) { alert(`Cannot exceed balance of ${fmtPKR(ledger.balance)}`); return; }
    setSaving(true);
    try {
      const id = nextId();
      await pushEntity('vendor_payment', 'create', {
        id, vendor_id: vendor.id, amount: amt,
        notes: notes.trim() || `Payment to ${vendor.name}`,
        date_created: new Date().toISOString(),
      });
      onPaymentRecorded();
      setAmount(''); setNotes('');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md h-full bg-background border-l border-border/60 shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <Truck size={15} className="text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-sm">{vendor.name}</p>
              {vendor.phone && <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Phone size={10} />{vendor.phone}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className={cn('mx-4 mt-4 mb-2 rounded-xl border p-3 text-center', ledger.balance > 0 ? 'bg-blue-500/8 border-blue-500/25' : 'bg-emerald-500/8 border-emerald-500/25')}>
          <p className={cn('text-2xl font-black tabular-nums', ledger.balance > 0 ? 'text-blue-600' : 'text-emerald-600')}>{fmtPKR(ledger.balance)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{ledger.balance > 0 ? 'We Owe' : 'Settled'}</p>
          <div className="flex justify-center gap-4 mt-2 text-[11px] text-muted-foreground">
            <span>Purchased: <strong className="text-foreground">{fmtPKR(ledger.totalPurchased)}</strong></span>
            <span>Paid: <strong className="text-emerald-600">{fmtPKR(ledger.totalPaid)}</strong></span>
          </div>
        </div>

        {ledger.balance > 0 && (
          <div className="mx-4 mb-3 bg-muted/30 rounded-xl border border-border/40 p-3 space-y-2 shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Record Payment</p>
            <div className="flex gap-2">
              <Input type="number" min="1" max={ledger.balance} value={amount} onChange={e => setAmount(e.target.value)} placeholder={String(Math.round(ledger.balance))} className="h-9 text-sm flex-1" />
              <Button size="sm" onClick={handlePay} disabled={saving || !amount} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white h-9 shrink-0">
                {saving ? 'Saving…' : 'Pay'}
              </Button>
            </div>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" className="h-8 text-xs" />
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-1">Purchase History</p>
          {ledger.purchases.map(po => (
            <div key={po.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border/30 bg-card">
              <div>
                <p className="text-xs font-semibold">PO-{String(po.id).padStart(4,'0')}</p>
                <p className="text-[10px] text-muted-foreground">{fmtDate(po.date_created)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold tabular-nums text-blue-600">{fmtPKR(po.total)}</p>
                {po.remaining > 0.5 ? <p className="text-[10px] text-amber-500">Due: {fmtPKR(po.remaining)}</p>
                  : <p className="text-[10px] text-emerald-600">Settled</p>}
              </div>
            </div>
          ))}
          {ledger.payments.length > 0 && (
            <>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-1 pt-3">Payments Made</p>
              {ledger.payments.map(p => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border/30 bg-card">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <ArrowUpRight size={12} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold">Payment sent</p>
                      <p className="text-[10px] text-muted-foreground">{fmtDate(p.date_created)}</p>
                    </div>
                  </div>
                  <p className="text-xs font-bold text-emerald-600 tabular-nums">{fmtPKR(p.amount)}</p>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LoansPage() {
  const { list, refresh } = useDataStore();
  const [tab, setTab] = useState('receivables');
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedVendor, setSelectedVendor] = useState(null);

  const customers      = list('customer');
  const vendors        = list('vendor');
  const allSales       = list('sale');
  const allPayments    = list('customer_payment');
  const allReturns     = list('sale_return');
  const allPurchases   = list('purchase');
  const vendorPayments = list('vendor_payment');
  const purchaseReturns = list('purchase_return');

  // Precompute all customer balances
  const customerRows = useMemo(() => {
    return customers
      .map(c => ({ ...c, balance: computeCustomerBalance(c.id, allSales, allPayments, allReturns) }))
      .filter(c => c.balance > 0.5)
      .sort((a, b) => b.balance - a.balance);
  }, [customers, allSales, allPayments, allReturns]);

  // Precompute all vendor balances
  const vendorRows = useMemo(() => {
    return vendors
      .map(v => {
        const ledger = computeVendorLedger(v.id, allPurchases, vendorPayments, purchaseReturns);
        return { ...v, balance: ledger.balance };
      })
      .filter(v => v.balance > 0.5)
      .sort((a, b) => b.balance - a.balance);
  }, [vendors, allPurchases, vendorPayments, purchaseReturns]);

  const totalReceivable = useMemo(() => customerRows.reduce((a, c) => a + c.balance, 0), [customerRows]);
  const totalPayable    = useMemo(() => vendorRows.reduce((a, v) => a + v.balance, 0), [vendorRows]);
  const netPosition     = totalReceivable - totalPayable;

  const q = search.trim().toLowerCase();
  const filteredCustomers = useMemo(() => customerRows.filter(c => !q || c.name?.toLowerCase().includes(q) || c.phone?.includes(q)), [customerRows, q]);
  const filteredVendors   = useMemo(() => vendorRows.filter(v => !q || v.name?.toLowerCase().includes(q) || v.phone?.includes(q)), [vendorRows, q]);

  const selectedCustomerDetail = useMemo(() => {
    if (!selectedCustomer) return null;
    return computeCustomerDetail(selectedCustomer.id, allSales, allPayments, allReturns);
  }, [selectedCustomer, allSales, allPayments, allReturns]);

  const selectedVendorLedger = useMemo(() => {
    if (!selectedVendor) return null;
    return computeVendorLedger(selectedVendor.id, allPurchases, vendorPayments, purchaseReturns);
  }, [selectedVendor, allPurchases, vendorPayments, purchaseReturns]);

  const handlePaymentRecorded = () => {
    refresh();
    setSelectedCustomer(null);
    setSelectedVendor(null);
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
          <span>Home</span><ChevronRight size={12} /><span className="text-foreground font-medium">Loans & Ledger</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Loans &amp; Ledger</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Receivable from customers · Payable to vendors</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Total Receivable"
          value={fmtPKR(totalReceivable)}
          Icon={TrendingUp}
          color={{ bg: 'bg-amber-500/5', border: 'border-amber-500/20', iconBg: 'bg-amber-500/10', icon: 'text-amber-600', text: 'text-amber-600' }}
        />
        <KpiCard
          label="Total Payable"
          value={fmtPKR(totalPayable)}
          Icon={TrendingDown}
          color={{ bg: 'bg-blue-500/5', border: 'border-blue-500/20', iconBg: 'bg-blue-500/10', icon: 'text-blue-600', text: 'text-blue-600' }}
        />
        <KpiCard
          label="Net Position"
          value={fmtPKR(netPosition)}
          Icon={Scale}
          color={
            netPosition >= 0
              ? { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', iconBg: 'bg-emerald-500/10', icon: 'text-emerald-600', text: 'text-emerald-600' }
              : { bg: 'bg-rose-500/5', border: 'border-rose-500/20', iconBg: 'bg-rose-500/10', icon: 'text-rose-600', text: 'text-rose-600' }
          }
        />
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex gap-1 p-1 rounded-xl bg-muted/60 border border-border/40 w-fit shrink-0">
          {[
            { key: 'receivables', label: `Receivable (${customerRows.length})`, color: 'text-amber-600' },
            { key: 'payables',    label: `Payable (${vendorRows.length})`,    color: 'text-blue-600' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'px-4 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200',
                tab === t.key
                  ? `bg-background shadow-sm border border-border/60 ${t.color}`
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'receivables' ? 'Search customers…' : 'Search vendors…'}
            className="pl-9 h-10 text-sm"
          />
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
        {/* Header row */}
        <div className="hidden md:grid grid-cols-[1fr_160px_160px] gap-3 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/40 bg-muted/20">
          <span>{tab === 'receivables' ? 'Customer' : 'Vendor'}</span>
          <span className="text-right">Outstanding</span>
          <span className="text-right">Action</span>
        </div>

        {tab === 'receivables' && (
          filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <TrendingUp size={28} className="opacity-30" />
              <p className="text-sm">{q ? `No customers match "${q}"` : 'No outstanding receivables 🎉'}</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {filteredCustomers.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCustomer(c)}
                  className="w-full grid grid-cols-2 md:grid-cols-[1fr_160px_160px] gap-3 items-center px-5 py-3.5 text-left hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 text-xs font-bold text-amber-600">
                      {(c.name?.[0] || 'C').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{c.name}</p>
                      {c.phone && <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1"><Phone size={9} />{c.phone}</p>}
                    </div>
                  </div>
                  <p className="text-sm font-bold text-amber-600 text-right tabular-nums">{fmtPKR(c.balance)}</p>
                  <div className="hidden md:flex justify-end">
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/25">View / Pay</span>
                  </div>
                </button>
              ))}
            </div>
          )
        )}

        {tab === 'payables' && (
          filteredVendors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <TrendingDown size={28} className="opacity-30" />
              <p className="text-sm">{q ? `No vendors match "${q}"` : 'No outstanding payables 🎉'}</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {filteredVendors.map(v => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVendor(v)}
                  className="w-full grid grid-cols-2 md:grid-cols-[1fr_160px_160px] gap-3 items-center px-5 py-3.5 text-left hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 text-xs font-bold text-blue-600">
                      {(v.name?.[0] || 'V').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{v.name}</p>
                      {v.phone && <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1"><Phone size={9} />{v.phone}</p>}
                    </div>
                  </div>
                  <p className="text-sm font-bold text-blue-600 text-right tabular-nums">{fmtPKR(v.balance)}</p>
                  <div className="hidden md:flex justify-end">
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/25">View / Pay</span>
                  </div>
                </button>
              ))}
            </div>
          )
        )}
      </div>

      {/* Detail panels */}
      {selectedCustomer && selectedCustomerDetail && (
        <CustomerDetailPanel
          customer={selectedCustomer}
          detail={selectedCustomerDetail}
          onClose={() => setSelectedCustomer(null)}
          onPaymentRecorded={handlePaymentRecorded}
        />
      )}
      {selectedVendor && selectedVendorLedger && (
        <VendorDetailPanel
          vendor={selectedVendor}
          ledger={selectedVendorLedger}
          onClose={() => setSelectedVendor(null)}
          onPaymentRecorded={handlePaymentRecorded}
        />
      )}
    </div>
  );
}
