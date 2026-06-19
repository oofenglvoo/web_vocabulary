import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, FolderPlus, Pencil, Trash2 } from 'lucide-react'
import {
  useCategoryStats,
  addCategory,
  updateCategory,
  deleteCategory,
} from '../hooks/useWords'
import { Category } from '../types/word'

const PRESET_COLORS = [
  '#8b5cf6', '#06b6d4', '#f97316', '#3b82f6', '#22c55e',
  '#a855f7', '#eab308', '#6366f1', '#ec4899', '#10b981',
]

export function Categories() {
  const navigate = useNavigate()
  const cats = useCategoryStats()
  const [editing, setEditing] = useState<Category | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">分类管理</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <FolderPlus size={20} />
        </button>
      </div>

      {cats.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>暂无分类</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cats.map((cat) => (
            <div key={cat.id} className="card p-3 flex items-center gap-3">
              <Link
                to={`/categories/${encodeURIComponent(cat.name)}`}
                className="flex-1 flex items-center gap-3 min-w-0"
              >
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{cat.name}</div>
                  {cat.description && (
                    <div className="text-xs text-gray-500 truncate">{cat.description}</div>
                  )}
                </div>
                <span className="text-sm text-gray-400">{cat.wordCount} 词</span>
              </Link>
              <button
                onClick={() => setEditing(cat)}
                className="p-2 hover:bg-gray-100 rounded-lg"
                aria-label="编辑"
              >
                <Pencil size={16} className="text-gray-400" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <CategoryEditor
          mode="add"
          onClose={() => setShowAdd(false)}
        />
      )}

      {editing && (
        <CategoryEditor
          mode="edit"
          category={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

interface EditorProps {
  mode: 'add' | 'edit'
  category?: Category
  onClose: () => void
}

function CategoryEditor({ mode, category, onClose }: EditorProps) {
  const [name, setName] = useState(category?.name ?? '')
  const [description, setDescription] = useState(category?.description ?? '')
  const [color, setColor] = useState(category?.color ?? PRESET_COLORS[0])
  const [error, setError] = useState('')

  const handleSave = async () => {
    const n = name.trim()
    if (!n) {
      setError('名称不能为空')
      return
    }
    if (mode === 'add') {
      await addCategory(n, description.trim(), color)
    } else if (category?.id) {
      await updateCategory(category.id, { name: n, description: description.trim(), color })
    }
    onClose()
  }

  const handleDelete = async () => {
    if (!category?.id) return
    if (category.name === '默认') {
      alert('默认分类不可删除')
      return
    }
    if (!confirm(`删除分类 "${category.name}",其中的单词将移到 "默认" 分类。继续?`)) return
    await deleteCategory(category.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm">
        <h3 className="font-bold text-lg mb-4">
          {mode === 'add' ? '新建分类' : '编辑分类'}
        </h3>

        {error && (
          <div className="bg-red-50 text-red-600 p-2 rounded mb-3 text-sm">{error}</div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:border-primary-600 focus:outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">描述</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:border-primary-600 focus:outline-none"
              placeholder="可选"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">颜色</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 ${
                    color === c ? 'border-gray-900' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          {mode === 'edit' && category?.name !== '默认' && (
            <button
              onClick={handleDelete}
              className="btn-secondary text-red-600 flex items-center gap-1"
            >
              <Trash2 size={16} /> 删除
            </button>
          )}
          <button onClick={onClose} className="btn-secondary flex-1">取消</button>
          <button onClick={handleSave} className="btn-primary flex-1">保存</button>
        </div>
      </div>
    </div>
  )
}
