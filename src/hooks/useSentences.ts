import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { Sentence } from '../types/word'
import { applyStageReview, stageIntervalDays, MAX_STAGE } from '../utils/srs'
import { ensureCategoryWritable } from '../utils/categoryType'
import { useNow } from './useNow'

export class DuplicateSentenceError extends Error {
  constructor(sentence: string) {
    super(`短句「${sentence}」已存在`)
    this.name = 'DuplicateSentenceError'
  }
}

// ---------- 读取 hooks ----------
export function useAllSentences() {
  return useLiveQuery(() => db.sentences.orderBy('createdAt').reverse().toArray(), []) ?? []
}

export function useDueSentences() {
  // 用自动刷新的 now 作依赖，让到期短句能随时间流逝自动出现
  const now = useNow()
  return (
    useLiveQuery(
      () =>
        db.sentences
          .where('nextReviewAt')
          .belowOrEqual(now)
          .filter((s) => s.isLearned === 0 && s.reviewCount > 0)
          .sortBy('nextReviewAt'),
      [now]
    ) ?? []
  )
}

export function useDueSentenceCount() {
  const now = useNow()
  return (
    useLiveQuery(
      () =>
        db.sentences
          .where('nextReviewAt')
          .belowOrEqual(now)
          .filter((s) => s.isLearned === 0 && s.reviewCount > 0)
          .count(),
      [now]
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

/** 每个分类下的短句数（用于创建短句计划时的预览计数） */
export function useSentenceCategoryStats() {
  return (
    useLiveQuery(async () => {
      const counts: Record<string, number> = {}
      await db.sentences.orderBy('category').each((s) => {
        counts[s.category] = (counts[s.category] ?? 0) + 1
      })
      return counts
    }, []) ?? {}
  )
}

// ---------- 写入 ----------
export async function addSentence(s: Omit<Sentence, 'id' | 'createdAt'>): Promise<number> {
  const sentence = s.sentence.trim()
  if (!sentence) throw new Error('短句不能为空')
  // 分类类型校验：词型分类禁止写入短句；未定型空分类自动锁定为短句型
  await ensureCategoryWritable('sentence', s.category)
  const existing = await db.sentences.where('sentence').equalsIgnoreCase(sentence).first()
  if (existing) throw new DuplicateSentenceError(existing.sentence)
  const id = await db.sentences.add({ ...s, sentence, createdAt: Date.now() } as Sentence)
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
  options = { skipDuplicates: true, ...options }
  const result: BulkAddSentenceResult = {
    added: 0,
    skipped: 0,
    skippedSentences: [],
    addedIds: [],
  }
  if (items.length === 0) return result

  // 批量内去重：按小写 sentence
  const seenInBatch = new Set<string>()
  const toInsert: Sentence[] = []
  for (const s of items) {
    const key = s.sentence.trim().toLowerCase()
    if (seenInBatch.has(key)) {
      result.skipped++
      result.skippedSentences.push(s.sentence)
      continue
    }
    seenInBatch.add(key)
    const finalSentence: Sentence = {
      ...s,
      sentence: s.sentence.trim(),
      category: options.overrideCategory ?? s.category,
      isFavorite: options.forceFavorite ? 1 : s.isFavorite,
      createdAt: Date.now(),
    } as Sentence
    toInsert.push(finalSentence)
  }

  if (toInsert.length > 0) {
    // 查重 + 插入放进同一事务，防止并发导入产生重复
    await db.transaction('rw', db.sentences, db.words, db.categories, async () => {
      // 分类类型校验：批内所有涉及分类需允许写入短句（顺带为未定型空分类盖戳）
      for (const cat of new Set(toInsert.map((s) => s.category))) {
        await ensureCategoryWritable('sentence', cat)
      }
      let candidates = toInsert
      if (options.skipDuplicates) {
        const existingSentences = await db.sentences.toArray()
        const existing = new Set(existingSentences.map((s) => s.sentence.trim().toLowerCase()))
        const filtered: Sentence[] = []
        for (const s of toInsert) {
          const key = s.sentence.trim().toLowerCase()
          if (existing.has(key)) {
            result.skipped++
            result.skippedSentences.push(s.sentence)
            continue
          }
          filtered.push(s)
        }
        candidates = filtered
      }
      if (candidates.length === 0) return
      const ids = (await db.sentences.bulkAdd(candidates, { allKeys: true })) as unknown as number[]
      result.added = candidates.length
      result.addedIds = ids
    })
  }
  return result
}

export async function updateSentence(id: number, changes: Partial<Sentence>) {
  return db.sentences.update(id, changes)
}

async function pruneSentenceIdFromPlans(id: number) {
  const plans = await db.studyPlans.toArray()
  for (const p of plans) {
    if ((p.entityType ?? 'word') !== 'sentence') continue
    const wordIds = (p.wordIds ?? []).filter((w) => w !== id)
    const startedIds = (p.startedIds ?? []).filter((w) => w !== id)
    if (
      wordIds.length !== (p.wordIds ?? []).length ||
      startedIds.length !== (p.startedIds ?? []).length
    ) {
      await db.studyPlans.update(p.id!, { wordIds, startedIds })
    }
  }
}

export async function deleteSentence(id: number) {
  // 删除短句时级联清理：学习记录和计划里的失效 ID
  await db.transaction('rw', db.sentences, db.studySessions, db.studyPlans, async () => {
    await db.sentences.delete(id)
    await db.studySessions.where('entityType').equals('sentence').filter((s) => s.entityId === id).delete()
    await pruneSentenceIdFromPlans(id)
  })
}

export async function toggleSentenceFavorite(id: number, current: number) {
  return db.sentences.update(id, { isFavorite: current ? 0 : 1 })
}

// 记录一次短句复习(SRS 同单词逻辑,只改 sentences 表)
export async function recordSentenceReview(
  sentenceId: number,
  quality: number,
  durationMs = 0,
  kind: 'new' | 'review' = 'review'
) {
  // 读-改-写放进事务，避免并发丢失计数
  await db.transaction('rw', db.sentences, db.studySessions, async () => {
    const s = await db.sentences.get(sentenceId)
    if (!s) return

    const now = Date.now()
    const { newStage, newProgress, isLearned } = applyStageReview(
      { srsStage: s.srsStage ?? 0, stageProgress: s.stageProgress ?? 0 },
      quality
    )

    const changes: Partial<Sentence> = {
      reviewCount: s.reviewCount + 1,
      lastReviewedAt: now,
      srsStage: newStage,
      stageProgress: newProgress,
      interval: stageIntervalDays(newStage),
      nextReviewAt: now + stageIntervalDays(newStage) * 24 * 60 * 60 * 1000,
    }

    await db.studySessions.add({
      entityId: sentenceId,
      entityType: 'sentence',
      mode: 'flashcard',
      result: quality >= 3 ? 'correct' : quality > 0 ? 'hint' : 'incorrect',
      durationMs,
      timestamp: now,
      kind,
    })

    if (quality >= 3) {
      changes.correctCount = s.correctCount + 1
      changes.streak = s.streak + 1
    } else {
      changes.streak = 0
    }

    if (isLearned) {
      changes.isLearned = 1
    }

    await db.sentences.update(sentenceId, changes)
  })
}

// 标记短句为已掌握
export async function markSentenceLearned(id: number) {
  const now = Date.now()
  await db.transaction('rw', db.sentences, db.studySessions, async () => {
    const s = await db.sentences.get(id)
    if (!s) return
    await db.sentences.update(id, {
    isLearned: 1,
    srsStage: MAX_STAGE,
    stageProgress: 0,
    interval: 365,
    streak: Math.max(5, s.streak),
    easeFactor: Math.max(2.5, s.easeFactor),
    lastReviewedAt: now,
    nextReviewAt: now + 365 * 24 * 60 * 60 * 1000,
    reviewCount: s.reviewCount + 1,
    correctCount: s.correctCount + 1,
    })
    await db.studySessions.add({
      entityId: id,
      entityType: 'sentence',
      mode: 'mark-learned',
      result: 'mastered',
      durationMs: 0,
      timestamp: now,
      kind: 'review',
    })
  })
}

// 取消掌握
export async function unmarkSentenceLearned(id: number) {
  const now = Date.now()
  const s = await db.sentences.get(id)
  if (!s || s.isLearned === 0) return
  await db.sentences.update(id, {
    isLearned: 0,
    srsStage: 1,
    stageProgress: 0,
    interval: 1,
    streak: 0,
    easeFactor: 2.5,
    nextReviewAt: now,
  })
}

export async function getRandomSentences(limit: number): Promise<Sentence[]> {
  // 只取 limit*4 条未掌握的再洗牌，避免全表 toArray
  const pool = await db.sentences
    .where('isLearned')
    .equals(0)
    .limit(limit * 4)
    .toArray()
  return pool.sort(() => Math.random() - 0.5).slice(0, limit)
}

// ---------- 批量操作 ----------
export async function bulkSetSentenceCategory(ids: number[], category: string) {
  if (ids.length === 0) return
  await db.transaction('rw', db.sentences, db.words, db.categories, async () => {
    await ensureCategoryWritable('sentence', category)
    for (const id of ids) {
      await db.sentences.update(id, { category })
    }
  })
}

export async function bulkSetSentenceFavorite(ids: number[], favorite: boolean) {
  if (ids.length === 0) return
  await db.transaction('rw', db.sentences, db.studySessions, async () => {
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
      srsStage: MAX_STAGE,
      stageProgress: 0,
      interval: 365,
      streak: Math.max(5, s.streak),
      easeFactor: Math.max(2.5, s.easeFactor),
      lastReviewedAt: now,
      nextReviewAt: now + 365 * 24 * 60 * 60 * 1000,
      reviewCount: s.reviewCount + 1,
      correctCount: s.correctCount + 1,
      })
      await db.studySessions.add({
        entityId: id,
        entityType: 'sentence',
        mode: 'mark-learned',
        result: 'mastered',
        durationMs: 0,
        timestamp: now,
        kind: 'review',
      })
    }
  })
}

export async function bulkDeleteSentences(ids: number[]) {
  if (ids.length === 0) return
  await db.transaction('rw', db.sentences, db.studySessions, db.studyPlans, async () => {
    await db.sentences.bulkDelete(ids)
    for (const id of ids) {
      await db.studySessions.where('entityType').equals('sentence').filter((s) => s.entityId === id).delete()
      await pruneSentenceIdFromPlans(id)
    }
  })
}
