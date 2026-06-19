export interface Word {
  id?: number
  word: string
  phonetic: string
  definition: string
  example: string
  translation: string
  category: string
  difficulty: number
  createdAt: number
  lastReviewedAt: number
  reviewCount: number
  correctCount: number
  streak: number
  easeFactor: number
  interval: number
  nextReviewAt: number
  isLearned: number
  isFavorite: number
  notes: string
}

export interface Category {
  id?: number
  name: string
  description: string
  color: string
  wordCount: number
  createdAt: number
}

export interface StudySession {
  id?: number
  wordId: number
  mode: string
  result: string
  durationMs: number
  timestamp: number
}

export type StudyMode = 'flashcard' | 'quiz' | 'spelling'

// 学习计划
// 来源:从某个分类、收藏夹或全部单词中,按每日新词数 + 复习数,直至全部掌握
export type PlanSource =
  | { kind: 'category'; category: string }
  | { kind: 'favorites' }
  | { kind: 'all' }

export interface StudyPlan {
  id?: number
  name: string
  // 来源类型与对应参数
  sourceKind: 'category' | 'favorites' | 'all'
  sourceCategory: string // 仅 sourceKind === 'category' 时有意义
  // 每日学习目标
  newPerDay: number // 每日新学单词数
  reviewPerDay: number // 每日复习单词数上限
  // 计划纳入的单词 ID 池(创建计划时根据 source 快照确定)
  wordIds: number[]
  // 已"开始学习过"的单词 ID(从 wordIds 中按 newPerDay 推送)
  startedIds: number[]
  // 状态
  isActive: number // 1 当前激活的计划(全局只允许一个),0 否
  isArchived: number // 1 已归档(完成或手动归档)
  createdAt: number
  // 当日完成进度跟踪 (yyyy-mm-dd)
  todayDate: string
  todayNewDone: number
  todayReviewDone: number
}
