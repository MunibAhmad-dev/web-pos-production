import { useState, useMemo, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import {
  FileText, Printer, MoreHorizontal, Search,
  Plus, Trash2, Pencil, RotateCcw, XCircle, Eye,
  ShoppingCart, ShoppingBag, MessageCircle, RefreshCw, AlertCircle, CloudOff,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Separator } from '../../components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '../../components/ui/dropdown-menu';
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from '../../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { Label } from '../../components/ui/label';
import { useMfgAuth } from '../../context/ManufacturingAuthContext';
import InvoiceReceiptPreview from '../../components/manufacturing/InvoiceReceiptPreview';
import { printInvoice, whatsappShare } from '../../lib/invoicePrint';
import { mfgGetInvoices } from '../../api/manufacturingApi';

// ─── static catalogues used in edit mode ─────────────────────────────────────
const PRODUCTS = [
  { id: 1, name: 'Air Cooler 24"',  selling_price: 22500 },
  { id: 2, name: 'Air Cooler 18"',  selling_price: 18000 },
  { id: 3, name: 'Desert Cooler',   selling_price: 32000 },
  { id: 4, name: 'Window Cooler',   selling_price: 28000 },
];
const PARTS = [
  { id: 1, name: 'Motor 18" 3-Speed', unit: 'pc',  selling_price: 5000, unit_cost: 3200 },
  { id: 2, name: 'Hex Nut M6',        unit: 'bag', selling_price: 2500, unit_cost: 2000 },
  { id: 3, name: 'Frame Sheet 18g',   unit: 'pc',  selling_price: 1500, unit_cost: 1200 },
  { id: 4, name: 'Pump 0.5hp',        unit: 'pc',  selling_price: 1500, unit_cost: 1000 },
  { id: 5, name: 'Water Pad 36"',     unit: 'pc',  selling_price:  800, unit_cost:  600 },
  { id: 6, name: 'Blade Set 24"',     unit: 'set', selling_price: 2000, unit_cost: 1400 },
];
const ACCOUNTS = [
  { id: 1, name: 'Cash' },
  { id: 2, name: 'Bank – HBL' },
  { id: 3, name: 'Bank – UBL' },
  { id: 4, name: 'EasyPaisa' },
  { id: 5, name: 'JazzCash' },
];
const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'EasyPaisa', 'JazzCash', 'Cheque'];

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmt(n) { return `Rs. ${Math.round(n || 0).toLocaleString()}`; }
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'numeric' });
}
function calcRestoreStatus(total, paid) {
  if (paid >= total) return 'Paid';
  if (paid > 0)      return 'Partial';
  return 'Due';
}

function buildOpts(u, items, factory) {
  const isSale = u.type === 'sale';
  const r = u.raw;

  const itemsArr = items.map(i => ({
    name: isSale ? i.product_name : i.part_name,
    tag:  isSale ? (i.item_kind === 'part' ? 'Part' : 'Product') : `Part · ${i.unit || ''}`,
    qty:  i.quantity,
    unit: isSale ? (i.item_kind === 'part' ? '' : 'pc') : (i.unit || ''),
    unitPrice: i.unit_price,
    total:     i.total,
  }));

  const subtotal = items.length > 0
    ? items.reduce((s, i) => s + i.total, 0)
    : (r.subtotal || r.total || 0);
  const discount = r.discount || 0;
  const extra    = isSale ? (r.tax || 0) : (r.transport || 0);
  const total    = subtotal - discount + extra;
  const paid     = r.paid_amount || 0;
  const balance  = total - paid;

  const totals = [
    { label: 'Subtotal', value: subtotal },
    ...(discount ? [{ label: 'Discount', value: discount, tone: 'muted' }] : []),
    ...(extra    ? [{ label: isSale ? 'Tax' : 'Transport', value: extra, tone: 'muted' }] : []),
    { label: 'Grand Total', value: total, emphasis: true },
    { label: 'Paid', value: paid, tone: 'muted' },
    ...(balance > 0 ? [{ label: 'Balance Due', value: balance }] : []),
  ];

  const STATUS_TONE = { Paid:'success', Partial:'warning', Due:'destructive', Returned:'warning', Cancelled:'destructive' };

  return {
    docType:   isSale ? 'Sales Invoice' : 'Purchase Invoice',
    docNumber: u.invoice_number,
    date:      fmtDate(r.created_at),
    company:   { name: factory || 'My Factory' },
    party: {
      label:   isSale ? 'Customer' : 'Vendor',
      name:    u.party,
      phone:   isSale ? r.customer_phone : '',
      address: isSale ? r.customer_address : '',
    },
    items: itemsArr,
    totals,
    status: { label: u.status, tone: STATUS_TONE[u.status] || 'warning' },
    accentColor: '#7C3AED',
  };
}

// ─── badge components ─────────────────────────────────────────────────────────
const STATUS_STYLE = {
  Paid:      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Partial:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  Due:       'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  Returned:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};
function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLE[status] || 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  );
}
function TypeBadge({ type }) {
  return type === 'sale'
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"><ShoppingCart size={10}/> Sale</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"><ShoppingBag size={10}/> Purchase</span>;
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function ManufacturingInvoices() {
  const { mfgUser } = useMfgAuth();
  const factory = mfgUser?.company_name || 'My Factory';

  // ── remote data ───────────────────────────────────────────────────────────
  const [invoices, setInvoices] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await mfgGetInvoices();
      setInvoices(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // ── filters ───────────────────────────────────────────────────────────────
  const [typeFilter,   setTypeFilter]   = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search,       setSearch]       = useState('');

  // ── dialog state ──────────────────────────────────────────────────────────
  const [viewing,      setViewing]      = useState(null);
  const [editMode,     setEditMode]     = useState(false);
  const [editItems,    setEditItems]    = useState([]);
  const [editHeader,   setEditHeader]   = useState({});
  const [addKind,      setAddKind]      = useState('product');
  const [addId,        setAddId]        = useState('');
  const [addQty,       setAddQty]       = useState(1);
  const [addPrice,     setAddPrice]     = useState('');

  const [receiptOpen,  setReceiptOpen]  = useState(false);
  const [receiptOpts,  setReceiptOpts]  = useState(null);
  const [receiptPhone, setReceiptPhone] = useState('');

  const [confirmState, setConfirmState] = useState(null);

  // ── unified list ──────────────────────────────────────────────────────────
  const unified = useMemo(() => {
    const list = invoices.map(inv => ({
      key:            `${inv.type}-${inv.id}`,
      type:           inv.type,
      id:             inv.id,
      invoice_number: inv.invoice_number,
      date:           inv.created_at,
      party:          inv.type === 'sale' ? (inv.customer_name || 'Walk-in') : (inv.vendor_name || 'Unknown Vendor'),
      phone:          inv.type === 'sale' ? (inv.customer_phone || '') : '',
      total:          inv.total,
      paid_amount:    inv.paid_amount,
      status:         inv.status,
      raw:            inv,
    }));
    list.sort((a, b) => new Date(b.date) - new Date(a.date));
    return list;
  }, [invoices]);

  const filtered = useMemo(() => unified.filter(u => {
    if (typeFilter   !== 'all' && u.type   !== typeFilter)   return false;
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!u.invoice_number.toLowerCase().includes(q) && !u.party.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [unified, typeFilter, statusFilter, search]);

  // ── summary totals ────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const revenue  = invoices.filter(i => i.type === 'sale'     && !['Cancelled','Returned'].includes(i.status)).reduce((s, x) => s + x.total, 0);
    const expenses = invoices.filter(i => i.type === 'purchase' && i.status !== 'Cancelled').reduce((s, x) => s + x.total, 0);
    const due      = unified.filter(u => ['Partial','Due'].includes(u.status)).reduce((s, u) => s + Math.max(0, u.total - u.paid_amount), 0);
    return { revenue, expenses, due, count: unified.length };
  }, [invoices, unified]);

  // ── items: line items are not synced to cloud ──────────────────────────────
  function getItems() { return []; }

  // ── open view ─────────────────────────────────────────────────────────────
  function openView(u) {
    setViewing(u);
    setEditMode(false);
    setEditItems([]);
    setEditHeader({});
  }

  // ── start edit ────────────────────────────────────────────────────────────
  function startEdit() {
    if (!viewing) return;
    const r = viewing.raw;
    // editItems starts empty — cloud doesn't have line items
    setEditItems([]);
    setEditHeader(viewing.type === 'sale'
      ? {
          party:          r.customer_name,
          phone:          r.customer_phone   || '',
          address:        r.customer_address || '',
          subtotal:       r.subtotal || r.total || 0,
          discount:       r.discount       || 0,
          tax:            r.tax            || 0,
          paid_amount:    r.paid_amount,
          payment_method: r.payment_method || 'Cash',
          account_id:     r.account_id     || 1,
        }
      : {
          party:          r.vendor_name,
          phone:          '',
          address:        '',
          subtotal:       r.subtotal || r.total || 0,
          discount:       r.discount    || 0,
          transport:      r.transport   || 0,
          paid_amount:    r.paid_amount,
          payment_method: r.payment_method || 'Cash',
          account_id:     r.account_id     || 1,
        }
    );
    setEditMode(true);
    setAddKind('product'); setAddId(''); setAddQty(1); setAddPrice('');
  }

  // ── edit item helpers ─────────────────────────────────────────────────────
  function updateEditItem(idx, field, value) {
    setEditItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        updated.total = Math.round((Number(updated.quantity) || 0) * (Number(updated.unit_price) || 0));
      }
      return updated;
    }));
  }
  function removeEditItem(idx) {
    setEditItems(prev => prev.filter((_, i) => i !== idx));
  }
  function addEditItem() {
    if (!addId) { toast.error('Select an item first'); return; }
    const isSale = viewing?.type === 'sale';
    if (isSale) {
      const source = addKind === 'product'
        ? PRODUCTS.find(p => p.id === Number(addId))
        : PARTS.find(p => p.id === Number(addId));
      if (!source) return;
      const price = addPrice !== '' ? Number(addPrice) : source.selling_price;
      const qty   = Number(addQty) || 1;
      setEditItems(prev => [...prev, {
        id: `new-${Date.now()}`,
        item_kind:    addKind,
        product_id:   addKind === 'product' ? source.id : null,
        part_id:      addKind === 'part'    ? source.id : null,
        product_name: source.name,
        quantity: qty, unit_price: price, total: qty * price,
      }]);
    } else {
      const part = PARTS.find(p => p.id === Number(addId));
      if (!part) return;
      const price = addPrice !== '' ? Number(addPrice) : part.unit_cost;
      const qty   = Number(addQty) || 1;
      setEditItems(prev => [...prev, {
        id: `new-${Date.now()}`,
        part_id: part.id, part_name: part.name, unit: part.unit,
        quantity: qty, unit_price: price, total: qty * price,
      }]);
    }
    setAddId(''); setAddQty(1); setAddPrice('');
  }

  // ── computed edit totals ──────────────────────────────────────────────────
  // If no items have been added yet, fall back to the stored subtotal so
  // the total shows correctly even without line-item data.
  const editSubtotal  = editItems.length > 0
    ? editItems.reduce((s, i) => s + (i.total || 0), 0)
    : Number(editHeader.subtotal || 0);
  const editDiscount  = Number(editHeader.discount  || 0);
  const editTransport = Number(editHeader.transport || 0);
  const editTax       = Number(editHeader.tax       || 0);
  const editTotal     = editSubtotal - editDiscount + editTransport + editTax;
  const editPaid      = Number(editHeader.paid_amount || 0);
  const editBalance   = Math.max(0, editTotal - editPaid);

  // ── save edit ─────────────────────────────────────────────────────────────
  function saveEdit() {
    if (!viewing) return;
    const isSale    = viewing.type === 'sale';
    const newStatus = editPaid >= editTotal ? 'Paid' : editPaid > 0 ? 'Partial' : 'Due';

    const updatedInv = isSale
      ? {
          ...viewing.raw,
          customer_name:    editHeader.party,
          customer_phone:   editHeader.phone,
          customer_address: editHeader.address,
          subtotal:         editSubtotal,
          discount:         editDiscount,
          tax:              editTax,
          total:            editTotal,
          paid_amount:      editPaid,
          payment_method:   editHeader.payment_method,
          account_id:       editHeader.account_id,
          status:           newStatus,
          edited_at:        new Date().toISOString(),
        }
      : {
          ...viewing.raw,
          vendor_name:    editHeader.party,
          subtotal:       editSubtotal,
          discount:       editDiscount,
          transport:      editTransport,
          total:          editTotal,
          paid_amount:    editPaid,
          payment_method: editHeader.payment_method,
          account_id:     editHeader.account_id,
          status:         newStatus,
          edited_at:      new Date().toISOString(),
        };

    setInvoices(prev => prev.map(inv =>
      (inv.id === viewing.id && inv.type === viewing.type) ? updatedInv : inv
    ));
    setViewing({ ...viewing, party: editHeader.party, total: editTotal, paid_amount: editPaid, status: newStatus, raw: updatedInv });
    setEditMode(false);
    toast.success('Invoice updated');
  }

  // ── status actions ────────────────────────────────────────────────────────
  function applyStatusChange(u, newStatus) {
    setInvoices(prev => prev.map(inv =>
      (inv.id === u.id && inv.type === u.type) ? { ...inv, status: newStatus } : inv
    ));
    if (viewing && viewing.key === u.key) {
      setViewing({ ...u, status: newStatus, raw: { ...u.raw, status: newStatus } });
    }
    toast.success(`Invoice ${newStatus}`);
  }
  function requestStatusChange(u, newStatus, label) {
    setConfirmState({ label, action: () => { applyStatusChange(u, newStatus); setConfirmState(null); } });
  }

  // ── print / share ─────────────────────────────────────────────────────────
  function openPrint(u, style = 'formal') {
    const opts = buildOpts(u, getItems(), factory);
    printInvoice({ ...opts, style });
  }
  function openReceipt(u) {
    const opts = buildOpts(u, getItems(), factory);
    setReceiptOpts({ ...opts, style: 'thermal' });
    setReceiptPhone(u.phone || '');
    setReceiptOpen(true);
  }

  const isSaleView = viewing?.type === 'sale';

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 p-5 md:p-7 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText size={22} className="text-violet-600" /> Invoices
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">All sales &amp; purchase invoices — synced from the desktop app</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={fetchInvoices} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      {/* Error banner */}
      {error && !loading && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertCircle size={15} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <Button size="sm" variant="ghost" className="text-red-700 h-7 px-2" onClick={fetchInvoices}>Retry</Button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:'Total Invoices',  value: loading ? '—' : totals.count,           plain: true },
          { label:'Total Revenue',   value: loading ? '—' : fmt(totals.revenue),   color:'text-green-600' },
          { label:'Total Purchases', value: loading ? '—' : fmt(totals.expenses),  color:'text-orange-600' },
          { label:'Balance Due',     value: loading ? '—' : fmt(totals.due),        color:'text-red-600' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
            <p className={`text-lg font-bold ${c.color || ''}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 h-9 text-sm"
            placeholder="Search invoice # or party…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-36 text-sm"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="sale">Sales Only</SelectItem>
            <SelectItem value="purchase">Purchases Only</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-36 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Paid">Paid</SelectItem>
            <SelectItem value="Partial">Partial</SelectItem>
            <SelectItem value="Due">Due</SelectItem>
            <SelectItem value="Cancelled">Cancelled</SelectItem>
            <SelectItem value="Returned">Returned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs text-muted-foreground">
                <TableHead>Invoice #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Party</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Loading skeleton */}
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skel-${i}`}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <TableCell key={j}>
                      <div className="h-4 rounded bg-muted animate-pulse" style={{ width: j === 3 ? '120px' : j === 4 || j === 5 ? '80px' : '60px' }} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                    {invoices.length === 0
                      ? 'No invoices synced yet. Use the Electron desktop app to create sales and purchases, then sync.'
                      : 'No invoices match the current filters.'}
                  </TableCell>
                </TableRow>
              )}

              {!loading && filtered.map(u => (
                <TableRow
                  key={u.key}
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => openView(u)}
                >
                  <TableCell className="font-mono text-xs font-semibold">{u.invoice_number}</TableCell>
                  <TableCell><TypeBadge type={u.type} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmtDate(u.date)}</TableCell>
                  <TableCell className="text-sm font-medium max-w-[140px] truncate">{u.party}</TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums">{fmt(u.total)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{fmt(u.paid_amount)}</TableCell>
                  <TableCell><StatusBadge status={u.status} /></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-violet-600" title="Print Formal" onClick={() => openPrint(u, 'formal')}>
                        <Printer size={13} />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground">
                            <MoreHorizontal size={13} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="text-sm">
                          <DropdownMenuItem onClick={() => openView(u)}>
                            <Eye size={13} className="mr-2" /> View Invoice
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { openView(u); setTimeout(startEdit, 50); }}>
                            <Pencil size={13} className="mr-2" /> Edit Invoice
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openReceipt(u)}>
                            <FileText size={13} className="mr-2" /> Receipt Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openPrint(u, 'thermal')}>
                            <Printer size={13} className="mr-2" /> Print Thermal
                          </DropdownMenuItem>
                          {u.phone && (
                            <DropdownMenuItem onClick={() => {
                              const opts = buildOpts(u, getItems(), factory);
                              const grand = opts.totals.find(t => t.emphasis);
                              whatsappShare(u.phone, `*${opts.docType}: ${opts.docNumber}*\nParty: ${u.party}\nTotal: Rs.${Math.round(grand?.value||0).toLocaleString()}\nStatus: ${u.status}`);
                            }}>
                              <MessageCircle size={13} className="mr-2" /> WhatsApp
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {u.type === 'sale' && !['Returned','Cancelled'].includes(u.status) && (
                            <DropdownMenuItem className="text-purple-600" onClick={() => requestStatusChange(u, 'Returned', 'Mark as Returned')}>
                              <RotateCcw size={13} className="mr-2" /> Mark as Returned
                            </DropdownMenuItem>
                          )}
                          {!['Cancelled'].includes(u.status) && (
                            <DropdownMenuItem className="text-red-600" onClick={() => requestStatusChange(u, 'Cancelled', 'Cancel Invoice')}>
                              <XCircle size={13} className="mr-2" /> Cancel Invoice
                            </DropdownMenuItem>
                          )}
                          {['Cancelled','Returned'].includes(u.status) && (
                            <DropdownMenuItem className="text-green-700" onClick={() => requestStatusChange(u, calcRestoreStatus(u.total, u.paid_amount), 'Restore Invoice')}>
                              <RotateCcw size={13} className="mr-2" /> Restore to Normal
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="px-4 py-2 border-t text-xs text-muted-foreground">
            Showing {filtered.length} of {unified.length} invoices
          </div>
        )}
      </div>

      {/* ── View / Edit Dialog ───────────────────────────────────────────── */}
      <Dialog open={!!viewing} onOpenChange={v => { if (!v) { setViewing(null); setEditMode(false); } }}>
        <DialogContent className="max-w-3xl min-h-[65vh] max-h-[90vh] overflow-y-auto">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  <TypeBadge type={viewing.type} />
                  <span className="font-mono">{viewing.invoice_number}</span>
                  <StatusBadge status={viewing.status} />
                  {viewing.raw.edited_at && (
                    <span className="text-xs text-muted-foreground font-normal ml-1">
                      (edited {fmtDate(viewing.raw.edited_at)})
                    </span>
                  )}
                </DialogTitle>
              </DialogHeader>

              {/* ── READ-ONLY VIEW ── */}
              {!editMode && (
                <div className="space-y-5 pt-2">
                  {/* Party + Date */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide font-semibold">
                        {isSaleView ? 'Customer' : 'Vendor'}
                      </p>
                      <p className="font-semibold">{viewing.party}</p>
                      {isSaleView && viewing.raw.customer_phone && (
                        <p className="text-muted-foreground text-xs mt-0.5">{viewing.raw.customer_phone}</p>
                      )}
                      {isSaleView && viewing.raw.customer_address && (
                        <p className="text-muted-foreground text-xs">{viewing.raw.customer_address}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide font-semibold">Date</p>
                      <p className="font-semibold">{fmtDate(viewing.date)}</p>
                      {viewing.raw.payment_method && (
                        <p className="text-muted-foreground text-xs mt-0.5">{viewing.raw.payment_method}</p>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Items — not synced notice */}
                  <div className="rounded-lg border border-dashed bg-muted/30 px-5 py-6 flex flex-col items-center gap-2 text-center">
                    <CloudOff size={20} className="text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">Line items not synced to cloud</p>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      The desktop app syncs invoice headers only. Open the invoice in the Electron app to see the full item breakdown.
                    </p>
                  </div>

                  {/* Totals */}
                  <div className="space-y-1.5 text-sm ml-auto w-64">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span><span className="tabular-nums">{fmt(viewing.raw.subtotal || viewing.total)}</span>
                    </div>
                    {(viewing.raw.discount > 0) && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Discount</span><span className="tabular-nums">- {fmt(viewing.raw.discount)}</span>
                      </div>
                    )}
                    {(isSaleView ? viewing.raw.tax : viewing.raw.transport) > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>{isSaleView ? 'Tax' : 'Transport'}</span>
                        <span className="tabular-nums">{fmt(isSaleView ? viewing.raw.tax : viewing.raw.transport)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-bold text-base">
                      <span>Grand Total</span><span className="tabular-nums text-violet-600">{fmt(viewing.total)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Paid</span><span className="tabular-nums">{fmt(viewing.paid_amount)}</span>
                    </div>
                    {(viewing.total - viewing.paid_amount) > 0 && (
                      <div className="flex justify-between text-red-600 font-semibold">
                        <span>Balance Due</span><span className="tabular-nums">{fmt(viewing.total - viewing.paid_amount)}</span>
                      </div>
                    )}
                  </div>

                  {viewing.raw.notes && (
                    <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">{viewing.raw.notes}</div>
                  )}
                </div>
              )}

              {/* ── EDIT MODE ── */}
              {editMode && (
                <div className="space-y-5 pt-2">
                  {/* Header fields */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="space-y-1">
                      <Label className="text-xs">{isSaleView ? 'Customer Name' : 'Vendor Name'}</Label>
                      <Input value={editHeader.party || ''} onChange={e => setEditHeader(h => ({ ...h, party: e.target.value }))} className="h-8 text-sm" />
                    </div>
                    {isSaleView && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs">Phone</Label>
                          <Input value={editHeader.phone || ''} onChange={e => setEditHeader(h => ({ ...h, phone: e.target.value }))} className="h-8 text-sm" placeholder="03…" />
                        </div>
                        <div className="space-y-1 col-span-2">
                          <Label className="text-xs">Address</Label>
                          <Input value={editHeader.address || ''} onChange={e => setEditHeader(h => ({ ...h, address: e.target.value }))} className="h-8 text-sm" placeholder="Optional" />
                        </div>
                      </>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">Payment Method</Label>
                      <Select value={editHeader.payment_method || 'Cash'} onValueChange={v => setEditHeader(h => ({ ...h, payment_method: v }))}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Account</Label>
                      <Select value={String(editHeader.account_id || 1)} onValueChange={v => setEditHeader(h => ({ ...h, account_id: Number(v) }))}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{ACCOUNTS.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Discount (Rs.)</Label>
                      <Input type="number" min={0} value={editHeader.discount ?? 0} onChange={e => setEditHeader(h => ({ ...h, discount: Number(e.target.value) }))} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{isSaleView ? 'Tax (Rs.)' : 'Transport (Rs.)'}</Label>
                      <Input
                        type="number" min={0}
                        value={isSaleView ? (editHeader.tax ?? 0) : (editHeader.transport ?? 0)}
                        onChange={e => setEditHeader(h => isSaleView ? { ...h, tax: Number(e.target.value) } : { ...h, transport: Number(e.target.value) })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Amount Paid (Rs.)</Label>
                      <Input type="number" min={0} value={editHeader.paid_amount ?? 0} onChange={e => setEditHeader(h => ({ ...h, paid_amount: Number(e.target.value) }))} className="h-8 text-sm" />
                    </div>
                  </div>

                  <Separator />

                  {/* Items edit section */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Items</p>

                    {editItems.length === 0 ? (
                      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-4 text-xs text-muted-foreground text-center mb-3">
                        No items loaded from cloud. Add items below if needed (these are local-only and won't sync back).
                      </div>
                    ) : (
                      <div className="rounded-lg border overflow-hidden mb-3">
                        <Table>
                          <TableHeader>
                            <TableRow className="text-xs text-muted-foreground">
                              <TableHead>{isSaleView ? 'Item' : 'Part'}</TableHead>
                              <TableHead className="w-20">Qty</TableHead>
                              <TableHead className="w-28">Unit Price</TableHead>
                              <TableHead className="text-right w-24">Amount</TableHead>
                              <TableHead className="w-8"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {editItems.map((item, idx) => (
                              <TableRow key={item.id || idx}>
                                <TableCell className="text-sm">
                                  <span className="font-medium">{isSaleView ? item.product_name : item.part_name}</span>
                                  {isSaleView && item.item_kind === 'part' && (
                                    <span className="ml-1.5 text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">Part</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Input type="number" min={0.01} step={0.01} value={item.quantity} onChange={e => updateEditItem(idx, 'quantity', Number(e.target.value))} className="h-7 text-xs w-16 tabular-nums" />
                                </TableCell>
                                <TableCell>
                                  <Input type="number" min={0} value={item.unit_price} onChange={e => updateEditItem(idx, 'unit_price', Number(e.target.value))} className="h-7 text-xs w-24 tabular-nums" />
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-sm font-semibold">{fmt(item.total)}</TableCell>
                                <TableCell>
                                  <button onClick={() => removeEditItem(idx)} className="text-muted-foreground hover:text-red-500 transition-colors p-1 rounded">
                                    <Trash2 size={13} />
                                  </button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* Add item row */}
                    <div className="p-3 rounded-lg border border-dashed bg-muted/20 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">Add Item</p>
                      <div className="flex flex-wrap gap-2 items-end">
                        {isSaleView && (
                          <Select value={addKind} onValueChange={v => { setAddKind(v); setAddId(''); setAddPrice(''); }}>
                            <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="product">Product</SelectItem>
                              <SelectItem value="part">Part</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        <Select value={addId} onValueChange={v => {
                          setAddId(v);
                          if (isSaleView) {
                            const src = addKind === 'product' ? PRODUCTS.find(p => p.id === Number(v)) : PARTS.find(p => p.id === Number(v));
                            if (src) setAddPrice(String(src.selling_price));
                          } else {
                            const p = PARTS.find(x => x.id === Number(v));
                            if (p) setAddPrice(String(p.unit_cost));
                          }
                        }}>
                          <SelectTrigger className="h-8 text-xs flex-1 min-w-[160px]"><SelectValue placeholder="Select…" /></SelectTrigger>
                          <SelectContent>
                            {(isSaleView ? (addKind === 'product' ? PRODUCTS : PARTS) : PARTS).map(x =>
                              <SelectItem key={x.id} value={String(x.id)}>{x.name}</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <Input type="number" min={0.01} step={0.01} value={addQty} onChange={e => setAddQty(e.target.value)} className="h-8 text-xs w-16" placeholder="Qty" />
                        <Input type="number" min={0} value={addPrice} onChange={e => setAddPrice(e.target.value)} className="h-8 text-xs w-28" placeholder="Price" />
                        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={addEditItem}>
                          <Plus size={12} /> Add
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Edit totals preview */}
                  <div className="space-y-1.5 text-sm ml-auto w-64 pt-2">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span><span className="tabular-nums">{fmt(editSubtotal)}</span>
                    </div>
                    {editDiscount > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Discount</span><span className="tabular-nums">- {fmt(editDiscount)}</span>
                      </div>
                    )}
                    {(isSaleView ? editTax : editTransport) > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>{isSaleView ? 'Tax' : 'Transport'}</span><span className="tabular-nums">{fmt(isSaleView ? editTax : editTransport)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-bold text-base">
                      <span>Grand Total</span><span className="tabular-nums text-violet-600">{fmt(editTotal)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Paid</span><span className="tabular-nums">{fmt(editPaid)}</span>
                    </div>
                    {editBalance > 0 && (
                      <div className="flex justify-between text-red-600 font-semibold">
                        <span>Balance Due</span><span className="tabular-nums">{fmt(editBalance)}</span>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground pt-1">
                      Status after save: <StatusBadge status={editPaid >= editTotal ? 'Paid' : editPaid > 0 ? 'Partial' : 'Due'} />
                    </div>
                  </div>
                </div>
              )}

              {/* Dialog footer */}
              <DialogFooter className="flex-wrap gap-2 sm:justify-between pt-2 border-t">
                <div className="flex gap-2 flex-wrap">
                  {!editMode && (
                    <>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openPrint(viewing, 'formal')}>
                        <Printer size={13} /> Print A4
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openPrint(viewing, 'thermal')}>
                        <Printer size={13} /> Thermal
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openReceipt(viewing)}>
                        <FileText size={13} /> Preview
                      </Button>
                      {viewing.phone && (
                        <Button size="sm" variant="outline" className="gap-1.5 text-green-700 border-green-200 hover:bg-green-50" onClick={() => {
                          const opts = buildOpts(viewing, getItems(), factory);
                          const grand = opts.totals.find(t => t.emphasis);
                          whatsappShare(viewing.phone, `*${opts.docType}: ${viewing.invoice_number}*\nTotal: Rs.${Math.round(grand?.value||0).toLocaleString()}\nStatus: ${viewing.status}`);
                        }}>
                          <MessageCircle size={13} /> WhatsApp
                        </Button>
                      )}
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  {!editMode && !['Cancelled','Returned'].includes(viewing.status) && (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={startEdit}>
                      <Pencil size={13} /> Edit
                    </Button>
                  )}
                  {editMode && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
                      <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5" onClick={saveEdit}>
                        Save Changes
                      </Button>
                    </>
                  )}
                  {!editMode && (
                    <Button size="sm" variant="ghost" onClick={() => setViewing(null)}>Close</Button>
                  )}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Confirm Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!confirmState} onOpenChange={v => !v && setConfirmState(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirmState?.label}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to {confirmState?.label?.toLowerCase()}? This will update the invoice status.
          </p>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmState(null)}>Cancel</Button>
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white" onClick={confirmState?.action}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Receipt Preview ─────────────────────────────────────────────── */}
      <InvoiceReceiptPreview
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        opts={receiptOpts}
        phone={receiptPhone}
      />
    </div>
  );
}
