import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  BarChart3, DollarSign, TrendingDown, TrendingUp, ShoppingCart,
  Boxes, Package2, Percent, RefreshCw, AlertCircle, AlertTriangle,
  Users, Truck, Receipt, ChevronDown, ChevronUp, CloudOff,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { useMfgAuth } from '../../context/ManufacturingAuthContext';
import { mfgGetReports } from '../../api/manufacturingApi';

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmt    = n  => `Rs. ${Math.round(n || 0).toLocaleString()}`;
const fmtPct = n  => `${Number(n || 0).toFixed(1)}%`;
const shortDate = iso => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' });
};

// ─── period helpers ───────────────────────────────────────────────────────────
const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom',label: 'Custom' },
];

function periodDates(key) {
  const today = new Date().toISOString().slice(0, 10);
  if (key === 'today') return { start: today, end: today };
  if (key === 'week') {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return { start: d.toISOString().slice(0, 10), end: today };
  }
  if (key === 'month') {
    const d = new Date(); d.setDate(1);
    return { start: d.toISOString().slice(0, 10), end: today };
  }
  return { start: today, end: today };
}

// ─── mini stat card ───────────────────────────────────────────────────────────
function StatCard({ icon: Icon, iconBg, iconColor, label, value, sub }) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-start gap-3">
      <div className={`mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon size={17} className={iconColor} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-lg font-bold leading-tight truncate">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ─── stock row ────────────────────────────────────────────────────────────────
function StockRow({ name, stock, threshold, price, unit, category }) {
  const low = stock <= threshold;
  return (
    <TableRow>
      <TableCell className="font-medium text-sm">{name}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{category || '—'}</TableCell>
      <TableCell>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
          low ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
        }`}>
          {low && <AlertTriangle size={10} />}
          {stock} {unit || 'pc'}
        </span>
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">{price > 0 ? fmt(price) : '—'}</TableCell>
    </TableRow>
  );
}

// ─── custom tooltip ───────────────────────────────────────────────────────────
function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover p-2.5 shadow-md text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' && p.value > 100 ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

const PL_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

// ─── main page ────────────────────────────────────────────────────────────────
export default function ManufacturingReports() {
  const { mfgUser } = useMfgAuth();

  const [activeTab,   setActiveTab]   = useState('overview');
  const [period,      setPeriod]      = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd,   setCustomEnd]   = useState('');
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = period === 'custom' && customStart
        ? { start_date: customStart, end_date: customEnd || customStart }
        : { period };
      const res = await mfgGetReports(params);
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [period, customStart, customEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const ov = data?.overview;
  const trendData = useMemo(() =>
    (ov?.revenue_trend || []).map(d => ({
      date:    shortDate(d.date),
      Revenue: d.revenue,
      Orders:  d.orders,
    })), [ov]);

  const plData = [
    { name: 'Revenue',  value: ov?.revenue     ?? 0 },
    { name: 'COGS',     value: ov?.cogs         ?? 0 },
    { name: 'Expenses', value: ov?.expenses     ?? 0 },
    { name: 'Profit',   value: ov?.net_profit   ?? 0 },
  ];

  // ── header date badge ─────────────────────────────────────────────────────
  const { start, end } = period === 'custom'
    ? { start: customStart, end: customEnd }
    : periodDates(period);
  const dateLabel = start === end ? shortDate(start) : `${shortDate(start)} – ${shortDate(end)}`;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 p-5 md:p-7 max-w-6xl mx-auto">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 size={22} className="text-indigo-500" /> Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Financial overview, stock, vendors, customers, and expenses
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={fetchData} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      {/* Tabs + period filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
        {/* Tab nav */}
        <div className="flex gap-0 rounded-lg border overflow-hidden bg-muted/30">
          {[
            { key: 'overview',   label: 'Overview',   icon: BarChart3 },
            { key: 'stock',      label: 'Stock',      icon: Package2 },
            { key: 'vendors',    label: 'Vendors',    icon: Truck },
            { key: 'customers',  label: 'Customers',  icon: Users },
            { key: 'expenses',   label: 'Expenses',   icon: Receipt },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === t.key
                  ? 'bg-white dark:bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>

        {/* Period filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                period === p.key
                  ? 'bg-indigo-600 text-white'
                  : 'border text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {p.label}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-1.5 mt-1 sm:mt-0">
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-7 text-xs w-36" />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-7 text-xs w-36" />
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && !loading && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertCircle size={15} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <Button size="sm" variant="ghost" className="text-red-700 h-7 px-2" onClick={fetchData}>Retry</Button>
        </div>
      )}

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-4">

          {/* Dark profit hero banner */}
          <div
            className="rounded-2xl overflow-hidden px-7 py-6 text-white"
            style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #1e3a5f 100%)' }}
          >
            {loading ? (
              <div className="flex gap-8 items-center">
                <div>
                  <div className="h-3 w-32 rounded bg-white/20 mb-3 animate-pulse" />
                  <div className="h-10 w-48 rounded bg-white/20 mb-2 animate-pulse" />
                  <div className="h-3 w-40 rounded bg-white/10 animate-pulse" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                  <p className="text-xs font-semibold tracking-widest uppercase text-white/50 mb-2">Net Profit this period</p>
                  <p className="text-4xl font-black leading-none mb-2" style={{ color: (ov?.net_profit ?? 0) >= 0 ? '#4ade80' : '#f87171' }}>
                    {fmt(ov?.net_profit ?? 0)}
                  </p>
                  <p className="text-sm text-white/60">
                    {fmtPct(ov?.margin_pct ?? 0)} margin · {fmt(ov?.revenue ?? 0)} revenue
                  </p>
                </div>
                <div className="flex gap-8 sm:gap-10 shrink-0">
                  {[
                    { label: 'Gross Profit', value: fmt(ov?.net_profit ?? 0) },
                    { label: 'COGS',         value: fmt(ov?.cogs       ?? 0) },
                    { label: 'Expenses',     value: fmt(ov?.expenses   ?? 0) },
                  ].map(c => (
                    <div key={c.label} className="text-right">
                      <p className="text-xs text-white/50 mb-1">{c.label}</p>
                      <p className="text-base font-bold">{c.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Stat cards row 1 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={DollarSign}   iconBg="bg-green-100 dark:bg-green-900/30"   iconColor="text-green-600"
              label="Revenue"    value={loading ? '—' : fmt(ov?.revenue ?? 0)}   sub={loading ? null : `${ov?.orders_count ?? 0} orders`} />
            <StatCard icon={TrendingDown} iconBg="bg-amber-100 dark:bg-amber-900/30"   iconColor="text-amber-600"
              label="COGS"       value={loading ? '—' : fmt(ov?.cogs    ?? 0)}   sub={loading ? null : `${fmtPct(ov?.cogs_pct ?? 0)} of revenue`} />
            <StatCard icon={Receipt}      iconBg="bg-red-100 dark:bg-red-900/30"        iconColor="text-red-500"
              label="Expenses"   value={loading ? '—' : fmt(ov?.expenses ?? 0)}  sub="Not synced to cloud" />
            <StatCard icon={TrendingUp}   iconBg="bg-violet-100 dark:bg-violet-900/30" iconColor="text-violet-600"
              label="Net Profit" value={loading ? '—' : fmt(ov?.net_profit ?? 0)} sub={loading ? null : `${fmtPct(ov?.margin_pct ?? 0)} margin`} />
          </div>

          {/* Stat cards row 2 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={ShoppingCart} iconBg="bg-blue-100 dark:bg-blue-900/30"   iconColor="text-blue-600"
              label="Avg Order"      value={loading ? '—' : fmt(ov?.avg_order ?? 0)} />
            <StatCard icon={Boxes}        iconBg="bg-teal-100 dark:bg-teal-900/30"   iconColor="text-teal-600"
              label="Orders Count"   value={loading ? '—' : (ov?.orders_count ?? 0)} sub="invoices in period" />
            <StatCard icon={Package2}     iconBg="bg-orange-100 dark:bg-orange-900/30" iconColor="text-orange-600"
              label="Stock Bought"   value={loading ? '—' : fmt(ov?.stock_bought ?? 0)} />
            <StatCard icon={Percent}      iconBg="bg-emerald-100 dark:bg-emerald-900/30" iconColor="text-emerald-600"
              label="Profit Margin"  value={loading ? '—' : fmtPct(ov?.margin_pct ?? 0)} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Revenue Trend */}
            <div className="rounded-xl border bg-card p-5">
              <p className="text-sm font-semibold mb-4">Revenue Trend</p>
              {loading ? (
                <div className="h-48 rounded-lg bg-muted animate-pulse" />
              ) : trendData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data for this period</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<RevenueTooltip />} />
                    <Area type="monotone" dataKey="Revenue" stroke="#6366f1" fill="url(#revGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* P&L Breakdown */}
            <div className="rounded-xl border bg-card p-5">
              <p className="text-sm font-semibold mb-4">Profit &amp; Loss Breakdown</p>
              {loading ? (
                <div className="h-48 rounded-lg bg-muted animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={plData} barSize={40}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<RevenueTooltip />} />
                    <Bar dataKey="value" name="Amount" radius={[5,5,0,0]}>
                      {plData.map((_, i) => <Cell key={i} fill={PL_COLORS[i]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* AR notice */}
          {!loading && (ov?.accounts_receivable ?? 0) > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle size={15} className="shrink-0" />
              Outstanding accounts receivable: <strong>{fmt(ov?.accounts_receivable)}</strong> — some invoices have unpaid balances.
            </div>
          )}
        </div>
      )}

      {/* ── STOCK TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'stock' && (
        <div className="flex flex-col gap-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Products', value: loading ? '—' : (data?.stock?.products_count ?? 0), icon: Package2, color: 'text-violet-600', bg: 'bg-violet-100 dark:bg-violet-900/30' },
              { label: 'Parts',    value: loading ? '—' : (data?.stock?.parts_count    ?? 0), icon: Boxes,    color: 'text-blue-600',   bg: 'bg-blue-100 dark:bg-blue-900/30' },
              { label: 'Low Stock',value: loading ? '—' : (data?.stock?.low_stock_count ?? 0), icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' },
            ].map(c => (
              <div key={c.label} className="rounded-xl border bg-card p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${c.bg}`}>
                  <c.icon size={17} className={c.color} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="text-xl font-bold">{c.value}</p>
                </div>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="h-48 rounded-xl border bg-muted animate-pulse" />
          ) : (
            <>
              {/* Products */}
              {(data?.stock?.products?.length ?? 0) > 0 && (
                <div className="rounded-xl border overflow-hidden bg-card">
                  <div className="px-5 py-3 border-b bg-muted/30">
                    <p className="text-sm font-semibold flex items-center gap-2"><Package2 size={14} className="text-violet-600" /> Products (Air Coolers)</p>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs text-muted-foreground">
                          <TableHead>Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Stock</TableHead>
                          <TableHead className="text-right">Selling Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.stock.products.map((p, i) => (
                          <StockRow key={p.id || i} name={p.name} stock={p.stock} threshold={p.low_stock_threshold} price={p.price} category={p.category} />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Parts */}
              {(data?.stock?.parts?.length ?? 0) > 0 && (
                <div className="rounded-xl border overflow-hidden bg-card">
                  <div className="px-5 py-3 border-b bg-muted/30">
                    <p className="text-sm font-semibold flex items-center gap-2"><Boxes size={14} className="text-blue-600" /> Parts Inventory</p>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs text-muted-foreground">
                          <TableHead>Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Stock</TableHead>
                          <TableHead className="text-right">Cost Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.stock.parts.map((p, i) => (
                          <StockRow key={p.id || i} name={p.name} stock={p.stock} threshold={p.low_stock_threshold} price={p.cost_price} unit={p.unit} category={p.category} />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {(data?.stock?.products_count ?? 0) === 0 && (data?.stock?.parts_count ?? 0) === 0 && (
                <div className="rounded-xl border bg-muted/20 px-6 py-10 flex flex-col items-center gap-3 text-center">
                  <CloudOff size={28} className="text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground">No stock data synced yet</p>
                  <p className="text-xs text-muted-foreground max-w-xs">Products and parts are synced from the Electron desktop app. Add some inventory there first.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── VENDORS TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'vendors' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border overflow-hidden bg-card">
            <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Truck size={14} className="text-amber-600" /> Vendor Spending — {dateLabel}
              </p>
              <span className="text-xs text-muted-foreground">{(data?.vendors?.length ?? 0)} vendors</span>
            </div>
            {loading ? (
              <div className="h-48 animate-pulse bg-muted/30" />
            ) : (data?.vendors?.length ?? 0) === 0 ? (
              <div className="py-12 flex flex-col items-center gap-2 text-muted-foreground text-sm">
                <Truck size={24} className="opacity-30" />
                No purchase data for this period
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs text-muted-foreground">
                      <TableHead>Vendor</TableHead>
                      <TableHead className="text-right">Invoices</TableHead>
                      <TableHead className="text-right">Total Spent</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.vendors.map((v, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-sm">{v.vendor_name}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{v.invoice_count}</TableCell>
                        <TableCell className="text-right text-sm font-semibold tabular-nums">{fmt(v.total_spent)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {v.outstanding > 0
                            ? <span className="text-red-600 font-semibold">{fmt(v.outstanding)}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Bar chart of top vendors */}
          {!loading && (data?.vendors?.length ?? 0) > 0 && (
            <div className="rounded-xl border bg-card p-5">
              <p className="text-sm font-semibold mb-4">Top Vendors by Spending</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.vendors.slice(0, 8).map(v => ({ name: v.vendor_name.length > 12 ? v.vendor_name.slice(0, 12) + '…' : v.vendor_name, Spent: v.total_spent }))} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<RevenueTooltip />} />
                  <Bar dataKey="Spent" fill="#f59e0b" radius={[5,5,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── CUSTOMERS TAB ────────────────────────────────────────────────── */}
      {activeTab === 'customers' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border overflow-hidden bg-card">
            <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Users size={14} className="text-blue-600" /> Customer Revenue — {dateLabel}
              </p>
              <span className="text-xs text-muted-foreground">{(data?.customers?.length ?? 0)} customers</span>
            </div>
            {loading ? (
              <div className="h-48 animate-pulse bg-muted/30" />
            ) : (data?.customers?.length ?? 0) === 0 ? (
              <div className="py-12 flex flex-col items-center gap-2 text-muted-foreground text-sm">
                <Users size={24} className="opacity-30" />
                No sales data for this period
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs text-muted-foreground">
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Total Revenue</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.customers.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-sm">{c.customer_name}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{c.order_count}</TableCell>
                        <TableCell className="text-right text-sm font-semibold tabular-nums">{fmt(c.total_revenue)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {c.outstanding > 0
                            ? <span className="text-red-600 font-semibold">{fmt(c.outstanding)}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Bar chart of top customers */}
          {!loading && (data?.customers?.length ?? 0) > 0 && (
            <div className="rounded-xl border bg-card p-5">
              <p className="text-sm font-semibold mb-4">Top Customers by Revenue</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.customers.slice(0, 8).map(c => ({ name: c.customer_name.length > 12 ? c.customer_name.slice(0, 12) + '…' : c.customer_name, Revenue: c.total_revenue }))} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<RevenueTooltip />} />
                  <Bar dataKey="Revenue" fill="#22c55e" radius={[5,5,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── EXPENSES TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'expenses' && (
        <div className="rounded-xl border bg-muted/20 px-6 py-14 flex flex-col items-center gap-3 text-center">
          <CloudOff size={32} className="text-muted-foreground" />
          <p className="text-base font-semibold text-muted-foreground">Expenses not synced to cloud</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            The Electron desktop app currently syncs sales, purchases, products, parts, customers, and vendors — but not expenses. Record expenses in the desktop app and they'll appear here once sync is extended.
          </p>
        </div>
      )}

    </div>
  );
}
