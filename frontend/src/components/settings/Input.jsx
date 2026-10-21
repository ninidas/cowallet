export default function Input({ ...props }) {
  return (
    <input
      className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
      {...props}
    />
  )
}
