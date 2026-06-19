import { Word } from '../types/word'

export type ImportableWord = Omit<Word, 'id' | 'createdAt'>

export interface ParseResult {
  words: ImportableWord[]
  errors: string[]
}

function buildWord(raw: Record<string, any>): ImportableWord | null {
  const word = String(raw.word ?? '').trim()
  if (!word) return null

  const definition = String(raw.definition ?? raw.def ?? '').trim()
  const translation = String(raw.translation ?? raw.trans ?? raw.meaning ?? '').trim()
  // 至少需要释义或中文翻译之一
  if (!definition && !translation) return null

  const difficultyRaw = raw.difficulty
  let difficulty = Number(difficultyRaw)
  if (!Number.isFinite(difficulty) || difficulty < 1 || difficulty > 5) {
    difficulty = 1
  }

  return {
    word,
    phonetic: String(raw.phonetic ?? '').trim(),
    definition,
    example: String(raw.example ?? '').trim(),
    translation,
    category: String(raw.category ?? '默认').trim() || '默认',
    difficulty,
    notes: String(raw.notes ?? '').trim(),
    lastReviewedAt: 0,
    reviewCount: 0,
    correctCount: 0,
    streak: 0,
    easeFactor: 2.5,
    interval: 0,
    nextReviewAt: Date.now(),
    isLearned: 0,
    isFavorite: 0,
  }
}

export function parseWordsJson(content: string): ParseResult {
  const errors: string[] = []
  const words: ImportableWord[] = []

  let data: unknown
  try {
    data = JSON.parse(content)
  } catch (e: any) {
    return { words, errors: [`JSON 格式错误: ${e?.message ?? String(e)}`] }
  }

  const list = Array.isArray(data) ? data : (data as any)?.words
  if (!Array.isArray(list)) {
    return { words, errors: ['JSON 必须是数组，或包含 words 数组的对象'] }
  }

  list.forEach((item, idx) => {
    if (!item || typeof item !== 'object') {
      errors.push(`第 ${idx + 1} 条: 不是有效的对象`)
      return
    }
    const w = buildWord(item as Record<string, any>)
    if (!w) {
      errors.push(`第 ${idx + 1} 条: 缺少必要字段 (word + definition/translation)`)
      return
    }
    words.push(w)
  })

  return { words, errors }
}

// 简易 CSV 解析，支持双引号转义、逗号、换行
function parseCsv(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        row.push(cell)
        cell = ''
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && content[i + 1] === '\n') i++
        row.push(cell)
        rows.push(row)
        row = []
        cell = ''
      } else {
        cell += ch
      }
    }
  }
  // 收尾
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

export function parseWordsCsv(content: string): ParseResult {
  const errors: string[] = []
  const words: ImportableWord[] = []

  const rows = parseCsv(content)
  if (rows.length === 0) {
    return { words, errors: ['CSV 内容为空'] }
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase())
  const hasHeader = headers.includes('word')

  const dataRows = hasHeader ? rows.slice(1) : rows
  const cols = hasHeader
    ? headers
    : ['word', 'phonetic', 'definition', 'example', 'translation', 'category', 'difficulty']

  dataRows.forEach((cells, idx) => {
    const obj: Record<string, string> = {}
    cols.forEach((key, i) => {
      obj[key] = cells[i] ?? ''
    })
    const w = buildWord(obj)
    if (!w) {
      errors.push(`第 ${idx + 1} 行: 缺少必要字段 (word + definition/translation)`)
      return
    }
    words.push(w)
  })

  return { words, errors }
}

// 简单文本格式: 每行一个单词，使用 制表符 / 逗号 / | 分隔
// 列顺序: word, translation/definition, phonetic, example, category
export function parseWordsText(content: string): ParseResult {
  const errors: string[] = []
  const words: ImportableWord[] = []

  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '')
  lines.forEach((line, idx) => {
    const parts = line.split(/[\t|]|,(?=\S)/).map((s) => s.trim())
    const [wordStr, meaning = '', phonetic = '', example = '', category = ''] = parts

    const isChinese = /[一-龥]/.test(meaning)
    const obj: Record<string, string> = {
      word: wordStr,
      phonetic,
      example,
      category,
      [isChinese ? 'translation' : 'definition']: meaning,
    }

    const w = buildWord(obj)
    if (!w) {
      errors.push(`第 ${idx + 1} 行: 解析失败 "${line}"`)
      return
    }
    words.push(w)
  })

  return { words, errors }
}
