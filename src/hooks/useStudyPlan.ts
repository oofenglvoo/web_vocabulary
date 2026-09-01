import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { StudyPlan, Word } from '../types/word'
import { getTodayReviewCutoff } from '../utils/srs'

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

export function useActivePlan(): StudyPlan | undefined {
  return (
    useLiveQuery(
      () =>
        db.studyPlans
          .where('isActive')
          .equals(1)
          .filter((p) => (p.entityType ?? 'word') === 'word')
          .first(),
      []
    ) ?? undefined
  )
}

export function useAllPlans(): StudyPlan[] {
  return (
    useLiveQuery(
      () =>
        db.studyPlans
          .orderBy('createdAt')
          .reverse()
          .filter((p) => (p.entityType ?? 'word') === 'word')
          .toArray(),
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
      // 依赖数组引用而非 length：wordIds 内容变化（同长度换词）时也要重跑
    }, [plan?.id, plan?.wordIds]) ?? []
  )
}

export function usePlanProgress(plan: StudyPlan | undefined): PlanProgress {
  const words = usePlanWords(plan)
  if (!plan) {
    return {
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
  }
  const reviewCutoff = getTodayReviewCutoff()
  const startedSet = new Set(plan.startedIds)
  // 只统计当前计划中仍然存在的词，避免删除单词后遗留的 ID 污染首页数字。
  const startedWords = words.filter((w) => startedSet.has(w.id!))
  // “学习中”必须同时满足：已加入本计划且尚未掌握。
  const learned = words.filter((w) => w.isLearned === 1).length
  const learning = startedWords.filter((w) => w.isLearned === 0).length
  // 剩余新词：未 start 且未掌握（与 getTodayNewWords 口径一致，已掌握不算新词）
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
  // 今日新词展示数 = 配额内完成 + 加学完成
  const todayNewDisplay = todayNewDone + todayExtraDone
  const overallPercent =
    words.length > 0 ? Math.round((learned / words.length) * 100) : 0
  const estimatedDaysLeft =
    plan.newPerDay > 0 ? Math.ceil(remainingNew / plan.newPerDay) : 0

  // 今日待学新词 = 每日目标 - 今日已完成（但不超过实际剩余新词数）
  const todayNewRemaining = Math.min(
    Math.max(0, plan.newPerDay - todayNewDone),
    remainingNew
  )
  // 复习数量由当前到期词动态决定，不设置每日上限。
  const todayReviewRemaining = dueReview

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
    todayReviewTarget: dueReview,
    todayNewRemaining,
    todayReviewRemaining,
    overallPercent,
    estimatedDaysLeft,
    todayNewDisplay,
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
  reviewPerDay?: number
}): Promise<number> {
  const wordIds = await buildWordIdsFromSource(
    input.sourceKind,
    input.sourceCategory ?? ''
  )
  // 新建计划时,把其他激活的"单词"计划 isActive 置 0；在事务内直接取回新计划 id
  let createdId = 0
  await db.transaction('rw', db.studyPlans, async () => {
    const existing = await db.studyPlans
      .where('isActive')
      .equals(1)
      .filter((p) => (p.entityType ?? 'word') === 'word')
      .toArray()
    for (const p of existing) {
      if (p.id) await db.studyPlans.update(p.id, { isActive: 0 })
    }
    createdId = Number(
      await db.studyPlans.add({
        name: input.name,
        entityType: 'word',
        sourceKind: input.sourceKind,
        sourceCategory: input.sourceCategory ?? '',
        newPerDay: input.newPerDay,
         reviewPerDay: input.reviewPerDay ?? 0,
        wordIds,
        startedIds: [],
        isActive: 1,
        isArchived: 0,
        createdAt: Date.now(),
        todayDate: todayStr(),
        todayNewDone: 0,
        todayReviewDone: 0,
        todayExtraDone: 0,
      } as StudyPlan)
    )
  })
  return createdId
}

export async function activatePlan(id: number) {
  await db.transaction('rw', db.studyPlans, async () => {
    const existing = await db.studyPlans
      .where('isActive')
      .equals(1)
      .filter((p) => (p.entityType ?? 'word') === 'word')
      .toArray()
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
// 同时清理已删除单词遗留的失效 ID
export async function refreshPlanWords(id: number): Promise<number> {
  const plan = await db.studyPlans.get(id)
  if (!plan) return 0
  const fresh = await buildWordIdsFromSource(plan.sourceKind, plan.sourceCategory)
  // 剔除已删除的 ID，保留仍存在的旧 ID，再并入来源中新增的 ID
  const existing = await db.words.bulkGet(plan.wordIds)
  const existingIds = existing.filter((w): w is Word => !!w).map((w) => w.id!)
  const merged = Array.from(new Set([...existingIds, ...fresh]))
  const newIds = fresh.filter((fid) => !existingIds.includes(fid))
  await db.studyPlans.update(id, { wordIds: merged })
  return newIds.length
}

// 检查计划来源中是否有尚未纳入的新单词
export async function getPlanNewWordCount(id: number): Promise<number> {
  const plan = await db.studyPlans.get(id)
  if (!plan) return 0
  const fresh = await buildWordIdsFromSource(plan.sourceKind, plan.sourceCategory)
  const existingSet = new Set(plan.wordIds)
  return fresh.filter((wid) => !existingSet.has(wid)).length
}

// 获取今日应学的"新词"队列:从 wordIds 中尚未 started 的取 newPerDay 个
// 已掌握(isLearned=1)的词不再作为新词——先排除已掌握，再取配额，避免配额被已掌握词占满
export async function getTodayNewWords(plan: StudyPlan): Promise<Word[]> {
  if (plan.wordIds.length === 0) return []
  const startedSet = new Set(plan.startedIds)
  const notStartedIds = plan.wordIds.filter((id) => !startedSet.has(id))
  if (notStartedIds.length === 0) return []
  const words = await db.words.bulkGet(notStartedIds)
  const unlearned = words
    .filter((w): w is Word => !!w)
    .filter((w) => w.isLearned === 0)
  return unlearned.slice(0, plan.newPerDay)
}

// 计划今日新词是否已学满(newPerDay)
export function isTodayNewQuotaDone(plan: StudyPlan): boolean {
  const isToday = plan.todayDate === todayStr()
  const done = isToday ? plan.todayNewDone : 0
  return done >= plan.newPerDay
}

// 加学：从计划取"未掌握且未 start 的"一批新词(数量=newPerDay)，独立于今日配额
export async function getExtraNewWords(plan: StudyPlan): Promise<Word[]> {
  if (plan.wordIds.length === 0) return []
  const startedSet = new Set(plan.startedIds)
  const notStartedIds = plan.wordIds.filter((id) => !startedSet.has(id))
  if (notStartedIds.length === 0) return []
  const words = await db.words.bulkGet(notStartedIds)
  return words
    .filter((w): w is Word => !!w)
    .filter((w) => w.isLearned === 0)
    .slice(0, plan.newPerDay)
}

// 加学中标记词已学：写入 startedIds + 今日加学完成数(todayExtraDone)+1，不计入配额(todayNewDone)
export async function markExtraWordStarted(planId: number, wordId: number) {
  await withPlanUpdate(planId, (plan) => {
    if (plan.startedIds.includes(wordId)) return {}
    const today = todayStr()
    const isToday = plan.todayDate === today
    const changes: Partial<StudyPlan> = {
      startedIds: [...plan.startedIds, wordId],
    }
    // 跨日则重置今日各计数
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

// 获取今日应复习的单词队列:已 started 且未掌握且到期
// 返回全部符合条件的到期单词，复习数量由 SRS 动态决定
export async function getTodayReviewWords(plan: StudyPlan): Promise<Word[]> {
  if (plan.wordIds.length === 0) return []
  const reviewCutoff = getTodayReviewCutoff()
  const startedSet = new Set(plan.startedIds)
  const candidates = plan.wordIds.filter((id) => startedSet.has(id))
  const words = await db.words.bulkGet(candidates)
  return words
    .filter((w): w is Word => !!w)
    .filter((w) => w.isLearned === 0 && w.nextReviewAt < reviewCutoff)
    .sort((a, b) => a.nextReviewAt - b.nextReviewAt)
}

// 事务内读取-计算-写入计划更新，避免并发(如跨午夜重置与新词计数)互相覆盖
async function withPlanUpdate(
  planId: number,
  fn: (plan: StudyPlan) => Partial<StudyPlan>
): Promise<void> {
  await db.transaction('rw', db.studyPlans, async () => {
    const plan = await db.studyPlans.get(planId)
    if (!plan) return
    const changes = fn(plan)
    await db.studyPlans.update(planId, changes)
  })
}

// 标记一个新词为"已开始学"(加入 startedIds)
export async function markWordStarted(planId: number, wordId: number) {
  await withPlanUpdate(planId, (plan) => {
    if (plan.startedIds.includes(wordId)) return {}
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
    return changes
  })
}

// 标记一次复习完成(只增加今日计数)
export async function markReviewDone(planId: number) {
  await withPlanUpdate(planId, (plan) => {
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
    return changes
  })
}

// 跨日重置今日计数(在读取时调用)
export async function ensureTodayReset(planId: number) {
  await withPlanUpdate(planId, (plan) => {
    const today = todayStr()
    if (plan.todayDate !== today) {
      return { todayDate: today, todayNewDone: 0, todayReviewDone: 0, todayExtraDone: 0 }
    }
    return {}
  })
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
  await withPlanUpdate(planId, (plan) => {
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
    return changes
  })
}
