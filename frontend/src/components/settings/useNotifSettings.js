import { useState } from 'react'
import { api } from '../../api'
import { useAuth } from '../../context/AuthContext'

// Notifications : types voulus (enregistrés sur le serveur, valables sur tous les appareils)
export function useNotifSettings() {
  const { config, refreshConfig, getMyUserKey } = useAuth()
  const [notif, setNotif] = useState(config?.notif ?? { partner: true, bank: true, budget: true, reminder: true })
  const partnerName = getMyUserKey() === 'user2' ? config?.user1_username : config?.user2_username
  async function toggleNotif(kind) {
    const next = { ...notif, [kind]: !notif[kind] }
    setNotif(next)
    try {
      await api.updateSettings({ [`notif_${kind}`]: next[kind] })
      refreshConfig()
    } catch {
      setNotif(notif)
    }
  }
  return { notif, partnerName, toggleNotif }
}
