// Receipt/invoice builders + printer settings — ported from the Electron app
// (src/renderer/pages/Sales.tsx buildReceiptHtml / buildFormalInvoiceHtml and
// src/main/main.ts buildReceiptPdfHtml 72mm wrapper) so web receipts match the
// desktop exactly. Settings are stored in localStorage (no backend changes).

const SETTINGS_KEY = 'osatech_receipt_settings';

export function getReceiptSettings() {
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch { /* ignore */ }
  return {
    store_name:     stored.store_name     || '',
    store_address:  stored.store_address  || '',
    store_phone:    stored.store_phone    || '',
    receipt_footer: stored.receipt_footer ?? 'Thank you for your purchase!',
    invoice_style:  stored.invoice_style  || 'thermal', // 'thermal' | 'formal'
    invoice_notes:  stored.invoice_notes  || '',
  };
}

export function saveReceiptSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// Manual formatter — matches Electron (en-PK locale is inconsistent on Windows)
export const fmtPKR = (n) => {
  const s = Math.round(Number(n) || 0).toString();
  const formatted = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `PKR ${formatted}`;
};

export function formatInvoiceId(id, dateString) {
  const d = dateString ? new Date(dateString) : new Date();
  const isValid = !isNaN(d.getTime());
  const base = isValid ? d : new Date();
  const datePart =
    base.getFullYear().toString() +
    String(base.getMonth() + 1).padStart(2, '0') +
    String(base.getDate()).padStart(2, '0');
  const numericId = Number(id);
  const idPart = Number.isFinite(numericId)
    ? String(Math.max(0, Math.trunc(numericId))).padStart(5, '0')
    : String(id ?? '').trim();
  return `INV-${datePart}-${idPart || '00000'}`;
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Formats qty for a sale item — shows "2 ctn + 3 box + 4 jars" when wholesale data present
function fmtQtyLabel(item) {
  const cartonQty = Number(item.cartonQty) || 0;
  const boxQty    = Number(item.boxQty)    || 0;
  const cartons   = Number(item.cartons)   || 0;
  const boxes     = Number(item.boxes)     || 0;
  const pcs       = Number(item.pcs)       || 0;
  const pn        = (item.pieceName || 'pc').toLowerCase();
  if (cartonQty > 0) {
    const parts = [];
    if (cartons > 0) parts.push(`${cartons} ctn`);
    if (boxQty > 0 && boxes > 0) parts.push(`${boxes} box`);
    if (pcs > 0) parts.push(`${pcs} ${pn}`);
    return parts.length > 0 ? parts.join(' + ') : `${item.qty ?? 0} ${pn}`;
  }
  return String(item.qty ?? 0);
}

// ─── Thermal receipt (inner content) ─────────────────────────────────────────
function buildReceiptHtml(data) {
  const itemsHtml = data.items.map((item) => {
    const lineTotal = item.price * item.qty;
    const amtNum = Math.round(lineTotal).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const qtyLabel = fmtQtyLabel(item);
    const pn = (item.pieceName || 'pc').toLowerCase();
    const cq = Number(item.cartonQty) || 0;
    const bq = Number(item.boxQty) || 0;
    const ctns = Number(item.cartons) || 0;
    const boxNote = cq > 0 && (ctns > 0 || Number(item.boxes) > 0)
      ? (() => {
          const pcsPerCtn = bq > 0 ? cq * bq : cq;
          if (bq > 0 && ctns > 0 && Number(item.boxes) > 0)
            return `<div class="r-rate">${ctns}ctn×${cq}×${bq} + ${item.boxes}box×${bq} = ${item.qty} ${pn}</div>`;
          if (bq > 0 && ctns > 0)
            return `<div class="r-rate">${ctns}×${pcsPerCtn} = ${item.qty} ${pn}</div>`;
          if (ctns > 0)
            return `<div class="r-rate">${ctns}×${cq} = ${item.qty} ${pn}</div>`;
          return '';
        })()
      : '';
    return `<tr>
       <td class="r-qty">${qtyLabel}</td>
       <td class="r-name">${esc(item.name)}${boxNote}<div class="r-rate">@ ${fmtPKR(item.price)}/pc</div></td>
       <td class="r-amt">${amtNum}</td>
     </tr>`;
  }).join('');
  return `
    <h2>${esc(data.settings.store_name)}</h2>
    ${data.settings.store_address ? `<p class="center sub">${esc(data.settings.store_address)}</p>` : ''}
    ${data.settings.store_phone ? `<p class="center sub">Tel: ${esc(data.settings.store_phone)}</p>` : ''}
    <div class="divider"></div>
    <p class="center inv-no">INVOICE: ${formatInvoiceId(data.saleId, data.date)}</p>
    <p class="center inv-date">${esc(data.date)}</p>
    ${data.customerName ? `<div class="meta-line"><span>Customer:</span> <strong>${esc(data.customerName)}</strong></div>${data.customerPhone ? `<div class="meta-line"><span>Tel:</span> <strong>${esc(data.customerPhone)}</strong></div>` : ''}` : ''}
    <table class="r-items">
      <thead>
        <tr><th class="r-qty">QTY</th><th class="r-name">ITEM</th><th class="r-amt">AMOUNT</th></tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div class="total-row sub-row"><span>Subtotal</span><span>${fmtPKR(data.subtotal)}</span></div>
    ${Number(data.discount) > 0 ? `<div class="total-row sub-row"><span>Discount</span><span>- ${fmtPKR(Number(data.discount))}</span></div>` : ''}
    <div class="total-row grand-row"><span>TOTAL</span><span>${fmtPKR(data.total)}</span></div>
    ${data.amountPaid !== undefined ? `<div class="total-row sub-row"><span>Amount Paid</span><span>${fmtPKR(data.amountPaid)}</span></div>` : ''}
    ${data.balance ? `<div class="total-row sub-row"><span>${data.balance > 0 ? 'Remaining Balance' : 'Change Due'}</span><span>${fmtPKR(Math.abs(data.balance))}</span></div>` : ''}
    <div class="total-row sub-row"><span>Payment</span><span>${data.paymentMethod === 'online' ? 'ONLINE PAYMENT' : String(data.paymentMethod || 'CASH').toUpperCase()}</span></div>
    <div class="divider"></div>
    <div style="text-align:center;margin-top:6px;">
      <div class="footer-msg">${esc(data.settings.receipt_footer)}</div>
      <div class="footer-credit">Software by +923298748232</div>
    </div>
  `;
}

// 72mm thermal wrapper — same CSS as the Electron PDF/print wrapper
function wrapThermal(content) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8"/>
    <style>
      @page { margin: 0; size: 72mm auto; }
      * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      html { width: 72mm; background: #fff; }
      body {
        width: 72mm;
        font-family: 'Segoe UI', 'Arial', 'Helvetica Neue', sans-serif;
        font-size: 13px; font-weight: 600; line-height: 1.45;
        padding: 4mm 4mm 10mm 4mm; background: #fff; color: #000;
      }
      .receipt { width: 100%; }
      h2 { text-align: center; font-size: 20px; font-weight: 800; margin-bottom: 4px; letter-spacing: .3px; }
      p { margin: 2px 0; font-size: 13px; }
      .center { text-align: center; }
      .sub { font-size: 12px; font-weight: 600; }
      .inv-no { font-weight: 800; font-size: 13px; margin-top: 2px; }
      .inv-date { font-size: 12px; font-weight: 700; margin-top: 1px; }
      .meta-line { font-size: 12px; font-weight: 600; margin: 2px 0; }
      .meta-line span { font-weight: 700; }
      .divider { border-bottom: 1px solid #000; margin: 8px 0; width: 100%; }
      .r-items { width: 100%; border-collapse: collapse; margin: 6px 0 2px; }
      .r-items th {
        font-size: 12px; font-weight: 800; text-transform: uppercase;
        text-align: left; padding: 4px 2px; border-top: 2px solid #000; border-bottom: 2px solid #000;
      }
      .r-items td {
        font-size: 13px; font-weight: 700; padding: 5px 2px; vertical-align: top;
        border-bottom: 1px dashed #000;
      }
      .r-items .r-qty { width: 34px; text-align: center; font-weight: 800; }
      .r-items .r-amt { width: 74px; text-align: right; white-space: nowrap; }
      .r-items .r-name { word-break: break-word; }
      .r-items .r-rate { font-size: 11px; font-weight: 600; margin-top: 1px; }
      .total-row { display: flex; justify-content: space-between; gap: 8px; font-weight: 800; font-size: 15px; margin-top: 6px; }
      .total-row.sub-row { font-size: 12px; font-weight: 700; margin-top: 3px; }
      .total-row.grand-row {
        font-size: 17px; font-weight: 800; margin-top: 5px;
        border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 4px 0;
      }
      .footer-msg { font-size: 13px; font-weight: 800; }
      .footer-credit { font-size: 10px; font-weight: 600; margin-top: 8px; }
      @media screen {
        html, body { width: auto; background: #f1f1f1; }
        body { display: flex; justify-content: center; padding: 24px 0; }
        .receipt { width: 72mm; background: #fff; padding: 4mm; box-shadow: 0 4px 24px rgba(0,0,0,.18); }
      }
    </style>
  </head>
  <body><div class="receipt">${content}</div></body>
</html>`;
}

// ─── Formal A4 invoice — same layout as the Electron formal invoice ──────────
function buildFormalInvoiceHtml(data) {
  const pkrNum = (n) => Math.round(Number(n) || 0).toLocaleString('en-PK');
  const paidAmt = data.amountPaid !== undefined ? data.amountPaid : data.total;
  const balAmt  = data.balance !== undefined ? data.balance : 0;
  let balanceRow = '';
  if      (balAmt > 0) balanceRow = `<tr><td class="label">BALANCE (CREDIT)</td><td class="value">PKR ${pkrNum(balAmt)}</td></tr>`;
  else if (balAmt < 0) balanceRow = `<tr><td class="label">CHANGE DUE</td><td class="value">PKR ${pkrNum(Math.abs(balAmt))}</td></tr>`;
  else                 balanceRow = `<tr><td class="label">BALANCE</td><td class="value">PKR 0</td></tr>`;

  const rowsHtml = data.items.map((item, idx) => {
    const qtyLabel = fmtQtyLabel(item);
    const pn2 = (item.pieceName || 'pc').toLowerCase();
    const cq2 = Number(item.cartonQty) || 0;
    const bq2 = Number(item.boxQty) || 0;
    const ctns2 = Number(item.cartons) || 0;
    const boxNote  = cq2 > 0 && (ctns2 > 0 || Number(item.boxes) > 0)
      ? (() => {
          const pcsPerCtn2 = bq2 > 0 ? cq2 * bq2 : cq2;
          if (bq2 > 0 && ctns2 > 0 && Number(item.boxes) > 0)
            return `<div style="font-size:7pt;color:#888;margin-top:2px">${ctns2}ctn×${cq2}×${bq2} + ${item.boxes}box×${bq2} = ${item.qty} ${pn2}</div>`;
          if (bq2 > 0 && ctns2 > 0)
            return `<div style="font-size:7pt;color:#888;margin-top:2px">${ctns2}×${pcsPerCtn2} = ${item.qty} ${pn2}</div>`;
          if (ctns2 > 0)
            return `<div style="font-size:7pt;color:#888;margin-top:2px">${ctns2}×${cq2} = ${item.qty} ${pn2}</div>`;
          return '';
        })()
      : '';
    return `<tr class="item-row">
      <td class="center">${idx + 1}</td>
      <td>${esc(item.name)}${boxNote}</td>
      <td class="center warranty-cell">—</td>
      <td class="center">${qtyLabel}</td>
      <td class="right">PKR ${pkrNum(item.price)}</td>
      <td class="right amount-col">PKR ${pkrNum(item.price * item.qty)}</td>
    </tr>`;
  }).join('');

  const emptyCount    = Math.max(0, 7 - data.items.length);
  const emptyRowsHtml = Array(emptyCount).fill('<tr class="item-row empty-row"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>').join('');

  const notesLines = (data.settings.invoice_notes || data.settings.receipt_footer || '')
    .split('\n').filter(Boolean)
    .map((l) => `<div class="note-line">${esc(l.replace(/^[•-]\s*/, ''))}</div>`).join('');

  const storeName    = data.settings.store_name    || 'Store Name';
  const storeAddr    = data.settings.store_address || '';
  const storePhone   = data.settings.store_phone   || '';
  const customerName = data.customerName           || 'Walk-in Customer';
  const invoiceNo    = formatInvoiceId(data.saleId, data.date);

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>Invoice ${invoiceNo}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  @page{size:A4;margin:0}
  html,body{background:#fff;color:#1a1a1a;font-family:Arial,Helvetica,sans-serif;font-size:10pt}
  .page{width:210mm;min-height:297mm;padding:10mm 12mm 8mm;display:flex;flex-direction:column;background:#fff}
  @media screen {
    html,body{background:#e8e8e8;display:flex;flex-direction:column;align-items:center;padding:24px 0 40px;min-height:100vh}
    .page{box-shadow:0 4px 24px rgba(0,0,0,0.18);border-radius:2px}
  }
  @media print {
    html,body{background:#fff;display:block;padding:0}
    .page{box-shadow:none}
  }
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:7px;border-bottom:3px solid #cc0000;margin-bottom:7px}
  .brand{display:flex;align-items:center;gap:9px}
  .store-name{font-size:18pt;font-weight:900;color:#cc0000;line-height:1.1}
  .store-sub{font-size:7.5pt;color:#555;margin-top:2px;line-height:1.5}
  .inv-meta{text-align:right}
  .inv-title{font-size:16pt;font-weight:900;color:#1a1a1a;letter-spacing:2px}
  .meta-row{font-size:8.5pt;color:#333;margin-top:3px}
  .meta-row span{font-weight:bold}
  .bill-bar{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:7px;padding:5px 9px;background:#fafafa;border:1px solid #e8e8e8;border-radius:3px}
  .bill-section{flex:1}
  .bill-section.right{text-align:right}
  .bill-lbl{font-size:6.5pt;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:.5px}
  .bill-name{font-size:10pt;font-weight:800;color:#1a1a1a;margin-top:2px}
  .bill-sub{font-size:7.5pt;color:#555;margin-top:1px;line-height:1.4}
  table{width:100%;border-collapse:collapse}
  thead tr{background:#cc0000;color:#fff}
  thead th{padding:5px 5px;font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.5px;border:1px solid #aaa;white-space:nowrap}
  .item-row td{border:1px solid #ccc;padding:4px 5px;font-size:9pt;vertical-align:middle}
  .item-row:nth-child(even){background:#fafafa}
  .empty-row td{height:18px}
  .center{text-align:center}.right{text-align:right}.amount-col{font-weight:700}
  .warranty-cell{color:#888;font-size:7.5pt}
  .bottom{display:flex;justify-content:space-between;gap:14px;margin-top:7px;align-items:flex-start}
  .notes-box{flex:1;border:1px solid #e0e0e0;border-radius:4px;padding:6px 10px;background:#fffbf8}
  .notes-title{font-size:7.5pt;font-weight:700;color:#cc0000;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
  .note-line{font-size:7.5pt;color:#c00;line-height:1.6;padding-left:8px;position:relative}
  .note-line::before{content:"•";position:absolute;left:0}
  .summary{min-width:190px}
  .summary table{width:100%}
  .summary td{border:1px solid #ccc;padding:4px 8px;font-size:9pt}
  .summary .label{color:#333}.summary .value{text-align:right;font-weight:600}
  .summary .discount-row td{color:#cc0000}
  .summary .grand-row td{font-weight:800;font-size:10pt;background:#f5f5f5}
  .footer{margin-top:auto;padding-top:7px;border-top:2px solid #cc0000;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;font-size:7.5pt;color:#555}
  .sign-block{display:flex;flex-direction:column;align-items:center;text-align:center}
  .sign-block.right-align{align-items:flex-end;text-align:right}
  .sign-lbl{font-size:7pt;color:#888;margin-bottom:14px;white-space:nowrap}
  .sign-line{border-bottom:1px solid #999;width:100%;margin-bottom:3px}
  .sign-name{font-size:7.5pt;font-weight:700;color:#333}
  @media print{html,body{width:210mm}.page{padding:8mm 10mm 6mm}}
</style>
</head><body><div class="page">
  <div class="hdr">
    <div class="brand"><div><div class="store-name">${esc(storeName)}</div><div class="store-sub">${storeAddr ? esc(storeAddr) + '<br/>' : ''}${storePhone ? 'Tel: ' + esc(storePhone) : ''}</div></div></div>
    <div class="inv-meta"><div class="inv-title">INVOICE</div><div class="meta-row"><span>No:</span> ${invoiceNo}</div><div class="meta-row"><span>Date:</span> ${esc(data.date)}</div></div>
  </div>
  <div class="bill-bar">
    <div class="bill-section">
      <div class="bill-lbl">Bill To</div>
      <div class="bill-name">${esc(customerName)}</div>
    </div>
    <div class="bill-section right">
      <div class="bill-lbl">From (Seller)</div>
      <div class="bill-name">${esc(storeName)}</div>
      <div class="bill-sub">${esc(storeAddr)}${storePhone ? '<br/>Tel: ' + esc(storePhone) : ''}</div>
    </div>
  </div>
  <table>
    <thead><tr><th style="width:30px">S.No</th><th style="text-align:left">Description</th><th style="width:60px">Warranty</th><th style="width:34px">Qty</th><th style="width:86px">Unit Price</th><th style="width:96px">Amount</th></tr></thead>
    <tbody>${rowsHtml}${emptyRowsHtml}</tbody>
  </table>
  <div class="bottom">
    <div class="notes-box"><div class="notes-title">Terms &amp; Notes</div>${notesLines || '<div class="note-line" style="color:#aaa;padding-left:0">No notes set.</div>'}</div>
    <div class="summary"><table>
      <tr><td class="label">AMOUNT</td><td class="value">PKR ${pkrNum(data.subtotal)}</td></tr>
      <tr class="discount-row"><td class="label">DISCOUNT</td><td class="value">${Number(data.discount) > 0 ? '- PKR ' + pkrNum(Number(data.discount)) : '—'}</td></tr>
      <tr class="grand-row"><td class="label">GRAND TOTAL</td><td class="value">PKR ${pkrNum(data.total)}</td></tr>
      <tr><td class="label">PAID</td><td class="value">PKR ${pkrNum(paidAmt)}</td></tr>
      ${balanceRow}
    </table></div>
  </div>
  <div class="footer">
    <div class="sign-block">
      <div class="sign-lbl">Customer Signature</div>
      <div class="sign-line"></div>
      <div class="sign-name">${esc(customerName)}</div>
    </div>
    <div class="sign-block">
      <div class="sign-lbl">Prepared By</div>
      <div class="sign-line"></div>
      <div class="sign-name">${esc(storeName)}</div>
    </div>
    <div class="sign-block right-align">
      <div class="sign-lbl">Authorized Signature</div>
      <div class="sign-line"></div>
      <div class="sign-name">${esc(storeName)}</div>
    </div>
  </div>
</div></body></html>`;
}

/** Full printable invoice HTML — style chosen by settings.invoice_style. */
export function buildInvoiceHtml(data) {
  return data.settings.invoice_style === 'formal'
    ? buildFormalInvoiceHtml(data)
    : wrapThermal(buildReceiptHtml(data));
}

/**
 * Open the invoice in a hidden iframe and trigger the browser print dialog.
 * The user picks their thermal or A4 printer there — or "Save as PDF" to
 * download. This is the browser equivalent of Electron's print paths.
 */
export function printInvoice(data, { autoPrint = true } = {}) {
  const html = buildInvoiceHtml(data);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  if (autoPrint) {
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 60_000);
      }, 150);
    };
    // Some browsers fire load before onload is attached
    setTimeout(() => {
      try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch { /* already printed */ }
    }, 400);
  }
  return iframe;
}

/**
 * Directly download the invoice as a PDF file (no print dialog).
 * Renders the invoice HTML off-screen and converts it with html2pdf.js —
 * thermal gets a 72mm-wide page with auto height, formal gets A4.
 */
export async function downloadInvoicePdf(data) {
  const { default: html2pdf } = await import('html2pdf.js');
  const html = buildInvoiceHtml(data);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;height:1400px;border:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  await new Promise((r) => setTimeout(r, 350)); // let styles/layout settle
  const isThermal = data.settings.invoice_style !== 'formal';
  // Target the invoice element itself, not body — body carries screen-view
  // chrome (grey background, centering) that shouldn't be in the PDF.
  const el = doc.querySelector(isThermal ? '.receipt' : '.page') || doc.body;
  const filename = `${formatInvoiceId(data.saleId, data.date)}.pdf`;
  const heightMm = Math.max(80, (el.scrollHeight * 25.4) / 96 + 6);
  const opt = {
    margin: 0,
    filename,
    image: { type: 'jpeg', quality: 0.97 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: isThermal
      ? { unit: 'mm', format: [72, heightMm], orientation: 'portrait' }
      : { unit: 'mm', format: 'a4', orientation: 'portrait' },
  };
  try {
    await html2pdf().set(opt).from(el).save();
  } finally {
    document.body.removeChild(iframe);
  }
}

/** Open the invoice in a new browser tab (view + print from there). */
export function openInvoiceInTab(data) {
  const html = buildInvoiceHtml(data);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}

/** Build the bilingual WhatsApp message + wa.me link — same as Electron. */
export function buildWhatsAppLink(data) {
  if (!data.customerPhone) return null;
  const paidAmt = data.amountPaid ?? data.total;
  const balance = data.balance ?? 0;
  const storeName = data.settings.store_name || 'Store';
  const invoiceId = formatInvoiceId(data.saleId, data.date);
  let msg = `🧾 *Invoice: ${invoiceId}*\n*${storeName}*\n`;
  msg += `📅 ${data.date}\n───────────────────\n`;
  data.items.forEach((i) => { msg += `▪ ${i.name} x${i.qty} = ${fmtPKR(i.price * i.qty)}\n`; });
  msg += `───────────────────\n`;
  if (data.discount > 0) msg += `🏷️ Discount: -${fmtPKR(data.discount)}\n`;
  msg += `💰 *Total: ${fmtPKR(data.total)}*\n✅ *Paid: ${fmtPKR(paidAmt)}*\n`;
  if (balance > 0) msg += `🔴 *Remaining Balance: ${fmtPKR(balance)}*\n`;
  else if (balance < 0) msg += `🟢 *Change Due: ${fmtPKR(Math.abs(balance))}*\n`;
  else msg += `🟢 *Fully Paid*\n`;
  msg += `\n━━━━━━━━━━━━━━━━━━━\n🧾 *بل نمبر: ${invoiceId}*\n🏪 *${storeName}*\n━━━━━━━━━━━━━━━━━━━\n`;
  data.items.forEach((i) => { msg += `▪ ${i.name} × ${i.qty} = ${fmtPKR(i.price * i.qty)}\n`; });
  msg += `━━━━━━━━━━━━━━━━━━━\n`;
  if (data.discount > 0) msg += `🏷️ رعایت: -${fmtPKR(data.discount)}\n`;
  msg += `💰 *کل رقم: ${fmtPKR(data.total)}*\n✅ *ادا شدہ: ${fmtPKR(paidAmt)}*\n`;
  if (balance > 0) msg += `🔴 *باقی رقم (ادھار): ${fmtPKR(balance)}*\n`;
  else if (balance < 0) msg += `🟢 *واپسی: ${fmtPKR(Math.abs(balance))}*\n`;
  else msg += `🟢 *مکمل ادائیگی ہو گئی*\n`;
  msg += `\n🙏 شکریہ! آپ کا دوبارہ خیرمقدم ہے۔`;
  let phone = String(data.customerPhone).replace(/\D/g, '');
  if (phone.startsWith('0')) phone = '92' + phone.substring(1);
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}
