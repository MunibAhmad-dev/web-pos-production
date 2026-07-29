import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ShoppingCart, Search, Plus, Minus, Trash2, History,
  RefreshCw, AlertCircle, Package2, Boxes, X, ChevronRight,
  User, Phone, CreditCard, Banknote, Building2, CheckCircle2,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import { useMfgAuth } from '../../context/ManufacturingAuthContext';
import { mfgGetSellItems, mfgCreateSale } from '../../api/manufacturingApi';

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = n => `Rs. ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function stockBadge(stock, threshold) {
  if (stock <= 0)         return { label: 'Out of Stock',  cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' };
  if (stock <= threshold) return { label: 'Low Stock',     cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
  return                         { label: `In Stock`,      cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
}

const PAYMENT_METHODS = [
  { key: 'Cash',          icon: Banknote,   label: 'Cash' },
  { key: 'Credit',        icon: CreditCard, label: 'Credit' },
  { key: 'Bank Transfer', icon: Building2,  label: 'Bank' },
];

// ── main component ────────────────────────────────────────────────────────────
export default function ManufacturingSell() {
  const { mfgUser }  = useMfgAuth();
  const navigate     = useNavigate();

  // ── data state ──────────────────────────────────────────────────────────────
  const [products, setProducts] = useState([]);
  const [parts,    setParts]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [tab,      setTab]      = useState('products'); // 'products' | 'parts'
  const [search,   setSearch]   = useState('');

  // ── cart state ───────────────────────────────────────────────────────────────
  const [cart,     setCart]     = useState([]); // [{ id, name, type, price, qty, unit }]
  const [discount, setDiscount] = useState('');
  const [tax,      setTax]      = useState('');

  // ── checkout dialog ──────────────────────────────────────────────────────────
  const [checkoutOpen, setCheckoutOpen]   = useState(false);
  const [submitting,   setSubmitting]     = useState(false);
  const [form, setForm] = useState({
    customer_name:  '',
    customer_phone: '',
    payment_method: 'Cash',
    paid_amount:    '',
    notes:          '',
  });

  // ── derived ──────────────────────────────────────────────────────────────────
  const subtotal    = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discountAmt = Math.min(Number(discount || 0), subtotal);
  const taxAmt      = Number(tax || 0);
  const total       = Math.max(0, subtotal - discountAmt + taxAmt);
  const cartCount   = cart.reduce((s, i) => s + i.qty, 0);

  const displayItems = useMemo(() => {
    const list = tab === 'products' ? products : parts;
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(i => i.name.toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q));
  }, [tab, products, parts, search]);

  // ── fetch ────────────────────────────────────────────────────────────────────
  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await mfgGetSellItems();
      setProducts(res.products || []);
      setParts(res.parts    || []);
    } catch (err) {
      setError(err.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // ── cart actions ─────────────────────────────────────────────────────────────
  function addToCart(item) {
    const price = tab === 'products' ? (item.price || 0) : (item.cost_price || 0);
    setCart(prev => {
      const key = `${tab}-${item.id}`;
      const exists = prev.find(c => c._key === key);
      if (exists) return prev.map(c => c._key === key ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { _key: key, id: item.id, name: item.name, type: tab, price, qty: 1, unit: item.unit || 'pc' }];
    });
  }

  function setQty(key, qty) {
    if (qty < 1) { removeItem(key); return; }
    setCart(prev => prev.map(c => c._key === key ? { ...c, qty } : c));
  }

  function removeItem(key) {
    setCart(prev => prev.filter(c => c._key !== key));
  }

  function clearCart() {
    setCart([]);
    setDiscount('');
    setTax('');
  }

  // ── open checkout ────────────────────────────────────────────────────────────
  function openCheckout() {
    setForm(f => ({
      ...f,
      paid_amount: f.payment_method === 'Credit' ? '0' : String(total),
    }));
    setCheckoutOpen(true);
  }

  function handleMethodChange(method) {
    setForm(f => ({
      ...f,
      payment_method: method,
      paid_amount: method === 'Credit' ? '0' : String(total),
    }));
  }

  // ── submit sale ──────────────────────────────────────────────────────────────
  async function handleCheckout() {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const paidAmt  = Number(form.paid_amount || 0);
      const status   = paidAmt >= total ? 'Completed' : paidAmt > 0 ? 'Partial' : 'Due';

      await mfgCreateSale({
        created_at:     new Date().toISOString(),
        customer_name:  form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        customer_address: '',
        subtotal,
        discount:       discountAmt,
        tax:            taxAmt,
        total,
        paid_amount:    paidAmt,
        payment_method: form.payment_method,
        status,
        items_count:    cart.length,
        note:           form.notes.trim(),
        source:         'web',
      });

      toast.success('Sale recorded successfully!');
      setCheckoutOpen(false);
      clearCart();
      setForm({ customer_name: '', customer_phone: '', payment_method: 'Cash', paid_amount: '', notes: '' });
    } catch (err) {
      toast.error(err.message || 'Failed to record sale');
    } finally {
      setSubmitting(false);
    }
  }

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">

      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden border-r">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
          <div>
            <h1 className="text-xl font-bold">Point of Sale</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {loading ? 'Loading…' : `${products.length} products · ${cart.length === 0 ? 'Cart empty' : `${cartCount} item${cartCount !== 1 ? 's' : ''} in cart`}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={fetchItems} disabled={loading}>
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => navigate('/manufacturing/invoices')}>
              <History size={13} /> Sales History
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 border-b bg-background">
          {[
            { key: 'products', label: 'Air Coolers',  icon: Package2 },
            { key: 'parts',    label: 'Loose Parts',  icon: Boxes },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSearch(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-5 py-3 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={tab === 'products' ? 'Search air coolers…' : 'Search parts…'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-400">
            <AlertCircle size={13} /> {error}
            <Button size="sm" variant="ghost" className="ml-auto h-5 px-2 text-xs text-red-700" onClick={fetchItems}>Retry</Button>
          </div>
        )}

        {/* Product table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-0">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 border-b animate-pulse">
                  <div className="h-3 flex-1 rounded bg-muted" />
                  <div className="h-5 w-20 rounded-full bg-muted" />
                  <div className="h-3 w-16 rounded bg-muted" />
                  <div className="h-7 w-7 rounded-full bg-muted" />
                </div>
              ))}
            </div>
          ) : displayItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
              {tab === 'products' ? <Package2 size={28} className="opacity-30" /> : <Boxes size={28} className="opacity-30" />}
              {search ? `No results for "${search}"` : 'No items synced yet'}
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-muted/50 backdrop-blur-sm border-b">
                <tr>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-6 py-2.5">
                    {tab === 'products' ? 'Air Cooler' : 'Part'}
                  </th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2.5">Stock</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2.5">Price</th>
                  <th className="w-12 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {displayItems.map(item => {
                  const badge = stockBadge(item.stock, item.low_stock_threshold);
                  const price = tab === 'products' ? item.price : item.cost_price;
                  const inCart = cart.find(c => c._key === `${tab}-${item.id}`);
                  return (
                    <tr
                      key={item.id}
                      className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => addToCart(item)}
                    >
                      <td className="px-6 py-3.5">
                        <p className="text-sm font-medium">{item.name}</p>
                        {item.category && <p className="text-xs text-muted-foreground">{item.category}</p>}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
                          {badge.label}
                          {item.stock > 0 && <span className="opacity-70">· {item.stock} {item.unit}</span>}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <span className={`text-sm font-semibold tabular-nums ${price > 0 ? 'text-indigo-600' : 'text-muted-foreground'}`}>
                          {price > 0 ? fmt(price) : '—'}
                        </span>
                      </td>
                      <td className="pr-5 py-3.5 text-right">
                        <button
                          onClick={e => { e.stopPropagation(); addToCart(item); }}
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                            inCart
                              ? 'bg-indigo-600 text-white'
                              : 'bg-muted hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-muted-foreground hover:text-indigo-600'
                          }`}
                        >
                          <Plus size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Right panel: Current Order ──────────────────────────────────────── */}
      <div className="w-80 xl:w-96 flex flex-col bg-background shrink-0">

        {/* Cart header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b shrink-0">
          <ShoppingCart size={16} className="text-muted-foreground" />
          <span className="font-semibold text-sm">Current Order</span>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 size={12} /> Clear
            </button>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground px-6 text-center">
              <ShoppingCart size={36} strokeWidth={1.2} />
              <div>
                <p className="text-sm font-medium">Cart is empty</p>
                <p className="text-xs mt-0.5">Click a product to add it</p>
              </div>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {cart.map(item => (
                <div key={item._key} className="rounded-lg border bg-card p-3 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{fmt(item.price)} / {item.unit}</p>
                    </div>
                    <button onClick={() => removeItem(item._key)} className="text-muted-foreground hover:text-destructive shrink-0 mt-0.5">
                      <X size={13} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setQty(item._key, item.qty - 1)}
                        className="w-6 h-6 rounded-full border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                      >
                        <Minus size={11} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={e => setQty(item._key, Math.max(1, Number(e.target.value) || 1))}
                        className="w-10 text-center text-sm font-semibold bg-transparent border-0 focus:outline-none"
                      />
                      <button
                        onClick={() => setQty(item._key, item.qty + 1)}
                        className="w-6 h-6 rounded-full border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                    <p className="text-sm font-bold tabular-nums text-indigo-600">{fmt(item.price * item.qty)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals + checkout */}
        <div className="border-t p-4 shrink-0 space-y-3">
          {/* Discount & Tax */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Discount (Rs.)</Label>
              <Input
                type="number" min="0" placeholder="0"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                className="h-8 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Tax (Rs.)</Label>
              <Input
                type="number" min="0" placeholder="0"
                value={tax}
                onChange={e => setTax(e.target.value)}
                className="h-8 text-sm mt-1"
              />
            </div>
          </div>

          {/* Summary lines */}
          <div className="space-y-1.5 py-2 border-t border-dashed">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{fmt(subtotal)}</span>
            </div>
            {discountAmt > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span className="tabular-nums">- {fmt(discountAmt)}</span>
              </div>
            )}
            {taxAmt > 0 && (
              <div className="flex justify-between text-sm text-amber-600">
                <span>Tax</span>
                <span className="tabular-nums">+ {fmt(taxAmt)}</span>
              </div>
            )}
          </div>

          {/* Total */}
          <div className="flex justify-between items-center">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-black tabular-nums text-indigo-600">{fmt(total)}</span>
          </div>

          {/* Checkout button */}
          <Button
            className="w-full h-11 text-sm font-bold gap-2"
            style={{ background: cart.length === 0 ? undefined : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}
            disabled={cart.length === 0}
            onClick={openCheckout}
          >
            <ChevronRight size={16} /> Checkout
          </Button>
        </div>
      </div>

      {/* ── Checkout dialog ─────────────────────────────────────────────────── */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart size={18} className="text-indigo-500" /> Confirm Sale
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">

            {/* Order summary */}
            <div className="rounded-lg bg-muted/40 px-4 py-3 space-y-1">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{cartCount} item{cartCount !== 1 ? 's' : ''}</span>
                <span>{fmt(subtotal)}</span>
              </div>
              {discountAmt > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span><span>- {fmt(discountAmt)}</span>
                </div>
              )}
              {taxAmt > 0 && (
                <div className="flex justify-between text-sm text-amber-600">
                  <span>Tax</span><span>+ {fmt(taxAmt)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t pt-1.5 mt-1.5">
                <span>Total</span>
                <span className="text-indigo-600 tabular-nums">{fmt(total)}</span>
              </div>
            </div>

            {/* Customer info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5"><User size={11} /> Customer Name</Label>
                <Input
                  placeholder="Optional"
                  value={form.customer_name}
                  onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5"><Phone size={11} /> Phone</Label>
                <Input
                  placeholder="Optional"
                  value={form.customer_phone}
                  onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Payment method */}
            <div className="space-y-1.5">
              <Label className="text-xs">Payment Method</Label>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.key}
                    onClick={() => handleMethodChange(m.key)}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-semibold transition-colors ${
                      form.payment_method === m.key
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                        : 'text-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    <m.icon size={16} />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount paid */}
            <div className="space-y-1.5">
              <Label className="text-xs">Amount Paid (Rs.)</Label>
              <Input
                type="number"
                min="0"
                placeholder={String(total)}
                value={form.paid_amount}
                onChange={e => setForm(f => ({ ...f, paid_amount: e.target.value }))}
                className="h-9 text-sm tabular-nums"
              />
              {/* Status preview */}
              {(() => {
                const paid = Number(form.paid_amount || 0);
                if (form.payment_method === 'Credit' || paid === 0) {
                  return <p className="text-xs text-red-600">Status: <strong>Due</strong> — full amount owed</p>;
                }
                if (paid < total) {
                  return <p className="text-xs text-amber-600">Status: <strong>Partial</strong> — Rs. {Math.round(total - paid).toLocaleString()} still due</p>;
                }
                return <p className="text-xs text-green-600">Status: <strong>Completed</strong></p>;
              })()}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs">Note (optional)</Label>
              <Input
                placeholder="Any note…"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCheckoutOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleCheckout}
              disabled={submitting || cart.length === 0}
              className="gap-2"
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}
            >
              {submitting ? (
                <><RefreshCw size={13} className="animate-spin" /> Saving…</>
              ) : (
                <><CheckCircle2 size={14} /> Confirm Sale</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
