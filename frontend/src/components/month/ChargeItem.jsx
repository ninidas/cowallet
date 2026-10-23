import { useTranslation } from 'react-i18next'
import { useFmt } from '../../hooks/useFmt'
import { cleanAmountInput, parseAmount } from '../../utils/amount'

// ── Charge item ────────────────────────────────────────────────────────────────
export default function ChargeItem({ charge, onTap, onSwipeDelete, config, suiviMode, actualValue, onActualChange }) {
  const { t } = useTranslation()
  const fmt = useFmt()
  const paidBy = charge.paid_by === 1 ? config?.user1_username : charge.paid_by === 2 ? config?.user2_username : null

  if (suiviMode) {
    const parsed = actualValue !== '' && !isNaN(parseAmount(actualValue)) ? parseAmount(actualValue) : null
    const delta = parsed !== null ? parsed - charge.amount : null
    return (
      <div className="flex items-center gap-3 py-3 px-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900 truncate text-sm">{charge.label}</p>
          <p className="text-xs text-slate-400">{fmt(charge.amount)} {t('month_detail.forecast_tag')}</p>
        </div>
        <input
          type="text" inputMode="decimal" autoComplete="off"
          value={actualValue}
          onChange={e => onActualChange(cleanAmountInput(e.target.value))}
          placeholder={String(charge.amount)}
          className="w-28 px-3 py-1.5 text-sm font-semibold text-right border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
        />
        {delta !== null && delta !== 0 && (
          <span className={`text-xs font-semibold shrink-0 w-16 text-right ${delta > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
            {delta > 0 ? '+' : ''}{fmt(delta)}
          </span>
        )}
        {delta === null && <span className="w-16 shrink-0" />}
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden bg-white group">
      <div className="relative bg-white">
        <button
          onClick={() => onTap(charge)}
          className="w-full flex items-center gap-3 py-3 px-4 min-h-[52px] lg:group-hover:pr-12 active:bg-violet-50 active:scale-[0.99] transition-all text-left"
        >
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-slate-900 break-words min-w-0">{charge.label}</span>
              {/* On ne signale que l'exception : la plupart des dépenses reviennent chaque mois */}
              {charge.installments_total > 1 ? (
                <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full shrink-0">
                  {charge.installments_total - charge.installments_left + 1}/{charge.installments_total}
                </span>
              ) : !charge.is_recurring && (
                <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                  {t('month_detail.one_off')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap empty:hidden mt-1">
              {paidBy && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{t('month_detail.advanced_by', { name: paidBy })}</span>
              )}
              {charge.note && (
                <span className="text-xs text-slate-400 italic truncate max-w-[160px]">{charge.note}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end shrink-0 gap-0.5">
            {charge.actual_amount != null ? (
              <>
                <span className="text-xs text-slate-400 line-through tabular-nums">{fmt(charge.amount)}</span>
                <span className={`text-base font-bold tabular-nums ${charge.actual_amount > charge.amount ? 'text-red-600' : charge.actual_amount < charge.amount ? 'text-emerald-600' : 'text-slate-800'}`}>
                  {fmt(charge.actual_amount)}
                </span>
                {charge.actual_amount !== charge.amount && (
                  <span className={`text-xs font-semibold tabular-nums ${charge.actual_amount > charge.amount ? 'text-red-400' : 'text-emerald-400'}`}>
                    {charge.actual_amount > charge.amount ? '+' : ''}{fmt(charge.actual_amount - charge.amount)}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="text-base font-bold text-slate-800 tabular-nums">{fmt(charge.amount)}</span>
                {charge.delta != null && charge.delta !== 0 && (
                  <span className={`text-xs font-semibold tabular-nums flex items-center gap-0.5 ${charge.delta > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                    {charge.delta > 0 ? '▲' : '▼'}{fmt(Math.abs(charge.delta))}
                  </span>
                )}
              </>
            )}
          </div>
        </button>
      </div>

      {/* Bouton delete au hover : desktop uniquement */}
      <button
        onClick={() => onSwipeDelete(charge)}
        className="hidden lg:flex absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-red-50 text-red-400 items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 transition-all"
        aria-label={t('month_detail.aria_delete')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      </button>
    </div>
  )
}
