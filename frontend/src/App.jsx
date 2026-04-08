import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import GroupSetupPage from './pages/GroupSetupPage'
import SetupPage from './pages/SetupPage'
import MonthsPage from './pages/MonthsPage'
import MonthDetailPage from './pages/MonthDetailPage'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'
import BudgetPage from './pages/BudgetPage'

function PrivateRoute({ children }) {
  const { user, config, ready } = useAuth()
  if (!ready) return null
  if (!user) return <Navigate to="/login" replace />
  if (config && !config.has_group) return <Navigate to="/group-setup" replace />
  return <Layout>{children}</Layout>
}

function PublicRoute({ children }) {
  const { ready } = useAuth()
  if (!ready) return null
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/setup"       element={<SetupPage />} />
      <Route path="/login"       element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register"    element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/group-setup" element={<PublicRoute><GroupSetupPage /></PublicRoute>} />
      <Route path="/months"      element={<PrivateRoute><MonthsPage /></PrivateRoute>} />
      <Route path="/months/:id"  element={<PrivateRoute><MonthDetailPage /></PrivateRoute>} />
      <Route path="/history"     element={<PrivateRoute><HistoryPage /></PrivateRoute>} />
      <Route path="/budget"       element={<PrivateRoute><BudgetPage /></PrivateRoute>} />
      <Route path="/settings"    element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
      <Route path="*"            element={<Navigate to="/months" replace />} />
    </Routes>
  )
}
