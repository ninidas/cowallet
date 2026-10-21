import { useState, useEffect } from 'react'
import { api } from '../../api'

// Connexion bancaire : état (résumé aussi dans le sommaire), choix de la banque, comptes suivis
export function useBankSettings({ setError, confirmArm }) {
  const [bankStatus,      setBankStatus]      = useState(null)
  const [bankConnecting,  setBankConnecting]  = useState(false)
  const [bankDisconnecting, setBankDisc]      = useState(false)
  const [showBankPicker,  setShowBankPicker]  = useState(false)
  const [aspsps,          setAspsps]          = useState([])
  const [aspspsLoading,   setAspspsLoading]   = useState(false)
  const [aspspCountry,    setAspspCountry]    = useState('FR')
  const [aspspSearch,     setAspspSearch]     = useState('')

  useEffect(() => {
    // D'abord sans l'échéance (immédiat), puis avec : Enable Banking met parfois 15 s à répondre
    let full = false
    api.getBankStatus(false).then(s => { if (!full) setBankStatus(s) }).catch(() => {})
    api.getBankStatus().then(s => { full = true; setBankStatus(s) }).catch(() => {})
  }, [])

  async function openBankPicker() {
    setShowBankPicker(true)
    setAspspsLoading(true)
    setAspspSearch('')
    try {
      const data = await api.getAspsps(aspspCountry)
      setAspsps(data)
    } catch (err) {
      setError(err.message)
      setShowBankPicker(false)
    } finally {
      setAspspsLoading(false)
    }
  }

  async function handleBankConnect(aspspName) {
    setShowBankPicker(false)
    setBankConnecting(true)
    try {
      const returnTo = `${window.location.origin}/bank/callback`
      const { connect_url } = await api.startBankConnect(returnTo, aspspName, aspspCountry)
      window.location.href = connect_url
    } catch (err) {
      setError(err.message)
      setBankConnecting(false)
    }
  }

  async function handleBankDisconnect() {
    if (!confirmArm('bank')) return
    setBankDisc(true)
    try {
      await api.deleteBankConnection()
      setBankStatus(s => ({ ...s, connected: false }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBankDisc(false)
    }
  }

  async function handleToggleAccount(id) {
    const res = await api.toggleBankAccount(id)
    setBankStatus(s => ({
      ...s,
      accounts: s.accounts.map(a => a.id === id ? { ...a, enabled: res.enabled } : a),
    }))
  }

  return {
    bankStatus, bankConnecting, bankDisconnecting, showBankPicker, setShowBankPicker,
    aspsps, setAspsps, aspspsLoading, setAspspsLoading, aspspCountry, setAspspCountry, aspspSearch, setAspspSearch,
    openBankPicker, handleBankConnect, handleBankDisconnect, handleToggleAccount,
  }
}
