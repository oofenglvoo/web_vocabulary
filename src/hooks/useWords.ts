import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { Word, Category, Flag } from '../types/word'
import { calculateSrs } from '../utils/srs'
import { useNow } from './useNow'

export function useAllWords() {
  return useLiveQuery(() => db.words.orderBy('createdAt').reverse().toArray(), []) ?? []
}

export function useDueWords() {
  // 用自动刷新的 now 作依赖，让到期词能随时间流逝自动出现在列表里
  const now = useNow()
  return useLiveQuery(
    () =>
      db.words
        .where('nextReviewAt')
        .belowOrEqual(now)
        .filter((w) => w.isLearned === 0 && w.reviewCount > 0)
        .sortBy('nextReviewAt'),
    [now]
  ) ?? []
}

export function useDueCount() {
  const now = useNow()
  return useLiveQuery(
    () => db.words.where('nextReviewAt').belowOrEqual(now).filter((w) => w.isLearned === 0 && w.reviewCount > 0).count(),
    [now]
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
  // 用 orderBy('category').each 迭代索引键而非 toArray() 物化整表，降低内存占用
  return (
    useLiveQuery(async () => {
      const cats = await db.categories.toArray()
      const counts: Record<string, number> = {}
      await db.words.orderBy('category').each((w) => {
        counts[w.category] = (counts[w.category] ?? 0) + 1
      })
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

const DAY_MS = 24 * 60 * 60 * 1000

export function useStats() {
  const total = useLiveQuery(() => db.words.count(), []) ?? 0
  const learned = useLiveQuery(() => db.words.where('isLearned').equals(1).count(), []) ?? 0
  const due = useDueCount()

  const dayAgo = Date.now() - DAY_MS
  const todaySessions = useLiveQuery(() => db.studySessions.where('timestamp').above(dayAgo).toArray(), []) ?? []

  const weekAgo = Date.now() - 7 * DAY_MS
  const weekSessions = useLiveQuery(() => db.studySessions.where('timestamp').above(weekAgo).toArray(), []) ?? []

  // 计算连续学习天数（只读最近一年，避免全表扫描）
  const streak = useLiveQuery(async () => {
    const yearAgo = Date.now() - 366 * DAY_MS
    const sessions = await db.studySessions
      .where('timestamp')
      .above(yearAgo)
      .reverse()
      .toArray()
    if (sessions.length === 0) return 0

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dayMs = DAY_MS

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

/** 单词重复时抛出的错误，便于 UI 层区分提示 */
export class DuplicateWordError extends Error {
  constructor(word: string) {
    super(`单词「${word}」已存在`)
    this.name = 'DuplicateWordError'
  }
}

export async function addWord(word: Omit<Word, 'id' | 'createdAt'>): Promise<number> {
  const trimmed = word.word.trim()
  if (!trimmed) throw new Error('单词不能为空')
  // 写入前查重（大小写不敏感），避免手动录入重复单词
  const existing = await db.words.where('word').equalsIgnoreCase(trimmed).first()
  if (existing) {
    throw new DuplicateWordError(existing.word)
  }
  const id = await db.words.add({ ...word, word: trimmed, createdAt: Date.now() } as Word)
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

  // 批量内去重（按小写 word）
  const seenInBatch = new Set<string>()
  const toInsert: Word[] = []
  for (const w of words) {
    const key = w.word.toLowerCase()
    if (seenInBatch.has(key)) {
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
    // 查重 + 插入放进同一事务：防止两个并发导入同时通过查重造成重复
    await db.transaction('rw', db.words, async () => {
      let candidates = toInsert
      if (options.skipDuplicates) {
        // 只物化 word 键（轻量字符串数组），不再把整张表 load 进内存
        const keys = await db.words.orderBy('word').keys()
        const existing = new Set(keys.map((k) => String(k).toLowerCase()))
        const filtered: Word[] = []
        for (const w of toInsert) {
          const key = w.word.toLowerCase()
          if (existing.has(key)) {
            result.skipped++
            result.skippedWords.push(w.word)
            continue
          }
          filtered.push(w)
        }
        candidates = filtered
      }
      if (candidates.length === 0) return
      // bulkAdd 返回最后一个 ID,这里用 allKeys 选项拿到所有 ID
      const ids = (await db.words.bulkAdd(candidates, { allKeys: true })) as unknown as number[]
      result.added = candidates.length
      result.addedIds = ids
    })
  }
  return result
}

export async function updateWord(id: number, changes: Partial<Word>) {
  return db.words.update(id, changes)
}

// 删除单词时级联清理：孤儿 studySessions + 计划里的失效 ID
export async function deleteWord(id: number) {
  await db.transaction('rw', db.words, db.studySessions, db.studyPlans, async () => {
    await db.words.delete(id)
    await db.studySessions.where('wordId').equals(id).delete()
    await pruneWordIdFromPlans(id)
  })
}

async function pruneWordIdFromPlans(id: number) {
  const plans = await db.studyPlans.toArray()
  for (const p of plans) {
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

export async function recordReview(wordId: number, quality: number, durationMs = 0) {
  // 读-改-写放进同一事务，避免双标签页/双击并发时自增计数丢失
  await db.transaction('rw', db.words, db.studySessions, async () => {
    const word = await db.words.get(wordId)
    if (!word) return

    const result: 'correct' | 'hint' | 'incorrect' =
      quality >= 3 ? 'correct' : quality > 0 ? 'hint' : 'incorrect'

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
  })
}

export async function toggleFavorite(id: number, current: Flag) {
  return db.words.update(id, { isFavorite: current ? 0 : 1 })
}

// 标记单词为已掌握(用于"掌握"按钮直接确认)
export async function markWordLearned(id: number) {
  // 单词更新 + 会话记录放进同一事务，避免只成功一半
  await db.transaction('rw', db.words, db.studySessions, async () => {
    const now = Date.now()
    const w = await db.words.get(id)
    if (!w) return
    await db.words.update(id, {
      isLearned: 1,
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
      mode: 'mark-learned',
      result: 'mastered',
      durationMs: 0,
      timestamp: now,
    })
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
  // 只取 limit*4 条未掌握的词再洗牌，避免全表 toArray
  const pool = await db.words
    .where('isLearned')
    .equals(0)
    .limit(limit * 4)
    .toArray()
  return pool.sort(() => Math.random() - 0.5).slice(0, limit)
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

/** 分类重名错误 */
export class DuplicateCategoryError extends Error {
  constructor(name: string) {
    super(`分类「${name}」已存在`)
    this.name = 'DuplicateCategoryError'
  }
}

export async function addCategory(name: string, description = '', color = '#8b5cf6') {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('分类名称不能为空')
  const existing = await db.categories.where('name').equalsIgnoreCase(trimmed).first()
  if (existing) {
    throw new DuplicateCategoryError(existing.name)
  }
  return db.categories.add({
    name: trimmed,
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
      const newName = changes.name
      // 查询与更新放入同一事务，避免读写之间新增的记录遗漏
      await db.transaction('rw', db.words, db.sentences, db.categories, async () => {
        await db.words.where('category').equals(old.name).modify({ category: newName })
        await db.sentences.where('category').equals(old.name).modify({ category: newName })
        await db.categories.update(id, changes)
      })
      return
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
    await db.words.where('category').equals(cat.name).modify({ category: target })
    // 将该分类下的短句也移到目标分类
    await db.sentences.where('category').equals(cat.name).modify({ category: target })
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
        nextReviewAt: now + 365 * DAY_MS,
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
  await db.transaction('rw', db.words, db.studySessions, db.studyPlans, async () => {
    await db.words.bulkDelete(ids)
    for (const id of ids) {
      await db.studySessions.where('wordId').equals(id).delete()
      await pruneWordIdFromPlans(id)
    }
  })
}
