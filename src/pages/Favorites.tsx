import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Heart, Search, Trash2, FolderInput, Upload } from 'lucide-react'
import {
  useFavoriteWords,
  useCategories,
  toggleFavorite,
  deleteWord,
  bulkSetFavorite,
  bulkSetCategory,
  bulkDeleteWords,
} from '../hooks/useWords'
import { WordCard } from '../components/WordCard'

export function Favorites() {
  const navigate = useNavigate()
  const words = useFavoriteWords()
  const categories = useCategories()
  const [search, setSearch] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [showMove, setShowMove] = useState(false)

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

  const handleUnfavoriteAll = async () => {
    await bulkSetFavorite(Array.from(selected), false)
    exitSelect()
  }

  const handleDeleteAll = async () => {
    if (!confirm(`确定删除选中的 ${selected.size} 个单词?`)) return
    await bulkDeleteWords(Array.from(selected))
    exitSelect()
  }

  const handleMoveTo = async (cat: string) => {
    await bulkSetCategory(Array.from(selected), cat)
    setShowMove(false)
    exitSelect()
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Heart size={20} className="fill-red-500 text-red-500" /> 收藏夹
        </h1>
        <button
          onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
          className="text-sm text-primary-600"
        >
          {selectMode ? '取消' : '多选'}
        </button>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">共 {words.length} 个</span>
        <Link
          to="/import?favorite=1"
          className="text-sm text-primary-600 hover:underline flex items-center gap-1"
        >
          <Upload size={14} /> 导入并收藏
        </Link>
      </div>

      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索收藏..."
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:border-primary-600 focus:outline-none"
        />
      </div>

      {selectMode && (
        <div className="card p-3 mb-3 flex items-center justify-between bg-primary-50">
          <span className="text-sm">已选 {selected.size}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowMove(true)}
              disabled={selected.size === 0}
              className="text-sm text-primary-600 disabled:opacity-50 flex items-center gap-1"
            >
              <FolderInput size={14} /> 移动分类
            </button>
            <button
              onClick={handleUnfavoriteAll}
              disabled={selected.size === 0}
              className="text-sm text-gray-600 disabled:opacity-50"
            >
              取消收藏
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
          <Heart size={48} className="mx-auto mb-2 opacity-30" />
          <p>{search ? '未找到匹配的单词' : '收藏夹是空的'}</p>
          {!search && (
            <>
              <p className="text-sm mt-1">在单词详情页点心形图标即可收藏</p>
              <Link
                to="/import?favorite=1"
                className="btn-primary inline-flex items-center gap-2 mt-4"
              >
                <Upload size={16} /> 批量导入并收藏
              </Link>
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
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleMoveTo(cat.name)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border"
                >
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span>{cat.name}</span>
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
