self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { title: 'CoWallet', body: event.data?.text() || '' } }

  // Support Declarative Web Push format (iOS 18.4+) and legacy format
  const title = (data.notification && data.notification.title) || data.title || 'CoWallet'
  const body  = (data.notification && data.notification.body)  || data.body  || ''
  const url   = (data.notification && data.notification.navigate) || data.url || '/'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/cowallet-logo-512x512.png',
      data: { url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const existing = list.find(c => c.url.includes(self.location.origin))
      if (existing) return existing.focus().then(c => c.navigate(url))
      const absUrl = url.startsWith('http') ? url : self.location.origin + url
      return clients.openWindow(absUrl)
    })
  )
})
