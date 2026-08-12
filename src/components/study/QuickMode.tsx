import { useState } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import { StudyItem } from './types'
import { FlipCard } from './FlipCard'

export interface QuickRating {
  item: StudyItem
  quality: number // 认识=3(推进周期), 忘记=1(停留)
}

interface QuickModeProps {
  items: StudyItem[]
  onRateAll: (results: QuickRating[]) => void
  onSpeak: (item: StudyItem) => void
}

/** 快速自测：逐条翻卡，全部看完后一次性提交（每条默认"认识"，可点按改为"忘记"） */
export function QuickMode({ items, onRateAll, onSpeak }: QuickModeProps) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(false)
  const [ratings, setRatings] = useState<Record<number, number>>({})

  const current = items[index]
  const isLast = index === items.length - 1

  const handleFlip = () => setFlipped((f) => !f)

  const next = () => {
    if (isLast) {
      setDone(true)
    } else {
      setIndex((i) => i + 1)
      setFlipped(false)
    }
  }

  // 完成页：逐条点按切换 认识/忘记，然后批量提交
  if (done) {
    return (
      <div className="card flex-1 flex flex-col p-5 overflow-auto">
        <h3 className="font-bold text-lg mb-3 dark:text-gray-100">已全部看完，确认掌握情况</h3>
        <div className="space-y-2 flex-1 overflow-auto">
          {items.map((item) => {
            const quality = ratings[item.id] ?? 3 // 默认认识
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setRatings((r) => ({ ...r, [item.id]: quality === 3 ? 1 : 3 }))}
                className={`w-full flex items-center gap-2 p-3 rounded-xl border text-left transition-colors ${
                  quality === 3
                    ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800'
                    : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'
                }`}
              >
                <span className="flex-1 min-w-0">
                  <span className="block font-medium truncate dark:text-gray-100">{item.title}</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
                    {item.primaryTranslation}
                  </span>
                </span>
                <span className="text-xs shrink-0 flex items-center gap-1">
                  {quality === 3 ? (
                    <>
                      <Check size={14} className="text-success-600" /> 认识
                    </>
                  ) : (
                    <>
                      <XCircleIcon /> 忘记
                    </>
                  )}
                </span>
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() =>
            onRateAll(items.map((item) => ({ item, quality: ratings[item.id] ?? 3 })))
          }
          className="mt-4 w-full py-3 rounded-xl bg-gradient-primary text-white font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-all"
        >
          提交 ({items.length}) <ChevronRight size={16} />
        </button>
      </div>
    )
  }

  return (
    <FlipCard item={current} flipped={flipped} onSpeak={() => onSpeak(current)}>
      <button
        type="button"
        onClick={handleFlip}
        className="mt-4 w-full py-2.5 rounded-xl bg-gradient-primary text-white text-sm font-medium shadow-soft active:scale-95 transition-all"
      >
        {flipped ? '收起释义' : '翻转查看释义'}
      </button>
      <button
        type="button"
        onClick={next}
        className="mt-2 w-full py-2.5 rounded-xl border dark:border-slate-700 text-sm font-medium dark:text-gray-200 active:scale-95 transition-all"
      >
        {isLast ? '完成本轮' : `下一张 (${index + 1} / ${items.length})`}
      </button>
      <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
        逐条翻卡浏览，全部看完后一次性提交掌握情况
      </p>
    </FlipCard>
  )
}

function XCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  )
}
