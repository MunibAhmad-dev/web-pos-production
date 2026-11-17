import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Phone, MapPin, Pencil, Trash2, MessageCircle, FileDown, ChevronLeft, BookOpen, Printer, Ban,
  MapPinned, BellRing, ArrowDownLeft, Copy, Users, Undo2, PencilLine, Lock, FileText, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import CustomerFormModal from '../../components/customers/CustomerFormModal';
import CustomerKhataPanel from '../../components/customers/CustomerKhataPanel';
import EditSaleModal from '../../components/sales/EditSaleModal';
import { useSaleRows, useSaleActions, ReturnDialog, CancelSaleDialog, qtyFmt } from '../../components/sales/saleActions';
import {
  rs, fmtDay, fmtDayTime, Avatar, periodRange, Balance, StateChip, PeopleList, HistoryList, MoneyDialog,
  EditPaymentDialog, EntrySheet, SheetButton, ConfirmDialog, PeriodPicker,
} from '../../components/people/peopleKit';
import { isCancelled } from '@/lib/ledger';
import { buildCustomerAccount, planPayment, buildPaymentEvents, parseDate, localStamp } from '@/lib/customerAccount';
import { getReceiptSettings, printInvoice, buildAccountStatementHtml, downloadStatementPdf, shareStatementViaWhatsApp, formatInvoiceId } from '../../utils/receipt';

const r2 = (v) => Math.round(v * 100) / 100;
const ts = (raw) => parseDate(raw)?.getTime() || 0;

/* ══ Customer account ═════════════════════════════════════════════════════ */
function CustomerAccount({ customer, onBack, onEdit, onDelete }) {
  const { list, pushBatch, nextId } = useDataStore();
  const { showToast } = useToast(); const { user } = useAuth(); const navigate = useNavigate();
  const saleRows = useSaleRows(); const { cancelSale, saveEdit } = useSaleActions();
  const [tab, setTab] = useState('history');
  const [period, setPeriod] = useState('all'); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [payOpen, setPayOpen] = useState(false); const [billsOpen, setBillsOpen] = useState(false);
  const [entry, setEntry] = useState(null); // { kind, id }
  const [editPay, setEditPay] = useState(null);
  const [returning, setReturning] = useState(null); const [editing, setEditing] = useState(null); const [cancelling, setCancelling] = useState(null);
  const [confirm, setConfirm] = useState(null); const [stmtBusy, setStmtBusy] = useState(null);

  const sales = list('sale'); const saleItems = list('sale_item'); const payments = list('customer_payment');
  const returns = list('sale_return'); const returnItems = list('sale_return_item');
  const khatas = list('customer_khata'); const khataPayments = list('customer_khata_payment');
  const accounts = list('account'); const accountTxns = list('account_txn');

  const account = useMemo(() => buildCustomerAccount({ customer, sales, saleItems, payments, returns, khatas, khataPayments }),
    [customer, sales, saleItems, payments, returns, khatas, khataPayments]);
  const t = account.totals;
  const invDate = useMemo(() => new Map(account.invoices.map((i) => [String(i.id), i.date_created])), [account]);
  const invNo = (id) => formatInvoiceId(id, invDate.get(String(id)));
  const saleRow = (id) => saleRows.find((r) => String(r.id) === String(id));

  const [start, end] = periodRange(period, from, to);
  const inRange = (raw) => { if (!start) return true; const d = parseDate(raw); return d && d >= start && d <= end; };
  const history = useMemo(() => {
    const decorate = (r) => ({ ...r, sub: r.type === 'Payment' ? [r.ref ? `on ${invNo(r.ref)}` : 'General', r.detail].filter(Boolean).join(' · ') : r.type === 'Invoice' ? r.detail : [r.ref ? invNo(r.ref) : '', r.detail].filter(Boolean).join(' · ') });
    if (!start) return { opening: 0, rows: account.ledger.map(decorate) };
    let opening = 0; const rows = [];
    for (const r of account.ledger) { const d = parseDate(r.date); if (d && d < start) opening = r.balance; else if (d && d <= end) rows.push(decorate(r)); }
    return { opening, rows };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, start, end]);
  const invoices = account.invoices.filter((i) => inRange(i.date_created));
  const paymentRows = account.payments.filter((p) => inRange(p.date_added || p.date_created));

  /* ── open a history row ── */
  const openLedger = (r) => {
    const m = String(r.key).match(/^(s|w|p|rf|r|kp|k)(.+)$/);
    if (!m) return;
    const [, pre, id] = m;
    if (pre === 's' || pre === 'w') setEntry({ kind: 'invoice', id });
    else if (pre === 'p') setEntry({ kind: 'payment', id });
    else if (pre === 'r' || pre === 'rf') setEntry({ kind: 'return', id });
    else setBillsOpen(true);
  };

  /* ── payments ── */
  const receive = async ({ amount, method, accountId, note }) => {
    const { events } = buildPaymentEvents({ account, customer, amount, note, accountId, method, nextId, sales });
    await pushBatch(events);
    showToast(`${rs(amount)} received from ${customer.name}`);
  };
  const groupOf = (p) => (p.payment_group ? account.payments.filter((x) => x.payment_group === p.payment_group) : [p]);
  const deletePayment = (p) => {
    const rows = groupOf(p); const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    setConfirm({
      title: `Delete payment of ${rs(total)}?`,
      body: rows.length > 1 ? `It was spread over ${rows.length} invoices. All parts and the matching cash/bank entry will be removed.` : 'The matching cash/bank entry will be removed too.',
      cta: 'Delete payment',
      action: async () => {
        const events = rows.map((r) => ({ entityType: 'customer_payment', operation: 'delete', payload: { id: r.id } }));
        const oldNote = `Customer payment received — ${p.notes || (p.sale_id ? `INV #${p.sale_id}` : 'General payment')}`;
        const txn = accountTxns.find((x) => x.type === 'in' && (p.payment_group ? String(x.note || '').includes(`[SPG:${p.payment_group}]`)
          : Math.abs(Number(x.amount) - Number(p.amount)) < 0.01 && (x.note === oldNote || (p.sale_id && x.note === `Sale payment received — Sale #${p.sale_id}`))));
        if (txn) events.push({ entityType: 'account_txn', operation: 'delete', payload: { id: txn.id } });
        events.push({ entityType: 'customer', operation: 'update', payload: { ...customer, outstanding_balance: r2(t.invoiceBalance + total), updated_at: localStamp() } });
        await pushBatch(events);
        setEntry(null);
        showToast('Payment deleted');
      },
    });
  };
  // Desktop edit-customer-payment: a split Smart Pay only takes a new note; a single payment can change amount too
  const savePaymentEdit = async (p, { amount, notes }) => {
    const now = localStamp();
    if (p.payment_group) {
      await pushBatch(groupOf(p).map((r) => ({ entityType: 'customer_payment', operation: 'update', payload: { ...r, notes } })));
      showToast('Payment note updated');
      return;
    }
    const events = [{ entityType: 'customer_payment', operation: 'update', payload: { ...p, amount, notes } }];
    const oldNote = `Customer payment received — ${p.notes || (p.sale_id ? `INV #${p.sale_id}` : 'General payment')}`;
    const newNote = `Customer payment received — ${notes || (p.sale_id ? `INV #${p.sale_id}` : 'General payment')}`;
    const txn = accountTxns.find((x) => x.type === 'in' && Math.abs(Number(x.amount) - Number(p.amount)) < 0.01 && (x.note === oldNote || (p.sale_id && x.note === `Sale payment received — Sale #${p.sale_id}`)));
    if (txn) events.push({ entityType: 'account_txn', operation: 'update', payload: { ...txn, amount, note: txn.note === oldNote ? newNote : txn.note } });
    if (Math.abs(amount - Number(p.amount)) > 0.005) events.push({ entityType: 'customer', operation: 'update', payload: { ...customer, outstanding_balance: r2(t.invoiceBalance + Number(p.amount) - amount), updated_at: now } });
    await pushBatch(events);
    showToast('Payment updated');
  };

  const invoiceData = (r) => {
    const settings = getReceiptSettings(); const synced = list('settings')?.[0] || {};
    return {
      saleId: r.id, items: r.lines.map((i) => ({ name: i.product_name, qty: Number(i.quantity), price: Number(i.price), lineTotal: i.view.amount })),
      subtotal: r.subtotal, discount: r.discount, total: r.total, paymentMethod: r.method || 'cash',
      settings: { ...settings, store_name: settings.store_name || synced.store_name || user?.store_name || 'My Store' },
      date: fmtDayTime(r.date), customerName: customer.name, customerPhone: customer.phone, amountPaid: r.paid, balance: r.remaining,
    };
  };

  const statement = async (action) => {
    if (stmtBusy) return;
    setStmtBusy(action);
    try {
      const settings = getReceiptSettings(); const synced = list('settings')?.[0] || {};
      const rows = history.rows.map((r) => ({ date: parseDate(r.date) || new Date(), type: r.type, desc: [r.type === 'Invoice' && r.ref ? invNo(r.ref) : r.type, r.sub].filter(Boolean).join(' — '), debit: r.debit, credit: r.credit }));
      if (start && Math.abs(history.opening) > 0.005) rows.unshift({ date: start, type: 'Opening', desc: 'Opening balance', debit: Math.max(0, history.opening), credit: Math.max(0, -history.opening) });
      const html = buildAccountStatementHtml({
        name: customer.name, phone: customer.phone, address: customer.address, type: 'customer', ledger: rows,
        totals: { invoiced: t.purchased + t.khataDue, paid: t.paid, returned: t.returned, balance: t.totalDue },
        settings: { ...settings, store_name: settings.store_name || synced.store_name || user?.store_name || 'My Store' },
      });
      const filename = `statement-${(customer.name || 'customer').replace(/\s+/g, '-')}.pdf`;
      if (action === 'pdf') await downloadStatementPdf(html, filename);
      else await shareStatementViaWhatsApp(html, { name: customer.name, phone: customer.phone, balance: t.totalDue, filename });
    } catch { showToast('Could not create the statement', 'error'); }
    finally { setStmtBusy(null); }
  };

  /* ── entry sheet content ── */
  const sheet = (() => {
    if (!entry) return null;
    if (entry.kind === 'invoice') {
      const r = saleRow(entry.id);
      if (!r) return { title: invNo(entry.id), subtitle: 'This invoice is not loaded on the web.', body: null };
      const live = r.state !== 'cancelled'; const lockEdit = r.returned > 0;
      return {
        title: r.no, subtitle: fmtDayTime(r.date), amount: rs(r.total), amountTone: r.state === 'cancelled' ? 'text-muted-foreground line-through' : 'text-foreground',
        body: (
          <div className="grid gap-3">
            <div className="flex items-center gap-2"><StateChip state={r.state} />{r.edited && <span className="text-[11px] font-semibold rounded-md px-1.5 py-0.5 bg-sky-500/10 text-sky-700 dark:text-sky-300">Edited</span>}{r.method && <span className="text-xs text-muted-foreground capitalize">{String(r.method).toLowerCase()}</span>}</div>
            <ul className="divide-y divide-border/60 rounded-xl border border-border text-sm">
              {r.lines.length === 0 && <li className="px-3 py-2.5 text-xs text-muted-foreground">Item lines haven’t synced to the web yet.</li>}
              {r.lines.map((it) => (
                <li key={it.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1 text-foreground">{it.product_name}{it.returnedQty > 0 && <span className="ml-2 rounded bg-muted px-1.5 py-px text-[10px] font-semibold text-muted-foreground">{qtyFmt(it.returnedQty)} returned</span>}<span className="block text-xs text-muted-foreground tabular-nums">{it.view.qty} × {it.view.rate}</span></span>
                  <span className="tabular-nums font-medium text-foreground">{rs(it.view.amount)}</span>
                </li>
              ))}
            </ul>
            <dl className="grid gap-1 text-sm">
              {r.discount > 0 && <div className="flex justify-between text-muted-foreground"><dt>Discount</dt><dd className="tabular-nums">− {rs(r.discount)}</dd></div>}
              <div className="flex justify-between text-muted-foreground"><dt>Paid</dt><dd className="tabular-nums">{rs(r.paid)}</dd></div>
              {r.returned > 0 && <div className="flex justify-between text-muted-foreground"><dt>Returned</dt><dd className="tabular-nums">− {rs(r.returned)}</dd></div>}
              {r.writeOff > 0 && <div className="flex justify-between text-muted-foreground"><dt>Written off</dt><dd className="tabular-nums">− {rs(r.writeOff)}</dd></div>}
              <div className={cn('flex justify-between font-semibold', r.remaining > 0.5 ? 'text-amber-700 dark:text-amber-400' : 'text-foreground')}><dt>Still due</dt><dd className="tabular-nums">{rs(r.remaining)}</dd></div>
            </dl>
            {lockEdit && live && <p className="text-xs text-muted-foreground">Editing is locked because items were returned — the same rule as the counter app.</p>}
          </div>
        ),
        actions: (<>
          <SheetButton icon={Printer} onClick={() => printInvoice(invoiceData(r))} disabled={!r.lines.length}>Print</SheetButton>
          {live && <SheetButton icon={lockEdit ? Lock : PencilLine} onClick={() => { setEditing(r); setEntry(null); }} disabled={lockEdit || r.state === 'returned' || !r.lines.length}>Edit items</SheetButton>}
          {live && <SheetButton icon={Undo2} onClick={() => { setReturning(r); setEntry(null); }} disabled={r.state === 'returned' || !r.lines.length}>Return items</SheetButton>}
          <SheetButton icon={FileText} onClick={() => navigate('/invoices')}>Invoices</SheetButton>
          {live && <SheetButton tone="danger" icon={Ban} onClick={() => { setCancelling(r); setEntry(null); }}>Cancel invoice</SheetButton>}
        </>),
      };
    }
    if (entry.kind === 'payment') {
      const p = account.payments.find((x) => String(x.id) === String(entry.id));
      if (!p) return null;
      const parts = groupOf(p); const total = parts.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const acc = accounts.find((a) => String(a.id) === String(p.account_id));
      return {
        title: p.payment_group ? 'Smart Pay payment' : 'Payment received', subtitle: fmtDayTime(p.date_added || p.date_created), amount: rs(total), amountTone: 'text-emerald-700 dark:text-emerald-400',
        body: (
          <div className="grid gap-3 text-sm">
            <dl className="grid gap-1.5">
              {acc && <div className="flex justify-between"><dt className="text-muted-foreground">Received in</dt><dd className="text-foreground">{acc.name}</dd></div>}
              {p.payment_method && <div className="flex justify-between"><dt className="text-muted-foreground">Method</dt><dd className="text-foreground capitalize">{String(p.payment_method).toLowerCase()}</dd></div>}
              {p.notes && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Note</dt><dd className="text-foreground text-right">{p.notes}</dd></div>}
            </dl>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">{parts.length > 1 ? `Spread over ${parts.length} entries` : 'Applied to'}</p>
              <ul className="divide-y divide-border/60 rounded-xl border border-border">
                {parts.map((x) => <li key={x.id} className="flex justify-between px-3 py-2"><span className="text-foreground">{x.sale_id ? invNo(x.sale_id) : 'General / advance'}</span><span className="tabular-nums font-medium">{rs(x.amount)}</span></li>)}
              </ul>
            </div>
          </div>
        ),
        actions: (<>
          <SheetButton icon={PencilLine} onClick={() => { setEditPay(p); setEntry(null); }}>Edit</SheetButton>
          <SheetButton tone="danger" icon={Trash2} onClick={() => deletePayment(p)}>Delete payment</SheetButton>
        </>),
      };
    }
    if (entry.kind === 'return') {
      const ret = account.returns.find((x) => String(x.id) === String(entry.id));
      if (!ret) return null;
      const items = returnItems.filter((x) => String(x.return_id) === String(ret.id));
      return {
        title: `Return on ${invNo(ret.sale_id)}`, subtitle: fmtDayTime(ret.date_created), amount: rs(ret.total_returned), amountTone: 'text-emerald-700 dark:text-emerald-400',
        body: (
          <div className="grid gap-3 text-sm">
            {items.length > 0 && <ul className="divide-y divide-border/60 rounded-xl border border-border">{items.map((it) => <li key={it.id} className="flex justify-between px-3 py-2"><span className="text-foreground">{it.product_name} <span className="text-xs text-muted-foreground">×{qtyFmt(it.quantity)}</span></span><span className="tabular-nums">{rs(Number(it.quantity) * Number(it.price))}</span></li>)}</ul>}
            <dl className="grid gap-1.5">
              <div className="flex justify-between"><dt className="text-muted-foreground">Came off their balance</dt><dd className="tabular-nums">{rs(Number(ret.total_returned) - Number(ret.cash_refunded || 0))}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Cash given back</dt><dd className="tabular-nums">{rs(ret.cash_refunded)}</dd></div>
              {ret.reason && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Reason</dt><dd className="text-right">{ret.reason}</dd></div>}
            </dl>
            <p className="text-xs text-muted-foreground">A return can’t be edited — stock and cash have already moved. Open the invoice to see it in full.</p>
          </div>
        ),
        actions: <SheetButton icon={FileText} onClick={() => setEntry({ kind: 'invoice', id: ret.sale_id })}>Open invoice</SheetButton>,
      };
    }
    return null;
  })();

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="h-9 pl-2 pr-3 rounded-lg inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><ChevronLeft size={17} /> Customers</button>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={onEdit} className="h-9 px-3 rounded-lg inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil size={15} /> <span className="hidden sm:inline">Edit</span></button>
          <button type="button" onClick={onDelete} className="h-9 px-3 rounded-lg inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"><Trash2 size={15} /> <span className="hidden sm:inline">Delete</span></button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)] items-start">
        {/* Summary */}
        <aside className="grid gap-4 xl:sticky xl:top-4">
          <section className="rounded-2xl border border-border/70 bg-card p-5">
            <div className="flex items-center gap-3">
              <Avatar name={customer.name} className="h-12 w-12 text-base rounded-2xl" />
              <div className="min-w-0">
                <h1 className="font-display text-xl font-extrabold tracking-tight text-foreground leading-snug break-words">{customer.name}</h1>
                {customer.created_at && <p className="text-xs text-muted-foreground">Customer since {fmtDay(customer.created_at)}</p>}
              </div>
            </div>
            <div className="mt-3 grid gap-1.5 text-sm text-muted-foreground">
              {customer.phone && <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(customer.phone); showToast('Number copied'); } catch { /* ignore */ } }} className="inline-flex items-center gap-2 hover:text-foreground tabular-nums w-fit"><Phone size={14} /> {customer.phone} <Copy size={11} className="opacity-60" /></button>}
              {customer.address && <span className="inline-flex items-start gap-2"><MapPin size={14} className="mt-0.5 shrink-0" /> {customer.address}</span>}
            </div>
            <div className={cn('mt-4 rounded-xl p-4', t.totalDue > 0.5 ? 'bg-amber-500/[0.07]' : t.totalDue < -0.5 ? 'bg-emerald-500/[0.07]' : 'bg-muted/40')}>
              <p className="text-xs font-medium text-muted-foreground">{t.totalDue < -0.5 ? 'Advance with you' : 'Total balance due'}</p>
              <p className={cn('mt-1 text-3xl font-bold tabular-nums tracking-tight', t.totalDue > 0.5 ? 'text-amber-800 dark:text-amber-300' : t.totalDue < -0.5 ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground')}>{rs(Math.abs(t.totalDue))}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">Sales loans <b className="font-semibold text-foreground tabular-nums">{rs(t.invoiceBalance)}</b> · Custom bills <b className="font-semibold text-foreground tabular-nums">{rs(t.khataDue)}</b></p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setPayOpen(true)} className="col-span-2 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-95"><ArrowDownLeft size={16} /> Receive payment</button>
              <button type="button" onClick={() => setBillsOpen(true)} className="h-10 rounded-xl border border-border text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-muted"><BookOpen size={15} /> Custom bills</button>
              <button type="button" onClick={() => statement('pdf')} disabled={!!stmtBusy} className="h-10 rounded-xl border border-border text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-muted disabled:opacity-60"><FileDown size={15} /> {stmtBusy === 'pdf' ? 'Preparing…' : 'Statement'}</button>
              {customer.phone && <button type="button" onClick={() => statement('wa')} disabled={!!stmtBusy} className="col-span-2 h-10 rounded-xl border border-border text-sm font-medium inline-flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-60"><MessageCircle size={15} /> Send statement on WhatsApp</button>}
            </div>
          </section>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70">
            {[['Purchased', rs(t.purchased)], ['Paid', rs(t.paid)], ['Returned', rs(t.returned)], ['Open invoices', t.openInvoices.toLocaleString('en-PK')]].map(([l, v]) => (
              <div key={l} className="bg-card px-4 py-3"><dt className="text-xs text-muted-foreground">{l}</dt><dd className="mt-0.5 text-base font-semibold tabular-nums text-foreground">{v}</dd></div>
            ))}
          </dl>
        </aside>

        {/* Activity */}
        <section className="rounded-2xl border border-border/70 bg-card min-w-0">
          <div className="flex flex-col gap-2 border-b border-border px-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1 -mb-px overflow-x-auto [scrollbar-width:none]" role="tablist">
              {[['history', 'History'], ['invoices', `Invoices · ${invoices.length}`], ['payments', `Payments · ${paymentRows.length}`], ['bills', `Custom bills · ${account.bills.length}`]].map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn('h-11 px-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors', tab === k ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>{l}</button>
              ))}
            </div>
            <div className="pb-2 sm:pb-0"><PeriodPicker {...{ period, setPeriod, from, setFrom, to, setTo }} /></div>
          </div>
          <div className="p-4">
            {tab === 'history' && <>
              <p className="mb-2 text-xs text-muted-foreground">Tap any entry to see it in full, edit, delete or cancel it.</p>
              <HistoryList rows={history.rows} opening={history.opening} start={start} kind="customer" onOpen={openLedger}
                label={(r) => (r.type === 'Invoice' && r.ref ? invNo(r.ref) : r.type)} />
            </>}
            {tab === 'invoices' && (
              <ul className="divide-y divide-border/60">
                {invoices.length === 0 && <li className="py-12 text-center text-sm text-muted-foreground">No invoices{start ? ' in this period' : ''}.</li>}
                {invoices.map((inv) => (
                  <li key={inv.id}>
                    <button type="button" onClick={() => setEntry({ kind: 'invoice', id: inv.id })} className="group w-full flex items-center gap-3 py-3 text-left rounded-lg hover:bg-muted/40 -mx-2 px-2">
                      <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-foreground">{formatInvoiceId(inv.id, inv.date_created)}</span><span className="block text-xs text-muted-foreground tabular-nums">{fmtDayTime(inv.date_created)} · {inv.items.length} item{inv.items.length === 1 ? '' : 's'}</span></span>
                      <StateChip state={inv.state} />
                      <span className="w-28 text-right"><span className="block text-sm font-semibold tabular-nums text-foreground">{rs(inv.total)}</span>{inv.remaining > 0.5 && <span className="block text-[11px] tabular-nums text-amber-700 dark:text-amber-400">{rs(inv.remaining)} due</span>}</span>
                      <ChevronRight size={15} className="text-muted-foreground/40 group-hover:text-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {tab === 'payments' && (
              <ul className="divide-y divide-border/60">
                {paymentRows.length === 0 && <li className="py-12 text-center text-sm text-muted-foreground">No payments{start ? ' in this period' : ''}.</li>}
                {paymentRows.map((p) => {
                  const acc = accounts.find((a) => String(a.id) === String(p.account_id));
                  return (
                    <li key={p.id} className="flex items-center gap-2 py-2">
                      <button type="button" onClick={() => setEntry({ kind: 'payment', id: p.id })} className="flex flex-1 min-w-0 items-center gap-3 text-left rounded-lg hover:bg-muted/40 -mx-2 px-2 py-1">
                        <span className="h-9 w-9 rounded-full bg-emerald-500/10 text-emerald-600 inline-flex items-center justify-center shrink-0"><ArrowDownLeft size={16} /></span>
                        <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-foreground">{p.sale_id ? `For ${invNo(p.sale_id)}` : 'General / advance payment'}{p.payment_group && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">smart pay</span>}</span><span className="block text-xs text-muted-foreground truncate tabular-nums">{fmtDayTime(p.date_added || p.date_created)}{acc ? ` · ${acc.name}` : ''}{p.notes ? ` · ${p.notes}` : ''}</span></span>
                        <span className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{rs(p.amount)}</span>
                      </button>
                      <button type="button" onClick={() => setEditPay(p)} className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Edit payment" title="Edit payment"><PencilLine size={14} /></button>
                      <button type="button" onClick={() => deletePayment(p)} className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10" aria-label="Delete payment" title="Delete payment"><Trash2 size={14} /></button>
                    </li>
                  );
                })}
              </ul>
            )}
            {tab === 'bills' && (
              account.bills.length === 0 ? (
                <div className="py-12 text-center"><p className="text-sm text-muted-foreground">No custom bills for this customer.</p><button type="button" onClick={() => setBillsOpen(true)} className="mt-3 h-9 px-4 rounded-lg border border-border text-sm font-medium inline-flex items-center gap-2 hover:bg-muted"><Plus size={15} /> New custom bill</button></div>
              ) : (
                <>
                  <ul className="divide-y divide-border/60">
                    {account.bills.map((k) => (
                      <li key={k.id}><button type="button" onClick={() => setBillsOpen(true)} className="group w-full flex items-center gap-3 py-3 text-left rounded-lg hover:bg-muted/40 -mx-2 px-2">
                        <span className="h-9 w-9 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 inline-flex items-center justify-center shrink-0"><BookOpen size={15} /></span>
                        <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-foreground truncate">{k.title || 'Custom bill'}</span><span className="block text-xs text-muted-foreground tabular-nums">{fmtDay(k.date_created || k.created_at)} · {rs(k.total_amount)} · paid {rs(k.paid)}</span></span>
                        {k.remaining > 0.5 ? <span className="text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-400">{rs(k.remaining)} due</span> : <StateChip state="paid" />}
                        <ChevronRight size={15} className="text-muted-foreground/40 group-hover:text-foreground" />
                      </button></li>
                    ))}
                  </ul>
                </>
              )
            )}
          </div>
        </section>
      </div>

      <MoneyDialog open={payOpen} onClose={() => setPayOpen(false)} title="Receive payment from" partyName={customer.name}
        dueLabel={`Owes ${rs(Math.max(0, t.totalDue))}${t.khataDue > 0.5 ? ` · incl. ${rs(t.khataDue)} on custom bills` : ''}`} due={Math.max(0, t.totalDue)} accounts={accounts}
        plan={(amt) => { const p = planPayment(account, amt); return { ...p, allocations: p.allocations.map((a) => ({ ...a, display: a.kind === 'invoice' ? invNo(a.id) : a.label })) }; }}
        onSave={receive} direction="in" advanceLabel="Kept as advance (credit)" />
      <EntrySheet open={!!sheet} onClose={() => setEntry(null)} {...(sheet || {})}>{sheet?.body}</EntrySheet>
      <EditPaymentDialog payment={editPay} onClose={() => setEditPay(null)}
        groupTotal={editPay?.payment_group ? groupOf(editPay).reduce((s, r) => s + (Number(r.amount) || 0), 0) : undefined}
        lockedReason={editPay?.payment_group ? (groupOf(editPay).length > 1 ? 'This Smart Pay is split across invoices — to change the amount, delete it and receive again. You can still change the note.' : 'A Smart Pay payment keeps its amount (same as the counter app) — delete it and receive again to change it. You can still change the note.') : null}
        onSave={(v) => savePaymentEdit(editPay, v)} />
      {returning && <ReturnDialog row={returning} onClose={() => setReturning(null)} />}
      <EditSaleModal open={!!editing} onClose={() => setEditing(null)} sale={editing?.raw} items={editing?.lines || []} products={list('product')} onSave={(v) => saveEdit(editing, v)} />
      <CancelSaleDialog row={cancelling} onClose={() => setCancelling(null)} onConfirm={async () => { const r = cancelling; setCancelling(null); try { await cancelSale(r); } catch (e) { showToast(e?.message || 'Could not cancel', 'error'); } }} />
      {billsOpen && <CustomerKhataPanel customer={customer} onClose={() => setBillsOpen(false)} />}
      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} onError={(e) => showToast(e?.message || 'Something went wrong', 'error')} />
    </div>
  );
}

/* ══ Customers list ═══════════════════════════════════════════════════════ */
export default function CustomersPage() {
  const { list, pushEntity, pushBatch } = useDataStore();
  const { showToast } = useToast();
  const [search, setSearch] = useState(''); const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [formOpen, setFormOpen] = useState(false); const [editing, setEditing] = useState(null); const [deleting, setDeleting] = useState(null);

  const customers = list('customer'); const sales = list('sale'); const payments = list('customer_payment');
  const returns = list('sale_return'); const khatas = list('customer_khata'); const khataPayments = list('customer_khata_payment');

  // Desktop balance: Σ(active invoice − write-off) − Σ payments − Σ(returns − cash refunded) + open custom bills
  const rows = useMemo(() => {
    const agg = new Map(customers.map((c) => [String(c.id), { purchased: 0, paid: 0, net: 0, khata: 0, last: 0 }]));
    const get = (id) => agg.get(String(id));
    const owner = new Map();
    for (const s of sales) {
      const a = s.customer_id != null && get(s.customer_id); if (!a) continue;
      a.last = Math.max(a.last, ts(s.date_created));
      if (isCancelled(s)) continue;
      owner.set(String(s.id), a);
      const v = (Number(s.total) || 0) - (Number(s.write_off_amount) || 0); a.purchased += v; a.net += v;
    }
    for (const p of payments) { const a = p.customer_id != null && get(p.customer_id); if (!a) continue; a.paid += Number(p.amount) || 0; a.net -= Number(p.amount) || 0; a.last = Math.max(a.last, ts(p.date_added || p.date_created)); }
    for (const r of returns) { const a = owner.get(String(r.sale_id)); if (a) a.net -= (Number(r.total_returned) || 0) - (Number(r.cash_refunded) || 0); }
    const kPaid = new Map(); for (const p of khataPayments) kPaid.set(String(p.khata_id), (kPaid.get(String(p.khata_id)) || 0) + (Number(p.amount) || 0));
    for (const k of khatas) { if (String(k.status || '').toLowerCase() === 'closed') continue; const a = get(k.customer_id); if (a) a.khata += Math.max(0, (Number(k.total_amount) || 0) - (kPaid.get(String(k.id)) || 0)); }
    return customers.map((c) => { const a = get(c.id); return { ...c, purchased: a.purchased, paid: a.paid, balance: r2(a.net + a.khata), last: a.last }; });
  }, [customers, sales, payments, returns, khatas, khataPayments]);

  const counts = useMemo(() => ({ all: rows.length, owing: rows.filter((r) => r.balance > 0.5).length, credit: rows.filter((r) => r.balance < -0.5).length, settled: rows.filter((r) => Math.abs(r.balance) <= 0.5).length }), [rows]);
  const receivable = useMemo(() => rows.filter((r) => r.balance > 0.5).reduce((s, r) => s + r.balance, 0), [rows]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((c) => (!q || c.name?.toLowerCase().includes(q) || String(c.phone || '').includes(q) || String(c.address || '').toLowerCase().includes(q))
      && (filter === 'all' || (filter === 'owing' ? c.balance > 0.5 : filter === 'credit' ? c.balance < -0.5 : Math.abs(c.balance) <= 0.5)));
  }, [rows, search, filter]);
  const open = rows.find((c) => String(c.id) === String(openId));

  const saveCustomer = async (form) => {
    const now = localStamp(); const name = String(form.name || '').trim();
    if (!name) throw new Error('Customer name is required');
    if (editing) { await pushEntity('customer', 'update', { ...editing, ...form, name, updated_at: now }); showToast('Customer updated'); }
    else {
      const created = await pushEntity('customer', 'create', { name, phone: form.phone || '', email: form.email || '', address: form.address || '', notes: form.notes || '', outstanding_balance: 0, created_at: now, updated_at: now });
      if (created?.id != null) setOpenId(created.id);
      showToast('Customer added');
    }
  };
  const confirmDelete = async () => {
    const c = deleting; setDeleting(null);
    if (!c || Math.abs(c.balance) > 0.5) return;
    await pushBatch([{ entityType: 'customer', operation: 'delete', payload: { id: c.id } }]);
    setOpenId(null);
    showToast('Customer deleted');
  };

  const columns = [
    { key: 'name', label: 'Customer', sort: (r) => String(r.name || '').toLowerCase(), firstDir: 'asc', render: (r) => (
      <span className="flex items-center gap-3 min-w-0"><Avatar name={r.name} className="h-9 w-9 text-xs" /><span className="min-w-0"><span className="block truncate font-medium text-foreground">{r.name}</span><span className="block truncate text-xs text-muted-foreground tabular-nums">{r.phone || 'No phone'}</span></span></span>
    ) },
    { key: 'address', label: 'Area / address', className: 'hidden lg:table-cell max-w-[220px]', render: (r) => <span className="block truncate text-muted-foreground">{r.address || '—'}</span> },
    { key: 'purchased', label: 'Purchased', align: 'right', sort: (r) => r.purchased, render: (r) => <span className="text-muted-foreground">{rs(r.purchased)}</span> },
    { key: 'paid', label: 'Paid', align: 'right', className: 'hidden lg:table-cell', sort: (r) => r.paid, render: (r) => <span className="text-muted-foreground">{rs(r.paid)}</span> },
    { key: 'balance', label: 'Balance', align: 'right', mobileRight: true, sort: (r) => r.balance, render: (r) => <Balance value={r.balance} kind="customer" className="font-semibold tabular-nums text-sm" /> },
    { key: 'last', label: 'Last activity', align: 'right', className: 'hidden xl:table-cell', sort: (r) => r.last, render: (r) => <span className="text-muted-foreground">{r.last ? fmtDay(new Date(r.last)) : '—'}</span> },
  ];

  return (
    <div className="flex flex-col gap-5">
      {open ? (
        <CustomerAccount key={open.id} customer={open} onBack={() => setOpenId(null)} onEdit={() => { setEditing(open); setFormOpen(true); }} onDelete={() => setDeleting(open)} />
      ) : (
        <>
          <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">Customers</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">{counts.all.toLocaleString('en-PK')} customer{counts.all === 1 ? '' : 's'}{counts.owing > 0 && <> · <span className="text-amber-700 dark:text-amber-400 font-medium">{counts.owing} owe you {rs(receivable)}</span></>}</p>
            </div>
            <div className="flex gap-2">
              <Link to="/route-book" className="h-10 px-3.5 rounded-xl border border-border bg-card text-sm font-medium inline-flex items-center gap-2 hover:bg-muted"><MapPinned size={15} /> <span className="hidden sm:inline">Route book</span><span className="sm:hidden">Routes</span></Link>
              <Link to="/payment-reminders" className="h-10 px-3.5 rounded-xl border border-border bg-card text-sm font-medium inline-flex items-center gap-2 hover:bg-muted"><BellRing size={15} /> Reminders</Link>
              <button type="button" onClick={() => { setEditing(null); setFormOpen(true); }} className="ml-auto sm:ml-0 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 shadow-sm hover:opacity-95"><Plus size={16} /> Add<span className="hidden sm:inline"> customer</span></button>
            </div>
          </header>
          <PeopleList rows={filtered} columns={columns} search={search} onSearch={setSearch}
            filters={[['all', 'All', counts.all], ['owing', 'Owe you', counts.owing], ['credit', 'In credit', counts.credit], ['settled', 'Settled', counts.settled]]}
            filter={filter} onFilter={setFilter} onOpen={(r) => setOpenId(r.id)} defaultSort={{ key: 'balance', dir: 'desc' }}
            emptyIcon={Users} emptyTitle={customers.length ? 'No customer matches' : 'No customers yet'} emptyHint={customers.length ? 'Try another search or filter.' : 'Add your first customer to start tracking udhaar.'}
            searchPlaceholder="Search name, phone or area" />
        </>
      )}

      <CustomerFormModal open={formOpen} onClose={() => setFormOpen(false)} onSubmit={saveCustomer} customer={editing} />
      <ConfirmDialog confirm={deleting ? {
        title: `Delete ${deleting.name}?`,
        body: Math.abs(deleting.balance) > 0.5 ? `They still have a balance of ${rs(Math.abs(deleting.balance))}. Settle it before deleting.` : 'Their past invoices stay in your records. This can’t be undone.',
        blocked: Math.abs(deleting.balance) > 0.5, cta: 'Delete', action: confirmDelete,
      } : null} onClose={() => setDeleting(null)} />
    </div>
  );
}
