import { useEffect, useMemo, useState } from 'react';
import { Plus, ArrowLeftRight, Eye, Pencil, Trash2, Landmark, Wallet } from 'lucide-react';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { Card } from '@/components/ui/panel';
import Table from '@/components/ui/data-table';
import Button from '@/components/ui/action-button';
import Badge from '@/components/ui/status-badge';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import AccountFormModal from '../../components/accounts/AccountFormModal';
import AddTxnModal from '../../components/accounts/AddTxnModal';
import TransferModal from '../../components/accounts/TransferModal';
import { formatCurrency, formatDateTime } from '../../utils/format';

// current_balance is never trusted as stored — always recomputed from
// opening_balance + Σ(in) − Σ(out), matching the desktop's recomputeAccountBalance().
function computeBalance(account, txns) {
  const delta = txns
    .filter((t) => String(t.account_id) === String(account.id))
    .reduce((sum, t) => sum + (t.type === 'in' ? Number(t.amount || 0) : -Number(t.amount || 0)), 0);
  return Number(account.opening_balance || 0) + delta;
}

export default function AccountsPage() {
  const { list, pushEntity, pushBatch, bootstrapped } = useDataStore();
  const { showToast } = useToast();

  const accounts = list('account');
  const txns = list('account_txn');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [ledgerAccount, setLedgerAccount] = useState(null);
  const [txnModalAccount, setTxnModalAccount] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferFrom, setTransferFrom] = useState(null);
  const [deleteTxnTarget, setDeleteTxnTarget] = useState(null);

  // Seed the default "Cash in Hand" account once, mirroring the desktop's
  // INSERT OR IGNORE seed — only runs if this store genuinely has none yet.
  useEffect(() => {
    if (bootstrapped && accounts.length === 0) {
      pushEntity('account', 'create', {
        name: 'Cash in Hand',
        type: 'cash',
        opening_balance: 0,
        current_balance: 0,
        bank_name: '',
        account_number: '',
        notes: '',
        is_default: 1,
        created_at: new Date().toISOString(),
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapped, accounts.length]);

  const rows = useMemo(
    () =>
      accounts
        .map((a) => ({ ...a, balance: computeBalance(a, txns) }))
        .sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0) || a.name.localeCompare(b.name)),
    [accounts, txns]
  );

  const totalBalance = rows.reduce((sum, a) => sum + a.balance, 0);

  const ledgerTxns = useMemo(
    () =>
      ledgerAccount
        ? txns.filter((t) => String(t.account_id) === String(ledgerAccount.id)).sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0))
        : [],
    [txns, ledgerAccount]
  );

  const handleSaveAccount = async (form) => {
    const now = new Date().toISOString();
    if (editing) {
      await pushEntity('account', 'update', { ...editing, name: form.name, bank_name: form.bank_name, account_number: form.account_number, notes: form.notes });
      showToast('Account updated');
    } else {
      await pushEntity('account', 'create', {
        name: form.name,
        type: form.type,
        opening_balance: form.opening_balance,
        current_balance: form.opening_balance,
        bank_name: form.bank_name,
        account_number: form.account_number,
        notes: form.notes,
        is_default: 0,
        created_at: now,
      });
      showToast('Account added');
    }
  };

  const handleDelete = async () => {
    if (deleteTarget.is_default) {
      showToast('The default account cannot be deleted', 'error');
      setDeleteTarget(null);
      return;
    }
    await pushEntity('account', 'delete', { id: deleteTarget.id });
    showToast('Account deleted');
    setDeleteTarget(null);
  };

  const handleAddTxn = async ({ type, amount, category, note }) => {
    await pushEntity('account_txn', 'create', {
      account_id: txnModalAccount.id,
      type,
      amount,
      category,
      note,
      date_created: new Date().toISOString(),
    });
    showToast('Transaction recorded');
  };

  const handleTransfer = async ({ fromId, toId, amount, note }) => {
    const now = new Date().toISOString();
    await pushBatch([
      { entityType: 'account_txn', operation: 'create', payload: { account_id: Number(fromId), type: 'out', amount, category: 'transfer', note, date_created: now } },
      { entityType: 'account_txn', operation: 'create', payload: { account_id: Number(toId), type: 'in', amount, category: 'transfer', note, date_created: now } },
    ]);
    showToast('Transfer complete');
  };

  const handleDeleteTxn = async () => {
    await pushEntity('account_txn', 'delete', { id: deleteTxnTarget.id });
    showToast('Transaction removed');
    setDeleteTxnTarget(null);
  };

  const columns = [
    {
      key: 'name',
      header: 'Account',
      render: (a) => (
        <div className="flex items-center gap-2">
          {a.type === 'bank' ? <Landmark size={15} className="text-muted-foreground" /> : <Wallet size={15} className="text-muted-foreground" />}
          <div>
            <p className="font-medium text-ink">
              {a.name} {a.is_default ? <Badge tone="blue">Default</Badge> : null}
            </p>
            {a.type === 'bank' && <p className="text-xs text-muted-foreground">{a.bank_name} {a.account_number}</p>}
          </div>
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: (a) => <span className="capitalize">{a.type}</span> },
    { key: 'balance', header: 'Balance', render: (a) => <span className="font-semibold">{formatCurrency(a.balance)}</span> },
    {
      key: 'actions',
      header: '',
      render: (a) => (
        <div className="flex items-center gap-1">
          <button onClick={() => setLedgerAccount(a)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-brand-blue" title="View ledger">
            <Eye size={15} />
          </button>
          <button onClick={() => setTxnModalAccount(a)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-brand-green" title="Add transaction">
            <Plus size={15} />
          </button>
          <button
            onClick={() => {
              setTransferFrom(a);
              setTransferOpen(true);
            }}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-brand-purple"
            title="Transfer"
          >
            <ArrowLeftRight size={15} />
          </button>
          <button
            onClick={() => {
              setEditing(a);
              setModalOpen(true);
            }}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-brand-blue"
          >
            <Pencil size={15} />
          </button>
          {!a.is_default && (
            <button onClick={() => setDeleteTarget(a)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-brand-red">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-ink">Accounts &amp; Cash</h2>
          <p className="text-sm text-muted-foreground">Total balance: {formatCurrency(totalBalance)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setTransferOpen(true)}>
            <ArrowLeftRight size={15} /> Transfer
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus size={16} /> Add Account
          </Button>
        </div>
      </div>

      <Card className="p-1">
        <Table columns={columns} data={rows} emptyMessage="No accounts yet." />
      </Card>

      <AccountFormModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleSaveAccount} account={editing} />
      <AddTxnModal open={Boolean(txnModalAccount)} onClose={() => setTxnModalAccount(null)} onSubmit={handleAddTxn} account={txnModalAccount} />
      <TransferModal
        open={transferOpen}
        onClose={() => {
          setTransferOpen(false);
          setTransferFrom(null);
        }}
        onSubmit={handleTransfer}
        accounts={rows}
        fromAccount={transferFrom}
      />

      <Modal open={Boolean(ledgerAccount)} onClose={() => setLedgerAccount(null)} title={`${ledgerAccount?.name || ''} — Ledger`}>
        <div className="divide-y divide-border">
          {ledgerTxns.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No transactions yet.</p>}
          {ledgerTxns.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="text-ink capitalize">{t.category || 'manual'}</p>
                <p className="text-xs text-muted-foreground">{t.note || '—'} · {formatDateTime(t.date_created)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={t.type === 'in' ? 'text-brand-green' : 'text-brand-red'}>
                  {t.type === 'in' ? '+' : '-'}
                  {formatCurrency(t.amount)}
                </span>
                <button onClick={() => setDeleteTxnTarget(t)} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete account"
        description={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
      />
      <ConfirmDialog
        open={Boolean(deleteTxnTarget)}
        onClose={() => setDeleteTxnTarget(null)}
        onConfirm={handleDeleteTxn}
        title="Remove transaction"
        description="This will remove the transaction and adjust the account balance. This cannot be undone."
        confirmLabel="Remove"
      />
    </div>
  );
}
