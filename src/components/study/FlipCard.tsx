import { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Volume2 } from 'lucide-react'
import { StudyItem, StudyEntityType } from './types'
import { FavoriteButton } from '../FavoriteButton'

interface FlipCardProps {
  item: StudyItem
  flipped: boolean
  onSpeak: () => void
  /** 收藏的实体类型：单词页/短句页各自传入 */
  entityType?: StudyEntityType
  /** 限定翻卡区域：提供时仅点击该区域翻卡；不提供则整卡可点（保留兼容） */
  onFlip?: () => void
  children?: ReactNode // 翻面后的附加内容（如自评按钮）
}

/** 正面=词面(单词/短句+发音)，背面=释义；统一翻转卡片 */
export function FlipCard({ item, flipped, onSpeak, entityType = 'word', onFlip, children }: FlipCardProps) {
  const zoneProps = onFlip
    ? { onClick: onFlip, 'data-flip-zone': true as const, className: 'cursor-pointer' }
    : { className: '' }
  return (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="card flex-1 min-w-0 flex flex-col p-6 overflow-auto"
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
            className="flex-1 min-w-0 flex flex-col"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="flex flex-col items-center mb-2 min-w-0 w-full">
              <h2 className="w-full min-w-0 max-w-full overflow-visible py-1 text-3xl font-bold leading-normal text-gradient text-center break-all select-text">
                {item.title}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSpeak()
                  }}
                  className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                  aria-label="发音"
                >
                  <Volume2 size={22} />
                </button>
                <div onClick={(e) => e.stopPropagation()}>
                  <FavoriteButton entityType={entityType} entityId={item.id} title={item.title} />
                </div>
              </div>
            </div>
            {item.phonetic && (
              <p className="text-gray-500 dark:text-gray-400 text-base text-center mb-4">{item.phonetic}</p>
            )}

            {/* 翻卡区域：音标下方空白处点击才翻卡 */}
            <div
              {...zoneProps}
              className={`flex-1 min-h-[64px] flex flex-col items-center justify-center text-center ${zoneProps.className}`}
            >
              <div className="text-center text-xs text-gray-400 dark:text-gray-500">
                {onFlip ? '点击下方空白查看释义' : '浏览模式 · 点击卡片查看释义'}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="back"
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -90, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 min-w-0 flex flex-col"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="flex items-center justify-center gap-3 mb-2 min-w-0 flex-wrap">
              <h2 className="min-w-0 max-w-full overflow-visible py-1 text-xl font-bold leading-normal text-gray-700 dark:text-gray-200 text-center break-all select-text">
                {item.title}
              </h2>
            </div>

            {/* 翻卡区域：单词下方（释义 + 空白）点击回到单词面；笔记/发音等交互自行阻止冒泡 */}
            <div {...zoneProps} className={`flex-1 min-h-0 flex flex-col ${zoneProps.className}`}>
              <div className="space-y-3 mt-2">{item.renderDefs()}</div>
              <div className="mt-auto pt-4 text-center text-xs text-gray-400 dark:text-gray-500">
                {onFlip ? '点击空白处回到单词面' : '点击卡片回到单词面'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {children}
    </motion.div>
  )
}
