import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Section from './Section'

// Rubrique Banque : connexion, échéance de l'accès, comptes suivis, déconnexion
export default function BankSettings({ bankStatus, bankConnecting, bankDisconnecting, armed, openBankPicker, handleBankDisconnect, handleToggleAccount }) {
  const { t, i18n } = useTranslation()
  const [searchParams]    = useSearchParams()

  // Échéance de l'accès bancaire (« 2027-04-16 » → « 16 avril 2027 »)
  const fmtBankDate = iso => new Date(`${iso}T00:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div id="settings-bank" className="space-y-4 scroll-mt-4">
      {/* Bank connection */}
      <Section title={t('settings.section_bank')}>
          {!bankStatus && <p className="text-sm text-slate-400 py-2">{t('settings.bank_loading')}</p>}
          {bankStatus && !bankStatus.configured && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 text-amber-800 text-sm px-4 py-3 rounded-xl">
              <span className="text-lg shrink-0">⚙️</span>
              <div>
                <p className="font-semibold">{t('settings.bank_not_configured')}</p>
                <p className="text-xs text-amber-600 mt-0.5">{t('settings.bank_not_configured_hint')}</p>
              </div>
            </div>
          )}
          {(!bankStatus || bankStatus.configured) && searchParams.get('bank') === 'connected' && (
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 text-sm font-medium px-4 py-3 rounded-xl">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
                <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
              </svg>
              {t('settings.bank_connected_success')}
            </div>
          )}

          {bankStatus?.configured && !bankStatus.connected ? (
            <div>
              <p className="text-sm text-slate-500 mb-4">
                {t('settings.bank_connect_hint')}
              </p>
              <button
                onClick={openBankPicker}
                disabled={bankConnecting}
                className="w-full py-3 rounded-2xl bg-violet-600 text-white font-semibold active:bg-violet-700 transition disabled:opacity-60"
              >
                {bankConnecting ? t('settings.btn_connecting') : t('settings.btn_connect_bank')}
              </button>
            </div>
          ) : bankStatus?.configured ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 py-2">
                <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center text-xl shrink-0">
                  🏦
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{bankStatus.provider_name}</p>
                  {bankStatus.no_accounts ? (
                    <p className="text-xs text-red-500 font-medium">{t('settings.bank_no_accounts')}</p>
                  ) : bankStatus.expired ? (
                    <p className="text-xs text-red-500 font-medium">
                      {bankStatus.valid_until ? t('settings.bank_expired_on', { date: fmtBankDate(bankStatus.valid_until) }) : t('settings.bank_expired')}
                    </p>
                  ) : bankStatus.expires_soon ? (
                    <p className="text-xs text-amber-600 font-medium">{t('settings.bank_expires_on', { date: fmtBankDate(bankStatus.valid_until) })}</p>
                  ) : (
                    <p className="text-xs text-emerald-600 font-medium">
                      {bankStatus.valid_until ? t('settings.bank_connected_until', { date: fmtBankDate(bankStatus.valid_until) }) : t('settings.bank_connected_label')}
                    </p>
                  )}
                </div>
              </div>

              {(bankStatus.no_accounts || bankStatus.expired || bankStatus.expires_soon) ? (
                <div>
                  <p className="text-sm text-slate-500 mb-3">
                    {t(bankStatus.no_accounts ? 'settings.bank_no_accounts_hint' : bankStatus.expired ? 'settings.bank_expired_hint' : 'settings.bank_expires_hint')}
                  </p>
                  <button
                    onClick={openBankPicker}
                    disabled={bankConnecting}
                    className="w-full py-3 rounded-2xl bg-violet-600 text-white font-semibold active:bg-violet-700 transition disabled:opacity-60"
                  >
                    {bankConnecting ? t('settings.btn_connecting') : t('settings.btn_reconnect_bank')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={openBankPicker}
                  disabled={bankConnecting}
                  className="w-full py-3 rounded-2xl border border-violet-200 text-violet-600 font-semibold active:bg-violet-50 transition disabled:opacity-60"
                >
                  {bankConnecting ? t('settings.btn_connecting') : t('settings.btn_reconnect_bank')}
                </button>
              )}

              {bankStatus.accounts?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('settings.bank_accounts')}</p>
                  {bankStatus.accounts.map(acc => (
                    <div key={acc.id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-slate-50">
                      <span className="text-sm font-medium text-slate-700 flex-1 truncate">{acc.name}</span>
                      <span className="text-xs text-slate-400">{acc.nature}</span>
                      <button
                        onClick={() => handleToggleAccount(acc.id)}
                        className={`relative w-10 h-6 rounded-full transition-colors ${acc.enabled ? 'bg-violet-600' : 'bg-slate-200'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${acc.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleBankDisconnect}
                disabled={bankDisconnecting}
                className={`w-full py-2.5 rounded-2xl border text-sm font-medium transition disabled:opacity-60 ${armed === 'bank' ? 'bg-red-500 border-red-500 text-white' : 'border-red-100 text-red-500 active:bg-red-50'}`}
              >
                {bankDisconnecting ? t('settings.btn_disconnecting') : armed === 'bank' ? t('settings.confirm_disconnect_bank') : t('settings.btn_disconnect_bank')}
              </button>
            </div>
          ) : null}
        </Section>

    </div>
  )
}
