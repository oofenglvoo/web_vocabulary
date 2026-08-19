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

// ===== 回忆式学习：P0-P2 测试用例 =====

test('TC-STUDY-RCL-001: 认识通过不再重复', async ({ page }) => {
  await addWords(page, [['apple', '苹果'], ['banana', '香蕉']])
  await page.goto(url('/study'))
  await page.waitForSelector('text=回忆式')
  await page.waitForTimeout(1000)

  await page.getByRole('button', { name: '认识', exact: true }).click()
  await page.waitForTimeout(300)
  // 剩余数应为 1（apple 移除，剩 banana）
  await expect(page.getByText('剩余 1')).toBeVisible()
})

test('TC-STUDY-RCL-002: 忘记重排到队尾', async ({ page }) => {
  await addWords(page, [['cat', '猫'], ['dog', '狗']])
  await page.goto(url('/study'))
  await page.waitForSelector('text=回忆式')
  await page.waitForTimeout(1000)

  await page.getByRole('button', { name: '忘记', exact: true }).click()
  await page.waitForTimeout(300)
  // 当前词应切换到下一个（cat 重排到队尾）
  await expect(page.getByText('剩余 1')).toBeVisible()
})

test('TC-STUDY-RCL-005: 模糊/忘记重复直到认识', async ({ page }) => {
  await addWords(page, [['apple', '苹果'], ['banana', '香蕉']])
  await page.goto(url('/study'))
  await page.waitForSelector('text=回忆式')
  await page.waitForTimeout(1000)

  // 词 A 选模糊 → 重排到队尾
  await page.getByRole('button', { name: '模糊', exact: true }).click()
  await page.waitForTimeout(300)
  // 学完下一个词
  await page.getByRole('button', { name: '认识', exact: true }).click()
  await page.waitForTimeout(300)
  // 词 A 再次出现（队列循环），现在选认识
  await page.getByRole('button', { name: '认识', exact: true }).click()
  await page.waitForTimeout(500)
  // 学习完成
  await expect(page.getByText('学习完成!')).toBeVisible()
})

test('TC-STUDY-RCL-006: 标记为已掌握', async ({ page }) => {
  await addWords(page, [['apple', '苹果']])
  await page.goto(url('/study'))
  await page.waitForSelector('text=回忆式')
  await page.waitForTimeout(1000)

  await page.getByRole('button', { name: '标记为已掌握', exact: true }).click()
  await page.getByRole('button', { name: '确认掌握', exact: true }).click()
  await page.waitForTimeout(500)
  await expect(page.getByText('学习完成!')).toBeVisible()
})

test('TC-STUDY-RCL-007: 全部学完进完成页', async ({ page }) => {
  await addWords(page, [['apple', '苹果']])
  await page.goto(url('/study'))
  await page.waitForSelector('text=回忆式')
  await page.waitForTimeout(1000)

  await page.getByRole('button', { name: '认识', exact: true }).click()
  await expect(page.getByText('学习完成!')).toBeVisible()
})

test('TC-STUDY-RCL-008: 点卡片翻面', async ({ page }) => {
  await addWords(page, [['apple', '苹果']])
  await page.goto(url('/study'))
  await page.waitForSelector('text=回忆式')
  await page.waitForTimeout(1000)

  // 点击卡片正面（标题 apple 所在卡片）
  await page.getByRole('heading', { name: 'apple' }).click()
  // 翻面后显示释义
  await expect(page.getByText('苹果')).toBeVisible()
})

// ===== 快速自测：P0-P2 测试用例 =====

test('TC-STUDY-QCK-001: 列表显示所有词', async ({ page }) => {
  await addWords(page, [['apple', '苹果'], ['banana', '香蕉'], ['cat', '猫']])
  await page.goto(url('/study'))
  await page.waitForTimeout(1000)
  await page.getByRole('button', { name: '题型设置' }).click()
  await page.locator('.modal-overlay').getByRole('button', { name: '快速自测', exact: true }).first().click()
  await page.locator('.modal-overlay').getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.getByText('新学 · 快速自测')).toBeVisible()

  await expect(page.getByText('apple', { exact: true })).toBeVisible()
  await expect(page.getByText('banana', { exact: true })).toBeVisible()
  await expect(page.getByText('cat', { exact: true })).toBeVisible()
})

test('TC-STUDY-QCK-002: 点击展开释义', async ({ page }) => {
  await addWords(page, [['apple', '苹果']])
  await page.goto(url('/study'))
  await page.waitForTimeout(1000)
  await page.getByRole('button', { name: '题型设置' }).click()
  await page.locator('.modal-overlay').getByRole('button', { name: '快速自测', exact: true }).first().click()
  await page.locator('.modal-overlay').getByRole('button', { name: '关闭', exact: true }).click()
  await page.waitForTimeout(300)

  await page.getByText('apple', { exact: true }).click()
  await expect(page.getByRole('button', { name: '忘记', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '记得', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '掌握', exact: true })).toBeVisible()
})

test('TC-STUDY-QCK-005: 选掌握标记已掌握', async ({ page }) => {
  await addWords(page, [['apple', '苹果']])
  await page.goto(url('/study'))
  await page.waitForTimeout(1000)
  await page.getByRole('button', { name: '题型设置' }).click()
  await page.locator('.modal-overlay').getByRole('button', { name: '快速自测', exact: true }).first().click()
  await page.locator('.modal-overlay').getByRole('button', { name: '关闭', exact: true }).click()
  await page.waitForTimeout(300)

  await page.getByText('apple', { exact: true }).click()
  await page.locator('button').filter({ hasText: '掌握' }).first().click()
  // 出现提交按钮（已评完所有词）
  await expect(page.getByRole('button', { name: /提交/ })).toBeVisible()
})

test('TC-STUDY-QCK-008: 全部评完出现提交', async ({ page }) => {
  await addWords(page, [['apple', '苹果'], ['banana', '香蕉']])
  await page.goto(url('/study'))
  await page.waitForTimeout(1000)
  await page.getByRole('button', { name: '题型设置' }).click()
  await page.locator('.modal-overlay').getByRole('button', { name: '快速自测', exact: true }).first().click()
  await page.locator('.modal-overlay').getByRole('button', { name: '关闭', exact: true }).click()
  await page.waitForTimeout(300)

  for (const word of ['apple', 'banana']) {
    await page.getByText(word, { exact: true }).click()
    await page.locator('button').filter({ hasText: '记得' }).first().click()
  }
  await expect(page.getByRole('button', { name: /提交/ })).toBeVisible()
})

// ===== 题型切换：P0-P2 测试用例 =====

test('TC-STUDY-SWITCH-001: 新学题型切换', async ({ page }) => {
  await addWords(page, [['apple', '苹果']])
  await page.goto(url('/study'))
  await page.waitForTimeout(1000)
  await expect(page.getByText('新学 · 回忆式')).toBeVisible()

  // 切到快速自测
  await page.getByRole('button', { name: '题型设置' }).click()
  await page.locator('.modal-overlay').getByRole('button', { name: '快速自测', exact: true }).first().click()
  await page.locator('.modal-overlay').getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.getByText('新学 · 快速自测')).toBeVisible()

  // 切回回忆式
  await page.getByRole('button', { name: '题型设置' }).click()
  await page.locator('.modal-overlay').getByRole('button', { name: '回忆式', exact: true }).first().click()
  await page.locator('.modal-overlay').getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.getByText('新学 · 回忆式')).toBeVisible()
})

// ===== 自由学习：P0-P2 测试用例 =====

test('TC-STUDY-FREE-001: 无计划自由学习', async ({ page }) => {
  await addWords(page, [['free', '自由'], ['study', '学习']])
  await page.goto(url('/study'))
  await page.waitForSelector('text=回忆式')
  await page.waitForTimeout(1000)
  // 应显示词卡（free 或 study）
  await expect(page.locator('h2').first()).toBeVisible()
})

test('TC-STUDY-FREE-002: 无词可学', async ({ page }) => {
  await page.goto(url('/study'))
  await page.waitForTimeout(1000)
  await expect(page.getByText(/没有可学习的单词/)).toBeVisible()
})