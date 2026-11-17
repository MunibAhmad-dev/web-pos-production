import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import {
  Plus, Phone, MapPin, Pencil, Trash2, MessageCircle, FileDown, ChevronLeft, BookOpen, Ban, ArrowUpRight,
  Copy, Truck, BarChart3, Layers, PencilLine, ExternalLink, ChevronRight, Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import VendorFormModal from '../../components/vendors/VendorFormModal';
import CustomBillsPanel from '../../components/vendors/CustomBillsPanel';
import GlobalCustomBillsOverlay from '../../components/vendors/GlobalCustomBillsOverlay';
import {
  rs, fmtDay, fmtDayTime, Avatar, periodRange, Balance, StateChip, PeopleList, HistoryList, MoneyDialog,
  EditPaymentDialog, EntrySheet, SheetButton, ConfirmDialog, PeriodPicker,
} from '../../components/people/peopleKit';
import { vendorBalances, khataBalances, isCancelled } from '@/lib/ledger';
import { parseDate, localStamp } from '@/lib/customerAccount';
import { buildVendorAccount, planVendorPayment, buildVendorPaymentEvents } from '@/lib/vendorAccount';
import { getReceiptSettings, buildAccountStatementHtml, downloadStatementPdf, shareStatementViaWhatsApp } from '../../utils/receipt';

const r2 = (v) => Math.round(v * 100) / 100;
const ts = (raw) => parseDate(raw)?.getTime() || 0;
const isLinked = (p) => p.purchase_id != null && p.purchase_id !== '' && Number(p.purchase_id) !== 0;
const oldVendorNote = (p) => `Vendor payment — ${p.notes || (isLinked(p) ? `PO #${p.purchase_id}` : 'Manual payment')}`;

/* ══ Vendor account ═══════════════════════════════════════════════════════ */
function VendorAccount({ vendor, onBack, onEdit, onDelete }) {
  const { list, pushBatch, nextId } = useDataStore();
  const { showToast } = useToast(); const { user } = useAuth(); const navigate = useNavigate();
  const [tab, setTab] = useState('history');
  const [period, setPeriod] = useState('all'); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [payOpen, setPayOpen] = useState(false); const [billsOpen, setBillsOpen] = useState(false);
  const [entry, setEntry] = useState(null); const [editPay, setEditPay] = useState(null);
  const [confirm, setConfirm] = useState(null); const [stmtBusy, setStmtBusy] = useState(null);

  const purchases = list('purchase'); const purchaseItems = list('purchase_item'); const batches = list('inventory_batch');
  const products = list('product'); const payments = list('vendor_payment'); const returns = list('purchase_return');
  const khatas = list('vendor_khata'); const khataPayments = list('vendor_khata_payment');
  const accounts = list('account'); const accountTxns = list('account_txn');

  const account = useMemo(() => buildVendorAccount({ vendor, purchases, purchaseItems, batches, products, payments, returns, khatas, khataPayments }),
    [vendor, purchases, purchaseItems, batches, products, payments, returns, khatas, khataPayments]);
  const t = account.totals;
  const supplied = useMemo(() => products.filter((p) => String(p.vendor_id) === String(vendor.id)), [products, vendor.id]);
  const billNo = (pid) => account.bills.find((b) => String(b.id) === String(pid))?.no || `PO #${pid}`;

  const [start, end] = periodRange(period, from, to);
  const inRange = (raw) => { if (!start) return true; const d = parseDate(raw); return d && d >= start && d <= end; };
  const history = useMemo(() => {
    const decorate = (r) => ({ ...r, sub: r.type === 'Payment' ? [r.ref ? `on ${r.ref}` : 'General', r.detail].filter(Boolean).join(' · ') : [r.type === 'Purchase' ? '' : r.ref, r.detail].filter(Boolean).join(' · ') });
    if (!start) return { opening: 0, rows: account.ledger.map(decorate) };
    let opening = 0; const rows = [];
    for (const r of account.ledger) { const d = parseDate(r.date); if (d && d < start) opening = r.balance; else if (d && d <= end) rows.push(decorate(r)); }
    return { opening, rows };
  }, [account, start, end]);
  const bills = account.bills.filter((b) => inRange(b.date_created));
  const paymentRows = account.payments.filter((p) => inRange(p.date_created || p.date_added));

  const openLedger = (r) => {
    const m = String(r.key).match(/^(p|v|r|kp|k)(.+)$/);
    if (!m) return;
    const [, pre, id] = m;
    if (pre === 'p') setEntry({ kind: 'purchase', id });
    else if (pre === 'v') setEntry({ kind: 'payment', id });
    else if (pre === 'r') setEntry({ kind: 'return', id });
    else setBillsOpen(true);
  };

  const pay = async ({ amount, accountId, note }) => {
    const { events } = buildVendorPaymentEvents({ account, vendor, amount, note, accountId, nextId });
    await pushBatch(events);
    showToast(`${rs(amount)} paid to ${vendor.name}`);
  };
  const groupOf = (p) => (p.payment_group ? account.payments.filter((x) => x.payment_group === p.payment_group) : [p]);
  const txnFor = (p) => accountTxns.find((x) => x.type === 'out' && (p.payment_group ? String(x.note || '').includes(`[SPG:${p.payment_group}]`)
    : String(x.note || '').includes(`[VPId:${p.id}]`) || (x.note === oldVendorNote(p) && Math.abs(Number(x.amount) - Number(p.amount)) < 0.01)));

  const deletePayment = (p) => {
    const rows = groupOf(p); const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    setConfirm({
      title: `Delete payment of ${rs(total)}?`,
      body: rows.length > 1 ? `It was spread over ${rows.length} bills. All parts and the matching cash/bank entry will be removed.` : 'The matching cash/bank entry will be removed too.',
      cta: 'Delete payment',
      action: async () => {
        const events = rows.map((r) => ({ entityType: 'vendor_payment', operation: 'delete', payload: { id: r.id } }));
        const txn = txnFor(p);
        if (txn) events.push({ entityType: 'account_txn', operation: 'delete', payload: { id: txn.id } });
        await pushBatch(events);
        setEntry(null);
        showToast('Payment deleted');
      },
    });
  };
  // Desktop edit-vendor-payment rules
  const editLock = (p) => {
    if (!p) return null;
    if (p.payment_group) return groupOf(p).length > 1 ? 'This Smart Pay is split across bills — to change the amount, delete it and pay again. You can still change the note.' : 'A Smart Pay payment keeps its amount (same as the counter app) — delete it and pay again to change it. You can still change the note.';
    if (p.cheque_id) return 'This payment comes from a cheque — change the cheque amount instead. You can still change the note.';
    if (khataPayments.some((k) => String(k.vendor_payment_id) === String(p.id))) return 'This payment belongs to a custom bill — change it from the custom bill. You can still change the note.';
    return null;
  };
  const savePaymentEdit = async (p, { amount, notes }) => {
    if (p.payment_group) {
      await pushBatch(groupOf(p).map((r) => ({ entityType: 'vendor_payment', operation: 'update', payload: { ...r, notes } })));
      showToast('Payment note updated');
      return;
    }
    const amt = editLock(p) ? Number(p.amount) : amount;
    const events = [{ entityType: 'vendor_payment', operation: 'update', payload: { ...p, amount: amt, notes } }];
    const txn = txnFor(p);
    if (txn) events.push({ entityType: 'account_txn', operation: 'update', payload: { ...txn, amount: amt, note: `Vendor payment — ${notes || (isLinked(p) ? `PO #${p.purchase_id}` : 'Manual payment')} [VPId:${p.id}]` } });
    await pushBatch(events);
    showToast('Payment updated');
  };

  // Desktop cancel-purchase: blocked after returns; reverse what's left in its batches; Smart Pay
  // shares stay as vendor credit, other payments on it are deleted with their cash entries.
  const cancelPurchase = (b) => {
    const hasReturns = b.returned > 0 || returns.some((r) => String(r.purchase_id) === String(b.id));
    setConfirm({
      title: `Cancel ${b.no}?`,
      body: hasReturns ? 'This purchase has returns recorded, so it can’t be cancelled. Return the remaining items instead.'
        : 'Stock still left from this purchase comes off, payments made only for it are reversed (Smart Pay shares stay as credit with the vendor). This can’t be undone.',
      blocked: hasReturns, cta: 'Cancel purchase',
      action: async () => {
        const now = localStamp(); const events = [];
        const raw = purchases.find((p) => String(p.id) === String(b.id)) || b;
        const myBatches = batches.filter((x) => String(x.purchase_id) === String(b.id));
        const delta = new Map();
        if (myBatches.length) {
          for (const x of myBatches) {
            const q = Number(x.quantity_remaining) || 0;
            if (x.product_id != null && q > 0) delta.set(String(x.product_id), (delta.get(String(x.product_id)) || 0) + q);
            events.push({ entityType: 'inventory_batch', operation: 'delete', payload: { id: x.id } });
          }
        } else {
          for (const l of b.lines) { const it = purchaseItems.find((pi) => String(pi.id) === String(l.id)); const pid = it?.product_id; if (pid != null) delta.set(String(pid), (delta.get(String(pid)) || 0) + l.quantity); }
        }
        for (const [pid, q] of delta) { const p = products.find((x) => String(x.id) === pid); if (p) events.push({ entityType: 'product', operation: 'update', payload: { ...p, stock: (Number(p.stock) || 0) - q, updated_at: now } }); }
        events.push({ entityType: 'purchase', operation: 'update', payload: { ...raw, status: 'Cancelled', updated_at: now } });
        for (const p of payments.filter((x) => String(x.purchase_id) === String(b.id))) {
          if (p.payment_group) { events.push({ entityType: 'vendor_payment', operation: 'update', payload: { ...p, purchase_id: null } }); continue; }
          events.push({ entityType: 'vendor_payment', operation: 'delete', payload: { id: p.id } });
          const txn = txnFor(p); if (txn) events.push({ entityType: 'account_txn', operation: 'delete', payload: { id: txn.id } });
        }
        for (const x of accountTxns.filter((x) => x.type === 'out' && x.note === `Purchase payment — PO #${b.id}`)) events.push({ entityType: 'account_txn', operation: 'delete', payload: { id: x.id } });
        await pushBatch(events);
        setEntry(null);
        showToast(`${b.no} cancelled`);
      },
    });
  };

  const statement = async (action) => {
    if (stmtBusy) return;
    setStmtBusy(action);
    try {
      const settings = getReceiptSettings(); const synced = list('settings')?.[0] || {};
      const rows = history.rows.map((r) => ({ date: parseDate(r.date) || new Date(), type: r.type, desc: [r.type === 'Payment' ? 'Payment' : r.ref || r.type, r.sub].filter(Boolean).join(' — '), debit: r.debit, credit: r.credit }));
      if (start && Math.abs(history.opening) > 0.005) rows.unshift({ date: start, type: 'Opening', desc: 'Opening balance', debit: Math.max(0, history.opening), credit: Math.max(0, -history.opening) });
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

  const sheet = (() => {
    if (!entry) return null;
    if (entry.kind === 'purchase') {
      const b = account.bills.find((x) => String(x.id) === String(entry.id));
      if (!b) return null;
      return {
        title: b.no, subtitle: fmtDayTime(b.date_created), amount: rs(b.total), amountTone: b.cancelled ? 'text-muted-foreground line-through' : 'text-foreground',
        body: (
          <div className="grid gap-3">
            <div><StateChip state={b.state} /></div>
            <ul className="divide-y divide-border/60 rounded-xl border border-border text-sm">
              {b.lines.length === 0 && <li className="px-3 py-2.5 text-xs text-muted-foreground">Item lines for this bill haven’t synced to the web yet.</li>}
              {b.lines.map((it) => <li key={it.id} className="flex items-center gap-3 px-3 py-2"><span className="min-w-0 flex-1 text-foreground">{it.name}<span className="block text-xs text-muted-foreground tabular-nums">{Number(it.quantity).toLocaleString('en-PK')} × {rs(it.price)}</span></span><span className="tabular-nums font-medium text-foreground">{rs(it.amount)}</span></li>)}
            </ul>
            <dl className="grid gap-1 text-sm">
              <div className="flex justify-between text-muted-foreground"><dt>Paid</dt><dd className="tabular-nums">{rs(b.paid)}</dd></div>
              {b.returned > 0 && <div className="flex justify-between text-muted-foreground"><dt>Returned</dt><dd className="tabular-nums">− {rs(b.returned)}</dd></div>}
              <div className={cn('flex justify-between font-semibold', b.remaining > 0.5 ? 'text-rose-700 dark:text-rose-400' : 'text-foreground')}><dt>Still to pay</dt><dd className="tabular-nums">{rs(b.remaining)}</dd></div>
            </dl>
          </div>
        ),
        actions: (<>
          <SheetButton icon={ExternalLink} onClick={() => navigate('/purchases')}>Edit or return in Purchases</SheetButton>
          {!b.cancelled && <SheetButton tone="danger" icon={Ban} onClick={() => cancelPurchase(b)}>Cancel purchase</SheetButton>}
        </>),
      };
    }
    if (entry.kind === 'payment') {
      const p = account.payments.find((x) => String(x.id) === String(entry.id));
      if (!p) return null;
      const parts = groupOf(p); const total = parts.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const acc = accounts.find((a) => String(a.id) === String(p.account_id));
      return {
        title: p.payment_group ? 'Smart Pay payment' : 'Payment made', subtitle: fmtDayTime(p.date_created || p.date_added), amount: rs(total), amountTone: 'text-foreground',
        body: (
          <div className="grid gap-3 text-sm">
            <dl className="grid gap-1.5">
              {acc && <div className="flex justify-between"><dt className="text-muted-foreground">Paid from</dt><dd className="text-foreground">{acc.name}</dd></div>}
              {p.notes && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Note</dt><dd className="text-foreground text-right">{p.notes}</dd></div>}
            </dl>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">{parts.length > 1 ? `Spread over ${parts.length} entries` : 'Applied to'}</p>
              <ul className="divide-y divide-border/60 rounded-xl border border-border">{parts.map((x) => <li key={x.id} className="flex justify-between px-3 py-2"><span className="text-foreground">{isLinked(x) ? billNo(x.purchase_id) : 'General / advance'}</span><span className="tabular-nums font-medium">{rs(x.amount)}</span></li>)}</ul>
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
      const ret = returns.find((x) => String(x.id) === String(entry.id));
      if (!ret) return null;
      return {
        title: `Return on ${billNo(ret.purchase_id)}`, subtitle: fmtDayTime(ret.date_created), amount: rs(ret.total_returned ?? ret.total), amountTone: 'text-emerald-700 dark:text-emerald-400',
        body: <p className="text-sm text-muted-foreground">{ret.reason ? `Reason: ${ret.reason}. ` : ''}Returns are recorded from Purchases and can’t be edited here — stock and cash have already moved.</p>,
        actions: <SheetButton icon={Package} onClick={() => setEntry({ kind: 'purchase', id: ret.purchase_id })}>Open purchase</SheetButton>,
      };
    }
    return null;
  })();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="h-9 pl-2 pr-3 rounded-lg inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><ChevronLeft size={17} /> Vendors</button>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={onEdit} className="h-9 px-3 rounded-lg inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil size={15} /> <span className="hidden sm:inline">Edit</span></button>
          <button type="button" onClick={onDelete} className="h-9 px-3 rounded-lg inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"><Trash2 size={15} /> <span className="hidden sm:inline">Delete</span></button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)] items-start">
        <aside className="grid gap-4 xl:sticky xl:top-4">
          <section className="rounded-2xl border border-border/70 bg-card p-5">
            <div className="flex items-center gap-3">
              <Avatar name={vendor.name} className="h-12 w-12 text-base rounded-2xl" />
              <div className="min-w-0">
                <h1 className="font-display text-xl font-extrabold tracking-tight text-foreground leading-snug break-words">{vendor.name}</h1>
                {supplied.length > 0 && <p className="text-xs text-muted-foreground">Supplies {supplied.length} product{supplied.length === 1 ? '' : 's'}</p>}
              </div>
            </div>
            <div className="mt-3 grid gap-1.5 text-sm text-muted-foreground">
              {vendor.phone && <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(vendor.phone); showToast('Number copied'); } catch { /* ignore */ } }} className="inline-flex items-center gap-2 hover:text-foreground tabular-nums w-fit"><Phone size={14} /> {vendor.phone} <Copy size={11} className="opacity-60" /></button>}
              {vendor.address && <span className="inline-flex items-start gap-2"><MapPin size={14} className="mt-0.5 shrink-0" /> {vendor.address}</span>}
            </div>
            <div className={cn('mt-4 rounded-xl p-4', t.totalDue > 0.5 ? 'bg-rose-500/[0.06]' : t.totalDue < -0.5 ? 'bg-emerald-500/[0.07]' : 'bg-muted/40')}>
              <p className="text-xs font-medium text-muted-foreground">{t.totalDue < -0.5 ? 'Paid ahead to them' : 'You owe them'}</p>
              <p className={cn('mt-1 text-3xl font-bold tabular-nums tracking-tight', t.totalDue > 0.5 ? 'text-rose-700 dark:text-rose-300' : t.totalDue < -0.5 ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground')}>{rs(Math.abs(t.totalDue))}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">Purchases <b className="font-semibold text-foreground tabular-nums">{rs(t.purchaseBalance)}</b> · Custom bills <b className="font-semibold text-foreground tabular-nums">{rs(t.khataDue)}</b></p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setPayOpen(true)} className="col-span-2 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-95"><ArrowUpRight size={16} /> Pay vendor</button>
              <button type="button" onClick={() => setBillsOpen(true)} className="h-10 rounded-xl border border-border text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-muted"><BookOpen size={15} /> Custom bills</button>
              <button type="button" onClick={() => statement('pdf')} disabled={!!stmtBusy} className="h-10 rounded-xl border border-border text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-muted disabled:opacity-60"><FileDown size={15} /> {stmtBusy === 'pdf' ? 'Preparing…' : 'Statement'}</button>
              {vendor.phone && <button type="button" onClick={() => statement('wa')} disabled={!!stmtBusy} className="col-span-2 h-10 rounded-xl border border-border text-sm font-medium inline-flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-60"><MessageCircle size={15} /> Send statement on WhatsApp</button>}
            </div>
          </section>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70">
            {[['Purchased', rs(t.purchased)], ['Paid', rs(t.paid)], ['Returned', rs(t.returned)], ['Open bills', t.openBills.toLocaleString('en-PK')]].map(([l, v]) => (
              <div key={l} className="bg-card px-4 py-3"><dt className="text-xs text-muted-foreground">{l}</dt><dd className="mt-0.5 text-base font-semibold tabular-nums text-foreground">{v}</dd></div>
            ))}
          </dl>
        </aside>

        <section className="rounded-2xl border border-border/70 bg-card min-w-0">
          <div className="flex flex-col gap-2 border-b border-border px-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1 -mb-px overflow-x-auto [scrollbar-width:none]" role="tablist">
              {[['history', 'History'], ['bills', `Purchases · ${bills.length}`], ['payments', `Payments · ${paymentRows.length}`], ['custom', `Custom bills · ${account.customBills.length}`], ['products', `Products · ${supplied.length}`]].map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn('h-11 px-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors', tab === k ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>{l}</button>
              ))}
            </div>
            <div className="pb-2 sm:pb-0"><PeriodPicker {...{ period, setPeriod, from, setFrom, to, setTo }} /></div>
          </div>
          <div className="p-4">
            {tab === 'history' && <>
              <p className="mb-2 text-xs text-muted-foreground">Tap any entry to see it in full, edit, delete or cancel it.</p>
              <HistoryList rows={history.rows} opening={history.opening} start={start} kind="vendor" onOpen={openLedger} label={(r) => (r.type === 'Payment' ? 'Payment' : r.ref || r.type)} />
            </>}
            {tab === 'bills' && (
              <ul className="divide-y divide-border/60">
                {bills.length === 0 && <li className="py-12 text-center text-sm text-muted-foreground">No purchases{start ? ' in this period' : ''}.</li>}
                {bills.map((b) => (
                  <li key={b.id}><button type="button" onClick={() => setEntry({ kind: 'purchase', id: b.id })} className="group w-full flex items-center gap-3 py-3 text-left rounded-lg hover:bg-muted/40 -mx-2 px-2">
                    <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-foreground">{b.no}</span><span className="block text-xs text-muted-foreground tabular-nums">{fmtDayTime(b.date_created)}{b.lines.length ? ` · ${b.lines.length} item${b.lines.length === 1 ? '' : 's'}` : ''}</span></span>
                    <StateChip state={b.state} />
                    <span className="w-28 text-right"><span className="block text-sm font-semibold tabular-nums text-foreground">{rs(b.total)}</span>{b.remaining > 0.5 && <span className="block text-[11px] tabular-nums text-rose-700 dark:text-rose-400">{rs(b.remaining)} due</span>}</span>
                    <ChevronRight size={15} className="text-muted-foreground/40 group-hover:text-foreground" />
                  </button></li>
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
                        <span className="h-9 w-9 rounded-full bg-rose-500/10 text-rose-600 inline-flex items-center justify-center shrink-0"><ArrowUpRight size={16} /></span>
                        <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-foreground">{isLinked(p) ? `For ${billNo(p.purchase_id)}` : 'General / advance payment'}{p.payment_group && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">smart pay</span>}</span><span className="block text-xs text-muted-foreground truncate tabular-nums">{fmtDayTime(p.date_created || p.date_added)}{acc ? ` · ${acc.name}` : ''}{p.notes ? ` · ${p.notes}` : ''}</span></span>
                        <span className="text-sm font-semibold tabular-nums text-foreground">{rs(p.amount)}</span>
                      </button>
                      <button type="button" onClick={() => setEditPay(p)} className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Edit payment" title="Edit payment"><PencilLine size={14} /></button>
                      <button type="button" onClick={() => deletePayment(p)} className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10" aria-label="Delete payment" title="Delete payment"><Trash2 size={14} /></button>
                    </li>
                  );
                })}
              </ul>
            )}
            {tab === 'custom' && (
              account.customBills.length === 0 ? (
                <div className="py-12 text-center"><p className="text-sm text-muted-foreground">No custom bills with this vendor.</p><button type="button" onClick={() => setBillsOpen(true)} className="mt-3 h-9 px-4 rounded-lg border border-border text-sm font-medium inline-flex items-center gap-2 hover:bg-muted"><Plus size={15} /> New custom bill</button></div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {account.customBills.map((k) => (
                    <li key={k.id}><button type="button" onClick={() => setBillsOpen(true)} className="group w-full flex items-center gap-3 py-3 text-left rounded-lg hover:bg-muted/40 -mx-2 px-2">
                      <span className="h-9 w-9 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 inline-flex items-center justify-center shrink-0"><BookOpen size={15} /></span>
                      <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-foreground truncate">{k.title || k.description || 'Custom bill'}</span><span className="block text-xs text-muted-foreground tabular-nums">{fmtDay(k.date_created || k.created_at)} · {rs(k.total_amount)} · paid {rs(k.paid)}</span></span>
                      {k.remaining > 0.5 ? <span className="text-sm font-semibold tabular-nums text-rose-700 dark:text-rose-400">{rs(k.remaining)} due</span> : <StateChip state="paid" />}
                      <ChevronRight size={15} className="text-muted-foreground/40 group-hover:text-foreground" />
                    </button></li>
                  ))}
                </ul>
              )
            )}
            {tab === 'products' && (
              <ul className="divide-y divide-border/60">
                {supplied.length === 0 && <li className="py-12 text-center text-sm text-muted-foreground">No products are linked to this vendor.</li>}
                {supplied.map((p) => <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm"><span className="flex-1 min-w-0 truncate text-foreground">{p.name}</span><span className="text-xs text-muted-foreground tabular-nums">Cost {rs(p.purchase_price)}</span><span className="w-24 text-right tabular-nums text-foreground">{Number(p.stock || 0).toLocaleString('en-PK')} in stock</span></li>)}
              </ul>
            )}
          </div>
        </section>
      </div>

      <MoneyDialog open={payOpen} onClose={() => setPayOpen(false)} title="Pay vendor" partyName={vendor.name}
        dueLabel={`You owe ${rs(Math.max(0, t.totalDue))}${t.khataDue > 0.5 ? ` · incl. ${rs(t.khataDue)} on custom bills` : ''}`} due={Math.max(0, t.totalDue)} accounts={accounts}
        plan={(amt) => planVendorPayment(account, amt)} onSave={pay} direction="out" advanceLabel="Paid ahead (advance)" />
      <EntrySheet open={!!sheet} onClose={() => setEntry(null)} {...(sheet || {})}>{sheet?.body}</EntrySheet>
      <EditPaymentDialog payment={editPay} onClose={() => setEditPay(null)}
        groupTotal={editPay?.payment_group ? groupOf(editPay).reduce((s, r) => s + (Number(r.amount) || 0), 0) : undefined}
        lockedReason={editLock(editPay)} onSave={(v) => savePaymentEdit(editPay, v)} />
      <AnimatePresence>{billsOpen && <CustomBillsPanel vendor={vendor} onClose={() => setBillsOpen(false)} />}</AnimatePresence>
      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} onError={(e) => showToast(e?.message || 'Something went wrong', 'error')} />
    </div>
  );
}

/* ══ Vendors list ═════════════════════════════════════════════════════════ */
export default function VendorsPage() {
  const navigate = useNavigate();
  const { list, pushEntity, pushBatch } = useDataStore();
  const { showToast } = useToast();
  const [search, setSearch] = useState(''); const [filter, setFilter] = useState('all'); const [openId, setOpenId] = useState(null);
  const [formOpen, setFormOpen] = useState(false); const [editing, setEditing] = useState(null); const [deleting, setDeleting] = useState(null);
  const [showGlobalBills, setShowGlobalBills] = useState(false); const [exportingPDF, setExportingPDF] = useState(false);

  const vendors = list('vendor'); const purchases = list('purchase'); const payments = list('vendor_payment');
  const returns = list('purchase_return'); const khatas = list('vendor_khata'); const khataPayments = list('vendor_khata_payment');

  // Desktop get-vendors: purchase balance + open custom bills
  const rows = useMemo(() => {
    const pb = vendorBalances({ purchases, vendorPayments: payments, purchaseReturns: returns });
    const kb = khataBalances(khatas, khataPayments, 'vendor_id');
    const agg = new Map(vendors.map((v) => [String(v.id), { purchased: 0, paid: 0, last: 0 }]));
    const live = new Set();
    for (const p of purchases) { const a = agg.get(String(p.vendor_id)); if (!a) continue; a.last = Math.max(a.last, ts(p.date_created)); if (isCancelled(p)) continue; live.add(String(p.id)); a.purchased += Number(p.grand_total ?? p.total) || 0; }
    for (const p of payments) { const a = agg.get(String(p.vendor_id)); if (!a) continue; if (p.purchase_id && Number(p.purchase_id) !== 0 && !live.has(String(p.purchase_id))) continue; a.paid += Number(p.amount) || 0; }
    return vendors.map((v) => { const a = agg.get(String(v.id)); return { ...v, ...a, balance: r2((pb.get(String(v.id)) || 0) + (kb.get(String(v.id)) || 0)) }; });
  }, [vendors, purchases, payments, returns, khatas, khataPayments]);

  const counts = useMemo(() => ({ all: rows.length, owing: rows.filter((r) => r.balance > 0.5).length, ahead: rows.filter((r) => r.balance < -0.5).length, settled: rows.filter((r) => Math.abs(r.balance) <= 0.5).length }), [rows]);
  const payable = useMemo(() => rows.filter((r) => r.balance > 0.5).reduce((s, r) => s + r.balance, 0), [rows]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((v) => (!q || v.name?.toLowerCase().includes(q) || String(v.phone || '').includes(q) || String(v.address || '').toLowerCase().includes(q))
      && (filter === 'all' || (filter === 'owing' ? v.balance > 0.5 : filter === 'ahead' ? v.balance < -0.5 : Math.abs(v.balance) <= 0.5)));
  }, [rows, search, filter]);
  const open = rows.find((v) => String(v.id) === String(openId));

  const saveVendor = async (form) => {
    const now = localStamp(); const name = String(form.name || '').trim();
    if (!name) throw new Error('Vendor name is required');
    if (editing) { await pushEntity('vendor', 'update', { ...editing, ...form, name, updated_at: now }); showToast('Vendor updated'); }
    else {
      const created = await pushEntity('vendor', 'create', { name, phone: form.phone || '', email: form.email || '', address: form.address || '', created_at: now, updated_at: now });
      if (created?.id != null) setOpenId(created.id);
      showToast('Vendor added');
    }
  };
  const confirmDelete = async () => {
    const v = deleting; setDeleting(null);
    if (!v || Math.abs(v.balance) > 0.5) return;
    await pushBatch([{ entityType: 'vendor', operation: 'delete', payload: { id: v.id } }]);
    setOpenId(null);
    showToast('Vendor deleted');
  };

  const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const exportPDF = async () => {
    if (exportingPDF || filtered.length === 0) return;
    setExportingPDF(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const st = list('settings')?.[0] || {}; const storeName = st.store_name || st.business_name || 'My Store';
      const body = filtered.map((v) => `<tr><td>${esc(v.name) || '—'}</td><td>${esc(v.phone) || '—'}</td><td>${esc(v.address) || '—'}</td><td class="num">${rs(v.purchased)}</td>
        <td class="num ${v.balance > 0.5 ? 'due' : 'ok'}">${Math.abs(v.balance) <= 0.5 ? 'Settled' : v.balance > 0 ? rs(v.balance) : `${rs(-v.balance)} ahead`}</td></tr>`).join('');
      const owed = filtered.filter((v) => v.balance > 0.5);
      const el = document.createElement('div');
      el.innerHTML = `<style>div{font-family:Arial,sans-serif;font-size:11px;color:#111}h2{font-size:16px;margin:0 0 2px}p.sub{font-size:10px;color:#666;margin:0 0 12px}
          table{width:100%;border-collapse:collapse}th{background:#1e293b;color:#fff;padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em}
          td{padding:6px 10px;border-bottom:1px solid #e2e8f0}.num{text-align:right;font-weight:700}.ok{color:#16a34a}.due{color:#b91c1c}
          .sum{margin-top:14px;padding-top:10px;border-top:2px solid #1e293b;display:flex;gap:24px}.sum b{display:block;font-size:14px}</style>
        <h2>${esc(storeName)} — Vendors</h2><p class="sub">${new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' })} · ${filtered.length} vendors</p>
        <table><thead><tr><th>Vendor</th><th>Phone</th><th>Address</th><th style="text-align:right">Purchased</th><th style="text-align:right">You owe</th></tr></thead><tbody>${body}</tbody></table>
        <div class="sum"><span>Vendors<b>${filtered.length}</b></span><span>You owe<b>${owed.length}</b></span><span>Total payable<b style="color:#b91c1c">${rs(owed.reduce((x, v) => x + v.balance, 0))}</b></span></div>`;
      await html2pdf().set({ margin: 10, filename: `Vendors-${localStamp().slice(0, 10)}.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' } }).from(el).save();
    } catch { showToast('Could not create the PDF', 'error'); }
    finally { setExportingPDF(false); }
  };

  const columns = [
    { key: 'name', label: 'Vendor', sort: (r) => String(r.name || '').toLowerCase(), firstDir: 'asc', render: (r) => (
      <span className="flex items-center gap-3 min-w-0"><Avatar name={r.name} className="h-9 w-9 text-xs" /><span className="min-w-0"><span className="block truncate font-medium text-foreground">{r.name}</span><span className="block truncate text-xs text-muted-foreground tabular-nums">{r.phone || 'No phone'}</span></span></span>
    ) },
    { key: 'address', label: 'Address', className: 'hidden lg:table-cell max-w-[220px]', render: (r) => <span className="block truncate text-muted-foreground">{r.address || '—'}</span> },
    { key: 'purchased', label: 'Purchased', align: 'right', sort: (r) => r.purchased, render: (r) => <span className="text-muted-foreground">{rs(r.purchased)}</span> },
    { key: 'paid', label: 'Paid', align: 'right', className: 'hidden lg:table-cell', sort: (r) => r.paid, render: (r) => <span className="text-muted-foreground">{rs(r.paid)}</span> },
    { key: 'balance', label: 'You owe', align: 'right', mobileRight: true, sort: (r) => r.balance, render: (r) => <Balance value={r.balance} kind="vendor" className="font-semibold tabular-nums text-sm" /> },
    { key: 'last', label: 'Last purchase', align: 'right', className: 'hidden xl:table-cell', sort: (r) => r.last, render: (r) => <span className="text-muted-foreground">{r.last ? fmtDay(new Date(r.last)) : '—'}</span> },
  ];

  return (
    <div className="flex flex-col gap-5">
      {open ? (
        <VendorAccount key={open.id} vendor={open} onBack={() => setOpenId(null)} onEdit={() => { setEditing(open); setFormOpen(true); }} onDelete={() => setDeleting(open)} />
      ) : (
        <>
          <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">Vendors</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">{counts.all.toLocaleString('en-PK')} vendor{counts.all === 1 ? '' : 's'}{counts.owing > 0 && <> · <span className="text-rose-700 dark:text-rose-400 font-medium">you owe {counts.owing === 1 ? '1 vendor' : `${counts.owing} vendors`} {rs(payable)}</span></>}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowGlobalBills(true)} className="h-10 px-3.5 rounded-xl border border-border bg-card text-sm font-medium inline-flex items-center gap-2 hover:bg-muted"><Layers size={15} /> <span className="hidden sm:inline">All custom bills</span><span className="sm:hidden">Bills</span></button>
              <button type="button" onClick={exportPDF} disabled={exportingPDF || !filtered.length} title="Download the vendor list as PDF" aria-label="Download the vendor list as PDF" className="h-10 w-10 shrink-0 rounded-xl border border-border bg-card inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"><FileDown size={15} /></button>
              <button type="button" onClick={() => navigate('/vendor-reports')} className="h-10 px-3.5 rounded-xl border border-border bg-card text-sm font-medium inline-flex items-center gap-2 hover:bg-muted"><BarChart3 size={15} /> Reports</button>
              <button type="button" onClick={() => { setEditing(null); setFormOpen(true); }} className="ml-auto sm:ml-0 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 shadow-sm hover:opacity-95"><Plus size={16} /> Add<span className="hidden sm:inline"> vendor</span></button>
            </div>
          </header>
          <PeopleList rows={filtered} columns={columns} search={search} onSearch={setSearch}
            filters={[['all', 'All', counts.all], ['owing', 'You owe', counts.owing], ['ahead', 'Paid ahead', counts.ahead], ['settled', 'Settled', counts.settled]]}
            filter={filter} onFilter={setFilter} onOpen={(r) => setOpenId(r.id)} defaultSort={{ key: 'balance', dir: 'desc' }}
            emptyIcon={Truck} emptyTitle={vendors.length ? 'No vendor matches' : 'No vendors yet'} emptyHint={vendors.length ? 'Try another search or filter.' : 'Add the suppliers you buy stock from.'}
            searchPlaceholder="Search name, phone or address" />
        </>
      )}

      <VendorFormModal open={formOpen} onClose={() => setFormOpen(false)} onSubmit={saveVendor} vendor={editing} />
      {showGlobalBills && <GlobalCustomBillsOverlay onClose={() => setShowGlobalBills(false)} />}
      <ConfirmDialog confirm={deleting ? {
        title: `Delete ${deleting.name}?`,
        body: Math.abs(deleting.balance) > 0.5 ? `There’s still a balance of ${rs(Math.abs(deleting.balance))}. Settle it before deleting.` : 'Past purchases stay in your records. This can’t be undone.',
        blocked: Math.abs(deleting.balance) > 0.5, cta: 'Delete', action: confirmDelete,
      } : null} onClose={() => setDeleting(null)} />
    </div>
  );
}
