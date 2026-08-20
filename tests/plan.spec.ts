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

// 创建计划且每日新词=1（用于加学测试：学满1个后剩余>0 → 弹加学框）
async function createPlanWithQuota1(page: import('@playwright/test').Page, name: string) {
  await page.goto(url('/plan'))
  await page.getByRole('button', { name: /创建学习计划/ }).click()
  await page.getByPlaceholder(/例如/).fill(name)
  const overlay = page.locator('.modal-overlay')
  await overlay.getByRole('button', { name: /全部/ }).click()
  // 每日新词 NumberStepper：点减号 9 次（10 → 1），每次间隔 100ms
  const stepper = overlay.getByText('每日新词', { exact: true }).locator('..')
  const minusBtn = stepper.getByRole('button').first()
  for (let i = 0; i < 9; i++) {
    await minusBtn.click()
    await page.waitForTimeout(100)
  }
  await page.getByRole('button', { name: /创建计划/ }).click()
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible()
}

// ===== 学习计划：P0-P2 级别测试用例 =====

// --- 创建计划 (TC-PLN-001 ~ 007) ---

test('TC-PLN-001: 创建单词计划(全部来源)', async ({ page }) => {
  await addWords(page, [['apple', '苹果'], ['banana', '香蕉'], ['cat', '猫']])
  await createPlan(page, '测试计划')
  await expect(page.getByRole('heading', { name: '测试计划' })).toBeVisible()
  await expect(page.getByText(/进行中/)).toBeVisible()
})

test('TC-PLN-002: 创建分类来源计划', async ({ page }) => {
  await addWords(page, [['apple', '苹果']])
  await page.goto(url('/plan'))
  await page.getByRole('button', { name: /创建学习计划/ }).click()
  await page.getByPlaceholder(/例如/).fill('分类计划')
  await page.getByRole('button', { name: /创建计划/ }).click()
  await expect(page.getByRole('heading', { name: '分类计划' })).toBeVisible()
})

test('TC-PLN-004: 创建短句计划', async ({ page }) => {
  await page.goto(url('/sentences/add'))
  await page.getByPlaceholder(/输入英文短句/).fill('hello')
  await page.getByPlaceholder(/中文翻译/).first().fill('你好')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/sentences/)

  await page.goto(url('/plan'))
  await page.getByRole('button', { name: /短句计划/ }).click()
  await page.getByRole('button', { name: /创建学习计划/ }).click()
  await page.getByPlaceholder(/例如/).fill('短句计划')
  await page.locator('.modal-overlay').getByRole('button', { name: /全部/ }).click()
  await page.getByRole('button', { name: /创建计划/ }).click()
  await expect(page.getByText('短句计划')).toBeVisible()
})

test('TC-PLN-005: 计划名称为空校验', async ({ page }) => {
  await page.goto(url('/plan'))
  await page.getByRole('button', { name: /创建学习计划/ }).click()
  // 不填名称直接点创建
  await page.getByRole('button', { name: /创建计划/ }).click()
  await expect(page.getByText(/请填写计划名称/)).toBeVisible()
  // 弹窗不关闭
  await expect(page.locator('.modal-overlay')).toBeVisible()
})

test('TC-PLN-006: 每日新词数限制', async ({ page }) => {
  await page.goto(url('/plan'))
  await page.getByRole('button', { name: /创建学习计划/ }).click()
  await page.getByPlaceholder(/例如/).fill('限额计划')
  await page.locator('.modal-overlay').getByRole('button', { name: /全部/ }).click()
  // 把每日新词减到 0
  const stepper = page.locator('.modal-overlay').getByText('每日新词', { exact: true }).locator('..')
  const minusBtn = stepper.getByRole('button').first()
  // 点 10 次减到 0（但 min=1，应停在 1）
  for (let i = 0; i < 10; i++) await minusBtn.click()
  // 输入框值应为 1（clamp 到 min）
  await expect(stepper.locator('input')).toHaveValue('1')
})

// --- 计划管理 (TC-PLN-MGT-001 ~ 006) ---

test('TC-PLN-MGT-001: 激活计划', async ({ page }) => {
  await addWords(page, [['apple', '苹果']])
  await createPlan(page, '计划A')
  // 创建第二个计划（点"新建计划"按钮）
  await page.getByRole('button', { name: '新建计划' }).click()
  await page.waitForTimeout(500)
  await page.getByPlaceholder(/例如/).fill('计划B')
  await page.locator('.modal-overlay').getByRole('button', { name: /全部/ }).click()
  await page.getByRole('button', { name: /创建计划/ }).click()
  await page.waitForTimeout(500)

  // 激活计划B
  const activateBtns = page.getByRole('button', { name: /激活/ })
  await activateBtns.first().click()
  await expect(page.getByText('计划B').first()).toBeVisible()
})

test('TC-PLN-MGT-003: 删除计划', async ({ page }) => {
  await addWords(page, [['apple', '苹果']])
  await createPlan(page, '待删除')
  await page.getByRole('button', { name: /删除/ }).click()
  await page.getByRole('button', { name: /确认删除/ }).click()
  await expect(page.getByText('待删除')).toHaveCount(0)
})

test('TC-PLN-MGT-005: 激活计划进度卡片', async ({ page }) => {
  await addWords(page, [['apple', '苹果'], ['banana', '香蕉']])
  await createPlan(page, '进度计划')
  await expect(page.getByText('进行中')).toBeVisible()
  await expect(page.getByText('今日新词')).toBeVisible()
  await expect(page.getByText('总进度')).toBeVisible()
})

// --- 加学 (TC-EXTRA-001 ~ 005) ---

test('TC-EXTRA-001: 首页加学确认框', async ({ page }) => {
  await addWords(page, [['apple', '苹果'], ['banana', '香蕉'], ['cat', '猫']])
  // 每日新词=1，有 3 个词 → 学满1个后 remainingNew=2 → 弹加学框
  await createPlanWithQuota1(page, '加学计划')

  // 学 1 个词（回忆式认识）。等完成页出现 → 确保 markWordStarted 已写入 DB
  await page.goto(url('/study?plan=1&mode=learn'))
  await page.locator('h2').first().waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: '认识', exact: true }).click()
  await expect(page.getByText('今日学习已完成!')).toBeVisible({ timeout: 10000 })

  // 首页点"学习"应弹加学确认框
  await page.goto(url('/'))
  // 等今日任务卡片加载（live query 更新）
  await page.getByText('今日任务').waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: '学习', exact: true }).click()
  await expect(page.getByText('今日新词已学满')).toBeVisible()
})

test('TC-EXTRA-005: 取消加学', async ({ page }) => {
  await addWords(page, [['apple', '苹果'], ['banana', '香蕉']])
  await createPlanWithQuota1(page, '取消加学')
  await page.goto(url('/study?plan=1&mode=learn'))
  await page.locator('h2').first().waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: '认识', exact: true }).click()
  await expect(page.getByText('今日学习已完成!')).toBeVisible({ timeout: 10000 })

  await page.goto(url('/'))
  await page.getByText('今日任务').waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: '学习', exact: true }).click()
  await expect(page.getByText('今日新词已学满')).toBeVisible()
  await page.getByRole('button', { name: '取消', exact: true }).click()
  await expect(page.getByText('今日新词已学满')).toHaveCount(0)
})