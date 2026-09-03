import { useEffect, useRef, useState } from 'react'
import { CheckCircle, HelpCircle, XCircle } from 'lucide-react'
import { StudyItem, StudyEntityType } from './types'
import { FlipCard } from './FlipCard'

interface RecallModeProps {
  item: StudyItem
  onRate: (quality: number) => Promise<void> | void
  onMaster?: () => void
  onSpeak: () => void
  entityType?: StudyEntityType
}

/** 回忆式(Moji)：正面=单词，点卡片翻面看释义；认识/模糊/忘记 三按钮常驻下方 */
export function RecallMode({ item, onRate, onMaster, onSpeak, entityType = 'word' }: RecallModeProps) {
  const [flipped, setFlipped] = useState(false)
  const [rating, setRating] = useState(false)
  const spokenId = useRef<number | null>(null)
  const speakRef = useRef(onSpeak)
  speakRef.current = onSpeak

  // 每个新词进入回忆式卡片时自动播放一次，手动点击发音仍可重复播放
  useEffect(() => {
    if (spokenId.current === item.id) return
    spokenId.current = item.id
    speakRef.current()
  }, [item.id])

  const handleFlip = () => {
    if (!rating) setFlipped((f) => !f)
  }

  const handleRate = async (quality: number) => {
    if (rating) return
    setRating(true)
    try {
      await onRate(quality)
    } finally {
      setRating(false)
    }
  }

  return (
    <div onClick={handleFlip} className="flex-1 flex flex-col cursor-pointer select-none">
      <FlipCard item={item} flipped={flipped} onSpeak={onSpeak} entityType={entityType}>
        {/* 自评按钮常驻（点按钮不触发翻面） */}
        <div
          className="mt-4 grid grid-cols-3 gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
               void handleRate(1)
            }}
             disabled={rating}
             className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 active:scale-95 transition-all disabled:opacity-50"
          >
            <XCircle size={20} />
            <span className="text-sm font-medium">忘记</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
               void handleRate(2)
            }}
             disabled={rating}
             className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-warn-600 dark:text-warn-400 active:scale-95 transition-all disabled:opacity-50"
          >
            <HelpCircle size={20} />
            <span className="text-sm font-medium">模糊</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
               void handleRate(5)
            }}
             disabled={rating}
             className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-success-600 dark:text-success-400 active:scale-95 transition-all disabled:opacity-50"
          >
            <CheckCircle size={20} />
            <span className="text-sm font-medium">认识</span>
          </button>
        </div>
        {onMaster && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onMaster()
            }}
            className="mt-2 w-full py-2 rounded-xl border dark:border-slate-700 text-sm text-success-600 dark:text-success-400 active:scale-95 transition-all"
          >
            标记为已掌握
          </button>
        )}
      </FlipCard>
    </div>
  )
}
