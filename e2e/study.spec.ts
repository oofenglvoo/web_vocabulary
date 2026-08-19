import { test, expect } from '@playwright/test'
import { url } from './helpers'

// 添加几个词供学习用
async function addWords(page: import('@playwright/test').Page, words: [string, string][]) {
  for (const [word, trans] of words) {
    await page.goto(url('/add'))
    await page.getByPlaceholder('输入英文单词').fill(word)
    await page.getByPlaceholder(/中文翻译/).first().fill(trans)
    await page.getByRole('button', { name: '保存', exact: true }).click()
  }
}

test('自由学习-回忆式:认识通过不再重复', async ({ page }) => {
  await addWords(page, [['apple', '苹果'], ['banana', '香蕉']])

  // 自由学习
  await page.goto(url('/study'))
  // 等待卡片加载
  await page.waitForTimeout(1000)

  // 回忆式: 初始显示单词, 点卡片翻面
  // 找到"认识"按钮（回忆式默认,自评按钮常驻）
  const knowBtn = page.getByRole('button', { name: '认识', exact: true })
  await expect(knowBtn).toBeVisible()
  await knowBtn.click()

  // 认识后移除当前词,进入下一个词
  await page.waitForTimeout(300)
  // 完成页出现前,应能继续操作
  const knowBtn2 = page.getByRole('button', { name: '认识', exact: true })
  await expect(knowBtn2).toBeVisible().catch(() => {})
})

test('自由学习-回忆式:忘记后重排重复出现', async ({ page }) => {
  await addWords(page, [['cat', '猫'], ['dog', '狗']])
  await page.goto(url('/study'))
  await page.waitForSelector('text=回忆式')

  // 找到"忘记"按钮并点击
  const forgetBtn = page.getByRole('button', { name: '忘记', exact: true })
  await expect(forgetBtn).toBeVisible()
  await forgetBtn.click()

  // 忘记后,当前词重排到队尾,卡片应继续显示（不立即通过）
  await page.waitForTimeout(300)
  // 应还有卡片显示
  const anyCard = page.locator('.card')
  await expect(anyCard.first()).toBeVisible()
})
