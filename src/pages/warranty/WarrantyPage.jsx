import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert, Plus, Search, RefreshCw, X, Trash2,
  Package, User, Phone, ChevronRight, CheckCircle2,
  Truck, PackageCheck, ArrowRight, ChevronDown,
  Warehouse, Building2, BadgeCheck, Activity,
  CalendarDays, FileText,
} from 'lucide-react';
import { Button }           from '@/components/ui/button';
import { Input }            from '@/components/ui/input';
import { Badge }            from '@/components/ui/badge';
import { Label }            from '@/components/ui/label';
import { Switch }           from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useDataStore } from '../../store/dataStore';
import { useToast }     from '../../context/ToastContext';
import { cn }           from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const STATUS_CONFIG = {
  in_godown:            { label: 'In Godown',     dot: 'bg-amber-500',   icon: Warehouse,    textColor: 'text-amber-600 dark:text-amber-400'    },
  sent_to_company:      { label: 'With Company',  dot: 'bg-blue-500',    icon: Building2,    textColor: 'text-blue-600 dark:text-blue-400'      },
  replacement_received: { label: 'Ready to Give', dot: 'bg-violet-500',  icon: PackageCheck, textColor: 'text-violet-600 dark:text-violet-400'  },
  closed:               { label: 'Closed',         dot: 'bg-emerald-500', icon: BadgeCheck,   textColor: 'text-emerald-600 dark:text-emerald-400'},
};

const NEXT_STATUS = {
  in_godown:            { status: 'sent_to_company',      label: 'Mark Sent to Company',     icon: Truck        },
  sent_to_company:      { status: 'replacement_received', label: 'Mark Replacement Received', icon: PackageCheck },
  replacement_received: { status: 'closed',               label: 'Give to Customer & Close',  icon: BadgeCheck   },
};

const STAT_CARDS = [
  { key: 'inGodown',          label: 'In Godown',           icon: Warehouse,  gradient: 'from-amber-500 to-orange-500',  iconColor: 'text-amber-500',   bg: 'bg-amber-500/10'   },
  { key: 'withCompany',       label: 'With Company',        icon: Building2,  gradient: 'from-blue-500 to-cyan-500',     iconColor: 'text-blue-500',    bg: 'bg-blue-500/10'    },
  { key: 'resolvedThisMonth', label: 'Resolved This Month', icon: BadgeCheck, gradient: 'from-emerald-500 to-teal-500',  iconColor: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { key: 'totalActive',       label: 'Total Active',        icon: Activity,   gradient: 'from-violet-500 to-purple-500', iconColor: 'text-violet-500',  bg: 'bg-violet-500/10'  },
];

const fmtDate     = (s) => s ? new Date(s).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (s) => s ? new Date(s).toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
const todayStr    = () => new Date().toISOString().slice(0, 10);

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={cn('gap-1.5 text-[10px] font-bold px-2 py-0.5', cfg.textColor)}>
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot)} />
      <Icon size={9} />
      {cfg.label}
    </Badge>
  );
}

// ─── Timeline Step ────────────────────────────────────────────────────────────

function TimelineStep({ icon: Icon, label, dateStr, done, active, last }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0 transition-all',
          done   ? 'bg-emerald-500 border-emerald-500 text-white' :
          active ? 'bg-primary border-primary text-primary-foreground' :
                   'bg-background border-border text-muted-foreground',
        )}>
          {done ? <CheckCircle2 size={14} /> : <Icon size={13} />}
        </div>
        {!last && <div className={cn('w-0.5 flex-1 my-1 min-h-[20px] rounded-full', done ? 'bg-emerald-500/40' : 'bg-border')} />}
      </div>
      <div className="pb-4 pt-0.5 min-w-0">
        <p className={cn('text-sm font-semibold', done || active ? 'text-foreground' : 'text-muted-foreground')}>{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {fmtDateTime(dateStr) ?? (active ? 'Current stage' : 'Pending')}
        </p>
      </div>
    </div>
  );
}

// ─── Customer Autocomplete ─────────────────────────────────────────────────────

function CustomerSearchInput({ value, onChange, onSelect, placeholder = 'Search or type customer name…', customers }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const options = useMemo(() => {
    if (!value.trim()) return [];
    const q = value.toLowerCase();
    return customers.filter((c) => c.name?.toLowerCase().includes(q) || c.phone?.includes(q)).slice(0, 8);
  }, [value, customers]);

  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => options.length && setOpen(true)}
        className="pl-8 h-9 text-sm"
      />
      <AnimatePresence>
        {open && options.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden">
            {options.map((c) => (
              <button key={c.id} type="button"
                onClick={() => { onSelect({ id: c.id, name: c.name, phone: c.phone || '' }); setOpen(false); }}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors text-left">
                <span className="font-medium">{c.name}</span>
                <span className="text-[11px] text-muted-foreground">{c.phone}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Product Autocomplete ─────────────────────────────────────────────────────

function ProductSearchInput({ value, onChange, onSelect, products }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const options = useMemo(() => {
    if (!value.trim()) return [];
    const q = value.toLowerCase();
    return products.filter((p) => p.name?.toLowerCase().includes(q)).slice(0, 8);
  }, [value, products]);

  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        placeholder="Search product name…"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => options.length && setOpen(true)}
        className="pl-8 h-9 text-sm"
      />
      <AnimatePresence>
        {open && options.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden">
            {options.map((p) => (
              <button key={p.id} type="button"
                onClick={() => { onSelect({ id: p.id, name: p.name, stock: p.stock ?? 0 }); setOpen(false); }}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors text-left">
                <span className="font-medium">{p.name}</span>
                <span className="text-[11px] text-muted-foreground">Stock: {p.stock ?? 0}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── New Claim Dialog ─────────────────────────────────────────────────────────

function NewClaimDialog({ open, onOpenChange, customers, products, onSaved }) {
  const { pushEntity, get, nextId } = useDataStore();
  const { showToast } = useToast();

  const emptyForm = {
    product_name: '', product_id: null,
    customer_name: '', customer_phone: '', customer_id: null,
    sale_id: '', received_date: todayStr(), loaner_given: false, notes: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const reset = () => setForm(emptyForm);

  useEffect(() => { if (!open) reset(); }, [open]);

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.product_name.trim()) { showToast('Select or enter a product.', 'error'); return; }
    if (!form.received_date)       { showToast('Received date is required.', 'error'); return; }
    setSaving(true);
    try {
      const id = nextId();
      const claim = {
        id,
        product_id: form.product_id ?? null,
        product_name: form.product_name.trim(),
        customer_id: form.customer_id ?? null,
        customer_name: form.customer_name.trim() || null,
        customer_phone: form.customer_phone.trim() || null,
        sale_id: form.sale_id ? Number(form.sale_id) : null,
        status: 'in_godown',
        loaner_given: form.loaner_given ? 1 : 0,
        received_date: form.received_date,
        sent_to_company_date: null,
        replacement_received_date: null,
        given_to_customer_date: null,
        notes: form.notes.trim() || null,
        date_created: new Date().toISOString(),
      };
      await pushEntity('warranty_claim', 'create', claim);

      // Deduct 1 from stock when loaner is given
      if (form.loaner_given && form.product_id) {
        const prod = get('product', form.product_id);
        if (prod) {
          await pushEntity('product', 'update', { ...prod, stock: Math.max(0, (prod.stock ?? 0) - 1), updated_at: new Date().toISOString() });
        }
      }

      showToast(`Claim #${id} created${form.loaner_given ? ' — 1 unit deducted from stock.' : '.'}`);
      onSaved();
      onOpenChange(false);
    } catch (e) {
      showToast(e.message || 'Failed to create claim', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <div className="h-0.5 w-full bg-gradient-to-r from-amber-500 to-orange-500" />
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-xl shrink-0">
              <ShieldAlert size={18} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <DialogTitle className="text-base">New Warranty Claim</DialogTitle>
              <DialogDescription className="text-[12px]">Log a product returned under warranty</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Product */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider">Product *</Label>
            <ProductSearchInput
              value={form.product_name}
              onChange={(v) => { f('product_name', v); f('product_id', null); }}
              onSelect={(p) => { f('product_name', p.name); f('product_id', p.id); }}
              products={products}
            />
          </div>

          {/* Customer */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider">Customer (optional)</Label>
            <CustomerSearchInput
              value={form.customer_name}
              onChange={(v) => f('customer_name', v)}
              onSelect={(c) => { f('customer_name', c.name); f('customer_phone', c.phone); f('customer_id', c.id); }}
              customers={customers}
            />
            <div className="relative">
              <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input placeholder="Phone number" value={form.customer_phone} onChange={(e) => f('customer_phone', e.target.value)} className="pl-8 h-9 text-sm" />
            </div>
          </div>

          {/* Sale # + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider">Sale # (optional)</Label>
              <div className="relative">
                <FileText size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input placeholder="e.g. 1042" value={form.sale_id} onChange={(e) => f('sale_id', e.target.value)} className="pl-8 h-9 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider">Received Date *</Label>
              <Input type="date" value={form.received_date} onChange={(e) => f('received_date', e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          {/* Loaner Switch */}
          <Card className={cn('border transition-colors', form.loaner_given ? 'border-orange-500/40 bg-orange-500/5' : '')}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Give loaner unit to customer now</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Customer keeps a working unit while awaiting replacement.{' '}
                    <span className="text-orange-600 dark:text-orange-400 font-semibold">Deducts 1 from stock immediately.</span>
                  </p>
                </div>
                <Switch checked={form.loaner_given} onCheckedChange={(v) => f('loaner_given', v)} className="shrink-0 mt-0.5" />
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider">Notes (optional)</Label>
            <textarea
              value={form.notes}
              onChange={(e) => f('notes', e.target.value)}
              rows={2}
              placeholder="Fault description, serial number, etc."
              className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/60 bg-muted/20">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}
            className="bg-amber-500 hover:bg-amber-600 text-white border-0 min-w-[110px]">
            {saving ? 'Creating…' : 'Create Claim'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Claim Detail Panel ───────────────────────────────────────────────────────

function ClaimDetailPanel({ claim, onClose, onUpdated, customers }) {
  const { pushEntity, get } = useDataStore();
  const { showToast } = useToast();

  const [notes, setNotes]         = useState(claim.notes || '');
  const [editNotes, setEditNotes] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [showCloseStep, setShowCloseStep] = useState(false);
  const [closeCustomer, setCloseCustomer] = useState({
    id: claim.customer_id ?? null,
    name: claim.customer_name || '',
    phone: claim.customer_phone || '',
  });

  const next = NEXT_STATUS[claim.status];
  const statusOrder = ['in_godown', 'sent_to_company', 'replacement_received', 'closed'];
  const idx = statusOrder.indexOf(claim.status);

  const handleAdvanceClick = () => {
    if (!next) return;
    if (next.status === 'closed') { setShowCloseStep(true); return; }
    doAdvance();
  };

  const doAdvance = async (opts = {}) => {
    if (!next) return;
    setAdvancing(true);
    try {
      const now = new Date().toISOString();
      const updated = {
        ...claim,
        status: next.status,
        ...(next.status === 'sent_to_company'      ? { sent_to_company_date: now } : {}),
        ...(next.status === 'replacement_received' ? { replacement_received_date: now } : {}),
        ...(next.status === 'closed'               ? { given_to_customer_date: now, ...opts } : {}),
        updated_at: now,
      };
      await pushEntity('warranty_claim', 'update', updated);

      // Stock effects
      if (next.status === 'replacement_received' && claim.product_id) {
        const prod = get('product', claim.product_id);
        if (prod) {
          await pushEntity('product', 'update', { ...prod, stock: (prod.stock ?? 0) + 1, updated_at: now });
        }
      }
      if (next.status === 'closed' && !claim.loaner_given && claim.product_id) {
        const prod = get('product', claim.product_id);
        if (prod) {
          await pushEntity('product', 'update', { ...prod, stock: Math.max(0, (prod.stock ?? 0) - 1), updated_at: now });
        }
      }

      const msgs = {
        sent_to_company:      'Marked as sent to company.',
        replacement_received: 'Replacement received — stock +1.',
        closed: claim.loaner_given ? 'Closed — loaner returned.' : 'Closed — 1 unit deducted from stock.',
      };
      showToast(msgs[next.status] || 'Status updated.');
      onUpdated();
      onClose();
    } catch (e) {
      showToast(e.message || 'Failed to update status', 'error');
    } finally {
      setAdvancing(false); }
  };

  const handleConfirmClose = () => {
    doAdvance(closeCustomer.name ? {
      customer_id: closeCustomer.id,
      customer_name: closeCustomer.name,
      customer_phone: closeCustomer.phone,
    } : {});
  };

  const saveNotes = async () => {
    try {
      await pushEntity('warranty_claim', 'update', { ...claim, notes, updated_at: new Date().toISOString() });
      showToast('Notes updated.');
      setEditNotes(false);
      onUpdated();
    } catch (e) {
      showToast(e.message || 'Failed to save notes', 'error');
    }
  };

  const del = async () => {
    setDeleting(true);
    try {
      await pushEntity('warranty_claim', 'delete', claim);
      showToast('Claim removed.');
      onUpdated();
      onClose();
    } catch (e) {
      showToast(e.message || 'Failed to delete', 'error');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col h-full"
      >
        <div className="h-0.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-amber-500/10 rounded-xl shrink-0">
              <ShieldAlert size={15} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{claim.product_name}</p>
              <p className="text-[11px] text-muted-foreground">Claim #{claim.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={claim.status} />
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground ml-1 transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Info */}
          <Card>
            <CardContent className="p-4 space-y-2.5">
              {claim.customer_name ? (
                <div className="flex items-center gap-2 text-sm">
                  <User size={13} className="text-muted-foreground shrink-0" />
                  <span className="font-medium">{claim.customer_name}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User size={13} className="shrink-0" />
                  <span className="italic text-xs">No customer linked</span>
                </div>
              )}
              {claim.customer_phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone size={13} className="text-muted-foreground shrink-0" />
                  <span>{claim.customer_phone}</span>
                </div>
              )}
              {claim.sale_id && (
                <div className="flex items-center gap-2 text-sm">
                  <FileText size={13} className="text-muted-foreground shrink-0" />
                  <span>Sale #{claim.sale_id}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <CalendarDays size={13} className="text-muted-foreground shrink-0" />
                <span>Received {fmtDate(claim.received_date)}</span>
              </div>
              {!!claim.loaner_given && (
                <div className="flex items-center gap-2 pt-1 border-t border-border/60">
                  <Package size={13} className="text-orange-500 shrink-0" />
                  <span className="text-[12px] text-orange-600 dark:text-orange-400 font-semibold">
                    Loaner unit given to customer (−1 stock)
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Progress</p>
            <TimelineStep icon={Warehouse}    label="Received in Godown"  dateStr={claim.received_date}             done={idx >= 0} active={claim.status === 'in_godown'}             last={false} />
            <TimelineStep icon={Truck}        label="Sent to Company"      dateStr={claim.sent_to_company_date}      done={idx >= 2} active={claim.status === 'sent_to_company'}     last={false} />
            <TimelineStep icon={PackageCheck} label="Replacement Received" dateStr={claim.replacement_received_date} done={idx >= 3} active={claim.status === 'replacement_received'} last={false} />
            <TimelineStep icon={BadgeCheck}   label="Given to Customer"    dateStr={claim.given_to_customer_date}    done={idx >= 4} active={claim.status === 'closed'}               last={true}  />
          </div>

          {/* Notes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Notes</p>
              {!editNotes && claim.status !== 'closed' && (
                <button onClick={() => setEditNotes(true)} className="text-[11px] text-primary hover:underline">Edit</button>
              )}
            </div>
            {editNotes ? (
              <div className="space-y-2">
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                  className="w-full px-3 py-2 text-sm bg-background border border-input rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditNotes(false)}>Cancel</Button>
                  <Button size="sm" onClick={saveNotes}>Save</Button>
                </div>
              </div>
            ) : (
              <Card><CardContent className="px-4 py-3">
                <p className={cn('text-sm', claim.notes ? 'text-foreground' : 'text-muted-foreground italic')}>
                  {claim.notes || 'No notes added.'}
                </p>
              </CardContent></Card>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border/60 px-5 py-4 space-y-2 shrink-0">
          {/* "Give to Customer" expanded step */}
          <AnimatePresence>
            {showCloseStep && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <Card className="border-emerald-500/30 bg-emerald-500/5 mb-3">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <BadgeCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
                      <p className="text-sm font-semibold text-foreground">Who is receiving the unit?</p>
                    </div>
                    <CustomerSearchInput
                      value={closeCustomer.name}
                      onChange={(v) => setCloseCustomer((p) => ({ ...p, name: v, id: null }))}
                      onSelect={(c) => setCloseCustomer(c)}
                      customers={customers}
                    />
                    <div className="relative">
                      <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      <Input
                        placeholder="Phone (optional)"
                        value={closeCustomer.phone}
                        onChange={(e) => setCloseCustomer((p) => ({ ...p, phone: e.target.value }))}
                        className="pl-8 h-9 text-sm"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowCloseStep(false)}>
                        Cancel
                      </Button>
                      <Button size="sm" className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                        onClick={handleConfirmClose} disabled={advancing}>
                        {advancing ? 'Closing…' : <><BadgeCheck size={13} /> Confirm & Close</>}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Advance button */}
          {next && !showCloseStep && (
            <Button className="w-full h-10 font-semibold gap-2" onClick={handleAdvanceClick} disabled={advancing}>
              {advancing ? 'Updating…' : (
                <><next.icon size={15} />{next.label}<ArrowRight size={14} className="ml-auto" /></>
              )}
            </Button>
          )}

          {/* Delete */}
          {!confirmDel ? (
            <button onClick={() => setConfirmDel(true)}
              className="w-full text-[12px] text-muted-foreground hover:text-destructive transition-colors py-1.5 flex items-center justify-center gap-1.5">
              <Trash2 size={12} /> Delete Claim
            </button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setConfirmDel(false)}>Cancel</Button>
              <Button size="sm" variant="destructive" className="flex-1" onClick={del} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Confirm Delete'}
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WarrantyPage() {
  const { list, refresh }  = useDataStore();
  const [tab, setTab]      = useState('all');
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [showNew, setShowNew]   = useState(false);
  const [detail, setDetail]     = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const allClaims  = list('warranty_claim');
  const customers  = list('customer');
  const products   = list('product');

  // Filter + sort
  const filtered = useMemo(() => {
    let arr = allClaims;
    if (tab !== 'all') arr = arr.filter((c) => c.status === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter((c) =>
        c.product_name?.toLowerCase().includes(q) ||
        c.customer_name?.toLowerCase().includes(q) ||
        c.customer_phone?.includes(q)
      );
    }
    return arr.sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0));
  }, [allClaims, tab, search]);

  const visible = filtered.slice(0, pageSize);
  const hasMore = filtered.length > pageSize;

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    return {
      inGodown:          allClaims.filter((c) => c.status === 'in_godown').length,
      withCompany:       allClaims.filter((c) => c.status === 'sent_to_company').length,
      resolvedThisMonth: allClaims.filter((c) => {
        if (c.status !== 'closed') return false;
        const d = new Date(c.given_to_customer_date || c.updated_at || 0);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length,
      totalActive: allClaims.filter((c) => c.status !== 'closed').length,
    };
  }, [allClaims]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await refresh(); } finally { setRefreshing(false); }
  };

  return (
    <div className="flex flex-col h-full bg-background min-h-0">
      {/* Page header */}
      <div className="shrink-0 border-b border-border/60 bg-card/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-xl">
              <ShieldAlert size={20} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Warranty Claims</h1>
              <p className="text-[12px] text-muted-foreground">Track returns from intake to resolution</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-1.5">
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </Button>
            <Button size="sm" onClick={() => setShowNew(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white border-0 gap-1.5">
              <Plus size={14} /> New Claim
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STAT_CARDS.map(({ key, label, icon: Icon, gradient, iconColor, bg }, i) => (
            <motion.div key={key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="overflow-hidden">
                <div className={cn('h-0.5 w-full bg-gradient-to-r', gradient)} />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
                      <p className="text-3xl font-black tabular-nums text-foreground">{stats[key]}</p>
                    </div>
                    <div className={cn('p-2.5 rounded-xl', bg)}>
                      <Icon size={18} className={iconColor} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Tabs + search */}
        <Tabs value={tab} onValueChange={(v) => { setTab(v); setPageSize(PAGE_SIZE); }}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <TabsList className="h-9">
              <TabsTrigger value="all"                  className="text-xs px-3">All</TabsTrigger>
              <TabsTrigger value="in_godown"            className="text-xs px-3">In Godown</TabsTrigger>
              <TabsTrigger value="sent_to_company"      className="text-xs px-3">With Company</TabsTrigger>
              <TabsTrigger value="replacement_received" className="text-xs px-3">Ready to Give</TabsTrigger>
              <TabsTrigger value="closed"               className="text-xs px-3">Closed</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search customer or product…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPageSize(PAGE_SIZE); }}
                  className="pl-8 h-9 text-sm w-56"
                />
              </div>
              {search && (
                <Button variant="ghost" size="sm" onClick={() => setSearch('')} className="h-9 px-2 text-muted-foreground">
                  <X size={13} />
                </Button>
              )}
            </div>
          </div>

          <TabsContent value={tab} className="mt-4 space-y-3">
            {visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-muted/30 rounded-2xl mb-4">
                  <ShieldAlert size={32} className="text-muted-foreground/30" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No warranty claims found</p>
                <p className="text-[12px] text-muted-foreground/60 mt-1">
                  {tab === 'all' && !search ? 'Create your first claim using the button above.' : 'No claims match this filter.'}
                </p>
              </div>
            ) : (
              <>
                <Card>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10 text-center">#</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Received</TableHead>
                          <TableHead className="w-8" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <AnimatePresence initial={false}>
                          {visible.map((claim, i) => (
                            <motion.tr
                              key={claim.id}
                              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                              transition={{ delay: Math.min(i, 10) * 0.025 }}
                              onClick={() => setDetail(claim)}
                              className="cursor-pointer hover:bg-muted/40 transition-colors border-b border-border/40 last:border-0"
                            >
                              <TableCell className="text-center text-xs font-mono text-muted-foreground">{String(claim.id).slice(-6)}</TableCell>
                              <TableCell>
                                <div className="space-y-0.5">
                                  <p className="text-sm font-semibold text-foreground">{claim.product_name}</p>
                                  {!!claim.loaner_given && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-600 dark:text-orange-400 border-orange-500/30">
                                      Loaner given
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <p className="text-sm text-foreground">{claim.customer_name || <span className="text-muted-foreground italic text-xs">—</span>}</p>
                                {claim.customer_phone && (
                                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <Phone size={9} />{claim.customer_phone}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell><StatusBadge status={claim.status} /></TableCell>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmtDate(claim.received_date)}</TableCell>
                              <TableCell><ChevronRight size={15} className="text-muted-foreground/40" /></TableCell>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                      </TableBody>
                    </Table>
                  </div>
                </Card>

                {/* Pagination footer */}
                <div className="flex items-center justify-between px-1">
                  <p className="text-[12px] text-muted-foreground">
                    Showing <span className="font-semibold text-foreground">{visible.length}</span> of <span className="font-semibold text-foreground">{filtered.length}</span> claims
                  </p>
                  {hasMore && (
                    <Button variant="outline" size="sm" onClick={() => setPageSize((p) => p + PAGE_SIZE)} className="gap-1.5">
                      <ChevronDown size={12} /> Load more ({filtered.length - visible.length} remaining)
                    </Button>
                  )}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <NewClaimDialog
        open={showNew}
        onOpenChange={setShowNew}
        customers={customers}
        products={products}
        onSaved={() => {}}
      />

      <AnimatePresence>
        {detail && (
          <ClaimDetailPanel
            claim={detail}
            onClose={() => setDetail(null)}
            onUpdated={() => setDetail(null)}
            customers={customers}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
