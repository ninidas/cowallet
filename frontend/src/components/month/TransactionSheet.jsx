import { useTranslation } from 'react-i18next'
import { useFmt } from '../../hooks/useFmt'
import { useArm } from '../../hooks/useArm'
import BottomSheet from '../BottomSheet'
import { txLabel, txKindLabel, txDay } from './transactions'

// Une transaction touchée : sa catégorie en gros boutons, et sa suppression rangée ici plutôt que sur chaque ligne
export default function TransactionSheet({ tx, categories, onPick, onDelete, onClose, t }) {
  const fmt = useFmt()
  const { i18n } = useTranslation()
  const [armed, confirm] = useArm()
  if (!tx) return <BottomSheet open={false} onClose={onClose} />
  const date = new Date(`${txDay(tx)}T00:00:00`).toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })
  const kind = txKindLabel(tx, t)
  return (
    <BottomSheet open onClose={onClose}>
      <div className="px-4 pb-safe space-y-4">
        <div className="flex justify-between gap-3 items-start">
          <div className="min-w-0">
            <p className="font-bold text-slate-900 leading-snug break-words">{txLabel(tx.description)}</p>
            {tx.detail && <p className="text-sm text-slate-600 mt-0.5 break-words">{tx.detail}</p>}
            <p className="text-sm text-slate-500 mt-0.5 first-letter:uppercase">{date}{kind && ` · ${kind}`}</p>
          </div>
          <p className={`text-lg font-extrabold tabular-nums whitespace-nowrap ${tx.amount < 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
            {tx.amount < 0 ? `+${fmt(-tx.amount)}` : fmt(tx.amount)}
          </p>
        </div>
        <div role="radiogroup" aria-label={t('month_detail.category')} className="grid grid-cols-2 gap-2">
          {categories.map(c => {
            const on = tx.category === c.name
            return (
              <button key={c.id} role="radio" aria-checked={on} onClick={() => onPick(on ? null : c.name)}
                className={`h-12 px-3 rounded-xl flex items-center gap-2.5 text-sm font-semibold text-left transition active:scale-[0.98] ${on ? 'border-2 border-violet-600 bg-violet-50 text-slate-900' : 'border border-slate-200 bg-white text-slate-800'}`}>
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <span className="flex-1 truncate">{c.name}</span>
                {on && (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4 text-violet-700 shrink-0" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
        {!tx.category && <p className="text-sm text-slate-600 bg-violet-50 rounded-xl px-3 py-2.5">{t('month_detail.same_merchant_hint')}</p>}
        <button onClick={() => confirm('del') && onDelete()}
          className={`w-full h-12 rounded-xl text-sm font-semibold transition ${armed ? 'bg-red-500 text-white' : 'border border-red-200 text-red-600 active:bg-red-50'}`}>
          {armed ? t('month_detail.confirm_delete_tx') : t('month_detail.aria_delete_tx')}
        </button>
      </div>
    </BottomSheet>
  )
}
