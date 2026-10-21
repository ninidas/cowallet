import { useTranslation } from 'react-i18next'
import { useFmt } from '../../hooks/useFmt'

// ── Budget vs actual card ──────────────────────────────────────────────────────
export default function BudgetVsActualCard({ bva }) {
  const { t } = useTranslation()
  const fmt = useFmt()
  if (!bva || (bva.rows.length === 0 && !bva.uncategorized)) return null
  const gap = Math.round((bva.total_actual - bva.total_budget) * 100) / 100
  const over = gap > 0
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">{t('month_detail.forecast_vs_actual')}</p>
      </div>
      <div className="divide-y divide-slate-50">
        {bva.rows.map(row => (
          <div key={row.category} className="flex items-center gap-3 px-4 py-3">
            <span className="text-lg w-7 text-center shrink-0">{row.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">{row.category}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: row.budget > 0 ? `${Math.min((row.actual / row.budget) * 100, 100)}%` : '0%',
                      backgroundColor: row.delta > 0 ? '#ef4444' : row.color,
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-sm font-bold tabular-nums ${row.delta > 0 ? 'text-red-500' : 'text-slate-800'}`}>
                {fmt(row.actual)}
              </p>
              <p className="text-xs text-slate-400 tabular-nums">/ {fmt(row.budget)}</p>
            </div>
            {row.delta !== 0 && (
              <span className={`text-xs font-bold tabular-nums w-12 text-right shrink-0 ${row.delta > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {row.delta > 0 ? '+' : ''}{fmt(row.delta)}
              </span>
            )}
          </div>
        ))}
        {/* Pas encore catégorisé : compté dans le réel, pour que le total dise vrai */}
        {bva.uncategorized > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-50">
            <span className="w-7 flex justify-center shrink-0"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /></span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">{t('month_detail.uncategorized_row')}</p>
              <p className="text-xs text-amber-800">{t('month_detail.to_classify', { count: bva.uncategorized_count })}</p>
            </div>
            <p className="text-sm font-bold tabular-nums text-amber-800 shrink-0">{fmt(bva.uncategorized)}</p>
            <span className="text-xs font-bold tabular-nums w-12 text-right shrink-0 text-amber-800">+{fmt(bva.uncategorized)}</span>
          </div>
        )}
      </div>
      <div className={`px-4 py-3 ${over ? 'bg-red-50' : 'bg-emerald-50'}`}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-600">{t('month_detail.total')}</p>
          <span className={`text-base font-bold tabular-nums ${over ? 'text-red-600' : 'text-emerald-700'}`}>
            {gap > 0 ? '+' : ''}{fmt(gap)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-600 tabular-nums mt-0.5">
          <span>{t('month_detail.actual_estimated_short', { amount: fmt(bva.total_actual) })}</span>
          <span>{t('month_detail.forecast_tag')} {fmt(bva.total_budget)}</span>
        </div>
      </div>
    </div>
  )
}
