import { Link, useLocation } from 'react-router-dom'
import { BookOpen, Home, Heart, FolderOpen, Target } from 'lucide-react'

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

      {/* 不用 key={pathname} 包裹：避免同组件路由变化(如 /word/1 → /word/2)时整页重挂、状态丢失 */}
      <main className="flex-1 pb-24 animate-fade-in">{children}</main>

      <nav aria-label="主导航" className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
        <div className="max-w-md mx-auto px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pointer-events-auto">
          <div className="bg-white/80 dark:bg-slate-800/90 backdrop-blur-xl border border-gray-200/50 dark:border-slate-700/50 shadow-card rounded-2xl">
            <div className="flex justify-around py-1.5">
              {navItems.map((item) => {
                const active = isActive(item.path)
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    aria-current={active ? 'page' : undefined}
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
