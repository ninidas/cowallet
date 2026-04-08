self.addEventListener('push', (event) => {
  if (!event.data) return
  let data = {}
  try { data = event.data.json() } catch { data = { title: 'CoWallet', body: event.data.text() } }

  event.waitUntil(
    self.registration.showNotification(data.title || 'CoWallet', {
      body: data.body || '',
      icon: '/cowallet-logo-512x512.png',
      badge: '/cowallet-logo-512x512.png',
      data: { url: data.url || '/' },
      vibrate: [200, 100, 200],
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
      return clients.openWindow(url)
    })
  )
})
