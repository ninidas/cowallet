import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { useRef } from 'react'
import { usePush } from '../context/PushContext'

const PRESET_COLORS = [
  '#3b82f6', '#f97316', '#10b981', '#a855f7',
  '#ef4444', '#06b6d4', '#ec4899', '#eab308',
  '#64748b', '#8b5cf6', '#14b8a6', '#f59e0b',
]

const PRESET_EMOJIS = [
  '🛒','🍽️','🥗','☕','🍕','🍺','🚗','⛽','🚌','🚲',
  '✈️','🅿️','🚆','🎬','🎵','📚','🎮','🏋️','🎨','🍷',
  '💊','🏥','🧴','💆','👶','🦷','💰','💳','🏦','📈',
  '🏠','🎁','🛍️','🧾','📦','🔧','🐾','🎓','💡','📱',
  '🖥️','🔑','🌍','🧽','💈','🏡','🎀','🚑','👗','🎪',
]

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-50">
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Input({ ...props }) {
  return (
    <input
      className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
      {...props}
    />
  )
}

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const navigate   = useNavigate()
  const { user, config, logout, refreshConfig } = useAuth()
  const { supported: pushSupported, permission, subscribed, loading: pushLoading, subscribe, unsubscribe } = usePush()
  const [username,        setUsername]        = useState(user?.username ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword,     setNewPassword]     = useState('')
  const [share,           setShare]           = useState(config?.default_user1_share ?? 50)
  const [groupName,       setGroupName]       = useState(config?.group_name ?? '')
  const [currency,        setCurrency]        = useState(config?.currency ?? 'EUR')
  const [saving,  setSaving]  = useState(false)
  const [success, setSuccess] = useState('')
  const [error,   setError]   = useState('')

  // Suppression de compte
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletePassword, setDeletePassword]       = useState('')
  const [deleteError, setDeleteError]             = useState('')
  const [deleting, setDeleting]                   = useState(false)

  // Categories
  const [categories,    setCategories]    = useState([])
  const [newCatName,    setNewCatName]    = useState('')
  const [newCatIcon,    setNewCatIcon]    = useState('📦')
  const [newCatColor,   setNewCatColor]   = useState('#3b82f6')
  const [catError,      setCatError]      = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [editingCatId,  setEditingCatId]  = useState(null)
  const [editingCatName, setEditingCatName] = useState('')

  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState([])
  const [newPmName,      setNewPmName]      = useState('')
  const [pmError,        setPmError]        = useState('')
  const [editingPmId,   setEditingPmId]   = useState(null)
  const [editingPmName, setEditingPmName] = useState('')

  // Bank sync
  const [searchParams]    = useSearchParams()
  const [bankStatus,      setBankStatus]      = useState(null)
  const [bankConnecting,  setBankConnecting]  = useState(false)
  const [bankDisconnecting, setBankDisc]      = useState(false)
  const [showBankPicker,  setShowBankPicker]  = useState(false)
  const [aspsps,          setAspsps]          = useState([])
  const [aspspsLoading,   setAspspsLoading]   = useState(false)
  const [aspspCountry,    setAspspCountry]    = useState('FR')
  const [aspspSearch,     setAspspSearch]     = useState('')

  useEffect(() => {
    window.scrollTo(0, 0)
    api.getCategories().then(setCategories).catch(() => {})
    api.getPaymentMethods().then(setPaymentMethods).catch(() => {})
    api.getBankStatus().then(setBankStatus).catch(() => {})
  }, [])

  async function openBankPicker() {
    setShowBankPicker(true)
    setAspspsLoading(true)
    setAspspSearch('')
    try {
      const data = await api.getAspsps(aspspCountry)
      setAspsps(data)
    } catch (err) {
      setError(err.message)
      setShowBankPicker(false)
    } finally {
      setAspspsLoading(false)
    }
  }

  async function handleBankConnect(aspspName) {
    setShowBankPicker(false)
    setBankConnecting(true)
    try {
      const returnTo = `${window.location.origin}/bank/callback`
      const { connect_url } = await api.startBankConnect(returnTo, aspspName, aspspCountry)
      window.location.href = connect_url
    } catch (err) {
      setError(err.message)
      setBankConnecting(false)
    }
  }

  async function handleBankDisconnect() {
    setBankDisc(true)
    try {
      await api.deleteBankConnection()
      setBankStatus(s => ({ ...s, connected: false }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBankDisc(false)
    }
  }

  async function handleToggleAccount(id) {
    const res = await api.toggleBankAccount(id)
    setBankStatus(s => ({
      ...s,
      accounts: s.accounts.map(a => a.id === id ? { ...a, enabled: res.enabled } : a),
    }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    const payload = {}
    if (username.trim() !== user?.username) payload.username = username.trim()
    if (newPassword) {
      payload.current_password = currentPassword
      payload.new_password     = newPassword
    }
    if (share !== config?.default_user1_share) payload.default_user1_share = share
    const nameChanged     = groupName.trim() && groupName.trim() !== (config?.group_name ?? '')
    const currencyChanged = currency !== (config?.currency ?? 'EUR')
    if (Object.keys(payload).length === 0 && !nameChanged && !currencyChanged) {
      setSaving(false)
      setSuccess(t('settings.success_no_change'))
      return
    }
    try {
      if (Object.keys(payload).length > 0) await api.updateSettings(payload)
      if (nameChanged) await api.renameGroup(groupName.trim())
      if (currencyChanged) await api.updateCurrency(currency)
      await refreshConfig()
      setSuccess(t('settings.success_saved'))
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteAccount() {
    setDeleteError('')
    setDeleting(true)
    try {
      await api.deleteAccount(deletePassword)
      logout()
      navigate('/login')
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  async function handleAddCategory(e) {
    e.preventDefault()
    setCatError('')
    if (!newCatName.trim()) return
    try {
      const cat = await api.createCategory({ name: newCatName.trim(), icon: newCatIcon, color: newCatColor })
      setCategories(cs => [...cs, cat])
      setNewCatName('')
      setNewCatIcon('📦')
      setNewCatColor('#3b82f6')
      setShowEmojiPicker(false)
    } catch (err) {
      setCatError(err.message)
    }
  }

  async function handleDeleteCategory(id) {
    try {
      await api.deleteCategory(id)
      setCategories(cs => cs.filter(c => c.id !== id))
    } catch (err) {
      setCatError(err.message)
    }
  }

  async function handleRenameCategory(id) {
    const name = editingCatName.trim()
    if (!name) return
    try {
      const updated = await api.updateCategory(id, { name })
      setCategories(cs => cs.map(c => c.id === id ? updated : c))
      setEditingCatId(null)
    } catch (err) {
      setCatError(err.message)
    }
  }

  async function handleAddPaymentMethod(e) {
    e.preventDefault()
    setPmError('')
    if (!newPmName.trim()) return
    try {
      const pm = await api.createPaymentMethod({ name: newPmName.trim() })
      setPaymentMethods(pms => [...pms, pm])
      setNewPmName('')
    } catch (err) {
      setPmError(err.message)
    }
  }

  async function handleDeletePaymentMethod(id) {
    try {
      await api.deletePaymentMethod(id)
      setPaymentMethods(pms => pms.filter(p => p.id !== id))
    } catch (err) {
      setPmError(err.message)
    }
  }

  async function handleRenamePaymentMethod(id) {
    const name = editingPmName.trim()
    if (!name) return
    try {
      const updated = await api.updatePaymentMethod(id, { name })
      setPaymentMethods(pms => pms.map(p => p.id === id ? updated : p))
      setEditingPmId(null)
    } catch (err) {
      setPmError(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-safe page-enter">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 safe-top px-4 pb-10 lg:pb-12">
        <div className="max-w-6xl mx-auto lg:px-6 flex items-center gap-3">
          <button
            onClick={() => navigate('/months')}
            className="lg:hidden w-10 h-10 rounded-full bg-white/20 flex items-center justify-center active:bg-white/30 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-white">{t('settings.title')}</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 lg:px-6 -mt-5 lg:-mt-8 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start space-y-4 lg:space-y-0">

        {/* Colonne gauche */}
        <div className="space-y-4">

          {/* Notifications */}
          {pushSupported && (
            <Section title={t('settings.section_notifications')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">{t('settings.notif_label')}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{t('settings.notif_hint')}</p>
                  {permission === 'denied' && <p className="text-xs text-red-500 mt-1">{t('settings.notif_blocked')}</p>}
                </div>
                <button
                  type="button"
                  onClick={subscribed ? unsubscribe : subscribe}
                  disabled={pushLoading || permission === 'denied'}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${subscribed ? 'bg-violet-600' : 'bg-slate-200'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${subscribed ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
              {subscribed && (
                <button
                  type="button"
                  onClick={async () => {
                    const reg = await navigator.serviceWorker.ready
                    reg.showNotification('CoWallet test', { body: 'Les notifications fonctionnent !', icon: '/cowallet-logo-512x512.png' })
                  }}
                  className="text-xs text-violet-600 underline mt-1"
                >
                  {t('settings.notif_test')}
                </button>
              )}
            </Section>
          )}

          {config?.invite_code && (
            <Section title={t('settings.section_invite')}>
              <p className="text-sm text-slate-500">{t('settings.invite_hint')}</p>
              <div className="flex gap-2 mt-2">
                <div className="flex-1 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 font-mono truncate">
                  {`${window.location.origin}/invite/${config.invite_code}`}
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const url = `${window.location.origin}/invite/${config.invite_code}`
                    if (navigator.share) {
                      await navigator.share({ title: 'CoWallet', text: t('settings.invite_text'), url })
                    } else {
                      await navigator.clipboard.writeText(url)
                      alert(t('settings.invite_copied'))
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold active:scale-95 transition shrink-0"
                >
                  {t('settings.invite_share')}
                </button>
              </div>
            </Section>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <Section title={t('settings.section_group')}>
              <Field label={t('settings.field_group_name')}>
                <Input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder={t('settings.group_name_placeholder')} maxLength={40} />
              </Field>
              <p className="text-xs text-slate-400">{t('settings.group_name_hint')}</p>
              <Field label={t('settings.field_currency')}>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                >
                  {[
                    { code: 'EUR', label: 'Euro (€)' },
                    { code: 'USD', label: 'US Dollar ($)' },
                    { code: 'GBP', label: 'British Pound (£)' },
                    { code: 'CHF', label: 'Swiss Franc (CHF)' },
                    { code: 'CAD', label: 'Canadian Dollar (CA$)' },
                    { code: 'AUD', label: 'Australian Dollar (A$)' },
                    { code: 'JPY', label: 'Japanese Yen (¥)' },
                    { code: 'SEK', label: 'Swedish Krona (SEK)' },
                    { code: 'NOK', label: 'Norwegian Krone (NOK)' },
                    { code: 'DKK', label: 'Danish Krone (DKK)' },
                    { code: 'PLN', label: 'Polish Zloty (PLN)' },
                    { code: 'CZK', label: 'Czech Koruna (CZK)' },
                  ].map(({ code, label }) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </Field>
            </Section>
            <Section title={t('settings.section_account')}>
              <Field label={t('settings.field_display_name')}>
                <Input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder={t('settings.username_placeholder')} required />
              </Field>
            </Section>

            <Section title={t('settings.section_password')}>
              <Field label={t('settings.field_current_password')}>
                <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
              </Field>
              <Field label={t('settings.field_new_password')}>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
              </Field>
            </Section>

            <Section title={t('settings.section_split')}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">{config?.user1_username ?? 'User 1'}</span>
                <span className="text-sm font-bold text-violet-600">{share} / {100 - share}</span>
                <span className="text-sm text-slate-600">{config?.user2_username ?? 'User 2'}</span>
              </div>
              <input type="range" min={1} max={99} value={share} onChange={e => setShare(Number(e.target.value))} className="w-full accent-violet-600" />
              <div className="flex justify-center gap-2 mt-3 flex-wrap">
                {[50, 60, 70].map(v => (
                  <button key={v} type="button" onClick={() => setShare(v)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition ${share === v ? 'bg-violet-600 text-white border-violet-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                    {v}/{100 - v}
                  </button>
                ))}
              </div>
            </Section>

            {error   && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}
            {success && <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-xl">{success}</div>}

            <button type="submit" disabled={saving}
              className="w-full py-4 rounded-2xl bg-violet-600 text-white font-semibold shadow-lg shadow-violet-200 active:scale-95 transition disabled:opacity-60">
              {saving ? t('settings.btn_saving') : t('settings.btn_save')}
            </button>

            <button type="button" onClick={logout}
              className="w-full py-4 rounded-2xl bg-white text-red-500 font-semibold border border-red-100 active:bg-red-50 transition">
              {t('settings.btn_logout')}
            </button>

            {!showDeleteConfirm ? (
              <button type="button" onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-3 text-sm text-slate-400 hover:text-red-400 transition">
                {t('settings.btn_delete_account')}
              </button>
            ) : (
              <div className="bg-red-50 rounded-2xl p-4 space-y-3">
                <p className="text-sm font-semibold text-red-600">{t('settings.delete_confirm_title')}</p>
                <p className="text-xs text-red-400">{t('settings.delete_confirm_hint')}</p>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-red-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm"
                  placeholder={t('settings.delete_password_placeholder')}
                />
                {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteError('') }}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 bg-white active:bg-slate-50 transition">
                    {t('settings.btn_cancel')}
                  </button>
                  <button type="button" onClick={handleDeleteAccount} disabled={deleting || !deletePassword}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold active:scale-95 transition disabled:opacity-60">
                    {deleting ? t('settings.btn_deleting') : t('settings.btn_confirm_delete')}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Colonne droite */}
        <div className="space-y-4">

          {/* Categories */}
          <Section title={t('settings.section_categories')}>
            <div className="space-y-2">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-slate-50">
                  <span className="text-lg">{cat.icon}</span>
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  {editingCatId === cat.id ? (
                    <>
                      <input
                        value={editingCatName}
                        onChange={e => setEditingCatName(e.target.value)}
                        onBlur={() => handleRenameCategory(cat.id)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRenameCategory(cat.id); if (e.key === 'Escape') setEditingCatId(null) }}
                        className="flex-1 px-2 py-1 text-sm rounded-lg border border-violet-300 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                        autoFocus
                      />
                    </>
                  ) : (
                    <span
                      className="text-sm font-medium text-slate-700 flex-1 cursor-pointer hover:text-violet-600 transition"
                      onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name) }}
                    >{cat.name}</span>
                  )}
                  <button onClick={() => handleDeleteCategory(cat.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {catError && <p className="text-xs text-red-500">{catError}</p>}

            <form onSubmit={handleAddCategory} className="space-y-3 pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('settings.new_category')}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(v => !v)}
                  className={`w-14 h-11 text-xl rounded-xl border flex items-center justify-center transition ${showEmojiPicker ? 'border-violet-400 ring-2 ring-violet-300 bg-violet-50' : 'border-slate-200 bg-slate-50'}`}
                >
                  {newCatIcon}
                </button>
                <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder={t('settings.category_name_placeholder')} required />
              </div>
              {showEmojiPicker && (
                <div className="grid grid-cols-10 gap-1 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  {PRESET_EMOJIS.map(e => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => { setNewCatIcon(e); setShowEmojiPicker(false) }}
                      className={`h-9 text-xl rounded-lg flex items-center justify-center transition active:scale-95 ${newCatIcon === e ? 'bg-violet-100 ring-2 ring-violet-400' : 'hover:bg-slate-200'}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 py-1">
                {PRESET_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setNewCatColor(c)}
                    className={`w-7 h-7 rounded-full transition ${newCatColor === c ? 'ring-2 ring-offset-2 ring-violet-500 scale-110' : ''}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              <button type="submit"
                className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold active:scale-95 transition">
                {t('settings.btn_add')}
              </button>
            </form>
          </Section>

          {/* Payment methods */}
          <Section title={t('settings.section_payment_methods')}>
            <div className="space-y-2">
              {paymentMethods.map(pm => (
                <div key={pm.id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-slate-50">
                  {editingPmId === pm.id ? (
                    <input
                      value={editingPmName}
                      onChange={e => setEditingPmName(e.target.value)}
                      onBlur={() => handleRenamePaymentMethod(pm.id)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRenamePaymentMethod(pm.id); if (e.key === 'Escape') setEditingPmId(null) }}
                      className="flex-1 px-2 py-1 text-sm rounded-lg border border-violet-300 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                      autoFocus
                    />
                  ) : (
                    <span
                      className="text-sm font-medium text-slate-700 flex-1 cursor-pointer hover:text-violet-600 transition"
                      onClick={() => { setEditingPmId(pm.id); setEditingPmName(pm.name) }}
                    >{pm.name}</span>
                  )}
                  <button onClick={() => handleDeletePaymentMethod(pm.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {pmError && <p className="text-xs text-red-500">{pmError}</p>}

            <form onSubmit={handleAddPaymentMethod} className="flex gap-2 pt-2 border-t border-slate-100">
              <input value={newPmName} onChange={e => setNewPmName(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder={t('settings.payment_method_placeholder')} required />
              <button type="submit"
                className="px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold active:scale-95 transition">
                {t('settings.btn_add')}
              </button>
            </form>
          </Section>

          {/* Bank connection */}
          <Section title={t('settings.section_bank')}>
              {bankStatus && !bankStatus.configured && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 text-amber-800 text-sm px-4 py-3 rounded-xl">
                  <span className="text-lg shrink-0">⚙️</span>
                  <div>
                    <p className="font-semibold">{t('settings.bank_not_configured')}</p>
                    <p className="text-xs text-amber-600 mt-0.5">{t('settings.bank_not_configured_hint')}</p>
                  </div>
                </div>
              )}
              {(!bankStatus || bankStatus.configured) && searchParams.get('bank') === 'connected' && (
                <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 text-sm font-medium px-4 py-3 rounded-xl">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
                    <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                  </svg>
                  {t('settings.bank_connected_success')}
                </div>
              )}

              {bankStatus?.configured && !bankStatus.connected ? (
                <div>
                  <p className="text-sm text-slate-500 mb-4">
                    {t('settings.bank_connect_hint')}
                  </p>
                  <button
                    onClick={openBankPicker}
                    disabled={bankConnecting}
                    className="w-full py-3 rounded-2xl bg-violet-600 text-white font-semibold active:bg-violet-700 transition disabled:opacity-60"
                  >
                    {bankConnecting ? t('settings.btn_connecting') : t('settings.btn_connect_bank')}
                  </button>
                </div>
              ) : bankStatus?.configured ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 py-2">
                    <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center text-xl shrink-0">
                      🏦
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{bankStatus.provider_name}</p>
                      <p className="text-xs text-emerald-600 font-medium">{t('settings.bank_connected_label')}</p>
                    </div>
                  </div>

                  {bankStatus.accounts?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('settings.bank_accounts')}</p>
                      {bankStatus.accounts.map(acc => (
                        <div key={acc.id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-slate-50">
                          <span className="text-sm font-medium text-slate-700 flex-1 truncate">{acc.name}</span>
                          <span className="text-xs text-slate-400">{acc.nature}</span>
                          <button
                            onClick={() => handleToggleAccount(acc.id)}
                            className={`relative w-10 h-6 rounded-full transition-colors ${acc.enabled ? 'bg-violet-600' : 'bg-slate-200'}`}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${acc.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={handleBankDisconnect}
                    disabled={bankDisconnecting}
                    className="w-full py-2.5 rounded-2xl border border-red-100 text-red-500 text-sm font-medium active:bg-red-50 transition disabled:opacity-60"
                  >
                    {bankDisconnecting ? t('settings.btn_disconnecting') : t('settings.btn_disconnect_bank')}
                  </button>
                </div>
              ) : null}
            </Section>

          {/* Language */}
          <Section title={t('settings.section_language')}>
            <div className="flex gap-2">
              {['en', 'fr'].map(lang => (
                <button
                  key={lang}
                  onClick={() => i18n.changeLanguage(lang)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition ${i18n.language === lang || (lang === 'en' && !['fr'].includes(i18n.language)) ? 'bg-violet-600 text-white border-violet-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                >
                  {t(`settings.lang_${lang}`)}
                </button>
              ))}
            </div>
          </Section>

        </div>
      </div>

      <div className="h-8" />

      {/* Bank picker modal */}
      {showBankPicker && (
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
      )}
    </div>
  )
}
