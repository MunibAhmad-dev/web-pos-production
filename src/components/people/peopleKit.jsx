/* eslint-disable react-refresh/only-export-components */
/** Shared building blocks for the Customers and Vendors screens. */
import { useEffect, useMemo, useState } from 'react';
import { Search, X, ChevronDown, ChevronRight, Wallet, Landmark, Check, ArrowUpDown } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { parseDate } from '@/lib/customerAccount';

export const rs = (n) => 'Rs. ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
export const fmtDay = (raw) => { const d = raw instanceof Date ? raw : parseDate(raw); return d && !isNaN(d) ? d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; };
export const fmtDayTime = (raw) => { const d = parseDate(raw); return d && !isNaN(d) ? d.toLocaleString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'; };
const TONES = [
  'bg-sky-500/12 text-sky-700 dark:text-sky-300', 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
  'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300', 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  'bg-rose-500/12 text-rose-700 dark:text-rose-300', 'bg-teal-500/12 text-teal-700 dark:text-teal-300',
];
export const toneOf = (s = '') => TONES[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length];
export const initials = (s = '') => String(s).replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

export function Avatar({ name, className }) {
  return <span className={cn('rounded-full inline-flex items-center justify-center font-bold shrink-0', toneOf(name), className)}>{initials(name)}</span>;
}

export const PERIODS = [['all', 'All time'], ['today', 'Today'], ['week', '7 days'], ['month', '30 days'], ['custom', 'Custom']];
export function periodRange(period, from, to) {
  const n = new Date(); const sod = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  if (period === 'today') return [sod, n];
  if (period === 'week') return [new Date(sod - 6 * 864e5), n];
  if (period === 'month') return [new Date(sod - 29 * 864e5), n];
  if (period === 'custom' && from && to) return [new Date(`${from}T00:00:00`), new Date(`${to}T23:59:59`)];
  return [null, null];
}

/** Balance with direction words: customers owe you (amber) / are in credit; you owe vendors (rose) / paid ahead. */
export function Balance({ value, kind = 'customer', className, settled = 'Settled' }) {
  if (Math.abs(value) < 0.5) return <span className={cn('text-muted-foreground', className)}>{settled}</span>;
  if (value > 0) return <span className={cn(kind === 'vendor' ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400', className)}>{rs(value)}</span>;
  return <span className={cn('text-emerald-700 dark:text-emerald-400', className)}>{rs(-value)} {kind === 'vendor' ? 'ahead' : 'credit'}</span>;
}

export const STATE_CHIP = {
  paid: ['Paid', 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'],
  partial: ['Part paid', 'bg-amber-500/12 text-amber-800 dark:text-amber-400'],
  unpaid: ['Unpaid', 'bg-rose-500/10 text-rose-700 dark:text-rose-400'],
  returned: ['Returned', 'bg-muted text-muted-foreground'],
  cancelled: ['Cancelled', 'bg-muted text-muted-foreground line-through'],
};
export function StateChip({ state }) {
  const [l, c] = STATE_CHIP[state] || STATE_CHIP.unpaid;
  return <span className={cn('text-[11px] font-semibold rounded-md px-1.5 py-0.5 whitespace-nowrap', c)}>{l}</span>;
}

/* ── People list (full width) ─────────────────────────────────────────────── */
/**
 * columns: [{ key, label, align, render(row), sort(row) , className }]
 */
export function PeopleList({ rows, columns, search, onSearch, filters, filter, onFilter, onOpen, emptyIcon: EmptyIcon, emptyTitle, emptyHint, searchPlaceholder, defaultSort }) {
  const [sort, setSort] = useState(defaultSort);
  const [shown, setShown] = useState(80);
  useEffect(() => setShown(80), [search, filter, sort]);
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key);
    if (!col?.sort) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => { const x = col.sort(a); const y = col.sort(b); return (typeof x === 'string' ? x.localeCompare(y) : x - y) * dir; });
  }, [rows, columns, sort]);
  const toggle = (c) => c.sort && setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: c.firstDir || 'desc' }));

  return (
    <section className="rounded-2xl border border-border/70 bg-card overflow-hidden">
      <div className="flex flex-col gap-2.5 border-b border-border/70 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 min-w-0 sm:max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder}
            className="w-full h-10 rounded-xl border border-border bg-background pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary" />
          {search && <button type="button" onClick={() => onSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded inline-flex items-center justify-center text-muted-foreground hover:bg-muted" aria-label="Clear search"><X size={14} /></button>}
        </div>
        <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] sm:ml-auto">
          {filters.map(([k, l, count]) => (
            <button key={k} type="button" onClick={() => onFilter(k)}
              className={cn('h-7 shrink-0 rounded-full px-2.5 text-xs font-medium border transition-colors inline-flex items-center gap-1.5',
                filter === k ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground')}>
              {l}{count != null && <span className={cn('tabular-nums', filter === k ? 'opacity-70' : 'opacity-60')}>{count}</span>}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="px-6 py-16 text-center">
          {EmptyIcon && <EmptyIcon size={20} className="mx-auto mb-2 text-muted-foreground" />}
          <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
          {emptyHint && <p className="mt-1 text-xs text-muted-foreground">{emptyHint}</p>}
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                  {columns.map((c, i) => (
                    <th key={c.key} className={cn('py-2.5 font-medium', i === 0 ? 'pl-4 pr-3' : 'px-3', c.align === 'right' && 'text-right', c.className)}
                      aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                      {c.sort ? (
                        <button type="button" onClick={() => toggle(c)} className={cn('inline-flex items-center gap-1 uppercase tracking-[0.06em] hover:text-foreground', sort?.key === c.key && 'text-foreground')}>
                          {c.label}<ArrowUpDown size={11} className={cn(sort?.key === c.key ? 'opacity-100' : 'opacity-40')} />
                        </button>
                      ) : c.label}
                    </th>
                  ))}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {sorted.slice(0, shown).map((r) => (
                  <tr key={r.id} onClick={() => onOpen(r)} className="group cursor-pointer border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors">
                    {columns.map((c, i) => (
                      <td key={c.key} className={cn('py-3', i === 0 ? 'pl-4 pr-3' : 'px-3', c.align === 'right' && 'text-right tabular-nums whitespace-nowrap', c.className)}>{c.render(r)}</td>
                    ))}
                    <td className="pr-3"><ChevronRight size={16} className="text-muted-foreground/50 group-hover:text-foreground transition-colors" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="md:hidden divide-y divide-border/60">
            {sorted.slice(0, shown).map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => onOpen(r)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40">
                  {columns[0].render(r)}
                  <span className="ml-auto text-right shrink-0">{columns.find((c) => c.mobileRight)?.render(r)}</span>
                  <ChevronRight size={16} className="text-muted-foreground/50 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3 border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">
            <span className="tabular-nums">Showing {Math.min(shown, sorted.length).toLocaleString('en-PK')} of {sorted.length.toLocaleString('en-PK')}</span>
            {sorted.length > shown && <button type="button" onClick={() => setShown((n) => n + 80)} className="h-8 px-3 rounded-lg border border-border font-medium hover:text-foreground">Show more</button>}
          </div>
        </>
      )}
    </section>
  );
}

/* ── History (ledger) — every row clickable ───────────────────────────────── */
export function HistoryList({ rows, opening, start, kind, onOpen, label }) {
  if (!rows.length && !start) return <p className="py-12 text-center text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <ul className="divide-y divide-border/60">
      <li className="hidden sm:grid grid-cols-[104px_minmax(0,1fr)_104px_104px_124px_20px] gap-3 pb-2 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
        <span>Date</span><span>Details</span><span className="text-right">{kind === 'vendor' ? 'Bill' : 'Debit'}</span><span className="text-right">{kind === 'vendor' ? 'Paid' : 'Credit'}</span><span className="text-right">Balance</span><span />
      </li>
      {start && (
        <li className="flex items-center justify-between gap-3 py-3 text-sm">
          <span className="font-medium text-foreground">Opening balance · {fmtDay(start)}</span>
          <Balance value={opening} kind={kind} className="font-semibold tabular-nums" />
        </li>
      )}
      {[...rows].reverse().map((r) => (
        <li key={r.key}>
          <button type="button" onClick={() => onOpen(r)}
            className="group w-full grid grid-cols-[minmax(0,1fr)_auto_16px] sm:grid-cols-[104px_minmax(0,1fr)_104px_104px_124px_20px] items-center gap-x-3 py-2.5 text-left text-sm rounded-lg hover:bg-muted/40 -mx-2 px-2">
            <span className="hidden sm:block text-muted-foreground tabular-nums">{fmtDay(r.date)}</span>
            <span className="min-w-0">
              <span className="font-medium text-foreground">{label(r)}</span>
              {r.sub && <span className="ml-2 text-xs text-muted-foreground">{r.sub}</span>}
              <span className="block sm:hidden text-xs text-muted-foreground tabular-nums">{fmtDay(r.date)}</span>
            </span>
            <span className="hidden sm:block text-right tabular-nums text-foreground">{r.debit ? rs(r.debit) : ''}</span>
            <span className="hidden sm:block text-right tabular-nums text-emerald-700 dark:text-emerald-400">{r.credit ? rs(r.credit) : ''}</span>
            <span className="text-right">
              <span className={cn('block sm:hidden text-sm font-semibold tabular-nums', r.credit ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground')}>{r.credit ? `− ${rs(r.credit)}` : `+ ${rs(r.debit)}`}</span>
              <span className="text-[11px] sm:text-sm sm:font-semibold tabular-nums whitespace-nowrap"><span className="sm:hidden text-muted-foreground">Bal. </span><Balance value={r.balance} kind={kind} /></span>
            </span>
            <ChevronRight size={15} className="text-muted-foreground/40 group-hover:text-foreground" />
          </button>
        </li>
      ))}
      {start && rows.length === 0 && <li className="py-8 text-center text-sm text-muted-foreground">Nothing in this period.</li>}
    </ul>
  );
}

/* ── Money in / out with oldest-first preview ─────────────────────────────── */
export function MoneyDialog({ open, onClose, title, partyName, dueLabel, due, accounts, plan, onSave, direction = 'in', advanceLabel }) {
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
    setAmount(due > 0.5 ? String(Math.round(due)) : ''); setMethod('cash'); setAccountId(defaultAcc('cash')); setNote(''); setError(''); setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const amt = Math.max(0, Number(amount) || 0);
  const preview = useMemo(() => (amt > 0 ? plan(amt) : { allocations: [], advance: 0 }), [amt, plan]);
  const save = async () => {
    setError('');
    if (!(amt > 0)) return setError('Enter the amount.');
    if (accounts.length && !accountId) return setError('Choose the cash or bank account.');
    setSaving(true);
    try { await onSave({ amount: amt, method, accountId, note }); onClose(); }
    catch (e) { setError(e?.message || 'Could not save the payment.'); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="w-full max-w-[460px] gap-0 p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-5 border-b border-border bg-muted/40">
          <DialogTitle className="text-sm font-medium text-muted-foreground">{title}</DialogTitle>
          <p className="mt-1 text-lg font-semibold text-foreground">{partyName}</p>
          <DialogDescription className="mt-0.5 text-xs text-muted-foreground">{dueLabel}</DialogDescription>
        </div>
        <div className="px-6 py-5 grid gap-5 max-h-[62vh] overflow-y-auto">
          <div>
            <label htmlFor="money-amount" className="text-sm font-medium text-foreground">Amount</label>
            <div className="relative mt-1.5">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rs.</span>
              <input id="money-amount" autoFocus inputMode="decimal" value={amount} onFocus={(e) => e.target.select()}
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
              <p className="text-sm font-medium text-foreground mb-1.5">{direction === 'in' ? 'Received in' : 'Paid from'}</p>
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
          {amt > 0 && (preview.allocations.length > 0 || preview.advance > 0) && (
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Applied oldest first</p>
              <ul className="grid gap-1.5 text-sm">
                {preview.allocations.map((a) => (
                  <li key={`${a.kind}-${a.id}`} className="flex items-center justify-between gap-3">
                    <span className="truncate text-foreground">{a.display || a.label}<span className="ml-1.5 text-xs text-muted-foreground">{a.clears ? 'cleared' : `${rs(a.remaining - a.amount)} left`}</span></span>
                    <span className="tabular-nums font-medium text-foreground">{rs(a.amount)}</span>
                  </li>
                ))}
                {preview.advance > 0 && <li className="flex items-center justify-between gap-3 text-emerald-700 dark:text-emerald-400"><span>{advanceLabel}</span><span className="tabular-nums font-medium">{rs(preview.advance)}</span></li>}
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

/* ── Edit a payment (desktop rules: a split Smart Pay only takes a new note) ─ */
export function EditPaymentDialog({ payment, groupTotal, lockedReason, onClose, onSave }) {
  const [amount, setAmount] = useState(''); const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (payment) { setAmount(String(groupTotal ?? payment.amount ?? '')); setNote(payment.notes || ''); setError(''); setSaving(false); } }, [payment, groupTotal]);
  if (!payment) return null;
  const save = async () => {
    const amt = Number(amount);
    if (!lockedReason && !(amt > 0)) return setError('Enter a valid amount.');
    setSaving(true);
    try { await onSave({ amount: lockedReason ? Number(groupTotal ?? payment.amount) : amt, notes: note.trim() }); onClose(); }
    catch (e) { setError(e?.message || 'Could not save.'); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="w-full max-w-[420px]">
        <DialogTitle>Edit payment</DialogTitle>
        <DialogDescription>{fmtDayTime(payment.date_added || payment.date_created)}</DialogDescription>
        <div className="grid gap-4">
          <div>
            <label htmlFor="edit-pay-amount" className="text-sm font-medium text-foreground">Amount</label>
            <div className="relative mt-1.5">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rs.</span>
              <input id="edit-pay-amount" inputMode="decimal" value={amount} disabled={!!lockedReason} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                className="w-full h-11 rounded-xl border border-border bg-background pl-11 pr-3 text-base font-semibold tabular-nums outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60" />
            </div>
            {lockedReason && <p className="mt-1.5 text-xs text-muted-foreground">{lockedReason}</p>}
          </div>
          <div>
            <label htmlFor="edit-pay-note" className="text-sm font-medium text-foreground">Note</label>
            <input id="edit-pay-note" value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5 w-full h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/25" />
          </div>
          {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={saving} className="h-10 px-4 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted">Cancel</button>
            <button type="button" onClick={save} disabled={saving} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Entry sheet: details of one history row + its actions ────────────────── */
export function EntrySheet({ open, onClose, title, subtitle, amount, amountTone, children, actions }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-full max-w-[520px] gap-0 p-0 overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-border">
          <div className="min-w-0">
            <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
            <DialogDescription className="mt-0.5 text-xs">{subtitle}</DialogDescription>
          </div>
          {amount != null && <span className={cn('text-lg font-bold tabular-nums whitespace-nowrap pr-6', amountTone)}>{amount}</span>}
        </div>
        <div className="px-6 py-4 max-h-[55vh] overflow-y-auto">{children}</div>
        {actions && <div className="flex flex-wrap gap-2 border-t border-border px-6 py-4">{actions}</div>}
      </DialogContent>
    </Dialog>
  );
}
export function SheetButton({ onClick, icon: Icon, children, tone, disabled, title }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className={cn('h-10 px-3.5 rounded-xl text-sm font-medium inline-flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none',
        tone === 'danger' ? 'text-rose-600 hover:bg-rose-500/10 sm:ml-auto' : tone === 'primary' ? 'bg-primary text-primary-foreground hover:opacity-95' : 'border border-border bg-card text-foreground hover:bg-muted')}>
      {Icon && <Icon size={15} />} {children}
    </button>
  );
}

export function ConfirmDialog({ confirm, onClose, onError }) {
  return (
    <Dialog open={!!confirm} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogTitle>{confirm?.title}</DialogTitle>
        <DialogDescription>{confirm?.body}</DialogDescription>
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted">Keep</button>
          <button type="button" disabled={confirm?.blocked} onClick={async () => { const a = confirm.action; onClose(); try { await a(); } catch (e) { onError?.(e); } }}
            className="h-9 px-4 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-40">{confirm?.cta || 'Yes, continue'}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PeriodPicker({ period, setPeriod, from, setFrom, to, setTo }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period" className="h-8 appearance-none rounded-lg border border-border bg-background pl-2.5 pr-7 text-xs font-medium outline-none">
          {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
      </div>
      {period === 'custom' && <>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 rounded-lg border border-border bg-background px-2 text-xs" aria-label="From" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 rounded-lg border border-border bg-background px-2 text-xs" aria-label="To" />
      </>}
    </div>
  );
}
