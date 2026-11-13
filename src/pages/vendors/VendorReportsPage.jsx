import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, TrendingUp, Package, Wallet, ShoppingCart, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { isCancelled, vendorBalances, khataBalances } from '@/lib/ledger';

const fmtPKR  = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const RANGES = [
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 90 Days', days: 90 },
  { label: 'Last Year',    days: 365 },
  { label: 'All Time',     days: Infinity },
];

export default function VendorReportsPage() {
  const navigate = useNavigate();
  const { list } = useDataStore();
  const [range, setRange]   = useState(RANGES[1]);
  const [search, setSearch] = useState('');

  const cutoff = range.days === Infinity ? null : new Date(Date.now() - range.days * 86_400_000);

  const vendors    = list('vendor');
  const purchases  = list('purchase');
  const payments   = list('vendor_payment');
  const khataPayments = list('vendor_khata_payment');
  const purchaseReturns = list('purchase_return');
  const vendorKhatas = list('vendor_khata');

  const stats = useMemo(() => {
    // Outstanding = desktop get-vendors rule + open custom bills (vendors carry no stored balance).
    const balByV = vendorBalances({ purchases, vendorPayments: payments, purchaseReturns });
    const khataByV = khataBalances(vendorKhatas, khataPayments, 'vendor_id');
    const khataVendor = new Map(vendorKhatas.map((k) => [String(k.id), String(k.vendor_id)]));
    return vendors
      .map((v) => {
        const vid = String(v.id);
        const vPurchases = purchases.filter((p) => String(p.vendor_id) === vid && (!cutoff || new Date(p.date_created || 0) >= cutoff));
        const vPayments  = payments.filter((p) => String(p.vendor_id) === vid);
        const vKhata     = khataPayments.filter((p) => khataVendor.get(String(p.khata_id)) === vid);
        const totalSpend    = vPurchases.filter((p) => !isCancelled(p)).reduce((s, p) => s + Number(p.grand_total || p.total || 0), 0);
        const totalPaid     = [...vPayments, ...vKhata].reduce((s, p) => s + Number(p.amount || 0), 0);
        const outstanding   = Math.max(0, (balByV.get(vid) || 0) + (khataByV.get(vid) || 0));
        const lastPurchase  = vPurchases.sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0))[0];
        return {
          ...v,
          totalSpend,
          totalPaid,
          outstanding,
          purchaseCount: vPurchases.length,
          lastPurchase: lastPurchase?.date_created,
        };
      })
      .filter((v) => v.totalSpend > 0 || v.outstanding > 0 || v.purchaseCount > 0)
      .sort((a, b) => b.totalSpend - a.totalSpend);
  }, [vendors, purchases, payments, khataPayments, purchaseReturns, vendorKhatas, cutoff]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return stats;
    return stats.filter((v) => v.name.toLowerCase().includes(q) || (v.phone || '').includes(q));
  }, [stats, search]);

  const totalSpend  = stats.reduce((s, v) => s + v.totalSpend, 0);
  const totalOwed   = stats.reduce((s, v) => s + v.outstanding, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/vendors')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={14} /> Vendors
        </button>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm font-semibold">Vendor Reports</span>
      </div>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Vendor Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Spending breakdown and outstanding balances per vendor</p>
        </div>
        {/* Range picker */}
        <div className="flex rounded-xl overflow-hidden border border-border bg-muted/30">
          {RANGES.map((r) => (
            <button key={r.label} onClick={() => setRange(r)}
              className={cn('h-9 px-3 text-xs font-semibold transition-colors', range === r ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Vendors',  value: stats.length,         color: 'text-foreground',  icon: Package },
          { label: 'Total Spend',     value: fmtPKR(totalSpend),   color: 'text-foreground',  icon: ShoppingCart },
          { label: 'Total Owed',      value: fmtPKR(totalOwed),    color: 'text-rose-600',    icon: Wallet },
          { label: 'All Vendors',     value: vendors.length,       color: 'text-primary',     icon: BarChart3 },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-border bg-card px-5 py-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Icon size={13} /><span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
            </div>
            <p className={cn('text-xl font-black tabular-nums', color)}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendor…"
          className="h-9 w-full pl-8 pr-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </div>

      {/* Vendor rows */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground/40">
            <BarChart3 size={36} />
            <p className="text-sm">No vendor data for this period</p>
          </div>
        ) : (
          <>
            {/* Column header */}
            <div className="hidden sm:grid grid-cols-[1fr_120px_120px_120px_100px] gap-3 px-5 py-3 border-b border-border bg-muted/20 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <span>Vendor</span>
              <span className="text-right">Spend ({range.label})</span>
              <span className="text-right">Outstanding</span>
              <span className="text-right">Orders</span>
              <span className="text-right">Last Order</span>
            </div>
            <div className="divide-y divide-border/50">
              {filtered.map((v, idx) => (
                <button key={v.id} onClick={() => navigate(`/vendors/${v.id}`)}
                  className="w-full flex flex-col sm:grid sm:grid-cols-[1fr_120px_120px_120px_100px] gap-2 sm:gap-3 items-start sm:items-center px-5 py-4 hover:bg-muted/20 transition-colors text-left">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Rank badge */}
                    <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0',
                      idx === 0 ? 'bg-amber-400/20 text-amber-600' : idx === 1 ? 'bg-slate-400/20 text-slate-600' : idx === 2 ? 'bg-orange-400/20 text-orange-600' : 'bg-muted text-muted-foreground')}>
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{v.name}</p>
                      {v.phone && <p className="text-[10px] text-muted-foreground">{v.phone}</p>}
                    </div>
                  </div>
                  <div className="flex sm:contents gap-4 text-sm pl-10 sm:pl-0 flex-wrap">
                    <div className="sm:text-right">
                      <span className="sm:hidden text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Spend</span>
                      <p className="font-black tabular-nums">{fmtPKR(v.totalSpend)}</p>
                    </div>
                    <div className="sm:text-right">
                      <span className="sm:hidden text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Outstanding</span>
                      <p className={cn('font-bold tabular-nums text-sm', v.outstanding > 0 ? 'text-rose-600' : 'text-muted-foreground')}>{fmtPKR(v.outstanding)}</p>
                    </div>
                    <div className="sm:text-right">
                      <span className="sm:hidden text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Orders</span>
                      <p className="font-bold text-sm">{v.purchaseCount}</p>
                    </div>
                    <div className="sm:text-right">
                      <span className="sm:hidden text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Last Order</span>
                      <p className="text-xs text-muted-foreground">{fmtDate(v.lastPurchase)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">{filtered.length} vendor{filtered.length !== 1 ? 's' : ''}</p>
    </div>
  );
}
