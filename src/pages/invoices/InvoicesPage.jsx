import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ShoppingCart, Package, Search, SlidersHorizontal, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { isCancelled } from '@/lib/ledger';

const fmtPKR  = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const STATUS_OPTS = ['All', 'Completed', 'Partial', 'Unpaid', 'Cancelled'];

function saleStatusLabel(sale) {
  if (isCancelled(sale)) return 'Cancelled';
  const rem = Number(sale.remaining ?? sale.due_amount ?? (Number(sale.total || 0) - Number(sale.amount_paid || sale.amountPaid || 0)));
  if (rem <= 0.5)  return 'Completed';
  if (Number(sale.amount_paid || sale.amountPaid || 0) > 0) return 'Partial';
  return 'Unpaid';
}

const STATUS_STYLE = {
  Completed:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  Partial:    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  Unpaid:     'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400',
  Cancelled:  'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  PO:         'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  Received:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
};

export default function InvoicesPage() {
  const navigate = useNavigate();
  const { list } = useDataStore();
  const [type, setType]       = useState('all');
  const [status, setStatus]   = useState('All');
  const [search, setSearch]   = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const customers = useMemo(() => {
    const m = {};
    for (const c of list('customer')) m[String(c.id)] = c.name;
    return m;
  }, [list]);

  const vendors = useMemo(() => {
    const m = {};
    for (const v of list('vendor')) m[String(v.id)] = v.name;
    return m;
  }, [list]);

  const rows = useMemo(() => {
    const sales = (type === 'purchase' ? [] : list('sale')).map((s) => {
      const sl = saleStatusLabel(s);
      return {
        _type: 'sale',
        id: s.id,
        ref: `INV #${s.id}`,
        party: customers[String(s.customer_id)] || 'Walk-in',
        date: s.date_created,
        total: Number(s.total || 0),
        status: sl,
        raw: s,
      };
    });

    const purchases = (type === 'sale' ? [] : list('purchase')).map((p) => ({
      _type: 'purchase',
      id: p.id,
      ref: `PO #${p.id}`,
      party: vendors[String(p.vendor_id)] || 'Unknown Vendor',
      date: p.date_created,
      total: Number(p.total || 0),
      status: p.status || 'PO',
      raw: p,
    }));

    let merged = [...sales, ...purchases].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    if (status !== 'All') merged = merged.filter((r) => r.status === status);

    const q = search.toLowerCase();
    if (q) merged = merged.filter((r) => r.ref.toLowerCase().includes(q) || r.party.toLowerCase().includes(q));

    return merged;
  }, [list, type, status, search, customers, vendors]);

  const totalSales     = list('sale').length;
  const totalPurchases = list('purchase').length;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All sales invoices and purchase orders</p>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Sales Invoices',   value: totalSales,     color: 'text-foreground',    icon: ShoppingCart },
          { label: 'Purchase Orders',  value: totalPurchases, color: 'text-blue-600',       icon: Package },
          { label: 'Total Documents',  value: totalSales + totalPurchases, color: 'text-foreground', icon: FileText },
          { label: 'Showing Now',      value: rows.length,    color: 'text-primary',        icon: FileText },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-border bg-card px-5 py-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Icon size={13} /><span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
            </div>
            <p className={cn('text-2xl font-black tabular-nums', color)}>{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Filters bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Type toggle */}
        <div className="flex rounded-xl overflow-hidden border border-border bg-muted/30">
          {[['all', 'All'], ['sale', 'Sales'], ['purchase', 'Purchases']].map(([v, l]) => (
            <button key={v} onClick={() => setType(v)}
              className={cn('h-9 px-4 text-sm font-semibold transition-colors', type === v ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
              {l}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ref or party…"
            className="h-9 w-full pl-8 pr-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>

        {/* Status filter toggle */}
        <button onClick={() => setShowFilters(!showFilters)}
          className={cn('flex items-center gap-1.5 h-9 px-3 rounded-xl border text-sm font-medium transition-colors', showFilters ? 'border-primary/50 bg-primary/5 text-primary' : 'border-border hover:bg-muted')}>
          <SlidersHorizontal size={14} /> Filters
        </button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTS.map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={cn('h-8 px-3 rounded-full text-xs font-semibold border transition-colors', status === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted')}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground/40">
            <FileText size={36} />
            <p className="text-sm">No invoices match this filter</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {rows.map((row) => (
              <button key={`${row._type}-${row.id}`}
                onClick={() => row._type === 'sale' ? navigate(`/customers/${row.raw.customer_id}`) : navigate('/purchases')}
                className="w-full flex items-center px-5 py-3.5 hover:bg-muted/30 transition-colors text-left gap-4">
                {/* Type icon */}
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', row._type === 'sale' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blue-500/10 text-blue-600')}>
                  {row._type === 'sale' ? <ShoppingCart size={15} /> : <Package size={15} />}
                </div>
                {/* Ref + party */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black font-mono">{row.ref}</span>
                    <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full', STATUS_STYLE[row.status] || 'bg-muted text-muted-foreground')}>{row.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{row.party}</p>
                </div>
                {/* Amount + date */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-black tabular-nums">{fmtPKR(row.total)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(row.date)}</p>
                </div>
                <ChevronRight size={14} className="text-muted-foreground/40 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">{rows.length} record{rows.length !== 1 ? 's' : ''}</p>
    </div>
  );
}
