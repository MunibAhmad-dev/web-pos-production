import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Phone, MapPin, Pencil, Trash2, MessageCircle, FileDown, Wallet, Landmark, Check, X,
  ChevronLeft, ChevronDown, ChevronRight, BookOpen, ArrowUpRight, ExternalLink, Copy, Truck, BarChart3, Layers,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import VendorFormModal from '../../components/vendors/VendorFormModal';
import CustomBillsPanel from '../../components/vendors/CustomBillsPanel';
import GlobalCustomBillsOverlay from '../../components/vendors/GlobalCustomBillsOverlay';
import { vendorBalances, khataBalances } from '@/lib/ledger';
import { parseDate, localStamp } from '@/lib/customerAccount';
import { buildVendorAccount, planVendorPayment, buildVendorPaymentEvents } from '@/lib/vendorAccount';
import { getReceiptSettings, buildAccountStatementHtml, downloadStatementPdf, shareStatementViaWhatsApp } from '../../utils/receipt';

const rs = (n) => 'Rs. ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const fmtDay = (raw) => { const d = parseDate(raw); return d && !isNaN(d) ? d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; };
const fmtDayTime = (raw) => { const d = parseDate(raw); return d && !isNaN(d) ? d.toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—'; };
const TONES = [
  'bg-violet-500/12 text-violet-700 dark:text-violet-300', 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
  'bg-teal-500/12 text-teal-700 dark:text-teal-300', 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  'bg-rose-500/12 text-rose-700 dark:text-rose-300', 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
];
const toneOf = (s = '') => TONES[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length];
const initials = (s = '') => String(s).replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

const PERIODS = [['all', 'All time'], ['today', 'Today'], ['week', '7 days'], ['month', '30 days'], ['custom', 'Custom']];
function periodRange(period, from, to) {
  const n = new Date(); const sod = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  if (period === 'today') return [sod, n];
  if (period === 'week') return [new Date(sod - 6 * 864e5), n];
  if (period === 'month') return [new Date(sod - 29 * 864e5), n];
  if (period === 'custom' && from && to) return [new Date(`${from}T00:00:00`), new Date(`${to}T23:59:59`)];
  return [null, null];
}

// Positive = you owe the vendor; negative = you paid ahead
function OweText({ value, className }) {
  if (Math.abs(value) < 0.5) return <span className={cn('text-muted-foreground', className)}>Settled</span>;
  return value > 0
    ? <span className={cn('text-rose-700 dark:text-rose-400', className)}>{rs(value)}</span>
    : <span className={cn('text-emerald-700 dark:text-emerald-400', className)}>{rs(-value)} ahead</span>;
}
const STATE_CHIP = {
  paid: ['Paid', 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'],
  partial: ['Part paid', 'bg-amber-500/12 text-amber-800 dark:text-amber-400'],
  unpaid: ['Unpaid', 'bg-rose-500/10 text-rose-700 dark:text-rose-400'],
  returned: ['Returned', 'bg-muted text-muted-foreground'],
  cancelled: ['Cancelled', 'bg-muted text-muted-foreground line-through'],
};

/* ── Pay vendor (desktop Smart Pay) ───────────────────────────────────────── */
function PayVendorDialog({ open, onClose, vendor, account, accounts, onSave }) {
  const due = Math.max(0, account?.totals.totalDue || 0);
  const [amount, setAmount] = useState(''); const [method, setMethod] = useState('cash');
  const [accountId, setAccountId] = useState(''); const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
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
  const plan = useMemo(() => (account && amt > 0 ? planVendorPayment(account, amt) : { allocations: [], advance: 0 }), [account, amt]);
  const save = async () => {
    setError('');
    if (!(amt > 0)) return setError('Enter the amount paid.');
    if (accounts.length && !accountId) return setError('Choose which account the money left from.');
    setSaving(true);
    try { await onSave({ amount: amt, accountId, note }); onClose(); }
    catch (e) { setError(e?.message || 'Could not save the payment.'); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="w-full max-w-[460px] gap-0 p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-5 border-b border-border bg-muted/40">
          <DialogTitle className="text-sm font-medium text-muted-foreground">Pay vendor</DialogTitle>
          <p className="mt-1 text-lg font-semibold text-foreground">{vendor?.name}</p>
          <DialogDescription className="mt-0.5 text-xs text-muted-foreground">You owe {rs(due)}{account?.totals.khataDue > 0.5 ? ` · incl. ${rs(account.totals.khataDue)} on custom bills` : ''}</DialogDescription>
        </div>
        <div className="px-6 py-5 grid gap-5 max-h-[62vh] overflow-y-auto">
          <div>
            <label htmlFor="vpay-amount" className="text-sm font-medium text-foreground">Amount paid</label>
            <div className="relative mt-1.5">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rs.</span>
              <input id="vpay-amount" autoFocus inputMode="decimal" value={amount} onFocus={(e) => e.target.select()}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} onKeyDown={(e) => e.key === 'Enter' && save()}
                className="w-full h-12 rounded-xl border border-border bg-background pl-11 pr-3 text-lg font-semibold tabular-nums outline-none focus:ring-[3px] focus:ring-primary/20 focus:border-primary" />
            </div>
            {due > 0.5 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[['Full amount', due], ['Half', due / 2]].map(([l, v]) => (
                  <button key={l} type="button" onClick={() => setAmount(String(Math.round(v)))} className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground">{l} · {rs(v)}</button>
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
              <p className="text-sm font-medium text-foreground mb-1.5">Paid from</p>
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
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional) — e.g. cheque no., bank ref"
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/25" />
          {amt > 0 && (plan.allocations.length > 0 || plan.advance > 0) && (
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Applied oldest first</p>
              <ul className="grid gap-1.5 text-sm">
                {plan.allocations.map((a) => (
                  <li key={`${a.kind}-${a.id}`} className="flex items-center justify-between gap-3">
                    <span className="truncate text-foreground">{a.label}<span className="ml-1.5 text-xs text-muted-foreground">{a.clears ? 'cleared' : `${rs(a.remaining - a.amount)} left`}</span></span>
                    <span className="tabular-nums font-medium text-foreground">{rs(a.amount)}</span>
                  </li>
                ))}
                {plan.advance > 0 && <li className="flex items-center justify-between gap-3 text-emerald-700 dark:text-emerald-400"><span>Paid ahead (advance)</span><span className="tabular-nums font-medium">{rs(plan.advance)}</span></li>}
              </ul>
            </div>
          )}
          {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        </div>
        <div className="flex gap-2 px-6 py-4 border-t border-border">
          <button type="button" onClick={onClose} disabled={saving} className="h-11 px-4 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-60">
            {saving ? 'Saving…' : <><Check size={16} /> Save payment{amt > 0 ? ` · ${rs(amt)}` : ''}</>}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Vendor account (right side) ──────────────────────────────────────────── */
function VendorPanel({ vendor, onBack, onEdit, onDelete }) {
  const { list, pushBatch, nextId } = useDataStore();
  const { showToast } = useToast(); const { user } = useAuth(); const navigate = useNavigate();
  const [tab, setTab] = useState('ledger'); const [period, setPeriod] = useState('all');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [payOpen, setPayOpen] = useState(false); const [billsOpen, setBillsOpen] = useState(false);
  const [expanded, setExpanded] = useState(null); const [stmtBusy, setStmtBusy] = useState(null); const [confirm, setConfirm] = useState(null);

  const purchases = list('purchase'); const purchaseItems = list('purchase_item'); const batches = list('inventory_batch');
  const products = list('product'); const payments = list('vendor_payment'); const returns = list('purchase_return');
  const khatas = list('vendor_khata'); const khataPayments = list('vendor_khata_payment');
  const accounts = list('account'); const accountTxns = list('account_txn');

  const account = useMemo(() => buildVendorAccount({ vendor, purchases, purchaseItems, batches, products, payments, returns, khatas, khataPayments }),
    [vendor, purchases, purchaseItems, batches, products, payments, returns, khatas, khataPayments]);
  const t = account.totals;
  const supplied = useMemo(() => products.filter((p) => String(p.vendor_id) === String(vendor.id)), [products, vendor.id]);

  const [start, end] = periodRange(period, from, to);
  const inRange = (raw) => { if (!start) return true; const d = parseDate(raw); return d && d >= start && d <= end; };
  const ledgerRows = useMemo(() => {
    if (!start) return { opening: 0, rows: account.ledger };
    let opening = 0; const rows = [];
    for (const r of account.ledger) { const d = parseDate(r.date); if (d && d < start) opening = r.balance; else if (d && d <= end) rows.push(r); }
    return { opening, rows };
  }, [account, start, end]);
  const bills = account.bills.filter((b) => inRange(b.date_created));
  const paymentRows = account.payments.filter((p) => inRange(p.date_created || p.date_added));
  const billNo = (pid) => account.bills.find((b) => String(b.id) === String(pid))?.no || `PO #${pid}`;

  const pay = async ({ amount, accountId, note }) => {
    const { events } = buildVendorPaymentEvents({ account, vendor, amount, note, accountId, nextId });
    await pushBatch(events);
    showToast(`${rs(amount)} paid to ${vendor.name}`);
  };

  const removePayment = (p) => {
    const group = p.payment_group;
    const rows = group ? account.payments.filter((x) => x.payment_group === group) : [p];
    const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    setConfirm({
      title: `Delete payment of ${rs(total)}?`,
      body: rows.length > 1 ? `It was spread over ${rows.length} bills. All parts and the matching cash/bank entry will be removed.` : 'The matching cash/bank entry will be removed too.',
      action: async () => {
        const events = rows.map((r) => ({ entityType: 'vendor_payment', operation: 'delete', payload: { id: r.id } }));
        // Desktop delete-vendor-payment: [SPG:] for Smart Pay, [VPId:] for single payments, then the older note format
        const oldNote = `Vendor payment — ${p.notes || (p.purchase_id ? `PO #${p.purchase_id}` : 'Manual payment')}`;
        const txn = accountTxns.find((x) => x.type === 'out' && (group ? String(x.note || '').includes(`[SPG:${group}]`)
          : String(x.note || '').includes(`[VPId:${p.id}]`) || (String(x.note || '') === oldNote && Math.abs(Number(x.amount) - Number(p.amount)) < 0.01)));
        if (txn) events.push({ entityType: 'account_txn', operation: 'delete', payload: { id: txn.id } });
        await pushBatch(events);
        showToast('Payment deleted');
      },
    });
  };

  const statement = async (action) => {
    if (stmtBusy) return;
    setStmtBusy(action);
    try {
      const settings = getReceiptSettings(); const synced = list('settings')?.[0] || {};
      const rows = (start ? ledgerRows.rows : account.ledger).map((r) => ({
        date: parseDate(r.date) || new Date(), type: r.type, desc: [r.ref || r.type, r.detail].filter(Boolean).join(' — '), debit: r.debit, credit: r.credit,
      }));
      if (start && Math.abs(ledgerRows.opening) > 0.005) rows.unshift({ date: start, type: 'Opening', desc: 'Opening balance', debit: Math.max(0, ledgerRows.opening), credit: Math.max(0, -ledgerRows.opening) });
      const html = buildAccountStatementHtml({
        name: vendor.name, phone: vendor.phone, address: vendor.address, type: 'vendor', ledger: rows,
        totals: { invoiced: t.purchased + t.khataDue, paid: t.paid, returned: t.returned, balance: t.totalDue },
        settings: { ...settings, store_name: settings.store_name || synced.store_name || user?.store_name || 'My Store' },
      });
      const filename = `statement-${(vendor.name || 'vendor').replace(/\s+/g, '-')}.pdf`;
      if (action === 'pdf') await downloadStatementPdf(html, filename);
      else await shareStatementViaWhatsApp(html, { name: vendor.name, phone: vendor.phone, balance: t.totalDue, filename });
    } catch { showToast('Could not create the statement', 'error'); }
    finally { setStmtBusy(null); }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start gap-3 sm:gap-4 px-4 sm:px-6 pt-4 sm:pt-5 pb-4">
        <button type="button" onClick={onBack} className="lg:hidden -ml-1 mt-2 h-8 w-8 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:bg-muted" aria-label="Back to vendors"><ChevronLeft size={18} /></button>
        <span className={cn('h-11 w-11 sm:h-14 sm:w-14 rounded-xl sm:rounded-2xl inline-flex items-center justify-center text-base sm:text-lg font-bold shrink-0', toneOf(vendor.name))}>{initials(vendor.name)}</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg sm:text-xl font-extrabold tracking-tight text-foreground leading-snug break-words">{vendor.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {vendor.phone && <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(vendor.phone); showToast('Number copied'); } catch { /* ignore */ } }} className="inline-flex items-center gap-1.5 hover:text-foreground tabular-nums" title="Copy number"><Phone size={13} /> {vendor.phone} <Copy size={11} className="opacity-60" /></button>}
            {vendor.address && <span className="inline-flex items-center gap-1.5 min-w-0"><MapPin size={13} /> <span className="truncate">{vendor.address}</span></span>}
            {supplied.length > 0 && <span className="text-xs">{supplied.length} product{supplied.length === 1 ? '' : 's'} supplied</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onEdit} className="h-9 w-9 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit details" aria-label="Edit details"><Pencil size={16} /></button>
          <button type="button" onClick={onDelete} className="h-9 w-9 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600" title="Delete vendor" aria-label="Delete vendor"><Trash2 size={16} /></button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pb-6">
        <section className={cn('rounded-2xl border p-5', t.totalDue > 0.5 ? 'border-rose-500/25 bg-rose-500/[0.04]' : t.totalDue < -0.5 ? 'border-emerald-500/25 bg-emerald-500/[0.05]' : 'border-border bg-muted/30')}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[13px] font-medium text-muted-foreground">{t.totalDue < -0.5 ? 'Paid ahead to them' : 'You owe them'}</p>
              <p className={cn('mt-1 text-[34px] leading-none font-bold tabular-nums tracking-tight', t.totalDue > 0.5 ? 'text-rose-700 dark:text-rose-300' : t.totalDue < -0.5 ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground')}>{rs(Math.abs(t.totalDue))}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Purchases <span className="font-medium text-foreground tabular-nums">{rs(t.purchaseBalance)}</span><span className="mx-1.5">·</span>
                Custom bills <span className="font-medium text-foreground tabular-nums">{rs(t.khataDue)}</span>
                {t.openBills > 0 && <><span className="mx-1.5">·</span>{t.openBills} open bill{t.openBills === 1 ? '' : 's'}</>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPayOpen(true)} className="w-full sm:w-auto justify-center h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 shadow-sm hover:opacity-95"><ArrowUpRight size={16} /> Pay vendor</button>
              <button type="button" onClick={() => setBillsOpen(true)} className="flex-1 sm:flex-none justify-center whitespace-nowrap h-10 px-2.5 sm:px-3.5 rounded-xl border border-border bg-card text-sm font-medium text-foreground inline-flex items-center gap-2 hover:bg-muted"><BookOpen size={15} /> <span className="sm:hidden">Bills</span><span className="hidden sm:inline">Custom bills</span></button>
              <button type="button" onClick={() => statement('pdf')} disabled={!!stmtBusy} className="flex-1 sm:flex-none justify-center whitespace-nowrap h-10 px-2.5 sm:px-3.5 rounded-xl border border-border bg-card text-sm font-medium text-foreground inline-flex items-center gap-2 hover:bg-muted disabled:opacity-60"><FileDown size={15} /> {stmtBusy === 'pdf' ? 'Preparing…' : 'Statement'}</button>
              {vendor.phone && <button type="button" onClick={() => statement('wa')} disabled={!!stmtBusy} title="Send statement on WhatsApp" aria-label="Send statement on WhatsApp" className="h-10 w-10 shrink-0 rounded-xl border border-border bg-card inline-flex items-center justify-center text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-60"><MessageCircle size={16} /></button>}
            </div>
          </div>
        </section>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['Purchased', rs(t.purchased)], ['Paid', rs(t.paid)], ['Returned', rs(t.returned)], ['Bills', account.bills.filter((b) => !b.cancelled).length.toLocaleString('en-PK')]].map(([l, v]) => (
            <div key={l} className="rounded-xl border border-border/70 bg-card px-4 py-3">
              <dt className="text-xs text-muted-foreground">{l}<span className="hidden sm:inline">{l !== 'Bills' ? ' (all time)' : ''}</span></dt>
              <dd className="mt-1 text-base font-semibold tabular-nums text-foreground">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border">
          <div className="flex gap-1 -mb-px overflow-x-auto [scrollbar-width:none]" role="tablist">
            {[['ledger', 'Ledger'], ['bills', `Purchases · ${bills.length}`], ['payments', `Payments · ${paymentRows.length}`], ['custom', `Custom bills · ${account.customBills.length}`], ['products', `Products · ${supplied.length}`]].map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={cn('h-10 px-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors', tab === k ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>{l}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 pb-2">
            <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period" className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-medium outline-none">
              {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            {period === 'custom' && <>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 rounded-lg border border-border bg-background px-2 text-xs" aria-label="From" />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 rounded-lg border border-border bg-background px-2 text-xs" aria-label="To" />
            </>}
          </div>
        </div>

        {tab === 'ledger' && (
          <div className="mt-3">
            {ledgerRows.rows.length === 0 && !start ? <p className="py-12 text-center text-sm text-muted-foreground">No activity yet.</p> : (
              <ul className="divide-y divide-border/60">
                {start && <li className="flex items-center justify-between gap-3 py-3 text-sm"><span className="font-medium text-foreground">Opening balance · {fmtDay(start)}</span><OweText value={ledgerRows.opening} className="font-semibold tabular-nums" /></li>}
                {[...ledgerRows.rows].reverse().map((r) => (
                  <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[110px_minmax(0,1fr)_110px_110px_130px] items-center gap-x-3 gap-y-0.5 py-2.5 text-sm">
                    <span className="hidden sm:block text-muted-foreground tabular-nums">{fmtDay(r.date)}</span>
                    <span className="min-w-0">
                      <span className="font-medium text-foreground">{r.type === 'Payment' ? 'Payment' : r.ref || r.type}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{[r.type === 'Payment' && r.ref ? `on ${r.ref}` : r.type === 'Purchase' ? '' : r.type !== (r.ref || r.type) ? r.type : '', r.detail].filter(Boolean).join(' · ')}</span>
                      <span className="block sm:hidden text-xs text-muted-foreground tabular-nums">{fmtDay(r.date)}</span>
                    </span>
                    <span className="hidden sm:block text-right tabular-nums text-foreground">{r.debit ? rs(r.debit) : ''}</span>
                    <span className="hidden sm:block text-right tabular-nums text-emerald-700 dark:text-emerald-400">{r.credit ? rs(r.credit) : ''}</span>
                    <span className="text-right">
                      <span className={cn('block sm:hidden text-sm font-semibold tabular-nums', r.credit ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground')}>{r.credit ? `− ${rs(r.credit)}` : `+ ${rs(r.debit)}`}</span>
                      <span className="text-[11px] sm:text-sm sm:font-semibold tabular-nums whitespace-nowrap"><span className="sm:hidden text-muted-foreground">Bal. </span><OweText value={r.balance} /></span>
                    </span>
                  </li>
                ))}
                {start && ledgerRows.rows.length === 0 && <li className="py-8 text-center text-sm text-muted-foreground">Nothing in this period.</li>}
              </ul>
            )}
          </div>
        )}

        {tab === 'bills' && (
          <ul className="mt-3 divide-y divide-border/60">
            {bills.length === 0 && <li className="py-12 text-center text-sm text-muted-foreground">No purchases{start ? ' in this period' : ''}.</li>}
            {bills.map((b) => {
              const [label, chip] = STATE_CHIP[b.state] || STATE_CHIP.unpaid; const open = expanded === b.id;
              return (
                <li key={b.id} className="py-1">
                  <div className="flex items-center gap-3 py-2">
                    <button type="button" onClick={() => setExpanded(open ? null : b.id)} className="flex flex-1 min-w-0 items-center gap-3 text-left" aria-expanded={open}>
                      <ChevronRight size={15} className={cn('text-muted-foreground transition-transform shrink-0', open && 'rotate-90')} />
                      <span className="min-w-0"><span className="block text-sm font-medium text-foreground">{b.no}</span><span className="block text-xs text-muted-foreground tabular-nums">{fmtDayTime(b.date_created)}{b.lines.length ? ` · ${b.lines.length} item${b.lines.length === 1 ? '' : 's'}` : ''}</span></span>
                    </button>
                    <span className={cn('text-[11px] font-semibold rounded-md px-1.5 py-0.5 whitespace-nowrap', chip)}>{label}</span>
                    <span className="w-28 text-right"><span className="block text-sm font-semibold tabular-nums text-foreground">{rs(b.total)}</span>{b.remaining > 0.5 && <span className="block text-[11px] tabular-nums text-rose-700 dark:text-rose-400">{rs(b.remaining)} due</span>}</span>
                  </div>
                  {open && (
                    <div className="mb-3 ml-7 rounded-xl border border-border bg-muted/20">
                      <ul className="divide-y divide-border/60 text-sm">
                        {b.lines.length === 0 && <li className="px-4 py-2.5 text-xs text-muted-foreground">Item lines for this bill haven’t synced to the web yet.</li>}
                        {b.lines.map((it) => (
                          <li key={it.id} className="flex items-center gap-3 px-4 py-2">
                            <span className="flex-1 min-w-0 truncate text-foreground">{it.name}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">{Number(it.quantity).toLocaleString('en-PK')} × {rs(it.price)}</span>
                            <span className="w-24 text-right tabular-nums text-foreground">{rs(it.amount)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                        <span className="tabular-nums">Paid {rs(b.paid)}{b.returned > 0 && <> · Returned {rs(b.returned)}</>}</span>
                        <button type="button" onClick={() => navigate('/purchases')} className="h-8 px-2.5 rounded-lg inline-flex items-center gap-1.5 hover:bg-muted hover:text-foreground"><ExternalLink size={14} /> Open in Purchases</button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {tab === 'payments' && (
          <ul className="mt-3 divide-y divide-border/60">
            {paymentRows.length === 0 && <li className="py-12 text-center text-sm text-muted-foreground">No payments{start ? ' in this period' : ''}.</li>}
            {paymentRows.map((p) => {
              const acc = accounts.find((a) => String(a.id) === String(p.account_id));
              const linked = p.purchase_id != null && p.purchase_id !== '' && Number(p.purchase_id) !== 0;
              return (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <span className="h-9 w-9 rounded-full bg-rose-500/10 text-rose-600 inline-flex items-center justify-center shrink-0"><ArrowUpRight size={16} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{linked ? `For ${billNo(p.purchase_id)}` : 'General / advance payment'}{p.payment_group && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">smart pay</span>}</p>
                    <p className="text-xs text-muted-foreground truncate tabular-nums">{fmtDayTime(p.date_created || p.date_added)}{acc ? ` · ${acc.name}` : ''}{p.notes ? ` · ${p.notes}` : ''}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-foreground">{rs(p.amount)}</span>
                  <button type="button" onClick={() => removePayment(p)} className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10" aria-label="Delete payment" title="Delete payment"><Trash2 size={14} /></button>
                </li>
              );
            })}
          </ul>
        )}

        {tab === 'custom' && (
          <div className="mt-3">
            {account.customBills.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">No custom bills with this vendor.</p>
                <button type="button" onClick={() => setBillsOpen(true)} className="mt-3 h-9 px-4 rounded-lg border border-border text-sm font-medium inline-flex items-center gap-2 hover:bg-muted"><Plus size={15} /> New custom bill</button>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-border/60">
                  {account.customBills.map((k) => (
                    <li key={k.id} className="flex items-center gap-3 py-3">
                      <span className="h-9 w-9 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 inline-flex items-center justify-center shrink-0"><BookOpen size={15} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{k.title || k.description || 'Custom bill'}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">{fmtDay(k.date_created || k.created_at)} · {rs(k.total_amount)} · paid {rs(k.paid)}</p>
                      </div>
                      {k.remaining > 0.5 ? <span className="text-sm font-semibold tabular-nums text-rose-700 dark:text-rose-400">{rs(k.remaining)} due</span> : <span className="text-[11px] font-semibold rounded-md px-1.5 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Paid</span>}
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => setBillsOpen(true)} className="mt-3 text-sm font-medium text-primary inline-flex items-center gap-1 hover:underline">Manage custom bills <ChevronRight size={14} /></button>
              </>
            )}
          </div>
        )}

        {tab === 'products' && (
          <ul className="mt-3 divide-y divide-border/60">
            {supplied.length === 0 && <li className="py-12 text-center text-sm text-muted-foreground">No products are linked to this vendor.</li>}
            {supplied.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="flex-1 min-w-0 truncate text-foreground">{p.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">Cost {rs(p.purchase_price)}</span>
                <span className="w-20 text-right tabular-nums text-foreground">{Number(p.stock || 0).toLocaleString('en-PK')} in stock</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PayVendorDialog open={payOpen} onClose={() => setPayOpen(false)} vendor={vendor} account={account} accounts={accounts} onSave={pay} />
      <AnimatePresence>{billsOpen && <CustomBillsPanel vendor={vendor} onClose={() => setBillsOpen(false)} />}</AnimatePresence>
      <Dialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>{confirm?.title}</DialogTitle>
          <DialogDescription>{confirm?.body}</DialogDescription>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirm(null)} className="h-9 px-4 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted">Keep</button>
            <button type="button" onClick={async () => { const a = confirm.action; setConfirm(null); try { await a(); } catch (e) { showToast(e?.message || 'Something went wrong', 'error'); } }} className="h-9 px-4 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700">Yes, continue</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */

const FILTERS = [['all', 'All'], ['owing', 'You owe'], ['ahead', 'Paid ahead'], ['settled', 'Settled']];

export default function VendorsPage() {
  const navigate = useNavigate();
  const { list, pushEntity, pushBatch } = useDataStore();
  const { showToast } = useToast();
  const [search, setSearch] = useState(''); const [filter, setFilter] = useState('all'); const [sort, setSort] = useState('balance');
  const [selectedId, setSelectedId] = useState(null); const [mobileDetail, setMobileDetail] = useState(false);
  const [formOpen, setFormOpen] = useState(false); const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null); const [showGlobalBills, setShowGlobalBills] = useState(false); const [shown, setShown] = useState(60);

  const vendors = list('vendor'); const purchases = list('purchase'); const payments = list('vendor_payment');
  const returns = list('purchase_return'); const khatas = list('vendor_khata'); const khataPayments = list('vendor_khata_payment');

  // Desktop get-vendors: purchase balance + open custom bills
  const rows = useMemo(() => {
    const pb = vendorBalances({ purchases, vendorPayments: payments, purchaseReturns: returns });
    const kb = khataBalances(khatas, khataPayments, 'vendor_id');
    return vendors.map((v) => ({ ...v, balance: Math.round(((pb.get(String(v.id)) || 0) + (kb.get(String(v.id)) || 0)) * 100) / 100 }));
  }, [vendors, purchases, payments, returns, khatas, khataPayments]);
  const stats = useMemo(() => { const o = rows.filter((r) => r.balance > 0.5); return { total: rows.length, owingCount: o.length, payable: o.reduce((s, r) => s + r.balance, 0) }; }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = rows.filter((v) => !q || v.name?.toLowerCase().includes(q) || String(v.phone || '').includes(q));
    if (filter === 'owing') r = r.filter((v) => v.balance > 0.5);
    if (filter === 'ahead') r = r.filter((v) => v.balance < -0.5);
    if (filter === 'settled') r = r.filter((v) => Math.abs(v.balance) <= 0.5);
    return [...r].sort((a, b) => (sort === 'name' ? String(a.name).localeCompare(String(b.name))
      : sort === 'recent' ? String(b.created_at || '').localeCompare(String(a.created_at || ''))
        : b.balance - a.balance || String(a.name).localeCompare(String(b.name))));
  }, [rows, search, filter, sort]);
  useEffect(() => setShown(60), [search, filter, sort]);

  const [exportingPDF, setExportingPDF] = useState(false);
  const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const exportPDF = async () => {
    if (exportingPDF || filtered.length === 0) return;
    setExportingPDF(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const st = list('settings')?.[0] || {};
      const storeName = st.store_name || st.business_name || 'My Store';
      const body = filtered.map((v) => `<tr><td>${esc(v.name) || '—'}</td><td>${esc(v.phone) || '—'}</td><td>${esc(v.address) || '—'}</td>
        <td class="num ${v.balance > 0.5 ? 'due' : 'ok'}">${Math.abs(v.balance) <= 0.5 ? 'Settled' : v.balance > 0 ? rs(v.balance) : `${rs(-v.balance)} ahead`}</td></tr>`).join('');
      const owed = filtered.filter((v) => v.balance > 0.5);
      const el = document.createElement('div');
      el.innerHTML = `<style>
          div{font-family:Arial,sans-serif;font-size:11px;color:#111}h2{font-size:16px;margin:0 0 2px}p.sub{font-size:10px;color:#666;margin:0 0 12px}
          table{width:100%;border-collapse:collapse}th{background:#1e293b;color:#fff;padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em}
          td{padding:6px 10px;border-bottom:1px solid #e2e8f0}.num{text-align:right;font-weight:700}.ok{color:#16a34a}.due{color:#b91c1c}
          .sum{margin-top:14px;padding-top:10px;border-top:2px solid #1e293b;display:flex;gap:24px}.sum b{display:block;font-size:14px}
        </style>
        <h2>${esc(storeName)} — Vendors</h2>
        <p class="sub">${new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' })} · ${filtered.length} vendors</p>
        <table><thead><tr><th>Vendor</th><th>Phone</th><th>Address</th><th style="text-align:right">You owe</th></tr></thead><tbody>${body}</tbody></table>
        <div class="sum"><span>Vendors<b>${filtered.length}</b></span><span>You owe<b>${owed.length}</b></span><span>Total payable<b style="color:#b91c1c">${rs(owed.reduce((x, v) => x + v.balance, 0))}</b></span></div>`;
      await html2pdf().set({ margin: 10, filename: `Vendors-${localStamp().slice(0, 10)}.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } }).from(el).save();
    } catch { showToast('Could not create the PDF', 'error'); }
    finally { setExportingPDF(false); }
  };

  const selected = rows.find((v) => String(v.id) === String(selectedId)) || (typeof window !== 'undefined' && window.innerWidth >= 1024 ? filtered[0] : null);

  const saveVendor = async (form) => {
    const now = localStamp(); const name = String(form.name || '').trim();
    if (!name) throw new Error('Vendor name is required');
    if (editing) { await pushEntity('vendor', 'update', { ...editing, ...form, name, updated_at: now }); showToast('Vendor updated'); }
    else {
      const created = await pushEntity('vendor', 'create', { name, phone: form.phone || '', email: form.email || '', address: form.address || '', created_at: now, updated_at: now });
      if (created?.id != null) setSelectedId(created.id);
      showToast('Vendor added');
    }
  };
  const confirmDelete = async () => {
    const v = deleting; setDeleting(null);
    if (!v) return;
    if (Math.abs(v.balance) > 0.5) { showToast(`${v.name} still has a balance of ${rs(Math.abs(v.balance))} — settle it first`, 'error'); return; }
    await pushBatch([{ entityType: 'vendor', operation: 'delete', payload: { id: v.id } }]);
    if (String(selectedId) === String(v.id)) setSelectedId(null);
    showToast('Vendor deleted');
  };

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100dvh-8.5rem)]">
      <header className={cn('flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', mobileDetail && selected ? 'hidden lg:flex' : 'flex')}>
        <div>
          <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">Vendors</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{stats.total.toLocaleString('en-PK')} vendor{stats.total === 1 ? '' : 's'}{stats.owingCount > 0 && <> · <span className="text-rose-700 dark:text-rose-400 font-medium">you owe {stats.owingCount === 1 && stats.total === 1 ? 'them' : `${stats.owingCount} of them`} {rs(stats.payable)}</span></>}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowGlobalBills(true)} className="h-10 px-3.5 rounded-xl border border-border bg-card text-sm font-medium inline-flex items-center gap-2 hover:bg-muted"><Layers size={15} /> <span className="hidden sm:inline">All custom bills</span><span className="sm:hidden">Bills</span></button>
          <button type="button" onClick={exportPDF} disabled={exportingPDF || !filtered.length} title="Download the vendor list as PDF" aria-label="Download the vendor list as PDF" className="h-10 w-10 shrink-0 rounded-xl border border-border bg-card inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"><FileDown size={15} /></button>
          <button type="button" onClick={() => navigate('/vendor-reports')} className="h-10 px-3.5 rounded-xl border border-border bg-card text-sm font-medium inline-flex items-center gap-2 hover:bg-muted"><BarChart3 size={15} /> Reports</button>
          <button type="button" onClick={() => { setEditing(null); setFormOpen(true); }} className="ml-auto sm:ml-0 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 shadow-sm hover:opacity-95"><Plus size={16} /> Add<span className="hidden sm:inline"> vendor</span></button>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className={cn('min-h-0 flex-col rounded-2xl border border-border/70 bg-card overflow-hidden', mobileDetail && selected ? 'hidden lg:flex' : 'flex')}>
          <div className="p-3 border-b border-border/70 grid gap-2.5">
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or phone" aria-label="Search vendors"
                  className="w-full h-10 rounded-xl border border-border bg-background pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary" />
                {search && <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded inline-flex items-center justify-center text-muted-foreground hover:bg-muted" aria-label="Clear search"><X size={14} /></button>}
              </div>
              <div className="relative shrink-0">
                <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" className="h-10 appearance-none rounded-xl border border-border bg-background pl-3 pr-7 text-xs font-medium outline-none">
                  <option value="balance">Most owed</option><option value="name">A–Z</option><option value="recent">Newest</option>
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
              {FILTERS.map(([k, l]) => (
                <button key={k} type="button" onClick={() => setFilter(k)} className={cn('h-7 shrink-0 rounded-full px-2.5 text-xs font-medium border transition-colors', filter === k ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground')}>{l}</button>
              ))}
            </div>
          </div>
          <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-border/50">
            {filtered.length === 0 && (
              <li className="px-4 py-14 text-center">
                <Truck size={20} className="mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">{vendors.length ? 'No vendor matches' : 'No vendors yet'}</p>
                {!vendors.length && <p className="text-xs text-muted-foreground mt-1">Add the suppliers you buy stock from.</p>}
              </li>
            )}
            {filtered.slice(0, shown).map((v) => {
              const on = selected && String(selected.id) === String(v.id);
              return (
                <li key={v.id}>
                  <button type="button" onClick={() => { setSelectedId(v.id); setMobileDetail(true); }} aria-current={on ? 'true' : undefined}
                    className={cn('relative w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors', on ? 'bg-primary/[0.07]' : 'hover:bg-muted/50')}>
                    {on && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary" aria-hidden="true" />}
                    <span className={cn('h-10 w-10 rounded-full inline-flex items-center justify-center text-xs font-bold shrink-0', toneOf(v.name))}>{initials(v.name)}</span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-foreground truncate">{v.name}</span><span className="block text-xs text-muted-foreground truncate tabular-nums">{v.phone || 'No phone'}</span></span>
                    <span className="text-right text-sm font-semibold tabular-nums whitespace-nowrap">{Math.abs(v.balance) <= 0.5 ? <span className="text-xs font-normal text-muted-foreground">Settled</span> : <OweText value={v.balance} />}</span>
                  </button>
                </li>
              );
            })}
            {filtered.length > shown && <li className="p-3 text-center"><button type="button" onClick={() => setShown((n) => n + 60)} className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground">Show more · {filtered.length - shown} left</button></li>}
          </ul>
        </section>

        <section className={cn('min-h-0 rounded-2xl border border-border/70 bg-card overflow-hidden', mobileDetail && selected ? 'block' : 'hidden lg:block')}>
          {selected ? (
            <VendorPanel key={selected.id} vendor={selected} onBack={() => setMobileDetail(false)} onEdit={() => { setEditing(selected); setFormOpen(true); }} onDelete={() => setDeleting(selected)} />
          ) : (
            <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center px-6">
              <span className="h-12 w-12 rounded-full bg-muted inline-flex items-center justify-center mb-3"><Truck size={20} className="text-muted-foreground" /></span>
              <p className="text-sm font-medium text-foreground">Choose a vendor</p>
              <p className="text-xs text-muted-foreground mt-1">What you owe, bills and payments show here.</p>
            </div>
          )}
        </section>
      </div>

      <VendorFormModal open={formOpen} onClose={() => setFormOpen(false)} onSubmit={saveVendor} vendor={editing} />
      {showGlobalBills && <GlobalCustomBillsOverlay onClose={() => setShowGlobalBills(false)} />}
      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Delete {deleting?.name}?</DialogTitle>
          <DialogDescription>{deleting && Math.abs(deleting.balance) > 0.5 ? `There’s still a balance of ${rs(Math.abs(deleting.balance))}. Settle it before deleting.` : 'Past purchases stay in your records. This can’t be undone.'}</DialogDescription>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setDeleting(null)} className="h-9 px-4 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted">Cancel</button>
            <button type="button" onClick={confirmDelete} disabled={deleting && Math.abs(deleting.balance) > 0.5} className="h-9 px-4 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-40">Delete</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
