import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, Home, Heart, FolderOpen, Target } from 'lucide-react'

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
}

const pageTransition = {
  type: 'tween' as const,
  ease: 'easeOut' as const,
  duration: 0.2,
}

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const navItems = [
    { path: '/', icon: Home, label: '首页' },
    { path: '/words', icon: BookOpen, label: '单词' },
    { path: '/plan', icon: Target, label: '计划' },
    { path: '/favorites', icon: Heart, label: '收藏' },
    { path: '/categories', icon: FolderOpen, label: '分类' },
  ]

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-gray-50/80 dark:bg-slate-900">
      {/* 顶部渐变装饰条 */}
      <div className="top-accent-bar" />

      <main className="flex-1 pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
        <div className="max-w-md mx-auto px-3 pb-3 pointer-events-auto">
          <div className="bg-white/80 dark:bg-slate-800/90 backdrop-blur-xl border border-gray-200/50 dark:border-slate-700/50 shadow-card rounded-2xl">
            <div className="flex justify-around py-1.5">
              {navItems.map((item) => {
                const active = isActive(item.path)
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="flex flex-col items-center px-2.5 py-1.5 rounded-xl transition-all"
                  >
                    <div
                      className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all ${
                        active
                          ? 'bg-gradient-primary text-white shadow-glow'
                          : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-gray-300'
                      }`}
                    >
                      <item.icon size={18} />
                    </div>
                    <span
                      className={`text-[10px] mt-0.5 transition-colors ${
                        active ? 'text-primary-600 dark:text-primary-400 font-medium' : 'text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      {item.label}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </nav>
    </div>
  )
}
