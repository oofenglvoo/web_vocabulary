import { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Volume2 } from 'lucide-react'
import { StudyItem } from './types'

interface FlipCardProps {
  item: StudyItem
  flipped: boolean
  onSpeak: () => void
  children?: ReactNode // 翻面后的附加内容（如自评按钮）
}

/** 正面=词面(单词/短句+发音)，背面=释义；统一翻转卡片 */
export function FlipCard({ item, flipped, onSpeak, children }: FlipCardProps) {
  return (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="card flex-1 flex flex-col p-6 overflow-auto"
      style={{ perspective: '1000px' }}
    >
      <AnimatePresence mode="wait">
        {!flipped ? (
          <motion.div
            key="front"
            initial={{ rotateY: -90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: 90, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="flex items-center justify-center gap-3 mb-2">
              <h2 className="text-3xl font-bold text-gradient text-center break-words">
                {item.title}
              </h2>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onSpeak()
                }}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors shrink-0"
                aria-label="发音"
              >
                <Volume2 size={22} />
              </button>
            </div>
            {item.phonetic && (
              <p className="text-gray-500 dark:text-gray-400 text-base text-center mb-4">{item.phonetic}</p>
            )}

            <div className="text-center text-xs text-gray-400 dark:text-gray-500 mt-2">
              点击卡片查看释义
            </div>

            <div className="mt-auto pt-5 text-center text-xs text-gray-400 dark:text-gray-500">
              浏览模式 · 点击卡片查看释义
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="back"
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -90, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="flex items-center justify-center gap-3 mb-2">
              <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 text-center break-words">
                {item.title}
              </h2>
            </div>

            <div className="space-y-3 mt-2">{item.renderDefs()}</div>

            <div className="mt-auto pt-4 text-center text-xs text-gray-400 dark:text-gray-500">
              点击卡片回到单词面
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {children}
    </motion.div>
  )
}
