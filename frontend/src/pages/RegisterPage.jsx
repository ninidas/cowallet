import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

export default function RegisterPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Mot de passe trop court (8 caractères min.)'); return }
    if (!/\d/.test(password)) { setError('Le mot de passe doit contenir au moins un chiffre'); return }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas'); return }
    setLoading(true)
    try {
      const data = await api.register(username.trim(), password)
      login(data)
      navigate('/group-setup', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-700 px-6 pt-4 sm:pt-10 pb-8">
      <div className="mb-6 text-center">
        <img src="/logo-white1.png" alt="CoWallet" className="w-40 object-contain mx-auto mb-5" />
        <h1 className="text-3xl font-bold text-white">CoWallet</h1>
        <p className="text-violet-200 mt-1 text-sm">Gérez vos dépenses en commun</p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl">
        <h2 className="text-xl font-semibold text-slate-800 mb-6">Créer un compte</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Identifiant</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
              placeholder="Ton prénom"
              autoComplete="username"
              autoCapitalize="none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
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
              className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </div>

          {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-violet-600 text-white font-semibold text-base shadow-lg shadow-violet-200 active:scale-95 transition disabled:opacity-60 disabled:scale-100 mt-2"
          >
            {loading ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-violet-600 font-medium">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
