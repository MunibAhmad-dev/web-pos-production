import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X, FileText, MessageCircle, Printer,
  ChevronDown, ChevronUp, Loader2, RefreshCw,
  Phone, DollarSign, TrendingDown, ListChecks, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { getReceiptSettings } from '../../utils/receipt';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_LIMIT = 20;
const fmtPKR  = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; } };
const fmtDT   = (d) => { try { return new Date(d).toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return d; } };
const todayStr = () => new Date().toISOString().slice(0, 10);

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, accent }) {
  return (
    <Card className="border border-border/60">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
          <div className="p-1.5 rounded-lg bg-muted">
            <Icon className={`w-3.5 h-3.5 ${accent}`} />
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground tabular-nums leading-none">{value}</p>
      </CardContent>
    </Card>
  );
}

// ─── Inline Payment Row ───────────────────────────────────────────────────────

function PayRow({ bill, onPaid }) {
  const { pushEntity } = useDataStore();
  const { showToast } = useToast();
  const [open, setOpen]     = useState(false);
  const [amt, setAmt]       = useState('');
  const [note, setNote]     = useState('');
  const [saving, setSaving] = useState(false);

  const handlePay = async () => {
    const n = Number(amt);
    if (!n || n <= 0) { showToast('Enter a valid amount', 'error'); return; }
    setSaving(true);
    try {
      await pushEntity('custom_bill_payment', 'create', {
        bill_id:    bill.id,
        amount:     n,
        note:       note.trim() || null,
        date_added: new Date().toISOString(),
      });
      showToast(`PKR ${n.toLocaleString()} recorded for "${bill.title}"`);
      setAmt(''); setNote(''); setOpen(false);
      onPaid();
    } catch (e) {
      showToast(e.message || 'Failed to save payment', 'error');
    } finally { setSaving(false); }
  };

  const pct = bill.total_amount > 0 ? Math.min(100, Math.round((bill.amount_paid / bill.total_amount) * 100)) : 0;

  return (
    <div className="border border-border/60 rounded-xl overflow-hidden bg-card">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Vendor avatar */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
          style={{ background: `hsl(${(bill.vendor_name.charCodeAt(0) * 37) % 360}, 55%, 48%)` }}
        >
          {bill.vendor_name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{bill.vendor_name}</span>
            {bill.vendor_phone && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Phone className="w-2.5 h-2.5" />{bill.vendor_phone}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-muted-foreground truncate">{bill.title}</span>
            <span className="text-[10px] text-muted-foreground/40">·</span>
            <span className="text-[10px] text-muted-foreground">{fmtDate(bill.date_created)}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] text-muted-foreground">{pct}%</span>
          </div>
        </div>

        <div className="text-right flex-shrink-0 hidden sm:block mr-1">
          <div className="text-[10px] text-muted-foreground">Total</div>
          <div className="text-sm font-medium">{fmtPKR(bill.total_amount)}</div>
        </div>
        <div className="text-right flex-shrink-0 hidden sm:block mr-1">
          <div className="text-[10px] text-muted-foreground">Paid</div>
          <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{fmtPKR(bill.amount_paid)}</div>
        </div>
        <div className="text-right flex-shrink-0 mr-3">
          <div className="text-[10px] text-muted-foreground">Remaining</div>
          <div className="text-sm font-bold text-rose-600 dark:text-rose-400">{fmtPKR(bill.balance_due)}</div>
        </div>

        <Button
          size="sm"
          variant={open ? 'secondary' : 'default'}
          className="flex-shrink-0 h-8 text-xs gap-1"
          onClick={() => setOpen(v => !v)}
        >
          {open
            ? <><ChevronUp className="w-3 h-3" />Cancel</>
            : <><DollarSign className="w-3 h-3" />Pay</>}
        </Button>
      </div>

      {open && (
        <div className="border-t border-border/50 bg-muted/30 px-4 py-3 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[120px]">
            <label className="text-xs text-muted-foreground mb-1 block">Amount (PKR)</label>
            <Input
              type="number"
              placeholder={`Max ${Math.round(bill.balance_due)}`}
              value={amt}
              onChange={e => setAmt(e.target.value)}
              className="h-8 text-sm font-mono"
              min="1"
              max={bill.balance_due}
              onKeyDown={e => e.key === 'Enter' && handlePay()}
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-muted-foreground mb-1 block">Note (optional)</label>
            <Input
              type="text"
              placeholder="e.g. Cash payment"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={e => e.key === 'Enter' && handlePay()}
            />
          </div>
          <Button size="sm" onClick={handlePay} disabled={saving} className="h-8 text-xs gap-1">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
            {saving ? 'Saving…' : 'Confirm'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main Overlay ─────────────────────────────────────────────────────────────

export default function GlobalCustomBillsOverlay({ onClose }) {
  const { list, refresh } = useDataStore();
  const { showToast } = useToast();

  const [loading, setLoading]     = useState(false);
  const [visibleCount, setVisible] = useState(PAGE_LIMIT);

  const [reportMode, setReportMode] = useState('today');
  const [customFrom, setCustomFrom] = useState(todayStr());
  const [customTo, setCustomTo]     = useState(todayStr());
  const [generating, setGenerating] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Derive data from store
  const allVendors     = list('vendor');
  const rawBills       = list('custom_bill');
  const rawPayments    = list('custom_bill_payment');

  const { bills, stats } = useMemo(() => {
    const enriched = rawBills
      .map(bill => {
        const vendor   = allVendors.find(v => String(v.id) === String(bill.vendor_id));
        const bPays    = rawPayments.filter(p => String(p.bill_id) === String(bill.id));
        const amount_paid = bPays.reduce((s, p) => s + Number(p.amount || 0), 0);
        const balance_due = Math.max(0, Number(bill.total_amount || 0) - amount_paid);
        return {
          ...bill,
          vendor_name:  vendor?.name  || 'Unknown Vendor',
          vendor_phone: vendor?.phone || null,
          amount_paid,
          balance_due,
        };
      })
      .filter(b => b.balance_due > 0.1)
      .sort((a, b) => new Date(b.date_created) - new Date(a.date_created));

    const s = {
      active_count:    enriched.length,
      total_billed:    enriched.reduce((s, b) => s + Number(b.total_amount || 0), 0),
      total_paid:      enriched.reduce((s, b) => s + b.amount_paid, 0),
      total_remaining: enriched.reduce((s, b) => s + b.balance_due, 0),
    };

    return { bills: enriched, stats: s };
  }, [rawBills, rawPayments, allVendors]);

  const visible   = bills.slice(0, visibleCount);
  const hasMore   = bills.length > visibleCount;
  const totalCount = bills.length;

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try { await refresh(); } finally { setLoading(false); }
  }, [refresh]);

  // ── Report helpers ──────────────────────────────────────────────────────────

  const effectiveDates = () => reportMode === 'today'
    ? { from: todayStr(), to: todayStr() }
    : { from: customFrom, to: customTo };

  const buildReportPayments = ({ from, to }) => {
    return rawPayments
      .filter(p => {
        const d = new Date(p.date_added);
        return d >= new Date(from + 'T00:00:00') && d <= new Date(to + 'T23:59:59');
      })
      .map(p => {
        const bill   = rawBills.find(b => String(b.id) === String(p.bill_id));
        const vendor = allVendors.find(v => bill && String(v.id) === String(bill.vendor_id));
        return {
          ...p,
          bill_title:  bill?.title        || '—',
          bill_total:  bill?.total_amount || 0,
          vendor_name: vendor?.name       || '—',
          vendor_phone: vendor?.phone     || null,
        };
      })
      .sort((a, b) => new Date(b.date_added) - new Date(a.date_added));
  };

  const buildReportHtml = (payments, repStats, dateLabel, biz) => {
    const paid_total = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const rows = payments.map(p => `
      <tr>
        <td>${fmtDT(p.date_added)}</td>
        <td>${p.vendor_name}</td>
        <td>${p.bill_title}</td>
        <td style="text-align:right">${fmtPKR(p.amount)}</td>
        <td>${p.note || '—'}</td>
      </tr>`).join('');

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Custom Bills Report</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#111;font-size:12px;padding:20px}
  .hdr{text-align:center;margin-bottom:16px}
  .hdr h1{font-size:20px;font-weight:700;color:#1e293b}
  .hdr p{color:#64748b;font-size:11px;margin-top:2px}
  .sw{font-size:13px;font-weight:600;color:#4f46e5}
  hr{border:none;border-top:2px solid #e2e8f0;margin:12px 0}
  .stats{display:flex;gap:12px;margin-bottom:16px}
  .sb{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px}
  .sb .l{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}
  .sb .v{font-size:16px;font-weight:700;margin-top:2px}
  .red{color:#dc2626}.grn{color:#16a34a}.blu{color:#2563eb}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th,td{padding:7px 8px;text-align:left;border-bottom:1px solid #f1f5f9;font-size:11px}
  th{background:#f8fafc;font-weight:600;color:#374151}
  tr:last-child td{border-bottom:none}
  .ft{text-align:center;margin-top:20px;font-size:10px;color:#94a3b8}
</style></head>
<body>
<div class="hdr">
  <div class="sw">OsaTech POS</div>
  <h1>Custom Bills Report</h1>
  ${biz ? `<p>${biz}</p>` : ''}
  <p>Period: ${dateLabel}</p>
  <p>Generated: ${fmtDT(new Date().toISOString())}</p>
</div>
<hr/>
<div class="stats">
  <div class="sb"><div class="l">All-time Remaining</div><div class="v red">${fmtPKR(repStats?.total_remaining ?? 0)}</div></div>
  <div class="sb"><div class="l">All-time Paid</div><div class="v grn">${fmtPKR(repStats?.total_paid ?? 0)}</div></div>
  <div class="sb"><div class="l">Paid in Period</div><div class="v blu">${fmtPKR(paid_total)}</div></div>
</div>
<h3 style="font-size:12px;font-weight:600;margin-bottom:6px;color:#374151">Payments in Period (${payments.length})</h3>
${payments.length > 0
  ? `<table><thead><tr><th>Date &amp; Time</th><th>Vendor</th><th>Bill</th><th style="text-align:right">Amount</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table>`
  : '<p style="color:#94a3b8;font-size:11px;padding:8px 0">No payments in this period.</p>'}
<div class="ft">OsaTech POS · Custom Bills · ${fmtDate(new Date().toISOString())}</div>
</body></html>`;
  };

  const handlePrint = () => {
    const { from, to } = effectiveDates();
    if (from > to) { showToast('Start date must be before end date', 'error'); return; }
    setGenerating(true);
    try {
      const payments  = buildReportPayments({ from, to });
      const dateLabel = from === to ? fmtDate(from + 'T00:00:00') : `${fmtDate(from + 'T00:00:00')} — ${fmtDate(to + 'T00:00:00')}`;
      const biz       = getReceiptSettings().store_name || '';
      const html      = buildReportHtml(payments, stats, dateLabel, biz);
      const win = window.open('', '_blank');
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 400);
    } catch (e) {
      showToast(e.message || 'Failed to generate report', 'error');
    } finally { setGenerating(false); }
  };

  const handleWa = () => {
    const { from, to } = effectiveDates();
    if (from > to) { showToast('Start date must be before end date', 'error'); return; }
    setGenerating(true);
    try {
      const payments   = buildReportPayments({ from, to });
      const dateLabel  = from === to ? fmtDate(from + 'T00:00:00') : `${fmtDate(from + 'T00:00:00')} – ${fmtDate(to + 'T00:00:00')}`;
      const paid_total = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
      const biz        = getReceiptSettings().store_name ? `\n${getReceiptSettings().store_name}` : '';
      let msg = `*OsaTech POS — Custom Bills*${biz}\nPeriod: ${dateLabel}\n\n`;
      msg += `📊 *Summary*\n• Remaining: *${fmtPKR(stats.total_remaining)}*\n• Total Paid: *${fmtPKR(stats.total_paid)}*\n• Paid in Period: *${fmtPKR(paid_total)}*\n\n`;
      if (payments.length > 0) {
        msg += `💳 *Payments (${payments.length})*\n`;
        payments.slice(0, 15).forEach(p => {
          msg += `• ${p.vendor_name} — ${p.bill_title}: *${fmtPKR(p.amount)}* (${fmtDate(p.date_added)})\n`;
        });
        if (payments.length > 15) msg += `… and ${payments.length - 15} more\n`;
      } else {
        msg += `No payments in this period.\n`;
      }
      msg += `\n_Generated by OsaTech POS_`;
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    } catch (e) {
      showToast(e.message || 'Failed', 'error');
    } finally { setGenerating(false); }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Sheet */}
      <div
        className="relative w-full max-w-4xl bg-background rounded-2xl shadow-2xl border border-border/60 flex flex-col animate-in zoom-in-95 duration-200"
        style={{ maxHeight: 'calc(100vh - 48px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/60 flex-shrink-0">
          <div className="p-2 rounded-xl bg-primary/10">
            <ListChecks className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold leading-tight">All Custom Bills</h2>
            <p className="text-xs text-muted-foreground">Active pending bills across all vendors</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={loading} className="h-8 text-xs gap-1">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Active Bills"    value={String(stats.active_count)}   icon={ListChecks}   accent="text-blue-500" />
            <StatCard label="Total Billed"    value={fmtPKR(stats.total_billed)}   icon={DollarSign}   accent="text-amber-500" />
            <StatCard label="Total Paid"      value={fmtPKR(stats.total_paid)}     icon={CheckCircle2} accent="text-emerald-500" />
            <StatCard label="Total Remaining" value={fmtPKR(stats.total_remaining)} icon={TrendingDown} accent="text-rose-500" />
          </div>

          {/* Report */}
          <div className="border border-border/60 rounded-xl bg-card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Generate Report
            </h3>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex rounded-lg overflow-hidden border border-border">
                {['today', 'custom'].map((m, i) => (
                  <button
                    key={m}
                    onClick={() => setReportMode(m)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${i > 0 ? 'border-l border-border' : ''} ${
                      reportMode === m ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {m === 'today' ? 'Today' : 'Custom Range'}
                  </button>
                ))}
              </div>

              {reportMode === 'custom' && (
                <>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">From</label>
                    <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-8 text-xs w-36" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">To</label>
                    <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-8 text-xs w-36" />
                  </div>
                </>
              )}

              <Button size="sm" onClick={handlePrint} disabled={generating} className="h-8 text-xs gap-1">
                {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Printer className="w-3 h-3" />}
                PDF / Print
              </Button>
              <Button
                size="sm" variant="outline" onClick={handleWa} disabled={generating}
                className="h-8 text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950/30"
              >
                <MessageCircle className="w-3 h-3" />
                WhatsApp
              </Button>
            </div>
          </div>

          {/* Bills list */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">
                Active Bills
                {totalCount > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    ({visible.length} of {totalCount})
                  </span>
                )}
              </h3>
            </div>

            {bills.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-500/50" />
                <div className="text-center">
                  <p className="font-semibold text-sm">All clear!</p>
                  <p className="text-xs mt-1">No active custom bills across any vendor.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {visible.map(bill => (
                  <PayRow key={bill.id} bill={bill} onPaid={() => {}} />
                ))}

                {hasMore && (
                  <div className="pt-2 flex justify-center">
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setVisible(v => v + PAGE_LIMIT)}
                      className="h-8 text-xs gap-1 min-w-[160px]"
                    >
                      <ChevronDown className="w-3 h-3" />
                      Load More ({totalCount - visibleCount} remaining)
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
