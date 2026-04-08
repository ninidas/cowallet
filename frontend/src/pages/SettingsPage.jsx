import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { useRef } from 'react'
import { usePushNotifications } from '../hooks/usePushNotifications'

const PRESET_COLORS = [
  '#3b82f6', '#f97316', '#10b981', '#a855f7',
  '#ef4444', '#06b6d4', '#ec4899', '#eab308',
  '#64748b', '#8b5cf6', '#14b8a6', '#f59e0b',
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
  const navigate   = useNavigate()
  const { user, config, logout, refreshConfig } = useAuth()
  const { supported: pushSupported, permission, subscribed, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications()

  const [username,        setUsername]        = useState(user?.username ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword,     setNewPassword]     = useState('')
  const [share,           setShare]           = useState(config?.default_user1_share ?? 50)
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

  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState([])
  const [newPmName,      setNewPmName]      = useState('')
  const [pmError,        setPmError]        = useState('')

  useEffect(() => {
    window.scrollTo(0, 0)
    api.getCategories().then(setCategories).catch(() => {})
    api.getPaymentMethods().then(setPaymentMethods).catch(() => {})
  }, [])

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
    if (Object.keys(payload).length === 0) {
      setSaving(false)
      setSuccess('Aucune modification.')
      return
    }
    try {
      await api.updateSettings(payload)
      await refreshConfig()
      setSuccess('Paramètres enregistrés.')
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
          <h1 className="text-xl font-bold text-white">Paramètres</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 lg:px-6 -mt-5 lg:-mt-8 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start space-y-4 lg:space-y-0">

        {/* Colonne gauche */}
        <div className="space-y-4">

          {/* Notifications */}
          {pushSupported && (
            <Section title="Notifications">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">Nouvelles dépenses</p>
                  <p className="text-xs text-slate-400 mt-0.5">Sois notifié quand ton partenaire ajoute une dépense</p>
                  {permission === 'denied' && <p className="text-xs text-red-500 mt-1">Notifications bloquées dans le navigateur</p>}
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
            </Section>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <Section title="Mon compte">
              <Field label="Prénom affiché">
                <Input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Ton prénom" required />
              </Field>
            </Section>

            <Section title="Changer le mot de passe">
              <Field label="Mot de passe actuel">
                <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
              </Field>
              <Field label="Nouveau mot de passe">
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
              </Field>
            </Section>

            <Section title="Répartition par défaut">
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
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>

            <button type="button" onClick={logout}
              className="w-full py-4 rounded-2xl bg-white text-red-500 font-semibold border border-red-100 active:bg-red-50 transition">
              Se déconnecter
            </button>

            {!showDeleteConfirm ? (
              <button type="button" onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-3 text-sm text-slate-400 hover:text-red-400 transition">
                Supprimer mon compte
              </button>
            ) : (
              <div className="bg-red-50 rounded-2xl p-4 space-y-3">
                <p className="text-sm font-semibold text-red-600">Supprimer mon compte</p>
                <p className="text-xs text-red-400">Cette action est irréversible. Confirmez avec votre mot de passe.</p>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-red-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm"
                  placeholder="Mot de passe"
                />
                {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteError('') }}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 bg-white active:bg-slate-50 transition">
                    Annuler
                  </button>
                  <button type="button" onClick={handleDeleteAccount} disabled={deleting || !deletePassword}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold active:scale-95 transition disabled:opacity-60">
                    {deleting ? 'Suppression…' : 'Confirmer'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Colonne droite */}
        <div className="space-y-4">

          {/* Catégories */}
          <Section title="Catégories">
            <div className="space-y-2">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-slate-50">
                  <span className="text-lg">{cat.icon}</span>
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-sm font-medium text-slate-700 flex-1">{cat.name}</span>
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
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Nouvelle catégorie</p>
              <div className="flex gap-2">
                <input value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)}
                  className="w-14 px-2 py-2.5 text-center text-xl rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="📦" maxLength={2} />
                <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="Nom de la catégorie" required />
              </div>
              <div className="flex flex-wrap gap-2 py-1">
                {PRESET_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setNewCatColor(c)}
                    className={`w-7 h-7 rounded-full transition ${newCatColor === c ? 'ring-2 ring-offset-2 ring-violet-500 scale-110' : ''}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              <button type="submit"
                className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold active:scale-95 transition">
                Ajouter
              </button>
            </form>
          </Section>

          {/* Moyens de paiement */}
          <Section title="Moyens de paiement">
            <div className="space-y-2">
              {paymentMethods.map(pm => (
                <div key={pm.id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-slate-50">
                  <span className="text-sm font-medium text-slate-700 flex-1">{pm.name}</span>
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
                placeholder="Ex : Virement, Lydia…" required />
              <button type="submit"
                className="px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold active:scale-95 transition">
                Ajouter
              </button>
            </form>
          </Section>

        </div>
      </div>

      <div className="h-8" />
    </div>
  )
}
