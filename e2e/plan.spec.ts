import { test, expect } from '@playwright/test'
import { url } from './helpers'

async function addWords(page: import('@playwright/test').Page, words: [string, string][]) {
  for (const [word, trans] of words) {
    await page.goto(url('/add'))
    await page.getByPlaceholder('输入英文单词').fill(word)
    await page.getByPlaceholder(/中文翻译/).first().fill(trans)
    await page.getByRole('button', { name: '保存', exact: true }).click()
  }
}

// 创建计划（返回后计划应为激活状态）
async function createPlan(page: import('@playwright/test').Page, name: string) {
  await page.goto(url('/plan'))
  await page.getByRole('button', { name: /创建学习计划/ }).click()
  await page.getByPlaceholder(/例如/).fill(name)
  await page.locator('.modal-overlay').getByRole('button', { name: /全部/ }).click()
  await page.getByRole('button', { name: /创建计划/ }).click()
  // 等计划创建完成（toast 或列表出现）
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible()
}

test('创建学习计划并显示', async ({ page }) => {
  await addWords(page, [['apple', '苹果'], ['banana', '香蕉'], ['cat', '猫']])
  await createPlan(page, '测试计划')
  // 计划名出现在计划列表卡片
  await expect(page.getByRole('heading', { name: '测试计划' })).toBeVisible()
})

test('今日任务显示学习入口', async ({ page }) => {
  await addWords(page, [['dog', '狗'], ['egg', '蛋']])
  await createPlan(page, '每日计划')

  // 回首页，今日任务卡片应出现（activePlan 已设）
  await page.goto(url('/'))
  await expect(page.getByText('今日任务')).toBeVisible()
  await expect(page.getByRole('button', { name: '学习', exact: true })).toBeVisible()
})
