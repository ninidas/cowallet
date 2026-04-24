import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { useCategoriesMap } from '../hooks/useCategoriesMap'
import { useFmt } from '../hooks/useFmt'

import CategoryBadge from '../components/CategoryBadge'
import ChargeForm from '../components/ChargeForm'
import BottomSheet from '../components/BottomSheet'

// ── Hero card ──────────────────────────────────────────────────────────────────
function HeroCard({ month }) {
  const { t } = useTranslation()
  const fmt = useFmt()
  const delta = month.prev_total != null ? month.total - month.prev_total : null
  const deltaPositive = delta > 0

  return (
    <div className="bg-gradient-to-br from-violet-600 to-indigo-700 mx-4 rounded-3xl p-4 lg:p-6 shadow-xl shadow-violet-200 mb-4 lg:mx-0">
      <div className="flex justify-between items-start mb-3 lg:mb-5">
        <div>
          <p className="text-violet-200 text-xs lg:text-sm font-medium">{t('month_detail.total_month')}</p>
          <p className="text-white/90 text-xl lg:text-2xl font-bold">{fmt(month.total)}</p>
          {delta !== null && delta !== 0 && (
            <p className={`text-xs font-semibold mt-0.5 ${deltaPositive ? 'text-red-200' : 'text-emerald-200'}`}>
              {deltaPositive ? '▲' : '▼'} {fmt(Math.abs(delta))} {t('month_detail.vs_last_month')}
            </p>
          )}
        </div>
        <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm">
          {month.user1_share}/{month.user2_share}
        </span>
      </div>
      <div className="border-t border-white/20 pt-3 lg:pt-4">
        <p className="text-violet-200 text-xs lg:text-sm mb-0.5">{t('month_detail.each_share')}</p>
        <span className="text-white text-3xl lg:text-4xl font-extrabold tabular-nums">
          {fmt(month.user1_due)}
        </span>
      </div>
    </div>
  )
}

// ── Transfer button ────────────────────────────────────────────────────────────
function TransferButton({ name, amount, done, onToggle, loading }) {
  const { t } = useTranslation()
  const fmt = useFmt()
  return (
    <button
      onClick={onToggle}
      disabled={loading}
      className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition active:scale-95 disabled:opacity-60 ${
        done ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'
      }`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        done ? 'bg-emerald-100' : 'bg-slate-100'
      }`}>
        {done
          ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-emerald-600"><path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" /></svg>
          : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-400"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        }
      </div>
      <div className="text-left min-w-0">
        <p className="text-sm font-semibold text-slate-700 capitalize truncate">{name}</p>
        <p className={`text-xs font-medium ${done ? 'text-emerald-600' : 'text-slate-400'}`}>
          {done ? t('month_detail.transferred') : t('month_detail.to_transfer', { amount: fmt(amount) })}
        </p>
      </div>
    </button>
  )
}

// ── Charge item ────────────────────────────────────────────────────────────────
function ChargeItem({ charge, onTap, onSwipeDelete, config, suiviMode, actualValue, onActualChange }) {
  const { t } = useTranslation()
  const fmt = useFmt()
  const paidBy = charge.paid_by === 1 ? config?.user1_username : charge.paid_by === 2 ? config?.user2_username : null

  if (suiviMode) {
    const parsed = actualValue !== '' && !isNaN(parseFloat(actualValue)) ? parseFloat(actualValue) : null
    const delta = parsed !== null ? parsed - charge.amount : null
    return (
      <div className="flex items-center gap-3 py-3 px-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900 truncate text-sm">{charge.label}</p>
          <p className="text-xs text-slate-400">{fmt(charge.amount)} {t('month_detail.forecast_tag')}</p>
        </div>
        <input
          type="number" min="0" step="0.01"
          value={actualValue}
          onChange={e => onActualChange(e.target.value)}
          placeholder={String(charge.amount)}
          className="w-28 px-3 py-1.5 text-sm font-semibold text-right border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
        />
        {delta !== null && delta !== 0 && (
          <span className={`text-xs font-semibold shrink-0 w-16 text-right ${delta > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
            {delta > 0 ? '+' : ''}{fmt(delta)}
          </span>
        )}
        {delta === null && <span className="w-16 shrink-0" />}
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden bg-white group">
      <div className="relative bg-white">
        <button
          onClick={() => onTap(charge)}
          className="w-full flex items-center gap-3 py-3.5 px-4 lg:group-hover:pr-12 active:bg-violet-50 active:scale-[0.99] transition-all text-left"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-900 truncate">{charge.label}</span>
              {charge.is_recurring && (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-slate-400 shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              )}
              {charge.installments_total > 1 && (
                <span className="text-xs font-semibold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-lg shrink-0">
                  {charge.installments_total - charge.installments_left + 1}/{charge.installments_total}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {charge.payment_type && (
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{charge.payment_type}</span>
              )}
              {paidBy && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{t('month_detail.advanced_by', { name: paidBy })}</span>
              )}
              {charge.note && (
                <span className="text-xs text-slate-400 italic truncate max-w-[160px]">{charge.note}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end shrink-0 gap-0.5">
            {charge.actual_amount != null ? (
              <>
                <span className="text-xs text-slate-400 line-through tabular-nums">{fmt(charge.amount)}</span>
                <span className={`text-base font-bold tabular-nums ${charge.actual_amount > charge.amount ? 'text-red-600' : charge.actual_amount < charge.amount ? 'text-emerald-600' : 'text-slate-800'}`}>
                  {fmt(charge.actual_amount)}
                </span>
                {charge.actual_amount !== charge.amount && (
                  <span className={`text-xs font-semibold tabular-nums ${charge.actual_amount > charge.amount ? 'text-red-400' : 'text-emerald-400'}`}>
                    {charge.actual_amount > charge.amount ? '+' : ''}{fmt(charge.actual_amount - charge.amount)}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="text-base font-bold text-slate-800 tabular-nums">{fmt(charge.amount)}</span>
                {charge.delta != null && charge.delta !== 0 && (
                  <span className={`text-xs font-semibold tabular-nums flex items-center gap-0.5 ${charge.delta > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                    {charge.delta > 0 ? '▲' : '▼'}{fmt(Math.abs(charge.delta))}
                  </span>
                )}
              </>
            )}
          </div>
        </button>
      </div>

      {/* Bouton delete au hover — desktop uniquement */}
      <button
        onClick={() => onSwipeDelete(charge)}
        className="hidden lg:flex absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-red-50 text-red-400 items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 transition-all"
        aria-label="Supprimer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      </button>
    </div>
  )
}

// ── Budget vs actual card ──────────────────────────────────────────────────────
function BudgetVsActualCard({ bva }) {
  const { t } = useTranslation()
  const fmt = useFmt()
  if (!bva || bva.rows.length === 0) return null
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">{t('month_detail.forecast_vs_actual')}</p>
        {bva.uncategorized > 0 && (
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
            {t('month_detail.uncategorized', { amount: fmt(bva.uncategorized) })}
          </span>
        )}
      </div>
      <div className="divide-y divide-slate-50">
        {bva.rows.map(row => (
          <div key={row.category} className="flex items-center gap-3 px-4 py-3">
            <span className="text-lg w-7 text-center shrink-0">{row.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">{row.category}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: row.budget > 0 ? `${Math.min((row.actual / row.budget) * 100, 100)}%` : '0%',
                      backgroundColor: row.delta > 0 ? '#ef4444' : row.color,
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-sm font-bold tabular-nums ${row.delta > 0 ? 'text-red-500' : 'text-slate-800'}`}>
                {fmt(row.actual)}
              </p>
              <p className="text-xs text-slate-400 tabular-nums">/ {fmt(row.budget)}</p>
            </div>
            {row.delta !== 0 && (
              <span className={`text-xs font-bold tabular-nums w-12 text-right shrink-0 ${row.delta > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {row.delta > 0 ? '+' : ''}{fmt(row.delta)}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="px-4 py-3 bg-slate-50 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500">{t('month_detail.total')}</p>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-400 tabular-nums">{t('month_detail.forecast_tag')} {fmt(bva.total_budget)}</span>
          <span className={`text-sm font-bold tabular-nums ${bva.total_actual > bva.total_budget ? 'text-red-500' : 'text-emerald-600'}`}>
            {t('month_detail.actual_estimated_short', { amount: fmt(bva.total_actual) })}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Transactions tab ───────────────────────────────────────────────────────────
function TransactionsTab({ monthId, month, bva, onBvaChange, categoriesMap, categories, onImport, t }) {
  const fmt = useFmt()
  const [transactions, setTx]   = useState([])
  const [loading,      setLoad] = useState(true)
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
    } finally {
      setLoad(false)
    }
  }, [monthId, onBvaChange])

  useEffect(() => { load() }, [load])

  async function handleCategorize(txId, category) {
    await api.categorizeTransaction(txId, category || null)
    await load()
  }

  async function handleDelete(txId) {
    await api.deleteTransaction(txId)
    await load()
  }

  async function handleDeleteAll() {
    if (!window.confirm(t('month_detail.confirm_delete_all'))) return
    await Promise.all(transactions.map(tx => api.deleteTransaction(tx.id)))
    await load()
  }

  if (loading) return (
    <div className="flex justify-center py-10">
      <div className="w-6 h-6 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-3">
      <BudgetVsActualCard bva={bva} />

      {autoCount > 0 && (
        <div className="flex items-center gap-2 bg-violet-50 border border-violet-100 text-violet-700 text-sm px-4 py-3 rounded-xl">
          <span>✨</span>
          <span>{t('month_detail.auto_categorized', { count: autoCount })}</span>
          <button onClick={() => { searchParams.delete('auto'); setSearchParams(searchParams) }} className="ml-auto text-violet-400 hover:text-violet-600">✕</button>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {t('month_detail.real_transactions', { count: transactions.length })}
          </p>
          <div className="flex items-center gap-2">
            {transactions.length > 0 && (
              <button
                onClick={handleDeleteAll}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-50 text-red-500 text-xs font-semibold active:bg-red-100 transition"
              >
                {t('month_detail.delete_all')}
              </button>
            )}
            <button
              onClick={onImport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-600 text-white text-xs font-semibold active:bg-violet-700 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {t('month_detail.import_bank')}
            </button>
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-slate-200">
            <div className="text-3xl mb-3">🏦</div>
            <p className="font-semibold text-slate-700 mb-1">{t('month_detail.no_transactions')}</p>
            <p className="text-slate-400 text-sm">{t('month_detail.no_transactions_hint')}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-50">
            {transactions.map(tx => (
              <div key={tx.id} className="px-4 py-3 flex items-start gap-3 group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800 truncate">{tx.description}</p>
                    {tx.is_card && (
                      <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500">CB</span>
                    )}
                    <span className="text-xs text-slate-400 shrink-0">{tx.date.slice(8)}/{tx.date.slice(5, 7)}</span>
                  </div>
                  {/* Category selector */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: categoriesMap.get(tx.category)?.color ?? '#cbd5e1' }}
                    />
                    <select
                      value={tx.category ?? ''}
                      onChange={e => handleCategorize(tx.id, e.target.value || null)}
                      className="text-xs px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-400 max-w-full"
                    >
                      <option value="">{t('month_detail.no_category')}</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.name}>{c.icon} {c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold tabular-nums text-slate-800">{fmt(tx.amount)}</span>
                  <button
                    onClick={() => handleDelete(tx.id)}
                    className="w-7 h-7 rounded-lg bg-red-50 text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 active:opacity-100 hover:bg-red-100 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function MonthDetailPage() {
  const { t } = useTranslation()
  const fmt = useFmt()
  const { id }         = useParams()
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()
  const { config }     = useAuth()
  const { categoriesMap, categories } = useCategoriesMap()

  const [activeTab, setActiveTab]   = useState(searchParams.get('tab') === 'transactions' ? 'transactions' : 'charges')
  const [month, setMonth]           = useState(null)
  const [months, setMonths]         = useState([])
  const [bva,   setBva]             = useState(null)
  const [loading, setLoading]       = useState(true)
  const [transferLoading, setTL]    = useState(false)

  // Forms / modals
  const [showAddCharge, setShowAddCharge]       = useState(false)
  const [editingCharge, setEditingCharge]       = useState(null)
  const [chargeOptions, setChargeOptions]       = useState(null) // charge tap menu
  const [suiviMode, setSuiviMode]               = useState(false)
  const [actualsMap, setActualsMap]             = useState({})
  const [confirmDelete, setConfirmDelete]       = useState(false)
  const [confirmDeleteMonth, setConfirmDeleteMonth] = useState(false)
  const [deletingMonth, setDeletingMonth]       = useState(false)

  const load = useCallback(async () => {
    try {
      const [data, all] = await Promise.all([api.getMonth(id), api.getMonths()])
      const bvaData = await api.getBudgetVsActual(id).catch(() => null)
      setMonth(data)
      setMonths(all) // trié desc (plus récent en premier)
      setBva(bvaData)
    } catch {
      navigate('/months', { replace: true })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { window.scrollTo(0, 0); load() }, [load])

  // Voisins : months est trié desc, donc index-1 = plus récent, index+1 = plus ancien
  const currentIdx = months.findIndex(m => String(m.id) === String(id))
  const nextMonth  = currentIdx > 0 ? months[currentIdx - 1] : null       // plus récent
  const prevMonth  = currentIdx >= 0 && currentIdx < months.length - 1 ? months[currentIdx + 1] : null // plus ancien

  async function toggleTransfer(key) {
    setTL(true)
    try {
      const updated = await api.updateTransfer(id, { [`${key}_transferred`]: !month[`${key}_transferred`] })
      setMonth(updated)
    } finally {
      setTL(false)
    }
  }

  async function handleChargeSaved() {
    setShowAddCharge(false)
    setEditingCharge(null)
    await load()
  }

  async function handleDeleteMonth() {
    setDeletingMonth(true)
    try {
      await api.deleteMonth(id)
      navigate('/months', { replace: true })
    } finally {
      setDeletingMonth(false)
    }
  }

  async function handleDeleteCharge() {
    await api.deleteCharge(chargeOptions.id)
    setChargeOptions(null)
    setConfirmDelete(false)
    await load()
  }

  function enterSuiviMode() {
    const map = {}
    month.charges.forEach(c => { map[c.id] = c.actual_amount != null ? String(c.actual_amount) : '' })
    setActualsMap(map)
    setSuiviMode(true)
  }

  async function saveSuivi() {
    const updates = month.charges
      .map(c => {
        const raw = actualsMap[c.id]?.trim()
        const val = raw === '' ? null : parseFloat(raw)
        const cur = c.actual_amount ?? null
        const next = isNaN(val) ? null : val
        if (next === cur) return null
        return api.updateCharge(c.id, { actual_amount: next })
      })
      .filter(Boolean)
    await Promise.all(updates)
    setSuiviMode(false)
    await load()
  }

  // Grouper les charges par catégorie
  const grouped = month?.charges.reduce((acc, c) => {
    if (!acc[c.category]) acc[c.category] = []
    acc[c.category].push(c)
    return acc
  }, {}) ?? {}

  const categoryTotals = Object.entries(grouped).map(([cat, charges]) => ({
    cat,
    total: charges.reduce((s, c) => s + c.amount, 0),
    charges,
  }))

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
    </div>
  )


  return (
    <div
      className="min-h-screen bg-slate-50 pb-safe page-enter"
    >
      {/* Header — sticky sur mobile */}
      <div className="sticky top-0 z-20 bg-gradient-to-r from-violet-600 to-indigo-600 safe-top px-4 pb-3 lg:pb-4">
        <div className="max-w-6xl mx-auto lg:px-6 flex items-center gap-3 lg:gap-4">
          {/* Retour */}
          <button
            onClick={() => navigate('/months')}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center active:bg-white/30 transition shrink-0 lg:hidden"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>

          {/* Navigation mois */}
          <div className="flex-1 flex items-center justify-center lg:justify-start gap-2">
            <button
              onClick={() => prevMonth && navigate(`/months/${prevMonth.id}`)}
              disabled={!prevMonth}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center active:bg-white/30 transition disabled:opacity-30"
              aria-label={t('month_detail.aria_prev_month')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-white min-w-0 text-center">{month.label}</h1>
            <button
              onClick={() => nextMonth && navigate(`/months/${nextMonth.id}`)}
              disabled={!nextMonth}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center active:bg-white/30 transition disabled:opacity-30"
              aria-label={t('month_detail.aria_next_month')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          {/* Valider le mois */}
          <button
            onClick={() => {
              const optimistic = { ...month, validated_by: month.validated_by ? null : -1 }
              setMonth(optimistic)
              api.validateMonth(month.id).then(m => setMonth(m)).catch(() => setMonth(month))
            }}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition shrink-0 ${month.validated_by ? 'bg-emerald-400/80 active:bg-emerald-500/80' : 'bg-white/20 active:bg-white/30'}`}
            aria-label={t('month_detail.aria_validate_month')}
            title={month.validated_by ? t('month_detail.title_validated') : t('month_detail.title_validate')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </button>

          {/* Supprimer */}
          <button
            onClick={() => setConfirmDeleteMonth(true)}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center active:bg-white/30 transition shrink-0"
            aria-label="Supprimer ce mois"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      </div>

      {/* Layout desktop 2 colonnes */}
      <div className="max-w-6xl mx-auto lg:px-6 lg:py-6 lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">

        {/* Colonne droite sur desktop (hero + virements) — affichée en premier sur mobile */}
        <div className="lg:col-span-1 lg:sticky lg:top-6 space-y-4">
          {/* Hero */}
          <div className="mt-4 mx-4 lg:mx-0 lg:mt-0 lg:-mt-10">
            <HeroCard month={month} />
          </div>

          {/* Virements */}
          <div className="px-4 lg:px-0">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">{t('month_detail.transfers')}</p>
            <div className="flex gap-3">
              <TransferButton
                name={config?.user1_username ?? 'User 1'}
                amount={month.user1_to_transfer}
                done={month.user1_transferred}
                onToggle={() => toggleTransfer('user1')}
                loading={transferLoading}
              />
              <TransferButton
                name={config?.user2_username ?? 'User 2'}
                amount={month.user2_to_transfer}
                done={month.user2_transferred}
                onToggle={() => toggleTransfer('user2')}
                loading={transferLoading}
              />
            </div>
          </div>
        </div>

        {/* Colonne gauche sur desktop (charges / transactions) */}
        <div className="lg:col-span-2 px-4 lg:px-0 mt-4 lg:mt-0">

          {/* Onglets */}
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
            </button>
          </div>

          {activeTab === 'transactions' && (
            <TransactionsTab
              monthId={id}
              month={month}
              bva={bva}
              onBvaChange={setBva}
              categoriesMap={categoriesMap}
              categories={categories ?? []}
              onImport={() => navigate(`/bank/import/${id}`)}
              t={t}
            />
          )}

          {activeTab === 'charges' && (<>
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('month_detail.section_expenses')}</p>
            {categoryTotals.length > 0 && (
              suiviMode ? (
                <button onClick={saveSuivi} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-600 text-white text-xs font-semibold active:bg-violet-700 transition">
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
          {suiviMode && (() => {
            const totalPrevu = month.charges.reduce((s, c) => s + c.amount, 0)
            const totalReel  = month.charges.reduce((s, c) => {
              const v = actualsMap[c.id]?.trim()
              return s + (v && !isNaN(parseFloat(v)) ? parseFloat(v) : c.amount)
            }, 0)
            const delta = totalReel - totalPrevu
            return (
              <div className={`mb-3 p-4 rounded-2xl ${delta > 0 ? 'bg-red-50 border border-red-100' : delta < 0 ? 'bg-emerald-50 border border-emerald-100' : 'bg-slate-50 border border-slate-100'}`}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-500">{t('month_detail.forecast')}</span>
                  <span className="font-semibold text-slate-800">{fmt(totalPrevu)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('month_detail.actual_estimated')}</span>
                  <span className={`font-bold ${delta > 0 ? 'text-red-600' : delta < 0 ? 'text-emerald-600' : 'text-slate-800'}`}>{fmt(totalReel)}</span>
                </div>
                {delta !== 0 && (
                  <div className={`flex justify-between text-sm font-bold mt-2 pt-2 border-t ${delta > 0 ? 'border-red-100 text-red-600' : 'border-emerald-100 text-emerald-600'}`}>
                    <span>{delta > 0 ? t('month_detail.overspend') : t('month_detail.savings')}</span>
                    <span>{delta > 0 ? '+' : ''}{fmt(delta)}</span>
                  </div>
                )}
              </div>
            )
          })()}

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
            <div className="space-y-3">
              {categoryTotals.map(({ cat, total, charges }) => {
                const catData = categoriesMap.get(cat)
                return (
                  <div key={cat} className="bg-white rounded-2xl overflow-hidden border border-slate-100"
                       style={{ borderLeft: `3px solid ${catData?.color ?? '#94a3b8'}` }}>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: catData?.color ?? '#94a3b8' }} />
                        <CategoryBadge category={cat} icon={catData?.icon} color={catData?.color} />
                      </div>
                      <div className="flex items-center gap-2">
                        {suiviMode && (() => {
                          const actualTotal = charges.reduce((s, c) => {
                            const v = actualsMap[c.id]?.trim()
                            return s + (v && !isNaN(parseFloat(v)) ? parseFloat(v) : c.amount)
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
              })}
            </div>
          )}
          </>)} {/* fin activeTab === 'charges' */}

        </div>
      </div>

      {/* FAB */}
      {activeTab === 'charges' && !showAddCharge && !editingCharge && !suiviMode && (
      <button
        onClick={() => setShowAddCharge(true)}
        className="fixed bottom-24 lg:bottom-8 right-6 lg:right-10 bg-violet-600 rounded-full w-14 h-14 shadow-xl shadow-violet-300 flex items-center justify-center active:scale-95 transition z-10"
        aria-label={t('month_detail.aria_add_expense')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-7 h-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>
      )}

      {/* Modal ajout charge */}
      <ChargeForm
        open={showAddCharge}
        monthId={id}
        config={config}
        onClose={() => setShowAddCharge(false)}
        onSaved={handleChargeSaved}
      />

      {/* Modal édition charge */}
      <ChargeForm
        open={!!editingCharge}
        monthId={id}
        charge={editingCharge}
        config={config}
        onClose={() => setEditingCharge(null)}
        onSaved={handleChargeSaved}
      />

      {/* Bottom sheet options charge */}
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

      {/* Confirmation suppression du mois */}
      <BottomSheet open={confirmDeleteMonth} onClose={() => setConfirmDeleteMonth(false)}>
        <div className="px-4 pb-safe">
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">🗑️</div>
            <p className="font-semibold text-slate-900">{t('month_detail.confirm_delete_month_title', { label: month?.label })}</p>
            <p className="text-slate-500 text-sm mt-1">{t('month_detail.confirm_delete_month_body')}</p>
          </div>
          <div className="space-y-2">
            <button
              onClick={handleDeleteMonth}
              disabled={deletingMonth}
              className="w-full py-4 rounded-2xl bg-red-500 text-white font-semibold active:bg-red-600 transition disabled:opacity-60"
            >
              {deletingMonth ? t('month_detail.deleting') : t('month_detail.btn_delete_month')}
            </button>
            <button
              onClick={() => setConfirmDeleteMonth(false)}
              className="w-full py-4 rounded-2xl bg-slate-100 text-slate-700 font-semibold active:bg-slate-200 transition"
            >
              {t('month_detail.cancel')}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Confirmation suppression charge */}
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
    </div>
  )
}
