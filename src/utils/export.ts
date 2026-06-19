import { Word } from '../types/word'

export function exportWordsToJson(words: Word[]): string {
  const exports = words.map((w) => ({
    word: w.word,
    phonetic: w.phonetic,
    definition: w.definition,
    example: w.example,
    translation: w.translation,
    category: w.category,
    difficulty: w.difficulty,
  }))
  return JSON.stringify(exports, null, 2)
}

export function exportWordsToCsv(words: Word[]): string {
  const headers = ['word', 'phonetic', 'definition', 'example', 'translation', 'category', 'difficulty']
  const rows = words.map((w) => [
    w.word,
    w.phonetic,
    w.definition,
    w.example,
    w.translation,
    w.category,
    String(w.difficulty),
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
