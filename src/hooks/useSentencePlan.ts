import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { StudyPlan, Sentence } from '../types/word'

// 短句计划:与单词计划(useStudyPlan.ts)逻辑一致,仅查表改为 sentences,
// 且只管理 entityType === 'sentence' 的计划。单词/短句各自独立维护"激活"状态。

function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface SentencePlanProgress {
  totalSentences: number
  startedSentences: number
  learnedSentences: number
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
  // 今日新句展示数 = 配额内完成 + 加学完成
  todayNewDisplay: number
}

export function useActiveSentencePlan(): StudyPlan | undefined {
  return (
    useLiveQuery(
      () =>
        db.studyPlans
          .where('entityType')
          .equals('sentence')
          .filter((p) => p.isActive === 1)
          .first(),
      []
    ) ?? undefined
  )
}

export function useAllSentencePlans(): StudyPlan[] {
  return (
    useLiveQuery(async () => {
      const plans = await db.studyPlans
        .where('entityType')
        .equals('sentence')
        .toArray()
      return plans.sort((a, b) => b.createdAt - a.createdAt)
    }, []) ?? []
  )
}

export function useSentencePlanById(id: number): StudyPlan | undefined {
  return useLiveQuery(() => db.studyPlans.get(id), [id])
}

export function usePlanSentences(plan: StudyPlan | undefined): Sentence[] {
  return (
    useLiveQuery(async () => {
      if (!plan || plan.wordIds.length === 0) return []
      const sentences = await db.sentences.bulkGet(plan.wordIds)
      return sentences.filter((s): s is Sentence => !!s)
      // 依赖数组引用而非 length：wordIds 内容变化（同长度换词）时也要重跑
    }, [plan?.id, plan?.wordIds]) ?? []
  )
}

export function useSentencePlanProgress(plan: StudyPlan | undefined): SentencePlanProgress {
  const sentences = usePlanSentences(plan)
  if (!plan) {
    return {
      totalSentences: 0,
      startedSentences: 0,
      learnedSentences: 0,
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
  const now = Date.now()
  const startedSet = new Set(plan.startedIds)
  const learned = sentences.filter((s) => s.isLearned === 1).length
  // 剩余新句：未 start 且未掌握（与 getTodayNewSentences 口径一致，已掌握不算新句）
  const remainingNew = sentences.filter(
    (s) => !startedSet.has(s.id!) && s.isLearned === 0
  ).length
  const dueReview = sentences.filter(
    (s) => startedSet.has(s.id!) && s.isLearned === 0 && s.nextReviewAt <= now
  ).length
  const today = todayStr()
  const isToday = plan.todayDate === today
  const todayNewDone = isToday ? plan.todayNewDone : 0
  const todayReviewDone = isToday ? plan.todayReviewDone : 0
  const todayExtraDone = isToday ? plan.todayExtraDone ?? 0 : 0
  // 今日新句展示数 = 配额内完成 + 加学完成
  const todayNewDisplay = todayNewDone + todayExtraDone
  const overallPercent =
    sentences.length > 0 ? Math.round((learned / sentences.length) * 100) : 0
  const estimatedDaysLeft =
    plan.newPerDay > 0 ? Math.ceil(remainingNew / plan.newPerDay) : 0

  const todayNewRemaining = Math.min(
    Math.max(0, plan.newPerDay - todayNewDone),
    remainingNew
  )
  const todayReviewRemaining = Math.max(0, dueReview - todayReviewDone)

  return {
    totalSentences: sentences.length,
    startedSentences: plan.startedIds.length,
    learnedSentences: learned,
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

// 根据来源构建 sentenceIds 快照(查 sentences 表)
async function buildSentenceIdsFromSource(
  sourceKind: 'category' | 'favorites' | 'all',
  sourceCategory: string
): Promise<number[]> {
  let sentences: Sentence[] = []
  if (sourceKind === 'category') {
    sentences = await db.sentences.where('category').equals(sourceCategory).toArray()
  } else if (sourceKind === 'favorites') {
    sentences = await db.sentences.where('isFavorite').equals(1).toArray()
  } else {
    sentences = await db.sentences.toArray()
  }
  sentences.sort((a, b) => a.createdAt - b.createdAt)
  return sentences.map((s) => s.id!).filter((id) => id != null)
}

export async function createSentencePlan(input: {
  name: string
  sourceKind: 'category' | 'favorites' | 'all'
  sourceCategory?: string
  newPerDay: number
  reviewPerDay: number
}): Promise<number> {
  const wordIds = await buildSentenceIdsFromSource(
    input.sourceKind,
    input.sourceCategory ?? ''
  )
  // 新建短句计划时,把其他"激活"的短句计划置 0；事务内直接取回新计划 id
  let createdId = 0
  await db.transaction('rw', db.studyPlans, async () => {
    const existing = await db.studyPlans
      .where('entityType')
      .equals('sentence')
      .filter((p) => p.isActive === 1)
      .toArray()
    for (const p of existing) {
      if (p.id) await db.studyPlans.update(p.id, { isActive: 0 })
    }
    createdId = Number(
      await db.studyPlans.add({
        name: input.name,
        entityType: 'sentence',
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
      } as StudyPlan)
    )
  })
  return createdId
}

export async function activateSentencePlan(id: number) {
  await db.transaction('rw', db.studyPlans, async () => {
    const existing = await db.studyPlans
      .where('entityType')
      .equals('sentence')
      .filter((p) => p.isActive === 1)
      .toArray()
    for (const p of existing) {
      if (p.id && p.id !== id) await db.studyPlans.update(p.id, { isActive: 0 })
    }
    await db.studyPlans.update(id, { isActive: 1, isArchived: 0 })
  })
}

export async function archiveSentencePlan(id: number) {
  await db.studyPlans.update(id, { isActive: 0, isArchived: 1 })
}

export async function deleteSentencePlan(id: number) {
  await db.studyPlans.delete(id)
}

export async function updateSentencePlanSettings(
  id: number,
  changes: { name?: string; newPerDay?: number; reviewPerDay?: number }
) {
  await db.studyPlans.update(id, changes)
}

// 刷新短句计划的 id 池，同时清理已删除短句遗留的失效 ID
export async function refreshSentencePlanWords(id: number): Promise<number> {
  const plan = await db.studyPlans.get(id)
  if (!plan) return 0
  const fresh = await buildSentenceIdsFromSource(plan.sourceKind, plan.sourceCategory)
  const existing = await db.sentences.bulkGet(plan.wordIds)
  const existingIds = existing.filter((s): s is Sentence => !!s).map((s) => s.id!)
  const merged = Array.from(new Set([...existingIds, ...fresh]))
  const newIds = fresh.filter((fid) => !existingIds.includes(fid))
  await db.studyPlans.update(id, { wordIds: merged })
  return newIds.length
}

export async function getSentencePlanNewWordCount(id: number): Promise<number> {
  const plan = await db.studyPlans.get(id)
  if (!plan) return 0
  const fresh = await buildSentenceIdsFromSource(plan.sourceKind, plan.sourceCategory)
  const existingSet = new Set(plan.wordIds)
  return fresh.filter((wid) => !existingSet.has(wid)).length
}

export async function getTodayNewSentences(plan: StudyPlan): Promise<Sentence[]> {
  if (plan.wordIds.length === 0) return []
  const startedSet = new Set(plan.startedIds)
  const notStartedIds = plan.wordIds.filter((id) => !startedSet.has(id))
  if (notStartedIds.length === 0) return []
  const sentences = await db.sentences.bulkGet(notStartedIds)
  // 已掌握(isLearned=1)的短句不再作为新句——先排除再取配额
  return sentences
    .filter((s): s is Sentence => !!s)
    .filter((s) => s.isLearned === 0)
    .slice(0, plan.newPerDay)
}

// 计划今日新句是否已学满(newPerDay)
export function isTodayNewQuotaDone(plan: StudyPlan): boolean {
  const isToday = plan.todayDate === todayStr()
  const done = isToday ? plan.todayNewDone : 0
  return done >= plan.newPerDay
}

// 加学：从计划取"未掌握且未 start 的"一批新句(数量=newPerDay)，独立于今日配额
export async function getExtraNewSentences(plan: StudyPlan): Promise<Sentence[]> {
  if (plan.wordIds.length === 0) return []
  const startedSet = new Set(plan.startedIds)
  const notStartedIds = plan.wordIds.filter((id) => !startedSet.has(id))
  if (notStartedIds.length === 0) return []
  const sentences = await db.sentences.bulkGet(notStartedIds)
  return sentences
    .filter((s): s is Sentence => !!s)
    .filter((s) => s.isLearned === 0)
    .slice(0, plan.newPerDay)
}

// 加学中标记短句已学：写入 startedIds + 今日加学完成数(todayExtraDone)+1，不计入配额(todayNewDone)
export async function markExtraSentenceStarted(planId: number, sentenceId: number) {
  await withPlanUpdate(planId, (plan) => {
    if (plan.startedIds.includes(sentenceId)) return {}
    const today = todayStr()
    const isToday = plan.todayDate === today
    const changes: Partial<StudyPlan> = {
      startedIds: [...plan.startedIds, sentenceId],
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

export async function getTodayReviewSentences(plan: StudyPlan): Promise<Sentence[]> {
  if (plan.wordIds.length === 0) return []
  const now = Date.now()
  const startedSet = new Set(plan.startedIds)
  const candidates = plan.wordIds.filter((id) => startedSet.has(id))
  const sentences = await db.sentences.bulkGet(candidates)
  const today = todayStr()
  const isToday = plan.todayDate === today
  const todayReviewDone = isToday ? plan.todayReviewDone : 0
  const remaining = Math.max(0, plan.reviewPerDay - todayReviewDone)
  return sentences
    .filter((s): s is Sentence => !!s)
    .filter((s) => s.isLearned === 0 && s.nextReviewAt <= now)
    .sort((a, b) => a.nextReviewAt - b.nextReviewAt)
    .slice(0, remaining)
}

// 事务内读取-计算-写入计划更新，避免并发互相覆盖
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

export async function markSentenceStarted(planId: number, sentenceId: number) {
  await withPlanUpdate(planId, (plan) => {
    if (plan.startedIds.includes(sentenceId)) return {}
    const today = todayStr()
    const isToday = plan.todayDate === today
    const changes: Partial<StudyPlan> = {
      startedIds: [...plan.startedIds, sentenceId],
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

export async function markSentenceReviewDone(planId: number) {
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

export async function ensureSentenceTodayReset(planId: number) {
  await withPlanUpdate(planId, (plan) => {
    const today = todayStr()
    if (plan.todayDate !== today) {
      return { todayDate: today, todayNewDone: 0, todayReviewDone: 0, todayExtraDone: 0 }
    }
    return {}
  })
}

export async function markPlanSentenceLearned(
  planId: number,
  sentenceId: number,
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
      if (!plan.startedIds.includes(sentenceId)) {
        changes.startedIds = [...plan.startedIds, sentenceId]
      }
      changes.todayNewDone = (changes.todayNewDone ?? plan.todayNewDone) + 1
    }
    return changes
  })
}
