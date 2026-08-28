import { test, expect } from '@playwright/test'
import { url, startStudyTest } from './helpers'

// ===== 语言上下文：英语/日语统一页面切换 =====

/** 首页 Hero 区切换到指定语言 */
async function switchLang(page: import('@playwright/test').Page, lang: '英语' | '日语') {
  await page.goto(url('/'))
  await page.getByRole('button', { name: lang }).first().click()
  await expect(page.getByRole('button', { name: lang })).toHaveAttribute('aria-pressed', 'true')
}

test('TC-LANG-001: 默认英语，切换日语后首页数据源切换', async ({ page }) => {
  await page.goto(url('/'))
  // 默认英语
  await expect(page.getByRole('heading', { name: '单词记忆' })).toBeVisible()
  // 切换日语
  await page.getByRole('button', { name: '日语' }).first().click()
  await expect(page.getByRole('heading', { name: '日语记忆' })).toBeVisible()
  // 日语模式隐藏短句入口
  await expect(page.getByText('短句学习')).toBeHidden()
  // 切回英语恢复
  await page.getByRole('button', { name: '英语' }).first().click()
  await expect(page.getByRole('heading', { name: '单词记忆' })).toBeVisible()
  await expect(page.getByText('短句学习')).toBeVisible()
})

test('TC-LANG-002: 语言选择持久化', async ({ page }) => {
  await switchLang(page, '日语')
  // 刷新后仍为日语
  await page.goto(url('/'))
  await expect(page.getByRole('heading', { name: '日语记忆' })).toBeVisible()
})

test('TC-LANG-003: 日语词添加后在日语词库可见，英语模式不可见', async ({ page }) => {
  await switchLang(page, '日语')
  await page.goto(url('/add'))
  // 日语表单：表记 + 假名必填
  await expect(page.getByPlaceholder('如：食べる')).toBeVisible()
  await page.getByPlaceholder('如：食べる').fill('食べる')
  await page.getByPlaceholder('如：たべる').fill('たべる')
  await page.getByPlaceholder('中文翻译').first().fill('吃')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/words$/)

  // 日语词库可见
  await page.goto(url('/words'))
  await expect(page.getByRole('heading', { name: '日语词库' })).toBeVisible()
  await expect(page.getByText('食べる', { exact: true })).toBeVisible({ timeout: 10000 })

  // 切英语：同一列表页显示英语单词，且不显示日语词
  await switchLang(page, '英语')
  await page.goto(url('/words'))
  await expect(page.getByRole('heading', { name: '单词列表' })).toBeVisible()
  await expect(page.getByText('暂无单词')).toBeVisible()
})

test('TC-LANG-004: 旧 /japanese 路由重定向并切换语言', async ({ page }) => {
  await page.goto(url('/japanese'))
  // 重定向到统一词库页 + 自动切换到日语
  await expect(page).toHaveURL(/\/words$/)
  await expect(page.getByRole('heading', { name: '日语词库' })).toBeVisible()
  // 语言偏好已持久化为日语
  await page.goto(url('/'))
  await expect(page.getByRole('heading', { name: '日语记忆' })).toBeVisible()
})

test('TC-LANG-005: 日语模式下计划页为日语词计划', async ({ page }) => {
  await switchLang(page, '日语')
  await page.goto(url('/plan'))
  await expect(page.getByRole('button', { name: '日语词计划' })).toBeVisible()
  // 短句计划 Tab 隐藏
  await expect(page.getByRole('button', { name: '短句计划' })).toBeHidden()
  // 创建日语计划
  await page.getByRole('button', { name: '新建计划' }).click()
  await page.getByPlaceholder(/CET-4/).fill('N5 四十日计划')
  await page.getByRole('button', { name: /创建计划/ }).click()
  await expect(page.getByText('N5 四十日计划').first()).toBeVisible({ timeout: 10000 })
})

test('TC-LANG-006: 分类按语言隔离', async ({ page }) => {
  // 日语模式新建分类
  await switchLang(page, '日语')
  await page.goto(url('/categories'))
  await page.getByRole('button', { name: '新建分类' }).click()
  await page.locator('.modal-content input').first().fill('日语语法词')
  await expect(page.getByRole('radio', { name: '日语词分类' })).toBeVisible()
  await page.getByRole('button', { name: '保存' }).click()
  await expect(page.getByRole('link', { name: /日语语法词/ })).toBeVisible({ timeout: 10000 })

  // 英语模式不可见
  await switchLang(page, '英语')
  await page.goto(url('/categories'))
  await expect(page.getByRole('link', { name: /默认/ }).first()).toBeVisible()
  await expect(page.getByText('日语语法词')).toBeHidden()
})

test('TC-LANG-007: 日语模式收藏夹独立于英语收藏夹', async ({ page }) => {
  await switchLang(page, '日语')
  await page.goto(url('/favorites'))
  await expect(page.getByRole('heading', { name: '收藏夹', exact: true })).toBeVisible()
  // 日语模式不显示实体 Tab（单词/短句）
  await expect(page.getByRole('button', { name: /^短句/ })).toBeHidden()
  // 新建日语收藏夹
  await page.getByRole('button', { name: '新建收藏夹' }).click()
  await page.getByPlaceholder('收藏夹名称').fill('日语重点')
  await page.getByRole('button', { name: '保存' }).click()
  await expect(page.getByRole('button', { name: /收藏夹 日语重点/ })).toBeVisible({ timeout: 10000 })

  // 英语模式看不到日语收藏夹
  await switchLang(page, '英语')
  await page.goto(url('/favorites'))
  await expect(page.getByText('日语重点')).toBeHidden()
})

test('TC-LANG-008: 日语批量导入（自动收藏/新建分类/默认分类落位）', async ({ page }) => {
  await switchLang(page, '日语')

  // 自动收藏导入（回归：事务内动态导入曾导致写入失败）
  await page.goto(url('/import'))
  await page.locator('textarea').fill(`[
    { "word": "食べる", "reading": "たべる", "translation": "吃" },
    { "word": "飲む", "reading": "のむ", "translation": "喝" }
  ]`)
  await page.getByRole('button', { name: /解析预览/ }).click()
  await page.waitForTimeout(200)
  await page.getByRole('checkbox').first().check()
  await page.getByRole('button', { name: /导入 \d+ 个/ }).click()
  await expect(page.getByText(/导入完成/)).toBeVisible({ timeout: 10000 })

  // 新建分类导入
  await page.getByRole('button', { name: /继续导入/ }).click()
  await page.locator('textarea').fill(`[{ "word": "行く", "reading": "いく", "translation": "去" }]`)
  await page.getByRole('button', { name: /解析预览/ }).click()
  await page.waitForTimeout(200)
  await page.locator('select').selectOption('__new__')
  await page.getByPlaceholder('新分类名称').fill('动词集')
  await page.getByRole('button', { name: /导入 \d+ 个/ }).click()
  await expect(page.getByText(/导入完成/)).toBeVisible({ timeout: 10000 })

  // 分类页面：默认「日语」分类与新建分类可见且无重复
  await page.goto(url('/categories'))
  await expect(page.getByRole('link', { name: /日语词汇/ })).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('link', { name: /日语词汇/ })).toHaveCount(1)
  await expect(page.getByRole('link', { name: /动词集/ })).toBeVisible()

  // 空分类详情页有批量导入入口
  await page.goto(url('/categories/' + encodeURIComponent('N4')))
  await expect(page.getByText('还没有内容')).toBeVisible()
  await expect(page.getByRole('link', { name: /批量导入日语词到本分类/ })).toBeVisible()

  // 默认「日语」分类详情页展示导入的词
  await page.goto(url('/categories/' + encodeURIComponent('日语')))
  await expect(page.getByText('食べる', { exact: true })).toBeVisible({ timeout: 10000 })
})

test('TC-LANG-009: 收藏夹空态「批量导入并收藏」走应用内路由', async ({ page }) => {
  // 回归：空态按钮曾用原生 <a href>，点击后丢失 /web_vocabulary 前缀导致 404
  await switchLang(page, '日语')
  await page.goto(url('/favorites'))
  await page.getByRole('link', { name: /批量导入并收藏/ }).click()
  // 应停留在带 basename 的应用内导入页，而不是 Vite 的 404 提示页
  await expect(page).toHaveURL(/\/import\?favorite=1$/)
  await expect(page.getByRole('heading', { name: '导入日语词' })).toBeVisible()
})

test('TC-LANG-010: 新格式导入（音调/meaning/notes）在列表与详情展示', async ({ page }) => {
  await switchLang(page, '日语')
  await page.goto(url('/import'))
  await page.locator('textarea').fill(`[
    {
      "word": "廊下",
      "reading": "ろうか",
      "accent": "⓪",
      "partOfSpeech": "名",
      "meaning": "走廊，廊下",
      "example": "廊下を歩く。",
      "exampleTranslation": "走走廊。",
      "category": "N5",
      "notes": "音调测试笔记"
    }
  ]`)
  await page.getByRole('button', { name: /解析预览/ }).click()
  // 预览表含音调列
  await expect(page.getByRole('cell', { name: '⓪' })).toBeVisible()
  await page.getByRole('button', { name: /导入 \d+ 个/ }).click()
  await expect(page.getByText(/导入完成/)).toBeVisible({ timeout: 10000 })

  // 词库卡片：音调 chip + 笔记行
  await page.goto(url('/words'))
  await expect(page.getByText('廊下', { exact: true })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('音调测试笔记')).toBeVisible()

  // 详情页：音调 chip + 笔记块
  await page.getByText('廊下', { exact: true }).click()
  await page.waitForURL(/\/word\/\d+/)
  await expect(page.getByText('⓪').first()).toBeVisible()
  await expect(page.getByText('音调测试笔记')).toBeVisible()
})

test('TC-LANG-011: 学习翻面显示笔记并可现场编辑', async ({ page }) => {
  await switchLang(page, '日语')
  await page.goto(url('/import'))
  await page.locator('textarea').fill(`[
    { "word": "勉強", "reading": "べんきょう", "meaning": "学习", "notes": "初始笔记" }
  ]`)
  await page.getByRole('button', { name: /解析预览/ }).click()
  await page.getByRole('button', { name: /导入 \d+ 个/ }).click()
  await expect(page.getByText(/导入完成/)).toBeVisible({ timeout: 10000 })

  // 进入新学（自由学习队列只有这一个词）
  await page.goto(url('/study'))
  await page.waitForTimeout(1500)
  await startStudyTest(page)
  // 翻面看释义
  await page.getByText('勉強').click()
  await expect(page.getByText('初始笔记')).toBeVisible()

  // 现场编辑笔记（NotesBlock 阻止冒泡，不会触发翻面）
  await page.getByLabel('编辑笔记').click()
  await page.locator('textarea').fill('更新后的笔记')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText('笔记已保存')).toBeVisible()
  await expect(page.getByText('更新后的笔记')).toBeVisible()
})

test('TC-LANG-012: 日语分类导入关闭跳过重复后允许跨分类导入同词', async ({ page }) => {
  await switchLang(page, '日语')

  // 先把同一个日语词导入 N5 分类
  await page.goto(url('/import?category=N5'))
  await page.locator('textarea').fill(`[
    { "word": "分類語", "reading": "ぶんるいご", "meaning": "分类词" }
  ]`)
  await page.getByRole('button', { name: /解析预览/ }).click()
  await page.getByRole('button', { name: /导入 \d+ 个/ }).click()
  await expect(page.getByText(/导入完成/)).toBeVisible({ timeout: 10000 })

  // 目标改为 N4，取消“跳过已存在”后再次导入同词
  await page.goto(url('/import?category=N4'))
  await page.locator('textarea').fill(`[
    { "word": "分類語", "reading": "ぶんるいご", "meaning": "分类词（N4）" }
  ]`)
  await page.getByRole('button', { name: /解析预览/ }).click()
  await page.locator('input[type="checkbox"]').nth(1).uncheck()
  await page.getByRole('button', { name: /导入 \d+ 个/ }).click()
  await expect(page.getByText(/导入完成/)).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('跳过: 0 个')).toBeVisible()

  // 两个分类都应各有一条同名日语词
  await page.goto(url('/categories/N4'))
  await expect(page.getByText('分類語', { exact: true })).toBeVisible({ timeout: 10000 })
})
