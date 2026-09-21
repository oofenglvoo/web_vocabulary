import { BookMarked, Lightbulb, Star } from 'lucide-react'
import { SpeakButton } from './SpeakButton'
import type { DictionaryResult } from '../utils/dictionary'

/** 用于把词典结果写入词条的自定义动作；不传则不显示对应按钮 */
export interface DictionaryFillActions {
  onFillPhonetic?: (phonetic: string) => void
  onFillSense?: (sense: { pos: string; trans: string }) => void
  onFillExample?: (example: { en: string; zh: string }) => void
}

interface DictionaryPanelProps {
  result: DictionaryResult
  loading?: boolean
  error?: string
  title?: string
  fill?: DictionaryFillActions
}

const PROVIDER_LABELS: Record<DictionaryResult['provider'], string> = {
  Bing: '必应词典',
}

/** 高亮例句中的目标词（大小写不敏感，按词边界匹配） */
function highlightWord(sentence: string, word: string) {
  if (!word) return sentence
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = sentence.split(new RegExp(`(${escaped})`, 'gi'))
  return parts.map((part, index) =>
    part.toLowerCase() === word.toLowerCase() ? (
      <mark key={index} className="bg-transparent text-accent-500 dark:text-accent-400 font-medium">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

/** 词典结果展示：音标 / 释义 / 词形 / 网络释义 / 双语例句 / 短语 / 近义词 */
export function DictionaryPanel({ result, loading, error, title = '词典释义', fill }: DictionaryPanelProps) {
  const hasSenses = result.senses.length > 0
  const hasWeb = result.webDefinitions.length > 0
  const hasExamples = result.examples.length > 0
  const hasPhrases = result.phrases.length > 0
  const hasSynonyms = result.synonyms.length > 0
  const hasCollins = result.collins.length > 0
  const hasWordForms = result.wordForms.length > 0
  const hasDiscriminations = result.discriminations.length > 0
  const phonetic = (result.usPhonetic || result.ukPhonetic || '').replace(/^\/+|\/+$/g, '')

  return (
    <div className="card p-4 space-y-4" data-dictionary-panel>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
          <BookMarked size={16} />
          <h2 className="text-sm font-medium">{title}</h2>
        </div>
        <span className="text-xs text-gray-400">数据来源：{PROVIDER_LABELS[result.provider]}</span>
      </div>

      {loading && <p className="text-sm text-gray-500 dark:text-gray-400">查询中...</p>}
      {!loading && error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && !error && (
        <>
          {/* 词头：单词大字 + 美/英音标 */}
          <div className="space-y-2">
            <h3 className="text-3xl font-bold text-gradient break-all">{result.word}</h3>
            {(result.usPhonetic || result.ukPhonetic) && (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                {result.usPhonetic && (
                  <span className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                    <span className="text-xs text-gray-400">美</span>
                    <span className="font-mono">{result.usPhonetic}</span>
                    <SpeakButton text={result.word} label="播放美音" size={14} />
                  </span>
                )}
                {result.ukPhonetic && (
                  <span className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                    <span className="text-xs text-gray-400">英</span>
                    <span className="font-mono">{result.ukPhonetic}</span>
                    <SpeakButton text={result.word} label="播放英音" size={14} />
                  </span>
                )}
                {fill?.onFillPhonetic && phonetic && (
                  <button
                    type="button"
                    onClick={() => fill.onFillPhonetic!(`/${phonetic}/`)}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    填入音标
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 词性释义：每行一个词性 + 释义 */}
          {hasSenses && (
            <ul className="space-y-1.5">
              {result.senses.map((sense, index) => (
                <li key={index} className="flex items-start gap-2 text-sm" data-dictionary-sense>
                  {sense.pos && (
                    <span className="shrink-0 font-semibold text-primary-500 dark:text-primary-400 mt-0.5">
                      {sense.pos}
                    </span>
                  )}
                  <span className="flex-1 text-gray-700 dark:text-gray-200">{sense.trans}</span>
                  {fill?.onFillSense && (
                    <button
                      type="button"
                      onClick={() => fill.onFillSense!(sense)}
                      className="shrink-0 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      填入
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* 词形：词形: women */}
          {hasWordForms && (
            <div data-dictionary-forms className="text-sm">
              <span className="text-gray-400">词形：</span>
              <span className="dark:text-gray-200">
                {result.wordForms
                  .map((form) => (form.pos ? `${form.pos} ${form.word}` : form.word))
                  .join('、')}
              </span>
            </div>
          )}

          {hasCollins && (
            <div data-dictionary-collins>
              <div className="text-xs text-gray-400 mb-1.5 flex items-center gap-1">
                <Star size={12} /> 柯林斯词典
              </div>
              <div className="space-y-2.5">
                {result.collins.map((entry, index) => (
                  <div key={index} className="rounded-xl border border-gray-100 dark:border-slate-700 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      {entry.pos && (
                        <span className="text-xs font-medium text-primary-500 dark:text-primary-400">{entry.pos}</span>
                      )}
                      {entry.star > 0 && (
                        <span className="inline-flex items-center gap-0.5" aria-label={`${entry.star} 星`}>
                          {Array.from({ length: entry.star }, (_, starIndex) => (
                            <Star key={starIndex} size={11} className="text-amber-400 fill-amber-400" />
                          ))}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-200">{entry.definition}</p>
                    {entry.examples.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {entry.examples.map((example, exampleIndex) => (
                          <div key={exampleIndex}>
                            <p className="text-sm text-gray-600 dark:text-gray-300">{example.en}</p>
                            {example.zh && <p className="text-xs text-gray-500 dark:text-gray-400">{example.zh}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasWeb && (
            <div>
              <div className="text-xs text-gray-400 mb-1.5">网络释义</div>
              <div className="space-y-2" data-dictionary-web>
                {result.webDefinitions.map((item, index) => (
                  <div key={index} className="text-sm">
                    <span className="font-medium dark:text-gray-200">{item.value}</span>
                    {item.example && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{item.example}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 双语例句：编号列表，例句中高亮目标词 */}
          {hasExamples && (
            <div>
              <div className="text-xs text-gray-400 mb-2">双语例句</div>
              <ol className="space-y-3">
                {result.examples.map((example, index) => (
                  <li key={index} className="flex gap-2.5" data-dictionary-example>
                    <span className="shrink-0 text-sm text-gray-400 tabular-nums">{index + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-1.5">
                        <SpeakButton text={example.en} lang="en" label="播放例句" size={14} className="mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-100">
                            {highlightWord(example.en, result.word)}
                          </p>
                          {example.zh && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                              {highlightWord(example.zh, result.word)}
                            </p>
                          )}
                          <div className="flex items-center justify-between gap-2 mt-1.5">
                            <span className="text-xs text-gray-400 truncate">{example.source ?? ''}</span>
                            {fill?.onFillExample && (
                              <button
                                type="button"
                                onClick={() => fill.onFillExample!({ en: example.en, zh: example.zh })}
                                className="shrink-0 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                              >
                                设为例句
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {hasPhrases && (
            <div>
              <div className="text-xs text-gray-400 mb-1.5">短语</div>
              <div className="space-y-1.5">
                {result.phrases.map((item, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <span className="shrink-0 font-medium text-primary-500 dark:text-primary-400">{item.phrase}</span>
                    <span className="flex-1 text-gray-600 dark:text-gray-300">{item.trans}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasDiscriminations && (
            <div data-dictionary-discrimination>
              <div className="text-xs text-gray-400 mb-1.5">近义词辨析</div>
              <div className="space-y-2">
                {result.discriminations.map((item, index) => (
                  <div key={index} className="text-sm">
                    <span className="font-medium text-primary-500 dark:text-primary-400">{item.headword}</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.usage}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasSynonyms && (
            <div>
              <div className="text-xs text-gray-400 mb-1.5 flex items-center gap-1">
                <Lightbulb size={12} /> 近义词
              </div>
              <div className="flex flex-wrap gap-1.5" data-dictionary-synonyms>
                {result.synonyms.map((synonym) => (
                  <span
                    key={synonym}
                    className="inline-block px-2.5 py-1 rounded-full text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300"
                  >
                    {synonym}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!hasSenses && !hasWeb && !hasExamples && !hasPhrases && !hasSynonyms && !hasCollins && !hasWordForms && !hasDiscriminations && !result.usPhonetic && !result.ukPhonetic && (
            <p className="text-sm text-gray-500 dark:text-gray-400">未找到该词的词典释义</p>
          )}
        </>
      )}
    </div>
  )
}
