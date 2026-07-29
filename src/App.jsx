import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ManufacturingAuthProvider } from './context/ManufacturingAuthContext';
import { DataStoreProvider } from './store/dataStore';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './components/theme-provider';
import { TooltipProvider } from './components/ui/tooltip';
import { Toaster } from './components/ui/sonner';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/layout/Layout';
import ManufacturingProtectedRoute from './components/manufacturing/ManufacturingProtectedRoute';
import ManufacturingLayout from './components/manufacturing/ManufacturingLayout';

import HomePage from './pages/HomePage';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import PendingApproval from './pages/auth/PendingApproval';
import Dashboard from './pages/Dashboard';
import ProductsPage from './pages/products/ProductsPage';
import InventoryPage from './pages/inventory/InventoryPage';
import POSPage from './pages/sales/POSPage';
import SalesHistoryPage from './pages/sales/SalesHistoryPage';
import CustomersPage from './pages/customers/CustomersPage';
import CustomerDetailPage from './pages/customers/CustomerDetailPage';
import VendorsPage from './pages/vendors/VendorsPage';
import VendorDetailPage from './pages/vendors/VendorDetailPage';
import EmployeesPage from './pages/employees/EmployeesPage';
import PurchasesPage from './pages/purchases/PurchasesPage';
import ReturnsPage from './pages/returns/ReturnsPage';
import AccountsPage from './pages/accounts/AccountsPage';
import ExpensesPage from './pages/finance/ExpensesPage';
import CashRegisterPage from './pages/finance/CashRegisterPage';
import DailyClosePage from './pages/finance/DailyClosePage';
import PaymentLedgerPage from './pages/finance/PaymentLedgerPage';
import TransactionsPage from './pages/finance/TransactionsPage';
import ReportsPage from './pages/reports/ReportsPage';
import BalanceSheetPage from './pages/reports/BalanceSheetPage';
import SettingsPage from './pages/settings/SettingsPage';
import ManufacturingLogin from './pages/manufacturing/ManufacturingLogin';
import ManufacturingRegister from './pages/manufacturing/ManufacturingRegister';
import ManufacturingPendingApproval from './pages/manufacturing/ManufacturingPendingApproval';
import ManufacturingDashboard from './pages/manufacturing/ManufacturingDashboard';
import ManufacturingComingSoon from './pages/manufacturing/ManufacturingComingSoon';
import ManufacturingInvoices from './pages/manufacturing/ManufacturingInvoices';
import ManufacturingReports from './pages/manufacturing/ManufacturingReports';
import ManufacturingSell from './pages/manufacturing/ManufacturingSell';
import ManufacturingBuyStock from './pages/manufacturing/ManufacturingBuyStock';
import ManufacturingPartsInventory from './pages/manufacturing/ManufacturingPartsInventory';
import ManufacturingProducts from './pages/manufacturing/ManufacturingProducts';
import ManufacturingVendors from './pages/manufacturing/ManufacturingVendors';
import ManufacturingCustomers from './pages/manufacturing/ManufacturingCustomers';
import ManufacturingAccounting from './pages/manufacturing/ManufacturingAccounting';
import ManufacturingExpenses from './pages/manufacturing/ManufacturingExpenses';
import ManufacturingSettings from './pages/manufacturing/ManufacturingSettings';
import ManufacturingAbout from './pages/manufacturing/ManufacturingAbout';
import ManufacturingLicense from './pages/manufacturing/ManufacturingLicense';
import NotFound from './pages/NotFound';

// Remounts DataStoreProvider (wiping all in-memory data) whenever the logged-in
// instance changes — this is the only guard against cross-account data leakage.
function DataStoreWrapper({ children }) {
  const { user } = useAuth();
  return (
    <DataStoreProvider key={user?.instance_id ?? 'anon'}>
      {children}
    </DataStoreProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <ManufacturingAuthProvider>
        <AuthProvider>
          <DataStoreWrapper>
          <ToastProvider>
            <TooltipProvider delayDuration={200}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/pending-approval" element={<PendingApproval />} />
                <Route path="/manufacturing/login" element={<ManufacturingLogin />} />
                <Route path="/manufacturing/register" element={<ManufacturingRegister />} />
                <Route path="/manufacturing/pending" element={<ManufacturingPendingApproval />} />

                {/* Manufacturing protected routes */}
                <Route element={<ManufacturingProtectedRoute />}>
                  <Route element={<ManufacturingLayout />}>
                    <Route path="/manufacturing/dashboard" element={<ManufacturingDashboard />} />
                    <Route path="/manufacturing/sales"     element={<ManufacturingSell />} />
                    <Route path="/manufacturing/purchases" element={<ManufacturingBuyStock />} />
                    <Route path="/manufacturing/parts"     element={<ManufacturingPartsInventory />} />
                    <Route path="/manufacturing/products"  element={<ManufacturingProducts />} />
                    <Route path="/manufacturing/vendors"   element={<ManufacturingVendors />} />
                    <Route path="/manufacturing/customers" element={<ManufacturingCustomers />} />
                    <Route path="/manufacturing/invoices"  element={<ManufacturingInvoices />} />
                    <Route path="/manufacturing/accounting" element={<ManufacturingAccounting />} />
                    <Route path="/manufacturing/expenses"  element={<ManufacturingExpenses />} />
                    <Route path="/manufacturing/reports"   element={<ManufacturingReports />} />
                    <Route path="/manufacturing/settings"  element={<ManufacturingSettings />} />
                    <Route path="/manufacturing/license"   element={<ManufacturingLicense />} />
                    <Route path="/manufacturing/about"     element={<ManufacturingAbout />} />
                  </Route>
                </Route>

                <Route
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/sales" element={<POSPage />} />
                  <Route path="/sales/history" element={<SalesHistoryPage />} />
                  <Route path="/products" element={<ProductsPage />} />
                  <Route path="/inventory" element={<InventoryPage />} />
                  <Route path="/vendors" element={<VendorsPage />} />
                  <Route path="/vendors/:id" element={<VendorDetailPage />} />
                  <Route path="/purchases" element={<PurchasesPage />} />
                  <Route path="/returns" element={<ReturnsPage />} />
                  <Route path="/customers" element={<CustomersPage />} />
                  <Route path="/customers/:id" element={<CustomerDetailPage />} />
                  <Route path="/employees" element={<EmployeesPage />} />
                  <Route path="/accounts" element={<AccountsPage />} />
                  <Route path="/expenses" element={<ExpensesPage />} />
                  <Route path="/cash-register" element={<CashRegisterPage />} />
                  <Route path="/daily-close" element={<DailyClosePage />} />
                  <Route path="/payment-ledger" element={<PaymentLedgerPage />} />
                  <Route path="/transactions" element={<TransactionsPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/balance-sheet" element={<BalanceSheetPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </TooltipProvider>
          </ToastProvider>
          </DataStoreWrapper>
        </AuthProvider>
        </ManufacturingAuthProvider>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </ThemeProvider>
  );
}
