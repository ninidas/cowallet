import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { tError } from '../utils/tError'

export default function LoginPage() {
  const { login } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.login(username.trim(), password)
      login(data)
      navigate('/months', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-700 px-6 pt-4 sm:pt-10 pb-8">
      {/* Logo */}
      <div className="mb-6 text-center">
        <img src="/logo-white1.png" alt="CoWallet" className="w-32 object-contain mx-auto mb-5" />
        <h1 className="text-3xl font-bold text-white">CoWallet</h1>
        <p className="text-violet-200 mt-1 text-sm">{t('login.tagline')}</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl">
        <h2 className="text-xl font-semibold text-slate-800 mb-6">{t('login.title')}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              {t('login.field_username')}
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
              placeholder={t('login.field_username_placeholder')}
              autoComplete="username"
              autoCapitalize="none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              {t('login.field_password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">
              {tError(t, error)}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-violet-600 text-white font-semibold text-base shadow-lg shadow-violet-200 active:scale-95 transition disabled:opacity-60 disabled:scale-100 mt-2"
          >
            {loading ? t('login.btn_loading') : t('login.btn_login')}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          {t('login.no_account')}{' '}
          <Link to="/register" className="text-violet-600 font-medium">{t('login.btn_register')}</Link>
        </p>
      </div>
    </div>
  )
}
