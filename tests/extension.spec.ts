import { test, expect, chromium, BrowserContext, Page } from '@playwright/test'
import { createServer, Server } from 'node:http'
import { spawn, ChildProcess } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rmSync, mkdirSync } from 'node:fs'

// 扩展端到端测试：真实加载 extension/dist 到 Chrome，覆盖划词 → 查词 → 收藏闭环。
//
// 关键约束：
//  - MV3 无头模式不注入 content script，必须 headful 运行。
//  - 词典请求由 offscreen 文档发起，不被 Playwright 路由拦截，故测试构建时把
//    代理前缀 VITE_DICT_PROXY 指向本地 mock 服务器（端口 5397）。
//  - popup 内嵌的 app 指向本地 dev 服务器（5199），由本测试自行启动/关闭。
//  运行：npm run test:e2e:extension（内部先 build:extension:test 再跑测试）

const here = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(here, '..')
const EXT_DIST = resolve(ROOT, 'extension/dist')
const PROFILE_DIR = resolve(ROOT, 'tmp-ext-profile-test')
const MOCK_PORT = 5397
const DEV_PORT = 5199
const APP_URL = `http://127.0.0.1:${DEV_PORT}/web_vocabulary/`

// 必应词典页面结构（与 tests/dictionary.spec.ts 的 fixture 同源）
const BING_HTML = `
<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"></head><body>
<div class="qdef">
  <div class="hd_area">
    <div class="hd_p1_1" lang="en">
      <div class="hd_prUS b_primtxt">美&#160;[ˈædəkwət] </div>
      <div class="hd_pr b_primtxt">英&#160;['ædɪkwət] </div>
    </div>
  </div>
  <ul>
    <li><span class="pos">adj.</span><span class="def b_regtxt">足够的；合格的；合乎需要的</span></li>
  </ul>
</div>
<div id="sentenceSeg">
  <div class="se_li"><div class="se_li1">
    <div class="sen_en b_regtxt">The lack of adequate security had been a concern since 2003.</div>
    <div class="sen_cn b_regtxt">缺少充分的安全保护一直是个隐患。</div>
  </div></div>
</div>
</body></html>`

let context: BrowserContext
let proxyServer: Server
let devServer: ChildProcess

/** 等待 dev 服务器可访问（或超时） */
async function waitForDevServer(timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(APP_URL, { method: 'GET' })
      if (res.ok) return
    } catch {
      // 未就绪，继续等
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`dev 服务器未在 ${timeoutMs}ms 内就绪: ${APP_URL}`)
}

test.beforeAll(async () => {
  // 本地 mock 代理：任意 /<bing url> 请求都返回必应词典 HTML
  proxyServer = createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(BING_HTML)
  })
  await new Promise<void>((r) => proxyServer.listen(MOCK_PORT, '127.0.0.1', () => r()))

  // 启动 dev 服务器（app），供 popup iframe 内嵌
  devServer = spawn('npx', ['vite', '--port', String(DEV_PORT), '--strictPort', '--host', '127.0.0.1'], {
    cwd: ROOT,
    shell: true,
    stdio: 'ignore',
  })
  await waitForDevServer()

  rmSync(PROFILE_DIR, { recursive: true, force: true })
  mkdirSync(PROFILE_DIR, { recursive: true })
  context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXT_DIST}`,
      `--load-extension=${EXT_DIST}`,
    ],
  })
})

test.afterAll(async () => {
  await context?.close()
  await new Promise<void>((r) => proxyServer?.close(() => r()))
  devServer?.kill()
  rmSync(PROFILE_DIR, { recursive: true, force: true })
})

/** 打开一个测试页面 */
async function openArticlePage(): Promise<Page> {
  const page = await context.newPage()
  await page.route('http://article.test/**', async (route) => {
    await route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html><body><p id="text">The adequate bench provides performance.</p></body></html>',
    })
  })
  await page.goto('http://article.test/')
  await expect(page.locator('#vocab-helper-bubble-host')).toHaveCount(0)
  return page
}

/** 在页面上划选指定子串并触发 mouseup */
async function selectText(page: Page, selector: string, needle: string) {
  await page.evaluate(
    ([sel, text]) => {
      const el = document.querySelector(sel)!
      const node = el.firstChild!
      const idx = (el.textContent || '').indexOf(text)
      const range = document.createRange()
      range.setStart(node, idx)
      range.setEnd(node, idx + text.length)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    },
    [selector, needle]
  )
}

/** 读取气泡内文本 */
function bubbleText(page: Page) {
  return page.evaluate(() => {
    const host = document.getElementById('vocab-helper-bubble-host')
    return host?.shadowRoot?.getElementById('bubble')?.innerText ?? null
  })
}

/** 点击气泡内第 idx 个单词的「收藏」按钮 */
async function clickCollect(page: Page, idx = 0) {
  await page.evaluate((i) => {
    const host = document.getElementById('vocab-helper-bubble-host')!
    const btn = host.shadowRoot!.querySelector(`button[data-collect="${i}"]`) as HTMLButtonElement
    btn.click()
  }, idx)
}

/** 找到 popup 窗口页 */
function findPopupPage() {
  return context.pages().find((p) => p.url().includes('popup/index.html'))
}

/** 在 app iframe 里读取词库 */
async function readAppWords(popup: Page) {
  const frame = popup.frames().find((f) => f.url().includes(String(DEV_PORT)))
  if (!frame) return null
  return frame.evaluate(() => {
    return new Promise<any[]>((resolve, reject) => {
      const req = indexedDB.open('VocabularyDB_v2')
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('words', 'readonly')
        const all = tx.objectStore('words').getAll()
        all.onsuccess = () => {
          db.close()
          resolve(all.result as any[])
        }
        all.onerror = () => reject(all.error)
      }
      req.onerror = () => reject(req.error)
    })
  })
}

test.describe('扩展：划词查词', () => {
  test('TC-EXT-001 划选单个单词弹出气泡并展示释义', async () => {
    const page = await openArticlePage()
    await selectText(page, '#text', 'adequate')
    await expect
      .poll(async () => (await bubbleText(page)) ?? '', { timeout: 15000 })
      .toContain('足够的')
    const text = (await bubbleText(page)) ?? ''
    expect(text).toContain('adequate')
    expect(text).toContain('ædəkwət')
    await page.close()
  })

  test('TC-EXT-002 划选一句话自动拆成多个单词', async () => {
    const page = await openArticlePage()
    await selectText(page, '#text', 'adequate bench provides performance')
    await expect
      .poll(async () => (await bubbleText(page)) ?? '', { timeout: 15000 })
      .toContain('共 4 个')
    await page.close()
  })

  test('TC-EXT-003 停用词与过短词被过滤', async () => {
    const page = await openArticlePage()
    await selectText(page, '#text', 'The adequate')
    // The 是停用词，应被过滤，只剩 adequate
    await expect
      .poll(async () => (await bubbleText(page)) ?? '', { timeout: 15000 })
      .toContain('共 1 个')
    await page.close()
  })
})

test.describe('扩展：收藏闭环', () => {
  test('TC-EXT-010 点收藏自动弹出面板并落库到指定分类', async () => {
    const page = await openArticlePage()
    await selectText(page, '#text', 'adequate')
    await expect
      .poll(async () => (await bubbleText(page)) ?? '', { timeout: 15000 })
      .toContain('足够的')

    await clickCollect(page)

    // 面板窗口应自动打开
    await expect.poll(() => !!findPopupPage(), { timeout: 15000 }).toBeTruthy()
    const popup = findPopupPage()!

    // app iframe 内应出现该单词
    await expect
      .poll(async () => {
        const words = await readAppWords(popup)
        return words?.some((w) => w.word === 'adequate') ?? false
      }, { timeout: 20000 })
      .toBeTruthy()

    const words = (await readAppWords(popup)) ?? []
    const adequate = words.find((w) => w.word === 'adequate')
    expect(adequate.category).toBe('划词收藏')
    expect(adequate.definitions[0].trans).toContain('足够的')
    await page.close()
  })

  test('TC-EXT-011 同名单词再次收藏被跳过', async () => {
    const page = await openArticlePage()
    await selectText(page, '#text', 'adequate')
    await expect
      .poll(async () => (await bubbleText(page)) ?? '', { timeout: 15000 })
      .toContain('足够的')
    await clickCollect(page)

    await expect.poll(() => !!findPopupPage(), { timeout: 15000 }).toBeTruthy()
    const popup = findPopupPage()!
    await expect
      .poll(async () => {
        const words = await readAppWords(popup)
        return words?.filter((w) => w.word === 'adequate').length ?? 0
      }, { timeout: 20000 })
      .toBe(1)
    await page.close()
  })
})
