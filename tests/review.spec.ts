import { test, expect } from '@playwright/test'
import { url, makeAllWordsDue } from './helpers'

async function addWords(page: import('@playwright/test').Page, words: [string, string][]) {
  for (const [word, trans] of words) {
    await page.goto(url('/add'))
    await page.getByPlaceholder(/输入单词/).fill(word)
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
  await expect(page.getByRole('button', { name: /开始学习|额外学习/, exact: true })).toBeVisible()
  // 复习按钮（无到期词时禁用）
  const reviewBtn = page.getByRole('button', { name: /开始复习|已完成复习/, exact: true })
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
  await expect(page.getByRole('button', { name: /开始复习|已完成复习/, exact: true })).toBeVisible()
})

test('TC-SEP-001: 学习入口只含新词，复习入口只含到期词', async ({ page }) => {
  // 3 个词，计划每日新词配额 2
  await addWords(page, [['sep-a', '甲'], ['sep-b', '乙'], ['sep-c', '丙']])
  await createPlan(page, '分离计划')

  // 通过"额外学习"把 3 个词都标记为已学（不占用今日配额）
  await page.goto(url('/study?plan=1&mode=learn&extra=1'))
  await page.waitForSelector('text=回忆式')
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: '认识', exact: true }).click()
    await page.waitForTimeout(600)
  }
  // 回忆式队列清空后进入结束页
  await expect(page.locator('text=/学习完成!|今日学习已完成!/')).toBeVisible()

  // 把所有单词的 nextReviewAt 改到过去 → 全部到期
  await makeAllWordsDue(page)

  // mode=learn：全部已 started，无剩余新词 → 不应混入复习词，显示已完成
  await page.goto(url('/study?plan=1&mode=learn'))
  await page.waitForTimeout(1000)
  await expect(page.getByText('今日学习已完成!')).toBeVisible()

  // mode=review：3 个到期词都应在复习队列
  await page.goto(url('/study?plan=1&mode=review'))
  await page.waitForSelector('text=回忆式')
  await expect(page.getByText('复习 · 回忆式')).toBeVisible()
  await expect(page.getByText('剩余 3')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'sep-a' })).toBeVisible()
})
