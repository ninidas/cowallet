import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function InvitePage() {
  const { code } = useParams()
  const { user, config, ready } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!ready) return
    // Stocker le code pour le récupérer après inscription/connexion
    if (code) sessionStorage.setItem('invite_code', code)

    if (!user) {
      navigate('/', { replace: true })
    } else if (config && !config.has_group) {
      navigate('/group-setup', { replace: true })
    } else {
      navigate('/months', { replace: true })
    }
  }, [ready, user, config])

  return null
}
