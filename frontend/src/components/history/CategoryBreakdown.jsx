import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFmt } from '../../hooks/useFmt'

// Clé renvoyée par le serveur pour les transactions pas encore catégorisées
export const UNCATEGORIZED = '__uncategorized__'
const TOP_MERCHANTS = 6

const round2 = n => Math.round(n * 100) / 100
const hasActual = row => !!row && Object.keys(row).some(k => k !== 'label' && row[k] > 0)
const sumRows = (rows, cat) => round2(rows.reduce((s, r) => s + (r?.[cat] ?? 0), 0))

// Prévu face au réel par catégorie, sur les mois qui ont des relevés (ou un seul),
// et pour une catégorie dépliée, les commerçants où l'argent est parti
export function breakdownRows(stats, labels) {
  const planned = labels.map(l => stats.by_month?.find(r => r.label === l))
  const actual  = labels.map(l => stats.by_month_actual?.find(r => r.label === l))
  const cats = [...new Set([...planned, ...actual].flatMap(r => Object.keys(r ?? {})))].filter(k => k !== 'label')
  return cats
    .map(category => ({ category, budget: sumRows(planned, category), actual: sumRows(actual, category) }))
    .filter(r => r.budget > 0 || r.actual > 0)
    // Le prévu d'abord (du plus gros au plus petit), puis le réel non prévu, « Sans catégorie » en dernier
    .sort((a, b) => (a.category === UNCATEGORIZED) - (b.category === UNCATEGORIZED)
      || (b.budget > 0) - (a.budget > 0) || b.budget - a.budget || b.actual - a.actual)
}

export function merchantsOf(stats, labels, category) {
  const byKey = new Map()
  for (const r of stats.by_merchant ?? []) {
    if (r.category !== category || !labels.includes(r.month)) continue
    const m = byKey.get(r.key) ?? { key: r.key, merchant: r.merchant, kind: r.kind, date: r.date, total: 0, count: 0 }
    m.total = round2(m.total + r.total)
    m.count += r.count
    byKey.set(r.key, m)
  }
  return [...byKey.values()].sort((a, b) => b.total - a.total)
}

export default function CategoryBreakdown({ stats, months, categoriesMap, shortLabel, onOpenMonth }) {
  const { t, i18n } = useTranslation()
  const fmt = useFmt({ maximumFractionDigits: 0 })
  const fmtCents = useFmt()
  // Un prélèvement PayPal n'a pas de commerçant : on le reconnaît à sa date et à son montant
  const day = iso => new Date(`${iso}T00:00:00`).toLocaleDateString(i18n.language?.startsWith('en') ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short' })
  const [selected, setSelected] = useState('all')
  const [open, setOpen] = useState(null)

  // Mois avec relevés bancaires ; sans aucun relevé, tous les mois (le prévu seul)
  const withStatements = months.filter(m => hasActual(stats.by_month_actual?.find(r => r.label === m.label)))
  const choices = withStatements.length ? withStatements : months
  const current = choices.find(m => m.label === selected)
  const labels = current ? [current.label] : choices.map(m => m.label)
  const rows = breakdownRows(stats, labels)
  if (rows.length === 0) return null

  const totalBudget = round2(rows.reduce((s, r) => s + r.budget, 0))
  const totalActual = round2(rows.reduce((s, r) => s + r.actual, 0))
  const totalGap = round2(totalActual - totalBudget)
  const pick = value => { setSelected(value); setOpen(null) }
  const pill = active => `shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${active ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500'}`

  return (
    <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-slate-50">
        <p className="text-sm font-semibold text-slate-700">{t('history.breakdown_title')}</p>
        <p className="text-xs text-slate-500 mt-0.5">{t('history.breakdown_hint')}</p>
      </div>

      {/* Un seul sélecteur de mois : le plus récent d'abord */}
      <div className="px-4 py-2.5 flex gap-2 overflow-x-auto border-b border-slate-50 scrollbar-none">
        <button onClick={() => pick('all')} aria-pressed={!current} className={pill(!current)}>{t('history.all')}</button>
        {[...choices].reverse().map(m => (
          <button key={m.id} onClick={() => pick(m.label)} aria-pressed={current?.id === m.id} className={pill(current?.id === m.id)}>
            {shortLabel(m.label)}
          </button>
        ))}
      </div>

      {/* Le total de la période, comparé sur les mêmes mois */}
      <div className="mx-4 mt-3.5 mb-1 px-3.5 py-3 bg-slate-50 rounded-2xl space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className="text-xs text-slate-500">
            {current ? current.label
              : withStatements.length ? t('history.breakdown_all_months', { count: withStatements.length })
              : t('history.breakdown_no_statements')}
          </span>
          {withStatements.length > 0 && totalGap !== 0 && (
            <span className={`text-xs font-bold tabular-nums px-2.5 py-0.5 rounded-full ${totalGap > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}`}>
              {totalGap > 0 ? '+' : '−'}{t(totalGap > 0 ? 'month_detail.over_budget' : 'month_detail.under_budget', { amount: fmt(Math.abs(totalGap)) })}
            </span>
          )}
        </div>
        <p className="text-lg font-bold text-slate-800 tabular-nums leading-tight">
          {fmt(totalActual)} <span className="text-sm font-medium text-slate-500">{t('history.breakdown_summary', { planned: fmt(totalBudget) })}</span>
        </p>
        {!current && withStatements.length > 0 && withStatements.length < months.length && (
          <p className="text-xs text-slate-500">{t('history.breakdown_excluded')}</p>
        )}
      </div>

      <div className="p-2 pb-3">
        {rows.map(({ category, budget, actual }) => {
          const uncategorized = category === UNCATEGORIZED
          const color = uncategorized ? '#f59e0b' : categoriesMap.get(category)?.color ?? '#94a3b8'
          const unplanned = budget === 0
          const over = !unplanned && actual > budget
          const gap = round2(actual - budget)
          const isOpen = open === category
          const merchants = isOpen ? merchantsOf(stats, labels, category) : []
          const shown = merchants.slice(0, TOP_MERCHANTS)
          const rest = merchants.slice(TOP_MERCHANTS)
          const badge = uncategorized
            ? { text: t('history.to_sort', { count: merchantsOf(stats, labels, category).reduce((s, m) => s + m.count, 0) }), cls: 'bg-amber-100 text-amber-800' }
            : unplanned ? { text: t('history.not_planned'), cls: 'bg-slate-100 text-slate-600' }
            : actual === 0 ? { text: t('history.nothing_spent'), cls: 'bg-slate-100 text-slate-600' }
            : gap === 0 ? null
            : { text: `${gap > 0 ? '+' : '−'}${fmt(Math.abs(gap))}`, cls: over ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700' }
          const barPct = unplanned ? (actual > 0 ? 100 : 0) : Math.min(actual / budget * 100, 100)
          return (
            <div key={category} className={`rounded-2xl ${isOpen ? (uncategorized ? 'bg-amber-50' : 'bg-violet-50/60') : ''}`}>
              <button
                onClick={() => setOpen(isOpen ? null : category)}
                aria-expanded={isOpen}
                disabled={actual === 0}
                className="w-full text-left px-2 py-3 space-y-2 disabled:cursor-default"
              >
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className={`text-sm font-semibold flex-1 min-w-0 truncate ${uncategorized ? 'text-amber-800' : 'text-slate-700'}`}>
                    {uncategorized ? t('month_detail.uncategorized_row') : category}
                  </span>
                  {badge && <span className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded-full shrink-0 ${badge.cls}`}>{badge.text}</span>}
                  {actual > 0 && (
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  )}
                </div>
                {/* Barre : le réel rapporté au prévu ; au-delà, rouge, avec un trait à l'endroit du prévu */}
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden relative ml-[18px]">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${barPct}%`, backgroundColor: over ? '#ef4444' : color }} />
                  {over && <div className="absolute top-0 bottom-0 w-0.5 bg-white" style={{ left: `${budget / actual * 100}%` }} />}
                </div>
                <div className="flex items-center justify-between ml-[18px] text-xs text-slate-500">
                  <span>
                    {uncategorized ? t('history.not_sorted_yet')
                      : unplanned ? t('history.nothing_planned')
                      : <>{t('history.planned')} <span className="font-medium text-slate-600 tabular-nums">{fmt(budget)}</span></>}
                  </span>
                  <span>{t('history.actual')} <span className="font-bold text-slate-700 tabular-nums">{fmt(actual)}</span></span>
                </div>
              </button>

              {isOpen && (
                <div className="pl-[26px] pr-2 pb-3">
                  {shown.map(m => (
                    <div key={m.key} className={`flex items-center gap-2.5 py-2 border-t ${uncategorized ? 'border-amber-100' : 'border-slate-100'}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{m.date ? t('history.paypal_on', { date: day(m.date) }) : m.merchant}</p>
                        <p className="text-xs text-slate-500">{t(`history.kind_${m.kind}`, { count: m.count })}</p>
                      </div>
                      <div aria-hidden="true" className="w-14 h-1 rounded-full bg-slate-100 overflow-hidden shrink-0">
                        <div className="h-full" style={{ width: `${Math.min(100, m.total / actual * 100)}%`, backgroundColor: color }} />
                      </div>
                      <span className="text-sm font-bold text-slate-700 tabular-nums w-20 text-right shrink-0">{m.date ? fmtCents(m.total) : fmt(m.total)}</span>
                    </div>
                  ))}
                  {rest.length > 0 && (
                    <p className={`pt-2 border-t text-xs text-slate-500 ${uncategorized ? 'border-amber-100' : 'border-slate-100'}`}>
                      {t('history.more_merchants', { count: rest.length, amount: fmt(rest.reduce((s, m) => s + m.total, 0)) })}
                    </p>
                  )}
                  {uncategorized && current && (
                    <button onClick={() => onOpenMonth(current.id)}
                      className="mt-2 min-h-[44px] px-4 rounded-xl bg-violet-600 text-white text-sm font-semibold active:bg-violet-700 transition">
                      {t('history.sort_in_month', { month: current.label })}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
