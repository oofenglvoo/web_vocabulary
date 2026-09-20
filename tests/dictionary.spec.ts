import { test, expect, Page, Route } from '@playwright/test'
import { url } from './helpers'

// 有道 jsonapi 的真实响应结构（示例词 adequate），经 r.jina.ai 代理返回纯文本 JSON
const YOUDAO_ADEQUATE = {
  ec: {
    word: [
      {
        usphone: 'ˈædəkwət',
        ukphone: 'ˈædɪkwət',
        trs: [{ tr: [{ l: { i: ['adj. 足够的；合格的；合乎需要的'] } }] }],
      },
    ],
  },
  web_trans: {
    'web-translation': [
      {
        trans: [
          { value: '适当的', summary: { line: ['Adequate enforcement is often necessary.'] } },
          { value: '充分的' },
        ],
      },
    ],
  },
  blng_sents_part: {
    'sentence-pair': [
      {
        sentence: 'The lack of adequate security had been a concern since 2003.',
        'sentence-translation': '缺少充分的安全保护一直是个隐患。',
        source: 'bbs.ecocn.org',
      },
    ],
  },
  phrs: {
    phrs: [{ phr: { headword: { l: { i: 'adequate for' } }, trs: [{ tr: { l: { i: '足以应付' } } }] } }],
  },
  syno: { synos: [{ syno: { pos: 'adj.', ws: [{ w: 'sufficient' }, { w: 'enough' }] } }] },
  collins: {
    collins_entries: [
      {
        headword: 'adequate',
        star: '3',
        entries: {
          entry: [
            {
              tran_entry: [
                {
                  pos_entry: { pos: 'ADJ', pos_tips: '形容词' },
                  tran: 'If something is adequate, there is enough of it or it is good enough. 足够的',
                  exam_sents: {
                    sent: [
                      {
                        eng_sent: 'One in four people worldwide are without adequate homes.',
                        chn_sent: '全世界四分之一的人没有足够的住房。',
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  },
  rel_word: {
    rels: [
      { rel: { pos: 'adv.', words: [{ word: 'adequately', tran: '充分地；足够地' }] } },
      { rel: { pos: 'n.', words: [{ word: 'adequacy', tran: '足够；适当' }] } },
    ],
  },
  discriminate: {
    data: [
      {
        usages: [
          { headword: 'sufficient', usage: '指数量充足，足够满足某种需要。' },
          { headword: 'adequate', usage: '足够的，指数目合适，适合需要。' },
        ],
      },
    ],
  },
}

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
}

/** mock 有道主通道（经 r.jina.ai 代理），返回被调用的次数 */
async function mockYoudao(page: Page, body: unknown = YOUDAO_ADEQUATE) {
  let calls = 0
  await page.route('**r.jina.ai/**', async (route) => {
    calls += 1
    await fulfillJson(route, body)
  })
  return { get calls() { return calls } }
}

async function mockYoudaoFailure(page: Page) {
  await page.route('**r.jina.ai/**', (route) => route.abort())
}

/** mock 备通道三件套 + 翻译回填，用于验证回退链路 */
async function mockFreeChannels(page: Page) {
  await page.route('**freedictionaryapi.com/**', async (route) => {
    await fulfillJson(route, {
      word: 'adequate',
      entries: [
        {
          partOfSpeech: 'adjective',
          pronunciations: [{ type: 'ipa', text: 'ˈædəkwət', tags: ['US'] }],
          senses: [
            { definition: 'sufficient in amount', examples: ['There was no adequate funding.'] },
            { definition: 'acceptable in quality' },
            { definition: 'able to supply what is needed' },
          ],
        },
      ],
    })
  })
  await page.route('**api.datamuse.com/**', async (route) => {
    await fulfillJson(route, [{ word: 'sufficient' }, { word: 'enough' }])
  })
  await page.route('**en.wiktionary.org/**', async (route) => {
    await fulfillJson(route, {
      en: [
        {
          partOfSpeech: 'Adjective',
          definitions: [{ definition: 'Sufficient; good enough', examples: ['Adequate lighting is required.'] }],
        },
      ],
    })
  })
  await page.route('**translate.googleapis.com/**', async (route) => {
    await fulfillJson(route, [[['足够的', 'source', null, null, 10]], null, 'en', []])
  })
}

async function lookupFromHome(page: Page, word: string) {
  await page.goto(url('/'))
  await page.getByLabel('翻译内容').fill(word)
  await page.getByRole('button', { name: '查词', exact: true }).click()
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

  test('TC-DICT-002: 有道主通道展示音标/释义/网络释义/例句/短语/近义词', async ({ page }) => {
    await mockYoudao(page)
    await page.goto(url('/dictionary?q=adequate'))
    const panel = page.locator('[data-dictionary-panel]')
    await expect(panel).toBeVisible()
    await expect(page.getByText('数据来源：有道词典')).toBeVisible()
    await expect(panel.getByText('ˈædəkwət')).toBeVisible()
    await expect(panel.getByText('ˈædɪkwət')).toBeVisible()
    await expect(panel.locator('[data-dictionary-sense]')).toContainText('足够的；合格的；合乎需要的')
    await expect(panel.locator('[data-dictionary-sense]')).toContainText('adj.')
    await expect(panel.getByText('网络释义')).toBeVisible()
    await expect(panel.locator('[data-dictionary-web]')).toContainText('适当的')
    await expect(panel.locator('[data-dictionary-example]')).toContainText('缺少充分的安全保护一直是个隐患。')
    await expect(panel.locator('[data-dictionary-example]')).toContainText('bbs.ecocn.org')
    await expect(panel.getByText('adequate for')).toBeVisible()
    await expect(panel.locator('[data-dictionary-synonyms]')).toContainText('sufficient')
  })

  test('TC-DICT-008: 有道展示柯林斯星级/词形变化/近义词辨析', async ({ page }) => {
    await mockYoudao(page)
    await page.goto(url('/dictionary?q=adequate'))
    const panel = page.locator('[data-dictionary-panel]')
    await expect(panel).toBeVisible()
    // 柯林斯块：星级、词性、双语释义与例句
    const collins = panel.locator('[data-dictionary-collins]')
    await expect(collins).toBeVisible()
    await expect(collins.getByText('形容词')).toBeVisible()
    await expect(collins.locator('[aria-label="3 星"]')).toBeVisible()
    await expect(collins).toContainText('there is enough of it')
    await expect(collins).toContainText('One in four people worldwide are without adequate homes.')
    await expect(collins).toContainText('全世界四分之一的人没有足够的住房。')
    // 词形变化
    const forms = panel.locator('[data-dictionary-forms]')
    await expect(forms).toContainText('adequately')
    await expect(forms).toContainText('adv.')
    await expect(forms).toContainText('adequacy')
    // 近义词辨析
    const discrimination = panel.locator('[data-dictionary-discrimination]')
    await expect(discrimination).toContainText('sufficient')
    await expect(discrimination).toContainText('指数量充足，足够满足某种需要。')
  })

  test('TC-DICT-003: 有道失败回退 FreeDictionary 并补齐 Wiktionary 与中文', async ({ page }) => {
    await mockYoudaoFailure(page)
    await mockFreeChannels(page)
    await page.goto(url('/dictionary?q=adequate'))
    const panel = page.locator('[data-dictionary-panel]')
    await expect(page.getByText('数据来源：FreeDictionary')).toBeVisible()
    await expect(panel.getByText('ˈædəkwət')).toBeVisible()
    // 免费源只有英文释义，中文由翻译通道回填
    await expect(panel.locator('[data-dictionary-sense]').first()).toContainText('足够的')
    // 例句含免费源与 Wiktionary 补源，来源标注为 wiktionary
    await expect(panel.locator('[data-dictionary-example]').first()).toContainText('There was no adequate funding.')
    await expect(panel.locator('[data-dictionary-example]').nth(1)).toContainText('Adequate lighting is required.')
    await expect(panel.locator('[data-dictionary-example]').nth(1)).toContainText('en.wiktionary.org')
    await expect(panel.locator('[data-dictionary-synonyms]')).toContainText('sufficient')
  })

  test('TC-DICT-004: 多词查询直接报错不发请求', async ({ page }) => {
    const youdao = await mockYoudao(page)
    await page.goto(url('/dictionary?q=hello%20world'))
    await expect(page.getByText('未找到该词的词典释义，请检查拼写或网络后重试')).toBeVisible()
    expect(youdao.calls).toBe(0)
  })

  test('TC-DICT-005: 结果缓存，二次查询不再请求在线接口', async ({ page }) => {
    const youdao = await mockYoudao(page)
    await page.goto(url('/dictionary?q=adequate'))
    await expect(page.locator('[data-dictionary-panel]')).toBeVisible()
    // StrictMode 下 dev 首屏 effect 会双跑，只记录首屏请求数
    const firstLoadCalls = youdao.calls
    expect(firstLoadCalls).toBeGreaterThan(0)
    await page.goto(url('/'))
    await page.goto(url('/dictionary?q=adequate'))
    await expect(page.locator('[data-dictionary-sense]').first()).toBeVisible()
    expect(youdao.calls).toBe(firstLoadCalls)
  })

  test('TC-DICT-006: 添加单词页查词典并回填音标/释义/例句', async ({ page }) => {
    await mockYoudao(page)
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
    await panel.getByRole('button', { name: '设为例句' }).click()
    await expect(page.getByPlaceholder('输入例句')).toHaveValue('The lack of adequate security had been a concern since 2003.')
    await expect(page.getByPlaceholder('例句中文翻译（可选）')).toHaveValue('缺少充分的安全保护一直是个隐患。')
  })

  test('TC-DICT-007: 回填后可直接保存单词', async ({ page }) => {
    await mockYoudao(page)
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
})
