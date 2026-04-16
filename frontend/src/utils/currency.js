const LOCALE_CURRENCY = {
  'en-US': 'USD',
  'en-CA': 'CAD',
  'en-AU': 'AUD',
  'en-NZ': 'NZD',
  'en-GB': 'GBP',
  'en-IE': 'EUR',
  'en-SG': 'SGD',
  'en-IN': 'INR',
  'fr-FR': 'EUR',
  'fr-BE': 'EUR',
  'fr-CH': 'CHF',
  'fr-CA': 'CAD',
  'de-DE': 'EUR',
  'de-AT': 'EUR',
  'de-CH': 'CHF',
  'es-ES': 'EUR',
  'it-IT': 'EUR',
  'pt-PT': 'EUR',
  'pt-BR': 'BRL',
  'nl-NL': 'EUR',
  'nl-BE': 'EUR',
  'pl-PL': 'PLN',
  'cs-CZ': 'CZK',
  'hu-HU': 'HUF',
  'ro-RO': 'RON',
  'sv-SE': 'SEK',
  'no-NO': 'NOK',
  'nb-NO': 'NOK',
  'da-DK': 'DKK',
  'fi-FI': 'EUR',
  'ja-JP': 'JPY',
}

export function getDefaultCurrency() {
  const locale = navigator.language || 'en'
  if (LOCALE_CURRENCY[locale]) return LOCALE_CURRENCY[locale]
  // Fallback sur la langue seule (ex: 'fr' → EUR)
  const lang = locale.split('-')[0]
  const fallbacks = { fr: 'EUR', de: 'EUR', es: 'EUR', it: 'EUR', pt: 'EUR', nl: 'EUR', en: 'USD' }
  return fallbacks[lang] || 'EUR'
}
