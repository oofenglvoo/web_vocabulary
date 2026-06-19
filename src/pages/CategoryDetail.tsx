import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Search, Trash2, FolderInput, Heart, Upload, Plus } from 'lucide-react'
import {
  useWordsByCategory,
  useCategories,
  toggleFavorite,
  deleteWord,
  bulkSetFavorite,
  bulkSetCategory,
  bulkDeleteWords,
} from '../hooks/useWords'
import { WordCard } from '../components/WordCard'

export function CategoryDetail() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const decoded = name ? decodeURIComponent(name) : ''
  const words = useWordsByCategory(decoded)
  const categories = useCategories()
  const [search, setSearch] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [showMove, setShowMove] = useState(false)

  const cat = categories.find((c) => c.name === decoded)

  const filtered = words.filter((w) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      w.word.toLowerCase().includes(s) ||
      w.definition.toLowerCase().includes(s) ||
      w.translation.includes(search)
    )
  })

  const toggleSelect = (id: number) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const exitSelect = () => {
    setSelectMode(false)
    setSelected(new Set())
  }

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((w) => w.id!)))
    }
  }

  const handleFavoriteAll = async () => {
    await bulkSetFavorite(Array.from(selected), true)
    exitSelect()
  }

  const handleDeleteAll = async () => {
    if (!confirm(`确定删除选中的 ${selected.size} 个单词?`)) return
    await bulkDeleteWords(Array.from(selected))
    exitSelect()
  }

  const handleMoveTo = async (target: string) => {
    if (target === decoded) {
      setShowMove(false)
      return
    }
    await bulkSetCategory(Array.from(selected), target)
    setShowMove(false)
    exitSelect()
  }

  const importHref = `/import?category=${encodeURIComponent(decoded)}`
  const addHref = `/add?category=${encodeURIComponent(decoded)}`

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          {cat && (
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: cat.color }}
            />
          )}
          {decoded}
        </h1>
        <button
          onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
          className="text-sm text-primary-600"
        >
          {selectMode ? '取消' : '多选'}
        </button>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">共 {words.length} 个单词</span>
        <div className="flex gap-2">
          <Link
            to={addHref}
            className="text-sm text-primary-600 hover:underline flex items-center gap-1"
          >
            <Plus size={14} /> 添加
          </Link>
          <Link
            to={importHref}
            className="text-sm text-primary-600 hover:underline flex items-center gap-1"
          >
            <Upload size={14} /> 批量导入
          </Link>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索..."
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:border-primary-600 focus:outline-none"
        />
      </div>

      {selectMode && (
        <div className="card p-3 mb-3 bg-primary-50 space-y-2">
          <div className="flex items-center justify-between">
            <button onClick={selectAll} className="text-sm text-primary-600">
              {selected.size === filtered.length && filtered.length > 0 ? '取消全选' : '全选'}
            </button>
            <span className="text-sm">已选 {selected.size}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowMove(true)}
              disabled={selected.size === 0}
              className="text-sm text-primary-600 disabled:opacity-50 flex items-center gap-1"
            >
              <FolderInput size={14} /> 移动
            </button>
            <button
              onClick={handleFavoriteAll}
              disabled={selected.size === 0}
              className="text-sm text-red-500 disabled:opacity-50 flex items-center gap-1"
            >
              <Heart size={14} /> 收藏
            </button>
            <button
              onClick={handleDeleteAll}
              disabled={selected.size === 0}
              className="text-sm text-red-600 disabled:opacity-50 flex items-center gap-1"
            >
              <Trash2 size={14} /> 删除
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {search ? (
            <p>未找到匹配的单词</p>
          ) : (
            <>
              <p className="mb-4">该分类暂无单词</p>
              <div className="flex justify-center gap-3">
                <Link
                  to={importHref}
                  className="btn-primary flex items-center gap-2"
                >
                  <Upload size={16} /> 批量导入
                </Link>
                <Link
                  to={addHref}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Plus size={16} /> 添加单词
                </Link>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((word) => (
            <div key={word.id} className="flex items-center gap-2">
              {selectMode && (
                <input
                  type="checkbox"
                  checked={selected.has(word.id!)}
                  onChange={() => toggleSelect(word.id!)}
                  className="w-5 h-5 accent-primary-600"
                />
              )}
              <div className="flex-1 min-w-0">
                <WordCard
                  word={word}
                  onClick={() =>
                    selectMode
                      ? toggleSelect(word.id!)
                      : (window.location.href = `/word/${word.id}`)
                  }
                  onFavorite={() => toggleFavorite(word.id!, word.isFavorite)}
                  onDelete={() => {
                    if (confirm('确定删除?')) deleteWord(word.id!)
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {showMove && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm max-h-[80vh] overflow-auto">
            <h3 className="font-bold text-lg mb-4">移动到分类</h3>
            <div className="space-y-2">
              {categories
                .filter((c) => c.name !== decoded)
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleMoveTo(c.name)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border"
                  >
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    <span>{c.name}</span>
                  </button>
                ))}
            </div>
            <button
              onClick={() => setShowMove(false)}
              className="btn-secondary w-full mt-4"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
