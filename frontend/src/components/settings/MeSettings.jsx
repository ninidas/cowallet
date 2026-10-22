import { useTranslation } from 'react-i18next'
import { tError } from '../../utils/tError'
import Section from './Section'
import Field from './Field'
import Input from './Input'

// Rubrique Profil : prénom et carte, mot de passe, langue, suppression du compte
export default function MeSettings({
  username, setUsername, cards, setCards, currentPassword, setCurrentPassword, newPassword, setNewPassword,
  showPassword, setShowPassword, handleSave,
  showDeleteConfirm, setShowDeleteConfirm, deletePassword, setDeletePassword, deleteError, setDeleteError, deleting, handleDeleteAccount,
}) {
  const { t, i18n } = useTranslation()
  return (
    <div id="settings-me" className="space-y-4 scroll-mt-4">
    <form onSubmit={handleSave}>
      <Section title={t('settings.section_account')}>
        <Field label={t('settings.field_display_name')}>
          <Input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder={t('settings.username_placeholder')} required />
        </Field>
        <Field label={t('settings.field_cards')}>
          <Input type="text" inputMode="numeric" value={cards} onChange={e => setCards(e.target.value.replace(/[^\d, ]/g, ''))} placeholder="1234" maxLength={24} autoComplete="off" />
        </Field>
        <p className="text-xs text-slate-500 -mt-2">{t('settings.cards_hint')}</p>
      </Section>

    </form>
    <form onSubmit={handleSave}>
      <Section title={t('settings.section_password')}>
        {!showPassword ? (
          <button type="button" onClick={() => setShowPassword(true)}
            className="w-full py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 active:bg-slate-50 transition">
            {t('settings.btn_change_password')}
          </button>
        ) : (<>
        <Field label={t('settings.field_current_password')}>
          <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
        </Field>
        <Field label={t('settings.field_new_password')}>
          <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
        </Field>
        </>)}
      </Section>
    </form>
    {/* Language */}
    <Section title={t('settings.section_language')}>
      <div className="flex gap-2">
        {['en', 'fr'].map(lang => (
          <button
            key={lang}
            onClick={() => i18n.changeLanguage(lang)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition ${i18n.language === lang || (lang === 'en' && !['fr'].includes(i18n.language)) ? 'bg-violet-600 text-white border-violet-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
          >
            {t(`settings.lang_${lang}`)}
          </button>
        ))}
      </div>
    </Section>

    {/* Supprimer le compte : en bas de « Mon compte » */}
    <div className="space-y-2 pt-2">
    {!showDeleteConfirm ? (
      <button type="button" onClick={() => setShowDeleteConfirm(true)}
        className="w-full py-3 text-sm text-slate-400 hover:text-red-400 transition">
        {t('settings.btn_delete_account')}
      </button>
    ) : (
      <div className="bg-red-50 rounded-2xl p-4 space-y-3">
        <p className="text-sm font-semibold text-red-600">{t('settings.delete_confirm_title')}</p>
        <p className="text-xs text-red-400">{t('settings.delete_confirm_hint')}</p>
        <input
          type="password"
          value={deletePassword}
          onChange={e => setDeletePassword(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-red-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm"
          placeholder={t('settings.delete_password_placeholder')}
        />
        {deleteError && <p className="text-xs text-red-600">{tError(t, deleteError)}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteError('') }}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 bg-white active:bg-slate-50 transition">
            {t('settings.btn_cancel')}
          </button>
          <button type="button" onClick={handleDeleteAccount} disabled={deleting || !deletePassword}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold active:scale-95 transition disabled:opacity-60">
            {deleting ? t('settings.btn_deleting') : t('settings.btn_confirm_delete')}
          </button>
        </div>
      </div>
    )}
    </div>
    </div>
  )
}
