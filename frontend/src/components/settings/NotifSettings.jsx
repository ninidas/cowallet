import { useTranslation } from 'react-i18next'
import { usePush } from '../../context/PushContext'
import Section from './Section'
import NotifRow from './NotifRow'

// Types de notifications, dans l'ordre du sommaire ; « ce que fait » le partenaire seulement s'il y en a un
export const notifKinds = partnerName => ['partner', 'bank', 'budget', 'reminder'].filter(kind => kind !== 'partner' || partnerName)

// Rubrique Notifications : l'appareil (abonnement push), puis les types voulus (valables partout)
export default function NotifSettings({ notif, partnerName, toggleNotif }) {
  const { t } = useTranslation()
  const { supported, permission, subscribed, loading, subscribe, unsubscribe } = usePush()
  return (
    <div id="settings-notifications" className="space-y-4 scroll-mt-4">
      <Section title={t('settings.section_this_device')}>
        {supported ? (
          <NotifRow label={t('settings.notif_device')} hint={t('settings.notif_device_hint')}
            on={subscribed} disabled={loading || permission === 'denied'}
            onToggle={subscribed ? unsubscribe : subscribe}>
            {permission === 'denied' && <p className="text-xs text-red-500 mt-1">{t('settings.notif_blocked')}</p>}
          </NotifRow>
        ) : (
          <p className="text-sm text-slate-600">{t('settings.notif_unsupported')}</p>
        )}
      </Section>

      <Section title={t('settings.section_notif_types')}>
        <p className="text-xs text-slate-500 -mt-1">{t('settings.notif_types_hint')}</p>
        {notifKinds(partnerName).map(kind => (
          <NotifRow key={kind}
            label={kind === 'partner' ? t('settings.notif_partner', { name: partnerName }) : t(`settings.notif_${kind}`)}
            hint={t(`settings.notif_${kind}_hint`)} on={notif[kind]} onToggle={() => toggleNotif(kind)} />
        ))}
      </Section>
    </div>
  )
}
