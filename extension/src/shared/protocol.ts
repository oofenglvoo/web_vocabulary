// 与 app 侧 src/utils/embedProtocol.ts 保持一致的协议副本（扩展独立构建，无法直接 import app 源码）。
// 注：词典解析逻辑直接复用 app 的 src/utils/dictionary.ts，不再复制。
// 改动协议时请同步两份文件。

export const EMBED_PROTOCOL_VERSION = 1

export interface EmbedCollectedWord {
  word: string
  phonetic?: string
  definitions: Array<{ pos: string; def: string; trans: string }>
  dictionaryExamples?: Array<{ en: string; zh: string; source?: string }>
  sourceUrl?: string
  sourceTitle?: string
}

export const EMBED_MESSAGE = {
  ready: 'vocab:embed-ready',
  ping: 'vocab:ping',
  requestCategories: 'vocab:request-categories',
  categoryList: 'vocab:category-list',
  collect: 'vocab:collect',
  collectResult: 'vocab:collect-result',
} as const

export interface EmbedCollectResultPayload {
  type: typeof EMBED_MESSAGE.collectResult
  requestId: string
  added: number
  skipped: number
  skippedWords: string[]
  errors: string[]
  category: string
}

/** app iframe 地址（本地 dev 服务器） */
export const APP_EMBED_URL = 'http://127.0.0.1:5199/web_vocabulary/?embed=1'

/** popup 与 background/content 之间用的内部消息类型 */
export const RUNTIME_MESSAGE = {
  /** content → background：把待收藏数据交给 popup（会尝试打开面板） */
  collect: 'runtime:collect',
  /** content → background：向宿主 app 询问分类列表 */
  requestCategories: 'runtime:request-categories',
  /** popup → background：弹出面板完成后取回待办 + 分类请求 */
  pullPending: 'runtime:pull-pending',
  /** content → background：查询单个单词的词典释义 */
  lookup: 'runtime:lookup',
  /** popup → background：收藏完成，通知 background 转告来源标签页 */
  reportResult: 'runtime:report-result',
  /** background → content：收藏结果回执 */
  collectDone: 'content:collect-done',
} as const

/** background ⇄ offscreen 文档之间的消息类型 */
export const OFFSCREEN_MESSAGE = {
  lookup: 'offscreen:lookup',
} as const

/** offscreen 文档路径（对应构建产物） */
export const OFFSCREEN_PATH = 'src/offscreen/index.html'

/** 精简的词典结果（只带气泡展示需要的字段），避免跨进程传递完整对象 */
export interface LookupResult {
  word: string
  phonetic: string
  senses: Array<{ pos: string; trans: string }>
  /** 送给 app 落库用的完整释义（含 def） */
  definitions: Array<{ pos: string; def: string; trans: string }>
  dictionaryExamples: Array<{ en: string; zh: string; source?: string }>
  error?: string
}

export interface RuntimeLookupMessage {
  type: typeof RUNTIME_MESSAGE.lookup
  word: string
}

export interface PendingCollect {
  words: EmbedCollectedWord[]
  category: string
  createdAt: number
  /** 由气泡点「收藏」触发：popup 打开后自动提交，无需用户再点 */
  autoSubmit?: boolean
  /** 发起收藏的标签页 ID，用于把结果回传气泡提示 */
  tabId?: number
}

export interface PendingCategories {
  createdAt: number
}

export interface RuntimeCollectMessage {
  type: typeof RUNTIME_MESSAGE.collect
  words: EmbedCollectedWord[]
  category: string
}

export interface RuntimeRequestCategoriesMessage {
  type: typeof RUNTIME_MESSAGE.requestCategories
}
