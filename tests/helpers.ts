import { Page } from '@playwright/test'

// 与 playwright.config.ts 的 BASE_URL 保持一致（带尾斜杠）
const BASE = process.env.PW_BASE_URL || 'http://127.0.0.1:8457/web_vocabulary/'

/** 构造带 base 路径的完整 URL，避免 goto 相对路径丢失 base */
export function url(path: string): string {
  // path 形如 "/add" → 拼接成 "/web_vocabulary/add"
  return new URL(path.replace(/^\//, ''), BASE).toString()
}

export { BASE }

/**
 * 在 /plan 页创建一个「全部」来源的单词计划，返回计划 ID。
 * 可选题型参数用于验证计划级题型配置（不传即保持默认 = 跟随全局）。
 */
export async function createWordPlan(
  page: Page,
  name: string,
  opts?: { newType?: string; reviewType?: string }
): Promise<string> {
  await page.goto(url('/plan'))
  await page.getByRole('button', { name: /创建学习计划/ }).click()
  const overlay = page.locator('.modal-overlay')
  await page.getByPlaceholder(/例如/).fill(name)
  await overlay.getByRole('button', { name: /全部/ }).click()
  if (opts?.newType) {
    await overlay
      .getByText('新学题型')
      .locator('..')
      .getByRole('button', { name: opts.newType, exact: true })
      .click()
  }
  if (opts?.reviewType) {
    await overlay
      .getByText('复习题型')
      .locator('..')
      .getByRole('button', { name: opts.reviewType, exact: true })
      .click()
  }
  await page.getByRole('button', { name: /创建计划/ }).click()
  await page.getByText(name, { exact: true }).first().waitFor({ timeout: 10000 })
  const href = await page.locator('a[href*="/plan/"][href$="/words"]').first().getAttribute('href')
  const id = href?.match(/\/plan\/(\d+)\/words/)?.[1]
  if (!id) throw new Error('未找到新建计划 ID')
  return id
}

/** Moji 学习流程：进入当天词表后确认开始测试 */
export async function startStudyTest(page: Page) {
  const startButton = page.getByRole('button', { name: '开始测试', exact: true })
  await page.waitForFunction(() => {
    const hasStart = Array.from(document.querySelectorAll('button')).some((button) => button.textContent?.trim() === '开始测试')
    const hasQuiz = !!document.querySelector('[data-study-quiz]')
    const isEmpty = document.body.textContent?.includes('今日学习已完成') || document.body.textContent?.includes('暂无待复习')
    return hasStart || hasQuiz || isEmpty
  }, undefined, { timeout: 10000 })
  if (await startButton.count() === 0 || !(await startButton.isVisible())) return
  await startButton.click()
  await page.getByRole('button', { name: '确认开始', exact: true }).click()
}

/**
 * 直接改写 IndexedDB 中短句的 category 字段（绕过应用校验层），
 * 用于在测试中构造“旧混合数据”场景。
 */
export async function moveSentencesCategory(page: Page, from: string, to: string) {
  await page.evaluate(([f, t]) => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('VocabularyDB_v2')
      req.onsuccess = () => {
        const db = req.result
        let settled = false
        const done = () => {
          if (!settled) {
            settled = true
            db.close()
            resolve()
          }
        }
        try {
          const tx = db.transaction('sentences', 'readwrite')
          const idx = tx.objectStore('sentences').index('category')
          const cursorReq = idx.openCursor(IDBKeyRange.only(f as string))
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result
            if (!cursor) {
              done()
              return
            }
            const value = { ...(cursor.value as Record<string, unknown>), category: t }
            cursor.update(value)
            cursor.continue()
          }
          cursorReq.onerror = () => reject(cursorReq.error)
          tx.oncomplete = done
          tx.onerror = () => reject(tx.error)
        } catch (e) {
          reject(e)
        }
      }
      req.onerror = () => reject(req.error)
    })
  }, [from, to])
}

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
