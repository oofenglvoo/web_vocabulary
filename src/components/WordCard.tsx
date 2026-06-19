import { Heart, Trash2, Volume2 } from 'lucide-react'
import { Word } from '../types/word'
import { speakWord } from '../utils/tts'

interface WordCardProps {
  word: Word
  onClick: () => void
  onFavorite: () => void
  onDelete: () => void
}

export function WordCard({ word, onClick, onFavorite, onDelete }: WordCardProps) {
  const difficultyLabels = ['简单', '较易', '中等', '较难', '困难']
  const difficultyStyles = [
    'bg-success-50 text-success-600',
    'bg-success-50 text-success-600',
    'bg-warn-50 text-warn-600',
    'bg-orange-50 text-orange-600',
    'bg-red-50 text-red-600',
  ]
  const learnedBadge = word.isLearned === 1

  return (
    <div
      onClick={onClick}
      className="card p-4 cursor-pointer hover:shadow-glow hover:-translate-y-0.5 transition-all"
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-lg text-gray-900">{word.word}</h3>
            <button
              onClick={(e) => {
                e.stopPropagation()
                speakWord(word.word)
              }}
              className="p-1 rounded-full hover:bg-primary-50 active:scale-90 transition"
              aria-label="发音"
            >
              <Volume2 size={15} className="text-primary-500" />
            </button>
            {word.phonetic && (
              <span className="text-xs text-gray-400">{word.phonetic}</span>
            )}
            {learnedBadge && (
              <span className="chip bg-success-50 text-success-600 text-[10px]">
                已掌握
              </span>
            )}
          </div>
          {word.translation && (
            <p className="text-sm text-gray-700 mt-1 truncate font-medium">
              {word.translation}
            </p>
          )}
          {word.definition && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{word.definition}</p>
          )}
          <div className="flex items-center gap-1.5 mt-2">
            <span
              className={`chip text-[10px] ${
                difficultyStyles[word.difficulty - 1] || difficultyStyles[2]
              }`}
            >
              {difficultyLabels[word.difficulty - 1] || '中等'}
            </span>
            <span className="text-[11px] text-gray-400">{word.category}</span>
          </div>
        </div>
        <div className="flex items-center -mr-1.5 -my-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onFavorite()
            }}
            className="p-2 rounded-full hover:bg-accent-50 active:scale-90 transition"
            aria-label="收藏"
          >
            <Heart
              size={17}
              className={
                word.isFavorite
                  ? 'fill-accent-500 text-accent-500'
                  : 'text-gray-300'
              }
            />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-2 rounded-full hover:bg-red-50 active:scale-90 transition"
            aria-label="删除"
          >
            <Trash2 size={17} className="text-gray-300 hover:text-red-500" />
          </button>
        </div>
      </div>
    </div>
  )
}
