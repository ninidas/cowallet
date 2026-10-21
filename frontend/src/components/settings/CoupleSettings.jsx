import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import Section from './Section'
import Field from './Field'
import Input from './Input'

// Rubrique Couple : répartition par défaut, invitation, nom du groupe et devise
export default function CoupleSettings({ share, setShare, groupName, setGroupName, currency, setCurrency, handleSave, setSuccess }) {
  const { t } = useTranslation()
  const { config } = useAuth()
  return (
    <div id="settings-couple" className="space-y-4 scroll-mt-4">
    <form onSubmit={handleSave}>
        <Section title={t('settings.section_split')}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600">{config?.user1_username ?? 'User 1'}</span>
            <span className="text-sm font-bold text-violet-600">{share} / {100 - share}</span>
            <span className="text-sm text-slate-600">{config?.user2_username ?? 'User 2'}</span>
          </div>
          <input type="range" min={1} max={99} value={share} onChange={e => setShare(Number(e.target.value))} className="w-full accent-violet-600" />
          <div className="flex justify-center gap-2 mt-3 flex-wrap">
            {[50, 60, 70].map(v => (
              <button key={v} type="button" onClick={() => setShare(v)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition ${share === v ? 'bg-violet-600 text-white border-violet-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                {v}/{100 - v}
              </button>
            ))}
          </div>
        </Section>

    </form>
    {config?.invite_code && (
      <Section title={t('settings.section_invite')}>
        <p className="text-sm text-slate-500">{t('settings.invite_hint')}</p>
        <div className="flex gap-2 mt-2">
          <div className="flex-1 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 font-mono truncate">
            {`${window.location.origin}/invite/${config.invite_code}`}
          </div>
          <button
            type="button"
            onClick={async () => {
              const url = `${window.location.origin}/invite/${config.invite_code}`
              if (navigator.share) {
                await navigator.share({ title: 'CoWallet', text: t('settings.invite_text'), url })
              } else {
                await navigator.clipboard.writeText(url)
                setSuccess(t('settings.invite_copied'))
                setTimeout(() => setSuccess(''), 3000)
              }
            }}
            className="px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold active:scale-95 transition shrink-0"
          >
            {t('settings.invite_share')}
          </button>
        </div>
      </Section>
    )}

    <form onSubmit={handleSave}>
      <Section title={t('settings.section_group')}>
        <Field label={t('settings.field_group_name')}>
          <Input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder={t('settings.group_name_placeholder')} maxLength={40} />
        </Field>
        <p className="text-xs text-slate-400">{t('settings.group_name_hint')}</p>
        <Field label={t('settings.field_currency')}>
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          >
            {['EUR','USD','GBP','CHF','CAD','AUD','JPY','SEK','NOK','DKK','PLN','CZK'].map(code => {
              const symbol = new Intl.NumberFormat(navigator.language, { style: 'currency', currency: code })
                .formatToParts(0).find(p => p.type === 'currency')?.value || code
              return <option key={code} value={code}>{code} ({symbol})</option>
            })}
          </select>
        </Field>
      </Section>
    </form>
    </div>
  )
}
