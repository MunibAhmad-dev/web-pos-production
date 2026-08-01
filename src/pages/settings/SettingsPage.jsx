import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import cloudApi from '../../api/cloudClient';
import { Card, CardHeader } from '@/components/ui/panel';
import { Input } from '@/components/form/fields';
import Button from '@/components/ui/action-button';
import Badge from '@/components/ui/status-badge';
import { useLowStockThreshold } from '../../hooks/useLowStockThreshold';
import { setLowStockThreshold } from '../../utils/constants';
import { getReceiptSettings, saveReceiptSettings } from '../../utils/receipt';
import { Printer, FileText, Database, Download, Upload, FileSpreadsheet, FileJson } from 'lucide-react';
import { useDataStore } from '../../store/dataStore';

const statusTone = { approved: 'green', pending: 'orange', blocked: 'red' };

const INVOICE_STYLES = [
  {
    value: 'thermal',
    icon: Printer,
    title: 'Thermal Receipt',
    desc: '72–80mm roll printer (XP-80C etc.) — compact receipt, same as desktop.',
  },
  {
    value: 'formal',
    icon: FileText,
    title: 'Formal A4 Invoice',
    desc: 'Full-page invoice with bill-to, terms and signatures — for laser/inkjet printers.',
  },
];

export default function SettingsPage() {
  const { user, refreshStatus } = useAuth();
  const { showToast } = useToast();
  const [storeName, setStoreName] = useState(user?.store_name || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const threshold = useLowStockThreshold();
  const [thresholdInput, setThresholdInput] = useState(threshold);

  const [receipt, setReceipt] = useState(getReceiptSettings);
  const updateReceipt = (key, value) => setReceipt((r) => ({ ...r, [key]: value }));
  const handleSaveReceipt = (e) => {
    e.preventDefault();
    saveReceiptSettings(receipt);
    showToast('Receipt & printer settings saved');
  };

  // ── Backup & Import ──────────────────────────────────────────────────────────
  const { collections, pushBatch } = useDataStore();
  const [importing, setImporting] = useState(false);

  const allData = () => {
    const out = {};
    for (const [type, map] of Object.entries(collections)) out[type] = Array.from(map.values());
    return out;
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const stamp = () => new Date().toISOString().slice(0, 10);

  const exportJson = () => {
    const payload = { exported_at: new Date().toISOString(), store: user?.store_name, data: allData() };
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `pos-backup-${stamp()}.json`);
    showToast('JSON backup downloaded');
  };

  const exportXlsx = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    for (const [type, rows] of Object.entries(allData())) {
      if (!rows.length) continue;
      // Excel sheet names max 31 chars
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), type.slice(0, 31));
    }
    XLSX.writeFile(wb, `pos-backup-${stamp()}.xlsx`);
    showToast('Excel backup downloaded');
  };

  // Import master data (products / customers / vendors) from a JSON or XLSX
  // backup — rows are pushed as sync events so they reach the cloud and every
  // other device, exactly like data entered by hand.
  const IMPORTABLE = ['product', 'customer', 'vendor'];
  const handleImportFile = async (file) => {
    if (!file) return;
    setImporting(true);
    try {
      let tables = {};
      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(await file.text());
        tables = parsed.data || parsed; // accept our backup shape or a raw {type: rows} map
      } else if (/\.(xlsx|xls)$/i.test(file.name)) {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(await file.arrayBuffer());
        for (const name of wb.SheetNames) tables[name] = XLSX.utils.sheet_to_json(wb.Sheets[name]);
      } else {
        showToast('Use a .json or .xlsx backup file (the .db format is for the desktop app)', 'error');
        return;
      }
      // normalize plural sheet names (products → product)
      const events = [];
      for (const [rawName, rows] of Object.entries(tables)) {
        const type = rawName.endsWith('s') && IMPORTABLE.includes(rawName.slice(0, -1)) ? rawName.slice(0, -1) : rawName;
        if (!IMPORTABLE.includes(type) || !Array.isArray(rows)) continue;
        for (const row of rows) {
          if (!row || typeof row !== 'object' || !row.name) continue;
          events.push({ entityType: type, operation: 'create', payload: { ...row } });
        }
      }
      if (events.length === 0) {
        showToast('No products/customers/vendors found in that file', 'error');
        return;
      }
      // push in chunks of 80 (cloud caps 100 events per sync call)
      for (let i = 0; i < events.length; i += 80) {
        await pushBatch(events.slice(i, i + 80));
      }
      showToast(`Imported ${events.length} records — synced to cloud`);
    } catch (err) {
      showToast(err?.message || 'Import failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await cloudApi.post('/instances/heartbeat', { store_name: storeName });
      await refreshStatus();
      showToast('Store name updated');
    } catch (err) {
      showToast(err.response?.data?.error || 'Unable to save', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveThreshold = (e) => {
    e.preventDefault();
    const value = Number(thresholdInput);
    if (!Number.isFinite(value) || value < 0) {
      showToast('Enter a valid threshold', 'error');
      return;
    }
    setLowStockThreshold(value);
    showToast('Low stock threshold updated');
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Settings</h2>
        <p className="text-sm text-muted-foreground">Store profile and preferences for this web account.</p>
      </div>

      <Card>
        <CardHeader
          title="Store Profile"
          action={<Badge tone={statusTone[user?.approval_status] || 'gray'}>{user?.approval_status}</Badge>}
        />
        <form onSubmit={handleSaveProfile} className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <Input label="Business / Store name" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
          <Input label="Owner name" value={user?.owner_name || ''} disabled />
          <Input label="Mobile number (login)" value={user?.mobile || ''} disabled />
          <Input label="Store address" value={user?.store_address || ''} disabled />
          <div className="sm:col-span-2">
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? 'Saving…' : 'Save Store Name'}
            </Button>
          </div>
        </form>
        <p className="px-5 pb-5 text-xs text-muted-foreground">
          Only the store name can be updated from here today — owner name, mobile and address are set at registration
          (shared with the desktop app) and aren&apos;t editable from the web yet.
        </p>
      </Card>

      <Card>
        <CardHeader title="Inventory" />
        <form onSubmit={handleSaveThreshold} className="flex flex-col gap-4 p-5 sm:max-w-xs">
          <Input
            label="Low stock alert threshold"
            type="number"
            min="0"
            value={thresholdInput}
            onChange={(e) => setThresholdInput(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Products at or below this quantity show a low-stock badge on Dashboard, Products, Inventory and POS.</p>
          <Button type="submit" className="self-start">
            Save Threshold
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader title="Receipt & Printer" />
        <form onSubmit={handleSaveReceipt} className="flex flex-col gap-4 p-5">
          {/* Invoice style — thermal vs formal, same as desktop Settings */}
          <div>
            <p className="mb-2 text-sm font-medium text-ink">Invoice Style</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {INVOICE_STYLES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateReceipt('invoice_style', opt.value)}
                  className={`flex flex-col p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    receipt.invoice_style === opt.value
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border/50 hover:border-primary/30 hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <opt.icon size={16} className={receipt.invoice_style === opt.value ? 'text-primary' : 'text-muted-foreground'} />
                    <span className="text-sm font-semibold">{opt.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Store name on receipt" value={receipt.store_name} placeholder={user?.store_name || 'My Store'} onChange={(e) => updateReceipt('store_name', e.target.value)} />
            <Input label="Store phone" value={receipt.store_phone} placeholder="03xx-xxxxxxx" onChange={(e) => updateReceipt('store_phone', e.target.value)} />
            <div className="sm:col-span-2">
              <Input label="Store address" value={receipt.store_address} placeholder="Shop #, Market, City" onChange={(e) => updateReceipt('store_address', e.target.value)} />
            </div>
            <Input label="Receipt footer message" value={receipt.receipt_footer} onChange={(e) => updateReceipt('receipt_footer', e.target.value)} />
            <Input label="Invoice notes / terms (formal invoice)" value={receipt.invoice_notes} placeholder="One line per note" onChange={(e) => updateReceipt('invoice_notes', e.target.value)} />
          </div>

          <p className="text-xs text-muted-foreground">
            Printing from the browser opens the system print dialog — select your thermal printer (72mm paper size is pre-set) or
            choose <strong>Save as PDF</strong> to download the invoice. Settings are saved on this device.
          </p>
          <Button type="submit" className="self-start">Save Receipt Settings</Button>
        </form>
      </Card>

      <Card>
        <CardHeader title="Backup & Import" />
        <div className="flex flex-col gap-5 p-5">
          <div>
            <p className="mb-2 text-sm font-medium text-ink flex items-center gap-1.5"><Download size={14} /> Export / Backup</p>
            <p className="text-xs text-muted-foreground mb-3">Download everything synced to this account — sales, purchases, products, customers, vendors, payments and more.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={exportJson} className="gap-2">
                <FileJson size={14} /> Export JSON
              </Button>
              <Button type="button" variant="secondary" onClick={exportXlsx} className="gap-2">
                <FileSpreadsheet size={14} /> Export Excel (.xlsx)
              </Button>
            </div>
          </div>
          <div className="border-t border-border pt-4">
            <p className="mb-2 text-sm font-medium text-ink flex items-center gap-1.5"><Upload size={14} /> Import</p>
            <p className="text-xs text-muted-foreground mb-3">
              Import <strong>products, customers and vendors</strong> from a JSON or Excel backup. Records sync to the cloud and
              appear on the desktop app too. Sales/purchase history import and <span className="font-mono">.db</span> files are handled by the desktop app
              (Settings → Backup &amp; Import there).
            </p>
            <label className={`inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium cursor-pointer ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
              <Database size={14} /> {importing ? 'Importing…' : 'Choose .json / .xlsx file'}
              <input
                type="file"
                accept=".json,.xlsx,.xls"
                className="hidden"
                onChange={(e) => { handleImportFile(e.target.files?.[0]); e.target.value = ''; }}
              />
            </label>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Account" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Instance ID</p>
            <p className="font-mono text-xs text-ink">{user?.instance_id}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Approval status</p>
            <Badge tone={statusTone[user?.approval_status] || 'gray'}>{user?.approval_status}</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}
