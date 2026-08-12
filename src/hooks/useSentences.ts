import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { Sentence } from '../types/word'
import { calculateSrs } from '../utils/srs'

// ---------- 读取 hooks ----------
export function useAllSentences() {
  return useLiveQuery(() => db.sentences.orderBy('createdAt').reverse().toArray(), []) ?? []
}

export function useDueSentences() {
  const now = Date.now()
  return (
    useLiveQuery(
      () =>
        db.sentences
          .where('nextReviewAt')
          .belowOrEqual(now)
          .filter((s) => s.isLearned === 0 && s.reviewCount > 0)
          .sortBy('nextReviewAt'),
      []
    ) ?? []
  )
}

export function useDueSentenceCount() {
  const now = Date.now()
  return (
    useLiveQuery(
      () =>
        db.sentences
          .where('nextReviewAt')
          .belowOrEqual(now)
          .filter((s) => s.isLearned === 0 && s.reviewCount > 0)
          .count(),
      []
    ) ?? 0
  )
}

export function useSentencesByCategory(category: string) {
  return (
    useLiveQuery(
      () => db.sentences.where('category').equals(category).toArray(),
      [category]
    ) ?? []
  )
}

export function useFavoriteSentences() {
  return useLiveQuery(() => db.sentences.where('isFavorite').equals(1).toArray(), []) ?? []
}

export function useSentenceById(id: number) {
  return useLiveQuery(() => db.sentences.get(id), [id])
}

export function useSentenceStats() {
  const total = useLiveQuery(() => db.sentences.count(), []) ?? 0
  const learned = useLiveQuery(() => db.sentences.where('isLearned').equals(1).count(), []) ?? 0
  return { total, learned }
}

// ---------- 写入 ----------
export async function addSentence(s: Omit<Sentence, 'id' | 'createdAt'>): Promise<number> {
  const id = await db.sentences.add({ ...s, createdAt: Date.now() } as Sentence)
  return Number(id)
}

export interface BulkAddSentenceResult {
  added: number
  skipped: number
  skippedSentences: string[]
  addedIds: number[]
}

export async function bulkAddSentences(
  items: Omit<Sentence, 'id' | 'createdAt'>[],
  options: {
    skipDuplicates?: boolean
    overrideCategory?: string
    forceFavorite?: boolean
  } = { skipDuplicates: true }
): Promise<BulkAddSentenceResult> {
  const result: BulkAddSentenceResult = {
    added: 0,
    skipped: 0,
    skippedSentences: [],
    addedIds: [],
  }
  if (items.length === 0) return result

  // 重复检测:按小写 sentence 去重
  let existingSet = new Set<string>()
  if (options.skipDuplicates) {
    const existing = await db.sentences.toArray()
    existingSet = new Set(existing.map((s) => s.sentence.toLowerCase()))
  }

  const seenInBatch = new Set<string>()
  const toInsert: Sentence[] = []
  for (const s of items) {
    const key = s.sentence.toLowerCase()
    if (options.skipDuplicates && (existingSet.has(key) || seenInBatch.has(key))) {
      result.skipped++
      result.skippedSentences.push(s.sentence)
      continue
    }
    seenInBatch.add(key)
    const finalSentence: Sentence = {
      ...s,
      category: options.overrideCategory ?? s.category,
      isFavorite: options.forceFavorite ? 1 : s.isFavorite,
      createdAt: Date.now(),
    } as Sentence
    toInsert.push(finalSentence)
  }

  if (toInsert.length > 0) {
    const ids = (await db.sentences.bulkAdd(toInsert, { allKeys: true })) as unknown as number[]
    result.added = toInsert.length
    result.addedIds = ids
  }
  return result
}

export async function updateSentence(id: number, changes: Partial<Sentence>) {
  return db.sentences.update(id, changes)
}

export async function deleteSentence(id: number) {
  return db.sentences.delete(id)
}

export async function toggleSentenceFavorite(id: number, current: number) {
  return db.sentences.update(id, { isFavorite: current ? 0 : 1 })
}

// 记录一次短句复习(SRS 同单词逻辑,只改 sentences 表)
export async function recordSentenceReview(sentenceId: number, quality: number) {
  const s = await db.sentences.get(sentenceId)
  if (!s) return

  const { newInterval, newEaseFactor, nextReviewAt } = calculateSrs(
    quality,
    s.interval,
    s.easeFactor,
    s.streak
  )

  const changes: Partial<Sentence> = {
    reviewCount: s.reviewCount + 1,
    lastReviewedAt: Date.now(),
    interval: newInterval,
    easeFactor: newEaseFactor,
    nextReviewAt,
  }

  if (quality >= 3) {
    changes.correctCount = s.correctCount + 1
    changes.streak = s.streak + 1
  } else {
    changes.streak = 0
  }

  if (newInterval >= 21) {
    changes.isLearned = 1
  }

  await db.sentences.update(sentenceId, changes)
}

// 标记短句为已掌握
export async function markSentenceLearned(id: number) {
  const now = Date.now()
  const s = await db.sentences.get(id)
  if (!s) return
  await db.sentences.update(id, {
    isLearned: 1,
    interval: 365,
    streak: Math.max(5, s.streak),
    easeFactor: Math.max(2.5, s.easeFactor),
    lastReviewedAt: now,
    nextReviewAt: now + 365 * 24 * 60 * 60 * 1000,
    reviewCount: s.reviewCount + 1,
    correctCount: s.correctCount + 1,
  })
}

// 取消掌握
export async function unmarkSentenceLearned(id: number) {
  const now = Date.now()
  const s = await db.sentences.get(id)
  if (!s || s.isLearned === 0) return
  await db.sentences.update(id, {
    isLearned: 0,
    interval: 1,
    streak: 0,
    easeFactor: 2.5,
    nextReviewAt: now,
  })
}

export async function getRandomSentences(limit: number): Promise<Sentence[]> {
  const all = await db.sentences.toArray()
  return all.filter((s) => s.isLearned === 0).sort(() => Math.random() - 0.5).slice(0, limit)
}

// ---------- 批量操作 ----------
export async function bulkSetSentenceCategory(ids: number[], category: string) {
  if (ids.length === 0) return
  await db.transaction('rw', db.sentences, async () => {
    for (const id of ids) {
      await db.sentences.update(id, { category })
    }
  })
}

export async function bulkSetSentenceFavorite(ids: number[], favorite: boolean) {
  if (ids.length === 0) return
  await db.transaction('rw', db.sentences, async () => {
    for (const id of ids) {
      await db.sentences.update(id, { isFavorite: favorite ? 1 : 0 })
    }
  })
}

export async function bulkMarkSentenceLearned(ids: number[]) {
  if (ids.length === 0) return
  const now = Date.now()
  await db.transaction('rw', db.sentences, async () => {
    for (const id of ids) {
      const s = await db.sentences.get(id)
      if (!s || s.isLearned === 1) continue
      await db.sentences.update(id, {
        isLearned: 1,
        interval: 365,
        streak: Math.max(5, s.streak),
        easeFactor: Math.max(2.5, s.easeFactor),
        lastReviewedAt: now,
        nextReviewAt: now + 365 * 24 * 60 * 60 * 1000,
        reviewCount: s.reviewCount + 1,
        correctCount: s.correctCount + 1,
      })
    }
  })
}

export async function bulkDeleteSentences(ids: number[]) {
  if (ids.length === 0) return
  await db.sentences.bulkDelete(ids)
}
