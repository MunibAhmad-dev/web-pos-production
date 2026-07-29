import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Package2, Boxes, Search, Plus, Minus, Trash2, X,
  RefreshCw, AlertCircle, ShoppingBag, ChevronRight,
  Building2, Banknote, CreditCard, CheckCircle2, Truck, Hash,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import { mfgGetSellItems, mfgCreatePurchase } from '../../api/manufacturingApi';

const fmt = n =>
  `Rs. ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const PAYMENT_METHODS = [
  { key: 'Cash',          icon: Banknote,   label: 'Cash' },
  { key: 'Credit',        icon: CreditCard, label: 'Credit' },
  { key: 'Bank Transfer', icon: Building2,  label: 'Bank' },
];

export default function ManufacturingBuyStock() {
  const [mode, setMode]       = useState('purchase'); // 'purchase' | 'opening'
  const [tab, setTab]         = useState('parts');
  const [parts, setParts]     = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');

  const [cart, setCart]               = useState([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [form, setForm] = useState({
    vendor_name:    '',
    invoice_number: '',
    payment_method: 'Cash',
    paid_amount:    '',
    transport:      '',
    notes:          '',
  });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await mfgGetSellItems();
      setParts(res.parts || []);
      setProducts(res.products || []);
    } catch (err) {
      setError(err.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const displayItems = useMemo(() => {
    const list = tab === 'parts' ? parts : products;
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(i =>
      i.name.toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q)
    );
  }, [tab, parts, products, search]);

  const subtotal    = cart.reduce((s, i) => s + i.qty * i.unit_cost, 0);
  const transportAmt = Number(form.transport || 0);
  const total       = subtotal + transportAmt;
  const cartCount   = cart.reduce((s, i) => s + i.qty, 0);

  function addToCart(item) {
    const unit_cost = tab === 'parts'
      ? Number(item.cost_price || 0)
      : Number(item.purchase_price || item.price || 0);
    setCart(prev => {
      const key    = `${tab}-${item.id}`;
      const exists = prev.find(c => c._key === key);
      if (exists) return prev.map(c => c._key === key ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, {
        _key:         key,
        id:           item.id,
        name:         item.name,
        type:         tab,
        qty:          1,
        unit_cost,
        unit:         item.unit || 'pc',
        currentStock: Number(item.stock || 0),
      }];
    });
  }

  function updateQty(key, qty) {
    if (qty < 1) { removeItem(key); return; }
    setCart(prev => prev.map(c => c._key === key ? { ...c, qty } : c));
  }

  function updateCost(key, cost) {
    setCart(prev => prev.map(c => c._key === key ? { ...c, unit_cost: Number(cost) || 0 } : c));
  }

  function removeItem(key) {
    setCart(prev => prev.filter(c => c._key !== key));
  }

  function clearCart() { setCart([]); }

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
      paid_amount:    method === 'Credit' ? '0' : String(total),
    }));
  }

  async function handleProcess() {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const stockUpdates = cart.map(item => {
        const sourceList = item.type === 'parts' ? parts : products;
        const full       = sourceList.find(p => String(p.id) === String(item.id));
        if (!full) return null;
        return {
          entity_type: item.type === 'parts' ? 'part' : 'product',
          payload:     { ...full, stock: Number(full.stock || 0) + item.qty },
        };
      }).filter(Boolean);

      if (mode === 'opening') {
        await mfgCreatePurchase(null, stockUpdates);
      } else {
        const paidAmt = Number(form.paid_amount || 0);
        const status  = paidAmt >= total ? 'Completed' : paidAmt > 0 ? 'Partial' : 'Due';
        await mfgCreatePurchase({
          created_at:     new Date().toISOString(),
          vendor_name:    form.vendor_name.trim(),
          vendor_id:      null,
          invoice_number: form.invoice_number.trim(),
          subtotal,
          discount:       0,
          transport:      transportAmt,
          total,
          paid_amount:    paidAmt,
          payment_method: form.payment_method,
          status,
          items_count:    cart.length,
          notes:          form.notes.trim(),
          source:         'web',
        }, stockUpdates);
      }

      // Optimistically update local stock state
      const newStockMap = new Map(stockUpdates.map(u => [String(u.payload.id), u.payload.stock]));
      setParts(prev    => prev.map(p    => newStockMap.has(String(p.id))    ? { ...p,    stock: newStockMap.get(String(p.id)) }    : p));
      setProducts(prev => prev.map(p    => newStockMap.has(String(p.id))    ? { ...p,    stock: newStockMap.get(String(p.id)) }    : p));

      toast.success(mode === 'opening' ? 'Stock added successfully!' : 'Purchase recorded successfully!');
      setCheckoutOpen(false);
      clearCart();
      setForm({ vendor_name: '', invoice_number: '', payment_method: 'Cash', paid_amount: '', transport: '', notes: '' });
    } catch (err) {
      toast.error(err.message || 'Failed to process');
    } finally {
      setSubmitting(false);
    }
  }

  /* ─── Status badge helper ─── */
  function PaymentStatus() {
    const paid = Number(form.paid_amount || 0);
    if (form.payment_method === 'Credit' || paid === 0)
      return <p className="text-xs text-red-600 mt-1">Status: <strong>Due</strong></p>;
    if (paid < total)
      return <p className="text-xs text-amber-600 mt-1">Status: <strong>Partial</strong> — Rs. {Math.round(total - paid).toLocaleString()} outstanding</p>;
    return <p className="text-xs text-green-600 mt-1">Status: <strong>Completed</strong></p>;
  }

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">

      {/* ─── Left panel ─── */}
      <div className="flex-1 flex flex-col overflow-hidden border-r">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
          <div>
            <h1 className="text-xl font-bold">Buy Stock</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {loading
                ? 'Loading…'
                : `${(tab === 'parts' ? parts : products).length} ${tab === 'parts' ? 'parts' : 'products'} · ${
                    cart.length === 0 ? 'Cart empty' : `${cartCount} item${cartCount !== 1 ? 's' : ''} added`
                  }`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={fetchItems} disabled={loading}>
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </Button>
            {/* Mode toggle */}
            <div className="flex rounded-lg border overflow-hidden text-xs font-semibold">
              <button
                onClick={() => setMode('purchase')}
                className={`px-3 py-2 transition-colors ${
                  mode === 'purchase'
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                New Purchase
              </button>
              <button
                onClick={() => setMode('opening')}
                className={`px-3 py-2 border-l transition-colors ${
                  mode === 'opening'
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Already Purchased / Opening Stock
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 border-b bg-background">
          {[
            { key: 'parts',    label: 'Raw Parts',         icon: Boxes },
            { key: 'products', label: 'Assembled Coolers',  icon: Package2 },
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
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-5 py-3 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={tab === 'parts' ? 'Search parts to buy…' : 'Search assembled coolers…'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-400">
            <AlertCircle size={13} />
            {error}
            <Button size="sm" variant="ghost" className="ml-auto h-5 px-2 text-xs text-red-700" onClick={fetchItems}>
              Retry
            </Button>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 border-b animate-pulse">
                  <div className="h-3 flex-1 rounded bg-muted" />
                  <div className="h-3 w-20 rounded bg-muted" />
                  <div className="h-3 w-16 rounded bg-muted" />
                  <div className="h-8 w-8 rounded-full bg-muted" />
                </div>
              ))}
            </div>
          ) : displayItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground text-sm">
              {tab === 'parts' ? <Boxes size={28} className="opacity-30" /> : <Package2 size={28} className="opacity-30" />}
              {search
                ? `No results for "${search}"`
                : 'No items synced yet from the desktop app'}
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-muted/50 backdrop-blur-sm border-b">
                <tr>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-6 py-2.5">
                    {tab === 'parts' ? 'Part' : 'Product'}
                  </th>
                  <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2.5">
                    In Stock
                  </th>
                  <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2.5">
                    Cost
                  </th>
                  <th className="w-16 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {displayItems.map(item => {
                  const cost  = tab === 'parts'
                    ? Number(item.cost_price || 0)
                    : Number(item.purchase_price || item.price || 0);
                  const inCart = !!cart.find(c => c._key === `${tab}-${item.id}`);
                  return (
                    <tr
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-3.5">
                        <p className="text-sm font-medium">{item.name}</p>
                        {item.category && (
                          <p className="text-xs text-muted-foreground">{item.category}</p>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <span className="text-sm font-semibold">
                          {item.stock ?? 0}{' '}
                          <span className="text-xs text-muted-foreground font-normal">
                            {item.unit || 'pcs'}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <span className="text-sm font-semibold text-indigo-600 tabular-nums">
                          {cost > 0 ? fmt(cost) : '—'}
                        </span>
                      </td>
                      <td className="pr-5 py-3.5 text-right">
                        <button
                          onClick={e => { e.stopPropagation(); addToCart(item); }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                            inCart
                              ? 'bg-indigo-600 text-white'
                              : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 hover:bg-indigo-600 hover:text-white'
                          }`}
                        >
                          <Plus size={16} />
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

      {/* ─── Right panel (cart) ─── */}
      <div className="w-80 xl:w-96 flex flex-col bg-background shrink-0">

        {/* Cart header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b shrink-0">
          <ShoppingBag size={16} className="text-muted-foreground" />
          <span className="font-semibold text-sm">Incoming Stock</span>
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
              <ShoppingBag size={36} strokeWidth={1.2} />
              <div>
                <p className="text-sm font-medium">Cart is empty</p>
                <p className="text-xs mt-0.5">Click a part to add it</p>
              </div>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {cart.map(item => (
                <div key={item._key} className="rounded-lg border bg-card p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium flex-1 min-w-0 truncate">{item.name}</p>
                    <button
                      onClick={() => removeItem(item._key)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  {/* Qty + unit cost */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQty(item._key, item.qty - 1)}
                        className="w-6 h-6 rounded border flex items-center justify-center text-muted-foreground hover:bg-muted"
                      >
                        <Minus size={10} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={e => updateQty(item._key, Math.max(1, Number(e.target.value) || 1))}
                        className="w-10 text-center text-sm font-bold bg-transparent border-0 focus:outline-none"
                      />
                      <button
                        onClick={() => updateQty(item._key, item.qty + 1)}
                        className="w-6 h-6 rounded border flex items-center justify-center text-muted-foreground hover:bg-muted"
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                    <span className="text-xs text-muted-foreground">{item.unit} ×</span>
                    <div className="flex-1 flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Rs.</span>
                      <input
                        type="number"
                        min="0"
                        value={item.unit_cost}
                        onChange={e => updateCost(item._key, e.target.value)}
                        className="w-full text-sm font-semibold bg-transparent border-0 focus:outline-none text-indigo-600"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Line total</span>
                    <span className="font-bold tabular-nums">{fmt(item.qty * item.unit_cost)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom totals + CTA */}
        <div className="border-t p-4 shrink-0 space-y-3">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{fmt(subtotal)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-black tabular-nums text-indigo-600">{fmt(total)}</span>
          </div>
          <Button
            className="w-full h-11 text-sm font-bold gap-2"
            style={cart.length > 0 ? { background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' } : {}}
            disabled={cart.length === 0}
            onClick={openCheckout}
          >
            <ChevronRight size={16} />
            {mode === 'opening' ? 'Add to Stock' : 'Process Purchase'}
          </Button>
        </div>
      </div>

      {/* ─── Checkout dialog ─── */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag size={18} className="text-indigo-500" />
              {mode === 'opening' ? 'Add to Stock' : 'Process Purchase'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Summary */}
            <div className="rounded-lg bg-muted/40 px-4 py-3 space-y-1">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{cartCount} item{cartCount !== 1 ? 's' : ''}</span>
                <span className="tabular-nums">{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-1.5 mt-1.5">
                <span>Total</span>
                <span className="text-indigo-600 tabular-nums">{fmt(total)}</span>
              </div>
            </div>

            {mode === 'purchase' ? (
              <>
                {/* Vendor + invoice */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <Truck size={11} /> Vendor Name
                    </Label>
                    <Input
                      placeholder="Optional"
                      value={form.vendor_name}
                      onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <Hash size={11} /> Invoice #
                    </Label>
                    <Input
                      placeholder="Optional"
                      value={form.invoice_number}
                      onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                {/* Transport */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Transport Cost (Rs.)</Label>
                  <Input
                    type="number" min="0" placeholder="0"
                    value={form.transport}
                    onChange={e => setForm(f => ({ ...f, transport: e.target.value }))}
                    className="h-9 text-sm"
                  />
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
                    type="number" min="0" placeholder={String(total)}
                    value={form.paid_amount}
                    onChange={e => setForm(f => ({ ...f, paid_amount: e.target.value }))}
                    className="h-9 text-sm"
                  />
                  <PaymentStatus />
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
              </>
            ) : (
              /* Opening stock — just a note */
              <div className="space-y-1.5">
                <Label className="text-xs">Note (optional)</Label>
                <Input
                  placeholder="e.g. Opening stock, purchased offline…"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="h-9 text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Stock levels will be incremented without creating a purchase invoice.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCheckoutOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleProcess}
              disabled={submitting || cart.length === 0}
              className="gap-2"
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}
            >
              {submitting ? (
                <><RefreshCw size={13} className="animate-spin" /> Processing…</>
              ) : (
                <><CheckCircle2 size={14} /> {mode === 'opening' ? 'Add to Stock' : 'Confirm Purchase'}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
