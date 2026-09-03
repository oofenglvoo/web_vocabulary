import { useState } from 'react'
import { Heart, Plus, X } from 'lucide-react'
import { useEntityFolderIds, useFavoriteFolders, setItemFolders, createFolder, useJapaneseEntityFolderIds, useJapaneseFavoriteFolders, setJapaneseItemFolders, createJapaneseFavoriteFolder } from '../hooks/useFavorites'
import { DEFAULT_FOLDER_NAME } from '../hooks/useFavorites'
import { useToast } from './Toast'

const LAST_FOLDER_KEY = 'vocab:lastFavoriteFolderId'
const LAST_JAPANESE_FOLDER_KEY = 'vocab:lastJapaneseFavoriteFolderId'

function getLastFolderId(folders: { id?: number; name: string }[], japanese = false) {
  const saved = Number(localStorage.getItem(japanese ? LAST_JAPANESE_FOLDER_KEY : LAST_FOLDER_KEY))
  if (Number.isInteger(saved) && folders.some((folder) => folder.id === saved)) return saved
  return folders.find((folder) => folder.name === DEFAULT_FOLDER_NAME)?.id ?? folders[0]?.id
}

const PRESET_COLORS = [
  '#d8785d', '#2f6b5c', '#6e9f84', '#c89236', '#477f61',
  '#5f9b78', '#c4654d', '#e0b15b', '#d8785d', '#245749',
]

interface FavoriteButtonProps {
  entityType: 'word' | 'sentence' | 'japaneseWord'
  entityId: number
  title?: string // 提示文案里的词条名（toast 用）
}

/**
 * 心形收藏按钮 + 收藏夹选择面板。
 * 学习卡片/详情页通用：实心=至少属于一个夹；点击弹出多选面板，可即时新建收藏夹。
 */
export function FavoriteButton({ entityType, entityId, title }: FavoriteButtonProps) {
  const [open, setOpen] = useState(false)
  const folderIds = useEntityFolderIds(entityType, entityId)
  const folders = useFavoriteFolders()
  const japaneseFolderIds = useJapaneseEntityFolderIds(entityType === 'japaneseWord' ? entityId : undefined)
  const japaneseFolders = useJapaneseFavoriteFolders()
  const { toast } = useToast()
  const selectedFolderIds = entityType === 'japaneseWord' ? japaneseFolderIds : folderIds
  const selectedFolders = entityType === 'japaneseWord' ? japaneseFolders : folders
  const active = selectedFolderIds.length > 0

  const favoriteInLastFolder = async () => {
    const isJapanese = entityType === 'japaneseWord'
    const folderId = getLastFolderId(selectedFolders, isJapanese)
    if (folderId == null) {
      setOpen(true)
      return
    }
    try {
      if (entityType === 'japaneseWord') await setJapaneseItemFolders(entityId, [folderId])
      else await setItemFolders(entityType, entityId, [folderId])
      localStorage.setItem(isJapanese ? LAST_JAPANESE_FOLDER_KEY : LAST_FOLDER_KEY, String(folderId))
      const folderName = selectedFolders.find((folder) => folder.id === folderId)?.name ?? DEFAULT_FOLDER_NAME
      toast('success', `${title ? `「${title}」` : '内容'}已收藏到「${folderName}」`, 5000, {
        label: '收藏到其他目录',
        onClick: () => setOpen(true),
      })
    } catch (e) {
      toast('error', (e as Error).message || '收藏失败')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (active) setOpen(true)
          else void favoriteInLastFolder()
        }}
        className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors shrink-0"
        aria-label={active ? '编辑收藏' : '加入收藏'}
        aria-pressed={active}
      >
        <Heart size={20} className={active ? 'fill-red-500 text-red-500' : 'text-gray-400'} />
      </button>

      {open && (
        <FavoritePanel
          onClose={() => setOpen(false)}
          folders={selectedFolders}
          currentFolderIds={selectedFolderIds}
          createFolder={entityType === 'japaneseWord' ? createJapaneseFavoriteFolder : createFolder}
          saveFolders={(ids) => entityType === 'japaneseWord' ? setJapaneseItemFolders(entityId, ids) : setItemFolders(entityType, entityId, ids)}
          onSaved={(folderId) => localStorage.setItem(entityType === 'japaneseWord' ? LAST_JAPANESE_FOLDER_KEY : LAST_FOLDER_KEY, String(folderId))}
        />
      )}
    </>
  )
}

function FavoritePanel({
  currentFolderIds,
  folders,
  createFolder,
  saveFolders,
  onClose,
  onSaved,
}: {
  currentFolderIds: number[]
  folders: { id?: number; name: string; color: string }[]
  createFolder: (name: string, color: string) => Promise<number>
  saveFolders: (ids: number[]) => Promise<unknown>
  onClose: () => void
  onSaved: (folderId: number) => void
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set(currentFolderIds))
  const [lastSelectedId, setLastSelectedId] = useState<number | undefined>(currentFolderIds[0])
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[1])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else {
        next.add(id)
        setLastSelectedId(id)
      }
      return next
    })
  }

  const handleCreate = async () => {
    setError('')
    try {
      const id = await createFolder(newName, newColor)
      setSelected((prev) => new Set(prev).add(id))
      setLastSelectedId(id)
      setCreating(false)
      setNewName('')
    } catch (e) {
      setError((e as Error).message || '创建失败')
    }
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      await saveFolders(Array.from(selected))
      if (lastSelectedId != null && selected.has(lastSelectedId)) onSaved(lastSelectedId)
      onClose()
    } catch (e) {
      setError((e as Error).message || '保存失败')
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="选择收藏夹"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg dark:text-gray-100">加入收藏夹</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="关闭"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-2.5 rounded-xl mb-3 text-sm">
            {error}
          </div>
        )}

        {folders.length === 0 && !creating && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            还没有收藏夹，先新建一个吧
          </p>
        )}

        <div className="space-y-1.5 mb-3 max-h-56 overflow-auto">
          {folders.map((f) => (
            <label
              key={f.id}
              className="flex items-center gap-3 p-2.5 rounded-xl border dark:border-slate-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/60 transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(f.id!)}
                onChange={() => toggleSelect(f.id!)}
                className="w-4 h-4 accent-indigo-500"
              />
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: f.color }}
              />
              <span className="text-sm dark:text-gray-200">{f.name}</span>
              {f.name === DEFAULT_FOLDER_NAME && (
                <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500">默认</span>
              )}
            </label>
          ))}
        </div>

        {creating ? (
          <div className="border-t border-gray-100 dark:border-slate-700 pt-3 space-y-2.5">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="收藏夹名称"
              className="input-field text-sm"
              autoFocus
            />
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  aria-label={`选择颜色 ${c}`}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    newColor === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setCreating(false); setError('') }} className="btn-secondary flex-1 py-2 text-sm">
                取消
              </button>
              <button type="button" onClick={handleCreate} disabled={!newName.trim()} className="btn-primary flex-1 py-2 text-sm">
                创建并勾选
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setCreating(true); setError('') }}
            className="w-full py-2 rounded-xl border border-dashed border-gray-300 dark:border-slate-600 text-sm text-gray-500 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-300 transition-colors flex items-center justify-center gap-1"
          >
            <Plus size={14} /> 新建收藏夹
          </button>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full mt-4"
        >
          {saving ? '保存中...' : `确定 (${selected.size})`}
        </button>
      </div>
    </div>
  )
}
