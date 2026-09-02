import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Search, Trash2, FolderInput, Heart, CheckSquare, Square, CheckCheck, ArrowUp, ArrowDown } from 'lucide-react'
import { Word } from '../types/word'
import { WordCard } from './WordCard'
import { enhancedSearch } from '../utils/search'
import { getDefinitions, getPrimaryTranslation, getPrimaryDefinition } from '../utils/definitions'
import { EmptyState } from './EmptyState'

interface SelectableListItem {
  id?: number
}

interface SelectableWordListProps<T extends SelectableListItem> {
  words: T[]
  search: string
  onSearchChange: (s: string) => void
  onWordClick: (item: T) => void
  onFavorite: (item: T) => void
  onDelete: (item: T) => void
  /** 多选模式下可选操作 */
  batchActions?: {
    onMoveToCategory?: (ids: number[]) => void
    onFavoriteAll?: (ids: number[]) => void
    onUnfavoriteAll?: (ids: number[]) => void
    onDeleteAll?: (ids: number[]) => void
  }
  /** 列表为空时的提示 */
  emptyText?: string
  emptyHint?: string
  emptyAction?: { label: string; href: string }
  /** 标题区域右侧附加内容 */
  headerExtra?: React.ReactNode
  /** 分类筛选列表（可选） */
  categories?: string[]
  category?: string
  onCategoryChange?: (cat: string) => void
  /** 自定义每项的渲染（默认渲染 WordCard）。短句列表传入 SentenceCard 渲染 */
  renderItem?: (item: T, actions: { onClick: () => void; onFavorite: () => void; onDelete: () => void }) => React.ReactNode
  /** 自定义搜索匹配（默认按 word/translation/definition 增强 search）。短句按 sentence/translation */
  matchSearch?: (query: string, item: T) => boolean
  /** 搜索框占位文案 */
  searchPlaceholder?: string
}

export function SelectableWordList<T extends SelectableListItem>({
  words,
  search,
  onSearchChange,
  onWordClick,
  onFavorite,
  onDelete,
  batchActions,
  emptyText = '暂无单词',
  emptyHint,
  emptyAction,
  categories,
  category,
  onCategoryChange,
  renderItem,
  matchSearch,
  searchPlaceholder = '搜索单词、释义...',
}: SelectableWordListProps<T>) {
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [showScrollBottom, setShowScrollBottom] = useState(false)

  // 记忆化过滤结果，避免每次渲染都重新过滤全部单词
  // （搜索为空时直接复用原数组，跳过开销较大的匹配）
  const filtered = useMemo(() => {
    const q = search.trim()
    if (!q) return words
    if (matchSearch) return words.filter((w) => matchSearch(q, w))
    // 默认:单词增强搜索(word/translation/definition + definitions内容)
    return words.filter((wRaw) => {
      const w = wRaw as unknown as Word
      const defs = getDefinitions(w)
      const defText = defs.map((d) => `${d.pos} ${d.def} ${d.trans}`).join(' ')
      return enhancedSearch(q, {
        word: w.word,
        translation: getPrimaryTranslation(w),
        definition: getPrimaryDefinition(w) + ' ' + defText,
      })
    })
  }, [words, search, matchSearch])

  // 增量渲染：只挂载已滚动到的部分，避免一次性渲染数千张卡片
  // 配合卡片 memo，进入页面时不再卡顿
  const [visibleCount, setVisibleCount] = useState(60)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // 切换分类/搜索时重置已渲染数量
  useEffect(() => {
    setVisibleCount(60)
  }, [search, category, words])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => Math.min(c + 60, filtered.length))
        }
      },
      { rootMargin: '600px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [filtered.length])

  const visibleWords = filtered.length > visibleCount ? filtered.slice(0, visibleCount) : filtered

  useEffect(() => {
    const updateScrollButtons = () => {
      const scroller = document.scrollingElement ?? document.documentElement
      const maxScroll = scroller.scrollHeight - window.innerHeight
      setShowScrollTop(scroller.scrollTop > 160)
      setShowScrollBottom(maxScroll > 160 && scroller.scrollTop < maxScroll - 160)
    }
    updateScrollButtons()
    window.addEventListener('scroll', updateScrollButtons, { passive: true })
    window.addEventListener('resize', updateScrollButtons)
    return () => {
      window.removeEventListener('scroll', updateScrollButtons)
      window.removeEventListener('resize', updateScrollButtons)
    }
  }, [filtered.length, visibleCount])

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = () => {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((w) => w.id!)))
    }
  }

  const selectedIds = Array.from(selected)

  // 批量操作后清理选中状态
  const wrapBatchAction = (action: (ids: number[]) => void) => (ids: number[]) => {
    action(ids)
    setSelected(new Set())
    setSelectMode(false)
  }

  return (
    <>
      {/* 搜索 + 多选入口 */}
      <div className="relative mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="input-field pl-10"
          />
        </div>
        {batchActions && (
          <button
            onClick={() => {
              setSelectMode(!selectMode)
              setSelected(new Set())
            }}
            className={`p-2.5 rounded-xl border transition-colors ${
              selectMode
                ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-600 dark:text-primary-400'
                : 'border-gray-200 dark:border-slate-700 text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
            aria-label="多选"
          >
            <CheckCheck size={18} />
          </button>
        )}
      </div>

      {/* 分类筛选 */}
      {categories && categories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onCategoryChange?.(cat)}
              className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-all ${
                category === cat
                  ? 'bg-gradient-primary text-white shadow-glow'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* 多选操作栏 */}
      {selectMode && (
        <div className="card p-3 mb-3 bg-primary-50 dark:bg-primary-900/30 space-y-2">
          <div className="flex items-center justify-between">
            <button onClick={selectAll} className="text-sm text-primary-600 dark:text-primary-400">
              {selected.size === filtered.length && filtered.length > 0 ? '取消全选' : '全选'}
            </button>
            <span className="text-sm dark:text-gray-200">已选 {selected.size}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {batchActions?.onMoveToCategory && (
              <button
                onClick={() => wrapBatchAction(batchActions.onMoveToCategory!)(selectedIds)}
                disabled={selected.size === 0}
                className="text-sm text-primary-600 dark:text-primary-400 disabled:opacity-50 flex items-center gap-1"
              >
                <FolderInput size={14} /> 移动分类
              </button>
            )}
            {batchActions?.onFavoriteAll && (
              <button
                onClick={() => wrapBatchAction(batchActions.onFavoriteAll!)(selectedIds)}
                disabled={selected.size === 0}
                className="text-sm text-red-500 dark:text-red-400 disabled:opacity-50 flex items-center gap-1"
              >
                <Heart size={14} /> 收藏
              </button>
            )}
            {batchActions?.onUnfavoriteAll && (
              <button
                onClick={() => wrapBatchAction(batchActions.onUnfavoriteAll!)(selectedIds)}
                disabled={selected.size === 0}
                className="text-sm text-gray-600 dark:text-gray-400 disabled:opacity-50"
              >
                取消收藏
              </button>
            )}
            {batchActions?.onDeleteAll && (
              <button
                onClick={() => wrapBatchAction(batchActions.onDeleteAll!)(selectedIds)}
                disabled={selected.size === 0}
                className="text-sm text-red-600 dark:text-red-400 disabled:opacity-50 flex items-center gap-1"
              >
                <Trash2 size={14} /> 删除
              </button>
            )}
          </div>
        </div>
      )}

      {(showScrollTop || showScrollBottom) && (
        <div className="fixed right-4 bottom-20 z-30 flex flex-col gap-2">
          {showScrollTop && (
            <button
              type="button"
              onClick={() => {
                const scroller = document.scrollingElement ?? document.documentElement
                scroller.scrollTo({ top: 0, behavior: 'auto' })
              }}
              className="w-10 h-10 rounded-full bg-white/90 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 shadow-lg flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              aria-label="回到顶部"
              title="回到顶部"
            >
              <ArrowUp size={18} />
            </button>
          )}
          {showScrollBottom && (
            <button
              type="button"
              onClick={() => {
                setVisibleCount(filtered.length)
                requestAnimationFrame(() => {
                  const scroller = document.scrollingElement ?? document.documentElement
                  scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'auto' })
                })
              }}
              className="w-10 h-10 rounded-full bg-white/90 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 shadow-lg flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              aria-label="到底部"
              title="到底部"
            >
              <ArrowDown size={18} />
            </button>
          )}
        </div>
      )}

      {/* 列表 */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Search size={32} className="text-gray-300 dark:text-gray-600" />}
          title={search ? '未找到匹配的单词' : emptyText}
          description={emptyHint && !search ? emptyHint : undefined}
          action={!search && emptyAction ? { label: emptyAction.label, href: emptyAction.href } : undefined}
        />
      ) : (
        <>
          <div className="space-y-3">
            {visibleWords.map((word) => (
              <div key={word.id} className="flex items-center gap-2">
                {selectMode && (
                  <button
                    onClick={() => toggleSelect(word.id!)}
                    className="shrink-0"
                  >
                    {selected.has(word.id!) ? (
                      <CheckSquare size={20} className="text-primary-600 dark:text-primary-400" />
                    ) : (
                      <Square size={20} className="text-gray-300 dark:text-gray-600" />
                    )}
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  {renderItem ? (
                    renderItem(word, {
                      onClick: () => (selectMode ? toggleSelect(word.id!) : onWordClick(word)),
                      onFavorite: () => onFavorite(word),
                      onDelete: () => onDelete(word),
                    })
                  ) : (
                    <WordCard
                      word={word as unknown as Word}
                      onClick={() =>
                        selectMode ? toggleSelect(word.id!) : onWordClick(word)
                      }
                      onFavorite={() => onFavorite(word)}
                      onDelete={() => onDelete(word)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
          {visibleWords.length < filtered.length && (
            <div ref={sentinelRef} className="h-4" aria-hidden />
          )}
        </>
      )}
    </>
  )
}
