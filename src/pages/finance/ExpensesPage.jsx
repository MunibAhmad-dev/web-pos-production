import { useState, useMemo } from 'react';
import { usePagination } from '../../hooks/usePagination';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign, Plus, Trash2, FileText, Activity,
  X, TrendingDown, Layers, BarChart2, CalendarDays,
} from 'lucide-react';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { formatCurrency, formatDate } from '../../utils/format';
import { cn } from '@/lib/utils';

/* ─── Animations ──────────────────────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1], delay: Math.min(i, 5) * 0.06 },
  }),
};

/* ─── Category colour palette ─────────────────────────────────────────────── */
const CATEGORY_PALETTE = {
  rent:        { pill: 'bg-violet-500/10 border border-violet-500/20 text-violet-700 dark:text-violet-400', dot: 'bg-violet-500' },
  utilities:   { pill: 'bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400',         dot: 'bg-blue-500' },
  electricity: { pill: 'bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400',         dot: 'bg-blue-500' },
  salary:      { pill: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  salaries:    { pill: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  maintenance: { pill: 'bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400',     dot: 'bg-amber-500' },
  supplies:    { pill: 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-700 dark:text-cyan-400',         dot: 'bg-cyan-500' },
  food:        { pill: 'bg-orange-500/10 border border-orange-500/20 text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
  transport:   { pill: 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-400', dot: 'bg-indigo-500' },
  misc:        { pill: 'bg-zinc-500/10 border border-zinc-500/20 text-zinc-600 dark:text-zinc-400',         dot: 'bg-zinc-500' },
};
const getCategoryStyle = (cat) =>
  CATEGORY_PALETTE[(cat || '').toLowerCase()] ?? CATEGORY_PALETTE['misc'];

const CATEGORY_SUGGESTIONS = ['Rent', 'Utilities', 'Electricity', 'Salary', 'Maintenance', 'Supplies', 'Transport', 'Food', 'Misc'];

const DATE_FILTERS = [
  { key: 'today',   label: 'Today' },
  { key: 'weekly',  label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'custom',  label: 'Custom' },
];

/* ─── Date filter helper ──────────────────────────────────────────────────── */
function isInRange(dateStr, filter, fromDate, toDate) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  if (filter === 'today') {
    return d.toDateString() === now.toDateString();
  }
  if (filter === 'weekly') {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return d >= start;
  }
  if (filter === 'monthly') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  if (filter === 'custom') {
    if (fromDate && d < new Date(fromDate + 'T00:00:00')) return false;
    if (toDate   && d > new Date(toDate   + 'T23:59:59')) return false;
    return true;
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
export default function ExpensesPage() {
  const { list, pushEntity } = useDataStore();
  const { showToast } = useToast();

  /* ── Form state ── */
  const [showAdd,      setShowAdd]      = useState(false);
  const [description,  setDescription]  = useState('');
  const [category,     setCategory]     = useState('');
  const [amount,       setAmount]       = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [saving,       setSaving]       = useState(false);

  /* ── Filter state ── */
  const [dateFilter, setDateFilter] = useState('weekly');
  const [fromDate,   setFromDate]   = useState('');
  const [toDate,     setToDate]     = useState('');

  /* ── Delete state ── */
  const [deleteTarget, setDeleteTarget] = useState(null);

  /* ── Data ── */
  const allExpenses = useMemo(
    () => list('expense').slice().sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0)),
    [list],
  );

  const expenses = useMemo(
    () => allExpenses.filter(e => isInRange(e.date_created, dateFilter, fromDate, toDate)),
    [allExpenses, dateFilter, fromDate, toDate],
  );

  const { paged: pagedExpenses, page: expPage, pageCount: expPageCount, setPage: setExpPage } = usePagination(expenses, 40);

  /* ── KPI computations ── */
  const now = new Date();
  const currentMonthTotal = useMemo(
    () => allExpenses
      .filter(e => {
        const d = new Date(e.date_created || 0);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, e) => s + Number(e.amount || 0), 0),
    [allExpenses],
  );

  const totalFiltered = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount || 0), 0), [expenses]);
  const avgExpense    = useMemo(() => expenses.length > 0 ? totalFiltered / expenses.length : 0, [expenses, totalFiltered]);

  /* ── Category breakdown ── */
  const categoryBreakdown = useMemo(() => {
    const map = {};
    for (const e of expenses) {
      const cat = e.category || 'Misc';
      map[cat] = (map[cat] || 0) + Number(e.amount || 0);
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [expenses]);

  /* ── Payment method breakdown ── */
  const paymentBreakdown = useMemo(() => {
    const cash   = expenses.filter(e => e.payment_method === 'cash' || !e.payment_method).reduce((s, e) => s + Number(e.amount || 0), 0);
    const online = expenses.filter(e => e.payment_method === 'online').reduce((s, e) => s + Number(e.amount || 0), 0);
    return { cash, online };
  }, [expenses]);

  /* ── Handlers ── */
  const handleAdd = async (ev) => {
    ev.preventDefault();
    if (!description.trim()) { showToast('Description is required', 'warning'); return; }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 0)   { showToast('Enter a valid amount', 'warning'); return; }
    if (amt > 99_999_999)        { showToast('Amount is too large', 'warning'); return; }
    setSaving(true);
    try {
      await pushEntity('expense', 'create', {
        category:       category.trim() || 'Misc',
        description:    description.trim(),
        amount:         amt,
        payment_method: paymentMethod,
        date_created:   new Date().toISOString(),
      });
      showToast('Expense added');
      setShowAdd(false);
      setDescription(''); setCategory(''); setAmount(''); setPaymentMethod('cash');
    } catch {
      showToast('Failed to save expense', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await pushEntity('expense', 'delete', { id: deleteTarget.id });
      showToast('Expense deleted');
    } catch {
      showToast('Failed to delete expense', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  /* ── Render ── */
  return (
    <div className="flex flex-col gap-6 max-w-5xl">

      {/* ── Page header ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0}
        className="flex items-start justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <TrendingDown size={16} className="text-rose-500" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
          </div>
          <p className="text-sm text-muted-foreground pl-[42px]">
            Track operational costs — rent, utilities, and everything in between
          </p>
        </div>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
          <button
            onClick={() => setShowAdd(v => !v)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all',
              showAdd
                ? 'bg-muted text-foreground hover:bg-muted/80 border border-border'
                : 'bg-rose-600 hover:bg-rose-700 text-white',
            )}
          >
            {showAdd ? <><X size={15} /> Cancel</> : <><Plus size={15} /> Add Expense</>}
          </button>
        </motion.div>
      </motion.div>

      {/* ── Date filter ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" custom={1}
        className="flex flex-col sm:flex-row gap-2 items-start sm:items-center"
      >
        <div className="overflow-x-auto pb-0.5 -mb-0.5">
          <div className="flex gap-1 rounded-xl bg-muted/60 border border-border/40 p-1 min-w-max">
            {DATE_FILTERS.map(f => (
              <button key={f.key} onClick={() => setDateFilter(f.key)}
                className={cn(
                  'px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all duration-200',
                  dateFilter === f.key
                    ? 'bg-background text-foreground shadow-sm border border-border/60'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <AnimatePresence>
          {dateFilter === 'custom' && (
            <motion.div key="custom"
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.22 }} className="flex gap-2"
            >
              <div className="relative">
                <CalendarDays size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input type="date" className="h-9 pl-8 sm:w-40 text-sm rounded-lg border border-border/60 bg-background px-2" value={fromDate}
                  onChange={e => {
                    const v = e.target.value;
                    if (toDate && v > toDate) { showToast('Start date cannot be after end date', 'warning'); return; }
                    setFromDate(v);
                  }}
                />
              </div>
              <div className="relative">
                <CalendarDays size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input type="date" className="h-9 pl-8 sm:w-40 text-sm rounded-lg border border-border/60 bg-background px-2" value={toDate}
                  onChange={e => {
                    const v = e.target.value;
                    if (fromDate && v < fromDate) { showToast('End date cannot be before start date', 'warning'); return; }
                    setToDate(v);
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'This Month',     value: formatCurrency(currentMonthTotal), icon: Activity,  iconClass: 'bg-rose-500/10 border-rose-500/20 text-rose-500' },
          { label: 'Total Records',  value: String(expenses.length),           icon: FileText,  iconClass: 'bg-orange-500/10 border-orange-500/20 text-orange-500' },
          { label: 'Avg per Expense',value: formatCurrency(avgExpense),        icon: BarChart2, iconClass: 'bg-violet-500/10 border-violet-500/20 text-violet-500' },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} variants={fadeUp} initial="hidden" animate="show" custom={i + 2}
            whileHover={{ y: -2, transition: { duration: 0.18 } }}
          >
            <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 shadow-sm flex items-center gap-4">
              <div className={cn('w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0', kpi.iconClass)}>
                <kpi.icon size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">{kpi.label}</p>
                <p className="text-xl font-bold font-mono tracking-tight">{kpi.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Category & payment breakdown ── */}
      <AnimatePresence>
        {expenses.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {/* Category breakdown */}
            <div className="rounded-2xl border border-border/50 bg-card/80 p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-3">By Category</p>
              <div className="space-y-2">
                {categoryBreakdown.map(([cat, total]) => {
                  const catStyle = getCategoryStyle(cat);
                  const pct = totalFiltered > 0 ? (total / totalFiltered) * 100 : 0;
                  return (
                    <div key={cat} className="flex items-center gap-2">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 w-28 justify-center', catStyle.pill)}>
                        <span className={cn('w-1 h-1 rounded-full', catStyle.dot)} />
                        {cat}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted/60 overflow-hidden">
                        <div className={cn('h-full rounded-full', catStyle.dot)} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-mono font-semibold text-muted-foreground w-24 text-right shrink-0">{formatCurrency(total)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment method breakdown */}
            <div className="rounded-2xl border border-border/50 bg-card/80 p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-3">By Payment Method</p>
              <div className="space-y-3">
                {[
                  { label: 'Cash',   value: paymentBreakdown.cash,   color: 'bg-emerald-500', pct: totalFiltered > 0 ? (paymentBreakdown.cash / totalFiltered) * 100 : 0 },
                  { label: 'Online', value: paymentBreakdown.online, color: 'bg-blue-500',    pct: totalFiltered > 0 ? (paymentBreakdown.online / totalFiltered) * 100 : 0 },
                ].map(m => (
                  <div key={m.label} className="flex items-center gap-3">
                    <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', m.color)} />
                    <span className="text-sm font-medium w-14 shrink-0">{m.label}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted/60 overflow-hidden">
                      <div className={cn('h-full rounded-full', m.color)} style={{ width: `${m.pct}%` }} />
                    </div>
                    <span className="text-xs font-mono font-semibold text-muted-foreground w-24 text-right shrink-0">{formatCurrency(m.value)}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-border/40 flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Period total</span>
                  <span className="text-sm font-bold font-mono text-rose-500">{formatCurrency(totalFiltered)}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add expense form ── */}
      <AnimatePresence>
        {showAdd && (
          <motion.div key="add-form"
            initial={{ opacity: 0, scale: 0.97, y: -12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="rounded-2xl border border-rose-500/25 bg-card shadow-lg overflow-hidden">
              <div className="bg-rose-500/5 border-b border-rose-500/15 px-5 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
                  <DollarSign size={15} className="text-rose-500" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Log New Expense</p>
                  <p className="text-xs text-muted-foreground">Deducted from Gross Profit in P&amp;L report.</p>
                </div>
              </div>
              <form onSubmit={handleAdd}>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Description <span className="text-rose-500">*</span>
                      </label>
                      <input
                        required value={description} onChange={e => setDescription(e.target.value)}
                        placeholder="e.g. Monthly rent payment"
                        className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Amount <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number" required min="0" value={amount} onChange={e => setAmount(e.target.value)}
                        placeholder="5000"
                        className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</label>
                      <input
                        value={category} onChange={e => setCategory(e.target.value)}
                        placeholder="e.g. Utilities, Rent, Misc"
                        className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                        list="category-suggestions"
                      />
                      <datalist id="category-suggestions">
                        {CATEGORY_SUGGESTIONS.map(s => <option key={s} value={s} />)}
                      </datalist>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {['Rent', 'Utilities', 'Food', 'Misc'].map(s => (
                          <button key={s} type="button" onClick={() => setCategory(s)}
                            className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all',
                              category === s
                                ? 'bg-foreground text-background border-foreground'
                                : 'bg-muted/60 text-muted-foreground border-border/50 hover:border-border'
                            )}
                          >{s}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment Method</label>
                      <div className="flex gap-2 pt-1">
                        {[{ value: 'cash', label: 'Cash', color: 'bg-emerald-500' }, { value: 'online', label: 'Online', color: 'bg-blue-500' }].map(m => (
                          <button key={m.value} type="button"
                            onClick={() => setPaymentMethod(m.value)}
                            className={cn(
                              'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all',
                              paymentMethod === m.value
                                ? 'bg-foreground/5 border-foreground/30 text-foreground'
                                : 'bg-muted/30 border-border/50 text-muted-foreground hover:border-border hover:bg-muted/50',
                            )}
                          >
                            <span className={cn('w-2 h-2 rounded-full', m.color)} />
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-5 py-4 border-t border-border/60 bg-muted/20 flex justify-end gap-3">
                  <button type="button"
                    onClick={() => setShowAdd(false)}
                    className="px-4 py-2 rounded-lg border border-border/60 text-sm font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={saving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                  >
                    <Plus size={14} /> {saving ? 'Saving…' : 'Save Expense'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Expenses table ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" custom={5}
        className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-muted-foreground" />
            <span className="text-sm font-semibold">Expense Ledger</span>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {expenses.length} record{expenses.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Column headers */}
        <div className="hidden sm:grid sm:grid-cols-[130px_1fr_120px_110px_44px] gap-2 px-5 py-2.5 border-b border-border/40 bg-muted/10">
          {['Date', 'Description', 'Category', 'Amount', ''].map(h => (
            <span key={h} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{h}</span>
          ))}
        </div>

        <div className="divide-y divide-border/40">
          {expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <div className="w-11 h-11 rounded-xl bg-muted/60 border border-border/50 flex items-center justify-center">
                <FileText size={20} className="text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium">No expenses recorded</p>
              <p className="text-xs text-muted-foreground/60">Click "Add Expense" to log your first entry</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {pagedExpenses.map((e, idx) => {
                const catStyle = getCategoryStyle(e.category);
                const isOnline = e.payment_method === 'online';
                return (
                  <motion.div key={e.id}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.22, delay: Math.min(idx, 12) * 0.02 }}
                    className="group flex flex-col sm:grid sm:grid-cols-[130px_1fr_120px_110px_44px] gap-1 sm:gap-2 items-start sm:items-center px-5 py-3.5 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <CalendarDays size={12} className="text-muted-foreground/50 flex-shrink-0" />
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatDate(e.date_created)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-sm truncate block">{e.description || '—'}</span>
                      {/* Mobile: show category inline */}
                      <span className={cn('sm:hidden inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium', catStyle.pill)}>
                        <span className={cn('w-1 h-1 rounded-full', catStyle.dot)} />
                        {e.category || 'Misc'}
                      </span>
                    </div>
                    <div className="hidden sm:block">
                      <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium', catStyle.pill)}>
                        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', catStyle.dot)} />
                        {e.category || 'Misc'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold font-mono text-rose-500">-{formatCurrency(e.amount)}</span>
                      <span className={cn(
                        'hidden sm:inline text-[9px] font-semibold px-1.5 py-0.5 rounded-full',
                        isOnline
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                      )}>
                        {isOnline ? 'online' : 'cash'}
                      </span>
                    </div>
                    <div className="flex items-center justify-center self-center">
                      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                        onClick={() => setDeleteTarget(e)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-rose-500 hover:bg-rose-500/10 transition-all sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <Trash2 size={13} />
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Period total footer */}
        {expenses.length > 0 && (
          <div className="px-5 py-3 border-t border-border/40 bg-muted/10 flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Period total</span>
            <span className="text-sm font-bold font-mono text-rose-500">{formatCurrency(totalFiltered)}</span>
          </div>
        )}
        {expPageCount > 1 && (
          <div className="flex items-center justify-between px-5 py-2.5 border-t border-border/30 shrink-0 bg-muted/20">
            <span className="text-xs text-muted-foreground">{expenses.length} records · page {expPage} of {expPageCount}</span>
            <div className="flex gap-1">
              <button onClick={() => setExpPage(p => Math.max(1, p - 1))} disabled={expPage === 1}
                className="h-7 w-7 rounded-lg border border-border text-base flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors">‹</button>
              <button onClick={() => setExpPage(p => Math.min(expPageCount, p + 1))} disabled={expPage === expPageCount}
                className="h-7 w-7 rounded-lg border border-border text-base flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors">›</button>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Delete confirmation ── */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete expense"
        description={`Remove "${deleteTarget?.description || 'this expense'}" (${formatCurrency(deleteTarget?.amount)})? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
