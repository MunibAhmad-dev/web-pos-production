import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Landmark, Plus, RefreshCw, AlertCircle, ArrowLeftRight,
  Wallet, Building2, Smartphone, X, Pencil, Trash2, CheckCircle2,
  ChevronDown, ChevronUp, CreditCard,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import {
  mfgGetAccounts, mfgCreateAccount, mfgUpdateAccount, mfgDeleteAccount,
  mfgTransfer, mfgGetLedger,
} from '../../api/manufacturingApi';

const Rs  = n => `Rs. ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmt = d => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const ACCOUNT_ICONS = {
  cash: Wallet,
  bank: Building2,
};
const ACCOUNT_COLORS = {
  cash:     'bg-blue-100 dark:bg-blue-900/40 text-blue-600',
  bank:     'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600',
  easypaisa:'bg-purple-100 dark:bg-purple-900/40 text-purple-600',
  jazzcash: 'bg-red-100 dark:bg-red-900/40 text-red-600',
};

function accountIcon(name = '') {
  const n = name.toLowerCase();
  if (n.includes('easy') || n.includes('paisa')) return Smartphone;
  if (n.includes('jazz'))  return Smartphone;
  if (n.includes('bank') || n.includes('meezan') || n.includes('habib') || n.includes('hbl') || n.includes('ubl')) return Building2;
  return Wallet;
}
function accountColor(name = '') {
  const n = name.toLowerCase();
  if (n.includes('easy') || n.includes('paisa')) return 'bg-purple-100 dark:bg-purple-900/40 text-purple-600';
  if (n.includes('jazz'))  return 'bg-red-100 dark:bg-red-900/40 text-red-600';
  if (n.includes('bank') || n.includes('meezan') || n.includes('habib') || n.includes('hbl') || n.includes('ubl')) return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600';
  return 'bg-blue-100 dark:bg-blue-900/40 text-blue-600';
}

const EMPTY_ACCOUNT_FORM = { name: '', type: 'cash', opening_balance: '', bank_name: '', account_number: '', notes: '' };
const EMPTY_TRANSFER     = { from_account_id: '', to_account_id: '', amount: '', note: '' };

const PAGE = 50;

export default function ManufacturingAccounting() {
  const [accounts, setAccounts]   = useState([]);
  const [entries, setEntries]     = useState([]);
  const [total, setTotal]         = useState(0);
  const [offset, setOffset]       = useState(0);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  const [accDlg, setAccDlg]       = useState({ open: false, mode: 'add', account: null });
  const [accForm, setAccForm]     = useState(EMPTY_ACCOUNT_FORM);
  const [delDlg, setDelDlg]       = useState({ open: false, account: null });
  const [trfDlg, setTrfDlg]       = useState(false);
  const [trfForm, setTrfForm]     = useState(EMPTY_TRANSFER);
  const [submitting, setSub]      = useState(false);

  const fetchAll = useCallback(async (off = 0) => {
    setLoading(true); setError('');
    try {
      const [accRes, ledRes] = await Promise.all([
        mfgGetAccounts(),
        mfgGetLedger({ limit: PAGE, offset: off }),
      ]);
      setAccounts(accRes.accounts || []);
      setEntries(off === 0 ? (ledRes.entries || []) : prev => [...prev, ...(ledRes.entries || [])]);
      setTotal(ledRes.total || 0);
      setOffset(off);
    } catch (e) { setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(0); }, [fetchAll]);

  const totalBalance = useMemo(() => accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0), [accounts]);

  // ── account form ─────────────────────────────────────────────────────────────
  const AF = key => e => setAccForm(f => ({ ...f, [key]: e.target.value }));

  async function handleSaveAccount() {
    if (!accForm.name.trim()) { toast.error('Account name is required'); return; }
    setSub(true);
    try {
      if (accDlg.mode === 'add') {
        const res = await mfgCreateAccount(accForm);
        setAccounts(prev => [...prev, res.account]);
        toast.success('Account added');
      } else {
        const res = await mfgUpdateAccount(accDlg.account.id, accForm);
        setAccounts(prev => prev.map(a => a.id === accDlg.account.id ? { ...a, ...res.account } : a));
        toast.success('Account updated');
      }
      setAccDlg({ open: false, mode: 'add', account: null });
    } catch (e) { toast.error(e.message || 'Failed'); }
    finally { setSub(false); }
  }

  async function handleDeleteAccount() {
    setSub(true);
    try {
      await mfgDeleteAccount(delDlg.account.id);
      setAccounts(prev => prev.filter(a => a.id !== delDlg.account.id));
      toast.success('Account deleted');
      setDelDlg({ open: false, account: null });
    } catch (e) { toast.error(e.message || 'Failed'); }
    finally { setSub(false); }
  }

  async function handleTransfer() {
    const { from_account_id, to_account_id, amount } = trfForm;
    if (!from_account_id || !to_account_id) { toast.error('Select both accounts'); return; }
    if (!amount || Number(amount) <= 0) { toast.error('Enter a valid amount'); return; }
    if (String(from_account_id) === String(to_account_id)) { toast.error('Cannot transfer to same account'); return; }
    setSub(true);
    try {
      await mfgTransfer({ from_account_id: Number(from_account_id), to_account_id: Number(to_account_id), amount: Number(amount), note: trfForm.note });
      toast.success('Transfer done');
      setTrfDlg(false);
      setTrfForm(EMPTY_TRANSFER);
      fetchAll(0);
    } catch (e) { toast.error(e.message || 'Failed'); }
    finally { setSub(false); }
  }

  function openEdit(a) {
    setAccForm({ name: a.name, type: a.type, opening_balance: String(a.opening_balance), bank_name: a.bank_name, account_number: a.account_number, notes: a.notes });
    setAccDlg({ open: true, mode: 'edit', account: a });
  }

  const TF = key => e => setTrfForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">

      {/* Header */}
      <div className="px-6 py-5 border-b bg-background shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
              <Landmark size={20} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Accounting</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Account balances and the ledger — every sale, purchase, and payment</p>
              <p className="text-xs text-muted-foreground mt-1"><strong className="text-foreground">{accounts.length}</strong> account{accounts.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => fetchAll(0)} disabled={loading}>
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setTrfForm(EMPTY_TRANSFER); setTrfDlg(true); }} className="gap-1.5">
              <ArrowLeftRight size={13} /> Transfer
            </Button>
            <Button size="sm" onClick={() => { setAccForm(EMPTY_ACCOUNT_FORM); setAccDlg({ open: true, mode: 'add', account: null }); }} className="gap-1.5" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}>
              <Plus size={13} /> Add Account
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-400">
            <AlertCircle size={13} /> {error}
            <Button size="sm" variant="ghost" className="ml-auto h-5 px-2 text-xs" onClick={() => fetchAll(0)}>Retry</Button>
          </div>
        )}

        {/* Account cards */}
        <div className="px-6 pt-5 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {loading && accounts.length === 0 ? (
              [1,2,3,4].map(i => (
                <div key={i} className="rounded-2xl border p-5 animate-pulse bg-muted/30 h-28" />
              ))
            ) : accounts.map(a => {
              const Icon  = accountIcon(a.name);
              const color = accountColor(a.name);
              const bal   = Number(a.current_balance || 0);
              return (
                <div key={a.id} className="rounded-2xl border bg-card p-5 hover:shadow-md transition-shadow group">
                  <div className="flex items-start justify-between">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
                      <Icon size={17} />
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(a)} className="p-1 rounded hover:bg-muted text-blue-500"><Pencil size={12} /></button>
                      {!a.is_default && <button onClick={() => setDelDlg({ open: true, account: a })} className="p-1 rounded hover:bg-muted text-red-500"><Trash2 size={12} /></button>}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">{a.name}</p>
                  <p className={`text-2xl font-bold tabular-nums mt-0.5 ${bal < 0 ? 'text-red-600' : ''}`}>
                    Rs. {bal.toLocaleString('en-PK', { minimumFractionDigits: 0 })}
                  </p>
                </div>
              );
            })}
          </div>

          {accounts.length > 0 && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <span>Total across all accounts:</span>
              <span className={`font-bold tabular-nums ${totalBalance < 0 ? 'text-red-600' : 'text-foreground'}`}>
                {Rs(totalBalance)}
              </span>
            </div>
          )}
        </div>

        {/* Ledger */}
        <div className="px-6 pb-6">
          <h2 className="text-base font-semibold mb-3">Recent Ledger Entries</h2>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50 border-b">
                <tr>
                  {['Date', 'Account', 'Type', 'Category', 'Amount', 'Description'].map((h, i) => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide ${i >= 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && entries.length === 0 ? (
                  [1,2,3,4,5].map(i => (
                    <tr key={i} className="border-b animate-pulse">
                      {[1,2,3,4,5,6].map(j => <td key={j} className="px-4 py-3"><div className="h-3 bg-muted rounded" /></td>)}
                    </tr>
                  ))
                ) : entries.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">No ledger entries yet</td></tr>
                ) : (
                  entries.map(e => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{fmt(e.date_created)}</td>
                      <td className="px-4 py-3 text-sm font-medium">{e.account_name}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`font-semibold ${e.type === 'in' ? 'text-emerald-600' : 'text-red-500'}`}>
                          {e.type === 'in' ? 'Income' : 'Expense'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{e.category || '—'}</td>
                      <td className="px-4 py-3 text-sm font-semibold tabular-nums text-right">{Rs(e.amount)}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground text-right max-w-[240px] truncate">{e.note || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {entries.length > 0 && (
              <div className="px-4 py-3 border-t text-center text-xs text-muted-foreground">
                {offset + entries.length < total ? (
                  <button onClick={() => fetchAll(offset + PAGE)} disabled={loading} className="text-blue-600 hover:underline font-medium">
                    {loading ? 'Loading…' : `Load more (${total - offset - entries.length} remaining)`}
                  </button>
                ) : (
                  `Showing all ${total}`
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Account dialog */}
      <Dialog open={accDlg.open} onOpenChange={v => setAccDlg(d => ({ ...d, open: v }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark size={16} className="text-blue-500" />
              {accDlg.mode === 'add' ? 'Add New Account' : `Edit — ${accDlg.account?.name}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Account Name <span className="text-red-500">*</span></Label>
              <Input placeholder="e.g. Cash in Hand, HBL Account" value={accForm.name} onChange={AF('name')} className="h-9 text-sm" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <select value={accForm.type} onChange={AF('type')} className="w-full h-9 rounded-md border bg-background px-3 text-sm">
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Opening Balance</Label>
                <Input type="number" placeholder="0" value={accForm.opening_balance} onChange={AF('opening_balance')} className="h-9 text-sm" />
              </div>
            </div>
            {accForm.type === 'bank' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Bank Name</Label>
                  <Input placeholder="e.g. HBL, Meezan" value={accForm.bank_name} onChange={AF('bank_name')} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Account Number</Label>
                  <Input placeholder="0012345…" value={accForm.account_number} onChange={AF('account_number')} className="h-9 text-sm" />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Input placeholder="Any notes…" value={accForm.notes} onChange={AF('notes')} className="h-9 text-sm" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAccDlg(d => ({ ...d, open: false }))} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSaveAccount} disabled={submitting || !accForm.name.trim()} style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}>
              {submitting ? <RefreshCw size={13} className="animate-spin" /> : <><CheckCircle2 size={14} /> {accDlg.mode === 'add' ? 'Add Account' : 'Save'}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer dialog */}
      <Dialog open={trfDlg} onOpenChange={setTrfDlg}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ArrowLeftRight size={16} className="text-blue-500" /> Transfer Between Accounts</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs">From Account <span className="text-red-500">*</span></Label>
              <select value={trfForm.from_account_id} onChange={TF('from_account_id')} className="w-full h-9 rounded-md border bg-background px-3 text-sm">
                <option value="">Select account</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({Rs(a.current_balance)})</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To Account <span className="text-red-500">*</span></Label>
              <select value={trfForm.to_account_id} onChange={TF('to_account_id')} className="w-full h-9 rounded-md border bg-background px-3 text-sm">
                <option value="">Select account</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({Rs(a.current_balance)})</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Amount <span className="text-red-500">*</span></Label>
              <Input type="number" placeholder="0" value={trfForm.amount} onChange={TF('amount')} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Note (optional)</Label>
              <Input placeholder="e.g. Moving cash to bank" value={trfForm.note} onChange={TF('note')} className="h-9 text-sm" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTrfDlg(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleTransfer} disabled={submitting} style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}>
              {submitting ? <RefreshCw size={13} className="animate-spin" /> : <><ArrowLeftRight size={14} /> Transfer</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={delDlg.open} onOpenChange={v => setDelDlg(d => ({ ...d, open: v }))}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 size={16} /> Delete Account</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">Delete <strong className="text-foreground">{delDlg.account?.name}</strong>? All its ledger entries will be orphaned.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDelDlg({ open: false, account: null })} disabled={submitting}>Cancel</Button>
            <Button onClick={handleDeleteAccount} disabled={submitting} className="bg-red-600 hover:bg-red-700 text-white">
              {submitting ? <RefreshCw size={13} className="animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
