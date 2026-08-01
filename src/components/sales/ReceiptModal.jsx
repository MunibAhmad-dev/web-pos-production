import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, ChevronDown, Monitor, Printer, X, FileDown } from 'lucide-react';
import Button from '@/components/ui/action-button';
import {
  getReceiptSettings, buildWhatsAppLink, printInvoice, openInvoiceInTab,
  formatInvoiceId, fmtPKR,
} from '../../utils/receipt';

// Receipt modal — mirrors the Electron ReceiptModal (Sales.tsx): dashed
// thermal-style preview, print menu, Save as PDF, browser print, WhatsApp.
export default function ReceiptModal({ open, onClose, sale, businessName }) {
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const printMenuRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (printMenuRef.current && !printMenuRef.current.contains(e.target)) setShowPrintMenu(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const data = useMemo(() => {
    if (!sale) return null;
    const settings = getReceiptSettings();
    return {
      saleId: sale.saleId ?? sale.invoiceNo,
      items: (sale.items || []).map((i) => ({
        name: i.name,
        qty: i.qty,
        price: i.price ?? (i.qty ? (i.lineTotal || 0) / i.qty : 0),
      })),
      subtotal: sale.subtotal,
      discount: sale.discount || 0,
      total: sale.total,
      paymentMethod: sale.paymentMethod,
      settings: { ...settings, store_name: settings.store_name || businessName || 'My Store' },
      date: new Date(sale.createdAt || Date.now()).toLocaleString('en-PK', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      }),
      customerName: sale.customerName || undefined,
      customerPhone: sale.customerPhone || undefined,
      amountPaid: sale.amountPaid,
      balance: sale.dueAmount > 0 ? sale.dueAmount : 0,
    };
  }, [sale, businessName]);

  if (!open || !sale || !data) return null;

  const waLink = buildWhatsAppLink(data);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex min-h-full items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-sm flex flex-col max-h-[90vh] rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle size={18} className="text-emerald-500" />
            </div>
            <h2 className="text-lg font-bold">Sale Complete!</h2>
          </div>
          <button onClick={onClose} className="h-8 w-8 -mr-2 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        {/* Receipt preview — matches the Electron dashed thermal preview */}
        <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
          <div className="bg-background border border-dashed border-border rounded-xl p-5 font-mono text-xs text-foreground shadow-sm">
            <p className="text-center font-bold text-sm mb-0.5">{data.settings.store_name}</p>
            {data.settings.store_address && <p className="text-center text-muted-foreground leading-tight">{data.settings.store_address}</p>}
            {data.settings.store_phone && <p className="text-center text-muted-foreground">Tel: {data.settings.store_phone}</p>}
            <div className="border-b border-dashed border-border my-3" />
            <p className="text-center text-foreground font-bold">INVOICE: {formatInvoiceId(data.saleId, sale.createdAt)}</p>
            <p className="text-center text-foreground/80 font-semibold text-[10px]">{data.date}</p>
            {data.customerName && (
              <p className="text-[10px] mt-1">Customer: <strong>{data.customerName}</strong>{data.customerPhone ? ` · ${data.customerPhone}` : ''}</p>
            )}
            <div className="border-b border-dashed border-border my-3" />
            <table className="w-full">
              <thead>
                <tr className="border-y-2 border-foreground/80 text-foreground">
                  <th className="text-center font-extrabold py-1 w-8">QTY</th>
                  <th className="text-left font-extrabold py-1">ITEM</th>
                  <th className="text-right font-extrabold py-1">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-dashed border-border align-top">
                    <td className="text-center font-bold py-1.5">{item.qty}</td>
                    <td className="py-1.5 pr-2">
                      <div className="font-semibold break-words">{item.name}</div>
                      <div className="text-[10px] text-foreground/70">@ {fmtPKR(item.price)}</div>
                    </td>
                    <td className="text-right font-bold py-1.5 whitespace-nowrap">{fmtPKR(item.price * item.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="my-3" />
            <div className="flex justify-between text-muted-foreground text-[10px] mt-1"><span>Subtotal</span><span>{fmtPKR(data.subtotal)}</span></div>
            {data.discount > 0 && <div className="flex justify-between text-destructive text-[10px] mt-0.5"><span>Discount</span><span>-{fmtPKR(data.discount)}</span></div>}
            <div className="flex justify-between font-bold text-sm mt-1"><span>Total</span><span>{fmtPKR(data.total)}</span></div>
            {data.amountPaid !== undefined && <div className="flex justify-between text-muted-foreground text-[10px] mt-1"><span>Amount Paid</span><span>{fmtPKR(data.amountPaid)}</span></div>}
            {data.balance > 0 && (
              <div className="flex justify-between text-[10px] mt-0.5">
                <span className="text-muted-foreground">Remaining Balance (Qaraz)</span>
                <span className="text-amber-600 font-semibold">{fmtPKR(data.balance)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground text-[10px] mt-1"><span>Payment</span><span className="uppercase">{data.paymentMethod === 'online' ? 'Online Payment' : data.paymentMethod}</span></div>
            {data.settings.receipt_footer && (
              <><div className="border-b border-dashed border-border my-3" /><p className="text-center text-muted-foreground">{data.settings.receipt_footer}</p></>
            )}
          </div>
        </div>

        {/* Actions — Print menu / PDF / browser tab / WhatsApp */}
        <div className="flex flex-col gap-3 px-5 py-4 border-t border-border">
          <div className="flex w-full gap-3">
            <Button variant="secondary" onClick={onClose} className="flex-1 justify-center">Close</Button>
            <div ref={printMenuRef} className="relative flex-1">
              <Button onClick={() => setShowPrintMenu((v) => !v)} className="w-full justify-center gap-2 shadow-md">
                <Printer size={15} /> Print
                <ChevronDown size={13} className={`ml-auto transition-transform ${showPrintMenu ? 'rotate-180' : ''}`} />
              </Button>
              {showPrintMenu && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-lg shadow-xl overflow-hidden z-50">
                  <button
                    onClick={() => { setShowPrintMenu(false); printInvoice(data); }}
                    className="w-full px-4 py-3 text-sm text-left hover:bg-muted flex items-center gap-2 font-medium"
                  >
                    <Printer size={14} />
                    <div>
                      <div>Direct Print</div>
                      <div className="text-xs text-muted-foreground font-normal">Opens print dialog — pick your thermal printer</div>
                    </div>
                  </button>
                  <div className="border-t border-border" />
                  <button
                    onClick={() => { setShowPrintMenu(false); openInvoiceInTab(data); }}
                    className="w-full px-4 py-3 text-sm text-left hover:bg-muted flex items-center gap-2 font-medium"
                  >
                    <Monitor size={14} />
                    <div>
                      <div>Open in Browser Tab</div>
                      <div className="text-xs text-muted-foreground font-normal">View full invoice, then print from there</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-3 w-full">
            <Button variant="secondary" onClick={() => printInvoice(data)} className="flex-1 justify-center gap-2 text-xs">
              <FileDown size={13} /> Save as PDF
            </Button>
            {waLink && (
              <Button
                onClick={() => window.open(waLink, '_blank')}
                className="flex-1 justify-center gap-2 text-xs bg-green-600 hover:bg-green-700 text-white border-transparent"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                WhatsApp
              </Button>
            )}
          </div>
          <p className="text-[10px] text-center text-muted-foreground">
            Tip: in the print dialog choose <strong>Save as PDF</strong> to download, or select your thermal/A4 printer directly.
          </p>
        </div>
      </div>
    </div>
  );
}
