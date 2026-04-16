import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { useFmt } from '../hooks/useFmt'
import BottomSheet from './BottomSheet'

const EMPTY = {
  label: '',
  amount: '',
  category: '',
  payment_type: '',
  is_recurring: false,
  paid_by: '',
  installments: 1,
  note: '',
}

const INSTALLMENT_OPTIONS = [1, 2, 3, 4, 6, 12]

export default function ChargeForm({ open, onClose, onSaved, monthId, charge, config }) {
  const { t } = useTranslation()
  const fmt = useFmt()
  const isEdit = !!charge
  const [form, setForm]               = useState(EMPTY)
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [showSugg, setShowSugg]       = useState(false)
  const [categories, setCategories]   = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [installmentCurrent, setInstallmentCurrent] = useState(1)
  const [cascadeInstallments, setCascadeInstallments] = useState(true)
  const labelRef = useRef(null)

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {})
    api.getPaymentMethods().then(setPaymentMethods).catch(() => {})
  }, [])

  useEffect(() => {
    if (open) {
      api.getChargeSuggestions().then(setSuggestions).catch(() => {})
      setForm(charge ? {
        label:        charge.label,
        amount:       String(charge.amount),
        category:     charge.category,
        payment_type: charge.payment_type ?? '',
        is_recurring: charge.is_recurring,
        paid_by:      charge.paid_by != null ? String(charge.paid_by) : '',
        installments: 1,
        note:         charge.note ?? '',
      } : { ...EMPTY, paid_by: localStorage.getItem('cowallet_last_paid_by') ?? '' })
      if (charge && (charge.installments_total ?? 1) > 1) {
        const total = charge.installments_total
        const left  = charge.installments_left
        setInstallmentCurrent(total - left + 1)
        setCascadeInstallments(true)
      }
      setError('')
      setTimeout(() => labelRef.current?.focus(), 150)
    }
  }, [open, charge])

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  const filteredSugg = form.label.trim().length > 0
    ? suggestions.filter(s => s.label.toLowerCase().includes(form.label.toLowerCase()))
    : []

  function applySuggestion(s) {
    setForm(f => ({
      ...f,
      label:        s.label,
      category:     s.category,
      amount:       String(s.amount),
      payment_type: s.payment_type ?? '',
    }))
    setShowSugg(false)
  }

  const totalAmount   = parseFloat(form.amount) || 0
  const perMonth      = form.installments > 1 ? totalAmount / form.installments : totalAmount

  const editInstallTotal = isEdit ? (charge?.installments_total ?? 1) : 1
  const isInstallmentCharge = editInstallTotal > 1

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.category) { setError(t('chargeform.error_no_category')); return }
    setError('')
    setLoading(true)

    const newInstallmentsLeft = isInstallmentCharge
      ? editInstallTotal - installmentCurrent + 1
      : (isEdit ? (charge.installments_left ?? 1) : form.installments)

    const payload = {
      label:              form.label.trim(),
      amount:             parseFloat((perMonth).toFixed(2)),
      category:           form.category,
      payment_type:       form.payment_type || null,
      is_recurring:       form.is_recurring,
      paid_by:            form.paid_by ? parseInt(form.paid_by) : null,
      installments_total: isEdit ? editInstallTotal : form.installments,
      installments_left:  newInstallmentsLeft,
      note:               form.note.trim() || null,
    }

    try {
      if (isEdit) {
        await api.updateCharge(charge.id, payload)
        if (isInstallmentCharge && cascadeInstallments && newInstallmentsLeft !== charge.installments_left) {
          await api.fixInstallments(charge.id, newInstallmentsLeft)
        }
      } else {
        await api.addCharge(monthId, payload)
      }
      if (payload.paid_by) localStorage.setItem('cowallet_last_paid_by', String(payload.paid_by))
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={isEdit ? t('chargeform.title_edit') : t('chargeform.title_add')}
    >
      <form onSubmit={handleSubmit} className="px-4 pb-safe space-y-5">

        {/* Label + suggestions */}
        <div className="relative">
          <label className="block text-sm font-medium text-slate-600 mb-1.5">{t('chargeform.field_label')}</label>
          <input
            ref={labelRef}
            type="text"
            value={form.label}
            onChange={e => { set('label', e.target.value); setShowSugg(true) }}
            onFocus={() => setShowSugg(true)}
            onBlur={() => setTimeout(() => setShowSugg(false), 100)}
            className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            placeholder={t('chargeform.field_label_placeholder')}
            autoComplete="off"
            required
          />
          {showSugg && filteredSugg.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
              {filteredSugg.slice(0, 5).map((s, i) => (
                <button
                  type="button"
                  key={i}
                  onMouseDown={e => { e.preventDefault(); applySuggestion(s) }}
                  onTouchStart={() => applySuggestion(s)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition text-left border-b border-slate-50 last:border-0"
                >
                  <span className="text-sm font-medium text-slate-800 truncate">{s.label}</span>
                  <span className="text-xs text-slate-400 ml-2 shrink-0">
                    {fmt(s.amount)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Montant */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            {!isEdit && form.installments > 1 ? t('chargeform.field_amount_total') : t('chargeform.field_amount')}
          </label>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={e => set('amount', e.target.value)}
              className="w-full pl-4 pr-10 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent tabular-nums"
              placeholder="0,00"
              required
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">€</span>
          </div>
          {!isEdit && form.installments > 1 && totalAmount > 0 && (
            <p className="text-sm text-violet-600 font-semibold mt-1.5 ml-1">
              {t('chargeform.field_amount_per_month', { amount: fmt(perMonth) })}
            </p>
          )}
        </div>

        {/* Paiement fractionné — create only */}
        {!isEdit && (
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              {t('chargeform.field_installments')} <span className="text-slate-400 font-normal">{t('chargeform.field_optional')}</span>
            </label>
            <div className="flex gap-2">
              {INSTALLMENT_OPTIONS.map(n => (
                <button
                  type="button"
                  key={n}
                  onClick={() => set('installments', n)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition active:scale-95 ${
                    form.installments === n
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  {n === 1 ? '1×' : `${n}×`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Correction échéance — edit only, fractionné uniquement */}
        {isEdit && isInstallmentCharge && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
            <p className="text-sm font-semibold text-amber-800">{t('chargeform.field_installment_fix')}</p>
            <div className="flex items-center gap-3">
              <span className="text-sm text-amber-700">{t('chargeform.installment_label')}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInstallmentCurrent(n => Math.max(1, n - 1))}
                  className="w-8 h-8 rounded-full bg-white border border-amber-300 text-amber-700 font-bold flex items-center justify-center active:scale-95 transition"
                >−</button>
                <span className="text-lg font-bold text-amber-900 tabular-nums w-16 text-center">
                  {installmentCurrent} / {editInstallTotal}
                </span>
                <button
                  type="button"
                  onClick={() => setInstallmentCurrent(n => Math.min(editInstallTotal, n + 1))}
                  className="w-8 h-8 rounded-full bg-white border border-amber-300 text-amber-700 font-bold flex items-center justify-center active:scale-95 transition"
                >+</button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCascadeInstallments(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white border border-amber-200 transition"
            >
              <span className="text-sm text-amber-800">{t('chargeform.field_installment_cascade')}</span>
              <div className={`w-9 h-5 rounded-full transition-colors ${cascadeInstallments ? 'bg-amber-500' : 'bg-slate-300'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm m-0.5 transition-transform ${cascadeInstallments ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </button>
          </div>
        )}

        {/* Catégorie */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">{t('chargeform.field_category')}</label>
          <div className="grid grid-cols-3 gap-2">
            {categories.map(cat => {
              const selected = form.category === cat.name
              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => set('category', cat.name)}
                  className="flex flex-col items-center gap-1 py-3 rounded-2xl border-2 transition active:scale-95"
                  style={selected
                    ? { backgroundColor: cat.color + '20', color: cat.color, borderColor: cat.color }
                    : { backgroundColor: '#f8fafc', color: '#64748b', borderColor: 'transparent' }
                  }
                >
                  <span className="text-xl">{cat.icon}</span>
                  <span className="text-xs font-semibold">{cat.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Type de paiement */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">{t('chargeform.field_payment_type')} <span className="text-slate-400 font-normal">{t('chargeform.field_optional')}</span></label>
          <div className="flex flex-wrap gap-2">
            {paymentMethods.map(pm => (
              <button
                type="button"
                key={pm.id}
                onClick={() => set('payment_type', form.payment_type === pm.name ? '' : pm.name)}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition active:scale-95 ${
                  form.payment_type === pm.name
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                {pm.name}
              </button>
            ))}
          </div>
        </div>

        {/* Avancé par */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">{t('chargeform.field_paid_by')} <span className="text-slate-400 font-normal">{t('chargeform.field_optional')}</span></label>
          <div className="flex gap-2">
            {[
              { value: '1', label: config?.user1_username ?? 'User 1' },
              { value: '2', label: config?.user2_username ?? 'User 2' },
            ].map(({ value, label }) => (
              <button
                type="button"
                key={value}
                onClick={() => set('paid_by', form.paid_by === value ? '' : value)}
                className={`flex-1 py-3 rounded-2xl text-sm font-semibold border-2 transition active:scale-95 capitalize ${
                  form.paid_by === value
                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                    : 'bg-slate-50 text-slate-500 border-transparent'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Récurrente — masqué si fractionné */}
        {(isEdit || form.installments === 1) && (
          <button
            type="button"
            onClick={() => set('is_recurring', !form.is_recurring)}
            className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl border-2 transition ${
              form.is_recurring ? 'bg-violet-50 border-violet-200' : 'bg-slate-50 border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-5 h-5 ${form.is_recurring ? 'text-violet-600' : 'text-slate-400'}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <div className="text-left">
                <p className={`text-sm font-semibold ${form.is_recurring ? 'text-violet-700' : 'text-slate-700'}`}>{t('chargeform.field_recurring')}</p>
                <p className="text-xs text-slate-400">{t('chargeform.field_recurring_hint')}</p>
              </div>
            </div>
            <div className={`w-11 h-6 rounded-full transition-colors ${form.is_recurring ? 'bg-violet-600' : 'bg-slate-300'}`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow-sm m-0.5 transition-transform ${form.is_recurring ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
          </button>
        )}

        {/* Note */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            {t('chargeform.field_note')} <span className="text-slate-400 font-normal">{t('chargeform.field_optional')}</span>
          </label>
          <textarea
            value={form.note}
            onChange={e => set('note', e.target.value)}
            rows={2}
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none text-sm"
            placeholder={t('chargeform.field_note_placeholder')}
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-violet-600 text-white font-semibold shadow-lg shadow-violet-200 active:scale-95 transition disabled:opacity-60 disabled:scale-100"
        >
          {loading ? t('chargeform.btn_loading') : isEdit ? t('chargeform.btn_save') : t('chargeform.btn_add')}
        </button>

        <div className="h-2" />
      </form>
    </BottomSheet>
  )
}
