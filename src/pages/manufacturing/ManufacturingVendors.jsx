import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  Truck, Plus, Search, X, RefreshCw, AlertCircle,
  MoreVertical, Eye, Pencil, Trash2, Phone, Mail,
  Building2, MapPin, FileText, CheckCircle2,
  ShoppingCart, Banknote, TrendingDown, Hash, MessageCircle,
  CreditCard,
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
        <div className="fixed right-0 top-0 bottom-0 w-[420px] border-l bg-background shadow-2xl z-30 flex flex-col" style={{ top: '56px' }}>
          {/* Header: name + phone */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0">
            <div className="min-w-0">
              <h2 className="font-bold text-base truncate">{profile.data?.vendor?.name || 'Vendor Profile'}</h2>
              {profile.data?.vendor?.phone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Phone size={10} /> {profile.data.vendor.phone}
                </p>
              )}
            </div>
            <button onClick={() => setProfile({ open: false, data: null, loading: false })} className="ml-3 p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0">
              <X size={16} />
            </button>
          </div>

          {profile.loading ? (
            <div className="flex-1 flex items-center justify-center">
              <RefreshCw size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : profile.data && (
            <div className="flex-1 overflow-y-auto">

              {/* Action buttons */}
              <div className="px-4 pt-4 pb-3 grid grid-cols-2 gap-2">
                <Link to="/manufacturing/purchases">
                  <button className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
                    <Plus size={14} /> New Purchase
                  </button>
                </Link>
                <button
                  onClick={() => toast.info('Record a payment in the Purchases page')}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold border border-border hover:bg-muted/50 transition-colors"
                >
                  <CreditCard size={14} /> Record Payment
                </button>
              </div>

              {/* 3 stat cards */}
              <div className="px-4 pb-3 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-muted/40 p-3 text-center">
                  <div className="text-xl font-black">{profile.data.analytics.totalOrders}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Orders</div>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.18)' }}>
                  <div className="text-sm font-black text-blue-600 truncate tabular-nums">{Rs(profile.data.analytics.totalPurchased)}</div>
                  <div className="text-[10px] text-blue-500/80 uppercase tracking-wide mt-0.5">Purchased</div>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.18)' }}>
                  <div className="text-sm font-black text-emerald-600 truncate tabular-nums">{Rs(profile.data.analytics.totalPaid)}</div>
                  <div className="text-[10px] text-emerald-500/80 uppercase tracking-wide mt-0.5">Paid</div>
                </div>
              </div>

              {/* Outstanding balance card */}
              <div className="px-4 pb-4">
                <div
                  className="rounded-xl px-4 py-3.5 flex items-center justify-between"
                  style={{
                    background: profile.data.analytics.outstanding > 0 ? 'rgba(239,68,68,0.07)' : 'rgba(16,185,129,0.07)',
                    border: `1.5px solid ${profile.data.analytics.outstanding > 0 ? 'rgba(239,68,68,0.22)' : 'rgba(16,185,129,0.22)'}`,
                  }}
                >
                  <div>
                    <div className="text-[11px] text-muted-foreground mb-1">Outstanding Balance</div>
                    <div className={`text-2xl font-black tabular-nums ${profile.data.analytics.outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {Rs(profile.data.analytics.outstanding)}
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${profile.data.analytics.outstanding > 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'}`}>
                    {profile.data.analytics.outstanding > 0 ? 'Owed' : 'Settled'}
                  </span>
                </div>
              </div>

              {/* WhatsApp share */}
              {(profile.data.vendor.whatsapp || profile.data.vendor.phone) && (
                <div className="px-4 pb-3">
                  <a
                    href={(() => {
                      const num = (profile.data.vendor.whatsapp || profile.data.vendor.phone).replace(/\D/g, '');
                      const ph = num.startsWith('0') ? '92' + num.slice(1) : num;
                      const { totalPurchased, totalPaid, outstanding } = profile.data.analytics;
                      const msg = `Assalam o Alaikum ${profile.data.vendor.name},\n\nAccount Summary:\n• Total Purchased: Rs. ${Math.round(totalPurchased).toLocaleString()}\n• Amount Paid: Rs. ${Math.round(totalPaid).toLocaleString()}\n• Balance Due: Rs. ${Math.round(outstanding).toLocaleString()}\n\nPlease confirm. JazakAllah.`;
                      return `https://wa.me/${ph}?text=${encodeURIComponent(msg)}`;
                    })()}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full rounded-lg py-2 text-sm font-semibold text-white"
                    style={{ background: '#25D366' }}
                  >
                    <MessageCircle size={14} fill="white" /> Share on WhatsApp
                  </a>
                </div>
              )}

              {/* Tabs */}
              <div className="px-4 pb-3 border-b">
                <div className="flex gap-1 bg-muted rounded-lg p-1">
                  <button className="flex-1 text-xs font-semibold py-1.5 rounded-md bg-background shadow-sm text-foreground">Purchases</button>
                  <button className="flex-1 text-xs font-semibold py-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors">Khata</button>
                  <button className="flex-1 text-xs font-semibold py-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors">Ledger</button>
                </div>
              </div>

              {/* BOUGHT / PAID / REMAINING summary */}
              <div className="px-4 py-3 grid grid-cols-3 gap-2 border-b">
                <div className="text-center">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Bought</div>
                  <div className="text-sm font-bold tabular-nums mt-0.5">{Rs(profile.data.analytics.totalPurchased)}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-emerald-500/80 uppercase tracking-wide">Paid</div>
                  <div className="text-sm font-bold tabular-nums text-emerald-600 mt-0.5">{Rs(profile.data.analytics.totalPaid)}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-red-500/70 uppercase tracking-wide">Remaining</div>
                  <div className={`text-sm font-bold tabular-nums mt-0.5 ${profile.data.analytics.outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{Rs(profile.data.analytics.outstanding)}</div>
                </div>
              </div>

              {/* Per-invoice cards */}
              <div className="px-4 py-4 space-y-3">
                {profile.data.purchases.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-muted-foreground text-sm gap-2">
                    <Truck size={28} className="opacity-20" />
                    No purchases recorded
                  </div>
                ) : (
                  profile.data.purchases.map(p => {
                    const paid = Number(p.paid_amount || 0);
                    const total = Number(p.total || 0);
                    const balance = total - paid;
                    const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
                    return (
                      <div key={p.id} className="rounded-xl border bg-card p-3.5 space-y-3">
                        {/* Top row */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground">#{p.id}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              p.status === 'Paid' || p.status === 'Completed'
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                : p.status === 'Partial'
                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            }`}>{p.status || 'Due'}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{fmt(p.created_at)}</span>
                        </div>
                        {/* Amount breakdown */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-lg bg-muted/40 px-2 py-2 text-center">
                            <div className="text-[10px] text-muted-foreground">Total</div>
                            <div className="text-xs font-bold tabular-nums mt-0.5">{Rs(total)}</div>
                          </div>
                          <div className="rounded-lg px-2 py-2 text-center" style={{ background: 'rgba(16,185,129,0.09)' }}>
                            <div className="text-[10px] text-emerald-500/80">Paid</div>
                            <div className="text-xs font-bold tabular-nums text-emerald-600 mt-0.5">{Rs(paid)}</div>
                          </div>
                          <div className="rounded-lg px-2 py-2 text-center" style={{ background: balance > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.09)' }}>
                            <div className="text-[10px] text-red-400/80">Balance</div>
                            <div className={`text-xs font-bold tabular-nums mt-0.5 ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{Rs(balance)}</div>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="space-y-1">
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: pct >= 100 ? '#10b981' : pct > 0 ? '#f59e0b' : '#ef4444' }}
                            />
                          </div>
                          <div className="text-[10px] text-muted-foreground text-right">{pct.toFixed(0)}% paid</div>
                        </div>
                        {/* Action buttons */}
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            onClick={() => toast.info('Go to Purchases to record a payment')}
                            className="py-1 rounded-lg text-[11px] font-semibold border border-blue-200 dark:border-blue-800 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          >Pay</button>
                          <button className="py-1 rounded-lg text-[11px] font-semibold border border-border text-muted-foreground hover:bg-muted/50 transition-colors">View</button>
                          <button className="py-1 rounded-lg text-[11px] font-semibold border border-border text-muted-foreground hover:bg-muted/50 transition-colors">Print</button>
                        </div>
                      </div>
                    );
                  })
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
