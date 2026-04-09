const BASE = '/api'

function getToken() {
  return localStorage.getItem('token')
}

// Simple in-memory cache with TTL
const _cache = {}
const TTL = 45_000 // 45 seconds

function cached(key, fn) {
  const entry = _cache[key]
  if (entry && Date.now() < entry.expiresAt) return Promise.resolve(entry.data)
  return fn().then(data => {
    _cache[key] = { data, expiresAt: Date.now() + TTL }
    return data
  })
}

function invalidate(...keys) {
  keys.forEach(k => {
    if (k.endsWith('*')) {
      const prefix = k.slice(0, -1)
      Object.keys(_cache).filter(x => x.startsWith(prefix)).forEach(x => delete _cache[x])
    } else {
      delete _cache[k]
    }
  })
}

export function clearCache() {
  Object.keys(_cache).forEach(k => delete _cache[k])
}

async function request(path, options = {}) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  })

  if (res.status === 401) {
    if (token) {
      localStorage.clear()
      window.location.href = '/login'
      return
    }
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Identifiants incorrects')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Une erreur est survenue')
  }

  if (res.status === 204) return null
  return res.json()
}

export const api = {
  getConfig:       ()           => request('/config'),
  setupStatus:     ()           => request('/setup/status'),
  setup:           (data)       => request('/setup', { method: 'POST', body: JSON.stringify(data) }),
  login:           (u, p)       => request('/auth/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) }),
  register:        (u, p)       => request('/users/register', { method: 'POST', body: JSON.stringify({ username: u, password: p }) }),
  deleteAccount:   (password)   => request('/users/me', { method: 'DELETE', body: JSON.stringify({ password }) }),

  getMyGroup:      ()           => request('/groups/me'),
  createGroup:     (data)       => request('/groups', { method: 'POST', body: JSON.stringify(data) }),
  joinGroup:       (code)       => request('/groups/join', { method: 'POST', body: JSON.stringify({ invite_code: code }) }),
  renameGroup:     (name)       => request('/groups/me/name', { method: 'PATCH', body: JSON.stringify({ name }) }),

  getStats:        ()           => cached('stats',  () => request('/stats')),
  updateSettings:  (data)       => request('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
  getMonths:       ()           => cached('months', () => request('/months')),
  createMonth:     (data)       => request('/months', { method: 'POST', body: JSON.stringify(data) })
                                     .then(r => { invalidate('months', 'stats') ; return r }),
  getMonth:        (id)         => cached(`month:${id}`, () => request(`/months/${id}`)),
  deleteMonth:     (id)         => request(`/months/${id}`, { method: 'DELETE' })
                                     .then(r => { invalidate('months', `month:${id}`, 'stats') ; return r }),
  deleteMonths:    (ids)        => request('/months/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) })
                                     .then(r => { invalidate('months', 'stats') ; return r }),
  updateTransfer:  (id, data)   => request(`/months/${id}/transfer`, { method: 'PATCH', body: JSON.stringify(data) })
                                     .then(r => { invalidate('months', `month:${id}`) ; return r }),
  updateShare:     (id, data)   => request(`/months/${id}/share`, { method: 'PATCH', body: JSON.stringify(data) })
                                     .then(r => { invalidate(`month:${id}`) ; return r }),
  validateMonth:   (id)         => request(`/months/${id}/validate`, { method: 'POST' })
                                     .then(r => { invalidate('months', `month:${id}`) ; return r }),

  exportCsv: async () => {
    const res = await fetch('/api/export/csv', {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    if (!res.ok) throw new Error('Export échoué')
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `cowallet-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  },

  getCategories:        ()           => cached('categories', () => request('/categories')),
  createCategory:       (data)       => request('/categories', { method: 'POST', body: JSON.stringify(data) })
                                          .then(r => { invalidate('categories') ; return r }),
  updateCategory:       (id, data)   => request(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
                                          .then(r => { invalidate('categories') ; return r }),
  deleteCategory:       (id)         => request(`/categories/${id}`, { method: 'DELETE' })
                                          .then(r => { invalidate('categories') ; return r }),

  getPaymentMethods:    ()           => cached('payment_methods', () => request('/payment-methods')),
  createPaymentMethod:  (data)       => request('/payment-methods', { method: 'POST', body: JSON.stringify(data) })
                                          .then(r => { invalidate('payment_methods') ; return r }),
  deletePaymentMethod:  (id)         => request(`/payment-methods/${id}`, { method: 'DELETE' })
                                          .then(r => { invalidate('payment_methods') ; return r }),

  getBudget:           ()           => cached('budget', () => request('/budget')),
  createBudgetEntry:   (data)       => request('/budget', { method: 'POST', body: JSON.stringify(data) })
                                         .then(r => { invalidate('budget') ; return r }),
  updateBudgetEntry:   (id, data)   => request(`/budget/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
                                         .then(r => { invalidate('budget') ; return r }),
  deleteBudgetEntry:   (id)         => request(`/budget/${id}`, { method: 'DELETE' })
                                         .then(r => { invalidate('budget') ; return r }),

  getVapidPublicKey:   ()     => request('/push/vapid-public'),
  subscribePush:       (data) => request('/push/subscribe',   { method: 'POST',   body: JSON.stringify(data) }),
  unsubscribePush:     (data) => request('/push/subscribe',   { method: 'DELETE', body: JSON.stringify(data) }),

  getChargeSuggestions: () => cached('suggestions', () => request('/charges/suggestions')),
  addCharge:       (mid, data)  => request(`/months/${mid}/charges`, { method: 'POST', body: JSON.stringify(data) })
                                     .then(r => { invalidate('months', `month:${mid}`, 'stats', 'suggestions') ; return r }),
  updateCharge:    (id, data)   => request(`/charges/${id}`, { method: 'PUT', body: JSON.stringify(data) })
                                     .then(r => { invalidate('months', 'month:*', 'stats') ; return r }),
  fixInstallments: (id, installments_left) => request(`/charges/${id}/fix-installments`, { method: 'POST', body: JSON.stringify({ installments_left }) })
                                     .then(r => { invalidate('months', 'month:*', 'stats') ; return r }),
  deleteCharge:    (id)         => request(`/charges/${id}`, { method: 'DELETE' })
                                     .then(r => { invalidate('months', 'month:*', 'stats') ; return r }),
}
