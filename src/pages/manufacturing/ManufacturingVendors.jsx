import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import {
  Truck, Plus, Search, X, RefreshCw, AlertCircle,
  MoreVertical, Eye, Pencil, Trash2, Phone, Mail,
  Building2, MapPin, FileText, CheckCircle2,
  ShoppingCart, Banknote, TrendingDown, Hash,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import {
  mfgGetVendors, mfgGetVendorProfile,
  mfgCreateVendor, mfgUpdateVendor, mfgDeleteVendor,
} from '../../api/manufacturingApi';

const Rs  = n => `Rs. ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmt = d => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const EMPTY_FORM = { name: '', company_name: '', phone: '', whatsapp: '', address: '', email: '', ntn: '', notes: '' };

export default function ManufacturingVendors() {
  const [vendors, setVendors]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');

  // Dialogs
  const [formDlg, setFormDlg]   = useState({ open: false, mode: 'add', vendor: null });
  const [delDlg, setDelDlg]     = useState({ open: false, vendor: null });
  const [form, setForm]         = useState(EMPTY_FORM);
  const [submitting, setSub]    = useState(false);

  // Profile panel
  const [profile, setProfile]   = useState({ open: false, data: null, loading: false });

  // 3-dot menu
  const [menu, setMenu]         = useState({ open: false, id: null });
  const menuRef                 = useRef(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await mfgGetVendors();
      setVendors(res.vendors || []);
    } catch (e) { setError(e.message || 'Failed to load vendors'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu({ open: false, id: null });
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const displayed = useMemo(() => {
    if (!search.trim()) return vendors;
    const q = search.toLowerCase();
    return vendors.filter(v => v.name.toLowerCase().includes(q) || v.company_name.toLowerCase().includes(q) || v.phone.includes(q));
  }, [vendors, search]);

  // ── form helpers ─────────────────────────────────────────────────────────────
  function openAdd() {
    setForm(EMPTY_FORM);
    setFormDlg({ open: true, mode: 'add', vendor: null });
  }
  function openEdit(v) {
    setForm({ name: v.name, company_name: v.company_name, phone: v.phone, whatsapp: v.whatsapp, address: v.address, email: v.email, ntn: v.ntn, notes: v.notes });
    setFormDlg({ open: true, mode: 'edit', vendor: v });
    setMenu({ open: false, id: null });
  }
  const F = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Vendor name is required'); return; }
    setSub(true);
    try {
      if (formDlg.mode === 'add') {
        const res = await mfgCreateVendor(form);
        setVendors(prev => [...prev, res.vendor].sort((a, b) => a.name.localeCompare(b.name)));
        toast.success('Vendor added');
      } else {
        const res = await mfgUpdateVendor(formDlg.vendor.id, form);
        setVendors(prev => prev.map(v => v.id === formDlg.vendor.id ? res.vendor : v));
        toast.success('Vendor updated');
        if (profile.open && profile.data?.vendor?.id === formDlg.vendor.id)
          setProfile(p => ({ ...p, data: { ...p.data, vendor: res.vendor } }));
      }
      setFormDlg({ open: false, mode: 'add', vendor: null });
    } catch (e) { toast.error(e.message || 'Failed to save'); }
    finally { setSub(false); }
  }

  async function handleDelete() {
    setSub(true);
    try {
      await mfgDeleteVendor(delDlg.vendor.id);
      setVendors(prev => prev.filter(v => v.id !== delDlg.vendor.id));
      toast.success('Vendor deleted');
      setDelDlg({ open: false, vendor: null });
      if (profile.open && profile.data?.vendor?.id === delDlg.vendor.id)
        setProfile({ open: false, data: null, loading: false });
    } catch (e) { toast.error(e.message || 'Failed to delete'); }
    finally { setSub(false); }
  }

  async function openProfile(v) {
    setMenu({ open: false, id: null });
    setProfile({ open: true, data: null, loading: true });
    try {
      const res = await mfgGetVendorProfile(v.id);
      setProfile({ open: true, data: res, loading: false });
    } catch (e) {
      toast.error('Failed to load profile');
      setProfile({ open: false, data: null, loading: false });
    }
  }

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">

      {/* Main table */}
      <div className={`flex flex-col flex-1 overflow-hidden transition-all ${profile.open ? 'mr-[400px]' : ''}`}>

        {/* Header */}
        <div className="px-6 py-5 border-b bg-background shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                <Truck size={20} className="text-indigo-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Vendors</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Suppliers you buy raw materials and assembled coolers from</p>
                <p className="text-xs text-muted-foreground mt-1"><strong className="text-foreground">{vendors.length}</strong> vendor{vendors.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={fetch} disabled={loading}>
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              </Button>
              <Button size="sm" onClick={openAdd} className="gap-1.5" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
                <Plus size={13} /> Add Vendor
              </Button>
            </div>
          </div>
          <div className="mt-4 relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search vendors…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><X size={13} /></button>}
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-400">
            <AlertCircle size={13} /> {error}
            <Button size="sm" variant="ghost" className="ml-auto h-5 px-2 text-xs" onClick={fetch}>Retry</Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-0">
              {[1,2,3].map(i => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 border-b animate-pulse">
                  {[1,2,3,4].map(j => <div key={j} className="h-3 flex-1 rounded bg-muted" />)}
                </div>
              ))}
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 gap-3 text-muted-foreground text-sm">
              <Truck size={32} className="opacity-25" />
              {search ? `No vendors match "${search}"` : 'No vendors yet. Add your first vendor.'}
              {!search && <Button size="sm" onClick={openAdd} className="gap-1.5 mt-1"><Plus size={12} /> Add Vendor</Button>}
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-muted/50 backdrop-blur-sm border-b">
                <tr>
                  {['Name', 'Company', 'Phone', 'Email', 'Actions'].map((h, i) => (
                    <th key={h} className={`px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide ${i === 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map(v => (
                  <tr key={v.id} className={`border-b hover:bg-muted/20 transition-colors cursor-pointer ${profile.data?.vendor?.id === v.id ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`} onClick={() => openProfile(v)}>
                    <td className="px-5 py-3.5 font-medium text-sm">{v.name}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">{v.company_name || <span className="opacity-30">—</span>}</td>
                    <td className="px-5 py-3.5 text-sm">{v.phone || <span className="opacity-30 text-muted-foreground">—</span>}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">{v.email || <span className="opacity-30">—</span>}</td>
                    <td className="px-5 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                      <div className="relative inline-block" ref={menu.id === v.id ? menuRef : null}>
                        <button
                          onClick={() => setMenu(m => m.id === v.id && m.open ? { open: false, id: null } : { open: true, id: v.id })}
                          className="p-1.5 rounded hover:bg-muted transition-colors"
                        >
                          <MoreVertical size={15} />
                        </button>
                        {menu.open && menu.id === v.id && (
                          <div className="absolute right-0 top-8 z-50 w-44 rounded-lg border bg-popover shadow-xl py-1">
                            <button onClick={() => openProfile(v)} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-muted/50 transition-colors">
                              <Eye size={14} /> Full Profile
                            </button>
                            <button onClick={() => openEdit(v)} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-muted/50 transition-colors">
                              <Pencil size={14} /> Edit
                            </button>
                            <button onClick={() => { setDelDlg({ open: true, vendor: v }); setMenu({ open: false, id: null }); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Profile side panel */}
      {profile.open && (
        <div className="fixed right-0 top-0 bottom-0 w-[400px] border-l bg-background shadow-2xl z-30 flex flex-col" style={{ top: '56px' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
            <h2 className="font-semibold">Vendor Profile</h2>
            <button onClick={() => setProfile({ open: false, data: null, loading: false })} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
          </div>

          {profile.loading ? (
            <div className="flex-1 flex items-center justify-center">
              <RefreshCw size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : profile.data && (
            <div className="flex-1 overflow-y-auto">
              {/* Vendor info */}
              <div className="px-5 py-4 border-b">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-lg">{profile.data.vendor.name}</h3>
                    {profile.data.vendor.company_name && <p className="text-sm text-muted-foreground">{profile.data.vendor.company_name}</p>}
                  </div>
                  <button onClick={() => openEdit(profile.data.vendor)} className="p-1.5 rounded text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30"><Pencil size={14} /></button>
                </div>
                <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {profile.data.vendor.phone   && <div className="flex items-center gap-2"><Phone size={12} /> {profile.data.vendor.phone}</div>}
                  {profile.data.vendor.email   && <div className="flex items-center gap-2"><Mail size={12} /> {profile.data.vendor.email}</div>}
                  {profile.data.vendor.address && <div className="flex items-center gap-2"><MapPin size={12} /> {profile.data.vendor.address}</div>}
                  {profile.data.vendor.ntn     && <div className="flex items-center gap-2"><Hash size={12} /> NTN: {profile.data.vendor.ntn}</div>}
                  {profile.data.vendor.notes   && <div className="flex items-center gap-2"><FileText size={12} /> {profile.data.vendor.notes}</div>}
                </div>
              </div>

              {/* Stats */}
              <div className="px-5 py-4 border-b">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Analytics</h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Orders', value: profile.data.analytics.totalOrders, icon: ShoppingCart, color: 'text-blue-600' },
                    { label: 'Purchased', value: Rs(profile.data.analytics.totalPurchased), icon: TrendingDown, color: 'text-indigo-600' },
                    { label: 'Total Paid', value: Rs(profile.data.analytics.totalPaid), icon: Banknote, color: 'text-emerald-600' },
                    { label: 'Outstanding', value: Rs(profile.data.analytics.outstanding), icon: AlertCircle, color: profile.data.analytics.outstanding > 0 ? 'text-red-600' : 'text-emerald-600' },
                  ].map(s => (
                    <div key={s.label} className="rounded-lg bg-muted/40 p-3">
                      <div className={`flex items-center gap-1.5 text-xs text-muted-foreground mb-1`}><s.icon size={11} /> {s.label}</div>
                      <div className={`text-base font-bold tabular-nums ${s.color}`}>{s.value}</div>
                    </div>
                  ))}
                </div>
                {profile.data.analytics.outstanding === 0 && profile.data.analytics.totalOrders > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 font-semibold"><CheckCircle2 size={12} /> Fully Settled</div>
                )}
              </div>

              {/* Recent purchases */}
              <div className="px-5 py-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Recent Purchases</h4>
                {profile.data.purchases.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No purchases recorded</p>
                ) : (
                  <div className="space-y-2">
                    {profile.data.purchases.map(p => (
                      <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{Rs(p.total)}</p>
                          <p className="text-xs text-muted-foreground">{fmt(p.created_at)}</p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            p.status === 'Completed' || p.status === 'Paid'
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                              : p.status === 'Partial'
                              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          }`}>{p.status || 'Due'}</span>
                          {p.paid_amount < p.total && (
                            <p className="text-xs text-red-500 mt-0.5">Due: {Rs(p.total - p.paid_amount)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={formDlg.open} onOpenChange={v => setFormDlg(d => ({ ...d, open: v }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck size={16} className="text-indigo-500" />
              {formDlg.mode === 'add' ? 'Add New Vendor' : `Edit — ${formDlg.vendor?.name}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Vendor Name <span className="text-red-500">*</span></Label>
                <Input placeholder="e.g. Ali Traders" value={form.name} onChange={F('name')} className="h-9 text-sm" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Building2 size={10} /> Company Name</Label>
                <Input placeholder="Optional" value={form.company_name} onChange={F('company_name')} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Phone size={10} /> Contact Number</Label>
                <Input placeholder="03001234567" value={form.phone} onChange={F('phone')} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">WhatsApp</Label>
                <Input placeholder="Same or different" value={form.whatsapp} onChange={F('whatsapp')} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Mail size={10} /> Email</Label>
                <Input type="email" placeholder="Optional" value={form.email} onChange={F('email')} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><MapPin size={10} /> Address</Label>
                <Input placeholder="City / Area" value={form.address} onChange={F('address')} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Hash size={10} /> NTN / Tax Info</Label>
                <Input placeholder="Optional" value={form.ntn} onChange={F('ntn')} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs flex items-center gap-1"><FileText size={10} /> Notes</Label>
                <Input placeholder="Any notes…" value={form.notes} onChange={F('notes')} className="h-9 text-sm" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFormDlg(d => ({ ...d, open: false }))} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSave} disabled={submitting || !form.name.trim()} style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
              {submitting ? <RefreshCw size={13} className="animate-spin" /> : <><CheckCircle2 size={14} /> {formDlg.mode === 'add' ? 'Add Vendor' : 'Save'}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={delDlg.open} onOpenChange={v => setDelDlg(d => ({ ...d, open: v }))}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 size={16} /> Delete Vendor</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">Delete <strong className="text-foreground">{delDlg.vendor?.name}</strong>? This pushes a delete sync event.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDelDlg({ open: false, vendor: null })} disabled={submitting}>Cancel</Button>
            <Button onClick={handleDelete} disabled={submitting} className="bg-red-600 hover:bg-red-700 text-white">
              {submitting ? <RefreshCw size={13} className="animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
