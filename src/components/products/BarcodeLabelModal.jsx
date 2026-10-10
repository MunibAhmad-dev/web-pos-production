/**
 * Barcode label print / PDF export modal.
 * Works with any product that has a `barcode` field.
 */
import { useState, useRef, useEffect } from 'react';
import { X, Printer, Download, RefreshCw, Minus, Plus } from 'lucide-react';
import JsBarcode from 'jsbarcode';

const SIZES = [
  { key: '50x25',  label: '50×25 mm',  w: 50,  h: 25 },
  { key: '60x40',  label: '60×40 mm',  w: 60,  h: 40 },
  { key: '100x50', label: '100×50 mm', w: 100, h: 50 },
];

function buildLabelHtml(product, qty, sizeMm, copies) {
  const { w, h } = sizeMm;
  const price = product.price ? `PKR ${Math.round(Number(product.price)).toLocaleString('en-PK')}` : '';
  // Inline SVG barcode via JsBarcode
  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  try {
    JsBarcode(svgEl, product.barcode || product.id, {
      format: 'CODE128',
      width: 1.5,
      height: Math.max(h * 1.3, 20),
      displayValue: true,
      fontSize: 8,
      margin: 2,
      background: 'transparent',
    });
  } catch { /* barcode generation fail */ }
  const svgStr = svgEl.outerHTML;

  const labels = Array.from({ length: copies }).map(() => `
    <div style="
      width:${w}mm; height:${h}mm; border:0.5pt solid #ccc;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      padding:1mm; box-sizing:border-box; page-break-inside:avoid; float:left; margin:0.5mm;
    ">
      <p style="font-family:Arial,sans-serif;font-size:${Math.max(h * 0.18, 5)}pt;font-weight:700;text-align:center;margin:0 0 0.5mm;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">
        ${product.name}
      </p>
      ${product.barcode ? `<div style="width:100%;text-align:center;overflow:hidden">${svgStr}</div>` : ''}
      ${price ? `<p style="font-family:Arial,sans-serif;font-size:${Math.max(h * 0.2, 6)}pt;font-weight:900;text-align:center;margin:0.5mm 0 0;color:#000">${price}</p>` : ''}
    </div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      @page { margin: 5mm; }
      body { margin: 0; padding: 0; }
      div { box-sizing: border-box; }
    </style>
  </head><body>${labels}<div style="clear:both"></div></body></html>`;
}

export default function BarcodeLabelModal({ product, onClose }) {
  const [sizeKey, setSizeKey]   = useState('50x25');
  const [copies, setCopies]     = useState(1);
  const [exporting, setExporting] = useState(false);
  const previewRef = useRef(null);
  const size = SIZES.find((s) => s.key === sizeKey) || SIZES[0];

  useEffect(() => {
    if (!previewRef.current) return;
    const iframeDoc = previewRef.current.contentDocument;
    if (!iframeDoc) return;
    iframeDoc.open();
    iframeDoc.write(buildLabelHtml(product, 1, size, 1));
    iframeDoc.close();
  }, [product, size]);

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(buildLabelHtml(product, copies, size, copies));
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const el = document.createElement('div');
      const { w, h } = size;
      el.innerHTML = buildLabelHtml(product, copies, size, copies);
      await html2pdf().set({
        margin: 5,
        filename: `Label-${product.name?.replace(/\s+/g, '-')}-${w}x${h}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: [w * Math.min(copies, 4) + 10, h + 10], orientation: 'landscape' },
      }).from(el).save();
    } catch (err) { console.error(err); }
    finally { setExporting(false); }
  };

  if (!product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="font-bold text-base">Print Barcode Label</h3>
            <p className="text-xs text-muted-foreground truncate max-w-[240px]">{product.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
        </div>

        {/* Preview */}
        <div className="bg-muted/30 flex items-center justify-center p-4 border-b" style={{ minHeight: 120 }}>
          <iframe
            ref={previewRef}
            title="label-preview"
            className="bg-white rounded shadow border border-border/40"
            style={{ width: `${Math.min(size.w * 2.4, 320)}px`, height: `${size.h * 2.4}px`, pointerEvents: 'none' }}
          />
        </div>

        {/* Controls */}
        <div className="p-4 flex flex-col gap-4">
          {/* Size selector */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Label Size</label>
            <div className="flex gap-2">
              {SIZES.map((s) => (
                <button key={s.key} onClick={() => setSizeKey(s.key)}
                  className={`flex-1 h-8 rounded-lg border text-xs font-semibold transition-colors ${sizeKey === s.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background hover:bg-muted text-muted-foreground'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Copies */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Copies</label>
            <div className="flex items-center gap-3">
              <button onClick={() => setCopies(c => Math.max(1, c - 1))}
                className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted">
                <Minus size={13} />
              </button>
              <span className="font-bold text-lg w-8 text-center tabular-nums">{copies}</span>
              <button onClick={() => setCopies(c => Math.min(100, c + 1))}
                className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted">
                <Plus size={13} />
              </button>
              <span className="text-xs text-muted-foreground">{copies > 1 ? `${copies} labels` : '1 label'}</span>
            </div>
          </div>
        </div>

        {/* Footer buttons */}
        <div className="flex items-center gap-2 px-4 pb-4 border-t pt-4">
          <button onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 h-9 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
            <Printer size={14} /> Print
          </button>
          <button onClick={handleExportPDF} disabled={exporting}
            className="flex-1 flex items-center justify-center gap-2 h-9 rounded-xl border border-border bg-background hover:bg-muted text-sm font-semibold transition-colors disabled:opacity-40">
            {exporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
            {exporting ? 'Exporting…' : 'Save PDF'}
          </button>
          <button onClick={onClose} className="h-9 px-3 rounded-xl border border-border bg-background hover:bg-muted text-sm transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}
