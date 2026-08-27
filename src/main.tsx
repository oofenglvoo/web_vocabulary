import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { initDarkMode } from './utils/theme'
import { db } from './db/database'

initDarkMode()

/**
 * 渲染前确保 IndexedDB 连接就绪：
 * 避免冷启动时 UI 已可交互但 Dexie 仍在打开/迁移中，
 * 导致早期写入依赖异常或 liveQuery 停留在失败态。
 */
function DatabaseGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    db.open()
      .catch((e) => {
        // 打不开也继续渲染（ErrorBoundary/页面层会暴露问题），但把错误留痕
        console.error('Database open failed:', e)
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    )
  }
  return <>{children}</>
}

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('找不到 #root 挂载点，请检查 index.html')
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <DatabaseGate>
      <App />
    </DatabaseGate>
  </React.StrictMode>,
)
