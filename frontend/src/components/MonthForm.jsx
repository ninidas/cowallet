import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { getMonthNames } from '../constants'
import BottomSheet from './BottomSheet'

function getDefaultYearMonth() {
  const now = new Date()
  let m = now.getMonth() + 2 // prochain mois
  let y = now.getFullYear()
  if (m > 12) { m = 1; y++ }
  return { year: y, month: m }
}

export default function MonthForm({ open, onClose, onCreated, config }) {
  const { t, i18n } = useTranslation()
  const MONTH_NAMES = getMonthNames(i18n.language)
  const defaults = getDefaultYearMonth()
  const [year, setYear]       = useState(defaults.year)
  const [month, setMonth]     = useState(defaults.month)
  const [share, setShare]     = useState(50)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      const d = getDefaultYearMonth()
      setYear(d.year)
      setMonth(d.month)
      setShare(config?.default_user1_share ?? 50)
      setError('')
    }
  }, [open, config])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const newMonth = await api.createMonth({ year, month: parseInt(month), user1_share: share })
      onCreated(newMonth)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const user1 = config?.user1_username ?? 'User 1'
  const user2 = config?.user2_username ?? 'User 2'
  const user2Share = 100 - share

  // Années disponibles : -1 à +2 ans
  const currentYear = new Date().getFullYear()
  const years = [currentYear - 1, currentYear, currentYear + 1]

  return (
    <BottomSheet open={open} onClose={onClose} title={t('monthform.title')}>
      <form onSubmit={handleSubmit} className="px-4 pb-safe space-y-5">

        {/* Month / year selection */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">{t('monthform.field_month')}</label>
            <select
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent appearance-none"
            >
              {MONTH_NAMES.slice(1).map((name, i) => (
                <option key={i + 1} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">{t('monthform.field_year')}</label>
            <select
              value={year}
              onChange={e => setYear(parseInt(e.target.value))}
              className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent appearance-none"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Répartition */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-3">
            {t('monthform.field_split')}
            <span className="ml-2 font-bold text-violet-600 capitalize">{user1} {share}%</span>
            <span className="text-slate-400"> · </span>
            <span className="font-bold text-indigo-500 capitalize">{user2} {user2Share}%</span>
          </label>

          {/* Slider */}
          <div className="relative px-1">
            <input
              type="range"
              min="1"
              max="99"
              value={share}
              onChange={e => setShare(parseInt(e.target.value))}
              className="w-full h-2 appearance-none rounded-full cursor-pointer"
              style={{
                background: `linear-gradient(to right, #7c3aed ${share}%, #e2e8f0 ${share}%)`,
              }}
            />
          </div>

          {/* Présets rapides */}
          <div className="flex gap-2 mt-3 justify-center">
            {[
              { label: '50/50', value: 50 },
              { label: '60/40', value: 60 },
              { label: '70/30', value: 70 },
            ].map(preset => (
              <button
                type="button"
                key={preset.label}
                onClick={() => setShare(preset.value)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition active:scale-95 ${
                  share === preset.value
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Info récurrentes */}
        <div className="flex items-start gap-3 bg-violet-50 rounded-2xl px-4 py-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-violet-500 mt-0.5 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          <p className="text-xs text-violet-700">{t('monthform.recurring_hint')}</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-violet-600 text-white font-semibold shadow-lg shadow-violet-200 active:scale-95 transition disabled:opacity-60 disabled:scale-100"
        >
          {loading ? t('monthform.btn_loading') : t('monthform.btn_create', { month: MONTH_NAMES[month], year })}
        </button>

        <div className="h-2" />
      </form>
    </BottomSheet>
  )
}
