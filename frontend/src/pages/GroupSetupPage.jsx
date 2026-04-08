import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

export default function GroupSetupPage() {
  const { refreshConfig, logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab]           = useState('create') // 'create' | 'join'
  const [groupName, setGroupName] = useState('Notre budget')
  const [inviteCode, setInviteCode] = useState('')
  const [createdGroup, setCreatedGroup] = useState(null)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const group = await api.createGroup({ name: groupName })
      setCreatedGroup(group)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.joinGroup(inviteCode.trim())
      await refreshConfig()
      navigate('/months', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleContinue() {
    await refreshConfig()
    navigate('/months', { replace: true })
  }

  if (createdGroup) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-700 px-6 py-8">
        <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#10b981" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Groupe créé !</h2>
          <p className="text-slate-500 text-sm mb-6">Partagez ce code avec votre partenaire pour qu'il rejoigne le groupe.</p>

          <div className="bg-violet-50 rounded-2xl p-4 mb-6">
            <p className="text-xs text-violet-400 font-medium mb-1">Code d'invitation</p>
            <p className="text-3xl font-bold tracking-widest text-violet-700">{createdGroup.invite_code}</p>
          </div>

          <button
            onClick={handleContinue}
            className="w-full py-4 rounded-2xl bg-violet-600 text-white font-semibold shadow-lg shadow-violet-200 active:scale-95 transition"
          >
            Continuer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-700 px-6 py-8">
      <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl">
        <button
          onClick={() => { logout(); navigate('/login') }}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 mb-6 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Retour à la connexion
        </button>
        <h2 className="text-xl font-semibold text-slate-800 mb-2">Votre espace budget</h2>
        <p className="text-sm text-slate-400 mb-6">Créez un groupe ou rejoignez celui de votre partenaire.</p>

        {/* Tabs */}
        <div className="flex bg-slate-100 rounded-2xl p-1 mb-6">
          {[['create', 'Créer'], ['join', 'Rejoindre']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setTab(key); setError('') }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${tab === key ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'create' ? (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Nom du groupe</label>
              <input
                type="text"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                placeholder="Notre budget"
                required
              />
            </div>
            {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}
            <button type="submit" disabled={loading}
              className="w-full py-4 rounded-2xl bg-violet-600 text-white font-semibold shadow-lg shadow-violet-200 active:scale-95 transition disabled:opacity-60">
              {loading ? 'Création…' : 'Créer le groupe'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Code d'invitation</label>
              <input
                type="text"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition text-center tracking-widest font-mono text-lg uppercase"
                placeholder="XXXXXXXX"
                maxLength={8}
                required
              />
            </div>
            {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}
            <button type="submit" disabled={loading}
              className="w-full py-4 rounded-2xl bg-violet-600 text-white font-semibold shadow-lg shadow-violet-200 active:scale-95 transition disabled:opacity-60">
              {loading ? 'Vérification…' : 'Rejoindre le groupe'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
