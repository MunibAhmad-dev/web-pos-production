import { useState, useRef, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import cloudApi from '../../api/cloudClient';
import { useLowStockThreshold } from '../../hooks/useLowStockThreshold';
import { setLowStockThreshold } from '../../utils/constants';
import { getReceiptSettings, saveReceiptSettings, buildInvoiceHtml } from '../../utils/receipt';
import { printInvoice } from '../../lib/invoicePrint';
import {
  Printer, FileText, Database, Download, Upload, FileSpreadsheet, FileJson,
  Eye, EyeOff, Building2, ShieldCheck, Puzzle, MessageSquare, Receipt,
  Store, Image, Trash2, Lock, Bell, CreditCard, Search, RotateCcw, RefreshCw,
} from 'lucide-react';
import { useDataStore, clearDataCache } from '../../store/dataStore';
import { useModuleSettings } from '../../hooks/useModuleSettings';
import Badge from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

const statusTone = { approved: 'green', pending: 'orange', blocked: 'red' };

const WA_TEMPLATE_KEY = 'pos_wa_template';
const POS_PIN_KEY = 'pos_pin';
const FBR_KEY = 'pos_fbr_settings';

const DEFAULT_WA_TEMPLATE =
  '*Sale Update — {store}*\n\nHello *{customer}*,\nOrder: #{sale_id}\nTotal: PKR {total}\n*Balance Due: PKR {balance}*\n\nThank you for your business!';

const getWaTemplate = () => {
  try { return localStorage.getItem(WA_TEMPLATE_KEY) || DEFAULT_WA_TEMPLATE; }
  catch { return DEFAULT_WA_TEMPLATE; }
};
const getPosPin = () => { try { return localStorage.getItem(POS_PIN_KEY) || ''; } catch { return ''; } };
const getFbrSettings = () => { try { return JSON.parse(localStorage.getItem(FBR_KEY) || '{}'); } catch { return {}; } };

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'general',       label: 'General',         icon: Building2,     desc: 'Business & branding'       },
  { id: 'receipt',       label: 'Print & Receipt',  icon: Printer,       desc: 'Paper & invoice style'     },
  { id: 'security',      label: 'Security',         icon: ShieldCheck,   desc: 'PIN & thresholds'          },
  { id: 'modules',       label: 'Modules',          icon: Puzzle,        desc: 'Optional features'         },
  { id: 'notifications', label: 'Notifications',    icon: MessageSquare, desc: 'WhatsApp templates'        },
  { id: 'fbr',           label: 'FBR',              icon: Receipt,       desc: 'Digital invoicing'         },
  { id: 'backup',        label: 'Backup',           icon: Database,      desc: 'Export, import & restore'  },
  { id: 'reprint',       label: 'Reprint',          icon: RotateCcw,     desc: 'Reprint past invoices'     },
];

// ── Module definitions ────────────────────────────────────────────────────────
const MODULES = [
  {
    key: 'bakery_module_enabled', emoji: '🍞', title: 'Bakery',
    desc: 'Expiry dates, weight-based pricing, production dates, unit types',
    features: ['Expiry Date Tracking', 'Weight-Based Pricing', 'Production Date', 'Unit Types (kg/g/tray)'],
    on: 'bg-orange-500', badge: 'bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-400',
  },
  {
    key: 'dry_fruits_module_enabled', emoji: '🌰', title: 'Dry Fruits',
    desc: 'Quality grades, country of origin, wholesale pricing, wastage %',
    features: ['Quality Grades', 'Country of Origin', 'Wholesale Pricing', 'Wastage %'],
    on: 'bg-amber-700', badge: 'bg-amber-700/10 border-amber-700/20 text-amber-700 dark:text-amber-400',
  },
  {
    key: 'pharmacy_module_enabled', emoji: '💊', title: 'Pharmacy / Medical',
    desc: 'Generic name, strength, medicine type, manufacturer, expiry, prescription flag',
    features: ['Generic Name & Strength', 'Medicine Type', 'Manufacturer', 'Prescription Flag', 'Expiry Date'],
    on: 'bg-cyan-500', badge: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-700 dark:text-cyan-400',
  },
  {
    key: 'electronics_module_enabled', emoji: '🖥️', title: 'Electronics',
    desc: 'IMEI tracking, warranty periods, serial numbers, brand & model fields',
    features: ['IMEI / Serial No.', 'Warranty Period', 'Brand & Model', 'Condition Grade'],
    on: 'bg-blue-600', badge: 'bg-blue-600/10 border-blue-600/20 text-blue-700 dark:text-blue-400',
  },
  {
    key: 'mobile_module_enabled', emoji: '📱', title: 'Mobile Phones',
    desc: 'IMEI, RAM, storage, color, unlocked status, PTA approval tracking',
    features: ['IMEI Tracking', 'RAM & Storage', 'PTA Approved Status', 'Color Variant'],
    on: 'bg-violet-600', badge: 'bg-violet-600/10 border-violet-600/20 text-violet-700 dark:text-violet-400',
  },
  {
    key: 'laptop_module_enabled', emoji: '💻', title: 'Laptops & Computers',
    desc: 'Processor, RAM, storage, display size, battery health, refurbished flag',
    features: ['CPU & RAM', 'Storage Type', 'Display Size', 'Refurbished Flag'],
    on: 'bg-slate-600', badge: 'bg-slate-600/10 border-slate-600/20 text-slate-700 dark:text-slate-300',
  },
  {
    key: 'accessories_module_enabled', emoji: '🔌', title: 'Accessories',
    desc: 'Compatibility list, cable type, connector standard, color variants',
    features: ['Compatibility', 'Cable Type', 'Connector Standard', 'Color Variants'],
    on: 'bg-gray-600', badge: 'bg-gray-600/10 border-gray-600/20 text-gray-700 dark:text-gray-300',
  },
  {
    key: 'clothing_module_enabled', emoji: '👕', title: 'Clothing / Fashion',
    desc: 'Size, color, gender, fabric, season — variants per product',
    features: ['Size (S/M/L/XL)', 'Color Variant', 'Gender Category', 'Fabric / Material'],
    on: 'bg-pink-500', badge: 'bg-pink-500/10 border-pink-500/20 text-pink-700 dark:text-pink-400',
  },
  {
    key: 'restaurant_module_enabled', emoji: '🍽️', title: 'Restaurant / Café',
    desc: 'Table management, kitchen order tickets, portion sizes, meal categories',
    features: ['Table Management', 'Kitchen Tickets', 'Portion Sizes', 'Meal Categories'],
    on: 'bg-red-500', badge: 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400',
  },
  {
    key: 'grocery_module_enabled', emoji: '🛒', title: 'Grocery / Supermarket',
    desc: 'Loose weight sales, expiry, FIFO stock rotation, category tree',
    features: ['Loose Weight Sales', 'FIFO Stock', 'Expiry Tracking', 'Category Tree'],
    on: 'bg-green-600', badge: 'bg-green-600/10 border-green-600/20 text-green-700 dark:text-green-400',
  },
  {
    key: 'paint_module_enabled', emoji: '🎨', title: 'Paint / Hardware',
    desc: 'Color codes, shade mixing, litre-based pricing, surface type',
    features: ['Color Codes', 'Shade Mixing', 'Litre Pricing', 'Surface Type'],
    on: 'bg-rose-600', badge: 'bg-rose-600/10 border-rose-600/20 text-rose-700 dark:text-rose-400',
  },
  {
    key: 'accounting_module_enabled', emoji: '🏦', title: 'Accounting / Finance',
    desc: 'Chart of accounts, journal entries, profit & loss, balance sheet',
    features: ['Chart of Accounts', 'Journal Entries', 'Profit & Loss', 'Balance Sheet'],
    on: 'bg-emerald-600', badge: 'bg-emerald-600/10 border-emerald-600/20 text-emerald-700 dark:text-emerald-400',
  },
];

const INVOICE_STYLES = [
  { value: 'thermal', icon: Printer, title: 'Thermal Receipt', desc: '72–80mm roll printer (XP-80C etc.) — compact receipt, same as desktop.' },
  { value: 'formal',  icon: FileText, title: 'Formal A4 Invoice', desc: 'Full-page invoice with bill-to, terms and signatures — for laser/inkjet printers.' },
];

// ── Shared field component ────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = 'text', disabled }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        type={type} value={value ?? ''} onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder} disabled={disabled}
        className="h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-60 disabled:cursor-not-allowed transition-shadow"
      />
    </div>
  );
}

// ── Section card wrapper ──────────────────────────────────────────────────────
function SectionCard({ icon: Icon, iconCls = 'text-primary', bgCls = 'bg-primary/10', title, subtitle, children }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 pt-4 pb-3 border-b border-border/40">
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', bgCls)}>
          <Icon size={14} className={iconCls} />
        </div>
        <div>
          <p className="text-sm font-bold leading-none">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user, refreshStatus } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('general');

  // General
  const [storeName, setStoreName] = useState(user?.store_name || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Logo
  const [logoPreview, setLogoPreview] = useState(() => {
    try { return JSON.parse(localStorage.getItem('osatech_receipt_settings') || '{}').store_logo || ''; }
    catch { return ''; }
  });
  const logoInputRef = useRef(null);

  // Security
  const [posPin, setPosPin] = useState(getPosPin);
  const [showPin, setShowPin] = useState(false);

  // Low stock
  const threshold = useLowStockThreshold();
  const [thresholdInput, setThresholdInput] = useState(threshold);

  // Modules
  const { modules, toggle: toggleModule } = useModuleSettings();

  // Receipt
  const [receipt, setReceipt] = useState(getReceiptSettings);
  const updateReceipt = (key, val) => setReceipt(r => ({ ...r, [key]: val }));

  // Notifications (WA template)
  const [waTemplate, setWaTemplate] = useState(getWaTemplate);

  // FBR
  const [fbr, setFbr] = useState(() => ({
    fbr_enabled: false, fbr_environment: 'sandbox', fbr_token: '',
    fbr_seller_ntncnic: '', fbr_seller_strn: '', fbr_seller_business: '',
    fbr_seller_province: '', fbr_seller_address: '',
    ...getFbrSettings(),
  }));
  const updateFbr = (key, val) => setFbr(f => ({ ...f, [key]: val }));

  // Reprint
  const [reprintSearch, setReprintSearch] = useState('');
  const [reprintDate, setReprintDate] = useState('today');
  const [reprintStyle, setReprintStyle] = useState(() => {
    try { return JSON.parse(localStorage.getItem('osatech_receipt_settings') || '{}').invoice_style || 'thermal'; }
    catch { return 'thermal'; }
  });

  // Backup
  const { collections, pushBatch, bootstrap } = useDataStore();
  const [importing, setImporting] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await cloudApi.post('/instances/heartbeat', { store_name: storeName });
      await refreshStatus();
      showToast('Store name updated');
    } catch (err) {
      showToast(err.response?.data?.error || 'Unable to save', 'error');
    } finally { setSavingProfile(false); }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setLogoPreview(dataUrl);
      const next = { ...receipt, store_logo: dataUrl };
      setReceipt(next);
      saveReceiptSettings(next);
      showToast('Logo saved');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeLogo = () => {
    setLogoPreview('');
    const next = { ...receipt, store_logo: '' };
    setReceipt(next);
    saveReceiptSettings(next);
    showToast('Logo removed');
  };

  const setInvoiceStyle = (style) => {
    const next = { ...receipt, invoice_style: style };
    setReceipt(next);
    saveReceiptSettings(next);
    showToast(`${style === 'formal' ? 'Formal A4' : 'Thermal'} style saved`);
  };

  const previewInvoiceStyle = (style) => {
    const s = { ...receipt, invoice_style: style };
    const html = buildInvoiceHtml({
      saleId: 'DEMO',
      date: new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }),
      items: [{ name: 'Sample Product A', qty: 2, price: 1200 }, { name: 'Sample Product B', qty: 1, price: 3500 }],
      subtotal: 5900, discount: 0, total: 5900, amountPaid: 5900, balance: 0,
      paymentMethod: 'cash', customerName: 'Ahmed Ali', customerPhone: '03001234567',
      settings: { ...s, store_name: s.store_name || user?.store_name || 'My Store' },
    });
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.open(); win.document.write(html); win.document.close();
  };

  const handleSaveReceipt = (e) => {
    e.preventDefault();
    saveReceiptSettings(receipt);
    showToast('Receipt settings saved');
  };

  const handleSaveThreshold = (e) => {
    e.preventDefault();
    const v = Number(thresholdInput);
    if (!Number.isFinite(v) || v < 0) { showToast('Enter a valid threshold', 'error'); return; }
    setLowStockThreshold(v);
    showToast('Low stock threshold updated');
  };

  const handleSavePin = (e) => {
    e.preventDefault();
    if (posPin && !/^\d{4,6}$/.test(posPin)) { showToast('PIN must be 4–6 digits', 'error'); return; }
    if (posPin) { localStorage.setItem(POS_PIN_KEY, posPin); showToast('POS PIN saved'); }
    else { localStorage.removeItem(POS_PIN_KEY); showToast('POS PIN removed'); }
  };

  const handleSaveWaTemplate = (e) => {
    e.preventDefault();
    localStorage.setItem(WA_TEMPLATE_KEY, waTemplate);
    showToast('WhatsApp template saved');
  };

  const handleSaveFbr = (e) => {
    e.preventDefault();
    localStorage.setItem(FBR_KEY, JSON.stringify(fbr));
    showToast('FBR settings saved');
  };

  // Backup
  const allData = () => {
    const out = {};
    for (const [type, map] of Object.entries(collections)) out[type] = Array.from(map.values());
    return out;
  };
  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      await clearDataCache();
      await bootstrap({ force: true });
      showToast('Cache cleared — data re-synced from server');
    } catch {
      showToast('Re-sync failed — check your connection', 'error');
    } finally {
      setClearingCache(false);
    }
  };

  const stamp = () => new Date().toISOString().slice(0, 10);
  const exportJson = () => {
    downloadBlob(new Blob([JSON.stringify({ exported_at: new Date().toISOString(), store: user?.store_name, data: allData() }, null, 2)], { type: 'application/json' }), `pos-backup-${stamp()}.json`);
    showToast('JSON backup downloaded');
  };
  const exportXlsx = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    for (const [type, rows] of Object.entries(allData())) {
      if (!rows.length) continue;
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), type.slice(0, 31));
    }
    XLSX.writeFile(wb, `pos-backup-${stamp()}.xlsx`);
    showToast('Excel backup downloaded');
  };
  const IMPORTABLE = ['product', 'customer', 'vendor'];
  const handleImportFile = async (file) => {
    if (!file) return;
    setImporting(true);
    try {
      let tables = {};
      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(await file.text());
        tables = parsed.data || parsed;
      } else if (/\.(xlsx|xls)$/i.test(file.name)) {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(await file.arrayBuffer());
        for (const name of wb.SheetNames) tables[name] = XLSX.utils.sheet_to_json(wb.Sheets[name]);
      } else { showToast('Use a .json or .xlsx file', 'error'); return; }
      const events = [];
      for (const [rawName, rows] of Object.entries(tables)) {
        const type = rawName.endsWith('s') && IMPORTABLE.includes(rawName.slice(0, -1)) ? rawName.slice(0, -1) : rawName;
        if (!IMPORTABLE.includes(type) || !Array.isArray(rows)) continue;
        for (const row of rows) {
          if (!row || typeof row !== 'object' || !row.name) continue;
          events.push({ entityType: type, operation: 'create', payload: { ...row } });
        }
      }
      if (!events.length) { showToast('No products/customers/vendors found', 'error'); return; }
      for (let i = 0; i < events.length; i += 80) await pushBatch(events.slice(i, i + 80));
      showToast(`Imported ${events.length} records — synced to cloud`);
    } catch (err) {
      showToast(err?.message || 'Import failed', 'error');
    } finally { setImporting(false); }
  };

  // ── Reprint helpers ──────────────────────────────────────────────────────────
  const reprintSales = useMemo(() => {
    const salesArr = Array.from((collections.sales || new Map()).values());
    const now = new Date();
    const startOf = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
    const cutoff = reprintDate === 'today'
      ? startOf(now)
      : reprintDate === 'week'
        ? new Date(now.getTime() - 7 * 86400000)
        : reprintDate === 'month'
          ? new Date(now.getFullYear(), now.getMonth(), 1)
          : null;

    const q = reprintSearch.toLowerCase().trim();
    return salesArr
      .filter(s => {
        if (cutoff && new Date(s.date_created) < cutoff) return false;
        if (!q) return true;
        const cust = s.customer_id ? (collections.customers || new Map()).get(String(s.customer_id)) : null;
        return (
          String(s.id).includes(q) ||
          String(Math.round(Number(s.total))).includes(q) ||
          (cust?.name || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.date_created) - new Date(a.date_created))
      .slice(0, 100);
  }, [collections, reprintSearch, reprintDate]);

  const handleReprint = (sale) => {
    const saleItems = Array.from((collections.sale_items || new Map()).values())
      .filter(si => String(si.sale_id) === String(sale.id));
    const cust = sale.customer_id
      ? (collections.customers || new Map()).get(String(sale.customer_id))
      : null;
    const rs = getReceiptSettings();
    const subtotal = Number(sale.total) + Number(sale.discount || 0);
    printInvoice({
      style: reprintStyle,
      docType: 'INVOICE',
      docNumber: sale.id,
      date: new Date(sale.date_created).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }),
      company: {
        name: rs.store_name || user?.store_name || 'My Store',
        address: rs.store_address || '',
        phone: rs.store_phone || '',
      },
      party: cust ? { label: 'Customer', name: cust.name, phone: cust.phone || '' } : undefined,
      items: saleItems.map(si => ({
        name: si.product_name || si.name || 'Item',
        qty: Number(si.quantity) || 1,
        unitPrice: Number(si.price || si.unit_price || 0),
        total: Number(si.price || si.unit_price || 0) * (Number(si.quantity) || 1),
      })),
      totals: [
        ...(Number(sale.discount) > 0 ? [{ label: 'Subtotal', value: subtotal, tone: 'muted' }, { label: 'Discount', value: Number(sale.discount), tone: 'muted' }] : []),
        { label: 'TOTAL', value: Number(sale.total), emphasis: true },
      ],
      status: sale.status === 'Cancelled'
        ? { label: 'CANCELLED', tone: 'destructive' }
        : Number(sale.remaining || 0) > 0.5
          ? { label: 'PARTIAL PAYMENT', tone: 'warning' }
          : { label: 'PAID', tone: 'success' },
      notes: rs.receipt_footer || '',
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 max-w-5xl pb-10">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Configure your store, receipts, and data preferences</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">

        {/* ── Sidebar nav ── */}
        <nav className="lg:w-[196px] shrink-0 flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-1 lg:pb-0 lg:sticky lg:top-4 lg:self-start">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-150 whitespace-nowrap lg:whitespace-normal group',
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground border border-transparent'
                )}>
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors', isActive ? 'bg-primary/15' : 'bg-muted/60 group-hover:bg-accent')}>
                  <Icon size={14} />
                </div>
                <div className="min-w-0 hidden lg:block">
                  <p className={cn('text-xs font-semibold leading-none', isActive && 'font-bold')}>{tab.label}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-none">{tab.desc}</p>
                </div>
                <span className="lg:hidden text-xs font-semibold">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ── Tab content ── */}
        <div className="flex-1 min-w-0 space-y-5">

      {/* ── GENERAL ── */}
      {activeTab === 'general' && (
        <>
          <SectionCard icon={Building2} title="Store Profile" subtitle="Business identity shown to customers">
            <form onSubmit={handleSaveProfile} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between sm:col-span-2 -mt-1 mb-1">
                <p className="text-xs text-muted-foreground">Instance: <span className="font-mono">{user?.instance_id}</span></p>
                <Badge tone={statusTone[user?.approval_status] || 'gray'}>{user?.approval_status}</Badge>
              </div>
              <Field label="Business / Store name" value={storeName} onChange={setStoreName} />
              <Field label="Owner name" value={user?.owner_name || ''} onChange={() => {}} disabled />
              <Field label="Mobile (login)" value={user?.mobile || ''} onChange={() => {}} disabled />
              <Field label="Store address" value={user?.store_address || ''} onChange={() => {}} disabled />
              <div className="sm:col-span-2 flex items-center gap-3">
                <button type="submit" disabled={savingProfile}
                  className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 transition-opacity">
                  {savingProfile ? 'Saving…' : 'Save Store Name'}
                </button>
                <p className="text-xs text-muted-foreground">Owner, mobile & address are set at registration.</p>
              </div>
            </form>
          </SectionCard>

          {/* Store Logo */}
          <SectionCard icon={Image} title="Store Logo" subtitle="Appears on printed invoices and receipts">
            <div className="flex items-start gap-5">
              {logoPreview ? (
                <div className="relative shrink-0">
                  <img src={logoPreview} alt="Store logo" className="w-24 h-24 rounded-xl object-cover border border-border/50 shadow-sm" />
                  <button type="button" onClick={removeLogo}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-white flex items-center justify-center shadow-sm hover:opacity-80 transition-opacity">
                    <Trash2 size={11} />
                  </button>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border/50 flex flex-col items-center justify-center bg-muted/20 shrink-0 gap-1">
                  <Store size={22} className="text-muted-foreground/40" />
                  <p className="text-[9px] text-muted-foreground/60 font-medium">No logo</p>
                </div>
              )}
              <div className="flex flex-col gap-2.5 pt-1">
                <p className="text-sm text-muted-foreground leading-relaxed">Upload your store logo — it will appear at the top of printed invoices and thermal receipts.</p>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                <button type="button" onClick={() => logoInputRef.current?.click()}
                  className="self-start h-8 px-4 rounded-lg border border-border bg-background text-xs font-semibold hover:bg-muted/60 transition-colors">
                  {logoPreview ? 'Change Logo' : 'Upload Logo'}
                </button>
                <p className="text-[10px] text-muted-foreground">PNG or JPG recommended. Saved on this device only.</p>
              </div>
            </div>
          </SectionCard>

          {/* Account */}
          <SectionCard icon={CreditCard} title="Account" subtitle="Cloud account details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg bg-muted/30 border border-border/40 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Instance ID</p>
                <p className="font-mono text-xs break-all">{user?.instance_id}</p>
              </div>
              <div className="rounded-lg bg-muted/30 border border-border/40 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Approval Status</p>
                <Badge tone={statusTone[user?.approval_status] || 'gray'}>{user?.approval_status}</Badge>
              </div>
            </div>
          </SectionCard>
        </>
      )}

      {/* ── RECEIPT & PRINT ── */}
      {activeTab === 'receipt' && (
        <SectionCard icon={Printer} title="Receipt & Printer" subtitle="Paper format and invoice content">
          <form onSubmit={handleSaveReceipt} className="flex flex-col gap-6">
            {/* Invoice style */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Invoice Style</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {INVOICE_STYLES.map((opt) => (
                  <div key={opt.value} className="flex flex-col gap-1.5">
                    <button type="button" onClick={() => setInvoiceStyle(opt.value)}
                      className={cn(
                        'flex flex-col p-4 rounded-xl border-2 text-left transition-all',
                        receipt.invoice_style === opt.value
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border/50 hover:border-primary/30 hover:bg-muted/30'
                      )}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <opt.icon size={15} className={receipt.invoice_style === opt.value ? 'text-primary' : 'text-muted-foreground'} />
                        <span className="text-sm font-semibold">{opt.title}</span>
                        {receipt.invoice_style === opt.value && (
                          <span className="ml-auto text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">Active</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{opt.desc}</span>
                    </button>
                    <button type="button" onClick={() => previewInvoiceStyle(opt.value)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary px-2 py-1 rounded-lg hover:bg-primary/5 transition-colors self-start">
                      <Eye size={11} /> Preview {opt.title}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Fields */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Store name on receipt" value={receipt.store_name} onChange={v => updateReceipt('store_name', v)} placeholder={user?.store_name || 'My Store'} />
              <Field label="Store phone" value={receipt.store_phone} onChange={v => updateReceipt('store_phone', v)} placeholder="03xx-xxxxxxx" />
              <div className="sm:col-span-2">
                <Field label="Store address" value={receipt.store_address} onChange={v => updateReceipt('store_address', v)} placeholder="Shop #, Market, City" />
              </div>
              <Field label="Receipt footer" value={receipt.receipt_footer} onChange={v => updateReceipt('receipt_footer', v)} />
              <Field label="Invoice notes / terms" value={receipt.invoice_notes} onChange={v => updateReceipt('invoice_notes', v)} placeholder="Thank you…" />
            </div>

            <p className="text-xs text-muted-foreground p-3 rounded-xl bg-muted/30 border border-border/40">
              Printing opens the browser print dialog — select your thermal printer (72mm paper pre-set) or <strong>Save as PDF</strong>. Settings are saved on this device.
            </p>
            <button type="submit" className="self-start h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
              Save Receipt Settings
            </button>
          </form>
        </SectionCard>
      )}

      {/* ── SECURITY ── */}
      {activeTab === 'security' && (
        <>
          <SectionCard icon={Bell} iconCls="text-amber-600" bgCls="bg-amber-500/10" title="Inventory Alert" subtitle="Low stock notification threshold">
            <form onSubmit={handleSaveThreshold} className="flex flex-col gap-4 max-w-xs">
              <Field label="Low stock threshold (units)" type="number" value={thresholdInput} onChange={setThresholdInput} />
              <p className="text-xs text-muted-foreground">Products at or below this quantity show a low-stock badge on Dashboard, Products and POS.</p>
              <button type="submit" className="self-start h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
                Save Threshold
              </button>
            </form>
          </SectionCard>

          <SectionCard icon={Lock} iconCls="text-red-600" bgCls="bg-red-500/10" title="POS Access PIN" subtitle="Require a PIN before staff can use the checkout screen">
            <form onSubmit={handleSavePin} className="flex flex-col gap-4 max-w-xs">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">PIN (4–6 digits)</label>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={posPin} onChange={e => setPosPin(e.target.value)}
                    placeholder="Leave blank to disable"
                    maxLength={6}
                    className="h-9 pl-3 pr-10 w-full rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono tracking-[0.3em]"
                  />
                  <button type="button" onClick={() => setShowPin(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                When set, staff must enter this PIN before using the POS checkout screen. Leave blank to disable PIN protection. Saved on this device only.
              </p>
              <div className="flex gap-2">
                <button type="submit" className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
                  Save PIN
                </button>
                {posPin && (
                  <button type="button"
                    onClick={() => { setPosPin(''); localStorage.removeItem(POS_PIN_KEY); showToast('PIN removed'); }}
                    className="h-9 px-4 rounded-lg border border-border bg-background text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors font-semibold">
                    Remove PIN
                  </button>
                )}
              </div>
            </form>
          </SectionCard>
        </>
      )}

      {/* ── MODULES ── */}
      {activeTab === 'modules' && (
        <SectionCard icon={Puzzle} title="Business Modules" subtitle="Enable the features that match your shop type — each adds specialised product fields">
          <div className="divide-y divide-border/30 -mx-1">
            {MODULES.map(m => (
              <div key={m.key} className="py-4 px-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-lg border', m.badge)}>
                      {m.emoji}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-none">{m.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{m.desc}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => toggleModule(m.key)}
                    className={cn(
                      'relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none shrink-0 mt-0.5',
                      modules[m.key] ? m.on : 'bg-muted'
                    )}>
                    <span className={cn(
                      'inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200',
                      modules[m.key] ? 'translate-x-6' : 'translate-x-1'
                    )} />
                  </button>
                </div>
                {modules[m.key] && m.features && (
                  <div className="mt-3 ml-12 flex flex-wrap gap-1.5">
                    {m.features.map(f => (
                      <span key={f} className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border', m.badge)}>
                        ✓ {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── NOTIFICATIONS ── */}
      {activeTab === 'notifications' && (
        <SectionCard icon={MessageSquare} iconCls="text-green-600" bgCls="bg-green-500/10"
          title="WhatsApp Message Template"
          subtitle="Customize the message sent when you tap the WhatsApp button on a sale or purchase card">
          <form onSubmit={handleSaveWaTemplate} className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {['{customer}', '{store}', '{total}', '{balance}', '{sale_id}', '{date}'].map(v => (
                <button key={v} type="button"
                  onClick={() => setWaTemplate(t => t + v)}
                  className="h-6 px-2 rounded-md bg-muted border border-border/60 text-[10px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors">
                  {v}
                </button>
              ))}
              <span className="self-center text-[10px] text-muted-foreground">← click to insert variable</span>
            </div>

            <textarea
              rows={7}
              value={waTemplate}
              onChange={e => setWaTemplate(e.target.value)}
              className="w-full rounded-xl border border-border bg-background p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
            />

            {/* Live preview */}
            <div className="p-4 rounded-xl bg-[#e7fbd9] dark:bg-[#1a3020] border border-[#cdf4a8]/60 dark:border-[#2d5a2d]/60">
              <p className="text-[10px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400 mb-2">Preview</p>
              <p className="text-sm whitespace-pre-line text-gray-800 dark:text-gray-200 leading-relaxed">
                {waTemplate
                  .replace('{customer}', 'Ahmed Ali')
                  .replace('{store}', user?.store_name || 'My Store')
                  .replace('{total}', '5,500')
                  .replace('{balance}', '2,000')
                  .replace('{sale_id}', '9012')
                  .replace('{date}', new Date().toLocaleDateString('en-PK'))
                }
              </p>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
                Save Template
              </button>
              <button type="button"
                onClick={() => setWaTemplate(DEFAULT_WA_TEMPLATE)}
                className="h-9 px-4 rounded-lg border border-border bg-background text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors font-semibold">
                Reset to Default
              </button>
            </div>
          </form>
        </SectionCard>
      )}

      {/* ── FBR ── */}
      {activeTab === 'fbr' && (
        <SectionCard icon={Receipt} iconCls="text-emerald-600" bgCls="bg-emerald-500/10"
          title="FBR Digital Invoicing"
          subtitle="Pakistan Federal Board of Revenue — IRIS portal integration">
          <form onSubmit={handleSaveFbr} className="flex flex-col gap-5">
            {/* Enable toggle */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-muted/20 border border-border/50">
              <div>
                <p className="text-sm font-semibold">Enable FBR Integration</p>
                <p className="text-xs text-muted-foreground mt-0.5">Generates FBR-compliant invoice numbers and submits to the IRIS portal</p>
              </div>
              <button type="button" onClick={() => updateFbr('fbr_enabled', !fbr.fbr_enabled)}
                className={cn(
                  'relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none shrink-0',
                  fbr.fbr_enabled ? 'bg-emerald-600' : 'bg-muted'
                )}>
                <span className={cn('inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200', fbr.fbr_enabled ? 'translate-x-6' : 'translate-x-1')} />
              </button>
            </div>

            {/* Environment selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Environment</label>
              <div className="flex gap-2 max-w-xs">
                {['sandbox', 'production'].map(env => (
                  <button key={env} type="button" onClick={() => updateFbr('fbr_environment', env)}
                    className={cn(
                      'flex-1 h-9 rounded-lg border text-xs font-semibold capitalize transition-all',
                      fbr.fbr_environment === env
                        ? env === 'production' ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' : 'bg-primary border-primary text-primary-foreground shadow-sm'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/40'
                    )}>
                    {env === 'production' ? '🟢 Production' : '🧪 Sandbox'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="FBR API Token" value={fbr.fbr_token} onChange={v => updateFbr('fbr_token', v)} placeholder="Your IRIS API token" type="password" />
              <Field label="NTN / CNIC" value={fbr.fbr_seller_ntncnic} onChange={v => updateFbr('fbr_seller_ntncnic', v)} placeholder="0000000-0" />
              <Field label="STRN (Sales Tax No.)" value={fbr.fbr_seller_strn} onChange={v => updateFbr('fbr_seller_strn', v)} placeholder="00-00-0000-000-00" />
              <Field label="Business Name (as on FBR)" value={fbr.fbr_seller_business} onChange={v => updateFbr('fbr_seller_business', v)} placeholder="As registered with FBR" />
              <Field label="Province" value={fbr.fbr_seller_province} onChange={v => updateFbr('fbr_seller_province', v)} placeholder="Punjab / Sindh / KPK…" />
              <Field label="Business Address (FBR)" value={fbr.fbr_seller_address} onChange={v => updateFbr('fbr_seller_address', v)} placeholder="As registered with FBR" />
            </div>

            <p className="text-xs p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-800 dark:text-amber-300">
              <strong>Note:</strong> FBR submission requires a live internet connection to the IRIS portal. Use <em>Sandbox</em> for testing — Production submissions are legally binding tax invoices. Settings are saved on this device.
            </p>
            <button type="submit" className="self-start h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
              Save FBR Settings
            </button>
          </form>
        </SectionCard>
      )}

      {/* ── BACKUP ── */}
      {activeTab === 'backup' && (
        <SectionCard icon={Database} title="Backup & Import" subtitle="Export your data or restore from a previous backup">
          <div className="flex flex-col gap-6">
            {/* Export */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Download size={11} /> Export / Backup
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Download everything synced to this account — sales, purchases, products, customers, vendors, payments and more.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={exportJson}
                  className="h-9 px-4 rounded-lg border border-border bg-background text-xs font-semibold hover:bg-muted/60 transition-colors flex items-center gap-1.5">
                  <FileJson size={13} /> Export JSON
                </button>
                <button type="button" onClick={exportXlsx}
                  className="h-9 px-4 rounded-lg border border-border bg-background text-xs font-semibold hover:bg-muted/60 transition-colors flex items-center gap-1.5">
                  <FileSpreadsheet size={13} /> Export Excel (.xlsx)
                </button>
              </div>
            </div>

            {/* Import */}
            <div className="border-t border-border/40 pt-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Upload size={11} /> Import
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Import <strong>products, customers and vendors</strong> from a JSON or Excel backup. Records sync to the cloud and appear on the desktop app too.
                Sales/purchase history import and <code className="font-mono">.db</code> files are handled by the desktop app (Settings → Backup there).
              </p>
              <label className={cn(
                'inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border bg-background text-xs font-semibold cursor-pointer hover:bg-muted/60 transition-colors',
                importing && 'opacity-50 pointer-events-none'
              )}>
                <Database size={13} /> {importing ? 'Importing…' : 'Choose .json / .xlsx file'}
                <input type="file" accept=".json,.xlsx,.xls" className="hidden"
                  onChange={e => { handleImportFile(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            </div>

            {/* Force Re-sync */}
            <div className="border-t border-border/40 pt-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <RefreshCw size={11} /> Force Re-sync
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                If your data looks stale or out of sync, clear the local cache and pull everything fresh from the server. This won't delete any data — it just re-downloads it.
              </p>
              <button
                type="button"
                onClick={handleClearCache}
                disabled={clearingCache}
                className={cn(
                  'h-9 px-4 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-colors',
                  clearingCache
                    ? 'border-border bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                    : 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10'
                )}
              >
                <RefreshCw size={13} className={clearingCache ? 'animate-spin' : ''} />
                {clearingCache ? 'Clearing cache & re-syncing…' : 'Clear local cache & re-sync'}
              </button>
            </div>
          </div>
        </SectionCard>
      )}

      {/* ── REPRINT ── */}
      {activeTab === 'reprint' && (
        <SectionCard icon={RotateCcw} title="Reprint Invoice" subtitle="Find any past sale and print directly — no file saved to your computer">
          <div className="flex flex-col gap-4">
            {/* Controls row */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Style toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
                {[{ v: 'thermal', l: '🖨 Thermal' }, { v: 'formal', l: '📄 A4' }].map(({ v, l }) => (
                  <button key={v} type="button" onClick={() => setReprintStyle(v)}
                    className={cn(
                      'h-8 px-3 text-xs font-semibold transition-all',
                      reprintStyle === v ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'
                    )}>
                    {l}
                  </button>
                ))}
              </div>

              {/* Date filter */}
              <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
                {[{ v: 'today', l: 'Today' }, { v: 'week', l: '7 days' }, { v: 'month', l: 'Month' }, { v: 'all', l: 'All' }].map(({ v, l }) => (
                  <button key={v} type="button" onClick={() => setReprintDate(v)}
                    className={cn(
                      'h-8 px-3 text-xs font-semibold transition-all',
                      reprintDate === v ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'
                    )}>
                    {l}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative flex-1 min-w-[180px]">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="text" value={reprintSearch} onChange={e => setReprintSearch(e.target.value)}
                  placeholder="Search by customer, sale ID or amount…"
                  className="h-8 pl-8 pr-3 w-full rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
            </div>

            {/* Results */}
            {reprintSales.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <RotateCcw size={28} className="text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground font-medium">No sales found</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">Try a different date range or search term</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border/50 overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[1fr_auto_auto_auto_80px] gap-3 px-3 py-2 bg-muted/40 border-b border-border/40">
                  {['Invoice', 'Date', 'Customer', 'Total', ''].map((h, i) => (
                    <span key={i} className={cn('text-[9px] font-black uppercase tracking-widest text-muted-foreground', i >= 2 && 'text-right')}>{h}</span>
                  ))}
                </div>

                {/* Rows */}
                <div className="divide-y divide-border/30 max-h-[480px] overflow-y-auto">
                  {reprintSales.map(s => {
                    const cust = s.customer_id ? (collections.customers || new Map()).get(String(s.customer_id)) : null;
                    const isPending = Number(s.remaining || 0) > 0.5 && s.status !== 'Cancelled';
                    const isCancelled = s.status === 'Cancelled';
                    const itemCount = Array.from((collections.sale_items || new Map()).values())
                      .filter(si => String(si.sale_id) === String(s.id)).length;

                    return (
                      <div key={s.id} className="grid grid-cols-[1fr_auto_auto_auto_80px] gap-3 px-3 py-2.5 items-center hover:bg-muted/20 transition-colors">
                        {/* Invoice # + items */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-black font-mono">#{s.id}</span>
                            <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                              isCancelled ? 'bg-muted text-muted-foreground' : isPending ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            )}>
                              {isCancelled ? 'Cancelled' : isPending ? 'Partial' : 'Paid'}
                            </span>
                            {s.payment_method && (
                              <span className="text-[9px] font-semibold text-muted-foreground/70 capitalize">{s.payment_method}</span>
                            )}
                          </div>
                          {itemCount > 0 && (
                            <p className="text-[9px] text-muted-foreground mt-0.5">{itemCount} item{itemCount !== 1 ? 's' : ''}</p>
                          )}
                        </div>

                        {/* Date */}
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap tabular-nums">
                          {new Date(s.date_created).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
                        </span>

                        {/* Customer */}
                        <span className="text-[10px] text-right max-w-[100px] truncate">
                          {cust?.name || <span className="text-muted-foreground/50 italic">Walk-in</span>}
                        </span>

                        {/* Total */}
                        <span className="text-[11px] font-black tabular-nums text-right">
                          PKR {Math.round(Number(s.total)).toLocaleString()}
                        </span>

                        {/* Print button */}
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleReprint(s)}
                            className="flex items-center gap-1 h-7 px-2.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-bold transition-colors border border-primary/20 shrink-0"
                          >
                            <Printer size={11} /> Print
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer count */}
                <div className="px-3 py-2 border-t border-border/40 bg-muted/20">
                  <p className="text-[10px] text-muted-foreground">
                    Showing {reprintSales.length} sale{reprintSales.length !== 1 ? 's' : ''} · Click Print to open the {reprintStyle === 'thermal' ? 'thermal receipt (72mm)' : 'formal A4 invoice'} directly in the print dialog
                  </p>
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      )}

        </div>{/* end tab content */}
      </div>{/* end flex row */}
    </div>
  );
}
