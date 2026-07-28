import { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatDateTime } from '../../utils/format';

export default function EmployeeHistoryModal({ open, onClose, target, advances, salaryExpenses }) {
  const [tab, setTab] = useState('salary');

  useEffect(() => {
    if (target?.tab) setTab(target.tab);
  }, [target]);

  const employee = target?.employee;

  const salaryRows = useMemo(
    () =>
      (salaryExpenses || [])
        .filter((e) => String(e.employee_id) === String(employee?.id))
        .sort((a, b) => new Date(b.date_added || 0) - new Date(a.date_added || 0)),
    [salaryExpenses, employee]
  );

  const udharRows = useMemo(() => {
    const rows = (advances || [])
      .filter((a) => String(a.employee_id) === String(employee?.id))
      .sort((a, b) => new Date(a.date_added || 0) - new Date(b.date_added || 0));
    let running = 0;
    const withRunning = rows.map((r) => {
      running += r.type === 'advance' ? Number(r.amount || 0) : -Number(r.amount || 0);
      return { ...r, running };
    });
    return withRunning.reverse();
  }, [advances, employee]);

  if (!target) return null;

  return (
    <Modal open={open} onClose={onClose} title={employee?.name}>
      <div className="mb-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="salary">Salary History</TabsTrigger>
            <TabsTrigger value="udhar">Udhar History</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === 'salary' ? (
        <div className="divide-y divide-border">
          {salaryRows.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No salary payments yet.</p>}
          {salaryRows.map((e) => (
            <div key={e.id} className="flex justify-between py-2 text-sm">
              <div>
                <p className="text-ink">{e.title}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(e.date_added)}</p>
              </div>
              <span className="font-medium text-ink">{formatCurrency(e.amount)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {udharRows.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No udhar records yet.</p>}
          {udharRows.map((a) => (
            <div key={a.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="text-ink capitalize">{a.type}</p>
                <p className="text-xs text-muted-foreground">{a.description || '—'} · {formatDateTime(a.date_added)}</p>
              </div>
              <div className="text-right">
                <span className={a.type === 'advance' ? 'text-brand-orange' : 'text-brand-green'}>
                  {a.type === 'advance' ? '+' : '-'}
                  {formatCurrency(a.amount)}
                </span>
                <p className="text-xs text-muted-foreground">Bal: {formatCurrency(a.running)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
