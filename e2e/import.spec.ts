import { test, expect } from '@playwright/test'
import { url } from './helpers'

test('导入示例单词', async ({ page }) => {
  await page.goto(url('/import'))
  // 点击"使用示例"填充 JSON
  await page.getByRole('button', { name: /使用示例/ }).click()
  // 点击"解析预览"
  await page.getByRole('button', { name: /解析预览/ }).click()
  // 应显示解析结果（2 个词）
  await expect(page.getByText(/共 \d+ 个有效单词/)).toBeVisible()
  // 点击导入按钮
  await page.getByRole('button', { name: /导入 \d+ 个单词/ }).click()
  // 导入完成提示
  await expect(page.getByText(/成功导入/)).toBeVisible()
})

test('导入后单词出现在列表', async ({ page }) => {
  await page.goto(url('/import'))
  await page.getByRole('button', { name: /使用示例/ }).click()
  await page.getByRole('button', { name: /解析预览/ }).click()
  await page.getByRole('button', { name: /导入 \d+ 个单词/ }).click()
  await expect(page.getByText(/成功导入/)).toBeVisible()

  await page.goto(url('/words'))
  await expect(page.getByText('bank', { exact: true })).toBeVisible()
  await expect(page.getByText('hello', { exact: true })).toBeVisible()
})
