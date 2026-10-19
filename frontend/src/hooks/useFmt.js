import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

export function useFmt({ maximumFractionDigits } = {}) {
  const { config } = useAuth()
  const { i18n } = useTranslation()
  const currency = config?.currency || 'EUR'
  // Montants au format de la langue de l'app (« 1 323,33 € »), pas de celle du téléphone
  const locale = (i18n.resolvedLanguage || i18n.language || 'fr').startsWith('en') ? 'en-GB' : 'fr-FR'
  return (n) => new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: maximumFractionDigits ?? (currency === 'JPY' ? 0 : 2),
  }).format(n)
}
