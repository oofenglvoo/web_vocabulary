import { useState, useEffect, useRef } from 'react'
import { Check, ChevronRight, Star, Volume2, X as XIcon } from 'lucide-react'
import { StudyItem } from './types'

export interface QuickRating {
  item: StudyItem
  quality: number // 1=忘记, 3=记得, 5=掌握
  mastered: boolean // 是否标记为已掌握
}

interface QuickModeProps {
  items: StudyItem[]
  onRateAll: (results: QuickRating[]) => void
  onSpeak: (item: StudyItem) => void
}

/** 快速自测：列表视图，所有词同时列出，点击展开释义 + 忘记/记得/掌握三选项，全部评完后统一提交 */
export function QuickMode({ items, onRateAll, onSpeak }: QuickModeProps) {
  const [ratings, setRatings] = useState<Record<number, QuickRating>>({})
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [submitted, setSubmitted] = useState(false)

  const allRated = items.every((item) => ratings[item.id] !== undefined)
  const total = items.length
  const ratedCount = Object.keys(ratings).length

  const setRating = (item: StudyItem, quality: number, mastered: boolean) => {
    setRatings((prev) => ({ ...prev, [item.id]: { item, quality, mastered } }))
  }

  // 若手动收起导致没有展开任何词，自动展开第一个未评词
  const prevRatedCount = useRef(0)
  useEffect(() => {
    if (prevRatedCount.current === 0 && ratedCount === 0) return
    prevRatedCount.current = ratedCount
  }, [ratedCount])

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSubmit = () => {
    if (submitted) return
    setSubmitted(true)
    onRateAll(items.map((item) => ratings[item.id] ?? { item, quality: 1, mastered: false }))
  }

  return (
    <div className="card flex-1 flex flex-col p-4 overflow-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg dark:text-gray-100">快速自测</h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {ratedCount} / {total}
        </span>
      </div>

      <div className="space-y-2 flex-1 overflow-auto">
        {items.map((item) => {
          const isExpanded = expanded.has(item.id)
          const rating = ratings[item.id]
          const isRated = rating !== undefined

          return (
            <div
              key={item.id}
              className="rounded-xl border dark:border-slate-700 overflow-hidden transition-all"
            >
              <button
                type="button"
                onClick={() => toggleExpand(item.id)}
                className="w-full flex items-center gap-3 p-3 text-left bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="flex-1 min-w-0">
                  <span className="font-medium dark:text-gray-100">{item.title}</span>
                  {item.phonetic && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">{item.phonetic}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSpeak(item)
                  }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors shrink-0"
                  aria-label="发音"
                >
                  <Volume2 size={16} className="text-gray-400" />
                </button>
                {/* 已评状态图标 */}
                {isRated && (
                  <span className="shrink-0">
                    {rating.quality === 1 ? (
                      <XIcon size={18} className="text-red-500" />
                    ) : rating.quality === 5 ? (
                      <Star size={18} className="text-amber-500 fill-amber-500" />
                    ) : (
                      <Check size={18} className="text-success-500" />
                    )}
                  </span>
                )}
                <ChevronRight
                  size={16}
                  className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                />
              </button>

              {/* 展开区域：释义 + 三选项 */}
              {isExpanded && (
                <div className="px-3 pb-3 bg-gray-50 dark:bg-slate-700/40">
                  <div className="text-sm text-gray-600 dark:text-gray-300 mb-3 pt-2">
                    {item.renderDefs()}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setRating(item, 1, false)
                      }}
                      className={`flex flex-col items-center gap-1 py-2 rounded-xl text-sm font-medium transition-all ${
                        isRated && rating.quality === 1
                          ? 'bg-red-500 text-white shadow-glow'
                          : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50'
                      }`}
                    >
                      <XIcon size={16} />
                      忘记
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setRating(item, 3, false)
                      }}
                      className={`flex flex-col items-center gap-1 py-2 rounded-xl text-sm font-medium transition-all ${
                        isRated && rating.quality === 3
                          ? 'bg-success-500 text-white shadow-glow'
                          : 'bg-emerald-50 dark:bg-emerald-900/30 text-success-600 dark:text-success-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                      }`}
                    >
                      <Check size={16} />
                      记得
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setRating(item, 5, true)
                      }}
                      className={`flex flex-col items-center gap-1 py-2 rounded-xl text-sm font-medium transition-all ${
                        isRated && rating.quality === 5
                          ? 'bg-amber-500 text-white shadow-glow'
                          : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                      }`}
                    >
                      <Star size={16} />
                      掌握
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 提交按钮 */}
      {allRated && !submitted && (
        <button
          type="button"
          onClick={handleSubmit}
          className="mt-4 w-full py-3 rounded-xl bg-gradient-primary text-white font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-all"
        >
          提交 ({total}) <ChevronRight size={16} />
        </button>
      )}
    </div>
  )
}