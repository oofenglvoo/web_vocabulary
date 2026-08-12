import { Word, Sentence, Definition } from '../types/word'

export type ImportableWord = Omit<Word, 'id' | 'createdAt'>
export type ImportableSentence = Omit<Sentence, 'id' | 'createdAt'>

export interface ParseResult {
  words: ImportableWord[]
  errors: string[]
}

export interface SentenceParseResult {
  sentences: ImportableSentence[]
  errors: string[]
}

function buildWord(raw: Record<string, any>): ImportableWord | null {
  const word = String(raw.word ?? '').trim()
  if (!word) return null

  // 先解析多释义数组（可能只有 definitions，没有顶层 definition/translation）
  let definitions: Definition[] = []
  if (Array.isArray(raw.definitions) && raw.definitions.length > 0) {
    definitions = raw.definitions
      .filter((d: any) => d && (String(d.def ?? '').trim() || String(d.trans ?? '').trim()))
      .map((d: any) => ({
        pos: String(d.pos ?? '').trim(),
        def: String(d.def ?? '').trim(),
        trans: String(d.trans ?? '').trim(),
      }))
  }

  // 再读旧字段（兼容只有 definition/translation 的文件）
  const definition = String(raw.definition ?? raw.def ?? '').trim()
  const translation = String(raw.translation ?? raw.trans ?? raw.meaning ?? '').trim()

  // 必要字段：word + 有释义（definitions 数组或旧字段至少有一个非空）
  if (definitions.length === 0 && !definition && !translation) return null

  // 如果只有旧字段，构造 definitions；如果有 definitions 但旧字段为空，回填第一个释义
  if (definitions.length === 0 && (definition || translation)) {
    definitions = [{ pos: '', def: definition, trans: translation }]
  } else if (definitions.length > 0) {
    const primary = definitions.find((d) => d.def || d.trans)
    if (primary) {
      if (!definition) raw.definition = primary.def
      if (!translation) raw.translation = primary.trans
    }
  }

  const difficultyRaw = raw.difficulty
  let difficulty = Number(difficultyRaw)
  if (!Number.isFinite(difficulty) || difficulty < 1 || difficulty > 5) {
    difficulty = 1
  }

  return {
    word,
    phonetic: String(raw.phonetic ?? '').trim(),
    definition: String(raw.definition ?? '').trim(),
    example: String(raw.example ?? '').trim(),
    translation: String(raw.translation ?? '').trim(),
    definitions,
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
    srsStage: 0,
    stageProgress: 0,
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
    const obj: Record<string, any> = {}
    cols.forEach((key, i) => {
      obj[key] = cells[i] ?? ''
    })
    // 尝试解析 definitions 列（JSON 数组）
    if (obj.definitions && typeof obj.definitions === 'string') {
      const defsStr = obj.definitions.trim()
      if (defsStr.startsWith('[')) {
        try {
          obj.definitions = JSON.parse(defsStr)
        } catch {
          // 解析失败则忽略，当作普通字符串
        }
      }
    }
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
// 多释义: 第二列用分号分隔，如 "银行;河岸;存钱" 或 "n. 银行; n. 河岸; v. 存钱"
export function parseWordsText(content: string): ParseResult {
  const errors: string[] = []
  const words: ImportableWord[] = []

  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '')
  lines.forEach((line, idx) => {
    const parts = line.split(/[\t|]|,(?=\S)/).map((s) => s.trim())
    const [wordStr, meaning = '', phonetic = '', example = '', category = ''] = parts

    // 检测是否含多释义（分号分隔）
    const hasMultipleDefs = meaning.includes(';') || meaning.includes('；')
    if (hasMultipleDefs) {
      const defParts = meaning.split(/[;；]/).map((s) => s.trim()).filter(Boolean)
      const definitions: Definition[] = defParts.map((part) => {
        // 尝试解析 "词性. 释义" 格式，如 "n. 银行"
        const posMatch = part.match(/^([a-z]+\.)\s*(.*)/i)
        if (posMatch) {
          const pos = posMatch[1]
          const rest = posMatch[2]
          const isChinese = /[一-龥]/.test(rest)
          return { pos, def: isChinese ? '' : rest, trans: isChinese ? rest : '' }
        }
        // 无词性前缀
        const isChinese = /[一-龥]/.test(part)
        return { pos: '', def: isChinese ? '' : part, trans: isChinese ? part : '' }
      })

      const obj: Record<string, any> = {
        word: wordStr,
        phonetic,
        example,
        category,
        definitions,
        // 向前兼容：取第一个释义填入旧字段
        definition: definitions.find((d) => d.def)?.def ?? '',
        translation: definitions.find((d) => d.trans)?.trans ?? '',
      }

      const w = buildWord(obj)
      if (!w) {
        errors.push(`第 ${idx + 1} 行: 解析失败 "${line}"`)
        return
      }
      words.push(w)
      return
    }

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

// ===== 短句导入 =====

function buildSentence(raw: Record<string, any>): ImportableSentence | null {
  const sentence = String(raw.sentence ?? '').trim()
  if (!sentence) return null

  const translation = String(raw.translation ?? '').trim()
  const example = String(raw.example ?? '').trim()
  const category = String(raw.category ?? '').trim()
  const difficulty = raw.difficulty != null ? Number(raw.difficulty) : 3
  const notes = String(raw.notes ?? '').trim()

  // 构建多释义数组
  let definitions: Definition[] = []
  if (Array.isArray(raw.definitions) && raw.definitions.length > 0) {
    definitions = raw.definitions
      .filter((d: any) => d && (String(d.def ?? '').trim() || String(d.trans ?? '').trim()))
      .map((d: any) => ({
        pos: String(d.pos ?? '').trim(),
        def: String(d.def ?? '').trim(),
        trans: String(d.trans ?? '').trim(),
      }))
  }
  // 如果没有 definitions 数组，从旧字段构造
  if (definitions.length === 0 && translation) {
    definitions = [{ pos: '', def: '', trans: translation }]
  }

  return {
    sentence,
    translation,
    definitions,
    example,
    category,
    difficulty: Number.isFinite(difficulty) ? difficulty : 3,
    notes,
    isFavorite: 0,
    isLearned: 0,
    interval: 0,
    easeFactor: 2.5,
    nextReviewAt: Date.now(),
    lastReviewedAt: 0,
    reviewCount: 0,
    correctCount: 0,
    streak: 0,
    srsStage: 0,
    stageProgress: 0,
  }
}

export function parseSentencesJson(content: string): SentenceParseResult {
  const errors: string[] = []
  const sentences: ImportableSentence[] = []

  try {
    const data = JSON.parse(content)
    const list = Array.isArray(data) ? data : data.sentences ?? []
    list.forEach((item: any, idx: number) => {
      const s = buildSentence(item)
      if (!s) {
        errors.push(`第 ${idx + 1} 项: 缺少 sentence 字段`)
        return
      }
      sentences.push(s)
    })
  } catch (e: any) {
    errors.push(`JSON 解析失败: ${e.message}`)
  }

  return { sentences, errors }
}

export function parseSentencesCsv(content: string): SentenceParseResult {
  const errors: string[] = []
  const sentences: ImportableSentence[] = []

  const rows = parseCsv(content)
  if (rows.length === 0) {
    return { sentences, errors }
  }

  const header = rows[0].map((h) => h.trim().toLowerCase())
  const dataRows = rows.slice(1)

  const sentenceIdx = header.indexOf('sentence')
  if (sentenceIdx === -1) {
    errors.push('CSV 缺少 sentence 列')
    return { sentences, errors }
  }

  const translationIdx = header.indexOf('translation')
  const exampleIdx = header.indexOf('example')
  const categoryIdx = header.indexOf('category')
  const difficultyIdx = header.indexOf('difficulty')
  const notesIdx = header.indexOf('notes')
  const definitionsIdx = header.indexOf('definitions')

  dataRows.forEach((cols, idx) => {
    const obj: Record<string, any> = {
      sentence: cols[sentenceIdx] ?? '',
      translation: translationIdx >= 0 ? (cols[translationIdx] ?? '') : '',
      example: exampleIdx >= 0 ? (cols[exampleIdx] ?? '') : '',
      category: categoryIdx >= 0 ? (cols[categoryIdx] ?? '') : '',
      difficulty: difficultyIdx >= 0 ? (cols[difficultyIdx] ?? '') : '',
      notes: notesIdx >= 0 ? (cols[notesIdx] ?? '') : '',
    }
    // 尝试解析 definitions 列
    if (definitionsIdx >= 0 && cols[definitionsIdx]) {
      const defsStr = String(cols[definitionsIdx]).trim()
      if (defsStr.startsWith('[')) {
        try {
          obj.definitions = JSON.parse(defsStr)
        } catch {
          // 解析失败则忽略
        }
      }
    }
    const s = buildSentence(obj)
    if (!s) {
      errors.push(`第 ${idx + 2} 行: sentence 为空`)
      return
    }
    sentences.push(s)
  })

  return { sentences, errors }
}

export function parseSentencesText(content: string): SentenceParseResult {
  const errors: string[] = []
  const sentences: ImportableSentence[] = []

  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '')
  lines.forEach((line, idx) => {
    const parts = line.split(/[\t|]|,(?=\S)/).map((s) => s.trim())
    const [sentenceStr, meaning = '', example = '', category = '', difficulty = '3', notes = ''] = parts

    // 检测是否含多翻译（分号分隔）
    const hasMultipleDefs = meaning.includes(';') || meaning.includes('；')
    if (hasMultipleDefs) {
      const defParts = meaning.split(/[;；]/).map((s) => s.trim()).filter(Boolean)
      const definitions: Definition[] = defParts.map((part) => {
        const isChinese = /[一-龥]/.test(part)
        return { pos: '', def: isChinese ? '' : part, trans: isChinese ? part : '' }
      })
      const obj: Record<string, any> = {
        sentence: sentenceStr,
        translation: definitions.find((d) => d.trans)?.trans ?? '',
        definitions,
        example,
        category,
        difficulty,
        notes,
      }
      const s = buildSentence(obj)
      if (!s) {
        errors.push(`第 ${idx + 1} 行: 解析失败 "${line}"`)
        return
      }
      sentences.push(s)
      return
    }

    const obj: Record<string, any> = {
      sentence: sentenceStr,
      translation: meaning,
      example,
      category,
      difficulty,
      notes,
    }

    const s = buildSentence(obj)
    if (!s) {
      errors.push(`第 ${idx + 1} 行: 解析失败 "${line}"`)
      return
    }
    sentences.push(s)
  })

  return { sentences, errors }
}
