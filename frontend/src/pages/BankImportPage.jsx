import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api'

function formatEur(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

function formatDate(str) {
  if (!str) return ''
  const [y, m, d] = str.split('-')
  return `${d}/${m}/${y}`
}

export default function BankImportPage() {
  const { monthId } = useParams()
  const navigate    = useNavigate()
  const { t } = useTranslation()

  const [month,         setMonth]     = useState(null)
  const [transactions,  setTx]        = useState([])
  const [selected,      setSelected]  = useState(new Set())
  const [loading,       setLoading]   = useState(true)
  const [importing,     setImporting] = useState(false)
  const [error,         setError]     = useState(null)
  const [debitsOnly,    setDebitsOnly]= useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [m, alreadyImported] = await Promise.all([
          api.getMonth(monthId),
          api.getMonthTransactions(monthId),
        ])
        setMonth(m)

        const importedIds = new Set(alreadyImported.map(t => t.saltedge_id))
        const fromDate = `${m.year}-${String(m.month).padStart(2, '0')}-01`
        const lastDay  = new Date(m.year, m.month, 0).getDate()
        const toDate   = `${m.year}-${String(m.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
        const txs      = await api.getBankTransactions(fromDate, toDate)

        setTx(txs.map(tx => ({ ...tx, already_imported: importedIds.has(tx.id) })))
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [monthId])

  const displayed = transactions.filter(tx =>
    !tx.already_imported && (debitsOnly ? tx.is_debit : true)
  )
  const alreadyCount = transactions.filter(tx => tx.already_imported).length

  function toggleAll() {
    if (selected.size === displayed.length) setSelected(new Set())
    else setSelected(new Set(displayed.map(tx => tx.id)))
  }

  function toggle(id) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  async function handleImport() {
    const toImport = displayed.filter(tx => selected.has(tx.id))
    if (!toImport.length) return
    setImporting(true)
    try {
      const result = await api.importTransactions({
        month_id: parseInt(monthId),
        transactions: toImport.map(tx => ({
          saltedge_id:  tx.id,
          date:         tx.date,
          description:  tx.description,
          amount:       tx.amount,
          account_name: tx.account_name,
          is_card:      tx.is_card ?? false,
        })),
      })
      const msg = result.auto_categorized
        ? `?tab=transactions&imported=${result.imported}&auto=${result.auto_categorized}`
        : `?tab=transactions`
      navigate(`/months/${monthId}${msg}`, { replace: true })
    } catch (e) {
      setError(e.message)
      setImporting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="text-center">
        <p className="text-red-500 mb-4 text-sm">{error}</p>
        <button onClick={() => navigate(-1)} className="text-violet-600 font-medium text-sm">{t('common.back')}</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 pb-32">

      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 safe-top px-4 pb-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center active:bg-white/30 transition shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">{t('bank_import.title')}</h1>
            <p className="text-violet-200 text-xs">{month?.label}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-3">

        {/* Filter bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setDebitsOnly(!debitsOnly)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${
              debitsOnly ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {debitsOnly ? t('bank_import.debits_only') : t('bank_import.all_transactions')}
          </button>
          {displayed.length > 0 && (
            <button onClick={toggleAll} className="text-xs text-violet-600 font-medium">
              {selected.size === displayed.length ? t('bank_import.deselect_all') : t('bank_import.select_all')}
            </button>
          )}
        </div>

        {displayed.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-slate-100">
            <div className="text-3xl mb-3">🏦</div>
            <p className="font-semibold text-slate-700 mb-1">{t('bank_import.no_transactions')}</p>
            <p className="text-slate-400 text-sm">{t('bank_import.no_transactions_hint', { month: month?.label })}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-50">
            {displayed.map(tx => (
              <button
                key={tx.id}
                onClick={() => toggle(tx.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition ${
                  selected.has(tx.id) ? 'bg-violet-50' : 'active:bg-slate-50'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                  selected.has(tx.id) ? 'bg-violet-600 border-violet-600' : 'border-slate-300'
                }`}>
                  {selected.has(tx.id) && (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="white" className="w-3 h-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-slate-800 truncate">{tx.description}</p>
                    {tx.is_card && (
                      <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500">CB</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatDate(tx.date)} · {tx.account_name}
                  </p>
                </div>

                <span className={`text-sm font-bold tabular-nums shrink-0 ${
                  tx.is_debit ? 'text-slate-800' : 'text-emerald-600'
                }`}>
                  {tx.is_debit ? '' : '+'}{formatEur(tx.amount)}
                </span>
              </button>
            ))}
          </div>
        )}

        {alreadyCount > 0 && (
          <p className="text-xs text-slate-400 text-center">
            {t('bank_import.already_imported_other', { count: alreadyCount })}
          </p>
        )}

      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-4 pb-safe pt-3 z-10">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full py-4 rounded-2xl bg-violet-600 text-white font-semibold active:bg-violet-700 transition disabled:opacity-60"
            >
              {importing
                ? t('bank_import.btn_importing')
                : t('bank_import.btn_import_other', { count: selected.size })}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
