import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    href: string
    onClick?: () => void
  }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-900/30 dark:to-accent-900/30 flex items-center justify-center mb-4 shadow-soft">
        {icon}
      </div>
      <h3 className="font-bold text-lg text-gray-700 dark:text-gray-200 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs">{description}</p>
      )}
      {action && (
        // 应用内路由必须走 Link：原生 <a href> 会丢掉 basename（/web_vocabulary）导致 404
        <Link
          to={action.href}
          onClick={action.onClick}
          className="btn-primary mt-5 inline-flex items-center gap-1.5"
        >
          {action.label}
        </Link>
      )}
    </motion.div>
  )
}
