import {
  Store, Code2, Smartphone, Mail, MessageCircle,
  Database, Cpu, Server, Layers, Shield, Zap, Package,
  Users, Wallet, ShoppingCart, BarChart3, FileText, Settings,
  Truck, Receipt, CheckCircle2, Award, Wrench, CreditCard,
} from 'lucide-react';

const MODULES = [
  { icon: ShoppingCart, label: 'POS (New Sale)',          desc: 'Fast sale entry with receipt generation' },
  { icon: Package,      label: 'Inventory & Products',    desc: 'Stock management, batch tracking, adjustments' },
  { icon: Truck,        label: 'Vendors & Purchases',     desc: 'Supplier profiles, POs, outstanding balances' },
  { icon: Users,        label: 'Customers',               desc: 'Customer ledger, khata, route book, reminders' },
  { icon: Wallet,       label: 'Expenses & Godown',       desc: 'Operational costs and store godown log' },
  { icon: Database,     label: 'Accounts & Finance',      desc: 'Account balances, ledger, bank transfers' },
  { icon: CreditCard,   label: 'Cash Register',           desc: 'Session-based cash tracking with history' },
  { icon: Receipt,      label: 'FBR e-Invoicing',         desc: 'Real-time invoice submission to FBR' },
  { icon: Wrench,       label: 'Repair Jobs',             desc: 'Mobile repair shop job management' },
  { icon: FileText,     label: 'Invoices',                desc: 'Unified view of all sales and purchase orders' },
  { icon: BarChart3,    label: 'Reports & Balance Sheet', desc: 'Sales, purchases, profits, and balance sheet' },
  { icon: Settings,     label: 'Settings',                desc: 'Printer config, store info, invoice branding' },
];

const TECH_STACK = [
  { layer: 'Frontend',  items: ['React 19', 'Vite', 'Tailwind CSS v4', 'shadcn/ui', 'React Router 7', 'Framer Motion'] },
  { layer: 'Storage',   items: ['IndexedDB', 'Event-Sourced Sync', 'Offline-First', 'CRDT-Style Merge'] },
  { layer: 'Cloud',     items: ['Node.js', 'Express', 'PostgreSQL', 'Prisma ORM', 'osatechcloud.cloud'] },
  { layer: 'Desktop',   items: ['Electron', 'SQLite 3', 'better-sqlite3', 'IPC Bridge', 'Auto-Update'] },
];

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">

      {/* Hero */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 40%,#1a1a3e 100%)' }}>
        <div className="px-8 py-8 text-white">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                  <Store size={24} className="text-sky-300" />
                </div>
                <div>
                  <div className="font-black text-xl tracking-tight">OsaTech POS</div>
                  <div className="text-sky-300 text-sm">Retail Shop Management System</div>
                </div>
              </div>
              <div className="space-y-1 text-sm text-white/80">
                <p>Offline-first cloud-synced POS for Pakistani retail shops</p>
                <p>Web portal · works alongside the Electron desktop app</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-white">v2.0</div>
              <div className="text-xs text-sky-300 mt-0.5">Web Edition · 2026</div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Modules',   value: '12+' },
              { label: 'Platform',  value: 'Web + Desktop' },
              { label: 'Sync',      value: 'Real-time' },
              { label: 'Offline',   value: 'Full Support' },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-sky-300 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Developer */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-black text-2xl shrink-0">
            M
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold">Munib Ahmad</h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-semibold">
                <Award size={10} /> OsaTech
              </span>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">Software Developer · Full Stack Engineer</p>
            <p className="text-sm mt-2 text-muted-foreground">
              Building complete business management software for Pakistani shops.
              Specializing in offline-first Electron apps and cloud-synced web dashboards.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href="https://wa.me/923298748232" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors">
                <MessageCircle size={14} /> WhatsApp · 0329-8748232
              </a>
              <a href="mailto:munibahmadvfx@gmail.com"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border hover:bg-muted transition-colors">
                <Mail size={14} /> munibahmadvfx@gmail.com
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Modules */}
      <div className="rounded-2xl border bg-card p-6">
        <h3 className="font-bold text-base mb-4 flex items-center gap-2"><Layers size={16} className="text-sky-500" /> Business Modules</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MODULES.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center shrink-0">
                  <Icon size={15} className="text-sky-600 dark:text-sky-400" />
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
          {TECH_STACK.map((t) => (
            <div key={t.layer} className="p-4 rounded-xl border bg-muted/20">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">{t.layer}</p>
              <div className="flex flex-wrap gap-1.5">
                {t.items.map((item) => (
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
          {[
            'The Electron desktop app works fully offline with a local SQLite database',
            'Every change is pushed to the cloud as a sync event (entity_type + operation + payload)',
            'This web portal reads the same events — last-write-wins per entity ID',
            'Web portal changes sync back to the desktop on next pull',
            'Web-created IDs use timestamp-based values (14+ digits) — never collide with desktop sequential IDs',
          ].map((line) => (
            <div key={line} className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" /><span>{line}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4">
        <p className="text-xs text-muted-foreground">© 2026 Munib Ahmad · OsaTech. All rights reserved.</p>
        <p className="text-xs text-muted-foreground mt-1">OsaTech POS Web Edition · Built with React 19 + Express + PostgreSQL</p>
      </div>
    </div>
  );
}
