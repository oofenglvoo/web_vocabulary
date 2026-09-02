import { FormEvent, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Copy, Languages, RotateCw, X } from 'lucide-react'
import { BackButton } from '../components/BackButton'
import { useToast } from '../components/Toast'
import { translateWithMyMemory } from '../utils/translation'
import { getDefinitions } from '../utils/definitions'
import { isJaWord, type LangWord } from '../hooks/languageAware'
import { useAllWords } from '../hooks/useWords'
import { useAllJapaneseWords } from '../hooks/useJapaneseWords'
import type { JapaneseWord, Word } from '../types/word'

type SourceLang = 'en' | 'ja'

function detectSourceLang(text: string): SourceLang {
  return /[\u3040-\u30ff]/.test(text) ? 'ja' : 'en'
}

function findLocalWord(words: LangWord[], text: string): LangWord | undefined {
  const normalized = text.trim().toLocaleLowerCase()
  return words.find((word) => word.word.trim().toLocaleLowerCase() === normalized)
}

export function Translate() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { toast } = useToast()
  const englishWords = useAllWords()
  const japaneseWords = useAllJapaneseWords()
  const query = searchParams.get('q')?.trim() ?? ''
  const [input, setInput] = useState(query)
  const [translation, setTranslation] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const source = detectSourceLang(query)
  // 翻译页按输入内容选择词库，不受当前首页语言切换状态影响。
  const localWords = source === 'ja' ? japaneseWords : englishWords
  const localWord = query ? findLocalWord(localWords, query) : undefined

  const requestTranslation = async (text: string) => {
    const normalized = text.trim()
    if (!normalized) {
      setSearchParams({}, { replace: true })
      setTranslation(null)
      setError('请输入要翻译的单词或句子')
      return
    }
    setInput(normalized)
    setTranslation(null)
    setError('')
    setCopied(false)
    setLoading(true)
    try {
      setTranslation(await translateWithMyMemory(normalized, detectSourceLang(normalized)))
    } catch {
      setError('翻译失败，请检查网络后重试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setInput(query)
    setTranslation(null)
    setError('')
    setCopied(false)
    if (!query) {
      setLoading(false)
      return
    }
    void translateWithMyMemory(query, source)
      .then(setTranslation)
      .catch(() => setError('翻译失败，请检查网络后重试'))
      .finally(() => setLoading(false))
    setLoading(true)
    // Only react to a new URL query; translate() intentionally updates the same query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const normalized = input.trim()
    if (normalized === query) {
      void requestTranslation(normalized)
    } else {
      setSearchParams(normalized ? { q: normalized } : {}, { replace: true })
    }
  }

  const handleCopy = async () => {
    if (!translation) return
    try {
      await navigator.clipboard.writeText(translation)
      setCopied(true)
      toast('success', '译文已复制')
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast('error', '复制失败，请手动复制')
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <BackButton />
        <h1 className="text-xl font-bold dark:text-gray-100">在线翻译</h1>
      </div>

      <form onSubmit={handleSubmit} className="card p-4 space-y-3">
        <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
          <Languages size={18} />
          <span className="text-sm font-medium">输入英语或日语</span>
        </div>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="输入单词、短语或句子..."
          rows={5}
          maxLength={5000}
          autoFocus
          className="input-field w-full min-w-0 text-gray-900 dark:text-gray-100 resize-y min-h-28"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-400">{input.length}/5000</span>
          <div className="flex gap-2">
            {input && (
              <button type="button" onClick={() => setInput('')} className="btn-secondary px-3 py-2 text-sm gap-1">
                <X size={15} /> 清空
              </button>
            )}
            <button type="submit" disabled={loading || !input.trim()} className="btn-primary px-4 py-2 text-sm gap-1.5 disabled:opacity-50">
              {loading ? <RotateCw size={15} className="animate-spin" /> : <Languages size={15} />}
              翻译
            </button>
          </div>
        </div>
      </form>

      {(query || loading || error) && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-primary-600 dark:text-primary-400">翻译结果</h2>
              {query && <p className="text-xs text-gray-400 mt-1">已识别为：{source === 'ja' ? '日语' : '英语'}</p>}
            </div>
            {translation && (
              <button onClick={handleCopy} className="text-xs text-primary-600 dark:text-primary-400 flex items-center gap-1">
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? '已复制' : '复制译文'}
              </button>
            )}
          </div>
          {loading && <p className="text-sm text-gray-500 dark:text-gray-400">翻译中...</p>}
          {!loading && translation && <p className="text-lg whitespace-pre-wrap dark:text-gray-200">{translation}</p>}
          {!loading && error && <p className="text-sm text-red-500">{error}</p>}
          {translation && <p className="text-xs text-gray-400">在线翻译（MyMemory）</p>}
        </div>
      )}

      {localWord && <LocalWordResult word={localWord} />}
    </div>
  )
}

function LocalWordResult({ word }: { word: LangWord }) {
  const isJa = isJaWord(word)
  const englishWord = isJa ? null : word as Word
  const japaneseWord = isJa ? word as JapaneseWord : null
  const definitions = isJa ? [] : getDefinitions(englishWord!)

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-primary-600 dark:text-primary-400">本地词库匹配</h2>
        <span className="text-xs text-gray-400">已保存内容</span>
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <h3 className="text-2xl font-bold text-gradient">{word.word}</h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {isJa ? japaneseWord!.reading : englishWord!.phonetic}
          </span>
        </div>
        {isJa ? (
          <div className="mt-3 space-y-2">
            {japaneseWord!.definitions?.filter((definition) => definition.meaning || definition.translation).map((definition, index) => (
              <div key={index} className="text-sm dark:text-gray-200">
                {definition.pos && <span className="text-primary-600 dark:text-primary-400 mr-2">{definition.pos}</span>}
                {definition.meaning && <span>{definition.meaning}</span>}
                {definition.translation && <span className="text-gray-500 dark:text-gray-400 ml-2">{definition.translation}</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {definitions.filter((definition) => definition.def || definition.trans).map((definition, index) => (
              <div key={index} className="text-sm dark:text-gray-200">
                {definition.pos && <span className="text-primary-600 dark:text-primary-400 mr-2">{definition.pos}</span>}
                {definition.def && <span>{definition.def}</span>}
                {definition.trans && <span className="text-gray-500 dark:text-gray-400 ml-2">{definition.trans}</span>}
              </div>
            ))}
            {definitions.length === 0 && englishWord!.translation && <p className="text-sm dark:text-gray-200">{englishWord!.translation}</p>}
          </div>
        )}
      </div>
      {word.example && (
        <div className="rounded-xl bg-gray-50 dark:bg-slate-700/60 p-3">
          <div className="text-xs text-gray-400 mb-1">例句</div>
          <p className="text-sm dark:text-gray-200 whitespace-pre-wrap">{word.example}</p>
          {isJa && japaneseWord!.exampleTranslation && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{japaneseWord!.exampleTranslation}</p>}
        </div>
      )}
      {word.notes && (
        <div>
          <div className="text-xs text-gray-400 mb-1">笔记</div>
          <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{word.notes}</p>
        </div>
      )}
      <p className="text-xs text-gray-400">分类：{word.category}</p>
    </div>
  )
}
