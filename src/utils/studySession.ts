const STUDY_SESSION_KEY = 'vocab.study.session'

function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function key(lang: string, planId: number | null) {
  return `${lang}:${planId ?? 'free'}`
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
