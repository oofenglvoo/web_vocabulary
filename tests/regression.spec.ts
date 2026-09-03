import { test, expect } from '@playwright/test'
import { url } from './helpers'

test('TC-REG-001: 分类详情返回按钮回到分类页', async ({ page }) => {
  await page.goto(url('/categories/默认'))
  await page.waitForFunction(() => document.body.textContent?.includes('分类') || document.body.textContent?.includes('默认'))
  const wordLink = page.locator('a[href*="/word/"]').first()
  if (await wordLink.count() === 0) test.skip()
  await wordLink.click()
  await page.getByRole('button', { name: '返回' }).click()
  await expect(page).toHaveURL(/\/categories\/默认$/)
})

test('TC-REG-002: 日语详情中的10以上编号不会被拆开', async ({ page }) => {
  await page.goto(url('/'))
  await page.getByRole('button', { name: '日语', exact: true }).click()
  const wordId = await page.evaluate(() => new Promise<number>((resolve, reject) => {
    const request = indexedDB.open('VocabularyDB_v2')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      const transaction = database.transaction('japaneseWords', 'readwrite')
      const addRequest = transaction.objectStore('japaneseWords').add({
        word: '番号テスト',
        reading: 'ばんごうテスト',
        definitions: [{ pos: '名', meaning: '1、第一 2、第二 10、数字10.0の説明', translation: '一 二 十' }],
        partOfSpeech: '名', example: '', exampleReading: '', exampleTranslation: '', category: '日语',
        difficulty: 1, createdAt: Date.now(), lastReviewedAt: 0, reviewCount: 0, correctCount: 0,
        streak: 0, easeFactor: 2.5, interval: 0, nextReviewAt: Date.now(), srsStage: 0,
        stageProgress: 0, isLearned: 0, isFavorite: 0, notes: '',
      })
      addRequest.onerror = () => reject(addRequest.error)
      transaction.oncomplete = () => {
        database.close()
        resolve(Number(addRequest.result))
      }
    }
  }))
  await page.goto(url(`/word/${wordId}`))
  await expect(page.getByText('数字10.0の説明', { exact: true })).toBeVisible()
})
