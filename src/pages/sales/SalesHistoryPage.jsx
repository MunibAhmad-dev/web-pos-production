import { useMemo, useState } from 'react';
import { Eye, Ban, Pencil } from 'lucide-react';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { Card } from '@/components/ui/panel';
import Table from '@/components/ui/data-table';
import Badge from '@/components/ui/status-badge';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EditSaleModal from '../../components/sales/EditSaleModal';
import { DatePicker } from '@/components/form/date-picker';
import { formatCurrency, formatDateTime } from '../../utils/format';

const statusTone = { Completed: 'green', Cancelled: 'red' };

const StatBlock = ({ label, value, tone = 'text-ink' }) => (
  <div className="rounded-xl border border-border p-4 text-center">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className={`mt-1 text-xl font-semibold ${tone}`}>{value}</p>
  </div>
);

export default function SalesHistoryPage() {
  const { list, pushBatch } = useDataStore();
  const { showToast } = useToast();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [viewSale, setViewSale] = useState(null);
  const [editSale, setEditSale] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const sales = list('sale');
  const saleItems = list('sale_item');
  const saleReturns = list('sale_return');
  const customers = list('customer');
  const products = list('product');

  const customerById = useMemo(() => new Map(customers.map((c) => [String(c.id), c])), [customers]);
  const itemsBySale = useMemo(() => {
    const map = new Map();
    for (const item of saleItems) {
      const key = String(item.sale_id);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    return map;
  }, [saleItems]);
  const salesWithReturns = useMemo(() => new Set(saleReturns.map((r) => String(r.sale_id))), [saleReturns]);

  const filteredSales = useMemo(() => {
    return sales
      .filter((s) => {
        if (!s.date_created) return true;
        const d = new Date(s.date_created);
        if (from && d < new Date(from)) return false;
        if (to && d > new Date(new Date(to).getTime() + 86400000)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0));
  }, [sales, from, to]);

  const kpis = useMemo(() => {
    const completed = filteredSales.filter((s) => s.status === 'Completed');
    const revenue = completed.reduce((sum, s) => sum + Number(s.total || 0), 0);
    const discounts = completed.reduce((sum, s) => sum + Number(s.discount || 0), 0);
    const pending = completed.filter((s) => Number(s.due_amount || 0) > 0.01);
    const pendingTotal = pending.reduce((sum, s) => sum + Number(s.due_amount || 0), 0);
    return { completedCount: completed.length, revenue, discounts, pendingCount: pending.length, pendingTotal };
  }, [filteredSales]);

  const handleCancelSale = async () => {
    const sale = cancelTarget;
    const items = itemsBySale.get(String(sale.id)) || [];
    setCancelling(true);
    try {
      const now = new Date().toISOString();
      const events = [{ entityType: 'sale', operation: 'update', payload: { ...sale, status: 'Cancelled', updated_at: now } }];

      for (const item of items) {
        if (item.product_id == null) continue;
        const product = products.find((p) => String(p.id) === String(item.product_id));
        if (!product) continue;
        const newStock = Number(product.stock || 0) + Number(item.quantity || 0);
        events.push({ entityType: 'product', operation: 'update', payload: { ...product, stock: newStock, updated_at: now } });
      }

      // Reverse whatever amount this sale actually added to the customer's
      // credit balance (partial payment applies on any method, not just Udhaar).
      const dueAmount = Number(sale.due_amount || 0);
      if (dueAmount > 0.01 && sale.customer_id != null) {
        const customer = customerById.get(String(sale.customer_id));
        if (customer) {
          const newBalance = Math.max(0, Number(customer.outstanding_balance || 0) - dueAmount);
          events.push({
            entityType: 'customer',
            operation: 'update',
            payload: { ...customer, outstanding_balance: newBalance, updated_at: now },
          });
        }
      }

      await pushBatch(events);
      showToast('Sale cancelled');
      setCancelTarget(null);
    } catch (err) {
      showToast(err.response?.data?.error || 'Unable to cancel sale', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handleSaveEdit = async ({ lines, subtotal, discount, total }) => {
    const sale = editSale;
    const now = new Date().toISOString();
    const originalItems = itemsBySale.get(String(sale.id)) || [];
    const originalById = new Map(originalItems.map((i) => [i.id, i]));
    const keptIds = new Set(lines.filter((l) => l.saleItemId != null).map((l) => l.saleItemId));

    const events = [{ entityType: 'sale', operation: 'update', payload: { ...sale, subtotal, discount, total, edited_at: now } }];

    // Stock deltas: removed/reduced lines restock, new/increased lines destock.
    const stockDelta = new Map();
    for (const orig of originalItems) {
      if (orig.product_id == null) continue;
      if (!keptIds.has(orig.id)) {
        stockDelta.set(orig.product_id, (stockDelta.get(orig.product_id) || 0) + Number(orig.quantity || 0));
        events.push({ entityType: 'sale_item', operation: 'delete', payload: { id: orig.id } });
      }
    }
    for (const line of lines) {
      if (line.product_id == null) continue;
      const original = line.saleItemId != null ? originalById.get(line.saleItemId) : null;
      const oldQty = original ? Number(original.quantity || 0) : 0;
      const delta = oldQty - line.qty;
      if (delta !== 0) stockDelta.set(line.product_id, (stockDelta.get(line.product_id) || 0) + delta);

      const payload = {
        id: line.saleItemId ?? undefined,
        sale_id: sale.id,
        product_id: line.product_id,
        product_name: line.name,
        quantity: line.qty,
        price: line.price,
        purchase_price: line.purchase_price,
        is_custom: line.isCustom,
        created_at: original?.created_at || now,
      };
      events.push({ entityType: 'sale_item', operation: line.saleItemId != null ? 'update' : 'create', payload });
    }

    for (const [productId, delta] of stockDelta.entries()) {
      if (delta === 0) continue;
      const product = products.find((p) => String(p.id) === String(productId));
      if (!product) continue;
      events.push({
        entityType: 'product',
        operation: 'update',
        payload: { ...product, stock: Math.max(0, Number(product.stock || 0) + delta), updated_at: now },
      });
    }

    await pushBatch(events);
    showToast('Sale updated — items and stock have been adjusted');
  };

  const columns = [
    {
      key: 'invoiceNo',
      header: 'Invoice',
      render: (s) => (
        <span className="flex items-center gap-1.5 font-medium text-ink">
          INV-{String(s.id).slice(-6)}
          {s.edited_at && <Badge tone="orange">Edited</Badge>}
        </span>
      ),
    },
    { key: 'customer', header: 'Customer', render: (s) => customerById.get(String(s.customer_id))?.name || 'Walk-in' },
    { key: 'items', header: 'Items', render: (s) => (itemsBySale.get(String(s.id)) || []).length },
    { key: 'payment_method', header: 'Method', render: (s) => <span className="capitalize">{s.payment_method}</span> },
    { key: 'subtotal', header: 'Subtotal', render: (s) => formatCurrency(s.subtotal) },
    { key: 'discount', header: 'Disc.', render: (s) => formatCurrency(s.discount) },
    { key: 'total', header: 'Total', render: (s) => formatCurrency(s.total) },
    { key: 'status', header: 'Status', render: (s) => <Badge tone={statusTone[s.status] || 'gray'}>{s.status}</Badge> },
    { key: 'date_created', header: 'Date', render: (s) => formatDateTime(s.date_created) },
    {
      key: 'actions',
      header: '',
      sortable: false,
      render: (s) => (
        <div className="flex items-center gap-1">
          <button onClick={() => setViewSale(s)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-brand-blue">
            <Eye size={15} />
          </button>
          {s.status === 'Completed' && !salesWithReturns.has(String(s.id)) && (
            <button onClick={() => setEditSale(s)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-brand-blue" title="Edit sale">
              <Pencil size={15} />
            </button>
          )}
          {s.status === 'Completed' && (
            <button
              onClick={() => setCancelTarget(s)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
              title="Cancel sale"
            >
              <Ban size={15} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-lg font-semibold text-ink">Sales History</h2>
          <p className="text-sm text-muted-foreground">All completed sales and receipts.</p>
        </div>
        <div className="flex gap-2">
          <DatePicker label="From" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          <DatePicker label="To" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBlock label="Completed Sales" value={kpis.completedCount} />
        <StatBlock label="Revenue Loaded" value={formatCurrency(kpis.revenue)} tone="text-brand-blue" />
        <StatBlock label="Total Discounts" value={formatCurrency(kpis.discounts)} tone="text-brand-orange" />
        <StatBlock label="Pending Payments" value={`${kpis.pendingCount} · ${formatCurrency(kpis.pendingTotal)}`} tone="text-brand-red" />
      </div>

      <Card className="p-1">
        <Table columns={columns} data={filteredSales} emptyMessage="No sales recorded yet." />
      </Card>

      <Modal open={Boolean(viewSale)} onClose={() => setViewSale(null)} title={viewSale ? `INV-${String(viewSale.id).slice(-6)}` : ''}>
        {viewSale && (
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">
              {formatDateTime(viewSale.date_created)} · {customerById.get(String(viewSale.customer_id))?.name || 'Walk-in'}
            </p>
            <div className="divide-y divide-border border-y border-border">
              {(itemsBySale.get(String(viewSale.id)) || []).map((item) => (
                <div key={item.id} className="flex justify-between py-1.5">
                  <span>
                    {item.product_name} × {item.quantity}
                  </span>
                  <span>{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-semibold text-ink">
              <span>Total</span>
              <span>{formatCurrency(viewSale.total)}</span>
            </div>
            {Number(viewSale.due_amount || 0) > 0.01 && (
              <div className="flex justify-between text-brand-orange">
                <span>Due (Qaraz)</span>
                <span>{formatCurrency(viewSale.due_amount)}</span>
              </div>
            )}
          </div>
        )}
      </Modal>

      <EditSaleModal
        open={Boolean(editSale)}
        onClose={() => setEditSale(null)}
        sale={editSale}
        items={editSale ? itemsBySale.get(String(editSale.id)) || [] : []}
        products={products}
        onSave={handleSaveEdit}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => (cancelling ? null : setCancelTarget(null))}
        onConfirm={handleCancelSale}
        title="Cancel sale"
        description={`This restocks all items from INV-${cancelTarget ? String(cancelTarget.id).slice(-6) : ''} and reverses any credit balance. This cannot be undone.`}
        confirmLabel={cancelling ? 'Cancelling…' : 'Cancel Sale'}
      />
    </div>
  );
}
