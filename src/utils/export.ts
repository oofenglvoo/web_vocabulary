import { Word, Sentence, JapaneseWord } from '../types/word'

export function exportWordsToJson(words: Word[]): string {
  const exports = words.map((w) => {
    const base: Record<string, any> = {
      word: w.word,
      phonetic: w.phonetic,
      definition: w.definition,
      example: w.example,
      exampleTranslation: w.exampleTranslation ?? '',
      translation: w.translation,
      category: w.category,
      difficulty: w.difficulty,
      onlineTranslation: w.onlineTranslation ?? '',
      onlineTranslationSource: w.onlineTranslationSource ?? '',
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
  const headers = ['word', 'phonetic', 'definition', 'example', 'exampleTranslation', 'translation', 'category', 'difficulty', 'onlineTranslation', 'onlineTranslationSource', 'definitions']
  const rows = words.map((w) => [
    w.word,
    w.phonetic,
    w.definition,
    w.example,
    w.exampleTranslation ?? '',
    w.translation,
    w.category,
    String(w.difficulty),
    w.onlineTranslation ?? '',
    w.onlineTranslationSource ?? '',
    w.definitions && w.definitions.length > 0 ? JSON.stringify(w.definitions) : '',
  ])
  // 前缀 ﻿ (UTF-8 BOM)，让 Excel 正确识别 UTF-8 编码，避免中文乱码
  return '﻿' + [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n')
}

export function exportJapaneseWordsToJson(words: JapaneseWord[]): string {
  return JSON.stringify(words.map((w) => ({
    word: w.word,
    reading: w.reading,
    accent: w.accent,
    partOfSpeech: w.partOfSpeech,
    definitions: w.definitions,
    example: w.example,
    exampleReading: w.exampleReading,
    exampleTranslation: w.exampleTranslation,
    category: w.category,
    difficulty: w.difficulty,
    onlineTranslation: w.onlineTranslation ?? '',
    onlineTranslationSource: w.onlineTranslationSource ?? '',
    notes: w.notes,
  })), null, 2)
}

export function exportJapaneseWordsToCsv(words: JapaneseWord[]): string {
  const headers = ['word', 'reading', 'accent', 'partOfSpeech', 'definitions', 'example', 'exampleReading', 'exampleTranslation', 'category', 'difficulty', 'onlineTranslation', 'onlineTranslationSource', 'notes']
  const rows = words.map((w) => [
    w.word, w.reading, w.accent, w.partOfSpeech, JSON.stringify(w.definitions ?? []),
    w.example, w.exampleReading, w.exampleTranslation, w.category, String(w.difficulty),
    w.onlineTranslation ?? '', w.onlineTranslationSource ?? '', w.notes,
  ])
  return '﻿' + [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n')
}

function escapeCsv(value: unknown): string {
  const str = value == null ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * 导出/下载文件。
 * - 浏览器环境:创建 Blob 触发下载(原逻辑)。
 * - 安卓原生环境(Capacitor):WebView 无法触发浏览器下载,改为用 Filesystem 写入缓存目录,
 *   再调起系统分享面板,由用户选择保存位置(文件管理器/其他应用)。
 * 通过 window.Capacitor 判断,浏览器环境不加载任何 Capacitor 库。
 */
export async function downloadFile(content: string, filename: string, type: string) {
  const isNative = (window as any)?.Capacitor?.isNativePlatform?.() === true
  if (isNative) {
    try {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
      const { Share } = await import('@capacitor/share')
      const base = 'vocab-exports'
      await Filesystem.mkdir({ path: base, directory: Directory.Cache, recursive: true }).catch(() => {})
      const filePath = `${base}/${filename}`
      await Filesystem.writeFile({
        path: filePath,
        data: content,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      })
      const { uri } = await Filesystem.getUri({ path: filePath, directory: Directory.Cache })
      await Share.share({ title: filename, url: uri })
    } catch {
      // 插件异常时回退浏览器方式,避免静默失败
      browserDownload(content, filename, type)
    }
    return
  }
  browserDownload(content, filename, type)
}

function browserDownload(content: string, filename: string, type: string) {
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
  // 前缀 ﻿ (UTF-8 BOM)，让 Excel 正确识别 UTF-8 编码，避免中文乱码
  return '﻿' + [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n')
}
