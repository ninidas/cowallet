import { useTranslation } from 'react-i18next'
import { useFmt } from '../../hooks/useFmt'

// Dépensé (transactions importées) face au prévu, d'un coup d'œil
export default function SpentStrip({ bva, isCurrent }) {
  const { t, i18n } = useTranslation()
  const day = iso => new Date(`${iso}T00:00:00`).toLocaleDateString(i18n.language?.startsWith('en') ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short' })
  const fmt = useFmt()
  const gap = Math.round((bva.total_actual - bva.total_budget) * 100) / 100
  const over = gap > 0
  const pct = bva.total_budget > 0 ? Math.min(100, (bva.total_actual / bva.total_budget) * 100) : 100
  return (
    <div className="bg-white/10 rounded-2xl px-3.5 py-3 mb-3 lg:mb-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <span className="text-violet-100 text-xs whitespace-nowrap">
          {isCurrent ? t('month_detail.spent_to_date') : t('month_detail.spent')}
        </span>
        {gap !== 0 && (
          <span className={`shrink-0 whitespace-nowrap text-xs font-bold tabular-nums px-2.5 py-1 rounded-full ${over ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}`}>
            {over ? '+' : '−'}{t(over ? 'month_detail.over_budget' : 'month_detail.under_budget', { amount: fmt(Math.abs(gap)) })}
          </span>
        )}
      </div>
      <p className="text-white text-lg font-bold tabular-nums leading-tight">
        {fmt(bva.total_actual)} <span className="text-sm font-medium text-violet-200">{t('month_detail.of_planned', { amount: fmt(bva.total_budget) })}</span>
      </p>
      <div className="h-2 rounded-full bg-white/25 overflow-hidden relative">
        <div className={`h-full rounded-full ${over ? 'bg-red-300' : 'bg-emerald-300'}`} style={{ width: `${pct}%` }} />
        {over && <div className="absolute top-0 bottom-0 w-0.5 bg-white" style={{ left: `${(bva.total_budget / bva.total_actual) * 100}%` }} />}
      </div>
      {/* Mois passé : période réellement couverte par les transactions importées */}
      {!isCurrent && bva.first_date && (
        <p className="text-violet-100 text-xs">{t('months.spent_period', { from: day(bva.first_date), to: day(bva.last_date) })}</p>
      )}
      {bva.uncategorized > 0 && (
        <p className="text-violet-100 text-xs">{t('month_detail.incl_uncategorized', { amount: fmt(bva.uncategorized) })}</p>
      )}
    </div>
  )
}
