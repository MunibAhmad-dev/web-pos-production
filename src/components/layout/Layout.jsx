import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import CommandPalette from './CommandPalette';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { navGroups } from './navConfig';

const titleMap = navGroups
  .flatMap((group) => group.items)
  .reduce((map, item) => ({ ...map, [item.to]: item.label }), {
    '/sales': 'Point of Sale',
    '/sales/history': 'Sales History',
  });

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const location = useLocation();
  const title = titleMap[location.pathname] || 'Dashboard';

  return (
    <div className="flex min-h-screen overflow-hidden bg-background">
      <aside
        style={{ width: sidebarCollapsed ? 72 : 240 }}
        className="hidden shrink-0 border-r border-border/60 transition-[width] duration-200 ease-in-out lg:block"
      >
        <Sidebar className="fixed h-screen" collapsible collapsed={sidebarCollapsed} onToggleCollapsed={setSidebarCollapsed} />
      </aside>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0 sm:max-w-64">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setSidebarOpen(true)} title={title} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-screen-2xl">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette />
    </div>
  );
}
