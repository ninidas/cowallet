import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NotifSettings from '../src/components/settings/NotifSettings'
import SettingsNav from '../src/components/settings/SettingsNav'

// Le groupe et l'abonnement push de cet appareil, réglés test par test
let auth, push
vi.mock('../src/context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../src/context/PushContext', () => ({ usePush: () => push }))

const all = { partner: true, bank: true, budget: true, reminder: true }
beforeEach(() => {
  auth = { user: { username: 'alex' }, config: { user1_username: 'alex', user2_username: 'sam', notif: all }, getMyUserKey: () => 'user1', logout: vi.fn() }
  push = { supported: true, permission: 'default', subscribed: true, loading: false, subscribe: vi.fn(), unsubscribe: vi.fn() }
})

describe('NotifSettings', () => {
  it('l\'appareil, puis les 4 types ; un appui change le type', () => {
    const toggleNotif = vi.fn()
    render(<NotifSettings notif={{ ...all, budget: false }} partnerName="sam" toggleNotif={toggleNotif} />)
    expect(screen.getByRole('switch', { name: 'Sur cet appareil' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getAllByRole('switch')).toHaveLength(5)
    expect(screen.getByRole('switch', { name: 'Budget dépassé' })).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(screen.getByRole('switch', { name: 'Ce que fait sam' }))
    expect(toggleNotif).toHaveBeenCalledWith('partner')
  })

  it('sans partenaire, pas de ligne pour lui', () => {
    render(<NotifSettings notif={all} toggleNotif={() => {}} />)
    expect(screen.queryByText(/Ce que fait/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('switch')).toHaveLength(4)
  })

  it('navigateur sans notifications : on dit comment faire, les choix restent', () => {
    push.supported = false
    render(<NotifSettings notif={all} partnerName="sam" toggleNotif={() => {}} />)
    expect(screen.getByText(/ajoutez CoWallet à l'écran d'accueil/)).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'Sur cet appareil' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('switch')).toHaveLength(4)
  })
})

describe('SettingsNav', () => {
  const renderNav = () => render(<MemoryRouter><SettingsNav bankStatus={null} categories={[]} paymentMethods={[]} /></MemoryRouter>)
  const summaryOf = name => screen.getByRole('link', { name: new RegExp(`^${name}`) }).textContent.slice(name.length)

  it('une rubrique Notifications à part, avant le Profil', () => {
    renderNav()
    expect(screen.getAllByRole('link').map(l => l.getAttribute('href')))
      .toEqual(['/settings/bank', '/settings/spending', '/settings/couple', '/settings/notifications', '/settings/me'])
    expect(summaryOf('Notifications')).toBe('Activées sur cet appareil')
    expect(summaryOf('Profil')).toBe('alex')
  })

  it('le résumé dit ce qui est coupé', () => {
    auth.config.notif = { ...all, bank: false }
    renderNav()
    expect(summaryOf('Notifications')).toBe('Activées sur cet appareil · 3 sur 4')
  })

  it('appareil non abonné, ou navigateur sans notifications', () => {
    push.subscribed = false
    const { unmount } = renderNav()
    expect(summaryOf('Notifications')).toBe('Désactivées sur cet appareil')
    unmount()
    push.supported = false
    renderNav()
    expect(summaryOf('Notifications')).toBe('Non disponibles dans ce navigateur')
  })
})
