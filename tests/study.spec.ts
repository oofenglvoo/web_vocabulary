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

// 等自由学习加载出词卡
async function waitCard(page: import('@playwright/test').Page) {
  await page.waitForSelector('text=回忆式')
  await page.locator('h2').first().waitFor({ timeout: 10000 })
}

// 读当前词
async function currentWord(page: import('@playwright/test').Page): Promise<string> {
  return (await page.locator('h2').first().innerText()).trim()
}

// 等当前词改变
async function waitWordChange(page: import('@playwright/test').Page, oldWord: string) {
  await page.locator('h2').first().waitFor({ timeout: 10000 })
  // 轮询直到当前词不再是 oldWord（重排后进入下一个词）
  await expect
    .poll(async () => currentWord(page), { timeout: 10000 })
    .not.toBe(oldWord)
}

// ===== 回忆式学习 =====

test('TC-STUDY-RCL-001: 认识通过不再重复', async ({ page }) => {
  await addWords(page, [['apple', '苹果'], ['banana', '香蕉']])
  await page.goto(url('/study'))
  await waitCard(page)

  await page.getByRole('button', { name: '认识', exact: true }).click()
  // apple 认识后剩余 1
  await expect(page.getByText('剩余 1')).toBeVisible()
})

test('TC-STUDY-RCL-002: 忘记重排到队尾', async ({ page }) => {
  await addWords(page, [['cat', '猫'], ['dog', '狗']])
  await page.goto(url('/study'))
  await waitCard(page)

  const before = await currentWord(page)
  await page.getByRole('button', { name: '忘记', exact: true }).click()
  // 剩余不变（重排不移除）
  await expect(page.getByText('剩余 2')).toBeVisible()
  // 进入下一个词
  await waitWordChange(page, before)
})

test('TC-STUDY-RCL-003: 模糊重排到队尾', async ({ page }) => {
  await addWords(page, [['cat', '猫'], ['dog', '狗']])
  await page.goto(url('/study'))
  await waitCard(page)

  const before = await currentWord(page)
  await page.getByRole('button', { name: '模糊', exact: true }).click()
  await expect(page.getByText('剩余 2')).toBeVisible()
  await waitWordChange(page, before)
})

test('TC-STUDY-RCL-004: 认识后不再出现', async ({ page }) => {
  await addWords(page, [['apple', '苹果'], ['banana', '香蕉']])
  await page.goto(url('/study'))
  await waitCard(page)

  // 认识两次（两个词）→ 队列清空 → 自由学习走空队列页
  await page.getByRole('button', { name: '认识', exact: true }).click()
  await page.getByRole('button', { name: '认识', exact: true }).click()
  await expect(page.getByText('今日学习已完成!')).toBeVisible()
})

test('TC-STUDY-RCL-005: 模糊/忘记重复直到认识', async ({ page }) => {
  await addWords(page, [['apple', '苹果'], ['banana', '香蕉']])
  await page.goto(url('/study'))
  await waitCard(page)

  // 当前词选模糊 → 重排；下一词认识；重排的词再出现，认识 → 队列空
  await page.getByRole('button', { name: '模糊', exact: true }).click()
  await page.getByRole('button', { name: '认识', exact: true }).click()
  await page.getByRole('button', { name: '认识', exact: true }).click()
  await expect(page.getByText('今日学习已完成!')).toBeVisible()
})

test('TC-STUDY-RCL-006: 标记为已掌握', async ({ page }) => {
  await addWords(page, [['apple', '苹果']])
  await page.goto(url('/study'))
  await waitCard(page)

  await page.getByRole('button', { name: '标记为已掌握', exact: true }).click()
  await page.getByRole('button', { name: '确认掌握', exact: true }).click()
  // 自由学习标记掌握后队列空 → 空队列页
  await expect(page.getByText('今日学习已完成!')).toBeVisible()
})

test('TC-STUDY-RCL-007: 全部学完进空队列页', async ({ page }) => {
  await addWords(page, [['apple', '苹果']])
  await page.goto(url('/study'))
  await waitCard(page)

  await page.getByRole('button', { name: '认识', exact: true }).click()
  await expect(page.getByText('今日学习已完成!')).toBeVisible()
})

// ===== 快速自测 =====

async function switchToQuick(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '题型设置' }).click()
  await page.locator('.modal-overlay').getByRole('button', { name: '快速自测', exact: true }).first().click()
  await page.locator('.modal-overlay').getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.getByText('新学 · 快速自测')).toBeVisible()
}

test('TC-STUDY-QCK-001: 列表显示所有词', async ({ page }) => {
  await addWords(page, [['apple', '苹果'], ['banana', '香蕉'], ['cat', '猫']])
  await page.goto(url('/study'))
  await page.waitForTimeout(1000)
  await switchToQuick(page)

  await expect(page.getByText('apple', { exact: true })).toBeVisible()
  await expect(page.getByText('banana', { exact: true })).toBeVisible()
  await expect(page.getByText('cat', { exact: true })).toBeVisible()
})

test('TC-STUDY-QCK-002: 点击展开释义', async ({ page }) => {
  await addWords(page, [['apple', '苹果']])
  await page.goto(url('/study'))
  await page.waitForTimeout(1000)
  await switchToQuick(page)

  // 等 apple 行出现，点击展开
  await page.getByText('apple', { exact: true }).waitFor({ timeout: 10000 })
  await page.getByText('apple', { exact: true }).click()
  await page.getByRole('button', { name: '忘记', exact: true }).waitFor({ timeout: 10000 })
  await expect(page.getByRole('button', { name: '忘记', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '记得', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '掌握', exact: true })).toBeVisible()
})

test('TC-STUDY-QCK-008: 全部评完出现提交', async ({ page }) => {
  await addWords(page, [['apple', '苹果'], ['banana', '香蕉']])
  await page.goto(url('/study'))
  await page.waitForTimeout(1000)
  await switchToQuick(page)

  // 先展开两个词
  await page.locator('button').filter({ hasText: 'apple' }).first().click()
  await page.locator('button').filter({ hasText: 'banana' }).first().click()
  await page.waitForTimeout(300)

  // 点 apple 的"记得"（第一个）、banana 的"记得"（最后一个）
  await page.getByRole('button', { name: '记得', exact: true }).first().click()
  await page.getByRole('button', { name: '记得', exact: true }).last().click()

  await expect(page.getByRole('button', { name: /提交/ })).toBeVisible()
})

// ===== 题型切换 =====

test('TC-STUDY-SWITCH-001: 新学题型切换', async ({ page }) => {
  await addWords(page, [['apple', '苹果']])
  await page.goto(url('/study'))
  await page.waitForTimeout(1000)
  await expect(page.getByText('新学 · 回忆式')).toBeVisible()

  // 切到快速自测
  await switchToQuick(page)

  // 切回回忆式（新学题型组内）
  await page.getByRole('button', { name: '题型设置' }).click()
  const overlay = page.locator('.modal-overlay')
  await overlay.getByText('新学题型').locator('..').locator('button').filter({ hasText: '回忆式' }).click()
  await overlay.getByRole('button', { name: '关闭', exact: true }).click()
  await page.waitForTimeout(500)

  // 刷新页面验证持久化
  await page.reload()
  await page.waitForTimeout(2000)
  await expect(page.getByText('新学 · 回忆式')).toBeVisible()
})

// ===== 自由学习 =====

test('TC-STUDY-FREE-001: 无计划自由学习', async ({ page }) => {
  await addWords(page, [['free', '自由'], ['study', '学习']])
  await page.goto(url('/study'))
  await page.waitForTimeout(1500)
  await expect(page.locator('h2').first()).toBeVisible()
})

test('TC-STUDY-FREE-002: 无词可学', async ({ page }) => {
  await page.goto(url('/study'))
  await page.waitForTimeout(1500)
  await expect(page.getByText('今日学习已完成!')).toBeVisible()
})