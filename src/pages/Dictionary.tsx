import { FormEvent, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookMarked, RotateCw, Search, X } from 'lucide-react'
import { BackButton } from '../components/BackButton'
import { DictionaryPanel } from '../components/DictionaryPanel'
import { emptyDictionaryResult, lookupDictionary, type DictionaryResult } from '../utils/dictionary'

export function Dictionary() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q')?.trim() ?? ''
  const [input, setInput] = useState(query)
  const [result, setResult] = useState<DictionaryResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setInput(query)
    if (!query) {
      setResult(null)
      setError('')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    setResult(null)
    void lookupDictionary(query)
      .then((data) => {
        if (!cancelled) setResult(data)
      })
      .catch(() => {
        if (!cancelled) setError('未找到该词的词典释义，请检查拼写或网络后重试')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [query])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const normalized = input.trim()
    setSearchParams(normalized ? { q: normalized } : {}, { replace: true })
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <BackButton />
        <h1 className="text-xl font-bold dark:text-gray-100">在线词典</h1>
      </div>

      <form onSubmit={handleSubmit} className="card p-4 space-y-3">
        <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
          <BookMarked size={18} />
          <span className="text-sm font-medium">查询英语单词</span>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="输入单词，如 adequate"
              autoFocus
              className="input-field w-full min-w-0 pl-9"
              aria-label="词典查询内容"
            />
          </div>
          {input && (
            <button
              type="button"
              onClick={() => setInput('')}
              className="btn-secondary px-3 py-2 text-sm gap-1 shrink-0"
            >
              <X size={15} /> 清空
            </button>
          )}
          <button type="submit" disabled={loading || !input.trim()} className="btn-primary px-4 py-2 text-sm gap-1.5 shrink-0 disabled:opacity-50">
            {loading ? <RotateCw size={15} className="animate-spin" /> : <Search size={15} />}
            查询
          </button>
        </div>
        <p className="text-xs text-gray-400">音标、词性释义、词形、网络释义与双语例句来自必应词典，仅支持单个英文单词。</p>
      </form>

      {query && !loading && !error && result && (
        <DictionaryPanel result={result} />
      )}

      {query && (loading || error) && (
        <DictionaryPanel
          result={emptyDictionaryResult(query)}
          loading={loading}
          error={error}
        />
      )}

      {!query && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
          输入一个英文单词，查看音标、词性释义、词形、网络释义与双语例句。
        </p>
      )}
    </div>
  )
}
