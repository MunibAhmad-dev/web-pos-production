import { isCancelled, vendorBalances } from '../lib/ledger';
// Per-vendor ledger reconstruction — mirrors the desktop's vendor profile math
// (remaining-per-PO, settled/pending counts, lifetime totals), computed from
// the same purchase/vendor_payment/purchase_return collections this web app
// already tracks (payments and returns are linked back to a purchase_id).
export function computeVendorLedger(vendorId, purchases, vendorPayments, purchaseReturns) {
  const vid = String(vendorId);
  const vPurchases = purchases.filter((p) => String(p.vendor_id) === vid);
  const poIds = new Set(vPurchases.map((p) => String(p.id)));
  const cancelledIds = new Set(vPurchases.filter(isCancelled).map((p) => String(p.id)));
  // Payments tied to a cancelled purchase don't count (desktop rule).
  const vPayments = vendorPayments.filter((p) => String(p.vendor_id) === vid && !cancelledIds.has(String(p.purchase_id ?? '')));
  // purchase_returns carry no vendor_id — they link through purchase_id.
  const vReturns = purchaseReturns.filter((r) => poIds.has(String(r.purchase_id)) && !cancelledIds.has(String(r.purchase_id)));
  const retAmt = (r) => Number(r.total_returned ?? r.total ?? 0);

  const totalPurchased = vPurchases.filter((p) => !isCancelled(p)).reduce((s, p) => s + Number(p.grand_total || p.total || 0), 0);
  const totalPaid = vPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalReturned = vReturns.reduce((s, r) => s + retAmt(r), 0);
  const balance = Math.max(0, vendorBalances({ purchases: vPurchases, vendorPayments: vPayments, purchaseReturns: vReturns }).get(vid) || 0);

  const purchasesWithRemaining = vPurchases
    .map((po) => {
      const paid = vPayments.filter((p) => String(p.purchase_id) === String(po.id)).reduce((s, p) => s + Number(p.amount || 0), 0);
      const returned = vReturns.filter((r) => String(r.purchase_id) === String(po.id)).reduce((s, r) => s + retAmt(r), 0);
      const remaining = isCancelled(po) ? 0 : Math.max(0, Number(po.grand_total || po.total || 0) - paid - returned);
      return { ...po, paidAgainstOrder: paid, returnedAgainstOrder: returned, remaining };
    })
    .sort((a, b) => new Date(b.date_created || 0) - new Date(a.date_created || 0));

  const settledOrders = purchasesWithRemaining.filter((po) => po.remaining <= 0.5 || isCancelled(po)).length;

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
