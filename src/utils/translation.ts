// 在线翻译：多通道回退。
// 主通道 Google（translate.googleapis.com 免密钥接口，配额宽松、响应快），
// 备通道 MyMemory（免费 JSON API，但匿名日配额低、易限流）。
// 任一通道成功即返回；两条都失败才抛出错误。

const GOOGLE_ENDPOINT = 'https://translate.googleapis.com/translate_a/single'
const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get'
const CACHE_PREFIX = 'vocab.translation:'
const REQUEST_TIMEOUT_MS = 8000

export type TranslationProvider = 'Google' | 'MyMemory'

export interface TranslationResult {
  text: string
  provider: TranslationProvider
}

function cacheKey(text: string, source: string, target: string) {
  return `${CACHE_PREFIX}${source}:${target}:${text}`
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    window.clearTimeout(timeout)
  }
}

// Google 免密钥接口：data[0] 为分段数组，每段 [译文, 原文, ...]，拼接所有段即完整译文
async function translateWithGoogle(text: string, source: string, target: string): Promise<string> {
  const params = new URLSearchParams({ client: 'gtx', sl: source, tl: target, dt: 't', q: text })
  const response = await fetchWithTimeout(`${GOOGLE_ENDPOINT}?${params.toString()}`)
  if (!response.ok) throw new Error(`Google 翻译服务响应异常 (${response.status})`)
  const data = await response.json()
  const segments: unknown = Array.isArray(data) ? data[0] : null
  if (!Array.isArray(segments)) throw new Error('Google 翻译未返回有效结果')
  const translated = segments
    .map((segment) => (Array.isArray(segment) && typeof segment[0] === 'string' ? segment[0] : ''))
    .join('')
    .trim()
  if (!translated) throw new Error('Google 翻译未返回有效结果')
  return translated
}

async function translateWithMyMemory(text: string, source: string, target: string): Promise<string> {
  const params = new URLSearchParams({ q: text, langpair: `${source}|${target}`, mt: '1' })
  const response = await fetchWithTimeout(`${MYMEMORY_ENDPOINT}?${params.toString()}`)
  if (!response.ok) throw new Error(`MyMemory 翻译服务响应异常 (${response.status})`)
  const data = await response.json() as {
    responseStatus?: number
    responseData?: { translatedText?: string }
    matches?: Array<{ translation?: string; match?: number }>
  }
  const responseTranslation = data.responseData?.translatedText?.trim() ?? ''
  // MyMemory 触发日配额或参数异常时，会在正常响应体里返回警告文本而非译文
  if (/MYMEMORY WARNING|INVALID|QUERY LENGTH/i.test(responseTranslation)) {
    throw new Error('MyMemory 触发限额或返回异常')
  }
  // MyMemory 对短词（如 address）常把原文当作首选结果返回，
  // 即使 matches 里有真正的译文。这里优先取不等于原文的候选。
  const translatedText = data.matches
    ?.map((match) => match.translation?.trim())
    .find((match) => match && match.toLowerCase() !== text.toLowerCase())
    ?? responseTranslation
  if (!translatedText || data.responseStatus !== 200) throw new Error('MyMemory 未返回有效结果')
  return translatedText
}

const CHANNELS: Array<{ provider: TranslationProvider; run: (t: string, s: string, tg: string) => Promise<string> }> = [
  { provider: 'Google', run: translateWithGoogle },
  { provider: 'MyMemory', run: translateWithMyMemory },
]

export async function translateOnline(
  text: string,
  source: 'en' | 'ja',
  target = 'zh-CN'
): Promise<TranslationResult> {
  const normalizedText = text.trim()
  if (!normalizedText) throw new Error('待翻译内容为空')

  const key = cacheKey(normalizedText, source, target)
  try {
    const cached = localStorage.getItem(key)
    if (cached) {
      const parsed = JSON.parse(cached) as TranslationResult
      // 早期可能把原文误当译文缓存，忽略这类条目以便重新获取真实译文
      if (parsed?.text && parsed.text.toLowerCase() !== normalizedText.toLowerCase()) return parsed
    }
  } catch {
    // localStorage 不可用或缓存格式异常时继续走网络
  }

  let lastError: unknown = null
  for (const channel of CHANNELS) {
    try {
      const translated = await channel.run(normalizedText, source, target)
      if (translated.toLowerCase() === normalizedText.toLowerCase()) {
        // 译文与原文相同通常意味着该通道没能真正翻译，留给下一个通道尝试
        lastError = new Error(`${channel.provider} 未返回有效译文`)
        continue
      }
      const result: TranslationResult = { text: translated, provider: channel.provider }
      try {
        localStorage.setItem(key, JSON.stringify(result))
      } catch {
        // 缓存失败不影响本次返回
      }
      return result
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('所有翻译通道均不可用')
}
