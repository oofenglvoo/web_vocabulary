import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Plus, Upload } from 'lucide-react'
import { useAllWords, toggleFavorite, deleteWord, bulkSetCategory, bulkSetFavorite, bulkDeleteWords, useCategories } from '../hooks/useWords'
import { SelectableWordList } from '../components/SelectableWordList'
import { ConfirmModal } from '../components/ConfirmModal'
import { BackButton } from '../components/BackButton'
import { useToast } from '../components/Toast'

export function WordList() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const words = useAllWords()
  const categories = useCategories()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('全部')
  const [showMove, setShowMove] = useState(false)
  const [moveIds, setMoveIds] = useState<number[]>([])
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false)
  const [batchDeleteIds, setBatchDeleteIds] = useState<number[]>([])

  // 记忆化分类列表，避免每次渲染都生成新数组
  const categoryList = useMemo(() => ['全部', ...new Set(words.map((w) => w.category))], [words])

  const filtered = category === '全部' ? words : words.filter((w) => w.category === category)

  const handleMoveTo = async (cat: string) => {
    await bulkSetCategory(moveIds, cat)
    toast('success', `已移动 ${moveIds.length} 个单词到「${cat}」`)
    setShowMove(false)
    setMoveIds([])
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <BackButton />
        <h1 className="page-title-accent">单词列表</h1>
        <div className="flex gap-2">
          <Link to="/import" className="btn-secondary flex items-center gap-1">
            <Upload size={18} /> 导入
          </Link>
          <Link to="/add" className="btn-primary flex items-center gap-1">
            <Plus size={18} /> 添加
          </Link>
        </div>
      </div>

      <SelectableWordList
        words={category === '全部' ? words : filtered}
        search={search}
        onSearchChange={setSearch}
        onWordClick={(w) => navigate(`/word/${w.id}?scope=all`)}
        onFavorite={(w) => toggleFavorite(w.id!, w.isFavorite)}
        onDelete={(w) => setConfirmDeleteId(w.id!)}
        categories={categoryList}
        category={category}
        onCategoryChange={setCategory}
        batchActions={{
          onMoveToCategory: (ids) => { setMoveIds(ids); setShowMove(true) },
          onFavoriteAll: (ids) => { bulkSetFavorite(ids, true); toast('success', `已收藏 ${ids.length} 个单词`) },
          onDeleteAll: (ids) => { setBatchDeleteIds(ids); setConfirmBatchDelete(true) },
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
          title="删除单词?"
          message="删除后不可恢复（相关学习记录与计划引用会一并清理）"
          confirmText="删除"
          onConfirm={async () => {
            await deleteWord(confirmDeleteId)
            toast('success', '单词已删除')
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      {confirmBatchDelete && (
        <ConfirmModal
          title="删除选中的单词?"
          message={`共 ${batchDeleteIds.length} 个单词`}
          confirmText="删除"
          onConfirm={async () => {
            await bulkDeleteWords(batchDeleteIds)
            toast('success', `已删除 ${batchDeleteIds.length} 个单词`)
          }}
          onCancel={() => setConfirmBatchDelete(false)}
        />
      )}
    </div>
  )
}
