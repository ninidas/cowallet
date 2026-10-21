import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../../api'
import { useFmt } from '../../hooks/useFmt'
import { useArm } from '../../hooks/useArm'
import BudgetVsActualCard from './BudgetVsActualCard'
import TransactionSheet from './TransactionSheet'
import { txLabel, txKindLabel, txDay } from './transactions'

// ── Transactions tab ───────────────────────────────────────────────────────────
export default function TransactionsTab({ monthId, month, bva, onBvaChange, onUncategorizedChange, categoriesMap, categories, onImport, t }) {
  const fmt = useFmt()
  const { i18n } = useTranslation()
  const [transactions, setTx]   = useState([])
  const [loading,      setLoad] = useState(true)
  const [loadError,    setLoadError] = useState(false)
  const [openTx,       setOpenTx] = useState(null)
  const [filter,       setFilter] = useState('all')   // 'all' | 'todo'
  const [showBva,      setShowBva] = useState(false)
  const [armedAll, confirmAll]     = useArm()
  const [searchParams, setSearchParams] = useSearchParams()
  const autoCount = parseInt(searchParams.get('auto') || '0')

  const load = useCallback(async () => {
    try {
      const [txs, bvaData] = await Promise.all([
        api.getMonthTransactions(monthId),
        api.getBudgetVsActual(monthId),
      ])
      setTx(txs)
      onBvaChange(bvaData)
      onUncategorizedChange?.(txs.filter(tx => !tx.category).length)
      setLoadError(false)
    } catch {
      setLoadError(true)
    } finally {
      setLoad(false)
    }
  }, [monthId, onBvaChange, onUncategorizedChange])

  useEffect(() => { load() }, [load])

  async function handleCategorize(tx, category) {
    setOpenTx(null)
    await api.categorizeTransaction(tx.id, category)
    await load()
  }

  async function handleDelete(tx) {
    setOpenTx(null)
    await api.deleteTransaction(tx.id)
    await load()
  }

  async function handleDeleteAll() {
    if (!confirmAll('all')) return
    // Liste rechargée même si une suppression échoue : on voit ce qui reste
    await Promise.allSettled(transactions.map(tx => api.deleteTransaction(tx.id)))
    await load()
  }

  if (loading) return (
    <div className="flex justify-center py-10">
      <div className="w-6 h-6 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
    </div>
  )

  if (loadError) return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center space-y-3">
      <p className="font-semibold text-slate-800">{t('month_detail.tx_load_error')}</p>
      <p className="text-sm text-slate-500">{t('months.load_error_hint')}</p>
      <button onClick={() => { setLoad(true); load() }}
        className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold active:bg-violet-700 transition">
        {t('months.btn_retry')}
      </button>
    </div>
  )

  const todo = transactions.filter(tx => !tx.category).length
  const shown = filter === 'todo' ? transactions.filter(tx => !tx.category) : transactions
  // Regroupées par jour, le plus récent en premier (la liste arrive déjà triée)
  const days = []
  for (const tx of [...shown].sort((a, b) => txDay(b).localeCompare(txDay(a)))) {
    const last = days[days.length - 1]
    if (last && last.date === txDay(tx)) last.txs.push(tx)
    else days.push({ date: txDay(tx), txs: [tx] })
  }
  const dayLabel = iso => new Date(`${iso}T00:00:00`).toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })
  const gap = bva ? Math.round((bva.total_actual - bva.total_budget) * 100) / 100 : 0

  return (
    <div className="space-y-3">
      {/* Prévu vs réel par catégorie : replié sur une ligne, déplié à la demande */}
      {bva && (bva.rows.length > 0 || bva.uncategorized > 0) && (
        showBva ? (
          <div className="space-y-2">
            <button onClick={() => setShowBva(false)} className="w-full flex items-center justify-between px-1 text-sm font-semibold text-violet-700">
              {t('month_detail.hide_by_category')}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.4} stroke="currentColor" className="w-4 h-4" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 15l6-6 6 6" /></svg>
            </button>
            <BudgetVsActualCard bva={bva} />
          </div>
        ) : (
          <button onClick={() => setShowBva(true)} className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3 text-left active:bg-slate-50 transition">
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-slate-800">{t('month_detail.by_category')}</span>
              <span className="block text-xs text-slate-500 tabular-nums">{t('month_detail.actual_vs_planned', { actual: fmt(bva.total_actual), planned: fmt(bva.total_budget) })}</span>
            </span>
            {gap !== 0 && <span className={`text-sm font-bold tabular-nums ${gap > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{gap > 0 ? '+' : '−'}{fmt(Math.abs(gap))}</span>}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
          </button>
        )
      )}

      {autoCount > 0 && (
        <div className="flex items-center gap-2 bg-violet-50 border border-violet-100 text-violet-700 text-sm px-4 py-3 rounded-xl">
          <span>{t('month_detail.auto_categorized', { count: autoCount })}</span>
          <button onClick={() => { searchParams.delete('auto'); setSearchParams(searchParams) }} aria-label={t('month_detail.cancel')} className="hit ml-auto text-violet-400 hover:text-violet-600">✕</button>
        </div>
      )}

      {/* Filtre et import */}
      <div className="flex items-center gap-2">
        <div role="group" aria-label={t('month_detail.filter')} className="flex-1 flex gap-2 min-w-0">
          <button onClick={() => setFilter('all')} aria-pressed={filter === 'all'}
            className={`h-10 px-3.5 rounded-full text-sm font-semibold whitespace-nowrap transition ${filter === 'all' ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            {t('month_detail.filter_all', { count: transactions.length })}
          </button>
          {todo > 0 && (
            <button onClick={() => setFilter(filter === 'todo' ? 'all' : 'todo')} aria-pressed={filter === 'todo'}
              className={`h-10 px-3.5 rounded-full text-sm font-semibold whitespace-nowrap transition ${filter === 'todo' ? 'bg-amber-500 text-white' : 'bg-amber-50 border border-amber-300 text-amber-800'}`}>
              {t('month_detail.filter_todo', { count: todo })}
            </button>
          )}
        </div>
        <button onClick={onImport} aria-label={t('month_detail.import_bank')} title={t('month_detail.import_bank')}
          className="w-11 h-11 rounded-full bg-violet-600 text-white flex items-center justify-center shrink-0 active:bg-violet-700 transition shadow-sm shadow-violet-200">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-5 h-5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v11M7 10l5 5 5-5M5 20h14" />
          </svg>
        </button>
      </div>

      {transactions.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-slate-200">
          <p className="font-semibold text-slate-700 mb-1">{t('month_detail.no_transactions')}</p>
          <p className="text-slate-500 text-sm">{t('month_detail.no_transactions_hint')}</p>
        </div>
      ) : (
        days.map(day => (
          <section key={day.date} className="space-y-1.5">
            <h3 className="flex justify-between px-1 pt-1 text-xs font-bold tracking-wide text-slate-500 uppercase">
              <span>{dayLabel(day.date)}</span>
              <span className="tabular-nums">{fmt(day.txs.reduce((s, tx) => s + tx.amount, 0))}</span>
            </h3>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
              {day.txs.map(tx => {
                const cat = tx.category ? categoriesMap.get(tx.category) : null
                const kind = txKindLabel(tx, t)
                return (
                  <button key={tx.id} onClick={() => setOpenTx(tx)}
                    className={`w-full px-4 py-3 flex items-start gap-3 text-left transition active:bg-violet-50 ${tx.category ? '' : 'bg-amber-50/40'}`}>
                    <span className="flex-1 min-w-0 space-y-1.5">
                      <span className="block text-sm font-semibold text-slate-800 leading-snug break-words">{txLabel(tx.description)}</span>
                      {tx.detail && <span className="block text-xs text-slate-500 -mt-1 break-words">{tx.detail}</span>}
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-semibold border ${tx.category ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-amber-50 border-amber-300 text-amber-800'}`}>
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tx.category ? (cat?.color ?? '#94a3b8') : '#f59e0b' }} />
                          {tx.category ?? t('month_detail.to_categorize_chip')}
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.6} stroke="currentColor" className="w-3 h-3" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
                        </span>
                        {kind && <span className="text-xs text-slate-500">{kind}</span>}
                      </span>
                    </span>
                    <span className={`text-[15px] font-bold tabular-nums whitespace-nowrap ${tx.amount < 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {tx.amount < 0 ? `+${fmt(-tx.amount)}` : fmt(tx.amount)}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ))
      )}

      {transactions.length > 0 && (
        <div className="flex justify-center pt-2">
          <button onClick={handleDeleteAll}
            className={`h-11 px-4 rounded-full text-sm transition ${armedAll ? 'bg-red-500 text-white font-semibold' : 'text-slate-500 hover:text-red-500'}`}>
            {armedAll ? t('month_detail.confirm_delete_all_btn') : t('month_detail.delete_all_month')}
          </button>
        </div>
      )}

      <TransactionSheet tx={openTx} categories={categories} t={t}
        onClose={() => setOpenTx(null)}
        onPick={cat => handleCategorize(openTx, cat)}
        onDelete={() => handleDelete(openTx)} />
    </div>
  )
}
