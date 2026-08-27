import { Page } from '@playwright/test'

// 与 playwright.config.ts 的 BASE_URL 保持一致（带尾斜杠）
const BASE = process.env.PW_BASE_URL || 'http://127.0.0.1:5199/web_vocabulary/'

/** 构造带 base 路径的完整 URL，避免 goto 相对路径丢失 base */
export function url(path: string): string {
  // path 形如 "/add" → 拼接成 "/web_vocabulary/add"
  return new URL(path.replace(/^\//, ''), BASE).toString()
}

export { BASE }

/**
 * 直接改写 IndexedDB 中所有单词的 nextReviewAt 为过去时间（模拟到期复习）。
 * 绕过 UI 层做时间旅行，用于验证复习队列组装逻辑。
 */
export async function makeAllWordsDue(page: Page, offsetMs = 60_000) {
  await page.evaluate((offset) => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('VocabularyDB_v2')
      req.onsuccess = () => {
        const db = req.result
        try {
          const tx = db.transaction('words', 'readwrite')
          const store = tx.objectStore('words')
          const now = Date.now()
          const cursorReq = store.openCursor()
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result
            if (!cursor) {
              tx.oncomplete = () => {
                db.close()
                resolve()
              }
              return
            }
            const word = cursor.value as { nextReviewAt?: number }
            word.nextReviewAt = now - offset
            cursor.update(word)
            cursor.continue()
          }
          cursorReq.onerror = () => reject(cursorReq.error)
        } catch (e) {
          reject(e)
        }
      }
      req.onerror = () => reject(req.error)
    })
  }, offsetMs)
}
