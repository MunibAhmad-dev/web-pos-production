import { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatDateTime } from '../../utils/format';

// ── Print helpers ─────────────────────────────────────────────────────────────
function buildUdharReportHtml({ employee, rows }) {
  const fmt = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
  const balance = rows.length > 0 ? rows[rows.length - 1].running : 0;
  const fmtDate = (d) => {
    try { return new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return '—'; }
  };

  const tableRows = rows.map(r => `
    <tr>
      <td>${fmtDate(r.date_added)}</td>
      <td class="${r.type === 'advance' ? 'red' : 'green'}">${r.type === 'advance' ? 'Advance' : 'Repaid'}</td>
      <td>${r.description || '—'}</td>
      <td class="num ${r.type === 'advance' ? 'red' : 'green'}">${r.type === 'advance' ? '+' : '-'}${fmt(r.amount)}</td>
      <td class="num">${fmt(r.running)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Udhar Statement — ${employee.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, system-ui, sans-serif; padding: 20px; background: #fffbeb; }
  .card { max-width: 580px; margin: 0 auto; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,.1); }
  .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #fff; padding: 24px; }
  .header h1 { font-size: 20px; font-weight: 700; }
  .header p { font-size: 12px; opacity: .85; margin-top: 3px; }
  .balance-strip { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; background: ${balance > 0 ? '#fef2f2' : '#f0fdf4'}; border-bottom: 1px solid ${balance > 0 ? '#fecaca' : '#bbf7d0'}; }
  .balance-label { font-size: 13px; font-weight: 600; color: ${balance > 0 ? '#dc2626' : '#16a34a'}; }
  .balance-value { font-size: 20px; font-weight: 800; color: ${balance > 0 ? '#dc2626' : '#16a34a'}; font-variant-numeric: tabular-nums; }
  table { width: 100%; border-collapse: collapse; background: #fff; }
  thead { background: #f9fafb; }
  th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; padding: 10px 14px; border-bottom: 1px solid #f3f4f6; }
  td { font-size: 12px; padding: 10px 14px; border-bottom: 1px solid #f9fafb; color: #374151; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  td.red { color: #dc2626; }
  td.green { color: #16a34a; }
  .footer { text-align: center; font-size: 11px; color: #9ca3af; padding: 10px; background: #fafafa; }
  @media print { body { background: none; } .card { box-shadow: none; } }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1>Udhar Statement — ${employee.name}</h1>
    <p>Generated on ${new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
  </div>
  <div class="balance-strip">
    <span class="balance-label">${balance > 0 ? 'Currently Owes' : balance < 0 ? 'Credit Balance' : 'Clear'}</span>
    <span class="balance-value">${balance !== 0 ? fmt(Math.abs(balance)) : '—'}</span>
  </div>
  <table>
    <thead>
      <tr><th>Date</th><th>Type</th><th>Description</th><th style="text-align:right">Amount</th><th style="text-align:right">Balance</th></tr>
    </thead>
    <tbody>${tableRows || '<tr><td colspan="5" style="text-align:center;padding:20px;color:#9ca3af">No records</td></tr>'}</tbody>
  </table>
  <div class="footer">OsaTech POS</div>
</div>
<script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;
}

function buildSalarySlipHtml({ employee, expense }) {
  const fmt = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
  const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' }); } catch { return '—'; } };
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Salary Slip</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, system-ui, sans-serif; background: #f0fdf4; display: flex; justify-content: center; padding: 20px; }
  .slip { width: 380px; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,.12); }
  .header { background: linear-gradient(135deg, #10b981, #059669); color: #fff; padding: 28px 24px 22px; text-align: center; }
  .header h1 { font-size: 22px; font-weight: 700; } .header .date { font-size: 12px; opacity: .8; margin-top: 4px; }
  .avatar { width: 52px; height: 52px; border-radius: 50%; background: rgba(255,255,255,.25); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; font-size: 22px; font-weight: 700; }
  .body { background: #fff; padding: 20px; }
  .row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
  .row:last-child { border-bottom: none; }
  .label { color: #6b7280; } .value { font-weight: 600; }
  .total { background: #f0fdf4; border-radius: 10px; padding: 14px 16px; margin-top: 14px; display: flex; justify-content: space-between; align-items: center; }
  .total-label { color: #065f46; font-weight: 700; } .total-value { color: #059669; font-size: 22px; font-weight: 800; }
  .footer { text-align: center; font-size: 11px; color: #9ca3af; padding: 12px 20px; background: #fafafa; border-top: 1px solid #f3f4f6; }
  @media print { body { background: none; padding: 0; } .slip { box-shadow: none; } }
</style></head><body>
<div class="slip">
  <div class="header">
    <div class="avatar">${(employee.name || 'E').charAt(0).toUpperCase()}</div>
    <h1>Salary Slip</h1><div class="date">${fmtDate(expense.date_added)}</div>
  </div>
  <div class="body">
    <div class="row"><span class="label">Employee</span><span class="value">${employee.name}</span></div>
    ${employee.role ? `<div class="row"><span class="label">Role</span><span class="value">${employee.role}</span></div>` : ''}
    ${employee.phone ? `<div class="row"><span class="label">Phone</span><span class="value">${employee.phone}</span></div>` : ''}
    <div class="row"><span class="label">Date</span><span class="value">${fmtDate(expense.date_added)}</span></div>
    ${expense.notes ? `<div class="row"><span class="label">Notes</span><span class="value">${expense.notes}</span></div>` : ''}
    <div class="total"><span class="total-label">Net Salary Paid</span><span class="total-value">${fmt(expense.amount)}</span></div>
  </div>
  <div class="footer">OsaTech POS</div>
</div>
<script>window.onload = function() { window.print(); };<\/script>
</body></html>`;
}

function printHtml(html) {
  const w = window.open('', '_blank', 'width=520,height=720');
  if (w) { w.document.write(html); w.document.close(); }
}

function shareWhatsApp(text) {
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function EmployeeHistoryModal({ open, onClose, target, advances, salaryExpenses }) {
  const [tab, setTab] = useState('salary');

  useEffect(() => {
    if (target?.tab) setTab(target.tab);
  }, [target]);

  const employee = target?.employee;

  const salaryRows = useMemo(
    () =>
      (salaryExpenses || [])
        .filter((e) => String(e.employee_id) === String(employee?.id))
        .sort((a, b) => new Date(b.date_added || 0) - new Date(a.date_added || 0)),
    [salaryExpenses, employee]
  );

  const udharRows = useMemo(() => {
    const rows = (advances || [])
      .filter((a) => String(a.employee_id) === String(employee?.id))
      .sort((a, b) => new Date(a.date_added || 0) - new Date(b.date_added || 0));
    let running = 0;
    return rows.map((r) => {
      running += r.type === 'advance' ? Number(r.amount || 0) : -Number(r.amount || 0);
      return { ...r, running };
    });
  }, [advances, employee]);

  const currentBalance = udharRows.length > 0 ? udharRows[udharRows.length - 1].running : 0;
  const udharRowsDesc = [...udharRows].reverse();

  if (!target) return null;

  const handlePrintUdhar = () => {
    const html = buildUdharReportHtml({ employee, rows: udharRows });
    printHtml(html);
  };

  const handleWhatsAppUdhar = () => {
    const fmt = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
    let text = `*Udhar Statement — ${employee.name}*\n`;
    text += `Date: ${new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' })}\n`;
    text += `*Balance: ${currentBalance > 0 ? 'Owes ' : currentBalance < 0 ? 'Credit ' : ''}${fmt(Math.abs(currentBalance))}*\n\n`;
    for (const r of udharRowsDesc.slice(0, 10)) {
      const d = r.date_added ? new Date(r.date_added).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' }) : '—';
      text += `${d} ${r.type === 'advance' ? '▲' : '▼'} ${fmt(r.amount)} — ${r.description || r.type}\n`;
    }
    if (udharRowsDesc.length > 10) text += `…and ${udharRowsDesc.length - 10} more\n`;
    shareWhatsApp(text);
  };

  return (
    <Modal open={open} onClose={onClose} title={`${employee?.name} — History`} width="max-w-lg">
      <div className="mb-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="salary">Salary History</TabsTrigger>
            <TabsTrigger value="udhar">Udhar History</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === 'salary' ? (
        <div>
          {salaryRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No salary payments yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {salaryRows.map((e) => (
                <div key={e.id} className="flex items-center gap-2 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{e.title.replace(/^Salary\s*[—\-]\s*/i, '') || e.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(e.date_added)}</p>
                    {e.notes && <p className="text-xs text-muted-foreground italic">{e.notes}</p>}
                  </div>
                  <span className="text-sm font-bold text-emerald-600 font-mono">{formatCurrency(e.amount)}</span>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => printHtml(buildSalarySlipHtml({ employee, expense: e }))}
                      title="Print slip"
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-ink transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        const fmt = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
                        const d = e.date_added ? new Date(e.date_added).toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
                        const text = `*Salary Slip*\nEmployee: ${employee.name}${employee.role ? `\nRole: ${employee.role}` : ''}\nDate: ${d}${e.notes ? `\nNotes: ${e.notes}` : ''}\n\n*Amount Paid: ${fmt(e.amount)}*`;
                        shareWhatsApp(text);
                      }}
                      title="Share via WhatsApp"
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* Balance strip */}
          {udharRows.length > 0 && (
            <div className={`flex items-center justify-between rounded-xl px-4 py-3 mb-3 ${currentBalance > 0 ? 'bg-rose-500/5 border border-rose-500/20' : currentBalance < 0 ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-muted/30 border border-border'}`}>
              <span className={`text-sm font-semibold ${currentBalance > 0 ? 'text-rose-600' : currentBalance < 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                {currentBalance > 0 ? 'Currently Owes' : currentBalance < 0 ? 'Credit Balance' : 'No Balance'}
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-bold font-mono ${currentBalance > 0 ? 'text-rose-600' : currentBalance < 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                  {currentBalance !== 0 ? formatCurrency(Math.abs(currentBalance)) : '—'}
                </span>
                <button onClick={handlePrintUdhar} title="Print statement" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-ink transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                </button>
                <button onClick={handleWhatsAppUdhar} title="Share via WhatsApp" className="rounded-lg p-1.5 text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 transition-colors">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </button>
              </div>
            </div>
          )}

          {udharRowsDesc.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No udhar records yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {udharRowsDesc.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${a.type === 'advance' ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {a.type === 'advance' ? 'Advance' : 'Repaid'}
                      {a.deduct_from_salary == 1 && (
                        <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${a.salary_applied == 1 ? 'bg-muted text-muted-foreground' : 'bg-amber-500/10 text-amber-700'}`}>
                          {a.salary_applied == 1 ? 'deducted' : 'pending deduction'}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{a.description || '—'} · {formatDateTime(a.date_added)}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <span className={`text-sm font-bold font-mono ${a.type === 'advance' ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {a.type === 'advance' ? '+' : '-'}{formatCurrency(a.amount)}
                    </span>
                    <p className="text-xs text-muted-foreground">Bal: {formatCurrency(a.running)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
