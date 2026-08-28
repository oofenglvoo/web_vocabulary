import { useEffect, useRef, useState } from 'react'
import { Check, Pencil, StickyNote } from 'lucide-react'
import { useToast } from './Toast'

interface NotesBlockProps {
  notes: string
  /** 持久化笔记（调用方决定写到哪个实体）；保存成功后组件本地立即回显 */
  onSave: (notes: string) => Promise<void>
}

/**
 * 笔记块：查看 + 行内编辑，无笔记时提供「添加笔记」入口。
 * 用于学习翻面 / 词条详情；根节点阻止点击冒泡，避免触发卡片翻面。
 */
export function NotesBlock({ notes, onSave }: NotesBlockProps) {
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(notes)
  const [current, setCurrent] = useState(notes)
  const [saving, setSaving] = useState(false)
  // 仅当外部 notes 真正变化（live query 刷新/切换词条）时才同步显示；
  // 学习页的 item 是启动时的快照，prop 恒为旧值，不能用它覆盖刚保存的内容
  const lastNotesRef = useRef(notes)
  useEffect(() => {
    if (notes !== lastNotesRef.current) {
      lastNotesRef.current = notes
      if (!editing) setCurrent(notes)
    }
  }, [notes, editing])

  const startEdit = () => {
    setValue(current)
    setEditing(true)
  }

  const save = async () => {
    const next = value.trim()
    if (next === current) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSave(next)
      setCurrent(next)
      setEditing(false)
      toast('success', '笔记已保存')
    } catch (e) {
      toast('error', '保存失败: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="bg-gray-50 dark:bg-slate-700/60 rounded-xl p-3.5"
      onClick={(e) => e.stopPropagation()}
    >
      {editing ? (
        <>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
            <StickyNote size={12} /> 笔记
          </div>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={3}
            autoFocus
            className="input-field text-sm"
            placeholder="记录释义要点、用法、联想..."
          />
          <div className="flex justify-end gap-3 mt-2">
            <button type="button" onClick={() => setEditing(false)} className="text-sm text-gray-400">
              取消
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1 disabled:opacity-50"
            >
              <Check size={14} /> {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </>
      ) : current ? (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
              <StickyNote size={12} /> 笔记
            </div>
            <p className="text-sm dark:text-gray-200 whitespace-pre-wrap break-words">{current}</p>
          </div>
          <button
            type="button"
            onClick={startEdit}
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors shrink-0"
            aria-label="编辑笔记"
          >
            <Pencil size={13} className="text-gray-400" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={startEdit}
          className="w-full flex items-center justify-center gap-1.5 py-1 text-sm text-gray-400 dark:text-gray-500 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
        >
          <StickyNote size={13} /> 添加笔记
        </button>
      )}
    </div>
  )
}
