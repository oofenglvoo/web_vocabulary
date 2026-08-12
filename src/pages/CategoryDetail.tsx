import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Upload, Plus, FolderOpen } from 'lucide-react'
import {
  useWordsByCategory,
  useCategories,
  toggleFavorite,
  deleteWord,
  bulkSetFavorite,
  bulkSetCategory,
  bulkDeleteWords,
} from '../hooks/useWords'
import {
  useSentencesByCategory,
  toggleSentenceFavorite,
  deleteSentence,
  bulkSetSentenceFavorite,
  bulkSetSentenceCategory,
  bulkDeleteSentences,
} from '../hooks/useSentences'
import { SelectableWordList } from '../components/SelectableWordList'
import { ConfirmModal } from '../components/ConfirmModal'
import { SentenceCard } from '../components/SentenceCard'
import { EmptyState } from '../components/EmptyState'
import { BackButton } from '../components/BackButton'
import { useToast } from '../components/Toast'
import { enhancedSearch } from '../utils/search'
import { Sentence } from '../types/word'

type Tab = 'word' | 'sentence'

export function CategoryDetail() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const decoded = name ? decodeURIComponent(name) : ''
  const words = useWordsByCategory(decoded)
  const sentences = useSentencesByCategory(decoded)
  const categories = useCategories()

  const [tab, setTab] = useState<Tab>('word')
  const [search, setSearch] = useState('')
  const [showMove, setShowMove] = useState(false)
  const [moveWordIds, setMoveWordIds] = useState<number[]>([])
  const [moveSentenceIds, setMoveSentenceIds] = useState<number[]>([])
  const [confirmDeleteWordId, setConfirmDeleteWordId] = useState<number | null>(null)
  const [confirmDeleteSentenceId, setConfirmDeleteSentenceId] = useState<number | null>(null)
  const [confirmBatchWordDelete, setConfirmBatchWordDelete] = useState(false)
  const [confirmBatchSentenceDelete, setConfirmBatchSentenceDelete] = useState(false)
  const [batchWordIds, setBatchWordIds] = useState<number[]>([])
  const [batchSentenceIds, setBatchSentenceIds] = useState<number[]>([])

  // 缺失分类名时给出兜底页，而不是渲染空白标题
  if (!decoded) {
    return (
      <div className="p-4">
        <BackButton />
        <EmptyState
          icon={<FolderOpen size={32} className="text-gray-300 dark:text-gray-600" />}
          title="分类不存在"
          description="请返回分类列表重新选择"
        />
      </div>
    )
  }

  const cat = categories.find((c) => c.name === decoded)
  const importHref = `/import?category=${encodeURIComponent(decoded)}`
  const addHref = `/add?category=${encodeURIComponent(decoded)}`
  const sentenceImportHref = `/sentences/import?category=${encodeURIComponent(decoded)}`
  const sentenceAddHref = `/sentences/add?category=${encodeURIComponent(decoded)}`

  const handleMoveToWord = async (target: string) => {
    if (target === decoded) {
      setShowMove(false)
      return
    }
    await bulkSetCategory(moveWordIds, target)
    toast('success', `已移动 ${moveWordIds.length} 个单词到「${target}」`)
    setShowMove(false)
    setMoveWordIds([])
  }

  const handleMoveToSentence = async (target: string) => {
    if (target === decoded) {
      setShowMove(false)
      return
    }
    await bulkSetSentenceCategory(moveSentenceIds, target)
    toast('success', `已移动 ${moveSentenceIds.length} 个短句到「${target}」`)
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
          {cat && (
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
          )}
          {decoded}
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
            <span className="text-sm text-gray-500 dark:text-gray-400">共 {words.length} 个单词</span>
            <div className="flex gap-2">
              <Link
                to={addHref}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
              >
                <Plus size={14} /> 添加
              </Link>
              <Link
                to={importHref}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
              >
                <Upload size={14} /> 批量导入
              </Link>
            </div>
          </div>

          <SelectableWordList
            words={words}
            search={search}
            onSearchChange={setSearch}
            onWordClick={(w) => navigate(`/word/${w.id}?category=${encodeURIComponent(decoded)}`)}
            onFavorite={(w) => toggleFavorite(w.id!, w.isFavorite)}
            onDelete={(w) => setConfirmDeleteWordId(w.id!)}
            emptyText="该分类暂无单词"
            emptyAction={{ label: '批量导入', href: importHref }}
            batchActions={{
              onMoveToCategory: (ids) => {
                setMoveWordIds(ids)
                setShowMove(true)
              },
              onFavoriteAll: (ids) => {
                bulkSetFavorite(ids, true)
                toast('success', `已收藏 ${ids.length} 个单词`)
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
            <span className="text-sm text-gray-500 dark:text-gray-400">共 {sentences.length} 个短句</span>
            <div className="flex gap-2">
              <Link
                to={sentenceAddHref}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
              >
                <Plus size={14} /> 添加
              </Link>
              <Link
                to={sentenceImportHref}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
              >
                <Upload size={14} /> 批量导入
              </Link>
            </div>
          </div>

          <SelectableWordList<Sentence>
            words={sentences}
            search={search}
            onSearchChange={setSearch}
            onWordClick={(s) =>
              navigate(`/sentence/${s.id}?scope=category&category=${encodeURIComponent(decoded)}`)
            }
            onFavorite={(s) => toggleSentenceFavorite(s.id!, s.isFavorite)}
            onDelete={(s) => setConfirmDeleteSentenceId(s.id!)}
            renderItem={renderSentence}
            matchSearch={(q, s) =>
              enhancedSearch(q, { word: s.sentence, translation: s.translation, definition: (s.definitions ?? []).map((d: any) => `${d.pos ?? ''} ${d.def ?? ''} ${d.trans ?? ''}`).join(' ') })
            }
            emptyText="该分类暂无短句"
            emptyAction={{ label: '批量导入', href: sentenceImportHref }}
            batchActions={{
              onMoveToCategory: (ids) => {
                setMoveSentenceIds(ids)
                setShowMove(true)
              },
              onFavoriteAll: (ids) => {
                bulkSetSentenceFavorite(ids, true)
                toast('success', `已收藏 ${ids.length} 个短句`)
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
            <div className="space-y-2">
              {categories
                .filter((c) => c.name !== decoded)
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() =>
                      tab === 'word' ? handleMoveToWord(c.name) : handleMoveToSentence(c.name)
                    }
                    className="w-full flex items-center gap-3 p-3 rounded-xl border dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="dark:text-gray-200">{c.name}</span>
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
