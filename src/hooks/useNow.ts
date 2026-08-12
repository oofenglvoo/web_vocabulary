import { useState, useEffect } from 'react'

/**
 * 返回当前时间戳，并按固定间隔自动刷新。
 * 用于让 useDueWords / useDueCount 等"到期时间"相关的 live query
 * 能随真实时间流逝自动重跑（Dexie 的 live query 只在数据表变化时重跑）。
 */
export function useNow(intervalMs = 60000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}
