import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function LandingPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [inviteInfo, setInviteInfo] = useState(null)

  useEffect(() => {
    const code = sessionStorage.getItem('invite_code')
    if (!code) return
    fetch(`/api/groups/invite-info/${code}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setInviteInfo(data) })
      .catch(() => {})
  }, [])

  const FEATURES = [
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      ),
      title: t('landing.feature_monthly_title'),
      desc: t('landing.feature_monthly_desc'),
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
        </svg>
      ),
      title: t('landing.feature_split_title'),
      desc: t('landing.feature_split_desc'),
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      ),
      title: t('landing.feature_recurring_title'),
      desc: t('landing.feature_recurring_desc'),
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
      ),
      title: t('landing.feature_notifications_title'),
      desc: t('landing.feature_notifications_desc'),
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
      title: t('landing.feature_history_title'),
      desc: t('landing.feature_history_desc'),
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3m-3 3h3m-6 3h.008v.008H6V15zm0 3h.008v.008H6V18z" />
        </svg>
      ),
      title: t('landing.feature_pwa_title'),
      desc: t('landing.feature_pwa_desc'),
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Hero */}
      <div className="bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-700 text-white">
        <div className="max-w-4xl mx-auto px-6 pt-16 pb-24 text-center">
          <div className="flex justify-center mb-6">
            <img src="/icons/icon-192.png" alt="CoWallet" className="w-20 h-20 rounded-3xl shadow-2xl shadow-violet-900/50" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold mb-4 tracking-tight">
            CoWallet
          </h1>
          <p className="text-xl lg:text-2xl text-violet-200 font-medium mb-3">
            {t('landing.tagline')}
          </p>
          <p className="text-violet-300 max-w-xl mx-auto mb-10">
            {t('landing.subtitle')}
          </p>
          {inviteInfo && (
            <div className="inline-flex items-center gap-3 bg-white/15 backdrop-blur-sm border border-white/30 rounded-2xl px-5 py-4 mb-6 text-left max-w-sm mx-auto">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-bold">
                {inviteInfo.inviter[0].toUpperCase()}
              </div>
              <div>
                <p className="text-white font-semibold text-sm">
                  {inviteInfo.group_name
                    ? t('landing.invite_message_group', { inviter: inviteInfo.inviter, group: inviteInfo.group_name })
                    : t('landing.invite_message', { inviter: inviteInfo.inviter })}
                </p>
                <p className="text-violet-200 text-xs mt-0.5">{t('landing.invite_hint')}</p>
              </div>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {inviteInfo ? (
              <button
                onClick={() => navigate('/register')}
                className="px-8 py-4 bg-white text-violet-700 font-bold rounded-2xl shadow-lg active:scale-95 transition text-lg"
              >
                {t('landing.cta_register_invite')}
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 bg-white text-violet-700 font-bold rounded-2xl shadow-lg active:scale-95 transition text-lg"
                >
                  {t('landing.cta_login')}
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="px-8 py-4 bg-white/15 text-white font-bold rounded-2xl border border-white/30 active:scale-95 transition text-lg backdrop-blur-sm"
                >
                  {t('landing.cta_register')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-slate-800 text-center mb-10">
          {t('landing.features_title')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="w-11 h-11 bg-violet-50 rounded-xl flex items-center justify-center text-violet-600 mb-3">
                {f.icon}
              </div>
              <h3 className="font-semibold text-slate-800 mb-1">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Privacy */}
      <div className="bg-violet-50 border-t border-violet-100">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
            <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl">
              🔒
            </div>
            <div>
              <h3 className="font-bold text-slate-800 mb-1">{t('landing.privacy_title')}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                {t('landing.privacy_desc')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-slate-100">
        <div className="max-w-4xl mx-auto px-6 py-6 text-center">
          <p className="text-xs text-slate-400">
            {t('landing.footer')}
          </p>
        </div>
      </div>

    </div>
  )
}
