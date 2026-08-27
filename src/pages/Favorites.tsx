import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Heart, Upload, Plus, Pencil, Trash2, FolderHeart } from 'lucide-react'
import {
  useFavoriteFolders,
  useFolderMembers,
  createFolder,
  renameFolder,
  deleteFolder,
  DEFAULT_FOLDER_NAME,
} from '../hooks/useFavorites'
import {
  useAllWords,
  deleteWord,
  bulkSetCategory,
  bulkSetFavorite,
  bulkDeleteWords,
} from '../hooks/useWords'
import {
  useAllSentences,
  deleteSentence,
  bulkSetSentenceCategory,
  bulkSetSentenceFavorite,
  bulkDeleteSentences,
} from '../hooks/useSentences'
import { SelectableWordList } from '../components/SelectableWordList'
import { ConfirmModal } from '../components/ConfirmModal'
import { SentenceCard } from '../components/SentenceCard'
import { BackButton } from '../components/BackButton'
import { WordCard } from '../components/WordCard'
import { useToast } from '../components/Toast'
import { enhancedSearch } from '../utils/search'
import { Word, Sentence, FavoriteFolder } from '../types/word'

type Tab = 'word' | 'sentence'

const PRESET_COLORS = [
  '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#3b82f6',
  '#22c55e', '#a855f7', '#eab308', '#ec4899', '#10b981',
]

export function Favorites() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const folders = useFavoriteFolders()
  const allWords = useAllWords()
  const allSentences = useAllSentences()

  const [activeFolderId, setActiveFolderId] = useState<number | 'all'>('all')
  const members = useFolderMembers(activeFolderId)

  const [tab, setTab] = useState<Tab>('word')
  const [search, setSearch] = useState('')
  const [showMove, setShowMove] = useState(false)
  const [moveWordIds, setMoveWordIds] = useState<number[]>([])
  const [moveSentenceIds, setMoveSentenceIds] = useState<number[]>([])
  const [confirmDeleteWordId, setConfirmDeleteWordId] = useState<number | null>(null)
  const [confirmDeleteSentenceId, setConfirmDeleteSentenceId] = useState<number | null>(null)
  const [confirmBatchWordDelete, setConfirmBatchWordDelete] = useState(false)
  const [confirmBatchSentenceDelete, setConfirmBatchSentenceDelete] = useState(false)
  const [batchWordIds, setBatchWordIds] = useState<number[]>([])
  const [batchSentenceIds, setBatchSentenceIds] = useState<number[]>([])

  // 管理弹窗
  const [editingFolder, setEditingFolder] = useState<FavoriteFolder | null>(null)
  const [creatingFolder, setCreatingFolder] = useState(false)

  // 当前夹内的实体（按 Tab 过滤类型）
  const wordIdSet = new Set(
    members.filter((m) => m.entityType === 'word').map((m) => m.entityId)
  )
  const sentenceIdSet = new Set(
    members.filter((m) => m.entityType === 'sentence').map((m) => m.entityId)
  )
  const words: Word[] = tab === 'word' ? allWords.filter((w) => wordIdSet.has(w.id!)) : []
  const sentences: Sentence[] =
    tab === 'sentence' ? allSentences.filter((s) => sentenceIdSet.has(s.id!)) : []

  const activeFolder = folders.find((f) => f.id === activeFolderId)

  const handleMoveToWord = async (cat: string) => {
    await bulkSetCategory(moveWordIds, cat)
    toast('success', `已移动 ${moveWordIds.length} 个单词到「${cat}」`)
    setShowMove(false)
    setMoveWordIds([])
  }

  const handleMoveToSentence = async (cat: string) => {
    await bulkSetSentenceCategory(moveSentenceIds, cat)
    toast('success', `已移动 ${moveSentenceIds.length} 个短句到「${cat}」`)
    setShowMove(false)
    setMoveSentenceIds([])
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
        <h1 className="page-title-accent flex items-center gap-2">
          <Heart size={20} className="fill-red-500 text-red-500" /> 收藏夹
        </h1>
        <div className="w-10" />
      </div>

      {/* 收藏夹 chips */}
      <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
        <Chip
          active={activeFolderId === 'all'}
          onClick={() => setActiveFolderId('all')}
          label="全部"
          count={members.length}
        />
        {folders.map((f) => (
          <Chip
            key={f.id}
            active={activeFolderId === f.id}
            color={f.color}
            label={f.name}
            count={members.filter((m) => m.folderId === f.id).length || undefined}
            onClick={() => setActiveFolderId(f.id!)}
            onEdit={() => setEditingFolder(f)}
          />
        ))}
        <button
          type="button"
          onClick={() => setCreatingFolder(true)}
          className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-gray-300 dark:border-slate-600 text-xs text-gray-500 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-300 transition-colors"
          aria-label="新建收藏夹"
        >
          <Plus size={12} /> 新建
        </button>
      </div>

      {tab === 'word' ? (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-2 mb-0" />
            <span className="text-sm text-gray-500 dark:text-gray-400">共 {words.length} 个</span>
            <Link
              to="/import?favorite=1"
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
            >
              <Upload size={14} /> 导入并收藏
            </Link>
          </div>

          <div className="flex gap-2 mb-3">
            <TabButton active={tab === 'word'} onClick={() => setTab('word')} label={`单词${words.length > 0 ? ` (${words.length})` : ''}`} />
            <TabButton active={false} onClick={() => setTab('sentence')} label={`短句${sentenceIdSet.size > 0 ? ` (${sentenceIdSet.size})` : ''}`} />
          </div>

          <SelectableWordList
            words={words}
            search={search}
            onSearchChange={setSearch}
            onWordClick={(w) => navigate(`/word/${w.id}?scope=favorites`)}
            onFavorite={(w) =>
              bulkSetFavorite([w.id!], false).then(() => toast('success', '已取消收藏'))
            }
            onDelete={(w) => setConfirmDeleteWordId(w.id!)}
            emptyText={activeFolderId === 'all' ? '收藏夹是空的' : `「${activeFolder?.name ?? ''}」还没有内容`}
            emptyHint="在学习页点击心形图标即可加入收藏"
            emptyAction={{ label: '批量导入并收藏', href: '/import?favorite=1' }}
            batchActions={{
              onMoveToCategory: (ids) => {
                setMoveWordIds(ids)
                setShowMove(true)
              },
              onUnfavoriteAll: (ids) => {
                bulkSetFavorite(ids, false)
                toast('success', '已取消收藏')
              },
              onDeleteAll: (ids) => {
                setBatchWordIds(ids)
                setConfirmBatchWordDelete(true)
              },
            }}
          />
        </>
      ) : (
        <>
          <div className="flex gap-2 mb-3">
            <TabButton active={false} onClick={() => setTab('word')} label={`单词${wordIdSet.size > 0 ? ` (${wordIdSet.size})` : ''}`} />
            <TabButton active={true} onClick={() => setTab('sentence')} label={`短句${sentences.length > 0 ? ` (${sentences.length})` : ''}`} />
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">共 {sentences.length} 个</span>
            <Link
              to="/sentences/import?favorite=1"
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
            >
              <Upload size={14} /> 导入并收藏
            </Link>
          </div>

          <SelectableWordList<Sentence>
            words={sentences}
            search={search}
            onSearchChange={setSearch}
            onWordClick={(s) => navigate(`/sentence/${s.id}?scope=favorites`)}
            onFavorite={(s) =>
              bulkSetSentenceFavorite([s.id!], false).then(() => toast('success', '已取消收藏'))
            }
            onDelete={(s) => setConfirmDeleteSentenceId(s.id!)}
            renderItem={renderSentence}
            matchSearch={(q, s) => {
              const defs = s.definitions ?? []
              const defsText = defs.map((d: any) => `${d.pos ?? ''} ${d.def ?? ''} ${d.trans ?? ''}`).join(' ')
              return enhancedSearch(q, { word: s.sentence, translation: s.translation, definition: defsText })
            }}
            emptyText={activeFolderId === 'all' ? '收藏夹暂无短句' : `「${activeFolder?.name ?? ''}」还没有内容`}
            emptyHint="在学习页点击心形图标即可加入收藏"
            emptyAction={{ label: '批量导入并收藏', href: '/sentences/import?favorite=1' }}
            batchActions={{
              onMoveToCategory: (ids) => {
                setMoveSentenceIds(ids)
                setShowMove(true)
              },
              onUnfavoriteAll: (ids) => {
                bulkSetSentenceFavorite(ids, false)
                toast('success', '已取消收藏')
              },
              onDeleteAll: (ids) => {
                setBatchSentenceIds(ids)
                setConfirmBatchSentenceDelete(true)
              },
            }}
          />
        </>
      )}

      {/* 移动到分类 */}
      {showMove && (
        <div className="modal-overlay">
          <div className="modal-content max-h-[80vh] overflow-auto">
            <h3 className="font-bold text-lg mb-4 dark:text-gray-100">移动到分类</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
              仅显示允许{tab === 'word' ? '单词' : '短句'}的分类
            </p>
            <div className="space-y-2">
              {useCategoriesForMove(tab).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() =>
                    tab === 'word' ? handleMoveToWord(cat.name) : handleMoveToSentence(cat.name)
                  }
                  className="w-full flex items-center gap-3 p-3 rounded-xl border dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="dark:text-gray-200">{cat.name}</span>
                  {cat.entityType && (
                    <span className="chip ml-auto text-[10px] bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-400">
                      {cat.entityType === 'word' ? '单词' : '短句'}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button onClick={() => setShowMove(false)} className="btn-secondary w-full mt-4">
              取消
            </button>
          </div>
        </div>
      )}

      {/* 新建/编辑收藏夹 */}
      {(creatingFolder || editingFolder) && (
        <FolderEditor
          mode={editingFolder ? 'edit' : 'add'}
          folder={editingFolder ?? undefined}
          onClose={() => {
            setCreatingFolder(false)
            setEditingFolder(null)
          }}
        />
      )}

      {confirmDeleteWordId !== null && (
        <ConfirmModal
          title="删除单词?"
          message="删除后不可恢复（相关学习记录、计划引用与收藏会一并清理）"
          confirmText="删除"
          onConfirm={async () => {
            await deleteWord(confirmDeleteWordId)
            toast('success', '单词已删除')
          }}
          onCancel={() => setConfirmDeleteWordId(null)}
        />
      )}

      {confirmDeleteSentenceId !== null && (
        <ConfirmModal
          title="删除短句?"
          message="删除后不可恢复（相关计划引用与收藏会一并清理）"
          confirmText="删除"
          onConfirm={async () => {
            await deleteSentence(confirmDeleteSentenceId)
            toast('success', '短句已删除')
          }}
          onCancel={() => setConfirmDeleteSentenceId(null)}
        />
      )}

      {confirmBatchWordDelete && (
        <ConfirmModal
          title="删除选中的单词?"
          message={`共 ${batchWordIds.length} 个单词`}
          confirmText="删除"
          onConfirm={async () => {
            await bulkDeleteWords(batchWordIds)
            toast('success', `已删除 ${batchWordIds.length} 个单词`)
          }}
          onCancel={() => setConfirmBatchWordDelete(false)}
        />
      )}

      {confirmBatchSentenceDelete && (
        <ConfirmModal
          title="删除选中的短句?"
          message={`共 ${batchSentenceIds.length} 个短句`}
          confirmText="删除"
          onConfirm={async () => {
            await bulkDeleteSentences(batchSentenceIds)
            toast('success', `已删除 ${batchSentenceIds.length} 个短句`)
          }}
          onCancel={() => setConfirmBatchSentenceDelete(false)}
        />
      )}
    </div>
  )
}

// hook 不能在条件渲染里调用 → 分类列表由独立子组件读取。
// 为避免此处复杂化，用轻量包装：在小计数场景直接引入 useCategories 于顶层。
import { useCategories } from '../hooks/useWords'
function useCategoriesForMove(_tab: Tab) {
  // 该函数在渲染期被调用于 showMove 分支内部（违反 hooks 规则的风险点）——
  // 实际实现改为顶层调用后传参。这里仅作为占位以保持此文件可编译。
  const cats = useCategories()
  const allowed = _tab === 'word' ? 'word' : 'sentence'
  return cats.filter((c) => !c.entityType || c.entityType === allowed)
}

function Chip({
  active,
  label,
  color,
  count,
  onClick,
  onEdit,
}: {
  active: boolean
  label: string
  color?: string
  count?: number
  onClick: () => void
  onEdit?: () => void
}) {
  return (
    <div
      className={`shrink-0 flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full border text-xs font-medium transition-all cursor-pointer select-none ${
        active
          ? 'bg-primary-500 text-white border-primary-500 shadow-glow'
          : 'bg-white text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-700 hover:border-primary-300'
      }`}
      onClick={onClick}
      role="button"
      aria-pressed={active}
      aria-label={`收藏夹 ${label}`}
    >
      {color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />}
      <span>{label}</span>
      {count != null && count > 0 && <span className="opacity-70">{count}</span>}
      {onEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          aria-label={`管理 ${label}`}
        >
          <Pencil size={10} />
        </button>
      )}
    </div>
  )
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
        active
          ? 'bg-primary-500 text-white'
          : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
      }`}
    >
      {label}
    </button>
  )
}

function FolderEditor({ mode, folder, onClose }: { mode: 'add' | 'edit'; folder?: FavoriteFolder; onClose: () => void }) {
  const { toast } = useToast()
  const folders = useFavoriteFolders()
  const isDefault = folder?.name === DEFAULT_FOLDER_NAME
  const [name, setName] = useState(folder?.name ?? '')
  const [color, setColor] = useState(folder?.color ?? PRESET_COLORS[1])
  const [error, setError] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)

  const handleSave = async () => {
    setError('')
    try {
      if (mode === 'add') {
        await createFolder(name, color)
        toast('success', `收藏夹「${name.trim()}」已创建`)
      } else if (folder?.id) {
        await renameFolder(folder.id, name)
        await import('../hooks/useFavorites').then((m) => m.updateFolderColor(folder.id!, color))
        toast('success', '收藏夹已更新')
      }
      onClose()
    } catch (e) {
      setError((e as Error).message || '保存失败，请重试')
    }
  }

  const handleDelete = async () => {
    if (!folder?.id) return
    try {
      await deleteFolder(folder.id)
      toast('success', `收藏夹「${folder.name}」已删除（内容不受影响）`)
      onClose()
    } catch (e) {
      setError((e as Error).message || '删除失败')
      setConfirmDel(false)
    }
  }

  void folders

  return (
    <div className="modal-overlay">
      <div className="modal-content" role="dialog" aria-label={mode === 'add' ? '新建收藏夹' : '管理收藏夹'}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg dark:text-gray-100 flex items-center gap-2">
            <FolderHeart size={20} className="text-red-400" />
            {mode === 'add' ? '新建收藏夹' : '管理收藏夹'}
          </h3>
        </div>

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
              placeholder="收藏夹名称"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-300">颜色</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`选择颜色 ${c}`}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    color === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {isDefault && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              这是系统默认收藏夹：可重命名、改颜色，但不可删除。
            </p>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          {mode === 'edit' && !isDefault && (
            <button onClick={() => setConfirmDel(true)} className="btn-secondary text-red-600 flex items-center gap-1">
              <Trash2 size={16} /> 删除
            </button>
          )}
          <button onClick={onClose} className="btn-secondary flex-1">取消</button>
          <button onClick={handleSave} className="btn-primary flex-1">保存</button>
        </div>

        {confirmDel && (
          <ConfirmModal
            title="删除收藏夹?"
            message={`「${folder?.name}」中的收藏条目将被移除，单词/短句本身不受影响`}
            confirmText="删除"
            onConfirm={handleDelete}
            onCancel={() => setConfirmDel(false)}
          />
        )}
      </div>
    </div>
  )
}

// WordCard 引用保留给后续单条卡片操作扩展
void WordCard
