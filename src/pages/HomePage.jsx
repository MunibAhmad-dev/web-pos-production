import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useAuth } from '../context/AuthContext';
import {
  Sun, Moon, Store, ArrowRight, Factory, Scissors, MessageCircle, ScanBarcode,
  BookOpen, Boxes, Pill, Wallet, Cloud, WifiOff, Receipt, Package, ChevronDown,
  Check, Users, Laptop, Smartphone, RefreshCw, Printer, Menu, X, Mail,
} from 'lucide-react';

const WHATSAPP_NUMBER = '923298748232';
const CONTACT_EMAIL = 'munibahmad4735@gmail.com';
const waLink = (msg) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;

/* ── Small building blocks ───────────────────────────────────────────────── */

function Logo({ small = false }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className={`${small ? 'w-7 h-7 rounded-lg' : 'w-9 h-9 rounded-xl'} bg-primary text-primary-foreground inline-flex items-center justify-center shadow-sm`}>
        <Store size={small ? 14 : 17} strokeWidth={2.2} />
      </span>
      <span className={`font-display font-extrabold tracking-tight text-foreground ${small ? 'text-[15px]' : 'text-lg'}`}>OsaTech</span>
    </span>
  );
}

function ThemeButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="w-9 h-9 rounded-lg border border-border bg-card/70 text-muted-foreground hover:text-foreground inline-flex items-center justify-center transition-colors"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function SignInMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="h-9 px-3.5 rounded-lg text-sm font-semibold text-foreground hover:bg-muted inline-flex items-center gap-1.5 transition-colors"
      >
        Sign in <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full pt-2 z-50">
          <div className="w-64 rounded-xl border border-border bg-popover p-1.5 shadow-xl">
            <Link to="/login" className="flex items-start gap-3 rounded-lg p-2.5 hover:bg-muted transition-colors">
              <span className="mt-0.5 w-8 h-8 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center shrink-0"><Store size={15} /></span>
              <span>
                <span className="block text-sm font-semibold text-foreground">Retail POS</span>
                <span className="block text-xs text-muted-foreground">Your shop's web dashboard</span>
              </span>
            </Link>
            <Link to="/manufacturing/login" className="flex items-start gap-3 rounded-lg p-2.5 hover:bg-muted transition-colors">
              <span className="mt-0.5 w-8 h-8 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 inline-flex items-center justify-center shrink-0"><Factory size={15} /></span>
              <span>
                <span className="block text-sm font-semibold text-foreground">Factory ERP</span>
                <span className="block text-xs text-muted-foreground">Manufacturing &amp; parts</span>
              </span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Eyebrow({ children }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{children}</p>;
}

/* ── Product mock: the web dashboard, built in HTML so it stays sharp ───── */

function DashboardMock() {
  const bars = [42, 58, 47, 66, 54, 78, 61, 72, 69, 88, 74, 92];
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[32px] bg-gradient-to-br from-primary/15 via-transparent to-emerald-500/10 blur-2xl" aria-hidden="true" />
      <div className="relative rounded-2xl border border-border bg-card shadow-2xl shadow-slate-900/10 dark:shadow-black/40 overflow-hidden">
        {/* window chrome */}
        <div className="flex items-center gap-2 px-4 h-10 border-b border-border bg-muted/50">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span className="ml-3 h-6 flex-1 max-w-[260px] rounded-md bg-background border border-border text-[11px] text-muted-foreground flex items-center px-2.5">
            OsaTech · Web dashboard
          </span>
        </div>

        <div className="p-5 grid gap-4">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Today’s sales', 'Rs. 84,200', '+14%'],
              ['Gross profit', 'Rs. 21,950', '26% margin'],
              ['Khata due', 'Rs. 1.2L', '38 customers'],
            ].map(([label, value, note]) => (
              <div key={label} className="rounded-xl border border-border p-3">
                <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
                <p className="mt-1 text-[13px] sm:text-[15px] font-bold tabular-nums text-foreground whitespace-nowrap">{value}</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">{note}</p>
              </div>
            ))}
          </div>

          {/* chart + invoices */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div className="sm:col-span-3 rounded-xl border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-foreground">Sales, last 12 days</p>
                <p className="text-[10px] text-muted-foreground">PKR</p>
              </div>
              <div className="mt-3 h-24 flex items-end gap-1.5">
                {bars.map((h, i) => (
                  <div key={i} className={`flex-1 rounded-t ${i === bars.length - 1 ? 'bg-primary' : 'bg-primary/25'}`} style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
            <div className="sm:col-span-2 rounded-xl border border-border p-3">
              <p className="text-[11px] font-semibold text-foreground">Recent invoices</p>
              <ul className="mt-2 space-y-2">
                {[['Ali Traders', 'Rs. 12,400', 'Paid'], ['Walk-in', 'Rs. 1,850', 'Paid'], ['Rana Store', 'Rs. 32,000', 'Khata']].map(([n, a, s]) => (
                  <li key={n} className="flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block text-[11px] font-medium text-foreground truncate">{n}</span>
                      <span className="block text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">{a}</span>
                    </span>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${s === 'Paid' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'}`}>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* floating receipt */}
      <div className="hidden sm:block absolute -bottom-32 right-8 w-44 rotate-[3deg] rounded-xl border border-border bg-card shadow-xl p-3.5 font-mono">
        <p className="text-center text-[10px] font-bold text-foreground tracking-wide">AL-MADINA STORE</p>
        <p className="text-center text-[9px] text-muted-foreground">INV-2026320-1042</p>
        <div className="my-2 border-t border-dashed border-border" />
        {[['Basmati 5kg', '2,450'], ['Cooking oil 3L', '1,980'], ['Sugar 2kg', '360']].map(([n, p]) => (
          <p key={n} className="flex justify-between text-[9px] text-muted-foreground"><span>{n}</span><span className="tabular-nums">{p}</span></p>
        ))}
        <div className="my-2 border-t border-dashed border-border" />
        <p className="flex justify-between text-[10px] font-bold text-foreground"><span>TOTAL</span><span className="tabular-nums">Rs. 4,790</span></p>
      </div>

      {/* floating offline badge */}
      <div className="hidden sm:flex absolute -top-4 -right-4 items-center gap-2 rounded-full border border-border bg-card shadow-lg px-3 py-1.5">
        <span className="relative flex w-2 h-2"><span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" /><span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" /></span>
        <span className="text-[11px] font-semibold text-foreground">Synced 2 min ago</span>
      </div>
    </div>
  );
}

/* ── Khata mock for the feature section ─────────────────────────────────── */

function KhataMock() {
  const rows = [
    ['12 Nov', 'Invoice 1031', '18,500', '', '18,500'],
    ['14 Nov', 'Cash paid', '', '10,000', '8,500'],
    ['15 Nov', 'Invoice 1038', '6,200', '', '14,700'],
    ['17 Nov', 'Return', '', '1,700', '13,000'],
  ];
  return (
    <div className="rounded-xl border border-border bg-background/60 overflow-hidden text-[11px]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="font-semibold text-foreground">Rana General Store</span>
        <span className="text-muted-foreground">Statement · Nov</span>
      </div>
      <div className="grid grid-cols-[40px_minmax(0,1fr)_46px_46px_50px] gap-x-2 px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border">
        <span>Date</span><span>Detail</span><span className="text-right">Debit</span><span className="text-right">Credit</span><span className="text-right">Bal.</span>
      </div>
      {rows.map(([d, t, dr, cr, bal]) => (
        <div key={d + t} className="grid grid-cols-[40px_minmax(0,1fr)_46px_46px_50px] gap-x-2 px-3 py-1.5 border-b border-border/60 last:border-0 tabular-nums">
          <span className="text-muted-foreground">{d}</span>
          <span className="text-foreground truncate">{t}</span>
          <span className="text-right text-foreground">{dr}</span>
          <span className="text-right text-emerald-600 dark:text-emerald-400">{cr}</span>
          <span className="text-right font-semibold text-foreground">{bal}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

const FEATURES = [
  { icon: ScanBarcode, title: 'Fast counter checkout', body: 'Scan a barcode or search by name, take cash, card or credit, and print a thermal receipt in seconds.' },
  { icon: Boxes, title: 'Wholesale in cartons', body: 'Sell by carton and loose box with the right price for each. Stock stays correct either way.' },
  { icon: Pill, title: 'Pharmacy batches & expiry', body: 'Pick the batch at sale time, see what expires soon, and keep each batch’s own price.' },
  { icon: Package, title: 'Purchases & stock', body: 'Record vendor bills, returns and stock adjustments. Low-stock alerts before shelves go empty.' },
  { icon: Wallet, title: 'Cash, bank & daily close', body: 'Every sale, expense and payment lands in the right account. Close the register with a one-page report.' },
  { icon: Users, title: 'Staff, payroll & partners', body: 'Salaries, advances (udhar), attendance, and each partner’s share of the profit and drawings.' },
];

const BUSINESS_TYPES = ['General store', 'Wholesale', 'Pharmacy', 'Bakery', 'Dry fruits', 'Hardware', 'Grocery', 'Stationery'];

export default function HomePage() {
  const { user } = useAuth();
  const [mobileNav, setMobileNav] = useState(false);

  if (user?.approval_status === 'approved' && !user?.cloud_blocked) {
    return <Navigate to="/dashboard" replace />;
  }

  const year = new Date().getFullYear();

  return (
    <div className="min-h-full bg-background text-foreground overflow-x-hidden">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <nav className="mx-auto max-w-6xl px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          <Link to="/" aria-label="OsaTech home"><Logo /></Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#apps" className="hover:text-foreground transition-colors">Apps</a>
            <a href="#contact" className="hover:text-foreground transition-colors">Contact</a>
          </div>
          <div className="flex items-center gap-2">
            <ThemeButton />
            <div className="hidden sm:block"><SignInMenu /></div>
            <Link to="/register" className="hidden sm:inline-flex h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold items-center gap-1.5 hover:opacity-90 transition-opacity shadow-sm">
              Register your store
            </Link>
            <button type="button" className="sm:hidden w-9 h-9 rounded-lg border border-border inline-flex items-center justify-center text-foreground"
              onClick={() => setMobileNav(v => !v)} aria-label="Menu" aria-expanded={mobileNav}>
              {mobileNav ? <X size={17} /> : <Menu size={17} />}
            </button>
          </div>
        </nav>
        {mobileNav && (
          <div className="sm:hidden border-t border-border bg-background px-5 py-4 grid gap-1 text-sm">
            {[['#features', 'Features'], ['#how', 'How it works'], ['#apps', 'Apps'], ['#contact', 'Contact']].map(([h, l]) => (
              <a key={h} href={h} onClick={() => setMobileNav(false)} className="py-2 text-muted-foreground">{l}</a>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link to="/login" className="h-10 rounded-lg border border-border inline-flex items-center justify-center font-semibold">Sign in</Link>
              <Link to="/register" className="h-10 rounded-lg bg-primary text-primary-foreground inline-flex items-center justify-center font-semibold">Register</Link>
            </div>
            <Link to="/manufacturing/login" className="mt-1 py-2 text-xs text-muted-foreground">Factory ERP sign in →</Link>
          </div>
        )}
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative">
        <div className="absolute inset-0 -z-0 pointer-events-none [background:radial-gradient(60%_50%_at_75%_10%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent_70%)]" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-5 sm:px-8 pt-14 pb-24 sm:pt-20 lg:pt-24 grid gap-14 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground">
              <WifiOff size={13} className="text-primary" /> Works offline at the counter · syncs when online
            </span>
            <h1 className="mt-6 font-display text-[40px] leading-[1.05] sm:text-6xl font-extrabold tracking-tight text-balance">
              Run your shop.<br />
              <span className="text-primary">Check it from anywhere.</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground max-w-[34rem] text-pretty">
              OsaTech is point-of-sale and bookkeeping for shops in Pakistan. Billing, khata, stock and cash run on
              the counter PC, even when the internet doesn’t. You see every sale and balance live on the web.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/register" className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-semibold inline-flex items-center gap-2 shadow-lg shadow-primary/25 hover:opacity-95 transition-opacity">
                Register your store <ArrowRight size={17} />
              </Link>
              <Link to="/login" className="h-12 px-6 rounded-xl border border-border bg-card font-semibold text-foreground inline-flex items-center gap-2 hover:bg-muted transition-colors">
                Sign in to Web POS
              </Link>
            </div>
            <ul className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              {[
                [Receipt, 'Thermal & A4 receipts'],
                [BookOpen, 'Customer & vendor khata'],
                [RefreshCw, 'Desktop + web, one account'],
              ].map(([Icon, label]) => (
                <li key={label} className="flex items-center gap-2 text-muted-foreground">
                  <Icon size={15} className="text-primary shrink-0" /> {label}
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:pl-4 sm:pb-20">
            <DashboardMock />
          </div>
        </div>
      </section>

      {/* ── Built for ───────────────────────────────────────────────────── */}
      <section className="border-y border-border bg-card/50">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 py-7 flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
          <p className="text-sm font-medium text-muted-foreground shrink-0">Set up for</p>
          <ul className="flex flex-wrap gap-2">
            {BUSINESS_TYPES.map(t => (
              <li key={t} className="rounded-full border border-border bg-background px-3 py-1 text-sm text-foreground">{t}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-6xl px-5 sm:px-8 py-20 sm:py-28">
        <div className="max-w-2xl">
          <Eyebrow>Features</Eyebrow>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-balance">Everything the counter needs, and the books behind it</h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">Built with shopkeepers, for how a Pakistani shop actually runs: credit customers, carton prices, the day’s cash, and the owner checking in from home.</p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {/* khata, wide */}
          <article className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 sm:p-7 grid gap-6 md:grid-cols-[1fr_1.15fr] md:items-center">
            <div>
              <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary inline-flex items-center justify-center"><BookOpen size={19} /></span>
              <h3 className="mt-4 text-lg font-bold text-foreground">Khata that keeps itself</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Credit sales, payments and returns post to each customer’s ledger automatically. Share a statement on
                WhatsApp for any week, month or custom dates.
              </p>
              <ul className="mt-4 grid gap-1.5 text-sm text-foreground">
                {['Running balance per customer and vendor', 'Partial payments and advances', 'Statement as PDF or image'].map(f => (
                  <li key={f} className="flex items-center gap-2"><Check size={15} className="text-primary shrink-0" />{f}</li>
                ))}
              </ul>
            </div>
            <KhataMock />
          </article>

          {/* offline */}
          <article className="rounded-2xl bg-sky-700 dark:bg-sky-800 text-white p-6 sm:p-7 flex flex-col">
            <span className="w-10 h-10 rounded-xl bg-white/15 inline-flex items-center justify-center"><WifiOff size={19} /></span>
            <h3 className="mt-4 text-lg font-bold">No internet? Keep selling.</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/85">
              The counter app runs on your own PC. Sales are saved locally and uploaded as soon as the connection is back.
            </p>
            <div className="mt-auto pt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-white/10 p-3"><p className="text-white/70 text-xs">Counter</p><p className="font-semibold">Always on</p></div>
              <div className="rounded-xl bg-white/10 p-3"><p className="text-white/70 text-xs">Cloud</p><p className="font-semibold">Auto-sync</p></div>
            </div>
          </article>

          {FEATURES.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-2xl border border-border bg-card p-6 sm:p-7">
              <span className="w-10 h-10 rounded-xl bg-muted text-foreground inline-flex items-center justify-center"><Icon size={19} /></span>
              <h3 className="mt-4 text-base font-bold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section id="how" className="border-t border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 py-20 sm:py-28">
          <div className="max-w-2xl">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-balance">Counter PC in the shop. Your phone in your pocket.</h2>
          </div>
          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              [Laptop, 'Bill at the counter', 'Install OsaTech POS on the shop PC. Add your products and start billing on the first day, with or without internet.'],
              [Cloud, 'It syncs to your account', 'Sales, payments, stock and expenses upload to your private cloud account in the background.'],
              [Smartphone, 'Check from anywhere', 'Open the web dashboard from any phone or laptop: today’s sales, profit, khata and stock, live.'],
            ].map(([Icon, title, body], i) => (
              <li key={title} className="relative rounded-2xl border border-border bg-background p-6 sm:p-7">
                <div className="flex items-center justify-between">
                  <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary inline-flex items-center justify-center"><Icon size={19} /></span>
                  <span className="font-display text-4xl font-extrabold text-muted-foreground/25 tabular-nums">0{i + 1}</span>
                </div>
                <h3 className="mt-4 text-base font-bold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Apps ────────────────────────────────────────────────────────── */}
      <section id="apps" className="mx-auto max-w-6xl px-5 sm:px-8 py-20 sm:py-28">
        <div className="max-w-2xl">
          <Eyebrow>Apps</Eyebrow>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold tracking-tight">One company, three tools</h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">Pick the one built for your trade.</p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Store, tone: 'bg-primary/10 text-primary', name: 'Retail POS', kind: 'Desktop + web',
              body: 'Billing, khata, stock, purchases, accounts and reports for shops, wholesalers and pharmacies.',
              cta: { to: '/login', label: 'Sign in' }, primary: true,
            },
            {
              icon: Factory, tone: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', name: 'Factory ERP', kind: 'Desktop + web',
              body: 'For assemble-to-order makers: bills of materials used up on every sale, parts stock and vendor payables.',
              cta: { to: '/manufacturing/login', label: 'Sign in' },
            },
            {
              icon: Scissors, tone: 'bg-teal-500/10 text-teal-600 dark:text-teal-400', name: 'Tailor App', kind: 'Desktop',
              body: 'Saved measurements for every customer, orders from received to delivered, advances and balance due.',
              cta: { href: waLink('Hi, I’d like to know more about the OsaTech Tailor App.'), label: 'Ask on WhatsApp' },
            },
          ].map(app => (
            <article key={app.name} className={`rounded-2xl border bg-card p-6 sm:p-7 flex flex-col ${app.primary ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border'}`}>
              <div className="flex items-center justify-between">
                <span className={`w-10 h-10 rounded-xl inline-flex items-center justify-center ${app.tone}`}><app.icon size={19} /></span>
                <span className="text-[11px] font-medium text-muted-foreground rounded-full border border-border px-2 py-0.5">{app.kind}</span>
              </div>
              <h3 className="mt-4 text-lg font-bold text-foreground">{app.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground flex-1">{app.body}</p>
              {app.cta.to ? (
                <Link to={app.cta.to} className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2.5 transition-all">
                  {app.cta.label} <ArrowRight size={15} />
                </Link>
              ) : (
                <a href={app.cta.href} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2.5 transition-all">
                  {app.cta.label} <ArrowRight size={15} />
                </a>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* ── CTA + contact ───────────────────────────────────────────────── */}
      <section id="contact" className="mx-auto max-w-6xl px-5 sm:px-8 pb-20 sm:pb-28">
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 dark:bg-card dark:border dark:border-border px-6 py-12 sm:px-12 sm:py-16">
          <div className="absolute -right-24 -top-24 w-80 h-80 rounded-full bg-primary/30 blur-3xl pointer-events-none" aria-hidden="true" />
          <div className="relative grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white text-balance">Put your shop on OsaTech this week.</h2>
              <p className="mt-4 text-slate-300 leading-relaxed max-w-xl">
                Register your store, and we’ll help you set up products, opening stock and khata balances.
                Questions first? Message us. A real person replies.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/register" className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-semibold inline-flex items-center gap-2 hover:opacity-95 transition-opacity">
                  Register your store <ArrowRight size={17} />
                </Link>
                <a href={waLink('Hi, I’m interested in OsaTech POS for my shop.')} target="_blank" rel="noopener noreferrer"
                  className="h-12 px-6 rounded-xl bg-white/10 text-white font-semibold inline-flex items-center gap-2 hover:bg-white/15 transition-colors">
                  <MessageCircle size={17} /> Chat on WhatsApp
                </a>
              </div>
            </div>
            <dl className="grid gap-4 text-sm">
              {[
                [MessageCircle, 'WhatsApp', `+${WHATSAPP_NUMBER.slice(0, 2)} ${WHATSAPP_NUMBER.slice(2, 5)} ${WHATSAPP_NUMBER.slice(5)}`],
                [Mail, 'Email', CONTACT_EMAIL],
                [Printer, 'Works with', 'Thermal 58/80 mm, A4 printers & barcode scanners'],
              ].map(([Icon, label, value]) => (
                <div key={label} className="flex items-start gap-3 rounded-xl bg-white/5 border border-white/10 p-4">
                  <Icon size={16} className="text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <dt className="text-xs text-slate-400">{label}</dt>
                    <dd className="text-white font-medium break-words select-all">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo small />
          <p className="text-xs text-muted-foreground">© {year} OsaTech. Point of sale and bookkeeping for shops.</p>
          <div className="flex items-center gap-5 text-sm">
            <Link to="/register" className="text-muted-foreground hover:text-foreground transition-colors">Register</Link>
            <Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors">Sign in</Link>
            <Link to="/manufacturing/login" className="text-muted-foreground hover:text-foreground transition-colors">Factory ERP</Link>
          </div>
        </div>
      </footer>

      {/* ── WhatsApp ────────────────────────────────────────────────────── */}
      <a
        href={waLink('Hi, I’m interested in OsaTech POS.')}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us on WhatsApp"
        className="fixed bottom-5 right-5 z-50 w-13 h-13 w-[52px] h-[52px] rounded-full bg-[#25D366] text-white inline-flex items-center justify-center shadow-lg shadow-emerald-600/30 hover:scale-105 transition-transform"
      >
        <MessageCircle size={24} fill="currentColor" />
      </a>
    </div>
  );
}
