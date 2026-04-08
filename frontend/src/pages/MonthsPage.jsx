import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import MonthForm from '../components/MonthForm'

function formatEur(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

function TransferPill({ done, name }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
      done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${done ? 'bg-emerald-500' : 'bg-slate-300'}`} />
      {name}
    </span>
  )
}

const NOW = new Date()

function MonthCard({ month, config, onClick, isCurrent }) {
  const bothDone = month.user1_transferred && month.user2_transferred
  const borderColor = bothDone ? '#10b981' : isCurrent ? '#7c3aed' : '#e2e8f0'

  return (
    <button
      onClick={onClick}
      className={`w-full bg-white rounded-2xl p-5 shadow-sm border active:scale-[0.98] transition text-left ${
        isCurrent ? 'border-violet-200 ring-2 ring-violet-100' : 'border-slate-100'
      }`}
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900">{month.label}</h3>
            {isCurrent && (
              <span className="text-xs font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                En cours
              </span>
            )}
            {month.validated_by && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                ✓ Validé
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-0.5">
            {month.user1_share}/{100 - month.user1_share} · {formatEur(month.total)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400 mb-0.5">Part individuelle</p>
          <p className="text-xl font-bold text-violet-600">{formatEur(month.user1_due)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <TransferPill done={month.user1_transferred} name={config?.user1_username ?? 'User 1'} />
          <TransferPill done={month.user2_transferred} name={config?.user2_username ?? 'User 2'} />
        </div>
        {bothDone && (
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
            ✓ Clôturé
          </span>
        )}
      </div>
    </button>
  )
}

export default function MonthsPage() {
  const { user, config } = useAuth()
  const navigate = useNavigate()
  const [months, setMonths]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)

  async function load() {
    try {
      const data = await api.getMonths()
      setMonths(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    window.scrollTo(0, 0)
    load()
  }, [])

  async function handleMonthCreated(newMonth) {
    setShowForm(false)
    navigate(`/months/${newMonth.id}`)
  }

  return (
    <div className="min-h-screen bg-slate-50 page-enter">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 safe-top px-4 pb-10 lg:pb-12">
        <div className="max-w-6xl mx-auto lg:px-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-violet-200 text-sm">Bonjour,</p>
              <h1 className="text-2xl font-bold text-white capitalize">{user?.username}</h1>
            </div>
            {/* Bouton paramètres visible uniquement sur mobile (sidebar gère ça sur desktop) */}
            <button
              onClick={() => navigate('/settings')}
              className="lg:hidden w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white active:bg-white/30 transition"
              aria-label="Paramètres"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6 pb-safe">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Mes mois</h2>
          <Link
            to="/history"
            className="lg:hidden flex items-center gap-1.5 text-sm font-medium text-violet-600 active:text-violet-800 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            Historique
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          </div>
        ) : months.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-200">
            <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-violet-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <p className="text-slate-700 font-semibold mb-1">Aucun mois pour l'instant</p>
            <p className="text-slate-400 text-sm">Appuyez sur <span className="font-bold text-violet-500">+</span> pour créer votre premier mois</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {months.map(m => (
              <MonthCard
                key={m.id}
                month={m}
                config={config}
                isCurrent={m.year === NOW.getFullYear() && m.month === NOW.getMonth() + 1}
                onClick={() => navigate(`/months/${m.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-24 lg:bottom-8 right-5 w-14 h-14 bg-violet-600 rounded-full shadow-xl shadow-violet-300 flex items-center justify-center active:scale-95 transition z-10"
        aria-label="Nouveau mois"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-7 h-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      <MonthForm
        open={showForm}
        config={config}
        onClose={() => setShowForm(false)}
        onCreated={handleMonthCreated}
      />
    </div>
  )
}
