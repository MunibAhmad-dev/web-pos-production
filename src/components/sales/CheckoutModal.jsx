import { useEffect, useMemo, useState } from 'react';
import { Banknote, Smartphone, BookOpen, CalendarClock, Check, Wallet, Landmark, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const rs = (n) => 'Rs. ' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-PK', { maximumFractionDigits: 2 });

const METHODS = [
  { key: 'cash', label: 'Cash', icon: Banknote },
  { key: 'online', label: 'Online / card', icon: Smartphone },
  { key: 'credit', label: 'Udhaar', icon: BookOpen },
];

function plusDays(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
}

/** Round-number notes a customer is likely to hand over for this total. */
function quickAmounts(total) {
  const steps = [100, 500, 1000, 5000];
  const out = new Set();
  for (const s of steps) { const v = Math.ceil(total / s) * s; if (v > total) out.add(v); }
  return [...out].sort((a, b) => a - b).slice(0, 3);
}

/**
 * Matches the desktop checkout: cash can be over-tendered (change shown, only the bill is
 * recorded); anything left unpaid goes on the customer's udhaar and needs a customer.
 */
export default function CheckoutModal({ open, onClose, onConfirm, total: liveTotal, itemCount: liveCount = 0, customers = [], accounts = [], onAddCustomer, initialCustomerId = '' }) {
  // Snapshot of the bill when the dialog opens — the cart is cleared as the sale completes,
  // and the closing dialog must not flash Rs. 0 / a wrong change amount.
  const [snap, setSnap] = useState({ total: liveTotal, itemCount: liveCount });
  const { total, itemCount } = snap;
  const [method, setMethod] = useState('cash');
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [received, setReceived] = useState('');
  const [accountId, setAccountId] = useState('');
  const [dueDate, setDueDate] = useState(plusDays(7));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const cashAccounts = accounts.filter((a) => a.type !== 'bank');
  const bankAccounts = accounts.filter((a) => a.type === 'bank');
  const defaultAccount = (m) => {
    if (m === 'online' && bankAccounts.length) return String(bankAccounts[0].id);
    const def = accounts.find((a) => Number(a.is_default) === 1) || cashAccounts[0] || accounts[0];
    return def ? String(def.id) : '';
  };

  useEffect(() => {
    if (!open) return;
    setSnap({ total: liveTotal, itemCount: liveCount });
    setMethod('cash'); setCustomerId(initialCustomerId); setReceived(String(liveTotal)); setAccountId(defaultAccount('cash'));
    setDueDate(plusDays(7)); setError(''); setSubmitting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // A customer created from inside checkout becomes the selected one.
  useEffect(() => { if (open && initialCustomerId) setCustomerId(initialCustomerId); }, [initialCustomerId, open]);

  const pickMethod = (m) => {
    setMethod(m); setError('');
    setReceived(m === 'credit' ? '0' : String(total));
    setAccountId(defaultAccount(m));
  };

  const amount = Math.max(0, Number(received) || 0);
  const paid = method === 'credit' ? 0 : Math.min(amount, total);
  const change = method === 'cash' ? Math.max(0, amount - total) : 0;
  const due = Math.max(0, Math.round((total - paid) * 100) / 100);
  const customer = customers.find((c) => String(c.id) === String(customerId));
  const quick = useMemo(() => quickAmounts(total), [total]);

  const confirm = async () => {
    setError('');
    if (method === 'online' && amount > total + 0.001) return setError('An online payment can’t be more than the bill.');
    if (due > 0.01 && !customerId) return setError('Choose a customer — the unpaid part goes on their udhaar.');
    if (paid > 0 && accounts.length && !accountId) return setError('Choose the account the money goes into.');
    setSubmitting(true);
    try {
      await onConfirm({ paymentMethod: method, customerId, amountPaid: paid, dueDate: due > 0.01 ? dueDate : null, accountId: paid > 0 ? accountId : null });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not complete the sale. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const AccountIcon = (a) => (a.type === 'bank' ? Landmark : Wallet);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !submitting && onClose()}>
      <DialogContent className="w-full max-w-[460px] gap-0 p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-5 bg-muted/40 border-b border-border">
          <DialogTitle className="text-sm font-medium text-muted-foreground">Amount to collect</DialogTitle>
          <p className="mt-1 text-[34px] leading-none font-bold tracking-tight tabular-nums text-foreground">{rs(total)}</p>
          <DialogDescription className="mt-1.5 text-xs text-muted-foreground">{itemCount} item{itemCount === 1 ? '' : 's'}{customer ? ` · ${customer.name}` : ' · Walk-in'}</DialogDescription>
        </div>

        <div className="px-6 py-5 grid gap-5 max-h-[60vh] overflow-y-auto">
          {/* Method */}
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Payment method">
            {METHODS.map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" role="radio" aria-checked={method === key} onClick={() => pickMethod(key)}
                className={cn('rounded-xl border px-2 py-3 flex flex-col items-center gap-1.5 text-[13px] font-medium transition-all',
                  method === key ? 'border-primary bg-primary/[0.07] text-foreground ring-1 ring-primary/40' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50')}>
                <Icon size={18} className={method === key ? 'text-primary' : ''} />
                {label}
              </button>
            ))}
          </div>

          {/* Amount */}
          {method !== 'credit' && (
            <div>
              <label htmlFor="received" className="text-sm font-medium text-foreground">{method === 'cash' ? 'Cash received' : 'Amount paid'}</label>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rs.</span>
                <input id="received" autoFocus inputMode="decimal" value={received}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setReceived(e.target.value.replace(/[^0-9.]/g, ''))}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirm(); }}
                  className="w-full h-12 rounded-xl border border-border bg-background pl-11 pr-3 text-lg font-semibold tabular-nums outline-none focus:ring-[3px] focus:ring-primary/20 focus:border-primary" />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setReceived(String(total))}
                  className={cn('h-8 px-3 rounded-lg border text-xs font-medium transition-colors', Math.abs(amount - total) < 0.005 ? 'border-primary text-primary bg-primary/5' : 'border-border text-muted-foreground hover:text-foreground')}>
                  Exact
                </button>
                {method === 'cash' && quick.map((v) => (
                  <button key={v} type="button" onClick={() => setReceived(String(v))}
                    className={cn('h-8 px-3 rounded-lg border text-xs font-medium tabular-nums transition-colors', amount === v ? 'border-primary text-primary bg-primary/5' : 'border-border text-muted-foreground hover:text-foreground')}>
                    {v.toLocaleString('en-PK')}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Result */}
          {change > 0.004 && (
            <div className="flex items-center justify-between rounded-xl bg-emerald-500/[0.08] border border-emerald-500/25 px-4 py-3">
              <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Give back</span>
              <span className="text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{rs(change)}</span>
            </div>
          )}
          {due > 0.01 && (
            <div className="rounded-xl bg-amber-500/[0.08] border border-amber-500/25 px-4 py-3 grid gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-amber-900 dark:text-amber-300">{method === 'credit' ? 'Full amount on udhaar' : 'Left on udhaar'}</span>
                <span className="text-xl font-bold tabular-nums text-amber-800 dark:text-amber-300">{rs(due)}</span>
              </div>
              <div className="flex gap-2">
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} aria-label="Customer"
                  className="flex-1 min-w-0 h-10 rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/25">
                  <option value="">Choose customer…</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>)}
                </select>
                <button type="button" onClick={onAddCustomer} aria-label="New customer" title="New customer"
                  className="h-10 w-10 rounded-lg border border-border bg-background inline-flex items-center justify-center text-muted-foreground hover:text-foreground"><UserPlus size={16} /></button>
              </div>
              {customer && (
                <p className="text-xs text-amber-900/80 dark:text-amber-300/80">
                  New balance: <span className="font-semibold tabular-nums">{rs((Number(customer.outstanding_balance) || 0) + due)}</span>
                </p>
              )}
              <label className="flex items-center gap-2 text-xs text-amber-900/80 dark:text-amber-300/80">
                <CalendarClock size={14} className="shrink-0" /> Remind me on
                <input type="date" value={dueDate} min={plusDays(0)} onChange={(e) => setDueDate(e.target.value)}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none" />
              </label>
            </div>
          )}

          {/* Account */}
          {paid > 0 && accounts.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-1.5">Received in</p>
              <div className="grid gap-1.5">
                {(method === 'online' && bankAccounts.length ? [...bankAccounts, ...cashAccounts] : accounts).map((a) => {
                  const Icon = AccountIcon(a);
                  const on = String(a.id) === String(accountId);
                  return (
                    <button key={a.id} type="button" onClick={() => setAccountId(String(a.id))}
                      className={cn('flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                        on ? 'border-primary/60 bg-primary/[0.05]' : 'border-border hover:bg-muted/50')}>
                      <Icon size={15} className={a.type === 'bank' ? 'text-sky-600' : 'text-emerald-600'} />
                      <span className="flex-1 truncate text-foreground">{a.name}</span>
                      {on && <Check size={15} className="text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-border bg-card">
          <button type="button" onClick={onClose} disabled={submitting}
            className="h-11 px-4 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted">Back</button>
          <button type="button" onClick={confirm} disabled={submitting}
            className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-60">
            {submitting ? 'Saving…' : <><Check size={16} /> Complete sale</>}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
