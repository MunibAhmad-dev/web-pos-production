import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, ArrowLeftRight, ArrowDownLeft, ArrowUpRight, Landmark, Wallet, Search, X, Pencil, Trash2,
  ShoppingBag, Package, Receipt, RotateCcw, UserMinus, Users, ArrowDownUp, ChevronRight, Banknote,
} from 'lucide-react';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { EntrySheet, SheetButton, ConfirmDialog, PERIODS, periodRange } from '@/components/people/peopleKit';
import { parseDate, localStamp, buildCustomerAccount } from '@/lib/customerAccount';
import { cn } from '@/lib/utils';

/* ── helpers ──────────────────────────────────────────────────────────────── */
const num = (v) => Number(v) || 0;
const rs = (n) => 'Rs. ' + Math.round(num(n)).toLocaleString('en-PK');
const signed = (n) => (n < 0 ? '−' : '+') + rs(Math.abs(n));
const tsOf = (raw) => parseDate(raw)?.getTime() || 0;
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
function dayLabel(d) {
  if (!d || isNaN(d) || d.getTime() === 0) return 'No date';
  const now = new Date(); const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return 'Today';
  if (sameDay(d, y)) return 'Yesterday';
  return d.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}
const timeOf = (raw) => { const d = parseDate(raw); return d && !isNaN(d) ? d.toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' }) : ''; };
const last4 = (s) => { const d = String(s || '').replace(/\s/g, ''); return d.length >= 4 ? d.slice(-4) : d; };
/** Internal tags the desktop appends to notes ([EID:12], [SPG:sp-…], [VPId:3]) aren't for people. */
const cleanNote = (s) => String(s || '').replace(/\s*\[(?:EID|SPG|VPId|SPId|CID)[^\]]*\]/gi, '').trim();

/** Category → label, icon and tint. Unknown categories fall back to money in / money out. */
const KINDS = {
  sale: { label: 'Sale payment', icon: ShoppingBag, tint: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' },
  purchase: { label: 'Vendor payment', icon: Package, tint: 'bg-orange-500/12 text-orange-600 dark:text-orange-400' },
  expense: { label: 'Expense', icon: Receipt, tint: 'bg-amber-500/14 text-amber-700 dark:text-amber-400' },
  transfer: { label: 'Transfer', icon: ArrowLeftRight, tint: 'bg-sky-500/12 text-sky-600 dark:text-sky-400' },
  drawing: { label: 'Partner drawing', icon: UserMinus, tint: 'bg-violet-500/12 text-violet-600 dark:text-violet-400' },
  sale_return: { label: 'Refund', icon: RotateCcw, tint: 'bg-rose-500/12 text-rose-600 dark:text-rose-400' },
  salary: { label: 'Salary', icon: Users, tint: 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-400' },
};
const SYSTEM = new Set(['sale', 'purchase', 'expense', 'drawing', 'sale_return', 'salary']);
function kindOf(t) {
  const k = KINDS[String(t.category || '').toLowerCase()];
  if (k) return k;
  return t.type === 'in'
    ? { label: t.category && t.category !== 'manual' ? t.category : 'Money added', icon: ArrowDownLeft, tint: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' }
    : { label: t.category && t.category !== 'manual' ? t.category : 'Money taken out', icon: ArrowUpRight, tint: 'bg-muted text-foreground/70' };
}

/** Card finishes — cash is green, banks cycle through deep tones. White text reads on all of them in both themes. */
const CASH_FINISH = 'from-emerald-500 via-emerald-600 to-teal-700';
const BANK_FINISHES = ['from-indigo-500 via-indigo-600 to-blue-800', 'from-sky-500 via-sky-600 to-cyan-800', 'from-violet-500 via-violet-600 to-fuchsia-800', 'from-slate-600 via-slate-700 to-slate-900', 'from-rose-500 via-rose-600 to-pink-800'];
const BAR = ['bg-emerald-500', 'bg-indigo-500', 'bg-sky-500', 'bg-violet-500', 'bg-slate-500', 'bg-rose-500'];

/** Closing balance for each of the last `days` days — drawn as the card's sparkline. */
function dailyBalances(account, txns, days = 30) {
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const pts = [];
  const sorted = txns.slice().sort((a, b) => tsOf(a.date_created) - tsOf(b.date_created));
  let bal = num(account.opening_balance); let i = 0;
  for (let d = days - 1; d >= 0; d--) {
    const cut = end.getTime() - d * 864e5;
    while (i < sorted.length && tsOf(sorted[i].date_created) <= cut) { bal += sorted[i].type === 'in' ? num(sorted[i].amount) : -num(sorted[i].amount); i++; }
    pts.push(bal);
  }
  return pts;
}
function Sparkline({ points, className }) {
  if (!points.length) return null;
  const min = Math.min(...points), max = Math.max(...points), span = max - min || 1;
  const w = 120, h = 32;
  const d = points.map((p, i) => `${(i / (points.length - 1 || 1)) * w},${h - ((p - min) / span) * (h - 4) - 2}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      <polyline points={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ── page ─────────────────────────────────────────────────────────────────── */
export default function AccountsPage() {
  const { list, pushEntity, pushBatch, bootstrapped } = useDataStore();
  const { showToast } = useToast();
  const accounts = list('account');
  const txns = list('account_txn');
  const customers = list('customer');
  const custPayments = list('customer_payment');
  const vendors = list('vendor');
  const vendPayments = list('vendor_payment');
  const expenses = list('expense');
  const sales = list('sale');
  const saleItems = list('sale_item');
  const saleReturns = list('sale_return');
  const khatas = list('customer_khata');
  const khataPayments = list('customer_khata_payment');

  const [selectedId, setSelectedId] = useState('all');
  const [period, setPeriod] = useState('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [flow, setFlow] = useState('all');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(80);
  const [accountForm, setAccountForm] = useState(null);      // { account|null }
  const [moveFor, setMoveFor] = useState(null);              // { account, type }
  const [transfer, setTransfer] = useState(null);            // { fromId }
  const [openTxn, setOpenTxn] = useState(null);
  const [confirm, setConfirm] = useState(null);

  // Seed the default "Cash in Hand" account once, like the desktop's INSERT OR IGNORE.
  useEffect(() => {
    if (bootstrapped && accounts.length === 0) {
      pushEntity('account', 'create', { name: 'Cash in Hand', type: 'cash', opening_balance: 0, current_balance: 0, bank_name: '', account_number: '', notes: '', is_default: 1, created_at: localStamp() }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapped, accounts.length]);

  // Balances are always rebuilt from opening balance + every movement (desktop recomputeAccountBalance).
  const txnsByAccount = useMemo(() => {
    const m = new Map();
    for (const t of txns) { const k = String(t.account_id); if (!m.has(k)) m.set(k, []); m.get(k).push(t); }
    return m;
  }, [txns]);
  const rows = useMemo(() => {
    let bank = 0;
    return accounts
      .slice()
      .sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0) || String(a.name).localeCompare(String(b.name)))
      .map((a, idx) => {
        const own = txnsByAccount.get(String(a.id)) || [];
        const balance = num(a.opening_balance) + own.reduce((s, t) => s + (t.type === 'in' ? num(t.amount) : -num(t.amount)), 0);
        const finish = a.type === 'bank' ? BANK_FINISHES[bank++ % BANK_FINISHES.length] : CASH_FINISH;
        return { ...a, balance, finish, bar: BAR[idx % BAR.length], spark: dailyBalances(a, own), count: own.length };
      });
  }, [accounts, txnsByAccount]);
  const byId = useMemo(() => new Map(rows.map((r) => [String(r.id), r])), [rows]);
  const selected = selectedId === 'all' ? null : byId.get(String(selectedId)) || null;
  useEffect(() => { if (selectedId !== 'all' && !byId.has(String(selectedId))) setSelectedId('all'); }, [byId, selectedId]);

  const total = rows.reduce((s, r) => s + r.balance, 0);
  const cashTotal = rows.filter((r) => r.type !== 'bank').reduce((s, r) => s + r.balance, 0);
  const bankTotal = total - cashTotal;
  const positive = rows.filter((r) => r.balance > 0.5);
  const positiveSum = positive.reduce((s, r) => s + r.balance, 0);

  // Running balance after each movement, per account (chronological).
  const balanceAfter = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      let bal = num(r.opening_balance);
      for (const t of (txnsByAccount.get(String(r.id)) || []).slice().sort((a, b) => tsOf(a.date_created) - tsOf(b.date_created) || num(a.id) - num(b.id))) {
        bal += t.type === 'in' ? num(t.amount) : -num(t.amount);
        m.set(String(t.id), bal);
      }
    }
    return m;
  }, [rows, txnsByAccount]);

  const [pStart, pEnd] = periodRange(period, from, to);
  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return txns
      .filter((t) => !selected || String(t.account_id) === String(selected.id))
      .filter((t) => { if (!pStart) return true; const x = tsOf(t.date_created); return x >= pStart.getTime() && x <= pEnd.getTime(); })
      .filter((t) => !q || cleanNote(t.note).toLowerCase().includes(q) || kindOf(t).label.toLowerCase().includes(q) || String(t.amount).includes(q) || (byId.get(String(t.account_id))?.name || '').toLowerCase().includes(q));
  }, [txns, selected, pStart, pEnd, query, byId]);
  // Moving money between your own accounts isn't income or spending — leave transfers out of the totals in "All accounts".
  const stats = useMemo(() => {
    let inn = 0, out = 0;
    for (const t of scoped) {
      if (!selected && String(t.category).toLowerCase() === 'transfer') continue;
      if (t.type === 'in') inn += num(t.amount); else out += num(t.amount);
    }
    return { inn, out, net: inn - out };
  }, [scoped, selected]);
  const visible = useMemo(() => scoped
    .filter((t) => flow === 'all' || (flow === 'transfer' ? String(t.category).toLowerCase() === 'transfer' : t.type === flow && String(t.category).toLowerCase() !== 'transfer'))
    .sort((a, b) => tsOf(b.date_created) - tsOf(a.date_created) || num(b.id) - num(a.id)), [scoped, flow]);
  useEffect(() => setShown(80), [selectedId, period, from, to, flow, query]);
  const groups = useMemo(() => {
    const out = []; let cur = null;
    for (const t of visible.slice(0, shown)) {
      const d = parseDate(t.date_created) || new Date(0);
      const key = d.toDateString();
      if (!cur || cur.key !== key) { cur = { key, label: dayLabel(d), items: [], net: 0 }; out.push(cur); }
      cur.items.push(t);
      if (selected || String(t.category).toLowerCase() !== 'transfer') cur.net += t.type === 'in' ? num(t.amount) : -num(t.amount);
    }
    return out;
  }, [visible, shown, selected]);

  /* ── writes ── */
  const saveAccount = async (form, existing) => {
    if (existing) {
      await pushEntity('account', 'update', { ...existing, name: form.name, bank_name: form.bank_name, account_number: form.account_number, notes: form.notes });
      showToast('Account updated');
    } else {
      const created = await pushEntity('account', 'create', { name: form.name, type: form.type, opening_balance: form.opening_balance, current_balance: form.opening_balance, bank_name: form.bank_name, account_number: form.account_number, notes: form.notes, is_default: 0, created_at: localStamp() });
      if (created?.id != null) setSelectedId(String(created.id));
      showToast('Account added');
    }
  };
  const moveMoney = async (account, { type, amount, category, note }) => {
    await pushEntity('account_txn', 'create', { account_id: Number(account.id), type, amount, category: category || 'manual', note, date_created: localStamp() });
    showToast(type === 'in' ? `${rs(amount)} added to ${account.name}` : `${rs(amount)} taken out of ${account.name}`);
  };
  const doTransfer = async ({ fromId, toId, amount, note }) => {
    const now = localStamp();
    await pushBatch([
      { entityType: 'account_txn', operation: 'create', payload: { account_id: Number(fromId), type: 'out', amount, category: 'transfer', note, date_created: now } },
      { entityType: 'account_txn', operation: 'create', payload: { account_id: Number(toId), type: 'in', amount, category: 'transfer', note, date_created: now } },
    ]);
    showToast(`${rs(amount)} moved to ${byId.get(String(toId))?.name || 'account'}`);
  };
  /**
   * What a movement was recorded for — same rules as the desktop (find-txn-source): customer payment
   * ("Customer payment received — …" or [SPG:]), vendor payment ([VPId:] or [SPG:]), expense ([EID:]),
   * counter sale ("Sale payment received — Sale #n"). Removing it then undoes that record too.
   */
  const sourceOf = (t) => {
    if (!t) return null;
    const note = String(t.note || ''); const amt = num(t.amount);
    const spg = note.match(/\[SPG:([^\]]+)\]/)?.[1];
    if (t.type === 'in') {
      let rows = [];
      if (spg) rows = custPayments.filter((x) => x.payment_group === spg);
      else if (note.startsWith('Customer payment received — ')) {
        const c = custPayments.filter((x) => Math.abs(num(x.amount) - amt) < 0.005).sort((a, b) => num(b.id) - num(a.id))
          .find((x) => `Customer payment received — ${x.notes || (x.sale_id ? `INV #${x.sale_id}` : 'General payment')}` === note);
        if (c) rows = [c];
      }
      if (rows.length) {
        const customer = customers.find((c) => String(c.id) === String(rows[0].customer_id));
        const total = Math.round(rows.reduce((a, r) => a + num(r.amount), 0) * 100) / 100;
        let invoiceBalance = num(customer?.outstanding_balance), khataDue = 0;
        if (customer) {
          const acct = buildCustomerAccount({ customer, sales, saleItems, payments: custPayments, returns: saleReturns, khatas, khataPayments });
          invoiceBalance = num(acct.totals.invoiceBalance); khataDue = num(acct.totals.khataDue);
        }
        return { kind: 'customer_payment', rows, customer, party: customer?.name || 'Customer', amount: total, invoiceBalance, before: invoiceBalance + khataDue, after: invoiceBalance + khataDue + total };
      }
      const sale = note.match(/^Sale payment received — Sale #(\d+)/)?.[1];
      if (sale) return { kind: 'sale', saleId: sale };
    } else {
      const vpid = note.match(/\[VPId:(\d+)\]/)?.[1];
      const rows = vpid ? vendPayments.filter((x) => String(x.id) === String(vpid)) : spg ? vendPayments.filter((x) => x.payment_group === spg) : [];
      if (rows.length) {
        const v = vendors.find((x) => String(x.id) === String(rows[0].vendor_id));
        return { kind: 'vendor_payment', rows, party: v?.name || 'Vendor', amount: Math.round(rows.reduce((a, r) => a + num(r.amount), 0) * 100) / 100 };
      }
      const eid = note.match(/\[EID:(\d+)\]/)?.[1];
      if (eid) {
        const e = expenses.find((x) => String(x.id) === String(eid));
        return { kind: 'expense', expenseId: eid, title: e?.title || cleanNote(note).replace(/^Expense:\s*/, '') || 'Expense', amount: num(e?.amount) || amt };
      }
    }
    return null;
  };

  /** The other side of a transfer — same amount, note and time, opposite direction, another account (desktop rule). */
  const transferLeg = (t) => txns.find((x) => String(x.id) !== String(t.id) && String(x.category).toLowerCase() === 'transfer'
    && x.type !== t.type && num(x.amount) === num(t.amount) && (x.note || '') === (t.note || '') && String(x.date_created) === String(t.date_created) && String(x.account_id) !== String(t.account_id));
  const askDeleteTxn = (t) => {
    const k = kindOf(t); const leg = String(t.category).toLowerCase() === 'transfer' ? transferLeg(t) : null;
    const sys = SYSTEM.has(String(t.category).toLowerCase());
    const src = sourceOf(t);
    if (src?.kind === 'sale') {
      setConfirm({ title: 'Recorded by a sale', body: `This money came in with sale #${String(src.saleId).slice(-6)}. Edit or cancel that sale in Invoices to change it.`, cta: 'Remove', blocked: true, action: async () => {} });
      return;
    }
    if (src?.kind === 'customer_payment') {
      setConfirm({
        title: 'Undo customer payment?',
        body: `This is ${src.party}'s payment of ${rs(src.amount)}${src.rows.length > 1 ? `, split across ${src.rows.length} invoices` : ''}. Removing it undoes the payment: ${src.party} will owe ${rs(src.after)} instead of ${rs(src.before)}, and ${rs(src.amount)} comes off ${byId.get(String(t.account_id))?.name || 'this account'}.`,
        cta: 'Undo payment',
        action: async () => {
          const events = src.rows.map((r) => ({ entityType: 'customer_payment', operation: 'delete', payload: { id: r.id } }));
          events.push({ entityType: 'account_txn', operation: 'delete', payload: { id: t.id } });
          if (src.customer) events.push({ entityType: 'customer', operation: 'update', payload: { ...src.customer, outstanding_balance: Math.round((src.invoiceBalance + src.amount) * 100) / 100, updated_at: localStamp() } });
          await pushBatch(events);
          setOpenTxn(null);
          showToast(`Payment undone — ${src.party} owes ${rs(src.after)}`);
        },
      });
      return;
    }
    if (src?.kind === 'vendor_payment') {
      setConfirm({
        title: 'Undo vendor payment?',
        body: `This is your payment of ${rs(src.amount)} to ${src.party}${src.rows.length > 1 ? `, split across ${src.rows.length} bills` : ''}. Removing it undoes the payment: you will owe ${src.party} ${rs(src.amount)} more, and the money goes back into ${byId.get(String(t.account_id))?.name || 'this account'}.`,
        cta: 'Undo payment',
        action: async () => {
          await pushBatch([...src.rows.map((r) => ({ entityType: 'vendor_payment', operation: 'delete', payload: { id: r.id } })), { entityType: 'account_txn', operation: 'delete', payload: { id: t.id } }]);
          setOpenTxn(null);
          showToast(`Payment to ${src.party} undone`);
        },
      });
      return;
    }
    if (src?.kind === 'expense') {
      setConfirm({
        title: 'Delete this expense?',
        body: `This is the expense “${src.title}” (${rs(src.amount)}). Removing it deletes the expense too, so profit goes up by ${rs(src.amount)} and the money goes back into ${byId.get(String(t.account_id))?.name || 'this account'}.`,
        cta: 'Delete expense',
        action: async () => {
          await pushBatch([{ entityType: 'expense', operation: 'delete', payload: { id: src.expenseId } }, { entityType: 'account_txn', operation: 'delete', payload: { id: t.id } }]);
          setOpenTxn(null);
          showToast('Expense deleted');
        },
      });
      return;
    }
    setConfirm({
      title: 'Remove this movement?',
      body: leg
        ? `Both sides of this transfer are removed, so ${byId.get(String(t.account_id))?.name} and ${byId.get(String(leg.account_id))?.name} stay balanced.`
        : sys
          ? `This came from a ${k.label.toLowerCase()}. Removing it changes only this account's balance — the ${k.label.toLowerCase()} itself stays as it is.`
          : `${rs(t.amount)} will ${t.type === 'in' ? 'come off' : 'go back to'} ${byId.get(String(t.account_id))?.name}'s balance.`,
      cta: 'Remove',
      action: async () => {
        const ids = [t.id, ...(leg ? [leg.id] : [])];
        await pushBatch(ids.map((id) => ({ entityType: 'account_txn', operation: 'delete', payload: { id } })));
        setOpenTxn(null);
        showToast(leg ? 'Transfer removed from both accounts' : 'Movement removed');
      },
    });
  };
  const askDeleteAccount = (a) => {
    if (a.is_default) { showToast('The default Cash in Hand account can’t be deleted', 'error'); return; }
    const own = txnsByAccount.get(String(a.id)) || [];
    setConfirm({
      title: `Delete ${a.name}?`,
      body: own.length ? `Its ${own.length} movement${own.length === 1 ? '' : 's'} are deleted too, and ${rs(a.balance)} leaves your total. This can’t be undone.` : 'This can’t be undone.',
      cta: 'Delete account',
      action: async () => {
        await pushBatch([...own.map((t) => ({ entityType: 'account_txn', operation: 'delete', payload: { id: t.id } })), { entityType: 'account', operation: 'delete', payload: { id: a.id } }]);
        setSelectedId('all');
        showToast('Account deleted');
      },
    });
  };

  const periodName = (PERIODS.find(([k]) => k === period) || [])[1] || '';

  return (
    <div className="mx-auto w-full max-w-[1200px] min-w-0 space-y-6 pb-12">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground leading-tight">Accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">Cash in hand and bank balances, and every rupee that moved.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setTransfer({ fromId: selected?.id ?? null })} disabled={rows.length < 2}
            className="h-10 px-4 rounded-full border border-border bg-card text-sm font-medium text-foreground hover:bg-muted inline-flex items-center gap-2 disabled:opacity-40">
            <ArrowLeftRight size={15} /> Transfer
          </button>
          <button type="button" onClick={() => setAccountForm({ account: null })}
            className="h-10 px-4 rounded-full bg-foreground text-background text-sm font-semibold hover:opacity-90 inline-flex items-center gap-2">
            <Plus size={16} /> New account
          </button>
        </div>
      </header>

      {/* Total */}
      <section className="rounded-[28px] border border-border/70 bg-card p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-muted-foreground">Total balance</p>
            <p className={cn('mt-1 text-[44px] sm:text-[52px] font-semibold tracking-tight tabular-nums leading-none', total < 0 ? 'text-rose-600' : 'text-foreground')}>{rs(total)}</p>
            <p className="mt-3 text-sm text-muted-foreground tabular-nums">
              <span className="inline-flex items-center gap-1.5"><Banknote size={14} /> Cash {rs(cashTotal)}</span>
              <span className="mx-2.5 text-muted-foreground/40">·</span>
              <span className="inline-flex items-center gap-1.5"><Landmark size={14} /> Bank {rs(bankTotal)}</span>
            </p>
          </div>
          <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-10">
            {[['Money in', stats.inn, 'text-emerald-600 dark:text-emerald-400'], ['Money out', stats.out, 'text-foreground'], ['Net change', stats.net, stats.net < 0 ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400']].map(([l, v, c]) => (
              <div key={l} className="min-w-0 flex items-baseline justify-between gap-4 sm:block">
                <dt className="text-[13px] sm:text-[12px] text-muted-foreground whitespace-nowrap">{l}</dt>
                <dd className={cn('sm:mt-1 text-base sm:text-xl font-semibold tabular-nums whitespace-nowrap', c)}>{l === 'Net change' ? signed(v) : rs(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
        {positiveSum > 0 && (
          <div className="mt-7">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
              {positive.map((r) => <div key={r.id} className={cn('h-full', r.bar)} style={{ width: `${(r.balance / positiveSum) * 100}%` }} title={`${r.name} ${rs(r.balance)}`} />)}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-muted-foreground">
              {positive.map((r) => (
                <span key={r.id} className="inline-flex items-center gap-1.5 tabular-nums">
                  <span className={cn('h-2 w-2 rounded-full', r.bar)} /> {r.name} <span className="text-foreground/80">{Math.round((r.balance / positiveSum) * 100)}%</span>
                </span>
              ))}
              <span className="sm:ml-auto">{selected ? selected.name : 'All accounts'} · {periodName.toLowerCase()}{selected ? '' : ', transfers left out'}</span>
            </div>
          </div>
        )}
      </section>

      {/* Wallet cards */}
      <section aria-label="Accounts">
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto pb-2 [scrollbar-width:none]">
          <div className="flex gap-4 snap-x snap-mandatory sm:grid sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => {
              const on = String(selectedId) === String(r.id);
              return (
                <button key={r.id} type="button" onClick={() => setSelectedId(on ? 'all' : String(r.id))} aria-pressed={on}
                  className={cn('snap-start shrink-0 w-[78%] sm:w-auto text-left rounded-[22px] p-5 bg-gradient-to-br text-white shadow-sm transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    r.finish, on ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground/70 -translate-y-0.5 shadow-lg' : 'hover:-translate-y-0.5 hover:shadow-md', selectedId !== 'all' && !on && 'opacity-60 hover:opacity-100')}>
                  <div className="flex items-center justify-between gap-2 text-white/85">
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium">
                      {r.type === 'bank' ? <Landmark size={14} /> : <Wallet size={14} />}
                      {r.type === 'bank' ? (r.bank_name || 'Bank') : 'Cash'}
                    </span>
                    {r.is_default ? <span className="text-[10px] font-semibold uppercase tracking-wider bg-white/20 rounded-full px-2 py-0.5">Default</span> : null}
                  </div>
                  <p className="mt-5 text-[15px] font-semibold truncate">{r.name}</p>
                  <p className="mt-1 text-[26px] font-semibold tracking-tight tabular-nums leading-tight break-all">{rs(r.balance)}</p>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <p className="text-[12px] text-white/70 tabular-nums">{r.type === 'bank' && r.account_number ? `•••• ${last4(r.account_number)}` : `${r.count} movement${r.count === 1 ? '' : 's'}`}</p>
                    <Sparkline points={r.spark} className="h-7 w-24 shrink-0 text-white/60" />
                  </div>
                </button>
              );
            })}
            <button type="button" onClick={() => setAccountForm({ account: null })}
              className="snap-start shrink-0 w-[78%] sm:w-auto min-h-[176px] rounded-[22px] border-2 border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 inline-flex flex-col items-center justify-center gap-2 transition-colors">
              <span className="h-10 w-10 rounded-full bg-muted inline-flex items-center justify-center"><Plus size={18} /></span>
              <span className="text-sm font-medium">Add a bank or cash account</span>
            </button>
          </div>
        </div>
      </section>

      {/* Activity */}
      <section className="rounded-[28px] border border-border/70 bg-card overflow-hidden min-w-0">
        <div className="p-5 sm:p-6 border-b border-border/70 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight text-foreground truncate">{selected ? selected.name : 'All activity'}</h2>
              <p className="text-[13px] text-muted-foreground tabular-nums">
                {selected ? <>Balance <span className={cn('font-medium', selected.balance < 0 ? 'text-rose-600' : 'text-foreground')}>{rs(selected.balance)}</span>{selected.type === 'bank' && selected.account_number ? ` · ${selected.bank_name || 'Bank'} •••• ${last4(selected.account_number)}` : ''}</> : `${rows.length} account${rows.length === 1 ? '' : 's'} · tap a card to see one`}
              </p>
            </div>
            {selected && (
              <div className="flex flex-wrap gap-2">
                <PillButton icon={ArrowDownLeft} onClick={() => setMoveFor({ account: selected, type: 'in' })}>Add money</PillButton>
                <PillButton icon={ArrowUpRight} onClick={() => setMoveFor({ account: selected, type: 'out' })}>Take out</PillButton>
                <PillButton icon={ArrowLeftRight} onClick={() => setTransfer({ fromId: selected.id })} disabled={rows.length < 2}>Transfer</PillButton>
                <PillButton icon={Pencil} onClick={() => setAccountForm({ account: selected })} label="Edit account" />
                {!selected.is_default && <PillButton icon={Trash2} onClick={() => askDeleteAccount(selected)} label="Delete account" danger />}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1 min-w-0">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes, amounts, accounts"
                className="h-10 w-full rounded-full bg-muted/60 border border-transparent focus:border-border focus:bg-background pl-10 pr-9 text-sm outline-none transition-colors" />
              {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={14} /></button>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented value={flow} onChange={setFlow} options={[['all', 'All'], ['in', 'In'], ['out', 'Out'], ['transfer', 'Transfers']]} />
              <div className="hidden sm:block"><Segmented value={period} onChange={setPeriod} options={PERIODS.map(([k, l]) => [k, l])} /></div>
              <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period"
                className="sm:hidden h-9 rounded-full bg-muted/70 border-0 px-3.5 text-[12px] font-medium text-foreground outline-none">
                {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
          </div>
          {period === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" className="h-9 rounded-full border border-border bg-background px-3" />
              <span className="text-muted-foreground">to</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" className="h-9 rounded-full border border-border bg-background px-3" />
            </div>
          )}
        </div>

        {groups.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <span className="mx-auto h-12 w-12 rounded-full bg-muted inline-flex items-center justify-center text-muted-foreground"><ArrowLeftRight size={20} /></span>
            <p className="mt-3 text-sm font-medium text-foreground">{txns.length ? 'Nothing here for these filters' : 'No money has moved yet'}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{txns.length ? 'Try another period, or clear the search.' : 'Sales, payments, expenses and transfers will show up here.'}</p>
          </div>
        ) : (
          <div>
            {groups.map((g) => (
              <div key={g.key}>
                <div className="sticky top-0 z-[1] flex items-center justify-between bg-card/95 backdrop-blur px-5 sm:px-6 py-2 border-b border-border/50">
                  <span className="text-[12px] font-semibold text-muted-foreground">{g.label}</span>
                  <span className={cn('text-[12px] font-medium tabular-nums', g.net < 0 ? 'text-muted-foreground' : 'text-emerald-600 dark:text-emerald-400')}>{signed(g.net)}</span>
                </div>
                <ul>
                  {g.items.map((t) => {
                    const k = kindOf(t); const Icon = k.icon; const acct = byId.get(String(t.account_id));
                    const note = cleanNote(t.note);
                    return (
                      <li key={t.id}>
                        <button type="button" onClick={() => setOpenTxn(t)} className="w-full flex items-center gap-3.5 px-5 sm:px-6 py-3.5 text-left hover:bg-muted/50 transition-colors border-b border-border/40 last:border-0">
                          <span className={cn('h-10 w-10 shrink-0 rounded-full inline-flex items-center justify-center', k.tint)}><Icon size={17} /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[14px] font-medium text-foreground truncate capitalize-first">{k.label}</span>
                            <span className="block text-[12px] text-muted-foreground truncate">
                              {[timeOf(t.date_created), !selected && acct ? acct.name : null, note || null].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                          <span className="text-right shrink-0">
                            <span className={cn('block text-[14px] font-semibold tabular-nums', t.type === 'in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground')}>{t.type === 'in' ? '+' : '−'}{rs(t.amount)}</span>
                            {selected && balanceAfter.has(String(t.id)) && <span className="block text-[11px] text-muted-foreground tabular-nums">{rs(balanceAfter.get(String(t.id)))}</span>}
                          </span>
                          <ChevronRight size={15} className="shrink-0 text-muted-foreground/50 hidden sm:block" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {visible.length > shown && (
              <div className="p-4 text-center border-t border-border/50">
                <button type="button" onClick={() => setShown((n) => n + 120)} className="h-9 px-5 rounded-full border border-border text-sm font-medium hover:bg-muted">
                  Show more · {(visible.length - shown).toLocaleString('en-PK')} left
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <AccountDialog state={accountForm} onClose={() => setAccountForm(null)} onSave={saveAccount} />
      <MoveDialog state={moveFor} onClose={() => setMoveFor(null)} onSave={moveMoney} />
      <TransferDialog state={transfer} accounts={rows} onClose={() => setTransfer(null)} onSave={doTransfer} />
      <TxnSheet txn={openTxn} source={openTxn ? sourceOf(openTxn) : null} account={openTxn ? byId.get(String(openTxn.account_id)) : null} leg={openTxn && String(openTxn.category).toLowerCase() === 'transfer' ? transferLeg(openTxn) : null}
        legAccount={(l) => byId.get(String(l?.account_id))} after={openTxn ? balanceAfter.get(String(openTxn.id)) : null}
        onClose={() => setOpenTxn(null)} onDelete={askDeleteTxn} />
      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} onError={(e) => showToast(e?.message || 'Could not save', 'error')} />
    </div>
  );
}

/* ── small pieces ─────────────────────────────────────────────────────────── */
function PillButton({ icon: Icon, onClick, children, label, danger, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label}
      className={cn('h-9 rounded-full text-[13px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-40',
        children ? 'px-3.5' : 'w-9 justify-center',
        danger ? 'text-rose-600 hover:bg-rose-500/10' : 'bg-muted/70 text-foreground hover:bg-muted')}>
      <Icon size={15} /> {children}
    </button>
  );
}
function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-full bg-muted/70 p-0.5 overflow-x-auto max-w-full" role="tablist">
      {options.map(([k, l]) => (
        <button key={k} type="button" role="tab" aria-selected={value === k} onClick={() => onChange(k)}
          className={cn('h-8 px-3 rounded-full text-[12px] font-medium whitespace-nowrap transition-all',
            value === k ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{l}</button>
      ))}
    </div>
  );
}
function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-muted-foreground mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground mt-1">{hint}</span>}
    </label>
  );
}
const inputCls = 'h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none focus:border-foreground/40 focus:ring-4 focus:ring-foreground/5 transition disabled:opacity-60';
/** Big centred amount, Apple-Cash style. */
function AmountInput({ value, onChange, autoFocus }) {
  // The dialog moves focus to itself after opening, which beats the autoFocus attribute — focus once it settles.
  const ref = useRef(null);
  useEffect(() => { if (!autoFocus) return undefined; const t = setTimeout(() => ref.current?.focus(), 60); return () => clearTimeout(t); }, [autoFocus]);
  return (
    <div className="flex items-baseline justify-center gap-2 py-3">
      <span className="text-2xl font-medium text-muted-foreground">Rs.</span>
      <input ref={ref} inputMode="decimal" value={value} placeholder="0"
        onChange={(e) => { const v = e.target.value.replace(/[^\d.]/g, ''); if ((v.match(/\./g) || []).length <= 1) onChange(v); }}
        style={{ width: `${Math.max(1, String(value || '0').length) + 0.6}ch` }}
        className="min-w-[2ch] max-w-[11ch] bg-transparent text-left text-[44px] font-semibold tracking-tight tabular-nums outline-none placeholder:text-muted-foreground/40" aria-label="Amount" />
    </div>
  );
}
function DialogShell({ open, onClose, title, description, children, footer }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-full max-w-[440px] gap-0 p-0 overflow-hidden rounded-[24px]">
        <div className="px-6 pt-6">
          <DialogTitle className="text-[17px] font-semibold tracking-tight">{title}</DialogTitle>
          {description && <DialogDescription className="mt-1 text-[13px]">{description}</DialogDescription>}
        </div>
        <div className="px-6 py-5 space-y-4">{children}</div>
        <div className="flex gap-2 px-6 pb-6">{footer}</div>
      </DialogContent>
    </Dialog>
  );
}
function FooterButtons({ onClose, saving, disabled, label, onSave, danger }) {
  return (
    <>
      <button type="button" onClick={onClose} className="h-11 flex-1 rounded-full border border-border text-sm font-medium hover:bg-muted">Cancel</button>
      <button type="button" onClick={onSave} disabled={saving || disabled}
        className={cn('h-11 flex-1 rounded-full text-sm font-semibold disabled:opacity-40', danger ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-foreground text-background hover:opacity-90')}>
        {saving ? 'Saving…' : label}
      </button>
    </>
  );
}

function AccountDialog({ state, onClose, onSave }) {
  const existing = state?.account || null;
  const [form, setForm] = useState({ type: 'cash', name: '', opening_balance: '', bank_name: '', account_number: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!state) return;
    setError(''); setSaving(false);
    setForm(existing ? { type: existing.type || 'cash', name: existing.name || '', opening_balance: String(existing.opening_balance ?? ''), bank_name: existing.bank_name || '', account_number: existing.account_number || '', notes: existing.notes || '' }
      : { type: 'cash', name: '', opening_balance: '', bank_name: '', account_number: '', notes: '' });
  }, [state, existing]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async () => {
    if (!form.name.trim()) { setError('Give the account a name'); return; }
    setSaving(true);
    try { await onSave({ ...form, name: form.name.trim(), opening_balance: Math.max(0, num(form.opening_balance)) }, existing); onClose(); }
    catch (e) { setError(e?.message || 'Could not save'); } finally { setSaving(false); }
  };
  return (
    <DialogShell open={!!state} onClose={onClose} title={existing ? 'Edit account' : 'New account'}
      description={existing ? 'Type and opening balance stay as they were — they set every balance since.' : 'A drawer of cash or a bank account the shop pays from.'}
      footer={<FooterButtons onClose={onClose} saving={saving} label={existing ? 'Save' : 'Add account'} onSave={save} />}>
      {!existing && (
        <div className="grid grid-cols-2 gap-2.5">
          {[['cash', 'Cash', Wallet], ['bank', 'Bank', Landmark]].map(([k, l, Icon]) => (
            <button key={k} type="button" onClick={() => setForm((f) => ({ ...f, type: k }))} aria-pressed={form.type === k}
              className={cn('rounded-2xl border p-4 text-left transition-all', form.type === k ? 'border-foreground bg-foreground/[0.03] ring-1 ring-foreground' : 'border-border hover:bg-muted/50')}>
              <Icon size={18} className="text-foreground/80" />
              <span className="mt-2 block text-sm font-semibold">{l}</span>
              <span className="block text-[11px] text-muted-foreground">{k === 'cash' ? 'Drawer, safe or pocket' : 'Account at a bank'}</span>
            </button>
          ))}
        </div>
      )}
      <Field label="Name"><input value={form.name} onChange={set('name')} placeholder={form.type === 'bank' ? 'e.g. Meezan current account' : 'e.g. Shop drawer'} className={inputCls} autoFocus /></Field>
      {!existing && <Field label="Opening balance" hint="What's in it today. Leave empty for zero."><input inputMode="decimal" value={form.opening_balance} onChange={set('opening_balance')} placeholder="0" className={inputCls} /></Field>}
      {form.type === 'bank' && (
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Bank"><input value={form.bank_name} onChange={set('bank_name')} placeholder="Bank name" className={inputCls} /></Field>
          <Field label="Account number"><input value={form.account_number} onChange={set('account_number')} placeholder="Optional" className={inputCls} /></Field>
        </div>
      )}
      <Field label="Notes"><input value={form.notes} onChange={set('notes')} placeholder="Optional" className={inputCls} /></Field>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
    </DialogShell>
  );
}

const QUICK = { in: ['Owner investment', 'Loan received', 'Other income'], out: ['Owner withdrawal', 'Bank charges', 'Other'] };
function MoveDialog({ state, onClose, onSave }) {
  const [type, setType] = useState('in');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (state) { setType(state.type || 'in'); setAmount(''); setCategory(''); setNote(''); setError(''); setSaving(false); } }, [state]);
  const amt = num(amount);
  const after = state ? state.account.balance + (type === 'in' ? amt : -amt) : 0;
  const save = async () => {
    if (!(amt > 0)) { setError('Enter an amount'); return; }
    setSaving(true);
    try { await onSave(state.account, { type, amount: Math.round(amt * 100) / 100, category: category || 'manual', note: note.trim() }); onClose(); }
    catch (e) { setError(e?.message || 'Could not save'); } finally { setSaving(false); }
  };
  return (
    <DialogShell open={!!state} onClose={onClose} title={state?.account?.name || ''} description={`Balance now ${rs(state?.account?.balance)}`}
      footer={<FooterButtons onClose={onClose} saving={saving} disabled={!(amt > 0)} label={type === 'in' ? 'Add money' : 'Take out'} onSave={save} />}>
      <div className="flex justify-center"><Segmented value={type} onChange={(v) => { setType(v); setCategory(''); }} options={[['in', 'Add money'], ['out', 'Take out']]} /></div>
      <AmountInput value={amount} onChange={setAmount} autoFocus />
      <p className={cn('-mt-2 text-center text-[13px] tabular-nums', after < 0 ? 'text-rose-600' : 'text-muted-foreground')}>
        {amt > 0 ? `New balance ${rs(after)}${after < 0 ? ' — below zero' : ''}` : ' '}
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {QUICK[type].map((c) => (
          <button key={c} type="button" onClick={() => setCategory(category === c ? '' : c)}
            className={cn('h-8 px-3 rounded-full text-[12px] font-medium border transition-colors', category === c ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground')}>{c}</button>
        ))}
      </div>
      <Field label="Note"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was it for?" className={inputCls} /></Field>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
    </DialogShell>
  );
}

function AccountPicker({ label, value, onChange, accounts, exclude }) {
  return (
    <Field label={label}>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, 'appearance-none')}>
        <option value="" disabled>Choose an account</option>
        {accounts.filter((a) => String(a.id) !== String(exclude)).map((a) => <option key={a.id} value={a.id}>{a.name} — {rs(a.balance)}</option>)}
      </select>
    </Field>
  );
}
function TransferDialog({ state, accounts, onClose, onSave }) {
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!state) return;
    const f = state.fromId != null ? String(state.fromId) : String(accounts[0]?.id ?? '');
    setFromId(f); setToId(String(accounts.find((a) => String(a.id) !== f)?.id ?? '')); setAmount(''); setNote(''); setError(''); setSaving(false);
  }, [state, accounts]);
  const amt = num(amount);
  const fromA = accounts.find((a) => String(a.id) === String(fromId));
  const toA = accounts.find((a) => String(a.id) === String(toId));
  const save = async () => {
    if (!fromA || !toA || fromA.id === toA.id) { setError('Pick two different accounts'); return; }
    if (!(amt > 0)) { setError('Enter an amount'); return; }
    setSaving(true);
    try { await onSave({ fromId: fromA.id, toId: toA.id, amount: Math.round(amt * 100) / 100, note: note.trim() }); onClose(); }
    catch (e) { setError(e?.message || 'Could not save'); } finally { setSaving(false); }
  };
  return (
    <DialogShell open={!!state} onClose={onClose} title="Transfer" description="Move money between your own accounts. It isn't income or spending."
      footer={<FooterButtons onClose={onClose} saving={saving} disabled={!(amt > 0) || !fromA || !toA} label="Transfer" onSave={save} />}>
      <AmountInput value={amount} onChange={setAmount} autoFocus />
      <div className="relative space-y-2.5">
        <AccountPicker label="From" value={fromId} onChange={(v) => { setFromId(v); if (v === toId) setToId(fromId); }} accounts={accounts} />
        <button type="button" onClick={() => { setFromId(toId); setToId(fromId); }} aria-label="Swap accounts"
          className="absolute right-3 top-[58px] z-10 h-8 w-8 rounded-full border border-border bg-background inline-flex items-center justify-center text-muted-foreground hover:text-foreground shadow-sm">
          <ArrowDownUp size={14} />
        </button>
        <AccountPicker label="To" value={toId} onChange={setToId} accounts={accounts} exclude={fromId} />
      </div>
      {fromA && toA && amt > 0 && (
        <div className="rounded-2xl bg-muted/50 px-4 py-3 text-[13px] tabular-nums space-y-1">
          <div className="flex justify-between gap-3"><span className="text-muted-foreground truncate">{fromA.name}</span><span className={cn(fromA.balance - amt < 0 ? 'text-rose-600' : 'text-foreground')}>{rs(fromA.balance)} → {rs(fromA.balance - amt)}</span></div>
          <div className="flex justify-between gap-3"><span className="text-muted-foreground truncate">{toA.name}</span><span className="text-foreground">{rs(toA.balance)} → {rs(toA.balance + amt)}</span></div>
          {fromA.balance - amt < 0 && <p className="text-rose-600 pt-1">{fromA.name} goes below zero.</p>}
        </div>
      )}
      <Field label="Note"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" className={inputCls} /></Field>
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
    </DialogShell>
  );
}

function TxnSheet({ txn, source, account, leg, legAccount, after, onClose, onDelete }) {
  if (!txn) return <EntrySheet open={false} onClose={onClose} />;
  const k = kindOf(txn); const Icon = k.icon; const note = cleanNote(txn.note);
  const d = parseDate(txn.date_created);
  const rows = [
    ['Account', account?.name || '—'],
    source?.kind === 'customer_payment' ? ['Payment from', `${source.party}${source.rows.length > 1 ? ` · ${source.rows.length} invoices` : ''}`] : null,
    source?.kind === 'vendor_payment' ? ['Paid to', source.party] : null,
    source?.kind === 'expense' ? ['Expense', source.title] : null,
    source?.kind === 'sale' ? ['Sale', `#${String(source.saleId).slice(-6)}`] : null,
    leg ? [txn.type === 'out' ? 'Sent to' : 'Came from', legAccount(leg)?.name || '—'] : null,
    ['Date', d && !isNaN(d) ? d.toLocaleString('en-PK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'],
    after != null ? ['Balance after', rs(after)] : null,
    note ? ['Note', note] : null,
  ].filter(Boolean);
  return (
    <EntrySheet open onClose={onClose} title={k.label} subtitle={account?.name || ''}
      amount={`${txn.type === 'in' ? '+' : '−'}${rs(txn.amount)}`} amountTone={txn.type === 'in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}
      actions={<SheetButton icon={Trash2} tone="danger" onClick={() => onDelete(txn)}>{leg ? 'Remove transfer' : source?.kind === 'customer_payment' || source?.kind === 'vendor_payment' ? 'Undo payment' : source?.kind === 'expense' ? 'Delete expense' : 'Remove'}</SheetButton>}>
      <div className="flex justify-center pb-4">
        <span className={cn('h-14 w-14 rounded-full inline-flex items-center justify-center', k.tint)}><Icon size={24} /></span>
      </div>
      <dl className="divide-y divide-border/60 rounded-2xl border border-border/60">
        {rows.map(([l, v]) => (
          <div key={l} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
            <dt className="text-muted-foreground shrink-0">{l}</dt>
            <dd className="text-right text-foreground break-words min-w-0">{v}</dd>
          </div>
        ))}
      </dl>
      {source?.kind === 'sale' ? (
        <p className="mt-3 text-[12px] text-muted-foreground leading-relaxed">Taken at the counter with this sale. To change it, edit or cancel the sale in Invoices.</p>
      ) : source ? (
        <p className="mt-3 text-[12px] text-muted-foreground leading-relaxed">Removing this undoes the {source.kind === 'expense' ? 'expense' : 'payment'} as well, so every screen stays in step.</p>
      ) : SYSTEM.has(String(txn.category).toLowerCase()) ? (
        <p className="mt-3 text-[12px] text-muted-foreground leading-relaxed">Recorded automatically by a {k.label.toLowerCase()}. To change the amount, edit the {k.label.toLowerCase()} itself.</p>
      ) : null}
    </EntrySheet>
  );
}
