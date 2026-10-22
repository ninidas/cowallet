import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../context/AuthContext'

// Profil : suppression du compte
export function useMeSettings() {
  const navigate = useNavigate()
  const { logout } = useAuth()

  // Suppression de compte
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletePassword, setDeletePassword]       = useState('')
  const [deleteError, setDeleteError]             = useState('')
  const [deleting, setDeleting]                   = useState(false)

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
    handleDeleteAccount,
  }
}
