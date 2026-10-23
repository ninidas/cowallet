import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../api'
import { useAuth } from '../../context/AuthContext'

// Champs enregistrés par la barre du bas (Couple et Profil) : prénom, mot de passe, part, nom du groupe, devise, carte
export function useSettingsForm({ setError, setSuccess }) {
  const { t } = useTranslation()
  const { user, config, refreshConfig, updateDisplayName, updateToken } = useAuth()
  const [username,        setUsername]        = useState(user?.displayName ?? user?.username ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword,     setNewPassword]     = useState('')
  const [share,           setShare]           = useState(config?.default_user1_share ?? 50)
  const [groupName,       setGroupName]       = useState(config?.group_name ?? '')
  const [currency,        setCurrency]        = useState(config?.currency ?? 'EUR')
  const [cards,           setCards]           = useState(config?.my_cards ?? '')
  const [saving,  setSaving]  = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const hasChanges = (
    username.trim() !== (user?.displayName ?? user?.username ?? '') ||
    !!newPassword ||
    share !== (config?.default_user1_share ?? 50) ||
    (groupName.trim() !== '' && groupName.trim() !== (config?.group_name ?? '')) ||
    currency !== (config?.currency ?? 'EUR') ||
    cards.trim() !== (config?.my_cards ?? '')
  )

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    const payload = {}
    if (username.trim() !== (user?.displayName ?? user?.username ?? '')) payload.display_name = username.trim()
    if (newPassword) {
      payload.current_password = currentPassword
      payload.new_password     = newPassword
    }
    if (share !== (config?.default_user1_share ?? 50)) payload.default_user1_share = share
    if (cards.trim() !== (config?.my_cards ?? '')) payload.card_digits = cards.trim()
    const nameChanged     = groupName.trim() && groupName.trim() !== (config?.group_name ?? '')
    const currencyChanged = currency !== (config?.currency ?? 'EUR')
    if (Object.keys(payload).length === 0 && !nameChanged && !currencyChanged) {
      setSaving(false)
      setSuccess(t('settings.success_no_change'))
      return
    }
    try {
      if (Object.keys(payload).length > 0) {
        const res = await api.updateSettings(payload)
        if (res?.access_token) updateToken(res.access_token)
      }
      if (nameChanged) await api.renameGroup(groupName.trim())
      if (currencyChanged) await api.updateCurrency(currency)
      if (payload.display_name) updateDisplayName(payload.display_name)
      await refreshConfig()
      setSuccess(t('settings.success_saved'))
      setCurrentPassword('')
      setNewPassword('')
      setShowPassword(false)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return {
    username, setUsername, currentPassword, setCurrentPassword, newPassword, setNewPassword,
    share, setShare, groupName, setGroupName, currency, setCurrency, cards, setCards,
    saving, showPassword, setShowPassword, hasChanges, handleSave,
  }
}
