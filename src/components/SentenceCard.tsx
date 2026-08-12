import { memo } from 'react'
import { Heart, Trash2, Volume2 } from 'lucide-react'
import { Sentence } from '../types/word'
import { speakWord } from '../utils/tts'
import { getSentenceDefinitions, getSentencePrimaryTranslation } from '../utils/definitions'

interface SentenceCardProps {
  sentence: Sentence
  onClick: () => void
  onFavorite: () => void
  onDelete: () => void
}

export const SentenceCard = memo(function SentenceCard({
  sentence,
  onClick,
  onFavorite,
  onDelete,
}: SentenceCardProps) {
  const difficultyLabels = ['简单', '较易', '中等', '较难', '困难']
  const difficultyStyles = [
    'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  ]
  const learnedBadge = sentence.isLearned === 1
  const defs = getSentenceDefinitions(sentence)
  const primaryTrans = getSentencePrimaryTranslation(sentence)

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      role="button"
      tabIndex={0}
      className="card p-4 cursor-pointer hover:shadow-glow hover:-translate-y-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 leading-snug">
              {sentence.sentence}
            </h3>
            <button
              onClick={(e) => {
                e.stopPropagation()
                speakWord(sentence.sentence)
              }}
              className="p-1 rounded-full hover:bg-primary-50 active:scale-90 transition dark:hover:bg-primary-900/30"
              aria-label="发音"
            >
              <Volume2 size={15} className="text-primary-500 dark:text-primary-400" />
            </button>
            {learnedBadge && (
              <span className="chip bg-emerald-50 text-emerald-600 text-[10px] dark:bg-emerald-900/30 dark:text-emerald-400">
                已掌握
              </span>
            )}
          </div>
          {/* 多释义展示 */}
          {defs.length > 0 ? (
            <div className="mt-1 space-y-0.5">
              {defs.slice(0, 3).map((d, i) => (
                <p key={i} className="text-sm text-gray-700 dark:text-gray-300 truncate">
                  {d.pos && <span className="text-primary-500 dark:text-primary-400 font-medium mr-1">{d.pos}</span>}
                  {d.trans && <span className="font-medium">{d.trans}</span>}
                  {d.trans && d.def && <span className="text-gray-400 dark:text-gray-500 mx-1">·</span>}
                  {d.def && <span className="text-xs text-gray-500 dark:text-gray-400">{d.def}</span>}
                </p>
              ))}
              {defs.length > 3 && (
                <p className="text-xs text-gray-400 dark:text-gray-500">+{defs.length - 3} 更多释义</p>
              )}
            </div>
          ) : (
            primaryTrans && (
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 truncate font-medium">
                {primaryTrans}
              </p>
            )
          )}
          <div className="flex items-center gap-1.5 mt-2">
            <span
              className={`chip text-[10px] ${
                difficultyStyles[sentence.difficulty - 1] || difficultyStyles[2]
              }`}
            >
              {difficultyLabels[sentence.difficulty - 1] || '中等'}
            </span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">{sentence.category}</span>
          </div>
        </div>
        <div className="flex items-center -mr-1.5 -my-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onFavorite()
            }}
            className="p-2 rounded-full hover:bg-pink-50 active:scale-90 transition dark:hover:bg-pink-900/20"
            aria-label="收藏"
          >
            <Heart
              size={17}
              className={
                sentence.isFavorite
                  ? 'fill-pink-500 text-pink-500'
                  : 'text-gray-300 dark:text-gray-600'
              }
            />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-2 rounded-full hover:bg-red-50 active:scale-90 transition dark:hover:bg-red-900/20"
            aria-label="删除"
          >
            <Trash2 size={17} className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400" />
          </button>
        </div>
      </div>
    </div>
  )
})
