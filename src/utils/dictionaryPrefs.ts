// 词典偏好：是否在英语单词详情页自动展开必应词典
const AUTO_KEY = 'vocab.autolookup'

export function getAutoLookup(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(AUTO_KEY) === '1'
  } catch {
    return false
  }
}

export function setAutoLookup(value: boolean) {
  try {
    localStorage.setItem(AUTO_KEY, value ? '1' : '0')
  } catch {
    // localStorage 不可用时静默失败，不影响本次操作
  }
}
