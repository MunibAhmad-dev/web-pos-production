import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Minus, Trash2, ShoppingCart, Sparkles, History, ChevronLeft, ChevronRight, UserCheck, X as XIcon, Package } from 'lucide-react';
import { usePagination } from '../../hooks/usePagination';
import { useAuth } from '../../context/AuthContext';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import Button from '@/components/ui/action-button';
import { Input } from '@/components/form/fields';
import { Switch } from '@/components/ui/switch';
import SearchInput from '@/components/form/search-input';
import CustomItemModal from '@/components/sales/CustomItemModal';
import CheckoutModal from '@/components/sales/CheckoutModal';
import ReceiptModal from '../../components/sales/ReceiptModal';
import CustomerFormModal from '../../components/customers/CustomerFormModal';
import { formatCurrency } from '../../utils/format';
import { useLowStockThreshold } from '../../hooks/useLowStockThreshold';
import { getModuleSettings } from '../../hooks/useModuleSettings';
import { cn } from '@/lib/utils';

const BARCODE_MODE_KEY = 'osatech_barcode_mode';

export default function POSPage() {
  const { user } = useAuth();
  const { list, pushBatch, pushEntity, nextId } = useDataStore();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const currency = 'PKR';
  const LOW_STOCK_THRESHOLD = useLowStockThreshold();

  const products = list('product');
  const customers = list('customer');
  const categoryOptions = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort(),
    [products]
  );

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [barcodeMode, setBarcodeMode] = useState(() => {
    try {
      const stored = localStorage.getItem(BARCODE_MODE_KEY);
      return stored == null ? true : stored === 'true';
    } catch {
      return true;
    }
  });
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customItemModalOpen, setCustomItemModalOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receiptSale, setReceiptSale] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(BARCODE_MODE_KEY, String(barcodeMode));
    } catch {
      /* ignore */
    }
  }, [barcodeMode]);

  const filteredProducts = useMemo(() => {
    let rows = products;
    if (categoryFilter === 'uncategorized') {
      rows = rows.filter((p) => !p.category);
    } else if (categoryFilter !== 'all') {
      rows = rows.filter((p) => p.category === categoryFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (p) => p.name?.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q) || p.barcode2?.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [products, categoryFilter, search]);

  const addToCart = (product) => {
    // Matches the desktop app: stock is never a hard limit — selling into
    // negative stock is allowed, only a warning toast is shown.
    const stock = Number(product.stock || 0);
    const boxQty = wholesaleOn ? (Number(product.box_qty) || 0) : 0;
    // Wholesale price per piece (falls back to retail price if not set)
    const wsPrice = wholesaleOn && Number(product.wholesale_price) > 0
      ? Number(product.wholesale_price)
      : Number(product.price || 0);

    setCart((prev) => {
      const existing = prev.find((i) => i.key === String(product.id));
      if (existing) {
        if (boxQty > 0) {
          // Wholesale product already in cart — increment pieces
          const newPcs = (existing.pcs || 0) + 1;
          const qty = (existing.boxes || 0) * boxQty + newPcs;
          if (qty > stock) showToast(`Only ${stock} in stock — selling into negative`, 'warning');
          return prev.map((i) => i.key === String(product.id) ? { ...i, pcs: newPcs, qty } : i);
        }
        const nextQty = existing.qty + 1;
        if (nextQty > stock) showToast(`Only ${stock} in stock — selling into negative`, 'warning');
        return prev.map((i) => (i.key === String(product.id) ? { ...i, qty: nextQty } : i));
      }
      if (stock <= 0) {
        showToast(`${product.name} has no stock recorded — selling into negative`, 'warning');
      }
      const base = {
        key: String(product.id),
        product: product.id,
        name: product.name,
        unitCost: Number(product.purchase_price || 0),
        stockQty: stock,
      };
      if (boxQty > 0) {
        return [...prev, { ...base, unitPrice: wsPrice, boxQty, boxes: 0, pcs: 1, qty: 1 }];
      }
      return [...prev, { ...base, unitPrice: Number(product.price || 0), qty: 1 }];
    });
  };

  const addCustomItem = ({ name, unitPrice, qty }) => {
    setCart((prev) => [
      ...prev,
      { key: `custom-${Date.now()}`, isCustom: true, name, unitPrice, unitCost: 0, qty, stockQty: Infinity },
    ]);
  };

  const handleBarcodeEnter = (e) => {
    if (e.key !== 'Enter' || !barcodeMode) return;
    const value = search.trim().toLowerCase();
    if (!value) return;
    const match = products.find((p) => p.barcode?.toLowerCase() === value || p.barcode2?.toLowerCase() === value);
    if (match) {
      addToCart(match);
      setSearch('');
    } else {
      showToast('Barcode not found — showing similar products', 'error');
    }
  };

  const updateQty = (key, delta) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.key !== key) return i;
          const nextQty = i.qty + delta;
          if (nextQty > i.stockQty && i.stockQty >= 0) {
            showToast(`Only ${i.stockQty} in stock`, 'warning');
          }
          return { ...i, qty: nextQty };
        })
        .filter((i) => i.qty > 0)
    );
  };

  const removeFromCart = (key) => setCart((prev) => prev.filter((i) => i.key !== key));

  const updateBoxes = (key, delta) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.key !== key || !i.boxQty) return i;
        const newBoxes = Math.max(0, (i.boxes || 0) + delta);
        const pcs = i.pcs || 0;
        const qty = newBoxes * i.boxQty + pcs;
        if (qty > i.stockQty && i.stockQty >= 0) showToast(`Only ${i.stockQty} in stock`, 'warning');
        return { ...i, boxes: newBoxes, qty };
      }).filter((i) => i.qty > 0)
    );
  };

  const updatePcs = (key, delta) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.key !== key || !i.boxQty) return i;
        const newPcs = Math.max(0, (i.pcs || 0) + delta);
        const qty = (i.boxes || 0) * i.boxQty + newPcs;
        if (qty > i.stockQty && i.stockQty >= 0) showToast(`Only ${i.stockQty} in stock`, 'warning');
        return { ...i, pcs: newPcs, qty };
      }).filter((i) => i.qty > 0)
    );
  };

  const subtotal = useMemo(() => cart.reduce((sum, i) => sum + i.unitPrice * i.qty, 0), [cart]);
  const discountAmount = Math.min(Number(discount) || 0, subtotal);
  const total = Math.max(subtotal - discountAmount, 0);

  const selectedCustomer = useMemo(
    () => customers.find((c) => String(c.id) === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const resetCart = () => {
    setCart([]);
    setDiscount('');
    setSelectedCustomerId('');
  };

  const handleConfirmCheckout = async ({ paymentMethod, customerId, amountPaid, dueDate }) => {
    const now = new Date().toISOString();
    const saleId = nextId();
    const dueAmount = Math.max(0, total - amountPaid);

    const saleItemsPayloads = cart.map((item) => ({
      id: nextId(),
      sale_id: saleId,
      product_id: item.isCustom ? null : Number(item.product),
      product_name: item.name,
      quantity: item.qty,
      price: item.unitPrice,
      purchase_price: item.unitCost,
      is_custom: Boolean(item.isCustom),
      created_at: now,
      // Wholesale fields (0 when wholesale module off or non-box product)
      box_qty: item.boxQty || 0,
      boxes: item.boxes || 0,
      pcs: item.boxQty ? (item.pcs || 0) : item.qty,
    }));

    const salePayload = {
      id: saleId,
      customer_id: customerId ? Number(customerId) : null,
      total,
      discount: discountAmount,
      tax: 0,
      subtotal,
      date_created: now,
      payment_method: paymentMethod,
      // Match the Electron status ladder: Paid / Partial / Pending
      payment_status: amountPaid >= total ? 'Paid' : amountPaid > 0 ? 'Partial' : 'Pending',
      status: 'Completed',
      notes: '',
      due_amount: dueAmount,
      due_date: dueDate || null,
    };

    const events = [
      { entityType: 'sale', operation: 'create', payload: salePayload },
      ...saleItemsPayloads.map((p) => ({ entityType: 'sale_item', operation: 'create', payload: p })),
    ];

    // Record the paid portion as a customer_payment — exactly what the Electron
    // create-sale handler does. Without this the customer's ledger never shows
    // what they actually paid (e.g. 100 of 500).
    if (customerId && amountPaid > 0) {
      events.push({
        entityType: 'customer_payment',
        operation: 'create',
        payload: {
          id: nextId(),
          customer_id: Number(customerId),
          amount: amountPaid,
          notes: `Payment for Sale #${saleId}`,
          sale_id: saleId,
          date_added: now,
        },
      });
    }

    for (const item of cart) {
      if (item.isCustom) continue;
      const product = products.find((p) => String(p.id) === String(item.product));
      if (!product) continue;
      const newStock = Number(product.stock || 0) - item.qty;
      events.push({ entityType: 'product', operation: 'update', payload: { ...product, stock: newStock, updated_at: now } });
    }

    // Any unpaid remainder (partial payment or full Udhaar) goes to the
    // customer's credit balance — this applies on ANY payment method, not
    // just Udhaar, matching the desktop's checkout modal.
    if (dueAmount > 0.01 && customerId) {
      const customer = customers.find((c) => String(c.id) === String(customerId));
      if (customer) {
        const newBalance = Number(customer.outstanding_balance || 0) + dueAmount;
        events.push({
          entityType: 'customer',
          operation: 'update',
          payload: { ...customer, outstanding_balance: newBalance, updated_at: now },
        });
      }
    }

    await pushBatch(events);

    const customer = customerId ? customers.find((c) => String(c.id) === String(customerId)) : null;
    setReceiptSale({
      saleId,
      invoiceNo: `INV-${String(saleId).slice(-6)}`,
      createdAt: now,
      items: saleItemsPayloads.map((p) => ({
        product: p.product_id, name: p.product_name,
        qty: p.quantity, price: p.price, lineTotal: p.price * p.quantity,
        boxQty: p.box_qty || 0, boxes: p.boxes || 0, pcs: p.pcs || 0,
      })),
      subtotal,
      discount: discountAmount,
      tax: 0,
      total,
      paymentMethod,
      amountPaid,
      dueAmount,
      customerName: customer?.name,
      customerPhone: customer?.phone,
    });
    resetCart();
  };

  const handleAddCustomer = async (payload) => {
    const now = new Date().toISOString();
    const created = await pushEntity('customer', 'create', {
      name: payload.name,
      phone: payload.phone || '',
      email: payload.email || '',
      address: payload.address || '',
      outstanding_balance: 0,
      created_at: now,
      updated_at: now,
    });
    showToast('Customer added');
    return created;
  };

  const wholesaleOn = getModuleSettings().wholesale_module_enabled;

  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);

  const { paged: pagedProducts, page: posPage, pageCount: posPageCount, setPage: setPosPage } = usePagination(filteredProducts, 50);

  return (
    <div className="flex flex-col gap-4 xl:flex-row relative">
      <div className="min-w-0 flex-1 pb-20 xl:pb-0">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ShoppingCart size={18} />
            </div>
            <div>
              <h2 className="font-heading text-lg font-semibold text-foreground">Point of Sale</h2>
              <p className="text-xs text-muted-foreground">
                {filteredProducts.length} products · {cartCount === 0 ? 'Cart empty' : `${cartCount} item(s) in cart`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/sales/history')}>
              <History size={15} /> History
            </Button>
            <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
              <Switch checked={barcodeMode} onCheckedChange={setBarcodeMode} />
              <span className="text-sm text-muted-foreground">Barcode Mode</span>
            </div>
            <Button variant="secondary" onClick={() => setCustomItemModalOpen(true)}>
              <Sparkles size={15} /> Custom Item
            </Button>
          </div>
        </div>

        <SearchInput
          className="mb-3 h-11"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleBarcodeEnter}
          placeholder={barcodeMode ? 'Scan barcode — Enter auto-adds to cart…' : 'Search by name, category or barcode…'}
        />

        <div className="mb-3 flex gap-2 overflow-x-auto scrollbar-none pb-0.5" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => setCategoryFilter('all')}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              categoryFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            All
          </button>
          <button
            onClick={() => setCategoryFilter('uncategorized')}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              categoryFilter === 'uncategorized' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            None
          </button>
          {categoryOptions.map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                categoryFilter === c ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 border-b border-border bg-muted/40 px-4 py-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <span>Product</span>
            <span className="w-20 text-right">Category</span>
            <span className="w-16 text-right">Stock</span>
            <span className="w-24 text-right">Price</span>
            <span className="w-8" />
          </div>
          <div className="divide-y divide-border">
            {pagedProducts.map((p) => {
              const stock = Number(p.stock || 0);
              const alreadyInCart = cart.find((i) => i.key === String(p.id));
              let stockTone = 'bg-brand-green/10 text-brand-green';
              let stockLabel = String(stock);
              if (stock < 0) {
                stockTone = 'bg-brand-red/15 text-brand-red';
              } else if (stock === 0) {
                stockTone = 'bg-muted text-muted-foreground';
                stockLabel = 'OUT';
              } else if (stock <= LOW_STOCK_THRESHOLD) {
                stockTone = 'bg-brand-orange/10 text-brand-orange';
              }
              return (
                <div
                  key={p.id}
                  onClick={() => addToCart(p)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      addToCart(p);
                    }
                  }}
                  className="grid cursor-pointer grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-4 py-2.5 transition-colors hover:bg-muted/60"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {p.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className={cn('truncate text-sm font-medium', alreadyInCart ? 'text-primary' : 'text-foreground')}>
                        {p.name}
                        {alreadyInCart ? ` ×${alreadyInCart.qty}` : ''}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.barcode || 'No barcode'} · {p.unit || 'pcs'}
                        {wholesaleOn && Number(p.box_qty) > 0 && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 px-1.5 py-px text-[9px] font-bold">
                            <Package size={8} />
                            {p.box_qty}/box
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <span className="w-20 truncate text-right text-xs text-muted-foreground">{p.category || 'none'}</span>
                  <span className={cn('w-16 rounded-full px-2 py-0.5 text-right text-xs font-semibold', stockTone)}>{stockLabel}</span>
                  <span className="w-24 text-right text-sm font-semibold text-foreground">{formatCurrency(p.price, currency)}</span>
                  <div className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Plus size={15} />
                  </div>
                </div>
              );
            })}
            {filteredProducts.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">No products found.</p>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-2">
            <span className="text-xs text-muted-foreground">
              {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
              {posPageCount > 1 && ` · page ${posPage} of ${posPageCount}`}
            </span>
            {posPageCount > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPosPage(p => Math.max(1, p - 1))}
                  disabled={posPage === 1}
                  className="h-7 w-7 rounded-lg border border-border flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors"
                >
                  <ChevronLeft size={13} />
                </button>
                {Array.from({ length: posPageCount }, (_, i) => i + 1)
                  .filter(n => n === 1 || n === posPageCount || Math.abs(n - posPage) <= 1)
                  .reduce((acc, n, i, arr) => {
                    if (i > 0 && n - arr[i - 1] > 1) acc.push('…');
                    acc.push(n);
                    return acc;
                  }, [])
                  .map((n, i) =>
                    n === '…'
                      ? <span key={`ellipsis-${i}`} className="text-xs text-muted-foreground px-1">…</span>
                      : <button
                          key={n}
                          onClick={() => setPosPage(n)}
                          className={`h-7 w-7 rounded-lg text-xs font-medium transition-colors ${
                            n === posPage
                              ? 'bg-primary text-primary-foreground'
                              : 'border border-border hover:bg-muted'
                          }`}
                        >{n}</button>
                  )
                }
                <button
                  onClick={() => setPosPage(p => Math.min(posPageCount, p + 1))}
                  disabled={posPage === posPageCount}
                  className="h-7 w-7 rounded-lg border border-border flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop cart panel — hidden on mobile */}
      <div className="hidden xl:block xl:w-96 shrink-0">
        <div className="sticky top-20 flex flex-col rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <ShoppingCart size={16} className="text-muted-foreground" />
            <h3 className="font-heading text-sm font-semibold text-foreground">Current Order</h3>
          </div>

          {/* Customer row */}
          <div className={cn(
            'flex items-center gap-2 px-4 py-2.5 border-b border-border/60 transition-colors',
            selectedCustomer ? 'bg-emerald-500/5' : 'bg-muted/20'
          )}>
            <UserCheck size={13} className={selectedCustomer ? 'text-emerald-500' : 'text-muted-foreground'} />
            <div className="flex-1 min-w-0">
              {selectedCustomer ? (
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 truncate">{selectedCustomer.name}</p>
              ) : (
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full text-xs bg-transparent border-none outline-none text-muted-foreground cursor-pointer"
                >
                  <option value="">Walk-in Customer</option>
                  {customers.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                </select>
              )}
            </div>
            {selectedCustomer ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] text-muted-foreground font-mono">
                  {Number(selectedCustomer.outstanding_balance || 0) > 0
                    ? `CR: ${Math.round(Number(selectedCustomer.outstanding_balance))}` : ''}
                </span>
                <button onClick={() => setSelectedCustomerId('')} className="p-0.5 rounded text-muted-foreground hover:text-foreground">
                  <XIcon size={12} />
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3" style={{ maxHeight: 340, minHeight: 160 }}>
            {cart.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <ShoppingCart size={22} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">Cart is empty</p>
                <p className="text-xs text-muted-foreground">Tap a product to add it</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {cart.map((item) => (
                  <div key={item.key} className={cn('rounded-lg border p-2.5', item.boxQty ? 'border-sky-200 bg-sky-50/50 dark:border-sky-900/40 dark:bg-sky-950/20' : 'border-transparent')}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.boxQty ? <Package size={11} className="inline mr-1 text-sky-500" /> : null}
                          {item.name}
                          {item.isCustom && <span className="ml-1.5 text-[10px] text-brand-purple">Custom</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(item.unitPrice, currency)}/pc · {formatCurrency(item.unitPrice * item.qty, currency)} total</p>
                      </div>
                      <button onClick={() => removeFromCart(item.key)} className="rounded-md p-1 text-destructive hover:bg-destructive/10 shrink-0">
                        <Trash2 size={12} />
                      </button>
                    </div>
                    {item.boxQty ? (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-sky-600 font-semibold w-6">Box</span>
                        <button onClick={() => updateBoxes(item.key, -1)} className="rounded border border-border w-5 h-5 flex items-center justify-center hover:bg-muted"><Minus size={10} /></button>
                        <span className="w-4 text-center font-bold">{item.boxes}</span>
                        <button onClick={() => updateBoxes(item.key, 1)} className="rounded border border-border w-5 h-5 flex items-center justify-center hover:bg-muted"><Plus size={10} /></button>
                        <span className="text-muted-foreground ml-1 mr-2">×{item.boxQty}</span>
                        <span className="text-muted-foreground font-medium w-6">Pcs</span>
                        <button onClick={() => updatePcs(item.key, -1)} className="rounded border border-border w-5 h-5 flex items-center justify-center hover:bg-muted"><Minus size={10} /></button>
                        <span className="w-4 text-center font-bold">{item.pcs}</span>
                        <button onClick={() => updatePcs(item.key, 1)} className="rounded border border-border w-5 h-5 flex items-center justify-center hover:bg-muted"><Plus size={10} /></button>
                        <span className="ml-auto text-xs text-sky-600 font-bold">{item.qty} pcs</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 justify-end">
                        <button onClick={() => updateQty(item.key, -1)} className="rounded-md border border-border p-1 hover:bg-muted"><Minus size={12} /></button>
                        <span className="w-6 text-center text-sm font-bold">{item.qty}</span>
                        <button onClick={() => updateQty(item.key, 1)} className="rounded-md border border-border p-1 hover:bg-muted"><Plus size={12} /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
            <Input
              label="Discount"
              type="number"
              min="0"
              max={subtotal}
              placeholder="0"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />

            <div className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal, currency)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Discount</span>
                  <span>-{formatCurrency(discountAmount, currency)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1 text-2xl font-black text-primary">
                <span className="text-base font-semibold text-foreground">Total</span>
                <span>{formatCurrency(total, currency)}</span>
              </div>
            </div>

            <Button className="w-full justify-center" disabled={cart.length === 0} onClick={() => setCheckoutOpen(true)}>
              Checkout · {formatCurrency(total, currency)}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile floating cart button — shows below xl */}
      <div className="xl:hidden fixed bottom-4 left-4 right-4 z-40">
        <button
          onClick={() => setCartDrawerOpen(true)}
          className="w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl font-bold text-sm bg-primary text-primary-foreground"
        >
          <ShoppingCart size={18} />
          <span className="flex-1 text-left">View Cart</span>
          {cartCount > 0 && (
            <span className="bg-white/20 text-white text-xs font-black px-2 py-0.5 rounded-full min-w-[22px] text-center">
              {cartCount}
            </span>
          )}
          <span className="opacity-80 tabular-nums text-xs">{formatCurrency(total, currency)}</span>
        </button>
      </div>

      {/* Mobile cart drawer — shows below xl */}
      {cartDrawerOpen && (
        <div className="xl:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCartDrawerOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl shadow-2xl flex flex-col" style={{ maxHeight: '88vh' }}>
            <div className="w-12 h-1 bg-muted-foreground/30 rounded-full mx-auto mt-3 mb-1 shrink-0" />
            {/* Drawer header */}
            <div className="flex items-center gap-2 border-b border-border px-4 py-3 shrink-0">
              <ShoppingCart size={16} className="text-muted-foreground" />
              <h3 className="font-heading text-sm font-semibold text-foreground flex-1">Current Order</h3>
              {cart.length > 0 && (
                <button onClick={() => { resetCart(); setCartDrawerOpen(false); }} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors">
                  <Trash2 size={12} /> Clear
                </button>
              )}
              <button onClick={() => setCartDrawerOpen(false)} className="ml-2 p-1 text-muted-foreground hover:text-foreground">
                <Plus size={16} className="rotate-45" />
              </button>
            </div>
            {/* Items */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                    <ShoppingCart size={22} className="text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Cart is empty</p>
                  <p className="text-xs text-muted-foreground">Tap a product to add it</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {cart.map((item) => (
                    <div key={item.key} className={cn('rounded-lg border p-2.5', item.boxQty ? 'border-sky-200 bg-sky-50/50 dark:border-sky-900/40 dark:bg-sky-950/20' : 'border-border')}>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {item.boxQty ? <Package size={11} className="inline mr-1 text-sky-500" /> : null}
                            {item.name}
                            {item.isCustom && <span className="ml-1.5 text-[10px] text-brand-purple">Custom</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(item.unitPrice, currency)}/pc · {formatCurrency(item.unitPrice * item.qty, currency)}</p>
                        </div>
                        <button onClick={() => removeFromCart(item.key)} className="rounded-md p-1 text-destructive hover:bg-destructive/10 shrink-0">
                          <Trash2 size={12} />
                        </button>
                      </div>
                      {item.boxQty ? (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-sky-600 font-semibold w-6">Box</span>
                          <button onClick={() => updateBoxes(item.key, -1)} className="rounded border border-border w-6 h-6 flex items-center justify-center hover:bg-muted"><Minus size={10} /></button>
                          <span className="w-5 text-center font-bold">{item.boxes}</span>
                          <button onClick={() => updateBoxes(item.key, 1)} className="rounded border border-border w-6 h-6 flex items-center justify-center hover:bg-muted"><Plus size={10} /></button>
                          <span className="text-muted-foreground mr-2">×{item.boxQty}</span>
                          <span className="text-muted-foreground font-medium w-6">Pcs</span>
                          <button onClick={() => updatePcs(item.key, -1)} className="rounded border border-border w-6 h-6 flex items-center justify-center hover:bg-muted"><Minus size={10} /></button>
                          <span className="w-5 text-center font-bold">{item.pcs}</span>
                          <button onClick={() => updatePcs(item.key, 1)} className="rounded border border-border w-6 h-6 flex items-center justify-center hover:bg-muted"><Plus size={10} /></button>
                          <span className="ml-auto font-bold text-sky-600">{item.qty} pcs</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 justify-end">
                          <button onClick={() => updateQty(item.key, -1)} className="rounded-md border border-border p-1.5 hover:bg-muted"><Minus size={13} /></button>
                          <span className="w-7 text-center font-bold">{item.qty}</span>
                          <button onClick={() => updateQty(item.key, 1)} className="rounded-md border border-border p-1.5 hover:bg-muted"><Plus size={13} /></button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Totals + checkout */}
            <div className="flex flex-col gap-3 border-t border-border px-4 py-3 shrink-0">
              <Input
                label="Discount"
                type="number"
                min="0"
                max={subtotal}
                placeholder="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
              <div className="flex flex-col gap-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal, currency)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Discount</span>
                    <span>-{formatCurrency(discountAmount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-1 text-2xl font-black text-primary">
                  <span className="text-base font-semibold text-foreground">Total</span>
                  <span>{formatCurrency(total, currency)}</span>
                </div>
              </div>
              <Button className="w-full justify-center" disabled={cart.length === 0} onClick={() => { setCartDrawerOpen(false); setCheckoutOpen(true); }}>
                Checkout · {formatCurrency(total, currency)}
              </Button>
            </div>
          </div>
        </div>
      )}

      <CustomItemModal open={customItemModalOpen} onClose={() => setCustomItemModalOpen(false)} onAdd={addCustomItem} />
      <CustomerFormModal open={customerModalOpen} onClose={() => setCustomerModalOpen(false)} onSubmit={handleAddCustomer} />
      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onConfirm={handleConfirmCheckout}
        total={total}
        customers={customers}
        initialCustomerId={selectedCustomerId}
        onAddCustomer={() => setCustomerModalOpen(true)}
      />
      <ReceiptModal
        open={Boolean(receiptSale)}
        onClose={() => setReceiptSale(null)}
        sale={receiptSale}
        businessName={user?.store_name}
        currency={currency}
      />
    </div>
  );
}
