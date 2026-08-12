import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Volume2, CheckCircle, XCircle, RotateCcw } from 'lucide-react'
import { StudyItem } from './types'

interface ChoiceModeProps {
  item: StudyItem
  /** 干扰项(其他词的释义，不含当前词) */
  distractors: string[]
  onRate: (quality: number) => void
  onMaster?: () => void
  onSpeak: () => void
}

/** 选择题：看词选义(四选一)，答对后推进，答错重排 */
export function ChoiceMode({ item, distractors, onRate, onMaster, onSpeak }: ChoiceModeProps) {
  const [options] = useState<string[]>(() => {
    const opts = [item.primaryTranslation, ...distractors.slice(0, 3)]
    return opts.sort(() => Math.random() - 0.5)
  })
  const [selected, setSelected] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const submittedRef = useRef(false)

  const handleSelect = (option: string) => {
    if (revealed || submittedRef.current) return
    setSelected(option)
    setRevealed(true)
    const correct = option === item.primaryTranslation
    // 延迟展示结果后再回调父级推进/重排
    window.setTimeout(() => {
      if (submittedRef.current) return
      submittedRef.current = true
      onRate(correct ? 5 : 1)
    }, 900)
  }

  return (
    <div className="card flex-1 flex flex-col items-center justify-center p-6">
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-3xl font-bold text-gradient text-center break-words">{item.title}</h2>
        <button
          type="button"
          onClick={onSpeak}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors shrink-0"
          aria-label="发音"
        >
          <Volume2 size={20} />
        </button>
      </div>
      {item.phonetic && <p className="text-gray-500 dark:text-gray-400 mb-4">{item.phonetic}</p>}
      <p className="text-gray-500 dark:text-gray-400 mb-6">选择正确的中文释义</p>
      <div className="w-full max-w-sm space-y-2.5">
        {options.map((option) => {
          const isCorrect = option === item.primaryTranslation
          const isSelected = selected === option
          let btnClass =
            'w-full text-left px-4 py-3 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all'
          if (revealed) {
            if (isCorrect)
              btnClass = 'w-full text-left px-4 py-3 rounded-xl bg-gradient-success text-white shadow-glow'
            else if (isSelected)
              btnClass = 'w-full text-left px-4 py-3 rounded-xl bg-red-500 text-white'
            else btnClass = 'w-full text-left px-4 py-3 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 opacity-50'
          } else if (isSelected) {
            btnClass = 'w-full text-left px-4 py-3 rounded-xl bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700'
          }
          return (
            <motion.button
              key={option}
              onClick={() => handleSelect(option)}
              disabled={revealed}
              className={btnClass}
              whileTap={{ scale: 0.97 }}
            >
              {option}
            </motion.button>
          )
        })}
      </div>
      {revealed && selected && (
        <div className="mt-4 flex items-center gap-2 text-sm">
          {selected === item.primaryTranslation ? (
            <span className="flex items-center gap-1 text-success-600">
              <CheckCircle size={16} /> 答对了!
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-500">
              <XCircle size={16} /> 答错了,这个词将再次出现
            </span>
          )}
        </div>
      )}
      {onMaster && (
        <button
          type="button"
          onClick={onMaster}
          className="mt-4 flex items-center gap-1 px-3 py-1.5 rounded-xl border dark:border-slate-700 text-sm text-success-600 dark:text-success-400 active:scale-95 transition-all"
        >
          <RotateCcw size={14} /> 标记为已掌握
        </button>
      )}
    </div>
  )
}
