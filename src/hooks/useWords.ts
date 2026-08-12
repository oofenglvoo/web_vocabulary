import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { Word, Category } from '../types/word'
import { calculateSrs } from '../utils/srs'

export function useAllWords() {
  return useLiveQuery(() => db.words.orderBy('createdAt').reverse().toArray(), []) ?? []
}

export function useDueWords() {
  const now = Date.now()
  return useLiveQuery(
    () =>
      db.words
        .where('nextReviewAt')
        .belowOrEqual(now)
        .filter((w) => w.isLearned === 0 && w.reviewCount > 0)
        .sortBy('nextReviewAt'),
    []
  ) ?? []
}

export function useDueCount() {
  const now = Date.now()
  return useLiveQuery(
    () => db.words.where('nextReviewAt').belowOrEqual(now).filter((w) => w.isLearned === 0 && w.reviewCount > 0).count(),
    []
  ) ?? 0
}

export function useWordsByCategory(category: string) {
  return (
    useLiveQuery(
      () => db.words.where('category').equals(category).toArray(),
      [category]
    ) ?? []
  )
}

export function useCategoryStats() {
  // 返回每个分类的实际单词数 (基于 words 表 category 字段)
  return (
    useLiveQuery(async () => {
      const cats = await db.categories.toArray()
      const counts: Record<string, number> = {}
      const all = await db.words.toArray()
      for (const w of all) {
        counts[w.category] = (counts[w.category] ?? 0) + 1
      }
      return cats.map((c) => ({ ...c, wordCount: counts[c.name] ?? 0 }))
    }, []) ?? []
  )
}

export function useFavoriteWords() {
  return useLiveQuery(() => db.words.where('isFavorite').equals(1).toArray(), []) ?? []
}

export function useWordById(id: number) {
  return useLiveQuery(() => db.words.get(id), [id])
}

export function useCategories() {
  return useLiveQuery(() => db.categories.toArray(), []) ?? []
}

export function useStats() {
  const total = useLiveQuery(() => db.words.count(), []) ?? 0
  const learned = useLiveQuery(() => db.words.where('isLearned').equals(1).count(), []) ?? 0
  const due = useDueCount()

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000
  const todaySessions = useLiveQuery(() => db.studySessions.where('timestamp').above(dayAgo).toArray(), []) ?? []

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const weekSessions = useLiveQuery(() => db.studySessions.where('timestamp').above(weekAgo).toArray(), []) ?? []

  // 计算连续学习天数
  const streak = useLiveQuery(async () => {
    const sessions = await db.studySessions.orderBy('timestamp').reverse().toArray()
    if (sessions.length === 0) return 0

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dayMs = 24 * 60 * 60 * 1000

    // 获取最近一次学习日期
    const lastSession = sessions[0]
    const lastDate = new Date(lastSession.timestamp)
    lastDate.setHours(0, 0, 0, 0)

    // 如果最近一次学习不是今天也不是昨天,连续天数归零
    const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / dayMs)
    if (diffDays > 1) return 0

    // 从最近学习日往回数连续天数
    let streakCount = 0
    let checkDate = diffDays === 0 ? today.getTime() : lastDate.getTime()
    const dateSet = new Set<string>()
    for (const s of sessions) {
      const d = new Date(s.timestamp)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      dateSet.add(key)
    }

    while (true) {
      const d = new Date(checkDate)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (dateSet.has(key)) {
        streakCount++
        checkDate -= dayMs
      } else {
        break
      }
    }
    return streakCount
  }, []) ?? 0

  return {
    total,
    learned,
    due,
    todayTotal: todaySessions.length,
    todayCorrect: todaySessions.filter((s) => s.result === 'correct').length,
    weekTotal: weekSessions.length,
    weekCorrect: weekSessions.filter((s) => s.result === 'correct').length,
    streak,
  }
}

export async function addWord(word: Omit<Word, 'id' | 'createdAt'>): Promise<number> {
  const id = await db.words.add({ ...word, createdAt: Date.now() } as Word)
  return Number(id)
}

export interface BulkAddResult {
  added: number
  skipped: number
  skippedWords: string[]
  addedIds: number[]
}

export async function bulkAddWords(
  words: Omit<Word, 'id' | 'createdAt'>[],
  options: {
    skipDuplicates?: boolean
    overrideCategory?: string
    forceFavorite?: boolean
  } = { skipDuplicates: true }
): Promise<BulkAddResult> {
  const result: BulkAddResult = { added: 0, skipped: 0, skippedWords: [], addedIds: [] }
  if (words.length === 0) return result

  // 重复检测：按小写 word 去重
  let existingSet = new Set<string>()
  if (options.skipDuplicates) {
    const existing = await db.words.toArray()
    existingSet = new Set(existing.map((w) => w.word.toLowerCase()))
  }

  const seenInBatch = new Set<string>()
  const toInsert: Word[] = []
  for (const w of words) {
    const key = w.word.toLowerCase()
    if (options.skipDuplicates && (existingSet.has(key) || seenInBatch.has(key))) {
      result.skipped++
      result.skippedWords.push(w.word)
      continue
    }
    seenInBatch.add(key)
    const finalWord: Word = {
      ...w,
      category: options.overrideCategory ?? w.category,
      isFavorite: options.forceFavorite ? 1 : w.isFavorite,
      createdAt: Date.now(),
    } as Word
    toInsert.push(finalWord)
  }

  if (toInsert.length > 0) {
    // bulkAdd 返回最后一个 ID,这里用 allKeys 选项拿到所有 ID
    const ids = (await db.words.bulkAdd(toInsert, { allKeys: true })) as unknown as number[]
    result.added = toInsert.length
    result.addedIds = ids
  }
  return result
}

export async function updateWord(id: number, changes: Partial<Word>) {
  return db.words.update(id, changes)
}

export async function deleteWord(id: number) {
  return db.words.delete(id)
}

export async function recordReview(wordId: number, quality: number, durationMs = 0) {
  const word = await db.words.get(wordId)
  if (!word) return

  const result = quality >= 3 ? 'correct' : quality > 0 ? 'hint' : 'incorrect'

  await db.studySessions.add({
    wordId,
    mode: 'flashcard',
    result,
    durationMs,
    timestamp: Date.now(),
  })

  const { newInterval, newEaseFactor, nextReviewAt } = calculateSrs(
    quality,
    word.interval,
    word.easeFactor,
    word.streak
  )

  const changes: Partial<Word> = {
    reviewCount: word.reviewCount + 1,
    lastReviewedAt: Date.now(),
    interval: newInterval,
    easeFactor: newEaseFactor,
    nextReviewAt,
  }

  if (quality >= 3) {
    changes.correctCount = word.correctCount + 1
    changes.streak = word.streak + 1
  } else {
    changes.streak = 0
  }

  if (newInterval >= 21) {
    changes.isLearned = 1
  }

  await db.words.update(wordId, changes)
}

export async function toggleFavorite(id: number, current: number) {
  return db.words.update(id, { isFavorite: current ? 0 : 1 })
}

// 标记单词为已掌握(用于"掌握"按钮直接确认)
export async function markWordLearned(id: number) {
  const now = Date.now()
  const w = await db.words.get(id)
  if (!w) return
  await db.words.update(id, {
    isLearned: 1,
    interval: 365,
    streak: Math.max(5, w.streak),
    easeFactor: Math.max(2.5, w.easeFactor),
    lastReviewedAt: now,
    nextReviewAt: now + 365 * 24 * 60 * 60 * 1000,
    reviewCount: w.reviewCount + 1,
    correctCount: w.correctCount + 1,
  })
  await db.studySessions.add({
    wordId: id,
    mode: 'mark-learned',
    result: 'mastered',
    durationMs: 0,
    timestamp: now,
  })
}

// 取消掌握：将已掌握单词恢复为学习中状态
export async function unmarkWordLearned(id: number) {
  const now = Date.now()
  const w = await db.words.get(id)
  if (!w || w.isLearned === 0) return
  await db.words.update(id, {
    isLearned: 0,
    interval: 1,
    streak: 0,
    easeFactor: 2.5,
    nextReviewAt: now,
  })
}

export async function getRandomWords(limit: number): Promise<Word[]> {
  const all = await db.words.toArray()
  return all.filter((w) => w.isLearned === 0).sort(() => Math.random() - 0.5).slice(0, limit)
}

export async function initDefaultCategories(): Promise<void> {
  const count = await db.categories.count()
  if (count > 0) return

  const defaults = [
    { name: '默认', description: '默认分类', color: '#8b5cf6', wordCount: 0, createdAt: Date.now() },
    { name: 'CET-4', description: '大学英语四级', color: '#06b6d4', wordCount: 0, createdAt: Date.now() },
    { name: 'CET-6', description: '大学英语六级', color: '#f97316', wordCount: 0, createdAt: Date.now() },
    { name: '雅思', description: '雅思词汇', color: '#3b82f6', wordCount: 0, createdAt: Date.now() },
    { name: '托福', description: '托福词汇', color: '#22c55e', wordCount: 0, createdAt: Date.now() },
    { name: 'GRE', description: 'GRE词汇', color: '#a855f7', wordCount: 0, createdAt: Date.now() },
    { name: '商务英语', description: '商务场景词汇', color: '#eab308', wordCount: 0, createdAt: Date.now() },
    { name: '日常用语', description: '日常生活常用词', color: '#6366f1', wordCount: 0, createdAt: Date.now() },
  ]

  await db.categories.bulkAdd(defaults)
}

export async function addCategory(name: string, description = '', color = '#8b5cf6') {
  return db.categories.add({
    name,
    description,
    color,
    wordCount: 0,
    createdAt: Date.now(),
  })
}

export async function updateCategory(id: number, changes: Partial<Category>) {
  // 如果改名,需要把已有单词和短句的 category 字段同步更新
  if (changes.name) {
    const old = await db.categories.get(id)
    if (old && old.name !== changes.name) {
      const affectedWords = await db.words.where('category').equals(old.name).toArray()
      const affectedSentences = await db.sentences.where('category').equals(old.name).toArray()
      if (affectedWords.length > 0 || affectedSentences.length > 0) {
        await db.transaction('rw', db.words, db.sentences, db.categories, async () => {
          for (const w of affectedWords) {
            await db.words.update(w.id!, { category: changes.name! })
          }
          for (const s of affectedSentences) {
            await db.sentences.update(s.id!, { category: changes.name! })
          }
          await db.categories.update(id, changes)
        })
        return
      }
    }
  }
  await db.categories.update(id, changes)
}

export async function deleteCategory(
  id: number,
  options: { reassignTo?: string } = {}
) {
  const cat = await db.categories.get(id)
  if (!cat) return

  // 确定目标分类：优先使用指定分类，否则选择另一个现存分类
  let target = options.reassignTo
  if (!target) {
    const others = await db.categories.where('id').notEqual(id).toArray()
    if (others.length > 0) {
      target = others[0].name
    } else {
      // 删除的是最后一个分类 → 删后自动重建"默认"
      target = '默认'
    }
  }

  await db.transaction('rw', db.words, db.sentences, db.categories, async () => {
    // 将该分类下的单词移到目标分类
    const words = await db.words.where('category').equals(cat.name).toArray()
    for (const w of words) {
      await db.words.update(w.id!, { category: target })
    }
    // 将该分类下的短句也移到目标分类
    const sentences = await db.sentences.where('category').equals(cat.name).toArray()
    for (const s of sentences) {
      await db.sentences.update(s.id!, { category: target })
    }
    // 删除分类
    await db.categories.delete(id)
    // 如果删除后没有任何分类，自动重建"默认"
    const remaining = await db.categories.count()
    if (remaining === 0) {
      await db.categories.add({
        name: '默认',
        description: '默认分类',
        color: '#8b5cf6',
        wordCount: 0,
        createdAt: Date.now(),
      })
    }
  })
}

// 批量操作
export async function bulkSetCategory(ids: number[], category: string) {
  if (ids.length === 0) return
  await db.transaction('rw', db.words, async () => {
    for (const id of ids) {
      await db.words.update(id, { category })
    }
  })
}

export async function bulkSetFavorite(ids: number[], favorite: boolean) {
  if (ids.length === 0) return
  await db.transaction('rw', db.words, async () => {
    for (const id of ids) {
      await db.words.update(id, { isFavorite: favorite ? 1 : 0 })
    }
  })
}

export async function bulkMarkLearned(ids: number[]) {
  if (ids.length === 0) return
  const now = Date.now()
  await db.transaction('rw', db.words, db.studySessions, async () => {
    for (const id of ids) {
      const w = await db.words.get(id)
      if (!w || w.isLearned === 1) continue
      await db.words.update(id, {
        isLearned: 1,
        interval: 365,
        streak: Math.max(5, w.streak),
        easeFactor: Math.max(2.5, w.easeFactor),
        lastReviewedAt: now,
        nextReviewAt: now + 365 * 24 * 60 * 60 * 1000,
        reviewCount: w.reviewCount + 1,
        correctCount: w.correctCount + 1,
      })
      await db.studySessions.add({
        wordId: id,
        mode: 'mark-learned',
        result: 'mastered',
        durationMs: 0,
        timestamp: now,
      })
    }
  })
}

export async function bulkDeleteWords(ids: number[]) {
  if (ids.length === 0) return
  await db.words.bulkDelete(ids)
}
