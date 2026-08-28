import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { JapaneseWord, StudyKind } from '../types/word'
import { applyStageReview, stageIntervalDays, MAX_STAGE, getTodayReviewCutoff } from '../utils/srs'
import { ensureCategoryWritableForLang } from '../utils/categoryType'
import { useNow } from './useNow'

const DAY_MS = 24 * 60 * 60 * 1000

export function useAllJapaneseWords() {
  return useLiveQuery(() => db.japaneseWords.orderBy('createdAt').reverse().toArray(), []) ?? []
}

export function useJapaneseWord(id: number) {
  return useLiveQuery(() => db.japaneseWords.get(id), [id])
}

export function useJapaneseDueWords() {
  // 用自动刷新的 now 作依赖，让到期词能随时间流逝自动出现在列表里
  const now = useNow()
  const cutoff = getTodayReviewCutoff(new Date(now))
  return useLiveQuery(
    () =>
      db.japaneseWords
        .where('nextReviewAt')
        .below(cutoff)
        .filter((w) => w.isLearned === 0 && w.reviewCount > 0)
        .sortBy('nextReviewAt'),
    [now, cutoff]
  ) ?? []
}

export function useJapaneseDueCount() {
  const now = useNow()
  const cutoff = getTodayReviewCutoff(new Date(now))
  return useLiveQuery(
    () => db.japaneseWords.where('nextReviewAt').below(cutoff).filter((w) => w.isLearned === 0 && w.reviewCount > 0).count(),
    [now, cutoff]
  ) ?? 0
}

export class DuplicateJapaneseWordError extends Error {
  constructor(word: string) {
    super(`日语词「${word}」已存在`)
    this.name = 'DuplicateJapaneseWordError'
  }
}

export async function addJapaneseWord(word: Omit<JapaneseWord, 'id' | 'createdAt'>): Promise<number> {
  const trimmed = word.word.trim()
  if (!trimmed) throw new Error('日语词不能为空')
  await ensureCategoryWritableForLang('ja', word.category)
  const existing = await db.japaneseWords.where('word').equalsIgnoreCase(trimmed).first()
  if (existing) throw new DuplicateJapaneseWordError(existing.word)
  return Number(await db.japaneseWords.add({ ...word, word: trimmed, createdAt: Date.now() } as JapaneseWord))
}

export async function updateJapaneseWord(id: number, changes: Partial<JapaneseWord>) {
  if (changes.category) await ensureCategoryWritableForLang('ja', changes.category)
  return db.japaneseWords.update(id, changes)
}

export async function deleteJapaneseWord(id: number) {
  await db.transaction('rw', db.japaneseWords, db.japaneseFavoriteItems, db.studySessions, db.japaneseStudyPlans, async () => {
    await db.japaneseWords.delete(id)
    await db.japaneseFavoriteItems.where('entityId').equals(id).delete()
    await db.studySessions.where('entityType').equals('japaneseWord').filter((session) => session.entityId === id).delete()
    await db.japaneseStudyPlans.toCollection().modify((plan) => {
      plan.wordIds = plan.wordIds.filter((wordId) => wordId !== id)
      plan.startedIds = plan.startedIds.filter((wordId) => wordId !== id)
    })
  })
}

export async function bulkDeleteJapaneseWords(ids: number[]) {
  if (ids.length === 0) return
  await db.transaction('rw', db.japaneseWords, db.japaneseFavoriteItems, db.studySessions, db.japaneseStudyPlans, async () => {
    await db.japaneseWords.bulkDelete(ids)
    const idSet = new Set(ids)
    await db.japaneseFavoriteItems.filter((item) => idSet.has(item.entityId)).delete()
    await db.studySessions.where('entityType').equals('japaneseWord').filter((session) => idSet.has(session.entityId)).delete()
    await db.japaneseStudyPlans.toCollection().modify((plan) => {
      plan.wordIds = plan.wordIds.filter((wordId) => !idSet.has(wordId))
      plan.startedIds = plan.startedIds.filter((wordId) => !idSet.has(wordId))
    })
  })
}

export async function bulkSetJapaneseWordCategory(ids: number[], category: string) {
  if (ids.length === 0) return
  await ensureCategoryWritableForLang('ja', category)
  await db.transaction('rw', db.japaneseWords, db.categories, async () => {
    for (const id of ids) {
      await db.japaneseWords.update(id, { category })
    }
  })
}

export interface BulkAddJapaneseResult {
  added: number
  skipped: number
  skippedWords: string[]
  addedIds: number[]
}

export async function bulkAddJapaneseWords(
  words: Omit<JapaneseWord, 'id' | 'createdAt'>[],
  options: { skipDuplicates: boolean; overrideCategory?: string; forceFavorite?: boolean }
): Promise<BulkAddJapaneseResult> {
  const skippedWords: string[] = []
  const addedIds: number[] = []
  let added = 0

  // 动态导入必须在事务外完成：事务内 await 非 Dexie Promise 会导致事务提前提交
  const { ensureJapaneseDefaultFolder } = await import('./useFavorites')

  await db.transaction('rw', [db.japaneseWords, db.japaneseFavoriteItems, db.japaneseFavoriteFolders, db.categories, db.words, db.sentences], async () => {
    const seen = new Set<string>()
    const pending: JapaneseWord[] = []
    const usedCategories = new Set<string>()
    for (const item of words) {
      const word = item.word.trim()
      const key = word.toLocaleLowerCase()
      const category = options.overrideCategory ?? item.category
      if (!word || seen.has(key)) {
        skippedWords.push(word || '(空词条)')
        continue
      }
      seen.add(key)
      const existing = await db.japaneseWords.where('word').equalsIgnoreCase(word).first()
      if (existing) {
        if (options.skipDuplicates) {
          skippedWords.push(word)
          continue
        }
      }
      usedCategories.add(category)
      await ensureCategoryWritableForLang('ja', category)
      pending.push({ ...item, word, category, createdAt: Date.now() } as JapaneseWord)
    }
    if (pending.length > 0) {
      // 为导入涉及的、尚不存在的分类自动建行（归属日语），让分类页面可见
      for (const category of usedCategories) {
        const exists = await db.categories.where('name').equals(category).first()
        if (!exists) {
          await db.categories.add({
            name: category,
            description: '',
            color: '#d946ef',
            wordCount: 0,
            createdAt: Date.now(),
            lang: 'ja',
            entityType: 'word',
          })
        }
      }
      const ids = (await db.japaneseWords.bulkAdd(pending, { allKeys: true })) as unknown as number[]
      added = pending.length
      addedIds.push(...ids)
      if (options.forceFavorite) {
        const def = await ensureJapaneseDefaultFolder()
        await db.japaneseFavoriteItems.bulkAdd(
          ids.map((id) => ({ folderId: def.id!, entityType: 'japaneseWord', entityId: id, createdAt: Date.now() }))
        )
        for (const id of ids) {
          await db.japaneseWords.update(id, { isFavorite: 1 })
        }
      }
    }
  })
  return { added, skipped: skippedWords.length, skippedWords, addedIds }
}

export async function bulkSetJapaneseWordFavorite(ids: number[], favorite: boolean) {
  if (ids.length === 0) return
  // 与英语语义对齐：收藏状态由"默认"收藏夹的归属关系派生，避免 flag 与夹条目漂移
  const { setJapaneseItemFolders, ensureJapaneseDefaultFolder } = await import('./useFavorites')
  if (!favorite) {
    for (const id of ids) {
      await setJapaneseItemFolders(id, [])
    }
    return
  }
  const def = await ensureJapaneseDefaultFolder()
  for (const id of ids) {
    const existing = (await db.japaneseFavoriteItems.toArray()).filter((item) => item.entityId === id)
    const merged = Array.from(new Set([...existing.map((e) => e.folderId), def.id!]))
    await setJapaneseItemFolders(id, merged)
  }
}

/** 记录一次日语学习作答：SRS 周期推进 + 学习会话（entityType='japaneseWord'） */
export async function recordJapaneseReview(
  wordId: number,
  quality: number,
  durationMs = 0,
  kind: StudyKind = 'review'
) {
  await db.transaction('rw', db.japaneseWords, db.studySessions, async () => {
    const word = await db.japaneseWords.get(wordId)
    if (!word) return

    const result: 'correct' | 'hint' | 'incorrect' =
      quality >= 3 ? 'correct' : quality > 0 ? 'hint' : 'incorrect'

    await db.studySessions.add({
      wordId,
      entityId: wordId,
      entityType: 'japaneseWord',
      mode: 'flashcard',
      result,
      durationMs,
      timestamp: Date.now(),
      kind,
    })

    const now = Date.now()
    const { newStage, newProgress, isLearned } = applyStageReview(
      { srsStage: word.srsStage ?? 0, stageProgress: word.stageProgress ?? 0 },
      quality
    )

    const changes: Partial<JapaneseWord> = {
      reviewCount: word.reviewCount + 1,
      lastReviewedAt: now,
      srsStage: newStage,
      stageProgress: newProgress,
      interval: stageIntervalDays(newStage),
      nextReviewAt: now + stageIntervalDays(newStage) * DAY_MS,
    }

    if (quality >= 3) {
      changes.correctCount = word.correctCount + 1
      changes.streak = word.streak + 1
    } else {
      changes.streak = 0
    }

    if (isLearned) {
      changes.isLearned = 1
    }

    await db.japaneseWords.update(wordId, changes)
  })
}

/** 标记日语词为已掌握 */
export async function markJapaneseWordLearned(id: number) {
  await db.transaction('rw', db.japaneseWords, db.studySessions, async () => {
    const now = Date.now()
    const w = await db.japaneseWords.get(id)
    if (!w) return
    await db.japaneseWords.update(id, {
      isLearned: 1,
      srsStage: MAX_STAGE,
      stageProgress: 0,
      interval: 365,
      streak: Math.max(5, w.streak),
      easeFactor: Math.max(2.5, w.easeFactor),
      lastReviewedAt: now,
      nextReviewAt: now + 365 * DAY_MS,
      reviewCount: w.reviewCount + 1,
      correctCount: w.correctCount + 1,
    })
    await db.studySessions.add({
      wordId: id,
      entityId: id,
      entityType: 'japaneseWord',
      mode: 'mark-learned',
      result: 'mastered',
      durationMs: 0,
      timestamp: now,
      kind: 'review',
    })
  })
}

/** 取消掌握：恢复为学习中 */
export async function unmarkJapaneseWordLearned(id: number) {
  const now = Date.now()
  const w = await db.japaneseWords.get(id)
  if (!w || w.isLearned === 0) return
  await db.japaneseWords.update(id, {
    isLearned: 0,
    srsStage: 1,
    stageProgress: 0,
    interval: 1,
    streak: 0,
    easeFactor: 2.5,
    nextReviewAt: now,
  })
}

/** 随机取一批未掌握的日语词（自由学习队列，与英语口径一致） */
export async function getRandomJapaneseWords(limit: number): Promise<JapaneseWord[]> {
  const pool = await db.japaneseWords
    .where('isLearned')
    .equals(0)
    .limit(limit * 4)
    .toArray()
  return pool.sort(() => Math.random() - 0.5).slice(0, limit)
}
