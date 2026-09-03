const STUDY_SESSION_KEY = 'vocab.study.session'
const QUICK_PROGRESS_KEY = 'vocab.study.quick-progress'
const STUDY_PROGRESS_KEY = 'vocab.study.progress'

export interface QuickProgressRating {
  quality: number
  mastered: boolean
}

export interface StudyProgressSnapshot {
  date: string
  studyType: string
  queue: { id: number; isReview: boolean }[]
  index: number
}

function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function key(lang: string, planId: number | null) {
  return `${lang}:${planId ?? 'free'}`
}

function quickProgressKey(lang: string, planId: number | null, isExtra: boolean) {
  return `${lang}:${planId ?? 'free'}:${isExtra ? 'extra' : 'normal'}`
}

function studyProgressKey(lang: string, planId: number | null, isReview: boolean, isExtra: boolean) {
  return `${lang}:${planId ?? 'free'}:${isReview ? 'review' : isExtra ? 'extra' : 'normal'}`
}

export function hasStartedStudyToday(lang: string, planId: number | null): boolean {
  try {
    const sessions = JSON.parse(localStorage.getItem(STUDY_SESSION_KEY) || '{}') as Record<string, string>
    const sessionKey = key(lang, planId)
    const isStarted = sessions[sessionKey] === today()
    if (sessions[sessionKey] && !isStarted) {
      delete sessions[sessionKey]
      localStorage.setItem(STUDY_SESSION_KEY, JSON.stringify(sessions))
    }
    return isStarted
  } catch {
    return false
  }
}

export function markStudyStartedToday(lang: string, planId: number | null) {
  try {
    const sessions = JSON.parse(localStorage.getItem(STUDY_SESSION_KEY) || '{}') as Record<string, string>
    sessions[key(lang, planId)] = today()
    localStorage.setItem(STUDY_SESSION_KEY, JSON.stringify(sessions))
  } catch {
    // Local storage may be unavailable; the current session still works.
  }
}

export function clearStudyStarted(lang: string, planId: number | null) {
  try {
    const sessions = JSON.parse(localStorage.getItem(STUDY_SESSION_KEY) || '{}') as Record<string, string>
    delete sessions[key(lang, planId)]
    localStorage.setItem(STUDY_SESSION_KEY, JSON.stringify(sessions))
  } catch {
    // Local storage may be unavailable.
  }
}

export function getQuickProgress(
  lang: string,
  planId: number | null,
  isExtra: boolean
): Record<number, QuickProgressRating> {
  try {
    const progress = JSON.parse(localStorage.getItem(QUICK_PROGRESS_KEY) || '{}') as Record<
      string,
      { date: string; ratings: Record<string, QuickProgressRating> }
    >
    const sessionKey = quickProgressKey(lang, planId, isExtra)
    const saved = progress[sessionKey]
    if (!saved || saved.date !== today()) {
      if (saved) {
        delete progress[sessionKey]
        localStorage.setItem(QUICK_PROGRESS_KEY, JSON.stringify(progress))
      }
      return {}
    }
    return Object.fromEntries(
      Object.entries(saved.ratings).map(([id, rating]) => [Number(id), rating])
    )
  } catch {
    return {}
  }
}

export function hasQuickProgressToday(lang: string, planId: number | null, isExtra: boolean): boolean {
  try {
    const progress = JSON.parse(localStorage.getItem(QUICK_PROGRESS_KEY) || '{}') as Record<
      string,
      { date: string; ratings: Record<string, QuickProgressRating> }
    >
    return progress[quickProgressKey(lang, planId, isExtra)]?.date === today()
  } catch {
    return false
  }
}

export function saveQuickProgress(
  lang: string,
  planId: number | null,
  isExtra: boolean,
  itemId: number,
  rating: QuickProgressRating
) {
  try {
    const progress = JSON.parse(localStorage.getItem(QUICK_PROGRESS_KEY) || '{}') as Record<
      string,
      { date: string; ratings: Record<string, QuickProgressRating> }
    >
    const sessionKey = quickProgressKey(lang, planId, isExtra)
    const saved = progress[sessionKey]?.date === today()
      ? progress[sessionKey]
      : { date: today(), ratings: {} }
    saved.ratings[String(itemId)] = rating
    progress[sessionKey] = saved
    localStorage.setItem(QUICK_PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    // Local storage may be unavailable; the current session still works.
  }
}

export function clearQuickProgress(lang: string, planId: number | null, isExtra: boolean) {
  try {
    const progress = JSON.parse(localStorage.getItem(QUICK_PROGRESS_KEY) || '{}') as Record<string, unknown>
    delete progress[quickProgressKey(lang, planId, isExtra)]
    localStorage.setItem(QUICK_PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    // Local storage may be unavailable.
  }
}

export function getStudyProgress(
  lang: string,
  planId: number | null,
  isReview: boolean,
  isExtra: boolean,
  studyType: string
): StudyProgressSnapshot | null {
  try {
    const progress = JSON.parse(localStorage.getItem(STUDY_PROGRESS_KEY) || '{}') as Record<string, StudyProgressSnapshot>
    const sessionKey = studyProgressKey(lang, planId, isReview, isExtra)
    const saved = progress[sessionKey]
    if (!saved || saved.date !== today() || saved.studyType !== studyType) {
      if (saved) {
        delete progress[sessionKey]
        localStorage.setItem(STUDY_PROGRESS_KEY, JSON.stringify(progress))
      }
      return null
    }
    return saved
  } catch {
    return null
  }
}

export function hasStudyProgressToday(
  lang: string,
  planId: number | null,
  isReview: boolean,
  isExtra: boolean
): boolean {
  try {
    const progress = JSON.parse(localStorage.getItem(STUDY_PROGRESS_KEY) || '{}') as Record<string, StudyProgressSnapshot>
    return progress[studyProgressKey(lang, planId, isReview, isExtra)]?.date === today()
  } catch {
    return false
  }
}

export function saveStudyProgress(
  lang: string,
  planId: number | null,
  isReview: boolean,
  isExtra: boolean,
  snapshot: Omit<StudyProgressSnapshot, 'date'>
) {
  try {
    const progress = JSON.parse(localStorage.getItem(STUDY_PROGRESS_KEY) || '{}') as Record<string, StudyProgressSnapshot>
    progress[studyProgressKey(lang, planId, isReview, isExtra)] = { date: today(), ...snapshot }
    localStorage.setItem(STUDY_PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    // Local storage may be unavailable; the current session still works.
  }
}

export function clearStudyProgress(lang: string, planId: number | null, isReview: boolean, isExtra: boolean) {
  try {
    const progress = JSON.parse(localStorage.getItem(STUDY_PROGRESS_KEY) || '{}') as Record<string, unknown>
    delete progress[studyProgressKey(lang, planId, isReview, isExtra)]
    localStorage.setItem(STUDY_PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    // Local storage may be unavailable.
  }
}
