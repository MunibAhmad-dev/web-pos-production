import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Landmark, Lock, Unlock, TrendingUp, TrendingDown, Search, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';

const fmtPKR = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const fmtDT  = (d) => d ? new Date(d).toLocaleString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDur = (ms) => {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

function computeMovement(session, sales, expenses) {
  const start = new Date(session.opened_at);
  const end   = session.closed_at ? new Date(session.closed_at) : new Date();
  const inWin = (d) => d && new Date(d) >= start && new Date(d) <= end;
  let cashIn = 0, cashOut = 0;
  for (const s of sales) {
    if ((s.payment_method === 'cash' || s.payment_method === 'Cash') && s.status === 'Completed' && inWin(s.date_created))
      cashIn += Number(s.total || 0);
  }
  for (const e of expenses) {
    if (inWin(e.date_created || e.date_added)) cashOut += Number(e.amount || 0);
  }
  return { cashIn, cashOut };
}

export default function RegisterHistoryPage() {
  const navigate = useNavigate();
  const { list } = useDataStore();
  const [search, setSearch] = useState('');

  const sales    = list('sale');
  const expenses = list('expense');

  const sessions = useMemo(() => {
    return list('register')
      .map((r) => {
        const { cashIn, cashOut } = computeMovement(r, sales, expenses);
        const duration = r.closed_at
          ? new Date(r.closed_at) - new Date(r.opened_at)
          : Date.now() - new Date(r.opened_at);
        const openAmount  = Number(r.opening_balance || 0);
        const expectedClose = openAmount + cashIn - cashOut;
        const actualClose   = r.closed_at ? Number(r.closing_balance || 0) : null;
        const variance      = actualClose != null ? actualClose - expectedClose : null;
        return { ...r, cashIn, cashOut, duration, openAmount, expectedClose, actualClose, variance };
      })
      .sort((a, b) => new Date(b.opened_at || 0) - new Date(a.opened_at || 0));
  }, [list, sales, expenses]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => fmtDT(s.opened_at).toLowerCase().includes(q));
  }, [sessions, search]);

  const totalSessions  = sessions.length;
  const closedSessions = sessions.filter((s) => s.closed_at).length;
  const totalCashIn    = sessions.reduce((acc, s) => acc + s.cashIn, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/cash-register')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={14} /> Cash Register
        </button>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm font-semibold">Register History</span>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Register Sessions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Full history of all cash register opens and closes</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Sessions',  value: totalSessions,             color: 'text-foreground',  icon: Landmark },
          { label: 'Closed Sessions', value: closedSessions,            color: 'text-emerald-600', icon: Lock },
          { label: 'Total Cash In',   value: fmtPKR(totalCashIn),       color: 'text-emerald-600', icon: TrendingUp },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-border bg-card px-5 py-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Icon size={13} /><span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
            </div>
            <p className={cn('text-xl font-black tabular-nums', color)}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by date…"
          className="h-9 w-full pl-8 pr-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </div>

      {/* Sessions list */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground/40">
            <Landmark size={36} />
            <p className="text-sm">No register sessions found</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map((s) => (
              <div key={s.id} className="px-5 py-4">
                {/* Top row */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', s.closed_at ? 'bg-slate-500/10 text-slate-500' : 'bg-emerald-500/10 text-emerald-600')}>
                      {s.closed_at ? <Lock size={15} /> : <Unlock size={15} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black">Session #{s.id}</span>
                        <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full', s.closed_at ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400')}>
                          {s.closed_at ? 'Closed' : 'Open'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Unlock size={9} /> {fmtDT(s.opened_at)}</span>
                        {s.closed_at && <span className="flex items-center gap-1"><Lock size={9} /> {fmtDT(s.closed_at)}</span>}
                        <span className="flex items-center gap-1"><Clock size={9} /> {fmtDur(s.duration)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Amounts grid */}
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Opening',  value: fmtPKR(s.openAmount),    color: 'text-foreground' },
                    { label: 'Cash In',  value: fmtPKR(s.cashIn),        color: 'text-emerald-600' },
                    { label: 'Cash Out', value: fmtPKR(s.cashOut),       color: 'text-rose-600' },
                    { label: s.closed_at ? 'Closing' : 'Expected Close', value: fmtPKR(s.actualClose ?? s.expectedClose), color: 'text-foreground' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl bg-muted/30 px-3 py-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
                      <p className={cn('text-sm font-black tabular-nums mt-0.5', color)}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Variance badge */}
                {s.variance != null && Math.abs(s.variance) > 0.5 && (
                  <div className={cn('mt-2 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg', s.variance < 0 ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600')}>
                    {s.variance < 0 ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                    {s.variance < 0 ? 'Short' : 'Over'} by {fmtPKR(Math.abs(s.variance))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">{filtered.length} session{filtered.length !== 1 ? 's' : ''}</p>
    </div>
  );
}
