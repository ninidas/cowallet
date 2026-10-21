import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { useFmt } from '../hooks/useFmt'
import MonthForm from '../components/MonthForm'
import { useArm } from '../hooks/useArm'

const NOW = new Date()
const NOW_KEY = NOW.getFullYear() * 12 + NOW.getMonth() + 1
const monthKey = m => m.year * 12 + m.month

const shortDate = (iso, lang) => new Date(`${iso}T00:00:00`).toLocaleDateString(lang?.startsWith('en') ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short' })

const Check = ({ className = 'w-3 h-3' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3.2} stroke="currentColor" className={className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7" />
  </svg>
)
const Chevron = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-4 h-4 shrink-0" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
  </svg>
)

// Dépensé (transactions importées) face au prévu
function SpentBar({ spent, planned, from, to, isCurrent, fmt0, t, lang }) {
  const gap = Math.round(spent - planned)
  const over = gap > 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-slate-700 min-w-0">{t('months.spent_vs_planned', { spent: fmt0(spent), planned: fmt0(planned) })}</span>
        {gap !== 0 && (
          <span className={`font-bold tabular-nums shrink-0 ${over ? 'text-red-600' : 'text-emerald-700'}`}>
            {over ? '+' : '−'}{fmt0(Math.abs(gap))}
          </span>
        )}
      </div>
      <div className={`h-2 rounded-full overflow-hidden relative ${over ? 'bg-red-100' : 'bg-emerald-100'}`}>
        <div className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (spent / planned) * 100)}%` }} />
        {over && <div className="absolute top-0 bottom-0 w-0.5 bg-white" style={{ left: `${(planned / spent) * 100}%` }} />}
      </div>
      {/* Mois passé : période réellement couverte par les transactions importées */}
      {!isCurrent && from && to && (
        <p className="text-xs text-slate-500">{t('months.spent_period', { from: shortDate(from, lang), to: shortDate(to, lang) })}</p>
      )}
    </div>
  )
}

// Le mois en cours en grand, avec ce qu'il reste à faire
function CurrentCard({ month, config, myKey, onOpen, onCategorize, t }) {
  const fmt = useFmt()
  const fmt0 = useFmt({ maximumFractionDigits: 0 })
  const { i18n } = useTranslation()
  const done1 = month.user1_transferred, done2 = month.user2_transferred
  return (
    <div className="bg-white rounded-3xl border border-violet-100 shadow-lg shadow-violet-100/60 overflow-hidden">
      <button onClick={onOpen} className="w-full text-left p-5 space-y-4 active:bg-violet-50/50 transition">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wider text-violet-600 uppercase">{t('months.in_progress')}</p>
            <h3 className="text-xl font-extrabold text-slate-900 whitespace-nowrap">{month.label}</h3>
            <p className="text-sm text-slate-500">{t('months.total_split', { amount: fmt(month.total), split: `${month.user1_share}/${100 - month.user1_share}` })}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-slate-500">{t('months.your_share')}</p>
            <p className="text-2xl font-extrabold text-violet-700 tabular-nums">{fmt(myKey === 'user2' ? month.user2_due : month.user1_due)}</p>
          </div>
        </div>
        {month.spent != null && month.planned > 0 && (
          <SpentBar spent={month.spent} planned={month.planned} from={month.spent_from} to={month.spent_to} isCurrent fmt0={fmt0} t={t} lang={i18n.language} />
        )}
      </button>
      <div className="border-t border-slate-100 px-5 py-2">
        {month.uncategorized > 0 && (
          <button onClick={onCategorize} className="w-full flex items-center gap-3 py-2.5 text-sm font-semibold text-amber-800 text-left">
            <span className="w-6 h-6 rounded-full bg-amber-100 text-xs font-bold flex items-center justify-center shrink-0">{month.uncategorized}</span>
            <span className="flex-1">{t('months.todo_categorize', { count: month.uncategorized })}</span>
            <Chevron />
          </button>
        )}
        {done1 && done2 ? (
          <p className="flex items-center gap-3 py-2.5 text-sm text-emerald-700">
            <span className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0"><Check /></span>
            {t('months.transfers_done')}
          </p>
        ) : (
          [[done1, config?.user1_username], [done2, config?.user2_username]].filter(([d, n]) => !d && n).map(([, name]) => (
            <button key={name} onClick={onOpen} className="w-full flex items-center gap-3 py-2.5 text-sm text-slate-700 text-left">
              <span className="w-6 h-6 rounded-full bg-slate-100 shrink-0" />
              <span className="flex-1">{t('months.transfer_waiting', { name })}</span>
              <Chevron />
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// Un mois à venir : prévu et part, sans détail
function UpcomingCard({ month, myKey, onClick, t }) {
  const fmt = useFmt()
  return (
    <button onClick={onClick} className="w-full bg-white rounded-2xl border border-slate-200 px-4 py-3.5 flex items-center justify-between gap-3 text-left active:bg-slate-50 transition">
      <div className="min-w-0">
        <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">{t('months.upcoming')}</p>
        <p className="text-base font-bold text-slate-900">{month.label}</p>
        <p className="text-sm text-slate-500">{t('months.planned_total', { amount: fmt(month.total) })}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-slate-500">{t('months.your_share')}</p>
        <p className="text-lg font-bold text-violet-700 tabular-nums">{fmt(myKey === 'user2' ? month.user2_due : month.user1_due)}</p>
      </div>
    </button>
  )
}

// Un mois passé sur une ligne : réglé (coche) ou virement en attente
function MonthRow({ month, myKey, onClick, selectMode, selected, t }) {
  const fmt = useFmt()
  const settled = month.user1_transferred && month.user2_transferred
  const name = month.label.replace(/\s+\d{4}$/, '')
  return (
    <button onClick={onClick} aria-pressed={selectMode ? selected : undefined}
      className={`w-full min-h-[56px] px-4 py-2.5 flex items-center gap-3 text-left border-b border-slate-100 last:border-b-0 transition ${selected ? 'bg-violet-50' : 'active:bg-slate-50'}`}>
      {selectMode ? (
        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300'}`}>
          {selected && <Check />}
        </span>
      ) : settled ? (
        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"><Check /></span>
      ) : (
        <span className="w-5 h-5 rounded-full border-2 border-amber-400 shrink-0" />
      )}
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold text-slate-900">{name}</span>
        <span className="block text-xs text-slate-500">
          {t('months.total', { amount: fmt(month.total) })}
          {!settled && <span className="text-amber-700"> · {t('months.not_settled')}</span>}
          {month.uncategorized > 0 && <span className="text-amber-700"> · {t('months.to_categorize', { count: month.uncategorized })}</span>}
        </span>
      </span>
      <span className="text-[15px] font-bold text-slate-700 tabular-nums">{fmt(myKey === 'user2' ? month.user2_due : month.user1_due)}</span>
    </button>
  )
}

export default function MonthsPage() {
  const { t } = useTranslation()
  const { user, config, getMyUserKey } = useAuth()
  const myKey = getMyUserKey()
  const navigate = useNavigate()
  const [months, setMonths]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [loadError, setLoadError]   = useState(false)
  const [showForm, setShowForm]     = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected]     = useState(new Set())
  const [deleting, setDeleting]     = useState(false)
  const [armedBulk, confirmBulk]    = useArm()

  const current  = months.find(m => monthKey(m) === NOW_KEY)
  const upcoming = months.filter(m => monthKey(m) > NOW_KEY).sort((a, b) => monthKey(a) - monthKey(b))
  // En mode sélection, tous les mois passent en lignes pour être cochés
  const rows = selectMode ? months : months.filter(m => monthKey(m) < NOW_KEY)
  const pastByYear = [...new Set(rows.map(m => m.year))].sort((a, b) => b - a)
    .map(y => [y, rows.filter(m => m.year === y).sort((a, b) => monthKey(b) - monthKey(a))])

  async function load() {
    try {
      const data = await api.getMonths()
      setMonths(data)
      setLoadError(false)
    } catch {
      setLoadError(true)
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
    // Deux touches : la première arme le bouton (rouge vif, « Confirmer »), la seconde supprime
    if (!confirmBulk('bulk')) return
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
      {/* En-tête : le même sur toutes les pages (titre, sous-titre, actions à droite) */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 safe-top px-4 pb-14 lg:pb-16">
        <div className="max-w-6xl mx-auto lg:px-6 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-violet-200 text-sm truncate">
              {selectMode
                ? (selected.size === 0 ? t('months.select_months') : t('months.selected', { count: selected.size }))
                : `${t('months.hello')} ${user?.displayName ?? user?.username ?? ''}`}
            </p>
            <h1 className="text-2xl font-extrabold text-white">{t('nav.months')}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {selectMode ? (
              <button onClick={exitSelectMode}
                className="h-10 px-4 rounded-full bg-white/20 text-white text-sm font-semibold active:bg-white/30 transition">
                {t('months.cancel')}
              </button>
            ) : (
              <>
                <Link to="/search" aria-label={t('search.title')}
                  className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white active:bg-white/30 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </Link>
                {months.length > 0 && (
                  <button onClick={() => setSelectMode(true)} aria-label={t('months.select_months')}
                    className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white active:bg-white/30 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <rect x="4" y="4" width="16" height="16" rx="4" /><path strokeLinecap="round" strokeLinejoin="round" d="M8.5 12l2.5 2.5 4.5-5" />
                    </svg>
                  </button>
                )}
                {/* Réglages : sur ordinateur, la barre latérale s'en charge */}
                <button onClick={() => navigate('/settings')} aria-label={t('nav.settings')}
                  className="lg:hidden w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white active:bg-white/30 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 lg:px-6 -mt-10 pb-28 lg:pb-10">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          </div>
        ) : loadError ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center space-y-3">
            <p className="font-semibold text-slate-800">{t('months.load_error_title')}</p>
            <p className="text-sm text-slate-500">{t('months.load_error_hint')}</p>
            <button onClick={() => { setLoading(true); load() }}
              className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold active:bg-violet-700 transition">
              {t('months.btn_retry')}
            </button>
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
                    user1: user?.displayName ?? user?.username,
                    user2: user?.username === (config.user1_login ?? config.user1_username) ? config.user2_username : config.user1_username
                  })
                : t('months.empty_welcome', { name: user?.displayName ?? user?.username })}
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
          <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start space-y-3 lg:space-y-0">
            {/* Le mois en cours et ceux à venir */}
            {!selectMode && (current || upcoming.length > 0) && (
              <div className="space-y-3">
                {current && (
                  <CurrentCard month={current} config={config} myKey={myKey} t={t}
                    onOpen={() => navigate(`/months/${current.id}`)}
                    onCategorize={() => navigate(`/months/${current.id}?tab=transactions`)} />
                )}
                {upcoming.map(m => (
                  <UpcomingCard key={m.id} month={m} myKey={myKey} t={t} onClick={() => navigate(`/months/${m.id}`)} />
                ))}
              </div>
            )}
            {/* Les autres mois, une ligne chacun, par année (en mode sélection : tous les mois) */}
            <div className="space-y-4">
              {pastByYear.map(([year, list]) => (
                <section key={year} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  {/* L'année dans la carte : lisible même posée sur le dégradé de l'en-tête (ordinateur) */}
                  <div className="flex justify-between items-baseline px-4 pt-3 pb-2 border-b border-slate-100 bg-slate-50/60">
                    <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">{year}</h2>
                    {!selectMode && <span className="text-xs text-slate-500">{t('months.your_share')}</span>}
                  </div>
                  <div>
                    {list.map(m => (
                      <MonthRow key={m.id} month={m} myKey={myKey} t={t}
                        selectMode={selectMode} selected={selected.has(m.id)}
                        onClick={selectMode ? () => toggleSelect(m.id) : () => navigate(`/months/${m.id}`)} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Barre de suppression (mode sélection) */}
      {selectMode && (
        <div className="fixed above-nav left-4 right-4 max-w-sm mx-auto z-10">
          <button
            onClick={handleBulkDelete}
            disabled={selected.size === 0 || deleting}
            className={`w-full py-4 rounded-2xl font-semibold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-40 shadow-red-200 ${armedBulk ? 'bg-red-700 ring-4 ring-red-200' : 'bg-red-500'}`}
          >
            {deleting ? t('months.deleting') : selected.size === 0 ? t('months.select_months') : t(armedBulk ? 'months.confirm_delete_btn' : 'months.delete_btn', { count: selected.size })}
          </button>
        </div>
      )}

      {/* FAB */}
      {!selectMode && (
        <button
          onClick={() => setShowForm(true)}
          className="fixed above-nav right-5 w-14 h-14 bg-violet-600 rounded-full shadow-xl shadow-violet-300 flex items-center justify-center active:scale-95 transition z-10"
          aria-label={t('months.aria_new_month')}
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
