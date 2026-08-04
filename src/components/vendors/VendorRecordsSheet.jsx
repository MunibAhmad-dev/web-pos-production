import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, CheckCircle2, Undo2, Wallet, Plus, ChevronRight, X, Check, Trash2, CreditCard, Package } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Button from '@/components/ui/action-button';
import { Input } from '@/components/form/fields';
import Badge from '@/components/ui/status-badge';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { computeVendorLedger } from '../../utils/vendorStats';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format';
import { cn } from '@/lib/utils';

const fmtPKR = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const fmtDateShort = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }) : '—';

function poStatus(po) {
  if (po.status === 'cancelled') return { label: 'Cancelled', tone: 'gray' };
  if (po.remaining <= 0.5) return { label: 'Settled', tone: 'green' };
  if (po.paidAgainstOrder > 0) return { label: 'Partial', tone: 'orange' };
  return { label: 'Unpaid', tone: 'red' };
}

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

  // Per-PO inline payment state
  const [payingPoId, setPayingPoId] = useState(null);
  const [poPayAmount, setPoPayAmount] = useState('');
  const [poPayNotes, setPoPayNotes] = useState('');
  const [savingPoPay, setSavingPoPay] = useState(false);

  // Expanded PO state
  const [expandedPoId, setExpandedPoId] = useState(null);

  const purchases = list('purchase');
  const vendorPayments = list('vendor_payment');
  const purchaseReturns = list('purchase_return');

  const ledger = useMemo(
    () => (vendor ? computeVendorLedger(vendor.id, purchases, vendorPayments, purchaseReturns) : null),
    [vendor, purchases, vendorPayments, purchaseReturns]
  );

  const ledgerRows = useMemo(() => {
    if (!ledger) return [];
    const events = [
      ...ledger.purchases.filter((p) => p.status !== 'cancelled').map((po) => ({ label: `PO-${String(po.id).slice(-6)}`, date: po.date_created, debit: Number(po.total || 0), credit: 0 })),
      ...ledger.payments.map((p) => ({ label: 'Payment', date: p.date_created, debit: 0, credit: Number(p.amount || 0) })),
      ...ledger.returns.map((r) => ({ label: r.reason || 'Return', date: r.date_created, debit: 0, credit: Number(r.total || 0) })),
    ].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    let balance = 0;
    return events.map((e) => {
      balance += e.debit - e.credit;
      return { ...e, balance };
    }).reverse();
  }, [ledger]);

  const handleRecordPayment = async (purchaseId) => {
    const amount = purchaseId ? Number(poPayAmount) : Number(paymentAmount);
    if (!amount || amount <= 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }
    if (purchaseId) {
      setSavingPoPay(true);
    } else {
      setPaying(true);
    }
    try {
      await pushEntity('vendor_payment', 'create', {
        vendor_id: vendor.id,
        amount,
        date_created: new Date().toISOString(),
        notes: purchaseId ? (poPayNotes || '') : '',
        purchase_id: purchaseId || null,
      });
      showToast('Payment recorded');
      if (purchaseId) {
        setPayingPoId(null);
        setPoPayAmount('');
        setPoPayNotes('');
      } else {
        setPaymentAmount('');
      }
    } finally {
      setSavingPoPay(false);
      setPaying(false);
    }
  };

  const handleClearFull = async () => {
    if (!ledger || ledger.balance <= 0.5) return;
    setPaying(true);
    try {
      await pushEntity('vendor_payment', 'create', {
        vendor_id: vendor.id,
        amount: Math.round(ledger.balance),
        date_created: new Date().toISOString(),
        notes: 'Full balance cleared',
        purchase_id: null,
      });
      showToast('Full balance cleared');
      setPaymentAmount('');
    } finally {
      setPaying(false);
    }
  };

  const deletePayment = async (paymentId) => {
    await pushEntity('vendor_payment', 'delete', { id: paymentId });
    showToast('Payment removed');
  };

  if (!vendor || !ledger) return null;

  const pendingPOs = ledger.purchases.filter((po) => po.remaining > 0.5 && po.status !== 'cancelled');
  const paidPct = ledger.totalPurchased > 0 ? Math.round((ledger.totalPaid / ledger.totalPurchased) * 100) : 0;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] flex flex-col p-0">
        <SheetHeader className="px-4 pt-5 pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-base font-bold text-primary">
              {vendor.name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-sm">{vendor.name}</SheetTitle>
              <p className="truncate text-xs text-muted-foreground">
                {vendor.phone || '—'}{vendor.address ? ` · ${vendor.address}` : ''}
              </p>
            </div>
            <Button size="sm" variant="secondary" className="shrink-0" onClick={() => { onClose(); navigate(`/purchases?vendor_id=${vendor.id}`); }}>
              <Plus size={13} /> New PO
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4 mt-4">
          {/* Balance + general payment */}
          <div className={cn('rounded-xl p-4 border text-center', ledger.balance > 0.5 ? 'bg-rose-500/8 border-rose-500/20' : 'bg-emerald-500/8 border-emerald-500/20')}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Amount Owed (Baqi)</p>
            <p className={cn('text-2xl font-black tabular-nums', ledger.balance > 0.5 ? 'text-rose-600' : 'text-emerald-600')}>
              {fmtPKR(ledger.balance)}
            </p>
            {ledger.balance <= 0.5 && <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">All settled ✓</p>}
          </div>

          {ledger.balance > 0.5 && (
            <div className="space-y-2">
              <div className="flex items-end gap-2">
                <Input
                  label="Record payment sent"
                  type="number"
                  min="0"
                  placeholder="Amount (PKR)"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="flex-1"
                />
                <Button size="sm" onClick={() => handleRecordPayment(null)} disabled={paying} className="shrink-0">
                  {paying ? 'Logging…' : 'Log'}
                </Button>
              </div>
              <button
                onClick={handleClearFull}
                disabled={paying}
                className="w-full h-9 rounded-lg border border-emerald-400/50 text-emerald-600 hover:bg-emerald-500/10 text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Check size={13} /> Clear Full Balance — {fmtPKR(ledger.balance)}
              </button>
            </div>
          )}

          {/* KPI mini row */}
          <div className="grid grid-cols-2 gap-2">
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

          {/* Tabs */}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="ledger">Ledger</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* TRANSACTIONS */}
          {tab === 'transactions' && (
            <div className="space-y-2">
              {ledger.purchases.length === 0 && ledger.payments.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
              )}

              {/* Purchase orders with expandable detail + per-PO payment */}
              {ledger.purchases.map((po) => {
                const st = poStatus(po);
                const isExpanded = expandedPoId === po.id;
                const paidPct = po.total > 0 ? Math.min(100, Math.round((po.paidAgainstOrder / po.total) * 100)) : 0;
                const poRef = `PO #${String(po.id).slice(-5)}`;

                return (
                  <div key={po.id} className={cn('rounded-xl border overflow-hidden transition-all', isExpanded ? 'border-primary/30 shadow-sm' : 'border-border/60')}>
                    {/* PO header row */}
                    <button
                      className="w-full px-4 py-3 hover:bg-muted/20 transition-colors text-left"
                      onClick={() => setExpandedPoId(isExpanded ? null : po.id)}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <ChevronRight size={13} className={cn('text-muted-foreground/50 shrink-0 transition-transform', isExpanded && 'rotate-90 text-primary')} />
                          <span className="text-xs font-bold text-foreground">{poRef}</span>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">{fmtDateShort(po.date_created)}</span>
                      </div>
                      <div className="ml-5 grid grid-cols-3 gap-2 text-xs mb-2">
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Total</p>
                          <p className="font-bold tabular-nums">{fmtPKR(po.total)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Paid</p>
                          <p className="font-semibold text-emerald-600 tabular-nums">{fmtPKR(po.paidAgainstOrder)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Remaining</p>
                          <p className={cn('font-bold tabular-nums', po.remaining > 0.5 ? 'text-rose-600' : 'text-muted-foreground')}>{fmtPKR(Math.max(0, po.remaining))}</p>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="ml-5">
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', po.remaining <= 0.5 ? 'bg-emerald-500' : paidPct > 0 ? 'bg-amber-500' : 'bg-rose-400')}
                            style={{ width: `${paidPct}%` }}
                          />
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-0.5">{paidPct}% paid</p>
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t border-border/40 bg-muted/10">
                        {/* Items */}
                        {(po.items || []).length > 0 && (
                          <div className="px-4 pt-3 pb-2">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                              <Package size={9} className="inline mr-1" /> Items
                            </p>
                            <div className="space-y-1">
                              {po.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-xs">
                                  <span className="text-foreground/80 truncate mr-2">
                                    {item.product_name || `Product #${item.product_id}`} ×{item.quantity ?? item.qty}
                                  </span>
                                  <span className="text-muted-foreground tabular-nums shrink-0">
                                    {fmtPKR((Number(item.cost_price || item.purchase_price || item.unit_cost || 0)) * Number(item.quantity ?? item.qty ?? 0))}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Payments on this PO */}
                        {(po.payments || []).length > 0 && (
                          <div className="px-4 py-2 border-t border-border/30 space-y-1">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                              <CreditCard size={9} className="inline mr-1" /> Payments on this order
                            </p>
                            {(po.payments || []).map((p) => (
                              <div key={p.id} className="flex items-center justify-between text-xs rounded-lg bg-emerald-500/5 border border-emerald-500/15 px-3 py-1.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  <span className="text-muted-foreground">{fmtDateShort(p.date_created)}</span>
                                  {p.notes && <span className="text-muted-foreground/60 truncate">· {p.notes}</span>}
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  <span className="font-bold text-emerald-600 tabular-nums">{fmtPKR(p.amount)}</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); deletePayment(p.id); }}
                                    className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Inline pay for this PO */}
                        {po.remaining > 0.5 && po.status !== 'cancelled' && (
                          <div className="px-4 py-3 border-t border-border/30">
                            {payingPoId === po.id ? (
                              <div className="space-y-2">
                                <div className="flex gap-2">
                                  <div className="relative flex-1">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold">PKR</span>
                                    <input
                                      type="number" autoFocus min="0"
                                      value={poPayAmount}
                                      onChange={(e) => setPoPayAmount(e.target.value)}
                                      placeholder={`Due: ${Math.round(po.remaining).toLocaleString()}`}
                                      className="w-full pl-10 h-8 text-xs rounded-md border border-border bg-background focus:outline-none"
                                    />
                                  </div>
                                  <input
                                    value={poPayNotes}
                                    onChange={(e) => setPoPayNotes(e.target.value)}
                                    placeholder="Note"
                                    className="flex-1 px-2 h-8 text-xs rounded-md border border-border bg-background focus:outline-none"
                                  />
                                </div>
                                <div className="flex gap-1.5">
                                  <button
                                    disabled={!poPayAmount || savingPoPay}
                                    onClick={() => handleRecordPayment(po.id)}
                                    className="flex-1 h-8 text-xs bg-primary text-primary-foreground rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-1"
                                  >
                                    <Check size={11} /> {savingPoPay ? 'Saving…' : 'Pay'}
                                  </button>
                                  <button
                                    onClick={() => setPoPayAmount(String(Math.round(po.remaining)))}
                                    className="h-8 px-3 text-xs rounded-lg border border-border bg-background hover:bg-muted"
                                  >Full</button>
                                  <button
                                    onClick={() => { setPayingPoId(null); setPoPayAmount(''); setPoPayNotes(''); }}
                                    className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1.5"
                                onClick={() => { setPayingPoId(po.id); setPoPayAmount(String(Math.round(po.remaining))); }}
                              >
                                <Plus size={12} /> Record payment for this order
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Payment events */}
              {ledger.payments.map((p, idx) => (
                <div key={`pay-${idx}`} className="flex items-center justify-between rounded-xl bg-emerald-500/5 border border-emerald-500/15 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Payment Sent</p>
                    <p className="text-[10px] text-muted-foreground">{formatDateTime(p.date_created)}</p>
                    {p.notes && <p className="text-[10px] text-muted-foreground/70 truncate">{p.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="font-bold text-emerald-600 tabular-nums text-sm">{fmtPKR(p.amount)}</span>
                    <button
                      onClick={() => deletePayment(p.id)}
                      className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}

              {/* Returns */}
              {ledger.returns.map((r, idx) => (
                <div key={`ret-${idx}`} className="flex items-center justify-between rounded-xl bg-amber-500/5 border border-amber-500/15 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Return Processed</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(r.date_created)}</p>
                    {r.reason && <p className="text-[10px] text-muted-foreground/70 truncate">{r.reason}</p>}
                  </div>
                  <span className="font-bold text-amber-600 tabular-nums text-sm ml-3 shrink-0">-{fmtPKR(r.total)}</span>
                </div>
              ))}
            </div>
          )}

          {/* LEDGER */}
          {tab === 'ledger' && (
            <div className="text-xs">
              <div className="grid grid-cols-4 gap-2 border-b border-border pb-1.5 font-semibold text-muted-foreground uppercase text-[10px]">
                <span>Details</span>
                <span className="text-right">Debit</span>
                <span className="text-right">Credit</span>
                <span className="text-right">Balance</span>
              </div>
              {ledgerRows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-4 gap-2 border-b border-border py-1.5">
                  <span className="truncate text-foreground/80">{row.label}</span>
                  <span className="text-right text-rose-600">{row.debit ? formatCurrency(row.debit) : '—'}</span>
                  <span className="text-right text-emerald-600">{row.credit ? formatCurrency(row.credit) : '—'}</span>
                  <span className="text-right font-medium">{formatCurrency(row.balance)}</span>
                </div>
              ))}
              {ledgerRows.length === 0 && <p className="py-6 text-center text-muted-foreground">No ledger entries yet.</p>}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
