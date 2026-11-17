import { useEffect, useMemo, useState, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, Printer, FileDown, Undo2, MoreHorizontal, PencilLine, Ban, MessageCircle, ChevronRight,
  Receipt, History, FileText, UserRound, Lock,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import EditSaleModal from '../../components/sales/EditSaleModal';
import {
  useSaleRows, useSaleActions, ReturnDialog, CancelSaleDialog, rs, fmtDay, fmtTime, qtyFmt,
} from '../../components/sales/saleActions';
import { parseDate } from '@/lib/customerAccount';
import { getReceiptSettings, printInvoice, downloadInvoicePdf, buildWhatsAppLink } from '../../utils/receipt';

const PERIODS = [['today', 'Today'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['custom', 'Custom']];
function range(period, from, to) {
  const n = new Date();
  const sod = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  if (period === 'today') return [sod, null];
  if (period === 'weekly') return [new Date(sod.getTime() - 6 * 864e5), null];
  if (period === 'monthly') return [new Date(n.getFullYear(), n.getMonth(), 1), null];
  return [from ? new Date(`${from}T00:00:00`) : null, to ? new Date(`${to}T23:59:59`) : null];
}

const isCheque = (m) => /che(q|ck)/i.test(String(m || ''));
const methodTone = (m) => {
  const k = String(m || '').toLowerCase();
  if (isCheque(k)) return 'bg-violet-500/10 text-violet-700 dark:text-violet-300';
  if (/online|bank|card|jazz|easy/.test(k)) return 'bg-sky-500/10 text-sky-700 dark:text-sky-300';
  if (/credit|udhaar|loan/.test(k)) return 'bg-amber-500/12 text-amber-800 dark:text-amber-300';
  return 'bg-muted text-foreground/80';
};

// Desktop: walk-in sales show no payment badge — they're paid at the counter
const BADGE = {
  paid: ['Paid', 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'],
  partial: ['Part paid', 'bg-amber-500/12 text-amber-800 dark:text-amber-400'],
  unpaid: ['Unpaid', 'bg-rose-500/10 text-rose-700 dark:text-rose-400'],
  returned: ['Returned', 'bg-muted text-muted-foreground'],
  cancelled: ['Cancelled', 'bg-muted text-muted-foreground'],
};
const badgeFor = (r) => (!r.customer && (r.state === 'paid')) ? ['Completed', 'bg-muted text-foreground/70'] : BADGE[r.state];

const STATUS_FILTERS = [['all', 'All'], ['paid', 'Paid'], ['partial', 'Part paid'], ['unpaid', 'Unpaid'], ['returned', 'Returned'], ['cancelled', 'Cancelled']];

function IconBtn({ label, onClick, disabled, children, tone }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} disabled={disabled} title={label} aria-label={label}
      className={cn('h-8 w-8 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-35 disabled:pointer-events-none', tone)}>
      {children}
    </button>
  );
}

function RowMenu({ r, canEdit, onEdit, onCancel, onWhatsApp, navigate }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <button type="button" className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`More actions for ${r.no}`}>
          <MoreHorizontal size={16} />
        </button>
      } />
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem disabled={!canEdit} onClick={onEdit} className="h-8 px-2">
          {r.returned > 0 ? <Lock /> : <PencilLine />} Edit sale items
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/invoices')} className="h-8 px-2"><FileText /> Open in Invoices</DropdownMenuItem>
        {r.customer && <DropdownMenuItem onClick={() => navigate(`/customers/${r.customer.id}`)} className="h-8 px-2"><UserRound /> Customer account</DropdownMenuItem>}
        {r.phone && <DropdownMenuItem onClick={onWhatsApp} className="h-8 px-2"><MessageCircle /> Send on WhatsApp</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={r.state === 'cancelled'} onClick={onCancel} className="h-8 px-2"><Ban /> Cancel sale</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Detail({ r }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background">
      <ul className="divide-y divide-border/50 text-sm">
        {r.lines.length === 0 && <li className="px-4 py-3 text-xs text-muted-foreground">Item lines for this sale haven’t synced to the web yet.</li>}
        {r.lines.map((it) => (
          <li key={it.id} className="flex items-center gap-3 px-4 py-2">
            <span className="min-w-0 flex-1 text-foreground">
              {it.product_name}
              {it.returnedQty > 0 && <span className="ml-2 rounded bg-muted px-1.5 py-px text-[10px] font-semibold text-muted-foreground tabular-nums">{qtyFmt(it.returnedQty)} returned</span>}
              <span className="block sm:hidden text-xs text-muted-foreground tabular-nums">{it.view.qty} × {it.view.rate}</span>
            </span>
            <span className="hidden sm:inline text-xs text-muted-foreground tabular-nums whitespace-nowrap">{it.view.qty} × {it.view.rate}</span>
            <span className="shrink-0 sm:w-24 text-right font-medium tabular-nums text-foreground">{rs(it.view.amount)}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-border/70 px-4 py-2.5 text-xs text-muted-foreground tabular-nums">
        <span>{r.party}{r.phone ? ` · ${r.phone}` : ''}</span>
        <span className="flex flex-wrap gap-x-4">
          <span>Paid <b className="font-semibold text-foreground">{rs(r.paid)}</b></span>
          {r.returned > 0 && <span>Returned <b className="font-semibold text-foreground">{rs(r.returned)}</b></span>}
          {r.writeOff > 0 && <span>Written off <b className="font-semibold text-foreground">{rs(r.writeOff)}</b></span>}
          {r.remaining > 0.5 && <span className="text-amber-700 dark:text-amber-400">Due <b className="font-semibold">{rs(r.remaining)}</b></span>}
        </span>
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  const navigate = useNavigate();
  const { list } = useDataStore();
  const { showToast } = useToast();
  const { user } = useAuth();
  const rows = useSaleRows();
  const { cancelSale, saveEdit } = useSaleActions();

  const [period, setPeriod] = useState('today');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [shown, setShown] = useState(50);
  const [openKey, setOpenKey] = useState(null);
  const [returning, setReturning] = useState(null);
  const [editing, setEditing] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  const store = useMemo(() => {
    const local = getReceiptSettings(); const synced = list('settings')?.[0] || {};
    return {
      store_name: local.store_name || synced.store_name || user?.store_name || 'My Store',
      store_address: local.store_address || synced.store_address || '',
      store_phone: local.store_phone || synced.store_phone || '',
    };
  }, [list, user]);

  const inPeriod = useMemo(() => {
    const [start, end] = range(period, from, to);
    return rows.filter((r) => { const d = parseDate(r.date); if (!d) return !start && !end; return (!start || d >= start) && (!end || d <= end); });
  }, [rows, period, from, to]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inPeriod.filter((r) => (status === 'all' || r.state === status) && (!q || r.search.includes(q)));
  }, [inPeriod, status, search]);
  useEffect(() => setShown(50), [period, from, to, search, status]);

  // Same figures as the desktop's Transactions header, for the chosen period
  const kpi = useMemo(() => {
    const live = inPeriod.filter((r) => r.state !== 'cancelled' && r.state !== 'returned');
    const cheques = inPeriod.filter((r) => r.state !== 'cancelled' && isCheque(r.method));
    return {
      completed: live.length,
      revenue: live.reduce((s, r) => s + Math.max(0, r.total - r.returned), 0),
      discounts: inPeriod.filter((r) => r.state !== 'cancelled').reduce((s, r) => s + r.discount, 0),
      pending: inPeriod.reduce((s, r) => s + r.remaining, 0),
      pendingCount: inPeriod.filter((r) => r.remaining > 0.5).length,
      chequeCount: cheques.length, chequeTotal: cheques.reduce((s, r) => s + r.total, 0),
    };
  }, [inPeriod]);

  const invoiceData = (r) => {
    const settings = getReceiptSettings();
    return {
      saleId: r.id, items: r.lines.map((i) => ({ name: i.product_name, qty: Number(i.quantity), price: Number(i.price), lineTotal: i.view.amount })),
      subtotal: r.subtotal, discount: r.discount, total: r.total, paymentMethod: r.method || 'cash',
      settings: { ...settings, ...store }, date: `${fmtDay(r.date)} ${fmtTime(r.date)}`,
      customerName: r.customer?.name, customerPhone: r.customer?.phone, amountPaid: r.paid, balance: r.remaining,
    };
  };
  const pdf = async (r) => { try { await downloadInvoicePdf(invoiceData(r)); } catch { showToast('Could not create the PDF', 'error'); } };
  const doCancel = async () => {
    const r = cancelling; setCancelling(null);
    if (r) { try { await cancelSale(r); } catch (e) { showToast(e?.message || 'Could not cancel', 'error'); } }
  };
  const live = (r) => r.state !== 'cancelled';
  const canReturn = (r) => live(r) && r.state !== 'returned' && r.lines.length > 0;
  const canEdit = (r) => live(r) && r.state !== 'returned' && r.returned <= 0 && r.lines.length > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">Transactions</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Every sale with its payment, returns and actions</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-border bg-card p-1" role="tablist" aria-label="Period">
            {PERIODS.map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={period === k} onClick={() => setPeriod(k)}
                className={cn('h-8 px-3 rounded-lg text-sm font-medium transition-colors', period === k ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>{l}</button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" className="h-10 rounded-xl border border-border bg-card px-2.5 text-sm" />
              <span className="text-muted-foreground text-sm">to</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" className="h-10 rounded-xl border border-border bg-card px-2.5 text-sm" />
            </div>
          )}
        </div>
      </header>

      {/* Figures */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 sm:grid-cols-3 xl:grid-cols-6">
        {[
          ['Completed sales', kpi.completed.toLocaleString('en-PK'), 'Not returned or cancelled'],
          ['Net revenue', rs(kpi.revenue), 'After returns'],
          ['Discounts', rs(kpi.discounts), 'Given on these sales'],
          ['Pending loans', rs(kpi.pending), `${kpi.pendingCount} sale${kpi.pendingCount === 1 ? '' : 's'} not fully paid`, kpi.pending > 0.5 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'],
          ['Cheques received', kpi.chequeCount.toLocaleString('en-PK'), 'Sales paid by cheque'],
          ['Cheque amount', rs(kpi.chequeTotal), 'Total of those sales'],
        ].map(([l, v, sub, tone]) => (
          <div key={l} className="bg-card px-4 py-3.5 min-w-0">
            <dt className="text-xs text-muted-foreground">{l}</dt>
            <dd className={cn('mt-1 text-lg font-bold tabular-nums tracking-tight text-foreground truncate', tone)}>{v}</dd>
            <dd className="text-[11px] text-muted-foreground truncate">{sub}</dd>
          </div>
        ))}
      </dl>

      {/* Table */}
      <section className="rounded-2xl border border-border/70 bg-card overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b border-border/70 p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 min-w-0 sm:max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice no, customer, method or item" aria-label="Search transactions"
              className="w-full h-10 rounded-xl border border-border bg-background pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary" />
            {search && <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded inline-flex items-center justify-center text-muted-foreground hover:bg-muted" aria-label="Clear search"><X size={14} /></button>}
          </div>
          <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] sm:ml-auto">
            {STATUS_FILTERS.map(([k, l]) => (
              <button key={k} type="button" onClick={() => setStatus(k)}
                className={cn('h-7 shrink-0 rounded-full px-2.5 text-xs font-medium border transition-colors',
                  status === k ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground')}>{l}</button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Receipt size={20} className="mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{inPeriod.length ? 'No sale matches' : `No sales ${period === 'today' ? 'today yet' : 'in this period'}`}</p>
            <p className="mt-1 text-xs text-muted-foreground">{inPeriod.length ? 'Try another search or status.' : 'Pick another period to see older sales.'}</p>
          </div>
        ) : (
          <>
            {/* Wide screens: the desktop's columns */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    <th className="w-8" />
                    <th className="py-2.5 pr-3 font-medium">Invoice no</th>
                    <th className="py-2.5 pr-3 font-medium">Date &amp; time</th>
                    <th className="py-2.5 pr-3 font-medium">Customer &amp; items</th>
                    <th className="py-2.5 pr-3 font-medium">Method</th>
                    <th className="py-2.5 pr-3 font-medium">Status</th>
                    <th className="py-2.5 px-3 font-medium text-right hidden xl:table-cell">Subtotal</th>
                    <th className="py-2.5 px-3 font-medium text-right hidden xl:table-cell">Disc.</th>
                    <th className="py-2.5 px-3 font-medium text-right">Total</th>
                    <th className="py-2.5 pr-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, shown).map((r) => {
                    const open = openKey === r.key; const [bl, bc] = badgeFor(r);
                    return (
                      <Fragment key={r.key}>
                        <tr onClick={() => setOpenKey(open ? null : r.key)} className={cn('border-b border-border/50 cursor-pointer transition-colors', open ? 'bg-muted/40' : 'hover:bg-muted/30', r.state === 'cancelled' && 'opacity-60')}>
                          <td className="pl-3"><ChevronRight size={15} className={cn('text-muted-foreground transition-transform', open && 'rotate-90')} /></td>
                          <td className="py-3 pr-3 whitespace-nowrap">
                            <span className="font-medium text-foreground tabular-nums">{r.no}</span>
                            {r.edited && <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-sky-500/10 px-1 py-px text-[10px] font-semibold text-sky-700 dark:text-sky-300" title={`Edited ${fmtDay(r.raw.edited_at)}`}><History size={9} /> Edited</span>}
                          </td>
                          <td className="py-3 pr-3 whitespace-nowrap tabular-nums"><span className="text-foreground">{fmtDay(r.date)}</span><span className="block text-xs text-muted-foreground">{fmtTime(r.date)}</span></td>
                          <td className="py-3 pr-3 max-w-[320px]">
                            <span className="block truncate font-medium text-foreground">{r.party}</span>
                            <span className="block truncate text-xs text-muted-foreground" title={r.itemsSummary}>{r.itemsSummary || '—'}</span>
                          </td>
                          <td className="py-3 pr-3">{r.method && <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-semibold capitalize', methodTone(r.method))}>{String(r.method).toLowerCase()}</span>}</td>
                          <td className="py-3 pr-3 whitespace-nowrap">
                            <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-semibold', bc)}>{bl}</span>
                            {r.state === 'partial' && <span className="block mt-0.5 text-[11px] text-amber-700 dark:text-amber-400 tabular-nums">{rs(r.remaining)} due</span>}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-muted-foreground hidden xl:table-cell">{rs(r.subtotal)}</td>
                          <td className="py-3 px-3 text-right tabular-nums text-muted-foreground hidden xl:table-cell">{r.discount > 0 ? rs(r.discount) : '—'}</td>
                          <td className={cn('py-3 px-3 text-right font-semibold tabular-nums whitespace-nowrap text-foreground', r.state === 'cancelled' && 'line-through')}>{rs(r.total)}</td>
                          <td className="py-2 pr-2" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end">
                              <IconBtn label="Print receipt" onClick={() => printInvoice(invoiceData(r))}><Printer size={15} /></IconBtn>
                              <IconBtn label="Save PDF" onClick={() => pdf(r)}><FileDown size={15} /></IconBtn>
                              <IconBtn label="Return items" onClick={() => setReturning(r)} disabled={!canReturn(r)}><Undo2 size={15} /></IconBtn>
                              <RowMenu r={r} canEdit={canEdit(r)} onEdit={() => setEditing(r)} onCancel={() => setCancelling(r)} onWhatsApp={() => window.open(buildWhatsAppLink(invoiceData(r)), '_blank', 'noopener')} navigate={navigate} />
                            </div>
                          </td>
                        </tr>
                        {open && <tr className="bg-muted/40 border-b border-border/50"><td /><td colSpan={9} className="pb-3 pr-4"><Detail r={r} /></td></tr>}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Phones: cards */}
            <ul className="md:hidden divide-y divide-border/60">
              {filtered.slice(0, shown).map((r) => {
                const open = openKey === r.key; const [bl, bc] = badgeFor(r);
                return (
                  <li key={r.key} className={cn('px-4 py-3', r.state === 'cancelled' && 'opacity-60')}>
                    <button type="button" onClick={() => setOpenKey(open ? null : r.key)} className="flex w-full items-start gap-3 text-left" aria-expanded={open}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{r.party}</span>
                        <span className="block truncate text-xs text-muted-foreground tabular-nums">{r.no} · {fmtTime(r.date)}{period !== 'today' ? ` · ${fmtDay(r.date)}` : ''}</span>
                        <span className="mt-1 flex flex-wrap gap-1">
                          <span className={cn('rounded px-1.5 py-px text-[10px] font-semibold', bc)}>{bl}</span>
                          {r.method && <span className={cn('rounded px-1.5 py-px text-[10px] font-semibold capitalize', methodTone(r.method))}>{String(r.method).toLowerCase()}</span>}
                          {r.edited && <span className="rounded bg-sky-500/10 px-1.5 py-px text-[10px] font-semibold text-sky-700 dark:text-sky-300">Edited</span>}
                        </span>
                      </span>
                      <span className="text-right shrink-0">
                        <span className={cn('block text-sm font-semibold tabular-nums text-foreground', r.state === 'cancelled' && 'line-through')}>{rs(r.total)}</span>
                        {r.remaining > 0.5 && <span className="block text-[11px] text-amber-700 dark:text-amber-400 tabular-nums">{rs(r.remaining)} due</span>}
                      </span>
                    </button>
                    {open && (
                      <div className="mt-3 grid gap-2">
                        <Detail r={r} />
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => printInvoice(invoiceData(r))} className="h-9 flex-1 rounded-lg border border-border text-xs font-medium inline-flex items-center justify-center gap-1.5"><Printer size={14} /> Print</button>
                          <button type="button" onClick={() => pdf(r)} className="h-9 flex-1 rounded-lg border border-border text-xs font-medium inline-flex items-center justify-center gap-1.5"><FileDown size={14} /> PDF</button>
                          <button type="button" onClick={() => setReturning(r)} disabled={!canReturn(r)} className="h-9 flex-1 rounded-lg border border-border text-xs font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-40"><Undo2 size={14} /> Return</button>
                          <RowMenu r={r} canEdit={canEdit(r)} onEdit={() => setEditing(r)} onCancel={() => setCancelling(r)} onWhatsApp={() => window.open(buildWhatsAppLink(invoiceData(r)), '_blank', 'noopener')} navigate={navigate} />
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between gap-3 border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">
              <span className="tabular-nums">Showing {Math.min(shown, filtered.length).toLocaleString('en-PK')} of {filtered.length.toLocaleString('en-PK')}</span>
              {filtered.length > shown && <button type="button" onClick={() => setShown((n) => n + 50)} className="h-8 px-3 rounded-lg border border-border font-medium hover:text-foreground">Show more</button>}
            </div>
          </>
        )}
      </section>

      {returning && <ReturnDialog row={returning} onClose={() => setReturning(null)} />}
      <EditSaleModal open={!!editing} onClose={() => setEditing(null)} sale={editing?.raw} items={editing?.lines || []} products={list('product')} onSave={(p) => saveEdit(editing, p)} />
      <CancelSaleDialog row={cancelling} onClose={() => setCancelling(null)} onConfirm={doCancel} />
    </div>
  );
}
