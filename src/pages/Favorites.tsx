import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Heart, Upload, Plus, Pencil, Trash2, FolderHeart } from 'lucide-react'
import { useLang } from '../context/Language'
import {
  useLangFavoriteFolders,
  useLangFolderMembers,
  useLangCategories,
  createLangFolder,
  renameLangFolder,
  updateLangFolderColor,
  deleteLangFolder,
  setLangItemFolders,
  deleteLangWord,
  bulkSetLangCategory,
  bulkSetLangFavorite,
  bulkDeleteLangWords,
} from '../hooks/languageAware'
import { DEFAULT_FOLDER_NAME } from '../hooks/useFavorites'
import { useAllWords } from '../hooks/useWords'
import { useAllJapaneseWords } from '../hooks/useJapaneseWords'
import {
  useAllSentences,
  deleteSentence,
  bulkSetSentenceCategory,
  bulkSetSentenceFavorite,
  bulkDeleteSentences,
} from '../hooks/useSentences'
import { SelectableWordList } from '../components/SelectableWordList'
import { JapaneseWordCard } from '../components/JapaneseWordCard'
import { ConfirmModal } from '../components/ConfirmModal'
import { SentenceCard } from '../components/SentenceCard'
import { BackButton } from '../components/BackButton'
import { useToast } from '../components/Toast'
import { enhancedSearch } from '../utils/search'
import { Word, Sentence, FavoriteFolder, JapaneseWord } from '../types/word'

type Tab = 'word' | 'sentence'

const PRESET_COLORS = [
  '#d8785d', '#2f6b5c', '#6e9f84', '#c89236', '#477f61',
  '#5f9b78', '#c4654d', '#e0b15b', '#d8785d', '#245749',
]

function matchJapaneseSearch(query: string, w: JapaneseWord): boolean {
  const q = query.trim().toLowerCase()
  const haystack = [
    w.word,
    w.reading,
    w.accent,
    w.partOfSpeech,
    w.notes,
    w.category,
    ...(w.definitions ?? []).flatMap((d) => [d.pos, d.meaning, d.translation]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}

export function Favorites() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const isJa = useLang() === 'ja'
  const folders = useLangFavoriteFolders()
  const allWords = useAllWords()
  const allJapaneseWords = useAllJapaneseWords()
  const allSentences = useAllSentences()

  const [activeFolderId, setActiveFolderId] = useState<number | 'all'>('all')
  const members = useLangFolderMembers(activeFolderId)

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

  // 当前夹内的实体（按类型过滤）
  const jaEntityIds = new Set(
    members.filter((m) => m.entityType === 'japaneseWord').map((m) => m.entityId)
  )
  const wordIdSet = new Set(
    members.filter((m) => m.entityType === 'word').map((m) => m.entityId)
  )
  const sentenceIdSet = new Set(
    members.filter((m) => m.entityType === 'sentence').map((m) => m.entityId)
  )
  // 同一条目可能在多个夹 → 去重，保持词库排序
  const japaneseWords: JapaneseWord[] = allJapaneseWords.filter((w) => jaEntityIds.has(w.id!))
  const words: Word[] = allWords.filter((w) => wordIdSet.has(w.id!))
  const sentences: Sentence[] = allSentences.filter((s) => sentenceIdSet.has(s.id!))

  const activeFolder = folders.find((f) => f.id === activeFolderId)

  const handleMoveToWord = async (cat: string) => {
    await bulkSetLangCategory(moveWordIds, cat)
    toast('success', `已移动 ${moveWordIds.length} 个${isJa ? '日语词' : '单词'}到「${cat}」`)
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

  // 移动分类弹窗的分类候选（顶层调用 hook，避免条件渲染违反规则）
  const categories = useLangCategories()
  const moveCandidates = categories.filter((c) => {
    if (isJa || tab === 'word') return !c.entityType || c.entityType === 'word'
    return !c.entityType || c.entityType === 'sentence'
  })

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

      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          共 {isJa ? japaneseWords.length : tab === 'word' ? words.length : sentences.length} 个
        </span>
        <Link
          to={isJa ? '/import?favorite=1' : tab === 'word' ? '/import?favorite=1' : '/sentences/import?favorite=1'}
          className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
        >
          <Upload size={14} /> 导入并收藏
        </Link>
      </div>

      {/* 实体 Tab（日语模式只有日语词，隐藏 Tab） */}
      {!isJa && (
        <div className="flex gap-2 mb-3">
          <TabButton active={tab === 'word'} onClick={() => setTab('word')} label={`单词${wordIdSet.size > 0 ? ` (${wordIdSet.size})` : ''}`} />
          <TabButton active={tab === 'sentence'} onClick={() => setTab('sentence')} label={`短句${sentenceIdSet.size > 0 ? ` (${sentenceIdSet.size})` : ''}`} />
        </div>
      )}

      {isJa ? (
        <SelectableWordList<JapaneseWord>
          words={japaneseWords}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="搜索表记、假名、释义..."
          onWordClick={(w) => navigate(`/word/${w.id}?scope=favorites`)}
          onFavorite={(w) =>
            setLangItemFolders(w.id!, []).then(() => toast('success', '已取消收藏'))
          }
          onDelete={(w) => setConfirmDeleteWordId(w.id!)}
          renderItem={(w, actions) => <JapaneseWordCard word={w} {...actions} />}
          matchSearch={matchJapaneseSearch}
          emptyText={activeFolderId === 'all' ? '收藏夹暂无日语词' : `「${activeFolder?.name ?? ''}」还没有内容`}
          emptyHint="在学习页点击心形图标即可加入收藏"
          emptyAction={{ label: '批量导入并收藏', href: '/import?favorite=1' }}
          batchActions={{
            onMoveToCategory: (ids) => {
              setMoveWordIds(ids)
              setShowMove(true)
            },
            onUnfavoriteAll: (ids) => {
              Promise.all(ids.map((id) => setLangItemFolders(id, [])))
              toast('success', '已取消收藏')
            },
            onDeleteAll: (ids) => {
              setBatchWordIds(ids)
              setConfirmBatchWordDelete(true)
            },
          }}
        />
      ) : tab === 'word' ? (
        <SelectableWordList
          words={words}
          search={search}
          onSearchChange={setSearch}
          onWordClick={(w) => navigate(`/word/${w.id}?scope=favorites`)}
          onFavorite={(w) =>
            bulkSetLangFavorite([w.id!], false).then(() => toast('success', '已取消收藏'))
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
              bulkSetLangFavorite(ids, false)
              toast('success', '已取消收藏')
            },
            onDeleteAll: (ids) => {
              setBatchWordIds(ids)
              setConfirmBatchWordDelete(true)
            },
          }}
        />
      ) : (
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
      )}

      {/* 移动到分类 */}
      {showMove && (
        <div className="modal-overlay">
          <div className="modal-content max-h-[80vh] overflow-auto">
            <h3 className="font-bold text-lg mb-4 dark:text-gray-100">移动到分类</h3>
            <div className="space-y-2">
              {moveCandidates.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() =>
                    tab === 'word' || isJa ? handleMoveToWord(cat.name) : handleMoveToSentence(cat.name)
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
          title={isJa ? '删除日语词?' : '删除单词?'}
          message="删除后不可恢复（相关学习记录、计划引用与收藏会一并清理）"
          confirmText="删除"
          onConfirm={async () => {
            await deleteLangWord(confirmDeleteWordId)
            toast('success', isJa ? '日语词已删除' : '单词已删除')
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
          title={isJa ? '删除选中的日语词?' : '删除选中的单词?'}
          message={`共 ${batchWordIds.length} 个`}
          confirmText="删除"
          onConfirm={async () => {
            await bulkDeleteLangWords(batchWordIds)
            toast('success', `已删除 ${batchWordIds.length} 个`)
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
  const isDefault = folder?.name === DEFAULT_FOLDER_NAME
  const [name, setName] = useState(folder?.name ?? '')
  const [color, setColor] = useState(folder?.color ?? PRESET_COLORS[1])
  const [error, setError] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)

  const handleSave = async () => {
    setError('')
    try {
      if (mode === 'add') {
        await createLangFolder(name, color)
        toast('success', `收藏夹「${name.trim()}」已创建`)
      } else if (folder?.id) {
        await renameLangFolder(folder.id, name)
        await updateLangFolderColor(folder.id, color)
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
      await deleteLangFolder(folder.id)
      toast('success', `收藏夹「${folder.name}」已删除（内容不受影响）`)
      onClose()
    } catch (e) {
      setError((e as Error).message || '删除失败')
      setConfirmDel(false)
    }
  }

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
            message={`「${folder?.name}」中的收藏条目将被移除，词条本身不受影响`}
            confirmText="删除"
            onConfirm={handleDelete}
            onCancel={() => setConfirmDel(false)}
          />
        )}
      </div>
    </div>
  )
}
