import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { api } from '../api'
import { useCategoriesMap } from '../hooks/useCategoriesMap'
import { useFmt } from '../hooks/useFmt'
import { useAuth } from '../context/AuthContext'
import CategoryBreakdown from '../components/history/CategoryBreakdown'

// Clé renvoyée par le serveur pour les transactions pas encore catégorisées
const UNCATEGORIZED = '__uncategorized__'
const PLANNED_KEY = '__planned__'

function round2(n) { return Math.round(n * 100) / 100 }

function shortLabel(label) {
  // label is "Month Year" e.g. "January 2025" or "Janvier 2025"
  const parts = label.split(' ')
  const year = parts[parts.length - 1]
  const month = parts.slice(0, parts.length - 1).join(' ')
  // Juin et juillet donneraient tous deux « Jui. »
  const short = { juin: 'Juin', juillet: 'Juil.' }[month.toLowerCase()] ?? `${month.slice(0, 3)}.`
  return `${short} ${String(year).slice(2)}`
}

// Trois chiffres dans une seule carte : libellés courts, sur une ligne même à 375 px
function Stat({ label, value, sub, color }) {
  return (
    <div className="px-3 py-3.5 min-w-0">
      <p className="text-xs text-slate-500 truncate">{label}</p>
      <p className={`text-lg font-extrabold tabular-nums mt-1 ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 truncate">{sub}</p>
    </div>
  )
}

export default function HistoryPage() {
  const { t } = useTranslation()
  const fmt = useFmt()
  const fmtShort = useFmt({ maximumFractionDigits: 0 })
  const navigate = useNavigate()
  const { getMyUserKey } = useAuth()
  const myKey = getMyUserKey()
  const { categoriesMap } = useCategoriesMap()
  const [months, setMonths]       = useState([])
  const [statsData, setStatsData] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [exporting, setExporting] = useState(false)
  const [yearFilter, setYearFilter] = useState('all')
  const [chartMode, setChartMode] = useState('planned')   // barres du prévu ou du réel (transactions)

  useEffect(() => {
    window.scrollTo(0, 0)
    api.getMonths().then(m => setMonths([...m].reverse())).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const year = yearFilter === 'all' ? null : yearFilter
    api.getStats(year).then(s => setStatsData(s))
  }, [yearFilter])

  const years = [...new Set(months.map(m => m.year))].sort()
  const filtered = yearFilter === 'all' ? months : months.filter(m => m.year === yearFilter)

  const totalCumul = filtered.reduce((s, m) => s + m.total, 0)
  const avgTotal   = filtered.length ? totalCumul / filtered.length : 0
  const maxMonth   = filtered.length ? filtered.reduce((a, b) => a.total > b.total ? a : b) : null
  const minMonth   = filtered.length ? filtered.reduce((a, b) => a.total < b.total ? a : b) : null

  // Graphe par mois : le prévu, ou le réel des transactions avec le prévu en trait pour comparer.
  // En réel, seuls les mois qui ont des transactions (les autres seraient des barres vides).
  const inYear = row => yearFilter === 'all' || filtered.some(m => m.label === row.label)
  const sumRow = row => round2(Object.entries(row ?? {}).reduce((s, [k, v]) => k === 'label' ? s : s + v, 0))
  const hasActual = row => Object.keys(row).some(k => k !== 'label' && row[k] > 0)
  const actualRows = (statsData?.by_month_actual ?? []).filter(row => inYear(row) && hasActual(row))
  const showActual = chartMode === 'actual' && actualRows.length > 0
  const chartRows = showActual
    ? actualRows.map(row => ({ ...row, [PLANNED_KEY]: sumRow(statsData.by_month.find(r => r.label === row.label)) }))
    : (statsData?.by_month ?? []).filter(inYear)
  const activeCategories = [...new Set(chartRows.flatMap(row => Object.keys(row)))]
    .filter(k => k !== 'label' && k !== PLANNED_KEY && chartRows.some(row => row[k] > 0))
    .sort((a, b) => (a === UNCATEGORIZED) - (b === UNCATEGORIZED))
  const byMonthChart = chartRows.map(row => ({ ...row, label: shortLabel(row.label) }))
  const catName  = cat => cat === UNCATEGORIZED ? t('month_detail.uncategorized_row') : cat
  const catColor = cat => cat === UNCATEGORIZED ? '#f59e0b' : categoriesMap.get(cat)?.color ?? '#94a3b8'

  return (
    <div className="min-h-screen bg-slate-50 pb-safe page-enter">
      {/* En-tête : le même sur toutes les pages ; pas de flèche retour, c'est un onglet */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 safe-top px-4 pb-14 lg:pb-16">
        <div className="max-w-6xl mx-auto lg:px-6 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-violet-200 text-sm">{t('history.months_count', { count: filtered.length })}</p>
            <h1 className="text-2xl font-extrabold text-white">{t('history.title')}</h1>
          </div>
          {months.length > 0 && (
            <button
              onClick={async () => {
                setExporting(true)
                try { await api.exportCsv() } finally { setExporting(false) }
              }}
              disabled={exporting}
              className="h-10 flex items-center gap-1.5 bg-white/20 text-white text-sm font-semibold px-4 rounded-full active:bg-white/30 transition disabled:opacity-60"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              {exporting ? '…' : 'CSV'}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 lg:px-6 -mt-10 space-y-4">

        {/* Filtre par année */}
        {years.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setYearFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition ${yearFilter === 'all' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
            >
              {t('history.filter_all')}
            </button>
            {years.map(y => (
              <button
                key={y}
                onClick={() => setYearFilter(y)}
                className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition ${yearFilter === y ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
              >
                {y}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          </div>
        ) : months.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-100 mt-4">
            <div className="text-4xl mb-3">📊</div>
            <p className="font-semibold text-slate-700">{t('history.no_data')}</p>
          </div>
        ) : (
          <>
            {/* Trois chiffres */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg shadow-violet-100/50 grid grid-cols-3 divide-x divide-slate-100">
              <Stat label={t('history.stat_avg_short')} value={fmtShort(avgTotal)} sub={t('history.stat_per_month')} color="text-violet-700" />
              {maxMonth && <Stat label={t('history.stat_max_short')} value={fmtShort(maxMonth.total)} sub={maxMonth.label} color="text-red-600" />}
              {minMonth && <Stat label={t('history.stat_min_short')} value={fmtShort(minMonth.total)} sub={minMonth.label} color="text-emerald-700" />}
            </div>

            {/* Une barre par mois, découpée par catégorie (remplace les 6 courbes superposées) */}
            {months.length >= 2 && byMonthChart.length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-slate-200">
                <div className="flex items-start justify-between gap-3 px-1">
                  <p className="text-sm font-bold text-slate-800 pt-1">{t('history.section_by_month_bars')}</p>
                  {actualRows.length > 0 && (
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-xl shrink-0" role="group">
                      {['planned', 'actual'].map(mode => (
                        <button key={mode} onClick={() => setChartMode(mode)} aria-pressed={chartMode === mode}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${chartMode === mode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                          {t(`history.${mode}`)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 mb-4 px-1">{t(showActual ? 'history.section_by_month_bars_hint_actual' : 'history.section_by_month_bars_hint')}</p>
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={byMonthChart} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barCategoryGap="22%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tickFormatter={v => v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(v)}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false} tickLine={false} width={48}
                    />
                    <Tooltip
                      cursor={{ fill: '#f5f3ff' }}
                      formatter={(value, name) => [fmt(value), name === PLANNED_KEY ? t('history.planned') : catName(name)]}
                      contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', fontSize: 12 }}
                    />
                    {activeCategories.map((cat, i) => (
                      <Bar key={cat} dataKey={cat} stackId="m" fill={catColor(cat)}
                        radius={i === activeCategories.length - 1 ? [4, 4, 0, 0] : 0} />
                    ))}
                    {showActual && (
                      <Line dataKey={PLANNED_KEY} stroke="#334155" strokeWidth={2} strokeDasharray="5 4"
                        dot={{ r: 3, fill: '#334155', strokeWidth: 0 }} activeDot={{ r: 4 }} isAnimationActive={false} />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 px-1">
                  {activeCategories.map(cat => (
                    <div key={cat} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: catColor(cat) }} />
                      <span className="text-xs text-slate-600">{catName(cat)}</span>
                    </div>
                  ))}
                  {showActual && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-4 border-t-2 border-dashed border-slate-700 shrink-0" />
                      <span className="text-xs text-slate-600">{t('history.planned')}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Prévu face au réel par catégorie, et les commerçants d'une catégorie dépliée */}
            {statsData && (
              <CategoryBreakdown key={yearFilter} stats={statsData} months={filtered} categoriesMap={categoriesMap}
                shortLabel={shortLabel} onOpenMonth={id => navigate(`/months/${id}?tab=transactions`)} />
            )}

            {/* Table récap par mois */}
            <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-50">
                <p className="text-sm font-semibold text-slate-700">{t('history.section_month_detail')}</p>
              </div>
              <div className="divide-y divide-slate-50">
                {[...filtered].reverse().map(m => (
                  <button
                    key={m.id}
                    onClick={() => navigate(`/months/${m.id}`)}
                    className="w-full flex items-center justify-between px-4 py-3.5 active:bg-slate-50 transition text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{m.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {m.user1_share === 50
                          ? t('history.each_person', { amount: fmtShort(myKey === 'user2' ? m.user2_due : m.user1_due) })
                          : t('history.your_share', { amount: fmtShort(myKey === 'user2' ? m.user2_due : m.user1_due) })}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-slate-700 tabular-nums">{fmt(m.total)}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="h-4" />
          </>
        )}
      </div>
    </div>
  )
}
