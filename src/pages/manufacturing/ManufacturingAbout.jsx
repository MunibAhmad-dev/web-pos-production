import {
  Wind, Code2, Smartphone, Mail, MessageCircle, Globe,
  Database, Cpu, Server, Layers, Shield, Zap, Package,
  Users, Wallet, ShoppingCart, BarChart3, FileText, Settings,
  Truck, Receipt, CheckCircle2, Star, Award, ExternalLink,
} from 'lucide-react';

const MODULES = [
  { icon: ShoppingCart,  label: 'Sell (POS)',          desc: 'Sell air coolers and parts with invoice generation' },
  { icon: Package,       label: 'Buy Stock',           desc: 'Purchase raw parts and manage incoming inventory' },
  { icon: Layers,        label: 'Parts Inventory',     desc: 'Track motors, capacitors, frames, and all components' },
  { icon: Wind,          label: 'Products (Air Coolers)', desc: 'BOM-based product management with buildable computation' },
  { icon: Truck,         label: 'Vendors',             desc: 'Supplier profiles, purchase history, outstanding balances' },
  { icon: Users,         label: 'Customers',           desc: 'Customer ledger, sale history, and due amounts' },
  { icon: Wallet,        label: 'Accounting',          desc: 'Account balances, ledger entries, bank transfers' },
  { icon: Receipt,       label: 'Expenses',            desc: 'Operational costs with account debit integration' },
  { icon: FileText,      label: 'Invoices',            desc: 'Thermal 72mm receipts and A4 formal invoices' },
  { icon: BarChart3,     label: 'Reports',             desc: 'Sales, purchases, profits, and inventory reports' },
  { icon: Database,      label: 'Google Drive Backup', desc: 'One-click JSON backup to your Google Drive' },
  { icon: Settings,      label: 'Settings',            desc: 'Printer config, store info, invoice branding' },
];

const TECH_STACK = [
  { layer: 'Frontend',  items: ['React 19', 'Vite', 'Tailwind CSS', 'shadcn/ui', 'React Router 7'] },
  { layer: 'Backend',   items: ['Node.js', 'Express', 'TypeScript', 'Prisma ORM', 'PostgreSQL'] },
  { layer: 'Cloud',     items: ['osatechcloud.cloud', 'Event-Sourced Sync', 'Bearer Auth', 'REST API'] },
  { layer: 'Desktop',   items: ['Electron 41', 'SQLite 3', 'better-sqlite3', 'IPC Bridge', 'Offline-First'] },
];

export default function ManufacturingAbout() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">

      {/* Hero card */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg,#1e1b4b 0%,#312e81 40%,#4c1d95 100%)' }}>
        <div className="px-8 py-8 text-white">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                  <Wind size={24} className="text-violet-300" />
                </div>
                <div>
                  <div className="font-black text-xl tracking-tight">Manufacturing ERP</div>
                  <div className="text-violet-300 text-sm">Air Cooler Production Management</div>
                </div>
              </div>
              <div className="space-y-1 text-sm text-white/80">
                <p>Cloud-connected factory ERP for Pakistani air cooler manufacturers</p>
                <p>Works alongside the Electron desktop app — same data, any device</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-white">v1.0</div>
              <div className="text-xs text-violet-300 mt-0.5">Web Edition · 2026</div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Modules', value: '12+' },
              { label: 'Platform', value: 'Web + Desktop' },
              { label: 'Database', value: 'PostgreSQL Cloud' },
              { label: 'Sync', value: 'Real-time' },
            ].map(s => (
              <div key={s.label}>
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-violet-300 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Developer card */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-black text-2xl shrink-0">
            M
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold">Munib Ahmad</h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-semibold">
                <Award size={10} /> OsaTech
              </span>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">Software Developer · Full Stack Engineer</p>
            <p className="text-sm mt-2 text-muted-foreground">
              Building complete business management software for Pakistani shops and factories.
              Specializing in offline-first Electron apps and cloud-synced web dashboards.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href="https://wa.me/923298748232"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
              >
                <MessageCircle size={14} /> WhatsApp · 0329-8748232
              </a>
              <a
                href="mailto:munibahmadvfx@gmail.com"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border hover:bg-muted transition-colors"
              >
                <Mail size={14} /> munibahmadvfx@gmail.com
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Modules grid */}
      <div className="rounded-2xl border bg-card p-6">
        <h3 className="font-bold text-base mb-4 flex items-center gap-2"><Layers size={16} className="text-violet-500" /> Business Modules</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MODULES.map(m => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                  <Icon size={15} className="text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tech stack */}
      <div className="rounded-2xl border bg-card p-6">
        <h3 className="font-bold text-base mb-4 flex items-center gap-2"><Cpu size={16} className="text-blue-500" /> Technical Architecture</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TECH_STACK.map(t => (
            <div key={t.layer} className="p-4 rounded-xl border bg-muted/20">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">{t.layer}</p>
              <div className="flex flex-wrap gap-1.5">
                {t.items.map(item => (
                  <span key={item} className="px-2 py-0.5 rounded-md text-xs font-medium bg-background border">{item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How sync works */}
      <div className="rounded-2xl border bg-card p-6">
        <h3 className="font-bold text-base mb-3 flex items-center gap-2"><Zap size={16} className="text-amber-500" /> How Cloud Sync Works</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2"><CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" /><span>The Electron desktop app works fully offline with a local SQLite database</span></div>
          <div className="flex items-start gap-2"><CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" /><span>Every change is pushed to the cloud as a sync event (entity_type + operation + payload)</span></div>
          <div className="flex items-start gap-2"><CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" /><span>This web app reads the same events — last-write-wins per entity ID</span></div>
          <div className="flex items-start gap-2"><CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" /><span>Web app changes are written back as sync events and downloaded by the desktop on next sync</span></div>
          <div className="flex items-start gap-2"><CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" /><span>Web-created IDs use timestamp-based values (14+ digits) — never collide with desktop sequential IDs</span></div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4">
        <p className="text-xs text-muted-foreground">© 2026 Munib Ahmad · OsaTech. All rights reserved.</p>
        <p className="text-xs text-muted-foreground mt-1">Manufacturing ERP Web Edition · Built with React 19 + Express + PostgreSQL</p>
      </div>
    </div>
  );
}
