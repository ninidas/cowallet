export default function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
