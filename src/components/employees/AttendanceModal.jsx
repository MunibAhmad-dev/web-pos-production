import { useState, useMemo } from 'react';
import { X, CheckCircle2, XCircle, Clock, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';

const STATUS_CONFIG = {
  present:  { label: 'Present',  color: 'bg-emerald-500', text: 'text-emerald-600',  bg: 'bg-emerald-500/10 border-emerald-500/30' },
  absent:   { label: 'Absent',   color: 'bg-rose-500',    text: 'text-rose-600',     bg: 'bg-rose-500/10 border-rose-500/30' },
  half_day: { label: 'Half Day', color: 'bg-amber-500',   text: 'text-amber-600',    bg: 'bg-amber-500/10 border-amber-500/30' },
  leave:    { label: 'Leave',    color: 'bg-blue-500',    text: 'text-blue-600',      bg: 'bg-blue-500/10 border-blue-500/30' },
};

export default function AttendanceModal({ employee, onClose }) {
  const { list, pushEntity, nextId } = useDataStore();
  const { showToast } = useToast();

  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-based

  const allAttendance = list('attendance');
  const empAttendance = useMemo(() => {
    return allAttendance.filter((a) => String(a.employee_id) === String(employee.id));
  }, [allAttendance, employee.id]);

  // Build a map: 'YYYY-MM-DD' → record
  const attMap = useMemo(() => {
    const m = {};
    for (const a of empAttendance) {
      if (a.date) m[a.date] = a;
    }
    return m;
  }, [empAttendance]);

  // Month stats
  const monthStats = useMemo(() => {
    const prefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
    let present = 0, absent = 0, half = 0, leave = 0;
    for (const [date, rec] of Object.entries(attMap)) {
      if (!date.startsWith(prefix)) continue;
      if (rec.status === 'present') present++;
      else if (rec.status === 'absent') absent++;
      else if (rec.status === 'half_day') half++;
      else if (rec.status === 'leave') leave++;
    }
    return { present, absent, half, leave };
  }, [attMap, viewYear, viewMonth]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow    = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const handleMark = async (day, status) => {
    const date = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const existing = attMap[date];
    if (existing) {
      if (existing.status === status) {
        // Toggle off — delete
        await pushEntity('attendance', 'delete', { id: existing.id });
      } else {
        await pushEntity('attendance', 'update', { id: existing.id, status });
      }
    } else {
      await pushEntity('attendance', 'create', {
        id: nextId(),
        employee_id: employee.id,
        date,
        status,
        created_at: new Date().toISOString(),
      });
    }
  };

  const monthName = new Date(viewYear, viewMonth).toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <CalendarDays size={16} className="text-indigo-500" />
            </div>
            <div>
              <h3 className="font-bold text-base">{employee.name}</h3>
              <p className="text-xs text-muted-foreground">Attendance — {employee.role || employee.position || 'Employee'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
        </div>

        {/* Month nav + stats */}
        <div className="px-5 py-3 border-b bg-muted/10 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="h-7 w-7 rounded-lg border border-border hover:bg-muted flex items-center justify-center">
              <ChevronLeft size={14} />
            </button>
            <h4 className="font-bold text-sm">{monthName}</h4>
            <button onClick={nextMonth} disabled={isCurrentMonth} className="h-7 w-7 rounded-lg border border-border hover:bg-muted flex items-center justify-center disabled:opacity-30">
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { key: 'present', label: 'Present', val: monthStats.present, color: 'text-emerald-600' },
              { key: 'absent',  label: 'Absent',  val: monthStats.absent,  color: 'text-rose-600' },
              { key: 'half_day',label: 'Half Day',val: monthStats.half,    color: 'text-amber-600' },
              { key: 'leave',   label: 'Leave',   val: monthStats.leave,   color: 'text-blue-600' },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-background rounded-xl border border-border/50 py-2">
                <p className={cn('text-lg font-black', color)}>{val}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Calendar */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <div key={d} className="text-center text-[10px] font-bold text-muted-foreground/60 uppercase">{d}</div>
            ))}
          </div>
          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDow }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day  = i + 1;
              const date = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const rec  = attMap[date];
              const isToday = isCurrentMonth && day === today.getDate();
              const isFuture = new Date(date) > today;

              return (
                <div key={day} className={cn('rounded-xl p-0.5 border text-center',
                  isToday ? 'border-primary/50 bg-primary/5' : 'border-border/40',
                  isFuture ? 'opacity-40 pointer-events-none' : ''
                )}>
                  <p className={cn('text-[10px] font-bold mb-0.5', isToday ? 'text-primary' : 'text-muted-foreground/60')}>{day}</p>
                  {rec ? (
                    <div className={cn('rounded-lg py-0.5 px-1 text-[9px] font-bold border', STATUS_CONFIG[rec.status]?.bg, STATUS_CONFIG[rec.status]?.text)}>
                      {STATUS_CONFIG[rec.status]?.label?.slice(0, 4)}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-0.5">
                      <button onClick={() => handleMark(day, 'present')} className="rounded bg-emerald-500/10 hover:bg-emerald-500/30 py-0.5 transition-colors" title="Present">
                        <CheckCircle2 size={8} className="text-emerald-600 mx-auto" />
                      </button>
                      <button onClick={() => handleMark(day, 'absent')} className="rounded bg-rose-500/10 hover:bg-rose-500/30 py-0.5 transition-colors" title="Absent">
                        <XCircle size={8} className="text-rose-600 mx-auto" />
                      </button>
                      <button onClick={() => handleMark(day, 'half_day')} className="rounded bg-amber-500/10 hover:bg-amber-500/30 py-0.5 transition-colors col-span-1" title="Half Day">
                        <Clock size={8} className="text-amber-600 mx-auto" />
                      </button>
                      <button onClick={() => handleMark(day, 'leave')} className="rounded bg-blue-500/10 hover:bg-blue-500/30 py-0.5 transition-colors col-span-1" title="Leave">
                        <CalendarDays size={8} className="text-blue-600 mx-auto" />
                      </button>
                    </div>
                  )}
                  {rec && (
                    <button onClick={() => handleMark(day, rec.status)} className="text-[8px] text-muted-foreground/40 hover:text-destructive mt-0.5 block w-full" title="Clear">×</button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-border/40">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={cn('w-2.5 h-2.5 rounded-full', cfg.color)} />
                <span className="text-[10px] text-muted-foreground">{cfg.label}</span>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground ml-auto">Tap a day to mark · tap marked day to clear</p>
          </div>
        </div>

        <div className="px-5 py-3 border-t bg-muted/10 shrink-0 flex justify-end">
          <button onClick={onClose} className="h-8 px-4 text-xs rounded-lg border border-border bg-background hover:bg-muted">Close</button>
        </div>
      </div>
    </div>
  );
}
