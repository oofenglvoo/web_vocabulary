// 成就勋章系统：本地计算解锁状态，存 localStorage

export interface Achievement {
  id: string
  title: string
  icon: string // emoji
  desc: string
  test: (stats: AchievementStats) => boolean
}

export interface AchievementStats {
  totalSessions: number // 累计学习次数
  totalDays: number // 累计打卡天数
  streak: number // 连续天数
  totalLearned: number // 已掌握（单词+短句）
  totalPlans: number // 创建的计划数
}

export const ACHIEVEMENTS: Achievement[] = [
  // 累计学习次数
  { id: 'sessions-100', title: '初出茅庐', icon: '🌱', desc: '累计学习 100 次', test: (s) => s.totalSessions >= 100 },
  { id: 'sessions-500', title: '渐入佳境', icon: '🚀', desc: '累计学习 500 次', test: (s) => s.totalSessions >= 500 },
  { id: 'sessions-1000', title: '坚持之星', icon: '⭐', desc: '累计学习 1000 次', test: (s) => s.totalSessions >= 1000 },
  { id: 'sessions-2000', title: '词汇达人', icon: '💎', desc: '累计学习 2000 次', test: (s) => s.totalSessions >= 2000 },
  { id: 'sessions-5000', title: '词汇大师', icon: '👑', desc: '累计学习 5000 次', test: (s) => s.totalSessions >= 5000 },
  // 连续天数
  { id: 'streak-7', title: '七日之约', icon: '🔥', desc: '连续学习 7 天', test: (s) => s.streak >= 7 },
  { id: 'streak-30', title: '月度坚持', icon: '📅', desc: '连续学习 30 天', test: (s) => s.streak >= 30 },
  { id: 'streak-100', title: '百日打卡', icon: '🏆', desc: '连续学习 100 天', test: (s) => s.streak >= 100 },
  // 已掌握
  { id: 'learned-50', title: '小有所成', icon: '📗', desc: '掌握 50 个词条', test: (s) => s.totalLearned >= 50 },
  { id: 'learned-200', title: '学富五车', icon: '📚', desc: '掌握 200 个词条', test: (s) => s.totalLearned >= 200 },
  { id: 'learned-1000', title: '博闻强识', icon: '🏛️', desc: '掌握 1000 个词条', test: (s) => s.totalLearned >= 1000 },
  // 学习计划
  { id: 'plan-1', title: '计划启动', icon: '🗺️', desc: '创建第一个学习计划', test: (s) => s.totalPlans >= 1 },
  { id: 'plan-3', title: '规划大师', icon: '🧭', desc: '创建 3 个学习计划', test: (s) => s.totalPlans >= 3 },
]

const KEY = 'vocab.achievements'

export function getUnlocked(): string[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

/**
 * 根据最新统计检查解锁。返回本次新解锁的勋章列表（已写入 localStorage）。
 * 注意：totalSessions 等统计需在打卡/学习后最新值传入。
 */
export function checkAchievements(stats: AchievementStats): Achievement[] {
  const unlocked = new Set(getUnlocked())
  const newly: Achievement[] = []
  for (const a of ACHIEVEMENTS) {
    if (!unlocked.has(a.id) && a.test(stats)) {
      unlocked.add(a.id)
      newly.push(a)
    }
  }
  if (newly.length > 0) {
    localStorage.setItem(KEY, JSON.stringify(Array.from(unlocked)))
  }
  return newly
}
