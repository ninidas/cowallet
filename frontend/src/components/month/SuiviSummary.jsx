import { useTranslation } from 'react-i18next'
import { useFmt } from '../../hooks/useFmt'
import { parseAmount } from '../../utils/amount'

// Bandeau récap suivi : prévu, réel estimé avec les montants en cours de saisie, et l'écart
export default function SuiviSummary({ month, actualsMap }) {
  const { t } = useTranslation()
  const fmt = useFmt()
  const totalPrevu = month.charges.reduce((s, c) => s + c.amount, 0)
  const totalReel  = month.charges.reduce((s, c) => {
    const v = actualsMap[c.id]?.trim()
    return s + (v && !isNaN(parseAmount(v)) ? parseAmount(v) : c.amount)
  }, 0)
  const delta = totalReel - totalPrevu
  return (
    <div className={`mb-3 p-4 rounded-2xl ${delta > 0 ? 'bg-red-50 border border-red-100' : delta < 0 ? 'bg-emerald-50 border border-emerald-100' : 'bg-slate-50 border border-slate-100'}`}>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-500">{t('month_detail.forecast')}</span>
        <span className="font-semibold text-slate-800">{fmt(totalPrevu)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-slate-500">{t('month_detail.actual_estimated')}</span>
        <span className={`font-bold ${delta > 0 ? 'text-red-600' : delta < 0 ? 'text-emerald-600' : 'text-slate-800'}`}>{fmt(totalReel)}</span>
      </div>
      {delta !== 0 && (
        <div className={`flex justify-between text-sm font-bold mt-2 pt-2 border-t ${delta > 0 ? 'border-red-100 text-red-600' : 'border-emerald-100 text-emerald-600'}`}>
          <span>{delta > 0 ? t('month_detail.overspend') : t('month_detail.savings')}</span>
          <span>{delta > 0 ? '+' : ''}{fmt(delta)}</span>
        </div>
      )}
    </div>
  )
}
