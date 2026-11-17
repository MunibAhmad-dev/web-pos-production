import {
  LayoutGrid,
  ShoppingCart,
  History,
  Package,
  Boxes,
  Truck,
  ClipboardList,
  Undo2,
  ShieldAlert,
  Users,
  UserCog,
  Wallet,
  Landmark,
  Banknote,
  CalendarCheck,
  CreditCard,
  Receipt,
  BarChart3,
  TrendingUp,
  Settings,
  Scale,
  FileText,
  Shield,
  Info,
  Wrench,
  Warehouse,
  Tags,
  MapPinned,
  BellRing,
  FileBarChart,
} from 'lucide-react';

// Sidebar sections — same groups, order and names as the desktop app so staff who use both
// find things in the same place. `when` hides an item/group unless that module or setting is on
// (read from the shop's synced settings — see useStoreFeatures). `placement: 'footer'` groups are
// pinned at the bottom of the sidebar; every item stays searchable in the command palette.
export const navGroups = [
  {
    label: 'Core',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutGrid, end: true },
      { to: '/sales', label: 'Sales', icon: ShoppingCart, end: true, primary: true },
      { to: '/sales/history', label: 'Sales History', icon: History },
      { to: '/invoices', label: 'Invoices', icon: FileText },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { to: '/products', label: 'Products', icon: Package },
      { to: '/inventory', label: 'Inventory', icon: Boxes },
      { to: '/vendors', label: 'Vendors', icon: Truck },
      { to: '/purchases', label: 'Purchases / POs', icon: ClipboardList },
      { to: '/returns', label: 'Returns', icon: Undo2 },
      { to: '/warranty', label: 'Warranty Claims', icon: ShieldAlert },
      { to: '/godown', label: 'Godown', icon: Warehouse },
      { to: '/wholesale', label: 'Wholesale Price List', icon: Tags, when: 'wholesale' },
    ],
  },
  {
    label: 'Mobile Shop',
    when: 'mobile',
    items: [
      { to: '/repairs', label: 'Repairs & Jobs', icon: Wrench },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/customers', label: 'Customers', icon: Users },
      { to: '/loans', label: 'Loans (AP/AR)', icon: Scale },
      { to: '/employees', label: 'Employees', icon: UserCog },
      { to: '/route-book', label: 'Route Book', icon: MapPinned },
      { to: '/payment-reminders', label: 'Payment Reminders', icon: BellRing },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/accounts', label: 'Accounts & Cash', icon: Banknote },
      { to: '/daily-close', label: 'Daily Close', icon: CalendarCheck },
      { to: '/expenses', label: 'Expenses', icon: Receipt },
      { to: '/transactions', label: 'Transactions', icon: CreditCard },
      { to: '/payment-ledger', label: 'Payment Ledger', icon: Wallet },
      { to: '/cash-register', label: 'Cash Register', icon: Landmark },
      { to: '/register-history', label: 'Register History', icon: History },
    ],
  },
  {
    label: 'Reports',
    items: [
      { to: '/reports', label: 'Reports', icon: BarChart3 },
      { to: '/balance-sheet', label: 'Balance Sheet', icon: TrendingUp },
      { to: '/vendor-reports', label: 'Vendor Reports', icon: FileBarChart },
      { to: '/fbr', label: 'FBR Invoicing', icon: Shield },
    ],
  },
  {
    label: 'System',
    placement: 'footer',
    items: [
      { to: '/settings', label: 'Settings', icon: Settings },
      { to: '/about', label: 'About', icon: Info },
    ],
  },
];

/** Groups and items visible for this shop's enabled modules/settings. */
export function visibleNavGroups(features = {}) {
  return navGroups
    .filter((g) => !g.when || features[g.when])
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.when || features[i.when]) }))
    .filter((g) => g.items.length > 0);
}
