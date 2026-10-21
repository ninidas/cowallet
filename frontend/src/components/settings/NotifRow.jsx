// Une ligne de réglage avec interrupteur
export default function NotifRow({ label, hint, on, disabled, onToggle, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
        {children}
      </div>
      <button type="button" role="switch" aria-checked={!!on} aria-label={label} onClick={onToggle} disabled={disabled}
        className={`hit relative w-12 h-6 rounded-full shrink-0 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-50 ${on ? 'bg-violet-600' : 'bg-slate-200'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${on ? 'translate-x-6' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}
