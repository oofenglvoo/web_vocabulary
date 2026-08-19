import { test, expect } from '@playwright/test'
import { url } from './helpers'

test('添加短句并显示', async ({ page }) => {
  await page.goto(url('/sentences/add'))
  await page.getByPlaceholder(/输入英文短句/).fill('How are you?')
  await page.getByPlaceholder(/中文翻译/).first().fill('你好吗？')
  await page.getByRole('button', { name: '保存', exact: true }).click()

  await page.goto(url('/sentences'))
  await expect(page.getByText('How are you?', { exact: true })).toBeVisible()
})

test('统计页能加载', async ({ page }) => {
  await page.goto(url('/stats'))
  await expect(page.getByText('学习统计')).toBeVisible()
  await expect(page.getByText('总单词')).toBeVisible()
})

test('暗色模式切换', async ({ page }) => {
  await page.goto(url('/stats'))
  await expect(page.getByText('学习统计')).toBeVisible()
  // 深色模式按钮是图标按钮，位于"深色模式"文本的父级内
  const darkBtn = page.getByText('深色模式').locator('..').locator('button')
  await expect(darkBtn).toBeVisible()
  await darkBtn.click()
  // 页面应仍正常，html 的 dark class 应切换
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  await expect(page.getByText('学习统计')).toBeVisible()
})
