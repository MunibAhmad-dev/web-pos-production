import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, Plus, Phone, MapPin, Pencil, Trash2, MessageCircle, FileDown, Wallet, Landmark, Check, X,
  ChevronLeft, ChevronDown, ChevronRight, BookOpen, Printer, Ban, UserRound, MapPinned, BellRing,
  ArrowDownLeft, ExternalLink, Copy, Users,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import CustomerFormModal from '../../components/customers/CustomerFormModal';
import CustomerKhataPanel from '../../components/customers/CustomerKhataPanel';
import { buildCancelSaleEvents, isCancelled } from '@/lib/ledger';
import {
  buildCustomerAccount, planPayment, buildPaymentEvents, parseDate, localStamp,
} from '@/lib/customerAccount';
import {
  getReceiptSettings, printInvoice, buildWhatsAppLink, buildAccountStatementHtml, downloadStatementPdf,
  shareStatementViaWhatsApp, formatInvoiceId,
} from '../../utils/receipt';

/* ── Formatting ───────────────────────────────────────────────────────────── */
const rs = (n) => 'Rs. ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const fmtDay = (raw) => { const d = parseDate(raw); return d && !isNaN(d) ? d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; };
const fmtDayTime = (raw) => { const d = parseDate(raw); return d && !isNaN(d) ? d.toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—'; };
const TONES = [
  'bg-sky-500/12 text-sky-700 dark:text-sky-300', 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
  'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300', 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  'bg-rose-500/12 text-rose-700 dark:text-rose-300', 'bg-teal-500/12 text-teal-700 dark:text-teal-300',
];
const toneOf = (s = '') => TONES[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length];
const initials = (s = '') => String(s).replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

const PERIODS = [['all', 'All time'], ['today', 'Today'], ['week', '7 days'], ['month', '30 days'], ['custom', 'Custom']];
function periodRange(period, from, to) {
  const now = new Date();
  const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'today') return [sod, now];
  if (period === 'week') return [new Date(sod - 6 * 864e5), now];
  if (period === 'month') return [new Date(sod - 29 * 864e5), now];
  if (period === 'custom' && from && to) return [new Date(`${from}T00:00:00`), new Date(`${to}T23:59:59`)];
  return [null, null];
}

function BalanceText({ value, className }) {
  if (Math.abs(value) < 0.5) return <span className={cn('text-muted-foreground', className)}>Settled</span>;
  return value > 0
    ? <span className={cn('text-amber-700 dark:text-amber-400', className)}>{rs(value)}</span>
    : <span className={cn('text-emerald-700 dark:text-emerald-400', className)}>{rs(-value)} credit</span>;
}

const STATE_CHIP = {
  paid: ['Paid', 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'],
  partial: ['Part paid', 'bg-amber-500/12 text-amber-800 dark:text-amber-400'],
  unpaid: ['Unpaid', 'bg-rose-500/10 text-rose-700 dark:text-rose-400'],
  returned: ['Returned', 'bg-muted text-muted-foreground'],
  cancelled: ['Cancelled', 'bg-muted text-muted-foreground line-through'],
};

/* ── Receive payment ──────────────────────────────────────────────────────── */

function ReceivePaymentDialog({ open, onClose, customer, account, accounts, onSave }) {
  const due = Math.max(0, account?.totals.totalDue || 0);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [accountId, setAccountId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const defaultAcc = (m) => {
    const bank = accounts.filter((a) => a.type === 'bank');
    if (m === 'online' && bank.length) return String(bank[0].id);
    const d = accounts.find((a) => Number(a.is_default) === 1) || accounts.find((a) => a.type !== 'bank') || accounts[0];
    return d ? String(d.id) : '';
  };
  useEffect(() => {
    if (!open) return;
    setAmount(due > 0 ? String(Math.round(due)) : ''); setMethod('cash'); setAccountId(defaultAcc('cash')); setNote(''); setError(''); setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const amt = Math.max(0, Number(amount) || 0);
  const plan = useMemo(() => (account && amt > 0 ? planPayment(account, amt) : { allocations: [], advance: 0 }), [account, amt]);

  const save = async () => {
    setError('');
    if (!(amt > 0)) return setError('Enter the amount received.');
    if (accounts.length && !accountId) return setError('Choose where the money went.');
    setSaving(true);
    try { await onSave({ amount: amt, method, accountId, note }); onClose(); }
    catch (e) { setError(e?.message || 'Could not save the payment.'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="w-full max-w-[460px] gap-0 p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-5 border-b border-border bg-muted/40">
          <DialogTitle className="text-sm font-medium text-muted-foreground">Receive payment from</DialogTitle>
          <p className="mt-1 text-lg font-semibold text-foreground">{customer?.name}</p>
          <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
            Owes {rs(due)}{account?.totals.khataDue > 0.5 ? ` · incl. ${rs(account.totals.khataDue)} on custom bills` : ''}
          </DialogDescription>
        </div>
        <div className="px-6 py-5 grid gap-5 max-h-[62vh] overflow-y-auto">
          <div>
            <label htmlFor="pay-amount" className="text-sm font-medium text-foreground">Amount received</label>
            <div className="relative mt-1.5">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rs.</span>
              <input id="pay-amount" autoFocus inputMode="decimal" value={amount} onFocus={(e) => e.target.select()}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} onKeyDown={(e) => e.key === 'Enter' && save()}
                className="w-full h-12 rounded-xl border border-border bg-background pl-11 pr-3 text-lg font-semibold tabular-nums outline-none focus:ring-[3px] focus:ring-primary/20 focus:border-primary" />
            </div>
            {due > 0.5 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[['Full amount', due], ['Half', due / 2]].map(([l, v]) => (
                  <button key={l} type="button" onClick={() => setAmount(String(Math.round(v)))}
                    className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground">{l} · {rs(v)}</button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[['cash', 'Cash', Wallet], ['online', 'Online / bank', Landmark]].map(([k, l, Icon]) => (
              <button key={k} type="button" onClick={() => { setMethod(k); setAccountId(defaultAcc(k)); }}
                className={cn('h-11 rounded-xl border text-sm font-medium inline-flex items-center justify-center gap-2 transition-all',
                  method === k ? 'border-primary bg-primary/[0.07] ring-1 ring-primary/40 text-foreground' : 'border-border text-muted-foreground hover:text-foreground')}>
                <Icon size={16} className={method === k ? 'text-primary' : ''} /> {l}
              </button>
            ))}
          </div>
          {accounts.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-1.5">Received in</p>
              <div className="grid gap-1.5">
                {accounts.map((a) => {
                  const on = String(a.id) === String(accountId);
                  return (
                    <button key={a.id} type="button" onClick={() => setAccountId(String(a.id))}
                      className={cn('flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm', on ? 'border-primary/60 bg-primary/[0.05]' : 'border-border hover:bg-muted/50')}>
                      {a.type === 'bank' ? <Landmark size={15} className="text-sky-600" /> : <Wallet size={15} className="text-emerald-600" />}
                      <span className="flex-1 truncate text-foreground">{a.name}</span>
                      {on && <Check size={15} className="text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional) — e.g. JazzCash, cheque no."
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/25" />
          {amt > 0 && (plan.allocations.length > 0 || plan.advance > 0) && (
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Applied oldest first</p>
              <ul className="grid gap-1.5 text-sm">
                {plan.allocations.map((a) => (
                  <li key={`${a.kind}-${a.id}`} className="flex items-center justify-between gap-3">
                    <span className="truncate text-foreground">
                      {a.kind === 'invoice' ? formatInvoiceId(a.id, a.date) : a.label}
                      <span className="ml-1.5 text-xs text-muted-foreground">{a.clears ? 'cleared' : `${rs(a.remaining - a.amount)} left`}</span>
                    </span>
                    <span className="tabular-nums font-medium text-foreground">{rs(a.amount)}</span>
                  </li>
                ))}
                {plan.advance > 0 && (
                  <li className="flex items-center justify-between gap-3 text-emerald-700 dark:text-emerald-400">
                    <span>Kept as advance (credit)</span><span className="tabular-nums font-medium">{rs(plan.advance)}</span>
                  </li>
                )}
              </ul>
            </div>
          )}
          {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-border">
          <button type="button" onClick={onClose} disabled={saving} className="h-11 px-4 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">Cancel</button>
          <button type="button" onClick={save} disabled={saving}
            className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-60">
            {saving ? 'Saving…' : <><Check size={16} /> Save payment{amt > 0 ? ` · ${rs(amt)}` : ''}</>}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Account panel (right side) ───────────────────────────────────────────── */

function AccountPanel({ customer, onBack, onEdit, onDelete }) {
  const { list, get, pushBatch, nextId } = useDataStore();
  const { showToast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('ledger');
  const [period, setPeriod] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [billsOpen, setBillsOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [stmtBusy, setStmtBusy] = useState(null);
  const [confirm, setConfirm] = useState(null); // { title, body, action }

  const sales = list('sale');
  const saleItems = list('sale_item');
  const payments = list('customer_payment');
  const returns = list('sale_return');
  const khatas = list('customer_khata');
  const khataPayments = list('customer_khata_payment');
  const accounts = list('account');
  const accountTxns = list('account_txn');

  const account = useMemo(() => buildCustomerAccount({ customer, sales, saleItems, payments, returns, khatas, khataPayments }),
    [customer, sales, saleItems, payments, returns, khatas, khataPayments]);
  const t = account.totals;
  const invDate = useMemo(() => new Map(account.invoices.map((i) => [String(i.id), i.date_created])), [account]);
  const invNo = (id) => formatInvoiceId(id, invDate.get(String(id)));

  const [start, end] = periodRange(period, from, to);
  const inRange = (raw) => { if (!start) return true; const d = parseDate(raw); return d && d >= start && d <= end; };
  const ledgerRows = useMemo(() => {
    if (!start) return { opening: 0, rows: account.ledger };
    let opening = 0; const rows = [];
    for (const r of account.ledger) {
      const d = parseDate(r.date);
      if (d && d < start) opening = r.balance;
      else if (d && d <= end) rows.push(r);
    }
    return { opening, rows };
  }, [account, start, end]);
  const periodStats = useMemo(() => {
    const rows = ledgerRows.rows;
    const sum = (types, f) => rows.filter((r) => types.includes(r.type)).reduce((s, r) => s + r[f], 0);
    return { invoiced: sum(['Invoice', 'Custom bill'], 'debit'), paid: sum(['Payment', 'Bill payment'], 'credit'), returned: sum(['Return'], 'credit') - sum(['Refund'], 'debit') };
  }, [ledgerRows]);
  const invoices = account.invoices.filter((i) => inRange(i.date_created));
  const paymentRows = account.payments.filter((p) => inRange(p.date_added || p.date_created));

  const receive = async ({ amount, method, accountId, note }) => {
    const { events } = buildPaymentEvents({ account, customer, amount, note, accountId, method, nextId, sales });
    await pushBatch(events);
    showToast(`${rs(amount)} received from ${customer.name}`);
  };

  const removePayment = (p) => {
    const group = p.payment_group;
    const rows = group ? account.payments.filter((x) => x.payment_group === group) : [p];
    const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    setConfirm({
      title: `Delete payment of ${rs(total)}?`,
      body: rows.length > 1 ? `This payment was spread over ${rows.length} entries. All of them and the matching cash/bank entry will be removed.` : 'The matching cash/bank entry will be removed too.',
      action: async () => {
        const now = localStamp();
        const events = rows.map((r) => ({ entityType: 'customer_payment', operation: 'delete', payload: { id: r.id } }));
        const txn = accountTxns.find((x) => group ? String(x.note || '').includes(`[SPG:${group}]`)
          : (p.sale_id && String(x.note || '') === `Sale payment received — Sale #${p.sale_id}` && Math.abs(Number(x.amount) - Number(p.amount)) < 0.01));
        if (txn) events.push({ entityType: 'account_txn', operation: 'delete', payload: { id: txn.id } });
        events.push({ entityType: 'customer', operation: 'update', payload: { ...customer, outstanding_balance: Math.round((t.invoiceBalance + total) * 100) / 100, updated_at: now } });
        await pushBatch(events);
        showToast('Payment deleted');
      },
    });
  };

  const cancelInvoice = (inv) => setConfirm({
    title: `Cancel ${formatInvoiceId(inv.id, inv.date_created)}?`,
    body: 'Stock goes back, payments on it are reversed and it no longer counts in sales. This can’t be undone.',
    action: async () => {
      const events = buildCancelSaleEvents({
        sale: get('sale', inv.id) || inv, items: inv.items, customer, products: list('product'),
        payments, returns, returnItems: list('sale_return_item'), now: localStamp(),
      });
      if (!events) { showToast('This invoice is already cancelled', 'error'); return; }
      await pushBatch(events);
      showToast('Invoice cancelled');
    },
  });

  const invoiceData = (inv) => {
    const settings = getReceiptSettings();
    return {
      saleId: inv.id,
      items: inv.items.map((i) => ({ name: i.product_name, qty: Number(i.quantity), price: Number(i.price) })),
      subtotal: Number(inv.subtotal ?? inv.total), discount: Number(inv.discount || 0), total: inv.total,
      paymentMethod: inv.payment_method || 'cash',
      settings: { ...settings, store_name: settings.store_name || user?.store_name || 'My Store' },
      date: fmtDayTime(inv.date_created), customerName: customer.name, customerPhone: customer.phone,
      amountPaid: inv.paid, balance: inv.remaining,
    };
  };

  const statement = async (action) => {
    if (stmtBusy) return;
    setStmtBusy(action);
    try {
      const settings = getReceiptSettings();
      const rows = (start ? ledgerRows.rows : account.ledger).map((r) => ({
        date: parseDate(r.date) || new Date(), type: r.type,
        desc: [r.type === 'Invoice' && r.ref ? formatInvoiceId(r.ref, r.date) : r.type, r.detail].filter(Boolean).join(' — '),
        debit: r.debit, credit: r.credit,
      }));
      if (start && Math.abs(ledgerRows.opening) > 0.005) rows.unshift({ date: start, type: 'Opening', desc: 'Opening balance', debit: Math.max(0, ledgerRows.opening), credit: Math.max(0, -ledgerRows.opening) });
      const html = buildAccountStatementHtml({
        name: customer.name, phone: customer.phone, address: customer.address, type: 'customer', ledger: rows,
        totals: { invoiced: start ? periodStats.invoiced : t.purchased + t.khataDue, paid: start ? periodStats.paid : t.paid, returned: start ? periodStats.returned : t.returned, balance: t.totalDue },
        settings: { ...settings, store_name: settings.store_name || user?.store_name || 'My Store' },
      });
      const filename = `statement-${(customer.name || 'customer').replace(/\s+/g, '-')}.pdf`;
      if (action === 'pdf') await downloadStatementPdf(html, filename);
      else {
        const r = await shareStatementViaWhatsApp(html, { name: customer.name, phone: customer.phone, balance: t.totalDue, filename });
        if (r === 'downloaded') showToast('PDF saved — opening WhatsApp');
      }
    } catch { showToast('Could not create the statement', 'error'); }
    finally { setStmtBusy(null); }
  };

  const copyPhone = async () => {
    try { await navigator.clipboard.writeText(customer.phone); showToast('Number copied'); } catch { /* ignore */ }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-start gap-3 sm:gap-4 px-4 sm:px-6 pt-4 sm:pt-5 pb-4">
        <button type="button" onClick={onBack} className="lg:hidden -ml-1 mt-2 h-8 w-8 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:bg-muted" aria-label="Back to customers"><ChevronLeft size={18} /></button>
        <span className={cn('h-11 w-11 sm:h-14 sm:w-14 rounded-xl sm:rounded-2xl inline-flex items-center justify-center text-base sm:text-lg font-bold shrink-0', toneOf(customer.name))}>{initials(customer.name)}</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg sm:text-xl font-extrabold tracking-tight text-foreground leading-snug break-words">{customer.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {customer.phone && (
              <button type="button" onClick={copyPhone} className="inline-flex items-center gap-1.5 hover:text-foreground tabular-nums" title="Copy number">
                <Phone size={13} /> {customer.phone} <Copy size={11} className="opacity-60" />
              </button>
            )}
            {customer.address && <span className="inline-flex items-center gap-1.5 min-w-0"><MapPin size={13} /> <span className="truncate">{customer.address}</span></span>}
            {customer.created_at && <span className="text-xs">Customer since {fmtDay(customer.created_at)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onEdit} className="h-9 w-9 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit details" aria-label="Edit details"><Pencil size={16} /></button>
          <button type="button" onClick={onDelete} className="h-9 w-9 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600" title="Delete customer" aria-label="Delete customer"><Trash2 size={16} /></button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pb-6">
        {/* Balance */}
        <section className={cn('rounded-2xl border p-5', t.totalDue > 0.5 ? 'border-amber-500/25 bg-amber-500/[0.05]' : t.totalDue < -0.5 ? 'border-emerald-500/25 bg-emerald-500/[0.05]' : 'border-border bg-muted/30')}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[13px] font-medium text-muted-foreground">{t.totalDue < -0.5 ? 'Advance with you' : 'Total balance due'}</p>
              <p className={cn('mt-1 text-[34px] leading-none font-bold tabular-nums tracking-tight',
                t.totalDue > 0.5 ? 'text-amber-800 dark:text-amber-300' : t.totalDue < -0.5 ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground')}>
                {rs(Math.abs(t.totalDue))}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Sales loans (qaraz) <span className="font-medium text-foreground tabular-nums">{rs(t.invoiceBalance)}</span>
                <span className="mx-1.5">·</span>
                Custom bills <span className="font-medium text-foreground tabular-nums">{rs(t.khataDue)}</span>
                {t.openInvoices > 0 && <><span className="mx-1.5">·</span>{t.openInvoices} open invoice{t.openInvoices === 1 ? '' : 's'}</>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPayOpen(true)}
                className="w-full sm:w-auto justify-center h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 shadow-sm hover:opacity-95">
                <ArrowDownLeft size={16} /> Receive payment
              </button>
              <button type="button" onClick={() => setBillsOpen(true)}
                className="flex-1 sm:flex-none justify-center whitespace-nowrap h-10 px-2.5 sm:px-3.5 rounded-xl border border-border bg-card text-sm font-medium text-foreground inline-flex items-center gap-2 hover:bg-muted">
                <BookOpen size={15} /> <span className="sm:hidden">Bills</span><span className="hidden sm:inline">Custom bills</span>
              </button>
              <button type="button" onClick={() => statement('pdf')} disabled={!!stmtBusy} title="Download statement PDF"
                className="flex-1 sm:flex-none justify-center whitespace-nowrap h-10 px-2.5 sm:px-3.5 rounded-xl border border-border bg-card text-sm font-medium text-foreground inline-flex items-center gap-2 hover:bg-muted disabled:opacity-60">
                <FileDown size={15} /> {stmtBusy === 'pdf' ? 'Preparing…' : 'Statement'}
              </button>
              {customer.phone && (
                <button type="button" onClick={() => statement('wa')} disabled={!!stmtBusy} title="Send statement on WhatsApp" aria-label="Send statement on WhatsApp"
                  className="h-10 w-10 shrink-0 rounded-xl border border-border bg-card inline-flex items-center justify-center text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-60">
                  <MessageCircle size={16} />
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Lifetime numbers */}
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Purchased', start ? periodStats.invoiced : t.purchased],
            ['Paid', start ? periodStats.paid : t.paid],
            ['Returned', start ? periodStats.returned : t.returned],
            ['Invoices', start ? invoices.filter((i) => !i.cancelled).length : account.invoices.filter((i) => !i.cancelled).length],
          ].map(([label, v], i) => (
            <div key={label} className="rounded-xl border border-border/70 bg-card px-4 py-3">
              <dt className="text-xs text-muted-foreground">{label}{!start && i < 3 && <span className="hidden sm:inline"> (all time)</span>}</dt>
              <dd className="mt-1 text-base font-semibold tabular-nums text-foreground">{i === 3 ? Number(v).toLocaleString('en-PK') : rs(v)}</dd>
            </div>
          ))}
        </dl>

        {/* Tabs + period */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border">
          <div className="flex gap-1 -mb-px overflow-x-auto [scrollbar-width:none]" role="tablist">
            {[['ledger', 'Ledger'], ['invoices', `Invoices · ${invoices.length}`], ['payments', `Payments · ${paymentRows.length}`], ['bills', `Custom bills · ${account.bills.length}`]].map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={cn('h-10 px-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                  tab === k ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 pb-2">
            <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period"
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-medium outline-none">
              {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            {period === 'custom' && (
              <>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 rounded-lg border border-border bg-background px-2 text-xs" aria-label="From" />
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 rounded-lg border border-border bg-background px-2 text-xs" aria-label="To" />
              </>
            )}
          </div>
        </div>

        {/* Ledger */}
        {tab === 'ledger' && (
          <div className="mt-3 overflow-x-auto">
            {ledgerRows.rows.length === 0 && !start ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <table className="hidden sm:table w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Details</th>
                    <th className="py-2 px-3 font-medium text-right">Debit</th>
                    <th className="py-2 px-3 font-medium text-right">Credit</th>
                    <th className="py-2 pl-3 font-medium text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {start && (
                    <tr className="bg-muted/30">
                      <td className="py-2.5 pr-3 text-muted-foreground tabular-nums">{fmtDay(start)}</td>
                      <td className="py-2.5 pr-3 font-medium text-foreground">Opening balance</td>
                      <td /><td />
                      <td className="py-2.5 pl-3 text-right font-semibold tabular-nums whitespace-nowrap"><BalanceText value={ledgerRows.opening} /></td>
                    </tr>
                  )}
                  {[...ledgerRows.rows].reverse().map((r) => (
                    <tr key={r.key}>
                      <td className="py-2.5 pr-3 text-muted-foreground tabular-nums whitespace-nowrap">{fmtDay(r.date)}</td>
                      <td className="py-2.5 pr-3">
                        <span className="font-medium text-foreground">{r.type === 'Invoice' && r.ref ? formatInvoiceId(r.ref, r.date) : r.type}</span>
                        {(r.type !== 'Invoice' || r.detail) && <span className="ml-2 text-xs text-muted-foreground">{r.type === 'Invoice' ? r.detail : [r.type === 'Payment' && r.ref ? `on ${invNo(r.ref)}` : '', r.detail].filter(Boolean).join(' · ')}</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap text-foreground">{r.debit ? rs(r.debit) : ''}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap text-emerald-700 dark:text-emerald-400">{r.credit ? rs(r.credit) : ''}</td>
                      <td className="py-2.5 pl-3 text-right font-semibold tabular-nums whitespace-nowrap"><BalanceText value={r.balance} /></td>
                    </tr>
                  ))}
                  {start && ledgerRows.rows.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Nothing in this period.</td></tr>}
                </tbody>
              </table>
            )}
            {!(ledgerRows.rows.length === 0 && !start) && (
              <ul className="sm:hidden divide-y divide-border/60">
                {start && (
                  <li className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="font-medium text-foreground">Opening balance</span>
                    <BalanceText value={ledgerRows.opening} className="font-semibold tabular-nums" />
                  </li>
                )}
                {[...ledgerRows.rows].reverse().map((r) => (
                  <li key={r.key} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{r.type === 'Invoice' && r.ref ? formatInvoiceId(r.ref, r.date) : r.type}</p>
                      <p className="text-xs text-muted-foreground tabular-nums truncate">
                        {fmtDay(r.date)}{r.type === 'Payment' && r.ref ? ` · on ${invNo(r.ref)}` : ''}{r.detail ? ` · ${r.detail}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn('text-sm font-semibold tabular-nums', r.credit ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground')}>
                        {r.credit ? `− ${rs(r.credit)}` : `+ ${rs(r.debit)}`}
                      </p>
                      <p className="text-[11px] tabular-nums text-muted-foreground">Bal. <BalanceText value={r.balance} /></p>
                    </div>
                  </li>
                ))}
                {start && ledgerRows.rows.length === 0 && <li className="py-8 text-center text-sm text-muted-foreground">Nothing in this period.</li>}
              </ul>
            )}
          </div>
        )}

        {/* Invoices */}
        {tab === 'invoices' && (
          <ul className="mt-3 divide-y divide-border/60">
            {invoices.length === 0 && <li className="py-12 text-center text-sm text-muted-foreground">No invoices{start ? ' in this period' : ''}.</li>}
            {invoices.map((inv) => {
              const [label, chip] = STATE_CHIP[inv.state] || STATE_CHIP.unpaid;
              const open = expanded === inv.id;
              return (
                <li key={inv.id} className="py-1">
                  <div className="flex items-center gap-3 py-2">
                    <button type="button" onClick={() => setExpanded(open ? null : inv.id)} className="flex flex-1 min-w-0 items-center gap-3 text-left" aria-expanded={open}>
                      <ChevronRight size={15} className={cn('text-muted-foreground transition-transform shrink-0', open && 'rotate-90')} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">{formatInvoiceId(inv.id, inv.date_created)}</span>
                        <span className="block text-xs text-muted-foreground tabular-nums">{fmtDayTime(inv.date_created)} · {inv.items.length} item{inv.items.length === 1 ? '' : 's'}</span>
                      </span>
                    </button>
                    <span className={cn('text-[11px] font-semibold rounded-md px-1.5 py-0.5 whitespace-nowrap', chip)}>{label}</span>
                    <span className="w-28 text-right">
                      <span className="block text-sm font-semibold tabular-nums text-foreground">{rs(inv.total)}</span>
                      {inv.remaining > 0.5 && <span className="block text-[11px] tabular-nums text-amber-700 dark:text-amber-400">{rs(inv.remaining)} due</span>}
                    </span>
                  </div>
                  {open && (
                    <div className="mb-3 ml-7 rounded-xl border border-border bg-muted/20">
                      <ul className="divide-y divide-border/60 text-sm">
                        {inv.items.map((it) => (
                          <li key={it.id} className="flex items-center gap-3 px-4 py-2">
                            <span className="flex-1 min-w-0 truncate text-foreground">{it.product_name}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">{Number(it.quantity).toLocaleString('en-PK')} × {rs(it.price)}</span>
                            <span className="w-24 text-right tabular-nums text-foreground">{rs(Number(it.quantity) * Number(it.price))}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                        <span className="tabular-nums">
                          {Number(inv.discount) > 0 && <>Discount {rs(inv.discount)} · </>}Paid {rs(inv.paid)}{inv.returned > 0 && <> · Returned {rs(inv.returned)}</>}
                        </span>
                        <span className="flex items-center gap-1">
                          <button type="button" onClick={() => printInvoice(invoiceData(inv))} className="h-8 px-2.5 rounded-lg inline-flex items-center gap-1.5 hover:bg-muted hover:text-foreground"><Printer size={14} /> Print</button>
                          {customer.phone && <a href={buildWhatsAppLink(invoiceData(inv))} target="_blank" rel="noopener noreferrer" className="h-8 px-2.5 rounded-lg inline-flex items-center gap-1.5 hover:bg-muted hover:text-foreground"><MessageCircle size={14} /> WhatsApp</a>}
                          <button type="button" onClick={() => navigate(`/customers/${customer.id}`)} className="h-8 px-2.5 rounded-lg inline-flex items-center gap-1.5 hover:bg-muted hover:text-foreground" title="Edit items or return"><ExternalLink size={14} /> Edit</button>
                          {!inv.cancelled && <button type="button" onClick={() => cancelInvoice(inv)} className="h-8 px-2.5 rounded-lg inline-flex items-center gap-1.5 text-rose-600 hover:bg-rose-500/10"><Ban size={14} /> Cancel</button>}
                        </span>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Payments */}
        {tab === 'payments' && (
          <ul className="mt-3 divide-y divide-border/60">
            {paymentRows.length === 0 && <li className="py-12 text-center text-sm text-muted-foreground">No payments{start ? ' in this period' : ''}.</li>}
            {paymentRows.map((p) => {
              const acc = accounts.find((a) => String(a.id) === String(p.account_id));
              return (
                <li key={p.id} className="group flex items-center gap-3 py-3">
                  <span className="h-9 w-9 rounded-full bg-emerald-500/10 text-emerald-600 inline-flex items-center justify-center shrink-0"><ArrowDownLeft size={16} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {p.sale_id ? `For ${invNo(p.sale_id)}` : 'Advance / general payment'}
                      {p.payment_group && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">smart pay</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate tabular-nums">{fmtDayTime(p.date_added || p.date_created)}{acc ? ` · ${acc.name}` : ''}{p.notes ? ` · ${p.notes}` : ''}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{rs(p.amount)}</span>
                  <button type="button" onClick={() => removePayment(p)} className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10" aria-label="Delete payment" title="Delete payment"><Trash2 size={14} /></button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Custom bills */}
        {tab === 'bills' && (
          <div className="mt-3">
            {account.bills.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">No custom bills for this customer.</p>
                <button type="button" onClick={() => setBillsOpen(true)} className="mt-3 h-9 px-4 rounded-lg border border-border text-sm font-medium inline-flex items-center gap-2 hover:bg-muted"><Plus size={15} /> New custom bill</button>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {account.bills.map((k) => (
                  <li key={k.id} className="flex items-center gap-3 py-3">
                    <span className="h-9 w-9 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 inline-flex items-center justify-center shrink-0"><BookOpen size={15} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{k.title || 'Custom bill'}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{fmtDay(k.date_created || k.created_at)} · {rs(k.total_amount)} · paid {rs(k.paid)}</p>
                    </div>
                    {k.remaining > 0.5
                      ? <span className="text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-400">{rs(k.remaining)} due</span>
                      : <span className="text-[11px] font-semibold rounded-md px-1.5 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Paid</span>}
                  </li>
                ))}
              </ul>
            )}
            {account.bills.length > 0 && (
              <button type="button" onClick={() => setBillsOpen(true)} className="mt-3 text-sm font-medium text-primary inline-flex items-center gap-1 hover:underline">Manage custom bills <ChevronRight size={14} /></button>
            )}
          </div>
        )}
      </div>

      <ReceivePaymentDialog open={payOpen} onClose={() => setPayOpen(false)} customer={customer} account={account} accounts={accounts} onSave={receive} />
      {billsOpen && <CustomerKhataPanel customer={customer} onClose={() => setBillsOpen(false)} />}
      <Dialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>{confirm?.title}</DialogTitle>
          <DialogDescription>{confirm?.body}</DialogDescription>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirm(null)} className="h-9 px-4 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted">Keep</button>
            <button type="button" onClick={async () => { const a = confirm.action; setConfirm(null); try { await a(); } catch (e) { showToast(e?.message || 'Something went wrong', 'error'); } }}
              className="h-9 px-4 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700">Yes, continue</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */

const FILTERS = [['all', 'All'], ['owing', 'Owe you'], ['credit', 'In credit'], ['settled', 'Settled']];

export default function CustomersPage() {
  const { list, pushEntity, pushBatch } = useDataStore();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('balance');
  const [selectedId, setSelectedId] = useState(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [shown, setShown] = useState(60);

  const customers = list('customer');
  const sales = list('sale');
  const payments = list('customer_payment');
  const returns = list('sale_return');
  const khatas = list('customer_khata');
  const khataPayments = list('customer_khata_payment');

  // List balance: synced invoice balance + open custom bills (the detail panel recomputes from the ledger)
  const rows = useMemo(() => {
    const khataBy = new Map();
    for (const c of customers) khataBy.set(String(c.id), 0);
    const paid = new Map();
    for (const p of khataPayments) paid.set(String(p.khata_id), (paid.get(String(p.khata_id)) || 0) + (Number(p.amount) || 0));
    for (const k of khatas) {
      if (String(k.status || '').toLowerCase() === 'closed') continue;
      const rem = Math.max(0, (Number(k.total_amount) || 0) - (paid.get(String(k.id)) || 0));
      khataBy.set(String(k.customer_id), (khataBy.get(String(k.customer_id)) || 0) + rem);
    }
    // Desktop balance: Σ(active invoice − write-off) − Σ payments − Σ(returns − cash refunded)
    const inv = new Map(); const saleOwner = new Map();
    for (const sl of sales) {
      if (sl.customer_id == null) continue;
      const cid = String(sl.customer_id);
      if (isCancelled(sl)) continue;
      saleOwner.set(String(sl.id), cid);
      inv.set(cid, (inv.get(cid) || 0) + (Number(sl.total) || 0) - (Number(sl.write_off_amount) || 0));
    }
    for (const pm of payments) if (pm.customer_id != null) inv.set(String(pm.customer_id), (inv.get(String(pm.customer_id)) || 0) - (Number(pm.amount) || 0));
    for (const r of returns) {
      const cid = saleOwner.get(String(r.sale_id));
      if (cid) inv.set(cid, (inv.get(cid) || 0) - (Number(r.total_returned) || 0) + (Number(r.cash_refunded) || 0));
    }
    return customers.map((c) => ({ ...c, balance: Math.round(((inv.get(String(c.id)) || 0) + (khataBy.get(String(c.id)) || 0)) * 100) / 100 }));
  }, [customers, sales, payments, returns, khatas, khataPayments]);

  const stats = useMemo(() => {
    const owing = rows.filter((r) => r.balance > 0.5);
    return { total: rows.length, owingCount: owing.length, receivable: owing.reduce((s, r) => s + r.balance, 0) };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = rows.filter((c) => !q || c.name?.toLowerCase().includes(q) || String(c.phone || '').includes(q));
    if (filter === 'owing') r = r.filter((c) => c.balance > 0.5);
    if (filter === 'credit') r = r.filter((c) => c.balance < -0.5);
    if (filter === 'settled') r = r.filter((c) => Math.abs(c.balance) <= 0.5);
    return [...r].sort((a, b) => (sort === 'name' ? String(a.name).localeCompare(String(b.name))
      : sort === 'recent' ? String(b.created_at || '').localeCompare(String(a.created_at || ''))
        : b.balance - a.balance || String(a.name).localeCompare(String(b.name))));
  }, [rows, search, filter, sort]);
  useEffect(() => setShown(60), [search, filter, sort]);

  // Desktop shows the first customer straight away
  const selected = rows.find((c) => String(c.id) === String(selectedId)) || (typeof window !== 'undefined' && window.innerWidth >= 1024 ? filtered[0] : null);
  const select = (c) => { setSelectedId(c.id); setMobileDetail(true); };

  const saveCustomer = async (form) => {
    const now = localStamp();
    const name = String(form.name || '').trim();
    if (!name) throw new Error('Customer name is required');
    if (editing) {
      await pushEntity('customer', 'update', { ...editing, ...form, name, updated_at: now });
      showToast('Customer updated');
    } else {
      const created = await pushEntity('customer', 'create', { name, phone: form.phone || '', email: form.email || '', address: form.address || '', notes: form.notes || '', outstanding_balance: 0, created_at: now, updated_at: now });
      if (created?.id != null) setSelectedId(created.id);
      showToast('Customer added');
    }
  };

  const confirmDelete = async () => {
    const c = deleting; setDeleting(null);
    if (!c) return;
    if (Math.abs(c.balance) > 0.5) { showToast(`${c.name} still has a balance of ${rs(Math.abs(c.balance))} — settle it first`, 'error'); return; }
    await pushBatch([{ entityType: 'customer', operation: 'delete', payload: { id: c.id } }]);
    if (String(selectedId) === String(c.id)) setSelectedId(null);
    showToast('Customer deleted');
  };

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100dvh-8.5rem)]">
      {/* Header */}
      <header className={cn('flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', mobileDetail && selected ? 'hidden lg:flex' : 'flex')}>
        <div>
          <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">Customers</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {stats.total.toLocaleString('en-PK')} customer{stats.total === 1 ? '' : 's'} · <span className="text-amber-700 dark:text-amber-400 font-medium">{stats.owingCount} owe you {rs(stats.receivable)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/route-book" className="h-10 px-3.5 rounded-xl border border-border bg-card text-sm font-medium inline-flex items-center gap-2 hover:bg-muted"><MapPinned size={15} /> <span className="hidden sm:inline">Route book</span><span className="sm:hidden">Routes</span></Link>
          <Link to="/payment-reminders" className="h-10 px-3.5 rounded-xl border border-border bg-card text-sm font-medium inline-flex items-center gap-2 hover:bg-muted"><BellRing size={15} /> Reminders</Link>
          <button type="button" onClick={() => { setEditing(null); setFormOpen(true); }}
            className="ml-auto sm:ml-0 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 shadow-sm hover:opacity-95"><Plus size={16} /> Add<span className="hidden sm:inline"> customer</span></button>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
        {/* List */}
        <section className={cn('min-h-0 flex-col rounded-2xl border border-border/70 bg-card overflow-hidden', mobileDetail && selected ? 'hidden lg:flex' : 'flex')}>
          <div className="p-3 border-b border-border/70 grid gap-2.5">
            <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or phone"
                className="w-full h-10 rounded-xl border border-border bg-background pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary" aria-label="Search customers" />
              {search && <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded inline-flex items-center justify-center text-muted-foreground hover:bg-muted" aria-label="Clear search"><X size={14} /></button>}
            </div>
              <div className="relative shrink-0">
                <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort"
                  className="h-10 appearance-none rounded-xl border border-border bg-background pl-3 pr-7 text-xs font-medium outline-none">
                  <option value="balance">Most owed</option><option value="name">A–Z</option><option value="recent">Newest</option>
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
                {FILTERS.map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setFilter(k)}
                    className={cn('h-7 shrink-0 rounded-full px-2.5 text-xs font-medium border transition-colors',
                      filter === k ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground')}>{l}</button>
                ))}
              </div>
            </div>
          </div>
          <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-border/50">
            {filtered.length === 0 && (
              <li className="px-4 py-14 text-center">
                <Users size={20} className="mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">{customers.length ? 'No customer matches' : 'No customers yet'}</p>
                {!customers.length && <p className="text-xs text-muted-foreground mt-1">Add your first customer to start tracking udhaar.</p>}
              </li>
            )}
            {filtered.slice(0, shown).map((c) => {
              const on = selected && String(selected.id) === String(c.id);
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => select(c)} aria-current={on ? 'true' : undefined}
                    className={cn('relative w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors', on ? 'bg-primary/[0.07]' : 'hover:bg-muted/50')}>
                    {on && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary" aria-hidden="true" />}
                    <span className={cn('h-10 w-10 rounded-full inline-flex items-center justify-center text-xs font-bold shrink-0', toneOf(c.name))}>{initials(c.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground truncate">{c.name}</span>
                      <span className="block text-xs text-muted-foreground truncate tabular-nums">{c.phone || 'No phone'}</span>
                    </span>
                    <span className="text-right text-sm font-semibold tabular-nums whitespace-nowrap">
                      {Math.abs(c.balance) <= 0.5 ? <span className="text-xs font-normal text-muted-foreground">Settled</span> : <BalanceText value={c.balance} />}
                    </span>
                  </button>
                </li>
              );
            })}
            {filtered.length > shown && (
              <li className="p-3 text-center">
                <button type="button" onClick={() => setShown((n) => n + 60)} className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground">Show more · {filtered.length - shown} left</button>
              </li>
            )}
          </ul>
        </section>

        {/* Account */}
        <section className={cn('min-h-0 rounded-2xl border border-border/70 bg-card overflow-hidden', mobileDetail && selected ? 'block' : 'hidden lg:block')}>
          {selected ? (
            <AccountPanel key={selected.id} customer={selected} onBack={() => setMobileDetail(false)}
              onEdit={() => { setEditing(selected); setFormOpen(true); }} onDelete={() => setDeleting(selected)} />
          ) : (
            <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center px-6">
              <span className="h-12 w-12 rounded-full bg-muted inline-flex items-center justify-center mb-3"><UserRound size={20} className="text-muted-foreground" /></span>
              <p className="text-sm font-medium text-foreground">Choose a customer</p>
              <p className="text-xs text-muted-foreground mt-1">Their balance, invoices and payments show here.</p>
            </div>
          )}
        </section>
      </div>

      <CustomerFormModal open={formOpen} onClose={() => setFormOpen(false)} onSubmit={saveCustomer} customer={editing} />
      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Delete {deleting?.name}?</DialogTitle>
          <DialogDescription>
            {deleting && Math.abs(deleting.balance) > 0.5
              ? `They still have a balance of ${rs(Math.abs(deleting.balance))}. Settle it before deleting.`
              : 'Their past invoices stay in your records. This can’t be undone.'}
          </DialogDescription>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setDeleting(null)} className="h-9 px-4 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted">Cancel</button>
            <button type="button" onClick={confirmDelete} disabled={deleting && Math.abs(deleting.balance) > 0.5}
              className="h-9 px-4 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-40">Delete</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
