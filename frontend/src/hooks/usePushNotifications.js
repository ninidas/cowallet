import { useState, useEffect } from 'react'
import { api } from '../api'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export function usePushNotifications() {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  )
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading]       = useState(false)

  function checkSubscription() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => setSubscribed(!!sub))
    )
  }

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
    checkSubscription()

    document.addEventListener('visibilitychange', checkSubscription)
    return () => document.removeEventListener('visibilitychange', checkSubscription)
  }, [])

  async function subscribe() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    setLoading(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') return

      const { public_key } = await api.getVapidPublicKey()
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(public_key),
      })
      const json = sub.toJSON()
      await api.subscribePush({ endpoint: json.endpoint, keys: json.keys })
      setSubscribed(true)
    } catch (e) {
      console.error('Push subscribe error:', e)
    } finally {
      setLoading(false)
    }
  }

  async function unsubscribe() {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const json = sub.toJSON()
        await api.unsubscribePush({ endpoint: json.endpoint, keys: json.keys })
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } finally {
      setLoading(false)
    }
  }

  const supported = 'serviceWorker' in navigator && 'PushManager' in window

  return { supported, permission, subscribed, loading, subscribe, unsubscribe }
}
