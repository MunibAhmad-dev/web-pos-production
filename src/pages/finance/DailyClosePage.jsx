import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, ShoppingCart, TrendingDown, ArrowDownLeft, ArrowUpRight, Sigma,
  ChevronRight, Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { buildTransactionLedger } from '../../utils/ledger';

const fmtPKR = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
const fmtDay = (k) => new Date(k).toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.055, ease: [0.23, 1, 0.32, 1] } }),
};

const STAT_CFG = [
  { key: 'totalSales',   label: 'Sales Revenue',  icon: ShoppingCart,  color: 'text-blue-600',    bg: 'bg-blue-500/10'    },
  { key: 'totalExpenses',label: 'Expenses',        icon: TrendingDown,  color: 'text-rose-600',    bg: 'bg-rose-500/10'    },
  { key: 'cashIn',       label: 'Cash In',         icon: ArrowDownLeft, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
  { key: 'cashOut',      label: 'Cash Out',        icon: ArrowUpRight,  color: 'text-amber-600',   bg: 'bg-amber-500/10'   },
  { key: 'netCash',      label: 'Net Cash',        icon: Sigma,         color: 'text-primary',     bg: 'bg-primary/10'     },
];

export default function DailyClosePage() {
  const { list } = useDataStore();

  const ledger = useMemo(
    () => buildTransactionLedger({
      sales: list('sale'),
      saleReturns: list('sale_return'),
      purchaseReturns: list('purchase_return'),
      expenses: list('expense'),
      customerPayments: list('customer_payment'),
      vendorPayments: list('vendor_payment'),
      financialTxns: list('financial_transaction'),
    }),
    [list]
  );

  const sales = list('sale');
  const expenses = list('expense');
  const today = dayKey(new Date());

  const summaryFor = (key) => {
    const totalSales = sales
      .filter((s) => s.status === 'Completed' && s.date_created && dayKey(s.date_created) === key)
      .reduce((sum, s) => sum + Number(s.total || 0), 0);
    const totalExpenses = expenses
      .filter((e) => (e.date_added || e.date_created) && dayKey(e.date_added || e.date_created) === key)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const dayTxns = ledger.filter((t) => t.date && dayKey(t.date) === key);
    const cashIn = dayTxns.filter((t) => t.direction === 'in').reduce((sum, t) => sum + t.amount, 0);
    const cashOut = dayTxns.filter((t) => t.direction === 'out').reduce((sum, t) => sum + t.amount, 0);
    return { date: key, totalSales, totalExpenses, cashIn, cashOut, netCash: cashIn - cashOut };
  };

  const summary = summaryFor(today);

  const history = useMemo(() => {
    const days = new Set();
    for (const t of ledger) if (t.date) days.add(dayKey(t.date));
    for (const s of sales) if (s.date_created) days.add(dayKey(s.date_created));
    for (const e of expenses) {
      const d = e.date_added || e.date_created;
      if (d) days.add(dayKey(d));
    }
    return Array.from(days)
      .sort((a, b) => (a < b ? 1 : -1))
      .slice(0, 30)
      .map(summaryFor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledger, sales, expenses]);

  return (
    <div className="flex flex-col gap-6 max-w-5xl">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
          <span>Home</span><ChevronRight size={12} /><span className="text-foreground font-medium">Daily Close</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Daily Close</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Today's totals and daily history overview</p>
      </motion.div>

      {/* Today banner */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}>
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="relative p-6 border-b" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1a2a3a 100%)' }}>
            <div className="pointer-events-none absolute top-0 right-0 w-40 h-40 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="relative flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Calendar size={14} className="text-blue-400" />
                  <span className="text-blue-300/80 text-xs font-semibold uppercase tracking-wider">{fmtDay(today)}</span>
                </div>
                <h2 className="text-white text-xl font-black">Today's Summary</h2>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                <BarChart3 size={18} className="text-blue-300" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-6">
            {STAT_CFG.map(({ key, label, icon: Icon, color, bg }) => (
              <div key={key} className="rounded-xl border border-border/40 bg-muted/10 p-4">
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-2.5', bg)}>
                  <Icon size={16} className={color} />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className={cn('text-base font-black font-mono mt-0.5', color)}>{fmtPKR(summary[key])}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* History table */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b bg-muted/10">
            <Calendar size={15} className="text-muted-foreground" />
            <h2 className="text-base font-bold">Recent Days</h2>
            <span className="text-xs text-muted-foreground ml-auto">{history.length} day{history.length !== 1 ? 's' : ''}</span>
          </div>
          {history.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground py-12">
              <Calendar size={32} className="opacity-15" />
              <p className="text-sm">No activity recorded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted/20 border-b border-border/40">
                  {['Date', 'Sales', 'Expenses', 'Cash In', 'Cash Out', 'Net Cash'].map((h) => (
                    <th key={h} className={cn('text-xs font-semibold text-muted-foreground py-3',
                      h === 'Date' ? 'text-left pl-5' : 'text-right', h === 'Net Cash' ? 'pr-5' : '')}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {history.map((r, idx) => {
                    const isToday = r.date === today;
                    const netColor = r.netCash >= 0 ? 'text-emerald-600' : 'text-rose-600';
                    return (
                      <tr key={r.date}
                        className={cn('border-b border-border/20 last:border-0 hover:bg-muted/20 transition-colors', isToday && 'bg-primary/5')}>
                        <td className="py-3 pl-5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{fmtDay(r.date)}</span>
                            {isToday && <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-bold">Today</span>}
                          </div>
                        </td>
                        <td className="py-3 text-right font-mono text-blue-600 font-semibold">{fmtPKR(r.totalSales)}</td>
                        <td className="py-3 text-right font-mono text-rose-600">{fmtPKR(r.totalExpenses)}</td>
                        <td className="py-3 text-right font-mono text-emerald-600">{fmtPKR(r.cashIn)}</td>
                        <td className="py-3 text-right font-mono text-amber-600">{fmtPKR(r.cashOut)}</td>
                        <td className={cn('py-3 pr-5 text-right font-mono font-bold', netColor)}>{fmtPKR(r.netCash)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
