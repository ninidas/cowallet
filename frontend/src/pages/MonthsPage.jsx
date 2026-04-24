import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { useFmt } from '../hooks/useFmt'
import MonthForm from '../components/MonthForm'

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

function MonthCard({ month, config, onClick, isCurrent, selectMode, selected, t }) {
  const fmt = useFmt()
  const bothDone = month.user1_transferred && month.user2_transferred
  const borderColor = selected ? '#7c3aed' : bothDone ? '#10b981' : isCurrent ? '#7c3aed' : '#e2e8f0'

  return (
    <button
      onClick={onClick}
      className={`w-full bg-white rounded-2xl p-5 shadow-sm border active:scale-[0.98] transition text-left ${
        selected ? 'border-violet-300 ring-2 ring-violet-200 bg-violet-50' :
        isCurrent ? 'border-violet-200 ring-2 ring-violet-100' : 'border-slate-100'
      }`}
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {selectMode && (
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                selected ? 'border-violet-600 bg-violet-600' : 'border-slate-300'
              }`}>
                {selected && (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="white" className="w-3 h-3">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            )}
            <h3 className="text-lg font-bold text-slate-900">{month.label}</h3>
            {isCurrent && (
              <span className="text-xs font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                {t('months.in_progress')}
              </span>
            )}
            {month.validated_by && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                {t('months.validated')}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-0.5">
            {month.user1_share}/{100 - month.user1_share} · {fmt(month.total)}
          </p>
        </div>
        {!selectMode && (
          <div className="text-right">
            <p className="text-xs text-slate-400 mb-0.5">{t('months.per_person')}</p>
            <p className="text-xl font-bold text-violet-600">{fmt(month.user1_due)}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <TransferPill done={month.user1_transferred} name={config?.user1_username ?? 'User 1'} />
          <TransferPill done={month.user2_transferred} name={config?.user2_username ?? 'User 2'} />
        </div>
        {bothDone && !selectMode && (
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
            {t('months.closed')}
          </span>
        )}
      </div>
    </button>
  )
}

export default function MonthsPage() {
  const { t } = useTranslation()
  const { user, config } = useAuth()
  const navigate = useNavigate()
  const [months, setMonths]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected]     = useState(new Set())
  const [deleting, setDeleting]     = useState(false)

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

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return
    const label = `${selected.size}`
    if (!window.confirm(t('months.confirm_delete', { label }))) return
    setDeleting(true)
    try {
      await api.deleteMonths(Array.from(selected))
      setMonths(prev => prev.filter(m => !selected.has(m.id)))
      exitSelectMode()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 page-enter">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 safe-top px-4 pb-10 lg:pb-12">
        <div className="max-w-6xl mx-auto lg:px-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-violet-200 text-sm">{t('months.hello')}</p>
              <h1 className="text-2xl font-bold text-white capitalize">{user?.username}</h1>
              {config?.group_name && (
                <p className="text-violet-300 text-sm font-medium mt-0.5">{config.group_name}</p>
              )}
            </div>
            {/* Bouton paramètres visible uniquement sur mobile (sidebar gère ça sur desktop) */}
            <button
              onClick={() => navigate('/settings')}
              className="lg:hidden w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white active:bg-white/30 transition"
              aria-label={t('nav.settings')}
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
          <h2 className="text-lg font-bold text-slate-800">
            {selectMode ? (
              selected.size === 0 ? t('months.select_months') : t('months.selected', { count: selected.size })
            ) : t('nav.months')}
          </h2>
          <div className="flex items-center gap-3">
            {selectMode ? (
              <button
                onClick={exitSelectMode}
                className="text-sm font-medium text-slate-500 active:text-slate-700 transition"
              >
                {t('months.cancel')}
              </button>
            ) : (
              <>
                {months.length > 0 && (
                  <button
                    onClick={() => setSelectMode(true)}
                    className="text-sm font-medium text-slate-500 active:text-slate-700 transition"
                  >
                    {t('months.select')}
                  </button>
                )}
                <Link
                  to="/history"
                  className="lg:hidden flex items-center gap-1.5 text-sm font-medium text-violet-600 active:text-violet-800 transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                  {t('nav.history')}
                </Link>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          </div>
        ) : months.length === 0 ? (
          <div className="flex flex-col items-center py-10 px-4">
            <div className="w-20 h-20 bg-violet-100 rounded-3xl flex items-center justify-center mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-violet-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2 text-center">
              {config?.user2_username
                ? t('months.empty_welcome_two', {
                    user1: user?.username,
                    user2: user?.username === config.user1_username ? config.user2_username : config.user1_username
                  })
                : t('months.empty_welcome', { name: user?.username })}
            </h3>
            <p className="text-slate-500 text-sm text-center max-w-xs mb-7">
              {t('months.empty_hint')}
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="px-8 py-4 bg-violet-600 text-white font-bold rounded-2xl shadow-lg shadow-violet-200 active:scale-95 transition mb-8"
            >
              {t('months.btn_first_month')}
            </button>
            <div className="w-full max-w-sm space-y-3">
              {[
                { icon: '📅', title: t('months.tip_month_title'), desc: t('months.tip_month_desc') },
                { icon: '⚖️', title: t('months.tip_split_title'), desc: t('months.tip_split_desc') },
                { icon: '🔁', title: t('months.tip_recurring_title'), desc: t('months.tip_recurring_desc') },
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-3 bg-white rounded-2xl p-4 border border-slate-100">
                  <span className="text-xl mt-0.5">{tip.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{tip.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{tip.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {months.map(m => (
              <MonthCard
                key={m.id}
                month={m}
                config={config}
                isCurrent={m.year === NOW.getFullYear() && m.month === NOW.getMonth() + 1}
                onClick={selectMode ? () => toggleSelect(m.id) : () => navigate(`/months/${m.id}`)}
                selectMode={selectMode}
                selected={selected.has(m.id)}
                t={t}
              />
            ))}
          </div>
        )}
      </div>

      {/* Barre de suppression (mode sélection) */}
      {selectMode && (
        <div className="fixed bottom-24 lg:bottom-8 left-4 right-4 max-w-sm mx-auto z-10">
          <button
            onClick={handleBulkDelete}
            disabled={selected.size === 0 || deleting}
            className="w-full py-4 rounded-2xl font-semibold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-40 bg-red-500 shadow-red-200"
          >
            {deleting ? t('months.deleting') : selected.size === 0 ? t('months.select_months') : t('months.delete_btn', { count: selected.size })}
          </button>
        </div>
      )}

      {/* FAB */}
      {!selectMode && (
        <button
          onClick={() => setShowForm(true)}
          className="fixed bottom-24 lg:bottom-8 right-5 w-14 h-14 bg-violet-600 rounded-full shadow-xl shadow-violet-300 flex items-center justify-center active:scale-95 transition z-10"
          aria-label="Nouveau mois"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-7 h-7">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      )}

      <MonthForm
        open={showForm}
        config={config}
        onClose={() => setShowForm(false)}
        onCreated={handleMonthCreated}
      />
    </div>
  )
}
