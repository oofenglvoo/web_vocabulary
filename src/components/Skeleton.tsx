import { motion } from 'framer-motion'

interface SkeletonProps {
  className?: string
}

export function SkeletonCard({ className = '' }: SkeletonProps) {
  return (
    <div className={`card p-4 animate-pulse ${className}`}>
      <div className="flex items-center gap-3">
        <div className="h-5 w-24 bg-gray-200 dark:bg-slate-700 rounded-lg" />
        <div className="h-4 w-16 bg-gray-200 dark:bg-slate-700 rounded" />
      </div>
      <div className="mt-2 h-4 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
      <div className="mt-1 h-3 w-20 bg-gray-200 dark:bg-slate-700 rounded" />
      <div className="flex items-center gap-1.5 mt-2">
        <div className="h-5 w-12 bg-gray-200 dark:bg-slate-700 rounded-full" />
        <div className="h-3 w-10 bg-gray-200 dark:bg-slate-700 rounded" />
      </div>
    </div>
  )
}

export function SkeletonStat({ className = '' }: SkeletonProps) {
  return (
    <div className={`rounded-2xl p-4 bg-white border border-gray-100/80 dark:bg-slate-800/90 dark:border-slate-700/60 animate-pulse ${className}`}>
      <div className="h-7 w-12 bg-gray-200 dark:bg-slate-700 rounded mb-1" />
      <div className="h-3 w-16 bg-gray-200 dark:bg-slate-700 rounded" />
    </div>
  )
}

export function SkeletonList({ count = 5, className = '' }: { count?: number } & SkeletonProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.2 }}
        >
          <SkeletonCard />
        </motion.div>
      ))}
    </div>
  )
}

export function SkeletonRow({ className = '' }: SkeletonProps) {
  return (
    <div className={`flex items-center gap-3 py-2 animate-pulse ${className}`}>
      <div className="h-4 w-20 bg-gray-200 dark:bg-slate-700 rounded" />
      <div className="flex-1 h-4 bg-gray-200 dark:bg-slate-700 rounded" />
    </div>
  )
}
