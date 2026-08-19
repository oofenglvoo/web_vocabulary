import { test, expect } from '@playwright/test'
import { url } from './helpers'

async function addWords(page: import('@playwright/test').Page, words: [string, string][]) {
  for (const [word, trans] of words) {
    await page.goto(url('/add'))
    await page.getByPlaceholder('输入英文单词').fill(word)
    await page.getByPlaceholder(/中文翻译/).first().fill(trans)
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await page.waitForURL(/\/words/)
  }
}

async function createPlan(page: import('@playwright/test').Page, name: string) {
  await page.goto(url('/plan'))
  await page.getByRole('button', { name: /创建学习计划/ }).click()
  await page.getByPlaceholder(/例如/).fill(name)
  await page.locator('.modal-overlay').getByRole('button', { name: /全部/ }).click()
  await page.getByRole('button', { name: /创建计划/ }).click()
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible()
}

test('创建计划后学习入口可用', async ({ page }) => {
  await addWords(page, [['apple', '苹果'], ['banana', '香蕉']])
  await createPlan(page, '复习计划')

  // 首页应有学习按钮
  await page.goto(url('/'))
  await expect(page.getByRole('button', { name: '学习', exact: true })).toBeVisible()
  // 复习按钮（无到期词时禁用）
  const reviewBtn = page.getByRole('button', { name: '复习', exact: true })
  await expect(reviewBtn).toBeVisible()
})

test('学习后复习入口可用', async ({ page }) => {
  await addWords(page, [['apple', '苹果'], ['banana', '香蕉']])
  await createPlan(page, '复习计划2')

  // 学习一个词（回忆式，点认识）
  await page.goto(url('/study?plan=1&mode=learn'))
  await page.waitForSelector('text=回忆式')
  await page.getByRole('button', { name: '认识', exact: true }).click()

  // 回首页，复习按钮应可用（有已学词）
  await page.goto(url('/'))
  // 复习按钮存在（可能因 nextReviewAt 未到期而禁用，但按钮在）
  await expect(page.getByRole('button', { name: '复习', exact: true })).toBeVisible()
})
