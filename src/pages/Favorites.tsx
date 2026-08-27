import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Heart, Upload } from 'lucide-react'
import {
  useFavoriteWords,
  useCategories,
  toggleFavorite,
  deleteWord,
  bulkSetFavorite,
  bulkSetCategory,
  bulkDeleteWords,
} from '../hooks/useWords'
import {
  useFavoriteSentences,
  toggleSentenceFavorite,
  deleteSentence,
  bulkSetSentenceFavorite,
  bulkSetSentenceCategory,
  bulkDeleteSentences,
} from '../hooks/useSentences'
import { SelectableWordList } from '../components/SelectableWordList'
import { ConfirmModal } from '../components/ConfirmModal'
import { SentenceCard } from '../components/SentenceCard'
import { BackButton } from '../components/BackButton'
import { useToast } from '../components/Toast'
import { enhancedSearch } from '../utils/search'
import { Sentence } from '../types/word'

type Tab = 'word' | 'sentence'

export function Favorites() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const words = useFavoriteWords()
  const sentences = useFavoriteSentences()
  const categories = useCategories()

  const [tab, setTab] = useState<Tab>('word')
  const [search, setSearch] = useState('')
  const [showMove, setShowMove] = useState(false)
  // 分开记录要移动的单词/短句 ID，避免切 tab 时串表
  const [moveWordIds, setMoveWordIds] = useState<number[]>([])
  const [moveSentenceIds, setMoveSentenceIds] = useState<number[]>([])
  const [confirmDeleteWordId, setConfirmDeleteWordId] = useState<number | null>(null)
  const [confirmDeleteSentenceId, setConfirmDeleteSentenceId] = useState<number | null>(null)
  const [confirmBatchWordDelete, setConfirmBatchWordDelete] = useState(false)
  const [confirmBatchSentenceDelete, setConfirmBatchSentenceDelete] = useState(false)
  const [batchWordIds, setBatchWordIds] = useState<number[]>([])
  const [batchSentenceIds, setBatchSentenceIds] = useState<number[]>([])

  const handleMoveToWord = async (cat: string) => {
    await bulkSetCategory(moveWordIds, cat)
    toast('success', `已移动 ${moveWordIds.length} 个单词到「${cat}」`)
    setShowMove(false)
    setMoveWordIds([])
  }

  const handleMoveToSentence = async (cat: string) => {
    await bulkSetSentenceCategory(moveSentenceIds, cat)
    toast('success', `已移动 ${moveSentenceIds.length} 个短句到「${cat}」`)
    setShowMove(false)
    setMoveSentenceIds([])
  }

  const renderSentence = (
    s: Sentence,
    actions: { onClick: () => void; onFavorite: () => void; onDelete: () => void }
  ) => (
    <SentenceCard
      key={s.id}
      sentence={s}
      onClick={actions.onClick}
      onFavorite={actions.onFavorite}
      onDelete={actions.onDelete}
    />
  )

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <BackButton />
        <h1 className="page-title-accent flex items-center gap-2">
          <Heart size={20} className="fill-red-500 text-red-500" /> 收藏夹
        </h1>
        <div className="w-10" />
      </div>

      {/* 单词 | 短句 切换 */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setTab('word')}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
            tab === 'word'
              ? 'bg-primary-500 text-white'
              : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
          }`}
        >
          单词 {words.length > 0 && `(${words.length})`}
        </button>
        <button
          onClick={() => setTab('sentence')}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
            tab === 'sentence'
              ? 'bg-primary-500 text-white'
              : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
          }`}
        >
          短句 {sentences.length > 0 && `(${sentences.length})`}
        </button>
      </div>

      {tab === 'word' ? (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">共 {words.length} 个</span>
            <Link
              to="/import?favorite=1"
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
            >
              <Upload size={14} /> 导入并收藏
            </Link>
          </div>

          <SelectableWordList
            words={words}
            search={search}
            onSearchChange={setSearch}
            onWordClick={(w) => navigate(`/word/${w.id}?scope=favorites`)}
            onFavorite={(w) => toggleFavorite(w.id!, w.isFavorite)}
            onDelete={(w) => setConfirmDeleteWordId(w.id!)}
            emptyText="收藏夹是空的"
            emptyHint="在单词详情页点心形图标即可收藏"
            emptyAction={{ label: '批量导入并收藏', href: '/import?favorite=1' }}
            batchActions={{
              onMoveToCategory: (ids) => {
                setMoveWordIds(ids)
                setShowMove(true)
              },
              onUnfavoriteAll: (ids) => {
                bulkSetFavorite(ids, false)
                toast('success', '已取消收藏')
              },
              onDeleteAll: (ids) => {
                setBatchWordIds(ids)
                setConfirmBatchWordDelete(true)
              },
            }}
          />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">共 {sentences.length} 个</span>
            <Link
              to="/sentences/import?favorite=1"
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
            >
              <Upload size={14} /> 导入并收藏
            </Link>
          </div>

          <SelectableWordList<Sentence>
            words={sentences}
            search={search}
            onSearchChange={setSearch}
            onWordClick={(s) => navigate(`/sentence/${s.id}?scope=favorites`)}
            onFavorite={(s) => toggleSentenceFavorite(s.id!, s.isFavorite)}
            onDelete={(s) => setConfirmDeleteSentenceId(s.id!)}
            renderItem={renderSentence}
            matchSearch={(q, s) => {
              const defs = s.definitions ?? []
              const defsText = defs.map((d: any) => `${d.pos ?? ''} ${d.def ?? ''} ${d.trans ?? ''}`).join(' ')
              return enhancedSearch(q, { word: s.sentence, translation: s.translation, definition: defsText })
            }}
            emptyText="收藏夹暂无短句"
            emptyHint="在短句详情页点心形图标即可收藏"
            emptyAction={{ label: '批量导入并收藏', href: '/sentences/import?favorite=1' }}
            batchActions={{
              onMoveToCategory: (ids) => {
                setMoveSentenceIds(ids)
                setShowMove(true)
              },
              onUnfavoriteAll: (ids) => {
                bulkSetSentenceFavorite(ids, false)
                toast('success', '已取消收藏')
              },
              onDeleteAll: (ids) => {
                setBatchSentenceIds(ids)
                setConfirmBatchSentenceDelete(true)
              },
            }}
          />
        </>
      )}

      {showMove && (
        <div className="modal-overlay">
          <div className="modal-content max-h-[80vh] overflow-auto">
            <h3 className="font-bold text-lg mb-4 dark:text-gray-100">移动到分类</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
              仅显示允许{tab === 'word' ? '单词' : '短句'}的分类
            </p>
            <div className="space-y-2">
              {categories
                .filter((c) => !c.entityType || c.entityType === tab)
                .map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() =>
                      tab === 'word' ? handleMoveToWord(cat.name) : handleMoveToSentence(cat.name)
                    }
                    className="w-full flex items-center gap-3 p-3 rounded-xl border dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="dark:text-gray-200">{cat.name}</span>
                    {cat.entityType && (
                      <span className="chip ml-auto text-[10px] bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-400">
                        {cat.entityType === 'word' ? '单词' : '短句'}
                      </span>
                    )}
                  </button>
                ))}
            </div>
            <button onClick={() => setShowMove(false)} className="btn-secondary w-full mt-4">
              取消
            </button>
          </div>
        </div>
      )}

      {confirmDeleteWordId !== null && (
        <ConfirmModal
          title="删除单词?"
          message="删除后不可恢复（相关学习记录与计划引用会一并清理）"
          confirmText="删除"
          onConfirm={async () => {
            await deleteWord(confirmDeleteWordId)
            toast('success', '单词已删除')
          }}
          onCancel={() => setConfirmDeleteWordId(null)}
        />
      )}

      {confirmDeleteSentenceId !== null && (
        <ConfirmModal
          title="删除短句?"
          message="删除后不可恢复（相关计划引用会一并清理）"
          confirmText="删除"
          onConfirm={async () => {
            await deleteSentence(confirmDeleteSentenceId)
            toast('success', '短句已删除')
          }}
          onCancel={() => setConfirmDeleteSentenceId(null)}
        />
      )}

      {confirmBatchWordDelete && (
        <ConfirmModal
          title="删除选中的单词?"
          message={`共 ${batchWordIds.length} 个单词`}
          confirmText="删除"
          onConfirm={async () => {
            await bulkDeleteWords(batchWordIds)
            toast('success', `已删除 ${batchWordIds.length} 个单词`)
          }}
          onCancel={() => setConfirmBatchWordDelete(false)}
        />
      )}

      {confirmBatchSentenceDelete && (
        <ConfirmModal
          title="删除选中的短句?"
          message={`共 ${batchSentenceIds.length} 个短句`}
          confirmText="删除"
          onConfirm={async () => {
            await bulkDeleteSentences(batchSentenceIds)
            toast('success', `已删除 ${batchSentenceIds.length} 个短句`)
          }}
          onCancel={() => setConfirmBatchSentenceDelete(false)}
        />
      )}
    </div>
  )
}
