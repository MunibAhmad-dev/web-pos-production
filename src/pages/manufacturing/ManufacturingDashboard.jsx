import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  DollarSign, TrendingUp, Package, AlertTriangle, Wallet,
  Boxes, ShoppingCart, Users, Truck, ShoppingBag, BarChart3, HandCoins,
  RefreshCw, CheckCircle2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useMfgAuth } from '../../context/ManufacturingAuthContext';
import { mfgGetDashboard } from '../../api/manufacturingApi';

const fmt = (n) => 'Rs. ' + Math.round(Number(n) || 0).toLocaleString();
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const QUICK_ACTIONS = [
  { title: 'New Sale',  path: '/manufacturing/sales',     icon: ShoppingBag, from: '#3b82f6', to: '#2563eb' },
  { title: 'Products',  path: '/manufacturing/products',  icon: Package,     from: '#8b5cf6', to: '#7c3aed' },
  { title: 'Purchases', path: '/manufacturing/purchases', icon: Truck,       from: '#f97316', to: '#ea580c' },
  { title: 'Parts',     path: '/manufacturing/parts',     icon: Boxes,       from: '#06b6d4', to: '#0891b2' },
  { title: 'Customers', path: '/manufacturing/customers', icon: Users,       from: '#10b981', to: '#059669' },
  { title: 'Vendors',   path: '/manufacturing/vendors',   icon: Truck,       from: '#f59e0b', to: '#d97706' },
  { title: 'Accounting',path: '/manufacturing/accounting',icon: HandCoins,   from: '#ef4444', to: '#dc2626' },
  { title: 'Reports',   path: '/manufacturing/reports',   icon: BarChart3,   from: '#6366f1', to: '#4f46e5' },
];

const ymd = (d) => d.toISOString().slice(0, 10);
function presetRange(preset) {
  const today = new Date();
  switch (preset) {
    case 'today': return { startDate: ymd(today), endDate: ymd(today) };
    case 'week': { const s = new Date(today); s.setDate(s.getDate() - s.getDay()); return { startDate: ymd(s), endDate: ymd(today) }; }
    case 'month': { const s = new Date(today.getFullYear(), today.getMonth(), 1); return { startDate: ymd(s), endDate: ymd(today) }; }
    default: return {};
  }
}

function shortDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' });
}

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Good morning', emoji: '☀️' };
  if (h < 17) return { text: 'Good afternoon', emoji: '🌤️' };
  return { text: 'Good evening', emoji: '🌙' };
};

export default function ManufacturingDashboard() {
  const { mfgUser } = useMfgAuth();
  const [preset, setPreset] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd,   setCustomEnd]   = useState('');

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const range = useMemo(() => {
    if (preset === 'custom') return { startDate: customStart, endDate: customEnd };
    return presetRange(preset);
  }, [preset, customStart, customEnd]);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await mfgGetDashboard({ start_date: range.startDate, end_date: range.endDate });
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [range.startDate, range.endDate]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const greeting = getGreeting();
  const ownerName = mfgUser?.company_name?.trim() || '';

  // Build chart data — always 7 days regardless of period filter
  const salesTrend = data?.sales_trend?.map(d => ({
    date: shortDate(d.date),
    sales: d.count,
    revenue: d.revenue,
  })) || [];

  const stats = data?.stats || {};
  const period = data?.period || {};
  const topDebtors = stats.top_debtors || [];

  const cards = [
    { label: 'Total Sales',        value: stats.total_sales ?? 0,          icon: ShoppingCart, color: 'bg-blue-500/10 text-blue-600' },
    { label: 'Total Revenue',      value: fmt(stats.total_revenue),         icon: DollarSign,   color: 'bg-emerald-500/10 text-emerald-600' },
    { label: 'Accounts Receivable',value: fmt(stats.accounts_receivable),   icon: Wallet,       color: 'bg-red-500/10 text-red-600' },
    { label: 'Products',           value: stats.total_products ?? 0,        icon: Package,      color: 'bg-purple-500/10 text-purple-600' },
    { label: 'Parts',              value: stats.total_parts ?? 0,           icon: Boxes,        color: 'bg-amber-500/10 text-amber-600' },
    { label: 'Low Stock Items',    value: stats.low_stock_items ?? 0,       icon: AlertTriangle,color: 'bg-orange-500/10 text-orange-600' },
    { label: 'Customers',          value: stats.total_customers ?? 0,       icon: Users,        color: 'bg-indigo-500/10 text-indigo-600' },
    { label: 'Vendors',            value: stats.total_vendors ?? 0,         icon: Truck,        color: 'bg-cyan-500/10 text-cyan-600' },
  ];

  return (
    <div className="space-y-6">

      {/* Greeting */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting.text}{ownerName ? `, ${ownerName}` : ''} {greeting.emoji}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Here's what's happening with your factory.</p>
        </div>
        <button
          onClick={fetchDashboard}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
        {QUICK_ACTIONS.map(a => (
          <Link key={a.path} to={a.path} className="group">
            <div
              className="rounded-2xl p-3 flex flex-col items-center gap-2 text-center shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              style={{ background: `linear-gradient(135deg, ${a.from}, ${a.to})` }}
            >
              <a.icon size={20} className="text-white" />
              <span className="text-[11px] font-semibold text-white leading-tight">{a.title}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Period filter */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-3 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {[['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['custom', 'Custom']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPreset(key)}
              className={cn(
                'text-xs font-semibold px-3 py-1.5 rounded-md transition-colors',
                preset === key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <>
            <input type="date" className="h-8 px-2 text-sm rounded-md border border-border bg-background" value={customStart} onChange={e => setCustomStart(e.target.value)} />
            <input type="date" className="h-8 px-2 text-sm rounded-md border border-border bg-background" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
          </>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {loading ? 'Fetching…' : error ? <span className="text-red-500">{error}</span> : 'Live data from cloud'}
        </span>
      </div>

      {/* Error banner */}
      {error && !loading && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error} — <button onClick={fetchDashboard} className="underline font-semibold">Retry</button>
        </div>
      )}

      {/* AR / AP cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Receivable */}
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="h-[3px] bg-gradient-to-r from-emerald-600 to-emerald-400" />
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600"><Users size={18} /></div>
                <div>
                  <p className="text-sm font-bold">Receivable (AR)</p>
                  <p className="text-[11px] text-muted-foreground">Customers who owe you</p>
                </div>
              </div>
              <p className="text-xl font-black text-emerald-600">{fmt(stats.accounts_receivable)}</p>
            </div>
            {topDebtors.length > 0 ? (
              <div className="space-y-2">
                {topDebtors.slice(0, 5).map((d, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-700 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                      <span className="text-xs text-muted-foreground truncate">{d.customer_name}</span>
                    </div>
                    <span className="text-xs font-bold tabular-nums shrink-0 ml-2">{fmt(d.due)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
                <CheckCircle2 size={13} /> No outstanding receivables
              </div>
            )}
          </div>
        </div>

        {/* Period summary */}
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="h-[3px] bg-gradient-to-r from-violet-600 to-violet-400" />
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-violet-500/10 text-violet-600"><BarChart3 size={18} /></div>
                <div>
                  <p className="text-sm font-bold">Period Summary</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{preset === 'custom' ? 'Custom range' : preset === 'today' ? 'Today' : preset === 'week' ? 'This week' : 'This month'}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">Sales</p>
                <p className="text-2xl font-black text-foreground">{period.sales_count ?? 0}</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">Revenue</p>
                <p className="text-lg font-black text-violet-600">{fmt(period.revenue)}</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">Total Sales (All Time)</p>
                <p className="text-lg font-black text-foreground">{stats.total_sales ?? 0}</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">Total Revenue (All Time)</p>
                <p className="text-sm font-black text-teal-600 tabular-nums">{fmt(stats.total_revenue)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className="rounded-2xl border border-border/50 bg-card shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className={cn('p-3 rounded-xl shrink-0', c.color)}>
              <c.icon size={22} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
              <div className="text-xl font-bold tracking-tight">
                {loading ? <span className="animate-pulse">…</span> : c.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Sales count trend */}
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="h-[3px] bg-gradient-to-r from-blue-600 via-blue-400 to-transparent" />
          <div className="p-5 pb-2">
            <p className="font-semibold text-sm">Sales Count (Last 7 Days)</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={salesTrend}>
                <defs>
                  <linearGradient id="mfgSalesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                <Area type="monotone" dataKey="sales" name="Sales" stroke="#3b82f6" fill="url(#mfgSalesGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue trend */}
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="h-[3px] bg-gradient-to-r from-emerald-600 via-emerald-400 to-transparent" />
          <div className="p-5 pb-2">
            <p className="font-semibold text-sm">Revenue Trend (Last 7 Days)</p>
          </div>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={salesTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }}
                  formatter={v => [`Rs. ${Math.round(v).toLocaleString()}`, 'Revenue']}
                />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
