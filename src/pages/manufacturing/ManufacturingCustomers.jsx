import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import {
  Users, Plus, Search, X, RefreshCw, AlertCircle,
  MoreVertical, Eye, Pencil, Trash2, Phone,
  MapPin, FileText, CheckCircle2,
  ShoppingBag, Banknote, TrendingUp, Clock,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import {
  mfgGetCustomers, mfgGetCustomerProfile,
  mfgCreateCustomer, mfgUpdateCustomer, mfgDeleteCustomer,
} from '../../api/manufacturingApi';

const Rs  = n => `Rs. ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmt = d => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const EMPTY_FORM = { name: '', phone: '', whatsapp: '', address: '', city: '', notes: '' };

export default function ManufacturingCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [search, setSearch]       = useState('');

  const [formDlg, setFormDlg]     = useState({ open: false, mode: 'add', customer: null });
  const [delDlg, setDelDlg]       = useState({ open: false, customer: null });
  const [form, setForm]           = useState(EMPTY_FORM);
  const [submitting, setSub]      = useState(false);

  const [profile, setProfile]     = useState({ open: false, data: null, loading: false });
  const [menu, setMenu]           = useState({ open: false, id: null });
  const menuRef                   = useRef(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await mfgGetCustomers();
      setCustomers(res.customers || []);
    } catch (e) { setError(e.message || 'Failed to load'); }
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
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.city.toLowerCase().includes(q));
  }, [customers, search]);

  // ── form helpers ─────────────────────────────────────────────────────────────
  function openAdd() {
    setForm(EMPTY_FORM);
    setFormDlg({ open: true, mode: 'add', customer: null });
  }
  function openEdit(c) {
    setForm({ name: c.name, phone: c.phone, whatsapp: c.whatsapp, address: c.address, city: c.city, notes: c.notes });
    setFormDlg({ open: true, mode: 'edit', customer: c });
    setMenu({ open: false, id: null });
  }
  const F = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Customer name is required'); return; }
    setSub(true);
    try {
      if (formDlg.mode === 'add') {
        const res = await mfgCreateCustomer(form);
        setCustomers(prev => [...prev, res.customer].sort((a, b) => a.name.localeCompare(b.name)));
        toast.success('Customer added');
      } else {
        const res = await mfgUpdateCustomer(formDlg.customer.id, form);
        setCustomers(prev => prev.map(c => c.id === formDlg.customer.id ? res.customer : c));
        toast.success('Customer updated');
        if (profile.open && profile.data?.customer?.id === formDlg.customer.id)
          setProfile(p => ({ ...p, data: { ...p.data, customer: res.customer } }));
      }
      setFormDlg({ open: false, mode: 'add', customer: null });
    } catch (e) { toast.error(e.message || 'Failed to save'); }
    finally { setSub(false); }
  }

  async function handleDelete() {
    setSub(true);
    try {
      await mfgDeleteCustomer(delDlg.customer.id);
      setCustomers(prev => prev.filter(c => c.id !== delDlg.customer.id));
      toast.success('Customer deleted');
      setDelDlg({ open: false, customer: null });
      if (profile.open && profile.data?.customer?.id === delDlg.customer.id)
        setProfile({ open: false, data: null, loading: false });
    } catch (e) { toast.error(e.message || 'Failed to delete'); }
    finally { setSub(false); }
  }

  async function openProfile(c) {
    setMenu({ open: false, id: null });
    setProfile({ open: true, data: null, loading: true });
    try {
      const res = await mfgGetCustomerProfile(c.id);
      setProfile({ open: true, data: res, loading: false });
    } catch (e) {
      toast.error('Failed to load profile');
      setProfile({ open: false, data: null, loading: false });
    }
  }

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">

      {/* Main table */}
      <div className={`flex flex-col flex-1 overflow-hidden transition-all ${profile.open ? 'mr-[400px]' : ''}`}>

        {/* Header */}
        <div className="px-6 py-5 border-b bg-background shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                <Users size={20} className="text-emerald-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Customers</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Buyers of your air coolers and parts</p>
                <p className="text-xs text-muted-foreground mt-1"><strong className="text-foreground">{customers.length}</strong> customer{customers.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={fetch} disabled={loading}>
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              </Button>
              <Button size="sm" onClick={openAdd} className="gap-1.5" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                <Plus size={13} /> Add Customer
              </Button>
            </div>
          </div>
          <div className="mt-4 relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search customers…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
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
              <Users size={32} className="opacity-25" />
              {search ? `No customers match "${search}"` : 'No customers yet. Add your first customer.'}
              {!search && <Button size="sm" onClick={openAdd} className="gap-1.5 mt-1"><Plus size={12} /> Add Customer</Button>}
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-muted/50 backdrop-blur-sm border-b">
                <tr>
                  {['Name', 'Phone', 'City', 'Address', 'Actions'].map((h, i) => (
                    <th key={h} className={`px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide ${i === 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map(c => (
                  <tr key={c.id} className={`border-b hover:bg-muted/20 transition-colors cursor-pointer ${profile.data?.customer?.id === c.id ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`} onClick={() => openProfile(c)}>
                    <td className="px-5 py-3.5 font-medium text-sm">{c.name}</td>
                    <td className="px-5 py-3.5 text-sm">{c.phone || <span className="opacity-30 text-muted-foreground">—</span>}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">{c.city || <span className="opacity-30">—</span>}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">{c.address || <span className="opacity-30">—</span>}</td>
                    <td className="px-5 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                      <div className="relative inline-block" ref={menu.id === c.id ? menuRef : null}>
                        <button
                          onClick={() => setMenu(m => m.id === c.id && m.open ? { open: false, id: null } : { open: true, id: c.id })}
                          className="p-1.5 rounded hover:bg-muted transition-colors"
                        >
                          <MoreVertical size={15} />
                        </button>
                        {menu.open && menu.id === c.id && (
                          <div className="absolute right-0 top-8 z-50 w-44 rounded-lg border bg-popover shadow-xl py-1">
                            <button onClick={() => openProfile(c)} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-muted/50 transition-colors">
                              <Eye size={14} /> Full Profile
                            </button>
                            <button onClick={() => openEdit(c)} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-muted/50 transition-colors">
                              <Pencil size={14} /> Edit
                            </button>
                            <button onClick={() => { setDelDlg({ open: true, customer: c }); setMenu({ open: false, id: null }); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
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
            <h2 className="font-semibold">Customer Profile</h2>
            <button onClick={() => setProfile({ open: false, data: null, loading: false })} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
          </div>

          {profile.loading ? (
            <div className="flex-1 flex items-center justify-center">
              <RefreshCw size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : profile.data && (
            <div className="flex-1 overflow-y-auto">
              {/* Customer info */}
              <div className="px-5 py-4 border-b">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-lg">{profile.data.customer.name}</h3>
                    {profile.data.customer.city && <p className="text-sm text-muted-foreground">{profile.data.customer.city}</p>}
                  </div>
                  <button onClick={() => openEdit(profile.data.customer)} className="p-1.5 rounded text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30"><Pencil size={14} /></button>
                </div>
                <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {profile.data.customer.phone   && <div className="flex items-center gap-2"><Phone size={12} /> {profile.data.customer.phone}</div>}
                  {profile.data.customer.address && <div className="flex items-center gap-2"><MapPin size={12} /> {profile.data.customer.address}</div>}
                  {profile.data.customer.notes   && <div className="flex items-center gap-2"><FileText size={12} /> {profile.data.customer.notes}</div>}
                </div>
              </div>

              {/* Stats */}
              <div className="px-5 py-4 border-b">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Analytics</h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Orders', value: profile.data.analytics.totalOrders, icon: ShoppingBag, color: 'text-blue-600' },
                    { label: 'Lifetime Value', value: Rs(profile.data.analytics.lifetimeValue), icon: TrendingUp, color: 'text-indigo-600' },
                    { label: 'Total Paid', value: Rs(profile.data.analytics.totalPaid), icon: Banknote, color: 'text-emerald-600' },
                    { label: 'Due Amount', value: Rs(profile.data.analytics.dueAmount), icon: Clock, color: profile.data.analytics.dueAmount > 0 ? 'text-red-600' : 'text-emerald-600' },
                  ].map(s => (
                    <div key={s.label} className="rounded-lg bg-muted/40 p-3">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><s.icon size={11} /> {s.label}</div>
                      <div className={`text-base font-bold tabular-nums ${s.color}`}>{s.value}</div>
                    </div>
                  ))}
                </div>
                {profile.data.analytics.dueAmount === 0 && profile.data.analytics.totalOrders > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 font-semibold"><CheckCircle2 size={12} /> Fully Settled</div>
                )}
              </div>

              {/* Recent sales */}
              <div className="px-5 py-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Recent Sales</h4>
                {profile.data.sales.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sales recorded</p>
                ) : (
                  <div className="space-y-2">
                    {profile.data.sales.map(s => (
                      <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{Rs(s.total)}</p>
                          <p className="text-xs text-muted-foreground">{fmt(s.created_at)}</p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            s.status === 'Completed'
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                              : s.status === 'Partial'
                              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          }`}>{s.status || 'Due'}</span>
                          {s.paid_amount < s.total && (
                            <p className="text-xs text-red-500 mt-0.5">Due: {Rs(s.total - s.paid_amount)}</p>
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
              <Users size={16} className="text-emerald-500" />
              {formDlg.mode === 'add' ? 'Add New Customer' : `Edit — ${formDlg.customer?.name}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Customer Name <span className="text-red-500">*</span></Label>
                <Input placeholder="e.g. Raza Shop" value={form.name} onChange={F('name')} className="h-9 text-sm" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Phone size={10} /> Contact Number</Label>
                <Input placeholder="03111234567" value={form.phone} onChange={F('phone')} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">WhatsApp</Label>
                <Input placeholder="Same or different" value={form.whatsapp} onChange={F('whatsapp')} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><MapPin size={10} /> City</Label>
                <Input placeholder="e.g. Lahore" value={form.city} onChange={F('city')} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Address</Label>
                <Input placeholder="Area / Street" value={form.address} onChange={F('address')} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs flex items-center gap-1"><FileText size={10} /> Notes</Label>
                <Input placeholder="Any notes…" value={form.notes} onChange={F('notes')} className="h-9 text-sm" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFormDlg(d => ({ ...d, open: false }))} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSave} disabled={submitting || !form.name.trim()} style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
              {submitting ? <RefreshCw size={13} className="animate-spin" /> : <><CheckCircle2 size={14} /> {formDlg.mode === 'add' ? 'Add Customer' : 'Save'}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={delDlg.open} onOpenChange={v => setDelDlg(d => ({ ...d, open: v }))}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 size={16} /> Delete Customer</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">Delete <strong className="text-foreground">{delDlg.customer?.name}</strong>? This pushes a delete sync event.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDelDlg({ open: false, customer: null })} disabled={submitting}>Cancel</Button>
            <Button onClick={handleDelete} disabled={submitting} className="bg-red-600 hover:bg-red-700 text-white">
              {submitting ? <RefreshCw size={13} className="animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
