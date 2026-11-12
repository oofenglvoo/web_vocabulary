// EmbedHost 的落库逻辑：把扩展打过来的划词结果写进本地词库。
// 规则（已与用户确认）：
//  - 收藏 = 新建单词记录并归入指定分类；分类不存在则自动创建（英语单词型）。
//  - 遇到同名单词（大小写不敏感）完全跳过，不修改任何旧数据。
//  - 固定英语：分类与单词均按 lang='en' 处理。

import { db } from '../db/database'
import { Word, Definition, WordExample } from '../types/word'
import { ensureCategoryWritable } from '../utils/categoryType'
import { EmbedCollectedWord } from './embedProtocol'

export interface CollectSummary {
  added: number
  skipped: number
  skippedWords: string[]
  errors: string[]
  category: string
}

function buildDefinitions(raw: EmbedCollectedWord['definitions']): Definition[] {
  return (raw ?? [])
    .filter((d) => d && (String(d.def ?? '').trim() || String(d.trans ?? '').trim()))
    .map((d) => ({
      pos: String(d.pos ?? '').trim(),
      def: String(d.def ?? '').trim(),
      trans: String(d.trans ?? '').trim(),
    }))
}

function buildDictionaryExamples(raw: EmbedCollectedWord['dictionaryExamples']): WordExample[] {
  return (raw ?? [])
    .filter((e) => e && String(e.en ?? '').trim())
    .map((e) => ({
      en: String(e.en ?? '').trim(),
      zh: String(e.zh ?? '').trim(),
      source: e.source ? String(e.source).trim() : undefined,
    }))
}

/** 确保目标英语分类存在（不存在则创建），返回规范化的分类名 */
export async function ensureEmbedCategory(name: string): Promise<string> {
  const trimmed = (name || '').trim() || '划词收藏'
  const existing = await db.categories.where('name').equalsIgnoreCase(trimmed).first()
  if (existing) {
    // 已存在的分类需允许写入单词（防止误选到句型分类）
    await ensureCategoryWritable('word', existing.name)
    return existing.name
  }
  await db.categories.add({
    name: trimmed,
    description: '',
    color: '#2f6b5c',
    wordCount: 0,
    createdAt: Date.now(),
    lang: 'en',
    entityType: 'word',
  })
  return trimmed
}

/** 分类名列表（英语分类，含未定型空分类） */
export async function listEmbedCategories(): Promise<string[]> {
  const cats = await db.categories.toArray()
  return cats
    .filter((c) => !c.lang || c.lang === 'en')
    .map((c) => c.name)
    .sort((a, b) => a.localeCompare(b, 'zh'))
}

/**
 * 批量收藏划词单词。全部写入放在一个事务里：
 * 查重与插入原子完成，避免并发重复。
 */
export async function collectEmbedWords(words: EmbedCollectedWord[], category: string): Promise<CollectSummary> {
  const summary: CollectSummary = { added: 0, skipped: 0, skippedWords: [], errors: [], category }
  if (!Array.isArray(words) || words.length === 0) return summary

  const finalCategory = await ensureEmbedCategory(category)
  summary.category = finalCategory
  await ensureCategoryWritable('word', finalCategory)

  // 批内去重，避免同一批出现同名重复
  const seen = new Set<string>()
  const candidates: EmbedCollectedWord[] = []
  for (const w of words) {
    const trimmed = String(w.word ?? '').trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) {
      summary.skipped++
      summary.skippedWords.push(trimmed)
      continue
    }
    seen.add(key)
    candidates.push({ ...w, word: trimmed })
  }

  if (candidates.length === 0) return summary

  await db.transaction('rw', db.words, async () => {
    const now = Date.now()
    for (const candidate of candidates) {
      const existing = await db.words.where('word').equalsIgnoreCase(candidate.word).first()
      if (existing) {
        summary.skipped++
        summary.skippedWords.push(existing.word)
        continue
      }
      const definitions = buildDefinitions(candidate.definitions)
      const primary = definitions.find((d) => d.def || d.trans)
      const dictionaryExamples = buildDictionaryExamples(candidate.dictionaryExamples)
      const record: Omit<Word, 'id' | 'createdAt'> = {
        word: candidate.word,
        phonetic: String(candidate.phonetic ?? '').trim(),
        definition: primary?.def ?? '',
        translation: primary?.trans ?? '',
        definitions,
        example: '',
        ...(dictionaryExamples.length > 0 ? { dictionaryExamples } : {}),
        category: finalCategory,
        difficulty: 1,
        lastReviewedAt: 0,
        reviewCount: 0,
        correctCount: 0,
        streak: 0,
        easeFactor: 2.5,
        interval: 0,
        nextReviewAt: now,
        srsStage: 0,
        stageProgress: 0,
        isLearned: 0,
        isFavorite: 0,
        notes: '',
      }
      await db.words.add({ ...record, createdAt: now } as Word)
      summary.added++
    }
  })

  return summary
}
