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
} from 'lucide-react';

// Sidebar sections. `placement: 'footer'` groups render pinned at the bottom of the sidebar
// (still searchable in the command palette). `primary` marks the New Sale call-to-action.
export const navGroups = [
  {
    label: 'Sell',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutGrid, end: true },
      { to: '/sales', label: 'New Sale', icon: ShoppingCart, end: true, primary: true },
      { to: '/sales/history', label: 'Sales History', icon: History },
      { to: '/invoices', label: 'Invoices', icon: FileText },
    ],
  },
  {
    label: 'Stock',
    items: [
      { to: '/products', label: 'Products', icon: Package },
      { to: '/inventory', label: 'Inventory', icon: Boxes },
      { to: '/purchases', label: 'Purchases', icon: ClipboardList },
      { to: '/vendors', label: 'Vendors', icon: Truck },
      { to: '/returns', label: 'Returns', icon: Undo2 },
      { to: '/warranty', label: 'Warranty Claims', icon: ShieldAlert },
      { to: '/repairs', label: 'Repairs', icon: Wrench },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/customers', label: 'Customers', icon: Users },
      { to: '/employees', label: 'Employees', icon: UserCog },
    ],
  },
  {
    label: 'Money',
    items: [
      { to: '/accounts', label: 'Accounts & Cash', icon: Banknote },
      { to: '/expenses', label: 'Expenses', icon: Wallet },
      { to: '/loans', label: 'Receivables & Payables', icon: Scale },
      { to: '/payment-ledger', label: 'Payment Ledger', icon: CreditCard },
      { to: '/transactions', label: 'Transactions', icon: Receipt },
      { to: '/cash-register', label: 'Cash Register', icon: Landmark },
      { to: '/daily-close', label: 'Daily Close', icon: CalendarCheck },
      { to: '/register-history', label: 'Register History', icon: History },
    ],
  },
  {
    label: 'Reports',
    items: [
      { to: '/reports', label: 'Reports', icon: BarChart3 },
      { to: '/balance-sheet', label: 'Balance Sheet', icon: TrendingUp },
      { to: '/fbr', label: 'FBR e-Invoicing', icon: Shield },
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
