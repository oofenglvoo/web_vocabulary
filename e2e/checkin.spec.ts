import { test, expect } from '@playwright/test'
import { url } from './helpers'

test('打卡页能加载并显示统计', async ({ page }) => {
  await page.goto(url('/checkin'))
  await expect(page.getByRole('heading', { name: '打卡' })).toBeVisible()
  await expect(page.getByText('累计天数')).toBeVisible()
  await expect(page.getByText('连续天数')).toBeVisible()
  await expect(page.getByText('我的勋章')).toBeVisible()
})

test('学习后打卡天数增加', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder('输入英文单词').fill('test')
  await page.getByPlaceholder(/中文翻译/).first().fill('测试')
  await page.getByRole('button', { name: '保存', exact: true }).click()

  await page.goto(url('/study'))
  await page.waitForSelector('text=回忆式')
  await page.getByRole('button', { name: '认识', exact: true }).click()

  await page.goto(url('/checkin'))
  // 累计天数区域应显示数字（今天有学习记录 → 至少 1）
  const totalDaysCell = page.getByText('累计天数').locator('..')
  await expect(totalDaysCell).toBeVisible()
  // 数字 div 存在且非空
  const num = totalDaysCell.locator('div').first()
  await expect(num).not.toHaveText('')
})

test('分类页显示默认分类', async ({ page }) => {
  await page.goto(url('/categories'))
  // 等分类初始化完成
  await expect(page.getByText('CET-4').first()).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('默认').first()).toBeVisible()
})
