import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, Unlock, PlusCircle, DollarSign, TrendingUp, TrendingDown,
  Clock, CheckCircle, AlertTriangle, X, Banknote, ArrowDownLeft, ArrowUpRight,
  ChevronRight, History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtPKR = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: Math.min(i, 5) * 0.055, ease: [0.23, 1, 0.32, 1] } }),
};

function computeCashMovement(session, sales, expenses, financialTxns) {
  const start = new Date(session.opened_at);
  const end = session.closed_at ? new Date(session.closed_at) : new Date();
  const inWindow = (d) => d && new Date(d) >= start && new Date(d) <= end;
  let cashIn = 0, cashOut = 0;
  for (const s of sales) {
    if ((s.payment_method === 'cash' || s.payment_method === 'Cash') && s.status === 'Completed' && inWindow(s.date_created)) cashIn += Number(s.total || 0);
  }
  for (const e of expenses) {
    if (inWindow(e.date_created || e.date_added)) cashOut += Number(e.amount || 0);
  }
  for (const t of financialTxns) {
    if (!inWindow(t.date_created)) continue;
    if (t.type === 'cash_in') cashIn += Number(t.amount || 0);
    if (t.type === 'cash_out') cashOut += Number(t.amount || 0);
  }
  return { cashIn, cashOut };
}

// ─── Small Modal ──────────────────────────────────────────────────────────────
function SimpleModal({ isOpen, title, icon: Icon, accentColor, children, onClose, onConfirm, confirmLabel, confirmClass }) {
  if (!isOpen) return null;
  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.2 }}
        className="w-full max-w-sm bg-card rounded-2xl shadow-2xl border border-border/50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="relative p-5 border-b" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1a3a5c 100%)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-xl border', accentColor.bg)}><Icon size={18} className={accentColor.icon} /></div>
              <h2 className="text-white text-base font-bold">{title}</h2>
            </div>
            <button onClick={onClose} className="text-white/50 hover:text-white/90 p-1 rounded-lg hover:bg-white/10"><X size={16} /></button>
          </div>
        </div>
        <div className="p-5 space-y-4">{children}</div>
        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={onClose} className="h-9 px-4 text-sm rounded-lg border border-border bg-background hover:bg-muted transition-colors">Cancel</button>
          <button onClick={onConfirm} className={cn('h-9 px-4 text-sm rounded-lg text-white font-medium transition-colors', confirmClass || 'bg-primary hover:bg-primary/90')}>{confirmLabel}</button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CashRegisterPage() {
  const { list, pushEntity } = useDataStore();
  const { showToast } = useToast();

  const registers = list('register');
  const sales = list('sale');
  const expenses = list('expense');
  const financialTxns = list('financial_transaction');

  const session = useMemo(() => registers.find((r) => r.status === 'open'), [registers]);

  // Live movement for current session
  const liveMovement = useMemo(() => {
    if (!session) return { cashIn: 0, cashOut: 0 };
    return computeCashMovement(session, sales, expenses, financialTxns);
  }, [session, sales, expenses, financialTxns]);

  const expectedBalance = session
    ? Number(session.opening_balance || 0) + liveMovement.cashIn - liveMovement.cashOut
    : 0;

  const history = useMemo(() => {
    return registers
      .filter((r) => r.status === 'closed')
      .map((r) => {
        const { cashIn, cashOut } = computeCashMovement(r, sales, expenses, financialTxns);
        const expected = Number(r.opening_balance || 0) + cashIn - cashOut;
        const diff = Number(r.actual_cash || 0) - expected;
        return { ...r, cashIn, cashOut, expectedBalance: expected, difference: diff };
      })
      .sort((a, b) => new Date(b.closed_at || 0) - new Date(a.closed_at || 0));
  }, [registers, sales, expenses, financialTxns]);

  const [openModal, setOpenModal] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('');
  const [closeModal, setCloseModal] = useState(false);
  const [closingBalance, setClosingBalance] = useState('');
  const [movementModal, setMovementModal] = useState(false);
  const [movementType, setMovementType] = useState('cash_in');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementDesc, setMovementDesc] = useState('');

  const handleOpen = async () => {
    const now = new Date().toISOString();
    await pushEntity('register', 'create', {
      opened_at: now, opening_time: now, closed_at: null,
      opening_balance: Number(openingBalance) || 0,
      actual_cash: null, status: 'open', opened_by: '', closed_by: '', notes: '',
    });
    showToast('Register opened'); setOpenModal(false); setOpeningBalance('');
  };

  const handleClose = async () => {
    await pushEntity('register', 'update', {
      ...session, closed_at: new Date().toISOString(),
      actual_cash: Number(closingBalance) || 0, status: 'closed',
    });
    showToast('Register closed'); setCloseModal(false); setClosingBalance('');
  };

  const handleMovement = async () => {
    if (!movementAmount || Number(movementAmount) <= 0) { showToast('Enter a valid amount', 'error'); return; }
    await pushEntity('financial_transaction', 'create', {
      type: movementType, category: 'cash_movement',
      amount: Number(movementAmount), description: movementDesc,
      register_id: session?.id ?? null, date_created: new Date().toISOString(),
    });
    showToast('Cash movement recorded'); setMovementModal(false); setMovementAmount(''); setMovementDesc('');
  };

  // Recent movements for open session
  const sessionMovements = useMemo(() => {
    if (!session) return [];
    const start = new Date(session.opened_at);
    return financialTxns
      .filter((t) => t.category === 'cash_movement' && new Date(t.date_created) >= start)
      .sort((a, b) => new Date(b.date_created) - new Date(a.date_created))
      .slice(0, 10);
  }, [session, financialTxns]);

  return (
    <div className="flex flex-col gap-6 max-w-4xl">

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
          <span>Home</span><ChevronRight size={12} /><span className="text-foreground font-medium">Cash Register</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Cash Register</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Open, reconcile and close your daily cash drawer</p>
      </motion.div>

      {/* ── Current Session ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}>
        {session ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-card shadow-sm overflow-hidden">
            {/* Open banner */}
            <div className="relative p-6 border-b" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #064e3b 100%)' }}>
              <div className="pointer-events-none absolute top-0 right-0 w-40 h-40 rounded-full bg-emerald-500/10 blur-3xl" />
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/30 rounded-full px-3 py-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-emerald-300 text-xs font-bold uppercase tracking-wider">Register Open</span>
                    </div>
                  </div>
                  <h2 className="text-white text-2xl font-black">Opening Balance: {fmtPKR(session.opening_balance)}</h2>
                  <p className="text-emerald-300/70 text-sm mt-1 flex items-center gap-1.5"><Clock size={13} /> Opened: {fmtDate(session.opened_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setMovementModal(true)}
                    className="flex items-center gap-2 h-10 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold border border-white/20 transition-colors">
                    <PlusCircle size={14} /> Cash In/Out
                  </button>
                  <button onClick={() => setCloseModal(true)}
                    className="flex items-center gap-2 h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors shadow-sm">
                    <Lock size={14} /> Close Register
                  </button>
                </div>
              </div>
            </div>

            {/* Live stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
              {[
                { label: 'Cash Sales', value: fmtPKR(liveMovement.cashIn), icon: TrendingUp, color: 'text-emerald-600 bg-emerald-500/10' },
                { label: 'Cash Out', value: fmtPKR(liveMovement.cashOut), icon: TrendingDown, color: 'text-rose-600 bg-rose-500/10' },
                { label: 'Expected Cash', value: fmtPKR(expectedBalance), icon: DollarSign, color: 'text-primary bg-primary/10' },
                { label: 'Opening Balance', value: fmtPKR(session.opening_balance), icon: Banknote, color: 'text-muted-foreground bg-muted/40' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="rounded-xl border border-border/40 bg-muted/10 p-4">
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-2.5', color)}><Icon size={16} /></div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                  <p className="text-lg font-black font-mono mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {/* Recent movements */}
            {sessionMovements.length > 0 && (
              <div className="px-6 pb-6">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Cash Movements (This Session)</p>
                <div className="rounded-xl border border-border/40 overflow-hidden divide-y divide-border/20">
                  {sessionMovements.map((t) => (
                    <div key={t.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', t.type === 'cash_in' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600')}>
                          {t.type === 'cash_in' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{t.type === 'cash_in' ? 'Cash In' : 'Cash Out'}</p>
                          <p className="text-xs text-muted-foreground">{t.description || fmtDate(t.date_created)}</p>
                        </div>
                      </div>
                      <span className={cn('font-mono font-bold text-sm', t.type === 'cash_in' ? 'text-emerald-600' : 'text-rose-600')}>
                        {t.type === 'cash_in' ? '+' : '−'}{fmtPKR(t.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
            <div className="relative p-8 flex flex-col items-center gap-5 text-center" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1a2a3a 100%)' }}>
              <div className="pointer-events-none absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_center,_#3b82f6_0%,_transparent_70%)]" />
              <div className="relative z-10 flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-muted/20 border border-white/10 flex items-center justify-center">
                  <Lock size={28} className="text-white/50" />
                </div>
                <div>
                  <h2 className="text-white text-2xl font-black">Register Closed</h2>
                  <p className="text-white/50 text-sm mt-1">Start your shift by opening the cash register with today's opening balance</p>
                </div>
                <button onClick={() => setOpenModal(true)}
                  className="flex items-center gap-2 h-11 px-6 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold transition-colors shadow-sm">
                  <Unlock size={16} /> Open Register
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Session History ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b bg-muted/10">
            <History size={15} className="text-muted-foreground" />
            <h2 className="text-base font-bold">Register History</h2>
            <span className="text-xs text-muted-foreground ml-auto">{history.length} closed session{history.length !== 1 ? 's' : ''}</span>
          </div>
          {history.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground py-12">
              <Clock size={32} className="opacity-15" />
              <p className="text-sm">No closed sessions yet</p>
              <p className="text-xs opacity-70">Sessions appear here after the register is closed</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted/20 border-b border-border/40">
                  <th className="text-left text-xs font-semibold text-muted-foreground py-3 pl-5">Opened</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground py-3">Closed</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground py-3">Opening</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground py-3">Sales</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground py-3">Expected</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground py-3">Counted</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground py-3 pr-5">Difference</th>
                </tr></thead>
                <tbody>
                  {history.map((s) => {
                    const diff = s.difference;
                    const diffClass = Math.abs(diff) < 1 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-amber-600';
                    return (
                      <tr key={s.id} className="border-b border-border/20 last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="py-3 pl-5 text-xs text-muted-foreground">{fmtDate(s.opened_at)}</td>
                        <td className="py-3 text-xs text-muted-foreground">{fmtDate(s.closed_at)}</td>
                        <td className="py-3 text-right font-mono text-sm">{fmtPKR(s.opening_balance)}</td>
                        <td className="py-3 text-right font-mono text-sm text-emerald-600">{fmtPKR(s.cashIn)}</td>
                        <td className="py-3 text-right font-mono text-sm">{fmtPKR(s.expectedBalance)}</td>
                        <td className="py-3 text-right font-mono text-sm">{fmtPKR(s.actual_cash)}</td>
                        <td className="py-3 pr-5 text-right">
                          <span className={cn('inline-flex items-center gap-1 font-mono text-sm font-bold', diffClass)}>
                            {Math.abs(diff) < 1 ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                            {diff >= 0 ? '+' : ''}{fmtPKR(diff)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Open Register Modal ── */}
      <SimpleModal isOpen={openModal} title="Open Register" icon={Unlock} accentColor={{ bg: 'bg-emerald-500/20 border-emerald-400/30', icon: 'text-emerald-300' }} onClose={() => setOpenModal(false)} onConfirm={handleOpen} confirmLabel="Open Register" confirmClass="bg-emerald-600 hover:bg-emerald-700">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Opening Balance (Cash in Drawer)</label>
          <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">PKR</span>
            <input type="number" min="0" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} placeholder="0" autoFocus
              className="w-full h-10 pl-11 pr-3 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <p className="text-xs text-muted-foreground">Count all cash in the drawer before you start selling</p>
        </div>
      </SimpleModal>

      {/* ── Close Register Modal ── */}
      <SimpleModal isOpen={closeModal} title="Close Register" icon={Lock} accentColor={{ bg: 'bg-rose-500/20 border-rose-400/30', icon: 'text-rose-300' }} onClose={() => setCloseModal(false)} onConfirm={handleClose} confirmLabel="Close Register" confirmClass="bg-rose-600 hover:bg-rose-700">
        <div className="space-y-4">
          <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-2 text-sm">
            {[['Opening Balance', fmtPKR(session?.opening_balance || 0)], ['Cash Sales', fmtPKR(liveMovement.cashIn)], ['Cash Out', fmtPKR(liveMovement.cashOut)], ['Expected', fmtPKR(expectedBalance)]].map(([label, val]) => (
              <div key={label} className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-semibold font-mono">{val}</span></div>
            ))}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Counted Cash in Drawer</label>
            <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">PKR</span>
              <input type="number" min="0" value={closingBalance} onChange={(e) => setClosingBalance(e.target.value)} placeholder={String(Math.round(expectedBalance))} autoFocus
                className="w-full h-10 pl-11 pr-3 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            {closingBalance && (
              <p className={cn('text-xs font-semibold', Math.abs(Number(closingBalance) - expectedBalance) < 1 ? 'text-emerald-600' : Number(closingBalance) < expectedBalance ? 'text-rose-600' : 'text-amber-600')}>
                Difference: {Number(closingBalance) >= expectedBalance ? '+' : ''}{fmtPKR(Number(closingBalance) - expectedBalance)}
              </p>
            )}
          </div>
        </div>
      </SimpleModal>

      {/* ── Cash Movement Modal ── */}
      <SimpleModal isOpen={movementModal} title="Record Cash Movement" icon={DollarSign} accentColor={{ bg: 'bg-blue-500/20 border-blue-400/30', icon: 'text-blue-300' }} onClose={() => setMovementModal(false)} onConfirm={handleMovement} confirmLabel="Record" confirmClass="bg-primary hover:bg-primary/90">
        <div className="space-y-4">
          <div className="flex gap-2">
            {[['cash_in', 'Cash In', 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700', ArrowDownLeft], ['cash_out', 'Cash Out', 'bg-rose-500/10 border-rose-500/25 text-rose-700', ArrowUpRight]].map(([val, label, cls, Icon]) => (
              <button key={val} onClick={() => setMovementType(val)}
                className={cn('flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border text-sm font-semibold transition-all',
                  movementType === val ? cls : 'border-border bg-background text-muted-foreground hover:bg-muted')}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Amount</label>
            <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">PKR</span>
              <input type="number" min="1" value={movementAmount} onChange={(e) => setMovementAmount(e.target.value)} placeholder="0" autoFocus
                className="w-full h-10 pl-11 pr-3 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input value={movementDesc} onChange={(e) => setMovementDesc(e.target.value)} placeholder="e.g. Drawer change, cash withdrawal"
              className="w-full h-10 px-3 text-sm rounded-md border border-border bg-background focus:outline-none" />
          </div>
        </div>
      </SimpleModal>
    </div>
  );
}
