import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Heart, Trash2, Volume2, FolderInput, ChevronLeft, ChevronRight, Plus, X, Pencil, Check } from 'lucide-react'
import {
  useSentenceById,
  deleteSentence,
  toggleSentenceFavorite,
  updateSentence,
  useAllSentences,
  useFavoriteSentences,
  useSentencesByCategory,
} from '../hooks/useSentences'
import { useCategories } from '../hooks/useWords'
import { speakWord } from '../utils/tts'
import { getSentenceDefinitions } from '../utils/definitions'
import { BackButton } from '../components/BackButton'
import { useToast } from '../components/Toast'
import { SkeletonCard } from '../components/Skeleton'
import { Definition } from '../types/word'

type Scope = 'all' | 'favorites' | 'category'

export function SentenceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()

  const sentence = useSentenceById(Number(id))
  const categories = useCategories()
  const [showMove, setShowMove] = useState(false)
  const [editingDefs, setEditingDefs] = useState(false)
  const [editDefinitions, setEditDefinitions] = useState<Definition[]>([])

  const scopeParam = (searchParams.get('scope') as Scope) || 'all'
  const scopeCategory = searchParams.get('category') || ''
  const scope: Scope =
    scopeParam === 'category' && scopeCategory
      ? 'category'
      : scopeParam === 'favorites'
      ? 'favorites'
      : 'all'

  const allSentences = useAllSentences()
  const favSentences = useFavoriteSentences()
  const catSentences = useSentencesByCategory(scopeCategory)

  const list =
    scope === 'favorites'
      ? favSentences
      : scope === 'category'
      ? catSentences
      : allSentences
  const currentIdx = list.findIndex((s) => s.id === Number(id))
  const prevItem = currentIdx > 0 ? list[currentIdx - 1] : null
  const nextItem = currentIdx >= 0 && currentIdx < list.length - 1 ? list[currentIdx + 1] : null

  const buildHref = (itemId: number) => {
    const params = new URLSearchParams()
    params.set('scope', scope)
    if (scope === 'category' && scopeCategory) params.set('category', scopeCategory)
    return `/sentence/${itemId}?${params.toString()}`
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName.match(/INPUT|TEXTAREA|SELECT/)) return
      if (e.key === 'ArrowLeft' && prevItem) navigate(buildHref(prevItem.id!))
      else if (e.key === 'ArrowRight' && nextItem) navigate(buildHref(nextItem.id!))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevItem?.id, nextItem?.id, scope, scopeCategory])

  if (!sentence) {
    return (
      <div className="p-4 space-y-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  const handleDelete = async () => {
    if (!confirm('确定删除这个短句吗?')) return
    const idToDelete = sentence.id!
    const after = nextItem ?? prevItem
    await deleteSentence(idToDelete)
    toast('success', '短句已删除')
    if (after) navigate(buildHref(after.id!), { replace: true })
    else navigate('/sentences')
  }

  const handleMoveTo = async (cat: string) => {
    await updateSentence(sentence.id!, { category: cat })
    toast('success', `已移动到「${cat}」`)
    setShowMove(false)
  }

  const startEditDefs = () => {
    const defs = getSentenceDefinitions(sentence)
    setEditDefinitions(defs.length > 0 ? defs.map((d) => ({ ...d })) : [{ pos: '', def: '', trans: '' }])
    setEditingDefs(true)
  }

  const saveEditDefs = async () => {
    const validDefs = editDefinitions.filter((d) => d.def.trim() || d.trans.trim())
    if (validDefs.length === 0) {
      toast('warning', '至少需要一个翻译/释义')
      return
    }
    const primary = validDefs[0]
    await updateSentence(sentence.id!, {
      definitions: validDefs.map((d) => ({ pos: d.pos.trim(), def: d.def.trim(), trans: d.trans.trim() })),
      translation: primary.trans.trim(),
    })
    setEditingDefs(false)
    toast('success', '释义已更新')
  }

  const addEditDefinition = () => {
    setEditDefinitions([...editDefinitions, { pos: '', def: '', trans: '' }])
  }

  const removeEditDefinition = (index: number) => {
    if (editDefinitions.length <= 1) return
    setEditDefinitions(editDefinitions.filter((_, i) => i !== index))
  }

  const updateEditDefinition = (index: number, field: keyof Definition, value: string) => {
    const next = [...editDefinitions]
    next[index] = { ...next[index], [field]: value }
    setEditDefinitions(next)
  }

  const difficultyLabels = ['简单', '较易', '中等', '较难', '困难']
  const dateFmt = (t: number) => (t ? new Date(t).toLocaleString('zh-CN') : '无')
  const currentCat = categories.find((c) => c.name === sentence.category)
  const scopeLabel =
    scope === 'favorites' ? '收藏夹' : scope === 'category' ? scopeCategory : '全部短句'

  const defs = getSentenceDefinitions(sentence)

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <BackButton />
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleSentenceFavorite(sentence.id!, sentence.isFavorite)}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="收藏"
          >
            <Heart
              size={20}
              className={sentence.isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}
            />
          </button>
          <button
            onClick={() => setShowMove(true)}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="移动分类"
          >
            <FolderInput size={20} className="text-gray-400" />
          </button>
          <button
            onClick={handleDelete}
            className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 size={20} className="text-gray-400 hover:text-red-500" />
          </button>
        </div>
      </div>

      <div className="card p-6 text-center mb-4">
        <div className="flex items-center justify-center gap-3">
          <h1 className="text-2xl font-bold text-gradient leading-snug">{sentence.sentence}</h1>
          <button
            onClick={() => speakWord(sentence.sentence)}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors shrink-0"
          >
            <Volume2 size={24} />
          </button>
        </div>
        <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
          <span className="inline-block px-3 py-1 rounded-full text-sm bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
            {difficultyLabels[sentence.difficulty - 1]}
          </span>
          <Link
            to={`/categories/${encodeURIComponent(sentence.category)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
          >
            {currentCat && (
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: currentCat.color }}
              />
            )}
            {sentence.category}
          </Link>
          {sentence.isFavorite ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400">
              <Heart size={12} className="fill-red-500" /> 已收藏
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mb-4">
        <button
          onClick={() => prevItem && navigate(buildHref(prevItem.id!))}
          disabled={!prevItem}
          className="flex-1 flex items-center justify-start gap-2 px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 dark:border-slate-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          <ChevronLeft size={18} className="flex-shrink-0" />
          <div className="text-left min-w-0">
            <div className="text-xs text-gray-400">上一个</div>
            <div className="text-sm font-medium truncate dark:text-gray-200">
              {prevItem?.sentence ?? '已是第一个'}
            </div>
          </div>
        </button>
        <button
          onClick={() => nextItem && navigate(buildHref(nextItem.id!))}
          disabled={!nextItem}
          className="flex-1 flex items-center justify-end gap-2 px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 dark:border-slate-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          <div className="text-right min-w-0">
            <div className="text-xs text-gray-400">下一个</div>
            <div className="text-sm font-medium truncate dark:text-gray-200">
              {nextItem?.sentence ?? '已是最后一个'}
            </div>
          </div>
          <ChevronRight size={18} className="flex-shrink-0" />
        </button>
      </div>
      <div className="text-center text-xs text-gray-400 -mt-2 mb-3">
        {currentIdx >= 0 && list.length > 0 ? `${currentIdx + 1} / ${list.length} · ${scopeLabel}` : ''}
      </div>

      <div className="space-y-3">
        {/* 释义区域 */}
        {editingDefs ? (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-primary-600 dark:text-primary-400">编辑释义</h3>
              <div className="flex gap-2">
                <button
                  onClick={addEditDefinition}
                  className="text-sm text-primary-600 dark:text-primary-400 flex items-center gap-1"
                >
                  <Plus size={14} /> 添加
                </button>
                <button
                  onClick={saveEditDefs}
                  className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
                >
                  <Check size={14} /> 保存
                </button>
                <button
                  onClick={() => setEditingDefs(false)}
                  className="text-sm text-gray-400"
                >
                  取消
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {editDefinitions.map((d, i) => (
                <div
                  key={i}
                  className="bg-gray-50 dark:bg-slate-700/60 rounded-xl p-3 space-y-2 relative"
                >
                  {editDefinitions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEditDefinition(i)}
                      className="absolute top-2 right-2 p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                      aria-label="删除此释义"
                    >
                      <X size={14} className="text-gray-400" />
                    </button>
                  )}
                  <input
                    value={d.trans}
                    onChange={(e) => updateEditDefinition(i, 'trans', e.target.value)}
                    className="input-field text-sm"
                    placeholder="中文翻译"
                  />
                  <input
                    value={d.def}
                    onChange={(e) => updateEditDefinition(i, 'def', e.target.value)}
                    className="input-field text-sm"
                    placeholder="英文释义（可选）"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-primary-600 dark:text-primary-400">翻译/释义</h3>
              <button
                onClick={startEditDefs}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                aria-label="编辑释义"
              >
                <Pencil size={14} className="text-gray-400" />
              </button>
            </div>
            {defs.length > 0 ? (
              <div className="space-y-2">
                {defs.map((d, i) => (
                  <div key={i} className="flex items-start gap-2">
                    {d.pos && (
                      <span className="text-sm font-medium text-primary-500 dark:text-primary-400 shrink-0 mt-0.5">
                        {d.pos}
                      </span>
                    )}
                    <div className="flex-1">
                      {d.trans && (
                        <p className="text-lg dark:text-gray-200 font-medium">{d.trans}</p>
                      )}
                      {d.def && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{d.def}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-lg dark:text-gray-200">{sentence.translation || '暂无翻译'}</p>
            )}
          </div>
        )}

        {sentence.example && <SectionCard title="用法说明" content={sentence.example} highlight />}
        {sentence.notes && <SectionCard title="笔记" content={sentence.notes} />}

        <div className="card p-4">
          <h3 className="text-sm font-medium text-primary-600 dark:text-primary-400 mb-2">学习数据</h3>
          <div className="space-y-2 text-sm">
            <Row label="分类" value={sentence.category} />
            <Row label="学习状态" value={sentence.isLearned ? '已掌握' : '学习中'} />
            <Row label="复习次数" value={`${sentence.reviewCount} 次`} />
            <Row label="正确次数" value={`${sentence.correctCount} 次`} />
            <Row label="连续正确" value={`${sentence.streak} 次`} />
            <Row label="上次复习" value={dateFmt(sentence.lastReviewedAt)} />
            <Row label="添加时间" value={dateFmt(sentence.createdAt)} />
          </div>
        </div>
      </div>

      {showMove && (
        <div className="modal-overlay">
          <div className="modal-content max-h-[80vh] overflow-auto">
            <h3 className="font-bold text-lg mb-4 dark:text-gray-100">移动到分类</h3>
            <div className="space-y-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleMoveTo(cat.name)}
                  disabled={cat.name === sentence.category}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border dark:border-slate-700 transition-colors ${
                    cat.name === sentence.category
                      ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-800'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="flex-1 text-left dark:text-gray-200">{cat.name}</span>
                  {cat.name === sentence.category && (
                    <span className="text-xs text-primary-600 dark:text-primary-400">当前</span>
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
    </div>
  )
}

function SectionCard({ title, content, highlight }: { title: string; content: string; highlight?: boolean }) {
  return (
    <div className="card p-4">
      <h3
        className={`text-sm font-medium mb-2 ${
          highlight ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'
        }`}
      >
        {title}
      </h3>
      <p className={`text-lg ${highlight ? 'italic text-primary-700 dark:text-primary-300' : 'dark:text-gray-200'}`}>
        {content}
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="dark:text-gray-200">{value}</span>
    </div>
  )
}
