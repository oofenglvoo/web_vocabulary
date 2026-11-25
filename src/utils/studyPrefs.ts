// 学习题型配置（复刻 Moji：新学/复习分开配置题型）
export type StudyType = 'recall' | 'choice' | 'quick'

export interface StudyPrefs {
  newType: StudyType
  reviewType: StudyType
}

const PREFS_KEY = 'vocab.study.prefs'

const DEFAULT_PREFS: StudyPrefs = { newType: 'recall', reviewType: 'recall' }

export function getStudyPrefs(): StudyPrefs {
  if (typeof localStorage === 'undefined') return DEFAULT_PREFS
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<StudyPrefs>
    return {
      newType: parsed.newType === 'choice' || parsed.newType === 'quick' ? parsed.newType : DEFAULT_PREFS.newType,
      reviewType: parsed.reviewType === 'choice' || parsed.reviewType === 'quick' ? parsed.reviewType : DEFAULT_PREFS.reviewType,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function setStudyType(target: 'newType' | 'reviewType', type: StudyType) {
  const prefs = getStudyPrefs()
  prefs[target] = type
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

/** 根据新学/复习取当前题型 */
export function getStudyType(isReview: boolean): StudyType {
  const prefs = getStudyPrefs()
  return isReview ? prefs.reviewType : prefs.newType
}

/** 校验任意值是否为合法题型（旧备份/脏数据可能带非法值） */
export function isStudyType(value: unknown): value is StudyType {
  return value === 'recall' || value === 'choice' || value === 'quick'
}

/**
 * 取本次学习实际生效的题型：计划级配置优先，未配置则回退全局。
 * 仅单词/日语计划会带这两个字段；自由学习(plan 为空)与短句学习走全局。
 */
export function resolveStudyType(
  isReview: boolean,
  plan?: { newType?: StudyType; reviewType?: StudyType } | null
): StudyType {
  const planType = isReview ? plan?.reviewType : plan?.newType
  return isStudyType(planType) ? planType : getStudyType(isReview)
}

export const STUDY_TYPE_LABEL: Record<StudyType, string> = {
  recall: '回忆式',
  choice: '选择题',
  quick: '快速自测',
}
