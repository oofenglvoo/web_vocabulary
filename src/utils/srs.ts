import { Word } from '../types/word'

// 艾宾浩斯 7 周期制（复刻 Moji辞书）
// 周期间隔: 1 → 2 → 4 → 7 → 10 → 15 → 20 天
// 规则: 答对(quality>=3) 累计 stageProgress；连续答对 2 次 = "周期内全对" → 晋级下一周期。
//       答错(quality<3) 清零 stageProgress，停留当前周期(同周期内按短间隔重排复习)。
//       第 7 周期全对 → 已掌握(isLearned=1)。

/** 下标 = 周期(1-7)，对应间隔天数 */
export const STAGE_INTERVALS = [0, 1, 2, 4, 7, 10, 15, 20]

/** 一个周期需连续答对多少次才算"全对"晋级 */
export const STAGE_CLEAN_NEEDED = 2

export const MAX_STAGE = 7

/**
 * 复习按本地自然日计算，而不是要求恰好经过 24 小时。
 * 例如昨天晚上学习的词，今天就应该出现在“今日待复习”。
 */
export function getTodayReviewCutoff(now = new Date()): number {
  const tomorrow = new Date(now)
  tomorrow.setHours(24, 0, 0, 0)
  return tomorrow.getTime()
}

export interface StageState {
  srsStage: number // 0=未学, 1-6 学习中, 7=已掌握
  stageProgress: number // 当前周期内连续答对数
}

export interface StageReviewResult {
  newStage: number
  newProgress: number
  isLearned: boolean
}

/** 一次作答后返回新的周期状态（quality 0-5，>=3 视为答对） */
export function applyStageReview(
  w: StageState,
  quality: number
): StageReviewResult {
  const stage = Math.max(0, Math.min(w.srsStage, MAX_STAGE))
  let progress = w.stageProgress || 0

  if (quality >= 3) {
    // 未学的新词首次答对 → 进入第 1 周期（"开始学习"）
    if (stage === 0) {
      return { newStage: 1, newProgress: 0, isLearned: false }
    }
    // 答对：累计周期内连续答对
    progress += 1
    if (progress >= STAGE_CLEAN_NEEDED) {
      const newStage = stage + 1
      return {
        newStage: Math.min(newStage, MAX_STAGE),
        newProgress: 0,
        // 第 7 周期就是最终掌握状态。
        isLearned: newStage >= MAX_STAGE,
      }
    }
    return { newStage: stage, newProgress: progress, isLearned: false }
  }
  // 答错：清零，停留当前周期
  return { newStage: stage, newProgress: 0, isLearned: false }
}

/** 根据当前周期取下次复习间隔天数 */
export function stageIntervalDays(stage: number): number {
  const s = Math.max(1, Math.min(stage, MAX_STAGE))
  return STAGE_INTERVALS[s]
}

export function getDueWords(words: Word[]): Word[] {
  const cutoff = getTodayReviewCutoff()
  return words
    .filter((w) => !w.isLearned && w.nextReviewAt < cutoff)
    .sort((a, b) => a.nextReviewAt - b.nextReviewAt)
}

export function getRecommendedStudyCount(dueCount: number): number {
  if (dueCount === 0) return 0
  if (dueCount <= 10) return dueCount
  if (dueCount <= 20) return 15
  if (dueCount <= 50) return 20
  return 30
}
