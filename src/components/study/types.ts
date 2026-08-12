import { ReactNode } from 'react'

/** 学习会话中的一个词条（单词或短句的统一抽象） */
export interface StudyItem {
  id: number
  isReview: boolean
  title: string // 主词面（单词或短句）
  phonetic?: string
  primaryTranslation: string // 用于选择题
  renderDefs: () => ReactNode // 释义区 JSX
}
