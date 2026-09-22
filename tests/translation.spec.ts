import { test, expect } from '@playwright/test'
import { url } from './helpers'

async function mockTranslation(page: import('@playwright/test').Page, translation = '测试译文') {
  // Google 为主通道，优先命中；MyMemory 作为回退也一并 mock
  await page.route('**translate.googleapis.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([[[translation, 'source', null, null, 10]], null, 'en', []]),
    })
  })
  await page.route('**/api.mymemory.translated.net/get**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        responseStatus: 200,
        responseData: { translatedText: translation },
        matches: [{ translation }],
      }),
    })
  })
}

async function mockGoogleFailure(page: import('@playwright/test').Page) {
  await page.route('**translate.googleapis.com/**', (route) => route.abort())
}

async function addEnglishWord(page: import('@playwright/test').Page, word: string) {
  await page.goto(url('/add'))
  await page.getByPlaceholder(/输入单词/).fill(word)
  await page.getByPlaceholder(/中文翻译/).first().fill('本地释义')
  await page.getByPlaceholder('释义（英/日）').first().fill('a local definition')
  await page.getByPlaceholder('输入例句').fill('This is a local example.')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/words/)
}

/** 通过列表点击进入指定单词的详情页 */
async function openWordDetail(page: import('@playwright/test').Page, word: string) {
  await page.goto(url('/words'))
  await page.getByText(word, { exact: true }).first().waitFor({ timeout: 10000 })
  await page.getByText(word, { exact: true }).first().click()
  await page.waitForURL(/\/word\/\d+/)
}

test.describe('在线翻译增量测试', () => {
  test('TC-TRANS-001: 首页搜索框跳转到翻译页', async ({ page }) => {
    await page.goto(url('/'))
    const input = page.getByLabel('翻译内容')
    await expect(input).toBeVisible()
    await input.fill('hello world')
    await page.getByRole('button', { name: '翻译', exact: true }).click()
    await expect(page).toHaveURL(/\/translate\?q=hello(%20|\+)world/)
  })

  test('TC-TRANS-002: 自动翻译并显示识别语言', async ({ page }) => {
    await mockTranslation(page, '你好世界')
    await page.goto(url('/translate?q=hello%20world'))
    await expect(page.getByText('已识别为：英语')).toBeVisible()
    await expect(page.getByText('你好世界', { exact: true })).toBeVisible()
    await expect(page.getByText('在线翻译（Google）')).toBeVisible()
  })

  test('TC-TRANS-003: 日语输入自动识别并翻译', async ({ page }) => {
    await mockTranslation(page, '你好')
    await page.goto(url('/translate?q=%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF'))
    await expect(page.getByText('已识别为：日语')).toBeVisible()
    await expect(page.getByText('你好', { exact: true })).toBeVisible()
  })

  test('TC-TRANS-004: 匹配本地英语词库并显示详情', async ({ page }) => {
    const word = `translation-local-${Date.now()}`
    await addEnglishWord(page, word)
    await mockTranslation(page)
    await page.goto(url(`/translate?q=${encodeURIComponent(word)}`))
    await expect(page.getByText('本地词库匹配')).toBeVisible()
    await expect(page.getByText('本地释义', { exact: true })).toBeVisible()
    await expect(page.getByText('This is a local example.', { exact: true })).toBeVisible()
    await expect(page.getByText('分类：默认', { exact: true })).toBeVisible()
  })

  test('TC-TRANS-005: 日语页面搜索英语词也匹配英语本地词库', async ({ page }) => {
    const word = `translation-ja-page-${Date.now()}`
    await addEnglishWord(page, word)
    await page.goto(url('/'))
    await page.getByRole('button', { name: '日语', exact: true }).click()
    await mockTranslation(page)
    await page.goto(url(`/translate?q=${encodeURIComponent(word)}`))
    await expect(page.getByText('已识别为：英语')).toBeVisible()
    await expect(page.getByText('本地词库匹配')).toBeVisible()
    await expect(page.getByText('本地释义', { exact: true })).toBeVisible()
  })

  test('TC-TRANS-006: Google 失败回退 MyMemory 且短词优先用实际译文', async ({ page }) => {
    await mockGoogleFailure(page)
    await page.route('**/api.mymemory.translated.net/get**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          responseStatus: 200,
          responseData: { translatedText: 'address' },
          matches: [
            { translation: 'address', match: 0.99 },
            { translation: '地址', match: 0.99 },
          ],
        }),
      })
    })
    await page.goto(url('/translate?q=address'))
    await expect(page.getByText('地址', { exact: true })).toBeVisible()
    await expect(page.getByText('address', { exact: true })).toHaveCount(1)
    await expect(page.getByText('在线翻译（MyMemory）')).toBeVisible()
  })

  test('TC-TRANS-AUTO-001: 开关默认关闭，详情页不自动翻译', async ({ page }) => {
    const word = `auto-off-${Date.now()}`
    await addEnglishWord(page, word)
    let googleCalls = 0
    await page.route('**translate.googleapis.com/**', async (route) => {
      googleCalls += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([[[`译文-${word}`, 'source', null, null, 10]], null, 'en', []]),
      })
    })
    await openWordDetail(page, word)
    await expect(page.getByRole('heading', { name: word })).toBeVisible()
    await expect(page.locator('[data-auto-translation]')).toHaveCount(0)
    expect(googleCalls).toBe(0)
  })

  test('TC-TRANS-AUTO-002: 开启后进入英语词详情自动翻译并持久化', async ({ page }) => {
    const word = `auto-on-${Date.now()}`
    await addEnglishWord(page, word)
    await mockTranslation(page, `自动译文-${word}`)
    await openWordDetail(page, word)
    await page.getByRole('button', { name: '开启自动翻译' }).click()
    await expect(page.locator('[data-auto-translation]')).toBeVisible()
    await expect(page.getByText(`自动译文-${word}`, { exact: true })).toBeVisible()
    await expect(page.getByText('在线翻译（Google）')).toBeVisible()

    // 刷新后开关保持开启并继续自动翻译
    await page.reload()
    await expect(page.locator('[data-auto-translation]')).toBeVisible()
    await expect(page.getByText(`自动译文-${word}`, { exact: true })).toBeVisible()
  })

  test('TC-TRANS-AUTO-003: 切换单词后译文随之更新', async ({ page }) => {
    const word = `auto-switch-${Date.now()}`
    const other = `auto-switch2-${Date.now()}`
    await addEnglishWord(page, word)
    await addEnglishWord(page, other)
    await page.route('**translate.googleapis.com/**', async (route) => {
      const q = new URL(route.request().url()).searchParams.get('q') ?? ''
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([[[`译文:${q}`, 'source', null, null, 10]], null, 'en', []]),
      })
    })
    await openWordDetail(page, word)
    await page.getByRole('button', { name: '开启自动翻译' }).click()
    await expect(page.getByText(`译文:${word}`, { exact: true })).toBeVisible()

    // 点上一个词，译文应更新为另一个词
    await page.getByRole('button', { name: /上一个/ }).click()
    await expect(page.getByText(`译文:${other}`, { exact: true })).toBeVisible()
    await expect(page.getByText(`译文:${word}`, { exact: true })).toHaveCount(0)
  })

  test('TC-TRANS-AUTO-004: 关闭开关后不再自动翻译', async ({ page }) => {
    const word = `auto-close-${Date.now()}`
    await addEnglishWord(page, word)
    await mockTranslation(page, `关闭前译文-${word}`)
    await openWordDetail(page, word)
    await page.getByRole('button', { name: '开启自动翻译' }).click()
    await expect(page.locator('[data-auto-translation]')).toBeVisible()

    await page.getByRole('button', { name: '关闭自动翻译' }).click()
    await expect(page.locator('[data-auto-translation]')).toHaveCount(0)
  })

  test('TC-TRANS-AUTO-005: 日语词详情不自动翻译', async ({ page }) => {
    await page.goto(url('/'))
    await page.getByRole('button', { name: '日语', exact: true }).click()
    await page.goto(url('/add'))
    await page.getByPlaceholder('如：食べる').fill('ねこ')
    await page.getByPlaceholder('如：たべる').fill('ねこ')
    await page.getByPlaceholder('中文翻译').first().fill('猫')
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await page.waitForURL(/\/words/)

    await mockTranslation(page, '不该出现')
    await openWordDetail(page, 'ねこ')
    await expect(page.getByRole('button', { name: '开启自动翻译' })).toHaveCount(0)
    await expect(page.locator('[data-auto-translation]')).toHaveCount(0)
  })
})
