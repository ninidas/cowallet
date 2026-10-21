import { useTranslation } from 'react-i18next'
import { tError } from '../../utils/tError'
import Section from './Section'

const PRESET_COLORS = [
  '#3b82f6', '#f97316', '#10b981', '#a855f7',
  '#ef4444', '#06b6d4', '#ec4899', '#eab308',
  '#64748b', '#8b5cf6', '#14b8a6', '#f59e0b',
]

const PRESET_EMOJIS = [
  '🛒','🍽️','🥗','☕','🍕','🍺','🚗','⛽','🚌','🚲',
  '✈️','🅿️','🚆','🎬','🎵','📚','🎮','🏋️','🎨','🍷',
  '💊','🏥','🧴','💆','👶','🦷','💰','💳','🏦','📈',
  '🏠','🎁','🛍️','🧾','📦','🔧','🐾','🎓','💡','📱',
  '🖥️','🔑','🌍','🧽','💈','🏡','🎀','🚑','👗','🎪',
]

// Rubrique Dépenses : catégories et moyens de paiement
export default function SpendingSettings({
  armed, categories, newCatName, setNewCatName, newCatIcon, setNewCatIcon, newCatColor, setNewCatColor, catError,
  showEmojiPicker, setShowEmojiPicker, editingCatId, setEditingCatId, editingCatName, setEditingCatName,
  paymentMethods, newPmName, setNewPmName, pmError, editingPmId, setEditingPmId, editingPmName, setEditingPmName,
  handleAddCategory, handleDeleteCategory, handleRenameCategory,
  handleAddPaymentMethod, handleDeletePaymentMethod, handleRenamePaymentMethod,
}) {
  const { t } = useTranslation()
  return (
    <div id="settings-spending" className="space-y-4 scroll-mt-4">
    {/* Categories */}
    <Section title={t('settings.section_categories')}>
      <div className="space-y-2">
        {categories.map(cat => (
          <div key={cat.id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-slate-50">
            <span className="text-lg">{cat.icon}</span>
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
            {editingCatId === cat.id ? (
              <>
                <input
                  value={editingCatName}
                  onChange={e => setEditingCatName(e.target.value)}
                  onBlur={() => handleRenameCategory(cat.id)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRenameCategory(cat.id); if (e.key === 'Escape') setEditingCatId(null) }}
                  className="flex-1 px-2 py-1 text-sm rounded-lg border border-violet-300 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                  autoFocus
                />
              </>
            ) : (
              <span
                className="text-sm font-medium text-slate-700 flex-1 cursor-pointer hover:text-violet-600 transition"
                onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name) }}
              >{cat.name}</span>
            )}
            {armed === `cat-${cat.id}` ? (
              <button onClick={() => handleDeleteCategory(cat.id)}
                className="h-10 px-3 shrink-0 rounded-lg bg-red-500 text-white text-xs font-semibold">
                {t('settings.confirm_delete_short')}
              </button>
            ) : (
            <button onClick={() => handleDeleteCategory(cat.id)} aria-label={t('settings.confirm_delete_short')}
              className="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            )}
          </div>
        ))}
      </div>

      {catError && <p className="text-xs text-red-500">{tError(t, catError)}</p>}

      <form onSubmit={handleAddCategory} className="space-y-3 pt-4 border-t border-slate-100">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('settings.new_category')}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(v => !v)}
            className={`w-14 h-11 text-xl rounded-xl border flex items-center justify-center transition ${showEmojiPicker ? 'border-violet-400 ring-2 ring-violet-300 bg-violet-50' : 'border-slate-200 bg-slate-50'}`}
          >
            {newCatIcon}
          </button>
          <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
            className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder={t('settings.category_name_placeholder')} required />
        </div>
        {showEmojiPicker && (
          <div className="grid grid-cols-10 gap-1 p-3 bg-slate-50 rounded-xl border border-slate-200">
            {PRESET_EMOJIS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => { setNewCatIcon(e); setShowEmojiPicker(false) }}
                className={`h-9 text-xl rounded-lg flex items-center justify-center transition active:scale-95 ${newCatIcon === e ? 'bg-violet-100 ring-2 ring-violet-400' : 'hover:bg-slate-200'}`}
              >
                {e}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2 py-1">
          {PRESET_COLORS.map(c => (
            <button key={c} type="button" onClick={() => setNewCatColor(c)}
              className={`w-7 h-7 rounded-full transition ${newCatColor === c ? 'ring-2 ring-offset-2 ring-violet-500 scale-110' : ''}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
        <button type="submit"
          className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold active:scale-95 transition">
          {t('settings.btn_add')}
        </button>
      </form>
    </Section>

    {/* Payment methods */}
    <Section title={t('settings.section_payment_methods')}>
      <div className="space-y-2">
        {paymentMethods.map(pm => (
          <div key={pm.id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-slate-50">
            {editingPmId === pm.id ? (
              <input
                value={editingPmName}
                onChange={e => setEditingPmName(e.target.value)}
                onBlur={() => handleRenamePaymentMethod(pm.id)}
                onKeyDown={e => { if (e.key === 'Enter') handleRenamePaymentMethod(pm.id); if (e.key === 'Escape') setEditingPmId(null) }}
                className="flex-1 px-2 py-1 text-sm rounded-lg border border-violet-300 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                autoFocus
              />
            ) : (
              <span
                className="text-sm font-medium text-slate-700 flex-1 cursor-pointer hover:text-violet-600 transition"
                onClick={() => { setEditingPmId(pm.id); setEditingPmName(pm.name) }}
              >{pm.name}</span>
            )}
            {armed === `pm-${pm.id}` ? (
              <button onClick={() => handleDeletePaymentMethod(pm.id)}
                className="h-10 px-3 shrink-0 rounded-lg bg-red-500 text-white text-xs font-semibold">
                {t('settings.confirm_delete_short')}
              </button>
            ) : (
            <button onClick={() => handleDeletePaymentMethod(pm.id)} aria-label={t('settings.confirm_delete_short')}
              className="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            )}
          </div>
        ))}
      </div>

      {pmError && <p className="text-xs text-red-500">{tError(t, pmError)}</p>}

      <form onSubmit={handleAddPaymentMethod} className="flex gap-2 pt-2 border-t border-slate-100">
        <input value={newPmName} onChange={e => setNewPmName(e.target.value)}
          className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
          placeholder={t('settings.payment_method_placeholder')} required />
        <button type="submit"
          className="px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold active:scale-95 transition">
          {t('settings.btn_add')}
        </button>
      </form>
    </Section>

    </div>
  )
}
