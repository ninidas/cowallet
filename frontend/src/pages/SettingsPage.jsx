import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { tError } from '../utils/tError'
import { useArm } from '../hooks/useArm'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { SECTIONS } from '../components/settings/sections'
import { useSettingsForm } from '../components/settings/useSettingsForm'
import { useMeSettings } from '../components/settings/useMeSettings'
import { useNotifSettings } from '../components/settings/useNotifSettings'
import { useSpendingSettings } from '../components/settings/useSpendingSettings'
import { useBankSettings } from '../components/settings/useBankSettings'
import SettingsNav from '../components/settings/SettingsNav'
import BankSettings from '../components/settings/BankSettings'
import SpendingSettings from '../components/settings/SpendingSettings'
import CoupleSettings from '../components/settings/CoupleSettings'
import NotifSettings from '../components/settings/NotifSettings'
import MeSettings from '../components/settings/MeSettings'
import BankPickerModal from '../components/settings/BankPickerModal'

// Rubriques des réglages : un sommaire, puis une page par rubrique (/settings/bank…).
// L'état de chaque rubrique vit ici (hooks use…Settings) : changer de rubrique ne perd rien.
export default function SettingsPage() {
  const { t } = useTranslation()
  const navigate   = useNavigate()
  const { section: sectionParam } = useParams()
  const isDesktop = useIsDesktop()
  const section   = SECTIONS.includes(sectionParam) ? sectionParam : null
  const active    = section ?? (isDesktop ? 'bank' : null)
  const [success, setSuccess] = useState('')
  // Suppressions et déconnexion de la banque en deux touches, comme dans le Budget
  const [armed, confirmArm] = useArm()
  const [error,   setError]   = useState('')

  const form = useSettingsForm({ setError, setSuccess })
  const { saving, hasChanges, handleSave } = form
  const me = useMeSettings()
  const notifs = useNotifSettings()

  useEffect(() => { window.scrollTo(0, 0) }, [section])

  const spending = useSpendingSettings({ confirmArm })
  const bank     = useBankSettings({ setError, confirmArm })

  return (
    <div className="min-h-screen bg-slate-50 pb-safe page-enter">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 safe-top px-4 pb-10 lg:pb-12">
        <div className="max-w-6xl mx-auto lg:px-6 flex items-center gap-3">
          <button
            onClick={() => navigate(section ? '/settings' : '/months')}
            aria-label={t('settings.aria_back')}
            className="lg:hidden w-10 h-10 rounded-full bg-white/20 flex items-center justify-center active:bg-white/30 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-white">
            {section && !isDesktop ? t(`settings.nav_${section}`) : t('settings.title')}
          </h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 lg:px-6 -mt-5 lg:-mt-8 lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-6 lg:items-start space-y-4 lg:space-y-0">

        {/* Sommaire */}
        {(isDesktop || !active) && (
          <SettingsNav active={active} bankStatus={bank.bankStatus} categories={spending.categories} paymentMethods={spending.paymentMethods} />
        )}

        {/* Rubrique ouverte */}
        {active && (
        <div className="space-y-4 min-w-0">
          {active === 'bank' && (
            <BankSettings {...bank} armed={armed} />
          )}
          {active === 'spending' && (
            <SpendingSettings {...spending} armed={armed} />
          )}
          {active === 'couple' && (
            <CoupleSettings {...form} setSuccess={setSuccess} setError={setError} />
          )}
          {active === 'notifications' && (
            <NotifSettings {...notifs} />
          )}
          {active === 'me' && (
            <MeSettings {...form} {...me} />
          )}
        </div>
        )}
      </div>

      <div className="h-8" />

      {/* Bank picker modal */}
      {bank.showBankPicker && (
        <BankPickerModal {...bank} setError={setError} />
      )}

      {error   && <div role="alert" onClick={() => setError('')} className="fixed left-4 right-4 above-nav z-40 shadow-lg bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{tError(t, error)}</div>}
      {success && <div role="status" className="fixed left-4 right-4 above-nav z-40 shadow-lg bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-xl">{success}</div>}


      {/* Sticky save bar */}
      <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} className={`fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-xl transition-all duration-300 ${hasChanges ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
        <div className="px-4 py-3 flex items-center gap-3 max-w-6xl mx-auto">
          <p className="text-sm text-slate-500 flex-1">{t('settings.unsaved_changes')}</p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-2xl bg-violet-600 text-white font-semibold text-sm shadow-lg shadow-violet-200 active:scale-95 transition disabled:opacity-60"
          >
            {saving ? t('settings.btn_saving') : t('settings.btn_save')}
          </button>
        </div>
      </div>
    </div>
  )
}
