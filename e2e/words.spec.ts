import { test, expect } from '@playwright/test'
import { url } from './helpers'

// 单词管理测试：Playwright 每个 test 用独立 browser context，IndexedDB 天然隔离

test('添加单词显示在列表', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder('输入英文单词').fill('apple')
  await page.getByPlaceholder(/中文翻译/).first().fill('苹果')
  await page.getByRole('button', { name: '保存', exact: true }).click()

  await page.goto(url('/words'))
  await expect(page.getByText('apple', { exact: true })).toBeVisible()
})

test('添加多个释义', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder('输入英文单词').fill('bank')
  await page.getByPlaceholder(/中文翻译/).first().fill('银行')
  await page.getByRole('button', { name: /添加释义/ }).click()
  // 等第二个释义输入框出现
  await expect(page.getByPlaceholder(/中文翻译/).nth(1)).toBeVisible()
  await page.getByPlaceholder(/中文翻译/).nth(1).fill('河岸')
  await page.getByRole('button', { name: '保存', exact: true }).click()

  // 保存后跳转 /words，等待 bank 出现（live query 更新）
  await expect(page.getByText('bank', { exact: true })).toBeVisible({ timeout: 10000 })
})

test('搜索能过滤单词', async ({ page }) => {
  for (const [word, trans] of [['apple', '苹果'], ['banana', '香蕉']]) {
    await page.goto(url('/add'))
    await page.getByPlaceholder('输入英文单词').fill(word)
    await page.getByPlaceholder(/中文翻译/).first().fill(trans)
    await page.getByRole('button', { name: '保存', exact: true }).click()
  }

  await page.goto(url('/words'))
  await page.getByPlaceholder(/搜索单词/).fill('apple')
  await expect(page.getByText('apple', { exact: true })).toBeVisible()
  await expect(page.getByText('banana', { exact: true })).toHaveCount(0)
})

test('收藏功能', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder('输入英文单词').fill('star')
  await page.getByPlaceholder(/中文翻译/).first().fill('星星')
  await page.getByRole('button', { name: '保存', exact: true }).click()

  await page.goto(url('/words'))
  await page.getByText('star', { exact: true }).click()
  // 用精确 aria-label 点收藏按钮
  await page.getByRole('button', { name: '收藏', exact: true }).click()
  // 等收藏状态生效（出现"已收藏"标签）
  await expect(page.getByText('已收藏')).toBeVisible()

  await page.goto(url('/favorites'))
  await expect(page.getByText('star', { exact: true })).toBeVisible()
})

test('重复单词不重复添加', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder('输入英文单词').fill('apple')
  await page.getByPlaceholder(/中文翻译/).first().fill('苹果')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  // 等跳转到 /words
  await page.waitForURL(/\/words/)

  // 第二次添加同名
  await page.goto(url('/add'))
  await page.getByPlaceholder('输入英文单词').fill('apple')
  await page.getByPlaceholder(/中文翻译/).first().fill('苹果')
  await page.getByRole('button', { name: '保存', exact: true }).click()

  await expect(page.getByText(/已存在/)).toBeVisible()
})
