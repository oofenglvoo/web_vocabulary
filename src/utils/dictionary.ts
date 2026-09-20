// 在线词典：多通道回退。
// 主通道 有道词典（dict.youdao.com/jsonapi，经 r.jina.ai 免费代理绕开 CORS），
//   含音标、英汉释义、网络释义、双语例句（带来源）、短语、近义词。
// 备通道 纯前端免费源（freedictionaryapi 并用 Wiktionary 补释义/例句，近义词取 Datamuse，均无中文），
//   中文释义由 translateOnline 补充。
// 任一通道成功即返回；两条都失败才抛出错误。

import { translateOnline } from './translation'

const YOUDao_ENDPOINT = 'https://dict.youdao.com/jsonapi'
const JINA_PROXY = 'https://r.jina.ai/'
const FREE_DICT_ENDPOINT = 'https://freedictionaryapi.com/api/v1/entries/en/'
const WIKTIONARY_ENDPOINT = 'https://en.wiktionary.org/api/rest_v1/page/definition/'
const DATAMUSE_ENDPOINT = 'https://api.datamuse.com/words'
const CACHE_PREFIX = 'vocab.dictionary:'
const REQUEST_TIMEOUT_MS = 8000
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30

export type DictionaryProvider = 'Youdao' | 'FreeDictionary'

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
    provider: 'Youdao',
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

// ---------- 有道（经 r.jina.ai 代理） ----------

interface YoudaoTranslation {
  value?: string
  summary?: { line?: string[] }
}

interface YoudaoSentencePair {
  sentence?: string
  'sentence-translation'?: string
  source?: string
}

interface YoudaoCollinsExamSentence {
  eng_sent?: string
  chn_sent?: string
}

interface YoudaoCollinsTranEntry {
  pos_entry?: { pos?: string; pos_tips?: string }
  tran?: string
  exam_sents?: { sent?: YoudaoCollinsExamSentence[] }
}

interface YoudaCollinsEntry {
  headword?: string
  star?: string
  entries?: { entry?: Array<{ tran_entry?: YoudaoCollinsTranEntry[] }> }
}

interface YoudaoRelWord {
  rel?: { pos?: string; words?: Array<{ word?: string; tran?: string }> }
}

interface YoudaoDiscriminateUsage {
  headword?: string
  usage?: string
}

interface YoudaoJson {
  simple?: { word?: Array<{ usphone?: string; ukphone?: string }> }
  ec?: { word?: Array<{ usphone?: string; ukphone?: string; trs?: Array<{ tr?: Array<{ l?: { i?: string | string[] } }> }> }> }
  web_trans?: { 'web-translation'?: Array<{ trans?: YoudaoTranslation[] }> }
  blng_sents_part?: { 'sentence-pair'?: YoudaoSentencePair[] }
  phrs?: { phrs?: Array<{ phr?: { headword?: { l?: { i?: string } }; trs?: Array<{ tr?: { l?: { i?: string } } }> } }> }
  syno?: { synos?: Array<{ syno?: { pos?: string; ws?: Array<{ w?: string }> } }> }
  collins?: { collins_entries?: YoudaCollinsEntry[] }
  rel_word?: { rels?: YoudaoRelWord[] }
  discriminate?: { data?: Array<{ usages?: YoudaoDiscriminateUsage[] }> }
}

function firstString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return cleanText(value[0])
  return cleanText(value)
}

function parseYoudao(data: YoudaoJson, word: string): DictionaryResult | null {
  const ecWord = data.ec?.word?.[0]
  const simpleWord = data.simple?.word?.[0]
  const usPhonetic = cleanText(ecWord?.usphone) || cleanText(simpleWord?.usphone)
  const ukPhonetic = cleanText(ecWord?.ukphone) || cleanText(simpleWord?.ukphone)

  const senses: DictionarySense[] = []
  for (const trs of ecWord?.trs ?? []) {
    for (const tr of trs.tr ?? []) {
      const trans = firstString(tr.l?.i)
      if (!trans) continue
      // 有道把词性写在释义文本开头，如 "adj. 足够的；..."，拆分出词性
      const match = trans.match(/^([a-zA-Z]+\.)\s*(.*)$/)
      senses.push(match ? { pos: match[1], trans: match[2].trim() } : { pos: '', trans })
    }
  }

  const webDefinitions: DictionaryWebDefinition[] = []
  for (const entry of data.web_trans?.['web-translation'] ?? []) {
    for (const trans of entry.trans ?? []) {
      const value = cleanText(trans.value)
      if (!value) continue
      const example = cleanText(trans.summary?.line?.[0])
      webDefinitions.push({ value, example: example || undefined })
    }
  }

  const examples: DictionaryExample[] = []
  for (const pair of data.blng_sents_part?.['sentence-pair'] ?? []) {
    const en = cleanText(pair.sentence)
    const zh = cleanText(pair['sentence-translation'])
    if (!en || !zh) continue
    examples.push({ en, zh, source: cleanText(pair.source) || undefined })
  }

  const phrases: DictionaryPhrase[] = []
  for (const item of data.phrs?.phrs ?? []) {
    const phrase = cleanText(item.phr?.headword?.l?.i)
    const trans = firstString(item.phr?.trs?.[0]?.tr?.l?.i)
    if (phrase && trans) phrases.push({ phrase, trans })
  }

  const synonyms: string[] = []
  for (const item of data.syno?.synos ?? []) {
    for (const ws of item.syno?.ws ?? []) {
      const synonym = cleanText(ws.w)
      if (synonym && synonym.toLowerCase() !== word.toLowerCase()) synonyms.push(synonym)
    }
  }

  // 柯林斯星级释义：每个 tran_entry 是一个词性下的权威双语释义 + 例句
  const collins: DictionaryCollinsEntry[] = []
  for (const entry of data.collins?.collins_entries ?? []) {
    const star = Number.parseInt(cleanText(entry.star), 10)
    for (const tranEntry of entry.entries?.entry ?? []) {
      for (const item of tranEntry.tran_entry ?? []) {
        const definition = cleanText(item.tran)
        if (!definition) continue
        const examples: DictionaryExample[] = []
        for (const sent of item.exam_sents?.sent ?? []) {
          const en = cleanText(sent.eng_sent)
          const zh = cleanText(sent.chn_sent)
          if (en && zh) examples.push({ en, zh, source: '柯林斯' })
        }
        collins.push({
          pos: cleanText(item.pos_entry?.pos_tips) || cleanText(item.pos_entry?.pos),
          star: Number.isNaN(star) ? 0 : star,
          definition,
          examples: uniqueBy(examples, (example) => example.en).slice(0, 3),
        })
      }
    }
  }

  // 词形变化 / 派生词，如 adequate → adequately(adv.)、adequacy(n.)
  const wordForms: DictionaryWordForm[] = []
  for (const rel of data.rel_word?.rels ?? []) {
    const pos = cleanText(rel.rel?.pos)
    for (const item of rel.rel?.words ?? []) {
      const form = cleanText(item.word)
      if (!form) continue
      wordForms.push({ pos, word: form, trans: cleanText(item.tran) })
    }
  }

  // 近义词辨析：同组易混词的用法说明（data 为数组，取第一组）
  const discriminations: DictionaryDiscrimination[] = []
  for (const group of data.discriminate?.data ?? []) {
    for (const usage of group.usages ?? []) {
      const headword = cleanText(usage.headword)
      const text = cleanText(usage.usage)
      if (headword && text) discriminations.push({ headword, usage: text })
    }
  }

  const result: DictionaryResult = {
    word,
    provider: 'Youdao',
    usPhonetic: usPhonetic || undefined,
    ukPhonetic: ukPhonetic || undefined,
    senses: uniqueBy(senses, (sense) => `${sense.pos}|${sense.trans}`),
    webDefinitions: uniqueBy(webDefinitions, (item) => item.value).slice(0, 10),
    examples: uniqueBy(examples, (item) => item.en).slice(0, 8),
    phrases: uniqueBy(phrases, (item) => item.phrase).slice(0, 10),
    synonyms: uniqueBy(synonyms, (item) => item.toLowerCase()).slice(0, 15),
    collins: collins.slice(0, 4),
    wordForms: uniqueBy(wordForms, (item) => `${item.pos}|${item.word}`).slice(0, 12),
    discriminations: uniqueBy(discriminations, (item) => item.headword).slice(0, 8),
  }

  const hasContent =
    result.senses.length > 0 ||
    result.webDefinitions.length > 0 ||
    result.examples.length > 0 ||
    result.usPhonetic ||
    result.ukPhonetic
  return hasContent ? result : null
}

async function lookupWithYoudao(word: string): Promise<DictionaryResult> {
  const target = `${YOUDao_ENDPOINT}?q=${encodeURIComponent(word)}`
  const response = await fetchWithTimeout(`${JINA_PROXY}${target}`, { headers: { 'x-respond-with': 'text' } })
  if (!response.ok) throw new Error(`有道词典服务响应异常 (${response.status})`)
  const text = await response.text()
  if (!text.trim().startsWith('{')) throw new Error('有道词典未返回有效结果')
  const data = JSON.parse(text) as YoudaoJson
  const result = parseYoudao(data, word)
  if (!result) throw new Error('有道词典未返回有效词条')
  return result
}

// ---------- 纯前端免费源（无中文，用翻译补齐） ----------

interface FreeDictSense {
  definition?: string
  examples?: string[]
}

interface FreeDictEntry {
  partOfSpeech?: string
  pronunciations?: Array<{ type?: string; text?: string; tags?: string[] }>
  senses?: FreeDictSense[]
}

async function lookupWithFreeDictionary(word: string): Promise<DictionaryResult> {
  const response = await fetchWithTimeout(`${FREE_DICT_ENDPOINT}${encodeURIComponent(word)}`)
  if (!response.ok) throw new Error(`FreeDictionary 服务响应异常 (${response.status})`)
  const data = await response.json() as { word?: string; entries?: FreeDictEntry[] }

  const entries = data.entries ?? []
  if (entries.length === 0) throw new Error('FreeDictionary 未返回有效词条')

  let usPhonetic = ''
  let ukPhonetic = ''
  for (const entry of entries) {
    for (const pronunciation of entry.pronunciations ?? []) {
      if (pronunciation.type !== 'ipa' || !pronunciation.text) continue
      const tags = pronunciation.tags ?? []
      if (!usPhonetic && tags.includes('US')) usPhonetic = cleanText(pronunciation.text)
      else if (!ukPhonetic && (tags.includes('UK') || tags.includes('Received Pronunciation'))) {
        ukPhonetic = cleanText(pronunciation.text)
      }
    }
  }

  const senses: DictionarySense[] = []
  const examples: DictionaryExample[] = []
  for (const entry of entries) {
    const pos = cleanText(entry.partOfSpeech)
    for (const sense of entry.senses ?? []) {
      const definition = cleanText(sense.definition)
      if (!definition) continue
      // 先用英文释义占位，随后用翻译接口回填中文
      senses.push({ pos, trans: definition })
      for (const example of sense.examples ?? []) {
        const cleaned = cleanText(example)
        if (cleaned && cleaned.length < 240) examples.push({ en: cleaned, zh: '' })
      }
    }
  }

  const result: DictionaryResult = {
    word,
    provider: 'FreeDictionary',
    usPhonetic: usPhonetic || undefined,
    ukPhonetic: ukPhonetic || undefined,
    senses: uniqueBy(senses, (sense) => `${sense.pos}|${sense.trans}`).slice(0, 12),
    webDefinitions: [],
    examples: uniqueBy(examples, (item) => item.en).slice(0, 5),
    phrases: [],
    synonyms: await lookupSynonyms(word),
    collins: [],
    wordForms: [],
    discriminations: [],
  }

  // Wiktionary 补源：主通道已失败，这里尽量多凑一份可用结果（同为英文，随后统一走翻译回填）
  await supplementWithWiktionary(result)

  // 中文用现有翻译通道补齐（失败则保留英文）
  await translateFreeDictionaryContent(result)
  return result
}

interface WiktionaryDefinition {
  definition?: string
  examples?: string[]
}

interface WiktionaryEntry {
  partOfSpeech?: string
  definitions?: WiktionaryDefinition[]
}

const WIKTIONARY_POS: Record<string, string> = {
  noun: 'n.',
  verb: 'v.',
  adjective: 'adj.',
  adverb: 'adv.',
  preposition: 'prep.',
  conjunction: 'conj.',
  pronoun: 'pron.',
  interjection: 'interj.',
  article: 'art.',
  determiner: 'det.',
}

async function lookupWithWiktionary(word: string): Promise<Omit<DictionaryResult, 'word' | 'provider'>> {
  const empty = {
    usPhonetic: undefined,
    ukPhonetic: undefined,
    senses: [],
    webDefinitions: [],
    examples: [],
    phrases: [],
    synonyms: [],
    collins: [],
    wordForms: [],
    discriminations: [],
  }
  try {
    const response = await fetchWithTimeout(`${WIKTIONARY_ENDPOINT}${encodeURIComponent(word)}`)
    if (!response.ok) return empty
    const data = await response.json() as Record<string, WiktionaryEntry[]>

    const senses: DictionarySense[] = []
    const examples: DictionaryExample[] = []
    for (const entry of data.en ?? []) {
      const rawPos = cleanText(entry.partOfSpeech).toLowerCase()
      const pos = WIKTIONARY_POS[rawPos] ?? rawPos
      for (const sense of entry.definitions ?? []) {
        const trans = cleanText(sense.definition)
        if (!trans) continue
        senses.push({ pos, trans })
        for (const example of sense.examples ?? []) {
          const cleaned = cleanText(example)
          if (cleaned && cleaned.length < 240) examples.push({ en: cleaned, zh: '', source: 'en.wiktionary.org' })
        }
      }
    }
    return { ...empty, senses: uniqueBy(senses, (item) => `${item.pos}|${item.trans}`).slice(0, 8), examples: uniqueBy(examples, (item) => item.en).slice(0, 5) }
  } catch {
    return empty
  }
}

async function supplementWithWiktionary(result: DictionaryResult) {
  const extra = await lookupWithWiktionary(result.word)
  result.senses = uniqueBy([...result.senses, ...extra.senses], (sense) => `${sense.pos}|${sense.trans}`).slice(0, 12)
  result.examples = uniqueBy([...result.examples, ...extra.examples], (item) => item.en).slice(0, 5)
}

async function lookupSynonyms(word: string): Promise<string[]> {
  try {
    const response = await fetchWithTimeout(`${DATAMUSE_ENDPOINT}?rel_syn=${encodeURIComponent(word)}&max=12`)
    if (!response.ok) return []
    const data = await response.json() as Array<{ word?: string }>
    return uniqueBy(
      data.map((item) => cleanText(item.word)).filter((item) => !!item && item.toLowerCase() !== word.toLowerCase()),
      (item) => item.toLowerCase()
    ).slice(0, 12)
  } catch {
    return []
  }
}

async function translateFreeDictionaryContent(result: DictionaryResult) {
  try {
    const senseTranslations = await Promise.all(
      result.senses.map((sense) => translateOnline(sense.trans, 'en').then((r) => r.text).catch(() => ''))
    )
    result.senses = result.senses.map((sense, index) => ({
      pos: sense.pos,
      trans: senseTranslations[index] || sense.trans,
    }))
  } catch {
    // 翻译失败时保留英文释义
  }
  try {
    const exampleTranslations = await Promise.all(
      result.examples.map((example) => translateOnline(example.en, 'en').then((r) => r.text).catch(() => ''))
    )
    result.examples = result.examples.map((example, index) => ({
      ...example,
      zh: exampleTranslations[index] || '',
    }))
  } catch {
    // 翻译失败时保留英文例句
  }
}

const CHANNELS: Array<{ provider: DictionaryProvider; run: (word: string) => Promise<DictionaryResult> }> = [
  { provider: 'Youdao', run: lookupWithYoudao },
  { provider: 'FreeDictionary', run: lookupWithFreeDictionary },
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
