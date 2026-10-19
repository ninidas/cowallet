import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { useCategoriesMap } from '../hooks/useCategoriesMap'
import { useFmt } from '../hooks/useFmt'

// Recherche dans les dépenses et les transactions bancaires de tous les mois (2026-10-20)
export default function SearchPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const fmt = useFmt()
  const { categoriesMap } = useCategoriesMap()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [res, setRes] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const query = q.trim()
    setParams(query ? { q: query } : {}, { replace: true })
    if (query.length < 2) { setRes(null); setError(null); return }
    setLoading(true)
    const timer = setTimeout(() => {
      api.search(query)
        .then(r => { setRes(r); setError(null) })
        .catch(e => setError(e.message))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [q])

  const fmtDate = iso => new Date(`${iso}T00:00:00`).toLocaleDateString(i18n.language?.startsWith('en') ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short' })
  const dot = cat => <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: categoriesMap.get(cat)?.color ?? '#cbd5e1' }} />
  const amount = a => a < 0
    ? <span className="text-sm font-bold tabular-nums text-emerald-600 shrink-0">+{fmt(-a)}</span>
    : <span className="text-sm font-bold tabular-nums text-slate-800 shrink-0">{fmt(a)}</span>

  const empty = res && !res.charges.length && !res.transactions.length

  return (
    <div className="min-h-screen bg-slate-50 pb-safe page-enter">
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 safe-top px-4 pb-6">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate('/months')}
            aria-label={t('search.back')}
            className="lg:hidden w-10 h-10 rounded-full bg-white/20 flex items-center justify-center active:bg-white/30 transition shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div className="flex-1 relative">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              id="search-q"
              ref={inputRef}
              type="search"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={t('search.placeholder')}
              autoComplete="off"
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white text-slate-900 placeholder-slate-400 text-base focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {q.trim().length < 2 && <p className="text-sm text-slate-500 text-center py-8">{t('search.hint')}</p>}
        {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{t('search.error')}</div>}
        {loading && !res && <p className="text-sm text-slate-400 text-center py-8">{t('search.loading')}</p>}
        {empty && <p className="text-sm text-slate-500 text-center py-8">{t('search.no_results', { q: q.trim() })}</p>}

        {res?.charges.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <h2 className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-50">
              {t('search.section_charges', { count: res.charges.length })}
            </h2>
            <ul className="divide-y divide-slate-50">
              {res.charges.map(c => (
                <li key={`c${c.id}`}>
                  <button onClick={() => navigate(`/months/${c.month_id}`)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50">
                    {dot(c.category)}
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-slate-900 truncate">{c.label}</span>
                      <span className="block text-xs text-slate-500 truncate">{c.month_label} · {c.category}</span>
                    </span>
                    {amount(c.amount)}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {res?.transactions.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <h2 className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-50">
              {t('search.section_transactions', { count: res.transactions.length })}
            </h2>
            <ul className="divide-y divide-slate-50">
              {res.transactions.map(tx => (
                <li key={`t${tx.id}`}>
                  <button onClick={() => navigate(`/months/${tx.month_id}?tab=transactions`)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50">
                    {dot(tx.category)}
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-slate-900 truncate">{tx.description}</span>
                      <span className="block text-xs text-slate-500 truncate">
                        {fmtDate(tx.date)} · {tx.category ?? t('search.uncategorized')}
                      </span>
                    </span>
                    {amount(tx.amount)}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {res && res.total > res.charges.length + res.transactions.length && (
          <p className="text-xs text-slate-400 text-center">{t('search.more', { count: res.total })}</p>
        )}
      </div>
    </div>
  )
}
