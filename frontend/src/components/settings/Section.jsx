// Une carte de réglages : titre en capitales, puis son contenu
export default function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-50">
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  )
}
