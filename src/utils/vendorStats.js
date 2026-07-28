// Per-vendor ledger reconstruction — mirrors the desktop's vendor profile math
// (remaining-per-PO, settled/pending counts, lifetime totals), computed from
// the same purchase/vendor_payment/purchase_return collections this web app
// already tracks (payments and returns are linked back to a purchase_id).
export function computeVendorLedger(vendorId, purchases, vendorPayments, purchaseReturns) {
  const vPurchases = purchases.filter((p) => String(p.vendor_id) === String(vendorId));
  const vPayments = vendorPayments.filter((p) => String(p.vendor_id) === String(vendorId));
  const vReturns = purchaseReturns.filter((r) => String(r.vendor_id) === String(vendorId));

  const totalPurchased = vPurchases.filter((p) => p.status !== 'cancelled').reduce((s, p) => s + Number(p.total || 0), 0);
  const totalPaid = vPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalReturned = vReturns.reduce((s, r) => s + Number(r.total || 0), 0);
  const balance = Math.max(0, totalPurchased - totalPaid - totalReturned);

  const purchasesWithRemaining = vPurchases
    .map((po) => {
      const paid = vPayments.filter((p) => String(p.purchase_id) === String(po.id)).reduce((s, p) => s + Number(p.amount || 0), 0);
      const returned = vReturns.filter((r) => String(r.purchase_id) === String(po.id)).reduce((s, r) => s + Number(r.total || 0), 0);
      const remaining = Math.max(0, Number(po.total || 0) - paid - returned);
      return { ...po, paidAgainstOrder: paid, returnedAgainstOrder: returned, remaining };
    })
    .sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0));

  const settledOrders = purchasesWithRemaining.filter((po) => po.remaining <= 0.5 || po.status === 'cancelled').length;

  const productIds = new Set();
  for (const po of vPurchases) {
    for (const item of po.items || []) {
      if (item.product_id != null) productIds.add(String(item.product_id));
    }
  }

  return {
    purchases: purchasesWithRemaining,
    payments: vPayments.slice().sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0)),
    returns: vReturns.slice().sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0)),
    totalPurchased,
    totalPaid,
    totalReturned,
    balance,
    totalOrders: vPurchases.length,
    settledOrders,
    pendingOrders: vPurchases.length - settledOrders,
    productsSupplied: productIds.size,
  };
}
