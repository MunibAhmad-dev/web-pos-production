import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MapPin, Phone, MessageCircle, CheckCircle2, Circle, Search,
  Download, Printer, SortAsc, Users, Wallet, TrendingDown,
  ChevronDown, Filter, RefreshCw, IndianRupee, ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '../../store/dataStore';
import { useToast } from '../../context/ToastContext';
import { isCancelled } from '@/lib/ledger';

const fmtPKR = (n) => 'PKR ' + Math.round(Number(n) || 0).toLocaleString('en-PK');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const today = new Date().toLocaleDateString('en-PK', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

const GRADIENTS = [
  { a: '#3b82f6', b: '#8b5cf6' }, { a: '#06b6d4', b: '#3b82f6' },
  { a: '#10b981', b: '#06b6d4' }, { a: '#f59e0b', b: '#ef4444' },
  { a: '#ec4899', b: '#8b5cf6' }, { a: '#6366f1', b: '#a78bfa' },
];
const getGrad = (name = '') => GRADIENTS[name.charCodeAt(0) % GRADIENTS.length];
function Avatar({ name = '' }) {
  const { a, b } = getGrad(name);
  return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 shadow-sm"
      style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── PDF Route Sheet Generator ────────────────────────────────────────────────
async function printRouteSheet(customers, collections, storeName = 'Store') {
  const html2pdf = (await import('html2pdf.js')).default;
  const rows = customers.map((c, i) => {
    const collected = Number(collections[c.id] || 0);
    return `<tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:8px 6px;text-align:center;color:#6b7280;font-size:11px">${i + 1}</td>
      <td style="padding:8px 6px;font-weight:700;font-size:12px">${c.name || ''}</td>
      <td style="padding:8px 6px;color:#374151;font-size:11px">${c.phone || '—'}</td>
      <td style="padding:8px 6px;color:#374151;font-size:11px;max-width:120px">${c.address || '—'}</td>
      <td style="padding:8px 6px;text-align:right;font-weight:700;color:#d97706;font-size:12px">${Math.round(c._balance).toLocaleString()}</td>
      <td style="padding:8px 6px;text-align:right;font-weight:700;color:#059669;font-size:12px">${collected > 0 ? Math.round(collected).toLocaleString() : ''}</td>
      <td style="padding:8px 6px;text-align:right;font-size:11px;color:#374151">${collected > 0 ? Math.round(c._balance - collected).toLocaleString() : ''}</td>
    </tr>`;
  }).join('');

  const totalBalance = customers.reduce((s, c) => s + c._balance, 0);
  const totalCollected = customers.reduce((s, c) => s + (Number(collections[c.id] || 0)), 0);

  const html = `<div style="font-family:Arial,sans-serif;padding:20px;color:#111">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1d4ed8;padding-bottom:12px;margin-bottom:16px">
      <div>
        <h1 style="margin:0;font-size:22px;font-weight:900;color:#1d4ed8">ROUTE BOOK</h1>
        <p style="margin:4px 0 0;font-size:13px;color:#374151;font-weight:700">${storeName}</p>
      </div>
      <div style="text-align:right">
        <p style="margin:0;font-size:12px;color:#6b7280">Date</p>
        <p style="margin:0;font-size:14px;font-weight:700">${today}</p>
        <p style="margin:4px 0 0;font-size:11px;color:#6b7280">${customers.length} customers · ${customers.filter(c => c._balance > 0).length} with balance</p>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
      <div style="background:#fef3c7;border-radius:8px;padding:12px;border:1px solid #f59e0b30">
        <p style="margin:0;font-size:10px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.05em">Total Outstanding</p>
        <p style="margin:4px 0 0;font-size:16px;font-weight:900;color:#d97706">PKR ${Math.round(totalBalance).toLocaleString()}</p>
      </div>
      <div style="background:#d1fae5;border-radius:8px;padding:12px;border:1px solid #10b98130">
        <p style="margin:0;font-size:10px;font-weight:700;color:#065f46;text-transform:uppercase;letter-spacing:.05em">Collected Today</p>
        <p style="margin:4px 0 0;font-size:16px;font-weight:900;color:#059669">PKR ${Math.round(totalCollected).toLocaleString()}</p>
      </div>
      <div style="background:#ede9fe;border-radius:8px;padding:12px;border:1px solid #8b5cf630">
        <p style="margin:0;font-size:10px;font-weight:700;color:#4c1d95;text-transform:uppercase;letter-spacing:.05em">Remaining</p>
        <p style="margin:4px 0 0;font-size:16px;font-weight:900;color:#7c3aed">PKR ${Math.round(totalBalance - totalCollected).toLocaleString()}</p>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <thead>
        <tr style="background:#1d4ed8;color:#fff">
          <th style="padding:8px 6px;text-align:center;font-size:11px;width:30px">#</th>
          <th style="padding:8px 6px;text-align:left;font-size:11px">Customer</th>
          <th style="padding:8px 6px;text-align:left;font-size:11px">Phone</th>
          <th style="padding:8px 6px;text-align:left;font-size:11px">Address</th>
          <th style="padding:8px 6px;text-align:right;font-size:11px">Balance (PKR)</th>
          <th style="padding:8px 6px;text-align:right;font-size:11px">Collected (PKR)</th>
          <th style="padding:8px 6px;text-align:right;font-size:11px">Remaining (PKR)</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#f3f4f6;font-weight:900;border-top:2px solid #e5e7eb">
          <td colspan="4" style="padding:8px 6px;text-align:right;font-size:12px">TOTAL</td>
          <td style="padding:8px 6px;text-align:right;color:#d97706;font-size:13px">${Math.round(totalBalance).toLocaleString()}</td>
          <td style="padding:8px 6px;text-align:right;color:#059669;font-size:13px">${Math.round(totalCollected).toLocaleString()}</td>
          <td style="padding:8px 6px;text-align:right;color:#7c3aed;font-size:13px">${Math.round(totalBalance - totalCollected).toLocaleString()}</td>
        </tr>
      </tfoot>
    </table>
    <p style="margin-top:16px;font-size:10px;color:#9ca3af;text-align:center">Generated by OsaTech POS · ${today}</p>
  </div>`;

  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.appendChild(el);
  await html2pdf().set({
    margin: 10, filename: `Route-Book-${new Date().toISOString().slice(0, 10)}.pdf`,
    html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
  }).from(el).save();
  document.body.removeChild(el);
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RouteBookPage() {
  const navigate = useNavigate();
  const { list, pushEntity } = useDataStore();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('balance');  // 'balance' | 'name' | 'area'
  const [filterMode, setFilterMode] = useState('with_balance'); // 'all' | 'with_balance'
  const [collections, setCollections] = useState({});
  const [visited, setVisited] = useState({});
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const customers   = list('customer');
  const allSales    = list('sale');
  const allPayments = list('customer_payment');
  const allReturns  = list('sale_return');

  const settings = useMemo(() => {
    try { return list('settings')?.[0] || {}; } catch { return {}; }
  }, [list]);
  const storeName = settings.store_name || settings.business_name || 'My Store';

  // Build balance map
  const enriched = useMemo(() => {
    return customers.map((c) => {
      const cid = String(c.id);
      const taken   = allSales.filter(s => String(s.customer_id) === cid && !isCancelled(s)).reduce((a, s) => a + (Number(s.total) || 0), 0);
      const paid    = allPayments.filter(p => String(p.customer_id) === cid).reduce((a, p) => a + (Number(p.amount) || 0), 0);
      const ret     = allReturns.filter(r => String(r.customer_id) === cid).reduce((a, r) => a + (Number(r.total_returned) || 0), 0);
      const balance = Math.max(0, taken - paid - ret);
      return { ...c, _balance: balance };
    });
  }, [customers, allSales, allPayments, allReturns]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list_ = enriched.filter(c =>
      (filterMode === 'all' || c._balance > 0.5) &&
      (!q || c.name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.address?.toLowerCase().includes(q))
    );
    if (sortBy === 'balance') list_.sort((a, b) => b._balance - a._balance);
    else if (sortBy === 'name') list_.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    else if (sortBy === 'area') list_.sort((a, b) => (a.address || '').localeCompare(b.address || ''));
    return list_;
  }, [enriched, search, sortBy, filterMode]);

  const totalBalance   = filtered.reduce((s, c) => s + c._balance, 0);
  const totalCollected = filtered.reduce((s, c) => s + (Number(collections[c.id] || 0)), 0);
  const visitedCount   = Object.values(visited).filter(Boolean).length;

  const toggleVisited = (id) => setVisited(p => ({ ...p, [id]: !p[id] }));

  const saveCollections = async () => {
    const entries = Object.entries(collections).filter(([, v]) => Number(v) > 0);
    if (!entries.length) { showToast('No collections entered', 'error'); return; }
    setSaving(true);
    try {
      for (const [customerId, amount] of entries) {
        const amt = Number(amount);
        if (!amt || amt <= 0) continue;
        const cust = enriched.find(c => String(c.id) === String(customerId));
        if (!cust) continue;
        await pushEntity('customer_payment', 'create', {
          customer_id: Number(customerId),
          amount: amt,
          date_added: new Date().toISOString(),
          notes: `Route collection — ${today}`,
        });
        await pushEntity('customer', 'update', {
          ...cust,
          outstanding_balance: Math.max(0, (cust.outstanding_balance || 0) - amt),
          updated_at: new Date().toISOString(),
        });
      }
      showToast(`${entries.length} collection(s) saved`);
      setCollections({});
    } catch (err) { showToast(err.message || 'Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      await printRouteSheet(filtered, collections, storeName);
      showToast('Route sheet exported');
    } catch (err) { showToast(err.message || 'Export failed', 'error'); }
    finally { setExporting(false); }
  };

  const sendWhatsApp = (c) => {
    if (!c.phone) { showToast("Customer has no phone number", 'error'); return; }
    let num = c.phone.replace(/[^0-9]/g, '');
    if (num.startsWith('0')) num = '92' + num.substring(1);
    const msg = `*Collection Notice — ${storeName}*\n\nHello *${c.name}*,\nYour outstanding balance is *PKR ${Math.round(c._balance).toLocaleString()}*.\n\nKindly arrange payment. Thank you!`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/customers')}
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-border bg-background hover:bg-muted transition-colors text-muted-foreground"
            title="Back to Customers">
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/15"><MapPin size={18} className="text-blue-500" /></div>
              <h1 className="text-2xl font-black tracking-tight">Route Book</h1>
            </div>
            <p className="text-xs font-medium text-muted-foreground ml-[52px]">{today}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {Object.values(collections).some(v => Number(v) > 0) && (
            <button onClick={saveCollections} disabled={saving}
              className="flex items-center gap-2 h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors shadow-sm disabled:opacity-50">
              <CheckCircle2 size={14} />{saving ? 'Saving…' : `Save Collections (PKR ${Math.round(totalCollected).toLocaleString()})`}
            </button>
          )}
          <button onClick={handleExportPDF} disabled={exporting}
            className="flex items-center gap-2 h-9 px-4 rounded-xl border border-border bg-background hover:bg-muted text-sm font-semibold transition-colors">
            {exporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
            {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </motion.div>

      {/* ── KPI Cards ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Customers', value: filtered.length, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/8 border-blue-500/15' },
          { label: 'Outstanding', value: fmtPKR(totalBalance), icon: Wallet, color: 'text-amber-500', bg: 'bg-amber-500/8 border-amber-500/15' },
          { label: 'Collected Today', value: fmtPKR(totalCollected), icon: TrendingDown, color: 'text-emerald-500', bg: 'bg-emerald-500/8 border-emerald-500/15' },
          { label: 'Visited', value: `${visitedCount} / ${filtered.length}`, icon: CheckCircle2, color: 'text-violet-500', bg: 'bg-violet-500/8 border-violet-500/15' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={cn('rounded-xl border p-4', bg)}>
            <div className="flex items-center gap-2 mb-2"><Icon size={14} className={color} /><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p></div>
            <p className={cn('text-xl font-black tabular-nums', color)}>{value}</p>
          </div>
        ))}
      </motion.div>

      {/* ── Controls ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone or area…"
            className="w-full h-9 pl-10 pr-4 text-sm border border-border/60 rounded-xl bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div className="flex gap-2">
          <select value={filterMode} onChange={e => setFilterMode(e.target.value)}
            className="h-9 px-3 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="with_balance">With Balance</option>
            <option value="all">All Customers</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="h-9 px-3 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="balance">Sort: Balance</option>
            <option value="name">Sort: Name</option>
            <option value="area">Sort: Area</option>
          </select>
        </div>
      </motion.div>

      {/* ── Customer List ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground rounded-2xl border border-border/50 bg-card">
          <Users size={44} className="opacity-10" />
          <p className="font-semibold text-sm">{search ? 'No matching customers' : 'No customers with outstanding balance'}</p>
          <p className="text-xs opacity-60">Try changing the filter above</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c, i) => {
            const isVisited = !!visited[c.id];
            const amt = collections[c.id] || '';
            const collectedAmt = Number(amt);
            const remainAfter = Math.max(0, c._balance - collectedAmt);

            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.03 }}
                className={cn('flex gap-3 rounded-2xl border p-4 transition-all',
                  isVisited ? 'bg-emerald-500/4 border-emerald-500/20' : 'bg-card border-border/50 hover:border-border')}>

                {/* Visited toggle */}
                <button onClick={() => toggleVisited(c.id)} className="mt-0.5 shrink-0">
                  {isVisited
                    ? <CheckCircle2 size={20} className="text-emerald-500" />
                    : <Circle size={20} className="text-muted-foreground/30 hover:text-muted-foreground transition-colors" />}
                </button>

                {/* Avatar */}
                <Avatar name={c.name} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={cn('font-black text-sm truncate', isVisited && 'line-through text-muted-foreground')}>{c.name}</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">#{i + 1}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {c.phone && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Phone size={10} />{c.phone}</span>}
                        {c.address && <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={10} className="shrink-0" /><span className="truncate max-w-[150px]">{c.address}</span></span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Balance</p>
                      <p className="text-sm font-black text-amber-600 tabular-nums">{fmtPKR(c._balance)}</p>
                    </div>
                  </div>

                  {/* Collection input + actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground pointer-events-none">PKR</span>
                      <input type="number" min="0" max={c._balance}
                        value={amt}
                        onChange={e => setCollections(p => ({ ...p, [c.id]: e.target.value }))}
                        placeholder={Math.round(c._balance).toLocaleString()}
                        className="h-8 pl-8 pr-2 w-36 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-emerald-500/40 tabular-nums" />
                    </div>
                    {collectedAmt > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-emerald-600">−{fmtPKR(collectedAmt)}</span>
                        <span className="text-[10px] text-muted-foreground">→</span>
                        <span className="text-[10px] font-bold text-rose-600">{fmtPKR(remainAfter)}</span>
                      </div>
                    )}
                    {c.phone && (
                      <button onClick={() => sendWhatsApp(c)}
                        className="h-8 w-8 rounded-full bg-[#25d366] flex items-center justify-center text-white hover:bg-[#1fba57] transition-colors shrink-0">
                        <MessageCircle size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Sticky Save Bar ── */}
      {Object.values(collections).some(v => Number(v) > 0) && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <motion.div initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            className="flex items-center gap-3 bg-card border border-border/80 rounded-2xl shadow-2xl px-5 py-3">
            <div className="text-center">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Collection</p>
              <p className="text-lg font-black text-emerald-600 tabular-nums">{fmtPKR(totalCollected)}</p>
            </div>
            <button onClick={saveCollections} disabled={saving}
              className="flex items-center gap-2 h-10 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors shadow-sm disabled:opacity-50">
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {saving ? 'Saving…' : 'Save All Collections'}
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
