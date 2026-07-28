import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Store, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { navGroups } from './navConfig';
import { cn } from '@/lib/utils';

export default function SidebarNav({ className = '', collapsible = false, collapsed: collapsedProp, onToggleCollapsed }) {
  const location = useLocation();

  const [internalCollapsed, setInternalCollapsed] = useState(() => {
    if (!collapsible) return false;
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const isCollapsed = collapsedProp ?? internalCollapsed;

  const toggleSidebar = () => {
    const next = !isCollapsed;
    try {
      localStorage.setItem('sidebar_collapsed', String(next));
    } catch {
      /* ignore */
    }
    setInternalCollapsed(next);
    onToggleCollapsed?.(next);
  };

  const [openGroups, setOpenGroups] = useState(() => {
    try {
      const stored = localStorage.getItem('pos_nav_open_groups');
      if (stored) return new Set(JSON.parse(stored));
    } catch {
      /* ignore */
    }
    return new Set(navGroups.map((g) => g.label));
  });

  const toggleGroup = (label) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      try {
        localStorage.setItem('pos_nav_open_groups', JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  useEffect(() => {
    const activeGroup = navGroups.find((g) => g.items.some((i) => i.to === location.pathname));
    if (activeGroup && !openGroups.has(activeGroup.label)) {
      setOpenGroups((prev) => new Set(prev).add(activeGroup.label));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <div
      style={collapsible ? { width: isCollapsed ? 72 : 240 } : undefined}
      className={cn('relative flex h-full flex-col bg-card text-foreground transition-[width] duration-200 ease-in-out', className)}
    >
      {collapsible && (
        <div className="absolute -right-3 top-6 z-50 hidden md:block">
          <button
            onClick={toggleSidebar}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-md transition-colors hover:text-foreground"
          >
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        </div>
      )}

      <div className={cn('flex h-[68px] shrink-0 items-center border-b border-border/60', isCollapsed ? 'justify-center px-3' : 'gap-3 px-5')}>
        <div className="relative shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
            <Store size={18} className="text-primary" />
          </div>
          <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />
        </div>
        {!isCollapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm leading-none font-bold">Retail POS</p>
            <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">Store management</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {navGroups.map((group) => {
          const isGroupOpen = openGroups.has(group.label);
          const hasActiveItem = group.items.some((item) => location.pathname === item.to);

          return (
            <div key={group.label} className="mb-0.5">
              {!isCollapsed ? (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="group/ghdr flex w-full items-center justify-between rounded-lg px-3 pt-3 pb-1.5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px]">{group.emoji}</span>
                    <span
                      className={cn(
                        'text-[9px] font-black tracking-[0.12em] uppercase select-none',
                        hasActiveItem ? 'text-primary' : 'text-muted-foreground/75 group-hover/ghdr:text-muted-foreground'
                      )}
                    >
                      {group.label}
                    </span>
                  </div>
                  <ChevronDown
                    size={10}
                    className={cn(
                      'text-muted-foreground/65 transition-transform duration-200 select-none group-hover/ghdr:text-muted-foreground',
                      isGroupOpen ? 'rotate-0' : '-rotate-90'
                    )}
                  />
                </button>
              ) : (
                <div className="mx-2 my-2 h-px bg-border/40" />
              )}

              <div
                className="overflow-hidden transition-[grid-template-rows] duration-200 ease-in-out"
                style={{ display: 'grid', gridTemplateRows: isCollapsed || isGroupOpen ? '1fr' : '0fr' }}
              >
                <div className="min-h-0">
                  {group.items.map(({ to, label, icon: Icon, end }) => {
                    const isActive = location.pathname === to;
                    return (
                      <NavLink
                        key={to}
                        to={to}
                        end={end}
                        title={isCollapsed ? label : undefined}
                        className={cn(
                          'group relative flex items-center rounded-lg text-[11px] font-medium transition-colors duration-100',
                          isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-3 py-2',
                          isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        )}
                      >
                        {isActive && <span className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />}
                        <Icon size={16} className={cn('shrink-0 transition-transform', isActive && 'scale-110')} />
                        <span className={cn('truncate transition-[opacity,width] duration-150', isActive && 'font-semibold', isCollapsed ? 'w-0 overflow-hidden opacity-0' : 'opacity-100')}>
                          {label}
                        </span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      <div className={cn('flex h-12 shrink-0 items-center border-t border-border/60', isCollapsed ? 'justify-center' : 'px-5')}>
        {isCollapsed ? (
          <span className="text-[9px] font-bold text-muted-foreground/40">v1</span>
        ) : (
          <span className="text-[10px] text-muted-foreground/50">Web POS · v1.0</span>
        )}
      </div>
    </div>
  );
}
