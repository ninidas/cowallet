import { useState } from 'react'
import { api } from '../api'

const STEPS = ['Utilisateur 1', 'Utilisateur 2', 'Répartition']

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
            i < current  ? 'bg-white text-violet-600' :
            i === current ? 'bg-white text-violet-600 ring-2 ring-white ring-offset-2 ring-offset-violet-600' :
                           'bg-white/30 text-white'
          }`}>
            {i < current ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
            ) : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-px w-8 transition-colors ${i < current ? 'bg-white' : 'bg-white/30'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function UserStep({ number, title, username, setUsername, password, setPassword, confirm, setConfirm, error }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-violet-200 text-sm mb-1">Étape {number} sur 3</p>
        <h2 className="text-2xl font-bold text-white">{title}</h2>
      </div>

      <div className="bg-white rounded-3xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">Prénom / identifiant</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            placeholder="Ex : nicolas"
            autoCapitalize="none"
            autoComplete="off"
            required
          />
          <p className="text-xs text-slate-400 mt-1.5 ml-1">Sera utilisé pour se connecter</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">Confirmer le mot de passe</label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />
        </div>

        {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}
      </div>
    </div>
  )
}

function ShareStep({ share, setShare, user1, user2 }) {
  const presets = [
    { label: '50 / 50', value: 50 },
    { label: '60 / 40', value: 60 },
    { label: '70 / 30', value: 70 },
  ]
  return (
    <div className="space-y-4">
      <div>
        <p className="text-violet-200 text-sm mb-1">Étape 3 sur 3</p>
        <h2 className="text-2xl font-bold text-white">Répartition des charges</h2>
        <p className="text-violet-200 text-sm mt-1">Modifiable mois par mois depuis l'app</p>
      </div>

      <div className="bg-white rounded-3xl p-6 space-y-6">
        {/* Visuel répartition */}
        <div className="flex rounded-2xl overflow-hidden h-12 text-sm font-bold">
          <div
            className="flex items-center justify-center bg-violet-600 text-white transition-all"
            style={{ width: `${share}%` }}
          >
            {share >= 20 && <span className="capitalize truncate px-2">{user1 || 'User 1'} {share}%</span>}
          </div>
          <div
            className="flex items-center justify-center bg-indigo-400 text-white transition-all"
            style={{ width: `${100 - share}%` }}
          >
            {(100 - share) >= 20 && <span className="capitalize truncate px-2">{user2 || 'User 2'} {100 - share}%</span>}
          </div>
        </div>

        {/* Slider */}
        <input
          type="range"
          min="1"
          max="99"
          value={share}
          onChange={e => setShare(parseInt(e.target.value))}
          className="w-full h-2 appearance-none rounded-full cursor-pointer"
          style={{ background: `linear-gradient(to right, #7c3aed ${share}%, #e2e8f0 ${share}%)` }}
        />

        {/* Présets */}
        <div className="flex gap-2 justify-center">
          {presets.map(p => (
            <button
              type="button"
              key={p.value}
              onClick={() => setShare(p.value)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition active:scale-95 ${
                share === p.value
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function SetupPage() {
  const [step, setStep] = useState(0)

  const [u1, setU1]         = useState('')
  const [p1, setP1]         = useState('')
  const [c1, setC1]         = useState('')
  const [u2, setU2]         = useState('')
  const [p2, setP2]         = useState('')
  const [c2, setC2]         = useState('')
  const [share, setShare]   = useState(50)

  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  function validateStep() {
    setError('')
    if (step === 0) {
      if (!u1.trim()) return setError('L\'identifiant est requis'), false
      if (p1.length < 6) return setError('Le mot de passe doit faire au moins 6 caractères'), false
      if (p1 !== c1) return setError('Les mots de passe ne correspondent pas'), false
    }
    if (step === 1) {
      if (!u2.trim()) return setError('L\'identifiant est requis'), false
      if (u2.trim() === u1.trim()) return setError('Les deux identifiants doivent être différents'), false
      if (p2.length < 6) return setError('Le mot de passe doit faire au moins 6 caractères'), false
      if (p2 !== c2) return setError('Les mots de passe ne correspondent pas'), false
    }
    return true
  }

  function next() {
    if (!validateStep()) return
    setStep(s => s + 1)
  }

  async function finish() {
    if (!validateStep()) return
    setLoading(true)
    try {
      await api.setup({
        user1_username: u1.trim(),
        user1_password: p1,
        user2_username: u2.trim(),
        user2_password: p2,
        default_user1_share: share,
      })
      window.location.replace('/login')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 to-indigo-700 px-5 py-8 flex flex-col">
      <div className="max-w-sm mx-auto w-full flex flex-col flex-1">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
            <span className="text-3xl">€</span>
          </div>
          <h1 className="text-xl font-bold text-white">CoWallet</h1>
          <p className="text-violet-200 text-sm mt-0.5">Configuration initiale</p>
        </div>

        <StepIndicator current={step} />

        <div className="flex-1">
          {step === 0 && (
            <UserStep
              number={1} title="Premier utilisateur"
              username={u1} setUsername={setU1}
              password={p1} setPassword={setP1}
              confirm={c1} setConfirm={setC1}
              error={error}
            />
          )}
          {step === 1 && (
            <UserStep
              number={2} title="Deuxième utilisateur"
              username={u2} setUsername={setU2}
              password={p2} setPassword={setP2}
              confirm={c2} setConfirm={setC2}
              error={error}
            />
          )}
          {step === 2 && (
            <ShareStep share={share} setShare={setShare} user1={u1} user2={u2} />
          )}
          {step === 2 && error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl mt-4">{error}</div>
          )}
        </div>

        <div className="mt-6 space-y-3">
          <button
            onClick={step < 2 ? next : finish}
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-white text-violet-700 font-bold text-base shadow-xl active:scale-95 transition disabled:opacity-60 disabled:scale-100"
          >
            {loading ? 'Configuration…' : step < 2 ? 'Continuer →' : 'Terminer la configuration'}
          </button>

          {step > 0 && (
            <button
              onClick={() => { setStep(s => s - 1); setError('') }}
              className="w-full py-3 rounded-2xl text-white/70 font-medium text-sm active:text-white transition"
            >
              ← Retour
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
