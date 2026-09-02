const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get'
const CACHE_PREFIX = 'vocab.translation.mymemory:'
const REQUEST_TIMEOUT_MS = 10000

function cacheKey(text: string, source: string, target: string) {
  return `${CACHE_PREFIX}${source}:${target}:${text}`
}

export async function translateWithMyMemory(
  text: string,
  source: 'en' | 'ja',
  target = 'zh-CN'
): Promise<string> {
  const normalizedText = text.trim()
  if (!normalizedText) throw new Error('待翻译内容为空')

  const key = cacheKey(normalizedText, source, target)
  try {
    const cached = localStorage.getItem(key)
    // Older requests may have cached the source text as a false translation.
    // Ignore that entry so a later request can pick a real candidate result.
    if (cached && cached.toLowerCase() !== normalizedText.toLowerCase()) return cached
  } catch {
    // Local storage may be unavailable; continue with the network request.
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const params = new URLSearchParams({ q: normalizedText, langpair: `${source}|${target}`, mt: '1' })
    const response = await fetch(`${MYMEMORY_ENDPOINT}?${params.toString()}`, { signal: controller.signal })
    if (!response.ok) throw new Error(`翻译服务响应异常 (${response.status})`)
    const data = await response.json() as {
      responseStatus?: number
      responseData?: { translatedText?: string }
      matches?: Array<{ translation?: string; match?: number }>
    }
    const responseTranslation = data.responseData?.translatedText?.trim()
    // MyMemory can return the source text as the top result even when a translated
    // match is available, especially for short words such as "address".
    const translatedText = data.matches
      ?.map((match) => match.translation?.trim())
      .find((match) => match && match.toLowerCase() !== normalizedText.toLowerCase())
      ?? responseTranslation
    if (!translatedText || data.responseStatus !== 200) throw new Error('翻译服务未返回有效结果')
    try {
      localStorage.setItem(key, translatedText)
    } catch {
      // Translation remains available for the current page when caching fails.
    }
    return translatedText
  } finally {
    window.clearTimeout(timeout)
  }
}
