import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Printer, MessageCircle, X } from 'lucide-react';
import { buildThermalHtml, printInvoice, whatsappShare } from '../../lib/invoicePrint';

// Displays a thermal slip preview inside the app + action buttons.
// opts: InvoiceOptions (same shape used by invoicePrint.js)
// phone: optional WhatsApp number for share
export default function InvoiceReceiptPreview({ open, onClose, opts, phone }) {
  if (!opts) return null;

  const html = buildThermalHtml(opts);

  function handleBrowserPrint() {
    printInvoice({ ...opts, style: 'thermal' });
  }

  function handleWhatsApp() {
    const items = opts.items.map(i => `${i.qty}x ${i.name} — Rs.${Math.round(i.total).toLocaleString()}`).join('\n');
    const grand = opts.totals.find(t => t.emphasis);
    const msg = `*${opts.docType}: ${opts.docNumber}*\nDate: ${opts.date}\n\n${items}\n\n*Total: Rs.${grand ? Math.round(grand.value).toLocaleString() : '—'}*\n\n${opts.company.name}`;
    whatsappShare(phone, msg);
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-semibold">Receipt Preview</DialogTitle>
          </div>
        </DialogHeader>

        {/* Thermal slip preview */}
        <div className="px-4 py-3 max-h-[60vh] overflow-y-auto bg-muted/30">
          <div
            className="bg-white rounded border text-[11px] font-mono p-3 mx-auto shadow-sm"
            style={{ maxWidth: 280, minWidth: 240, wordBreak: 'break-word' }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>

        <div className="flex gap-2 px-4 py-3 border-t">
          <Button size="sm" className="flex-1 gap-1.5" onClick={handleBrowserPrint}>
            <Printer size={14} /> Print
          </Button>
          {phone && (
            <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-green-700 border-green-200 hover:bg-green-50" onClick={handleWhatsApp}>
              <MessageCircle size={14} /> WhatsApp
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X size={14} />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
