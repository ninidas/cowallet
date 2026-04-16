import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

export default function RegisterPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError(t('register.error_password_short')); return }
    if (!/\d/.test(password)) { setError(t('register.error_password_no_digit')); return }
    if (password !== confirm) { setError(t('register.error_password_mismatch')); return }
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
        <p className="text-violet-200 mt-1 text-sm">{t('register.subtitle')}</p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl">
        <h2 className="text-xl font-semibold text-slate-800 mb-6">{t('register.title')}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">{t('register.field_username')}</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
              placeholder={t('register.field_username_placeholder')}
              autoComplete="username"
              autoCapitalize="none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">{t('register.field_password')}</label>
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
            <label className="block text-sm font-medium text-slate-600 mb-1.5">{t('register.field_confirm')}</label>
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
            {loading ? t('register.btn_loading') : t('register.btn_submit')}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          {t('register.has_account')}{' '}
          <Link to="/login" className="text-violet-600 font-medium">{t('register.login_link')}</Link>
        </p>

        <div className="flex items-center gap-2 mt-5 pt-5 border-t border-slate-100">
          <span className="text-base">🔒</span>
          <p className="text-xs text-slate-400 leading-relaxed">
            {t('register.privacy')}
          </p>
        </div>
      </div>
    </div>
  )
}
