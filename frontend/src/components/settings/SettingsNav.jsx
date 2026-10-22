import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { usePush } from '../../context/PushContext'
import { SECTIONS, SECTION_ICONS } from './sections'
import { notifKinds } from './NotifSettings'

// Sommaire des réglages, avec la déconnexion dessous
export default function SettingsNav({ active, bankStatus, categories, paymentMethods }) {
  const { t, i18n } = useTranslation()
  const { user, config, logout, getMyUserKey } = useAuth()
  const { supported: pushSupported, subscribed } = usePush()

  // Une ligne de résumé sous chaque rubrique : l'essentiel sans l'ouvrir
  function summary(id) {
    if (id === 'bank') {
      if (!bankStatus) return { text: '' }
      if (!bankStatus.configured) return { text: t('settings.sum_bank_unconfigured') }
      if (!bankStatus.connected) return { text: t('settings.sum_bank_off') }
      const bank = bankStatus.provider_name
      if (bankStatus.expired) return { text: t('settings.sum_bank_expired', { bank }), tone: 'text-red-600' }
      if (!bankStatus.valid_until) return { text: bank }
      const date = new Date(`${bankStatus.valid_until}T00:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })
      return { text: t('settings.sum_bank_until', { bank, date }), tone: bankStatus.expires_soon ? 'text-amber-700' : '' }
    }
    if (id === 'spending') {
      return { text: `${t('settings.sum_categories', { count: categories.length })} · ${t('settings.sum_payment_methods', { count: paymentMethods.length })}` }
    }
    if (id === 'couple') {
      const s = config?.default_user1_share ?? 50
      const split = `${s}/${100 - s}`
      const partner = getMyUserKey?.() === 'user2' ? config?.user1_username : config?.user2_username
      return { text: partner ? t('settings.sum_couple', { name: partner, split }) : t('settings.sum_couple_alone', { split }) }
    }
    if (id === 'notifications') {
      if (!pushSupported) return { text: t('settings.sum_notif_unsupported') }
      if (!subscribed) return { text: t('settings.sum_notif_off') }
      const partner = getMyUserKey?.() === 'user2' ? config?.user1_username : config?.user2_username
      const kinds = notifKinds(partner)
      const on = kinds.filter(kind => config?.notif?.[kind] ?? true).length
      return { text: on === kinds.length ? t('settings.sum_notif_all') : t('settings.sum_notif_some', { on, total: kinds.length }) }
    }
    return { text: user?.displayName ?? user?.username ?? '' }
  }

  return (
    <div className="space-y-4">
      <nav aria-label={t('settings.nav_label')} className="bg-white rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-100">
        {SECTIONS.map(id => {
          const sum = summary(id)
          return (
            <Link key={id} to={`/settings/${id}`} aria-current={active === id ? 'page' : undefined}
              className={`flex items-center gap-3 px-4 py-3.5 transition active:bg-violet-50 ${active === id ? 'lg:bg-violet-50' : 'hover:bg-slate-50'}`}>
              <span className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={SECTION_ICONS[id]} />
                </svg>
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold text-slate-800">{t(`settings.nav_${id}`)}</span>
                <span className={`block text-xs leading-snug ${sum.tone || 'text-slate-500'}`}>{sum.text || '\u00a0'}</span>
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-300 shrink-0" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          )
        })}
      </nav>
      <button type="button" onClick={logout}
        className="w-full py-4 rounded-2xl bg-white text-red-500 font-semibold border border-red-100 active:bg-red-50 transition">
        {t('settings.btn_logout')}
      </button>
    </div>
  )
}
