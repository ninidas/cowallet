import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePush } from '../context/PushContext'

const NAV = [
  {
    to: '/months',
    label: 'Mes mois',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    to: '/history',
    label: 'Historique',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    to: '/budget',
    label: 'Budget',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Paramètres',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate  = useNavigate()
  const { supported, permission, subscribed, loading, subscribe } = usePush()

  const isStandalone = typeof window !== 'undefined' &&
    window.matchMedia('(display-mode: standalone)').matches

  const [bannerDismissed, setBannerDismissed] = useState(
    () => localStorage.getItem('push_banner_dismissed') === '1'
  )

  const showBanner = isStandalone && supported && permission === 'default' && !subscribed && !bannerDismissed

  function dismissBanner() {
    localStorage.setItem('push_banner_dismissed', '1')
    setBannerDismissed(true)
  }

  async function handleActivate() {
    await subscribe()
    dismissBanner()
  }

  return (
    <div className="lg:flex lg:min-h-screen">

      {/* ── Sidebar desktop ───────────────────────────────── */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-gradient-to-b from-violet-700 to-indigo-800 shadow-xl">

        {/* Logo */}
        <div className="pt-8 pb-4 px-4 border-b border-white/10 flex flex-col items-center">
          <img src="/logo-white1.png" alt="CoWallet" className="w-24 object-contain mb-3" />
          <p className="text-white font-bold text-lg">CoWallet</p>
          <p className="text-violet-200 text-xs capitalize">{user?.username}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {NAV.map(({ to, label, icon }) => {
            const active = to === '/months'
              ? location.pathname === '/months' || location.pathname.startsWith('/months/')
              : location.pathname.startsWith(to)
            return (
              <button
                key={to}
                onClick={() => navigate(to)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? 'bg-white/20 text-white'
                    : 'text-violet-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                {icon}
                {label}
              </button>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-violet-200 hover:bg-white/10 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* ── Content ───────────────────────────────────────── */}
      <main className="lg:ml-64 lg:flex-1 min-h-screen bg-slate-50 pb-20 lg:pb-0">
        {children}
      </main>

      {/* ── Push notification banner ──────────────────────── */}
      {showBanner && (
        <div className="lg:hidden fixed bottom-16 inset-x-0 z-40 px-4 pb-2">
          <div className="bg-violet-700 text-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Activer les notifications</p>
              <p className="text-xs text-violet-200 mt-0.5">Soyez notifié quand votre partenaire valide un mois.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={dismissBanner}
                className="text-xs text-violet-300 hover:text-white px-2 py-1.5 rounded-lg transition"
              >
                Plus tard
              </button>
              <button
                onClick={handleActivate}
                disabled={loading}
                className="text-xs font-semibold bg-white text-violet-700 px-3 py-1.5 rounded-lg active:bg-violet-50 transition"
              >
                Activer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom nav mobile ─────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex z-50">
        {NAV.map(({ to, label, icon }) => {
          const active = to === '/months'
            ? location.pathname === '/months' || location.pathname.startsWith('/months/')
            : location.pathname.startsWith(to)
          return (
            <button
              key={to}
              onClick={() => navigate(to)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors ${
                active ? 'text-violet-600' : 'text-slate-400'
              }`}
            >
              {icon}
              {label}
            </button>
          )
        })}
      </nav>

    </div>
  )
}
