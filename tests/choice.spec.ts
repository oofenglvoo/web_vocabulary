import { test, expect } from '@playwright/test'
import { url } from './helpers'

async function addWords(page: import('@playwright/test').Page, words: [string, string][]) {
  for (const [word, trans] of words) {
    await page.goto(url('/add'))
    await page.getByPlaceholder(/输入单词/).fill(word)
    await page.getByPlaceholder(/中文翻译/).first().fill(trans)
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await page.waitForURL(/\/words/)
  }
}

// 切到选择题
async function switchToChoice(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '题型设置' }).click()
  const overlay = page.locator('.modal-overlay')
  await overlay.getByRole('button', { name: '选择题', exact: true }).first().click()
  await overlay.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.getByText('新学 · 选择题')).toBeVisible()
}

test('选择题:显示选项并可选', async ({ page }) => {
  await addWords(page, [['apple', '苹果'], ['banana', '香蕉'], ['cat', '猫'], ['dog', '狗']])
  await page.goto(url('/study'))
  await page.waitForTimeout(1000)
  await switchToChoice(page)

  // 应显示"选择正确的中文释义"和选项
  await expect(page.getByText('选择正确的中文释义')).toBeVisible()
  // 至少有一个选项按钮（中文翻译）
  const optionBtns = page.locator('button').filter({ hasText: /苹果|香蕉|猫|狗/ })
  await expect(optionBtns.first()).toBeVisible()
})

test('选择题:答对后进入下一题', async ({ page }) => {
  await addWords(page, [['apple', '苹果'], ['banana', '香蕉'], ['cat', '猫'], ['dog', '狗']])
  await page.goto(url('/study'))
  await page.waitForTimeout(1000)
  await switchToChoice(page)

  // 读当前题的单词（h2 标题）
  const currentWord = await page.locator('h2').first().innerText()
  // 找到该单词对应的翻译选项并点击
  // 选项按钮是中文翻译，先找当前单词的翻译
  const transMap: Record<string, string> = { apple: '苹果', banana: '香蕉', cat: '猫', dog: '狗' }
  const correctTrans = transMap[currentWord.trim()]
  await page.getByRole('button', { name: correctTrans, exact: true }).click()
  // 应显示"答对了"
  await expect(page.getByText('答对了')).toBeVisible()
})
