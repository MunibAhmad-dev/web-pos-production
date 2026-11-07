import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Plus, X, CheckCircle2, Clock, AlertTriangle,
  ChevronDown, ChevronUp, Search, RefreshCw, Trash2, Filter, ArrowLeft,
} from 'lucide-react';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  icon: Clock,         color: 'text-amber-600',   bg: 'bg-amber-500/10 border-amber-500/30' },
  snoozed:  { label: 'Snoozed',  icon: RefreshCw,     color: 'text-blue-600',    bg: 'bg-blue-500/10 border-blue-500/30' },
  settled:  { label: 'Settled',  icon: CheckCircle2,  color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  overdue:  { label: 'Overdue',  icon: AlertTriangle, color: 'text-rose-600',    bg: 'bg-rose-500/10 border-rose-500/30' },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtPKR(n) {
  return `PKR ${Math.round(Number(n) || 0).toLocaleString('en-PK')}`;
}

function AddReminderModal({ customers, onClose, onSave }) {
  const [form, setForm] = useState({
    customer_id: '',
    title: '',
    amount: '',
    due_date: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-bold text-base flex items-center gap-2"><Bell size={16} className="text-primary" /> New Payment Reminder</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Customer (optional)</label>
            <select value={form.customer_id} onChange={e => set('customer_id', e.target.value)}
              className="w-full h-9 pl-3 pr-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">— No specific customer —</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Title *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Collect payment for invoice #42"
              className="w-full h-9 pl-3 pr-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Amount (PKR)</label>
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0"
                className="w-full h-9 pl-3 pr-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)}
                className="w-full h-9 pl-3 pr-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Additional details..."
              className="w-full pl-3 pr-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
        </div>
        <div className="flex items-center gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 h-9 rounded-xl border border-border bg-background hover:bg-muted text-sm transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!form.title.trim() || saving}
            className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
            {saving ? 'Saving…' : 'Add Reminder'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentRemindersPage() {
  const navigate = useNavigate();
  const { list, pushEntity, nextId } = useDataStore();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | pending | overdue | snoozed | settled
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const reminders = list('payment_reminder');
  const customers = list('customer');

  const today = new Date().toISOString().slice(0, 10);

  const enriched = useMemo(() => {
    return reminders.map(r => {
      let status = r.status || 'pending';
      if (status === 'pending' && r.due_date && r.due_date < today) status = 'overdue';
      const customer = r.customer_id ? customers.find(c => String(c.id) === String(r.customer_id)) : null;
      return { ...r, _status: status, _customer: customer };
    });
  }, [reminders, customers, today]);

  const filtered = useMemo(() => {
    let rows = enriched;
    if (filter !== 'all') rows = rows.filter(r => r._status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.title?.toLowerCase().includes(q) ||
        r._customer?.name?.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q)
      );
    }
    return rows.sort((a, b) => {
      const ord = { overdue: 0, pending: 1, snoozed: 2, settled: 3 };
      return (ord[a._status] ?? 4) - (ord[b._status] ?? 4) || (b.date_created || '').localeCompare(a.date_created || '');
    });
  }, [enriched, filter, search]);

  const counts = useMemo(() => {
    const c = { all: enriched.length, pending: 0, overdue: 0, snoozed: 0, settled: 0 };
    for (const r of enriched) c[r._status] = (c[r._status] || 0) + 1;
    return c;
  }, [enriched]);

  const handleAdd = async (form) => {
    await pushEntity('payment_reminder', 'create', {
      id: nextId(),
      customer_id: form.customer_id || null,
      title: form.title.trim(),
      amount: Number(form.amount) || 0,
      due_date: form.due_date || null,
      notes: form.notes.trim() || null,
      status: 'pending',
      date_created: new Date().toISOString(),
    });
    showToast('Reminder added', 'success');
  };

  const handleSettle = async (r) => {
    await pushEntity('payment_reminder', 'update', { ...r, status: 'settled', settled_at: new Date().toISOString() });
    showToast('Marked as settled', 'success');
  };

  const handleSnooze = async (r, days = 3) => {
    const snoozeUntil = new Date();
    snoozeUntil.setDate(snoozeUntil.getDate() + days);
    await pushEntity('payment_reminder', 'update', {
      ...r,
      status: 'snoozed',
      due_date: snoozeUntil.toISOString().slice(0, 10),
    });
    showToast(`Snoozed ${days} days`, 'success');
  };

  const handleDelete = async (id) => {
    await pushEntity('payment_reminder', 'delete', { id });
    setDeleteId(null);
    showToast('Reminder deleted', 'success');
  };

  const TAB_FILTERS = [
    { key: 'all',     label: 'All' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'pending', label: 'Pending' },
    { key: 'snoozed', label: 'Snoozed' },
    { key: 'settled', label: 'Settled' },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/customers')}
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-border bg-background hover:bg-muted transition-colors text-muted-foreground"
            title="Back to Customers">
            <ArrowLeft size={16} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bell size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Payment Reminders</h1>
            <p className="text-xs text-muted-foreground">Track and manage payment follow-ups</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20">
          <Plus size={14} /> New Reminder
        </button>
      </div>

      {/* KPI strip */}
      {enriched.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Overdue',  val: counts.overdue,  color: 'text-rose-600',    bg: 'bg-rose-500/10 border-rose-500/20',    icon: AlertTriangle },
            { label: 'Pending',  val: counts.pending,  color: 'text-amber-600',   bg: 'bg-amber-500/10 border-amber-500/20',   icon: Clock },
            { label: 'Snoozed',  val: counts.snoozed,  color: 'text-blue-600',    bg: 'bg-blue-500/10 border-blue-500/20',     icon: RefreshCw },
            { label: 'Settled',  val: counts.settled,  color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20',icon: CheckCircle2 },
          ].map(c => (
            <div key={c.label}
              onClick={() => setFilter(c.label.toLowerCase())}
              className={cn('rounded-2xl border bg-card p-4 flex items-center gap-3 cursor-pointer hover:shadow-md transition-all', filter === c.label.toLowerCase() ? c.bg : 'border-border/60')}>
              <div className={cn('p-2 rounded-xl', c.bg)}>
                <c.icon size={15} className={c.color} />
              </div>
              <div>
                <p className={cn('text-xl font-black tabular-nums', c.color)}>{c.val}</p>
                <p className="text-[11px] text-muted-foreground">{c.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex gap-1.5 flex-wrap">
          {TAB_FILTERS.map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              className={cn('h-8 px-3 rounded-xl text-xs font-semibold border transition-colors',
                filter === t.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background hover:bg-muted text-muted-foreground')}>
              {t.label} {counts[t.key] > 0 && <span className="ml-1 opacity-70">({counts[t.key]})</span>}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-56">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reminders…"
            className="w-full h-9 pl-8 pr-3 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bell size={32} className="text-muted-foreground/30 mb-3" />
          <p className="font-semibold text-muted-foreground">No reminders</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Add a payment reminder to stay on top of receivables</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {filtered.map(r => {
              const cfg = STATUS_CONFIG[r._status] || STATUS_CONFIG.pending;
              const Icon = cfg.icon;
              const isExpanded = expandedId === r.id;
              return (
                <motion.div key={r.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                  className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-sm">
                  {/* Main row */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className={cn('p-1.5 rounded-lg border shrink-0', cfg.bg)}>
                      <Icon size={14} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{r.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {r._customer && <span className="text-xs text-muted-foreground">{r._customer.name}</span>}
                        {r.amount > 0 && <span className="text-xs font-bold text-primary">{fmtPKR(r.amount)}</span>}
                        {r.due_date && <span className={cn('text-xs', r._status === 'overdue' ? 'text-rose-600 font-semibold' : 'text-muted-foreground')}>Due: {fmtDate(r.due_date)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {r._status !== 'settled' && (
                        <>
                          <button onClick={() => handleSettle(r)} title="Mark settled"
                            className="h-7 w-7 rounded-lg text-emerald-600 hover:bg-emerald-500/10 flex items-center justify-center transition-colors">
                            <CheckCircle2 size={14} />
                          </button>
                          <button onClick={() => handleSnooze(r, 3)} title="Snooze 3 days"
                            className="h-7 w-7 rounded-lg text-blue-600 hover:bg-blue-500/10 flex items-center justify-center transition-colors">
                            <Clock size={14} />
                          </button>
                        </>
                      )}
                      {deleteId === r.id ? (
                        <div className="flex items-center gap-1 bg-destructive/8 px-2 rounded-lg border border-destructive/20 ml-1">
                          <span className="text-[11px] font-semibold text-destructive">Sure?</span>
                          <button onClick={() => handleDelete(r.id)} className="h-5 px-1.5 text-[10px] rounded bg-destructive text-white hover:bg-destructive/90">Yes</button>
                          <button onClick={() => setDeleteId(null)} className="h-5 px-1.5 text-[10px] rounded hover:bg-muted">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteId(r.id)}
                          className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                      <button onClick={() => setExpandedId(isExpanded ? null : r.id)}
                        className="h-7 w-7 rounded-lg hover:bg-muted flex items-center justify-center transition-colors text-muted-foreground">
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded notes + snooze options */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden">
                        <div className="px-4 pb-4 border-t border-border/40 pt-3 flex flex-col gap-3">
                          {r.notes && <p className="text-sm text-muted-foreground">{r.notes}</p>}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">Snooze:</span>
                            {[1, 3, 7, 14].map(d => (
                              <button key={d} onClick={() => handleSnooze(r, d)}
                                className="h-7 px-3 rounded-lg border border-border text-xs font-semibold hover:bg-muted transition-colors">
                                {d}d
                              </button>
                            ))}
                            {r._status !== 'settled' && (
                              <button onClick={() => handleSettle(r)}
                                className="h-7 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 text-xs font-semibold hover:bg-emerald-500/20 transition-colors ml-auto">
                                Mark Settled
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground/50">Created: {fmtDate(r.date_created)}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add modal */}
      <AnimatePresence>
        {showAdd && <AddReminderModal customers={customers} onClose={() => setShowAdd(false)} onSave={handleAdd} />}
      </AnimatePresence>
    </div>
  );
}
