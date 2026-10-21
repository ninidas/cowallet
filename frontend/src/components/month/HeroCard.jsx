import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useFmt } from '../../hooks/useFmt'
import SpentStrip from './SpentStrip'

// ── Hero card ──────────────────────────────────────────────────────────────────
export default function HeroCard({ month, bva }) {
  const { t } = useTranslation()
  const fmt = useFmt()
  const { getMyUserKey } = useAuth()
  const equal = month.user1_share === month.user2_share
  // Hors 50/50, chacun voit sa propre part
  const myDue = getMyUserKey() === 'user2' ? month.user2_due : month.user1_due
  const delta = month.prev_total != null ? month.total - month.prev_total : null
  const deltaPositive = delta > 0

  return (
    <div className="bg-gradient-to-br from-violet-600 to-indigo-700 mx-4 rounded-3xl p-4 lg:p-6 shadow-xl shadow-violet-200 mb-4 lg:mx-0">
      <div className="flex justify-between items-start mb-3 lg:mb-5">
        <div>
          <p className="text-violet-200 text-xs lg:text-sm font-medium">{t('month_detail.total_month')}</p>
          <p className="text-white/90 text-xl lg:text-2xl font-bold">{fmt(month.total)}</p>
          {delta !== null && delta !== 0 && (
            <p className={`text-xs font-semibold mt-0.5 ${deltaPositive ? 'text-red-200' : 'text-emerald-200'}`}>
              {deltaPositive ? '▲' : '▼'} {fmt(Math.abs(delta))} {t('month_detail.vs_last_month')}
            </p>
          )}
        </div>
        <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm">
          {month.user1_share}/{month.user2_share}
        </span>
      </div>
      {bva?.has_transactions && <SpentStrip bva={bva} isCurrent={month.year === new Date().getFullYear() && month.month === new Date().getMonth() + 1} />}
      <div className="border-t border-white/20 pt-3 lg:pt-4">
        <p className="text-violet-200 text-xs lg:text-sm mb-0.5">{t(equal ? 'month_detail.each_share' : 'month_detail.your_share')}</p>
        <span className="text-white text-3xl lg:text-4xl font-extrabold tabular-nums">
          {fmt(myDue)}
        </span>
      </div>
    </div>
  )
}
