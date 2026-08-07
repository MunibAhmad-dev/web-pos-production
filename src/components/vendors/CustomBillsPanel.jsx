import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, X, RefreshCw, Plus, Receipt, Check, Clock,
  ChevronDown, ChevronUp, MessageCircle, FileText, Trash2,
  Loader2, History, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { cn }     from '@/lib/utils';
import { useDataStore }   from '../../store/dataStore';
import { useToast }       from '../../context/ToastContext';
import { getReceiptSettings } from '../../utils/receipt';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PKR = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const ACTIVE  = (b) => b.balance_due > 0.1;
const SETTLED = (b) => b.balance_due <= 0.1;
const PAGE_SZ = 15;

const poNumber = (po) => {
  if (!po) return '';
  const d = po.date_created ? new Date(po.date_created) : new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `PO-${ymd}-${String(po.id || 0).slice(-5).toUpperCase()}`;
};

function inPeriod(dateStr, filter, from, to) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  if (filter === 'today') return d.toDateString() === now.toDateString();
  if (filter === 'week')  { const s = new Date(now); s.setDate(now.getDate() - 6); s.setHours(0, 0, 0, 0); return d >= s; }
  if (filter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (filter === 'custom') {
    if (from && d < new Date(from + 'T00:00:00')) return false;
    if (to   && d > new Date(to   + 'T23:59:59')) return false;
    return true;
  }
  return true;
}

// ─── PDF helpers ──────────────────────────────────────────────────────────────

async function downloadSingleBillPdf(bill, vendor, storeName) {
  const html2pdf = (await import('html2pdf.js')).default;
  const rows = (bill.payments || []).map((p, i) => `
    <tr style="border-bottom:1px solid #f0f0f0">
      <td style="padding:6px 8px;color:#888">${i + 1}</td>
      <td style="padding:6px 8px;font-weight:600;color:#059669">${PKR(p.amount)}</td>
      <td style="padding:6px 8px;color:#555">${p.note || '—'}</td>
      <td style="padding:6px 8px;color:#888">${fmtDate(p.date_added)}</td>
    </tr>`).join('');

  const html = `<div style="font-family:Arial,sans-serif;font-size:13px;color:#111;padding:32px;max-width:600px">
    <h2 style="margin:0 0 2px;font-size:20px">${storeName}</h2>
    <p style="margin:0 0 20px;color:#666;font-size:12px">Vendor: <strong>${vendor.name}</strong>${vendor.phone ? ' &middot; ' + vendor.phone : ''}</p>
    <hr style="border:none;border-top:2px solid #f0f0f0;margin:0 0 16px"/>
    <h3 style="margin:0 0 4px;font-size:16px">${bill.title}</h3>
    ${bill.notes ? `<p style="margin:0 0 12px;color:#777;font-style:italic;font-size:12px">${bill.notes}</p>` : ''}
    <p style="margin:0 0 16px;color:#888;font-size:12px">Created: ${fmtDate(bill.date_created)}</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <tr><td style="padding:6px 0;color:#666">Total Amount</td><td style="text-align:right;font-weight:700;font-size:15px">${PKR(bill.total_amount)}</td></tr>
      <tr><td style="padding:6px 0;color:#666">Amount Paid</td><td style="text-align:right;color:#059669;font-weight:700">${PKR(bill.amount_paid)}</td></tr>
      <tr style="border-top:2px solid #f0f0f0">
        <td style="padding:10px 0;font-weight:700">${SETTLED(bill) ? 'Fully Settled ✓' : 'Balance Due'}</td>
        <td style="text-align:right;font-weight:700;font-size:16px;color:${SETTLED(bill) ? '#059669' : '#dc2626'}">${SETTLED(bill) ? PKR(0) : PKR(bill.balance_due)}</td>
      </tr>
    </table>
    ${rows ? `
      <h4 style="margin:0 0 8px;text-transform:uppercase;font-size:10px;color:#999;letter-spacing:.08em">Payment History</h4>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#f9f9f9">
          <th style="padding:6px 8px;text-align:left;font-weight:600;color:#666">#</th>
          <th style="padding:6px 8px;text-align:left;font-weight:600;color:#666">Amount</th>
          <th style="padding:6px 8px;text-align:left;font-weight:600;color:#666">Note</th>
          <th style="padding:6px 8px;text-align:left;font-weight:600;color:#666">Date</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>` : '<p style="color:#aaa;font-size:12px;font-style:italic">No payments recorded.</p>'}
  </div>`;

  html2pdf().set({
    margin: 0, filename: `bill-${bill.id}.pdf`,
    html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  }).from(html).save();
}

async function downloadAllBillsPdf(activeBills, vendor, storeName) {
  const html2pdf = (await import('html2pdf.js')).default;
  const rows = activeBills.map(b => `
    <tr style="border-bottom:1px solid #f0f0f0">
      <td style="padding:8px">${b.title}</td>
      <td style="padding:8px;text-align:right;font-weight:600">${PKR(b.total_amount)}</td>
      <td style="padding:8px;text-align:right;color:#059669;font-weight:600">${PKR(b.amount_paid)}</td>
      <td style="padding:8px;text-align:right;color:#dc2626;font-weight:700">${PKR(b.balance_due)}</td>
    </tr>`).join('');
  const totalDue = activeBills.reduce((s, b) => s + b.balance_due, 0);

  const html = `<div style="font-family:Arial,sans-serif;font-size:13px;color:#111;padding:32px;max-width:680px">
    <h2 style="margin:0 0 2px;font-size:20px">${storeName}</h2>
    <p style="margin:0 0 4px;color:#666;font-size:12px">Vendor: <strong>${vendor.name}</strong></p>
    <p style="margin:0 0 20px;color:#aaa;font-size:11px">Generated: ${fmtDate(new Date().toISOString())}</p>
    <hr style="border:none;border-top:2px solid #f0f0f0;margin:0 0 16px"/>
    <h3 style="margin:0 0 12px;font-size:15px">Active Bills Summary</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:#f9f9f9">
        <th style="padding:8px;text-align:left;font-weight:600;color:#666">Bill</th>
        <th style="padding:8px;text-align:right;font-weight:600;color:#666">Total</th>
        <th style="padding:8px;text-align:right;font-weight:600;color:#666">Paid</th>
        <th style="padding:8px;text-align:right;font-weight:600;color:#666">Balance</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr style="border-top:2px solid #333">
        <td style="padding:10px 8px;font-weight:700">TOTAL OUTSTANDING</td>
        <td></td><td></td>
        <td style="padding:10px 8px;text-align:right;font-weight:700;font-size:15px;color:#dc2626">${PKR(totalDue)}</td>
      </tr></tfoot>
    </table>
  </div>`;

  html2pdf().set({
    margin: 0, filename: `custom-bills-${vendor.name}.pdf`,
    html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  }).from(html).save();
}

// ─── KPI Board ────────────────────────────────────────────────────────────────

function KPIBoard({ activeBills }) {
  const totalOutstanding = activeBills.reduce((s, b) => s + b.balance_due, 0);
  const totalBilled      = activeBills.reduce((s, b) => s + b.total_amount, 0);
  const totalPaid        = activeBills.reduce((s, b) => s + b.amount_paid, 0);
  const partialCount     = activeBills.filter(b => b.amount_paid > 0 && ACTIVE(b)).length;
  const unpaidCount      = activeBills.filter(b => b.amount_paid <= 0).length;

  return (
    <div className="p-4 space-y-3">
      {/* Big red card */}
      <div className="rounded-xl bg-red-600 p-4 text-white">
        <p className="text-[10px] font-bold uppercase tracking-widest text-red-200 mb-1 flex items-center gap-1">
          <AlertTriangle size={10} /> Total Outstanding — Amount to Pay
        </p>
        <p className="text-3xl font-black tabular-nums leading-none">{PKR(totalOutstanding)}</p>
      </div>
      {/* 3-col mini cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Total Billed</p>
          <p className="text-base font-black tabular-nums text-foreground">{PKR(totalBilled)}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">{activeBills.length} bill{activeBills.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Total Paid</p>
          <p className="text-base font-black tabular-nums text-emerald-600 dark:text-emerald-400">{PKR(totalPaid)}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">{partialCount} partial</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Pending Bills</p>
          <p className="text-base font-black tabular-nums text-amber-600 dark:text-amber-400">{activeBills.length}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">{partialCount} partial · {unpaidCount} unpaid</p>
        </div>
      </div>
    </div>
  );
}

// ─── Payment Activity ─────────────────────────────────────────────────────────

function PaymentActivity({ bills, allPayments }) {
  const [filter, setFilter]       = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]   = useState('');
  const [page, setPage]           = useState(PAGE_SZ);

  const FILTERS = [
    { key: 'today', label: 'Today' },
    { key: 'week',  label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'custom', label: 'Custom' },
  ];

  const billMap = useMemo(() => {
    const m = {};
    for (const b of bills) m[String(b.id)] = b;
    return m;
  }, [bills]);

  const filtered = useMemo(
    () => allPayments.filter(p => inPeriod(p.date_added, filter, customFrom, customTo)),
    [allPayments, filter, customFrom, customTo]
  );

  const byBill = useMemo(() => {
    const m = {};
    for (const p of filtered) {
      const bid = String(p.bill_id);
      if (!m[bid]) m[bid] = { bill: billMap[bid], total: 0 };
      m[bid].total += Number(p.amount || 0);
    }
    return Object.values(m).filter(x => x.bill).sort((a, b) => b.total - a.total);
  }, [filtered, billMap]);

  const totalPaid = filtered.reduce((s, p) => s + Number(p.amount || 0), 0);
  const visible   = byBill.slice(0, page);
  const hasMore   = byBill.length > page;

  return (
    <div className="px-4 pb-4 space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Payment Activity</p>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(f => (
          <button key={f.key}
            onClick={() => { setFilter(f.key); setPage(PAGE_SZ); }}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors border',
              filter === f.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground hover:border-primary/50'
            )}>
            {f.label}
          </button>
        ))}
      </div>

      {filter === 'custom' && (
        <div className="flex gap-2">
          <Input type="date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); setPage(PAGE_SZ); }} className="h-8 text-xs flex-1" />
          <Input type="date" value={customTo}   onChange={e => { setCustomTo(e.target.value);   setPage(PAGE_SZ); }} className="h-8 text-xs flex-1" />
        </div>
      )}

      {/* Summary bar */}
      {totalPaid > 0 && (
        <div className="rounded-lg bg-emerald-600 text-white px-4 py-2.5 text-sm font-semibold">
          {PKR(totalPaid)} paid &middot; {filtered.length} payment{filtered.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Per-bill breakdown */}
      {visible.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No payments in this period.</p>
      ) : (
        <div className="space-y-0.5">
          {visible.map(({ bill, total }) => (
            <div key={bill.id} className="flex items-center gap-2 py-2 border-b border-border/40 last:border-0">
              <CheckCircle2 size={13} className={SETTLED(bill) ? 'text-emerald-500 shrink-0' : 'text-amber-500 shrink-0'} />
              <span className="text-sm truncate flex-1 min-w-0">{bill.title}</span>
              {SETTLED(bill) && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 shrink-0">
                  Cleared
                </span>
              )}
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 shrink-0 tabular-nums">{PKR(total)}</span>
            </div>
          ))}
          {hasMore && (
            <button onClick={() => setPage(p => p + PAGE_SZ)}
              className="w-full text-xs text-primary hover:underline py-2 text-center">
              Load More ({byBill.length - page} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── New Bill Modal ───────────────────────────────────────────────────────────

function NewBillModal({ vendor, purchases, open, onClose }) {
  const { pushEntity, nextId } = useDataStore();
  const { showToast } = useToast();

  const emptyForm = { title: '', amount: '', notes: '', purchase_id: '' };
  const [form, setForm]   = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef(null);

  useEffect(() => {
    if (open) {
      setForm(emptyForm);
      setSaving(false);
      setTimeout(() => titleRef.current?.focus(), 80);
    }
  }, [open]);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim()) { showToast('Title is required', 'error'); return; }
    const amt = Number(form.amount);
    if (!amt || amt <= 0) { showToast('Amount must be greater than 0', 'error'); return; }
    setSaving(true);
    try {
      await pushEntity('custom_bill', 'create', {
        vendor_id:   vendor.id,
        title:       form.title.trim(),
        total_amount: amt,
        notes:       form.notes.trim() || null,
        purchase_id: form.purchase_id ? Number(form.purchase_id) : null,
        status:      'active',
        date_created: new Date().toISOString(),
      });
      showToast('Bill created');
      onClose();
    } catch (e) {
      showToast(e.message || 'Failed to create bill', 'error');
    } finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18 }}
        className="relative w-full max-w-[512px] mx-4 bg-card rounded-2xl shadow-2xl overflow-hidden z-10"
        onClick={e => e.stopPropagation()}
      >
        <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-400" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-xl shrink-0">
              <Receipt size={16} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">New Custom Bill</p>
              <p className="text-xs text-muted-foreground">{vendor.name}</p>
            </div>
          </div>
          <button onClick={() => !saving && onClose()}
            className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description / Title *</label>
            <Input ref={titleRef} placeholder="e.g. Goods on credit, Security deposit, Advance…"
              value={form.title} onChange={e => f('title', e.target.value)} className="h-9 text-sm" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bill Amount (PKR) *</label>
            <Input type="number" min={0} placeholder="0"
              value={form.amount} onChange={e => f('amount', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              className="h-9 text-sm font-mono" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes (optional)</label>
            <Input placeholder="Any additional notes…" value={form.notes} onChange={e => f('notes', e.target.value)} className="h-9 text-sm" />
          </div>

          {purchases.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Link to Purchase (optional)</label>
              <select value={form.purchase_id}
                onChange={e => f('purchase_id', e.target.value)}
                className="w-full h-9 text-sm px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring text-foreground">
                <option value="">— Not linked —</option>
                {purchases.map(p => (
                  <option key={p.id} value={p.id}>
                    #{poNumber(p)} · {fmtDate(p.date_created)} · {PKR(p.total)}
                  </option>
                ))}
              </select>
              {form.purchase_id && (
                <p className="text-[11px] text-blue-600 dark:text-blue-400">
                  ℹ Payments on this bill will also update the purchase balance.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border/60 bg-muted/20">
          <Button variant="outline" size="sm" onClick={() => !saving && onClose()} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSave}
            disabled={saving || !form.title.trim() || !Number(form.amount)}
            className="bg-amber-500 hover:bg-amber-600 text-white border-0 min-w-[110px]">
            {saving ? <><Loader2 size={12} className="animate-spin mr-1.5" />Creating…</> : 'Create Bill'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Bill Card (active) ───────────────────────────────────────────────────────

function BillCard({ bill, vendor, purchases, onDeleteBill, deletingBill }) {
  const { pushEntity, nextId } = useDataStore();
  const { showToast } = useToast();

  const [openPayForm, setOpenPayForm]   = useState(false);
  const [openHistory, setOpenHistory]   = useState(false);
  const [payAmount, setPayAmount]       = useState('');
  const [payNote, setPayNote]           = useState('');
  const [savingPay, setSavingPay]       = useState(false);
  const [deletingPayId, setDeletingPayId] = useState(null);

  const pct        = bill.total_amount > 0 ? Math.min(100, (bill.amount_paid / bill.total_amount) * 100) : 0;
  const isSettled  = SETTLED(bill);
  const amtNum     = Number(payAmount);
  const exceedsBalance = amtNum > bill.balance_due + 0.01;
  const canPay     = amtNum > 0 && !exceedsBalance;
  const payments   = bill.payments || [];

  const linkedPurchase = bill.purchase_id
    ? purchases.find(p => String(p.id) === String(bill.purchase_id))
    : null;

  const togglePayForm = () => {
    if (openPayForm) { setPayAmount(''); setPayNote(''); }
    setOpenPayForm(v => !v);
  };

  const handlePay = async () => {
    if (!canPay) return;
    setSavingPay(true);
    try {
      let mirroredId = null;
      if (bill.purchase_id) {
        const mirrored = await pushEntity('vendor_payment', 'create', {
          vendor_id:   vendor.id,
          amount:      amtNum,
          notes:       payNote.trim() || 'Custom bill payment',
          purchase_id: bill.purchase_id,
          date_added:  new Date().toISOString(),
        });
        mirroredId = mirrored?.id ?? null;
      }

      await pushEntity('custom_bill_payment', 'create', {
        bill_id:                   bill.id,
        amount:                    amtNum,
        note:                      payNote.trim() || null,
        date_added:                new Date().toISOString(),
        mirrored_vendor_payment_id: mirroredId,
      });

      showToast('Payment recorded');
      setPayAmount('');
      setPayNote('');
      setOpenPayForm(false);
    } catch (e) {
      showToast(e.message || 'Failed to record payment', 'error');
    } finally { setSavingPay(false); }
  };

  const handleDeletePayment = async (payment) => {
    setDeletingPayId(payment.id);
    try {
      if (payment.mirrored_vendor_payment_id) {
        await pushEntity('vendor_payment', 'delete', { id: payment.mirrored_vendor_payment_id });
      }
      await pushEntity('custom_bill_payment', 'delete', { id: payment.id });
      showToast('Payment removed');
    } catch (e) {
      showToast(e.message || 'Failed to delete payment', 'error');
    } finally { setDeletingPayId(null); }
  };

  const handleWA = () => {
    if (!vendor?.phone) return;
    const storeName = getReceiptSettings().store_name || 'Store';
    let msg = `🧾 *Custom Bill* — ${storeName}\n📌 ${bill.title}\n📅 ${fmtDate(bill.date_created)}\n───────────────\n`;
    msg += `💰 Total: ${PKR(bill.total_amount)}\n✅ Paid: ${PKR(bill.amount_paid)}\n`;
    msg += isSettled ? '🟢 Fully settled\n' : `🔴 Remaining: ${PKR(bill.balance_due)}\n`;
    let phone = String(vendor.phone).replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '92' + phone.substring(1);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className={cn('h-[3px]', isSettled ? 'bg-emerald-500' : 'bg-amber-500')} />

      <div className="p-4">
        {/* Top row: badge + date | amount */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1',
                isSettled
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
              )}>
                {isSettled ? <Check size={9} /> : <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />}
                {isSettled ? 'Settled' : 'Pending'}
              </span>
              <span className="text-[10px] text-muted-foreground">{fmtDate(bill.date_created)}</span>
            </div>
            <p className="font-bold text-sm text-foreground leading-tight">{bill.title}</p>
            {bill.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{bill.notes}</p>}
          </div>
          <p className="text-xl font-black tabular-nums text-foreground shrink-0">{PKR(bill.total_amount)}</p>
        </div>

        {/* Progress bar */}
        <div className="mb-2">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className={cn('h-full rounded-full transition-all duration-500', isSettled ? 'bg-emerald-500' : 'bg-amber-500')}
              style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between mt-1">
            {isSettled ? (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold w-full text-center">Fully settled ✓</span>
            ) : (
              <>
                <span className="text-[11px] text-muted-foreground">Paid: {PKR(bill.amount_paid)}</span>
                <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">Remaining: {PKR(bill.balance_due)}</span>
              </>
            )}
          </div>
        </div>

        {/* Linked purchase badge */}
        {linkedPurchase && (
          <div className="mt-2 rounded-lg bg-violet-500/10 border border-violet-500/20 px-3 py-1.5 text-[11px] text-violet-700 dark:text-violet-400 leading-normal">
            Linked Purchase: #{poNumber(linkedPurchase)} · {fmtDate(linkedPurchase.date_created)} · {PKR(linkedPurchase.total)}
          </div>
        )}

        {/* Actions section */}
        <div className="mt-3 pt-3 border-t border-border/50">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Actions</p>
          <div className="flex flex-wrap gap-1.5">
            {!isSettled && (
              <button onClick={togglePayForm}
                className={cn(
                  'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors border',
                  openPayForm
                    ? 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                )}>
                {openPayForm ? <X size={11} /> : <Plus size={11} />}
                {openPayForm ? 'Cancel Payment' : 'Add Payment'}
              </button>
            )}

            <button onClick={() => downloadSingleBillPdf(bill, vendor, getReceiptSettings().store_name || 'My Store')}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/20 transition-colors">
              <FileText size={11} /> Generate PDF
            </button>

            {vendor?.phone && (
              <button onClick={handleWA}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/20 transition-colors">
                <MessageCircle size={11} /> WhatsApp
              </button>
            )}

            <button onClick={() => setOpenHistory(v => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border bg-muted text-muted-foreground border-border hover:bg-muted/80 transition-colors">
              {openHistory ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {openHistory ? 'Hide Payments' : 'View Payments'}
              {payments.length > 0 && <span className="text-[10px] opacity-60">({payments.length})</span>}
            </button>

            <button onClick={() => onDeleteBill(bill.id)} disabled={deletingBill}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/20 transition-colors disabled:opacity-50">
              {deletingBill ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
              Delete Bill
            </button>
          </div>

          {/* Inline payment form */}
          <AnimatePresence>
            {openPayForm && !isSettled && (
              <motion.div key="pay-form"
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                className="overflow-hidden">
                <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Record Payment</p>

                  {/* Amount */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-muted-foreground">Payment Amount (PKR) *</label>
                      <button onClick={() => setPayAmount(String(Math.round(bill.balance_due)))}
                        className="text-[11px] text-primary hover:underline font-medium">
                        Pay Full ({PKR(bill.balance_due)})
                      </button>
                    </div>
                    <Input type="number" min={0}
                      placeholder={`Max: ${PKR(bill.balance_due)}`}
                      value={payAmount} onChange={e => setPayAmount(e.target.value)}
                      className={cn('h-9 text-sm font-mono', exceedsBalance && payAmount ? 'border-red-500 focus-visible:ring-red-500' : '')} />
                    {exceedsBalance && payAmount && (
                      <p className="text-[11px] text-red-600 mt-1">Exceeds remaining balance of {PKR(bill.balance_due)}</p>
                    )}
                  </div>

                  {/* Note */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Note (optional)</label>
                    <Input placeholder="e.g. Cash, Bank transfer, Cheque…"
                      value={payNote} onChange={e => setPayNote(e.target.value)} className="h-9 text-sm" />
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm"
                      onClick={() => { setOpenPayForm(false); setPayAmount(''); setPayNote(''); }}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handlePay} disabled={!canPay || savingPay}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white border-0">
                      {savingPay
                        ? <><Loader2 size={11} className="animate-spin mr-1.5" />Saving…</>
                        : 'Save Payment'}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Payment history */}
          <AnimatePresence>
            {openHistory && (
              <motion.div key="pay-history"
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                className="overflow-hidden">
                <div className="mt-3 pt-3 border-t border-border/50">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Payment History</p>
                  {payments.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">No payments recorded yet for this bill.</p>
                  ) : (
                    <div className="space-y-1">
                      {payments.slice(0, 15).map((p, i) => (
                        <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-border/30 last:border-0 text-xs">
                          <span className="text-muted-foreground w-5 text-right shrink-0 tabular-nums">{i + 1}</span>
                          <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">{PKR(p.amount)}</span>
                          <span className="text-muted-foreground truncate flex-1 min-w-0">{p.note || ''}</span>
                          <span className="text-muted-foreground shrink-0">{fmtDate(p.date_added)}</span>
                          <button onClick={() => handleDeletePayment(p)} disabled={deletingPayId === p.id}
                            className="shrink-0 h-6 w-6 flex items-center justify-center rounded text-rose-500 hover:bg-rose-500/10 transition-colors disabled:opacity-40">
                            {deletingPayId === p.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                          </button>
                        </div>
                      ))}
                      {payments.length > 15 && (
                        <p className="text-xs text-muted-foreground text-center py-1 italic">
                          + {payments.length - 15} more payments
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── Settled Bill Card ────────────────────────────────────────────────────────

function SettledBillCard({ bill, vendor, purchases }) {
  const linkedPurchase = bill.purchase_id
    ? purchases.find(p => String(p.id) === String(bill.purchase_id))
    : null;

  const handleWA = () => {
    if (!vendor?.phone) return;
    const storeName = getReceiptSettings().store_name || 'Store';
    const msg = `✅ *Bill Settled* — ${storeName}\n📌 ${bill.title}\n💰 ${PKR(bill.total_amount)} — Fully paid\n📅 ${fmtDate(bill.date_created)}`;
    let phone = String(vendor.phone).replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '92' + phone.substring(1);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden opacity-90">
      <div className="h-[3px] bg-emerald-500" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 flex items-center gap-1">
                <Check size={9} /> SETTLED
              </span>
              <span className="text-[10px] text-muted-foreground">{fmtDate(bill.date_created)}</span>
            </div>
            <p className="font-bold text-sm text-foreground">{bill.title}</p>
            {bill.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{bill.notes}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-black tabular-nums text-emerald-600 dark:text-emerald-400">{PKR(bill.total_amount)}</p>
            <p className="text-[10px] text-muted-foreground">Fully paid</p>
          </div>
        </div>

        {linkedPurchase && (
          <div className="mb-3 rounded-lg bg-violet-500/10 border border-violet-500/20 px-3 py-1.5 text-[11px] text-violet-700 dark:text-violet-400">
            Linked Purchase: #{poNumber(linkedPurchase)} · {fmtDate(linkedPurchase.date_created)} · {PKR(linkedPurchase.total)}
          </div>
        )}

        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => downloadSingleBillPdf(bill, vendor, getReceiptSettings().store_name || 'My Store')}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/20 transition-colors">
            <FileText size={11} /> PDF
          </button>
          {vendor?.phone && (
            <button onClick={handleWA}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/20 transition-colors">
              <MessageCircle size={11} /> WhatsApp
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function CustomBillsPanel({ vendor, onClose }) {
  const { list, pushEntity, refresh } = useDataStore();
  const { showToast } = useToast();

  const [tab, setTab]             = useState('active');
  const [newBillOpen, setNewBillOpen] = useState(false);
  const [activePage, setActivePage]   = useState(PAGE_SZ);
  const [settledPage, setSettledPage] = useState(PAGE_SZ);
  const [pdfFilter, setPdfFilter] = useState('month');
  const [pdfFrom, setPdfFrom]     = useState('');
  const [pdfTo, setPdfTo]         = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [deletingBillIds, setDeletingBillIds] = useState(new Set());

  // Raw collections
  const rawBills        = list('custom_bill');
  const rawBillPayments = list('custom_bill_payment');
  const allPurchases    = list('purchase');

  // Purchases for this vendor (for linking)
  const vendorPurchases = useMemo(() =>
    allPurchases
      .filter(p => String(p.vendor_id) === String(vendor.id))
      .sort((a, b) => new Date(b.date_created) - new Date(a.date_created))
  , [allPurchases, vendor.id]);

  // Enriched bills
  const bills = useMemo(() => {
    return rawBills
      .filter(b => String(b.vendor_id) === String(vendor.id))
      .sort((a, b) => new Date(b.date_created) - new Date(a.date_created))
      .map(bill => {
        const bPays = rawBillPayments
          .filter(p => String(p.bill_id) === String(bill.id))
          .sort((a, b) => new Date(b.date_added) - new Date(a.date_added));
        const amount_paid = bPays.reduce((s, p) => s + Number(p.amount || 0), 0);
        const balance_due = Math.max(0, Number(bill.total_amount || 0) - amount_paid);
        return { ...bill, amount_paid, balance_due, payments: bPays };
      });
  }, [rawBills, rawBillPayments, vendor.id]);

  const activeBills  = useMemo(() => bills.filter(ACTIVE), [bills]);
  const settledBills = useMemo(() => bills.filter(SETTLED), [bills]);
  const hasBills     = bills.length > 0;

  // All payments across vendor's bills (for PaymentActivity)
  const allBillPayments = useMemo(() => {
    const billIds = new Set(bills.map(b => String(b.id)));
    return rawBillPayments
      .filter(p => billIds.has(String(p.bill_id)))
      .sort((a, b) => new Date(b.date_added) - new Date(a.date_added));
  }, [rawBillPayments, bills]);

  const handleDeleteBill = async (billId) => {
    if (!window.confirm('Delete this bill? All its payments will also be deleted. Mirrored vendor payments are kept.')) return;
    setDeletingBillIds(prev => new Set([...prev, billId]));
    try {
      const billPays = rawBillPayments.filter(p => String(p.bill_id) === String(billId));
      for (const p of billPays) {
        await pushEntity('custom_bill_payment', 'delete', { id: p.id });
      }
      await pushEntity('custom_bill', 'delete', { id: billId });
      showToast('Bill deleted');
    } catch (e) {
      showToast(e.message || 'Failed to delete bill', 'error');
    } finally {
      setDeletingBillIds(prev => { const n = new Set(prev); n.delete(billId); return n; });
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await refresh(); } finally { setRefreshing(false); }
  };

  // WhatsApp summary for all active bills
  const handleWAAll = () => {
    if (!vendor?.phone) return;
    const storeName = getReceiptSettings().store_name || 'Store';
    let msg = `🧾 *Custom Bills Summary* — ${storeName}\n👤 ${vendor.name}\n───────────────\n`;
    for (const b of activeBills) msg += `📌 ${b.title}: ${PKR(b.balance_due)} remaining\n`;
    msg += `───────────────\n💰 Total Outstanding: ${PKR(activeBills.reduce((s, b) => s + b.balance_due, 0))}`;
    let phone = String(vendor.phone).replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '92' + phone.substring(1);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const PDF_FILTERS = [
    { key: 'today', label: 'Today' },
    { key: 'week',  label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'custom', label: 'Custom' },
  ];

  const pdfActiveBills = useMemo(() =>
    activeBills.filter(b => inPeriod(b.date_created, pdfFilter, pdfFrom, pdfTo))
  , [activeBills, pdfFilter, pdfFrom, pdfTo]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed top-0 right-0 z-50 h-full bg-background border-l border-border shadow-2xl flex flex-col"
        style={{ width: 'min(680px, 100vw)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-border/60 bg-card/80 backdrop-blur px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-amber-500/10 rounded-xl shrink-0">
              <Wallet size={18} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-foreground">Custom Bills</p>
              <p className="text-xs text-muted-foreground truncate">
                {vendor.name}{vendor.phone ? ` · ${vendor.phone}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={handleRefresh} disabled={refreshing}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* KPI Board — only when active bills exist */}
          {activeBills.length > 0 && (
            <>
              <KPIBoard activeBills={activeBills} />
              <div className="h-px bg-border/60" />
            </>
          )}

          {/* Payment Activity — only when any bills exist */}
          {hasBills && (
            <>
              <PaymentActivity bills={bills} allPayments={allBillPayments} />
              <div className="h-px bg-border/60" />
            </>
          )}

          {/* Action Bar */}
          <div className="bg-background/95 backdrop-blur border-b border-border/60 px-4 py-3 flex items-center gap-2 flex-wrap">
            <button onClick={() => setNewBillOpen(true)}
              className="flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors">
              <Plus size={14} /> New Bill
            </button>

            {activeBills.length > 0 && (
              <div className="flex items-center gap-1.5 ml-auto flex-wrap justify-end">
                {/* PDF date filter */}
                <div className="flex items-center rounded-lg overflow-hidden border border-border">
                  {PDF_FILTERS.map(f => (
                    <button key={f.key} onClick={() => setPdfFilter(f.key)}
                      className={cn(
                        'text-[11px] font-medium px-2.5 py-1.5 transition-colors border-r border-border last:border-r-0',
                        pdfFilter === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                      )}>
                      {f.label}
                    </button>
                  ))}
                </div>

                {pdfFilter === 'custom' && (
                  <div className="flex gap-1">
                    <Input type="date" value={pdfFrom} onChange={e => setPdfFrom(e.target.value)} className="h-7 text-[11px] w-[130px]" />
                    <Input type="date" value={pdfTo}   onChange={e => setPdfTo(e.target.value)}   className="h-7 text-[11px] w-[130px]" />
                  </div>
                )}

                <button
                  onClick={() => downloadAllBillsPdf(pdfActiveBills, vendor, getReceiptSettings().store_name || 'My Store')}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/20 transition-colors">
                  <FileText size={12} /> Invoice PDF
                </button>

                {vendor?.phone && (
                  <button onClick={handleWAAll}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/20 transition-colors">
                    <MessageCircle size={12} /> WhatsApp
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Tab switcher — only when bills exist */}
          {hasBills && (
            <div className="px-4 pt-4 pb-1 flex gap-2">
              <button onClick={() => setTab('active')}
                className={cn(
                  'flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 rounded-full transition-colors',
                  tab === 'active' ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                )}>
                Active ({activeBills.length})
              </button>
              <button onClick={() => setTab('settled')}
                className={cn(
                  'flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 rounded-full transition-colors',
                  tab === 'settled' ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                )}>
                <Clock size={11} /> Settled ({settledBills.length})
              </button>
            </div>
          )}

          {/* Bills list */}
          <div className="px-4 py-4 space-y-3">
            {tab === 'active' ? (
              activeBills.length === 0 ? (
                <div className="flex flex-col items-center py-16 gap-3 text-center">
                  <Wallet size={40} className="text-muted-foreground/20" />
                  <p className="text-sm font-medium text-muted-foreground">
                    {settledBills.length > 0 ? 'All bills settled!' : 'No custom bills yet'}
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    {settledBills.length > 0
                      ? 'Check the Settled tab for history.'
                      : 'Tap "+ New Bill" above to log the first one.'}
                  </p>
                </div>
              ) : (
                <>
                  {activeBills.slice(0, activePage).map(bill => (
                    <BillCard
                      key={bill.id} bill={bill} vendor={vendor} purchases={vendorPurchases}
                      onDeleteBill={handleDeleteBill} deletingBill={deletingBillIds.has(bill.id)}
                    />
                  ))}
                  {activeBills.length > activePage && (
                    <button onClick={() => setActivePage(p => p + PAGE_SZ)}
                      className="w-full text-xs text-primary hover:underline py-3 font-medium">
                      Load more ({activeBills.length - activePage} remaining)
                    </button>
                  )}
                </>
              )
            ) : (
              settledBills.length === 0 ? (
                <div className="flex flex-col items-center py-16 gap-3 text-center">
                  <History size={40} className="text-muted-foreground/20" />
                  <p className="text-sm font-medium text-muted-foreground">No settled bills yet</p>
                </div>
              ) : (
                <>
                  {settledBills.slice(0, settledPage).map(bill => (
                    <SettledBillCard key={bill.id} bill={bill} vendor={vendor} purchases={vendorPurchases} />
                  ))}
                  {settledBills.length > settledPage && (
                    <button onClick={() => setSettledPage(p => p + PAGE_SZ)}
                      className="w-full text-xs text-primary hover:underline py-3 font-medium">
                      Load more ({settledBills.length - settledPage} remaining)
                    </button>
                  )}
                </>
              )
            )}
          </div>
        </div>
      </motion.div>

      {/* New Bill Modal */}
      <AnimatePresence>
        {newBillOpen && (
          <NewBillModal
            vendor={vendor} purchases={vendorPurchases}
            open={newBillOpen} onClose={() => setNewBillOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
