export const CATEGORIES = {
  Maison:         { bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500',    icon: '🏠' },
  Voiture:        { bg: 'bg-orange-100',  text: 'text-orange-700',  dot: 'bg-orange-500',  icon: '🚗' },
  Alimentation:   { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', icon: '🛒' },
  Divertissement: { bg: 'bg-purple-100',  text: 'text-purple-700',  dot: 'bg-purple-500',  icon: '🎉' },
  Projet:         { bg: 'bg-rose-100',    text: 'text-rose-700',    dot: 'bg-rose-500',    icon: '🎯' },
  Voyage:         { bg: 'bg-sky-100',     text: 'text-sky-700',     dot: 'bg-sky-500',     icon: '✈️' },
}

export const CATEGORY_NAMES = Object.keys(CATEGORIES)

export const PAYMENT_TYPES = ['Prélèvement', 'Carte', 'Virement Manuel', 'PayPal']

export function getMonthNames(lang = 'en') {
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'
  const names = ['']
  for (let m = 1; m <= 12; m++) {
    names.push(new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2024, m - 1, 1)))
  }
  return names
}

// Keep for backwards compat
export const MONTH_NAMES = getMonthNames('fr')
