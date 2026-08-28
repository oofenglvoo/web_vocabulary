import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderPlus, Pencil, Trash2, FolderOpen } from 'lucide-react'
import { useLang } from '../context/Language'
import {
  useLangCategoryStats,
  addLangCategory,
} from '../hooks/languageAware'
import { updateCategory, deleteCategory } from '../hooks/useWords'
import { Category } from '../types/word'
import { BackButton } from '../components/BackButton'
import { useToast } from '../components/Toast'
import { EmptyState } from '../components/EmptyState'

const PRESET_COLORS = [
  '#8b5cf6', '#06b6d4', '#f97316', '#3b82f6', '#22c55e',
  '#a855f7', '#eab308', '#6366f1', '#ec4899', '#10b981',
]

export function Categories() {
  const isJa = useLang() === 'ja'
  const cats = useLangCategoryStats()
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
          aria-label="新建分类"
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
          {cats.map((cat, index) => {
            const isSentence = cat.entityType === 'sentence'
            const countLabel = isSentence ? `${cat.sentenceCount ?? 0} 句` : `${cat.wordCount} 词`
            return (
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
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate dark:text-gray-200">{cat.name}</span>
                      {cat.entityType && (
                        <span
                          className={`chip shrink-0 ${
                            cat.entityType === 'word'
                              ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300'
                              : 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300'
                          }`}
                        >
                          {cat.entityType === 'word' ? '单词' : '短句'}
                        </span>
                      )}
                    </div>
                    {cat.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{cat.description}</div>
                    )}
                  </div>
                  <span className="text-sm text-gray-400 dark:text-gray-500">{countLabel}</span>
                </Link>
                <button
                  onClick={() => setEditing(cat)}
                  className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                  aria-label="编辑"
                >
                  <Pencil size={16} className="text-gray-400" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {showAdd && (
        <CategoryEditor
          mode="add"
          isJa={isJa}
          onClose={() => setShowAdd(false)}
        />
      )}

      {editing && (
        <CategoryEditor
          mode="edit"
          category={editing}
          isJa={isJa}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

interface EditorProps {
  mode: 'add' | 'edit'
  category?: Category
  isJa: boolean
  onClose: () => void
}

function CategoryEditor({ mode, category, isJa, onClose }: EditorProps) {
  const { toast } = useToast()
  const [name, setName] = useState(category?.name ?? '')
  const [description, setDescription] = useState(category?.description ?? '')
  const [color, setColor] = useState(category?.color ?? PRESET_COLORS[0])
  const [type, setType] = useState<'word' | 'sentence'>(
    category?.entityType ?? 'word'
  )
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleSave = async () => {
    const n = name.trim()
    if (!n) {
      setError('名称不能为空')
      return
    }
    try {
      if (mode === 'add') {
        if (isJa) {
          // 日语分类自动归属日语语言与 word 实体
          await addLangCategory(n, description.trim(), color)
        } else {
          await addLangCategory(n, description.trim(), color, type)
        }
        toast('success', `分类「${n}」已创建`)
      } else if (category?.id) {
        await updateCategory(category.id, { name: n, description: description.trim(), color })
        toast('success', `分类「${n}」已更新`)
      }
      onClose()
    } catch (e) {
      setError((e as Error).message || '保存失败，请重试')
    }
  }

  const handleDelete = async () => {
    if (!category?.id) return
    setIsDeleting(true)
    try {
      await deleteCategory(category.id)
      toast('success', `分类「${category.name}」已删除`)
      onClose()
    } catch (e) {
      setError((e as Error).message || '删除失败，请重试')
      setIsDeleting(false)
    }
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

          {mode === 'add' ? (
            <div>
              <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">类型 *</label>
              <div className={`grid gap-2 ${isJa ? 'grid-cols-1' : 'grid-cols-2'}`} role="radiogroup" aria-label="分类类型">
                <button
                  type="button"
                  role="radio"
                  aria-checked={type === 'word'}
                  onClick={() => setType('word')}
                  className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                    type === 'word'
                      ? 'bg-primary-500 text-white border-primary-500 shadow-glow'
                      : 'border-gray-200 text-gray-600 dark:border-slate-600 dark:text-gray-300 hover:border-primary-300'
                  }`}
                >
                  {isJa ? '日语词分类' : '单词分类'}
                </button>
                {!isJa && (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={type === 'sentence'}
                    onClick={() => setType('sentence')}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      type === 'sentence'
                        ? 'bg-purple-500 text-white border-purple-500 shadow-glow'
                        : 'border-gray-200 text-gray-600 dark:border-slate-600 dark:text-gray-300 hover:border-purple-300'
                    }`}
                  >
                    短句分类
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                {isJa ? '分类将归入日语词库，仅存放日语词条' : '类型创建后不可更改；每个分类只存放一种内容'}
              </p>
            </div>
          ) : (
            category?.entityType && (
              <div>
                <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">类型</label>
                <span
                  className={`chip ${
                    category.entityType === 'word'
                      ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300'
                      : 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300'
                  }`}
                >
                  {category.entityType === 'word' ? '单词分类' : '短句分类'}
                </span>
              </div>
            )
          )}

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
              onClick={() => setConfirmDelete(true)}
              className="btn-secondary text-red-600 flex items-center gap-1"
            >
              <Trash2 size={16} /> 删除
            </button>
          )}
          <button onClick={onClose} className="btn-secondary flex-1">取消</button>
          <button onClick={handleSave} className="btn-primary flex-1">保存</button>
        </div>
      </div>

      {confirmDelete && (
        <div className="modal-overlay">
          <div className="modal-content max-w-xs text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-warn flex items-center justify-center shadow-glow">
              <Trash2 size={28} className="text-white" />
            </div>
            <h3 className="font-bold text-lg mb-1 dark:text-gray-100">删除分类?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              分类: <span className="font-medium text-gray-700 dark:text-gray-200">{category?.name}</span>
            </p>
            <p className="text-xs text-red-500 dark:text-red-400 font-medium mb-5">
              该分类下的所有单词和短句将一并删除!
            </p>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-2.5 rounded-xl mb-3 text-sm">{error}</div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary flex-1">
                取消
              </button>
              <button
                onClick={handleDelete}
                className="btn-danger flex-1"
                disabled={isDeleting}
              >
                {isDeleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
