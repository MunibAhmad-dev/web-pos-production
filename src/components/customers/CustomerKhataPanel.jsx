import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, X, Plus, Receipt, Check, Clock,
  MessageCircle, FileText, Trash2, ChevronDown, ChevronUp,
  CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';

const PKR = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const ACTIVE  = (b) => b.balance_due > 0.1;
const SETTLED = (b) => b.balance_due <= 0.1;

export default function CustomerKhataPanel({ customer, onClose }) {
  const { list, pushEntity, nextId } = useDataStore();
  const { showToast } = useToast();

  const allKhatas   = list('customer_khata');
  const allPayments = list('customer_khata_payment');

  const khatas = useMemo(() => {
    const cid = String(customer.id);
    return allKhatas
      .filter((k) => String(k.customer_id) === cid)
      .map((k) => {
        const payments = allPayments.filter((p) => String(p.khata_id) === String(k.id));
        const amount_paid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
        const balance_due = Math.max(0, Number(k.total_amount || 0) - amount_paid);
        return { ...k, payments, amount_paid, balance_due };
      })
      .sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0));
  }, [allKhatas, allPayments, customer.id]);

  const totalDue  = khatas.reduce((s, k) => s + k.balance_due, 0);
  const totalPaid = khatas.reduce((s, k) => s + k.amount_paid, 0);

  // Add-bill form
  const [showAddBill, setShowAddBill]     = useState(false);
  const [billTitle, setBillTitle]         = useState('');
  const [billAmount, setBillAmount]       = useState('');
  const [billNotes, setBillNotes]         = useState('');
  const [saving, setSaving]               = useState(false);

  // Pay-khata form
  const [payKhataId, setPayKhataId]       = useState(null);
  const [payAmt, setPayAmt]               = useState('');
  const [payNote, setPayNote]             = useState('');
  const [paying, setPaying]               = useState(false);

  // Delete confirms
  const [deleteKhataId, setDeleteKhataId]   = useState(null);
  const [deletePayId, setDeletePayId]       = useState(null);

  // Expanded bills
  const [expanded, setExpanded] = useState(new Set());
  const toggle = (id) => setExpanded((prev) => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const handleAddBill = async () => {
    const amt = Number(billAmount);
    if (!billTitle.trim() || !amt || amt <= 0) {
      showToast('Enter a title and valid amount', 'error'); return;
    }
    setSaving(true);
    try {
      await pushEntity('customer_khata', 'create', {
        id: nextId(),
        customer_id: customer.id,
        title: billTitle.trim(),
        total_amount: amt,
        notes: billNotes.trim() || null,
        date_created: new Date().toISOString(),
      });
      setBillTitle(''); setBillAmount(''); setBillNotes('');
      setShowAddBill(false);
      showToast('Khata bill added', 'success');
    } finally { setSaving(false); }
  };

  const handlePay = async (khata) => {
    const amt = Number(payAmt);
    if (!amt || amt <= 0) { showToast('Enter a valid amount', 'error'); return; }
    setPaying(true);
    try {
      await pushEntity('customer_khata_payment', 'create', {
        id: nextId(),
        khata_id: khata.id,
        customer_id: customer.id,
        amount: Math.min(amt, khata.balance_due),
        note: payNote.trim() || null,
        date_created: new Date().toISOString(),
      });
      setPayKhataId(null); setPayAmt(''); setPayNote('');
      showToast('Payment recorded', 'success');
    } finally { setPaying(false); }
  };

  const handleDeleteKhata = async (k) => {
    for (const p of k.payments) {
      await pushEntity('customer_khata_payment', 'delete', { id: p.id });
    }
    await pushEntity('customer_khata', 'delete', { id: k.id });
    setDeleteKhataId(null);
    showToast('Bill deleted', 'success');
  };

  const handleDeletePayment = async (p) => {
    await pushEntity('customer_khata_payment', 'delete', { id: p.id });
    setDeletePayId(null);
    showToast('Payment removed', 'success');
  };

  const whatsApp = (k) => {
    if (!customer.phone) return;
    const msg = encodeURIComponent(
      `Hi ${customer.name}, your khata "${k.title}" has a balance of ${PKR(k.balance_due)}. Please pay at your earliest convenience.`
    );
    window.open(`https://wa.me/92${customer.phone.replace(/^0/, '')}?text=${msg}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Wallet size={16} className="text-blue-500" />
            </div>
            <div>
              <h3 className="font-bold text-base">{customer.name}</h3>
              <p className="text-xs text-muted-foreground">Customer Khata (Bills & Payments)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 divide-x divide-border border-b shrink-0">
          {[
            { label: 'Total Bills', value: PKR(khatas.reduce((s, k) => s + Number(k.total_amount || 0), 0)), color: 'text-foreground' },
            { label: 'Total Paid',  value: PKR(totalPaid), color: 'text-emerald-600' },
            { label: 'Outstanding', value: PKR(totalDue),  color: totalDue > 0 ? 'text-rose-600' : 'text-emerald-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col items-center py-3 px-2 bg-muted/20">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">{label}</p>
              <p className={cn('text-sm font-bold mt-0.5', color)}>{value}</p>
            </div>
          ))}
        </div>

        {/* Bills list */}
        <div className="flex-1 overflow-y-auto">
          {khatas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <Receipt size={28} className="opacity-20" />
              <p className="text-sm">No khata bills yet</p>
            </div>
          ) : khatas.map((k) => (
            <div key={k.id} className="border-b border-border/40 last:border-0">
              {/* Bill header */}
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0', SETTLED(k) ? 'bg-emerald-500/10' : 'bg-amber-500/10')}>
                  {SETTLED(k) ? <CheckCircle2 size={14} className="text-emerald-500" /> : <AlertTriangle size={14} className="text-amber-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{k.title}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(k.date_created)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground line-through">{PKR(k.total_amount)}</p>
                  <p className={cn('text-sm font-bold', SETTLED(k) ? 'text-emerald-600' : 'text-rose-600')}>
                    {SETTLED(k) ? 'Settled' : PKR(k.balance_due)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {ACTIVE(k) && (
                    <button onClick={() => { setPayKhataId(k.id); setPayAmt(String(Math.round(k.balance_due))); }}
                      className="h-7 w-7 flex items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors" title="Record payment">
                      <Check size={13} />
                    </button>
                  )}
                  {customer.phone && (
                    <button onClick={() => whatsApp(k)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors" title="Send WhatsApp">
                      <MessageCircle size={13} />
                    </button>
                  )}
                  <button onClick={() => toggle(k.id)}
                    className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                    {expanded.has(k.id) ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                  {deleteKhataId === k.id ? (
                    <div className="flex items-center gap-1 bg-destructive/8 px-2 rounded-lg border border-destructive/20">
                      <span className="text-[10px] font-semibold text-destructive">Sure?</span>
                      <button onClick={() => handleDeleteKhata(k)} className="h-5 px-1.5 text-[10px] rounded bg-destructive text-white">Yes</button>
                      <button onClick={() => setDeleteKhataId(null)} className="h-5 px-1.5 text-[10px] rounded hover:bg-muted">No</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteKhataId(k.id)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Pay form inline */}
              <AnimatePresence>
                {payKhataId === k.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-emerald-500/5 border-t border-emerald-500/15">
                    <div className="px-4 py-3 flex flex-col gap-2">
                      <p className="text-xs font-semibold text-muted-foreground">Record Payment · Due: {PKR(k.balance_due)}</p>
                      <div className="flex gap-2">
                        <input type="number" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} placeholder="Amount"
                          className="flex-1 h-8 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none" />
                        <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Note (optional)"
                          className="flex-1 h-8 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none" />
                        <button onClick={() => handlePay(k)} disabled={paying}
                          className="h-8 px-3 text-xs rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-50">
                          {paying ? '…' : 'Pay'}
                        </button>
                        <button onClick={() => setPayKhataId(null)} className="h-8 px-3 text-xs rounded-lg border border-border hover:bg-muted">Cancel</button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Payment history */}
              <AnimatePresence>
                {expanded.has(k.id) && k.payments.length > 0 && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-muted/20 border-t border-border/30">
                    <div className="px-4 py-2 space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Payment History</p>
                      {k.payments.map((p) => (
                        <div key={p.id} className="flex items-center gap-2 text-xs">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span className="font-semibold text-emerald-600">{PKR(p.amount)}</span>
                          {p.note && <span className="text-muted-foreground">· {p.note}</span>}
                          <span className="text-muted-foreground ml-auto">{fmtDate(p.date_created)}</span>
                          {deletePayId === p.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDeletePayment(p)} className="h-4 px-1.5 text-[9px] rounded bg-destructive text-white">Del</button>
                              <button onClick={() => setDeletePayId(null)} className="h-4 px-1.5 text-[9px] rounded hover:bg-muted">No</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeletePayId(p.id)} className="text-destructive/40 hover:text-destructive"><Trash2 size={10} /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* Add bill form */}
        <AnimatePresence>
          {showAddBill && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-border bg-muted/10 shrink-0">
              <div className="px-4 py-3 flex flex-col gap-2.5">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">New Bill</p>
                <div className="flex gap-2">
                  <input value={billTitle} onChange={(e) => setBillTitle(e.target.value)} placeholder="Bill title (e.g. Jan Credit)"
                    className="flex-1 h-8 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none" />
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">PKR</span>
                    <input type="number" value={billAmount} onChange={(e) => setBillAmount(e.target.value)} placeholder="Amount"
                      className="w-32 h-8 pl-9 pr-2 text-sm rounded-lg border border-border bg-background focus:outline-none" />
                  </div>
                </div>
                <input value={billNotes} onChange={(e) => setBillNotes(e.target.value)} placeholder="Notes (optional)"
                  className="h-8 px-3 text-sm rounded-lg border border-border bg-background focus:outline-none" />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowAddBill(false)} className="h-8 px-3 text-xs rounded-lg border border-border hover:bg-muted">Cancel</button>
                  <button onClick={handleAddBill} disabled={saving}
                    className="h-8 px-4 text-xs rounded-lg bg-primary text-primary-foreground font-semibold disabled:opacity-50">
                    {saving ? 'Saving…' : 'Add Bill'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t shrink-0 bg-muted/10">
          <button onClick={() => setShowAddBill(!showAddBill)}
            className="flex items-center gap-2 h-8 px-3 rounded-lg border border-primary/40 bg-primary/5 text-primary text-xs font-semibold hover:bg-primary/10 transition-colors">
            <Plus size={13} /> New Bill
          </button>
          <button onClick={onClose} className="h-8 px-4 text-xs rounded-lg border border-border bg-background hover:bg-muted">Close</button>
        </div>
      </motion.div>
    </div>
  );
}
