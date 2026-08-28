import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * SPA 滚动位置管理（挂载在 Layout，全应用生效）：
 * - 持续把当前路由（location.key）的滚动位置记录到 sessionStorage
 * - PUSH/REPLACE 进入新页面时回到顶部
 * - POP（浏览器返回/前进）恢复离开时的位置；列表数据异步渲染，
 *   用 rAF 重试直到内容高度足够（上限 2s，超时按当前可滚动范围截断）
 */
export function useScrollRestoration() {
  const location = useLocation()
  const navType = useNavigationType()

  // 记录当前页滚动位置。
  // 关键：lastY 在 scroll 事件里同步更新。进入详情页时 React 先交换 DOM（页面变矮、
  // 浏览器把 scrollY 钳制到 0）再执行本 effect 的 cleanup——cleanup 若读 window.scrollY
  // 会把已保存的位置覆盖成 0，所以必须用事件里记录的 lastY。
  useEffect(() => {
    const key = 'scrollpos.' + location.key
    let lastY = window.scrollY
    const write = () => {
      try {
        sessionStorage.setItem(key, String(lastY))
      } catch {
        /* 隐私模式等场景忽略 */
      }
    }
    // 仅当该路由没有保存值时才写初值：返回（POP）到达时保留旧值供下方恢复使用，
    // 否则这里的初值会在恢复读取前把它覆盖成 0
    let existing: string | null = null
    try {
      existing = sessionStorage.getItem(key)
    } catch {
      /* ignore */
    }
    if (existing === null) write()
    window.addEventListener('scroll', save, { passive: true })
    function save() {
      lastY = window.scrollY
      write()
    }
    return () => {
      window.removeEventListener('scroll', save)
      write()
    }
  }, [location.key])

  // 导航后处理：POP 恢复，其余回顶部
  useEffect(() => {
    if (navType !== 'POP') {
      window.scrollTo(0, 0)
      return
    }
    let saved = 0
    try {
      saved = Number(sessionStorage.getItem('scrollpos.' + location.key) ?? 0)
    } catch {
      /* ignore */
    }
    if (!saved || saved < 0) return
    const start = Date.now()
    const attempt = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (max >= saved || Date.now() - start > 2000) {
        window.scrollTo(0, Math.min(saved, Math.max(0, max)))
      } else {
        // 列表数据尚未渲染完，等下一帧再试
        requestAnimationFrame(attempt)
      }
    }
    requestAnimationFrame(attempt)
  }, [location.key, navType])
}
