// 在线翻译偏好：是否在英语单词详情页自动翻译
export interface TranslationPrefs {
  autoTranslate: boolean
}

const AUTO_KEY = 'vocab.autotranslate'

export function getAutoTranslate(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(AUTO_KEY) === '1'
  } catch {
    return false
  }
}

export function setAutoTranslate(value: boolean) {
  try {
    localStorage.setItem(AUTO_KEY, value ? '1' : '0')
  } catch {
    // localStorage 不可用时静默失败，不影响本次操作
  }
}
