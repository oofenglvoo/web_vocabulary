import { test, expect, Page } from '@playwright/test'
import { createServer, Server } from 'node:http'
import { url } from './helpers'

// embed 精简模式（?embed=1）：被浏览器扩展 popup 以 iframe 内嵌时的宿主页面。
// 通过 postMessage 把划词结果交给 app 落库，不渲染完整应用。

// 父页面服务器端口与地址（跨源内嵌 app）
const PARENT_PORT = 5399
const PARENT_URL = `http://127.0.0.1:${PARENT_PORT}/`
let parentServer: Server

/** 读取 words 表记录 */
async function readWords(page: Page) {
  return page.evaluate(() => {
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

/** 读取 categories 表记录 */
async function readCategories(page: Page) {
  return page.evaluate(() => {
    return new Promise<any[]>((resolve, reject) => {
      const req = indexedDB.open('VocabularyDB_v2')
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('categories', 'readonly')
        const all = tx.objectStore('categories').getAll()
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

/** 收集 EmbedHost 通过 postMessage 回传的消息 */
async function installParentListener(page: Page) {
  await page.evaluate(() => {
    ;(window as any).__embedMessages = []
    window.addEventListener('message', (e) => {
      ;(window as any).__embedMessages.push(e.data)
    })
  })
}

/** 模拟扩展 popup：装好监听并发起 ping 握手，等宿主回 ready */
async function handshake(page: Page) {
  await expect(page.getByText('正在连接划词助手…')).toBeVisible({ timeout: 10000 })
  await installParentListener(page)
  await page.evaluate(() => window.postMessage({ type: 'vocab:ping' }, '*'))
  await waitForType(page, 'vocab:embed-ready')
  await expect(page.getByText('划词助手已连接')).toBeVisible({ timeout: 10000 })
}

async function waitForType(page: Page, type: string, timeout = 5000) {
  await page.waitForFunction(
    (t) => ((window as any).__embedMessages || []).some((m: any) => m?.type === t),
    type,
    { timeout }
  )
  return page.evaluate((t) => ((window as any).__embedMessages || []).find((m: any) => m?.type === t), type)
}

test.describe('embed 精简模式', () => {
  test.beforeAll(async () => {
    // 独立本地父页面服务器：制造与 app 不同的 origin，模拟扩展 popup 的 iframe 宿主。
    parentServer = createServer((_req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(
        `<!doctype html><html><body><iframe id="f" src="${url('/?embed=1')}" style="width:400px;height:500px"></iframe></body></html>`
      )
    })
    await new Promise<void>((resolve) => parentServer.listen(PARENT_PORT, '127.0.0.1', () => resolve()))
  })

  test.afterAll(async () => {
    await new Promise<void>((resolve) => parentServer.close(() => resolve()))
  })

  test('TC-EMBED-001 ?embed=1 只渲染精简宿主，不渲染完整应用', async ({ page }) => {
    await page.goto(url('/?embed=1'))
    await handshake(page)
    // 完整应用的导航不应出现
    await expect(page.getByRole('link', { name: '单词列表' })).toHaveCount(0)
  })

  test('TC-EMBED-002 首次加载即向父级发送 ready 握手', async ({ page }) => {
    // 在页面脚本执行前注入监听，捕获 EmbedHost 挂载时主动发出的 ready
    await page.addInitScript(() => {
      ;(window as any).__embedMessages = []
      window.addEventListener('message', (e) => {
        ;(window as any).__embedMessages.push(e.data)
      })
    })
    await page.goto(url('/?embed=1'))
    const ready = await waitForType(page, 'vocab:embed-ready')
    expect(ready.version).toBe(1)
  })

  test('TC-EMBED-003 collect 写入单词并自动创建分类', async ({ page }) => {
    await page.goto(url('/?embed=1'))
    await handshake(page)

    await page.evaluate(() => {
      window.postMessage(
        {
          type: 'vocab:collect',
          requestId: 'req-1',
          category: '划词收藏',
          words: [
            { word: 'Adequate', phonetic: 'ˈædɪkwət', definitions: [{ pos: 'adj.', def: 'enough', trans: '足够的' }] },
            { word: 'bench', definitions: [{ pos: 'n.', def: 'long seat', trans: '长椅' }] },
          ],
        },
        '*'
      )
    })

    const result = await waitForType(page, 'vocab:collect-result')
    expect(result.added).toBe(2)
    expect(result.skipped).toBe(0)
    expect(result.category).toBe('划词收藏')

    const words = await readWords(page)
    const names = words.map((w) => w.word).sort()
    expect(names).toEqual(['Adequate', 'bench'])
    const adequate = words.find((w) => w.word === 'Adequate')
    expect(adequate.category).toBe('划词收藏')
    expect(adequate.definitions[0].trans).toBe('足够的')
    expect(adequate.translation).toBe('足够的')
    expect(adequate.srsStage).toBe(0)

    const cats = await readCategories(page)
    expect(cats.some((c) => c.name === '划词收藏' && c.lang === 'en')).toBeTruthy()
  })

  test('TC-EMBED-004 同名单词跳过，不改动旧数据', async ({ page }) => {
    await page.goto(url('/?embed=1'))
    await handshake(page)

    const send = (requestId: string, category: string, words: any[]) =>
      page.evaluate(
        ([rid, cat, ws]) => {
          window.postMessage({ type: 'vocab:collect', requestId: rid, category: cat, words: ws }, '*')
        },
        [requestId, category, words]
      )

    await send('r1', '划词收藏', [{ word: 'plain', definitions: [{ pos: 'adj.', def: 'simple', trans: '朴素的' }] }])
    await waitForType(page, 'vocab:collect-result')

    // 第二次：同词大小写不同，应跳过
    await page.evaluate(() => {
      ;(window as any).__embedMessages = []
    })
    await send('r2', '划词收藏', [
      { word: 'PLAIN', definitions: [{ pos: 'adj.', def: 'changed', trans: '被改过的' }] },
      { word: 'novel', definitions: [{ pos: 'n.', def: 'book', trans: '小说' }] },
    ])
    const result = await waitForType(page, 'vocab:collect-result')
    expect(result.added).toBe(1)
    expect(result.skipped).toBe(1)

    const words = await readWords(page)
    const plain = words.find((w) => w.word.toLowerCase() === 'plain')
    expect(plain.word).toBe('plain')
    expect(plain.definitions[0].trans).toBe('朴素的')
    expect(words.filter((w) => w.word.toLowerCase() === 'plain')).toHaveLength(1)
  })

  test('TC-EMBED-005 请求分类列表返回英语分类', async ({ page }) => {
    await page.goto(url('/?embed=1'))
    await handshake(page)

    await page.evaluate(() => window.postMessage({ type: 'vocab:request-categories' }, '*'))
    const payload = await waitForType(page, 'vocab:category-list')
    expect(Array.isArray(payload.categories)).toBeTruthy()
  })

  test('TC-EMBED-006 跨源 iframe 内嵌时 postMessage 可完成收藏', async ({ page }) => {
    // 模拟扩展 popup：父页面（另一个本地端口）跨源内嵌 app 的 ?embed=1，
    // 通过 postMessage 驱动收藏，贴近 chrome-extension:// → http 场景。
    // 注意：必须用真实本地服务器，否则会被 Chrome 的 Private Network Access 拦截。
    const embedUrl = url('/?embed=1')
    await page.goto(PARENT_URL)
    const frame = page.frameLocator('#f')
    await expect(frame.getByText('正在连接划词助手…')).toBeVisible({ timeout: 10000 })

    await page.evaluate(() => {
      ;(window as any).__msgs = []
      window.addEventListener('message', (e) => {
        ;(window as any).__msgs.push(e.data)
      })
    })

    // 父级主动 ping，等 iframe 回 ready（等价扩展 popup 握手）
    await page.evaluate(() => {
      const f = document.getElementById('f') as HTMLIFrameElement
      f.contentWindow!.postMessage({ type: 'vocab:ping', version: 1 }, '*')
    })
    await page.waitForFunction(() => ((window as any).__msgs || []).some((m: any) => m?.type === 'vocab:embed-ready'))
    await expect(page.frameLocator('#f').getByText('划词助手已连接')).toBeVisible({ timeout: 10000 })

    await page.evaluate(() => {
      const f = document.getElementById('f') as HTMLIFrameElement
      f.contentWindow!.postMessage(
        {
          type: 'vocab:collect',
          requestId: 'cross-1',
          category: '划词收藏',
          words: [{ word: 'crossorigin', definitions: [{ pos: 'adj.', def: 'across', trans: '跨源的' }] }],
        },
        '*'
      )
    })
    await page.waitForFunction(
      () => ((window as any).__msgs || []).some((m: any) => m?.type === 'vocab:collect-result')
    )
    const result = await page.evaluate(() =>
      ((window as any).__msgs || []).find((m: any) => m?.type === 'vocab:collect-result')
    )
    expect(result.added).toBe(1)

    // 断言确实落到了 iframe 的 origin 词库
    const childFrame = page.frames().find((f) => f.url().includes('8457'))
    expect(childFrame).toBeTruthy()
    const words = await childFrame!.evaluate(() => {
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
    expect(words.some((w) => w.word === 'crossorigin')).toBeTruthy()
  })
})
