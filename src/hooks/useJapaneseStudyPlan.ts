import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { JapaneseStudyPlan, JapaneseWord } from '../types/word'
import { getTodayReviewCutoff } from '../utils/srs'

// 与 useStudyPlan.ts 完全对等的日语学习计划数据层：
// 计划存于独立的 japaneseStudyPlans 表，词条来自 japaneseWords，
// 收藏来源读取 japaneseFavoriteItems。类型上日语计划与 StudyPlan 结构兼容
// （缺省 entityType 视为 'word'），供统一页面直接消费。

// 当日日期字符串 (本地时区 yyyy-mm-dd)
function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface JapanesePlanProgress {
  totalWords: number
  startedWords: number
  learnedWords: number
  learningWords: number
  remainingNew: number
  dueReview: number
  todayNewDone: number
  todayReviewDone: number
  todayNewTarget: number
  todayReviewTarget: number
  todayNewRemaining: number
  todayReviewRemaining: number
  overallPercent: number
  estimatedDaysLeft: number
  // 今日新词展示数 = 配额内完成 + 加学完成(如 20/10)
  todayNewDisplay: number
}

export function useActiveJapaneseStudyPlan(): JapaneseStudyPlan | undefined {
  return useLiveQuery(() => db.japaneseStudyPlans.where('isActive').equals(1).first(), []) ?? undefined
}

export function useAllJapanesePlans(): JapaneseStudyPlan[] {
  return useLiveQuery(() => db.japaneseStudyPlans.orderBy('createdAt').reverse().toArray(), []) ?? []
}

export function useJapanesePlanById(id: number): JapaneseStudyPlan | undefined {
  return useLiveQuery(() => db.japaneseStudyPlans.get(id), [id])
}

export function useJapanesePlanWords(plan: JapaneseStudyPlan | undefined): JapaneseWord[] {
  return (
    useLiveQuery(async () => {
      if (!plan || plan.wordIds.length === 0) return []
      const words = await db.japaneseWords.bulkGet(plan.wordIds)
      return words.filter((w): w is JapaneseWord => !!w)
      // 依赖数组引用而非 length：wordIds 内容变化（同长度换词）时也要重跑
    }, [plan?.id, plan?.wordIds]) ?? []
  )
}

const EMPTY_PROGRESS: JapanesePlanProgress = {
  totalWords: 0,
  startedWords: 0,
  learnedWords: 0,
  learningWords: 0,
  remainingNew: 0,
  dueReview: 0,
  todayNewDone: 0,
  todayReviewDone: 0,
  todayNewTarget: 0,
  todayReviewTarget: 0,
  todayNewRemaining: 0,
  todayReviewRemaining: 0,
  overallPercent: 0,
  estimatedDaysLeft: 0,
  todayNewDisplay: 0,
}

export function useJapanesePlanProgress(plan: JapaneseStudyPlan | undefined): JapanesePlanProgress {
  const words = useJapanesePlanWords(plan)
  if (!plan) return EMPTY_PROGRESS

  const reviewCutoff = getTodayReviewCutoff()
  const startedSet = new Set(plan.startedIds)
  // 只统计当前计划中仍然存在的词，避免删除词条后遗留的 ID 污染数字。
  const startedWords = words.filter((w) => startedSet.has(w.id!))
  const learned = words.filter((w) => w.isLearned === 1).length
  const learning = startedWords.filter((w) => w.isLearned === 0).length
  // 剩余新词：未 start 且未掌握（与 getTodayJapaneseNewWords 口径一致）
  const remainingNew = words.filter(
    (w) => !startedSet.has(w.id!) && w.isLearned === 0
  ).length
  const dueReview = words.filter(
    (w) => startedSet.has(w.id!) && w.isLearned === 0 && w.nextReviewAt < reviewCutoff
  ).length
  const today = todayStr()
  const isToday = plan.todayDate === today
  const todayNewDone = isToday ? plan.todayNewDone : 0
  const todayReviewDone = isToday ? plan.todayReviewDone : 0
  const todayExtraDone = isToday ? plan.todayExtraDone ?? 0 : 0
  const todayNewDisplay = todayNewDone + todayExtraDone
  const overallPercent =
    words.length > 0 ? Math.round((learned / words.length) * 100) : 0
  const estimatedDaysLeft =
    plan.newPerDay > 0 ? Math.ceil(remainingNew / plan.newPerDay) : 0

  const todayNewRemaining = Math.min(
    Math.max(0, plan.newPerDay - todayNewDone),
    remainingNew
  )
  const todayReviewRemaining = Math.max(0, dueReview - todayReviewDone)

  return {
    totalWords: words.length,
    startedWords: startedWords.length,
    learnedWords: learned,
    learningWords: learning,
    remainingNew,
    dueReview,
    todayNewDone,
    todayReviewDone,
    todayNewTarget: plan.newPerDay,
    todayReviewTarget: plan.reviewPerDay,
    todayNewRemaining,
    todayReviewRemaining,
    overallPercent,
    estimatedDaysLeft,
    todayNewDisplay,
  }
}

// 根据来源构建 wordIds 快照（收藏来源读日语收藏夹条目）
async function buildJapaneseWordIdsFromSource(
  sourceKind: JapaneseStudyPlan['sourceKind'],
  sourceCategory: string
): Promise<number[]> {
  let words: JapaneseWord[] = []
  if (sourceKind === 'category') {
    words = await db.japaneseWords.where('category').equals(sourceCategory).toArray()
  } else if (sourceKind === 'favorites') {
    const entityIds = Array.from(new Set((await db.japaneseFavoriteItems.toArray()).map((item) => item.entityId)))
    words = (await db.japaneseWords.bulkGet(entityIds)).filter((w): w is JapaneseWord => !!w)
  } else {
    words = await db.japaneseWords.toArray()
  }
  // 按创建时间升序,优先学早加入的
  words.sort((a, b) => a.createdAt - b.createdAt)
  return words.map((w) => w.id!).filter((id) => id != null)
}

export async function createJapaneseStudyPlan(input: {
  name: string
  sourceKind: 'category' | 'favorites' | 'all'
  sourceCategory?: string
  newPerDay: number
  reviewPerDay: number
}): Promise<number> {
  const wordIds = await buildJapaneseWordIdsFromSource(input.sourceKind, input.sourceCategory ?? '')
  // 新建计划时把其他激活计划置 0；事务内取回新计划 id
  let createdId = 0
  await db.transaction('rw', db.japaneseStudyPlans, async () => {
    const existing = await db.japaneseStudyPlans.where('isActive').equals(1).toArray()
    for (const p of existing) {
      if (p.id) await db.japaneseStudyPlans.update(p.id, { isActive: 0 })
    }
    createdId = Number(
      await db.japaneseStudyPlans.add({
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
        todayExtraDone: 0,
      } as JapaneseStudyPlan)
    )
  })
  return createdId
}

export async function activateJapaneseStudyPlan(id: number) {
  await db.transaction('rw', db.japaneseStudyPlans, async () => {
    const existing = await db.japaneseStudyPlans.where('isActive').equals(1).toArray()
    for (const p of existing) {
      if (p.id && p.id !== id) await db.japaneseStudyPlans.update(p.id, { isActive: 0 })
    }
    await db.japaneseStudyPlans.update(id, { isActive: 1, isArchived: 0 })
  })
}

export async function archiveJapaneseStudyPlan(id: number) {
  await db.japaneseStudyPlans.update(id, { isActive: 0, isArchived: 1 })
}

export async function deleteJapaneseStudyPlan(id: number) {
  await db.japaneseStudyPlans.delete(id)
}

export async function updateJapaneseStudyPlanSettings(
  id: number,
  changes: { name?: string; newPerDay?: number; reviewPerDay?: number }
) {
  await db.japaneseStudyPlans.update(id, changes)
}

// 刷新计划的 wordIds（新增了同分类/收藏的词条时调用），
// 同时清理已删除词条遗留的失效 ID
export async function refreshJapanesePlanWords(id: number): Promise<number> {
  const plan = await db.japaneseStudyPlans.get(id)
  if (!plan) return 0
  const fresh = await buildJapaneseWordIdsFromSource(plan.sourceKind, plan.sourceCategory)
  const existing = await db.japaneseWords.bulkGet(plan.wordIds)
  const existingIds = existing.filter((w): w is JapaneseWord => !!w).map((w) => w.id!)
  const merged = Array.from(new Set([...existingIds, ...fresh]))
  const newIds = fresh.filter((fid) => !existingIds.includes(fid))
  await db.japaneseStudyPlans.update(id, { wordIds: merged })
  return newIds.length
}

// 检查计划来源中是否有尚未纳入的新词条
export async function getJapanesePlanNewWordCount(id: number): Promise<number> {
  const plan = await db.japaneseStudyPlans.get(id)
  if (!plan) return 0
  const fresh = await buildJapaneseWordIdsFromSource(plan.sourceKind, plan.sourceCategory)
  const existingSet = new Set(plan.wordIds)
  return fresh.filter((wid) => !existingSet.has(wid)).length
}

// 获取今日应学的"新词"队列：已掌握的不算新词
export async function getTodayJapaneseNewWords(plan: JapaneseStudyPlan): Promise<JapaneseWord[]> {
  if (plan.wordIds.length === 0) return []
  const startedSet = new Set(plan.startedIds)
  const notStartedIds = plan.wordIds.filter((id) => !startedSet.has(id))
  if (notStartedIds.length === 0) return []
  const words = await db.japaneseWords.bulkGet(notStartedIds)
  return words
    .filter((w): w is JapaneseWord => !!w)
    .filter((w) => w.isLearned === 0)
    .slice(0, plan.newPerDay)
}

// 计划今日新词是否已学满(newPerDay)
export function isTodayJapaneseNewQuotaDone(plan: JapaneseStudyPlan): boolean {
  const isToday = plan.todayDate === todayStr()
  const done = isToday ? plan.todayNewDone : 0
  return done >= plan.newPerDay
}

// 加学：从计划取"未掌握且未 start 的"一批新词(数量=newPerDay)，独立于今日配额
export async function getExtraJapaneseNewWords(plan: JapaneseStudyPlan): Promise<JapaneseWord[]> {
  if (plan.wordIds.length === 0) return []
  const startedSet = new Set(plan.startedIds)
  const notStartedIds = plan.wordIds.filter((id) => !startedSet.has(id))
  if (notStartedIds.length === 0) return []
  const words = await db.japaneseWords.bulkGet(notStartedIds)
  return words
    .filter((w): w is JapaneseWord => !!w)
    .filter((w) => w.isLearned === 0)
    .slice(0, plan.newPerDay)
}

// 加学中标记词已学：写入 startedIds + 今日加学完成数+1，不计入配额
export async function markExtraJapaneseWordStarted(planId: number, wordId: number) {
  await withJapanesePlanUpdate(planId, (plan) => {
    if (plan.startedIds.includes(wordId)) return {}
    const today = todayStr()
    const isToday = plan.todayDate === today
    const changes: Partial<JapaneseStudyPlan> = {
      startedIds: [...plan.startedIds, wordId],
    }
    if (!isToday) {
      changes.todayDate = today
      changes.todayNewDone = 0
      changes.todayReviewDone = 0
      changes.todayExtraDone = 1
    } else {
      changes.todayExtraDone = (plan.todayExtraDone ?? 0) + 1
    }
    return changes
  })
}

// 获取今日应复习的词条队列:已 started 且未掌握且到期，减去今日已完成数
export async function getTodayJapaneseReviewWords(plan: JapaneseStudyPlan): Promise<JapaneseWord[]> {
  if (plan.wordIds.length === 0) return []
  const reviewCutoff = getTodayReviewCutoff()
  const startedSet = new Set(plan.startedIds)
  const candidates = plan.wordIds.filter((id) => startedSet.has(id))
  const words = await db.japaneseWords.bulkGet(candidates)
  const today = todayStr()
  const isToday = plan.todayDate === today
  const todayReviewDone = isToday ? plan.todayReviewDone : 0
  const remaining = Math.max(0, plan.reviewPerDay - todayReviewDone)
  return words
    .filter((w): w is JapaneseWord => !!w)
    .filter((w) => w.isLearned === 0 && w.nextReviewAt < reviewCutoff)
    .sort((a, b) => a.nextReviewAt - b.nextReviewAt)
    .slice(0, remaining)
}

// 事务内读取-计算-写入计划更新，避免并发互相覆盖
async function withJapanesePlanUpdate(
  planId: number,
  fn: (plan: JapaneseStudyPlan) => Partial<JapaneseStudyPlan>
): Promise<void> {
  await db.transaction('rw', db.japaneseStudyPlans, async () => {
    const plan = await db.japaneseStudyPlans.get(planId)
    if (!plan) return
    const changes = fn(plan)
    await db.japaneseStudyPlans.update(planId, changes)
  })
}

// 标记一个新词为"已开始学"(加入 startedIds)
export async function markJapaneseWordStarted(planId: number, wordId: number) {
  await withJapanesePlanUpdate(planId, (plan) => {
    if (plan.startedIds.includes(wordId)) return {}
    const today = todayStr()
    const isToday = plan.todayDate === today
    const changes: Partial<JapaneseStudyPlan> = {
      startedIds: [...plan.startedIds, wordId],
    }
    if (isToday) {
      changes.todayNewDone = plan.todayNewDone + 1
    } else {
      changes.todayDate = today
      changes.todayNewDone = 1
      changes.todayReviewDone = 0
    }
    return changes
  })
}

// 标记一次复习完成(只增加今日计数)
export async function markJapaneseReviewDone(planId: number) {
  await withJapanesePlanUpdate(planId, (plan) => {
    const today = todayStr()
    const isToday = plan.todayDate === today
    const changes: Partial<JapaneseStudyPlan> = {}
    if (isToday) {
      changes.todayReviewDone = plan.todayReviewDone + 1
    } else {
      changes.todayDate = today
      changes.todayNewDone = 0
      changes.todayReviewDone = 1
    }
    return changes
  })
}

// 跨日重置今日计数(在读取时调用)
export async function ensureJapaneseTodayReset(planId: number) {
  await withJapanesePlanUpdate(planId, (plan) => {
    const today = todayStr()
    if (plan.todayDate !== today) {
      return { todayDate: today, todayNewDone: 0, todayReviewDone: 0, todayExtraDone: 0 }
    }
    return {}
  })
}

/**
 * 在计划上下文中把一个日语词标记为已掌握
 *  - 新词 → 加入 startedIds,本日新词计数 +1
 *  - 复习 → 本日复习计数 +1
 */
export async function markJapanesePlanWordLearned(
  planId: number,
  wordId: number,
  wasReview: boolean
) {
  await withJapanesePlanUpdate(planId, (plan) => {
    const today = todayStr()
    const isToday = plan.todayDate === today
    const changes: Partial<JapaneseStudyPlan> = {}
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
    return changes
  })
}
