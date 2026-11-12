// 划选文本 → 单词数组。
// 规则：按非字母字符切分，保留含连字符/撇号的英文词，去重、过滤过短词与常见停用词。
// 仅面向英语划词（后续若扩展日语需另做分词）。

/** 常见功能词，划词收藏时价值低，默认过滤 */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'of', 'to', 'in', 'on', 'at', 'by',
  'for', 'with', 'as', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did',
  'have', 'has', 'had', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we',
  'they', 'them', 'his', 'her', 'our', 'their', 'my', 'your', 'me', 'us', 'so', 'not', 'no', 'yes',
  'will', 'would', 'can', 'could', 'should', 'may', 'might', 'must', 'from', 'into', 'than', 'too',
  'very', 'just', 'also', 'only', 'more', 'most', 'some', 'any', 'all', 'each', 'every', 'other',
])

const MIN_LENGTH = 2
const MAX_LENGTH = 32

export interface TokenizeOptions {
  /** 是否过滤停用词（默认 true） */
  filterStopWords?: boolean
}

/** 把一段划选文本拆成候选单词（已去重，保留首次出现的原始大小写） */
export function tokenizeSelection(text: string, options: TokenizeOptions = {}): string[] {
  const { filterStopWords = true } = options
  if (!text) return []

  // 英文词：字母开头，可含内部的连字符/撇号（如 well-known、don't）
  const matches = text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []

  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of matches) {
    const cleaned = raw.replace(/['’-]+$/, '').trim()
    if (cleaned.length < MIN_LENGTH || cleaned.length > MAX_LENGTH) continue
    // 纯字母或含内部连字符/撇号的形态才保留
    if (!/^[A-Za-z]+(?:['’-][A-Za-z]+)*$/.test(cleaned)) continue
    const key = cleaned.toLowerCase()
    if (filterStopWords && STOP_WORDS.has(key)) continue
    if (seen.has(key)) continue
    seen.add(key)
    result.push(cleaned)
  }
  return result
}

/** 判断划选内容是否可视为单个单词（用于单点查词，含连字符也算单词） */
export function isSingleWord(text: string): boolean {
  return /^[A-Za-z][A-Za-z'’-]*$/.test(text.trim())
}
