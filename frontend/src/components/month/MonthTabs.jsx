import { useTranslation } from 'react-i18next'

// Onglets Prévisionnel / Transactions, avec le nombre de transactions à catégoriser
export default function MonthTabs({ activeTab, setActiveTab, uncategorized }) {
  const { t } = useTranslation()
  return (
    <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl mb-4">
      <button
        onClick={() => setActiveTab('charges')}
        className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
          activeTab === 'charges'
            ? 'bg-white text-slate-800 shadow-sm'
            : 'text-slate-500 active:bg-white/50'
        }`}
      >
        {t('month_detail.tab_forecast')}
      </button>
      <button
        onClick={() => setActiveTab('transactions')}
        className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
          activeTab === 'transactions'
            ? 'bg-white text-slate-800 shadow-sm'
            : 'text-slate-500 active:bg-white/50'
        }`}
      >
        {t('month_detail.tab_transactions')}
        {uncategorized > 0 && (
          <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold align-middle"
            aria-label={t('months.to_categorize', { count: uncategorized })}>
            {uncategorized}
          </span>
        )}
      </button>
    </div>
  )
}
