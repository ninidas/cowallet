import { useState, useEffect } from 'react'
import { Sankey, Tooltip, ResponsiveContainer } from 'recharts'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { useFmt } from '../hooks/useFmt'

const DEMO_SHARED = 600

const INCOME_COLORS     = ['#7c82d6','#6870cc','#555ec2']
const EXPENSE_COLORS    = ['#9068c0','#4898c0','#48b090','#c09048','#c05050','#a06898','#5088b8','#80a848','#c08050','#9050a0']
const INVEST_COLORS     = ['#b84848','#a83838','#c86060','#d07070','#983030']
const SHARED_COLOR      = '#7a90a8'
const CENTER_COLOR      = '#c8854a'

function groupByCategory(entries) {
  const groups = {}
  entries.forEach(e => {
    const key = e.category || ''
    if (!groups[key]) groups[key] = []
    groups[key].push(e)
  })
  return groups
}

function buildSankeyData(entries, sharedTotal, sharedLabel = 'Shared expenses') {
  const incomes     = entries.filter(e => e.type === 'income')
  const expenses    = entries.filter(e => e.type === 'expense')
  const investments = entries.filter(e => e.type === 'investment')

  const totalIncome     = incomes.reduce((s, e) => s + e.amount, 0)
  const totalExpense    = expenses.reduce((s, e) => s + e.amount, 0)
  const totalInvestment = investments.reduce((s, e) => s + e.amount, 0)
  const totalOut        = totalExpense + totalInvestment + (sharedTotal || 0)
  const remaining       = Math.max(0, totalIncome - totalOut)

  if (totalIncome === 0) return null

  const nodes  = []
  const links  = []
  const colors = []

  function addNode(name, color) { nodes.push({ name }); colors.push(color); return nodes.length - 1 }

  // Revenus
  const incomeIdxs = incomes.map((e, i) => addNode(e.label, INCOME_COLORS[i % INCOME_COLORS.length]))

  // Nœud central
  const centerIdx = addNode('Budget', CENTER_COLOR)

  // Liens revenus → centre en premier (évite les croisements)
  incomeIdxs.forEach((idx, i) => links.push({ source: idx, target: centerIdx, value: incomes[i].amount }))

  // Charges communes — nœud intermédiaire factice pour aligner avec les autres colonnes
  if (sharedTotal > 0) {
    const dummyIdx = addNode('__shared_dummy__', SHARED_COLOR)
    const leafIdx  = addNode(sharedLabel, SHARED_COLOR)
    links.push({ source: centerIdx, target: dummyIdx, value: sharedTotal })
    links.push({ source: dummyIdx,  target: leafIdx,  value: sharedTotal })
  }

  // Investissements — avec catégories intermédiaires si présentes
  const expGroups = groupByCategory(expenses)
  const expCatColor = (ci) => EXPENSE_COLORS[ci % EXPENSE_COLORS.length]
  let expColorIdx = 0
  const expenseLeafIdxs = []
  Object.entries(expGroups).forEach(([cat, items]) => {
    const color = expCatColor(expColorIdx++)
    if (cat) {
      const catIdx = addNode(cat, color)
      links.push({ source: centerIdx, target: catIdx, value: items.reduce((s, e) => s + e.amount, 0) })
      items.forEach(e => {
        const itemIdx = addNode(e.label, color)
        links.push({ source: catIdx, target: itemIdx, value: e.amount })
        expenseLeafIdxs.push(itemIdx)
      })
    } else {
      items.forEach((e, i) => {
        const c = EXPENSE_COLORS[(expColorIdx - 1 + i) % EXPENSE_COLORS.length]
        const itemIdx = addNode(e.label, c)
        links.push({ source: centerIdx, target: itemIdx, value: e.amount })
        expenseLeafIdxs.push(itemIdx)
      })
    }
  })

  // Investissements — avec catégories intermédiaires si présentes
  const invGroups = groupByCategory(investments)
  const invCatColor = (ci) => INVEST_COLORS[ci % INVEST_COLORS.length]
  let invColorIdx = 0
  Object.entries(invGroups).forEach(([cat, items]) => {
    const color = invCatColor(invColorIdx++)
    if (cat) {
      const catIdx = addNode(cat, color)
      links.push({ source: centerIdx, target: catIdx, value: items.reduce((s, e) => s + e.amount, 0) })
      items.forEach(e => {
        const itemIdx = addNode(e.label, color)
        links.push({ source: catIdx, target: itemIdx, value: e.amount })
      })
    } else {
      items.forEach((e, i) => {
        const c = INVEST_COLORS[(invColorIdx - 1 + i) % INVEST_COLORS.length]
        const itemIdx = addNode(e.label, c)
        links.push({ source: centerIdx, target: itemIdx, value: e.amount })
      })
    }
  })




  return { nodes, links, colors, centerIdx }
}

function EntryRow({ entry, onUpdate, onDelete }) {
  const [label, setLabel]   = useState(entry.label)
  const [amount, setAmount] = useState(String(entry.amount))
  const [saved, setSaved]   = useState(false)

  async function handleBlur() {
    const amt = parseFloat(amount)
    if (!label.trim() || isNaN(amt) || amt <= 0) return
    if (label.trim() === entry.label && amt === entry.amount) return
    await onUpdate(entry.id, { label: label.trim(), amount: amt })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); e.target.blur() }
  }

  return (
    <div className="flex items-center rounded-xl bg-white border border-slate-100 overflow-hidden group">
      <input value={label} onChange={e => setLabel(e.target.value)} onBlur={handleBlur} onKeyDown={handleKeyDown}
        className="flex-1 px-3 py-2 text-sm text-slate-900 bg-transparent border-none outline-none" />
      <div className="w-px h-6 bg-slate-200 shrink-0" />
      <input value={amount} onChange={e => setAmount(e.target.value)} onBlur={handleBlur} onKeyDown={handleKeyDown}
        type="number" min="0" step="0.01"
        className="w-24 px-3 py-2 text-sm font-semibold text-slate-900 bg-transparent border-none outline-none text-right" />
      {saved
        ? <span className="text-xs text-emerald-500 shrink-0">✓</span>
        : <button onClick={() => onDelete(entry.id)}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-300 hover:text-red-500 transition shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
      }
    </div>
  )
}

function AddEntryForm({ type, onAdd, onCancel = null, category = null, hint = null }) {
  const { t } = useTranslation()
  const [label, setLabel]   = useState(hint?.label || '')
  const [amount, setAmount] = useState(hint?.amount || '')
  const [saved, setSaved]   = useState(false)

  async function trySubmit() {
    const amt = parseFloat(amount)
    if (!label.trim() || isNaN(amt) || amt <= 0) return
    await onAdd({ type, label: label.trim(), amount: amt, category })
    setLabel(''); setAmount('')
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); trySubmit() }
    if (e.key === 'Escape' && onCancel) { e.preventDefault(); onCancel() }
  }

  return (
    <div className="flex items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 overflow-hidden">
      <input value={label} onChange={e => setLabel(e.target.value)} onBlur={trySubmit} onKeyDown={handleKeyDown}
        className="flex-1 px-3 py-2 text-sm text-slate-900 bg-transparent border-none outline-none placeholder-slate-400"
        placeholder={t('budget.field_label_placeholder')} />
      <div className="w-px h-6 bg-slate-200 shrink-0" />
      <input value={amount} onChange={e => setAmount(e.target.value)} onBlur={trySubmit} onKeyDown={handleKeyDown}
        type="number" min="0" step="0.01"
        className="w-24 px-3 py-2 text-sm text-slate-900 bg-transparent border-none outline-none text-right placeholder-slate-400"
        placeholder="0" />
      {saved
        ? <span className="text-xs text-emerald-500 pr-2 shrink-0">✓</span>
        : onCancel && (
          <button onMouseDown={e => { e.preventDefault(); onCancel() }}
            className="p-1 mr-1 text-slate-300 hover:text-red-400 transition shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )
      }
    </div>
  )
}

function CategoryGroup({ name, entries, type, onAdd, onUpdate, onDelete, onRename, onDeleteCategory }) {
  const { t } = useTranslation()
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName]         = useState(name)
  const [formKey, setFormKey]         = useState(0)
  const showForm                      = formKey > 0
  const total = entries.reduce((s, e) => s + e.amount, 0)

  async function handleAdd(data) {
    await onAdd(data)
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="group/header flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
        {editingName ? (
          <>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              className="flex-1 px-2 py-1 text-sm text-slate-900 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
              autoFocus onKeyDown={e => { if (e.key === 'Enter') { onRename(name, newName.trim()); setEditingName(false) } }} />
            <button onClick={() => { onRename(name, newName.trim()); setEditingName(false) }}
              className="px-2 py-1 rounded-lg bg-violet-600 text-white text-xs font-semibold">OK</button>
            <button onClick={() => setEditingName(false)}
              className="px-2 py-1 rounded-lg border border-slate-200 text-xs text-slate-500">✕</button>
          </>
        ) : (
          <>
            <span className="flex-1 text-sm font-semibold text-slate-700">{name}</span>
            <span className="text-xs text-slate-500 font-medium">{fmt(total)}</span>
            <button onClick={() => setEditingName(true)} className="p-1 text-slate-400 hover:text-violet-600 transition">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
            </button>
            <button onClick={() => onDeleteCategory(name)} className="p-1 text-slate-400 hover:text-red-500 transition sm:opacity-0 sm:group-hover/header:opacity-100">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          </>
        )}
      </div>
      <div className="p-3 space-y-2">
        {entries.map(entry => (
          <EntryRow key={entry.id} entry={entry} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
        {showForm && (
          <AddEntryForm key={formKey} type={type} onAdd={handleAdd} onCancel={() => setFormKey(0)} category={name} hint={entries.length === 0 ? ({
            [t('budget.default_cat_income')]:        { label: t('budget.hint_salary'),       amount: '2500' },
            [t('budget.default_cat_investments')]:   { label: t('budget.hint_stocks'),        amount: '150'  },
            [t('budget.default_cat_subscriptions')]: { label: 'Netflix',                      amount: '18'   },
            [t('budget.default_cat_daily')]:         { label: t('budget.hint_groceries'),     amount: '400'  },
          }[name] || null) : null} />
        )}
        <button
          onClick={() => setFormKey(k => k + 1)}
          className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition">
          + {t(`budget.add_${type}`)}
        </button>
      </div>
    </div>
  )
}

function TabContent({ type, entries, onAdd, onUpdate, onDelete, onRename, onDeleteCategory }) {
  const { t } = useTranslation()
  const [addingCat, setAddingCat]   = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [tempCats, setTempCats]     = useState([])

  const defaultCategories = {
    income:     [t('budget.default_cat_income')],
    expense:    [t('budget.default_cat_daily'), t('budget.default_cat_subscriptions')],
    investment: [t('budget.default_cat_investments')],
  }
  const defaults = defaultCategories[type] || []
  const fromEntries = [...new Set(entries.filter(e => e.category).map(e => e.category))]
  const allCats     = [...new Set([...defaults, ...fromEntries, ...tempCats])]

  function handleNewCat(e) {
    e.preventDefault()
    if (!newCatName.trim()) return
    setTempCats(prev => [...prev, newCatName.trim()])
    setNewCatName('')
    setAddingCat(false)
  }

  return (
    <div className="space-y-3">
      {/* Groupes */}
      {allCats.map(cat => (
        <CategoryGroup
          key={cat}
          name={cat}
          entries={entries.filter(e => e.category === cat)}
          type={type}
          onAdd={async (data) => { await onAdd(data); setTempCats(prev => prev.filter(c => c !== cat)) }}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onRename={onRename}
          onDeleteCategory={cat => { onDeleteCategory(cat); setTempCats(prev => prev.filter(c => c !== cat)) }}
        />
      ))}

      {/* Ajouter une catégorie */}
      {addingCat ? (
        <form onSubmit={handleNewCat} className="flex gap-2 items-center">
          <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
            className="flex-1 px-3 py-2 text-sm text-slate-900 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 placeholder-slate-400"
            placeholder={t('budget.category_name_placeholder')} autoFocus />
          <button type="submit" className="px-3 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold">OK</button>
          <button type="button" onClick={() => setAddingCat(false)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-500">✕</button>
        </form>
      ) : (
        <button onClick={() => setAddingCat(true)}
          className="w-full py-2 rounded-xl border border-dashed border-slate-300 text-slate-500 text-sm font-medium hover:border-violet-400 hover:text-violet-600 transition">
          {t('budget.add_category')}
        </button>
      )}
    </div>
  )
}

const LABEL_BG   = 'rgba(241,245,254,0.5)'
const LABEL_PX   = 5.5   // 0.5em @ 11px
const LABEL_PY   = 1.5   // 0.1em @ 11px
const LABEL_H    = 11 + LABEL_PY * 2
const LABEL_RX   = 4

function SvgLabel({ x, y, text, anchor = 'start' }) {
  const estW = text.length * 6.2
  const bgX  = anchor === 'end' ? x - estW - LABEL_PX * 2 : x - LABEL_PX
  return (
    <g>
      <rect x={bgX} y={y - LABEL_H / 2} width={estW + LABEL_PX * 2} height={LABEL_H} rx={LABEL_RX} fill={LABEL_BG} />
      <text x={anchor === 'end' ? x - LABEL_PX : x + LABEL_PX} y={y} textAnchor={anchor} dominantBaseline="middle" fontSize={11} fill="#374151">
        {text}
      </text>
    </g>
  )
}

function makeSankeyRenderers(colors, centerIdx, nodeNames, fmt) {
  const colorByName = {}
  nodeNames.forEach((name, i) => { colorByName[name] = colors[i] })
  const NodeRenderer = ({ x, y, width, height, index, payload }) => {
    const color    = colors[index] || '#94a3b8'
    const isDummy  = payload.name === '__shared_dummy__'
    const isLeft   = index <= centerIdx
    if (isDummy) return <g><rect x={x} y={y} width={width} height={height} rx={3} fill={color} fillOpacity={0.9} /></g>
    // Labels Salaire et Budget rendus dans le ruban (LinkRenderer), pas ici
    const isIncome = index < centerIdx
    const isCenter = index === centerIdx
    if (isIncome || isCenter) {
      return <g><rect x={x} y={y} width={width} height={height} rx={3} fill={color} fillOpacity={0.9} /></g>
    }
    const label = `${payload.name}: ${fmt(payload.value)}`
    const ty    = y + Math.max(height / 2, 6)
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} rx={3} fill={color} fillOpacity={0.9} />
        <SvgLabel x={x - 8} y={ty} text={label} anchor="end" />
      </g>
    )
  }

  const LinkRenderer = ({ sourceX, sourceY, targetX, targetY, sourceControlX, targetControlX, linkWidth, index, payload }) => {
    const color = colorByName[payload?.source?.name] || '#94a3b8'
    const half   = linkWidth / 2
    const gap    = 4
    const sx = sourceX + gap
    const tx = targetX - gap
    const d = [
      `M${sx},${sourceY - half}`,
      `C${sourceControlX},${sourceY - half} ${targetControlX},${targetY - half} ${tx},${targetY - half}`,
      `L${tx},${targetY + half}`,
      `C${targetControlX},${targetY + half} ${sourceControlX},${sourceY + half} ${sx},${sourceY + half}`,
      'Z',
    ].join(' ')
    const isIncomeToCenter = payload?.target?.name === 'Budget'
    if (!isIncomeToCenter) return <path d={d} fill={color} fillOpacity={0.35} stroke="none" />

    const srcLabel = `${payload.source.name}: ${fmt(payload.source.value)}`
    const tgtLabel = `Budget: ${fmt(payload.target.value)}`
    const midY     = sourceY
    const inset    = 20
    return (
      <g>
        <path d={d} fill={color} fillOpacity={0.35} stroke="none" />
        <SvgLabel x={sx + inset} y={midY} text={srcLabel} anchor="start" />
        <SvgLabel x={tx - inset} y={midY} text={tgtLabel} anchor="end" />
      </g>
    )
  }

  return { NodeRenderer, LinkRenderer }
}

export default function BudgetPage() {
  const { t } = useTranslation()
  const fmt = useFmt({ maximumFractionDigits: 0 })
  const { config, getMyUserKey } = useAuth()
  const [entries, setEntries]         = useState([])
  const [months, setMonths]           = useState([])
  const [sharedMode, setSharedMode]   = useState('avg') // 'avg' | 'last' | 'custom'
  const [sharedCustom, setSharedCustom] = useState(null) // entrée budget type "shared"
  const [editingShared, setEditingShared] = useState(false)
  const [activeTab, setActiveTab]         = useState('income')
  const [sharedInput, setSharedInput] = useState('')
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    window.scrollTo(0, 0)
    Promise.all([api.getBudget(), api.getMonths().catch(() => [])])
      .then(async ([budgetData, monthsData]) => {
        const shared = budgetData.find(e => e.type === 'shared')
        let real = budgetData.filter(e => e.type !== 'shared')
        if (real.length === 0) {
          const demoEntries = [
            { type: 'income',     category: t('budget.default_cat_income'),      label: t('budget.hint_salary'),    amount: 2500 },
            { type: 'investment', category: t('budget.default_cat_investments'), label: t('budget.hint_stocks'),    amount: 150  },
            { type: 'expense',    category: t('budget.default_cat_subscriptions'), label: 'Netflix',                amount: 18   },
            { type: 'expense',    category: t('budget.default_cat_daily'),        label: t('budget.hint_groceries'), amount: 400  },
          ]
          const created = await Promise.all(demoEntries.map((e, i) =>
            api.createBudgetEntry({ type: e.type, label: e.label, amount: e.amount, category: e.category, sort_order: i })
          ))
          real = created
        }
        setEntries(real)
        setSharedCustom(shared || null)
        if (shared) setSharedMode('custom')
        setMonths(monthsData)
      })
      .catch(err => console.error('BudgetPage load error:', err))
      .finally(() => setLoading(false))
  }, [])

  function calcAutoShared(mode) {
    const sorted = [...months].sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month)
    if (sorted.length === 0) return 0
    const myKey = getMyUserKey() // 'user1' ou 'user2'
    const getDue = m => myKey === 'user1' ? m.user1_due : m.user2_due
    if (mode === 'last') return Math.round(getDue(sorted[0]))
    const last3 = sorted.slice(0, 3)
    return Math.round(last3.reduce((s, m) => s + getDue(m), 0) / last3.length)
  }

  function getSharedTotal() {
    if (sharedMode === 'custom' && sharedCustom) return sharedCustom.amount
    return calcAutoShared(sharedMode)
  }

  async function saveSharedOverride(amount) {
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt < 0) return
    if (sharedCustom) {
      const updated = await api.updateBudgetEntry(sharedCustom.id, { amount: amt })
      setSharedCustom(updated)
    } else {
      const created = await api.createBudgetEntry({ type: 'shared', label: 'Charges communes', amount: amt })
      setSharedCustom(created)
    }
    setSharedMode('custom')
    setEditingShared(false)
  }

  async function resetSharedAuto(mode) {
    if (sharedCustom) {
      await api.deleteBudgetEntry(sharedCustom.id)
      setSharedCustom(null)
    }
    setSharedMode(mode)
    setEditingShared(false)
  }

  async function handleAdd(data) {
    const entry = await api.createBudgetEntry(data)
    setEntries(prev => [...prev, entry])
  }

  async function handleUpdate(id, data) {
    const updated = await api.updateBudgetEntry(id, data)
    setEntries(prev => prev.map(e => e.id === id ? updated : e))
  }

  async function handleDelete(id) {
    await api.deleteBudgetEntry(id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  async function handleDeleteCategory(cat) {
    const toDelete = entries.filter(e => e.category === cat)
    await Promise.all(toDelete.map(e => api.deleteBudgetEntry(e.id)))
    setEntries(prev => prev.filter(e => e.category !== cat))
  }

  async function handleRename(oldCat, newCat) {
    if (!newCat || oldCat === newCat) return
    const toUpdate = entries.filter(e => e.category === oldCat)
    const updated  = await Promise.all(toUpdate.map(e => api.updateBudgetEntry(e.id, { category: newCat })))
    setEntries(prev => prev.map(e => {
      const u = updated.find(u => u.id === e.id)
      return u || e
    }))
  }

  const sharedTotal = getSharedTotal()
  const sankeyData  = buildSankeyData(entries, sharedTotal, t('budget.tab_shared'))
  const nodeNames   = sankeyData?.nodes.map(n => n.name) || []
  const { NodeRenderer, LinkRenderer } = makeSankeyRenderers(sankeyData?.colors || [], sankeyData?.centerIdx ?? 0, nodeNames, fmt)

  const totalIncome     = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
  const totalExpense    = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0)
  const totalInvestment = entries.filter(e => e.type === 'investment').reduce((s, e) => s + e.amount, 0)
  const remaining       = Math.max(0, totalIncome - totalExpense - totalInvestment - sharedTotal)

  if (loading) return <div className="flex items-center justify-center min-h-screen text-slate-400">{t('budget.loading')}</div>

  const savingsRate = totalIncome > 0 ? ((remaining / totalIncome) * 100).toFixed(1) : 0

  const gaugeR    = 48
  const gaugeCirc = 2 * Math.PI * gaugeR
  const gaugeRate = Math.min(100, Math.max(0, parseFloat(savingsRate) || 0))
  const gaugeDash = (gaugeRate / 100) * gaugeCirc
  const gaugeColor = gaugeRate >= 20 ? '#a5b4fc' : gaugeRate >= 10 ? '#fcd34d' : '#fca5a5'

  return (
    <div className="pb-24 lg:pb-10 space-y-6">

      {/* Header gradient */}
      <div className="bg-gradient-to-br from-violet-600 to-indigo-700 px-4 pt-6 pb-6 sm:px-6 lg:px-10 sm:pt-8 sm:pb-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="text-white flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold">{t('budget.title')}</h1>
            <p className="text-violet-200 mt-1 sm:mt-2 leading-relaxed text-xs sm:text-sm hidden sm:block">
              {t('budget.subtitle_lg')}
            </p>
            <p className="text-violet-200 mt-1 text-xs sm:hidden">{t('budget.subtitle_sm')}</p>
            <p className="text-violet-300 text-xs mt-1">{t('budget.personal_note')}</p>
          </div>
          {totalIncome > 0 && (
            <div className="shrink-0 flex flex-col items-center">
              <svg className="w-20 h-20 sm:w-[110px] sm:h-[110px]" viewBox="0 0 110 110">
                <circle cx={55} cy={55} r={gaugeR} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={10} />
                <circle cx={55} cy={55} r={gaugeR} fill="none" stroke={gaugeColor} strokeWidth={10}
                  strokeDasharray={`${gaugeDash} ${gaugeCirc}`}
                  strokeLinecap="round" transform="rotate(-90 55 55)" />
                <text x={55} y={50} textAnchor="middle" fontSize={20} fontWeight="bold" fill="white">{savingsRate}%</text>
                <text x={55} y={66} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.7)">{t('budget.savings_rate')}</text>
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Onglets de saisie */}
      <div className="px-4 lg:px-6"><div className="max-w-3xl mx-auto">{(() => {
        const TABS = [
          { key: 'income',     label: t('budget.tab_income'),     short: t('budget.tab_income_short'),     color: INCOME_COLORS[0],  badge: 'bg-indigo-100 text-indigo-700' },
          { key: 'investment', label: t('budget.tab_investment'), short: t('budget.tab_investment_short'), color: INVEST_COLORS[0],  badge: 'bg-red-100 text-red-700' },
          { key: 'expense',    label: t('budget.tab_expense'),    short: t('budget.tab_expense_short'),    color: EXPENSE_COLORS[0], badge: 'bg-purple-100 text-purple-700' },
          { key: 'shared',     label: t('budget.tab_shared'),     short: t('budget.tab_shared_short'),     color: SHARED_COLOR,      badge: 'bg-slate-100 text-slate-600' },
        ]
        const active = TABS.find(t => t.key === activeTab)

        return (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Onglets */}
            <div className="flex border-b border-slate-100">
              {TABS.map(({ key, label, short, color, badge }) => {
                const total = key === 'shared'
                  ? sharedTotal
                  : entries.filter(e => e.type === key).reduce((s, e) => s + e.amount, 0)
                const isActive = activeTab === key
                return (
                  <button key={key} onClick={() => setActiveTab(key)}
                    className={`flex-1 py-3 px-1 text-xs font-medium transition relative ${isActive ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
                    <span className="block truncate sm:hidden">{short}</span>
                    <span className="hidden sm:block truncate">{label}</span>
                    {total > 0 && <span className={`hidden sm:inline mt-0.5 text-xs font-semibold ${badge} px-1.5 py-0.5 rounded-full`}>{fmt(total)}</span>}
                    {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ backgroundColor: color }} />}
                  </button>
                )
              })}
            </div>

            {/* Contenu de l'onglet actif */}
            <div className="p-4">
              {activeTab !== 'shared' ? (
                <TabContent
                  type={activeTab}
                  entries={entries.filter(e => e.type === activeTab)}
                  onAdd={handleAdd}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  onRename={handleRename}
                  onDeleteCategory={handleDeleteCategory}
                />
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                    {[
                      { key: 'avg',    label: t('budget.shared_avg') },
                      { key: 'last',   label: t('budget.shared_last') },
                      { key: 'custom', label: t('budget.shared_custom') },
                    ].map(({ key, label }) => (
                      <button key={key}
                        onClick={() => key === 'custom' ? (setSharedMode('custom'), setSharedInput(String(sharedCustom?.amount ?? calcAutoShared(sharedMode))), setEditingShared(true)) : resetSharedAuto(key)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${sharedMode === key ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {editingShared && sharedMode === 'custom' ? (
                    <div className="flex gap-2 items-center">
                      <input value={sharedInput} onChange={e => setSharedInput(e.target.value)}
                        type="number" min="0" step="1"
                        className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400 text-right"
                        autoFocus onKeyDown={e => e.key === 'Enter' && saveSharedOverride(sharedInput)} />
                      <button onClick={() => saveSharedOverride(sharedInput)} className="px-3 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold">OK</button>
                      <button onClick={() => setEditingShared(false)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-500">✕</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-slate-50">
                      <span className="flex-1 text-sm text-slate-600">
                        {sharedMode === 'avg' ? t('budget.shared_label_avg') : sharedMode === 'last' ? t('budget.shared_label_last') : t('budget.shared_label_custom')}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">{fmt(sharedTotal)}</span>
                      {sharedMode === 'custom' && (
                        <button onClick={() => { setSharedInput(String(sharedCustom?.amount ?? 0)); setEditingShared(true) }}
                          className="p-1 rounded-lg text-slate-400 hover:text-violet-600 transition">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })()}
        </div>
      </div>

      {/* Résumé textuel dynamique */}
      {totalIncome > 0 && (
        <div className="px-4 lg:px-6">
          <div className="max-w-3xl mx-auto">
            <div className="bg-violet-50 border border-violet-100 rounded-2xl px-5 py-4 text-sm text-slate-700 leading-relaxed">
              {remaining >= 0
                ? <>{t('budget.summary_rate_prefix')} <strong className="text-violet-700">{savingsRate} %</strong>. </>
                : <>{t('budget.summary_deficit_prefix')} <strong className="text-red-600">{fmt(Math.abs(remaining))}</strong>. </>
              }
              {t('budget.summary_income_prefix')} <strong>{fmt(totalIncome)}</strong>
              {(totalExpense + sharedTotal) > 0 && <>{t('budget.summary_expenses_prefix')} <strong>{fmt(totalExpense + sharedTotal)}</strong></>}
              {totalInvestment > 0 && <>{t('budget.summary_investments_pre')} <strong>{fmt(totalInvestment)}</strong>{t('budget.summary_investments_suf')}</>}
              {remaining > 0 && <>{t('budget.summary_remaining_pre')} <strong className="text-emerald-600">{fmt(remaining)}</strong>{t('budget.summary_remaining_suf')}</>}
              {remaining === 0 && <>{t('budget.summary_balanced')}</>}
              {remaining < 0 && <>.</>}
            </div>
          </div>
        </div>
      )}

      {/* Résumé cards */}
      {totalIncome > 0 && (
        <div className="px-4 lg:px-6">
          <div className="max-w-3xl mx-auto grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: t('budget.card_income'),      value: totalIncome,                color: 'text-indigo-600', bar: 'bg-indigo-400' },
              { label: t('budget.card_expenses'),    value: totalExpense + sharedTotal, color: 'text-purple-600', bar: 'bg-purple-400' },
              { label: t('budget.card_investments'), value: totalInvestment,            color: 'text-red-600',    bar: 'bg-red-400' },
              { label: t('budget.card_savings'),     value: remaining,                  color: remaining >= 0 ? 'text-blue-600' : 'text-red-600', bar: remaining >= 0 ? 'bg-blue-400' : 'bg-red-400' },
            ].map(({ label, value, color, bar }) => (
              <div key={label} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                <div className={`w-6 h-1 rounded-full ${bar} mb-2`} />
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className={`text-lg font-bold ${color}`}>{fmt(value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sankey */}
      {sankeyData && (
        <div className="px-4 lg:px-6">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">{t('budget.chart_title')}</h2>
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <div style={{ minWidth: 700 }}>
                <ResponsiveContainer width="100%" height={Math.max(250, sankeyData.nodes.length * 28)}>
                  <Sankey
                    data={sankeyData}
                    node={<NodeRenderer />}
                    link={<LinkRenderer />}
                    nodePadding={12}
                    nodeWidth={8}
                    margin={{ top: 10, right: 160, bottom: 10, left: 160 }}
                  >
                    <Tooltip
                      formatter={(value, name) => name === '__shared_dummy__' ? [null, null] : [fmt(value), name]}
                      itemStyle={{ display: 'none' }}
                      content={({ payload }) => {
                        if (!payload?.length) return null
                        const item = payload[0]
                        if (!item?.payload) return null
                        const name = item.payload.name || item.payload.source?.name || item.payload.target?.name
                        if (!name || name === '__shared_dummy__') return null
                        const value = item.value ?? item.payload.value
                        return (
                          <div className="bg-white border border-slate-200 rounded-lg shadow px-3 py-2 text-sm">
                            <span className="font-medium text-slate-700">{name}</span>
                            {value != null && <span className="text-slate-500 ml-2">{fmt(value)}</span>}
                          </div>
                        )
                      }}
                    />
                  </Sankey>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
