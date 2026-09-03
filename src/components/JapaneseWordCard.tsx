import { memo } from 'react'
import { Heart, StickyNote, Trash2, Volume2 } from 'lucide-react'
import { JapaneseWord } from '../types/word'
import { speakWord } from '../utils/tts'

interface JapaneseWordCardProps {
  word: JapaneseWord
  onClick: () => void
  onFavorite: () => void
  onDelete: () => void
}

/** 日语词条卡片：与 WordCard 同构，读音/假名/音调槽位替换英语特有字段 */
export const JapaneseWordCard = memo(function JapaneseWordCard({ word, onClick, onFavorite, onDelete }: JapaneseWordCardProps) {
  const primary = word.definitions?.[0]
  const learnedBadge = word.isLearned === 1

  return (
    <div
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
      role="button"
      tabIndex={0}
      className="card p-4 cursor-pointer hover:shadow-glow hover:-translate-y-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
    >
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h2 className="font-bold text-lg text-gray-900 dark:text-gray-100">{word.word}</h2>
            <button
              onClick={(event) => {
                event.stopPropagation()
                speakWord(word.word, { lang: 'ja' })
              }}
              className="p-1 rounded-full hover:bg-primary-50 active:scale-90 transition dark:hover:bg-primary-900/30"
              aria-label="发音"
            >
              <Volume2 size={15} className="text-primary-500 dark:text-primary-400" />
            </button>
            {word.reading && <span className="text-xs text-gray-400 dark:text-gray-500">{word.reading}</span>}
            {learnedBadge && (
              <span className="chip bg-emerald-50 text-emerald-600 text-[10px] dark:bg-emerald-900/30 dark:text-emerald-400">
                已掌握
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 truncate">
            {primary ? [primary.pos || word.partOfSpeech, primary.translation, primary.meaning].filter(Boolean).join(' ') : '暂无释义'}
          </p>
          {word.notes && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
              <StickyNote size={11} className="shrink-0" /> {word.notes}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            {word.accent && <span className="chip bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">{word.accent}</span>}
            {word.category && <span>{word.category}</span>}
          </div>
        </div>
        <div className="flex items-center -mr-1.5 -my-1">
          <button
            onClick={(event) => {
              event.stopPropagation()
              onFavorite()
            }}
              className="p-2 rounded-full hover:bg-accent-50 active:scale-90 transition dark:hover:bg-accent-900/20"
            aria-label="收藏"
          >
            <Heart
              size={17}
              className={
                word.isFavorite
                  ? 'fill-accent-500 text-accent-500'
                  : 'text-gray-300 dark:text-gray-600'
              }
            />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation()
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
