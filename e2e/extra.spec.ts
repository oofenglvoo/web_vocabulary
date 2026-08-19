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

test('计划页显示今日新词统计', async ({ page }) => {
  await addWords(page, [['apple', '苹果'], ['banana', '香蕉']])
  await createPlan(page, '统计计划')

  await page.goto(url('/plan'))
  // 计划页显示进行中卡片
  await expect(page.getByText('进行中')).toBeVisible()
  await expect(page.getByText('今日新词')).toBeVisible()
})