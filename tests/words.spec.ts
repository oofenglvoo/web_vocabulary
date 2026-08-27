import { test, expect } from '@playwright/test'
import { url } from './helpers'

// ===== 单词管理：P0-P2 级别测试用例 =====

// --- 添加单词 (TC-ADD-001 ~ 010) ---

// 等待 AddWord 完成水合且分类数据已从 Dexie 载入（避免冷启动竞态）
async function waitForAddPageReady(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    () => {
      const sel = document.querySelectorAll('select')[1]
      return !!sel && sel.options.length > 0
    },
    { timeout: 20000 }
  )
}

test('TC-ADD-001: 正常添加单词', async ({ page }) => {
  await page.goto(url('/add'))
  await waitForAddPageReady(page)
  await page.getByPlaceholder(/输入单词/).fill('apple')
  await page.getByPlaceholder(/中文翻译/).first().fill('苹果')
  await page.getByRole('button', { name: '保存', exact: true }).click()

  await page.goto(url('/words'))
  await page.getByText('apple', { exact: true }).waitFor({ timeout: 10000 })
  await expect(page.getByText('apple', { exact: true })).toBeVisible()
})

test('TC-ADD-002: 添加多释义单词', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder(/输入单词/).fill('bank')
  await page.getByPlaceholder(/中文翻译/).first().fill('银行')
  await page.getByRole('button', { name: /添加释义/ }).click()
  await expect(page.getByPlaceholder(/中文翻译/).nth(1)).toBeVisible()
  await page.getByPlaceholder(/中文翻译/).nth(1).fill('河岸')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/words/)

  // 详情页应显示两个释义
  await page.goto(url('/words'))
  await page.getByText('bank', { exact: true }).waitFor({ timeout: 10000 })
  await page.getByText('bank', { exact: true }).click()
  await expect(page.getByText('银行')).toBeVisible()
  await expect(page.getByText('河岸')).toBeVisible()
})

test('TC-ADD-003: 添加带词性的释义', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder(/输入单词/).fill('run')
  await page.getByPlaceholder(/中文翻译/).first().fill('跑步')
  // 选词性 v.
  await page.locator('select').first().selectOption('v.')
  await page.getByRole('button', { name: /添加释义/ }).click()
  await page.getByPlaceholder(/中文翻译/).nth(1).fill('奔跑')
  await page.locator('select').nth(1).selectOption('n.')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/words/)

  await page.goto(url('/words'))
  await page.getByText('run', { exact: true }).waitFor({ timeout: 10000 })
  await page.getByText('run', { exact: true }).click()
  await expect(page.getByText('v.')).toBeVisible()
  await expect(page.getByText('n.')).toBeVisible()
})

test('TC-ADD-004: 单词为空校验', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText(/单词不能为空/)).toBeVisible()
  // 页面不跳转（仍在 /add）
  await expect(page).toHaveURL(/\/add/)
})

test('TC-ADD-005: 释义为空校验', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder(/输入单词/).fill('test')
  // 不填释义直接保存
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText(/至少需要一个释义/)).toBeVisible()
})

test('TC-ADD-006: 重复单词检测', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder(/输入单词/).fill('apple')
  await page.getByPlaceholder(/中文翻译/).first().fill('苹果')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/words/)

  await page.goto(url('/add'))
  await page.getByPlaceholder(/输入单词/).fill('apple')
  await page.getByPlaceholder(/中文翻译/).first().fill('苹果')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText(/已存在/)).toBeVisible()
})

test('TC-ADD-007: 删除释义', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder(/输入单词/).fill('multi')
  await page.getByPlaceholder(/中文翻译/).first().fill('多')
  await page.getByRole('button', { name: /添加释义/ }).click()
  await page.getByPlaceholder(/中文翻译/).nth(1).fill('重')
  // 添加第三条释义，然后删除它
  await page.getByRole('button', { name: /添加释义/ }).click()
  const deleteBtns = page.getByRole('button', { name: /删除此释义/ })
  await expect(deleteBtns).toHaveCount(3)
  await deleteBtns.last().click()
  // 只剩 2 条
  await expect(page.getByRole('button', { name: /删除此释义/ })).toHaveCount(2)
})

test('TC-ADD-010: 单词仅空格', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder(/输入单词/).fill('   ')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText(/单词不能为空/)).toBeVisible()
})

// --- 单词列表 (TC-LIST-001 ~ 010) ---

test('TC-LIST-001: 搜索精确匹配', async ({ page }) => {
  for (const [word, trans] of [['apple', '苹果'], ['banana', '香蕉']]) {
    await page.goto(url('/add'))
    await page.getByPlaceholder(/输入单词/).fill(word)
    await page.getByPlaceholder(/中文翻译/).first().fill(trans)
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await page.waitForURL(/\/words/)
  }
  await page.goto(url('/words'))
  await page.getByPlaceholder(/搜索单词/).fill('apple')
  await expect(page.getByText('apple', { exact: true })).toBeVisible()
  await expect(page.getByText('banana', { exact: true })).toHaveCount(0)
})

test('TC-LIST-002: 搜索模糊匹配', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder(/输入单词/).fill('apple')
  await page.getByPlaceholder(/中文翻译/).first().fill('苹果')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/words/)

  await page.goto(url('/words'))
  await page.getByPlaceholder(/搜索单词/).fill('appl')
  await expect(page.getByText('apple', { exact: true })).toBeVisible()
})

test('TC-LIST-003: 搜索中文翻译', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder(/输入单词/).fill('apple')
  await page.getByPlaceholder(/中文翻译/).first().fill('苹果')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/words/)

  await page.goto(url('/words'))
  await page.getByPlaceholder(/搜索单词/).fill('苹果')
  await expect(page.getByText('apple', { exact: true })).toBeVisible()
})

test('TC-LIST-004: 分类筛选', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder(/输入单词/).fill('apple')
  await page.getByPlaceholder(/中文翻译/).first().fill('苹果')
  await page.locator('select').filter({ hasText: /默认|CET|雅思/ }).selectOption('CET-4')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/words/)

  await page.goto(url('/words'))
  // 点击 "CET-4" 分类（第一个 CET-4 是分类 chip，不是卡片）
  await page.getByRole('button', { name: '全部', exact: true }).first().click()
  await page.getByRole('button', { name: 'CET-4', exact: true }).first().click()
  await expect(page.getByText('apple', { exact: true })).toBeVisible()
})

test('TC-LIST-005: 多选模式', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder(/输入单词/).fill('apple')
  await page.getByPlaceholder(/中文翻译/).first().fill('苹果')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/words/)

  await page.goto(url('/add'))
  await page.getByPlaceholder(/输入单词/).fill('banana')
  await page.getByPlaceholder(/中文翻译/).first().fill('香蕉')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/words/)

  await page.goto(url('/words'))
  // 点多选按钮
  await page.getByRole('button', { name: /多选/ }).click()
  // 应出现多选操作栏
  await expect(page.getByText(/已选/)).toBeVisible()
})

test('TC-LIST-007: 批量删除', async ({ page }) => {
  for (const w of [['a1', 'a1'], ['b2', 'b2']]) {
    await page.goto(url('/add'))
    await page.getByPlaceholder(/输入单词/).fill(w[0])
    await page.getByPlaceholder(/中文翻译/).first().fill(w[1])
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await page.waitForURL(/\/words/)
  }
  await page.goto(url('/words'))
  await page.getByRole('button', { name: /多选/ }).click()
  // 全选
  await page.getByRole('button', { name: /全选/ }).click()
  // 点批量操作栏的"删除"（有可见文本，非 card 图标按钮）
  await page.getByText('删除').first().click()
  // 确认删除（ConfirmModal 的确认按钮，文本是"删除"）
  await page.getByRole('button', { name: '删除', exact: true }).last().click()
  await page.waitForTimeout(500)
  // 列表应空
  await expect(page.getByText(/暂无单词/)).toBeVisible()
})

test('TC-LIST-009: 空列表', async ({ page }) => {
  await page.goto(url('/words'))
  await expect(page.getByText(/暂无单词/)).toBeVisible()
})

test('TC-LIST-010: 搜索无结果', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder(/输入单词/).fill('apple')
  await page.getByPlaceholder(/中文翻译/).first().fill('苹果')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/words/)

  await page.goto(url('/words'))
  await page.getByPlaceholder(/搜索单词/).fill('zzzzzz')
  await expect(page.getByText(/未找到匹配/)).toBeVisible()
})

// --- 单词详情 (TC-DTL-001 ~ 010) ---

test('TC-DTL-001: 显示单词详情', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder(/输入单词/).fill('apple')
  await page.getByPlaceholder(/中文翻译/).first().fill('苹果')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/words/)

  await page.goto(url('/words'))
  await page.getByText('apple', { exact: true }).waitFor({ timeout: 10000 })
  await page.getByText('apple', { exact: true }).click()
  await expect(page.getByText('apple')).toBeVisible()
  await expect(page.getByText('苹果')).toBeVisible()
  await expect(page.getByText(/学习数据/)).toBeVisible()
})

test('TC-DTL-002: 收藏/取消收藏', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder(/输入单词/).fill('star')
  await page.getByPlaceholder(/中文翻译/).first().fill('星星')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/words/)

  await page.goto(url('/words'))
  await page.getByText('star', { exact: true }).waitFor({ timeout: 10000 })
  await page.getByText('star', { exact: true }).click()
  // 心形按钮 → 面板勾选默认夹 → 确定
  await page.getByRole('button', { name: '加入收藏' }).click()
  await page.getByRole('checkbox').first().check()
  await page.getByRole('button', { name: /确定 \(1\)/ }).click()
  await expect(page.getByText('已收藏')).toBeVisible()

  await page.goto(url('/favorites'))
  await expect(page.getByText('star', { exact: true })).toBeVisible()
})

test('TC-DTL-003: 编辑释义', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder(/输入单词/).fill('edit')
  await page.getByPlaceholder(/中文翻译/).first().fill('编辑')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/words/)

  await page.goto(url('/words'))
  await page.getByText('edit', { exact: true }).waitFor({ timeout: 10000 })
  await page.getByText('edit', { exact: true }).click()
  await page.getByRole('button', { name: /编辑释义/ }).click()
  await page.getByPlaceholder(/中文翻译/).first().fill('修订')
  await page.getByRole('button', { name: /保存/ }).first().click()
  await expect(page.getByText('修订')).toBeVisible()
})

test('TC-DTL-005: 删除单词', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder(/输入单词/).fill('delete')
  await page.getByPlaceholder(/中文翻译/).first().fill('删除')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/words/)

  await page.goto(url('/words'))
  await page.getByText('delete', { exact: true }).waitFor({ timeout: 10000 })
  await page.getByText('delete', { exact: true }).click()
  await page.getByRole('button', { name: /删除单词/ }).click()
  await page.getByRole('button', { name: /删除/ }).last().click()
  // 等跳转回列表
  await page.waitForURL(/\/words/)
  await page.waitForTimeout(500)
  await expect(page.getByText('delete', { exact: true })).toHaveCount(0)
})

test('TC-DTL-006: 上下切换', async ({ page }) => {
  for (const [w, t] of [['first', '第一'], ['second', '第二']]) {
    await page.goto(url('/add'))
    await page.getByPlaceholder(/输入单词/).fill(w)
    await page.getByPlaceholder(/中文翻译/).first().fill(t)
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await page.waitForURL(/\/words/)
  }
  await page.goto(url('/words'))
  // 点 second（最新创建，在列表最前，有下一个）
  await page.getByText('second', { exact: true }).waitFor({ timeout: 10000 })
  await page.getByText('second', { exact: true }).click()
  await page.getByRole('button', { name: /下一个/ }).click()
  await expect(page.getByText('first')).toBeVisible()
})

test('TC-DTL-008: 边界不可切换', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder(/输入单词/).fill('only')
  await page.getByPlaceholder(/中文翻译/).first().fill('唯一')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/words/)

  await page.goto(url('/words'))
  await page.getByText('only', { exact: true }).waitFor({ timeout: 10000 })
  await page.getByText('only', { exact: true }).click()
  await expect(page.getByText(/已是第一个/)).toBeVisible()
  await expect(page.getByText(/已是最后一个/)).toBeVisible()
})

test('TC-DTL-009: 编辑释义取消', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder(/输入单词/).fill('undo')
  await page.getByPlaceholder(/中文翻译/).first().fill('撤销')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/words/)

  await page.goto(url('/words'))
  await page.getByText('undo', { exact: true }).waitFor({ timeout: 10000 })
  await page.getByText('undo', { exact: true }).click()
  await page.getByRole('button', { name: /编辑释义/ }).click()
  await page.getByPlaceholder(/中文翻译/).first().fill('新的')
  await page.getByRole('button', { name: /取消/ }).first().click()
  await expect(page.getByText('撤销')).toBeVisible()
})

test('TC-DTL-010: 编辑空释义验证', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder(/输入单词/).fill('empty')
  await page.getByPlaceholder(/中文翻译/).first().fill('空')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/words/)

  await page.goto(url('/words'))
  await page.getByText('empty', { exact: true }).waitFor({ timeout: 10000 })
  await page.getByText('empty', { exact: true }).click()
  await page.getByRole('button', { name: /编辑释义/ }).click()
  await page.getByPlaceholder(/中文翻译/).first().fill('')
  await page.getByRole('button', { name: /保存/ }).first().click()
  await expect(page.getByText(/至少需要一个释义/)).toBeVisible()
})
