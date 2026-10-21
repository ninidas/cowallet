import { useTranslation } from 'react-i18next'
import { useFmt } from '../../hooks/useFmt'
import BottomSheet from '../BottomSheet'
import CategoryBadge from '../CategoryBadge'

// Une dépense touchée : la modifier ou la supprimer
export default function ChargeOptionsSheet({ chargeOptions, confirmDelete, categoriesMap, setChargeOptions, setEditingCharge, setConfirmDelete }) {
  const { t } = useTranslation()
  const fmt = useFmt()
  return (
    <BottomSheet open={!!chargeOptions && !confirmDelete} onClose={() => setChargeOptions(null)}>
      {chargeOptions && (
        <div className="px-4 pb-safe">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="font-semibold text-slate-900">{chargeOptions.label}</p>
              <p className="text-violet-600 font-bold text-lg">{fmt(chargeOptions.amount)}</p>
            </div>
            <CategoryBadge category={chargeOptions.category} icon={categoriesMap.get(chargeOptions.category)?.icon} color={categoriesMap.get(chargeOptions.category)?.color} />
          </div>

          <div className="space-y-2">
            <button
              onClick={() => { setEditingCharge(chargeOptions); setChargeOptions(null) }}
              className="w-full py-4 rounded-2xl bg-slate-100 text-slate-800 font-semibold active:bg-slate-200 transition"
            >
              {t('month_detail.edit')}
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full py-4 rounded-2xl bg-red-50 text-red-600 font-semibold active:bg-red-100 transition"
            >
              {t('month_detail.delete')}
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  )
}
