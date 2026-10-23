import { createContext, useContext, useState, useEffect } from 'react'
import { api, clearCache, clearSession } from '../api'

const AuthContext = createContext(null)

// À la déconnexion, l'appareil cesse de recevoir les notifications de ce compte (téléphone prêté ou
// partagé). En arrière-plan, avec le jeton de la session qui se termine : la déconnexion n'attend pas.
async function forgetPushOnDevice(token) {
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null
    const sub = reg && await reg.pushManager?.getSubscription()
    if (!sub) return
    const { endpoint, keys } = sub.toJSON()
    if (token) {
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ endpoint, keys }),
      }).catch(() => {})
    }
    await sub.unsubscribe()
  } catch { /* navigateur sans notifications : rien à faire */ }
}

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })
  const [config, setConfig] = useState(null)
  const [ready, setReady]   = useState(false)
  // Mode sombre retiré (2026-10-19) : seule la couleur du fond changeait, pas les écrans ;
  // un iPhone réglé en sombre pouvait afficher du texte clair sur des cartes blanches.
  const [darkMode, setDarkMode] = useState(false)
  useEffect(() => {
    document.documentElement.classList.remove('dark')
    localStorage.removeItem('darkMode')
  }, [])

  useEffect(() => {
    if (!user) { setReady(true); return }
    api.getConfig()
      .then(setConfig)
      .catch(() => {})
      .finally(() => setReady(true))
  }, [user?.userId])

  function login(tokenData) {
    const userData = {
      token:       tokenData.access_token,
      userId:      tokenData.user_id,
      username:    tokenData.username,
      displayName: tokenData.display_name ?? tokenData.username,
    }
    localStorage.setItem('token', tokenData.access_token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }

  function logout() {
    const token = localStorage.getItem('token')
    clearCache()
    clearSession()
    setUser(null)
    setConfig(null)
    forgetPushOnDevice(token)
  }

  async function refreshConfig() {
    const cfg = await api.getConfig()
    setConfig(cfg)
    return cfg
  }

  // Après un changement de mot de passe, les anciens jetons ne valent plus rien : on garde le nouveau
  function updateToken(token) {
    const updated = { ...user, token }
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(updated))
    setUser(updated)
  }

  function updateDisplayName(newDisplayName) {
    const updated = { ...user, displayName: newDisplayName }
    localStorage.setItem('user', JSON.stringify(updated))
    setUser(updated)
  }

  // Détermine si l'utilisateur connecté est user1 ou user2
  function getMyUserKey() {
    if (!user || !config) return null
    const user1Login = config.user1_login ?? config.user1_username
    return user.username === user1Login ? 'user1' : 'user2'
  }

  function toggleDarkMode() {
    setDarkMode(d => !d)
  }

  return (
    <AuthContext.Provider value={{ user, config, ready, login, logout, getMyUserKey, refreshConfig, updateDisplayName, updateToken, darkMode, toggleDarkMode }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
