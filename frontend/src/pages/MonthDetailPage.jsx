import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { useCategoriesMap } from '../hooks/useCategoriesMap'

import ChargeForm from '../components/ChargeForm'
import { parseAmount } from '../utils/amount'
import HeroCard from '../components/month/HeroCard'
import TransferButton from '../components/month/TransferButton'
import MonthHeader from '../components/month/MonthHeader'
import MonthTabs from '../components/month/MonthTabs'
import ChargesTab from '../components/month/ChargesTab'
import TransactionsTab from '../components/month/TransactionsTab'
import ChargeOptionsSheet from '../components/month/ChargeOptionsSheet'
import DeleteMonthSheet from '../components/month/DeleteMonthSheet'
import DeleteChargeSheet from '../components/month/DeleteChargeSheet'

// ── Main page ──────────────────────────────────────────────────────────────────
export default function MonthDetailPage() {
  const { t } = useTranslation()
  const { id }         = useParams()
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()
  const { config }     = useAuth()
  const { categoriesMap, categories } = useCategoriesMap()

  const [activeTab, setActiveTab]   = useState(searchParams.get('tab') === 'transactions' ? 'transactions' : 'charges')
  const [month, setMonth]           = useState(null)
  const [months, setMonths]         = useState([])
  const [bva,   setBva]             = useState(null)
  const [uncategorized, setUncategorized] = useState(0)
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
      setUncategorized(data.uncategorized ?? 0)
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
        const val = raw === '' ? null : parseAmount(raw)
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
    // Même règle que le total du mois : le réel quand il est saisi, pour que les catégories s'additionnent juste
    total: charges.reduce((s, c) => s + (c.actual_amount ?? c.amount), 0),
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
      {/* Header : sticky sur mobile */}
      <MonthHeader month={month} prevMonth={prevMonth} nextMonth={nextMonth} />

      {/* Layout desktop 2 colonnes */}
      <div className="max-w-6xl mx-auto lg:px-6 lg:py-6 lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">

        {/* Colonne droite sur desktop (hero + virements) : affichée en premier sur mobile */}
        <div className="lg:col-span-1 lg:sticky lg:top-36 space-y-4">
          {/* Hero */}
          <div className="mt-4 mx-4 lg:mx-0 lg:mt-0 lg:-mt-10">
            <HeroCard month={month} bva={bva} />
          </div>

          {/* Virements */}
          <div className="px-4 lg:px-0">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">{t('month_detail.transfers')}</p>
            <div className="flex gap-3">
              <TransferButton
                name={config?.user1_username ?? 'User 1'}
                amount={month.user1_to_transfer}
                toReceive={month.user1_to_receive}
                done={month.user1_transferred}
                onToggle={() => toggleTransfer('user1')}
                loading={transferLoading}
              />
              <TransferButton
                name={config?.user2_username ?? 'User 2'}
                amount={month.user2_to_transfer}
                toReceive={month.user2_to_receive}
                done={month.user2_transferred}
                onToggle={() => toggleTransfer('user2')}
                loading={transferLoading}
              />
            </div>
          </div>

          {/* Sur ordinateur : ce qu'il reste à faire, sous les virements */}
          {uncategorized > 0 && (
            <button onClick={() => setActiveTab('transactions')}
              className="hidden lg:flex w-full items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-sm font-semibold text-amber-800 active:bg-amber-100 transition">
              {t('months.todo_categorize', { count: uncategorized })}
              <span aria-hidden="true">›</span>
            </button>
          )}
        </div>

        {/* Colonne gauche sur desktop (charges / transactions) */}
        <div className="lg:col-span-2 px-4 lg:px-0 mt-4 lg:mt-0">

          {/* Onglets */}
          <MonthTabs activeTab={activeTab} setActiveTab={setActiveTab} uncategorized={uncategorized} />

          {activeTab === 'transactions' && (
            <TransactionsTab
              monthId={id}
              month={month}
              bva={bva}
              onBvaChange={setBva}
              onUncategorizedChange={setUncategorized}
              categoriesMap={categoriesMap}
              categories={categories ?? []}
              onImport={() => navigate(`/bank/import/${id}`)}
              t={t}
            />
          )}

          {activeTab === 'charges' && (
            <ChargesTab
              month={month}
              categoryTotals={categoryTotals}
              categoriesMap={categoriesMap}
              config={config}
              suiviMode={suiviMode}
              actualsMap={actualsMap}
              setActualsMap={setActualsMap}
              saveSuivi={saveSuivi}
              enterSuiviMode={enterSuiviMode}
              setChargeOptions={setChargeOptions}
              setConfirmDelete={setConfirmDelete}
              setConfirmDeleteMonth={setConfirmDeleteMonth}
            />
          )} {/* fin activeTab === 'charges' */}

        </div>
      </div>

      {/* FAB */}
      {activeTab === 'charges' && !showAddCharge && !editingCharge && !suiviMode && (
      <button
        onClick={() => setShowAddCharge(true)}
        className="fixed above-nav right-6 lg:right-10 bg-violet-600 rounded-full w-14 h-14 shadow-xl shadow-violet-300 flex items-center justify-center active:scale-95 transition z-10"
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
      <ChargeOptionsSheet
        chargeOptions={chargeOptions}
        confirmDelete={confirmDelete}
        categoriesMap={categoriesMap}
        setChargeOptions={setChargeOptions}
        setEditingCharge={setEditingCharge}
        setConfirmDelete={setConfirmDelete}
      />

      {/* Confirmation suppression du mois */}
      <DeleteMonthSheet
        month={month}
        confirmDeleteMonth={confirmDeleteMonth}
        setConfirmDeleteMonth={setConfirmDeleteMonth}
        deletingMonth={deletingMonth}
        handleDeleteMonth={handleDeleteMonth}
      />

      {/* Confirmation suppression charge */}
      <DeleteChargeSheet
        confirmDelete={confirmDelete}
        setConfirmDelete={setConfirmDelete}
        setChargeOptions={setChargeOptions}
        handleDeleteCharge={handleDeleteCharge}
      />
    </div>
  )
}
