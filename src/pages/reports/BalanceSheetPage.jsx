import { useMemo, useState } from 'react';
import { useDataStore } from '../../store/dataStore';
import { Card, CardHeader } from '@/components/ui/panel';
import { DatePicker } from '@/components/form/date-picker';
import Badge from '@/components/ui/status-badge';
import { formatCurrency } from '../../utils/format';

const Line = ({ label, value, bold, tone }) => (
  <div className={`flex justify-between py-1.5 text-sm ${bold ? 'border-t border-border font-semibold text-ink' : 'text-muted-foreground'}`}>
    <span>{label}</span>
    <span className={tone}>{formatCurrency(value)}</span>
  </div>
);

const RatioBlock = ({ label, value }) => (
  <div className="rounded-xl border border-border p-3 text-center">
    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="mt-1 text-base font-semibold text-ink">{value == null ? '—' : value}</p>
  </div>
);

export default function BalanceSheetPage() {
  const { list } = useDataStore();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const products = list('product');
  const sales = list('sale');
  const saleItems = list('sale_item');
  const expenses = list('expense');
  const customers = list('customer');
  const vendors = list('vendor');
  const purchases = list('purchase');
  const vendorPayments = list('vendor_payment');
  const purchaseReturns = list('purchase_return');
  const accounts = list('account');
  const accountTxns = list('account_txn');

  const inRange = (date) => {
    if (!date) return true;
    const d = new Date(date);
    if (from && d < new Date(from)) return false;
    if (to && d > new Date(new Date(to).getTime() + 86400000)) return false;
    return true;
  };

  const data = useMemo(() => {
    const inventoryValue = products.reduce((sum, p) => sum + Number(p.stock || 0) * Number(p.purchase_price || 0), 0);

    // Receivables/payables use the running customer/vendor balances (this web
    // app tracks credit as a whole-account balance, not per-invoice, so this
    // mirrors that model rather than the desktop's per-sale reconstruction).
    const receivables = customers.reduce((sum, c) => sum + Math.max(0, Number(c.outstanding_balance || 0)), 0);
    const payables = vendors.reduce((sum, v) => {
      const owed = purchases.filter((p) => String(p.vendor_id) === String(v.id) && p.status !== 'cancelled').reduce((s, p) => s + Number(p.total || 0), 0);
      const paid = vendorPayments.filter((p) => String(p.vendor_id) === String(v.id)).reduce((s, p) => s + Number(p.amount || 0), 0);
      const returned = purchaseReturns.filter((r) => String(r.vendor_id) === String(v.id)).reduce((s, r) => s + Number(r.total || 0), 0);
      return sum + Math.max(0, owed - paid - returned);
    }, 0);

    const salesInRange = sales.filter((s) => s.status === 'Completed' && inRange(s.date_created));
    const revenue = salesInRange.reduce((sum, s) => sum + Number(s.total || 0), 0);

    const saleIds = new Set(salesInRange.map((s) => String(s.id)));
    const productCost = new Map(products.map((p) => [String(p.id), Number(p.purchase_price || 0)]));
    const cogs = saleItems
      .filter((i) => saleIds.has(String(i.sale_id)))
      .reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.purchase_price || productCost.get(String(i.product_id)) || 0), 0);

    const expensesInRange = expenses.filter((e) => inRange(e.date_added)).reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const paymentStatsMap = {};
    for (const s of salesInRange) {
      const key = s.payment_method || 'cash';
      if (!paymentStatsMap[key]) paymentStatsMap[key] = { revenue: 0, count: 0 };
      paymentStatsMap[key].revenue += Number(s.total || 0);
      paymentStatsMap[key].count += 1;
    }

    const cashTotal = accounts.reduce((sum, a) => {
      const delta = accountTxns
        .filter((t) => String(t.account_id) === String(a.id))
        .reduce((s, t) => s + (t.type === 'in' ? Number(t.amount || 0) : -Number(t.amount || 0)), 0);
      return sum + Number(a.opening_balance || 0) + delta;
    }, 0);

    const netProfit = revenue - cogs - expensesInRange;
    const totalCurrentAssets = cashTotal + inventoryValue + receivables;
    const totalLiabilities = payables;
    const totalEquity = totalCurrentAssets - totalLiabilities;
    const retainedEarnings = netProfit;
    const ownersCapital = Math.max(0, totalEquity - retainedEarnings);
    const grossProfit = revenue - cogs;
    const isBalanced = Math.abs(totalEquity - netProfit) < Math.abs(totalEquity) * 0.05 + 100;

    return {
      inventoryValue,
      receivables,
      payables,
      revenue,
      cogs,
      grossProfit,
      expenses: expensesInRange,
      netProfit,
      cashTotal,
      totalCurrentAssets,
      totalLiabilities,
      totalEquity,
      retainedEarnings,
      ownersCapital,
      isBalanced,
      paymentStats: Object.entries(paymentStatsMap).map(([method, v]) => ({ method, ...v })),
      currentRatio: totalLiabilities > 0 ? (totalCurrentAssets / totalLiabilities).toFixed(2) : null,
      profitMargin: revenue > 0 ? `${((netProfit / revenue) * 100).toFixed(1)}%` : null,
      workingCapital: totalCurrentAssets - totalLiabilities,
      debtToEquity: totalEquity !== 0 ? (totalLiabilities / totalEquity).toFixed(2) : null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, sales, saleItems, expenses, customers, vendors, purchases, vendorPayments, purchaseReturns, accounts, accountTxns, from, to]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-lg font-semibold text-ink">Balance Sheet</h2>
          <p className="text-sm text-muted-foreground">Assets, liabilities and profitability snapshot.</p>
        </div>
        <div className="flex gap-2">
          <DatePicker label="From" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          <DatePicker label="To" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Assets" />
          <div className="p-5">
            <Line label="Cash & Bank Accounts" value={data.cashTotal} />
            <Line label="Accounts Receivable" value={data.receivables} />
            <Line label="Inventory / Stock Value" value={data.inventoryValue} />
            <Line label="Total Current Assets" value={data.totalCurrentAssets} bold />
            <Line label="Total Non-Current Assets" value={0} />
            <Line label="TOTAL ASSETS" value={data.totalCurrentAssets} bold />
          </div>
        </Card>

        <Card>
          <CardHeader title="Liabilities & Equity" />
          <div className="p-5">
            <Line label="Accounts Payable" value={data.payables} />
            <Line label="Total Liabilities" value={data.totalLiabilities} bold />
            <Line label="Net Profit / (Loss) — Period" value={data.retainedEarnings} />
            <Line label="Owner's Capital (Residual)" value={data.ownersCapital} />
            <Line label="Total Equity" value={data.totalEquity} bold />
            <Line label="TOTAL LIABILITIES + EQUITY" value={data.totalLiabilities + data.totalEquity} bold />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Financial Ratios"
          action={<Badge tone={data.isBalanced ? 'green' : 'orange'}>{data.isBalanced ? 'Balanced' : 'Check figures'}</Badge>}
        />
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
          <RatioBlock label="Current Ratio" value={data.currentRatio} />
          <RatioBlock label="Profit Margin" value={data.profitMargin} />
          <RatioBlock label="Working Capital" value={formatCurrency(data.workingCapital)} />
          <RatioBlock label="Debt-to-Equity" value={data.debtToEquity} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Income Statement" />
        <div className="p-5">
          <Line label="Gross Revenue" value={data.revenue} />
          <Line label="Less: COGS" value={-data.cogs} />
          <Line label="Gross Profit" value={data.grossProfit} bold />
          <Line label="Less: Operating Expenses" value={-data.expenses} />
          <Line label="Net Profit / (Loss)" value={data.netProfit} bold tone={data.netProfit >= 0 ? 'text-brand-green' : 'text-brand-red'} />
        </div>
        {data.paymentStats.length > 0 && (
          <div className="border-t border-border p-5">
            <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Revenue by Payment Method</p>
            <div className="flex flex-col gap-2">
              {data.paymentStats.map((p) => (
                <div key={p.method} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-muted-foreground">
                    {p.method} ({p.count})
                  </span>
                  <span className="font-medium text-ink">{formatCurrency(p.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
