import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Receipt, Plus, Search, X, RefreshCw, AlertCircle,
  Trash2, CheckCircle2, Calendar, Tag, Banknote,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import { mfgGetExpenses, mfgCreateExpense, mfgDeleteExpense, mfgGetAccounts } from '../../api/manufacturingApi';

const Rs  = n => `Rs. ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmt = d => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const COMMON_CATEGORIES = [
  'Rent', 'Electricity', 'Gas', 'Fuel', 'Salary', 'Labour',
  'Transport', 'Repair', 'Maintenance', 'Marketing', 'Miscellaneous',
];

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY_FORM = { title: '', category: '', amount: '', date_added: today(), notes: '', account_id: '' };

export default function ManufacturingExpenses() {
  const [expenses, setExpenses]   = useState([]);
  const [accounts, setAccounts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [search, setSearch]       = useState('');

  const [addDlg, setAddDlg]       = useState(false);
  const [delDlg, setDelDlg]       = useState({ open: false, expense: null });
  const [form, setForm]           = useState(EMPTY_FORM);
  const [submitting, setSub]      = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [expRes, accRes] = await Promise.all([mfgGetExpenses(), mfgGetAccounts()]);
      setExpenses(expRes.expenses || []);
      setAccounts(accRes.accounts || []);
    } catch (e) { setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const displayed = useMemo(() => {
    if (!search.trim()) return expenses;
    const q = search.toLowerCase();
    return expenses.filter(e => e.title.toLowerCase().includes(q) || e.category.toLowerCase().includes(q));
  }, [expenses, search]);

  const totalAmount = useMemo(() => displayed.reduce((s, e) => s + Number(e.amount || 0), 0), [displayed]);

  const F = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  async function handleSave() {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    setSub(true);
    try {
      const res = await mfgCreateExpense(form);
      setExpenses(prev => [res.expense, ...prev]);
      toast.success('Expense added');
      setAddDlg(false);
      setForm({ ...EMPTY_FORM, date_added: today() });
    } catch (e) { toast.error(e.message || 'Failed to save'); }
    finally { setSub(false); }
  }

  async function handleDelete() {
    setSub(true);
    try {
      await mfgDeleteExpense(delDlg.expense.id);
      setExpenses(prev => prev.filter(e => e.id !== delDlg.expense.id));
      toast.success('Expense deleted');
      setDelDlg({ open: false, expense: null });
    } catch (e) { toast.error(e.message || 'Failed to delete'); }
    finally { setSub(false); }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">

      {/* Header */}
      <div className="px-6 py-5 border-b bg-background shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0">
              <Receipt size={20} className="text-orange-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Expenses</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Track operational costs and outflows</p>
              <p className="text-xs text-muted-foreground mt-1">
                <strong className="text-foreground">{displayed.length}</strong> expense{displayed.length !== 1 ? 's' : ''}
                {displayed.length > 0 && <> · total <strong className="text-foreground">{Rs(totalAmount)}</strong></>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={fetchAll} disabled={loading}>
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </Button>
            <Button size="sm" onClick={() => { setForm({ ...EMPTY_FORM, date_added: today() }); setAddDlg(true); }} className="gap-1.5" style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }}>
              <Plus size={13} /> Add Expense
            </Button>
          </div>
        </div>
        <div className="mt-4 relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search expenses…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><X size={13} /></button>}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-400">
          <AlertCircle size={13} /> {error}
          <Button size="sm" variant="ghost" className="ml-auto h-5 px-2 text-xs" onClick={fetchAll}>Retry</Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-0">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-4 px-6 py-4 border-b animate-pulse">
                {[1,2,3,4,5].map(j => <div key={j} className="h-3 flex-1 rounded bg-muted" />)}
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 gap-3 text-muted-foreground text-sm">
            <Receipt size={32} className="opacity-25" />
            {search ? `No expenses match "${search}"` : 'No expenses yet. Add your first expense.'}
            {!search && <Button size="sm" onClick={() => { setForm({ ...EMPTY_FORM, date_added: today() }); setAddDlg(true); }} className="gap-1.5 mt-1"><Plus size={12} /> Add Expense</Button>}
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-muted/50 backdrop-blur-sm border-b">
              <tr>
                {['Date', 'Title', 'Category', 'Amount', 'Notes', 'Actions'].map((h, i) => (
                  <th key={h} className={`px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide ${i === 3 ? 'text-right' : i === 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map(e => (
                <tr key={e.id} className="border-b hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3.5 text-sm text-muted-foreground whitespace-nowrap">{fmt(e.date_added)}</td>
                  <td className="px-5 py-3.5 font-medium text-sm">{e.title}</td>
                  <td className="px-5 py-3.5 text-sm">
                    {e.category ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                        <Tag size={10} /> {e.category}
                      </span>
                    ) : <span className="text-muted-foreground opacity-40">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-sm font-semibold tabular-nums text-right text-red-600">{Rs(e.amount)}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground max-w-[200px] truncate">{e.notes || <span className="opacity-30">—</span>}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => setDelDlg({ open: true, expense: e })} className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-background border-t">
              <tr>
                <td colSpan={3} className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {search ? `Filtered total (${displayed.length} items)` : 'Total'}
                </td>
                <td className="px-5 py-3 text-sm font-bold tabular-nums text-right text-red-600">{Rs(totalAmount)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Add Expense dialog */}
      <Dialog open={addDlg} onOpenChange={setAddDlg}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt size={16} className="text-orange-500" /> Add New Expense
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Title / Description <span className="text-red-500">*</span></Label>
              <Input placeholder="e.g. Monthly rent" value={form.title} onChange={F('title')} className="h-9 text-sm" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Tag size={10} /> Category</Label>
                <select value={form.category} onChange={F('category')} className="w-full h-9 rounded-md border bg-background px-3 text-sm">
                  <option value="">Select or type…</option>
                  {COMMON_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Banknote size={10} /> Amount <span className="text-red-500">*</span></Label>
                <Input type="number" placeholder="0" value={form.amount} onChange={F('amount')} className="h-9 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Calendar size={10} /> Date</Label>
                <Input type="date" value={form.date_added} onChange={F('date_added')} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Debit From Account</Label>
                <select value={form.account_id} onChange={F('account_id')} className="w-full h-9 rounded-md border bg-background px-3 text-sm">
                  <option value="">None (cash)</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Input placeholder="Any notes…" value={form.notes} onChange={F('notes')} className="h-9 text-sm" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddDlg(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSave} disabled={submitting || !form.title.trim() || !form.amount} style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }}>
              {submitting ? <RefreshCw size={13} className="animate-spin" /> : <><CheckCircle2 size={14} /> Add Expense</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={delDlg.open} onOpenChange={v => setDelDlg(d => ({ ...d, open: v }))}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 size={16} /> Delete Expense</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">Delete <strong className="text-foreground">{delDlg.expense?.title}</strong> ({Rs(delDlg.expense?.amount)})?</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDelDlg({ open: false, expense: null })} disabled={submitting}>Cancel</Button>
            <Button onClick={handleDelete} disabled={submitting} className="bg-red-600 hover:bg-red-700 text-white">
              {submitting ? <RefreshCw size={13} className="animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
