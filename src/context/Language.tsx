import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react'

export type Lang = 'en' | 'ja'

const STORAGE_KEY = 'vocab.lang'

function loadLang(): Lang {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'ja' ? 'ja' : 'en'
  } catch {
    return 'en'
  }
}

// 模块级当前语言：供非 Hook 的异步数据函数在执行时读取，
// 由 Provider 在挂载与切换时保持同步（语言切换会重渲染整棵树）。
let currentLang: Lang = loadLang()

export function getCurrentLang(): Lang {
  return currentLang
}

function persistLang(lang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // 隐私模式等场景下持久化失败不影响本次会话
  }
}

interface LangContextValue {
  lang: Lang
  setLang: (next: Lang) => void
}

const LangContext = createContext<LangContextValue>({ lang: currentLang, setLang: () => {} })

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(currentLang)

  const setLang = useCallback((next: Lang) => {
    currentLang = next
    persistLang(next)
    setLangState(next)
  }, [])

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang])

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

/** 当前语言（组件内使用） */
export function useLang(): Lang {
  return useContext(LangContext).lang
}

/** 切换语言（组件内使用），切换后全应用数据源即时切换 */
export function useSetLang(): (next: Lang) => void {
  return useContext(LangContext).setLang
}

export const LANG_LABEL: Record<Lang, string> = { en: '英语', ja: '日语' }
