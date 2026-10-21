import { useTranslation } from 'react-i18next'
import BottomSheet from '../BottomSheet'

// Confirmation suppression charge
export default function DeleteChargeSheet({ confirmDelete, setConfirmDelete, setChargeOptions, handleDeleteCharge }) {
  const { t } = useTranslation()
  return (
    <BottomSheet open={confirmDelete} onClose={() => setConfirmDelete(false)}>
      <div className="px-4 pb-safe">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🗑️</div>
          <p className="font-semibold text-slate-900">{t('month_detail.confirm_delete_charge_title')}</p>
          <p className="text-slate-500 text-sm mt-1">{t('month_detail.confirm_delete_charge_body')}</p>
        </div>
        <div className="space-y-2">
          <button
            onClick={handleDeleteCharge}
            className="w-full py-4 rounded-2xl bg-red-500 text-white font-semibold active:bg-red-600 transition"
          >
            {t('month_detail.delete')}
          </button>
          <button
            onClick={() => { setConfirmDelete(false); setChargeOptions(null) }}
            className="w-full py-4 rounded-2xl bg-slate-100 text-slate-700 font-semibold active:bg-slate-200 transition"
          >
            {t('month_detail.cancel')}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
