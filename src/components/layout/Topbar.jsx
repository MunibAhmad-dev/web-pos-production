import { useState, useMemo, useRef, useEffect } from 'react';
import { Menu, LogOut, Settings, Search, Bell, Package, AlertTriangle, BellRing, ChevronDown, Sun, Moon, Monitor, Info, Clock } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Link } from 'react-router-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useDataStore } from '@/store/dataStore';
import { useLowStockThreshold } from '@/hooks/useLowStockThreshold';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { navGroups } from './navConfig';
import { cn } from '@/lib/utils';

function NotificationBell({ udharCount = 0 }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const { list } = useDataStore();
  const threshold = useLowStockThreshold();

  const lowStockItems = useMemo(() => {
    const products = list('product');
    return products
      .filter((p) => Number(p.stock ?? 0) >= 0 && Number(p.stock ?? 0) <= threshold)
      .sort((a, b) => Number(a.stock ?? 0) - Number(b.stock ?? 0))
      .slice(0, 8);
  }, [list, threshold]);

  const today = new Date().toISOString().slice(0, 10);
  const overdueReminders = useMemo(() => {
    return list('payment_reminder').filter(
      (r) => (r.status === 'pending' || !r.status) && r.due_date && r.due_date < today
    );
  }, [list, today]);

  const totalCount = lowStockItems.length + udharCount + overdueReminders.length;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
          open && 'bg-accent text-foreground',
        )}
      >
        <Bell size={16} />
        {totalCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-border/60 bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            {totalCount > 0 && (
              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-bold text-red-500">
                {totalCount} alert{totalCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {totalCount === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <div className="rounded-xl bg-emerald-500/10 p-3">
                  <Bell size={18} className="text-emerald-500" />
                </div>
                <p className="text-sm font-medium text-foreground">All good</p>
                <p className="text-xs text-muted-foreground">No alerts right now</p>
              </div>
            ) : (
              <>
                {lowStockItems.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 bg-amber-500/5 px-4 py-2">
                      <AlertTriangle size={11} className="text-amber-500" />
                      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                        Low Stock — {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {lowStockItems.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 border-b border-border/30 px-4 py-2.5 last:border-0 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                          <Package size={13} className="text-amber-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                          <p className={cn('text-xs font-semibold', Number(p.stock) <= 0 ? 'text-red-500' : 'text-amber-500')}>
                            {Number(p.stock) <= 0 ? 'Out of stock' : `${p.stock} ${p.unit || 'units'} left`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {udharCount > 0 && (
                  <div>
                    <div className="flex items-center gap-2 bg-red-500/5 px-4 py-2">
                      <AlertTriangle size={11} className="text-red-500" />
                      <p className="text-[11px] font-bold uppercase tracking-wider text-red-600">
                        Udhar Due — {udharCount} customer{udharCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="px-4 py-3 text-sm text-muted-foreground">
                      {udharCount} customer{udharCount !== 1 ? 's have' : ' has'} overdue payments.
                    </div>
                  </div>
                )}

                {overdueReminders.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 bg-orange-500/5 px-4 py-2">
                      <BellRing size={11} className="text-orange-500" />
                      <p className="text-[11px] font-bold uppercase tracking-wider text-orange-600">
                        Payment Reminders — {overdueReminders.length} overdue
                      </p>
                    </div>
                    {overdueReminders.slice(0, 4).map((r) => (
                      <div key={r.id} className="flex items-center gap-3 border-b border-border/30 px-4 py-2.5 last:border-0 hover:bg-accent/50 transition-colors">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
                          <BellRing size={13} className="text-orange-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{r.title}</p>
                          {r.amount > 0 && (
                            <p className="text-xs font-semibold text-orange-600">PKR {Math.round(r.amount).toLocaleString('en-PK')} due</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {overdueReminders.length > 4 && (
                      <Link to="/payment-reminders" onClick={() => setOpen(false)} className="block px-4 py-2 text-xs text-center text-primary hover:underline">
                        View all {overdueReminders.length} reminders →
                      </Link>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const initials = (name = '') =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

function ThemeChoice() {
  const { theme, setTheme } = useTheme();
  const options = [['light', 'Light', Sun], ['dark', 'Dark', Moon], ['system', 'Auto', Monitor]];
  return (
    <div className="px-1.5 py-1.5">
      <p className="px-1 pb-1.5 text-[11px] font-medium text-muted-foreground">Theme</p>
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {options.map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTheme(key)}
            className={cn(
              'flex h-7 items-center justify-center gap-1 rounded-md text-xs font-medium transition-colors',
              (theme || 'system') === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const name = user?.owner_name || user?.store_name || 'Account';
  const days = typeof user?.days_remaining === 'number' ? user.days_remaining : null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Account menu"
            className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition-colors hover:bg-muted sm:pr-2.5"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(name)}</AvatarFallback>
            </Avatar>
            <span className="hidden min-w-0 text-left xl:block">
              <span className="block max-w-[140px] truncate text-[13px] font-semibold leading-tight text-foreground">{name}</span>
              <span className="block max-w-[140px] truncate text-[11px] leading-tight text-muted-foreground">{user?.store_name || 'Owner'}</span>
            </span>
            <ChevronDown size={14} className="hidden text-muted-foreground sm:block" />
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-64 p-1">
        <div className="flex items-center gap-3 px-2 py-2.5">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.store_name}</p>
            {user?.mobile && <p className="truncate text-xs text-muted-foreground tabular-nums">{user.mobile}</p>}
          </div>
        </div>
        {days !== null && (
          <div className={cn(
            'mx-1.5 mb-1.5 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs',
            days <= 14 ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'bg-muted text-muted-foreground'
          )}>
            <Clock size={13} className="shrink-0" />
            {days > 0 ? `Licence: ${days} day${days === 1 ? '' : 's'} left` : 'Licence expires today'}
          </div>
        )}
        <DropdownMenuSeparator />
        <ThemeChoice />
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/settings')} className="h-8 px-2">
          <Settings /> Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/about')} className="h-8 px-2">
          <Info /> About OsaTech
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} variant="destructive" className="h-8 px-2">
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Topbar({ onMenuClick, title, udharCount = 0 }) {
  const location = useLocation();
  const isMac = typeof navigator !== 'undefined' && navigator.platform?.toUpperCase().includes('MAC');
  const activeGroup = navGroups.find((g) => g.items.some((i) => i.to === location.pathname));
  const openSearch = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true }));

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border/70 bg-card/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open menu"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-muted lg:hidden"
      >
        <Menu size={18} />
      </button>

      <div className="min-w-0 flex-1">
        {activeGroup && activeGroup.placement !== 'footer' && (
          <p className="hidden text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground sm:block">{activeGroup.label}</p>
        )}
        <h1 className="truncate text-base font-semibold leading-tight tracking-tight text-foreground sm:text-lg">{title}</h1>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={openSearch}
          className="hidden h-9 w-60 items-center justify-between rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground transition-colors hover:border-foreground/20 md:flex"
        >
          <span className="flex items-center gap-2"><Search size={15} /> Search pages…</span>
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
        <button
          type="button"
          onClick={openSearch}
          aria-label="Search"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
        >
          <Search size={16} />
        </button>

        <NotificationBell udharCount={udharCount} />

        <div className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
        <ProfileMenu />
      </div>
    </header>
  );
}
