import { useState, useMemo, useRef, useEffect } from 'react';
import { Menu, LogOut, Settings, Search, Bell, Package, AlertTriangle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useDataStore } from '@/store/dataStore';
import { useLowStockThreshold } from '@/hooks/useLowStockThreshold';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ThemeToggle from './ThemeToggle';
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

  const totalCount = lowStockItems.length + udharCount;

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
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const initials = (name = '') =>
  name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export default function Topbar({ onMenuClick, title, udharCount = 0 }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMac = typeof navigator !== 'undefined' && navigator.platform?.toUpperCase().includes('MAC');
  const activeGroup = navGroups.find((g) => g.items.some((i) => i.to === location.pathname));

  return (
    <header className="relative z-20 flex h-16 shrink-0 items-center justify-between border-b border-border/60 bg-card px-4 sm:px-6 md:h-[68px] md:px-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={onMenuClick} className="h-9 w-9 rounded-lg lg:hidden">
          <Menu size={18} />
        </Button>
        <div className="mx-1 hidden h-5 w-px bg-border/60 sm:block" />
        <div>
          <h1 className="max-w-[58vw] truncate text-base leading-none font-semibold tracking-tight text-foreground sm:max-w-none sm:text-lg">
            {title}
          </h1>
          <p className="mt-0.5 hidden text-[10px] text-muted-foreground/60 sm:block">
            {activeGroup ? `${activeGroup.emoji} ${activeGroup.label}` : '🏠 Core'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="hidden w-56 justify-between text-muted-foreground sm:flex"
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
        >
          <span className="flex items-center gap-2">
            <Search size={14} /> Search…
          </span>
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
            {isMac ? '⌘K' : 'Ctrl K'}
          </kbd>
        </Button>

        <ThemeToggle />

        <NotificationBell udharCount={udharCount} />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button type="button" className="cursor-pointer rounded-full">
                <Avatar>
                  <AvatarFallback className="bg-primary/10 text-primary">{initials(user?.owner_name)}</AvatarFallback>
                </Avatar>
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-1.5 py-1.5">
              <p className="text-sm font-medium text-foreground">{user?.store_name}</p>
              <p className="text-xs font-normal text-muted-foreground">{user?.mobile}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout} variant="destructive">
              <LogOut /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
