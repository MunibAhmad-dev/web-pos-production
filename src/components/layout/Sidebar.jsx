import { useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Store, ChevronDown, PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';
import { navGroups } from './navConfig';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const mainGroups = navGroups.filter((g) => g.placement !== 'footer');
const footerItems = navGroups.filter((g) => g.placement === 'footer').flatMap((g) => g.items);

function readSet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return fallback;
}

/** One navigation row — full label when expanded, icon + tooltip when collapsed. */
function NavItem({ to, label, icon: Icon, end, collapsed, active }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        'group relative flex items-center rounded-lg text-[13px] font-medium transition-colors',
        collapsed ? 'mx-auto h-10 w-10 justify-center' : 'h-9 gap-3 px-3',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {active && !collapsed && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" aria-hidden="true" />}
      <Icon size={17} strokeWidth={active ? 2.2 : 1.9} className="shrink-0" />
      {!collapsed && <span className={cn('truncate', active && 'font-semibold')}>{label}</span>}
    </NavLink>
  );
}

export default function SidebarNav({ className = '', collapsible = false, collapsed: collapsedProp, onToggleCollapsed }) {
  const location = useLocation();
  const { user } = useAuth();
  const isCollapsed = collapsible && !!collapsedProp;

  const toggleSidebar = () => {
    const next = !isCollapsed;
    try { localStorage.setItem('sidebar_collapsed', String(next)); } catch { /* ignore */ }
    onToggleCollapsed?.(next);
  };

  // Which sections are folded away (default: none) — remembered per browser.
  const [closedGroups, setClosedGroups] = useState(() => readSet('pos_nav_closed_groups', new Set()));
  const toggleGroup = (label) => {
    setClosedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      try { localStorage.setItem('pos_nav_closed_groups', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  // Navigating into a folded section opens it.
  useEffect(() => {
    const active = mainGroups.find((g) => g.items.some((i) => i.to === location.pathname));
    if (active && closedGroups.has(active.label)) toggleGroup(active.label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const storeName = user?.store_name || 'My store';
  const isActive = (to) => location.pathname === to;

  return (
    <div className={cn('flex h-full flex-col bg-card text-foreground', className)} style={collapsible ? { width: isCollapsed ? 72 : 248 } : undefined}>
      {/* Store */}
      <div className={cn('flex h-16 shrink-0 items-center border-b border-border/70', isCollapsed ? 'justify-center' : 'gap-3 px-4')}>
        <Link to="/dashboard" className="relative shrink-0" aria-label={storeName}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Store size={17} strokeWidth={2.2} />
          </span>
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" title="Connected" />
        </Link>
        {!isCollapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{storeName}</p>
            <p className="truncate text-[11px] text-muted-foreground">OsaTech Web POS</p>
          </div>
        )}
      </div>

      {/* New sale */}
      <div className={cn('shrink-0 pt-4 pb-2', isCollapsed ? 'px-3' : 'px-4')}>
        <Link
          to="/sales"
          title={isCollapsed ? 'New sale' : undefined}
          aria-label="New sale"
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold shadow-sm transition-opacity hover:opacity-95',
            isCollapsed ? 'mx-auto h-10 w-10' : 'h-10 w-full',
            isActive('/sales') && 'ring-2 ring-primary/30 ring-offset-2 ring-offset-card'
          )}
        >
          <Plus size={17} strokeWidth={2.4} />
          {!isCollapsed && 'New sale'}
        </Link>
      </div>

      {/* Sections */}
      <nav
        aria-label="Main"
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3 [scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:var(--border)_transparent]"
      >
        {mainGroups.map((group) => {
          const open = isCollapsed || !closedGroups.has(group.label);
          const items = group.items.filter((i) => !i.primary);
          const hasActive = items.some((i) => isActive(i.to));
          return (
            <div key={group.label} className="pt-3">
              {isCollapsed ? (
                <div className="mx-auto mb-2 h-px w-8 bg-border" aria-hidden="true" />
              ) : (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={open}
                  className="group/h mb-1 flex w-full items-center justify-between rounded-md px-3 py-1 text-left"
                >
                  <span className={cn('text-[11px] font-semibold uppercase tracking-[0.08em]', hasActive ? 'text-foreground' : 'text-muted-foreground/80')}>
                    {group.label}
                  </span>
                  <ChevronDown size={13} className={cn('text-muted-foreground/60 opacity-0 transition group-hover/h:opacity-100', !open && '-rotate-90 opacity-100')} />
                </button>
              )}
              {open && (
                <div className={cn('grid', isCollapsed ? 'gap-1' : 'gap-0.5')}>
                  {items.map((item) => (
                    <NavItem key={item.to} {...item} collapsed={isCollapsed} active={isActive(item.to)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer: settings, about, collapse */}
      <div className={cn('shrink-0 border-t border-border/70 py-2', isCollapsed ? 'px-3' : 'px-3')}>
        <div className={cn('grid', isCollapsed ? 'gap-1' : 'gap-0.5')}>
          {footerItems.map((item) => (
            <NavItem key={item.to} {...item} collapsed={isCollapsed} active={isActive(item.to)} />
          ))}
          {collapsible && (
            <button
              type="button"
              onClick={toggleSidebar}
              title={isCollapsed ? 'Expand sidebar' : undefined}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={cn(
                'flex items-center rounded-lg text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                isCollapsed ? 'mx-auto h-10 w-10 justify-center' : 'h-9 gap-3 px-3'
              )}
            >
              {isCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
              {!isCollapsed && 'Collapse'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
