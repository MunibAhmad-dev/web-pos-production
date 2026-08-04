import {
  LayoutGrid,
  ShoppingCart,
  Package,
  Boxes,
  Truck,
  ClipboardList,
  Undo2,
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
} from 'lucide-react';

export const navGroups = [
  {
    label: 'Core',
    emoji: '🏠',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutGrid, end: true },
      { to: '/sales', label: 'Sales', icon: ShoppingCart },
    ],
  },
  {
    label: 'Inventory',
    emoji: '📦',
    items: [
      { to: '/products', label: 'Products', icon: Package },
      { to: '/inventory', label: 'Inventory', icon: Boxes },
      { to: '/vendors', label: 'Vendors', icon: Truck },
      { to: '/purchases', label: 'Purchases / POs', icon: ClipboardList },
      { to: '/returns', label: 'Returns', icon: Undo2 },
    ],
  },
  {
    label: 'People',
    emoji: '👥',
    items: [
      { to: '/customers', label: 'Customers', icon: Users },
      { to: '/employees', label: 'Employees', icon: UserCog },
    ],
  },
  {
    label: 'Finance',
    emoji: '💰',
    items: [
      { to: '/accounts', label: 'Accounts & Cash', icon: Banknote },
      { to: '/expenses', label: 'Expenses', icon: Wallet },
      { to: '/cash-register', label: 'Cash Register', icon: Landmark },
      { to: '/daily-close', label: 'Daily Close', icon: CalendarCheck },
      { to: '/payment-ledger', label: 'Payment Ledger', icon: CreditCard },
      { to: '/transactions', label: 'Transactions', icon: Receipt },
      { to: '/loans', label: 'Receivables & Payables', icon: Scale },
    ],
  },
  {
    label: 'Reports',
    emoji: '📊',
    items: [
      { to: '/reports', label: 'Reports', icon: BarChart3 },
      { to: '/balance-sheet', label: 'Balance Sheet', icon: TrendingUp },
    ],
  },
  {
    label: 'System',
    emoji: '⚙️',
    items: [{ to: '/settings', label: 'Settings', icon: Settings }],
  },
];
