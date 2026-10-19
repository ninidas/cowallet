import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './en.json'
import fr from './fr.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    // Français par défaut (et non la langue de l'iPhone) ; l'anglais reste au choix dans les réglages
    fallbackLng: 'fr',
    supportedLngs: ['en', 'fr'],
    detection: {
      order: ['localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: 'cowallet_lang',
    },
    interpolation: { escapeValue: false },
  })

export default i18n
