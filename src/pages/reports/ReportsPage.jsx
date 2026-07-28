import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area,
} from 'recharts';
import {
  BarChart2, TrendingUp, ShoppingCart, Percent, ChevronRight, Calendar, X, Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';

const fmtPKR = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const fmtShort = (n) => {
  const v = Math.abs(Number(n) || 0);
  if (v >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return (n / 1_000).toFixed(0) + 'k';
  return String(Math.round(n));
};
const fmtDay = (k) => new Date(k).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.055, ease: [0.23, 1, 0.32, 1] } }),
};

export default function ReportsPage() {
  const { list } = useDataStore();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const allSales = list('sale');
  const saleItems = list('sale_item');
  const expenses = list('expense');
  const customerById = useMemo(() => new Map(list('customer').map((c) => [String(c.id), c])), [list]);

  const sales = useMemo(() => {
    return allSales
      .filter((s) => s.status === 'Completed')
      .filter((s) => {
        if (!s.date_created) return true;
        const d = new Date(s.date_created);
        if (from && d < new Date(from)) return false;
        if (to && d > new Date(new Date(to).getTime() + 86400000)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0));
  }, [allSales, from, to]);

  const saleIds = useMemo(() => new Set(sales.map((s) => String(s.id))), [sales]);
  const itemsInRange = useMemo(() => saleItems.filter((i) => saleIds.has(String(i.sale_id))), [saleItems, saleIds]);

  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total || 0), 0);
  const totalProfit = itemsInRange.reduce((sum, i) => sum + (Number(i.price || 0) - Number(i.purchase_price || 0)) * Number(i.quantity || 0), 0);
  const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const topProducts = useMemo(() => {
    const map = new Map();
    for (const i of itemsInRange) {
      const key = String(i.product_id ?? i.product_name);
      const entry = map.get(key) || { name: i.product_name, qtySold: 0, revenue: 0, profit: 0 };
      entry.qtySold += Number(i.quantity || 0);
      entry.revenue += Number(i.price || 0) * Number(i.quantity || 0);
      entry.profit += (Number(i.price || 0) - Number(i.purchase_price || 0)) * Number(i.quantity || 0);
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [itemsInRange]);

  const pnl = useMemo(() => {
    const dayOf = new Map(sales.map((s) => [String(s.id), String(s.date_created || '').slice(0, 10)]));
    const revenueByDay = {};
    const cogsByDay = {};
    for (const s of sales) {
      const day = String(s.date_created || '').slice(0, 10);
      if (!day) continue;
      revenueByDay[day] = (revenueByDay[day] || 0) + Number(s.total || 0);
    }
    for (const i of itemsInRange) {
      const day = dayOf.get(String(i.sale_id));
      if (!day) continue;
      cogsByDay[day] = (cogsByDay[day] || 0) + Number(i.purchase_price || 0) * Number(i.quantity || 0);
    }
    const expenseByDay = {};
    for (const e of expenses) {
      const day = String(e.date_added || '').slice(0, 10);
      if (!day) continue;
      if (from && day < from) continue;
      if (to && day > to) continue;
      expenseByDay[day] = (expenseByDay[day] || 0) + Number(e.amount || 0);
    }
    const days = Array.from(new Set([...Object.keys(revenueByDay), ...Object.keys(cogsByDay), ...Object.keys(expenseByDay)])).sort();
    return days.map((date) => {
      const revenue = revenueByDay[date] || 0;
      const cogs = cogsByDay[date] || 0;
      const expAmt = expenseByDay[date] || 0;
      return { date, revenue, cogs, expenses: expAmt, gross: revenue - cogs, net: revenue - cogs - expAmt };
    });
  }, [sales, itemsInRange, expenses, from, to]);

  const clearFilters = () => { setFrom(''); setTo(''); };

  return (
    <div className="flex flex-col gap-6 max-w-5xl">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
          <span>Home</span><ChevronRight size={12} /><span className="text-foreground font-medium">Reports</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Sales performance and profitability overview</p>
          </div>
          {/* Date filters */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <Calendar size={13} className="text-muted-foreground" />
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs focus:outline-none" />
            </div>
            <span className="text-muted-foreground text-xs">—</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs focus:outline-none" />
            {(from || to) && (
              <button onClick={clearFilters} className="h-8 w-8 rounded-lg border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted">
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Stat cards */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: fmtPKR(totalRevenue), icon: BarChart2, color: 'text-blue-600 bg-blue-500/10' },
          { label: 'Gross Profit', value: fmtPKR(totalProfit), icon: TrendingUp, color: 'text-emerald-600 bg-emerald-500/10' },
          { label: 'Transactions', value: sales.length, icon: ShoppingCart, color: 'text-purple-600 bg-purple-500/10' },
          { label: 'Avg. Margin', value: margin.toFixed(1) + '%', icon: Percent, color: 'text-amber-600 bg-amber-500/10' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-border/50 bg-card shadow-sm p-5">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', color)}><Icon size={18} /></div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-2xl font-black font-mono mt-1">{value}</p>
          </div>
        ))}
      </motion.div>

      {/* P&L Chart */}
      {pnl.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
            <div className="px-5 pt-5 pb-4 border-b bg-muted/5">
              <h2 className="text-base font-bold">Revenue & Profit Trend</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Daily revenue vs gross profit</p>
            </div>
            <div className="h-56 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pnl} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border,#e5e7eb)" opacity={0.4} />
                  <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 10, fill: 'var(--muted-foreground,#64748b)' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10, fill: 'var(--muted-foreground,#64748b)' }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip
                    formatter={(v, name) => [fmtPKR(v), name === 'revenue' ? 'Revenue' : name === 'gross' ? 'Gross Profit' : name]}
                    labelFormatter={fmtDay}
                    contentStyle={{ borderRadius: 12, border: '1px solid var(--border,#e5e7eb)', fontSize: 12, padding: '8px 12px' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revGrad)" dot={false} name="revenue" />
                  <Area type="monotone" dataKey="gross" stroke="#10b981" strokeWidth={2} fill="url(#profGrad)" dot={false} name="gross" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* Mini totals strip */}
            <div className="grid grid-cols-5 divide-x divide-border/30 border-t border-border/30">
              {[
                { label: 'Revenue', value: fmtPKR(pnl.reduce((s, d) => s + d.revenue, 0)), color: 'text-blue-600' },
                { label: 'COGS', value: fmtPKR(pnl.reduce((s, d) => s + d.cogs, 0)), color: 'text-amber-600' },
                { label: 'Expenses', value: fmtPKR(pnl.reduce((s, d) => s + d.expenses, 0)), color: 'text-rose-600' },
                { label: 'Gross', value: fmtPKR(pnl.reduce((s, d) => s + d.gross, 0)), color: 'text-emerald-600' },
                { label: 'Net', value: fmtPKR(pnl.reduce((s, d) => s + d.net, 0)), color: 'text-primary' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex flex-col items-center py-3 gap-0.5 bg-muted/5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                  <p className={cn('text-sm font-bold font-mono', color)}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Top products + sales table row */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3} className="grid md:grid-cols-2 gap-6">

        {/* Top Products */}
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b bg-muted/10">
            <Package size={15} className="text-muted-foreground" />
            <h2 className="text-sm font-bold">Top Products</h2>
            <span className="text-xs text-muted-foreground ml-auto">by revenue</span>
          </div>
          {topProducts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground py-8">
              <Package size={28} className="opacity-15" />
              <p className="text-xs">No sales data</p>
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {topProducts.map((p, i) => (
                <div key={p.name || i} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xs font-black text-muted-foreground/50 w-4 shrink-0">{i + 1}</span>
                    <span className="text-sm font-semibold truncate">{p.name || '—'}</span>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-mono font-bold text-blue-600">{fmtPKR(p.revenue)}</p>
                    <p className="text-[10px] text-muted-foreground">{p.qtySold} sold</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sales table */}
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b bg-muted/10">
            <ShoppingCart size={15} className="text-muted-foreground" />
            <h2 className="text-sm font-bold">Sales List</h2>
            <span className="text-xs text-muted-foreground ml-auto">{sales.length} sale{sales.length !== 1 ? 's' : ''}</span>
          </div>
          {sales.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground py-8">
              <ShoppingCart size={28} className="opacity-15" />
              <p className="text-xs">No sales in this period</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-96 divide-y divide-border/20">
              {sales.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors">
                  <div>
                    <p className="text-xs font-bold font-mono text-muted-foreground">INV-{String(s.id).slice(-6)}</p>
                    <p className="text-sm font-semibold">{customerById.get(String(s.customer_id))?.name || 'Walk-in'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-bold text-emerald-600">{fmtPKR(s.total)}</p>
                    <p className="text-[10px] text-muted-foreground">{fmtDate(s.date_created)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
