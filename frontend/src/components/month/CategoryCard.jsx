import { useFmt } from '../../hooks/useFmt'
import { parseAmount } from '../../utils/amount'
import ChargeItem from './ChargeItem'

// Une catégorie du prévisionnel : son total, l'écart en mode suivi, puis ses dépenses
export default function CategoryCard({ cat, total, charges, categoriesMap, config, suiviMode, actualsMap, setActualsMap, setChargeOptions, setConfirmDelete }) {
  const fmt = useFmt()
  const catData = categoriesMap.get(cat)
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 break-inside-avoid mb-3">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
        <h3 className="flex items-center gap-2.5 text-sm font-bold text-slate-800">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: catData?.color ?? '#94a3b8' }} />
          {cat}
        </h3>
        <div className="flex items-center gap-2">
          {suiviMode && (() => {
            const actualTotal = charges.reduce((s, c) => {
              const v = actualsMap[c.id]?.trim()
              return s + (v && !isNaN(parseAmount(v)) ? parseAmount(v) : c.amount)
            }, 0)
            const d = actualTotal - total
            return d !== 0 ? (
              <span className={`text-xs font-semibold ${d > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {d > 0 ? '+' : ''}{fmt(d)}
              </span>
            ) : null
          })()}
          <span className="text-sm font-bold text-slate-700 tabular-nums">{fmt(total)}</span>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {charges.map(c => (
          <ChargeItem
            key={c.id}
            charge={c}
            config={config}
            suiviMode={suiviMode}
            actualValue={actualsMap[c.id] ?? ''}
            onActualChange={v => setActualsMap(m => ({ ...m, [c.id]: v }))}
            onTap={(charge) => { setChargeOptions(charge) }}
            onSwipeDelete={(charge) => { setChargeOptions(charge); setConfirmDelete(true) }}
          />
        ))}
      </div>
    </div>
  )
}
