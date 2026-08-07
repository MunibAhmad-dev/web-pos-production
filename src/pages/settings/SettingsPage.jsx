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
import { getReceiptSettings, saveReceiptSettings, buildInvoiceHtml } from '../../utils/receipt';
import { Printer, FileText, Database, Download, Upload, FileSpreadsheet, FileJson, Eye } from 'lucide-react';
import { useDataStore } from '../../store/dataStore';
import { useModuleSettings } from '../../hooks/useModuleSettings';
import { cn } from '@/lib/utils';

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
  const { modules, toggle: toggleModule } = useModuleSettings();

  const [receipt, setReceipt] = useState(getReceiptSettings);
  const updateReceipt = (key, value) => setReceipt((r) => ({ ...r, [key]: value }));

  // Auto-save invoice_style immediately on click — user expects selection to be live
  const setInvoiceStyle = (style) => {
    const next = { ...receipt, invoice_style: style };
    setReceipt(next);
    saveReceiptSettings(next);
    showToast(`${style === 'formal' ? 'Formal A4' : 'Thermal'} invoice style saved`);
  };

  const previewInvoiceStyle = (style) => {
    const sampleSettings = { ...receipt, invoice_style: style };
    const html = buildInvoiceHtml({
      saleId: 'DEMO',
      date: new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }),
      items: [
        { name: 'Sample Product A', qty: 2, price: 1200 },
        { name: 'Sample Product B', qty: 1, price: 3500 },
      ],
      subtotal: 5900, discount: 0, total: 5900,
      amountPaid: 5900, balance: 0,
      paymentMethod: 'cash',
      customerName: 'John Doe',
      customerPhone: '03001234567',
      settings: { ...sampleSettings, store_name: sampleSettings.store_name || user?.store_name || 'My Store' },
    });
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.open(); win.document.write(html); win.document.close();
  };

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
                <div key={opt.value} className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => setInvoiceStyle(opt.value)}
                    className={`flex flex-col p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      receipt.invoice_style === opt.value
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border/50 hover:border-primary/30 hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <opt.icon size={16} className={receipt.invoice_style === opt.value ? 'text-primary' : 'text-muted-foreground'} />
                      <span className="text-sm font-semibold">{opt.title}</span>
                      {receipt.invoice_style === opt.value && (
                        <span className="ml-auto text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">Active</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{opt.desc}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => previewInvoiceStyle(opt.value)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary px-2 py-1 rounded-lg hover:bg-primary/5 transition-colors self-start"
                  >
                    <Eye size={11} /> Preview {opt.title}
                  </button>
                </div>
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

      {/* ── Business Modules ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader title="Business Modules" />
        <div className="divide-y divide-border/40 px-5 pb-5">
          <p className="text-xs text-muted-foreground pt-4 pb-5">
            Enable the modules that match your shop type. Each module adds specialized product fields and is saved on this device.
          </p>

          {/* Bakery */}
          <div className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0 text-base">🍞</div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Bakery Module</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Expiry dates, weight-based pricing, production dates, unit types</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleModule('bakery_module_enabled')}
                className={cn(
                  'relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none shrink-0',
                  modules.bakery_module_enabled ? 'bg-orange-500' : 'bg-muted'
                )}
              >
                <span className={cn(
                  'inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200',
                  modules.bakery_module_enabled ? 'translate-x-6' : 'translate-x-1'
                )} />
              </button>
            </div>
            {modules.bakery_module_enabled && (
              <div className="mt-3 flex flex-wrap gap-2">
                {['Expiry Date Tracking', 'Weight-Based Pricing', 'Production Date', 'Unit Types (kg/g/tray)'].map(f => (
                  <span key={f} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-700 dark:text-orange-400 text-[11px] font-medium">✓ {f}</span>
                ))}
              </div>
            )}
          </div>

          {/* Dry Fruits */}
          <div className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-800/10 border border-amber-800/20 flex items-center justify-center shrink-0 text-base">🌰</div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Dry Fruits Module</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Quality grades, country of origin, wholesale pricing, wastage %</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleModule('dry_fruits_module_enabled')}
                className={cn(
                  'relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none shrink-0',
                  modules.dry_fruits_module_enabled ? 'bg-amber-700' : 'bg-muted'
                )}
              >
                <span className={cn(
                  'inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200',
                  modules.dry_fruits_module_enabled ? 'translate-x-6' : 'translate-x-1'
                )} />
              </button>
            </div>
            {modules.dry_fruits_module_enabled && (
              <div className="mt-3 flex flex-wrap gap-2">
                {['Quality Grades', 'Country of Origin', 'Wholesale Pricing', 'Brand', 'Wastage %'].map(f => (
                  <span key={f} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-800/10 border border-amber-800/20 text-amber-800 dark:text-amber-400 text-[11px] font-medium">✓ {f}</span>
                ))}
              </div>
            )}
          </div>

          {/* Pharmacy */}
          <div className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 text-base">💊</div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Pharmacy / Medical Module</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Generic name, strength, medicine type, manufacturer, expiry, prescription flag</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleModule('pharmacy_module_enabled')}
                className={cn(
                  'relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none shrink-0',
                  modules.pharmacy_module_enabled ? 'bg-cyan-500' : 'bg-muted'
                )}
              >
                <span className={cn(
                  'inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200',
                  modules.pharmacy_module_enabled ? 'translate-x-6' : 'translate-x-1'
                )} />
              </button>
            </div>
            {modules.pharmacy_module_enabled && (
              <div className="mt-3 flex flex-wrap gap-2">
                {['Generic Name & Strength', 'Medicine Type', 'Manufacturer', 'Prescription Flag', 'Expiry Date'].map(f => (
                  <span key={f} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-700 dark:text-cyan-400 text-[11px] font-medium">✓ {f}</span>
                ))}
              </div>
            )}
          </div>
        </div>
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
