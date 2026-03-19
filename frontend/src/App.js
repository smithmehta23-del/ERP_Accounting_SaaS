import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { isLoggedIn } from "./auth";
import AppShell from "./components/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";
import ReceivablesPage from "./pages/ReceivablesPage";
import PayablesPage from "./pages/PayablesPage";
import PartyLedgerPage from "./pages/PartyLedgerPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AccountsPage from "./pages/AccountsPage";
import PartiesPage from "./pages/PartiesPage";
import VouchersPage from "./pages/VouchersPage";
import VoucherDetailsPage from "./pages/VoucherDetailsPage";
import LedgerPage from "./pages/LedgerPage";
import ReportsPage from "./pages/ReportsPage";
import ProfitLossPage from "./pages/ProfitLossPage";
import BalanceSheetPage from "./pages/BalanceSheetPage";
import ApprovalsPage from "./pages/ApprovalsPage";
import BankReconciliationPage from "./pages/BankReconciliationPage";
import InvoicesPage from "./pages/InvoicesPage";
import InvoiceDetailsPage from "./pages/InvoiceDetailsPage";
import GSTReportsPage from "./pages/GSTReportsPage";
import SettlementsPage from "./pages/SettlementsPage";
import SettingsPage from "./pages/SettingsPage";
import PeriodClosePage from "./pages/PeriodClosePage";
import AuditLogPage from "./pages/AuditLogPage";
import ItemsPage from "./pages/ItemsPage";
import StockSummaryPage from "./pages/StockSummaryPage";
import StockLedgerPage from "./pages/StockLedgerPage";
import ItemSalesRegisterPage from "./pages/ItemSalesRegisterPage";
import ItemPurchaseRegisterPage from "./pages/ItemPurchaseRegisterPage";
import LowStockPage from "./pages/LowStockPage";
import PurchaseOrdersPage from "./pages/PurchaseOrdersPage";
import ReorderSuggestionsPage from "./pages/ReorderSuggestionsPage";
import SalesOrdersPage from "./pages/SalesOrdersPage";
import SalesOrderDetailsPage from "./pages/SalesOrderDetailsPage";
import CollectionsDashboardPage from "./pages/CollectionsDashboardPage";
import FinancialYearsPage from "./pages/FinancialYearsPage";
import PostingLocksPage from "./pages/PostingLocksPage";
import CompanySwitcherPage from "./pages/CompanySwitcherPage";
import FollowupsPage from "./pages/FollowupsPage";
import AIInvoiceIntakePage from "./pages/AIInvoiceIntakePage";
import AIDraftInvoicePage from "./pages/AIDraftInvoicePage";
import AIInvoiceToPartyPage from "./pages/AIInvoiceToPartyPage";
import AIFullAutomationPage from "./pages/AIFullAutomationPage";
import BankAIPage from "./pages/BankAIPage";
import AIHubPage from "./pages/AIHubPage";
import AIAssistantPage from "./pages/AIAssistantPage";

function PrivateLayout({ children }) {
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />;
  }

  return <AppShell>{children}</AppShell>;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <PrivateLayout>
              <DashboardPage />
            </PrivateLayout>
          }
        />
<Route
  path="/ai"
  element={
    <PrivateLayout>
      <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
        <AIHubPage />
      </ProtectedRoute>
    </PrivateLayout>
  }
/>
<Route
  path="/ai-assistant"
  element={
    <PrivateLayout>
      <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
        <AIAssistantPage />
      </ProtectedRoute>
    </PrivateLayout>
  }
/>
<Route
  path="/bank-ai"
  element={
    <PrivateLayout>
      <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
        <BankAIPage />
      </ProtectedRoute>
    </PrivateLayout>
  }
/>
        <Route
          path="/sales-orders"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
                <SalesOrdersPage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />
<Route
  path="/financial-years"
  element={
    <PrivateLayout>
      <ProtectedRoute roles={["ADMIN"]}>
        <FinancialYearsPage />
      </ProtectedRoute>
    </PrivateLayout>
  }
/>
<Route
  path="/ai-draft-invoices"
  element={
    <PrivateLayout>
      <AIDraftInvoicePage />
    </PrivateLayout>
  }
/>
<Route
  path="/ai-invoice-intake"
  element={
    <PrivateLayout>
      <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
        <AIInvoiceIntakePage />
      </ProtectedRoute>
    </PrivateLayout>
  }
/>
<Route
  path="/posting-locks"
  element={
    <PrivateLayout>
      <ProtectedRoute roles={["ADMIN"]}>
        <PostingLocksPage />
      </ProtectedRoute>
    </PrivateLayout>
  }
/>
<Route
  path="/company-switcher"
  element={
    <PrivateLayout>
      <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
        <CompanySwitcherPage />
      </ProtectedRoute>
    </PrivateLayout>
  }
/>
<Route
  path="/collections"
  element={
    <PrivateLayout>
      <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
        <CollectionsDashboardPage />
      </ProtectedRoute>
    </PrivateLayout>
  }
/>
<Route
  path="/ai-invoice-party"
  element={
    <PrivateLayout>
      <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
        <AIInvoiceToPartyPage />
      </ProtectedRoute>
    </PrivateLayout>
  }
/>
<Route
  path="/followups"
  element={
    <PrivateLayout>
      <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
        <FollowupsPage />
      </ProtectedRoute>
    </PrivateLayout>
  }
/>
        <Route
          path="/sales-orders/:id"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
                <SalesOrderDetailsPage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />
<Route
  path="/ai-full-automation"
  element={
    <PrivateLayout>
      <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
        <AIFullAutomationPage />
      </ProtectedRoute>
    </PrivateLayout>
  }
/>
        <Route
          path="/purchase-orders"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
                <PurchaseOrdersPage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />

        <Route
          path="/reports/reorder-suggestions"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
                <ReorderSuggestionsPage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />

        <Route
          path="/reports/gst"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
                <GSTReportsPage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />
<Route
  path="/receivables"
  element={
    <PrivateLayout>
      <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
        <ReceivablesPage />
      </ProtectedRoute>
    </PrivateLayout>
  }
/>

<Route
  path="/payables"
  element={
    <PrivateLayout>
      <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
        <PayablesPage />
      </ProtectedRoute>
    </PrivateLayout>
  }
/>

<Route
  path="/party-ledger"
  element={
    <PrivateLayout>
      <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
        <PartyLedgerPage />
      </ProtectedRoute>
    </PrivateLayout>
  }
/>
        <Route
          path="/items"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN", "PREPARER"]}>
                <ItemsPage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />

        <Route
          path="/reports/low-stock"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
                <LowStockPage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />

        <Route
          path="/invoices"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN", "PREPARER"]}>
                <InvoicesPage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />

        <Route
          path="/invoices/:id"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
                <InvoiceDetailsPage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />

        <Route
          path="/reports/stock-summary"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
                <StockSummaryPage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />

        <Route
          path="/reports/stock-ledger"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
                <StockLedgerPage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />

        <Route
          path="/reports/item-sales-register"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
                <ItemSalesRegisterPage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />

        <Route
          path="/reports/item-purchase-register"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
                <ItemPurchaseRegisterPage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />

        <Route
          path="/period-close"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN"]}>
                <PeriodClosePage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />

        <Route
          path="/audit-log"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN", "APPROVER"]}>
                <AuditLogPage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />

        <Route
          path="/settings"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN"]}>
                <SettingsPage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />

        <Route
          path="/accounts"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN"]}>
                <AccountsPage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />

        <Route
          path="/parties"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN", "PREPARER"]}>
                <PartiesPage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />

        <Route
          path="/vouchers"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
                <VouchersPage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />

        <Route
          path="/vouchers/:id"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
                <VoucherDetailsPage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />

        <Route
          path="/ledger"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
                <LedgerPage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />

        <Route
          path="/reports"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
                <ReportsPage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />

        <Route
          path="/reports/pnl"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
                <ProfitLossPage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />

        <Route
          path="/reports/balance-sheet"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN", "PREPARER", "APPROVER"]}>
                <BalanceSheetPage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />

        <Route
          path="/approvals"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN", "APPROVER"]}>
                <ApprovalsPage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />

        <Route
          path="/settlements"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN", "PREPARER"]}>
                <SettlementsPage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />

        <Route
          path="/bank-reconciliation"
          element={
            <PrivateLayout>
              <ProtectedRoute roles={["ADMIN", "APPROVER"]}>
                <BankReconciliationPage />
              </ProtectedRoute>
            </PrivateLayout>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;