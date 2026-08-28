import { test, expect } from '@playwright/test'
import { url } from './helpers'

// 冒烟测试：验证环境与核心流程可用

test('首页能加载', async ({ page }) => {
  await page.goto(url('/'))
  await expect(page.getByRole('button', { name: '学习', exact: true })).toBeVisible()
})

test('能添加单词并出现在列表', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder(/输入单词/).fill('apple')
  await page.getByPlaceholder(/中文翻译/).first().fill('苹果')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  // 等待保存完成跳转，避免 goto 中断进行中的写入
  await page.waitForURL(/\/words/)

  await page.goto(url('/words'))
  await expect(page.getByText('apple', { exact: true })).toBeVisible()
})
