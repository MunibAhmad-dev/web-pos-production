import { Menu, LogOut, Settings, Search } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
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

const initials = (name = '') =>
  name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export default function Topbar({ onMenuClick, title }) {
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

        {typeof user?.days_remaining === 'number' && user.days_remaining <= 14 && (
          <div style={{
            fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 50,
            background: user.days_remaining <= 3 ? '#FEF2F2' : '#FFFBEB',
            color: user.days_remaining <= 3 ? '#EF4444' : '#D97706',
            border: `1px solid ${user.days_remaining <= 3 ? '#FECACA' : '#FDE68A'}`,
            whiteSpace: 'nowrap',
          }}>
            {user.days_remaining}d left
          </div>
        )}

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
