import { ThemeProvider, CssBaseline } from '@mui/material'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { WebSocketProvider } from './contexts/WebSocketContext'
import theme from './theme'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'
import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/Dashboard'
import UsersPage from './pages/users/UsersPage'
import AccountsPage from './pages/accounts/AccountsPage'
import TransactionsPage from './pages/transactions/TransactionsPage'
import KYCPage from './pages/kyc/KYCPage'
import TontinesPage from './pages/tontines/TontinesPage'
import SupportPage from './pages/support/SupportPage'
import ReportsPage from './pages/reports/ReportsPage'
import AuditLogsPage from './pages/audit/AuditLogsPage'
import SettingsPage from './pages/settings/SettingsPage'
import TenantsPage from './pages/tenants/TenantsPage'
import CurrencyPage from './pages/currency/CurrencyPage'
import NotificationsPage from './pages/notifications/NotificationsPage'

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <WebSocketProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/*"
              element={
                <PrivateRoute>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/dashboard" element={<DashboardPage />} />
                      <Route path="/users/*" element={<UsersPage />} />
                      <Route path="/accounts/*" element={<AccountsPage />} />
                      <Route path="/transactions/*" element={<TransactionsPage />} />
                      <Route path="/kyc/*" element={<KYCPage />} />
                      <Route path="/tontines/*" element={<TontinesPage />} />
                      <Route path="/support/*" element={<SupportPage />} />
                      <Route path="/reports" element={<ReportsPage />} />
                      <Route path="/audit-logs" element={<AuditLogsPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/tenants/*" element={<TenantsPage />} />
                      <Route path="/currency" element={<CurrencyPage />} />
                      <Route path="/notifications" element={<NotificationsPage />} />
                    </Routes>
                  </Layout>
                </PrivateRoute>
              }
            />
          </Routes>
        </WebSocketProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
