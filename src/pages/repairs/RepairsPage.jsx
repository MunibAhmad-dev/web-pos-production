import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wrench, Plus, Search, Clock, CheckCircle2, X, Phone, Package, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtPKR  = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');

const JOB_STATUS = {
  pending:     { label: 'Pending',     cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
  ready:       { label: 'Ready',       cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400' },
  completed:   { label: 'Completed',   cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
  cancelled:   { label: 'Cancelled',   cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
};

const BLANK = { customer_name: '', phone: '', device: '', issue: '', estimated_cost: '', status: 'pending', notes: '' };

export default function RepairsPage() {
  const navigate = useNavigate();
  const { list, pushEntity } = useDataStore();
  const { showToast } = useToast();

  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('all');
  const [showAdd, setShowAdd]     = useState(false);
  const [form, setForm]           = useState(BLANK);
  const [saving, setSaving]       = useState(false);
  const [editId, setEditId]       = useState(null);

  const jobs = useMemo(() => {
    return list('repair_job')
      .sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0));
  }, [list]);

  const filtered = useMemo(() => {
    let rows = statusFilter === 'all' ? jobs : jobs.filter((j) => j.status === statusFilter);
    const q = search.toLowerCase();
    if (q) rows = rows.filter((j) => (j.customer_name || '').toLowerCase().includes(q) || (j.device || '').toLowerCase().includes(q) || String(j.id).includes(q));
    return rows;
  }, [jobs, search, statusFilter]);

  const counts = useMemo(() => {
    const c = { all: jobs.length, pending: 0, in_progress: 0, ready: 0, completed: 0, cancelled: 0 };
    for (const j of jobs) if (c[j.status] !== undefined) c[j.status]++;
    return c;
  }, [jobs]);

  const openEdit = (job) => {
    setForm({ customer_name: job.customer_name || '', phone: job.phone || '', device: job.device || '', issue: job.issue || '', estimated_cost: job.estimated_cost || '', status: job.status || 'pending', notes: job.notes || '' });
    setEditId(job.id);
    setShowAdd(true);
  };

  const handleSave = async () => {
    if (!form.customer_name.trim()) { showToast('Customer name is required', 'error'); return; }
    if (!form.device.trim())        { showToast('Device description is required', 'error'); return; }
    setSaving(true);
    try {
      if (editId) {
        const existing = jobs.find((j) => String(j.id) === String(editId));
        await pushEntity('repair_job', 'update', { ...existing, ...form, estimated_cost: Number(form.estimated_cost) || 0, updated_at: new Date().toISOString() });
        showToast('Job updated');
      } else {
        await pushEntity('repair_job', 'create', { ...form, estimated_cost: Number(form.estimated_cost) || 0, date_created: new Date().toISOString() });
        showToast('Job created');
      }
      setShowAdd(false);
      setForm(BLANK);
      setEditId(null);
    } catch { showToast('Failed to save', 'error'); }
    setSaving(false);
  };

  const updateStatus = async (job, newStatus) => {
    try {
      await pushEntity('repair_job', 'update', { ...job, status: newStatus, updated_at: new Date().toISOString() });
      showToast(`Status → ${JOB_STATUS[newStatus]?.label}`);
    } catch { showToast('Update failed', 'error'); }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={14} /> Dashboard
        </button>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm font-semibold">Repairs</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Repair Jobs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track device repair jobs and their status</p>
        </div>
        <button onClick={() => { setForm(BLANK); setEditId(null); setShowAdd(true); }}
          className="flex items-center gap-2 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
          <Plus size={15} /> New Job
        </button>
      </div>

      {/* Status summary */}
      <div className="flex flex-wrap gap-2">
        {[['all', 'All'], ['pending', 'Pending'], ['in_progress', 'In Progress'], ['ready', 'Ready'], ['completed', 'Completed']].map(([v, l]) => (
          <button key={v} onClick={() => setStatus(v)}
            className={cn('h-8 px-3 rounded-full text-xs font-semibold border transition-colors', statusFilter === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted')}>
            {l} <span className="ml-1 opacity-70">({counts[v] ?? 0})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Customer, device or ID…"
          className="h-9 w-full pl-8 pr-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </div>

      {/* Job list */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground/40">
            <Wrench size={36} />
            <p className="text-sm">No repair jobs yet</p>
            <button onClick={() => setShowAdd(true)} className="text-sm text-primary hover:underline">Create first job</button>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map((job) => {
              const st = JOB_STATUS[job.status] || JOB_STATUS.pending;
              return (
                <div key={job.id} className="px-5 py-4 hover:bg-muted/10 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Wrench size={15} className="text-violet-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black font-mono">JOB #{job.id}</span>
                          <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full', st.cls)}>{st.label}</span>
                        </div>
                        <p className="text-sm font-semibold mt-0.5">{job.customer_name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5 flex-wrap">
                          {job.phone && <span className="flex items-center gap-1"><Phone size={10} /> {job.phone}</span>}
                          <span className="flex items-center gap-1"><Package size={10} /> {job.device}</span>
                          <span>{fmtDate(job.date_created)}</span>
                        </p>
                        {job.issue && <p className="text-xs text-muted-foreground mt-1 bg-muted/40 rounded-lg px-2 py-1 inline-block max-w-sm truncate">"{job.issue}"</p>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {job.estimated_cost > 0 && <p className="text-sm font-black tabular-nums">{fmtPKR(job.estimated_cost)}</p>}
                    </div>
                  </div>

                  {/* Status quick-change + edit */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {Object.entries(JOB_STATUS).filter(([k]) => k !== job.status && k !== 'cancelled').map(([k, v]) => (
                      <button key={k} onClick={() => updateStatus(job, k)}
                        className="h-7 px-2.5 rounded-lg text-[11px] font-semibold border border-border hover:bg-muted transition-colors">
                        → {v.label}
                      </button>
                    ))}
                    <button onClick={() => openEdit(job)} className="h-7 px-2.5 rounded-lg text-[11px] font-semibold border border-border hover:bg-muted ml-auto">Edit</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => { setShowAdd(false); setEditId(null); }}>
          <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-black text-base">{editId ? 'Edit Repair Job' : 'New Repair Job'}</h2>
              <button onClick={() => { setShowAdd(false); setEditId(null); }} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              {[
                { key: 'customer_name', label: 'Customer Name *', placeholder: 'e.g. Ahmed Khan' },
                { key: 'phone',         label: 'Phone Number',    placeholder: '0300-1234567' },
                { key: 'device',        label: 'Device *',        placeholder: 'e.g. Samsung Galaxy S21' },
                { key: 'issue',         label: 'Issue',           placeholder: 'Describe the problem' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">{label}</label>
                  <input value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Estimated Cost</label>
                  <input type="number" value={form.estimated_cost} onChange={(e) => setForm((f) => ({ ...f, estimated_cost: e.target.value }))} placeholder="0"
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Status</label>
                  <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {Object.entries(JOB_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Internal Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Parts needed, technician notes…" rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
            </div>
            <div className="flex items-center gap-3 p-5 border-t border-border">
              <button onClick={() => { setShowAdd(false); setEditId(null); }} className="flex-1 h-9 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
