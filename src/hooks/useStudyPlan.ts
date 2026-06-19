import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { StudyPlan, Word } from '../types/word'

// 当日日期字符串 (本地时区 yyyy-mm-dd)
function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface PlanProgress {
  totalWords: number
  startedWords: number
  learnedWords: number
  remainingNew: number
  dueReview: number
  todayNewDone: number
  todayReviewDone: number
  todayNewTarget: number
  todayReviewTarget: number
  // 0-100
  overallPercent: number
  // 预计剩余天数 (基于未开始新词 / newPerDay)
  estimatedDaysLeft: number
}

export function useActivePlan(): StudyPlan | undefined {
  return useLiveQuery(() => db.studyPlans.where('isActive').equals(1).first(), [])
}

export function useAllPlans(): StudyPlan[] {
  return (
    useLiveQuery(
      () => db.studyPlans.orderBy('createdAt').reverse().toArray(),
      []
    ) ?? []
  )
}

export function usePlanById(id: number): StudyPlan | undefined {
  return useLiveQuery(() => db.studyPlans.get(id), [id])
}

export function usePlanWords(plan: StudyPlan | undefined): Word[] {
  return (
    useLiveQuery(async () => {
      if (!plan || plan.wordIds.length === 0) return []
      const words = await db.words.bulkGet(plan.wordIds)
      return words.filter((w): w is Word => !!w)
    }, [plan?.id, plan?.wordIds.length]) ?? []
  )
}

export function usePlanProgress(plan: StudyPlan | undefined): PlanProgress {
  const words = usePlanWords(plan)
  if (!plan) {
    return {
      totalWords: 0,
      startedWords: 0,
      learnedWords: 0,
      remainingNew: 0,
      dueReview: 0,
      todayNewDone: 0,
      todayReviewDone: 0,
      todayNewTarget: 0,
      todayReviewTarget: 0,
      overallPercent: 0,
      estimatedDaysLeft: 0,
    }
  }
  const now = Date.now()
  const startedSet = new Set(plan.startedIds)
  const learned = words.filter((w) => w.isLearned === 1).length
  const remainingNew = words.filter((w) => !startedSet.has(w.id!)).length
  const dueReview = words.filter(
    (w) => startedSet.has(w.id!) && w.isLearned === 0 && w.nextReviewAt <= now
  ).length
  const today = todayStr()
  const isToday = plan.todayDate === today
  const todayNewDone = isToday ? plan.todayNewDone : 0
  const todayReviewDone = isToday ? plan.todayReviewDone : 0
  const overallPercent =
    words.length > 0 ? Math.round((learned / words.length) * 100) : 0
  const estimatedDaysLeft =
    plan.newPerDay > 0 ? Math.ceil(remainingNew / plan.newPerDay) : 0
  return {
    totalWords: words.length,
    startedWords: plan.startedIds.length,
    learnedWords: learned,
    remainingNew,
    dueReview,
    todayNewDone,
    todayReviewDone,
    todayNewTarget: plan.newPerDay,
    todayReviewTarget: plan.reviewPerDay,
    overallPercent,
    estimatedDaysLeft,
  }
}

// 根据来源构建 wordIds 快照
async function buildWordIdsFromSource(
  sourceKind: 'category' | 'favorites' | 'all',
  sourceCategory: string
): Promise<number[]> {
  let words: Word[] = []
  if (sourceKind === 'category') {
    words = await db.words.where('category').equals(sourceCategory).toArray()
  } else if (sourceKind === 'favorites') {
    words = await db.words.where('isFavorite').equals(1).toArray()
  } else {
    words = await db.words.toArray()
  }
  // 按创建时间升序,优先学早加入的;未掌握的优先
  words.sort((a, b) => a.createdAt - b.createdAt)
  return words.map((w) => w.id!).filter((id) => id != null)
}

export async function createPlan(input: {
  name: string
  sourceKind: 'category' | 'favorites' | 'all'
  sourceCategory?: string
  newPerDay: number
  reviewPerDay: number
}): Promise<number> {
  const wordIds = await buildWordIdsFromSource(
    input.sourceKind,
    input.sourceCategory ?? ''
  )
  // 新建计划时,把其他计划的 isActive 置 0
  await db.transaction('rw', db.studyPlans, async () => {
    const existing = await db.studyPlans.where('isActive').equals(1).toArray()
    for (const p of existing) {
      if (p.id) await db.studyPlans.update(p.id, { isActive: 0 })
    }
    await db.studyPlans.add({
      name: input.name,
      sourceKind: input.sourceKind,
      sourceCategory: input.sourceCategory ?? '',
      newPerDay: input.newPerDay,
      reviewPerDay: input.reviewPerDay,
      wordIds,
      startedIds: [],
      isActive: 1,
      isArchived: 0,
      createdAt: Date.now(),
      todayDate: todayStr(),
      todayNewDone: 0,
      todayReviewDone: 0,
    } as StudyPlan)
  })
  // 返回新建的 id (取最后一个)
  const created = await db.studyPlans.where('isActive').equals(1).first()
  return created?.id ?? 0
}

export async function activatePlan(id: number) {
  await db.transaction('rw', db.studyPlans, async () => {
    const existing = await db.studyPlans.where('isActive').equals(1).toArray()
    for (const p of existing) {
      if (p.id && p.id !== id) await db.studyPlans.update(p.id, { isActive: 0 })
    }
    await db.studyPlans.update(id, { isActive: 1, isArchived: 0 })
  })
}

export async function archivePlan(id: number) {
  await db.studyPlans.update(id, { isActive: 0, isArchived: 1 })
}

export async function deletePlan(id: number) {
  await db.studyPlans.delete(id)
}

export async function updatePlanSettings(
  id: number,
  changes: { name?: string; newPerDay?: number; reviewPerDay?: number }
) {
  await db.studyPlans.update(id, changes)
}

// 刷新计划的 wordIds (新增了同分类/收藏的单词时调用)
export async function refreshPlanWords(id: number) {
  const plan = await db.studyPlans.get(id)
  if (!plan) return
  const fresh = await buildWordIdsFromSource(plan.sourceKind, plan.sourceCategory)
  // 合并:已 started 的保留,新加入的尚 started 的 ID 也保留
  const startedSet = new Set(plan.startedIds)
  const merged = Array.from(new Set([...plan.wordIds, ...fresh]))
  // 但删除已经不在来源里的单词?这里保守保留,不删除
  await db.studyPlans.update(id, { wordIds: merged })
  // 提示: 已学过的单词保留;但下次取新词时只会从 fresh 中尚未 started 的里取
  void startedSet
}

// 获取今日应学的"新词"队列:从 wordIds 中尚未 started 的取 newPerDay 个
export async function getTodayNewWords(plan: StudyPlan): Promise<Word[]> {
  if (plan.wordIds.length === 0) return []
  const startedSet = new Set(plan.startedIds)
  const candidates = plan.wordIds.filter((id) => !startedSet.has(id))
  const take = candidates.slice(0, plan.newPerDay)
  if (take.length === 0) return []
  const words = await db.words.bulkGet(take)
  return words.filter((w): w is Word => !!w)
}

// 获取今日应复习的单词队列:已 started 且未掌握且到期
export async function getTodayReviewWords(plan: StudyPlan): Promise<Word[]> {
  if (plan.wordIds.length === 0) return []
  const now = Date.now()
  const startedSet = new Set(plan.startedIds)
  const candidates = plan.wordIds.filter((id) => startedSet.has(id))
  const words = await db.words.bulkGet(candidates)
  return words
    .filter((w): w is Word => !!w)
    .filter((w) => w.isLearned === 0 && w.nextReviewAt <= now)
    .sort((a, b) => a.nextReviewAt - b.nextReviewAt)
    .slice(0, plan.reviewPerDay)
}

// 标记一个新词为"已开始学"(加入 startedIds)
export async function markWordStarted(planId: number, wordId: number) {
  const plan = await db.studyPlans.get(planId)
  if (!plan) return
  if (plan.startedIds.includes(wordId)) return
  const today = todayStr()
  const isToday = plan.todayDate === today
  const changes: Partial<StudyPlan> = {
    startedIds: [...plan.startedIds, wordId],
  }
  if (isToday) {
    changes.todayNewDone = plan.todayNewDone + 1
  } else {
    changes.todayDate = today
    changes.todayNewDone = 1
    changes.todayReviewDone = 0
  }
  await db.studyPlans.update(planId, changes)
}

// 标记一次复习完成(只增加今日计数)
export async function markReviewDone(planId: number) {
  const plan = await db.studyPlans.get(planId)
  if (!plan) return
  const today = todayStr()
  const isToday = plan.todayDate === today
  const changes: Partial<StudyPlan> = {}
  if (isToday) {
    changes.todayReviewDone = plan.todayReviewDone + 1
  } else {
    changes.todayDate = today
    changes.todayNewDone = 0
    changes.todayReviewDone = 1
  }
  await db.studyPlans.update(planId, changes)
}

// 跨日重置今日计数(在读取时调用)
export async function ensureTodayReset(planId: number) {
  const plan = await db.studyPlans.get(planId)
  if (!plan) return
  const today = todayStr()
  if (plan.todayDate !== today) {
    await db.studyPlans.update(planId, {
      todayDate: today,
      todayNewDone: 0,
      todayReviewDone: 0,
    })
  }
}

/**
 * 在计划上下文中把一个单词标记为已掌握
 *  - 若该词原本是"新词"(不在 startedIds 中):加入 startedIds,本日新词计数 +1
 *  - 若该词原本是"复习"(已在 startedIds 中):本日复习计数 +1
 * 之后由调用方再调 markWordLearned() 把单词的 isLearned 置 1
 */
export async function markPlanWordLearned(
  planId: number,
  wordId: number,
  wasReview: boolean
) {
  const plan = await db.studyPlans.get(planId)
  if (!plan) return
  const today = todayStr()
  const isToday = plan.todayDate === today
  const changes: Partial<StudyPlan> = {}
  if (!isToday) {
    changes.todayDate = today
    changes.todayNewDone = 0
    changes.todayReviewDone = 0
  }
  if (wasReview) {
    changes.todayReviewDone = (changes.todayReviewDone ?? plan.todayReviewDone) + 1
  } else {
    if (!plan.startedIds.includes(wordId)) {
      changes.startedIds = [...plan.startedIds, wordId]
    }
    changes.todayNewDone = (changes.todayNewDone ?? plan.todayNewDone) + 1
  }
  await db.studyPlans.update(planId, changes)
}
