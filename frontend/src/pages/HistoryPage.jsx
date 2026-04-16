import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { api } from '../api'
import { useCategoriesMap } from '../hooks/useCategoriesMap'

function formatEur(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

function formatEurShort(n) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

function shortLabel(label) {
  // label is "Month Year" e.g. "January 2025" or "Janvier 2025"
  const parts = label.split(' ')
  const year = parts[parts.length - 1]
  const month = parts.slice(0, parts.length - 1).join(' ')
  return `${month.slice(0, 3)}. ${String(year).slice(2)}`
}

function StatCard({ label, value, sub, color = 'text-slate-800' }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-100">
      <p className="text-xs font-medium text-slate-400 mb-1">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-3 text-sm">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      <p className="font-bold text-violet-600">{formatEur(payload[0]?.value)}</p>
    </div>
  )
}

export default function HistoryPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { categoriesMap } = useCategoriesMap()
  const [months, setMonths]       = useState([])
  const [statsData, setStatsData] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
    Promise.all([api.getMonths(), api.getStats()])
      .then(([m, s]) => {
        setMonths([...m].reverse())
        setStatsData(s)
      })
      .finally(() => setLoading(false))
  }, [])

  const chartData = months.map(m => ({
    label: shortLabel(m.label),
    total: m.total,
  }))

  const totalCumul = months.reduce((s, m) => s + m.total, 0)
  const avgTotal   = months.length ? totalCumul / months.length : 0
  const maxMonth   = months.length ? months.reduce((a, b) => a.total > b.total ? a : b) : null
  const minMonth   = months.length ? months.reduce((a, b) => a.total < b.total ? a : b) : null

  // Catégories présentes dans les données par mois (dynamique)
  const activeCategories = statsData?.by_month?.length
    ? Object.keys(statsData.by_month[0]).filter(k => k !== 'label' && statsData.by_month.some(row => row[k] > 0))
    : []

  const byMonthChart = (statsData?.by_month ?? []).map(row => ({
    ...row,
    label: shortLabel(row.label),
  }))

  return (
    <div className="min-h-screen bg-slate-50 pb-safe page-enter">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 safe-top px-4 pb-10 lg:pb-12">
        <div className="max-w-6xl mx-auto lg:px-6 flex items-center gap-3">
          <button
            onClick={() => navigate('/months')}
            className="lg:hidden w-10 h-10 rounded-full bg-white/20 flex items-center justify-center active:bg-white/30 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">{t('history.title')}</h1>
            <p className="text-violet-200 text-xs">{t('history.months_count_other', { count: months.length })}</p>
          </div>
          {months.length > 0 && (
            <button
              onClick={async () => {
                setExporting(true)
                try { await api.exportCsv() } finally { setExporting(false) }
              }}
              disabled={exporting}
              className="flex items-center gap-1.5 bg-white/20 text-white text-sm font-medium px-3 py-2 rounded-xl active:bg-white/30 transition disabled:opacity-60"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              {exporting ? '…' : 'CSV'}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 lg:px-6 -mt-5 lg:-mt-8 space-y-4">

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
            {/* Stats — 3 cartes */}
            <div className="grid grid-cols-3 gap-2">
              <StatCard
                label={t('history.stat_avg')}
                value={formatEurShort(avgTotal)}
                sub={`${months.length} mois`}
                color="text-violet-600"
              />
              {maxMonth && (
                <StatCard
                  label={t('history.stat_max')}
                  value={formatEurShort(maxMonth.total)}
                  sub={shortLabel(maxMonth.label)}
                  color="text-red-500"
                />
              )}
              {minMonth && (
                <StatCard
                  label={t('history.stat_min')}
                  value={formatEurShort(minMonth.total)}
                  sub={shortLabel(minMonth.label)}
                  color="text-emerald-600"
                />
              )}
            </div>

            <div className="lg:grid lg:grid-cols-2 lg:gap-4">
            {/* Graphe évolution totale */}
            {months.length >= 2 && (
              <div className="bg-white rounded-3xl p-4 border border-slate-100">
                <p className="text-sm font-semibold text-slate-700 mb-4 px-1">{t('history.section_monthly_trend')}</p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tickFormatter={v => v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(v)}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false} tickLine={false} width={48}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="total" stroke="#7c3aed" strokeWidth={2.5}
                      dot={{ r: 4, fill: '#7c3aed', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Graphe lignes par catégorie */}
            {months.length >= 2 && byMonthChart.length > 0 && (
              <div className="bg-white rounded-3xl p-4 border border-slate-100">
                <p className="text-sm font-semibold text-slate-700 mb-1 px-1">{t('history.section_by_category')}</p>
                <p className="text-xs text-slate-400 mb-4 px-1">{t('history.section_by_month')}</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={byMonthChart} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tickFormatter={v => v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(v)}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false} tickLine={false} width={48}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip
                      formatter={(value, name) => [formatEur(value), name]}
                      contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', fontSize: 12 }}
                    />
                    {activeCategories.map(cat => {
                      const color = categoriesMap.get(cat)?.color ?? '#94a3b8'
                      return (
                        <Line
                          key={cat}
                          type="monotone"
                          dataKey={cat}
                          stroke={color}
                          strokeWidth={2}
                          dot={{ r: 3, fill: color, strokeWidth: 0 }}
                          activeDot={{ r: 5 }}
                          connectNulls
                        />
                      )
                    })}
                  </LineChart>
                </ResponsiveContainer>
                {/* Légende */}
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 px-1">
                  {activeCategories.map(cat => (
                    <div key={cat} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: categoriesMap.get(cat)?.color ?? '#94a3b8' }} />
                      <span className="text-xs text-slate-500">{cat}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            </div>{/* fin grid graphes */}

            <div className="lg:grid lg:grid-cols-2 lg:gap-4">
            {/* Répartition par catégorie */}
            {statsData?.by_category?.length > 0 && (
              <div className="bg-white rounded-3xl p-4 border border-slate-100">
                <p className="text-sm font-semibold text-slate-700 mb-4 px-1">{t('history.section_category_breakdown')}</p>
                <div className="space-y-3">
                  {statsData.by_category.map(({ category, total, pct }) => {
                    const catData = categoriesMap.get(category)
                    const color = catData?.color ?? '#94a3b8'
                    return (
                      <div key={category}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{catData?.icon ?? '•'}</span>
                            <span className="text-sm font-medium text-slate-700">{category}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">{pct}%</span>
                            <span className="text-sm font-bold text-slate-800 tabular-nums">{formatEurShort(total)}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: color, transition: 'width 0.6s ease' }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Top charges récurrentes */}
            {statsData?.top_recurring?.length > 0 && (
              <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-50">
                  <p className="text-sm font-semibold text-slate-700">{t('history.section_recurring')}</p>
                </div>
                <div className="divide-y divide-slate-50">
                  {statsData.top_recurring.map((c, i) => {
                    const catData = categoriesMap.get(c.category)
                    return (
                      <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                        <span className="text-lg w-7 text-center shrink-0">{catData?.icon ?? '•'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{c.label}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{t('history.recurring_months', { count: c.count })} {formatEur(c.avg)}</p>
                        </div>
                        <p className="text-sm font-bold text-slate-700 tabular-nums shrink-0">{formatEurShort(c.total)}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            </div>{/* fin grid catégorie + top recurring */}

            {/* Table récap par mois */}
            <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-50">
                <p className="text-sm font-semibold text-slate-700">{t('history.section_month_detail')}</p>
              </div>
              <div className="divide-y divide-slate-50">
                {[...months].reverse().map(m => (
                  <button
                    key={m.id}
                    onClick={() => navigate(`/months/${m.id}`)}
                    className="w-full flex items-center justify-between px-4 py-3.5 active:bg-slate-50 transition text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{m.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {t('history.each_person', { amount: formatEurShort(m.total / 2) })}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-slate-700 tabular-nums">{formatEur(m.total)}</p>
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
