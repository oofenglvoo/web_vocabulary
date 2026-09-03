import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Upload, Plus, FolderOpen, Download } from 'lucide-react'
import { useLang } from '../context/Language'
import {
  useLangWordsByCategory,
  useLangCategories,
  toggleLangFavorite,
  deleteLangWord,
  bulkSetLangFavorite,
  bulkSetLangCategory,
  bulkDeleteLangWords,
} from '../hooks/languageAware'
import {
  useSentencesByCategory,
  toggleSentenceFavorite,
  deleteSentence,
  bulkSetSentenceFavorite,
  bulkSetSentenceCategory,
  bulkDeleteSentences,
} from '../hooks/useSentences'
import { SelectableWordList } from '../components/SelectableWordList'
import { JapaneseWordCard } from '../components/JapaneseWordCard'
import { ConfirmModal } from '../components/ConfirmModal'
import { SentenceCard } from '../components/SentenceCard'
import { EmptyState } from '../components/EmptyState'
import { BackButton } from '../components/BackButton'
import { useToast } from '../components/Toast'
import { enhancedSearch } from '../utils/search'
import { Sentence, JapaneseWord, Word } from '../types/word'
import type { LangWord } from '../hooks/languageAware'
import { downloadFile, exportJapaneseWordsToCsv, exportJapaneseWordsToJson, exportWordsToCsv, exportWordsToJson } from '../utils/export'

type Tab = 'word' | 'sentence'

function matchJapaneseSearch(query: string, w: LangWord): boolean {
  const jaW = w as JapaneseWord
  const q = query.trim().toLowerCase()
  const haystack = [
    w.word,
    jaW.reading,
    jaW.accent,
    jaW.partOfSpeech,
    jaW.notes,
    w.category,
    ...(jaW.definitions ?? []).flatMap((d) => [d.pos, d.meaning, d.translation]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}

export function CategoryDetail() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const isJa = useLang() === 'ja'
  const decoded = name ? decodeURIComponent(name) : ''
  const words = useLangWordsByCategory(decoded)
  const sentences = useSentencesByCategory(decoded)
  const categories = useLangCategories()

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

  // 缺失分类名时给出兜底页，而不是渲染空白标题
  if (!decoded) {
    return (
      <div className="p-4">
        <BackButton />
        <EmptyState
          icon={<FolderOpen size={32} className="text-gray-300 dark:text-gray-600" />}
          title="分类不存在"
          description="请返回分类列表重新选择"
        />
      </div>
    )
  }

  const cat = categories.find((c) => c.name === decoded)
  const importHref = `/import?category=${encodeURIComponent(decoded)}`
  const addHref = `/add?category=${encodeURIComponent(decoded)}`
  const sentenceImportHref = `/sentences/import?category=${encodeURIComponent(decoded)}`
  const sentenceAddHref = `/sentences/add?category=${encodeURIComponent(decoded)}`

  const exportCategoryWords = async (format: 'json' | 'csv') => {
    const date = new Date().toISOString().slice(0, 10)
    const safeName = decoded.replace(/[\\/:*?"<>|]/g, '_')
    if (isJa) {
      const content = format === 'json'
        ? exportJapaneseWordsToJson(words as JapaneseWord[])
        : exportJapaneseWordsToCsv(words as JapaneseWord[])
      await downloadFile(content, `${safeName}-日语词-${date}.${format}`, format === 'json' ? 'application/json' : 'text/csv')
      return
    }
    const content = format === 'json' ? exportWordsToJson(words as Word[]) : exportWordsToCsv(words as Word[])
    await downloadFile(content, `${safeName}-单词-${date}.${format}`, format === 'json' ? 'application/json' : 'text/csv')
  }

  // 分类内容形态：
  // - 日语模式 → 恒为单词视图（日语词库无短句）
  // - 双侧都有内容（旧混合数据 / 异常数据）→ 双 Tab 只读浏览，锁定新增（优先判定）
  // - 已定型 → 单一视图（无 Tab）
  // - 未定型 + 空 → 初始选择（选择后写入即定型）
  // - 未定型 + 单侧有内容 → 按内容渲染
  const jaMode: 'word' | 'choose' = words.length > 0 ? 'word' : 'choose'
  const typedView: Tab | undefined =
    cat?.entityType === 'word' ? 'word' : cat?.entityType === 'sentence' ? 'sentence' : undefined
  let contentMode: 'word' | 'sentence' | 'choose' | 'mixed'
  if (isJa) {
    contentMode = jaMode
  } else if (words.length > 0 && sentences.length > 0) {
    contentMode = 'mixed'
  } else if (typedView) {
    contentMode = typedView
  } else if (words.length > 0) {
    contentMode = 'word'
  } else if (sentences.length > 0) {
    contentMode = 'sentence'
  } else {
    contentMode = 'choose'
  }
  // 混合模式下允许查看两个 Tab，但全部新增入口关闭
  const canAddWord = contentMode !== 'mixed' && (contentMode !== 'sentence')
  const canAddSentence = !isJa && contentMode !== 'mixed' && (contentMode !== 'word')

  const handleMoveToWord = async (target: string) => {
    if (target === decoded) {
      setShowMove(false)
      return
    }
    await bulkSetLangCategory(moveWordIds, target)
    toast('success', `已移动 ${moveWordIds.length} 个${isJa ? '日语词' : '单词'}到「${target}」`)
    setShowMove(false)
    setMoveWordIds([])
  }

  const handleMoveToSentence = async (target: string) => {
    if (target === decoded) {
      setShowMove(false)
      return
    }
    await bulkSetSentenceCategory(moveSentenceIds, target)
    toast('success', `已移动 ${moveSentenceIds.length} 个短句到「${target}」`)
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
          {cat && (
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
          )}
          {decoded}
        </h1>
        <div className="w-10" />
      </div>

      {/* 空分类未定型 → 初始选择，决定第一类内容 */}
      {contentMode === 'choose' ? (
        <div className="card p-6 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-primary flex items-center justify-center text-white shadow-glow">
            <FolderOpen size={26} />
          </div>
          <h3 className="font-bold text-lg mb-1 dark:text-gray-100">还没有内容</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
            {isJa
              ? '向本分类添加或导入日语词'
              : '请先选择要放入本分类的内容类型（选定后只存放这一种）'}
          </p>
          <div className={`grid gap-2 ${isJa ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <Link to={addHref} className="btn-primary py-2.5 text-sm">
              {isJa ? '添加日语词' : '添加单词'}
            </Link>
            {!isJa && (
              <Link
                to={sentenceAddHref}
                className="py-2.5 rounded-xl text-sm font-medium border border-primary-300 text-primary-600 dark:border-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all inline-flex items-center justify-center"
              >
                添加短句
              </Link>
            )}
          </div>
          <Link
            to={importHref}
            className="mt-3 inline-flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-sm font-medium border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-300 transition-all"
          >
            <Upload size={14} /> 批量导入{isJa ? '日语词' : '单词'}到本分类
          </Link>
        </div>
      ) : (
        <>
          {/* 仅混合模式显示 Tab 切换；定型分类直接展示对应区域 */}
          {contentMode === 'mixed' && (
            <>
              <div className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 p-3 rounded-xl mb-3 text-xs">
                此分类同时包含单词与短句（旧数据），已锁定新增。请将其中一类移出后自动定型。
              </div>
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
            </>
          )}

          {(contentMode === 'word' || (contentMode === 'mixed' && tab === 'word')) && (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  共 {words.length} 个{isJa ? '日语词' : '单词'}
                </span>
                {(canAddWord || words.length > 0) && (
                  <div className="flex gap-2">
                    {words.length > 0 && (
                      <div className="flex gap-2">
                        <button onClick={() => exportCategoryWords('json')} className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
                          <Download size={14} /> JSON
                        </button>
                        <button onClick={() => exportCategoryWords('csv')} className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
                          CSV
                        </button>
                      </div>
                    )}
                    {canAddWord && (
                      <>
                    <Link
                      to={addHref}
                      className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                    >
                      <Plus size={14} /> 添加
                    </Link>
                    <Link
                      to={importHref}
                      className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                    >
                      <Upload size={14} /> 批量导入
                    </Link>
                      </>
                    )}
                  </div>
                )}
              </div>

              <SelectableWordList
                words={words}
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder={isJa ? '搜索表记、假名、释义...' : '搜索单词、释义...'}
                onWordClick={(w) => navigate(`/word/${w.id}?scope=category&category=${encodeURIComponent(decoded)}&returnTo=${encodeURIComponent(`/categories/${decoded}`)}`)}
                onFavorite={(w) => toggleLangFavorite(w.id!, w.isFavorite)}
                onDelete={(w) => setConfirmDeleteWordId(w.id!)}
                renderItem={
                  isJa
                    ? (item, actions) => <JapaneseWordCard word={item as JapaneseWord} {...actions} />
                    : undefined
                }
                matchSearch={isJa ? matchJapaneseSearch : undefined}
                emptyText={isJa ? '该分类暂无日语词' : '该分类暂无单词'}
                emptyAction={canAddWord ? { label: '批量导入', href: importHref } : undefined}
                batchActions={{
                  onMoveToCategory: (ids) => {
                    setMoveWordIds(ids)
                    setShowMove(true)
                  },
                  onFavoriteAll: (ids) => {
                    bulkSetLangFavorite(ids, true)
                    toast('success', `已收藏 ${ids.length} 个${isJa ? '日语词' : '单词'}`)
                  },
                  onDeleteAll: (ids) => {
                    setBatchWordIds(ids)
                    setConfirmBatchWordDelete(true)
                  },
                }}
              />
            </>
          )}

          {(contentMode === 'sentence' || (contentMode === 'mixed' && tab === 'sentence')) && (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">共 {sentences.length} 个短句</span>
                {canAddSentence && (
                  <div className="flex gap-2">
                    <Link
                      to={sentenceAddHref}
                      className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                    >
                      <Plus size={14} /> 添加
                    </Link>
                    <Link
                      to={sentenceImportHref}
                      className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                    >
                      <Upload size={14} /> 批量导入
                    </Link>
                  </div>
                )}
              </div>

              <SelectableWordList<Sentence>
                words={sentences}
                search={search}
                onSearchChange={setSearch}
                onWordClick={(s) =>
                  navigate(`/sentence/${s.id}?scope=category&category=${encodeURIComponent(decoded)}`)
                }
                onFavorite={(s) => toggleSentenceFavorite(s.id!, s.isFavorite)}
                onDelete={(s) => setConfirmDeleteSentenceId(s.id!)}
                renderItem={renderSentence}
                matchSearch={(q, s) =>
                  enhancedSearch(q, { word: s.sentence, translation: s.translation, definition: (s.definitions ?? []).map((d: any) => `${d.pos ?? ''} ${d.def ?? ''} ${d.trans ?? ''}`).join(' ') })
                }
                emptyText="该分类暂无短句"
                emptyAction={canAddSentence ? { label: '批量导入', href: sentenceImportHref } : undefined}
                batchActions={{
                  onMoveToCategory: (ids) => {
                    setMoveSentenceIds(ids)
                    setShowMove(true)
                  },
                  onFavoriteAll: (ids) => {
                    bulkSetSentenceFavorite(ids, true)
                    toast('success', `已收藏 ${ids.length} 个短句`)
                  },
                  onDeleteAll: (ids) => {
                    setBatchSentenceIds(ids)
                    setConfirmBatchSentenceDelete(true)
                  },
                }}
              />
            </>
          )}
        </>
      )}

      {showMove && (
        <div className="modal-overlay">
          <div className="modal-content max-h-[80vh] overflow-auto">
            <h3 className="font-bold text-lg mb-4 dark:text-gray-100">移动到分类</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
              仅显示允许{tab === 'word' ? '单词' : '短句'}的分类
            </p>
            <div className="space-y-2">
              {categories
                .filter((c) => {
                  if (c.name === decoded) return false
                  // 目标必须未定型，或与本侧内容同类型（混合旧分类禁止再移入）
                  return !c.entityType || c.entityType === tab
                })
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() =>
                      tab === 'word' ? handleMoveToWord(c.name) : handleMoveToSentence(c.name)
                    }
                    className="w-full flex items-center gap-3 p-3 rounded-xl border dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="dark:text-gray-200">{c.name}</span>
                    {c.entityType && (
                      <span className="chip ml-auto text-[10px] bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-400">
                        {c.entityType === 'word' ? '单词' : '短句'}
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

      {confirmDeleteWordId !== null && (
        <ConfirmModal
          title={isJa ? '删除日语词?' : '删除单词?'}
          message="删除后不可恢复（相关学习记录与计划引用会一并清理）"
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
          message="删除后不可恢复（相关计划引用会一并清理）"
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
