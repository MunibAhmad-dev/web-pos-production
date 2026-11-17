import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, ScanBarcode, Plus, Minus, X, Trash2, ShoppingCart, Sparkles, History, Package,
  UserRound, ChevronDown, Check, Scale, ArrowRight, Keyboard,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { useLowStockThreshold } from '../../hooks/useLowStockThreshold';
import { useStoreFeatures } from '../../hooks/useStoreFeatures';
import { usePosView } from '../../hooks/usePosView';
import CustomItemModal from '@/components/sales/CustomItemModal';
import CheckoutModal from '@/components/sales/CheckoutModal';
import ReceiptModal from '../../components/sales/ReceiptModal';
import CustomerFormModal from '../../components/customers/CustomerFormModal';
import { cn } from '@/lib/utils';

/* ══════════════════════════════════════════════════════════════════════════
   Sale lines follow the desktop app's conventions so both apps agree:
   - unit items:      qty in pieces,       price & cost per piece
   - weighed (gram):  qty in grams,        price & cost per gram   (product price/cost are per kg)
   - weighed (kg):    qty in kg (decimal), price & cost per kg
   - wholesale:       qty in boxes,        price & cost per box    (product price/cost are per carton)
   ══════════════════════════════════════════════════════════════════════════ */

const PAGE = 60;
const rs = (n) => 'Rs. ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const rs2 = (n) => {
  const v = Number(n) || 0;
  return 'Rs. ' + (Math.abs(v - Math.round(v)) > 0.004 ? v.toLocaleString('en-PK', { maximumFractionDigits: 2 }) : Math.round(v).toLocaleString('en-PK'));
};
const TILE_TONES = [
  'bg-sky-500/12 text-sky-700 dark:text-sky-300', 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
  'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300', 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  'bg-rose-500/12 text-rose-700 dark:text-rose-300', 'bg-teal-500/12 text-teal-700 dark:text-teal-300',
];
const toneOf = (s = '') => TILE_TONES[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % TILE_TONES.length];
const initials = (s = '') => String(s).replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const plural = (word, n) => (Number(n) === 1 ? word : /(s|x|z|ch|sh)$/i.test(word) ? `${word}es` : `${word}s`);

/** Local "YYYY-MM-DD HH:MM:SS" — the format the desktop app stores and filters on. */
function localStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
/** Same invoice number the desktop prints: INV-<year><day-of-year>-<last 6 of id>. */
function invoiceNo(id, d = new Date()) {
  const doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  const s = String(id); return `INV-${d.getFullYear()}${doy}-${s.length > 6 ? s.slice(-6) : s}`;
}

function lineMode(p, wholesaleOn) {
  if (wholesaleOn && Number(p.carton_qty) > 0) return 'wholesale';
  if (p.unit_type === 'gram') return 'gram';
  if (p.unit_type === 'kg') return 'kg';
  return 'unit';
}

function makeLine(p, wholesaleOn) {
  const mode = lineMode(p, wholesaleOn);
  const price = Number(p.price) || 0;
  const cost = Number(p.purchase_price) || 0;
  const base = { key: String(p.id), productId: p.id, name: p.name, mode, stock: Number(p.stock) || 0, unit: p.unit || 'pcs' };
  if (mode === 'wholesale') {
    const cq = Number(p.carton_qty);
    return { ...base, cartonQty: cq, cartons: 1, boxes: 0, qty: cq, unitPrice: price / cq, unitCost: cost / cq,
      boxName: p.box_name || 'box', pieceName: p.piece_name || 'piece', pcsPerBox: Number(p.box_qty) || 0 };
  }
  if (mode === 'gram') return { ...base, qty: 1000, unitPrice: price / 1000, unitCost: cost / 1000 };
  return { ...base, qty: 1, unitPrice: price, unitCost: cost };
}

/* ── Customer picker ──────────────────────────────────────────────────────── */

function CustomerPicker({ customers, value, onChange, onNew }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const selected = customers.find((c) => String(c.id) === String(value));
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? customers.filter((c) => c.name?.toLowerCase().includes(s) || String(c.phone || '').includes(s)) : customers;
    return list.slice(0, 40);
  }, [customers, q]);
  const owes = Number(selected?.outstanding_balance) || 0;

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="w-full flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-left hover:border-foreground/20 transition-colors">
        <span className={cn('h-8 w-8 rounded-full inline-flex items-center justify-center text-[11px] font-semibold shrink-0',
          selected ? toneOf(selected.name) : 'bg-muted text-muted-foreground')}>
          {selected ? initials(selected.name) : <UserRound size={15} />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-foreground truncate">{selected ? selected.name : 'Walk-in customer'}</span>
          <span className={cn('block text-xs truncate', owes > 0.5 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
            {selected ? (owes > 0.5 ? `Already owes ${rs(owes)}` : owes < -0.5 ? `Has ${rs(-owes)} credit` : selected.phone || 'No balance') : 'Tap to choose a customer'}
          </span>
        </span>
        {selected ? (
          <span role="button" tabIndex={0} aria-label="Remove customer" onClick={(e) => { e.stopPropagation(); onChange(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onChange(''); } }}
            className="h-7 w-7 rounded-md inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground">
            <X size={14} />
          </span>
        ) : <ChevronDown size={15} className="text-muted-foreground" />}
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-30 rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or phone"
                className="w-full h-9 rounded-lg bg-muted/60 pl-8 pr-2 text-sm outline-none focus:ring-2 focus:ring-primary/25" />
            </div>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            <li>
              <button type="button" onClick={() => { onChange(''); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted">
                <UserRound size={15} className="text-muted-foreground" /> Walk-in customer
                {!selected && <Check size={14} className="ml-auto text-primary" />}
              </button>
            </li>
            {rows.map((c) => {
              const b = Number(c.outstanding_balance) || 0;
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => { onChange(String(c.id)); setOpen(false); setQ(''); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted">
                    <span className={cn('h-7 w-7 rounded-full inline-flex items-center justify-center text-[10px] font-semibold shrink-0', toneOf(c.name))}>{initials(c.name)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-foreground truncate">{c.name}</span>
                      {c.phone && <span className="block text-[11px] text-muted-foreground tabular-nums">{c.phone}</span>}
                    </span>
                    {b > 0.5 && <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 tabular-nums">{rs(b)}</span>}
                    {String(c.id) === String(value) && <Check size={14} className="text-primary" />}
                  </button>
                </li>
              );
            })}
            {rows.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted-foreground">No customer found</li>}
          </ul>
          <button type="button" onClick={() => { setOpen(false); onNew(); }}
            className="w-full flex items-center gap-2 border-t border-border px-3 py-2.5 text-sm font-medium text-primary hover:bg-muted">
            <Plus size={15} /> New customer
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Cart line ────────────────────────────────────────────────────────────── */

function Stepper({ value, onDec, onInc, onSet, decimal = false, label }) {
  const [draft, setDraft] = useState(null);
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-background">
      <button type="button" onClick={onDec} aria-label={`Less ${label}`} className="h-8 w-8 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"><Minus size={14} /></button>
      <input
        aria-label={label}
        inputMode={decimal ? 'decimal' : 'numeric'}
        value={draft ?? String(value)}
        onFocus={(e) => { setDraft(String(value)); e.target.select(); }}
        onChange={(e) => { const raw = e.target.value.replace(decimal ? /[^0-9.]/g : /\D/g, ''); setDraft(raw); if (raw !== '' && !raw.endsWith('.')) onSet(Number(raw)); }}
        onBlur={() => setDraft(null)}
        className="w-11 h-8 bg-transparent text-center text-sm font-semibold tabular-nums outline-none"
      />
      <button type="button" onClick={onInc} aria-label={`More ${label}`} className="h-8 w-8 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"><Plus size={14} /></button>
    </div>
  );
}

function PriceInput({ value, onChange, suffix }) {
  const [draft, setDraft] = useState(null);
  const shown = Math.round(value * 100) / 100;
  return (
    <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span>@</span>
      <input
        inputMode="decimal"
        value={draft ?? String(shown)}
        onFocus={(e) => { setDraft(String(shown)); e.target.select(); }}
        onChange={(e) => { const raw = e.target.value.replace(/[^0-9.]/g, ''); setDraft(raw); if (raw !== '' && !raw.endsWith('.')) onChange(Number(raw)); }}
        onBlur={() => setDraft(null)}
        className="w-20 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-xs font-medium text-foreground tabular-nums hover:border-border focus:border-primary focus:bg-background outline-none"
        aria-label="Price"
      />
      <span>{suffix}</span>
    </label>
  );
}

function CartLine({ line, onChange, onRemove }) {
  const set = (patch) => onChange(line.key, patch);
  const remaining = line.isCustom ? null : line.stock - line.qty;
  const short = remaining != null && remaining < 0;
  const total = line.unitPrice * line.qty;

  let qtyControl = null;
  let priceSuffix = `/ ${line.unit}`;
  let detail = null;
  if (line.mode === 'wholesale') {
    const cq = line.cartonQty;
    const setParts = (cartons, boxes) => {
      let c = Math.max(0, cartons); let b = Math.max(0, boxes);
      if (b >= cq) { c += Math.floor(b / cq); b %= cq; }
      if (c === 0 && b === 0) return onRemove(line.key);
      set({ cartons: c, boxes: b, qty: c * cq + b });
    };
    priceSuffix = `/ ${line.boxName}`;
    qtyControl = (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium text-muted-foreground w-10">Carton</span>
        <Stepper label="cartons" value={line.cartons} onDec={() => setParts(line.cartons - 1, line.boxes)} onInc={() => setParts(line.cartons + 1, line.boxes)} onSet={(n) => setParts(n, line.boxes)} />
        <span className="text-[11px] font-medium text-muted-foreground w-10 text-right capitalize">{line.boxName}</span>
        <Stepper label={line.boxName} value={line.boxes}
          onDec={() => (line.boxes > 0 ? setParts(line.cartons, line.boxes - 1) : line.cartons > 0 && setParts(line.cartons - 1, cq - 1))}
          onInc={() => setParts(line.cartons, line.boxes + 1)} onSet={(n) => setParts(line.cartons, n)} />
      </div>
    );
    detail = `${line.qty} ${plural(line.boxName, line.qty)} · ${cq} per carton${line.pcsPerBox ? ` · ${line.pcsPerBox} ${line.pieceName}/${line.boxName}` : ''}`;
  } else if (line.mode === 'gram' || line.mode === 'kg') {
    const kg = line.mode === 'gram' ? line.qty / 1000 : line.qty;
    const setKg = (v) => { const n = Math.max(0, Math.round(v * 1000) / 1000); if (n <= 0) return; set({ qty: line.mode === 'gram' ? Math.round(n * 1000) : n }); };
    priceSuffix = line.mode === 'gram' ? '/ g' : '/ kg';
    qtyControl = (
      <div className="flex items-center gap-2">
        <Scale size={13} className="text-muted-foreground" />
        <Stepper label="kilograms" decimal value={Math.round(kg * 1000) / 1000} onDec={() => setKg(kg - 0.25)} onInc={() => setKg(kg + 0.25)} onSet={setKg} />
        <span className="text-xs text-muted-foreground">kg</span>
        <span className="text-[11px] text-muted-foreground">({rs(line.mode === 'gram' ? line.unitPrice * 1000 : line.unitPrice)}/kg)</span>
      </div>
    );
  } else {
    qtyControl = (
      <Stepper label="quantity" value={line.qty}
        onDec={() => (line.qty > 1 ? set({ qty: line.qty - 1 }) : onRemove(line.key))}
        onInc={() => set({ qty: line.qty + 1 })} onSet={(n) => (n > 0 ? set({ qty: n }) : null)} />
    );
  }

  return (
    <li className="group px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">
            {line.name}
            {line.isCustom && <span className="ml-1.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">custom</span>}
          </p>
          <div className="flex flex-wrap items-center gap-x-2">
            <PriceInput value={line.mode === 'gram' ? line.unitPrice * 1000 : line.unitPrice}
              onChange={(v) => set({ unitPrice: line.mode === 'gram' ? v / 1000 : v })}
              suffix={line.mode === 'gram' ? '/ kg' : priceSuffix} />
            {detail && <span className="text-[11px] text-muted-foreground">{detail}</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold tabular-nums text-foreground">{rs2(total)}</p>
          <button type="button" onClick={() => onRemove(line.key)} aria-label={`Remove ${line.name}`}
            className="mt-0.5 text-muted-foreground/60 hover:text-rose-600 transition-colors opacity-70 group-hover:opacity-100">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {qtyControl}
        {short && (
          <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
            Only {line.mode === 'gram' ? `${(line.stock / 1000).toLocaleString('en-PK')} kg` : `${Math.max(0, line.stock)} ${line.mode === 'wholesale' ? plural(line.boxName, Math.max(0, line.stock)) : line.unit}`} in stock
          </span>
        )}
      </div>
    </li>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */

export default function POSPage() {
  const { user } = useAuth();
  const { list, pushBatch, pushEntity, nextId } = useDataStore();
  const { showToast } = useToast();
  const lowAt = useLowStockThreshold();
  const { wholesale: wholesaleOn } = useStoreFeatures();
  const searchRef = useRef(null);

  const products = list('product');
  const customers = list('customer');
  const accounts = list('account');

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [shown, setShown] = useState(PAGE);
  // Products show as a list by default; Settings → Sales screen switches to desktop-style cards.
  const view = usePosView();
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState('fixed');
  const [customerId, setCustomerId] = useState('');
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receiptSale, setReceiptSale] = useState(null);
  const [mobileCart, setMobileCart] = useState(false);

  const categories = useMemo(() => {
    const counts = new Map();
    for (const p of products) if (p.category) counts.set(p.category, (counts.get(p.category) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = category === 'all' ? products : products.filter((p) => (p.category || '') === category);
    if (q) {
      rows = rows.filter((p) => p.name?.toLowerCase().includes(q) || String(p.barcode || '').toLowerCase().includes(q)
        || String(p.barcode2 || '').toLowerCase().includes(q) || String(p.category || '').toLowerCase().includes(q));
      // Exact and prefix matches first
      rows = [...rows].sort((a, b) => {
        const sa = a.name?.toLowerCase().startsWith(q) ? 0 : 1; const sb = b.name?.toLowerCase().startsWith(q) ? 0 : 1;
        return sa - sb || String(a.name).localeCompare(String(b.name));
      });
    }
    return rows;
  }, [products, category, search]);
  useEffect(() => setShown(PAGE), [search, category]);

  const inCart = useMemo(() => new Map(cart.map((l) => [l.key, l])), [cart]);

  const addProduct = useCallback((p) => {
    setCart((prev) => {
      const ex = prev.find((l) => l.key === String(p.id));
      if (!ex) return [...prev, makeLine(p, wholesaleOn)];
      return prev.map((l) => {
        if (l !== ex) return l;
        if (l.mode === 'wholesale') return { ...l, cartons: l.cartons + 1, qty: (l.cartons + 1) * l.cartonQty + l.boxes };
        if (l.mode === 'gram') return { ...l, qty: l.qty + 250 };
        if (l.mode === 'kg') return { ...l, qty: Math.round((l.qty + 0.25) * 1000) / 1000 };
        return { ...l, qty: l.qty + 1 };
      });
    });
    if ((Number(p.stock) || 0) <= 0) showToast(`${p.name} is out of stock — stock will go negative`, 'warning');
  }, [wholesaleOn, showToast]);

  const changeLine = useCallback((key, patch) => setCart((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l))), []);
  const removeLine = useCallback((key) => setCart((prev) => prev.filter((l) => l.key !== key)), []);
  const addCustom = ({ name, unitPrice, qty }) => setCart((prev) => [...prev, {
    key: `custom-${Date.now()}`, isCustom: true, name, mode: 'unit', unit: 'pcs', unitPrice: Number(unitPrice) || 0, unitCost: 0, qty: Number(qty) || 1, stock: Infinity,
  }]);

  const onSearchKey = (e) => {
    if (e.key === 'Escape') { setSearch(''); return; }
    if (e.key !== 'Enter') return;
    const v = search.trim().toLowerCase();
    if (!v) return;
    const byCode = products.find((p) => String(p.barcode || '').toLowerCase() === v || String(p.barcode2 || '').toLowerCase() === v);
    const pick = byCode || (filtered.length === 1 ? filtered[0] : null);
    if (pick) { addProduct(pick); setSearch(''); }
    else showToast(filtered.length ? 'Several products match — tap the one you want' : 'No product with that barcode or name', 'error');
  };

  // Money
  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.unitPrice * l.qty, 0), [cart]);
  const discountAmount = useMemo(() => {
    const raw = Math.max(0, Number(discount) || 0);
    return discountType === 'percent' ? Math.min(subtotal, (subtotal * Math.min(raw, 100)) / 100) : Math.min(raw, subtotal);
  }, [discount, discountType, subtotal]);
  const total = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
  const itemCount = cart.length;

  const resetSale = () => { setCart([]); setDiscount(''); setDiscountType('fixed'); setCustomerId(''); };

  // Keyboard: "/" focuses search, Ctrl+Enter opens checkout
  useEffect(() => {
    const onKey = (e) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      if (e.key === '/' && !typing) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && cart.length) { e.preventDefault(); setCheckoutOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cart.length]);

  const handleConfirmCheckout = async ({ paymentMethod, customerId: cid, amountPaid, dueDate, accountId }) => {
    const nowDate = new Date();
    const now = localStamp(nowDate);
    const saleId = nextId();
    const paid = Math.min(Math.max(0, amountPaid), total);
    const due = Math.max(0, Math.round((total - paid) * 100) / 100);

    const items = cart.map((l) => ({
      id: nextId(),
      sale_id: saleId,
      product_id: l.isCustom ? null : l.productId,
      product_name: l.name,
      quantity: l.qty,
      price: l.unitPrice,
      purchase_price: l.unitCost,
      is_custom: l.isCustom ? 1 : 0,
      date_created: now,
      created_at: now,
      // Desktop column names, so a reprint on the counter PC shows the carton breakdown
      carton_qty: l.cartonQty || 0,
      cartons: l.cartons || 0,
      boxes: l.boxes || 0,
      box_qty: l.pcsPerBox || 0,
      box_name: l.mode === 'wholesale' ? l.boxName : null,
      piece_name: l.mode === 'wholesale' ? l.pieceName : null,
    }));

    const sale = {
      id: saleId,
      customer_id: cid ? Number(cid) : null,
      subtotal: Math.round(subtotal * 100) / 100,
      discount: Math.round(discountAmount * 100) / 100,
      tax: 0,
      total,
      date_created: now,
      payment_method: paymentMethod,
      payment_status: paid >= total ? 'Paid' : paid > 0 ? 'Partial' : 'Pending',
      status: 'Completed',
      notes: '',
      due_amount: due,
      due_date: dueDate || null,
    };

    const events = [
      { entityType: 'sale', operation: 'create', payload: sale },
      ...items.map((p) => ({ entityType: 'sale_item', operation: 'create', payload: p })),
    ];

    // Money actually received goes into the chosen cash/bank account, like the desktop's
    // "Sale payment received" entry — otherwise web sales never show in cash balances.
    if (paid > 0 && accountId) {
      events.push({ entityType: 'account_txn', operation: 'create', payload: {
        id: nextId(), account_id: Number(accountId), type: 'in', amount: paid, category: 'sale',
        note: `Sale payment received — Sale #${saleId}`, date_created: now,
      } });
    }
    if (cid && paid > 0) {
      events.push({ entityType: 'customer_payment', operation: 'create', payload: {
        id: nextId(), customer_id: Number(cid), amount: paid, sale_id: saleId,
        notes: `Payment for Sale #${saleId}`, payment_method: paymentMethod, date_added: now,
      } });
    }
    for (const l of cart) {
      if (l.isCustom) continue;
      const p = products.find((x) => String(x.id) === String(l.productId));
      if (!p) continue;
      const stock = Math.round(((Number(p.stock) || 0) - l.qty) * 1000) / 1000;
      events.push({ entityType: 'product', operation: 'update', payload: { ...p, stock, updated_at: now } });
    }
    if (cid && due > 0.01) {
      const c = customers.find((x) => String(x.id) === String(cid));
      if (c) events.push({ entityType: 'customer', operation: 'update', payload: { ...c, outstanding_balance: (Number(c.outstanding_balance) || 0) + due, updated_at: now } });
    }

    await pushBatch(events);

    const c = cid ? customers.find((x) => String(x.id) === String(cid)) : null;
    setReceiptSale({
      saleId,
      invoiceNo: invoiceNo(saleId, nowDate),
      createdAt: nowDate.toISOString(),
      items: items.map((p, i) => {
        const l = cart[i];
        return {
          product: p.product_id,
          name: p.product_name,
          qty: l.mode === 'gram' ? `${(l.qty / 1000).toLocaleString('en-PK')} kg` : p.quantity,
          price: l.mode === 'gram' ? l.unitPrice * 1000 : p.price,
          lineTotal: p.price * p.quantity,
          cartonQty: p.carton_qty || 0, pieceName: p.box_name || 'box', ws_cartons: p.cartons || 0, ws_boxes: p.boxes || 0,
        };
      }),
      subtotal: sale.subtotal, discount: sale.discount, tax: 0, total,
      paymentMethod, amountPaid: paid, dueAmount: due,
      customerName: c?.name, customerPhone: c?.phone,
    });
    resetSale();
    setMobileCart(false);
  };

  const handleAddCustomer = async (payload) => {
    const now = localStamp();
    const created = await pushEntity('customer', 'create', {
      name: payload.name, phone: payload.phone || '', email: payload.email || '', address: payload.address || '',
      outstanding_balance: 0, created_at: now, updated_at: now,
    });
    if (created?.id != null) setCustomerId(String(created.id));
    showToast('Customer added');
    return created;
  };

  /* ── Order panel (shared by desktop column and mobile sheet) ───────────── */
  const orderPanel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Current sale</h2>
          <p className="text-xs text-muted-foreground">{itemCount ? `${itemCount} item${itemCount === 1 ? '' : 's'}` : 'No items yet'}</p>
        </div>
        {itemCount > 0 && (
          <button type="button" onClick={resetSale} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-rose-600 transition-colors">
            <Trash2 size={13} /> Clear
          </button>
        )}
      </div>
      <div className="px-4 pb-3">
        <CustomerPicker customers={customers} value={customerId} onChange={setCustomerId} onNew={() => setCustomerModalOpen(true)} />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto border-y border-border/70">
        {cart.length === 0 ? (
          <div className="h-full min-h-[180px] flex flex-col items-center justify-center px-6 text-center">
            <span className="h-12 w-12 rounded-full bg-muted inline-flex items-center justify-center mb-3"><ShoppingCart size={20} className="text-muted-foreground" /></span>
            <p className="text-sm font-medium text-foreground">Scan or tap a product</p>
            <p className="text-xs text-muted-foreground mt-1">Items you add appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {cart.map((l) => <CartLine key={l.key} line={l} onChange={changeLine} onRemove={removeLine} />)}
          </ul>
        )}
      </div>

      <div className="px-4 pt-3 pb-4 grid gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground flex-1">Discount</span>
          <div className="relative w-28">
            <input inputMode="decimal" value={discount} placeholder="0"
              onChange={(e) => setDiscount(e.target.value.replace(/[^0-9.]/g, ''))}
              className="w-full h-9 rounded-lg border border-border bg-background px-2.5 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
              aria-label="Discount" />
          </div>
          <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/50">
            {[['fixed', 'Rs'], ['percent', '%']].map(([k, label]) => (
              <button key={k} type="button" onClick={() => setDiscountType(k)}
                className={cn('h-7 w-9 rounded-md text-xs font-semibold transition-colors',
                  discountType === k ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground')}>{label}</button>
            ))}
          </div>
        </div>
        <dl className="grid gap-1 text-sm">
          <div className="flex justify-between text-muted-foreground"><dt>Subtotal</dt><dd className="tabular-nums">{rs2(subtotal)}</dd></div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
              <dt>Discount{discountType === 'percent' ? ` (${Math.min(100, Number(discount) || 0)}%)` : ''}</dt>
              <dd className="tabular-nums">− {rs2(discountAmount)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between pt-2 mt-1 border-t border-border/70">
            <dt className="text-sm font-semibold text-foreground">Total</dt>
            <dd className="text-[28px] leading-none font-bold tabular-nums tracking-tight text-foreground">{rs2(total)}</dd>
          </div>
        </dl>
        <button type="button" disabled={!cart.length} onClick={() => setCheckoutOpen(true)}
          className="h-12 rounded-xl bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:opacity-95 active:scale-[0.99] transition disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed">
          Charge {rs2(total)} <ArrowRight size={17} />
        </button>
        <p className="hidden lg:flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <Keyboard size={12} /> <kbd className="font-sans">/</kbd> search · <kbd className="font-sans">Enter</kbd> add · <kbd className="font-sans">Ctrl</kbd>+<kbd className="font-sans">Enter</kbd> charge
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px] lg:gap-6 lg:h-[calc(100dvh-8.5rem)] pb-24 lg:pb-0">
      {/* ── Products ─────────────────────────────────────────────────────── */}
      <section className="flex min-h-0 min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <ScanBarcode size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              ref={searchRef} autoFocus value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={onSearchKey}
              placeholder="Scan a barcode or search products…"
              className="w-full h-12 rounded-xl border border-border bg-card pl-11 pr-10 text-[15px] outline-none shadow-sm focus:ring-[3px] focus:ring-primary/20 focus:border-primary"
              aria-label="Search products"
            />
            {search && (
              <button type="button" onClick={() => { setSearch(''); searchRef.current?.focus(); }} aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md inline-flex items-center justify-center text-muted-foreground hover:bg-muted"><X size={15} /></button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setCustomOpen(true)}
              className="h-12 px-4 rounded-xl border border-border bg-card text-sm font-medium text-foreground inline-flex items-center gap-2 hover:bg-muted transition-colors">
              <Sparkles size={16} className="text-violet-500" /> Custom item
            </button>
            <Link to="/transactions" className="h-12 w-12 rounded-xl border border-border bg-card inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Transactions" aria-label="Transactions">
              <History size={17} />
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3">
        <div className="flex flex-1 min-w-0 gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {['all', ...categories].map((c) => (
            <button key={c} type="button" onClick={() => setCategory(c)}
              className={cn('h-8 shrink-0 rounded-full px-3.5 text-[13px] font-medium transition-colors border',
                category === c ? 'bg-foreground text-background border-foreground' : 'bg-card text-muted-foreground border-border hover:text-foreground')}>
              {c === 'all' ? `All products` : c}
            </button>
          ))}
        </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden -mx-2 px-2 pt-2 pb-2">
          {filtered.length === 0 ? (
            <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center">
              <Package size={22} className="text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-foreground">No products found</p>
              <p className="text-xs text-muted-foreground mt-1">Try another name or barcode, or add a custom item.</p>
            </div>
          ) : (
            <>
              {(() => {
                const rows = filtered.slice(0, shown).map((p) => {
                  const line = inCart.get(String(p.id));
                  const mode = lineMode(p, wholesaleOn);
                  const st = Number(p.stock) || 0;
                  const cq = Number(p.carton_qty) || 0;
                  const stockText = mode === 'wholesale'
                    ? `${Math.trunc(st / cq)} ctn${st % cq ? ` ${st % cq} ${p.box_name || 'box'}` : ''}`
                    : mode === 'gram' ? `${(st / 1000).toLocaleString('en-PK', { maximumFractionDigits: 2 })} kg` : `${st.toLocaleString('en-PK')} ${mode === 'kg' ? 'kg' : (p.unit || 'pcs')}`;
                  const state = st <= 0 ? 'out' : (mode === 'wholesale' ? st / cq < 3 : st <= lowAt) ? 'low' : 'ok';
                  const perText = mode === 'wholesale' ? 'per carton' : mode === 'gram' || mode === 'kg' ? 'per kg' : `per ${p.unit || 'pc'}`;
                  const inCartText = line ? (line.mode === 'wholesale' ? `${line.cartons} ctn${line.boxes ? ` ${line.boxes}` : ''}` : line.mode === 'gram' ? `${(line.qty / 1000).toLocaleString('en-PK')} kg` : `${line.qty}`) : '';
                  const stockChip = (
                    <span className={cn('text-[11px] font-semibold rounded-md px-1.5 py-0.5 tabular-nums whitespace-nowrap',
                      state === 'out' ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                        : state === 'low' ? 'bg-amber-500/12 text-amber-800 dark:text-amber-400' : 'bg-muted text-muted-foreground')}>
                      {state === 'out' && st >= 0 ? 'Out of stock' : stockText}
                    </span>
                  );
                  return { p, line, stockChip, perText, inCartText };
                });

                if (view === 'cards') return (
                  <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {rows.map(({ p, line, stockChip, perText, inCartText }) => (
                      <li key={p.id}>
                        <button type="button" onClick={() => addProduct(p)}
                          className={cn('relative w-full h-full text-left rounded-xl border bg-card p-3 transition-all hover:-translate-y-px hover:shadow-md active:translate-y-0',
                            line ? 'border-primary/60 ring-1 ring-primary/30' : 'border-border/70 hover:border-foreground/15')}>
                          {line && <span className="absolute -top-1.5 -right-1.5 min-w-6 h-6 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold inline-flex items-center justify-center shadow tabular-nums">{inCartText}</span>}
                          <div className="flex items-start gap-2.5">
                            <span className={cn('h-9 w-9 rounded-lg inline-flex items-center justify-center text-xs font-bold shrink-0', toneOf(p.name))}>{initials(p.name)}</span>
                            <p className="text-[13px] font-medium leading-snug text-foreground line-clamp-2 min-h-[2.5em]">{p.name}</p>
                          </div>
                          <div className="mt-2.5 flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
                            <div>
                              <p className="text-[15px] font-bold tabular-nums text-foreground leading-tight whitespace-nowrap">{rs(p.price)}</p>
                              <p className="text-[10px] text-muted-foreground">{perText}</p>
                            </div>
                            {stockChip}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                );

                return (
                  <div className="rounded-2xl border border-border/70 bg-card overflow-hidden">
                    <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_120px_120px_88px] items-center gap-3 px-4 py-2 border-b border-border/70 bg-muted/40 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                      <span>Product</span><span className="text-right">In stock</span><span className="text-right">Price</span><span className="text-right">Add</span>
                    </div>
                    <ul className="divide-y divide-border/60">
                      {rows.map(({ p, line, stockChip, perText, inCartText }) => (
                        <li key={p.id}>
                          <button type="button" onClick={() => addProduct(p)}
                            className={cn('group w-full grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_120px_120px_88px] items-center gap-3 px-4 py-2.5 text-left transition-colors',
                              line ? 'bg-primary/[0.05] hover:bg-primary/[0.08]' : 'hover:bg-muted/50')}>
                            <span className="flex items-center gap-3 min-w-0">
                              <span className={cn('h-9 w-9 rounded-lg inline-flex items-center justify-center text-[11px] font-bold shrink-0', toneOf(p.name))}>{initials(p.name)}</span>
                              <span className="min-w-0">
                                <span className={cn('block text-sm font-medium truncate', line ? 'text-primary' : 'text-foreground')}>{p.name}</span>
                                <span className="block text-xs text-muted-foreground truncate">
                                  {[p.barcode, p.category].filter(Boolean).join(' · ') || 'No barcode'}
                                  <span className="sm:hidden"> · {rs(p.price)} {perText}</span>
                                </span>
                              </span>
                            </span>
                            <span className="hidden sm:flex justify-end">{stockChip}</span>
                            <span className="hidden sm:block text-right">
                              <span className="block text-sm font-semibold tabular-nums text-foreground whitespace-nowrap">{rs(p.price)}</span>
                              <span className="block text-[11px] text-muted-foreground">{perText}</span>
                            </span>
                            <span className="flex justify-end">
                              {line ? (
                                <span className="h-8 min-w-8 px-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold inline-flex items-center justify-center gap-1 tabular-nums">
                                  <Check size={13} /> {inCartText}
                                </span>
                              ) : (
                                <span className="h-8 w-8 rounded-lg border border-border text-muted-foreground inline-flex items-center justify-center group-hover:border-primary group-hover:text-primary transition-colors">
                                  <Plus size={15} />
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
              {filtered.length > shown && (
                <div className="flex justify-center pt-4">
                  <button type="button" onClick={() => setShown((n) => n + PAGE)}
                    className="h-9 px-4 rounded-lg border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground">
                    Show more · {filtered.length - shown} left
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ── Order (desktop) ──────────────────────────────────────────────── */}
      <aside className="hidden lg:block min-h-0 rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">{orderPanel}</aside>

      {/* ── Order (phones & tablets) ─────────────────────────────────────── */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <button type="button" onClick={() => setMobileCart(true)}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold inline-flex items-center gap-3 px-4">
          <ShoppingCart size={18} />
          <span className="flex-1 text-left">{itemCount ? `${itemCount} item${itemCount === 1 ? '' : 's'}` : 'Cart is empty'}</span>
          <span className="tabular-nums">{rs2(total)}</span>
        </button>
      </div>
      {mobileCart && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Current sale">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileCart(false)} />
          <div className="absolute inset-x-0 bottom-0 top-[8vh] rounded-t-2xl bg-card shadow-2xl flex flex-col">
            <div className="flex justify-center pt-2"><span className="h-1 w-10 rounded-full bg-muted-foreground/30" /></div>
            <button type="button" onClick={() => setMobileCart(false)} aria-label="Close" className="absolute right-3 top-3 h-8 w-8 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:bg-muted"><X size={17} /></button>
            <div className="flex-1 min-h-0">{orderPanel}</div>
          </div>
        </div>
      )}

      <CustomItemModal open={customOpen} onClose={() => setCustomOpen(false)} onAdd={addCustom} />
      <CustomerFormModal open={customerModalOpen} onClose={() => setCustomerModalOpen(false)} onSubmit={handleAddCustomer} />
      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onConfirm={handleConfirmCheckout}
        total={total}
        itemCount={itemCount}
        customers={customers}
        accounts={accounts}
        initialCustomerId={customerId}
        onAddCustomer={() => setCustomerModalOpen(true)}
      />
      <ReceiptModal open={Boolean(receiptSale)} onClose={() => setReceiptSale(null)} sale={receiptSale} businessName={user?.store_name} currency="PKR" />
    </div>
  );
}
