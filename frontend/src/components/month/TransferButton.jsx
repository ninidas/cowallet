import { useTranslation } from 'react-i18next'
import { useFmt } from '../../hooks/useFmt'

// ── Transfer button ────────────────────────────────────────────────────────────
export default function TransferButton({ name, amount, toReceive = 0, done, onToggle, loading }) {
  const { t } = useTranslation()
  const fmt = useFmt()
  return (
    <button
      onClick={onToggle}
      disabled={loading}
      className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition active:scale-95 disabled:opacity-60 ${
        done ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'
      }`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        done ? 'bg-emerald-100' : 'bg-slate-100'
      }`}>
        {done
          ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-emerald-600"><path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" /></svg>
          : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-400"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        }
      </div>
      <div className="text-left min-w-0">
        <p className="text-sm font-semibold text-slate-700 capitalize truncate">{name}</p>
        <p className={`text-xs font-medium ${done ? 'text-emerald-600' : 'text-slate-500'}`}>
          {done ? t('month_detail.transferred') : t('month_detail.to_transfer', { amount: fmt(amount) })}
        </p>
        {/* A avancé plus que sa part : le compte commun lui doit la différence */}
        {toReceive > 0 && (
          <p className="text-xs font-semibold text-emerald-700">{t('month_detail.to_receive', { amount: fmt(toReceive) })}</p>
        )}
      </div>
    </button>
  )
}
