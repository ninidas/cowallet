import { useAuth } from '../context/AuthContext'

export function useFmt({ maximumFractionDigits } = {}) {
  const { config } = useAuth()
  const currency = config?.currency || 'EUR'
  const locale = navigator.language || 'en'
  return (n) => new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: maximumFractionDigits ?? (currency === 'JPY' ? 0 : 2),
  }).format(n)
}
