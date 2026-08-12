import { Word, Sentence } from '../types/word'

export function exportWordsToJson(words: Word[]): string {
  const exports = words.map((w) => {
    const base: Record<string, any> = {
      word: w.word,
      phonetic: w.phonetic,
      definition: w.definition,
      example: w.example,
      translation: w.translation,
      category: w.category,
      difficulty: w.difficulty,
    }
    // 如果有多释义，导出 definitions 数组
    if (w.definitions && w.definitions.length > 0) {
      base.definitions = w.definitions
    }
    return base
  })
  return JSON.stringify(exports, null, 2)
}

export function exportWordsToCsv(words: Word[]): string {
  const headers = ['word', 'phonetic', 'definition', 'example', 'translation', 'category', 'difficulty', 'definitions']
  const rows = words.map((w) => [
    w.word,
    w.phonetic,
    w.definition,
    w.example,
    w.translation,
    w.category,
    String(w.difficulty),
    w.definitions && w.definitions.length > 0 ? JSON.stringify(w.definitions) : '',
  ])
  return [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n')
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ===== 短句导出 =====

export function exportSentencesToJson(sentences: Sentence[]): string {
  const exports = sentences.map((s) => {
    const base: Record<string, any> = {
      sentence: s.sentence,
      translation: s.translation,
      example: s.example,
      category: s.category,
      difficulty: s.difficulty,
      notes: s.notes,
    }
    if (s.definitions && s.definitions.length > 0) {
      base.definitions = s.definitions
    }
    return base
  })
  return JSON.stringify(exports, null, 2)
}

export function exportSentencesToCsv(sentences: Sentence[]): string {
  const headers = ['sentence', 'translation', 'example', 'category', 'difficulty', 'notes', 'definitions']
  const rows = sentences.map((s) => [
    s.sentence,
    s.translation,
    s.example,
    s.category,
    String(s.difficulty),
    s.notes,
    s.definitions && s.definitions.length > 0 ? JSON.stringify(s.definitions) : '',
  ])
  return [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n')
}
