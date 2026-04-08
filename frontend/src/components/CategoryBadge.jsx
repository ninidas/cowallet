export default function CategoryBadge({ category, icon, color }) {
  if (!category) return null
  const bg  = color ? color + '20' : '#94a3b820'
  const txt = color ?? '#94a3b8'
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: bg, color: txt }}
    >
      {icon && <span>{icon}</span>}
      {category}
    </span>
  )
}
