import { test, expect } from '@playwright/test'
import { url } from './helpers'

async function mockTranslation(page: import('@playwright/test').Page, translation = '测试译文') {
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

async function addEnglishWord(page: import('@playwright/test').Page, word: string) {
  await page.goto(url('/add'))
  await page.getByPlaceholder(/输入单词/).fill(word)
  await page.getByPlaceholder(/中文翻译/).first().fill('本地释义')
  await page.getByPlaceholder('释义（英/日）').first().fill('a local definition')
  await page.getByPlaceholder('输入例句').fill('This is a local example.')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/words/)
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
    await expect(page.getByText('在线翻译（MyMemory）')).toBeVisible()
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

  test('TC-TRANS-006: 短词原文候选优先使用实际译文', async ({ page }) => {
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
  })
})
