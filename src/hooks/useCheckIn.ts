import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { StudyKind, StudySession } from '../types/word'

// 打卡统计：完全从 studySessions 派生（timestamp + kind）
// kind='new' 有记录 → 当天新学完成；kind='review' → 当天复习完成
// 支持按语言过滤会话实体（en: word+sentence；ja: japaneseWord）

export interface DayCheckIn {
  dateKey: string // yyyy-mm-dd（本地时区）
  newDone: number
  reviewDone: number
}

export interface CheckInStats {
  totalDays: number // 累计学习天数（任意 kind）
  streak: number // 连续天数
  todayNewDone: number
  todayReviewDone: number
}

const DAY_MS = 24 * 60 * 60 * 1000

const ALL_TYPES: StudySession['entityType'][] = ['word', 'sentence', 'japaneseWord']

export function dateKeyOf(ts: number): string {
  const d = new Date(ts)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function groupByDay(sessions: { timestamp: number; kind: StudyKind }[]): Map<string, DayCheckIn> {
  const map = new Map<string, DayCheckIn>()
  for (const s of sessions) {
    const key = dateKeyOf(s.timestamp)
    const entry = map.get(key) ?? { dateKey: key, newDone: 0, reviewDone: 0 }
    if (s.kind === 'new') entry.newDone++
    else entry.reviewDone++
    map.set(key, entry)
  }
  return map
}

/** 学习打卡总览：累计天数、连续天数、今日新学/复习完成（按语言过滤） */
export function useCheckInStats(entityTypes: StudySession['entityType'][] = ALL_TYPES): CheckInStats {
  const sessions = useLiveQuery(
    () => db.studySessions.toArray(),
    [],
  ) ?? []
  const filtered = sessions.filter((s) => entityTypes.includes(s.entityType))
  const byDay = groupByDay(filtered)
  const dateKeys = Array.from(byDay.keys())
  const totalDays = dateKeys.length

  // 连续天数：从今天或昨天往前数连续有学习的天数
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayKey = dateKeyOf(today.getTime())
  let streak = 0
  if (byDay.has(todayKey)) {
    streak = 1
    for (let back = 1; ; back++) {
      if (byDay.has(dateKeyOf(today.getTime() - back * DAY_MS))) streak++
      else break
    }
  } else {
    // 今天还没学：从昨天开始数（昨天学了则连续保留）
    if (byDay.has(dateKeyOf(today.getTime() - DAY_MS))) {
      streak = 1
      for (let back = 2; ; back++) {
        if (byDay.has(dateKeyOf(today.getTime() - back * DAY_MS))) streak++
        else break
      }
    }
  }

  const todayEntry = byDay.get(todayKey)
  return {
    totalDays,
    streak,
    todayNewDone: todayEntry?.newDone ?? 0,
    todayReviewDone: todayEntry?.reviewDone ?? 0,
  }
}

/** 某月每天的打卡情况（dateKey → newDone/reviewDone，按语言过滤） */
export function useMonthCheckIns(
  year: number,
  month: number,
  entityTypes: StudySession['entityType'][] = ALL_TYPES
): Map<string, DayCheckIn> {
  // month 1-12
  const monthStart = new Date(year, month - 1, 1).getTime()
  const monthEnd = new Date(year, month, 1).getTime()
  const sessions = useLiveQuery(
    () =>
      db.studySessions
        .where('timestamp')
        .between(monthStart, monthEnd, true, false)
        .toArray(),
    [year, month]
  ) ?? []
  return groupByDay(sessions.filter((s) => entityTypes.includes(s.entityType)))
}
