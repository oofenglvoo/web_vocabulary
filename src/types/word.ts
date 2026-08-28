// 单个释义条目：词性 + 英文释义 + 中文翻译
export interface Definition {
  pos: string   // 词性缩写，如 n. / v. / adj. 等
  def: string   // 英文释义
  trans: string // 中文翻译
}

// IndexedDB 只能索引 number，布尔用 0|1 表示并收紧类型，避免任意 number 漏过类型检查
export type Flag = 0 | 1

export interface Word {
  id?: number
  word: string
  phonetic: string
  // 旧字段（向前兼容）：单个释义
  definition: string
  translation: string
  // 新字段：多个释义
  definitions: Definition[]
  example: string
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
  // 艾宾浩斯 7 周期制:0=未学, 1-6=学习中周期, 7=已掌握；stageProgress=当前周期内连续答对数
  srsStage: number
  stageProgress: number
  isLearned: Flag
  isFavorite: Flag
  notes: string
}

// 短句/短语:与单词平行的独立实体,复用 SRS 复习字段
export interface Sentence {
  id?: number
  sentence: string // 英文短句/短语
  translation: string // 中文翻译（向前兼容）
  // 新字段：多个释义
  definitions: Definition[]
  example: string // 可选:用法说明/语境
  category: string // 复用 Category(按 name 关联,与 Word 一致)
  difficulty: number // 1-5
  createdAt: number
  lastReviewedAt: number
  reviewCount: number
  correctCount: number
  streak: number
  easeFactor: number
  interval: number
  nextReviewAt: number
  // 艾宾浩斯 7 周期制:0=未学, 1-6=学习中周期, 7=已掌握；stageProgress=当前周期内连续答对数
  srsStage: number
  stageProgress: number
  isLearned: Flag
  isFavorite: Flag
  notes: string
}

// 日语释义条目：保留词性、日文释义与中文翻译，便于日语词条独立展示
export interface JapaneseDefinition {
  pos: string
  meaning: string
  translation: string
}

// 日语词条：读音只保存假名，不使用罗马字。
export interface JapaneseWord {
  id?: number
  word: string
  reading: string
  definitions: JapaneseDefinition[]
  partOfSpeech: string
  jlptLevel: string
  textbook: string
  example: string
  exampleReading: string
  exampleTranslation: string
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
  srsStage: number
  stageProgress: number
  isLearned: Flag
  isFavorite: Flag
  notes: string
}

export interface Category {
  id?: number
  name: string
  description: string
  color: string
  wordCount: number
  createdAt: number
  /**
   * 分类内容类型：新建时选定；旧数据由迁移按内容推断。
   * undefined = 未定型（空分类，首次写入时锁定）或旧混合数据（锁定新增）。
   */
  entityType?: 'word' | 'sentence'
  /**
   * 语言归属：'en'=英语词/短句，'ja'=日语词条。
   * undefined 视为 'en'（v14 迁移按内容补标）。
   */
  lang?: 'en' | 'ja'
}

// 复习结果与模式：收紧为字面量联合，避免脏数据 / 拼写错误静默通过
export type StudyResult = 'correct' | 'hint' | 'incorrect' | 'mastered'
export type StudySessionMode = StudyMode | 'mark-learned'
// 新学 vs 复习（打卡双圈与统计区分用）
export type StudyKind = 'new' | 'review'

// 收藏夹：多目录收藏。旧版 isFavorite 标志保留为"属于至少一个夹"的派生值
export interface FavoriteFolder {
  id?: number
  name: string
  color: string
  createdAt: number
}

// 收藏条目：word/sentence 与收藏夹的多对多关系行
export interface FavoriteItem {
  id?: number
  folderId: number
  entityType: 'word' | 'sentence' | 'japaneseWord'
  entityId: number
  createdAt: number
}

export interface JapaneseFavoriteFolder {
  id?: number
  name: string
  color: string
  createdAt: number
}

export interface JapaneseFavoriteItem {
  id?: number
  folderId: number
  entityType: 'japaneseWord'
  entityId: number
  createdAt: number
}

export interface StudySession {
  id?: number
  /** 旧字段，保留用于读取旧数据库记录；新记录使用 entityId/entityType。 */
  wordId?: number
  entityId: number
  entityType: 'word' | 'sentence' | 'japaneseWord'
  mode: StudySessionMode
  result: StudyResult
  durationMs: number
  timestamp: number
  kind: StudyKind
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
  // 计划实体类型:单词 or 短句。旧记录无此字段时视为 'word'(向前兼容)
  entityType?: 'word' | 'sentence'
  // 来源类型与对应参数
  sourceKind: 'category' | 'favorites' | 'all'
  sourceCategory: string // 仅 sourceKind === 'category' 时有意义
  // 每日学习目标
  newPerDay: number // 每日新学数量
  reviewPerDay: number // 每日复习数量上限
  // 计划纳入的 ID 池(创建计划时根据 source 快照确定)
  // entityType='word' 时为 wordIds, 'sentence' 时为 sentenceIds
  wordIds: number[]
  // 已"开始学习过"的 ID(从 wordIds 中按 newPerDay 推送)
  startedIds: number[]
  // 状态
  isActive: Flag // 1 当前激活的计划(单词/短句各自全局只允许一个),0 否
  isArchived: Flag // 1 已归档(完成或手动归档)
  createdAt: number
  // 当日完成进度跟踪 (yyyy-mm-dd)
  todayDate: string
  todayNewDone: number
  todayReviewDone: number
  // 今日加学完成数(学满配额后的额外学习,不计入 todayNewDone,但统计显示叠加)
  todayExtraDone: number
}

export interface JapaneseStudyPlan {
  id?: number
  name: string
  sourceKind: 'category' | 'favorites' | 'all'
  sourceCategory: string
  newPerDay: number
  reviewPerDay: number
  wordIds: number[]
  startedIds: number[]
  isActive: Flag
  isArchived: Flag
  createdAt: number
  todayDate: string
  todayNewDone: number
  todayReviewDone: number
  todayExtraDone: number
}
