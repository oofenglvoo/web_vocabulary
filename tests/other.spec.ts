import { test, expect } from '@playwright/test'
import { url } from './helpers'

// ===== 全局路由与导航：P0-P2 测试用例 =====

test('TC-GLB-003: 404 页面', async ({ page }) => {
  await page.goto(url('/nonexistent-page'))
  await expect(page.getByText(/页面不存在/)).toBeVisible()
  await expect(page.getByRole('link', { name: /返回首页/ })).toBeVisible()
})

test('TC-GLB-001: 底部导航切换', async ({ page }) => {
  await page.goto(url('/'))
  // 点"单词"导航
  await page.getByRole('link', { name: /单词/ }).first().click()
  await expect(page.getByText('单词列表')).toBeVisible()
  // 点"计划"导航
  await page.getByRole('link', { name: /计划/ }).first().click()
  await expect(page.getByText('学习计划')).toBeVisible()
})

test('TC-GLB-002: 子路由高亮父导航', async ({ page }) => {
  await page.goto(url('/add'))
  // "单词"导航应高亮（aria-current）
  await expect(page.locator('a[aria-current="page"]', { hasText: /单词/ })).toBeVisible()
})

test('TC-GLB-004: 深色模式持久化', async ({ page }) => {
  await page.goto(url('/stats'))
  // 切换深色模式
  await page.getByText('深色模式').locator('..').locator('button').click()
  await expect(page.locator('html.dark')).toBeVisible()
  // 刷新后保持
  await page.reload()
  await expect(page.locator('html.dark')).toBeVisible()
})

// ===== 短句管理：P0-P2 =====

test('TC-SNT-001: 正常添加短句', async ({ page }) => {
  await page.goto(url('/sentences/add'))
  await page.getByPlaceholder(/输入英文短句/).fill('Hello')
  await page.getByPlaceholder(/中文翻译/).first().fill('你好')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText('Hello', { exact: true })).toBeVisible()
})

test('TC-SNT-002: 空短句校验', async ({ page }) => {
  await page.goto(url('/sentences/add'))
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText(/短句不能为空/)).toBeVisible()
})

test('TC-SNT-LIST-001: 短句列表显示', async ({ page }) => {
  await page.goto(url('/sentences/add'))
  await page.getByPlaceholder(/输入英文短句/).fill('How are you')
  await page.getByPlaceholder(/中文翻译/).first().fill('你好吗')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/sentences/)

  await page.goto(url('/sentences'))
  await expect(page.getByText('How are you', { exact: true })).toBeVisible()
})

// ===== 导入：P0-P2 =====

test('TC-IMP-W-001: JSON 格式导入', async ({ page }) => {
  await page.goto(url('/import'))
  await page.getByRole('button', { name: /使用示例/ }).click()
  await page.getByRole('button', { name: /解析预览/ }).click()
  await expect(page.getByText(/共 \d+ 个有效单词/)).toBeVisible()
  await page.getByRole('button', { name: /导入 \d+ 个单词/ }).click()
  await expect(page.getByText(/成功导入/)).toBeVisible()
})

test('TC-IMP-W-004: 仅 definitions 数组的 JSON 导入', async ({ page }) => {
  await page.goto(url('/import'))
  await page.locator('textarea').fill(`[
    {
      "word": "ecosystem",
      "definitions": [
        { "pos": "n.", "def": "a system", "trans": "生态系统" }
      ],
      "category": "IELTS-环境",
      "difficulty": 4
    }
  ]`)
  await page.getByRole('button', { name: /解析预览/ }).click()
  await expect(page.getByText(/共 \d+ 个有效单词/)).toBeVisible()
  await page.getByRole('button', { name: /导入 \d+ 个单词/ }).click()
  await expect(page.getByText(/成功导入/)).toBeVisible()

  // 词应出现在列表
  await page.goto(url('/words'))
  await page.getByPlaceholder(/搜索单词/).fill('ecosystem')
  await expect(page.getByText('ecosystem', { exact: true })).toBeVisible()
})

test('TC-IMP-W-006: 跳过重复', async ({ page }) => {
  // 先添加 apple
  await page.goto(url('/add'))
  await page.getByPlaceholder('输入英文单词').fill('apple')
  await page.getByPlaceholder(/中文翻译/).first().fill('苹果')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/words/)

  // 导入包含 apple 的 JSON
  await page.goto(url('/import'))
  await page.locator('textarea').fill(`[{"word":"apple","definitions":[{"pos":"","def":"","trans":"苹果"}],"category":"默认","difficulty":1},{"word":"pear","definitions":[{"pos":"","def":"","trans":"梨"}],"category":"默认","difficulty":1}]`)
  await page.getByRole('button', { name: /解析预览/ }).click()
  await page.getByRole('button', { name: /导入 \d+ 个单词/ }).click()
  // 应显示成功导入（只导入 pear），或含跳过
  await expect(page.getByText(/成功导入/)).toBeVisible()
})

// ===== 分类：P0-P2 =====

test('TC-CAT-001: 显示默认分类', async ({ page }) => {
  await page.goto(url('/categories'))
  await expect(page.getByText('默认').first()).toBeVisible()
  await expect(page.getByText('CET-4').first()).toBeVisible()
})

test('TC-CAT-002: 新建分类', async ({ page }) => {
  await page.goto(url('/categories'))
  await page.getByRole('button', { name: /新建分类/ }).click()
  await page.getByPlaceholder(/分类名称/).fill('我的分类')
  await page.getByRole('button', { name: /保存/ }).click()
  await expect(page.getByText('我的分类')).toBeVisible()
})

test('TC-CAT-005: 空名称校验', async ({ page }) => {
  await page.goto(url('/categories'))
  await page.getByRole('button', { name: /新建分类/ }).click()
  await page.getByRole('button', { name: /保存/ }).click()
  await expect(page.getByText(/名称不能为空/)).toBeVisible()
})

test('TC-CAT-008: 分类详情不存在', async ({ page }) => {
  await page.goto(url('/categories/不存在的分类'))
  await expect(page.getByText(/分类不存在/)).toBeVisible()
})

// ===== 收藏夹：P0-P2 =====

test('TC-FAV-006: 空收藏夹', async ({ page }) => {
  await page.goto(url('/favorites'))
  await expect(page.getByText(/收藏夹是空的/)).toBeVisible()
})

// ===== 打卡：P0-P2 =====

test('TC-CHK-001: 打卡页加载', async ({ page }) => {
  await page.goto(url('/checkin'))
  await expect(page.getByRole('heading', { name: '打卡' })).toBeVisible()
  await expect(page.getByText('累计天数')).toBeVisible()
  await expect(page.getByText('连续天数')).toBeVisible()
  await expect(page.getByText('我的勋章')).toBeVisible()
})

test('TC-CHK-002: 学习后打卡天数增加', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder('输入英文单词').fill('test')
  await page.getByPlaceholder(/中文翻译/).first().fill('测试')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/words/)

  await page.goto(url('/study'))
  await page.waitForSelector('text=回忆式')
  await page.waitForTimeout(1000)
  await page.getByRole('button', { name: '认识', exact: true }).click()

  await page.goto(url('/checkin'))
  const cell = page.getByText('累计天数').locator('..')
  await expect(cell).toBeVisible()
  await expect(cell.locator('div').first()).not.toHaveText('')
})

test('TC-ACHV-001: 勋章墙显示', async ({ page }) => {
  await page.goto(url('/checkin'))
  await expect(page.getByText(/我的勋章/)).toBeVisible()
})

// ===== 统计：P0-P2 =====

test('TC-STAT-001: 学习统计显示', async ({ page }) => {
  await page.goto(url('/stats'))
  await expect(page.getByText('学习统计')).toBeVisible()
  await expect(page.getByText('总单词')).toBeVisible()
})

test('TC-STAT-003: 深色模式切换', async ({ page }) => {
  await page.goto(url('/stats'))
  await page.getByText('深色模式').locator('..').locator('button').click()
  await expect(page.locator('html.dark')).toBeVisible()
})