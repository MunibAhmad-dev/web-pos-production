import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ComposedChart, Bar, Line,
  PieChart, Pie, Cell,
} from 'recharts';
import { motion } from 'framer-motion';
import {
  DollarSign, TrendingUp, TrendingDown, Activity, Zap, Boxes, Wallet, AlertTriangle, PiggyBank,
  ShoppingCart, Package, Truck, Users, CreditCard, BarChart3, ClipboardList,
  ArrowUpRight, Banknote, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import cloudApi from '../api/cloudClient';
import { useAuth } from '../context/AuthContext';
import { useDataStore } from '../store/dataStore';
import { useLowStockThreshold } from '../hooks/useLowStockThreshold';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtPKR  = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const fmtShort = (n) => {
  const v = Math.abs(Number(n) || 0);
  if (v >= 1_000_000) return (Number(n) / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000)     return (Number(n) / 1_000).toFixed(0) + 'k';
  return String(Math.round(Number(n) || 0));
};
const fmtDay = (k) => new Date(k).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
const fmtDT  = (d) => d ? new Date(d).toLocaleString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Good morning',   emoji: '☀️' };
  if (h < 17) return { text: 'Good afternoon', emoji: '🌤️' };
  return              { text: 'Good evening',   emoji: '🌙' };
};

function rangeForPeriod(period, from, to) {
  const now = new Date();
  const end = new Date(now);
  let start = new Date(now);
  if      (period === 'today')  start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  else if (period === 'week')   start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  else if (period === 'month')  start = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (period === 'year')   start = new Date(now.getFullYear(), 0, 1);
  else if (period === 'custom' && from && to)
    return { date_from: new Date(from).toISOString(), date_to: new Date(to).toISOString() };
  return { date_from: start.toISOString(), date_to: end.toISOString() };
}

// For gram-unit products: stock is in grams, purchase_price is per-kg.
// Matches the Electron desktop's COGS cap:
//   MIN(si.purchase_price, COALESCE(NULLIF(si.price, 0), 500000))
// i.e. cap purchase_price at the sale-line price, using 500K as a fallback
// when the line price is 0/null. We use item.price (sale-time price) not
// product.price so that price changes after the sale don't distort history.
function gramCorrectedCost(qty, purchasePrice, unitType, itemPrice) {
  const cap = (Number(itemPrice) > 0) ? Number(itemPrice) : 500_000;
  const pp  = Math.min(Number(purchasePrice) || 0, cap);
  return unitType === 'gram'
    ? (Number(qty) / 1000) * pp
    : Number(qty) * pp;
}

function buildPnl(analyticsData, saleItems, sales, productById = {}, saleReturnItems = [], saleReturns = []) {
  const dayOf = {};
  // Cancelled sales are excluded from COGS too — matches the Electron dashboard,
  // whose COGS join filters status IN ('completed','paid','partial').
  for (const s of sales) {
    if (s.date_created && s.status !== 'Cancelled') dayOf[String(s.id)] = String(s.date_created).slice(0, 10);
  }
  const cogsByDay = {};
  // Map saleId:productId → purchase cost info (first line wins for the rare duplicate-product case)
  const saleItemInfo = {};
  for (const item of saleItems) {
    const day = dayOf[String(item.sale_id)];
    if (!day) continue;
    const product = productById[String(item.product_id ?? '')];
    // Fall back to product's own purchase_price when the sale_item stored 0
    // (happens for records created before the Electron batch-cost bug was fixed).
    const pp = Number(item.purchase_price) > 0 ? item.purchase_price : (product?.purchase_price ?? 0);
    // Pass item.price as the cap denominator — matches desktop's si.price column
    const cogs = gramCorrectedCost(item.quantity ?? 0, pp, product?.unit_type, item.price);
    cogsByDay[day] = (cogsByDay[day] || 0) + cogs;
    const k = `${item.sale_id}:${item.product_id}`;
    if (!saleItemInfo[k]) saleItemInfo[k] = { pp, unitType: product?.unit_type, itemPrice: item.price };
  }
  // Subtract COGS of returned items on the return date (mirrors how revenue is
  // reduced on the return date). Join: sale_return_item → sale_return → sale_id
  // → sale_item to get the original purchase_price.
  const returnSaleId = {};
  for (const r of saleReturns) returnSaleId[String(r.id)] = String(r.sale_id);
  for (const ri of saleReturnItems) {
    if (!ri.date_created) continue;
    const day = String(ri.date_created).slice(0, 10);
    if (!day) continue;
    const saleId = returnSaleId[String(ri.return_id)];
    if (!saleId) continue;
    const info = saleItemInfo[`${saleId}:${ri.product_id}`];
    if (!info) continue;
    const returnedCogs = gramCorrectedCost(Number(ri.quantity) || 0, info.pp, info.unitType, info.itemPrice);
    cogsByDay[day] = (cogsByDay[day] || 0) - returnedCogs;
  }
  const revenueByDay = {};
  for (const d of analyticsData?.salesByDay || []) revenueByDay[d.day] = d.revenue;
  const expensesByDay = {};
  for (const d of analyticsData?.expensesByDay || []) expensesByDay[d.day] = d.amount;
  // Use server-period days as the anchor — never expand into all-time COGS days.
  // revenueByDay and expensesByDay come from the server's period-filtered analytics,
  // so including cogsByDay (all history) would add phantom days with 0 revenue but
  // non-zero COGS, making net profit deeply negative when period is "Today".
  const days = Array.from(new Set([
    ...Object.keys(revenueByDay), ...Object.keys(expensesByDay)
  ])).sort();
  const series = days.map((date) => {
    const revenue  = revenueByDay[date]  || 0;
    const cogs     = cogsByDay[date]     || 0;
    const expenses = expensesByDay[date] || 0;
    return { date, revenue, cogs, expenses, gross: revenue - cogs, net: revenue - cogs - expenses };
  });
  const totals = series.reduce(
    (acc, d) => ({ revenue: acc.revenue + d.revenue, cogs: acc.cogs + d.cogs, expenses: acc.expenses + d.expenses, gross: acc.gross + d.gross, net: acc.net + d.net }),
    { revenue: 0, cogs: 0, expenses: 0, gross: 0, net: 0 }
  );
  return { series, totals };
}

const fadeUp = {
  hidden:  { opacity: 0, y: 18 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.38, delay: Math.min(i, 5) * 0.06, ease: [0.22, 1, 0.36, 1] } }),
};

const PERIOD_OPTS = [['today', 'Today'], ['week', '7 Days'], ['month', 'Month'], ['year', 'Year'], ['custom', 'Custom']];

const QUICK = [
  { to: '/sales',          label: 'New Sale',   icon: ShoppingCart,  color: 'bg-emerald-500/10 text-emerald-600' },
  { to: '/products',       label: 'Products',   icon: Package,       color: 'bg-blue-500/10 text-blue-600' },
  { to: '/purchases',      label: 'Purchases',  icon: ClipboardList, color: 'bg-purple-500/10 text-purple-600' },
  { to: '/inventory',      label: 'Inventory',  icon: Boxes,         color: 'bg-amber-500/10 text-amber-600' },
  { to: '/customers',      label: 'Customers',  icon: Users,         color: 'bg-pink-500/10 text-pink-600' },
  { to: '/vendors',        label: 'Vendors',    icon: Truck,         color: 'bg-indigo-500/10 text-indigo-600' },
  { to: '/payment-ledger', label: 'Ledger',     icon: CreditCard,    color: 'bg-orange-500/10 text-orange-600' },
  { to: '/reports',        label: 'Reports',    icon: BarChart3,     color: 'bg-cyan-500/10 text-cyan-600' },
];

// ─── Sparkline (mini area chart) ──────────────────────────────────────────────
function Sparkline({ data = [], dataKey = 'value', color = '#3b82f6' }) {
  if (!data.length) return null;
  return (
    <div className="h-10 -mx-1 mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`spk-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5}
            fill={`url(#spk-${color.replace('#', '')})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sublabel, color, sparkData, sparkKey, sparkColor }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-5 flex flex-col">
      <div className="flex items-start justify-between">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', color)}><Icon size={18} /></div>
      </div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mt-3">{label}</p>
      <p className="text-2xl font-black font-mono mt-0.5">{value}</p>
      {sublabel && <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>}
      {sparkData?.length > 1 && <Sparkline data={sparkData} dataKey={sparkKey || 'value'} color={sparkColor || '#3b82f6'} />}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-8 w-64 bg-muted rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array(8).fill(0).map((_, i) => <div key={i} className="h-36 rounded-2xl bg-muted" />)}</div>
      <div className="h-64 rounded-2xl bg-muted" />
    </div>
  );
}

// ─── Custom P&L Tooltip ───────────────────────────────────────────────────────
function PlTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const rows = [
    { key: 'revenue',  label: 'Revenue',      color: '#3b82f6' },
    { key: 'cogs',     label: 'COGS',         color: '#f59e0b' },
    { key: 'expenses', label: 'Expenses',     color: '#f43f5e' },
    { key: 'gross',    label: 'Gross Profit', color: '#10b981' },
    { key: 'net',      label: 'Net Profit',   color: '#8b5cf6' },
  ];
  return (
    <div className="rounded-xl border border-border/50 bg-card shadow-lg text-xs p-3 min-w-[160px]">
      <p className="font-bold mb-2 text-muted-foreground">{fmtDay(label)}</p>
      {rows.map(({ key, label: lbl, color }) => {
        const entry = payload.find((p) => p.dataKey === key);
        if (!entry) return null;
        return (
          <div key={key} className="flex justify-between gap-4 py-0.5">
            <span style={{ color }} className="font-semibold">{lbl}</span>
            <span className="font-mono font-bold">{fmtShort(entry.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Donut label ──────────────────────────────────────────────────────────────
function DonutLabel({ cx, cy, value, total }) {
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} dy="-0.4em" className="text-2xl font-black" fill="currentColor" fontSize={22} fontWeight={900}>{value}</tspan>
      <tspan x={cx} dy="1.4em" fontSize={11} fill="#94a3b8">of {total}</tspan>
    </text>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const { list } = useDataStore();
  const LOW_STOCK_THRESHOLD = useLowStockThreshold();

  const [period, setPeriod]   = useState('week');
  const [from, setFrom]       = useState('');
  const [to, setTo]           = useState('');
  const [overview, setOverview]   = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading]     = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const range = rangeForPeriod(period, from, to);
      const [dashRes, analyticsRes] = await Promise.all([
        cloudApi.get('/instances/dashboard'),
        cloudApi.get('/instances/analytics', { params: range }),
      ]);
      setOverview(dashRes.data.data);
      setAnalytics(analyticsRes.data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (period !== 'custom' || (from && to)) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, from, to]);

  const products    = list('product');
  const saleItems   = list('sale_item');
  const sales       = list('sale');
  const customers   = list('customer');
  const vendors     = list('vendor');
  const purchases   = list('purchase');
  const vendorPayments   = list('vendor_payment');
  const purchaseReturns  = list('purchase_return');
  const accounts    = list('account');
  const accountTxns = list('account_txn');

  // productById for unit_type lookup in COGS and stock value calculations
  const productById = useMemo(() => {
    const m = {};
    for (const p of products) m[String(p.id)] = p;
    return m;
  }, [products]);

  // Stock stats + donut
  const stockStats = useMemo(() => {
    let stockValue = 0, retailStockValue = 0;
    let inStockCount = 0, lowStockCount = 0, outOfStockCount = 0;
    const lowStockProducts = [];
    for (const p of products) {
      const stock = Number(p.stock || 0);
      // gram products: stock is in grams, price is per-kg — divide by 1000
      const isGram = p.unit_type === 'gram';
      // guard against astronomically wrong stock counts from cloud (pre-migration)
      const cappedStock = Math.min(Math.max(0, stock), isGram ? 100_000_000 : 1_000_000);
      const qty = isGram ? cappedStock / 1000 : cappedStock;
      // Match desktop SQL exactly:
      //   cost_value:   SUM(MIN(qty * MIN(purchase_price, 50M), 50M))
      //   retail_value: SUM(qty * price)  — no per-product cap on retail side
      const retailPrice = Number(p.price || 0);
      const pp = Math.min(Number(p.purchase_price || 0), 50_000_000);
      stockValue       += Math.min(qty * pp, 50_000_000);
      retailStockValue += qty * retailPrice;
      if (stock <= 0)                           { outOfStockCount++; }
      else if (stock <= LOW_STOCK_THRESHOLD)    { lowStockCount++;   lowStockProducts.push(p); }
      else                                       { inStockCount++; }
    }
    lowStockProducts.sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0));
    return {
      stockValue, retailStockValue,
      retailProfit: retailStockValue - stockValue,
      lowStockCount, totalItems: products.length,
      inStockCount, outOfStockCount,
      lowStockProducts: lowStockProducts.slice(0, 10),
      donut: [
        { name: 'In Stock',     value: inStockCount,    color: '#10b981' },
        { name: 'Low Stock',    value: lowStockCount,   color: '#f59e0b' },
        { name: 'Out of Stock', value: outOfStockCount, color: '#f43f5e' },
      ].filter((s) => s.value > 0),
    };
  }, [products, LOW_STOCK_THRESHOLD]);

  // Customer AR — use outstanding_balance maintained by the Electron app on each
  // customer record. Computing from sum(sales.total) overcounts because it treats
  // every named-customer sale as credit, including cash sales.
  const customerAR = useMemo(() => {
    const withBalance = customers
      .map((c) => ({ ...c, balance: Math.max(0, Number(c.outstanding_balance || 0)) }))
      .filter((c) => c.balance > 0.01)
      .sort((a, b) => b.balance - a.balance);
    return { totalAR: withBalance.reduce((s, c) => s + c.balance, 0), debtors: withBalance };
  }, [customers]);

  const payableVendors = useMemo(() => {
    return vendors.map((v) => {
      const vid    = String(v.id);
      const owed   = purchases.filter((p) => String(p.vendor_id) === vid && p.status !== 'Cancelled').reduce((s, p) => s + Number(p.grand_total || p.total || 0), 0);
      const paid   = vendorPayments.filter((p) => String(p.vendor_id) === vid).reduce((s, p) => s + Number(p.amount || 0), 0);
      const ret    = purchaseReturns.filter((r) => String(r.vendor_id) === vid).reduce((s, r) => s + Number(r.total_returned || 0), 0);
      return { ...v, balance: Math.max(0, owed - paid - ret) };
    }).filter((v) => v.balance > 0.01).sort((a, b) => b.balance - a.balance);
  }, [vendors, purchases, vendorPayments, purchaseReturns]);

  // Period analytics computed locally from synced data — the cloud analytics
  // endpoint includes Cancelled sales in salesByDay/totals (and can't be
  // changed), which inflated Period Revenue and Transactions vs the desktop.
  // Local calculation excludes cancelled and uses local-timezone day keys,
  // matching the Electron dashboard exactly.
  const expensesList = list('expense');
  const saleReturnsAll = list('sale_return');
  const saleReturnItemsAll = list('sale_return_item');
  const localAnalytics = useMemo(() => {
    const range = rangeForPeriod(period, from, to);
    const start = new Date(range.date_from);
    const end   = new Date(range.date_to);
    const dayKey = (d) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD, local tz
    const salesByDayMap = {};
    let count = 0, revenue = 0;
    for (const s of sales) {
      if (s.status === 'Cancelled' || !s.date_created) continue;
      const d = new Date(String(s.date_created).replace(' ', 'T'));
      if (isNaN(d) || d < start || d > end) continue;
      const day = dayKey(d);
      salesByDayMap[day] = (salesByDayMap[day] || 0) + Number(s.total || 0);
      count++;
      revenue += Number(s.total || 0);
    }
    // Deduct sale returns from revenue — refunded money isn't revenue.
    // Mirrors the Electron dashboard's returns deduction.
    for (const r of saleReturnsAll) {
      if (!r.date_created) continue;
      const d = new Date(String(r.date_created).replace(' ', 'T'));
      if (isNaN(d) || d < start || d > end) continue;
      const amt = Number(r.total_returned || 0);
      const day = dayKey(d);
      salesByDayMap[day] = (salesByDayMap[day] || 0) - amt;
      revenue -= amt;
    }
    const expByDayMap = {};
    let expTotal = 0;
    for (const e of expensesList) {
      const raw = e.date_created ?? e.date_added ?? e.date ?? e.created_at;
      if (!raw) continue;
      const d = new Date(String(raw).replace(' ', 'T'));
      if (isNaN(d) || d < start || d > end) continue;
      const amt = Number(e.amount || 0);
      expByDayMap[dayKey(d)] = (expByDayMap[dayKey(d)] || 0) + amt;
      expTotal += amt;
    }
    return {
      salesByDay: Object.entries(salesByDayMap).map(([day, rev]) => ({ day, revenue: rev })),
      expensesByDay: Object.entries(expByDayMap).map(([day, amount]) => ({ day, amount })),
      totals: { sales: count, revenue, expenses: expTotal },
    };
  }, [sales, saleReturnsAll, expensesList, period, from, to]);

  const pnl = useMemo(() => buildPnl(localAnalytics, saleItems, sales, productById, saleReturnItemsAll, saleReturnsAll), [localAnalytics, saleItems, sales, productById, saleReturnItemsAll, saleReturnsAll]);

  // Payment method breakdown from local sales filtered by period
  const paymentBreakdown = useMemo(() => {
    const range = rangeForPeriod(period, from, to);
    const rangeFrom = new Date(range.date_from);
    const rangeTo   = new Date(range.date_to);
    const inRange = sales.filter((s) => {
      if (s.status === 'Cancelled') return false;
      if (!s.date_created) return true;
      const d = new Date(s.date_created);
      return d >= rangeFrom && d <= rangeTo;
    });
    const map = new Map();
    for (const s of inRange) {
      const method = (s.payment_method || 'cash').toLowerCase();
      const entry  = map.get(method) || { name: method, count: 0, revenue: 0 };
      entry.count++;
      entry.revenue += Number(s.total || 0);
      map.set(method, entry);
    }
    const COLORS = { cash: '#10b981', online: '#3b82f6', credit: '#f59e0b', udhaar: '#8b5cf6', card: '#06b6d4', other: '#94a3b8' };
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .map((m) => ({ ...m, color: COLORS[m.name] || COLORS.other, label: m.name.charAt(0).toUpperCase() + m.name.slice(1) }));
  }, [sales, period, from, to]);

  const recentSales = useMemo(() =>
    sales.filter((s) => s.status === 'Completed').slice().sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0)).slice(0, 10),
  [sales]);

  // Today's revenue computed locally from synced sales. The cloud endpoint
  // compares date_created as a STRING against an ISO timestamp, but Electron
  // stores dates as "YYYY-MM-DD HH:MM:SS" (space < 'T'), so every desktop sale
  // is excluded server-side and the cloud figure reads 0. Local calculation is
  // also timezone-correct (local midnight, not server midnight).
  const todayRevenue = useMemo(() => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const gross = sales.reduce((sum, s) => {
      if (s.status === 'Cancelled' || !s.date_created) return sum;
      const d = new Date(String(s.date_created).replace(' ', 'T'));
      return d >= midnight ? sum + Number(s.total || 0) : sum;
    }, 0);
    // Net of today's returns — same as the Electron dashboard
    const returnedToday = saleReturnsAll.reduce((sum, r) => {
      if (!r.date_created) return sum;
      const d = new Date(String(r.date_created).replace(' ', 'T'));
      return d >= midnight ? sum + Number(r.total_returned || 0) : sum;
    }, 0);
    return gross - returnedToday;
  }, [sales, saleReturnsAll]);

  const accountsSummary = useMemo(() => {
    const withBalance = accounts.map((a) => {
      const delta = accountTxns.filter((t) => String(t.account_id) === String(a.id))
        .reduce((s, t) => s + (t.type === 'in' ? Number(t.amount || 0) : -Number(t.amount || 0)), 0);
      return { ...a, balance: Number(a.opening_balance || 0) + delta };
    });
    return {
      accounts: withBalance,
      cashTotal: withBalance.filter((a) => a.type === 'cash').reduce((s, a) => s + a.balance, 0),
      bankTotal: withBalance.filter((a) => a.type === 'bank').reduce((s, a) => s + a.balance, 0),
      netTotal:  withBalance.reduce((s, a) => s + a.balance, 0),
    };
  }, [accounts, accountTxns]);

  const topProducts  = analytics?.topProducts || [];
  const periodLabel  = { today: 'today', week: 'last 7 days', month: 'this month', year: 'this year', custom: 'selected period' }[period];
  const greet        = greeting();

  // Sparkline data
  const revSparkline  = pnl.series.slice(-10).map((d) => ({ date: d.date, value: d.revenue }));
  const netSparkline  = pnl.series.slice(-10).map((d) => ({ date: d.date, value: Math.max(0, d.gross) }));

  if (loading && !overview) return <Skeleton />;

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {greet.emoji} {greet.text}, <span className="text-primary">{user?.owner_name || user?.store_name}</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Here's what's happening with your store.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-xl bg-muted/40 border border-border/30 p-0.5 gap-0.5">
              {PERIOD_OPTS.map(([val, lbl]) => (
                <button key={val} onClick={() => setPeriod(val)}
                  className={cn('px-3 h-8 rounded-lg text-sm font-semibold transition-all', period === val ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                  {lbl}
                </button>
              ))}
            </div>
            {period === 'custom' && (
              <div className="flex items-center gap-2">
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 px-2.5 rounded-lg border border-border bg-background text-xs" />
                <span className="text-muted-foreground text-xs">—</span>
                <input type="date" value={to}   onChange={(e) => setTo(e.target.value)}   className="h-9 px-2.5 rounded-lg border border-border bg-background text-xs" />
              </div>
            )}
            <button onClick={load} className="w-9 h-9 rounded-xl border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── Period KPIs (Revenue / Gross Profit / Net Profit / Transactions / Today) ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard icon={DollarSign}    label="Period Revenue"  value={fmtPKR(pnl.totals.revenue)}    sublabel={periodLabel}   color="text-blue-600 bg-blue-500/10"     sparkData={revSparkline} sparkKey="value" sparkColor="#3b82f6" />
        <KpiCard icon={TrendingUp}    label="Gross Profit"    value={fmtPKR(pnl.totals.gross)}      sublabel={`COGS: ${fmtPKR(pnl.totals.cogs)}`}   color="text-emerald-600 bg-emerald-500/10" sparkData={pnl.series.slice(-10).map(d => ({ date: d.date, value: Math.max(0, d.gross) }))} sparkKey="value" sparkColor="#10b981" />
        <KpiCard icon={TrendingDown}  label="Net Profit"      value={fmtPKR(pnl.totals.net)}        sublabel={`Exp: ${fmtPKR(pnl.totals.expenses)}`} color={pnl.totals.net >= 0 ? 'text-violet-600 bg-violet-500/10' : 'text-rose-600 bg-rose-500/10'} sparkData={pnl.series.slice(-10).map(d => ({ date: d.date, value: d.net }))} sparkKey="value" sparkColor="#8b5cf6" />
        <KpiCard icon={Activity}      label="Transactions"    value={localAnalytics.totals.sales}   sublabel={periodLabel}   color="text-purple-600 bg-purple-500/10" />
        <KpiCard icon={Zap}           label="Today's Revenue" value={fmtPKR(todayRevenue)}           sublabel="vs this month" color="text-amber-600 bg-amber-500/10" />
      </motion.div>

      {/* ── Store KPIs (Stock / AR / Low Stock) ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Boxes}         label="Stock Value"     value={fmtPKR(stockStats.stockValue)}       sublabel="Total inventory at cost"              color="text-blue-600 bg-blue-500/10" />
        <KpiCard icon={PiggyBank}     label="Retail Stock"    value={fmtPKR(stockStats.retailStockValue)} sublabel={`Profit: ${fmtPKR(stockStats.retailProfit)}`} color="text-emerald-600 bg-emerald-500/10" />
        <KpiCard icon={Wallet}        label="Customer Credit" value={fmtPKR(customerAR.totalAR)}          sublabel={`${customerAR.debtors.length} debtors`}       color="text-purple-600 bg-purple-500/10" />
        <KpiCard icon={AlertTriangle} label="Low Stock"       value={stockStats.lowStockCount}            sublabel="Below threshold"                              color={stockStats.lowStockCount > 0 ? 'text-rose-600 bg-rose-500/10' : 'text-muted-foreground bg-muted/40'} />
      </motion.div>

      {/* ── Accounts summary ── */}
      {accounts.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3}>
          <div className="rounded-2xl bg-card relative overflow-hidden"
            style={{ border: '1px solid rgba(16,185,129,0.2)', boxShadow: '0 4px 24px -4px rgba(16,185,129,0.10), 0 1px 4px rgba(0,0,0,0.05)' }}>
            {/* Top accent bar */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-400" />
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <Wallet size={15} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Accounts & Cash</h3>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">Live balances across all accounts</p>
                </div>
              </div>
              <Link to="/accounts" className="h-8 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground rounded-xl px-2 transition-colors">
                View All <ArrowUpRight size={12} />
              </Link>
            </div>
            <div className="px-5 pb-5">
              {/* Summary totals */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'Cash in Hand', value: accountsSummary.cashTotal, borderCls: 'border-emerald-500/20 bg-emerald-500/5', valCls: 'text-emerald-600 dark:text-emerald-400' },
                  { label: 'Bank Total',   value: accountsSummary.bankTotal, borderCls: 'border-blue-500/20 bg-blue-500/5',       valCls: 'text-blue-600 dark:text-blue-400' },
                  { label: 'Net Funds',    value: accountsSummary.netTotal,  borderCls: accountsSummary.netTotal >= 0 ? 'border-violet-500/20 bg-violet-500/5' : 'border-red-400/20 bg-red-500/5', valCls: accountsSummary.netTotal >= 0 ? 'text-violet-600 dark:text-violet-400' : 'text-red-600 dark:text-red-400' },
                ].map(({ label, value, borderCls, valCls }) => (
                  <div key={label} className={cn('rounded-xl border px-3 py-2.5', borderCls)}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">{label}</p>
                    <p className={cn('text-sm font-black mt-0.5 truncate', valCls)}>{fmtPKR(value)}</p>
                  </div>
                ))}
              </div>
              {/* Per-account cards */}
              {accountsSummary.accounts.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {accountsSummary.accounts.map((acc) => (
                    <div key={acc.id} className={cn(
                      'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors',
                      acc.type === 'cash'
                        ? 'bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/25'
                        : 'bg-blue-500/5 border-blue-500/10 hover:border-blue-500/25'
                    )}>
                      <div className={cn('w-2 h-2 rounded-full flex-shrink-0', acc.type === 'cash' ? 'bg-emerald-500' : 'bg-blue-500')} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold truncate text-foreground">{acc.name}</p>
                        {acc.bank_name && <p className="text-[9px] text-muted-foreground/60 truncate">{acc.bank_name}</p>}
                        <p className={cn('text-[11px] font-black truncate', acc.type === 'cash' ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400')}>
                          {fmtPKR(acc.balance)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Revenue chart + Stock donut ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3} className="grid md:grid-cols-3 gap-6">

        {/* Revenue area chart */}
        <div className="md:col-span-2 rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b bg-muted/5">
            <h2 className="text-sm font-bold">Revenue Trend</h2>
            <p className="text-xs text-muted-foreground">Daily sales — {periodLabel}</p>
          </div>
          {pnl.series.length > 0 ? (
            <div className="h-44 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pnl.series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border,#e5e7eb)" opacity={0.4} />
                  <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip formatter={(v) => [fmtPKR(v), 'Revenue']} labelFormatter={fmtDay} contentStyle={{ borderRadius: 12, border: '1px solid var(--border,#e5e7eb)', fontSize: 12, padding: '8px 12px' }} />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revG)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">No data for {periodLabel}</div>
          )}
        </div>

        {/* Stock donut */}
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b bg-muted/5 flex items-center justify-between">
            <h2 className="text-sm font-bold">Stock Summary</h2>
            <Link to="/inventory" className="text-xs font-semibold text-primary hover:underline">View</Link>
          </div>
          <div className="flex flex-col items-center pt-3 pb-2">
            {stockStats.donut.length > 0 ? (
              <div className="relative">
                <PieChart width={140} height={140}>
                  <Pie
                    data={stockStats.donut}
                    cx={66} cy={66}
                    innerRadius={44} outerRadius={62}
                    paddingAngle={3}
                    dataKey="value"
                    startAngle={90} endAngle={-270}
                    strokeWidth={0}
                  >
                    {stockStats.donut.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                  </Pie>
                </PieChart>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black">{stockStats.totalItems}</span>
                  <span className="text-[10px] text-muted-foreground">products</span>
                </div>
              </div>
            ) : (
              <div className="h-[140px] flex items-center justify-center text-xs text-muted-foreground">No products</div>
            )}
            <div className="w-full px-4 pb-3 space-y-2 mt-1">
              {[
                { label: 'In Stock',     count: stockStats.inStockCount,     color: '#10b981' },
                { label: 'Low Stock',    count: stockStats.lowStockCount,    color: '#f59e0b' },
                { label: 'Out of Stock', count: stockStats.outOfStockCount,  color: '#f43f5e' },
              ].map(({ label, count, color }) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                    <span className="text-muted-foreground">{label}</span>
                  </div>
                  <span className="font-bold">{count}</span>
                </div>
              ))}
              <div className="pt-1 border-t border-border/30 flex justify-between text-xs">
                <span className="text-muted-foreground">Cost Value</span>
                <span className="font-bold font-mono text-blue-600">{fmtShort(stockStats.stockValue)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Retail Value</span>
                <span className="font-bold font-mono text-emerald-600">{fmtShort(stockStats.retailStockValue)}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── P&L ComposedChart (5 series) ── */}
      {pnl.series.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4}>
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
            <div className="px-5 pt-5 pb-4 border-b bg-muted/5 flex items-start justify-between">
              <div>
                <h2 className="text-sm font-bold">Profit & Loss</h2>
                <p className="text-xs text-muted-foreground">Revenue · COGS · Expenses · Gross · Net — {periodLabel}</p>
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-semibold">
                {[['Revenue','#3b82f6'],['COGS','#f59e0b'],['Expenses','#f43f5e'],['Gross','#10b981'],['Net','#8b5cf6']].map(([lbl, clr]) => (
                  <span key={lbl} className="flex items-center gap-1 text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-sm inline-block shrink-0" style={{ background: clr }} />{lbl}
                  </span>
                ))}
              </div>
            </div>
            <div className="h-56 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={pnl.series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pGross" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}    />
                    </linearGradient>
                    <linearGradient id="pNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border,#e5e7eb)" opacity={0.35} />
                  <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip content={<PlTooltip />} />
                  <Bar    dataKey="revenue"  fill="#3b82f6" fillOpacity={0.18} radius={[3,3,0,0]} />
                  <Line  dataKey="cogs"     stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
                  <Line  dataKey="expenses" stroke="#f43f5e" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
                  <Area  dataKey="gross"    stroke="#10b981" strokeWidth={2}   dot={false} fill="url(#pGross)" />
                  <Area  dataKey="net"      stroke="#8b5cf6" strokeWidth={2}   dot={false} fill="url(#pNet)" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {/* Totals strip */}
            <div className="grid grid-cols-5 divide-x divide-border/30 border-t border-border/30">
              {[
                ['Revenue',  pnl.totals.revenue,  'text-blue-600'],
                ['COGS',     pnl.totals.cogs,     'text-amber-600'],
                ['Expenses', pnl.totals.expenses, 'text-rose-600'],
                ['Gross',    pnl.totals.gross,    'text-emerald-600'],
                ['Net',      pnl.totals.net,      'text-violet-600'],
              ].map(([lbl, val, cls]) => (
                <div key={lbl} className="flex flex-col items-center py-3 gap-0.5 bg-muted/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{lbl}</p>
                  <p className={cn('text-sm font-black font-mono', cls)}>{fmtPKR(val)}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Payment method breakdown ── */}
      {paymentBreakdown.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}>
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b bg-muted/10">
              <h2 className="text-base font-bold">Payment Methods</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Breakdown by payment type — {periodLabel}</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4 p-5">
              {/* Donut */}
              <div className="relative shrink-0">
                <PieChart width={160} height={160}>
                  <Pie
                    data={paymentBreakdown}
                    cx={76} cy={76}
                    innerRadius={50} outerRadius={70}
                    paddingAngle={3}
                    dataKey="revenue"
                    startAngle={90} endAngle={-270}
                    strokeWidth={0}
                  >
                    {paymentBreakdown.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                  </Pie>
                </PieChart>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black">{paymentBreakdown.reduce((s, m) => s + m.count, 0)}</span>
                  <span className="text-[10px] text-muted-foreground">sales</span>
                </div>
              </div>
              {/* Legend + stats */}
              <div className="flex-1 min-w-0 space-y-2.5 w-full">
                {paymentBreakdown.map((m) => {
                  const total = paymentBreakdown.reduce((s, x) => s + x.revenue, 0);
                  const pct   = total > 0 ? Math.round((m.revenue / total) * 100) : 0;
                  return (
                    <div key={m.name}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: m.color }} />
                          <span className="font-semibold">{m.label}</span>
                          <span className="text-muted-foreground">({m.count} sale{m.count !== 1 ? 's' : ''})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold">{fmtShort(m.revenue)}</span>
                          <span className="text-muted-foreground w-8 text-right">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: m.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Quick actions ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={6}>
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b bg-muted/10"><h2 className="text-base font-bold">Quick Actions</h2></div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 p-5">
            {QUICK.map(({ to, label, icon: Icon, color }) => (
              <Link key={to} to={to}
                className="flex flex-col items-center gap-2 rounded-2xl border border-border/40 p-3 text-center hover:border-primary/30 hover:bg-primary/5 hover:-translate-y-0.5 transition-all duration-200">
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', color)}><Icon size={16} /></div>
                <span className="text-[10px] font-semibold text-muted-foreground">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Low stock alerts ── */}
      {stockStats.lowStockProducts.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={7}>
          <div className="rounded-2xl border border-rose-400/30 bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-rose-500/5">
              <div className="flex items-center gap-2.5">
                <AlertTriangle size={15} className="text-rose-500" />
                <h2 className="text-base font-bold">Low Stock Alerts</h2>
                <span className="text-xs bg-rose-500/10 text-rose-600 px-2 py-0.5 rounded-full font-bold">{stockStats.lowStockCount}</span>
              </div>
              <Link to="/inventory" className="text-xs font-semibold text-primary hover:underline">View All</Link>
            </div>
            <div className="divide-y divide-border/20">
              {stockStats.lowStockProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div><p className="text-sm font-semibold">{p.name}</p><p className="text-xs text-muted-foreground">{p.category || 'Uncategorized'}</p></div>
                  <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full border', Number(p.stock) <= 0 ? 'bg-rose-500/10 text-rose-700 border-rose-400/20' : 'bg-amber-500/10 text-amber-700 border-amber-400/20')}>
                    {Number(p.stock) <= 0 ? 'Out of Stock' : `${p.stock} left`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── AR / AP ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={8} className="grid md:grid-cols-2 gap-6">
        {/* Receivables */}
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b bg-muted/10">
            <div className="flex items-center gap-2.5"><Users size={14} className="text-muted-foreground" /><h2 className="text-sm font-bold">Receivable (AR)</h2></div>
            <Link to="/payment-ledger" className="text-xs font-semibold text-primary hover:underline">View All</Link>
          </div>
          <div className="divide-y divide-border/20">
            {customerAR.debtors.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3">
                <div><p className="text-sm font-semibold">{c.name}</p><p className="text-xs text-muted-foreground">{c.phone || '—'}</p></div>
                <span className="font-mono font-bold text-sm text-emerald-600">{fmtPKR(c.balance)}</span>
              </div>
            ))}
            {customerAR.debtors.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No outstanding receivables</p>}
          </div>
        </div>

        {/* Payables */}
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b bg-muted/10">
            <div className="flex items-center gap-2.5"><Truck size={14} className="text-muted-foreground" /><h2 className="text-sm font-bold">Payable (AP)</h2></div>
            <Link to="/payment-ledger" className="text-xs font-semibold text-primary hover:underline">View All</Link>
          </div>
          <div className="divide-y divide-border/20">
            {payableVendors.slice(0, 5).map((v) => (
              <div key={v.id} className="flex items-center justify-between px-5 py-3">
                <div><p className="text-sm font-semibold">{v.name}</p><p className="text-xs text-muted-foreground">{v.phone || '—'}</p></div>
                <span className="font-mono font-bold text-sm text-amber-600">{fmtPKR(v.balance)}</span>
              </div>
            ))}
            {payableVendors.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No outstanding payables</p>}
          </div>
        </div>
      </motion.div>

      {/* ── Top products + Recent sales ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={9} className="grid md:grid-cols-2 gap-6">
        {topProducts.length > 0 && (
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b bg-muted/10 flex items-center justify-between">
              <h2 className="text-sm font-bold">Top Products</h2>
              <span className="text-xs text-muted-foreground">{periodLabel}</span>
            </div>
            <div className="divide-y divide-border/20">
              {topProducts.slice(0, 5).map((p, idx) => (
                <div key={p.product_id || idx} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-5 h-5 rounded-full bg-muted text-[10px] font-black text-muted-foreground flex items-center justify-center">{idx + 1}</span>
                  <span className="text-sm font-semibold flex-1 truncate">{p.name}</span>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-mono font-bold text-blue-600">{fmtPKR(p.revenue)}</p>
                    <p className="text-[10px] text-muted-foreground">{p.quantity} sold</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b bg-muted/10">
            <h2 className="text-sm font-bold">Recent Sales</h2>
            <Link to="/sales/history" className="text-xs font-semibold text-primary hover:underline">View All</Link>
          </div>
          <div className="divide-y divide-border/20">
            {recentSales.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-mono text-xs font-bold text-muted-foreground">INV-{String(s.id).slice(-6)}</p>
                  <p className="text-xs text-muted-foreground">{fmtDT(s.date_created)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono font-bold text-emerald-600">{fmtPKR(s.total)}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{s.payment_method}</p>
                </div>
              </div>
            ))}
            {recentSales.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No sales yet</p>}
          </div>
        </div>
      </motion.div>

    </div>
  );
}
