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

// 切到快速自测
async function switchToQuick(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '题型设置' }).click()
  // 弹层内"新学题型"组的"快速自测"
  const overlay = page.locator('.modal-overlay')
  await overlay.getByRole('button', { name: '快速自测', exact: true }).first().click()
  await overlay.getByRole('button', { name: '关闭', exact: true }).click()
  // 等题型生效（标签变为"新学 · 快速自测"）
  await expect(page.getByText('新学 · 快速自测')).toBeVisible()
}

test('快速自测:列表显示所有词', async ({ page }) => {
  await addWords(page, [['apple', '苹果'], ['banana', '香蕉'], ['cat', '猫']])
  await page.goto(url('/study'))
  await page.waitForTimeout(1000)
  await switchToQuick(page)

  await expect(page.getByText('apple', { exact: true })).toBeVisible()
  await expect(page.getByText('banana', { exact: true })).toBeVisible()
  await expect(page.getByText('cat', { exact: true })).toBeVisible()
})

test('快速自测:点词展开释义并自评', async ({ page }) => {
  await addWords(page, [['apple', '苹果'], ['banana', '香蕉']])
  await page.goto(url('/study'))
  await page.waitForTimeout(1000)
  await switchToQuick(page)

  // 点击 apple 展开
  await page.getByText('apple', { exact: true }).click()
  await expect(page.getByRole('button', { name: '忘记', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '记得', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '掌握', exact: true })).toBeVisible()
})
