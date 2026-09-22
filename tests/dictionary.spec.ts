import { test, expect, Page, Route } from '@playwright/test'
import { url } from './helpers'
import { exportWordsToJson, exportWordsToCsv } from '../src/utils/export'
import { parseWordsJson } from '../src/utils/import'

// 必应词典真实页面结构（示例词 adequate），经 r.jina.ai 代理返回完整 HTML。
// 只保留解析器依赖的关键节点：.hd_prUS/.hd_pr 音标、.qdef ul li 释义、
// .pos.web 网络释义、div.sen_li（内含 .sen_en/.sen_cn 与来源链接）。
const BING_ADEQUATE_HTML = `
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
    <li><span class="pos web">网络</span><span class="def b_regtxt">适当的；充分的</span></li>
  </ul>
</div>
<div id="sentenceSeg">
  <div class="se_li"><div class="se_n_d">1.</div><div class="se_li1">
    <div class="sen_en b_regtxt">The lack of adequate security had been a concern since 2003.</div>
    <div class="sen_cn b_regtxt">缺少充分的安全保护一直是个隐患。</div>
    <div class="sen_li b_regtxt"><a class="p1-3" href="/search?q=site%3abbs.ecocn.org">bbs.ecocn.org</a></div>
  </div></div>
  <div class="se_li"><div class="se_n_d">2.</div><div class="se_li1">
    <div class="sen_en b_regtxt">One in four people worldwide are without adequate homes.</div>
    <div class="sen_cn b_regtxt">全世界四分之一的人没有足够的住房。</div>
    <div class="sen_li b_regtxt"><a class="p1-3" href="/search?q=site%3awww.bing.com">www.bing.com</a></div>
  </div></div>
</div>
</body></html>`

// 同词性的多个义项被必应合并在同一行（；连接），用于验证拆分；3 条例句验证全量落库
const BING_YOUNG_HTML = `
<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"></head><body>
<div class="qdef">
  <div class="hd_area">
    <div class="hd_p1_1" lang="en">
      <div class="hd_prUS b_primtxt">美&#160;[jʌŋ] </div>
      <div class="hd_pr b_primtxt">英&#160;[jʌŋ] </div>
    </div>
  </div>
  <ul>
    <li><span class="pos">n.</span><span class="def b_regtxt">青年人；幼崽；幼兽；幼鸟</span></li>
    <li><span class="pos">adj.</span><span class="def b_regtxt">幼小的；未成熟的</span></li>
  </ul>
</div>
<div id="sentenceSeg">
  <div class="se_li"><div class="se_n_d">1.</div><div class="se_li1">
    <div class="sen_en b_regtxt">The company featured a young actress named Hilda Clark.</div>
    <div class="sen_cn b_regtxt">公司的广告中有一位名叫希尔达·克拉克的年轻女演员。</div>
    <div class="sen_li b_regtxt"><a class="p1-3" href="/search?q=site%3aarticle.yeeyan.org">article.yeeyan.org</a></div>
  </div></div>
  <div class="se_li"><div class="se_n_d">2.</div><div class="se_li1">
    <div class="sen_en b_regtxt">The tires are extremely worn, suggesting the chariot was used by the young king.</div>
    <div class="sen_cn b_regtxt">轮胎磨损严重，说明这辆战车曾被年轻的国王使用。</div>
    <div class="sen_li b_regtxt"><a class="p1-3" href="/search?q=site%3aarticle.yeeyan.org">article.yeeyan.org</a></div>
  </div></div>
  <div class="se_li"><div class="se_n_d">3.</div><div class="se_li1">
    <div class="sen_en b_regtxt">Whenever young Les was sick, his mother put him on the parlor couch.</div>
    <div class="sen_cn b_regtxt">每当小莱斯生病，他母亲就把他放在客厅的沙发上。</div>
    <div class="sen_li b_regtxt"><a class="p1-3" href="/search?q=site%3aarticle.yeeyan.org">article.yeeyan.org</a></div>
  </div></div>
</div>
</body></html>`

async function fulfillHtml(route: Route, body: string) {
  await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body })
}

/** mock 必应主通道（经 r.jina.ai 代理），返回被调用的次数 */
async function mockBing(page: Page, body = BING_ADEQUATE_HTML) {
  let calls = 0
  await page.route('**r.jina.ai/**', async (route) => {
    calls += 1
    await fulfillHtml(route, body)
  })
  return { get calls() { return calls } }
}

async function mockBingFailure(page: Page) {
  await page.route('**r.jina.ai/**', (route) => route.abort())
}

/** 必应返回 200 但内容不是有效词典页（无词条），应视为失败 */
async function mockBingEmpty(page: Page) {
  await page.route('**r.jina.ai/**', async (route) => {
    await fulfillHtml(route, '<html><body><p>no result</p></body></html>')
  })
}

async function lookupFromHome(page: Page, word: string) {
  await page.goto(url('/'))
  await page.getByLabel('翻译内容').fill(word)
  await page.getByRole('button', { name: '查词', exact: true }).click()
}

/** 通过真实添加流程创建一个带本地释义的英文单词 */
async function addEnglishWord(page: Page, word: string) {
  await page.goto(url('/add'))
  await waitForAddPageReady(page)
  await page.getByPlaceholder('输入单词（英/日）').fill(word)
  await page.getByPlaceholder('中文翻译').first().fill('本地释义')
  await page.getByPlaceholder('释义（英/日）').first().fill('a local definition')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForURL(/\/words/)
}

/** 读取 IndexedDB 中指定单词的完整记录（覆盖/导出断言用） */
async function readWordRecord(page: Page, word: string) {
  return page.evaluate((target) => new Promise<any>((resolve, reject) => {
    const request = indexedDB.open('VocabularyDB_v2')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      const store = database.transaction('words', 'readonly').objectStore('words')
      const cursorRequest = store.openCursor()
      cursorRequest.onerror = () => reject(cursorRequest.error)
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result
        if (!cursor) {
          database.close()
          reject(new Error(`word not found: ${target}`))
          return
        }
        if (cursor.value?.word === target) {
          const value = cursor.value
          database.close()
          resolve(value)
          return
        }
        cursor.continue()
      }
    }
  }), word)
}

/** 等待 AddWord 水合完成且分类下拉已就绪（避免冷启动竞态） */
async function waitForAddPageReady(page: Page) {
  await page.waitForFunction(
    () => {
      const select = document.querySelectorAll('select')[1]
      return !!select && select.options.length > 0
    },
    { timeout: 20000 }
  )
}

test.describe('在线词典增量测试', () => {
  test('TC-DICT-001: 首页查词按钮跳转词典页', async ({ page }) => {
    await page.goto(url('/'))
    await expect(page.getByRole('link', { name: /在线词典/ })).toBeVisible()
    await lookupFromHome(page, 'adequate')
    await expect(page).toHaveURL(/\/dictionary\?q=adequate/)
  })

  test('TC-DICT-002: 必应通道展示音标/释义/网络释义/双语例句', async ({ page }) => {
    await mockBing(page)
    await page.goto(url('/dictionary?q=adequate'))
    const panel = page.locator('[data-dictionary-panel]')
    await expect(panel).toBeVisible()
    await expect(page.getByText('数据来源：必应词典')).toBeVisible()
    // 美/英音标（方括号已剥离）
    await expect(panel.getByText('ˈædəkwət')).toBeVisible()
    await expect(panel.getByText("'ædɪkwət")).toBeVisible()
    // 词性释义
    await expect(panel.locator('[data-dictionary-sense]')).toContainText('足够的；合格的；合乎需要的')
    await expect(panel.locator('[data-dictionary-sense]')).toContainText('adj.')
    // 网络释义（.pos.web 单独归入）
    await expect(panel.getByText('网络释义')).toBeVisible()
    await expect(panel.locator('[data-dictionary-web]')).toContainText('适当的；充分的')
    // 双语例句 + 来源
    await expect(panel.locator('[data-dictionary-example]').first()).toContainText('缺少充分的安全保护一直是个隐患。')
    await expect(panel.locator('[data-dictionary-example]').first()).toContainText('bbs.ecocn.org')
    await expect(panel.locator('[data-dictionary-example]').nth(1)).toContainText('One in four people worldwide are without adequate homes.')
  })

  test('TC-DICT-003: 必应返回空页面时报错', async ({ page }) => {
    await mockBingEmpty(page)
    await page.goto(url('/dictionary?q=adequate'))
    await expect(page.getByText('未找到该词的词典释义，请检查拼写或网络后重试')).toBeVisible()
  })

  test('TC-DICT-004: 多词查询直接报错不发请求', async ({ page }) => {
    const bing = await mockBing(page)
    await page.goto(url('/dictionary?q=hello%20world'))
    await expect(page.getByText('未找到该词的词典释义，请检查拼写或网络后重试')).toBeVisible()
    expect(bing.calls).toBe(0)
  })

  test('TC-DICT-005: 结果缓存，二次查询不再请求在线接口', async ({ page }) => {
    const bing = await mockBing(page)
    await page.goto(url('/dictionary?q=adequate'))
    await expect(page.locator('[data-dictionary-panel]')).toBeVisible()
    // StrictMode 下 dev 首屏 effect 会双跑，只记录首屏请求数
    const firstLoadCalls = bing.calls
    expect(firstLoadCalls).toBeGreaterThan(0)
    await page.goto(url('/'))
    await page.goto(url('/dictionary?q=adequate'))
    await expect(page.locator('[data-dictionary-sense]').first()).toBeVisible()
    expect(bing.calls).toBe(firstLoadCalls)
  })

  test('TC-DICT-006: 添加单词页查词典并回填音标/释义/例句', async ({ page }) => {
    await mockBing(page)
    await page.goto(url('/add'))
    await waitForAddPageReady(page)
    await page.getByPlaceholder('输入单词（英/日）').fill('adequate')
    await page.getByRole('button', { name: '查词典' }).click()
    const panel = page.locator('[data-dictionary-panel]')
    await expect(panel).toBeVisible()
    await panel.getByRole('button', { name: '填入音标' }).click()
    await expect(page.getByPlaceholder('/həˈloʊ/')).toHaveValue('/ˈædəkwət/')
    await panel.locator('[data-dictionary-sense]').getByRole('button', { name: '填入', exact: true }).click()
    await expect(page.getByPlaceholder('中文翻译').first()).toHaveValue('足够的；合格的；合乎需要的')
    await expect(page.locator('select').first()).toHaveValue('adj.')
    await panel.getByRole('button', { name: '设为例句' }).first().click()
    await expect(page.getByPlaceholder('输入例句')).toHaveValue('The lack of adequate security had been a concern since 2003.')
    await expect(page.getByPlaceholder('例句中文翻译（可选）')).toHaveValue('缺少充分的安全保护一直是个隐患。')
  })

  test('TC-DICT-007: 回填后可直接保存单词', async ({ page }) => {
    await mockBing(page)
    const word = `dict-${Date.now()}`
    await page.goto(url('/add'))
    await waitForAddPageReady(page)
    await page.getByPlaceholder('输入单词（英/日）').fill(word)
    await page.getByRole('button', { name: '查词典' }).click()
    // 词典返回固定词条，回填内容应落到当前输入的单词上
    await page.locator('[data-dictionary-sense]').getByRole('button', { name: '填入', exact: true }).click()
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await page.waitForURL(/\/words/)
    await page.goto(url('/words'))
    await page.getByText(word, { exact: true }).waitFor({ timeout: 10000 })
    await page.getByText(word, { exact: true }).click()
    await expect(page.getByText('足够的；合格的；合乎需要的')).toBeVisible()
  })

  test('TC-DICT-009: 翻译页可点击「查词典」展开必应词典卡片', async ({ page }) => {
    await mockBing(page)
    await page.goto(url('/translate?q=adequate'))
    // 等待翻译结果区渲染后再点查词典
    const dictButton = page.getByRole('button', { name: '查词典' })
    await expect(dictButton).toBeVisible()
    await dictButton.click()
    const panel = page.locator('[data-dictionary-panel]')
    await expect(panel).toBeVisible()
    await expect(panel.locator('[data-dictionary-sense]').first()).toContainText('足够的；合格的；合乎需要的')
    await expect(panel.locator('[data-dictionary-example]').first()).toContainText('缺少充分的安全保护一直是个隐患。')
    // 再次点击收起
    await page.getByRole('button', { name: '收起词典' }).click()
    await expect(page.locator('[data-dictionary-panel]')).toHaveCount(0)
  })

  test('TC-DICT-010: 翻译页输入句子时不显示查词典入口', async ({ page }) => {
    await page.goto(url('/translate?q=hello%20world'))
    await expect(page.getByRole('button', { name: '查词典' })).toHaveCount(0)
  })

  test('TC-DICT-011: 单词详情页可点击「查词典」展开必应词典卡片', async ({ page }) => {
    await mockBing(page)
    await addEnglishWord(page, 'adequate')
    await page.goto(url('/words'))
    await page.getByText('adequate', { exact: true }).click()
    const dictButton = page.getByRole('button', { name: '查词典', exact: true })
    await expect(dictButton).toBeVisible()
    await dictButton.click()
    const panel = page.locator('[data-dictionary-panel]')
    await expect(panel).toBeVisible()
    await expect(page.getByText('数据来源：必应词典')).toBeVisible()
    await expect(panel.getByText('ˈædəkwət')).toBeVisible()
    await expect(panel.locator('[data-dictionary-sense]').first()).toContainText('足够的；合格的；合乎需要的')
    // 再次点击收起
    await page.getByRole('button', { name: '收起词典' }).click()
    await expect(page.locator('[data-dictionary-panel]')).toHaveCount(0)
  })

  test('TC-DICT-012: 详情页可一键把词典结果覆盖到本地词条', async ({ page }) => {
    await mockBing(page)
    await addEnglishWord(page, 'adequate')
    await page.goto(url('/words'))
    await page.getByText('adequate', { exact: true }).click()
    await page.getByRole('button', { name: '查词典', exact: true }).click()
    await page.getByRole('button', { name: '覆盖本地翻译' }).click()
    await expect(page.getByText('已覆盖本地翻译')).toBeVisible()
    // 释义卡片被词典内容替换（本地英文释义保留：词典 senses 无对应 def）
    // adequate 单条义项「足够的；合格的；合乎需要的」按分号拆成 3 条
    await expect(page.locator('p.font-medium', { hasText: '足够的' })).toHaveCount(1)
    await expect(page.locator('p.font-medium', { hasText: '合格的' })).toHaveCount(1)
    await expect(page.locator('p.font-medium', { hasText: '合乎需要的' })).toHaveCount(1)
    await expect(page.locator('p', { hasText: 'a local definition' })).toHaveCount(1)
    await expect(page.getByText('/ˈædəkwət/', { exact: true })).toBeVisible()
    // 重进详情页确认已落库
    await page.goto(url('/words'))
    await page.getByText('adequate', { exact: true }).click()
    await expect(page.getByText('/ˈædəkwət/', { exact: true })).toBeVisible()
  })

  test('TC-DICT-013: 详情页顶部按钮不再是旧的在线翻译', async ({ page }) => {
    const word = `dict-entry-${Date.now()}`
    await addEnglishWord(page, word)
    await page.goto(url('/words'))
    await page.getByText(word, { exact: true }).click()
    await expect(page.getByRole('button', { name: '查词典', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '在线翻译' })).toHaveCount(0)
  })

  test('TC-DICT-014: 同词性多义项按中文分号拆成独立义项', async ({ page }) => {
    await mockBing(page, BING_YOUNG_HTML)
    await addEnglishWord(page, 'young')
    await page.goto(url('/words'))
    await page.getByText('young', { exact: true }).click()
    await page.getByRole('button', { name: '查词典', exact: true }).click()
    await page.getByRole('button', { name: '覆盖本地翻译' }).click()
    await expect(page.getByText('已覆盖本地翻译')).toBeVisible()
    const record = await readWordRecord(page, 'young')
    // n. 的 4 个义项 + adj. 的 2 个义项 → 6 条独立 definitions，同词性共用 pos
    expect(record.definitions).toHaveLength(6)
    expect(record.definitions.map((d: any) => d.pos)).toEqual(['n.', 'n.', 'n.', 'n.', 'adj.', 'adj.'])
    expect(record.definitions.map((d: any) => d.trans)).toEqual([
      '青年人', '幼崽', '幼兽', '幼鸟', '幼小的', '未成熟的',
    ])
    // 本地英文释义按拆分后的顺序保留，未被清空
    expect(record.definitions[0].def).toBe('a local definition')
  })

  test('TC-DICT-015: 全部例句写入 dictionaryExamples，首条同时写入旧字段', async ({ page }) => {
    await mockBing(page, BING_YOUNG_HTML)
    await addEnglishWord(page, 'young')
    await page.goto(url('/words'))
    await page.getByText('young', { exact: true }).click()
    await page.getByRole('button', { name: '查词典', exact: true }).click()
    await page.getByRole('button', { name: '覆盖本地翻译' }).click()
    await expect(page.getByText('已覆盖本地翻译')).toBeVisible()
    const record = await readWordRecord(page, 'young')
    expect(record.dictionaryExamples).toHaveLength(3)
    expect(record.dictionaryExamples[0].en).toBe('The company featured a young actress named Hilda Clark.')
    expect(record.dictionaryExamples[1].en).toBe('The tires are extremely worn, suggesting the chariot was used by the young king.')
    expect(record.dictionaryExamples[2].zh).toBe('每当小莱斯生病，他母亲就把他放在客厅的沙发上。')
    // 旧单数字段仍与首条一致，兼容学习页/卡片
    expect(record.example).toBe(record.dictionaryExamples[0].en)
    expect(record.exampleTranslation).toBe(record.dictionaryExamples[0].zh)
    // 不再把词典例句塞进笔记
    expect(record.notes ?? '').not.toContain('词典例句')
    // 详情页多行展示词典例句
    const card = page.locator('[data-word-dictionary-examples]')
    await expect(card).toBeVisible()
    await expect(card.getByText('The tires are extremely worn, suggesting the chariot was used by the young king.')).toBeVisible()
    await expect(card.getByText('每当小莱斯生病，他母亲就把他放在客厅的沙发上。')).toBeVisible()
  })

  test('TC-DICT-016: 覆盖后的词条导出 JSON/CSV 完整且可往返', async ({ page }) => {
    await mockBing(page, BING_YOUNG_HTML)
    await addEnglishWord(page, 'young')
    await page.goto(url('/words'))
    await page.getByText('young', { exact: true }).click()
    await page.getByRole('button', { name: '查词典', exact: true }).click()
    await page.getByRole('button', { name: '覆盖本地翻译' }).click()
    await expect(page.getByText('已覆盖本地翻译')).toBeVisible()
    const record = await readWordRecord(page, 'young')

    const json = exportWordsToJson([record])
    const jsonRows = JSON.parse(json)
    expect(jsonRows[0].definitions).toHaveLength(6)
    expect(jsonRows[0].dictionaryExamples).toHaveLength(3)
    expect(jsonRows[0].example).toBe(record.example)
    expect(jsonRows[0].onlineTranslation).toBe('青年人')
    expect(jsonRows[0].onlineTranslationSource).toBe('Bing')

    const csv = exportWordsToCsv([record])
    expect(csv).toContain('dictionaryExamples')
    expect(csv).toContain('幼崽')

    // 往返：导出的 JSON 重新解析后释义/例句无损
    const parsed = parseWordsJson(json)
    expect(parsed.errors).toHaveLength(0)
    expect(parsed.words[0].definitions).toHaveLength(6)
    expect(parsed.words[0].dictionaryExamples).toHaveLength(3)
    expect(parsed.words[0].dictionaryExamples![1].en).toBe('The tires are extremely worn, suggesting the chariot was used by the young king.')
    expect(parsed.words[0].example).toBe(record.example)
  })

  test('TC-DICT-017: 自动查词典开关默认关闭，详情页不自动展开', async ({ page }) => {
    await addEnglishWord(page, 'young')
    const bing = await mockBing(page, BING_YOUNG_HTML)
    await page.goto(url('/words'))
    await page.getByText('young', { exact: true }).click()
    await expect(page.getByRole('heading', { name: 'young' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '必应词典' })).toHaveCount(0)
    expect(bing.calls).toBe(0)
  })

  test('TC-DICT-018: 开启后进英语词详情自动展开词典并持久化', async ({ page }) => {
    await addEnglishWord(page, 'young')
    await mockBing(page, BING_YOUNG_HTML)
    await page.goto(url('/words'))
    await page.getByText('young', { exact: true }).click()
    await page.getByRole('button', { name: '开启自动查词典' }).click()
    // 自动展开词典卡片，无需点「查词典」
    await expect(page.getByRole('heading', { name: '必应词典' })).toBeVisible()
    await expect(page.getByText('青年人；幼崽；幼兽；幼鸟', { exact: true })).toBeVisible()

    // 刷新后开关保持开启并继续自动展开
    await page.reload()
    await expect(page.getByText('青年人；幼崽；幼兽；幼鸟', { exact: true })).toBeVisible()
  })

  test('TC-DICT-019: 关闭自动查词典后收起且不再自动展开', async ({ page }) => {
    await addEnglishWord(page, 'young')
    await mockBing(page, BING_YOUNG_HTML)
    await page.goto(url('/words'))
    await page.getByText('young', { exact: true }).click()
    await page.getByRole('button', { name: '开启自动查词典' }).click()
    await expect(page.getByText('青年人；幼崽；幼兽；幼鸟', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: '关闭自动查词典' }).click()
    await expect(page.getByText('青年人；幼崽；幼兽；幼鸟', { exact: true })).toHaveCount(0)
  })

  test('TC-DICT-020: 日语词不自动查词典', async ({ page }) => {
    await page.goto(url('/'))
    await page.getByRole('button', { name: '日语', exact: true }).click()
    await page.goto(url('/add'))
    await page.getByPlaceholder('如：食べる').fill('ねこ')
    await page.getByPlaceholder('如：たべる').fill('ねこ')
    await page.getByPlaceholder('中文翻译').first().fill('猫')
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await page.waitForURL(/\/words/)

    await mockBing(page, BING_YOUNG_HTML)
    await page.goto(url('/words'))
    await page.getByText('ねこ', { exact: true }).first().click()
    await expect(page.getByRole('button', { name: '开启自动查词典' })).toHaveCount(0)
    // 日语词不显示词典面板内容
    await expect(page.getByRole('heading', { name: '必应词典' })).toHaveCount(0)
  })
})
