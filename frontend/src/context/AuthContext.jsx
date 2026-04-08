import { createContext, useContext, useState, useEffect } from 'react'
import { api, clearCache } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })
  const [config, setConfig] = useState(null)
  const [ready, setReady]   = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('darkMode')
    if (stored !== null) return stored === 'true'
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })

  // Applique la classe dark sur <html>
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('darkMode', String(darkMode))
  }, [darkMode])

  useEffect(() => {
    if (!user) { setReady(true); return }
    api.getConfig()
      .then(setConfig)
      .catch(() => {})
      .finally(() => setReady(true))
  }, [user?.userId])

  function login(tokenData) {
    const userData = {
      token:    tokenData.access_token,
      userId:   tokenData.user_id,
      username: tokenData.username,
    }
    localStorage.setItem('token', tokenData.access_token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }

  function logout() {
    clearCache()
    localStorage.clear()
    setUser(null)
    setConfig(null)
  }

  async function refreshConfig() {
    const cfg = await api.getConfig()
    setConfig(cfg)
    return cfg
  }

  // Détermine si l'utilisateur connecté est user1 ou user2
  function getMyUserKey() {
    if (!user || !config) return null
    return user.username === config.user1_username ? 'user1' : 'user2'
  }

  function toggleDarkMode() {
    setDarkMode(d => !d)
  }

  return (
    <AuthContext.Provider value={{ user, config, ready, login, logout, getMyUserKey, refreshConfig, darkMode, toggleDarkMode }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
