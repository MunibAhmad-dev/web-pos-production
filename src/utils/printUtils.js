// Print utilities for Manufacturing ERP
// Thermal: 72mm receipt | Formal: A4 invoice

export function getPrinterSettings() {
  try {
    return JSON.parse(localStorage.getItem('mfg_printer_settings') || '{}');
  } catch { return {}; }
}

export function savePrinterSettings(settings) {
  localStorage.setItem('mfg_printer_settings', JSON.stringify(settings));
}

// ── Thermal Receipt ──────────────────────────────────────────────────────────

export function buildThermalHtml(data = {}) {
  const s  = getPrinterSettings();
  const {
    storeName    = s.store_name    || 'Manufacturing ERP',
    address      = s.store_address || '',
    phone        = s.store_phone   || '',
    footer       = s.receipt_footer || 'Thank you for your business!',
    invoiceNo    = 'INV-001',
    date         = new Date().toLocaleString('en-PK'),
    customer     = '',
    items        = [],
    subtotal     = 0,
    discount     = 0,
    total        = 0,
    paid         = 0,
    paymentMethod = 'Cash',
  } = data;

  const balance = total - paid;
  const change  = paid > total ? paid - total : 0;

  const rows = items.map(it => `
    <tr>
      <td>${it.qty || 1}</td>
      <td class="item-name">${it.name || ''}</td>
      <td class="right">Rs.${Number(it.amount || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  @page { size: 72mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { margin:0; padding:5mm 4mm; width:64mm; font-family:'Courier New',Courier,monospace; font-size:11px; color:#000; background:#fff; }
  h2 { margin:0 0 1px; font-size:14px; text-align:center; }
  p  { margin:1px 0; text-align:center; font-size:10px; }
  .bold  { font-weight:bold; }
  .center{ text-align:center; }
  .right { text-align:right; }
  hr { border:none; border-top:1px dashed #000; margin:4px 0; }
  table { width:100%; border-collapse:collapse; }
  td { padding:1px 0; vertical-align:top; }
  td.right { text-align:right; }
  .item-name { max-width:110px; word-break:break-word; }
  .total-row td { font-weight:bold; font-size:13px; border-top:1px solid #000; padding-top:2px; }
  .meta { font-size:10px; margin:1px 0; }
</style>
</head><body>
  <h2>${storeName}</h2>
  ${address ? `<p>${address}</p>` : ''}
  ${phone   ? `<p>Tel: ${phone}</p>` : ''}
  <hr>
  <p class="meta bold center">${invoiceNo}</p>
  <p class="meta center">${date}</p>
  ${customer ? `<p class="meta center">Customer: ${customer}</p>` : ''}
  <hr>
  <table>
    <thead><tr><th style="text-align:left">QTY</th><th style="text-align:left">ITEM</th><th style="text-align:right">AMT</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="3" style="text-align:center">— No items —</td></tr>'}</tbody>
  </table>
  <hr>
  <table>
    <tr><td>Subtotal</td><td class="right">Rs.${Number(subtotal).toLocaleString('en-PK',{maximumFractionDigits:0})}</td></tr>
    ${Number(discount) > 0 ? `<tr><td>Discount</td><td class="right">- Rs.${Number(discount).toLocaleString('en-PK',{maximumFractionDigits:0})}</td></tr>` : ''}
    <tr class="total-row"><td>TOTAL</td><td class="right">Rs.${Number(total).toLocaleString('en-PK',{maximumFractionDigits:0})}</td></tr>
    <tr><td>Amount Paid</td><td class="right">Rs.${Number(paid).toLocaleString('en-PK',{maximumFractionDigits:0})}</td></tr>
    ${change > 0   ? `<tr><td>Change Due</td><td class="right">Rs.${Number(change).toLocaleString('en-PK',{maximumFractionDigits:0})}</td></tr>` : ''}
    ${balance > 0  ? `<tr><td>Balance</td><td class="right bold">Rs.${Number(balance).toLocaleString('en-PK',{maximumFractionDigits:0})}</td></tr>` : ''}
    <tr><td>Payment</td><td class="right">${paymentMethod}</td></tr>
  </table>
  <hr>
  <p>${footer}</p>
  <p style="font-size:9px;margin-top:3px;">Software by OsaTech · +923298748232</p>
  <script>window.onload=()=>window.print();</script>
</body></html>`;
}

export function printThermal(data = {}) {
  const html = buildThermalHtml(data);
  const win  = window.open('', '_blank', 'width=340,height=600,toolbar=0,location=0,menubar=0');
  if (!win) { alert('Allow pop-ups to print receipts.'); return; }
  win.document.write(html);
  win.document.close();
}

// ── Formal A4 Invoice ────────────────────────────────────────────────────────

export function buildFormalHtml(data = {}) {
  const s  = getPrinterSettings();
  const {
    storeName    = s.store_name    || 'Manufacturing Company',
    address      = s.store_address || '',
    phone        = s.store_phone   || '',
    terms        = s.invoice_terms || 'Payment due within 30 days. No returns after 7 days.',
    invoiceNo    = 'INV-001',
    date         = new Date().toLocaleDateString('en-PK'),
    customerName = '',
    customerPhone = '',
    customerAddress = '',
    items        = [],
    subtotal     = 0,
    discount     = 0,
    total        = 0,
    paid         = 0,
  } = data;

  const balance = Math.max(0, total - paid);
  const MIN_ROWS = 8;
  const paddedItems = [...items];
  while (paddedItems.length < MIN_ROWS) paddedItems.push(null);

  const rows = paddedItems.map((it, i) => it
    ? `<tr>
        <td>${i + 1}</td>
        <td>${it.name || ''}</td>
        <td>${it.warranty || '—'}</td>
        <td style="text-align:center">${it.qty || 1}</td>
        <td style="text-align:right">Rs.${Number(it.unit_price || it.price || 0).toLocaleString('en-PK',{maximumFractionDigits:0})}</td>
        <td style="text-align:right">Rs.${Number(it.amount || 0).toLocaleString('en-PK',{maximumFractionDigits:0})}</td>
       </tr>`
    : `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin:0; padding:0; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color:#111; background:#fff; width:210mm; min-height:297mm; padding:10mm 12mm 8mm; }
  .hdr { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6mm; padding-bottom:4mm; border-bottom:2px solid #cc0000; }
  .hdr-left h1 { font-size:18pt; color:#cc0000; font-weight:900; margin-bottom:2px; }
  .hdr-left p  { font-size:9pt; color:#555; line-height:1.5; }
  .hdr-right   { text-align:right; }
  .hdr-right .inv-title { font-size:16pt; font-weight:900; color:#111; letter-spacing:2px; }
  .hdr-right .inv-meta  { font-size:9pt; color:#555; margin-top:3px; line-height:1.6; }
  .bill-bar { display:grid; grid-template-columns:1fr 1fr; gap:6mm; margin-bottom:5mm; background:#f9f9f9; border:1px solid #eee; padding:4mm; border-radius:2mm; }
  .bill-bar h3 { font-size:8pt; text-transform:uppercase; color:#cc0000; letter-spacing:1px; margin-bottom:3px; }
  .bill-bar p  { font-size:10pt; font-weight:600; }
  .bill-bar .sub { font-size:9pt; color:#555; font-weight:400; }
  table.items { width:100%; border-collapse:collapse; margin-bottom:5mm; }
  table.items thead tr { background:#cc0000; color:#fff; }
  table.items thead th { padding:4px 6px; font-size:9pt; font-weight:700; text-align:left; }
  table.items thead th:last-child, table.items thead th:nth-last-child(2) { text-align:right; }
  table.items thead th:nth-child(4) { text-align:center; }
  table.items tbody tr:nth-child(even) { background:#fafafa; }
  table.items tbody td { padding:4px 6px; font-size:9.5pt; border-bottom:1px solid #eee; }
  .bottom { display:grid; grid-template-columns:1fr 200px; gap:6mm; }
  .terms-box { border:1px solid #eee; padding:4mm; border-radius:2mm; }
  .terms-box h4 { font-size:8pt; text-transform:uppercase; color:#cc0000; margin-bottom:3px; letter-spacing:1px; }
  .terms-box p  { font-size:8.5pt; color:#555; line-height:1.5; }
  table.totals { width:100%; border-collapse:collapse; }
  table.totals td { padding:4px 6px; font-size:9.5pt; }
  table.totals td:last-child { text-align:right; }
  table.totals .grand { background:#cc0000; color:#fff; font-size:11pt; font-weight:700; }
  .sigs { display:grid; grid-template-columns:1fr 1fr 1fr; gap:4mm; margin-top:8mm; padding-top:3mm; border-top:1px solid #eee; }
  .sigs div { text-align:center; }
  .sigs .line { border-top:1px solid #111; margin-bottom:4px; }
  .sigs p { font-size:8pt; color:#555; }
</style>
</head><body>
  <div class="hdr">
    <div class="hdr-left">
      <h1>${storeName}</h1>
      ${address ? `<p>${address}</p>` : ''}
      ${phone   ? `<p>Tel: ${phone}</p>` : ''}
    </div>
    <div class="hdr-right">
      <div class="inv-title">INVOICE</div>
      <div class="inv-meta">
        No: <strong>${invoiceNo}</strong><br>
        Date: ${date}
      </div>
    </div>
  </div>

  <div class="bill-bar">
    <div>
      <h3>Bill To</h3>
      <p>${customerName || '—'}</p>
      ${customerPhone   ? `<p class="sub">Tel: ${customerPhone}</p>`    : ''}
      ${customerAddress ? `<p class="sub">${customerAddress}</p>` : ''}
    </div>
    <div>
      <h3>From</h3>
      <p>${storeName}</p>
      ${address ? `<p class="sub">${address}</p>` : ''}
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th style="width:28px">S.No</th>
        <th>Description</th>
        <th style="width:70px">Warranty</th>
        <th style="width:40px">Qty</th>
        <th style="width:90px">Unit Price</th>
        <th style="width:90px">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="bottom">
    <div class="terms-box">
      <h4>Terms &amp; Notes</h4>
      <p>${terms}</p>
    </div>
    <table class="totals">
      <tr><td>Amount</td><td>Rs.${Number(subtotal).toLocaleString('en-PK',{maximumFractionDigits:0})}</td></tr>
      ${Number(discount) > 0 ? `<tr><td>Discount</td><td>- Rs.${Number(discount).toLocaleString('en-PK',{maximumFractionDigits:0})}</td></tr>` : ''}
      <tr class="grand"><td>GRAND TOTAL</td><td>Rs.${Number(total).toLocaleString('en-PK',{maximumFractionDigits:0})}</td></tr>
      <tr><td>Paid</td><td>Rs.${Number(paid).toLocaleString('en-PK',{maximumFractionDigits:0})}</td></tr>
      <tr style="color:${balance>0?'#cc0000':'#16a34a'};font-weight:600"><td>Balance</td><td>Rs.${Number(balance).toLocaleString('en-PK',{maximumFractionDigits:0})}</td></tr>
    </table>
  </div>

  <div class="sigs">
    <div><div class="line"></div><p>Customer Signature</p></div>
    <div><div class="line"></div><p>Prepared By</p></div>
    <div><div class="line"></div><p>Authorized Signature</p></div>
  </div>

  <script>window.onload=()=>window.print();</script>
</body></html>`;
}

export function printFormal(data = {}) {
  const html = buildFormalHtml(data);
  const win  = window.open('', '_blank', 'width=900,height=700,toolbar=0,location=0,menubar=0');
  if (!win) { alert('Allow pop-ups to print invoices.'); return; }
  win.document.write(html);
  win.document.close();
}
