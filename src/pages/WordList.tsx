import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Plus, Upload } from 'lucide-react'
import { useLang } from '../context/Language'
import {
  useLangWords,
  useLangCategories,
  toggleLangFavorite,
  deleteLangWord,
  bulkSetLangCategory,
  bulkSetLangFavorite,
  bulkDeleteLangWords,
  LangWord,
} from '../hooks/languageAware'
import { SelectableWordList } from '../components/SelectableWordList'
import { JapaneseWordCard } from '../components/JapaneseWordCard'
import { JapaneseWord } from '../types/word'
import { ConfirmModal } from '../components/ConfirmModal'
import { BackButton } from '../components/BackButton'
import { useToast } from '../components/Toast'

/** 日语词条搜索：表记/假名/词性/音调/笔记/释义 全覆盖 */
function matchJapaneseSearch(query: string, w: LangWord): boolean {
  const word = w as JapaneseWord
  const q = query.trim().toLowerCase()
  const haystack = [
    word.word,
    word.reading,
    word.accent,
    word.partOfSpeech,
    word.notes,
    word.category,
    ...(word.definitions ?? []).flatMap((d) => [d.pos, d.meaning, d.translation]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}

export function WordList() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const lang = useLang()
  const isJa = lang === 'ja'
  const words = useLangWords()
  const categories = useLangCategories()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('全部')
  const [showMove, setShowMove] = useState(false)
  const [moveIds, setMoveIds] = useState<number[]>([])
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false)
  const [batchDeleteIds, setBatchDeleteIds] = useState<number[]>([])

  // 记忆化分类列表，避免每次渲染都生成新数组
  const categoryList = useMemo(() => ['全部', ...new Set(words.map((w) => w.category))], [words])

  const filtered = category === '全部' ? words : words.filter((w) => w.category === category)

  const handleMoveTo = async (cat: string) => {
    await bulkSetLangCategory(moveIds, cat)
    toast('success', `已移动 ${moveIds.length} 个词条到「${cat}」`)
    setShowMove(false)
    setMoveIds([])
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <BackButton />
        <h1 className="page-title-accent">{isJa ? '日语词库' : '单词列表'}</h1>
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
        words={filtered}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={isJa ? '搜索表记、假名、释义...' : '搜索单词、释义...'}
        onWordClick={(w) => navigate(`/word/${w.id}?scope=all`)}
        onFavorite={(w) => toggleLangFavorite(w.id!, w.isFavorite)}
        onDelete={(w) => setConfirmDeleteId(w.id!)}
        categories={categoryList}
        category={category}
        onCategoryChange={setCategory}
        renderItem={
          isJa
            ? (item, actions) => <JapaneseWordCard word={item as JapaneseWord} {...actions} />
            : undefined
        }
        matchSearch={isJa ? matchJapaneseSearch : undefined}
        emptyText={isJa ? '暂无日语词' : '暂无单词'}
        emptyHint={
          isJa
            ? '点击右上角「导入」批量添加日语词，或「添加」手动录入'
            : '点击右上角「导入」批量添加单词，或「添加」手动录入'
        }
        batchActions={{
          onMoveToCategory: (ids) => { setMoveIds(ids); setShowMove(true) },
          onFavoriteAll: (ids) => { bulkSetLangFavorite(ids, true); toast('success', `已收藏 ${ids.length} 个词条`) },
          onDeleteAll: (ids) => { setBatchDeleteIds(ids); setConfirmBatchDelete(true) },
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

      {confirmDeleteId !== null && (
        <ConfirmModal
          title={isJa ? '删除日语词?' : '删除单词?'}
          message="删除后不可恢复（相关学习记录与计划引用会一并清理）"
          confirmText="删除"
          onConfirm={async () => {
            await deleteLangWord(confirmDeleteId)
            toast('success', isJa ? '日语词已删除' : '单词已删除')
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      {confirmBatchDelete && (
        <ConfirmModal
          title={isJa ? '删除选中的日语词?' : '删除选中的单词?'}
          message={`共 ${batchDeleteIds.length} 个词条`}
          confirmText="删除"
          onConfirm={async () => {
            await bulkDeleteLangWords(batchDeleteIds)
            toast('success', `已删除 ${batchDeleteIds.length} 个词条`)
          }}
          onCancel={() => setConfirmBatchDelete(false)}
        />
      )}
    </div>
  )
}
