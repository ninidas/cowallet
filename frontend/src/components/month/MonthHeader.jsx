import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// Header : sticky sur mobile : retour, mois précédent / suivant
export default function MonthHeader({ month, prevMonth, nextMonth }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <div className="sticky top-0 z-20 bg-gradient-to-r from-violet-600 to-indigo-600 safe-top px-4 pb-3 lg:pb-4">
      <div className="max-w-6xl mx-auto lg:px-6 flex items-center gap-2 sm:gap-3 lg:gap-4">
        {/* Retour */}
        <button
          onClick={() => navigate('/months')}
          className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center active:bg-white/30 transition shrink-0 lg:hidden"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>

        {/* Navigation mois */}
        <div className="flex-1 min-w-0 flex items-center justify-center lg:justify-start gap-1.5 sm:gap-2">
          <button
            onClick={() => prevMonth && navigate(`/months/${prevMonth.id}`)}
            disabled={!prevMonth}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center active:bg-white/30 transition disabled:opacity-30 shrink-0"
            aria-label={t('month_detail.aria_prev_month')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="text-base sm:text-xl font-bold text-white text-center whitespace-nowrap">{month.label}</h1>
          <button
            onClick={() => nextMonth && navigate(`/months/${nextMonth.id}`)}
            disabled={!nextMonth}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center active:bg-white/30 transition disabled:opacity-30 shrink-0"
            aria-label={t('month_detail.aria_next_month')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>

        {/* Pendant de la flèche retour : garde le mois centré sur téléphone */}
        <span className="w-10 shrink-0 lg:hidden" aria-hidden="true" />

      </div>
    </div>
  )
}
