import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BookOpen, Home, Heart, FolderOpen, Target, BarChart3, Languages, Monitor, Smartphone, SlidersHorizontal } from 'lucide-react'
import { useScrollRestoration } from '../hooks/useScrollRestoration'

export type LayoutMode = 'auto' | 'mobile' | 'pc'

const LAYOUT_MODE_KEY = 'vocab.layout-mode'

function loadLayoutMode(): LayoutMode {
  try {
    const mode = localStorage.getItem(LAYOUT_MODE_KEY)
    return mode === 'mobile' || mode === 'pc' ? mode : 'auto'
  } catch {
    return 'auto'
  }
}

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  useScrollRestoration()
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(loadLayoutMode)
  const [isWide, setIsWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024)
  const [showLayoutMenu, setShowLayoutMenu] = useState(false)
  const useDesktopLayout = layoutMode === 'pc' || (layoutMode === 'auto' && isWide)

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const update = () => setIsWide(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  function changeLayoutMode(mode: LayoutMode) {
    setLayoutMode(mode)
    setShowLayoutMenu(false)
    try {
      localStorage.setItem(LAYOUT_MODE_KEY, mode)
    } catch {
      // 布局偏好无法持久化时不影响当前页面。
    }
  }

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
    <div className={`layout-shell min-h-screen flex flex-col bg-[var(--bg)] dark:bg-[#10221f] ${useDesktopLayout ? 'layout-pc-mode' : 'layout-mobile-mode'}`}>

      <div className={`${useDesktopLayout ? 'flex' : 'hidden'} fixed inset-y-0 left-0 w-64 flex-col border-r border-[var(--line)] bg-[#f1f4ed]/90 dark:bg-[#122a26]/90 px-6 py-8 z-40`}>
        <Link to="/" className="flex items-center gap-3 mb-12">
          <span className="w-10 h-10 rounded-2xl bg-[#1f5147] text-white flex items-center justify-center shadow-lg"><Languages size={20} /></span>
          <span className="font-bold tracking-tight text-lg text-[#19352f] dark:text-white">词汇簿</span>
        </Link>
        <nav className="space-y-2" aria-label="桌面主导航">
          {navItems.map((item) => {
            const active = isActive(item.path)
            return <Link key={item.path} to={item.path} aria-current={active ? 'page' : undefined} className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${active ? 'bg-[#dce9df] text-[#1f5147] dark:bg-[#21473e] dark:text-[#d7eee0]' : 'text-[#72817b] hover:bg-white/70 dark:text-[#a2b6ad] dark:hover:bg-[#193a33]'}`}><item.icon size={18} />{item.label}</Link>
          })}
        </nav>
        <Link to="/stats" className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-[#72817b] hover:bg-white/70 dark:text-[#a2b6ad]"><BarChart3 size={18} />学习统计</Link>
        <LayoutModeControl mode={layoutMode} open={showLayoutMenu} onToggle={() => setShowLayoutMenu((open) => !open)} onChange={changeLayoutMode} desktop />
      </div>

      {/* 不用 key={pathname} 包裹：避免同组件路由变化(如 /word/1 → /word/2)时整页重挂、状态丢失 */}
      <main className={`flex-1 animate-fade-in ${useDesktopLayout ? 'pb-8 pl-64' : 'pb-24'}`}>
        <div className="layout-viewport">{children}</div>
      </main>

      <nav aria-label="主导航" className={`${useDesktopLayout ? 'hidden' : 'flex'} fixed bottom-0 left-0 right-0 z-50 pointer-events-none`}>
        <div className="w-full max-w-md mx-auto pb-[calc(0.75rem+env(safe-area-inset-bottom))] pointer-events-auto">
          <div className="bg-[#f7faf5]/90 dark:bg-slate-800/90 backdrop-blur-xl border border-[var(--line)] shadow-card rounded-2xl">
            <div className="flex justify-around py-1.5">
              {navItems.map((item) => {
                const active = isActive(item.path)
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    aria-current={active ? 'page' : undefined}
                    className="flex flex-col items-center px-1.5 py-1 rounded-xl transition-all"
                  >
                    <div
                      className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all ${
                        active
                          ? 'bg-gradient-primary text-white shadow-glow'
                          : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-gray-300'
                      }`}
                    >
                      <item.icon size={21} />
                    </div>
                    <span
                      className={`text-xs mt-0.5 transition-colors ${
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

      {!useDesktopLayout && location.pathname === '/' && (
        <div className="fixed top-5 right-4 z-40">
          <LayoutModeControl mode={layoutMode} open={showLayoutMenu} onToggle={() => setShowLayoutMenu((open) => !open)} onChange={changeLayoutMode} />
        </div>
      )}
    </div>
  )
}

function LayoutModeControl({ mode, open, onToggle, onChange, desktop = false }: { mode: LayoutMode; open: boolean; onToggle: () => void; onChange: (mode: LayoutMode) => void; desktop?: boolean }) {
  return (
    <div className={`relative ${desktop ? 'mt-4' : ''}`}>
      <button type="button" onClick={onToggle} aria-label="布局模式" className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-[#72817b] hover:bg-white/70 dark:text-[#a2b6ad] dark:hover:bg-[#193a33]">
        <SlidersHorizontal size={17} />
        <span>布局：{mode === 'auto' ? '自动' : mode === 'mobile' ? '移动端' : 'PC'}</span>
      </button>
      {open && (
        <div className={`absolute ${desktop ? 'bottom-full mb-2 left-0' : 'top-full mt-2 right-0'} w-44 rounded-2xl border border-[var(--line)] bg-white dark:bg-[#18332e] p-1.5 shadow-xl`}>
          <LayoutOption icon={<SlidersHorizontal size={16} />} label="自动适配" active={mode === 'auto'} onClick={() => onChange('auto')} />
          <LayoutOption icon={<Smartphone size={16} />} label="移动端模式" active={mode === 'mobile'} onClick={() => onChange('mobile')} />
          <LayoutOption icon={<Monitor size={16} />} label="PC 模式" active={mode === 'pc'} onClick={() => onChange('pc')} />
        </div>
      )}
    </div>
  )
}

function LayoutOption({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm text-left ${active ? 'bg-[#dce9df] text-[#1f5147] dark:bg-[#21473e] dark:text-[#d7eee0]' : 'text-[#72817b] hover:bg-[#f1f4ed] dark:text-[#a2b6ad] dark:hover:bg-[#193a33]'}`}>{icon}{label}</button>
}
