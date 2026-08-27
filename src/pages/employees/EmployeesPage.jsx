import { useMemo, useState } from 'react';
import { Users, UserPlus, BadgeDollarSign, HandCoins, Briefcase, Pencil, Trash2, History, Wallet, Search } from 'lucide-react';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmployeeFormModal from '../../components/employees/EmployeeFormModal';
import GiveUdharModal from '../../components/employees/GiveUdharModal';
import PaySalaryModal from '../../components/employees/PaySalaryModal';
import EmployeeHistoryModal from '../../components/employees/EmployeeHistoryModal';
import { formatCurrency, formatDateTime } from '../../utils/format';

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, iconClass, Icon }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 p-5 shadow-sm flex items-center gap-4">
      <div className={cn('w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0', iconClass)}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">{label}</p>
        <p className="text-xl font-bold font-mono tracking-tight">{value}</p>
      </div>
    </div>
  );
}

// ── Employee card ─────────────────────────────────────────────────────────────
function EmployeeCard({ employee, onPay, onUdhar, onSalaryHistory, onUdharHistory, onEdit, onDelete }) {
  const balance = Number(employee.outstanding_balance || 0);
  const isActive = employee.is_active !== 0;

  return (
    <div className={cn(
      'rounded-2xl border bg-card shadow-sm p-5 flex flex-col gap-3 relative overflow-hidden',
      isActive ? 'border-emerald-500/20' : 'border-border/40 opacity-60',
    )}>
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] to-transparent pointer-events-none" />

      {/* Header */}
      <div className="flex items-start justify-between relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-base">
              {(employee.name || '?').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight truncate">{employee.name}</p>
            {employee.role && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{employee.role}</p>}
          </div>
        </div>
        {!isActive && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40 flex-shrink-0">
            Inactive
          </span>
        )}
      </div>

      {/* Salary & phone */}
      <div className="space-y-1.5 relative">
        <div className="flex items-center gap-2">
          <BadgeDollarSign size={12} className="text-emerald-500 flex-shrink-0" />
          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
            {formatCurrency(employee.monthly_salary || 0)}
          </span>
          <span className="text-[10px] text-muted-foreground/60">/ month</span>
        </div>
        {employee.phone && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground font-mono">{employee.phone}</span>
          </div>
        )}
        {employee.notes && <p className="text-[11px] text-muted-foreground/60 italic truncate">{employee.notes}</p>}
      </div>

      {/* Udhar balance */}
      {balance !== 0 && (
        <button
          onClick={onUdharHistory}
          className={cn(
            'flex items-center justify-between px-3 py-2 rounded-xl border text-left transition-colors relative',
            balance > 0 ? 'bg-rose-500/5 border-rose-500/20 hover:bg-rose-500/10' : 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10',
          )}
        >
          <span className={cn('text-[11px] font-semibold flex items-center gap-1.5', balance > 0 ? 'text-rose-600' : 'text-emerald-600')}>
            <HandCoins size={12} /> {balance > 0 ? 'Owes' : 'Credit'}
          </span>
          <span className={cn('text-sm font-bold font-mono', balance > 0 ? 'text-rose-600' : 'text-emerald-600')}>
            {formatCurrency(Math.abs(balance))}
          </span>
        </button>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-1.5 relative pt-1 border-t border-border/30">
        <button
          onClick={onPay}
          className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold transition-colors"
        >
          <BadgeDollarSign size={13} /> Pay
        </button>
        <button
          onClick={onUdhar}
          className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-xs font-semibold transition-colors"
        >
          <HandCoins size={13} /> Udhar
        </button>
        <button
          onClick={onSalaryHistory}
          title="Salary History"
          className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-violet-500 hover:bg-violet-500/10 transition-colors"
        >
          <History size={13} />
        </button>
        <button
          onClick={onUdharHistory}
          title="Udhar History"
          className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
        >
          <Wallet size={13} />
        </button>
        <button
          onClick={onEdit}
          title="Edit"
          className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={onDelete}
          title="Remove"
          className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
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
  const [empSearch, setEmpSearch] = useState('');

  const activeEmployees = employees.filter((e) => e.is_active !== 0);
  const monthlyPayroll = activeEmployees.reduce((sum, e) => sum + Number(e.monthly_salary || 0), 0);

  const salaryExpenses = useMemo(
    () => expenses.filter((e) => String(e.category || '').toLowerCase() === 'salary'),
    [expenses]
  );

  const salaryPaid30d = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000;
    return salaryExpenses
      .filter((e) => e.date_added && new Date(e.date_added).getTime() >= cutoff)
      .reduce((s, e) => s + Number(e.amount || 0), 0);
  }, [salaryExpenses]);

  const totalUdharOwed = employees.reduce((sum, e) => sum + Math.max(0, Number(e.outstanding_balance || 0)), 0);

  const filteredEmployees = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        (e.name || '').toLowerCase().includes(q) ||
        (e.role || '').toLowerCase().includes(q) ||
        (e.phone || '').includes(q)
    );
  }, [employees, empSearch]);

  // ── Handlers ───────────────────────────────────────────────────────────────
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

  const handleUdhar = async ({ type, amount, description, deduct_from_salary }) => {
    const employee = udharTarget;
    const sign = type === 'advance' ? 1 : -1;
    const now = new Date().toISOString();
    await pushBatch([
      {
        entityType: 'employee_advance',
        operation: 'create',
        payload: { employee_id: employee.id, type, amount, description, deduct_from_salary: deduct_from_salary || 0, salary_applied: 0, date_added: now },
      },
      {
        entityType: 'employee',
        operation: 'update',
        payload: { ...employee, outstanding_balance: Number(employee.outstanding_balance || 0) + amount * sign },
      },
    ]);
    showToast(type === 'advance' ? 'Advance recorded' : 'Repayment recorded');
  };

  const handlePaySalary = async ({ amount, month, notes, accountId, deductions = [], deductionTotal = 0 }) => {
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

    // Mark each selected deduction as applied
    if (deductions.length > 0) {
      for (const d of deductions) {
        events.push({
          entityType: 'employee_advance',
          operation: 'update',
          payload: { ...d, salary_applied: 1 },
        });
      }
      // Reduce outstanding_balance by applied deduction total
      events.push({
        entityType: 'employee',
        operation: 'update',
        payload: {
          ...employee,
          outstanding_balance: Math.max(0, Number(employee.outstanding_balance || 0) - deductionTotal),
        },
      });
    }

    await pushBatch(events);
    showToast('Salary paid');
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Users size={16} className="text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          </div>
          <p className="text-sm text-muted-foreground pl-[42px]">
            Payroll, salary history, and udhar (advances / goods taken)
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition-colors flex-shrink-0"
        >
          <UserPlus size={15} /> Add Employee
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KpiCard label="Active Employees" value={String(activeEmployees.length)} Icon={Users} iconClass="bg-emerald-500/10 border-emerald-500/20 text-emerald-500" />
        <KpiCard label="Monthly Payroll" value={formatCurrency(monthlyPayroll)} Icon={BadgeDollarSign} iconClass="bg-blue-500/10 border-blue-500/20 text-blue-500" />
        <KpiCard label="Salary Paid (30d)" value={formatCurrency(salaryPaid30d)} Icon={Briefcase} iconClass="bg-violet-500/10 border-violet-500/20 text-violet-500" />
        <KpiCard label="Total Udhar Owed" value={formatCurrency(totalUdharOwed)} Icon={HandCoins} iconClass="bg-amber-500/10 border-amber-500/20 text-amber-600" />
      </div>

      {/* Search */}
      {employees.length > 0 && (
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, role, phone…"
            value={empSearch}
            onChange={(e) => setEmpSearch(e.target.value)}
            className="w-full pl-8 pr-3 h-9 rounded-xl border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50"
          />
        </div>
      )}

      {/* Employee cards / empty states */}
      {employees.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border/50 bg-card/30 py-16 flex flex-col items-center gap-3 text-muted-foreground">
          <div className="w-14 h-14 rounded-2xl bg-muted/60 border border-border/40 flex items-center justify-center">
            <Users size={26} className="opacity-30" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-sm">No employees yet</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">Click "Add Employee" to set up your payroll</p>
          </div>
          <button
            onClick={() => { setEditing(null); setModalOpen(true); }}
            className="flex items-center gap-2 mt-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
          >
            <UserPlus size={14} /> Add First Employee
          </button>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground text-sm">
          <Search size={22} className="opacity-30" />
          <p>No employees match "<span className="font-medium text-foreground">{empSearch}</span>"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((emp) => (
            <EmployeeCard
              key={emp.id}
              employee={emp}
              onPay={() => setPayTarget(emp)}
              onUdhar={() => setUdharTarget(emp)}
              onSalaryHistory={() => setHistoryTarget({ employee: emp, tab: 'salary' })}
              onUdharHistory={() => setHistoryTarget({ employee: emp, tab: 'udhar' })}
              onEdit={() => { setEditing(emp); setModalOpen(true); }}
              onDelete={() => setDeleteTarget(emp)}
            />
          ))}
        </div>
      )}

      {/* Recent salary payments */}
      {salaryExpenses.length > 0 && (
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 bg-emerald-500/5">
            <div className="flex items-center gap-2">
              <BadgeDollarSign size={14} className="text-emerald-500" />
              <span className="text-sm font-semibold">Recent Salary Payments</span>
            </div>
            <span className="text-xs text-muted-foreground">{salaryExpenses.length} payment{salaryExpenses.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="grid grid-cols-[140px_1fr_1fr_130px] gap-2 px-5 py-2.5 border-b border-border/40 bg-muted/10">
            {['Date', 'Employee', 'Notes', 'Amount'].map((h) => (
              <span key={h} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{h}</span>
            ))}
          </div>
          <div className="divide-y divide-border/40">
            {salaryExpenses
              .slice()
              .sort((a, b) => new Date(b.date_added || 0) - new Date(a.date_added || 0))
              .slice(0, 20)
              .map((e) => (
                <div key={e.id} className="grid grid-cols-[140px_1fr_1fr_130px] gap-2 items-center px-5 py-3 hover:bg-muted/30 transition-colors">
                  <span className="font-mono text-xs text-muted-foreground">{formatDateTime(e.date_added)}</span>
                  <span className="font-semibold text-sm truncate">{e.title.replace(/^Salary\s*[—\-]\s*/i, '') || e.title}</span>
                  <span className="text-xs text-muted-foreground truncate">{e.notes || '—'}</span>
                  <span className="text-sm font-bold font-mono text-emerald-600">{formatCurrency(e.amount)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <EmployeeFormModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleSaveEmployee} employee={editing} />
      <GiveUdharModal open={Boolean(udharTarget)} onClose={() => setUdharTarget(null)} onSubmit={handleUdhar} employee={udharTarget} />
      <PaySalaryModal
        open={Boolean(payTarget)}
        onClose={() => setPayTarget(null)}
        onSubmit={handlePaySalary}
        employee={payTarget}
        accounts={accounts}
        advances={advances}
      />
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
