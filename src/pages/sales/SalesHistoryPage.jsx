import { useMemo, useState, useCallback } from 'react';
import { Eye, Ban, Pencil, ChevronDown, Clock, Download, FileText, RefreshCw, History } from 'lucide-react';
import { useDataStore } from '../../store/dataStore';
import { WINDOW_DAYS } from '../../store/idb';
import { useToast } from '../../context/ToastContext';
import { Card } from '@/components/ui/panel';
import Table from '@/components/ui/data-table';
import Badge from '@/components/ui/status-badge';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EditSaleModal from '../../components/sales/EditSaleModal';
import { DatePicker } from '@/components/form/date-picker';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { isCancelled, buildCancelSaleEvents } from '@/lib/ledger';

async function exportSalesPDF(sales, customerById, itemsBySale, storeName = 'Store', from = '', to = '') {
  const html2pdf = (await import('html2pdf.js')).default;
  const today = new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
  const dateRange = from && to ? `${from} – ${to}` : from ? `From ${from}` : to ? `To ${to}` : 'All Time';

  const totalRevenue = sales.filter(s => s.status === 'Completed').reduce((sum, s) => sum + Number(s.total || 0), 0);
  const totalDiscount = sales.filter(s => s.status === 'Completed').reduce((sum, s) => sum + Number(s.discount || 0), 0);
  const completedCount = sales.filter(s => s.status === 'Completed').length;

  const rows = sales.map((s, i) => {
    const cust = customerById.get(String(s.customer_id))?.name || 'Walk-in';
    const items = (itemsBySale.get(String(s.id)) || []).length;
    const cancelled = isCancelled(s);
    return `<tr style="border-bottom:1px solid #f3f4f6;${cancelled ? 'opacity:.55' : i % 2 !== 0 ? 'background:#f9fafb' : ''}">
      <td style="padding:7px 8px;font-size:11px;text-align:center;color:#6b7280">${i + 1}</td>
      <td style="padding:7px 8px;font-weight:700;font-size:11px;font-family:monospace">INV-${String(s.id).slice(-6).toUpperCase()}</td>
      <td style="padding:7px 8px;font-size:11px">${cust}</td>
      <td style="padding:7px 8px;font-size:11px;text-align:center">${items}</td>
      <td style="padding:7px 8px;font-size:11px;text-align:right;color:#374151">${Number(s.subtotal || 0).toLocaleString()}</td>
      <td style="padding:7px 8px;font-size:11px;text-align:right;color:#d97706">${Number(s.discount || 0) > 0 ? Number(s.discount).toLocaleString() : '—'}</td>
      <td style="padding:7px 8px;font-size:12px;text-align:right;font-weight:700">${Number(s.total || 0).toLocaleString()}</td>
      <td style="padding:7px 8px;font-size:11px;text-align:center"><span style="padding:2px 6px;border-radius:20px;font-size:9px;font-weight:700;background:${cancelled ? '#fee2e2' : '#d1fae5'};color:${cancelled ? '#dc2626' : '#059669'}">${s.status}</span></td>
      <td style="padding:7px 8px;font-size:10px;color:#6b7280">${new Date(s.date_created || 0).toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'numeric' })}</td>
    </tr>`;
  }).join('');

  const html = `<div style="font-family:Arial,sans-serif;padding:16px;color:#111">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1d4ed8;padding-bottom:12px;margin-bottom:14px">
      <div>
        <h1 style="margin:0;font-size:20px;font-weight:900;color:#1d4ed8">SALES REPORT</h1>
        <p style="margin:4px 0 0;font-size:13px;font-weight:700;color:#374151">${storeName}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#6b7280">Period: ${dateRange}</p>
      </div>
      <div style="text-align:right">
        <p style="margin:0;font-size:12px;color:#6b7280">Exported: <strong>${today}</strong></p>
        <p style="margin:4px 0 0;font-size:11px;color:#6b7280">${sales.length} transactions · ${completedCount} completed</p>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px">
      <div style="background:#dbeafe;border-radius:8px;padding:10px">
        <p style="margin:0;font-size:10px;font-weight:700;color:#1e40af;text-transform:uppercase">Total Revenue</p>
        <p style="margin:4px 0 0;font-size:16px;font-weight:900;color:#1d4ed8">PKR ${Math.round(totalRevenue).toLocaleString()}</p>
      </div>
      <div style="background:#fef3c7;border-radius:8px;padding:10px">
        <p style="margin:0;font-size:10px;font-weight:700;color:#92400e;text-transform:uppercase">Total Discounts</p>
        <p style="margin:4px 0 0;font-size:16px;font-weight:900;color:#d97706">PKR ${Math.round(totalDiscount).toLocaleString()}</p>
      </div>
      <div style="background:#d1fae5;border-radius:8px;padding:10px">
        <p style="margin:0;font-size:10px;font-weight:700;color:#065f46;text-transform:uppercase">Net (After Disc.)</p>
        <p style="margin:4px 0 0;font-size:16px;font-weight:900;color:#059669">PKR ${Math.round(totalRevenue).toLocaleString()}</p>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#1d4ed8;color:#fff">
          <th style="padding:7px 8px;text-align:center;width:25px">#</th>
          <th style="padding:7px 8px;text-align:left">Invoice</th>
          <th style="padding:7px 8px;text-align:left">Customer</th>
          <th style="padding:7px 8px;text-align:center">Items</th>
          <th style="padding:7px 8px;text-align:right">Subtotal</th>
          <th style="padding:7px 8px;text-align:right">Disc.</th>
          <th style="padding:7px 8px;text-align:right">Total (PKR)</th>
          <th style="padding:7px 8px;text-align:center">Status</th>
          <th style="padding:7px 8px;text-align:left">Date</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#f3f4f6;font-weight:900;border-top:2px solid #e5e7eb">
          <td colspan="4" style="padding:8px;text-align:right;font-size:12px">TOTAL (Completed)</td>
          <td colspan="2" style="padding:8px"></td>
          <td style="padding:8px;text-align:right;color:#1d4ed8;font-size:14px">PKR ${Math.round(totalRevenue).toLocaleString()}</td>
          <td colspan="2"></td>
        </tr>
      </tfoot>
    </table>
    <p style="margin-top:14px;font-size:9px;color:#9ca3af;text-align:center">Generated by OsaTech POS · ${today}</p>
  </div>`;

  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);
  const filename = `Sales-Report-${from || 'start'}-to-${to || 'end'}.pdf`;
  await html2pdf().set({
    margin: 8, filename,
    html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
  }).from(el).save();
  document.body.removeChild(el);
}

const statusTone = { Completed: 'green', Cancelled: 'red' };

const StatBlock = ({ label, value, tone = 'text-ink' }) => (
  <div className="rounded-xl border border-border p-4 text-center">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className={`mt-1 text-xl font-semibold ${tone}`}>{value}</p>
  </div>
);

export default function SalesHistoryPage() {
  const { list, get, pushBatch, loadOlderSales } = useDataStore();
  const { showToast } = useToast();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [viewSale, setViewSale] = useState(null);
  const [editSale, setEditSale] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [noMoreOlder, setNoMoreOlder] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  const allSettings = list('settings');
  const storeName = allSettings?.[0]?.store_name || allSettings?.[0]?.business_name || 'My Store';

  const sales = list('sale');
  const saleItems = list('sale_item');
  const saleReturns = list('sale_return');
  const customers = list('customer');
  const products = list('product');
  const customerPayments = list('customer_payment');

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

  const handleLoadOlder = useCallback(async () => {
    const oldest = filteredSales[filteredSales.length - 1];
    if (!oldest?.date_created) return;
    setLoadingOlder(true);
    try {
      const count = await loadOlderSales(oldest.date_created, 100);
      if (count === 0) setNoMoreOlder(true);
    } finally {
      setLoadingOlder(false);
    }
  }, [filteredSales, loadOlderSales]);

  const handleCancelSale = async () => {
    const sale = cancelTarget;
    const items = itemsBySale.get(String(sale.id)) || [];
    setCancelling(true);
    try {
      const now = new Date().toISOString();
      const events = buildCancelSaleEvents({
        sale: get('sale', sale.id) || sale, items, now,
        customer: sale.customer_id != null ? customerById.get(String(sale.customer_id)) : null,
        products, payments: customerPayments, returns: saleReturns, returnItems: list('sale_return_item'),
      });
      if (!events) { showToast('Sale is already cancelled', 'error'); setCancelTarget(null); return; }
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
        payload: { ...product, stock: Number(product.stock || 0) + delta, updated_at: now },
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

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      await exportSalesPDF(filteredSales, customerById, itemsBySale, storeName, from, to);
      showToast('Sales report exported');
    } catch (err) { showToast(err.message || 'Export failed', 'error'); }
    finally { setExportingPDF(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/15"><History size={16} className="text-blue-500" /></div>
            <h2 className="text-lg font-bold text-ink">Sales History</h2>
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 ml-[44px]">
            <Clock size={12} className="shrink-0" />
            Showing last {WINDOW_DAYS} days · use date filter or load older below
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DatePicker label="From" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
          <DatePicker label="To" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" />
          <button onClick={handleExportPDF} disabled={exportingPDF || filteredSales.length === 0}
            className="flex items-center gap-2 h-9 px-4 rounded-xl border border-border bg-background hover:bg-muted text-sm font-semibold transition-colors disabled:opacity-40">
            {exportingPDF ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
            {exportingPDF ? 'Exporting…' : 'Export PDF'}
          </button>
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

      {/* Load older sales from IndexedDB */}
      {!from && !to && (
        <div className="flex flex-col items-center gap-1 py-2">
          {noMoreOlder ? (
            <p className="text-xs text-muted-foreground">All historical sales loaded.</p>
          ) : (
            <button
              onClick={handleLoadOlder}
              disabled={loadingOlder || filteredSales.length === 0}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-40 transition-all"
            >
              <ChevronDown size={13} className={loadingOlder ? 'animate-bounce' : ''} />
              {loadingOlder ? 'Loading older sales…' : 'Load 100 older sales'}
            </button>
          )}
          <p className="text-[10px] text-muted-foreground/60">
            Reads from local cache — no internet needed
          </p>
        </div>
      )}

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
