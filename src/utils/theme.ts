export const DARK_KEY = 'vocab.dark'

/** 初始化暗色模式（依据 localStorage 或系统偏好） */
export function initDarkMode(): void {
  if (typeof localStorage === 'undefined') return
  const saved = localStorage.getItem(DARK_KEY)
  if (saved === 'true') {
    document.documentElement.classList.add('dark')
  } else if (saved === 'false') {
    document.documentElement.classList.remove('dark')
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.classList.add('dark')
  }
}

/** 当前是否处于暗色模式 */
export function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark')
}

/** 切换暗色模式并持久化，返回切换后的状态 */
export function toggleDarkMode(): boolean {
  const next = !document.documentElement.classList.contains('dark')
  document.documentElement.classList.toggle('dark', next)
  localStorage.setItem(DARK_KEY, String(next))
  return next
}
