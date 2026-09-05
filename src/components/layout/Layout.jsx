import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import CommandPalette from './CommandPalette';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { navGroups } from './navConfig';
import UdharReminderModal, { useUdharReminder } from '../sales/UdharReminderModal';
import { useAuth } from '@/context/AuthContext';
import { AlertTriangle } from 'lucide-react';

function LicenseBanner({ days }) {
  const isRed = days <= 3;
  return (
    <div
      className="flex shrink-0 items-center gap-3 px-6 py-2.5 text-sm font-medium text-white"
      style={{ background: isRed ? '#DC2626' : '#D97706' }}
    >
      <AlertTriangle size={15} className="shrink-0 opacity-90" />
      <span>
        <strong>License Expiring Soon</strong>
        {' — '}
        {days > 0 ? `${days}d remaining` : 'expires today'}
        {' — renew to avoid lockout'}
      </span>
      <a
        href="https://wa.me/923298748232?text=Hi+OsaTech%2C+I+need+to+renew+my+POS+license."
        target="_blank"
        rel="noreferrer"
        className="ml-auto shrink-0 rounded-lg border border-white/30 px-3 py-1 text-xs font-bold hover:bg-white/15 transition-colors"
      >
        Renew Now →
      </a>
    </div>
  );
}

const titleMap = navGroups
  .flatMap((group) => group.items)
  .reduce((map, item) => ({ ...map, [item.to]: item.label }), {
    '/sales': 'Point of Sale',
    '/sales/history': 'Sales History',
  });

export default function Layout() {
  const { user } = useAuth();
  const reminder = useUdharReminder();
  const licenseWarning = typeof user?.days_remaining === 'number' && user.days_remaining <= 14;
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

  // Close mobile sidebar whenever the route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

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
        <Topbar
          onMenuClick={() => setSidebarOpen(true)}
          title={title}
          udharCount={reminder.dueSales?.length || 0}
        />
        {licenseWarning && <LicenseBanner days={user.days_remaining} />}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-screen-2xl">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette />

      <UdharReminderModal
        dueSales={reminder.dueSales}
        open={reminder.open}
        onClose={() => reminder.setOpen(false)}
        onSnooze={reminder.handleSnooze}
        onExtend={reminder.handleExtend}
        onDismissAll={reminder.handleDismissAll}
      />
    </div>
  );
}
