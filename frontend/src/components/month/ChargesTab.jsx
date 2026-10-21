import { useTranslation } from 'react-i18next'
import SuiviSummary from './SuiviSummary'
import CategoryCard from './CategoryCard'

// ── Onglet Prévisionnel ────────────────────────────────────────────────────────
export default function ChargesTab({ month, categoryTotals, categoriesMap, config, suiviMode, actualsMap, setActualsMap, saveSuivi, enterSuiviMode, setChargeOptions, setConfirmDelete, setConfirmDeleteMonth }) {
  const { t } = useTranslation()
  return (<>
    <div className="flex items-center justify-between mb-2 px-1">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('month_detail.section_expenses')}</p>
      {categoryTotals.length > 0 && (
        suiviMode ? (
          <button onClick={saveSuivi} className="hit flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-600 text-white text-xs font-semibold active:bg-violet-700 transition">
            {t('month_detail.done')}
          </button>
        ) : (
          <button onClick={enterSuiviMode} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 transition">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            {t('month_detail.enter_actuals')}
          </button>
        )
      )}
    </div>

    {/* Bandeau récap suivi */}
    {suiviMode && <SuiviSummary month={month} actualsMap={actualsMap} />}

    {categoryTotals.length === 0 ? (
      <div className="bg-white rounded-2xl p-10 text-center border border-dashed border-slate-200">
        <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 text-violet-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" />
          </svg>
        </div>
        <p className="text-slate-700 font-semibold mb-1">{t('month_detail.no_expenses')}</p>
        <p className="text-slate-400 text-sm">{t('month_detail.no_expenses_hint')}</p>
      </div>
    ) : (
      <div className="lg:columns-2 lg:gap-3">
        {categoryTotals.map(({ cat, total, charges }) => (
          <CategoryCard
            key={cat}
            cat={cat}
            total={total}
            charges={charges}
            categoriesMap={categoriesMap}
            config={config}
            suiviMode={suiviMode}
            actualsMap={actualsMap}
            setActualsMap={setActualsMap}
            setChargeOptions={setChargeOptions}
            setConfirmDelete={setConfirmDelete}
          />
        ))}
      </div>
    )}
    {/* Supprimer le mois : action rare, en bas de page plutôt que dans l'en-tête */}
    <div className="flex justify-center pt-6 pb-2">
      <button
        onClick={() => setConfirmDeleteMonth(true)}
        className="px-4 py-3 text-sm text-slate-500 hover:text-red-500 active:text-red-600 transition"
      >
        {t('month_detail.aria_delete_month')}
      </button>
    </div>
  </>)
}
