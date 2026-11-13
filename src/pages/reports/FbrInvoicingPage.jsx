import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, CheckCircle2, Clock, XCircle, AlertTriangle, Search, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { isCancelled } from '@/lib/ledger';

const fmtPKR  = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const FBR_STATUS = {
  sent:    { label: 'Sent',    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', icon: CheckCircle2 },
  pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',   icon: Clock },
  failed:  { label: 'Failed',  cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400',     icon: XCircle },
  skipped: { label: 'Skipped', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',    icon: AlertTriangle },
};

export default function FbrInvoicingPage() {
  const navigate = useNavigate();
  const { list } = useDataStore();
  const { showToast } = useToast();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const customers = useMemo(() => {
    const m = {};
    for (const c of list('customer')) m[String(c.id)] = c;
    return m;
  }, [list]);

  const invoices = useMemo(() => {
    return list('sale')
      .filter((s) => !isCancelled(s))
      .map((s) => ({
        ...s,
        fbr_status: s.fbr_status || (s.fbr_invoice_number ? 'sent' : 'pending'),
        customer: customers[String(s.customer_id)],
      }))
      .sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0));
  }, [list, customers]);

  const counts = useMemo(() => ({
    all:     invoices.length,
    sent:    invoices.filter((i) => i.fbr_status === 'sent').length,
    pending: invoices.filter((i) => i.fbr_status === 'pending').length,
    failed:  invoices.filter((i) => i.fbr_status === 'failed').length,
    skipped: invoices.filter((i) => i.fbr_status === 'skipped').length,
  }), [invoices]);

  const filtered = useMemo(() => {
    let rows = filter === 'all' ? invoices : invoices.filter((i) => i.fbr_status === filter);
    const q = search.toLowerCase();
    if (q) rows = rows.filter((i) => String(i.id).includes(q) || (i.customer?.name || '').toLowerCase().includes(q) || (i.fbr_invoice_number || '').toLowerCase().includes(q));
    return rows;
  }, [invoices, filter, search]);

  const handleRetry = (invoice) => {
    showToast(`Retry queued for INV #${invoice.id} — connect FBR sandbox token in Settings`, 'info');
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/reports')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={14} /> Reports
        </button>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm font-semibold">FBR Digital Invoicing</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Shield size={18} className="text-emerald-600" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">FBR e-Invoicing</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Track real-time invoice submission status to FBR</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
          <AlertTriangle size={13} className="text-amber-600 shrink-0" />
          <span>FBR sandbox token required — configure in <button onClick={() => navigate('/settings')} className="font-bold text-amber-700 dark:text-amber-400 hover:underline">Settings</button></span>
        </div>
      </div>

      {/* Status summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'sent',    label: 'Sent to FBR',  color: 'text-emerald-600', bg: 'bg-emerald-500/5 border-emerald-500/15', icon: CheckCircle2 },
          { key: 'pending', label: 'Pending',       color: 'text-amber-600',   bg: 'bg-amber-500/5 border-amber-500/15',   icon: Clock },
          { key: 'failed',  label: 'Failed',        color: 'text-rose-600',    bg: 'bg-rose-500/5 border-rose-500/15',     icon: XCircle },
          { key: 'skipped', label: 'Skipped',       color: 'text-slate-500',   bg: 'bg-muted/30 border-border',            icon: AlertTriangle },
        ].map(({ key, label, color, bg, icon: Icon }) => (
          <button key={key} onClick={() => setFilter(filter === key ? 'all' : key)}
            className={cn('rounded-2xl border px-5 py-4 text-left transition-colors', bg, filter === key ? 'ring-2 ring-primary/30' : '')}>
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Icon size={13} /><span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
            </div>
            <p className={cn('text-2xl font-black tabular-nums', color)}>{counts[key]}</p>
          </button>
        ))}
      </div>

      {/* Filter + search */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-xl overflow-hidden border border-border bg-muted/30">
          {[['all', `All (${counts.all})`], ['pending', 'Pending'], ['failed', 'Failed']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={cn('h-9 px-4 text-sm font-semibold transition-colors', filter === v ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
              {l}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Invoice # or customer…"
            className="h-9 w-full pl-8 pr-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
      </div>

      {/* Invoice list */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground/40">
            <Shield size={36} />
            <p className="text-sm">No invoices match this filter</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map((inv) => {
              const st = FBR_STATUS[inv.fbr_status] || FBR_STATUS.pending;
              const StIcon = st.icon;
              return (
                <div key={inv.id} className="flex items-center px-5 py-3.5 gap-4 hover:bg-muted/20 transition-colors">
                  <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0', st.cls)}>
                    <StIcon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black font-mono">INV #{inv.id}</span>
                      <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full', st.cls)}>{st.label}</span>
                      {inv.fbr_invoice_number && (
                        <span className="text-[9px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{inv.fbr_invoice_number}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {inv.customer?.name || 'Walk-in'} · {fmtDate(inv.date_created)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black tabular-nums">{fmtPKR(inv.total)}</p>
                  </div>
                  {inv.fbr_status === 'failed' && (
                    <button onClick={() => handleRetry(inv)} title="Retry submission"
                      className="w-8 h-8 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors shrink-0">
                      <RefreshCw size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">{filtered.length} invoice{filtered.length !== 1 ? 's' : ''}</p>
    </div>
  );
}
