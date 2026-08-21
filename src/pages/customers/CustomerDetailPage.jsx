import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  X, Phone, Mail, MapPin, CreditCard, Receipt, Undo2, History,
  MessageCircle, ChevronDown, ChevronRight, Plus, Printer,
  Trash2, Check, Clock, FileText, TrendingUp, Package, ArrowLeft,
  CheckCircle2, Eye, Tag, CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { getReceiptSettings, printInvoice, buildWhatsAppLink } from '../../utils/receipt';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtPKR = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtDateShort = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }) : '—';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const GRADIENTS = ['from-purple-500 to-indigo-500', 'from-pink-500 to-rose-500', 'from-amber-500 to-orange-500', 'from-emerald-500 to-teal-500', 'from-blue-500 to-cyan-500'];
const getGrad = (name = '') => GRADIENTS[name.charCodeAt(0) % GRADIENTS.length];

function saleStatus(sale) {
  if (sale.status === 'Cancelled') return { label: 'Cancelled', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' };
  if (sale.remaining <= 0.5) return { label: 'Paid', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' };
  if (sale.amountPaid <= 0) return { label: 'Unpaid', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400' };
  return { label: 'Partial', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' };
}

function EmptyState({ icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
      <div className="text-muted-foreground/20">{icon}</div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

const SALES_PER_PAGE = 10;

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { list, pushEntity, pushBatch } = useDataStore();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [tab, setTab] = useState('invoices');
  const [salesPage, setSalesPage] = useState(1);
  const [payAmounts, setPayAmounts] = useState({});
  const [payNotesBySale, setPayNotesBySale] = useState({});
  const [expandedSaleId, setExpandedSaleId] = useState(null);

  const customer = list('customer').find((c) => String(c.id) === String(id));
  const allSales = list('sale');
  const allSaleItems = list('sale_item');
  const allPayments = list('customer_payment');
  const allReturns = list('sale_return');
  const allReturnItems = list('sale_return_item');

  const data = useMemo(() => {
    if (!customer) return null;
    const cid = String(customer.id);
    const custSales = allSales
      .filter((s) => String(s.customer_id) === cid)
      .sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0));

    const saleIds = new Set(custSales.map((s) => String(s.id)));
    const custPayments = allPayments.filter((p) => String(p.customer_id) === cid)
      .sort((a, b) => new Date(b.date_added || 0) - new Date(a.date_added || 0));
    const custReturns = allReturns.filter((r) => saleIds.has(String(r.sale_id)))
      .sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0));

    const totalTaken = custSales.filter((s) => s.status !== 'Cancelled').reduce((s, sale) => s + Number(sale.total || 0), 0);
    const totalPaid = custPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalReturned = custReturns.reduce((s, r) => s + Number(r.total_returned || 0), 0);
    const balance = Math.max(0, totalTaken - totalPaid - totalReturned);

    const enhancedSales = custSales.map((sale) => {
      const items = allSaleItems.filter((i) => String(i.sale_id) === String(sale.id));
      const linkedPayments = custPayments.filter((p) => String(p.sale_id) === String(sale.id));
      const linkedReturns = custReturns.filter((r) => String(r.sale_id) === String(sale.id));
      const amountPaid = linkedPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
      const amountReturned = linkedReturns.reduce((s, r) => s + Number(r.total_returned || 0), 0);
      const remaining = Math.max(0, Number(sale.total || 0) - amountPaid - amountReturned);
      return { ...sale, items, linkedPayments, linkedReturns, amountPaid, amountReturned, remaining };
    });

    const activity = [
      ...custSales.map((s) => ({ type: 'SALE', date: s.date_created, notes: `Sale — ${fmtPKR(s.total)}`, amount: Number(s.total || 0), id: s.id })),
      ...custPayments.map((p) => ({ type: 'PAYMENT_ADDED', date: p.date_added, notes: `Payment received — ${fmtPKR(p.amount)}`, amount: Number(p.amount || 0), id: p.id })),
      ...custReturns.map((r) => ({ type: 'RETURN', date: r.date_created, notes: `Return — ${fmtPKR(r.total_returned)}`, amount: Number(r.total_returned || 0), id: r.id })),
    ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    return { sales: enhancedSales, payments: custPayments, returns: custReturns, activity, totalTaken, totalPaid, totalReturned, balance };
  }, [customer, allSales, allSaleItems, allPayments, allReturns]);

  const timeline = useMemo(() => {
    if (!data) return [];
    const pagedSales = data.sales.slice(0, salesPage * SALES_PER_PAGE);
    return [
      ...pagedSales.map((s) => ({ ...s, _type: 'sale', _sortDate: new Date(s.date_created || 0).getTime() })),
      ...data.payments.map((p) => ({ ...p, _type: 'payment', _sortDate: new Date(p.date_added || 0).getTime() })),
    ].sort((a, b) => b._sortDate - a._sortDate);
  }, [data, salesPage]);

  const recordPayment = async (saleId) => {
    const amt = Number(payAmounts[saleId]);
    if (!amt || amt <= 0) { showToast('Enter a valid amount', 'error'); return; }
    try {
      await pushEntity('customer_payment', 'create', {
        customer_id: customer.id,
        amount: amt,
        notes: payNotesBySale[saleId] || '',
        sale_id: saleId,
        date_added: new Date().toISOString(),
      });
      await pushEntity('customer', 'update', {
        ...customer,
        outstanding_balance: Math.max(0, Number(customer.outstanding_balance || 0) - amt),
        updated_at: new Date().toISOString(),
      });
      showToast('Payment recorded');
      setPayAmounts((prev) => { const n = { ...prev }; delete n[saleId]; return n; });
      setPayNotesBySale((prev) => { const n = { ...prev }; delete n[saleId]; return n; });
    } catch { showToast('Failed to record payment', 'error'); }
  };

  const cancelSale = async (sale) => {
    if (!window.confirm(`Cancel Sale #${sale.id}? This cannot be undone.`)) return;
    const products = list('product');
    const now = new Date().toISOString();
    try {
      const events = [{ entityType: 'sale', operation: 'update', payload: { ...sale, status: 'Cancelled', updated_at: now } }];

      for (const item of (sale.items || [])) {
        if (item.product_id == null) continue;
        const product = products.find((p) => String(p.id) === String(item.product_id));
        if (!product) continue;
        const newStock = Number(product.stock || 0) + Number(item.quantity || 0);
        events.push({ entityType: 'product', operation: 'update', payload: { ...product, stock: newStock, updated_at: now } });
      }

      const remaining = Number(sale.remaining ?? sale.due_amount ?? 0);
      if (remaining > 0.01) {
        const newBalance = Math.max(0, Number(customer.outstanding_balance || 0) - remaining);
        events.push({ entityType: 'customer', operation: 'update', payload: { ...customer, outstanding_balance: newBalance, updated_at: now } });
      }

      for (const payment of (sale.linkedPayments || [])) {
        events.push({ entityType: 'customer_payment', operation: 'delete', payload: { id: payment.id } });
      }

      await pushBatch(events);
      showToast('Invoice cancelled');
    } catch { showToast('Failed to cancel invoice', 'error'); }
  };

  const deletePayment = async (payment) => {
    await pushEntity('customer_payment', 'delete', { id: payment.id });
    // Reverse the outstanding_balance decrement this payment applied
    await pushEntity('customer', 'update', {
      ...customer,
      outstanding_balance: Number(customer.outstanding_balance || 0) + Number(payment.amount || 0),
      updated_at: new Date().toISOString(),
    });
    showToast('Payment removed');
  };

  // Print / WhatsApp an existing invoice — same builders as the POS receipt
  const invoiceDataFor = (sale) => {
    const settings = getReceiptSettings();
    return {
      saleId: sale.id,
      items: (sale.items || []).map((i) => ({ name: i.product_name, qty: Number(i.quantity), price: Number(i.price) })),
      subtotal: Number(sale.subtotal ?? sale.total),
      discount: Number(sale.discount || 0),
      total: Number(sale.total),
      paymentMethod: sale.payment_method || 'cash',
      settings: { ...settings, store_name: settings.store_name || user?.store_name || 'My Store' },
      date: new Date(sale.date_created || Date.now()).toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      customerName: customer?.name,
      customerPhone: customer?.phone,
      amountPaid: sale.amountPaid,
      balance: sale.remaining > 0.5 ? sale.remaining : 0,
    };
  };

  if (!customer) {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <p className="text-muted-foreground">Customer not found</p>
        <button onClick={() => navigate('/customers')} className="text-sm text-primary hover:underline">← Back to Customers</button>
      </div>
    );
  }
  if (!data) return null;

  const { sales, payments, returns, activity, totalTaken, totalPaid, totalReturned, balance } = data;
  const hasMoreSales = sales.length > salesPage * SALES_PER_PAGE;
  const paidCount = sales.filter((s) => s.remaining <= 0.5 && s.status !== 'Cancelled').length;
  const unpaidCount = sales.filter((s) => s.remaining > 0.5 && s.status !== 'Cancelled').length;

  return (
    <div className="flex flex-col">
      {/* Back bar */}
      <div className="flex items-center gap-2 px-1 pb-4">
        <button onClick={() => navigate('/customers')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={14} /> Customers
        </button>
        <ChevronRight size={12} className="text-muted-foreground/50" />
        <span className="text-sm font-semibold">{customer.name}</span>
      </div>

      <div className="flex flex-col lg:flex-row lg:flex-1 lg:min-h-0 border border-border rounded-2xl overflow-hidden bg-card shadow-sm">

        {/* ── LEFT SIDEBAR ── */}
        <div className="border-b border-border lg:border-b-0 lg:w-[260px] lg:shrink-0 lg:border-r lg:flex lg:flex-col lg:overflow-y-auto">

          {/* Profile */}
          <div className="p-6 text-center border-b border-border">
            <div className={cn('w-20 h-20 rounded-2xl mx-auto flex items-center justify-center text-3xl font-black text-white mb-4 bg-gradient-to-br', getGrad(customer.name))}>
              {(customer.name || '?')[0].toUpperCase()}
            </div>
            <h2 className="text-base font-black leading-tight">{customer.name}</h2>
            <p className="text-[11px] text-muted-foreground mt-1">
              {customer.created_at ? `Customer since ${new Date(customer.created_at).toLocaleDateString('en-PK', { month: 'short', year: 'numeric' })}` : 'Customer'}
            </p>
            <div className="mt-4 space-y-2 text-left">
              {customer.phone && <div className="flex items-center gap-2 text-sm"><Phone size={12} className="text-muted-foreground shrink-0" /><span className="font-medium">{customer.phone}</span></div>}
              {customer.email && <div className="flex items-center gap-2 text-sm"><Mail size={12} className="text-muted-foreground shrink-0" /><span className="text-xs truncate">{customer.email}</span></div>}
              {customer.address && <div className="flex items-start gap-2 text-sm"><MapPin size={12} className="text-muted-foreground shrink-0 mt-0.5" /><span className="text-xs break-words leading-relaxed">{customer.address}</span></div>}
            </div>
            {customer.phone && (
              <button onClick={() => window.open(`https://wa.me/92${customer.phone.replace(/^0/, '')}`, '_blank')}
                className="mt-4 w-full h-8 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 text-xs font-semibold flex items-center justify-center gap-2 transition-colors">
                <MessageCircle size={13} /> Open WhatsApp
              </button>
            )}
          </div>

          {/* Balance */}
          <div className="px-5 pt-5 pb-3 border-b border-border">
            <div className={cn('rounded-xl p-4 border text-center', balance > 0.5 ? 'bg-rose-500/8 border-rose-500/20' : 'bg-emerald-500/8 border-emerald-500/20')}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Outstanding (Qaraz)</p>
              <p className={cn('text-2xl font-black', balance > 0.5 ? 'text-rose-600' : 'text-emerald-600')}>{fmtPKR(balance)}</p>
              {balance <= 0.5 && <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">All clear ✓</p>}
            </div>
          </div>

          {/* Stats */}
          <div className="px-5 py-4 border-b border-border">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Lifetime Stats</p>
            <div className="space-y-2.5">
              {[
                { icon: TrendingUp, label: 'Total Invoiced',    value: fmtPKR(totalTaken),            color: 'text-foreground' },
                { icon: Check,      label: 'Total Paid',        value: fmtPKR(totalPaid),             color: 'text-emerald-600' },
                { icon: Undo2,      label: 'Total Returned',    value: fmtPKR(totalReturned),          color: 'text-amber-600' },
                { icon: Receipt,    label: 'Total Invoices',    value: String(sales.length),           color: 'text-foreground' },
                { icon: FileText,   label: 'Paid Invoices',     value: `${paidCount} / ${sales.length}`, color: 'text-emerald-600' },
                { icon: Clock,      label: 'Pending Invoices',  value: String(unpaidCount),            color: unpaidCount > 0 ? 'text-rose-600' : 'text-foreground' },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                    <Icon size={12} className="shrink-0" /><span className="truncate">{label}</span>
                  </div>
                  <span className={cn('text-xs font-bold shrink-0 ml-2', color)}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Count pills */}
          <div className="px-5 py-4 mt-auto">
            <div className="flex gap-2 text-[11px]">
              {[['Payments', payments.length], ['Returns', returns.length], ['Events', activity.length]].map(([lbl, cnt]) => (
                <div key={lbl} className="flex-1 rounded-lg bg-muted/50 px-3 py-2 text-center">
                  <p className="font-black">{cnt}</p><p className="text-muted-foreground">{lbl}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div className="flex flex-col lg:flex-1 lg:min-w-0 lg:overflow-hidden">
          <Tabs value={tab} onValueChange={setTab} className="flex flex-col lg:flex-1 lg:overflow-hidden">
            <div className="border-b border-border px-6 pt-4 pb-0 shrink-0">
              <TabsList className="h-9 mb-0">
                {[
                  ['invoices', Receipt, 'Transactions', sales.length],
                  ['payments', CreditCard, 'Ledger', payments.length],
                  ['returns', Undo2, 'Returns', returns.length],
                  ['activity', History, 'Activity Log', 0],
                ].map(([val, Icon, lbl, cnt]) => (
                  <TabsTrigger key={val} value={val} className="gap-1.5 text-xs">
                    <Icon size={12} /> {lbl}
                    {cnt > 0 && <span className="ml-1 bg-muted text-muted-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full">{cnt}</span>}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* TRANSACTIONS — mixed timeline of sales + payments */}
            <TabsContent value="invoices" className="lg:flex-1 lg:overflow-y-auto m-0 p-4">
              {timeline.length === 0 ? <EmptyState icon={<Receipt size={36} />} text="No transactions yet" /> : (
                <div className="space-y-3">
                  {timeline.map((item) => {
                    if (item._type === 'payment') {
                      return (
                        <div key={`pay-${item.id}`} className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20 px-4 py-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                            <CheckCircle2 size={18} className="text-emerald-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-black tracking-wide text-emerald-700 dark:text-emerald-400">PAYMENT COLLECTED</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDateTime(item.date_added)}</p>
                            {item.notes && <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">{item.notes}</p>}
                          </div>
                          <p className="text-sm font-black text-emerald-600 tabular-nums shrink-0">{fmtPKR(item.amount)}</p>
                          <button onClick={() => deletePayment(item)} className="ml-1 text-muted-foreground/30 hover:text-destructive transition-colors shrink-0">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    }

                    // Sale card
                    const sale = item;
                    const st = saleStatus(sale);
                    const paidPct = Math.min(100, Math.round(Number(sale.total) > 0 ? (sale.amountPaid / Number(sale.total)) * 100 : 0));
                    const isExpanded = expandedSaleId === sale.id;
                    return (
                      <div key={`sale-${sale.id}`} className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
                        {/* Gradient top accent */}
                        <div className="h-[3px] w-full bg-gradient-to-r from-blue-500 to-purple-500" />

                        {/* Header row: number + badges left | date + eye right */}
                        <div className="flex items-center justify-between px-4 pt-3 pb-2 gap-2">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <span className="text-sm font-black font-mono">INV #{sale.id}</span>
                            <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0', st.cls)}>{st.label}</span>
                            {sale.items?.length > 0 && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-400/25 text-amber-700 dark:text-amber-400 shrink-0">
                                {sale.items.length} item{sale.items.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <CalendarDays size={9} />{fmtDate(sale.date_created)}
                            </span>
                            <button
                              onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                              title="View details"
                              className={cn('w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0',
                                isExpanded ? 'bg-primary/10 text-primary' : 'text-muted-foreground/50 hover:text-foreground hover:bg-muted')}>
                              <Eye size={14} />
                            </button>
                          </div>
                        </div>

                        {/* TOTAL / PAID / REMAINING — flat, no boxed cells */}
                        <div className="grid grid-cols-3 px-4 pb-2 text-center">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Total</p>
                            <p className="text-xs font-black mt-0.5 tabular-nums">{fmtPKR(sale.total)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Paid</p>
                            <p className="text-xs font-black mt-0.5 text-emerald-600 tabular-nums">{fmtPKR(sale.amountPaid)}</p>
                          </div>
                          <div>
                            <p className={cn('text-[9px] font-black uppercase tracking-widest', sale.remaining > 0.5 ? 'text-rose-600' : 'text-emerald-600')}>Remaining</p>
                            <p className={cn('text-xs font-black mt-0.5 tabular-nums', sale.remaining > 0.5 ? 'text-rose-600' : 'text-emerald-600')}>{fmtPKR(sale.remaining)}</p>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="px-4 pb-2">
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${paidPct}%` }} />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{paidPct}% paid</p>
                        </div>

                        {/* Items inline */}
                        {sale.items?.length > 0 && (
                          <div className="px-4 pb-2">
                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                              <span className="font-bold text-foreground/60">≡ </span>
                              {sale.items.map((i, idx) => (
                                <span key={idx}>
                                  {idx > 0 && <span className="text-muted-foreground/40">, </span>}
                                  {i.product_name} <span className="font-semibold text-foreground/80">×{i.quantity}</span>
                                </span>
                              ))}
                            </p>
                          </div>
                        )}

                        {/* Action bar: Amount | Pay (green) | WA | Print | Cancel */}
                        <div className="flex items-center gap-1.5 px-4 pb-3 flex-wrap">
                          {sale.remaining > 0.5 && sale.status !== 'Cancelled' && (
                            <>
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground font-bold pointer-events-none">PKR</span>
                                <input
                                  type="number" min="0"
                                  value={payAmounts[sale.id] ?? ''}
                                  onChange={(e) => setPayAmounts((prev) => ({ ...prev, [sale.id]: e.target.value }))}
                                  placeholder={Math.round(sale.remaining).toLocaleString()}
                                  className="h-8 pl-8 pr-2 w-32 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-emerald-500/40 tabular-nums"
                                />
                              </div>
                              <button
                                disabled={!payAmounts[sale.id] || Number(payAmounts[sale.id]) <= 0}
                                onClick={() => recordPayment(sale.id)}
                                className="h-8 px-4 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-40 transition-colors shrink-0">
                                Pay
                              </button>
                            </>
                          )}
                          <div className="flex items-center gap-1.5 ml-auto">
                            {customer.phone && (
                              <button
                                onClick={() => { const url = buildWhatsAppLink(invoiceDataFor(sale)); if (url) window.open(url, '_blank'); }}
                                title="WhatsApp"
                                className="w-8 h-8 rounded-full bg-[#25d366] flex items-center justify-center text-white hover:bg-[#1fba57] transition-colors shrink-0">
                                <MessageCircle size={13} />
                              </button>
                            )}
                            <button onClick={() => printInvoice(invoiceDataFor(sale))} title="Print"
                              className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors shrink-0">
                              <Printer size={13} />
                            </button>
                            {sale.status !== 'Cancelled' && (
                              <button onClick={() => cancelSale(sale)} title="Cancel invoice"
                                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 transition-colors shrink-0">
                                <X size={13} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expanded detail: items table + payments on invoice + returns */}
                        {isExpanded && (
                          <div className="border-t border-border/40 bg-muted/10 px-4 py-3 space-y-3">
                            {sale.items?.length > 0 && (
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Items Breakdown</p>
                                <div className="space-y-1.5">
                                  {sale.items.map((it, idx) => (
                                    <div key={idx} className="flex items-center text-xs gap-2">
                                      <span className="font-medium flex-1 min-w-0 truncate">{it.product_name}</span>
                                      <span className="text-muted-foreground shrink-0">×{it.quantity}</span>
                                      <span className="text-muted-foreground shrink-0 tabular-nums w-20 text-right">{fmtPKR(it.price)}</span>
                                      <span className="font-bold shrink-0 tabular-nums w-24 text-right">{fmtPKR(Number(it.price) * Number(it.quantity))}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-2 pt-2 border-t border-border/40 space-y-1 text-xs">
                                  {sale.discount > 0 && (
                                    <div className="flex justify-between text-muted-foreground">
                                      <span>Discount</span><span className="text-rose-600 tabular-nums">−{fmtPKR(sale.discount)}</span>
                                    </div>
                                  )}
                                  {sale.amountReturned > 0 && (
                                    <div className="flex justify-between text-muted-foreground">
                                      <span>Returns</span><span className="text-amber-600 tabular-nums">−{fmtPKR(sale.amountReturned)}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between font-bold border-t border-border/40 pt-1">
                                    <span>Grand Total</span><span className="tabular-nums">{fmtPKR(sale.total)}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                            {sale.linkedPayments?.length > 0 && (
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Payments on this Invoice</p>
                                <div className="space-y-1.5">
                                  {sale.linkedPayments.map((p) => (
                                    <div key={p.id} className="flex items-center justify-between text-xs rounded-lg bg-emerald-500/5 border border-emerald-500/15 px-3 py-1.5">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                        <span className="text-muted-foreground">{fmtDateShort(p.date_added)}</span>
                                        {p.notes && <span className="text-muted-foreground/60 truncate">· {p.notes}</span>}
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0 ml-3">
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtPKR(p.amount)}</span>
                                        <button onClick={() => deletePayment(p)}
                                          className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors">
                                          <Trash2 size={11} />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {sale.linkedReturns?.length > 0 && (
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Returns on this Invoice</p>
                                <div className="space-y-1">
                                  {sale.linkedReturns.map((r) => (
                                    <div key={r.id} className="flex items-center justify-between text-xs rounded-lg bg-amber-500/5 border border-amber-500/15 px-3 py-1.5">
                                      <span className="text-muted-foreground">{fmtDate(r.date_created)}</span>
                                      {r.reason && <span className="text-muted-foreground/60 truncate mx-2">{r.reason}</span>}
                                      <span className="font-bold text-amber-600 tabular-nums">{fmtPKR(r.total_returned)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {hasMoreSales && (
                    <div className="flex justify-center pt-2 pb-4">
                      <button onClick={() => setSalesPage((p) => p + 1)}
                        className="flex items-center gap-2 h-8 px-4 text-xs rounded-lg border border-border bg-background hover:bg-muted">
                        <ChevronDown size={13} /> Load {Math.min(SALES_PER_PAGE, sales.length - salesPage * SALES_PER_PAGE)} more
                      </button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* LEDGER */}
            <TabsContent value="payments" className="lg:flex-1 lg:overflow-y-auto m-0 p-5">
              {payments.length === 0 ? <EmptyState icon={<CreditCard size={36} />} text="No payments recorded yet" /> : (
                <div>
                  <div className="grid grid-cols-[1fr_130px_120px_40px] gap-3 px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border">
                    <span>Date & Notes</span><span className="text-right">Amount</span><span className="text-center">Invoice</span><span />
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {payments.map((p) => (
                      <div key={p.id} className="grid grid-cols-[1fr_130px_120px_40px] gap-3 items-center px-3 py-2.5 rounded-xl hover:bg-muted/30 transition-colors group">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold">{fmtDate(p.date_added)}</p>
                          {p.notes && <p className="text-[10px] text-muted-foreground truncate">{p.notes}</p>}
                        </div>
                        <p className="text-sm font-black text-emerald-600 text-right tabular-nums">{fmtPKR(p.amount)}</p>
                        <p className="text-xs text-muted-foreground text-center">
                          {p.sale_id ? <span className="bg-muted px-2 py-0.5 rounded-md font-mono text-[10px]">#{p.sale_id}</span> : <span className="text-muted-foreground/50">General</span>}
                        </p>
                        <button onClick={() => deletePayment(p)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-border flex justify-between text-sm font-bold">
                    <span className="text-muted-foreground">{payments.length} payment{payments.length !== 1 ? 's' : ''} total</span>
                    <span className="text-emerald-600">{fmtPKR(totalPaid)}</span>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* RETURNS */}
            <TabsContent value="returns" className="lg:flex-1 lg:overflow-y-auto m-0 p-5">
              {returns.length === 0 ? <EmptyState icon={<Undo2 size={36} />} text="No returns recorded" /> : (
                <div className="space-y-2">
                  {returns.map((r) => (
                    <div key={r.id} className="border border-border/60 rounded-xl px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold">Invoice #{r.sale_id}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(r.date_created)}</p>
                          {r.reason && <p className="text-xs text-muted-foreground mt-2 bg-muted/50 rounded-lg px-3 py-1.5 inline-block">"{r.reason}"</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-black text-amber-600 tabular-nums">{fmtPKR(r.total_returned)}</p>
                          <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 px-2 py-0.5 rounded-full">Returned</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-border flex justify-between text-sm font-bold">
                    <span className="text-muted-foreground">{returns.length} return{returns.length !== 1 ? 's' : ''} total</span>
                    <span className="text-amber-600">{fmtPKR(totalReturned)}</span>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ACTIVITY */}
            <TabsContent value="activity" className="lg:flex-1 lg:overflow-y-auto m-0 p-5">
              {activity.length === 0 ? <EmptyState icon={<History size={36} />} text="No activity recorded" /> : (
                <div className="relative pl-4">
                  <div className="absolute left-[18px] top-3 bottom-3 w-px bg-border/50" />
                  <div className="space-y-1">
                    {activity.map((h, idx) => {
                      const dot = h.type === 'PAYMENT_ADDED' ? { bg: 'bg-emerald-500', icon: <Check size={10} /> } :
                        h.type === 'RETURN' ? { bg: 'bg-amber-500', icon: <Undo2 size={9} /> } :
                          { bg: 'bg-primary', icon: <Clock size={10} /> };
                      return (
                        <div key={idx} className="flex gap-4 py-2">
                          <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 relative z-10', dot.bg)}>{dot.icon}</div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-xs font-semibold leading-snug">{h.notes}</p>
                              <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap shrink-0">{fmtDateShort(h.date)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
