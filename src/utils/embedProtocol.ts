// 浏览器扩展 ⇄ 本 app 的消息协议（同源 iframe + postMessage）。
// 扩展 popup 内嵌 app（?embed=1），把划词结果通过 postMessage 交给 app 落库。
// 该文件是协议的唯一事实源，扩展侧 shared/protocol.ts 需与其保持一致。

export const EMBED_PROTOCOL_VERSION = 1

/** 划词送给 app 的单词（已由扩展侧完成查词与拆分） */
export interface EmbedCollectedWord {
  word: string
  phonetic?: string
  definitions: Array<{ pos: string; def: string; trans: string }>
  dictionaryExamples?: Array<{ en: string; zh: string; source?: string }>
  sourceUrl?: string
  sourceTitle?: string
}

export const EMBED_MESSAGE = {
  /** app → 父级：EmbedHost 已就绪可通信 */
  ready: 'vocab:embed-ready',
  /** 父级 → app：握手，携带协议版本 */
  ping: 'vocab:ping',
  /** app → 父级：请求分类列表 */
  requestCategories: 'vocab:request-categories',
  /** app → 父级：分类列表 */
  categoryList: 'vocab:category-list',
  /** 父级 → app：收藏单词 */
  collect: 'vocab:collect',
  /** app → 父级：收藏结果 */
  collectResult: 'vocab:collect-result',
} as const

export type EmbedMessageType = (typeof EMBED_MESSAGE)[keyof typeof EMBED_MESSAGE]

export interface EmbedCollectPayload {
  type: typeof EMBED_MESSAGE.collect
  requestId: string
  category: string
  words: EmbedCollectedWord[]
}

export interface EmbedCollectResultPayload {
  type: typeof EMBED_MESSAGE.collectResult
  requestId: string
  added: number
  skipped: number
  skippedWords: string[]
  errors: string[]
  category: string
}

export interface EmbedCategoryListPayload {
  type: typeof EMBED_MESSAGE.categoryList
  categories: string[]
}

/** 判断当前页面是否以 embed 精简模式加载 */
export function isEmbedMode(search: string = typeof location !== 'undefined' ? location.search : ''): boolean {
  return new URLSearchParams(search).get('embed') === '1'
}
