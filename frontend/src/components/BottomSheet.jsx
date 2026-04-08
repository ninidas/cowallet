import { useEffect } from 'react'

export default function BottomSheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sheet — bottom sur mobile, modale centrée sur desktop */}
      <div
        className={`fixed inset-0 z-50 flex items-end justify-center lg:items-center ${
          open ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
        onClick={onClose}
      >
        <div
          className={`w-full max-w-lg bg-white shadow-2xl transition-all duration-300
            rounded-t-3xl lg:rounded-3xl
            ${open
              ? 'translate-y-0 opacity-100 lg:scale-100'
              : 'translate-y-full opacity-0 lg:translate-y-0 lg:scale-95'
            }
          `}
          onClick={e => e.stopPropagation()}
        >
          {/* Handle mobile uniquement */}
          <div className="flex justify-center pt-3 pb-1 lg:hidden">
            <div className="w-10 h-1 bg-slate-200 rounded-full" />
          </div>

          {title && (
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">{title}</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 active:bg-slate-200 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-slate-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <div className="pt-4 overflow-y-auto max-h-[85dvh]">
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
