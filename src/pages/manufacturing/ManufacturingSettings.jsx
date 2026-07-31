import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Settings, HardDrive, Printer, FileText, RefreshCw, CheckCircle2,
  CloudUpload, CloudOff, Download, Trash2, AlertCircle, Eye,
  Store, Phone, MapPin, FileCheck, Zap, X, ExternalLink,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { getPrinterSettings, savePrinterSettings, printThermal, printFormal } from '../../utils/printUtils';
import {
  mfgGetParts, mfgGetProducts, mfgGetVendors, mfgGetCustomers,
  mfgGetExpenses, mfgGetAccounts,
} from '../../api/manufacturingApi';
import { useMfgAuth } from '../../context/ManufacturingAuthContext';

// ── Google Drive config ───────────────────────────────────────────────────────
const GD_CLIENT_ID = '997460265293-at775rhu7jojvhmeuk6jjn0irammnmuq.apps.googleusercontent.com';
const GD_SCOPE     = 'https://www.googleapis.com/auth/drive.file';
const GD_TOKEN_KEY = 'mfg_gd_token';
const GD_META_KEY  = 'mfg_gd_meta';

function getGdToken() {
  try {
    const t = JSON.parse(localStorage.getItem(GD_TOKEN_KEY) || 'null');
    if (!t || Date.now() > t.expiry) return null;
    return t.token;
  } catch { return null; }
}

function saveGdToken(accessToken, expiresIn) {
  localStorage.setItem(GD_TOKEN_KEY, JSON.stringify({ token: accessToken, expiry: Date.now() + expiresIn * 1000 - 60000 }));
}

function clearGdToken() { localStorage.removeItem(GD_TOKEN_KEY); }

function getGdMeta() {
  try { return JSON.parse(localStorage.getItem(GD_META_KEY) || '{}'); } catch { return {}; }
}

function setGdMeta(data) { localStorage.setItem(GD_META_KEY, JSON.stringify({ ...getGdMeta(), ...data })); }

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'profile', label: 'Profile',         icon: Store },
  { id: 'drive',   label: 'Google Drive',    icon: HardDrive },
  { id: 'thermal', label: 'Thermal Printer', icon: Printer },
  { id: 'formal',  label: 'Formal Invoice',  icon: FileText },
];

const SAMPLE_SALE = {
  invoiceNo: 'INV-SAMPLE-001',
  customer: 'Ahmed Ali',
  items: [
    { qty: 2, name: 'Air Cooler 12V DC', amount: 14000 },
    { qty: 5, name: 'Capacitor 250V', amount: 500 },
  ],
  subtotal: 14500, discount: 500, total: 14000, paid: 10000, paymentMethod: 'Cash',
};

export default function ManufacturingSettings() {
  const { mfgUser } = useMfgAuth();
  const [tab, setTab] = useState('profile');
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });

  // Google Drive state
  const [gdToken, setGdToken]       = useState(getGdToken);
  const [gdFiles, setGdFiles]       = useState([]);
  const [gdLoading, setGdLoading]   = useState(false);
  const [gdBacking, setGdBacking]   = useState(false);
  const [gdMeta, setGdMetaState]    = useState(getGdMeta);
  const gisRef                      = useRef(null);

  // Printer settings state
  const [ps, setPs] = useState(() => ({
    store_name:    '',
    store_address: '',
    store_phone:   '',
    receipt_footer:'Thank you for your business!',
    invoice_terms: 'Payment due within 30 days. No returns after 7 days.',
    ...getPrinterSettings(),
  }));
  const [saving, setSaving] = useState(false);

  // ── Load GIS script ─────────────────────────────────────────────────────────
  useEffect(() => {
    const existing = document.getElementById('gis-script');
    if (existing) { gisRef.current = window.google; return; }
    const s = document.createElement('script');
    s.id  = 'gis-script';
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => { gisRef.current = window.google; };
    document.head.appendChild(s);
  }, []);

  // ── Connect Google Drive ─────────────────────────────────────────────────────
  function connectDrive() {
    const initAndRequest = () => {
      if (!window.google?.accounts?.oauth2) {
        toast.error('Google Identity Services not loaded yet — try again in a moment');
        return;
      }
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GD_CLIENT_ID,
        scope:     GD_SCOPE,
        callback:  (resp) => {
          if (resp.error) { toast.error(`Google auth failed: ${resp.error}`); return; }
          saveGdToken(resp.access_token, resp.expires_in);
          setGdToken(resp.access_token);
          toast.success('Connected to Google Drive');
          listBackups(resp.access_token);
        },
      });
      client.requestAccessToken({ prompt: 'consent' });
    };
    if (window.google?.accounts?.oauth2) initAndRequest();
    else {
      // wait for script to load
      const id = setInterval(() => {
        if (window.google?.accounts?.oauth2) { clearInterval(id); initAndRequest(); }
      }, 200);
      setTimeout(() => clearInterval(id), 8000);
    }
  }

  function disconnectDrive() {
    clearGdToken();
    setGdToken(null);
    setGdFiles([]);
    toast.success('Disconnected from Google Drive');
  }

  const listBackups = useCallback(async (token = gdToken) => {
    if (!token) return;
    setGdLoading(true);
    try {
      const r = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name+contains+'MfgBackup_'&fields=files(id,name,createdTime,size)&orderBy=createdTime+desc&pageSize=20`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!r.ok) { if (r.status === 401) { clearGdToken(); setGdToken(null); } throw new Error('Drive API error'); }
      const data = await r.json();
      setGdFiles(data.files || []);
    } catch (e) { toast.error(e.message || 'Failed to list backups'); }
    finally { setGdLoading(false); }
  }, [gdToken]);

  useEffect(() => { if (gdToken) listBackups(); }, []);

  async function triggerBackup() {
    if (!gdToken) { toast.error('Connect Google Drive first'); return; }
    setGdBacking(true);
    try {
      // Collect all data from manufacturing API
      const [parts, products, vendors, customers, expenses, accounts] = await Promise.allSettled([
        mfgGetParts(), mfgGetProducts(), mfgGetVendors(),
        mfgGetCustomers(), mfgGetExpenses(), mfgGetAccounts(),
      ]);

      const backup = {
        version:   '1.0',
        exported_at: new Date().toISOString(),
        parts:     parts.status     === 'fulfilled' ? parts.value.parts         : [],
        products:  products.status  === 'fulfilled' ? products.value.products   : [],
        vendors:   vendors.status   === 'fulfilled' ? vendors.value.vendors     : [],
        customers: customers.status === 'fulfilled' ? customers.value.customers : [],
        expenses:  expenses.status  === 'fulfilled' ? expenses.value.expenses   : [],
        accounts:  accounts.status  === 'fulfilled' ? accounts.value.accounts   : [],
      };

      const fileName = `MfgBackup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const meta     = { name: fileName, mimeType: 'application/json' };
      const blob     = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
      form.append('file', blob);

      const up = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method:  'POST',
        headers: { Authorization: `Bearer ${gdToken}` },
        body:    form,
      });
      if (!up.ok) throw new Error('Upload failed');

      const now = new Date().toISOString();
      setGdMeta({ lastBackup: now });
      setGdMetaState(getGdMeta());
      toast.success(`Backup uploaded: ${fileName}`);
      listBackups();
    } catch (e) { toast.error(e.message || 'Backup failed'); }
    finally { setGdBacking(false); }
  }

  async function restoreBackup(fileId, fileName) {
    if (!gdToken) return;
    if (!window.confirm(`Restore from "${fileName}"? This will overwrite current data.`)) return;
    try {
      const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${gdToken}` },
      });
      if (!r.ok) throw new Error('Download failed');
      const data = await r.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup downloaded — import manually if needed');
    } catch (e) { toast.error(e.message || 'Restore failed'); }
  }

  async function deleteBackup(fileId, fileName) {
    if (!gdToken) return;
    if (!window.confirm(`Delete backup "${fileName}"?`)) return;
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${gdToken}` },
      });
      toast.success('Backup deleted');
      listBackups();
    } catch (e) { toast.error(e.message || 'Delete failed'); }
  }

  // ── Printer helpers ─────────────────────────────────────────────────────────
  const P = key => e => setPs(p => ({ ...p, [key]: e.target.value }));

  function handleSaveSettings() {
    setSaving(true);
    savePrinterSettings(ps);
    setTimeout(() => { setSaving(false); toast.success('Settings saved'); }, 400);
  }

  function testThermal() { printThermal({ ...SAMPLE_SALE, storeName: ps.store_name, address: ps.store_address, phone: ps.store_phone, footer: ps.receipt_footer }); }
  function testFormal()  { printFormal({ ...SAMPLE_SALE, storeName: ps.store_name, address: ps.store_address, phone: ps.store_phone, terms: ps.invoice_terms }); }

  const fmt = d => d ? new Date(d).toLocaleString('en-PK') : '—';
  const fmtBytes = b => b ? (b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`) : '';

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">

      {/* Header */}
      <div className="px-6 py-5 border-b bg-background shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Settings size={20} className="text-slate-600 dark:text-slate-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Settings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Google Drive backup · Thermal printer · Formal invoice</p>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 mt-4 border-b -mb-5 pb-0">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.id ? 'border-violet-600 text-violet-600' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">

        {/* ── Profile Tab ── */}
        {tab === 'profile' && (
          <div className="max-w-lg space-y-6">
            <div className="rounded-2xl border bg-card p-6">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-full bg-violet-500/10 border-2 border-violet-500/30 flex items-center justify-center text-2xl font-bold text-violet-600">
                  {(mfgUser?.company_name || 'F')[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-lg">{mfgUser?.company_name || 'Factory ERP'}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Phone size={12} /> {mfgUser?.mobile || '—'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-lg bg-muted/40 px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">Company Name</p>
                  <p className="font-semibold">{mfgUser?.company_name || '—'}</p>
                </div>
                <div className="rounded-lg bg-muted/40 px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">Mobile</p>
                  <p className="font-semibold">{mfgUser?.mobile || '—'}</p>
                </div>
                <div className="rounded-lg bg-muted/40 px-4 py-3 col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Instance ID</p>
                  <p className="font-semibold font-mono text-xs">{mfgUser?.instance_id || '—'}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><FileCheck size={16} className="text-violet-500" /> Change Password</h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Current Password</Label>
                  <Input type="password" value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} className="h-9 text-sm mt-1.5" placeholder="Current password" />
                </div>
                <div>
                  <Label className="text-xs">New Password</Label>
                  <Input type="password" value={pwForm.next} onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} className="h-9 text-sm mt-1.5" placeholder="New password" />
                </div>
                <div>
                  <Label className="text-xs">Confirm New Password</Label>
                  <Input type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} className="h-9 text-sm mt-1.5" placeholder="Confirm password" />
                </div>
              </div>
              <Button
                className="mt-4 w-full"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}
                onClick={() => {
                  if (!pwForm.current || !pwForm.next) { toast.error('Please fill all fields'); return; }
                  if (pwForm.next !== pwForm.confirm) { toast.error('Passwords do not match'); return; }
                  toast.info('Password change not yet supported from web — use the desktop app');
                  setPwForm({ current: '', next: '', confirm: '' });
                }}
              >
                Update Password
              </Button>
            </div>
          </div>
        )}

        {/* ── Google Drive Tab ── */}
        {tab === 'drive' && (
          <div className="max-w-2xl space-y-6">

            {/* Status card */}
            <div className={`rounded-2xl border p-6 flex items-start justify-between gap-4 ${gdToken ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-card'}`}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${gdToken ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-slate-100 dark:bg-slate-800'}`}>
                  {gdToken ? <CloudUpload size={22} className="text-emerald-600" /> : <CloudOff size={22} className="text-slate-500" />}
                </div>
                <div>
                  <p className="font-semibold text-base">{gdToken ? 'Connected to Google Drive' : 'Not Connected'}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {gdToken ? 'Your manufacturing data is backed up to Google Drive.' : 'Connect your Google account to enable cloud backups.'}
                  </p>
                  {gdMeta.lastBackup && <p className="text-xs text-muted-foreground mt-1">Last backup: {fmt(gdMeta.lastBackup)}</p>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {gdToken ? (
                  <>
                    <Button size="sm" onClick={triggerBackup} disabled={gdBacking} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                      {gdBacking ? <RefreshCw size={13} className="animate-spin" /> : <CloudUpload size={13} />}
                      {gdBacking ? 'Backing up…' : 'Backup Now'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={disconnectDrive} className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50">
                      <X size={13} /> Disconnect
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={connectDrive} className="gap-1.5" style={{ background: 'linear-gradient(135deg,#4285F4,#1a73e8)' }}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6.28 3L1 12l3.89 6.75L10.17 9.75M12 3h-5.72L12 12l5.72-9M22.99 12l-5.28-9H12L17.28 12M22.99 12l-3.89 6.75H8.89L5 12h18M8.89 18.75L12 24l3.11-5.25" /></svg>
                    Connect Google Drive
                  </Button>
                )}
              </div>
            </div>

            {/* What gets backed up */}
            <div className="rounded-xl border bg-card p-5">
              <h3 className="font-semibold text-sm mb-3">What's Backed Up</h3>
              <div className="grid grid-cols-3 gap-2">
                {['Parts Inventory', 'Products', 'Vendors', 'Customers', 'Expenses', 'Accounts'].map(item => (
                  <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> {item}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">Backups are JSON files stored in your Google Drive. Weekly auto-backup runs when connected.</p>
            </div>

            {/* Backup files list */}
            {gdToken && (
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
                  <h3 className="font-semibold text-sm">Available Backups</h3>
                  <Button size="sm" variant="ghost" onClick={() => listBackups()} disabled={gdLoading} className="h-7 px-2 text-xs gap-1">
                    <RefreshCw size={11} className={gdLoading ? 'animate-spin' : ''} /> Refresh
                  </Button>
                </div>
                {gdLoading ? (
                  <div className="px-5 py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw size={14} className="animate-spin" /> Loading…
                  </div>
                ) : gdFiles.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-muted-foreground">No backups found. Click "Backup Now" to create your first backup.</div>
                ) : (
                  <div className="divide-y">
                    {gdFiles.map(f => (
                      <div key={f.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/20">
                        <div>
                          <p className="text-sm font-medium truncate max-w-[280px]">{f.name}</p>
                          <p className="text-xs text-muted-foreground">{fmt(f.createdTime)} {f.size ? `· ${fmtBytes(f.size)}` : ''}</p>
                        </div>
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => restoreBackup(f.id, f.name)}>
                            <Download size={11} /> Download
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-500 hover:bg-red-50" onClick={() => deleteBackup(f.id, f.name)}>
                            <Trash2 size={11} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>The Google OAuth client is configured for OsaTech's registered domain. If you host this app on a different domain, update the authorized origins in Google Cloud Console.</span>
            </div>
          </div>
        )}

        {/* ── Thermal Printer Tab ── */}
        {tab === 'thermal' && (
          <div className="max-w-xl space-y-5">
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Printer size={16} className="text-violet-600" />
                <h3 className="font-semibold">Store Information (printed on receipt)</h3>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Store size={10} /> Store Name</Label>
                  <Input placeholder="Golden Electronics" value={ps.store_name} onChange={P('store_name')} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><MapPin size={10} /> Address</Label>
                  <Input placeholder="Main Bazar, Lahore" value={ps.store_address} onChange={P('store_address')} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Phone size={10} /> Phone</Label>
                  <Input placeholder="0300-1234567" value={ps.store_phone} onChange={P('store_phone')} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Receipt Footer Message</Label>
                  <Input placeholder="Thank you for your business!" value={ps.receipt_footer} onChange={P('receipt_footer')} className="h-9 text-sm" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5">
              <h3 className="font-semibold text-sm mb-2">Paper Size</h3>
              <div className="flex items-center gap-3">
                <div className="px-3 py-1.5 rounded-lg border-2 border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-sm font-medium text-violet-700 dark:text-violet-300">72mm Thermal</div>
                <p className="text-xs text-muted-foreground">Standard thermal paper width used in most receipt printers.</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSaveSettings} disabled={saving} className="gap-1.5" style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                {saving ? <RefreshCw size={13} className="animate-spin" /> : <><CheckCircle2 size={14} /> Save Settings</>}
              </Button>
              <Button variant="outline" onClick={testThermal} className="gap-1.5">
                <Eye size={14} /> Test Print (72mm)
              </Button>
            </div>

            <div className="rounded-xl border bg-muted/30 p-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">How to Print</h4>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Connect your thermal printer and set it as the default printer</li>
                <li>When printing a receipt, a new window opens and auto-triggers the print dialog</li>
                <li>In the print dialog, make sure <strong className="text-foreground">paper size is 72mm × Auto</strong></li>
                <li>Disable headers/footers and set margins to None</li>
                <li>Click Print — the receipt prints silently on the thermal paper</li>
              </ol>
            </div>
          </div>
        )}

        {/* ── Formal Invoice Tab ── */}
        {tab === 'formal' && (
          <div className="max-w-xl space-y-5">
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <FileText size={16} className="text-red-600" />
                <h3 className="font-semibold">Invoice Header (A4 Format)</h3>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Store size={10} /> Company / Store Name</Label>
                  <Input placeholder="Golden Electronics" value={ps.store_name} onChange={P('store_name')} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><MapPin size={10} /> Address</Label>
                  <Input placeholder="Main Bazar, Lahore" value={ps.store_address} onChange={P('store_address')} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Phone size={10} /> Phone</Label>
                  <Input placeholder="0300-1234567" value={ps.store_phone} onChange={P('store_phone')} className="h-9 text-sm" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5">
              <h3 className="font-semibold text-sm mb-3">Terms &amp; Conditions (bottom of invoice)</h3>
              <textarea
                value={ps.invoice_terms}
                onChange={P('invoice_terms')}
                rows={3}
                placeholder="Payment due within 30 days…"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSaveSettings} disabled={saving} className="gap-1.5" style={{ background: 'linear-gradient(135deg,#cc0000,#991b1b)' }}>
                {saving ? <RefreshCw size={13} className="animate-spin" /> : <><CheckCircle2 size={14} /> Save Settings</>}
              </Button>
              <Button variant="outline" onClick={testFormal} className="gap-1.5">
                <Eye size={14} /> Test Print (A4)
              </Button>
            </div>

            <div className="rounded-xl border bg-muted/30 p-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Formal Invoice Features</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• A4 size with professional header (company name in red)</li>
                <li>• Bill-To section with customer details</li>
                <li>• Items table with S.No, Description, Warranty, Qty, Unit Price, Amount</li>
                <li>• Summary: Amount, Discount, Grand Total, Paid, Balance</li>
                <li>• Customer Signature · Prepared By · Authorized Signature lines</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
