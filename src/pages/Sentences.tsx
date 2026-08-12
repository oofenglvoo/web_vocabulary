import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Plus, Upload } from 'lucide-react'
import {
  useAllSentences,
  toggleSentenceFavorite,
  deleteSentence,
  bulkSetSentenceCategory,
  bulkSetSentenceFavorite,
  bulkDeleteSentences,
} from '../hooks/useSentences'
import { useCategories } from '../hooks/useWords'
import { SelectableWordList } from '../components/SelectableWordList'
import { ConfirmModal } from '../components/ConfirmModal'
import { SentenceCard } from '../components/SentenceCard'
import { BackButton } from '../components/BackButton'
import { useToast } from '../components/Toast'
import { enhancedSearch } from '../utils/search'
import { Sentence } from '../types/word'

export function Sentences() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const sentences = useAllSentences()
  const categories = useCategories()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('全部')
  const [showMove, setShowMove] = useState(false)
  const [moveIds, setMoveIds] = useState<number[]>([])
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false)
  const [batchDeleteIds, setBatchDeleteIds] = useState<number[]>([])

  const categoryList = useMemo(() => ['全部', ...new Set(sentences.map((s) => s.category))], [sentences])
  const filtered = category === '全部' ? sentences : sentences.filter((s) => s.category === category)

  const handleMoveTo = async (cat: string) => {
    await bulkSetSentenceCategory(moveIds, cat)
    toast('success', `已移动 ${moveIds.length} 个短句到「${cat}」`)
    setShowMove(false)
    setMoveIds([])
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
        <h1 className="page-title-accent">短句列表</h1>
        <div className="flex gap-2">
          <Link to="/sentences/import" className="btn-secondary flex items-center gap-1">
            <Upload size={18} /> 导入
          </Link>
          <Link to="/sentences/add" className="btn-primary flex items-center gap-1">
            <Plus size={18} /> 添加
          </Link>
        </div>
      </div>

      <SelectableWordList<Sentence>
        words={category === '全部' ? sentences : filtered}
        search={search}
        onSearchChange={setSearch}
        onWordClick={(s) => navigate(`/sentence/${s.id}?scope=all`)}
        onFavorite={(s) => toggleSentenceFavorite(s.id!, s.isFavorite)}
        onDelete={(s) => setConfirmDeleteId(s.id!)}
        renderItem={renderSentence}
        matchSearch={(q, s) => {
          const defs = s.definitions ?? []
          const defsText = defs.map((d: any) => `${d.pos ?? ''} ${d.def ?? ''} ${d.trans ?? ''}`).join(' ')
          return enhancedSearch(q, { word: s.sentence, translation: s.translation, definition: defsText })
        }}
        categories={categoryList}
        category={category}
        onCategoryChange={setCategory}
        emptyText="还没有短句"
        emptyHint="导入一批短句或手动添加"
        emptyAction={{ label: '去导入', href: '/sentences/import' }}
        batchActions={{
          onMoveToCategory: (ids) => {
            setMoveIds(ids)
            setShowMove(true)
          },
          onFavoriteAll: (ids) => {
            bulkSetSentenceFavorite(ids, true)
            toast('success', `已收藏 ${ids.length} 个短句`)
          },
          onDeleteAll: (ids) => {
            setBatchDeleteIds(ids)
            setConfirmBatchDelete(true)
          },
        }}
      />

      {showMove && (
        <div className="modal-overlay">
          <div className="modal-content max-h-[80vh] overflow-auto">
            <h3 className="font-bold text-lg mb-4 dark:text-gray-100">移动到分类</h3>
            <div className="space-y-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleMoveTo(cat.name)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="dark:text-gray-200">{cat.name}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setShowMove(false)} className="btn-secondary w-full mt-4">
              取消
            </button>
          </div>
        </div>
      )}

      {confirmDeleteId !== null && (
        <ConfirmModal
          title="删除短句?"
          message="删除后不可恢复（相关计划引用会一并清理）"
          confirmText="删除"
          onConfirm={async () => {
            await deleteSentence(confirmDeleteId)
            toast('success', '短句已删除')
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      {confirmBatchDelete && (
        <ConfirmModal
          title="删除选中的短句?"
          message={`共 ${batchDeleteIds.length} 个短句`}
          confirmText="删除"
          onConfirm={async () => {
            await bulkDeleteSentences(batchDeleteIds)
            toast('success', `已删除 ${batchDeleteIds.length} 个短句`)
          }}
          onCancel={() => setConfirmBatchDelete(false)}
        />
      )}
    </div>
  )
}
