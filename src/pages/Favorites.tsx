import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Heart, Upload } from 'lucide-react'
import {
  useFavoriteWords,
  useCategories,
  toggleFavorite,
  deleteWord,
  bulkSetFavorite,
  bulkSetCategory,
  bulkDeleteWords,
} from '../hooks/useWords'
import {
  useFavoriteSentences,
  toggleSentenceFavorite,
  deleteSentence,
  bulkSetSentenceFavorite,
  bulkSetSentenceCategory,
  bulkDeleteSentences,
} from '../hooks/useSentences'
import { SelectableWordList } from '../components/SelectableWordList'
import { SentenceCard } from '../components/SentenceCard'
import { BackButton } from '../components/BackButton'
import { useToast } from '../components/Toast'
import { enhancedSearch } from '../utils/search'
import { Sentence } from '../types/word'

type Tab = 'word' | 'sentence'

export function Favorites() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const words = useFavoriteWords()
  const sentences = useFavoriteSentences()
  const categories = useCategories()

  const [tab, setTab] = useState<Tab>('word')
  const [search, setSearch] = useState('')
  const [showMove, setShowMove] = useState(false)
  const [moveIds, setMoveIds] = useState<number[]>([])

  const handleMoveToWord = async (cat: string) => {
    await bulkSetCategory(moveIds, cat)
    toast('success', `已移动 ${moveIds.length} 个单词到「${cat}」`)
    setShowMove(false)
    setMoveIds([])
  }

  const handleMoveToSentence = async (cat: string) => {
    await bulkSetSentenceCategory(moveIds, cat)
    toast('success', `已移动 ${moveIds.length} 个短句到「${cat}」`)
    setShowMove(false)
    setMoveIds([])
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

      {/* 单词 | 短句 切换 */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setTab('word')}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
            tab === 'word'
              ? 'bg-primary-500 text-white'
              : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
          }`}
        >
          单词 {words.length > 0 && `(${words.length})`}
        </button>
        <button
          onClick={() => setTab('sentence')}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
            tab === 'sentence'
              ? 'bg-primary-500 text-white'
              : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
          }`}
        >
          短句 {sentences.length > 0 && `(${sentences.length})`}
        </button>
      </div>

      {tab === 'word' ? (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">共 {words.length} 个</span>
            <Link
              to="/import?favorite=1"
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
            >
              <Upload size={14} /> 导入并收藏
            </Link>
          </div>

          <SelectableWordList
            words={words}
            search={search}
            onSearchChange={setSearch}
            onWordClick={(w) => navigate(`/word/${w.id}?scope=favorites`)}
            onFavorite={(w) => toggleFavorite(w.id!, w.isFavorite)}
            onDelete={(w) => {
              if (confirm('确定删除?')) {
                deleteWord(w.id!)
                toast('success', '单词已删除')
              }
            }}
            emptyText="收藏夹是空的"
            emptyHint="在单词详情页点心形图标即可收藏"
            emptyAction={{ label: '批量导入并收藏', href: '/import?favorite=1' }}
            batchActions={{
              onMoveToCategory: (ids) => {
                setMoveIds(ids)
                setShowMove(true)
              },
              onUnfavoriteAll: (ids) => {
                bulkSetFavorite(ids, false)
                toast('success', '已取消收藏')
              },
              onDeleteAll: (ids) => {
                if (confirm(`确定删除选中的 ${ids.length} 个单词?`)) {
                  bulkDeleteWords(ids)
                  toast('success', '已删除选中单词')
                }
              },
            }}
          />
        </>
      ) : (
        <>
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
            onFavorite={(s) => toggleSentenceFavorite(s.id!, s.isFavorite)}
            onDelete={(s) => {
              if (confirm('确定删除?')) {
                deleteSentence(s.id!)
                toast('success', '短句已删除')
              }
            }}
            renderItem={renderSentence}
            matchSearch={(q, s) => {
              const defs = s.definitions ?? []
              const defsText = defs.map((d: any) => `${d.pos ?? ''} ${d.def ?? ''} ${d.trans ?? ''}`).join(' ')
              return enhancedSearch(q, { word: s.sentence, translation: s.translation, definition: defsText })
            }}
            emptyText="收藏夹暂无短句"
            emptyHint="在短句详情页点心形图标即可收藏"
            emptyAction={{ label: '批量导入并收藏', href: '/sentences/import?favorite=1' }}
            batchActions={{
              onMoveToCategory: (ids) => {
                setMoveIds(ids)
                setShowMove(true)
              },
              onUnfavoriteAll: (ids) => {
                bulkSetSentenceFavorite(ids, false)
                toast('success', '已取消收藏')
              },
              onDeleteAll: (ids) => {
                if (confirm(`确定删除选中的 ${ids.length} 个短句?`)) {
                  bulkDeleteSentences(ids)
                  toast('success', '已删除选中短句')
                }
              },
            }}
          />
        </>
      )}

      {showMove && (
        <div className="modal-overlay">
          <div className="modal-content max-h-[80vh] overflow-auto">
            <h3 className="font-bold text-lg mb-4 dark:text-gray-100">移动到分类</h3>
            <div className="space-y-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() =>
                    tab === 'word' ? handleMoveToWord(cat.name) : handleMoveToSentence(cat.name)
                  }
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
    </div>
  )
}
