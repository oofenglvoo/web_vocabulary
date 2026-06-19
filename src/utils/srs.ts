import { Word } from '../types/word'

export function calculateSrs(
  quality: number,
  interval: number,
  easeFactor: number,
  streak: number
): { newInterval: number; newEaseFactor: number; nextReviewAt: number } {
  const q = Math.min(Math.max(quality, 0), 5)

  let newEaseFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  newEaseFactor = Math.max(1.3, newEaseFactor)

  let newInterval: number
  if (q < 3) {
    newInterval = 1
  } else if (streak === 0) {
    newInterval = 1
  } else if (streak === 1) {
    newInterval = 6
  } else {
    newInterval = Math.round(interval * newEaseFactor)
    newInterval = Math.min(newInterval, 365)
  }

  const nextReviewAt = Date.now() + newInterval * 24 * 60 * 60 * 1000

  return { newInterval, newEaseFactor, nextReviewAt }
}

export function getDueWords(words: Word[]): Word[] {
  const now = Date.now()
  return words
    .filter((w) => !w.isLearned && w.nextReviewAt <= now)
    .sort((a, b) => a.nextReviewAt - b.nextReviewAt)
}

export function getRecommendedStudyCount(dueCount: number): number {
  if (dueCount === 0) return 0
  if (dueCount <= 10) return dueCount
  if (dueCount <= 20) return 15
  if (dueCount <= 50) return 20
  return 30
}
