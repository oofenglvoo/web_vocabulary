interface StatCardProps {
  title: string
  value: string | number
  icon?: React.ReactNode
  color?: string
  gradient?: boolean
}

export function StatCard({
  title,
  value,
  icon,
  color = 'text-primary-600',
  gradient = false,
}: StatCardProps) {
  if (gradient) {
    return (
      <div className="rounded-2xl p-4 bg-gradient-primary text-white shadow-card relative overflow-hidden">
        <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/10" />
        <div className="absolute -bottom-6 -left-2 w-16 h-16 rounded-full bg-white/10" />
        <div className="relative">
          {icon && <div className="mb-1.5 opacity-90">{icon}</div>}
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs opacity-80 mt-0.5">{title}</div>
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-2xl p-4 bg-white border border-gray-100/80 shadow-soft dark:bg-slate-800/90 dark:border-slate-700/60">
      {icon && <div className={`mb-1.5 ${color}`}>{icon}</div>}
      <div className={`text-2xl font-bold text-gradient`}>{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{title}</div>
    </div>
  )
}
