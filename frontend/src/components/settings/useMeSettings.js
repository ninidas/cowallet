import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../context/AuthContext'

// Profil : types de notifications voulus et suppression du compte
export function useMeSettings() {
  const navigate = useNavigate()
  const { config, logout, refreshConfig, getMyUserKey } = useAuth()

  // Suppression de compte
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletePassword, setDeletePassword]       = useState('')
  const [deleteError, setDeleteError]             = useState('')
  const [deleting, setDeleting]                   = useState(false)

  // Types de notifications choisis (enregistrés sur le serveur, valables sur tous les appareils)
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

  async function handleDeleteAccount() {
    setDeleteError('')
    setDeleting(true)
    try {
      await api.deleteAccount(deletePassword)
      logout()
      navigate('/login')
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  return {
    showDeleteConfirm, setShowDeleteConfirm, deletePassword, setDeletePassword, deleteError, setDeleteError, deleting,
    notif, partnerName, toggleNotif, handleDeleteAccount,
  }
}
