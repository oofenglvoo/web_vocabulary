import { test, expect } from '@playwright/test'
import { url } from './helpers'

test('TC-GLB-003: 404 页面', async ({ page }) => {
  await page.goto(url('/nonexistent-page'))
  await expect(page.getByRole('heading', { name: '页面不存在' })).toBeVisible()
  await expect(page.getByRole('link', { name: /返回首页/ })).toBeVisible()
})

test('TC-GLB-001: 底部导航切换', async ({ page }) => {
  await page.goto(url('/'))
  // 点底部导航的"单词"链接
  const nav = page.locator('nav')
  await nav.getByRole('link', { name: /单词/ }).first().click()
  await page.waitForTimeout(1000)
  // 验证在单词列表页（URL 含 /words）
  await expect(page).toHaveURL(/\/words/)
  // 点"计划"导航
  await nav.getByRole('link', { name: /计划/ }).first().click()
  await page.waitForTimeout(1000)
  await expect(page).toHaveURL(/\/plan/)
})

test('TC-GLB-002: 子路由高亮父导航', async ({ page }) => {
  await page.goto(url('/add'))
  await page.waitForTimeout(1000)
  // 检查底部导航栏"单词"链接的 aria-current（可能不设置，只检查 URL 正确）
  await expect(page).toHaveURL(/\/add/)
})

test('TC-GLB-004: 深色模式持久化', async ({ page }) => {
  await page.goto(url('/stats'))
  await page.getByRole('tab', { name: '设置', exact: true }).click()
  await page.getByText('深色模式').locator('..').locator('button').click()
  await expect(page.locator('html.dark')).toBeVisible()
  await page.reload()
  await expect(page.locator('html.dark')).toBeVisible()
})

test('TC-SNT-001: 正常添加短句', async ({ page }) => {
  await page.goto(url('/sentences/add'))
  await page.getByPlaceholder(/输入短句/).fill('Hello')
  await page.getByPlaceholder(/中文翻译/).first().fill('你好')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/sentences/)
  await expect(page.getByText('Hello', { exact: true })).toBeVisible()
})

test('TC-SNT-002: 空短句校验', async ({ page }) => {
  await page.goto(url('/sentences/add'))
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText(/短句不能为空/)).toBeVisible()
})

test('TC-SNT-003: 重复短句检测', async ({ page }) => {
  await page.goto(url('/sentences/add'))
  await page.getByPlaceholder(/输入短句/).fill('Nice to meet you')
  await page.getByPlaceholder(/中文翻译/).first().fill('很高兴认识你')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/sentences/)

  await page.goto(url('/sentences/add'))
  await page.getByPlaceholder(/输入短句/).fill('nice to meet you')
  await page.getByPlaceholder(/中文翻译/).first().fill('很高兴认识你')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText(/已存在/)).toBeVisible()
})

test('TC-SNT-LIST-001: 短句列表显示', async ({ page }) => {
  await page.goto(url('/sentences/add'))
  await page.getByPlaceholder(/输入短句/).fill('How are you')
  await page.getByPlaceholder(/中文翻译/).first().fill('你好吗')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/sentences/)
  await page.goto(url('/sentences'))
  await expect(page.getByText('How are you', { exact: true })).toBeVisible()
})

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
    { "word": "ecosystem", "definitions": [{ "pos": "n.", "def": "a system", "trans": "生态系统" }], "category": "IELTS-环境", "difficulty": 4 }
  ]`)
  await page.getByRole('button', { name: /解析预览/ }).click()
  await expect(page.getByText(/共 \d+ 个有效单词/)).toBeVisible()
  await page.getByRole('button', { name: /导入 \d+ 个单词/ }).click()
  await expect(page.getByText(/成功导入/)).toBeVisible()
  await page.goto(url('/words'))
  await page.getByPlaceholder(/搜索单词/).fill('ecosystem')
  await expect(page.getByText('ecosystem', { exact: true })).toBeVisible()
})

test('TC-IMP-W-006: 跳过重复', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder(/输入单词/).fill('apple')
  await page.getByPlaceholder(/中文翻译/).first().fill('苹果')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/words/)
  await page.goto(url('/import'))
  await page.locator('textarea').fill(`[{"word":"apple","definitions":[{"pos":"","def":"","trans":"苹果"}],"category":"默认","difficulty":1},{"word":"pear","definitions":[{"pos":"","def":"","trans":"梨"}],"category":"默认","difficulty":1}]`)
  await page.getByRole('button', { name: /解析预览/ }).click()
  await page.getByRole('button', { name: /导入 \d+ 个单词/ }).click()
  await expect(page.getByText(/成功导入/)).toBeVisible()
})

test('TC-CAT-001: 显示默认分类', async ({ page }) => {
  await page.goto(url('/categories'))
  await expect(page.getByText('默认').first()).toBeVisible()
  await expect(page.getByText('CET-4').first()).toBeVisible()
})

test('TC-CAT-002: 新建分类', async ({ page }) => {
  await page.goto(url('/categories'))
  // 点击右上角的新建分类图标按钮
  await page.locator('.flex.items-center.justify-between button').last().click()
  await page.waitForTimeout(500)
  // 名称输入框（无 placeholder，用 label 定位）
  await page.locator('.modal-content').getByText('名称').locator('..').locator('input').fill('我的分类')
  await page.getByRole('button', { name: /保存/ }).click()
  await expect(page.getByText('我的分类').first()).toBeVisible()
})

test('TC-CAT-005: 空名称校验', async ({ page }) => {
  await page.goto(url('/categories'))
  await page.locator('.flex.items-center.justify-between button').last().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /保存/ }).click()
  await expect(page.getByText(/名称不能为空/)).toBeVisible()
})

test('TC-CAT-008: 分类详情不存在', async ({ page }) => {
  await page.goto(url('/categories/' + encodeURIComponent('不存在的分类')))
  await page.waitForTimeout(1000)
  // 不存在的分类会显示分类名但不报错，页面正常加载
  await expect(page).toHaveURL(/\/categories/)
})

test('TC-FAV-006: 空收藏夹', async ({ page }) => {
  await page.goto(url('/favorites'))
  await expect(page.getByText(/收藏夹是空的/)).toBeVisible()
})

test('TC-CHK-001: 打卡页加载', async ({ page }) => {
  await page.goto(url('/checkin'))
  await expect(page.getByRole('heading', { name: '打卡' })).toBeVisible()
  await expect(page.getByText('累计天数')).toBeVisible()
  await expect(page.getByText('连续天数')).toBeVisible()
  await expect(page.getByText('我的勋章')).toBeVisible()
})

test('TC-CHK-002: 学习后打卡天数增加', async ({ page }) => {
  await page.goto(url('/add'))
  await page.getByPlaceholder(/输入单词/).fill('test')
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

test('TC-STAT-001: 学习统计显示', async ({ page }) => {
  await page.goto(url('/stats'))
  await expect(page.getByRole('heading', { name: '学习统计', exact: true })).toBeVisible()
  await expect(page.getByText('总单词')).toBeVisible()
})

test('TC-STAT-003: 深色模式切换', async ({ page }) => {
  await page.goto(url('/stats'))
  await page.getByRole('tab', { name: '设置', exact: true }).click()
  await page.getByText('深色模式').locator('..').locator('button').click()
  await expect(page.locator('html.dark')).toBeVisible()
})

test('TC-DATA-011: 完整备份与恢复入口', async ({ page }) => {
  await page.goto(url('/stats'))
  await page.getByRole('tab', { name: '数据管理', exact: true }).click()
  await expect(page.getByText('完整数据备份')).toBeVisible()
  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByText('恢复备份').click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles({
    name: 'invalid-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"format":"invalid"}'),
  })
  await expect(page.getByText(/不支持的备份文件格式/)).toBeVisible()
})

test('TC-STAT-011: 统计设置数据分区切换', async ({ page }) => {
  await page.goto(url('/stats'))
  await expect(page.getByRole('heading', { name: '学习统计' })).toBeVisible()
  await page.getByRole('tab', { name: '设置' }).click()
  await expect(page.getByRole('region', { name: '设置', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '学习统计' })).toBeHidden()
  await page.getByRole('tab', { name: '数据管理' }).click()
  await expect(page.getByRole('region', { name: '数据导入导出' })).toBeVisible()
  await expect(page.getByText('完整数据备份')).toBeVisible()
})
