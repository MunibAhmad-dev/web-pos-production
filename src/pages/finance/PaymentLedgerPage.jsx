import { createPortal } from 'react-dom';
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Store, Eye, HandCoins, X, DollarSign, ChevronRight,
  ArrowDownLeft, ArrowUpRight, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { buildTransactionLedger } from '../../utils/ledger';

const fmtPKR = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.055, ease: [0.23, 1, 0.32, 1] } }),
};

const GRADIENTS = ['from-purple-500 to-indigo-500', 'from-pink-500 to-rose-500', 'from-amber-500 to-orange-500', 'from-emerald-500 to-teal-500', 'from-blue-500 to-cyan-500', 'from-red-500 to-pink-500'];
const getGrad = (name = '') => GRADIENTS[name.charCodeAt(0) % GRADIENTS.length];

function Avatar({ name, size = 9 }) {
  return (
    <div className={cn(`w-${size} h-${size} rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold shrink-0`, getGrad(name))}
      style={{ fontSize: size <= 9 ? 14 : 18 }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

export default function PaymentLedgerPage() {
  const { list, pushEntity } = useDataStore();
  const { showToast } = useToast();
  const [party, setParty] = useState('customer');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);
  const [payTarget, setPayTarget] = useState(null);
  const [amount, setAmount] = useState('');

  const customers = list('customer');
  const vendors = list('vendor');
  const purchases = list('purchase');
  const vendorPayments = list('vendor_payment');
  const purchaseReturns = list('purchase_return');
  const customerPayments = list('customer_payment');

  const ledger = useMemo(
    () => buildTransactionLedger({
      sales: list('sale'),
      saleReturns: list('sale_return'),
      purchaseReturns,
      expenses: list('expense'),
      customerPayments,
      vendorPayments,
      financialTxns: list('financial_transaction'),
    }),
    [list, purchaseReturns, vendorPayments, customerPayments]
  );

  const rows = useMemo(() => {
    if (party === 'customer') {
      return customers
        .filter((c) => !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search))
        .map((c) => {
          const txns = ledger.filter((t) => String(t.customer_id) === String(c.id));
          const sales = list('sale').filter((s) => String(s.customer_id) === String(c.id) && s.status !== 'Cancelled');
          const paid = customerPayments.filter((p) => String(p.customer_id) === String(c.id)).reduce((s, p) => s + Number(p.amount || 0), 0);
          const totalBilled = sales.reduce((s, sale) => s + Number(sale.total || 0), 0);
          const balance = Math.max(0, totalBilled - paid);
          return { party: c, balance, transactions: txns };
        });
    }
    return vendors
      .filter((v) => !search || v.name?.toLowerCase().includes(search.toLowerCase()) || v.phone?.includes(search))
      .map((v) => {
        const owed = purchases
          .filter((p) => String(p.vendor_id) === String(v.id) && p.status !== 'cancelled' && p.status !== 'Cancelled')
          .reduce((s, p) => s + Number(p.total || 0), 0);
        const paid = vendorPayments.filter((p) => String(p.vendor_id) === String(v.id)).reduce((s, p) => s + Number(p.amount || 0), 0);
        const returned = purchaseReturns.filter((r) => String(r.vendor_id) === String(v.id)).reduce((s, r) => s + Number(r.total || 0), 0);
        const balance = Math.max(0, owed - paid - returned);
        const txns = ledger.filter((t) => String(t.vendor_id) === String(v.id));
        return { party: v, balance, transactions: txns };
      });
  }, [party, customers, vendors, purchases, vendorPayments, purchaseReturns, customerPayments, ledger, search, list]);

  const totalOutstanding = rows.reduce((s, r) => s + r.balance, 0);
  const withBalance = rows.filter((r) => r.balance > 0).length;

  const handlePayment = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { showToast('Enter a valid amount', 'error'); return; }
    try {
      if (party === 'customer') {
        await pushEntity('customer_payment', 'create', {
          customer_id: payTarget.party.id,
          amount: amt,
          date_added: new Date().toISOString(),
          notes: '',
          sale_id: null,
        });
      } else {
        await pushEntity('vendor_payment', 'create', {
          vendor_id: payTarget.party.id,
          amount: amt,
          date_created: new Date().toISOString(),
          notes: '',
          purchase_id: null,
        });
      }
      showToast('Payment recorded');
      setPayTarget(null);
      setAmount('');
    } catch (err) {
      showToast(err?.response?.data?.error || 'Unable to record payment', 'error');
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
          <span>Home</span><ChevronRight size={12} /><span className="text-foreground font-medium">Payment Ledger</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Payment Ledger</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Track outstanding balances with customers and vendors</p>
      </motion.div>

      {/* Stat cards */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Outstanding', value: fmtPKR(totalOutstanding), icon: DollarSign, color: 'text-amber-600 bg-amber-500/10' },
          { label: `${party === 'customer' ? 'Customers' : 'Vendors'} with Balance`, value: withBalance, icon: TrendingUp, color: 'text-rose-600 bg-rose-500/10' },
          { label: 'Total Records', value: rows.length, icon: party === 'customer' ? Users : Store, color: 'text-primary bg-primary/10' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-border/50 bg-card shadow-sm p-5">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', color)}><Icon size={18} /></div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-2xl font-black font-mono mt-1">{value}</p>
          </div>
        ))}
      </motion.div>

      {/* Table card */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-5 py-4 border-b bg-muted/10">
            <div className="flex rounded-xl bg-muted/40 border border-border/30 p-0.5 gap-0.5">
              {[['customer', Users, 'Customers'], ['vendor', Store, 'Vendors']].map(([val, Icon, label]) => (
                <button key={val} onClick={() => { setParty(val); setSearch(''); }}
                  className={cn('flex items-center gap-1.5 px-3 h-8 rounded-lg text-sm font-semibold transition-all', party === val ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                  <Icon size={13} />{label}
                </button>
              ))}
            </div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${party === 'customer' ? 'customers' : 'vendors'}…`}
              className="h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-56 ml-auto" />
          </div>

          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground py-12">
              <Users size={32} className="opacity-15" />
              <p className="text-sm">No records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted/20 border-b border-border/40">
                  <th className="text-left text-xs font-semibold text-muted-foreground py-3 pl-5">Name</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground py-3">Phone</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground py-3">{party === 'customer' ? 'Credit (AR)' : 'Balance (AP)'}</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground py-3">Transactions</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground py-3 pr-5">Actions</th>
                </tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.party.id} className="border-b border-border/20 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="py-3 pl-5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={row.party.name} size={8} />
                          <span className="font-semibold">{row.party.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-muted-foreground">{row.party.phone || '—'}</td>
                      <td className="py-3 text-right">
                        {row.balance > 0
                          ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 text-xs font-bold border border-amber-400/20">{fmtPKR(row.balance)}</span>
                          : <span className="text-emerald-600 text-xs font-semibold">Clear</span>
                        }
                      </td>
                      <td className="py-3 text-right text-muted-foreground">{row.transactions.length}</td>
                      <td className="py-3 pr-5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setDetail(row)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-primary transition-colors">
                            <Eye size={14} />
                          </button>
                          {row.balance > 0 && (
                            <button onClick={() => { setPayTarget(row); setAmount(''); }}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 transition-colors">
                              <HandCoins size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>

      {/* Detail modal */}
      {detail && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.2 }}
            className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border/50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="relative p-5 border-b" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1a3a5c 100%)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={detail.party.name} size={10} />
                  <div>
                    <h2 className="text-white font-bold">{detail.party.name}</h2>
                    <p className="text-white/50 text-xs">{detail.party.phone || 'No phone'}</p>
                  </div>
                </div>
                <button onClick={() => setDetail(null)} className="text-white/50 hover:text-white p-1 rounded-lg hover:bg-white/10"><X size={16} /></button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-border/30">
              {detail.transactions.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No transactions yet</p>
              ) : detail.transactions.map((t) => (
                <div key={t.key} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', t.direction === 'in' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600')}>
                      {t.direction === 'in' ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold capitalize">{String(t.type || '').replace('_', ' ')}</p>
                      <p className="text-xs text-muted-foreground">{fmtDateTime(t.date)}</p>
                    </div>
                  </div>
                  <span className={cn('font-mono font-bold text-sm', t.direction === 'in' ? 'text-emerald-600' : 'text-rose-600')}>
                    {t.direction === 'in' ? '+' : '−'}{fmtPKR(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Pay modal */}
      {payTarget && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setPayTarget(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.2 }}
            className="w-full max-w-sm bg-card rounded-2xl shadow-2xl border border-border/50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="relative p-5 border-b" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #064e3b 100%)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-white font-bold">Record Payment</h2>
                  <p className="text-emerald-300/70 text-xs mt-0.5">{payTarget.party.name}</p>
                </div>
                <button onClick={() => setPayTarget(null)} className="text-white/50 hover:text-white p-1 rounded-lg hover:bg-white/10"><X size={16} /></button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-xl bg-amber-500/10 border border-amber-400/20 p-3 text-sm">
                <span className="text-muted-foreground">Outstanding balance: </span>
                <span className="font-bold text-amber-700">{fmtPKR(payTarget.balance)}</span>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">PKR</span>
                  <input type="number" min="1" max={payTarget.balance} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus
                    placeholder={String(Math.round(payTarget.balance))}
                    className="w-full h-10 pl-11 pr-3 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-5 pb-5">
              <button onClick={() => setPayTarget(null)} className="h-9 px-4 text-sm rounded-lg border border-border bg-background hover:bg-muted">Cancel</button>
              <button onClick={handlePayment} className="h-9 px-4 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">Record Payment</button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </div>
  );
}
