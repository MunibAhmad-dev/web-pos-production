import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, CalendarClock, CalendarIcon, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { useDataStore } from '../../store/dataStore';
import { useNavigate } from 'react-router-dom';

const SNOOZE_KEY  = (id) => `udhar_snooze_${id}`;
const DISMISS_ALL = 'udhar_dismiss_all';
const fmtPKR  = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function isSnoozeActive(saleId) {
  try {
    const until = localStorage.getItem(SNOOZE_KEY(saleId));
    return until && until >= todayStr();
  } catch { return false; }
}

function isDismissAllActive() {
  try {
    const until = localStorage.getItem(DISMISS_ALL);
    return until && until >= new Date().toISOString();
  } catch { return false; }
}

function snooze(saleId, days = 3) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  try { localStorage.setItem(SNOOZE_KEY(saleId), d.toISOString().slice(0, 10)); } catch {}
}

function dismissAll(hours = 20) {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  try { localStorage.setItem(DISMISS_ALL, d.toISOString()); } catch {}
}

function getDueSales(allSales, allCustomers) {
  if (isDismissAllActive()) return [];
  const today = todayStr();
  const custMap = {};
  for (const c of allCustomers) custMap[String(c.id)] = c;
  return allSales.filter((s) => {
    if (!s.due_date) return false;
    if (s.payment_status === 'Paid') return false;
    if (s.due_date > today) return false;
    if (isSnoozeActive(s.id)) return false;
    return true;
  }).map((s) => {
    const customer = s.customer_id ? custMap[String(s.customer_id)] : null;
    const daysOverdue = Math.max(0, Math.floor((Date.now() - new Date(s.due_date).getTime()) / 86400000));
    return { ...s, customer, daysOverdue };
  }).sort((a, b) => b.daysOverdue - a.daysOverdue);
}

// ─── Single row in the reminder list ─────────────────────────────────────────

function SaleRow({ sale, onSnooze, onExtend, onMarkPaid }) {
  const [extending, setExtending] = useState(false);
  const [newDate, setNewDate]     = useState(null);

  const startExtend = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setNewDate(d);
    setExtending(true);
  };

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      {/* Top accent bar — red if overdue, amber if due today */}
      <div className={`h-[3px] ${sale.daysOverdue > 0 ? 'bg-rose-500' : 'bg-amber-500'}`} />

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg shrink-0 ${sale.daysOverdue > 0 ? 'bg-rose-500/10' : 'bg-amber-500/10'}`}>
            {sale.daysOverdue > 0
              ? <AlertTriangle size={15} className="text-rose-600 dark:text-rose-400" />
              : <Clock size={15} className="text-amber-600 dark:text-amber-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p className="font-bold text-sm text-foreground truncate">{sale.customer?.name || 'Unknown Customer'}</p>
              {sale.daysOverdue > 0
                ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400 shrink-0">
                    {sale.daysOverdue}d overdue
                  </span>
                : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 shrink-0">
                    Due today
                  </span>}
            </div>
            {sale.customer?.phone && (
              <p className="text-xs text-muted-foreground">{sale.customer.phone}</p>
            )}
            <div className="flex items-center gap-4 mt-1.5 flex-wrap">
              <span className="text-sm font-black text-rose-600 dark:text-rose-400 tabular-nums">
                {fmtPKR(sale.due_amount || (sale.total - (sale.amount_paid || 0)))}
              </span>
              <span className="text-xs text-muted-foreground">Due: {fmtDate(sale.due_date)}</span>
              <span className="text-xs text-muted-foreground">Sale: {fmtDate(sale.date_created)}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-1.5 mt-3 flex-wrap">
          <button
            onClick={startExtend}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20 transition-colors"
          >
            <CalendarClock size={11} /> Extend Date
          </button>
          <button
            onClick={() => onMarkPaid(sale)}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
          >
            <CheckCircle2 size={11} /> View Customer
          </button>
          <button
            onClick={() => onSnooze(sale.id)}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted/60 transition-colors"
          >
            Snooze 3 days
          </button>
        </div>

        {/* Extend date inline form */}
        <AnimatePresence>
          {extending && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-2 h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm text-left hover:bg-muted/40 transition-colors">
                      <CalendarIcon size={12} className="text-muted-foreground shrink-0" />
                      <span className={newDate ? 'text-foreground' : 'text-muted-foreground'}>
                        {newDate ? format(newDate, 'dd MMM yyyy') : 'Pick a date'}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[9999]" align="start" sideOffset={4}>
                    <Calendar
                      mode="single"
                      selected={newDate}
                      onSelect={(d) => d && setNewDate(d)}
                      disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <button
                  onClick={() => { if (newDate) { onExtend(sale, format(newDate, 'yyyy-MM-dd')); setExtending(false); } }}
                  disabled={!newDate}
                  className="h-8 px-3 text-xs font-bold rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  onClick={() => setExtending(false)}
                  className="h-8 px-2 text-xs rounded-lg border border-border text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Main hook + modal ────────────────────────────────────────────────────────

export function useUdharReminder() {
  const { list, pushEntity } = useDataStore();
  const [dueSales, setDueSales] = useState([]);
  const [open, setOpen]         = useState(false);

  const check = useCallback(() => {
    const sales = list('sale');
    const customers = list('customer');
    const due = getDueSales(sales, customers);
    setDueSales(due);
    if (due.length > 0) setOpen(true);
  }, [list]);

  // Check on mount + window focus
  useEffect(() => {
    // Slight delay so dataStore has time to bootstrap
    const t = setTimeout(check, 2000);
    window.addEventListener('focus', check);
    return () => { clearTimeout(t); window.removeEventListener('focus', check); };
  }, [check]);

  const handleSnooze = (saleId) => {
    snooze(saleId, 3);
    setDueSales((prev) => prev.filter((s) => String(s.id) !== String(saleId)));
  };

  const handleExtend = async (sale, newDate) => {
    try {
      await pushEntity('sale', 'update', { ...sale, due_date: newDate });
      setDueSales((prev) => prev.filter((s) => String(s.id) !== String(sale.id)));
    } catch (e) {
      console.error('Failed to extend due date', e);
    }
  };

  const handleDismissAll = () => {
    dismissAll(20);
    setDueSales([]);
    setOpen(false);
  };

  return { dueSales, open, setOpen, handleSnooze, handleExtend, handleDismissAll };
}

// ─── Modal component ──────────────────────────────────────────────────────────

export default function UdharReminderModal({ dueSales, open, onClose, onSnooze, onExtend, onDismissAll }) {
  const navigate = useNavigate();

  const handleMarkPaid = (sale) => {
    onClose();
    if (sale.customer_id) navigate(`/customers/${sale.customer_id}`);
  };

  if (!open || dueSales.length === 0) return null;

  const overdue  = dueSales.filter((s) => s.daysOverdue > 0).length;
  const dueToday = dueSales.length - overdue;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-lg bg-background rounded-2xl shadow-2xl overflow-hidden z-10 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-border/60 px-5 py-4 flex items-center gap-3">
          <div className="p-2 bg-rose-500/10 rounded-xl shrink-0">
            <Bell size={16} className="text-rose-600 dark:text-rose-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-foreground">Udhar / Payment Reminders</p>
            <p className="text-xs text-muted-foreground">
              {overdue > 0 && `${overdue} overdue`}
              {overdue > 0 && dueToday > 0 && ' · '}
              {dueToday > 0 && `${dueToday} due today`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
          {dueSales.map((sale) => (
            <SaleRow
              key={sale.id}
              sale={sale}
              onSnooze={onSnooze}
              onExtend={onExtend}
              onMarkPaid={handleMarkPaid}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border/60 px-4 py-3 flex items-center justify-between gap-3 bg-muted/20">
          <p className="text-xs text-muted-foreground">
            {dueSales.length} reminder{dueSales.length !== 1 ? 's' : ''} pending
          </p>
          <div className="flex gap-2">
            <button
              onClick={onDismissAll}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              Dismiss All (20h)
            </button>
            <button
              onClick={onClose}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
