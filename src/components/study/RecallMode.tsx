import { useState } from 'react'
import { CheckCircle, HelpCircle, XCircle } from 'lucide-react'
import { StudyItem } from './types'
import { FlipCard } from './FlipCard'

interface RecallModeProps {
  item: StudyItem
  onRate: (quality: number) => void
  onMaster?: () => void
  onSpeak: () => void
}

/** 回忆式：翻卡后自评「认识·模糊·忘记」 */
export function RecallMode({ item, onRate, onMaster, onSpeak }: RecallModeProps) {
  const [flipped, setFlipped] = useState(false)

  const handleFlip = () => setFlipped((f) => !f)

  return (
    <FlipCard
      item={item}
      flipped={flipped}
      onSpeak={onSpeak}
    >
      {flipped && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onRate(1)}
            className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 active:scale-95 transition-all"
          >
            <XCircle size={20} />
            <span className="text-sm font-medium">忘记</span>
          </button>
          <button
            type="button"
            onClick={() => onRate(3)}
            className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-warn-600 dark:text-warn-400 active:scale-95 transition-all"
          >
            <HelpCircle size={20} />
            <span className="text-sm font-medium">模糊</span>
          </button>
          <button
            type="button"
            onClick={() => onRate(5)}
            className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-success-600 dark:text-success-400 active:scale-95 transition-all"
          >
            <CheckCircle size={20} />
            <span className="text-sm font-medium">认识</span>
          </button>
        </div>
      )}
      {!flipped && (
        <button
          type="button"
          onClick={handleFlip}
          className="mt-4 w-full py-2.5 rounded-xl bg-gradient-primary text-white text-sm font-medium shadow-soft active:scale-95 transition-all"
        >
          翻转查看释义
        </button>
      )}
      {onMaster && (
        <button
          type="button"
          onClick={onMaster}
          className="mt-2 w-full py-2 rounded-xl border dark:border-slate-700 text-sm text-success-600 dark:text-success-400 active:scale-95 transition-all"
        >
          标记为已掌握
        </button>
      )}
    </FlipCard>
  )
}
