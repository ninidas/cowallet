import { useTranslation } from 'react-i18next'
import { api } from '../../api'

// Bank picker modal : pays, recherche, puis la banque à connecter
export default function BankPickerModal({ setShowBankPicker, aspsps, setAspsps, aspspsLoading, setAspspsLoading, aspspCountry, setAspspCountry, aspspSearch, setAspspSearch, handleBankConnect, setError }) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-0 sm:px-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-slate-800">{t('settings.bank_picker_title')}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{t('settings.bank_picker_subtitle')}</p>
          </div>
          <button onClick={() => setShowBankPicker(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-3 border-b border-slate-100 shrink-0 space-y-2">
          <div className="flex gap-2">
            {['FR', 'BE', 'ES', 'DE', 'IT', 'NL', 'PT'].map(c => (
              <button
                key={c}
                onClick={async () => {
                  setAspspCountry(c)
                  setAspspsLoading(true)
                  setAspspSearch('')
                  try {
                    const data = await api.getAspsps(c)
                    setAspsps(data)
                  } catch (err) {
                    setError(err.message)
                  } finally {
                    setAspspsLoading(false)
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${aspspCountry === c ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                {c}
              </button>
            ))}
          </div>
          <input
            value={aspspSearch}
            onChange={e => setAspspSearch(e.target.value)}
            placeholder={t('settings.bank_search_placeholder')}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <div className="overflow-y-auto flex-1">
          {aspspsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {aspsps
                .filter(b => !aspspSearch || (b.name || b.full_name || '').toLowerCase().includes(aspspSearch.toLowerCase()))
                .map((b, i) => (
                  <button
                    key={i}
                    onClick={() => handleBankConnect(b.name || b.full_name)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-violet-50 active:bg-violet-100 transition text-left"
                  >
                    {b.logo ? (
                      <img src={b.logo} alt="" className="w-8 h-8 rounded-lg object-contain shrink-0 bg-slate-50" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-sm">🏦</div>
                    )}
                    <span className="text-sm font-medium text-slate-800 truncate">{b.name || b.full_name}</span>
                  </button>
                ))
              }
              {!aspspsLoading && aspsps.filter(b => !aspspSearch || (b.name || b.full_name || '').toLowerCase().includes(aspspSearch.toLowerCase())).length === 0 && (
                <p className="text-center text-slate-400 text-sm py-8">{t('settings.bank_no_results')}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
