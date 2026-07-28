// The desktop schema has no single unified "transaction" table with
// direction/method columns (unlike the old Mongo model) — this reconstructs
// one client-side from the underlying entities so the ledger/reports pages
// can show a consistent view.
export function buildTransactionLedger({ sales, saleReturns, purchaseReturns, expenses, customerPayments, vendorPayments, financialTxns }) {
  const rows = [];

  for (const s of sales) {
    if (s.status !== 'Completed' || s.payment_method === 'credit') continue;
    rows.push({
      key: `sale-${s.id}`,
      type: 'sale',
      direction: 'in',
      amount: Number(s.total || 0),
      method: s.payment_method,
      description: `Sale INV-${String(s.id).slice(-6)}`,
      date: s.date_created,
      customer_id: s.customer_id,
      deletable: false,
    });
  }
  for (const r of saleReturns) {
    rows.push({
      key: `sale_return-${r.id}`,
      type: 'sale_return',
      direction: 'out',
      amount: Number(r.total || 0),
      method: 'cash',
      description: 'Sale return',
      date: r.date_created,
      deletable: false,
    });
  }
  for (const r of purchaseReturns) {
    rows.push({
      key: `purchase_return-${r.id}`,
      type: 'purchase_return',
      direction: 'in',
      amount: Number(r.total || 0),
      method: 'cash',
      description: 'Purchase return',
      date: r.date_created,
      vendor_id: r.vendor_id,
      deletable: false,
    });
  }
  for (const e of expenses) {
    rows.push({
      key: `expense-${e.id}`,
      type: 'expense',
      direction: 'out',
      amount: Number(e.amount || 0),
      method: 'cash',
      description: e.title || e.category,
      date: e.date_added,
      deletable: false,
    });
  }
  for (const p of customerPayments) {
    rows.push({
      key: `customer_payment-${p.id}`,
      type: 'customer_payment',
      direction: 'in',
      amount: Number(p.amount || 0),
      method: 'cash',
      description: 'Customer payment',
      date: p.date_added,
      customer_id: p.customer_id,
      deletable: true,
      raw: p,
    });
  }
  for (const p of vendorPayments) {
    rows.push({
      key: `vendor_payment-${p.id}`,
      type: 'vendor_payment',
      direction: 'out',
      amount: Number(p.amount || 0),
      method: 'cash',
      description: 'Vendor payment',
      date: p.date_created,
      vendor_id: p.vendor_id,
      deletable: true,
      raw: p,
    });
  }
  for (const t of financialTxns) {
    if (t.type !== 'cash_in' && t.type !== 'cash_out') continue;
    rows.push({
      key: `financial_transaction-${t.id}`,
      type: t.type,
      direction: t.type === 'cash_in' ? 'in' : 'out',
      amount: Number(t.amount || 0),
      method: 'cash',
      description: t.description || t.category,
      date: t.date_created,
      deletable: true,
      raw: t,
    });
  }

  return rows.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}
