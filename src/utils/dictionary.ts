// 在线词典：必应词典（cn.bing.com/dict/search）单通道。
// 必应词典页面向浏览器开放，但直接 fetch 受 CORS 限制，故经 r.jina.ai 免费代理取回 HTML，
// 再用 DOMParser 解析：美/英音标、词性释义、词形变化、双语例句（带来源）、网络释义。
// 结果按 30 天缓存在 localStorage，重复查询不再走网络。

const BING_DICT_ENDPOINT = 'https://cn.bing.com/dict/search'
const JINA_PROXY = 'https://r.jina.ai/'
const CACHE_PREFIX = 'vocab.dictionary:'
const REQUEST_TIMEOUT_MS = 8000
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30

export type DictionaryProvider = 'Bing'

export interface DictionarySense {
  pos: string
  trans: string
}

export interface DictionaryWebDefinition {
  value: string
  example?: string
}

export interface DictionaryExample {
  en: string
  zh: string
  source?: string
}

export interface DictionaryPhrase {
  phrase: string
  trans: string
}

/** 柯林斯星级释义（含权威双语释义与例句） */
export interface DictionaryCollinsEntry {
  pos: string
  star: number
  definition: string
  examples: DictionaryExample[]
}

/** 词形变化 / 派生词，如 adequate → adequately(adv.)、adequacy(n.) */
export interface DictionaryWordForm {
  pos: string
  word: string
  trans: string
}

/** 近义词辨析（同组易混词的用法说明） */
export interface DictionaryDiscrimination {
  headword: string
  usage: string
}

export interface DictionaryResult {
  word: string
  provider: DictionaryProvider
  usPhonetic?: string
  ukPhonetic?: string
  senses: DictionarySense[]
  webDefinitions: DictionaryWebDefinition[]
  examples: DictionaryExample[]
  phrases: DictionaryPhrase[]
  synonyms: string[]
  collins: DictionaryCollinsEntry[]
  wordForms: DictionaryWordForm[]
  discriminations: DictionaryDiscrimination[]
}

interface CacheEntry {
  savedAt: number
  result: DictionaryResult
}

/** 占位结果：查询中 / 失败时复用词典面板 */
export function emptyDictionaryResult(word: string): DictionaryResult {
  return {
    word,
    provider: 'Bing',
    senses: [],
    webDefinitions: [],
    examples: [],
    phrases: [],
    synonyms: [],
    collins: [],
    wordForms: [],
    discriminations: [],
  }
}

function cacheKey(word: string) {
  return `${CACHE_PREFIX}${word.toLocaleLowerCase()}`
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    window.clearTimeout(timeout)
  }
}

function cleanText(text: unknown): string {
  if (typeof text !== 'string') return ''
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const item of items) {
    const value = key(item)
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(item)
  }
  return result
}

// ---------- 必应词典（经 r.jina.ai 代理取 HTML） ----------

/** 从形如 "美 [ˈwʊmən]" / "英 ['wʊmən]" 的音标节点提取纯音标 */
function parsePhonetic(node: Element | null): string {
  if (!node) return ''
  const text = cleanText(node.textContent)
  const match = text.match(/[[(]([^\])]+)[\])]/)
  if (match) return cleanText(match[1])
  // 无方括号时剥掉语言前缀（如“美”“英”）
  return cleanText(text.replace(/^[美英]\s*/, ''))
}

function parseBing(html: string, word: string): DictionaryResult | null {
  if (!html.includes('<')) return null
  const doc = new DOMParser().parseFromString(html, 'text/html')

  // 音标：.hd_prUS 为美音，.hd_pr 为英音（必应没有 hd_prUK）
  const usPhonetic = parsePhonetic(doc.querySelector('.hd_prUS'))
  const ukPhonetic = parsePhonetic(doc.querySelector('.hd_pr'))

  // 词性释义：.qdef ul li 内 .pos + .def；.pos.web 的是网络释义，单独归入 webDefinitions
  const senses: DictionarySense[] = []
  const webDefinitions: DictionaryWebDefinition[] = []
  doc.querySelectorAll('.qdef ul li').forEach((li) => {
    const defNode = li.querySelector('.def')
    const trans = cleanText(defNode?.textContent)
    if (!trans) return
    const posNode = li.querySelector('.pos')
    if (posNode?.classList.contains('web')) {
      webDefinitions.push({ value: trans })
      return
    }
    senses.push({ pos: cleanText(posNode?.textContent), trans })
  })

  // 词形变化：形如“词形: women”
  const wordForms: DictionaryWordForm[] = []
  doc.querySelectorAll('.de_wf, .de_wf_d, .df_wb_c, [id^="wordform"]').forEach((node) => {
    const text = cleanText(node.textContent)
    const match = text.match(/词形[：:]\s*(.+)$/)
    if (!match) return
    for (const form of match[1].split(/[,，;；]/)) {
      const cleaned = cleanText(form)
      if (cleaned) wordForms.push({ pos: '', word: cleaned, trans: '' })
    }
  })

  // 双语例句：#sentenceSeg 内 .sen_en + .sen_cn 成对，来源在紧随其后的 .sen_li 链接
  const examples: DictionaryExample[] = []
  doc.querySelectorAll('#sentenceSeg .se_li').forEach((li) => {
    const en = cleanText(li.querySelector('.sen_en')?.textContent)
    if (!en) return
    const zh = cleanText(li.querySelector('.sen_cn')?.textContent)
    const sourceText = cleanText(li.querySelector('.sen_li a, cite')?.textContent)
    examples.push({ en, zh, source: sourceText || undefined })
  })

  const result: DictionaryResult = {
    word,
    provider: 'Bing',
    usPhonetic: usPhonetic || undefined,
    ukPhonetic: ukPhonetic || undefined,
    senses: uniqueBy(senses, (sense) => `${sense.pos}|${sense.trans}`).slice(0, 12),
    webDefinitions: uniqueBy(webDefinitions, (item) => item.value).slice(0, 10),
    examples: uniqueBy(examples, (item) => item.en).slice(0, 8),
    phrases: [],
    synonyms: [],
    collins: [],
    wordForms: uniqueBy(wordForms, (item) => item.word.toLowerCase()).slice(0, 12),
    discriminations: [],
  }

  const hasContent =
    result.senses.length > 0 ||
    result.webDefinitions.length > 0 ||
    result.examples.length > 0 ||
    result.wordForms.length > 0 ||
    !!result.usPhonetic ||
    !!result.ukPhonetic
  return hasContent ? result : null
}

async function lookupWithBing(word: string): Promise<DictionaryResult> {
  const target = `${BING_DICT_ENDPOINT}?q=${encodeURIComponent(word)}&mkt=zh-CN`
  const response = await fetchWithTimeout(`${JINA_PROXY}${target}`, { headers: { 'x-respond-with': 'html' } })
  if (!response.ok) throw new Error(`必应词典服务响应异常 (${response.status})`)
  const html = await response.text()
  const result = parseBing(html, word)
  if (!result) throw new Error('必应词典未返回有效词条')
  return result
}

const CHANNELS: Array<{ provider: DictionaryProvider; run: (word: string) => Promise<DictionaryResult> }> = [
  { provider: 'Bing', run: lookupWithBing },
]

export async function lookupDictionary(word: string): Promise<DictionaryResult> {
  const normalizedWord = word.trim()
  if (!normalizedWord) throw new Error('待查询内容为空')
  if (/\s/.test(normalizedWord)) throw new Error('词典仅支持单个单词查询')

  const key = cacheKey(normalizedWord)
  try {
    const cached = localStorage.getItem(key)
    if (cached) {
      const parsed = JSON.parse(cached) as CacheEntry
      if (parsed?.result && Date.now() - parsed.savedAt < CACHE_TTL_MS) return parsed.result
    }
  } catch {
    // localStorage 不可用或缓存格式异常时继续走网络
  }

  let lastError: unknown = null
  for (const channel of CHANNELS) {
    try {
      const result = await channel.run(normalizedWord)
      try {
        const entry: CacheEntry = { savedAt: Date.now(), result }
        localStorage.setItem(key, JSON.stringify(entry))
      } catch {
        // 缓存失败不影响本次返回
      }
      return result
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('所有词典通道均不可用')
}
