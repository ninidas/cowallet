import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'

export default function BankCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      setError('Paramètre manquant dans la redirection Enable Banking.')
      return
    }
    api.finishBankConnect(code)
      .then(() => navigate('/settings?bank=connected', { replace: true }))
      .catch(err => setError(err.message))
  }, [])

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="text-center">
        <div className="text-4xl mb-4">❌</div>
        <p className="font-semibold text-slate-800 mb-2">Connexion échouée</p>
        <p className="text-slate-500 text-sm mb-6">{error}</p>
        <button
          onClick={() => navigate('/settings')}
          className="px-6 py-3 bg-violet-600 text-white rounded-2xl font-semibold"
        >
          Retour aux paramètres
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600 font-medium">Finalisation de la connexion…</p>
      </div>
    </div>
  )
}
