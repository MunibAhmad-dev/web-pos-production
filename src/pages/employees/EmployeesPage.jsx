import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, HandCoins, Wallet, History, Receipt } from 'lucide-react';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { Card, CardHeader } from '@/components/ui/panel';
import Table from '@/components/ui/data-table';
import Button from '@/components/ui/action-button';
import Badge from '@/components/ui/status-badge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmployeeFormModal from '../../components/employees/EmployeeFormModal';
import GiveUdharModal from '../../components/employees/GiveUdharModal';
import PaySalaryModal from '../../components/employees/PaySalaryModal';
import EmployeeHistoryModal from '../../components/employees/EmployeeHistoryModal';
import { formatCurrency, formatDateTime } from '../../utils/format';

const StatBlock = ({ label, value, tone = 'text-ink' }) => (
  <div className="rounded-xl border border-border p-4 text-center">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className={`mt-1 text-xl font-semibold ${tone}`}>{value}</p>
  </div>
);

function EmployeeCard({ employee, onPay, onUdhar, onSalaryHistory, onUdharHistory, onEdit, onDelete }) {
  const balance = Number(employee.outstanding_balance || 0);
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {employee.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              {employee.name}
              {employee.is_active === 0 && <Badge tone="gray">Inactive</Badge>}
            </p>
            <p className="text-xs text-muted-foreground">{employee.role || '—'}</p>
          </div>
        </div>
        {balance !== 0 && (
          <button onClick={onUdharHistory} title="View udhar history">
            <Badge tone={balance > 0 ? 'orange' : 'green'}>{formatCurrency(Math.abs(balance))}</Badge>
          </button>
        )}
      </div>

      <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        <span>Salary: {formatCurrency(employee.monthly_salary)}/mo</span>
        {employee.phone && <span>Phone: {employee.phone}</span>}
        {employee.notes && <span className="truncate italic">{employee.notes}</span>}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
        <Button size="sm" variant="secondary" onClick={onPay}>
          <Wallet size={13} /> Pay
        </Button>
        <Button size="sm" variant="secondary" onClick={onUdhar}>
          <HandCoins size={13} /> Udhar
        </Button>
        <button onClick={onSalaryHistory} title="Salary history" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-brand-blue">
          <Receipt size={15} />
        </button>
        <button onClick={onUdharHistory} title="Udhar history" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-brand-blue">
          <History size={15} />
        </button>
        <button onClick={onEdit} className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-brand-blue">
          <Pencil size={15} />
        </button>
        <button onClick={onDelete} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-brand-red">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const { list, pushEntity, pushBatch } = useDataStore();
  const { showToast } = useToast();

  const employees = list('employee');
  const advances = list('employee_advance');
  const expenses = list('expense');
  const accounts = list('account');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [udharTarget, setUdharTarget] = useState(null);
  const [payTarget, setPayTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);

  const activeEmployees = employees.filter((e) => e.is_active !== 0);
  const monthlyPayroll = activeEmployees.reduce((sum, e) => sum + Number(e.monthly_salary || 0), 0);

  const salaryExpenses = useMemo(() => expenses.filter((e) => String(e.category || '').toLowerCase() === 'salary'), [expenses]);
  const salaryPaid30d = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000;
    return salaryExpenses.filter((e) => e.date_added && new Date(e.date_added).getTime() >= cutoff).reduce((s, e) => s + Number(e.amount || 0), 0);
  }, [salaryExpenses]);

  const totalUdharOwed = employees.reduce((sum, e) => sum + Math.max(0, Number(e.outstanding_balance || 0)), 0);

  const handleSaveEmployee = async (form) => {
    const now = new Date().toISOString();
    if (editing) {
      await pushEntity('employee', 'update', { ...editing, ...form, id: editing.id });
    } else {
      await pushEntity('employee', 'create', { ...form, is_active: 1, outstanding_balance: 0, created_at: now });
    }
    showToast(editing ? 'Employee updated' : 'Employee added');
  };

  const handleDelete = async () => {
    await pushEntity('employee', 'delete', { id: deleteTarget.id });
    showToast('Employee removed');
    setDeleteTarget(null);
  };

  const handleUdhar = async ({ type, amount, description }) => {
    const employee = udharTarget;
    const sign = type === 'advance' ? 1 : -1;
    const now = new Date().toISOString();
    await pushBatch([
      { entityType: 'employee_advance', operation: 'create', payload: { employee_id: employee.id, type, amount, description, date_added: now } },
      {
        entityType: 'employee',
        operation: 'update',
        payload: { ...employee, outstanding_balance: Number(employee.outstanding_balance || 0) + amount * sign },
      },
    ]);
    showToast(type === 'advance' ? 'Advance recorded' : 'Repayment recorded');
  };

  const handlePaySalary = async ({ amount, month, notes, accountId }) => {
    const employee = payTarget;
    const now = new Date().toISOString();
    const title = `Salary — ${employee.name}${month ? ` (${month})` : ''}`;
    const events = [
      {
        entityType: 'expense',
        operation: 'create',
        payload: { title, category: 'Salary', amount, notes: notes || '', employee_id: employee.id, date_added: now },
      },
    ];
    if (accountId) {
      const account = accounts.find((a) => String(a.id) === String(accountId));
      if (account) {
        events.push({
          entityType: 'account_txn',
          operation: 'create',
          payload: { account_id: account.id, type: 'out', amount, category: 'expense', note: `Expense: ${title}`, date_created: now },
        });
      }
    }
    await pushBatch(events);
    showToast('Salary paid');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-ink">Employees</h2>
          <p className="text-sm text-muted-foreground">Manage staff, salaries and advances.</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus size={16} /> Add Employee
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBlock label="Active Employees" value={activeEmployees.length} />
        <StatBlock label="Monthly Payroll" value={formatCurrency(monthlyPayroll)} />
        <StatBlock label="Salary Paid (30d)" value={formatCurrency(salaryPaid30d)} />
        <StatBlock label="Total Udhar Owed" value={formatCurrency(totalUdharOwed)} tone={totalUdharOwed > 0 ? 'text-brand-orange' : 'text-ink'} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {employees.map((e) => (
          <EmployeeCard
            key={e.id}
            employee={e}
            onPay={() => setPayTarget(e)}
            onUdhar={() => setUdharTarget(e)}
            onSalaryHistory={() => setHistoryTarget({ employee: e, tab: 'salary' })}
            onUdharHistory={() => setHistoryTarget({ employee: e, tab: 'udhar' })}
            onEdit={() => {
              setEditing(e);
              setModalOpen(true);
            }}
            onDelete={() => setDeleteTarget(e)}
          />
        ))}
        {employees.length === 0 && <p className="col-span-full py-10 text-center text-sm text-muted-foreground">No employees yet.</p>}
      </div>

      <Card>
        <CardHeader title="Recent Salary Payments" />
        <div className="p-1">
          <Table
            columns={[
              { key: 'title', header: 'Description', render: (e) => e.title },
              { key: 'amount', header: 'Amount', render: (e) => formatCurrency(e.amount) },
              { key: 'date_added', header: 'Date', render: (e) => formatDateTime(e.date_added) },
            ]}
            data={salaryExpenses
              .slice()
              .sort((a, b) => new Date(b.date_added || 0) - new Date(a.date_added || 0))
              .slice(0, 20)}
            emptyMessage="No salary payments yet."
          />
        </div>
      </Card>

      <EmployeeFormModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleSaveEmployee} employee={editing} />
      <GiveUdharModal open={Boolean(udharTarget)} onClose={() => setUdharTarget(null)} onSubmit={handleUdhar} employee={udharTarget} />
      <PaySalaryModal open={Boolean(payTarget)} onClose={() => setPayTarget(null)} onSubmit={handlePaySalary} employee={payTarget} accounts={accounts} />
      <EmployeeHistoryModal
        open={Boolean(historyTarget)}
        onClose={() => setHistoryTarget(null)}
        target={historyTarget}
        advances={advances}
        salaryExpenses={salaryExpenses}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove employee"
        description={`Remove "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Remove"
      />
    </div>
  );
}
