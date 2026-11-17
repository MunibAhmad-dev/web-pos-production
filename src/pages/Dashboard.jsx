import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from 'next-themes';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import {
  Plus, RefreshCw, ArrowUpRight, ArrowDownRight, Wallet, Users, Truck, Boxes, AlertTriangle,
  ChevronRight, Receipt,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { isActiveSale, vendorBalances, khataBalances } from '@/lib/ledger';
import { useAuth } from '../context/AuthContext';
import { useDataStore } from '../store/dataStore';
import { useLowStockThreshold } from '../hooks/useLowStockThreshold';

/* ══════════════════════════════════════════════════════════════════════════
   Numbers follow the desktop app's dashboard exactly:
   - revenue = active sales in the period − returns on those sales
   - cost of goods = (qty sold − qty returned) × cost recorded on the sale line
     (no fallback to today's product cost, no cap at the selling price)
   - stock value: positive stock only; gram stock ÷ 1000; wholesale box stock ÷ carton qty
   - customer credit = invoice balance + open custom bills, per customer, when they owe
   ══════════════════════════════════════════════════════════════════════════ */

const fmtPKR = (n) => 'Rs. ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const fmtCompact = (n) => {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  if (a >= 10_000_000) return (v / 10_000_000).toFixed(1).replace(/\.0$/, '') + ' Cr';
  if (a >= 100_000) return (v / 100_000).toFixed(1).replace(/\.0$/, '') + ' L';
  if (a >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(Math.round(v));
};
const parseDate = (raw) => (raw ? new Date(String(raw).replace(' ', 'T')) : null);
const dayKey = (d) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

const PERIODS = [['today', 'Today'], ['week', '7 days'], ['month', 'This month'], ['year', 'This year']];

function rangeFor(period) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = startOfDay;
  if (period === 'week') start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  if (period === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === 'year') start = new Date(now.getFullYear(), 0, 1);
  const end = now;
  // Previous window of the same length, for the "vs before" comparison.
  const span = end - start;
  return { start, end, prevStart: new Date(start - span), prevEnd: new Date(start - 1) };
}

/** Revenue, cost, profit and the per-day series for one window. */
function computeWindow({ start, end, sales, itemsBySale, returnsBySale, returnedQtyByItem, expenses, byHour }) {
  let revenue = 0; let cogs = 0; let count = 0; let expenseTotal = 0;
  const buckets = new Map();
  const bucketOf = (d) => (byHour ? String(d.getHours()).padStart(2, '0') : dayKey(d));
  const bump = (key, field, v) => {
    const b = buckets.get(key) || { key, revenue: 0, cogs: 0, count: 0 };
    b[field] += v; buckets.set(key, b);
  };
  const productSales = new Map();
  const methods = new Map();

  for (const s of sales) {
    if (!isActiveSale(s)) continue;
    const d = parseDate(s.date_created);
    if (!d || isNaN(d) || d < start || d > end) continue;
    const sid = String(s.id);
    const ret = returnsBySale.get(sid) || 0;
    const net = (Number(s.total) || 0) - ret;
    const key = bucketOf(d);
    revenue += net; count++;
    bump(key, 'revenue', net);
    bump(key, 'count', 1);

    const m = String(s.payment_method || 'cash').trim().toLowerCase() || 'cash';
    const me = methods.get(m) || { method: m, total: 0, count: 0 };
    me.total += Number(s.total) || 0; me.count++; methods.set(m, me);

    for (const it of itemsBySale.get(sid) || []) {
      const qty = Math.max(0, (Number(it.quantity) || 0) - (returnedQtyByItem.get(String(it.id)) || 0));
      const pp = Number(it.purchase_price) > 0 ? Math.min(Number(it.purchase_price), 1_000_000) : 0;
      const lineCost = qty * pp;
      cogs += lineCost;
      bump(key, 'cogs', lineCost);
      if (qty > 0) {
        const pk = String(it.product_id ?? it.product_name);
        const p = productSales.get(pk) || { name: it.product_name || 'Item', qty: 0, revenue: 0 };
        p.qty += qty; p.revenue += qty * (Number(it.price) || 0); productSales.set(pk, p);
      }
    }
  }
  for (const e of expenses) {
    const d = parseDate(e.date_added ?? e.date_created ?? e.date);
    if (!d || isNaN(d) || d < start || d > end) continue;
    expenseTotal += Number(e.amount) || 0;
  }
  return {
    revenue, cogs, count, expenses: expenseTotal,
    gross: revenue - cogs, net: revenue - cogs - expenseTotal,
    buckets, productSales, methods,
  };
}

/* ── Small pieces ─────────────────────────────────────────────────────────── */

function Delta({ now, before, invert = false }) {
  if (!before || Math.abs(before) < 1) return <span className="text-xs text-muted-foreground">No earlier data</span>;
  const pct = ((now - before) / Math.abs(before)) * 100;
  const up = pct >= 0;
  const good = invert ? !up : up;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
      good ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
      {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0)}%
      <span className="ml-1 font-normal text-muted-foreground">vs previous</span>
    </span>
  );
}

function Spark({ values, positive = true }) {
  if (!values || values.length < 2) return <div className="h-9" />;
  const w = 120; const h = 36;
  const min = Math.min(...values, 0); const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - ((v - min) / (max - min || 1)) * (h - 4) - 2]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn('h-9 w-full', positive ? 'text-primary' : 'text-rose-500')} preserveAspectRatio="none" aria-hidden="true">
      <path d={`${line} L${w},${h} L0,${h} Z`} fill="currentColor" opacity="0.09" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Metric({ label, value, sub, delta, spark, tone = 'default' }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 flex flex-col">
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-2 text-[26px] leading-none font-bold tabular-nums tracking-tight',
        tone === 'negative' ? 'text-rose-600 dark:text-rose-400' : 'text-foreground')}>{value}</p>
      <div className="mt-2 min-h-[18px]">{delta}</div>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      <div className="mt-auto pt-3">{spark}</div>
    </div>
  );
}

function Card({ title, action, children, className }) {
  return (
    <section className={cn('rounded-2xl border border-border/70 bg-card flex flex-col min-w-0', className)}>
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      <div className="px-5 pb-5 flex-1 min-w-0">{children}</div>
    </section>
  );
}

function CardLink({ to, children }) {
  return (
    <Link to={to} className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
      {children} <ChevronRight size={13} />
    </Link>
  );
}

function useChartColors() {
  const { resolvedTheme } = useTheme();
  return useMemo(() => {
    const css = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
    const read = (v, fb) => (css?.getPropertyValue(v).trim() || fb);
    return {
      primary: read('--primary', '#1478c8'),
      grid: read('--border', '#e5e7eb'),
      muted: read('--muted-foreground', '#6b7280'),
      profit: resolvedTheme === 'dark' ? '#34d399' : '#059669',
    };
  }, [resolvedTheme]);
}

function ChartTooltip({ active, payload, label, byHour }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const title = byHour ? `${label}:00 – ${label}:59` : new Date(`${label}T00:00:00`).toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short' });
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-foreground mb-1">{title}</p>
      <p className="flex justify-between gap-6"><span className="text-muted-foreground">Sales</span><span className="font-semibold tabular-nums text-foreground">{fmtPKR(row.revenue)}</span></p>
      <p className="flex justify-between gap-6"><span className="text-muted-foreground">Gross profit</span><span className="font-semibold tabular-nums text-foreground">{fmtPKR(row.gross)}</span></p>
    </div>
  );
}

const METHOD_COLORS = ['bg-primary', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-sky-400', 'bg-slate-400'];
const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/* ══════════════════════════════════════════════════════════════════════════ */

export default function Dashboard() {
  const { user } = useAuth();
  const { list, refresh, loading } = useDataStore();
  const threshold = useLowStockThreshold();
  const colors = useChartColors();
  const [period, setPeriod] = useState('week');
  const [refreshing, setRefreshing] = useState(false);

  const sales = list('sale');
  const saleItems = list('sale_item');
  const saleReturns = list('sale_return');
  const saleReturnItems = list('sale_return_item');
  const expenses = list('expense');
  const products = list('product');
  const customers = list('customer');
  const vendors = list('vendor');
  const purchases = list('purchase');
  const vendorPayments = list('vendor_payment');
  const purchaseReturns = list('purchase_return');
  const accounts = list('account');
  const accountTxns = list('account_txn');
  const khatas = list('customer_khata');
  const khataPayments = list('customer_khata_payment');

  // Lookups built once per data change
  const lookups = useMemo(() => {
    const itemsBySale = new Map();
    for (const it of saleItems) {
      const k = String(it.sale_id);
      if (!itemsBySale.has(k)) itemsBySale.set(k, []);
      itemsBySale.get(k).push(it);
    }
    const returnsBySale = new Map();
    for (const r of saleReturns) {
      const k = String(r.sale_id);
      returnsBySale.set(k, (returnsBySale.get(k) || 0) + (Number(r.total_returned) || 0));
    }
    const returnedQtyByItem = new Map();
    for (const ri of saleReturnItems) {
      const k = String(ri.sale_item_id ?? '');
      if (k) returnedQtyByItem.set(k, (returnedQtyByItem.get(k) || 0) + (Number(ri.quantity) || 0));
    }
    return { itemsBySale, returnsBySale, returnedQtyByItem };
  }, [saleItems, saleReturns, saleReturnItems]);

  const byHour = period === 'today';
  const range = useMemo(() => rangeFor(period), [period]);
  const cur = useMemo(() => computeWindow({ ...range, sales, expenses, byHour, ...lookups }), [range, sales, expenses, byHour, lookups]);
  const prev = useMemo(() => computeWindow({ start: range.prevStart, end: range.prevEnd, sales, expenses, byHour, ...lookups }), [range, sales, expenses, byHour, lookups]);
  const today = useMemo(() => {
    const r = rangeFor('today');
    return computeWindow({ start: r.start, end: r.end, sales, expenses, byHour: true, ...lookups });
  }, [sales, expenses, lookups]);

  // Chart series with every day/hour present (gaps shown as zero)
  const series = useMemo(() => {
    const keys = [];
    if (byHour) {
      const lastHour = new Date().getHours();
      for (let h = 0; h <= lastHour; h++) keys.push(String(h).padStart(2, '0'));
    } else {
      const d = new Date(range.start);
      while (d <= range.end && keys.length < 400) { keys.push(dayKey(d)); d.setDate(d.getDate() + 1); }
    }
    return keys.map((k) => {
      const b = cur.buckets.get(k) || { revenue: 0, cogs: 0, count: 0 };
      return { key: k, revenue: Math.round(b.revenue), gross: Math.round(b.revenue - b.cogs), count: b.count };
    });
  }, [cur, byHour, range]);

  const topProducts = useMemo(() => [...cur.productSales.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6), [cur]);
  const methodRows = useMemo(() => {
    const rows = [...cur.methods.values()].sort((a, b) => b.total - a.total);
    const total = rows.reduce((s, r) => s + r.total, 0) || 1;
    return rows.map((r, i) => ({ ...r, share: r.total / total, color: METHOD_COLORS[i % METHOD_COLORS.length] }));
  }, [cur]);

  const stock = useMemo(() => {
    let cost = 0; let retail = 0; let out = 0; const low = [];
    for (const p of products) {
      const s = Number(p.stock) || 0;
      if (s <= threshold) { low.push(p); if (s <= 0) out++; }
      if (s <= 0) continue;
      const units = p.unit_type === 'gram' ? s / 1000 : (Number(p.carton_qty) > 0 ? s / Number(p.carton_qty) : s);
      cost += Math.min(units * Math.min(Number(p.purchase_price) || 0, 50_000_000), 50_000_000);
      retail += Math.min(units * (Number(p.price) || 0), 50_000_000);
    }
    low.sort((a, b) => (Number(a.stock) || 0) - (Number(b.stock) || 0));
    return { cost, retail, low, out };
  }, [products, threshold]);

  const receivables = useMemo(() => {
    const kb = khataBalances(khatas, khataPayments, 'customer_id');
    const rows = customers
      .map((c) => ({ ...c, balance: (Number(c.outstanding_balance) || 0) + (kb.get(String(c.id)) || 0) }))
      .filter((c) => c.balance > 0.5)
      .sort((a, b) => b.balance - a.balance);
    return { total: rows.reduce((s, c) => s + c.balance, 0), rows };
  }, [customers, khatas, khataPayments]);

  const payables = useMemo(() => {
    const vb = vendorBalances({ purchases, vendorPayments, purchaseReturns });
    const rows = vendors.map((v) => ({ ...v, balance: vb.get(String(v.id)) || 0 })).filter((v) => v.balance > 0.5);
    return { total: rows.reduce((s, v) => s + v.balance, 0), count: rows.length };
  }, [vendors, purchases, vendorPayments, purchaseReturns]);

  const funds = useMemo(() => {
    const delta = new Map();
    for (const t of accountTxns) {
      const k = String(t.account_id);
      delta.set(k, (delta.get(k) || 0) + (t.type === 'in' ? 1 : -1) * (Number(t.amount) || 0));
    }
    let cash = 0; let bank = 0;
    for (const a of accounts) {
      const bal = (Number(a.opening_balance) || 0) + (delta.get(String(a.id)) || 0);
      if (a.type === 'bank') bank += bal; else cash += bal;
    }
    return { cash, bank, total: cash + bank };
  }, [accounts, accountTxns]);

  const recentSales = useMemo(() => {
    const custName = new Map(customers.map((c) => [String(c.id), c.name]));
    return sales
      .filter((s) => isActiveSale(s) && s.date_created)
      .sort((a, b) => parseDate(b.date_created) - parseDate(a.date_created))
      .slice(0, 7)
      .map((s) => ({ ...s, customer: s.customer_id ? custName.get(String(s.customer_id)) || 'Customer' : 'Walk-in', items: (lookups.itemsBySale.get(String(s.id)) || []).length }));
  }, [sales, customers, lookups]);

  const doRefresh = async () => {
    setRefreshing(true);
    try { await refresh(); } catch { /* offline — keep showing cached data */ } finally { setRefreshing(false); }
  };

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (user?.owner_name || '').trim().split(/\s+/)[0];
  const periodWord = { today: 'today', week: 'in the last 7 days', month: 'this month', year: 'this year' }[period];
  const margin = cur.revenue > 0 ? (cur.gross / cur.revenue) * 100 : 0;
  const avgTicket = cur.count ? cur.revenue / cur.count : 0;
  const sparkOf = (field) => series.map((r) => r[field]);

  return (
    <div className="flex flex-col gap-6 pb-6">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="mt-1 font-display text-[28px] leading-tight font-extrabold tracking-tight text-foreground">
            {greet}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Today so far: <span className="font-semibold text-foreground tabular-nums">{fmtPKR(today.revenue)}</span> from {today.count} sale{today.count === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-border/70 bg-muted/50 p-1" role="tablist" aria-label="Period">
            {PERIODS.map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={period === key} onClick={() => setPeriod(key)}
                className={cn('h-8 px-3 rounded-lg text-[13px] font-medium transition-all',
                  period === key ? 'bg-card text-foreground shadow-sm ring-1 ring-border/70' : 'text-muted-foreground hover:text-foreground')}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" onClick={doRefresh} aria-label="Refresh data" title="Fetch the latest from your counter PC"
            className="h-10 w-10 rounded-xl border border-border bg-card inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw size={15} className={cn((refreshing || loading) && 'animate-spin')} />
          </button>
          {/* The sidebar already has "New sale" on large screens */}
          <Link to="/sales" className="lg:hidden h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-1.5 shadow-sm hover:opacity-95">
            <Plus size={16} /> New sale
          </Link>
        </div>
      </div>

      {/* ── Headline numbers ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Sales" value={fmtPKR(cur.revenue)} sub={`After returns, ${periodWord}`}
          delta={<Delta now={cur.revenue} before={prev.revenue} />} spark={<Spark values={sparkOf('revenue')} />} />
        <Metric label="Gross profit" value={fmtPKR(cur.gross)} sub={`${margin.toFixed(1)}% margin · cost ${fmtPKR(cur.cogs)}`}
          delta={<Delta now={cur.gross} before={prev.gross} />} spark={<Spark values={sparkOf('gross')} positive={cur.gross >= 0} />}
          tone={cur.gross < 0 ? 'negative' : 'default'} />
        <Metric label="Net profit" value={fmtPKR(cur.net)} sub={`After ${fmtPKR(cur.expenses)} expenses`}
          delta={<Delta now={cur.net} before={prev.net} />} tone={cur.net < 0 ? 'negative' : 'default'}
          spark={<div className="h-9 flex items-end"><div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className={cn('h-full rounded-full', cur.net >= 0 ? 'bg-emerald-500' : 'bg-rose-500')} style={{ width: `${cur.revenue > 0 ? Math.min(100, Math.abs(cur.net) / cur.revenue * 100) : 0}%` }} />
          </div></div>} />
        <Metric label="Number of sales" value={cur.count.toLocaleString('en-PK')} sub={`Average bill ${fmtPKR(avgTicket)}`}
          delta={<Delta now={cur.count} before={prev.count} />} spark={<Spark values={sparkOf('count')} />} />
      </div>

      {/* ── Trend + payment methods ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title={byHour ? 'Sales by hour, today' : 'Sales and gross profit'} className="xl:col-span-2"
          action={<div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: colors.primary }} />Sales</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 rounded" style={{ background: colors.profit }} />Gross profit</span>
          </div>}>
          <div className="h-[280px] -ml-2">
            {cur.count === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-sm text-muted-foreground">
                <Receipt size={22} className="mb-2 opacity-50" /> No sales {periodWord} yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="key" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: colors.muted }} minTickGap={16}
                    tickFormatter={(k) => (byHour ? `${Number(k)}h` : new Date(`${k}T00:00:00`).toLocaleDateString('en-PK', period === 'year' ? { month: 'short' } : { day: 'numeric', month: 'short' }))} />
                  <YAxis tickLine={false} axisLine={false} width={52} tick={{ fontSize: 11, fill: colors.muted }} tickFormatter={fmtCompact} />
                  <Tooltip cursor={{ fill: colors.grid, opacity: 0.35 }} content={<ChartTooltip byHour={byHour} />} />
                  <Bar dataKey="revenue" fill={colors.primary} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Line dataKey="gross" type="monotone" stroke={colors.profit} strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card title="How customers paid" action={<span className="text-xs text-muted-foreground">{periodWord}</span>}>
          {methodRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No payments yet.</p>
          ) : (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                {methodRows.map((m) => <div key={m.method} className={m.color} style={{ width: `${m.share * 100}%` }} title={titleCase(m.method)} />)}
              </div>
              <ul className="mt-5 grid gap-3">
                {methodRows.map((m) => (
                  <li key={m.method} className="flex items-center gap-3 text-sm">
                    <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', m.color)} />
                    <span className="flex-1 min-w-0 truncate text-foreground">{titleCase(m.method)}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{m.count} · {Math.round(m.share * 100)}%</span>
                    <span className="w-28 text-right font-semibold tabular-nums text-foreground">{fmtPKR(m.total)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      {/* ── Financial position ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { to: '/accounts', icon: Wallet, tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', label: 'Cash & bank', value: funds.total,
            sub: `Cash ${fmtPKR(funds.cash)} · Bank ${fmtPKR(funds.bank)}`, negative: funds.total < 0 },
          { to: '/loans', icon: Users, tone: 'bg-sky-500/10 text-sky-600 dark:text-sky-400', label: 'Customers owe you', value: receivables.total,
            sub: `${receivables.rows.length} customer${receivables.rows.length === 1 ? '' : 's'}, incl. custom bills` },
          { to: '/vendors', icon: Truck, tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-400', label: 'You owe vendors', value: payables.total,
            sub: `${payables.count} vendor${payables.count === 1 ? '' : 's'}` },
          { to: '/inventory', icon: Boxes, tone: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', label: 'Stock at cost', value: stock.cost,
            sub: `Sells for ${fmtPKR(stock.retail)}` },
        ].map((t) => (
          <Link key={t.label} to={t.to} className="group rounded-2xl border border-border/70 bg-card p-5 flex items-start gap-4 hover:border-foreground/20 transition-colors">
            <span className={cn('h-10 w-10 rounded-xl inline-flex items-center justify-center shrink-0', t.tone)}><t.icon size={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-muted-foreground">{t.label}</p>
              <p className={cn('mt-1 text-xl font-bold tabular-nums tracking-tight', t.negative ? 'text-rose-600 dark:text-rose-400' : 'text-foreground')}>{fmtPKR(t.value)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground truncate">{t.sub}</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground/50 group-hover:text-foreground transition-colors mt-1" />
          </Link>
        ))}
      </div>

      {/* ── Products ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="Best sellers" className="xl:col-span-2" action={<CardLink to="/reports">Reports</CardLink>}>
          {topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nothing sold {periodWord} yet.</p>
          ) : (
            <ul className="grid gap-3.5">
              {topProducts.map((p, i) => (
                <li key={p.name + i} className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3">
                  <span className="text-xs font-semibold text-muted-foreground tabular-nums">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums shrink-0">{Number(p.qty.toFixed(2)).toLocaleString('en-PK')} sold</p>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(p.revenue / (topProducts[0].revenue || 1)) * 100}%` }} />
                    </div>
                  </div>
                  <span className="w-28 text-right text-sm font-semibold tabular-nums text-foreground">{fmtPKR(p.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Running low" action={<CardLink to="/inventory">Inventory</CardLink>}>
          {stock.low.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-foreground">Stock looks healthy</p>
              <p className="text-xs text-muted-foreground mt-1">Nothing at or below {threshold} units.</p>
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs text-muted-foreground">
                {stock.low.length} product{stock.low.length === 1 ? '' : 's'} at or below {threshold}
                {stock.out > 0 && <> · <span className="font-medium text-rose-600 dark:text-rose-400">{stock.out} out of stock</span></>}
              </p>
              <ul className="divide-y divide-border/60">
                {stock.low.slice(0, 6).map((p) => {
                  const s = Number(p.stock) || 0;
                  return (
                    <li key={p.id} className="flex items-center gap-3 py-2.5">
                      <AlertTriangle size={14} className={cn('shrink-0', s <= 0 ? 'text-rose-500' : 'text-amber-500')} />
                      <span className="flex-1 min-w-0 truncate text-sm text-foreground">{p.name}</span>
                      <span className={cn('text-xs font-semibold tabular-nums rounded-md px-1.5 py-0.5',
                        s <= 0 ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400')}>
                        {s <= 0 ? 'Out' : `${s} left`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>
      </div>

      {/* ── Recent activity ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="Latest sales" className="xl:col-span-2" action={<CardLink to="/sales/history">All sales</CardLink>}>
          {recentSales.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No sales yet.</p>
          ) : (
            <ul className="divide-y divide-border/60 -mx-1">
              {recentSales.map((s) => {
                const d = parseDate(s.date_created);
                const credit = /credit|udhar|khata/i.test(String(s.payment_method || ''));
                return (
                  <li key={s.id} className="flex items-center gap-3 px-1 py-2.5">
                    <span className="h-8 w-8 rounded-full bg-muted inline-flex items-center justify-center text-[11px] font-semibold text-muted-foreground shrink-0">
                      {s.customer === 'Walk-in' ? 'W' : s.customer.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{s.customer}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {d ? d.toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''}
                        {s.items ? ` · ${s.items} item${s.items === 1 ? '' : 's'}` : ''}
                      </p>
                    </div>
                    <span className={cn('text-[11px] font-medium rounded-md px-1.5 py-0.5',
                      credit ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'bg-muted text-muted-foreground')}>
                      {titleCase(String(s.payment_method || 'cash'))}
                    </span>
                    <span className="w-28 text-right text-sm font-semibold tabular-nums text-foreground">{fmtPKR(s.total)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Who owes you most" action={<CardLink to="/loans">Receivables</CardLink>}>
          {receivables.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No customer owes you anything.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {receivables.rows.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <Link to={`/customers/${c.id}`} className="flex items-center gap-3 py-2.5 group">
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-foreground truncate group-hover:underline">{c.name}</span>
                      {c.phone && <span className="block text-xs text-muted-foreground tabular-nums">{c.phone}</span>}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-foreground">{fmtPKR(c.balance)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
