import { useEffect, useRef, useState } from 'react'
import { Check, ChevronRight, Star, Volume2, X as XIcon } from 'lucide-react'
import { StudyItem } from './types'
import { FavoriteButton } from '../FavoriteButton'

export interface QuickRating {
  item: StudyItem
  quality: number // 1=忘记, 3=记得, 5=掌握
  mastered: boolean // 是否标记为已掌握
}

interface QuickModeProps {
  items: StudyItem[]
  onRateAll: (results: QuickRating[]) => Promise<boolean> | boolean | void
  initialRatings?: Record<number, QuickRating>
  onRatingChange?: (rating: QuickRating) => void
  onSpeak: (item: StudyItem) => void
  entityType?: 'word' | 'sentence' | 'japaneseWord'
}

/** 快速自测：列表视图，所有词同时列出，点击展开释义 + 忘记/记得/掌握三选项，全部评完后统一提交 */
export function QuickMode({ items, onRateAll, initialRatings = {}, onRatingChange, onSpeak, entityType = 'word' }: QuickModeProps) {
  const [ratings, setRatings] = useState<Record<number, QuickRating>>(initialRatings)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const itemRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const autoScrollId = useRef<number | null>(null)

  const allRated = items.every((item) => ratings[item.id] !== undefined)
  const total = items.length
  const ratedCount = Object.keys(ratings).length

  const setRating = (item: StudyItem, quality: number, mastered: boolean) => {
    const rating = { item, quality, mastered }
    setRatings((prev) => ({ ...prev, [item.id]: rating }))
    onRatingChange?.(rating)
    // 三选项（忘记/记得/掌握）选完都自动收起当前词，并展开下一个未评词
    setExpanded((prevExpanded) => {
      const next = new Set(prevExpanded)
      next.delete(item.id) // 收起当前词
      // 找当前词之后第一个尚未评的词
      // （此处闭包里的 ratings 是旧值，不含本次刚评的词，所以当前词必然"已评"被跳过）
      const idx = items.findIndex((i) => i.id === item.id)
      let target: StudyItem | null = null
      const ordered = [...items.slice(idx + 1), ...items.slice(0, idx)]
      for (const candidate of ordered) {
        if (candidate.id !== item.id && ratings[candidate.id] === undefined) {
          target = candidate
          break
        }
      }
       if (target) next.add(target.id)
       if (target) autoScrollId.current = target.id
       return next
     })
   }

  // 自动展开下一项后，把"忘记/记得/掌握"操作区滚到可视区域。
  // 用按钮区而不是整卡作目标：内容长于视口时 nearest 只能把卡顶滚进来，
  // 按钮仍会被挡住；以按钮区为目标能保证可以直接开始评分。
  // 底部有固定的主导航栏，用 scroll-margin-bottom 让按钮最终停在菜单上方。
  useEffect(() => {
    const id = autoScrollId.current
    if (id === null) return
    autoScrollId.current = null
    const frame = window.requestAnimationFrame(() => {
      const target =
        document.getElementById(`quick-actions-${id}`) ?? itemRefs.current[id]
      if (!target) return
      const nav = document.querySelector('nav')
      const navHeight = nav ? nav.getBoundingClientRect().height : 0
      target.style.scrollMarginBottom = `${Math.round(navHeight + 8)}px`
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [expanded])

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSubmit = async () => {
    if (submitted || submitting) return
    setSubmitting(true)
    try {
      const success = await onRateAll(items.map((item) => ratings[item.id] ?? { item, quality: 1, mastered: false }))
      if (success !== false) setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
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
              ref={(element) => { itemRefs.current[item.id] = element }}
              className="rounded-xl border dark:border-slate-700 overflow-hidden transition-all"
            >
              <div
                role="group"
                aria-label={`${item.title} 操作`}
                className="w-full flex items-center gap-3 p-3 text-left bg-white dark:bg-slate-800"
              >
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={`quick-definition-${item.id}`}
                  onClick={() => toggleExpand(item.id)}
                  className="flex-1 min-w-0 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block min-w-0 font-medium dark:text-gray-100 break-all whitespace-normal">{item.title}</span>
                    {item.phonetic && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">{item.phonetic}</span>
                    )}
                  </span>
                  <ChevronRight
                    size={16}
                    className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => onSpeak(item)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors shrink-0"
                  aria-label="发音"
                >
                  <Volume2 size={16} />
                </button>
                <FavoriteButton entityType={entityType} entityId={item.id} title={item.title} />
                {isRated && (
                  <span className="shrink-0" aria-label={rating.quality === 1 ? '忘记' : rating.quality === 5 ? '掌握' : '记得'}>
                    {rating.quality === 1 ? (
                      <XIcon size={18} className="text-red-500" />
                    ) : rating.quality === 5 ? (
                      <Star size={18} className="text-amber-500 fill-amber-500" />
                    ) : (
                      <Check size={18} className="text-success-500" />
                    )}
                  </span>
                )}
              </div>

              {/* 展开区域：释义 + 三选项 */}
              {isExpanded && (
                <div id={`quick-definition-${item.id}`} className="px-3 pb-3 bg-gray-50 dark:bg-slate-700/40">
                  <div className="text-sm text-gray-600 dark:text-gray-300 mb-3 pt-2">
                    {item.renderDefs()}
                  </div>

                  <div id={`quick-actions-${item.id}`} className="grid grid-cols-3 gap-2">
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
          disabled={submitting}
          className="mt-4 w-full py-3 rounded-xl bg-gradient-primary text-white font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-60"
        >
          {submitting ? '提交中...' : `提交 (${total})`} {!submitting && <ChevronRight size={16} />}
        </button>
      )}
    </div>
  )
}
