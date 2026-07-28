import { useMemo, useState } from 'react';
import { usePagination } from '../../hooks/usePagination';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  Trash2, ArrowDownLeft, ArrowUpRight, Sigma, TrendingUp, TrendingDown,
  ChevronRight, ReceiptText, X, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { buildTransactionLedger } from '../../utils/ledger';

const fmtPKR = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: Math.min(i, 5) * 0.055, ease: [0.23, 1, 0.32, 1] } }),
};

const TYPE_OPTIONS = ['sale', 'sale_return', 'purchase_return', 'expense', 'cash_in', 'cash_out', 'customer_payment', 'vendor_payment'];

const TYPE_LABELS = {
  sale: 'Sale', sale_return: 'Sale Return', purchase_return: 'Purchase Return', expense: 'Expense',
  cash_in: 'Cash In', cash_out: 'Cash Out', customer_payment: 'Customer Payment', vendor_payment: 'Vendor Payment',
};

const TYPE_COLORS = {
  sale: 'bg-emerald-500/10 text-emerald-700 border-emerald-400/20',
  sale_return: 'bg-rose-500/10 text-rose-700 border-rose-400/20',
  purchase_return: 'bg-violet-500/10 text-violet-700 border-violet-400/20',
  expense: 'bg-rose-500/10 text-rose-700 border-rose-400/20',
  cash_in: 'bg-blue-500/10 text-blue-700 border-blue-400/20',
  cash_out: 'bg-amber-500/10 text-amber-700 border-amber-400/20',
  customer_payment: 'bg-emerald-500/10 text-emerald-700 border-emerald-400/20',
  vendor_payment: 'bg-purple-500/10 text-purple-700 border-purple-400/20',
};

export default function TransactionsPage() {
  const { list, pushEntity } = useDataStore();
  const { showToast } = useToast();
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

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

  const filtered = useMemo(() => {
    return ledger
      .filter((t) => {
        if (type && t.type !== type) return false;
        if (from && new Date(t.date) < new Date(from)) return false;
        if (to && new Date(t.date) > new Date(new Date(to).getTime() + 86400000)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [ledger, type, from, to]);

  const { paged, page, pageCount, setPage } = usePagination(filtered, 40);

  const totalIn = filtered.filter((t) => t.direction === 'in').reduce((s, t) => s + t.amount, 0);
  const totalOut = filtered.filter((t) => t.direction === 'out').reduce((s, t) => s + t.amount, 0);

  const handleDelete = async () => {
    try {
      const t = deleteTarget;
      if (t.type === 'customer_payment') {
        await pushEntity('customer_payment', 'delete', { id: t.raw.id });
      } else if (t.type === 'vendor_payment') {
        await pushEntity('vendor_payment', 'delete', { id: t.raw.id });
      } else {
        await pushEntity('financial_transaction', 'delete', { id: t.raw.id });
      }
      showToast('Transaction deleted');
      setDeleteTarget(null);
    } catch (err) {
      showToast(err?.response?.data?.error || 'Unable to delete', 'error');
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
          <span>Home</span><ChevronRight size={12} /><span className="text-foreground font-medium">Transactions</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Complete ledger of all money movements</p>
      </motion.div>

      {/* Stat cards */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Entries', value: filtered.length, icon: ReceiptText, color: 'text-primary bg-primary/10' },
          { label: 'Total In', value: fmtPKR(totalIn), icon: ArrowDownLeft, color: 'text-emerald-600 bg-emerald-500/10' },
          { label: 'Total Out', value: fmtPKR(totalOut), icon: ArrowUpRight, color: 'text-rose-600 bg-rose-500/10' },
          { label: 'Net', value: fmtPKR(totalIn - totalOut), icon: Sigma, color: totalIn >= totalOut ? 'text-emerald-600 bg-emerald-500/10' : 'text-rose-600 bg-rose-500/10' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-border/50 bg-card shadow-sm p-5">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', color)}><Icon size={18} /></div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-xl font-black font-mono mt-1">{value}</p>
          </div>
        ))}
      </motion.div>

      {/* Filters + table */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b bg-muted/10">
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none">
              <option value="">All types</option>
              {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">From</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">To</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none" />
            </div>
            {(type || from || to) && (
              <button onClick={() => { setType(''); setFrom(''); setTo(''); }}
                className="h-9 px-3 rounded-lg border border-border bg-background text-sm text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1.5">
                <X size={12} /> Clear
              </button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground py-12">
              <ReceiptText size={32} className="opacity-15" />
              <p className="text-sm">No transactions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted/20 border-b border-border/40">
                  <th className="text-left text-xs font-semibold text-muted-foreground py-3 pl-5">Type</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground py-3">Description</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground py-3">Method</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground py-3">Amount</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground py-3">Date</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground py-3 pr-5"></th>
                </tr></thead>
                <tbody>
                  {paged.map((t, idx) => (
                    <tr key={t.key || idx} className="border-b border-border/20 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="py-3 pl-5">
                        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border', TYPE_COLORS[t.type] || 'bg-muted text-muted-foreground border-border')}>
                          {t.direction === 'in' ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                          {TYPE_LABELS[t.type] || String(t.type || '').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 text-muted-foreground text-xs max-w-[200px] truncate">{t.description || '—'}</td>
                      <td className="py-3 text-xs text-muted-foreground capitalize">{t.method || '—'}</td>
                      <td className="py-3 text-right">
                        <span className={cn('font-mono font-bold text-sm', t.direction === 'in' ? 'text-emerald-600' : 'text-rose-600')}>
                          {t.direction === 'in' ? '+' : '−'}{fmtPKR(t.amount)}
                        </span>
                      </td>
                      <td className="py-3 text-right text-xs text-muted-foreground">{fmtDateTime(t.date)}</td>
                      <td className="py-3 pr-5 text-right">
                        {t.deletable && (
                          <button onClick={() => setDeleteTarget(t)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 transition-colors ml-auto">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filtered.length > 0 && pageCount > 1 && (
            <div className="flex items-center justify-between px-5 py-2.5 border-t border-border/30 bg-muted/20">
              <span className="text-xs text-muted-foreground">{filtered.length} records · page {page} of {pageCount}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="h-7 w-7 rounded-lg border border-border text-base flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors">‹</button>
                <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount}
                  className="h-7 w-7 rounded-lg border border-border text-base flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors">›</button>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Confirm delete portal */}
      {deleteTarget && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.2 }}
            className="w-full max-w-sm bg-card rounded-2xl shadow-2xl border border-border/50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="relative p-5 border-b" style={{ background: 'linear-gradient(135deg, #1a0a0a 0%, #3a0a0a 100%)' }}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-400/30"><AlertTriangle size={18} className="text-rose-400" /></div>
                <h2 className="text-white font-bold">Delete Transaction</h2>
              </div>
            </div>
            <div className="p-5">
              <p className="text-sm text-muted-foreground">This will remove the transaction record permanently. This cannot be undone.</p>
            </div>
            <div className="flex justify-end gap-3 px-5 pb-5">
              <button onClick={() => setDeleteTarget(null)} className="h-9 px-4 text-sm rounded-lg border border-border bg-background hover:bg-muted">Cancel</button>
              <button onClick={handleDelete} className="h-9 px-4 text-sm rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold">Delete</button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </div>
  );
}
