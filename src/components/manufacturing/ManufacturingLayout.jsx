import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Boxes, Package, ShoppingCart, Wallet, FileBarChart,
  Settings as SettingsIcon, Wind, Truck, Users, ShoppingBag, Sun, Moon,
  Receipt, FileText, LogOut, ChevronRight, Info, Shield, Menu, X,
  User, Phone, Key,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { useMfgAuth } from '../../context/ManufacturingAuthContext';

const sections = [
  { label: 'Overview', items: [
    { to: '/manufacturing/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/manufacturing/invoices',  label: 'Invoices',  icon: FileText },
    { to: '/manufacturing/reports',   label: 'Reports',   icon: FileBarChart },
  ]},
  { label: 'Operations', items: [
    { to: '/manufacturing/sales',     label: 'Sell',            icon: ShoppingCart },
    { to: '/manufacturing/purchases', label: 'Buy Stock',       icon: ShoppingBag },
    { to: '/manufacturing/parts',     label: 'Parts Inventory', icon: Boxes },
    { to: '/manufacturing/products',  label: 'Products',        icon: Package },
  ]},
  { label: 'Relationships', items: [
    { to: '/manufacturing/vendors',   label: 'Vendors',   icon: Truck },
    { to: '/manufacturing/customers', label: 'Customers', icon: Users },
  ]},
  { label: 'Money', items: [
    { to: '/manufacturing/accounting', label: 'Accounting', icon: Wallet },
    { to: '/manufacturing/expenses',   label: 'Expenses',   icon: Receipt },
  ]},
  { label: 'System', items: [
    { to: '/manufacturing/settings', label: 'Settings', icon: SettingsIcon },
    { to: '/manufacturing/license',  label: 'License',  icon: Shield },
    { to: '/manufacturing/about',    label: 'About',    icon: Info },
  ]},
];

const allItems = sections.flatMap(s => s.items);

function SidebarContent({ mfgUser, onClose, onLogout }) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-[68px] border-b border-border/60 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
          <Wind size={18} className="text-violet-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm leading-tight tracking-tight truncate">
            {mfgUser?.company_name || 'Factory ERP'}
          </div>
          <div className="text-[10px] text-muted-foreground">Manufacturing</div>
        </div>
        {/* Close button — mobile only */}
        {onClose && (
          <button onClick={onClose} className="md:hidden p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-3 overflow-y-auto">
        {sections.map(section => (
          <div key={section.label}>
            <div className="px-3 mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors',
                      isActive
                        ? 'bg-violet-500/10 text-violet-700 dark:text-violet-400'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-violet-600" />
                      )}
                      <Icon size={16} className="shrink-0" />
                      <span className={cn('truncate', isActive && 'font-semibold')}>{label}</span>
                      {isActive && <ChevronRight size={12} className="ml-auto shrink-0 opacity-40" />}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User + footer */}
      <div className="px-3 py-3 border-t border-border/60 space-y-1">
        {mfgUser?.mobile && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">
            Logged in as <span className="font-semibold text-foreground">{mfgUser.mobile}</span>
          </div>
        )}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function ManufacturingLayout() {
  const { mfgUser, mfgLogout } = useMfgAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [now, setNow] = useState(new Date());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pwDlg, setPwDlg] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const profileRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function handler(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const handleLogout = () => {
    mfgLogout();
    navigate('/manufacturing/login');
  };

  const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const pageLabel = allItems.find(i => location.pathname === i.to)?.label || 'Factory ERP';

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">

      {/* ── Desktop sidebar (md+) ─────────────────────── */}
      <aside className="hidden md:flex w-64 bg-card text-card-foreground border-r border-border/60 flex-col shrink-0">
        <SidebarContent mfgUser={mfgUser} onLogout={handleLogout} />
      </aside>

      {/* ── Mobile drawer backdrop ────────────────────── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile drawer panel ───────────────────────── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-card text-card-foreground border-r border-border/60 flex flex-col md:hidden transition-transform duration-300',
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarContent mfgUser={mfgUser} onClose={() => setDrawerOpen(false)} onLogout={handleLogout} />
      </aside>

      {/* ── Main area ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Header */}
        <header className="h-[60px] md:h-[68px] border-b border-border/60 bg-card flex items-center justify-between px-4 md:px-6 shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="md:hidden p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors shrink-0"
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <h2 className="font-semibold text-base md:text-lg leading-tight truncate">{pageLabel}</h2>
              <p className="text-[10px] md:text-[11px] text-muted-foreground hidden sm:block truncate">{dateStr}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
            >
              {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Profile button */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(p => !p)}
                className="w-9 h-9 rounded-full bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-600 hover:bg-violet-500/20 transition-colors"
                title="Profile"
              >
                <User size={16} />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-11 z-50 w-64 rounded-xl border bg-popover shadow-2xl py-1 overflow-hidden">
                  <div className="px-4 py-3 border-b bg-muted/30">
                    <p className="font-bold text-sm truncate">{mfgUser?.company_name || 'Factory ERP'}</p>
                    {mfgUser?.mobile && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        <Phone size={10} /> {mfgUser.mobile}
                      </p>
                    )}
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => { setPwDlg(true); setProfileOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
                    >
                      <Key size={14} className="text-muted-foreground" /> Change Password
                    </button>
                    <button
                      onClick={() => { handleLogout(); setProfileOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                    >
                      <LogOut size={14} /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Change Password dialog */}
          {pwDlg && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="w-full max-w-xs rounded-2xl border bg-background shadow-2xl p-6">
                <h3 className="font-bold text-base mb-4 flex items-center gap-2"><Key size={16} className="text-violet-500" /> Change Password</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Current Password</label>
                    <input type="password" value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} className="w-full h-9 rounded-md border bg-background px-3 text-sm" placeholder="Current password" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">New Password</label>
                    <input type="password" value={pwForm.next} onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} className="w-full h-9 rounded-md border bg-background px-3 text-sm" placeholder="New password" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Confirm New Password</label>
                    <input type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} className="w-full h-9 rounded-md border bg-background px-3 text-sm" placeholder="Confirm new password" />
                  </div>
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={() => { setPwDlg(false); setPwForm({ current: '', next: '', confirm: '' }); }} className="flex-1 h-9 rounded-lg border text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
                  <button
                    onClick={() => {
                      if (!pwForm.current || !pwForm.next) return;
                      if (pwForm.next !== pwForm.confirm) { alert('Passwords do not match'); return; }
                      setPwDlg(false);
                      setPwForm({ current: '', next: '', confirm: '' });
                    }}
                    className="flex-1 h-9 rounded-lg text-sm font-medium text-white transition-colors"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
