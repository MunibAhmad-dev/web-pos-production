import React, { useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Search, RefreshCw, FolderTree, X,
  Calendar, Truck, AlertTriangle, ArrowUpDown, PlusCircle, MinusCircle,
  Info, ChevronRight, BarChart3, Layers,
  TrendingDown, ShieldCheck, History, Warehouse, FileText, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { useLowStockThreshold } from '../../hooks/useLowStockThreshold';
import { formatCurrency } from '../../utils/format';

// ─── Shadcn primitives (direct imports — same as desktop) ───────────────────
import { Button } from '../../../src/components/ui/button';
import { Input } from '../../../src/components/ui/input';
import { Badge } from '../../../src/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../src/components/ui/select';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtPKR = (n) => formatCurrency(n);

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.4, delay: i * 0.06, ease: [0.23, 1, 0.32, 1] }
  }),
};

const SPARKLINE_PATH = 'M0,14 L8,10 L16,16 L24,6 L32,12 L40,4 L48,10 L56,2';
function Sparkline({ color }) {
  return (
    <svg width="56" height="20" viewBox="0 0 56 20" fill="none" className="shrink-0">
      <path d={SPARKLINE_PATH} stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatCard({ icon: Icon, label, value, sub, tint }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', tint.bg)}>
          <Icon size={18} className={tint.icon} />
        </div>
        <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-muted-foreground">{sub}</p>
        <Sparkline color={tint.spark} />
      </div>
    </div>
  );
}

// ─── Stock Report Modal — client-side filtering from in-memory store ─────────
function StockReportModal({ initialSearch, threshold, onClose, onSelectProduct, allProducts }) {
  const [status, setStatus] = useState('low');
  const [search, setSearch] = useState(initialSearch);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allProducts.filter((p) => {
      const stock = Number(p.stock || 0);
      const matchStatus = status === 'out' ? stock <= 0 : (stock > 0 && stock < threshold);
      if (!matchStatus) return false;
      if (!q) return true;
      return (
        (p.name || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q)
      );
    });
  }, [allProducts, status, search, threshold]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative bg-background border border-border rounded-2xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <FileText size={16} className="text-amber-500" />
            </div>
            <div>
              <p className="font-bold text-sm">Stock Report</p>
              <p className="text-[11px] text-muted-foreground">{rows.length.toLocaleString()} item{rows.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pt-4 pb-3 border-b border-border/40 shrink-0 space-y-3">
          <div className="flex gap-1 p-1 rounded-xl bg-muted/60 border border-border/40 w-fit">
            {['low', 'out'].map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all',
                  status === s ? 'bg-background text-foreground shadow-sm border border-border/60' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {s === 'low' ? <AlertTriangle size={13} className="text-amber-500" /> : <TrendingDown size={13} className="text-red-500" />}
                {s === 'low' ? 'Low Stock' : 'Out of Stock'}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, category or barcode..."
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              {status === 'low' ? <AlertTriangle size={28} className="opacity-30" /> : <TrendingDown size={28} className="opacity-30" />}
              <p className="text-sm">No {status === 'low' ? 'low-stock' : 'out-of-stock'} items{search ? ` matching "${search}"` : ''}.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {rows.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onSelectProduct(p); onClose(); }}
                  className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{p.category || 'Uncategorized'}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs font-mono shrink-0 ml-3',
                      Number(p.stock) <= 0 ? 'border-red-500/40 bg-red-500/10 text-red-600' : 'border-amber-500/40 bg-amber-500/10 text-amber-600'
                    )}
                  >
                    {p.stock ?? 0} {p.unit || ''}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const { list, pushEntity } = useDataStore();
  const { showToast } = useToast();
  const threshold = useLowStockThreshold();

  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [showStockReport, setShowStockReport] = useState(false);

  // Product detail drawer state
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeTab, setActiveTab] = useState('batches');

  // Adjustment modal state
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [adjustmentQty, setAdjustmentQty] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('Wastage');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState(false);

  const searchDebounceRef = useRef(null);

  // ── Data from in-memory store ──────────────────────────────────────────────
  const allProducts = list('product');
  const allBatches = list('inventory_batch');
  const allAdjustments = list('stock_adjustment');

  // ── Derived stats ──────────────────────────────────────────────────────────
  const prodStats = useMemo(() => {
    const lowStock = allProducts.filter((p) => Number(p.stock || 0) > 0 && Number(p.stock || 0) < threshold).length;
    const outOfStock = allProducts.filter((p) => Number(p.stock || 0) <= 0).length;
    const totalStock = allProducts.reduce((sum, p) => sum + Number(p.stock || 0), 0);
    return { lowStock, outOfStock, totalStock };
  }, [allProducts, threshold]);

  // ── Per-product drawer data ────────────────────────────────────────────────
  const batches = useMemo(() => {
    if (!selectedProduct) return [];
    return allBatches
      .filter((b) => String(b.product_id) === String(selectedProduct.id))
      .filter((b) => Number(b.quantity_remaining || 0) > 0)
      .sort((a, b) => new Date(a.date_added || 0) - new Date(b.date_added || 0));
  }, [allBatches, selectedProduct]);

  const adjustments = useMemo(() => {
    if (!selectedProduct) return [];
    return allAdjustments
      .filter((a) => String(a.product_id) === String(selectedProduct.id))
      .sort((a, b) => new Date(b.date_created || b.created_at || 0) - new Date(a.date_created || a.created_at || 0));
  }, [allAdjustments, selectedProduct]);

  const damagedCount = useMemo(() => adjustments.filter((a) => Number(a.quantity) < 0).length, [adjustments]);
  const damagedUnits = useMemo(
    () => adjustments.reduce((sum, a) => sum + (Number(a.quantity) < 0 ? Math.abs(Number(a.quantity) || 0) : 0), 0),
    [adjustments]
  );

  // ── Filtered + sorted products ─────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let items = q
      ? allProducts.filter(
          (p) =>
            (p.name || '').toLowerCase().includes(q) ||
            (p.category || '').toLowerCase().includes(q) ||
            (p.barcode || '').toLowerCase().includes(q)
        )
      : [...allProducts];

    if (sortBy === 'name') items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (sortBy === 'stockAsc') items.sort((a, b) => (a.stock || 0) - (b.stock || 0));
    if (sortBy === 'stockDesc') items.sort((a, b) => (b.stock || 0) - (a.stock || 0));
    return items;
  }, [allProducts, searchTerm, sortBy]);

  const lowStockItems = filteredProducts.filter((p) => (p.stock || 0) < threshold && (p.stock || 0) > 0);

  const categories = useMemo(() => [...new Set(filteredProducts.map((p) => p.category).filter(Boolean))], [filteredProducts]);
  const byCategory = useMemo(() => {
    const groups = categories.map((cat) => ({
      name: cat,
      items: filteredProducts.filter((p) => p.category === cat),
    }));
    const uncategorized = filteredProducts.filter((p) => !p.category);
    if (uncategorized.length) groups.push({ name: 'Uncategorized', items: uncategorized });
    return groups;
  }, [categories, filteredProducts]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSearch = (v) => {
    setIsSearching(true);
    setSearchTerm(v);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setIsSearching(false), 200);
  };

  const openProduct = (p) => {
    setSelectedProduct(p);
    setActiveTab('batches');
  };

  const handleAdjustmentSubmit = async () => {
    if (
      !selectedProduct ||
      !adjustmentQty ||
      isNaN(Number(adjustmentQty)) ||
      Number(adjustmentQty) === 0
    ) {
      showToast('Please enter a valid quantity', 'warning');
      return;
    }

    setIsSubmittingAdjustment(true);
    try {
      const qty =
        adjustmentType === 'Wastage' || adjustmentType === 'Theft'
          ? -Math.abs(Number(adjustmentQty))
          : Number(adjustmentQty);

      const now = new Date().toISOString();
      const newStock = Math.max(0, Number(selectedProduct.stock || 0) + qty);

      await pushEntity('stock_adjustment', 'create', {
        product_id: selectedProduct.id,
        quantity: qty,
        type: adjustmentType,
        reason: adjustmentReason,
        date_created: now,
        created_at: now,
      });

      await pushEntity('product', 'update', {
        ...selectedProduct,
        stock: newStock,
        updated_at: now,
      });

      // Refresh the selected product reference with updated stock
      setSelectedProduct((prev) => (prev ? { ...prev, stock: newStock } : prev));

      showToast('Stock adjusted successfully', 'success');
      setAdjustmentModalOpen(false);
      setAdjustmentQty('');
      setAdjustmentReason('');
    } catch (err) {
      showToast('Failed to adjust stock', 'error');
    } finally {
      setIsSubmittingAdjustment(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-6 max-w-[1600px] h-full relative">
      {/* ── Main Panel ── */}
      <div className={`flex-1 transition-all duration-300 ${selectedProduct ? 'hidden md:flex md:w-1/2 lg:w-2/3' : 'w-full'}`}>
        <div className="flex flex-col gap-6 w-full pb-20">

          {/* ── Page Header ── */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                <span>Home</span>
                <ChevronRight size={12} />
                <span className="text-foreground font-medium">Inventory</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Inventory</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Track and manage your stock in real-time</p>
            </div>
          </motion.div>

          {/* ── KPI Strip ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}>
              <StatCard
                icon={Warehouse} label="Total Products" value={allProducts.length.toLocaleString()}
                sub="All products"
                tint={{ icon: 'text-blue-500', bg: 'bg-blue-500/10', spark: '#3b82f6' }}
              />
            </motion.div>
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
              <StatCard
                icon={AlertTriangle} label="Low Stock" value={prodStats.lowStock.toLocaleString()}
                sub="Below threshold"
                tint={{ icon: 'text-amber-500', bg: 'bg-amber-500/10', spark: '#f59e0b' }}
              />
            </motion.div>
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3}>
              <StatCard
                icon={TrendingDown} label="Out of Stock" value={prodStats.outOfStock.toLocaleString()}
                sub="Unavailable"
                tint={{ icon: 'text-red-500', bg: 'bg-red-500/10', spark: '#ef4444' }}
              />
            </motion.div>
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4}>
              <StatCard
                icon={BarChart3} label="In Stock" value={prodStats.totalStock.toLocaleString()}
                sub="Total units"
                tint={{ icon: 'text-emerald-500', bg: 'bg-emerald-500/10', spark: '#10b981' }}
              />
            </motion.div>
          </div>

          {/* ── Low Stock Alert Banner ── */}
          <AnimatePresence>
            {lowStockItems.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 flex items-start gap-4 shadow-sm"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertTriangle size={18} className="text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                    Low Stock Alert — {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} below threshold ({threshold} units)
                  </h3>
                  <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1 mb-3">
                    The following products need restocking soon.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {lowStockItems.slice(0, 15).map((p) => (
                      <Badge
                        key={p.id}
                        variant="outline"
                        className="border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 cursor-pointer hover:border-amber-400 transition-colors"
                        onClick={() => openProduct(p)}
                      >
                        {p.name}: <span className="font-bold ml-1">{p.stock || 0}</span>
                      </Badge>
                    ))}
                    {lowStockItems.length > 15 && (
                      <Badge variant="outline" className="border-amber-400/40 text-amber-600">
                        +{lowStockItems.length - 15} more
                      </Badge>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Search & Sort ── */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
            className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-border/40 bg-muted/20 flex items-center gap-2">
              <BarChart3 size={15} className="text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Browse Inventory</span>
            </div>
            <div className="p-5">
              <div className="flex flex-col md:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input
                    type="text"
                    placeholder="Search products by name or category..."
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10 pr-9 h-11 text-base shadow-sm bg-background w-full rounded-xl border-border/60"
                  />
                  {isSearching && (
                    <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                </div>
                <div className="shrink-0 flex items-center bg-background rounded-xl border border-border/60 h-11 px-2 shadow-sm">
                  <ArrowUpDown size={14} className="text-muted-foreground ml-2 mr-1" />
                  <Select value={sortBy} onValueChange={(val) => setSortBy(val)}>
                    <SelectTrigger className="w-[190px] border-none shadow-none focus:ring-0 h-9">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Sort by Name (A-Z)</SelectItem>
                      <SelectItem value="stockAsc">Lowest Stock First</SelectItem>
                      <SelectItem value="stockDesc">Highest Stock First</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" className="h-11 gap-2 shrink-0" onClick={() => setShowStockReport(true)}>
                  <FileText size={15} /> View Stock Report
                </Button>
              </div>

              {/* ── Search Results ── */}
              {searchTerm ? (
                <div className="rounded-xl border border-border/50 overflow-hidden shadow-sm">
                  {/* Header */}
                  <div className="px-5 py-3 bg-muted/30 border-b border-border/40 grid grid-cols-12 gap-4">
                    <span className="col-span-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Product Name</span>
                    <span className="col-span-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</span>
                    <span className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Stock</span>
                    <span className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Price</span>
                  </div>
                  {filteredProducts.length === 0 ? (
                    <div className="py-16 text-center text-muted-foreground text-sm">
                      No products found matching &ldquo;{searchTerm}&rdquo;.
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {filteredProducts.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => openProduct(p)}
                          className={cn(
                            'grid grid-cols-12 gap-4 px-5 py-3.5 cursor-pointer transition-colors hover:bg-muted/30',
                            selectedProduct?.id === p.id && 'bg-primary/5 border-l-2 border-l-primary'
                          )}
                        >
                          <span className="col-span-5 font-semibold text-sm text-foreground truncate">{p.name}</span>
                          <span className="col-span-3">
                            {p.category
                              ? <Badge variant="secondary" className="font-mono text-[10px] uppercase">{p.category}</Badge>
                              : <span className="text-muted-foreground text-sm">—</span>
                            }
                          </span>
                          <span className="col-span-2 text-right">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px]',
                                (p.stock || 0) === 0 && 'border-red-500/50 bg-red-500/10 text-red-600',
                                (p.stock || 0) > 0 && (p.stock || 0) < threshold && 'border-amber-500/50 bg-amber-500/10 text-amber-600',
                                (p.stock || 0) >= threshold && 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600'
                              )}
                            >
                              {p.stock || 0}
                            </Badge>
                          </span>
                          <span className="col-span-2 text-right font-semibold text-primary text-sm">{fmtPKR(p.price)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* ── Category Groups ── */
                <div className="space-y-4">
                  {byCategory.map((group, gi) => (
                    <motion.div
                      key={group.name}
                      variants={fadeUp}
                      initial="hidden"
                      animate="visible"
                      custom={gi}
                      className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden hover:border-border transition-colors"
                    >
                      {/* Category header */}
                      <div className="px-5 py-4 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                            <FolderTree size={14} className="text-primary" />
                          </div>
                          <span className="text-[15px] font-bold text-foreground">{group.name}</span>
                        </div>
                        <Badge variant="outline" className="bg-background border-border/60 text-muted-foreground text-xs">
                          {group.items.length} items
                        </Badge>
                      </div>

                      {/* Product grid */}
                      <div className="p-5">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                          {group.items.map((p) => {
                            const stockQty = p.stock || 0;
                            const isOut = stockQty === 0;
                            const isLow = !isOut && stockQty < threshold;
                            const isGood = stockQty >= threshold;
                            return (
                              <div
                                key={p.id}
                                onClick={() => openProduct(p)}
                                className={cn(
                                  'group flex flex-col justify-between border rounded-xl p-4 transition-all cursor-pointer',
                                  selectedProduct?.id === p.id
                                    ? 'border-primary ring-1 ring-primary/30 bg-primary/5'
                                    : 'bg-card border-border/60 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5'
                                )}
                              >
                                <p className="font-semibold text-sm line-clamp-2 text-foreground/90 group-hover:text-primary transition-colors leading-snug">
                                  {p.name}
                                </p>
                                <div className="mt-3 pt-3 border-t border-border/40 flex flex-col gap-1.5">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[11px] text-muted-foreground">Price</span>
                                    <span className="text-primary font-bold text-sm tracking-tight">{fmtPKR(p.price)}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-[11px] text-muted-foreground">Stock</span>
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        'text-[10px] h-4 py-0 px-1.5',
                                        isOut && 'border-red-500/40 bg-red-500/10 text-red-600',
                                        isLow && 'border-amber-500/40 bg-amber-500/10 text-amber-600',
                                        isGood && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                                      )}
                                    >
                                      {stockQty}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {byCategory.length === 0 && (
                    <div className="py-16 text-center text-muted-foreground text-sm">No products in your inventory yet.</div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Stock Detail Drawer ── */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 32 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="flex flex-col w-full md:w-1/2 lg:w-1/3 absolute md:relative right-0 h-[calc(100vh-100px)] rounded-2xl border border-border/50 shadow-2xl z-10 bg-background/95 backdrop-blur-md overflow-hidden"
          >
            {/* Drawer header */}
            <div
              className="relative p-5 pb-4 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #0f172a 100%)' }}
            >
              <div className="pointer-events-none absolute -top-8 -right-8 w-40 h-40 rounded-full bg-cyan-500/10 blur-2xl" />
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute right-4 top-4 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <X size={15} className="text-white" />
              </button>
              <div className="flex items-start gap-3 pr-8">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Package size={17} className="text-cyan-300" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-white font-bold text-base leading-snug line-clamp-2">{selectedProduct.name}</h2>
                  <p className="text-white/50 text-xs mt-0.5">Inventory batch history (FIFO)</p>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-0 border-b border-border/40 flex-shrink-0">
              <div className="p-4 border-r border-border/40">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Current Stock</p>
                <p className="text-2xl font-bold text-foreground">{selectedProduct.stock || 0}</p>
                <p className="text-xs text-muted-foreground">units</p>
              </div>
              <div className="p-4">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Selling Price</p>
                <p className="text-xl font-bold text-primary">{fmtPKR(selectedProduct.price)}</p>
              </div>
            </div>

            {/* Damaged row */}
            <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between bg-rose-500/5 flex-shrink-0">
              <div className="flex items-center gap-2">
                <TrendingDown size={14} className="text-rose-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Returned / Damaged</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-none text-[10px]">{damagedCount} entries</Badge>
                <Badge className="bg-rose-600 text-white border-none text-[10px]">-{damagedUnits} units</Badge>
              </div>
            </div>

            {/* Adjust button */}
            <div className="px-4 py-3 border-b border-border/40 flex-shrink-0">
              <Button
                className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white h-9 rounded-xl text-sm font-semibold"
                onClick={() => {
                  setAdjustmentType('Wastage');
                  setAdjustmentQty('');
                  setAdjustmentReason('');
                  setAdjustmentModalOpen(true);
                }}
              >
                <AlertTriangle size={15} /> Adjust / Fix Stock
              </Button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border/40 bg-muted/10 flex-shrink-0">
              <button
                onClick={() => setActiveTab('batches')}
                className={cn(
                  'flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-1.5',
                  activeTab === 'batches'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-background'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <Layers size={12} /> Batches ({batches.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={cn(
                  'flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-1.5',
                  activeTab === 'history'
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-background'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <History size={12} /> History ({adjustments.length})
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'batches' ? (
                <div className="p-4 pb-20 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Package size={14} className="text-muted-foreground" />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Available Batches</span>
                  </div>
                  {batches.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-10 text-center border border-dashed border-border/60 rounded-xl">
                      No stock batches available for this product.
                    </div>
                  ) : (
                    batches.map((b, i) => (
                      <div key={b.id} className="rounded-xl border border-border/50 bg-card p-4 shadow-sm relative overflow-hidden hover:border-border transition-colors">
                        {i === 0 && (
                          <div className="absolute right-0 top-0 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold px-2.5 py-1 rounded-bl-lg border-l border-b border-emerald-500/20">
                            NEXT (FIFO)
                          </div>
                        )}
                        <div className="flex justify-between items-start mb-3 mt-0.5 pr-16">
                          <span className="font-bold text-sm text-foreground">{b.quantity_remaining} units</span>
                          <Badge variant="outline" className="font-mono text-[11px] border-border/60">{fmtPKR(b.purchase_price)}/unit</Badge>
                        </div>
                        <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar size={11} className="flex-shrink-0" />
                            Added: {new Date(b.date_added).toLocaleDateString()}
                          </div>
                          {b.vendor_name && (
                            <div className="flex items-center gap-2">
                              <Truck size={11} className="flex-shrink-0" />
                              Vendor: {b.vendor_name}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="p-4 pb-20 space-y-3">
                  {adjustments.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-10 text-center border border-dashed border-border/60 rounded-xl">
                      No adjustment history found.
                    </div>
                  ) : (
                    adjustments.map((adj) => (
                      <div
                        key={adj.id}
                        className={cn(
                          'relative pl-4 border-l-2 transition-colors rounded-r-lg pr-3 py-2',
                          adj.quantity < 0 ? 'border-red-400 hover:border-red-500' : 'border-blue-400 hover:border-blue-500'
                        )}
                      >
                        <div className={cn(
                          'absolute -left-[5px] top-3 h-2.5 w-2.5 rounded-full border-2 border-background',
                          adj.quantity < 0 ? 'bg-red-500' : 'bg-blue-500'
                        )} />
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-bold text-foreground">{adj.type}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(adj.date_created || adj.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={cn('text-sm font-black', adj.quantity < 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400')}>
                            {adj.quantity > 0 ? '+' : ''}{adj.quantity} units
                          </span>
                          {adj.quantity < 0 && (
                            <Badge className="bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-none text-[9px] h-4">
                              Returned / Damaged
                            </Badge>
                          )}
                        </div>
                        {adj.reason && (
                          <div className="bg-muted/40 rounded-lg px-2.5 py-1.5 text-xs italic text-muted-foreground">
                            &ldquo;{adj.reason}&rdquo;
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Adjustment Modal ── */}
      <AnimatePresence>
        {adjustmentModalOpen && selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="w-full max-w-md rounded-2xl border border-border/50 shadow-2xl overflow-hidden bg-background"
            >
              {/* Modal header */}
              <div
                className="relative p-6 overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #92400e 0%, #b45309 50%, #78350f 100%)' }}
              >
                <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full bg-amber-300/10 blur-2xl" />
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                        <AlertTriangle size={18} className="text-amber-200" />
                      </div>
                      <h2 className="text-xl font-bold text-white">Stock Adjustment</h2>
                    </div>
                    <p className="text-amber-200/70 text-sm ml-12">{selectedProduct.name}</p>
                  </div>
                  <button
                    onClick={() => setAdjustmentModalOpen(false)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  >
                    <X size={16} className="text-white" />
                  </button>
                </div>
              </div>

              {/* Modal body */}
              <div className="p-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Adjustment Type</label>
                  <Select value={adjustmentType} onValueChange={setAdjustmentType}>
                    <SelectTrigger className="w-full border-amber-200/60 rounded-xl h-11">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Wastage">Wastage / Damage (-)</SelectItem>
                      <SelectItem value="Theft">Theft / Loss (-)</SelectItem>
                      <SelectItem value="Correction">Manual Correction (+/-)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Quantity</label>
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="0"
                      className="pl-11 h-12 text-lg font-bold border-amber-200/60 rounded-xl"
                      value={adjustmentQty}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (adjustmentType === 'Correction') {
                          if (/^-?\d*$/.test(raw)) setAdjustmentQty(raw);
                        } else {
                          setAdjustmentQty(raw.replace(/[^0-9]/g, ''));
                        }
                      }}
                    />
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-600">
                      {(adjustmentType === 'Wastage' || adjustmentType === 'Theft') ? <MinusCircle size={20} /> : <PlusCircle size={20} />}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Info size={11} />
                    {adjustmentType === 'Wastage' || adjustmentType === 'Theft'
                      ? 'This quantity will be subtracted from total stock.'
                      : 'Use +number to add stock or -number to reduce stock.'}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Reason / Note</label>
                  <Input
                    placeholder="e.g. Expired on shelf, Found broken..."
                    className="rounded-xl border-amber-100/60 bg-muted/20 h-11"
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                  />
                </div>

                <div className="flex gap-3 pt-2 border-t border-border/40">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl h-11"
                    onClick={() => setAdjustmentModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 gap-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-11 font-semibold"
                    onClick={handleAdjustmentSubmit}
                    disabled={isSubmittingAdjustment || !adjustmentQty}
                  >
                    {isSubmittingAdjustment
                      ? <RefreshCw className="animate-spin" size={15} />
                      : <ShieldCheck size={15} />
                    }
                    Confirm Adjustment
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stock Report Modal ── */}
      {showStockReport && (
        <StockReportModal
          initialSearch={searchTerm}
          threshold={threshold}
          onClose={() => setShowStockReport(false)}
          onSelectProduct={openProduct}
          allProducts={allProducts}
        />
      )}
    </div>
  );
}
