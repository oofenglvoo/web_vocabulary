import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderPlus, Pencil, Trash2, FolderOpen } from 'lucide-react'
import {
  useCategoryStats,
  addCategory,
  updateCategory,
  deleteCategory,
} from '../hooks/useWords'
import { Category } from '../types/word'
import { BackButton } from '../components/BackButton'
import { useToast } from '../components/Toast'
import { EmptyState } from '../components/EmptyState'

const PRESET_COLORS = [
  '#8b5cf6', '#06b6d4', '#f97316', '#3b82f6', '#22c55e',
  '#a855f7', '#eab308', '#6366f1', '#ec4899', '#10b981',
]

export function Categories() {
  const cats = useCategoryStats()
  const [editing, setEditing] = useState<Category | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <BackButton />
        <h1 className="page-title-accent">分类管理</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
        >
          <FolderPlus size={20} />
        </button>
      </div>

      {cats.length === 0 ? (
        <EmptyState
          icon={<FolderOpen size={32} className="text-primary-400" />}
          title="暂无分类"
          description="创建分类来组织你的单词"
        />
      ) : (
        <div className="space-y-2">
          {cats.map((cat, index) => (
            <div
              key={cat.id}
              className="card p-3 flex items-center gap-3 stagger-item card-hover"
              style={{ '--stagger-index': index } as React.CSSProperties}
            >
              <Link
                to={`/categories/${encodeURIComponent(cat.name)}`}
                className="flex-1 flex items-center gap-3 min-w-0"
              >
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate dark:text-gray-200">{cat.name}</div>
                  {cat.description && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{cat.description}</div>
                  )}
                </div>
                <span className="text-sm text-gray-400 dark:text-gray-500">{cat.wordCount} 词</span>
              </Link>
              <button
                onClick={() => setEditing(cat)}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
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
  const { toast } = useToast()
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
      toast('success', `分类「${n}」已创建`)
    } else if (category?.id) {
      await updateCategory(category.id, { name: n, description: description.trim(), color })
      toast('success', `分类「${n}」已更新`)
    }
    onClose()
  }

  const handleDelete = async () => {
    if (!category?.id) return
    const msg = `删除分类 "${category.name}"，其中的单词和短句将移到其他分类。继续?`
    if (!confirm(msg)) return
    await deleteCategory(category.id)
    toast('success', `分类「${category.name}」已删除`)
    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 className="font-bold text-lg mb-4 dark:text-gray-100">
          {mode === 'add' ? '新建分类' : '编辑分类'}
        </h3>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-2.5 rounded-xl mb-3 text-sm">{error}</div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">描述</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field"
              placeholder="可选"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-300">颜色</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    color === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          {mode === 'edit' && (
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
