import { useState, useEffect } from 'react'
import { api } from '../../api'

// Catégories et moyens de paiement : listes (comptées dans le sommaire), ajout, renommage, suppression
export function useSpendingSettings({ confirmArm }) {
  // Categories
  const [categories,    setCategories]    = useState([])
  const [newCatName,    setNewCatName]    = useState('')
  const [newCatIcon,    setNewCatIcon]    = useState('📦')
  const [newCatColor,   setNewCatColor]   = useState('#3b82f6')
  const [catError,      setCatError]      = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [editingCatId,  setEditingCatId]  = useState(null)
  const [editingCatName, setEditingCatName] = useState('')

  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState([])
  const [newPmName,      setNewPmName]      = useState('')
  const [pmError,        setPmError]        = useState('')
  const [editingPmId,   setEditingPmId]   = useState(null)
  const [editingPmName, setEditingPmName] = useState('')

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {})
    api.getPaymentMethods().then(setPaymentMethods).catch(() => {})
  }, [])

  async function handleAddCategory(e) {
    e.preventDefault()
    setCatError('')
    if (!newCatName.trim()) return
    try {
      const cat = await api.createCategory({ name: newCatName.trim(), icon: newCatIcon, color: newCatColor })
      setCategories(cs => [...cs, cat])
      setNewCatName('')
      setNewCatIcon('📦')
      setNewCatColor('#3b82f6')
      setShowEmojiPicker(false)
    } catch (err) {
      setCatError(err.message)
    }
  }

  async function handleDeleteCategory(id) {
    if (!confirmArm(`cat-${id}`)) return
    try {
      await api.deleteCategory(id)
      setCategories(cs => cs.filter(c => c.id !== id))
    } catch (err) {
      setCatError(err.message)
    }
  }

  async function handleRenameCategory(id) {
    const name = editingCatName.trim()
    if (!name) return
    try {
      const updated = await api.updateCategory(id, { name })
      setCategories(cs => cs.map(c => c.id === id ? updated : c))
      setEditingCatId(null)
    } catch (err) {
      setCatError(err.message)
    }
  }

  async function handleAddPaymentMethod(e) {
    e.preventDefault()
    setPmError('')
    if (!newPmName.trim()) return
    try {
      const pm = await api.createPaymentMethod({ name: newPmName.trim() })
      setPaymentMethods(pms => [...pms, pm])
      setNewPmName('')
    } catch (err) {
      setPmError(err.message)
    }
  }

  async function handleDeletePaymentMethod(id) {
    if (!confirmArm(`pm-${id}`)) return
    try {
      await api.deletePaymentMethod(id)
      setPaymentMethods(pms => pms.filter(p => p.id !== id))
    } catch (err) {
      setPmError(err.message)
    }
  }

  async function handleRenamePaymentMethod(id) {
    const name = editingPmName.trim()
    if (!name) return
    try {
      const updated = await api.updatePaymentMethod(id, { name })
      setPaymentMethods(pms => pms.map(p => p.id === id ? updated : p))
      setEditingPmId(null)
    } catch (err) {
      setPmError(err.message)
    }
  }

  return {
    categories, newCatName, setNewCatName, newCatIcon, setNewCatIcon, newCatColor, setNewCatColor, catError,
    showEmojiPicker, setShowEmojiPicker, editingCatId, setEditingCatId, editingCatName, setEditingCatName,
    paymentMethods, newPmName, setNewPmName, pmError, editingPmId, setEditingPmId, editingPmName, setEditingPmName,
    handleAddCategory, handleDeleteCategory, handleRenameCategory,
    handleAddPaymentMethod, handleDeletePaymentMethod, handleRenamePaymentMethod,
  }
}
