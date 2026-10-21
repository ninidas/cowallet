import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import MonthsPage from './pages/MonthsPage'
import MonthDetailPage from './pages/MonthDetailPage'

// Chargées à la demande : les graphiques (Historique, Budget) pèsent plus que tout le reste,
// le premier écran (Mes mois, un mois) s'ouvre sans les attendre
const historyPage = () => import('./pages/HistoryPage')
const budgetPage  = () => import('./pages/BudgetPage')
const HistoryPage      = lazy(historyPage)
const BudgetPage       = lazy(budgetPage)
const LandingPage      = lazy(() => import('./pages/LandingPage'))
const InvitePage       = lazy(() => import('./pages/InvitePage'))
const RegisterPage     = lazy(() => import('./pages/RegisterPage'))
const GroupSetupPage   = lazy(() => import('./pages/GroupSetupPage'))
const SetupPage        = lazy(() => import('./pages/SetupPage'))
const SettingsPage     = lazy(() => import('./pages/SettingsPage'))
const BankCallbackPage = lazy(() => import('./pages/BankCallbackPage'))
const BankImportPage   = lazy(() => import('./pages/BankImportPage'))
const SearchPage       = lazy(() => import('./pages/SearchPage'))

function PrivateRoute({ children }) {
  const { user, config, ready } = useAuth()
  if (!ready) return null
  if (!user) return <Navigate to="/" replace />
  if (config && !config.has_group) return <Navigate to="/group-setup" replace />
  return <Layout><Suspense fallback={null}>{children}</Suspense></Layout>
}

function PublicRoute({ children }) {
  const { user, ready } = useAuth()
  if (!ready) return null
  if (user) return <Navigate to="/months" replace />
  return children
}

export default function App() {
  // Une fois l'appli ouverte, Historique et Budget se chargent en fond : l'onglet s'ouvre sans attente
  useEffect(() => {
    const id = setTimeout(() => { historyPage(); budgetPage() }, 1500)
    return () => clearTimeout(id)
  }, [])

  return (
    <Suspense fallback={null}>
    <Routes>
      <Route path="/"            element={<PublicRoute><LandingPage /></PublicRoute>} />
      <Route path="/setup"       element={<SetupPage />} />
      <Route path="/login"       element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register"    element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/group-setup" element={<GroupSetupPage />} />
      <Route path="/invite/:code" element={<InvitePage />} />
      <Route path="/months"      element={<PrivateRoute><MonthsPage /></PrivateRoute>} />
      <Route path="/months/:id"  element={<PrivateRoute><MonthDetailPage /></PrivateRoute>} />
      <Route path="/history"     element={<PrivateRoute><HistoryPage /></PrivateRoute>} />
      <Route path="/search"      element={<PrivateRoute><SearchPage /></PrivateRoute>} />
      <Route path="/budget"      element={<PrivateRoute><BudgetPage /></PrivateRoute>} />
      <Route path="/settings/:section?" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
      <Route path="/bank/callback" element={<PrivateRoute><BankCallbackPage /></PrivateRoute>} />
      <Route path="/bank/import/:monthId" element={<PrivateRoute><BankImportPage /></PrivateRoute>} />
      <Route path="*"            element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}
