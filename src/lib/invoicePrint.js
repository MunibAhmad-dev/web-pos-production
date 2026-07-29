// Web-safe port of the Electron app's print.ts
// No window.api.* calls — uses window.open() + window.print() instead.

const STATUS_COLORS = {
  success:     { bg: '#dcfce7', fg: '#15803d' },
  warning:     { bg: '#fef3c7', fg: '#b45309' },
  destructive: { bg: '#fee2e2', fg: '#b91c1c' },
};

function buildFormalHtml(opts) {
  const accent = opts.accentColor || '#2563eb';
  const itemsHtml = opts.items.map((i, idx) => `
    <tr>
      <td class="idx">${idx + 1}</td>
      <td>
        <div class="item-name">${i.name}</div>
        ${i.tag ? `<span class="item-tag">${i.tag}</span>` : ''}
      </td>
      <td class="num">${i.qty}${i.unit ? ' ' + i.unit : ''}</td>
      <td class="num">Rs. ${Math.round(i.unitPrice).toLocaleString()}</td>
      <td class="num strong">Rs. ${Math.round(i.total).toLocaleString()}</td>
    </tr>
  `).join('');

  const totalsHtml = opts.totals.map(t => `
    <div class="${t.emphasis ? 'grand' : ''} ${t.tone === 'muted' ? 'muted-row' : ''}">
      <span>${t.label}</span><span>Rs. ${Math.round(t.value).toLocaleString()}</span>
    </div>
  `).join('');

  const statusColor = opts.status ? STATUS_COLORS[opts.status.tone] : null;

  return `<html><head><title>${opts.docType} ${opts.docNumber}</title><style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; max-width: 820px; margin: 0 auto; }
    .topbar { height: 6px; background: ${accent}; border-radius: 6px; margin-bottom: 24px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
    .brand h1 { font-size: 21px; margin: 0 0 4px; letter-spacing: -0.02em; }
    .brand .muted { color: #64748b; font-size: 12px; line-height: 1.5; }
    .doc-meta { text-align: right; }
    .doc-type { display: inline-block; background: ${accent}1a; color: ${accent}; font-weight: 700; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; padding: 5px 12px; border-radius: 999px; margin-bottom: 8px; }
    .doc-meta .muted { color: #64748b; font-size: 12px; margin-top: 2px; }
    .doc-meta .num { font-weight: 700; font-size: 14px; color: #1e293b; }
    .party-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; margin-bottom: 20px; }
    .party-box .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; margin-bottom: 4px; }
    .party-box .name { font-size: 15px; font-weight: 700; }
    .party-box .muted { color: #64748b; font-size: 12px; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    thead th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; }
    tbody td { padding: 12px 10px; font-size: 13px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .idx { color: #cbd5e1; font-size: 11px; width: 24px; }
    .item-name { font-weight: 600; }
    .item-tag { display: inline-block; margin-top: 3px; font-size: 10px; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 1px 7px; border-radius: 999px; }
    .num { text-align: right; white-space: nowrap; }
    .strong { font-weight: 700; }
    .totals { margin-top: 16px; width: 300px; margin-left: auto; }
    .totals > div { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
    .totals .muted-row { color: #64748b; }
    .totals .grand { font-weight: 800; font-size: 17px; border-top: 2px solid #1e293b; margin-top: 8px; padding-top: 10px; color: ${accent}; }
    .status-row { display: flex; justify-content: flex-end; margin-top: 10px; }
    .status-badge { display: inline-block; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 999px; ${statusColor ? `background:${statusColor.bg}; color:${statusColor.fg};` : ''} }
    .footer { margin-top: 36px; padding-top: 16px; border-top: 1px dashed #cbd5e1; text-align: center; }
    .footer .thanks { font-weight: 600; font-size: 13px; margin-bottom: 4px; }
    .footer .muted { color: #94a3b8; font-size: 11px; }
    @media print { body { padding: 12px; } }
  </style></head><body>
    <div class="topbar"></div>
    <div class="header">
      <div class="brand">
        <h1>${opts.company.name || 'Factory ERP'}</h1>
        <div class="muted">${opts.company.address || ''}${opts.company.address && opts.company.phone ? ' · ' : ''}${opts.company.phone || ''}</div>
      </div>
      <div class="doc-meta">
        <div class="doc-type">${opts.docType}</div>
        <div class="num">#${opts.docNumber}</div>
        <div class="muted">${opts.date}</div>
      </div>
    </div>
    ${opts.party ? `<div class="party-box"><div class="label">${opts.party.label}</div><div class="name">${opts.party.name}</div>${opts.party.phone || opts.party.address ? `<div class="muted">${[opts.party.phone, opts.party.address].filter(Boolean).join(' · ')}</div>` : ''}</div>` : ''}
    <table>
      <thead><tr><th></th><th>Item</th><th class="num">Qty</th><th class="num">Unit Price</th><th class="num">Amount</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div class="totals">${totalsHtml}</div>
    ${opts.status ? `<div class="status-row"><span class="status-badge">${opts.status.label}</span></div>` : ''}
    ${opts.notes ? `<div style="margin-top:16px;font-size:12px;color:#64748b;background:#f8fafc;border-radius:8px;padding:10px 14px;">${opts.notes}</div>` : ''}
    <div class="footer"><div class="thanks">Thank you for your business</div><div class="muted">Generated by ${opts.company.name || 'Factory ERP'}</div></div>
  </body></html>`;
}

export function buildThermalHtml(opts) {
  const itemsHtml = opts.items.map(i => `
    <tr>
      <td class="qty">${i.qty}${i.unit || ''}</td>
      <td class="name">${i.name}${i.tag ? `<div class="tag">${i.tag}</div>` : ''}<div class="rate">@ Rs. ${Math.round(i.unitPrice).toLocaleString()}</div></td>
      <td class="amt">${Math.round(i.total).toLocaleString()}</td>
    </tr>
  `).join('');

  const totalsHtml = opts.totals.map(t => `
    <div class="${t.emphasis ? 'grand' : 'trow'}"><span>${t.label}</span><span>Rs. ${Math.round(t.value).toLocaleString()}</span></div>
  `).join('');

  return `<html><head><title>${opts.docType} ${opts.docNumber}</title><style>
    * { box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; width: 300px; margin: 0 auto; padding: 16px; color: #111; font-size: 12px; }
    h2 { text-align: center; font-size: 15px; margin: 0 0 2px; }
    .center { text-align: center; }
    .muted { color: #444; }
    .dashed { border-top: 1px dashed #999; margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    thead th { text-align: left; font-weight: 800; border-top: 2px solid #111; border-bottom: 2px solid #111; padding: 4px 2px; font-size: 11px; }
    .qty { text-align: center; width: 14%; }
    .amt { text-align: right; width: 24%; white-space: nowrap; }
    tbody td { padding: 5px 2px; border-bottom: 1px dashed #ccc; vertical-align: top; font-size: 11.5px; }
    .tag { font-size: 9px; color: #555; }
    .rate { font-size: 9.5px; color: #555; }
    .trow, .grand { display: flex; justify-content: space-between; padding: 2px 0; }
    .grand { font-weight: 800; font-size: 13px; border-top: 1px solid #111; margin-top: 4px; padding-top: 6px; }
    .status { text-align: center; font-weight: 700; margin-top: 8px; }
    .footer { text-align: center; margin-top: 14px; }
    @media print { body { padding: 4px; } }
  </style></head><body>
    <h2>${opts.company.name || 'Factory ERP'}</h2>
    ${opts.company.address ? `<p class="center muted">${opts.company.address}</p>` : ''}
    ${opts.company.phone ? `<p class="center muted">Tel: ${opts.company.phone}</p>` : ''}
    <div class="dashed"></div>
    <p class="center" style="font-weight:700">${opts.docType.toUpperCase()}: ${opts.docNumber}</p>
    <p class="center muted">${opts.date}</p>
    ${opts.party ? `<p class="center" style="margin-top:6px">${opts.party.label}: <b>${opts.party.name}</b></p>` : ''}
    <div class="dashed"></div>
    <table>
      <thead><tr><th class="qty">QTY</th><th>ITEM</th><th class="amt">AMT</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div class="dashed"></div>
    ${totalsHtml}
    ${opts.status ? `<p class="status">${opts.status.label}</p>` : ''}
    ${opts.notes ? `<p class="center muted" style="margin-top:6px">${opts.notes}</p>` : ''}
    <div class="dashed"></div>
    <p class="center">Thank you!</p>
    <p class="center muted">${opts.company.name || 'Factory ERP'}</p>
  </body></html>`;
}

export function buildInvoiceHtml(opts) {
  return opts.style === 'thermal' ? buildThermalHtml(opts) : buildFormalHtml(opts);
}

function openPrintWindow(html, style) {
  const win = window.open('', '_blank', style === 'thermal' ? 'width=380,height=700' : 'width=850,height=1000');
  if (!win) { alert('Pop-up blocked. Please allow pop-ups for this site to print.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

export function printInvoice(opts) {
  openPrintWindow(buildInvoiceHtml(opts), opts.style || 'formal');
}

export function whatsappShare(phone, message) {
  const cleaned = (phone || '').replace(/[^0-9]/g, '');
  const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}
