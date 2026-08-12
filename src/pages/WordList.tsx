import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Plus, Upload } from 'lucide-react'
import { useAllWords, toggleFavorite, deleteWord, bulkSetCategory, bulkSetFavorite, bulkDeleteWords, useCategories } from '../hooks/useWords'
import { SelectableWordList } from '../components/SelectableWordList'
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

  const categoryList = ['全部', ...new Set(words.map((w) => w.category))]

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
        onDelete={(w) => {
          if (confirm('确定删除?')) {
            deleteWord(w.id!)
            toast('success', '单词已删除')
          }
        }}
        categories={categoryList}
        category={category}
        onCategoryChange={setCategory}
        batchActions={{
          onMoveToCategory: (ids) => { setMoveIds(ids); setShowMove(true) },
          onFavoriteAll: (ids) => { bulkSetFavorite(ids, true); toast('success', `已收藏 ${ids.length} 个单词`) },
          onDeleteAll: (ids) => { if (confirm(`确定删除选中的 ${ids.length} 个单词?`)) { bulkDeleteWords(ids); toast('success', '已删除选中单词') } },
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
    </div>
  )
}
