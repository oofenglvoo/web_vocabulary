// Unicode 汉字范围 -> 拼音首字母查表
function getPinyinInitial(char: string): string {
  const code = char.charCodeAt(0)
  if (code < 0x4e00 || code > 0x9fff) return char.toLowerCase()
  // 常见汉字拼音首字母分段 (简化版，覆盖大部分常用字)
  if (code >= 0x4e00 && code < 0x4e59) return 'a'
  if (code >= 0x4e59 && code < 0x4e8b) return 'b'
  if (code >= 0x4e8b && code < 0x4ed1) return 'c'
  if (code >= 0x4ed1 && code < 0x4f1e) return 'd'
  if (code >= 0x4f1e && code < 0x4f5a) return 'e'
  if (code >= 0x4f5a && code < 0x4fc2) return 'f'
  if (code >= 0x4fc2 && code < 0x502b) return 'g'
  if (code >= 0x502b && code < 0x5091) return 'h'
  if (code >= 0x5091 && code < 0x50e7) return 'j'
  if (code >= 0x50e7 && code < 0x5140) return 'k'
  if (code >= 0x5140 && code < 0x51a5) return 'l'
  if (code >= 0x51a5 && code < 0x5207) return 'm'
  if (code >= 0x5207 && code < 0x5236) return 'n'
  if (code >= 0x5236 && code < 0x5269) return 'p'
  if (code >= 0x5269 && code < 0x52c7) return 'q'
  if (code >= 0x52c7 && code < 0x52f5) return 'r'
  if (code >= 0x52f5 && code < 0x5360) return 's'
  if (code >= 0x5360 && code < 0x53d1) return 't'
  if (code >= 0x53d1 && code < 0x543e) return 'w'
  if (code >= 0x543e && code < 0x54af) return 'x'
  if (code >= 0x54af && code < 0x552e) return 'y'
  if (code >= 0x552e && code < 0x9fff) return 'z'
  return ''
}

// 生成中文文本的拼音首字母序列
// e.g. "你好世界" -> "nhsj"
export function toPinyinInitials(text: string): string {
  let result = ''
  for (const char of text) {
    if (/[一-鿿]/.test(char)) {
      result += getPinyinInitial(char)
    }
  }
  return result
}

// Levenshtein 距离 (编辑距离)
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
  }
  return dp[m][n]
}

// 模糊匹配：允许少量拼写错误
export function fuzzyMatch(query: string, target: string, maxDistance = 1): boolean {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  // 完全包含
  if (t.includes(q)) return true
  // 前缀匹配
  if (t.startsWith(q)) return true
  // 编辑距离匹配 (仅对短查询启用，避免性能问题)
  if (q.length <= 8 && t.length <= 20) {
    return levenshtein(q, t) <= maxDistance
  }
  return false
}

// 增强搜索：支持普通匹配 + 拼音首字母 + 模糊匹配
export function enhancedSearch(
  query: string,
  fields: { word: string; translation: string; definition: string }
): boolean {
  if (!query.trim()) return true
  const q = query.trim().toLowerCase()

  // 防御：字段可能来自旧数据而缺失，统一转字符串避免崩溃
  const word = String(fields.word ?? '')
  const translation = String(fields.translation ?? '')
  const definition = String(fields.definition ?? '')

  // 1. 精确子串匹配 (原有逻辑)
  if (word.toLowerCase().includes(q)) return true
  if (translation.includes(q)) return true
  if (definition.toLowerCase().includes(q)) return true

  // 2. 拼音首字母匹配 (输入是纯字母时匹配中文翻译)
  if (/^[a-zA-Z]+$/.test(q)) {
    const pinyin = toPinyinInitials(translation)
    if (pinyin.includes(q)) return true
  }

  // 3. 模糊匹配 (英文单词拼写容错)
  if (fuzzyMatch(q, word)) return true

  return false
}
