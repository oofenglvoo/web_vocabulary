import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import {
  Heart,
  Trash2,
  Volume2,
  FolderInput,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Pencil,
  Check,
} from 'lucide-react'
import {
  useWordById,
  deleteWord,
  updateWord,
  useCategories,
  useAllWords,
  useFavoriteWords,
  useWordsByCategory,
} from '../hooks/useWords'
import { FavoriteButton } from '../components/FavoriteButton'
import { speakWord } from '../utils/tts'
import { getDefinitions } from '../utils/definitions'
import { BackButton } from '../components/BackButton'
import { ConfirmModal } from '../components/ConfirmModal'
import { useToast } from '../components/Toast'
import { SkeletonCard } from '../components/Skeleton'
import { Definition } from '../types/word'

const POS_OPTIONS = ['', 'n.', 'v.', 'adj.', 'adv.', 'prep.', 'conj.', 'pron.', 'interj.', 'art.', '名', '动', '形', '副']

// 浏览来源:从哪个列表进入了这个详情页 → 决定上一个/下一个的取数集
type Scope = 'all' | 'favorites' | 'category'

export function WordDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()

  const word = useWordById(Number(id))
  const categories = useCategories()
  const [showMove, setShowMove] = useState(false)
  const [editingDefs, setEditingDefs] = useState(false)
  const [editDefinitions, setEditDefinitions] = useState<Definition[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)

  // 切换单词时重置编辑状态，避免残留上一个单词的释义编辑面板
  useEffect(() => {
    setEditingDefs(false)
    setEditDefinitions([])
  }, [id])

  // 上一个/下一个的来源
  const scopeParam = (searchParams.get('scope') as Scope) || 'all'
  const scopeCategory = searchParams.get('category') || ''
  const scope: Scope =
    scopeParam === 'category' && scopeCategory ? 'category' : scopeParam === 'favorites' ? 'favorites' : 'all'

  const allWords = useAllWords()
  const favWords = useFavoriteWords()
  const catWords = useWordsByCategory(scopeCategory)

  const list = scope === 'favorites' ? favWords : scope === 'category' ? catWords : allWords
  const currentIdx = list.findIndex((w) => w.id === Number(id))
  const prevWord = currentIdx > 0 ? list[currentIdx - 1] : null
  const nextWord = currentIdx >= 0 && currentIdx < list.length - 1 ? list[currentIdx + 1] : null

  const buildHref = (wordId: number) => {
    const params = new URLSearchParams()
    params.set('scope', scope)
    if (scope === 'category' && scopeCategory) params.set('category', scopeCategory)
    return `/word/${wordId}?${params.toString()}`
  }

  // 键盘 ←/→ 切换上下一个
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName.match(/INPUT|TEXTAREA|SELECT/)) return
      if (e.key === 'ArrowLeft' && prevWord) {
        navigate(buildHref(prevWord.id!))
      } else if (e.key === 'ArrowRight' && nextWord) {
        navigate(buildHref(nextWord.id!))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevWord?.id, nextWord?.id, scope, scopeCategory])

  if (!word) {
    return (
      <div className="p-4 space-y-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  const speak = () => {
    speakWord(word.word)
  }

  const handleDelete = async () => {
    const idToDelete = word.id!
    // 删除前确定下一个目标
    const after = nextWord ?? prevWord
    await deleteWord(idToDelete)
    toast('success', '单词已删除')
    if (after) {
      navigate(buildHref(after.id!), { replace: true })
    } else {
      navigate('/words')
    }
  }

  const handleMoveTo = async (cat: string) => {
    await updateWord(word.id!, { category: cat })
    toast('success', `已移动到「${cat}」`)
    setShowMove(false)
  }

  const startEditDefs = () => {
    const defs = getDefinitions(word)
    setEditDefinitions(defs.length > 0 ? defs.map((d) => ({ ...d })) : [{ pos: '', def: '', trans: '' }])
    setEditingDefs(true)
  }

  const saveEditDefs = async () => {
    const validDefs = editDefinitions.filter((d) => d.def.trim() || d.trans.trim())
    if (validDefs.length === 0) {
      toast('warning', '至少需要一个释义')
      return
    }
    const primary = validDefs[0]
    await updateWord(word.id!, {
      definitions: validDefs.map((d) => ({ pos: d.pos.trim(), def: d.def.trim(), trans: d.trans.trim() })),
      // 向前兼容旧字段
      definition: primary.def.trim(),
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
  const currentCat = categories.find((c) => c.name === word.category)

  const scopeLabel =
    scope === 'favorites' ? '收藏夹' : scope === 'category' ? scopeCategory : '全部单词'

  const defs = getDefinitions(word)

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <BackButton />
        <div className="flex items-center gap-2">
          <FavoriteButton entityType="word" entityId={word.id!} title={word.word} />
          <button
            onClick={() => setShowMove(true)}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="移动分类"
          >
            <FolderInput size={20} className="text-gray-400" />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            aria-label="删除单词"
          >
            <Trash2 size={20} className="text-gray-400 hover:text-red-500" />
          </button>
        </div>
      </div>

      <div className="card p-6 text-center mb-4">
        <div className="flex items-center justify-center gap-3">
          <h1 className="text-3xl font-bold text-gradient">{word.word}</h1>
          <button onClick={speak} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors" aria-label="发音">
            <Volume2 size={24} />
          </button>
        </div>
        {word.phonetic && <p className="text-gray-500 dark:text-gray-400 mt-1">{word.phonetic}</p>}
        <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
          <span className="inline-block px-3 py-1 rounded-full text-sm bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
            {difficultyLabels[word.difficulty - 1]}
          </span>
          <Link
            to={`/categories/${encodeURIComponent(word.category)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
          >
            {currentCat && (
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: currentCat.color }}
              />
            )}
            {word.category}
          </Link>
          {word.isFavorite ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400">
              <Heart size={12} className="fill-red-500" /> 已收藏
            </span>
          ) : null}
        </div>
      </div>

      {/* 上一个 / 下一个 */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <button
          onClick={() => prevWord && navigate(buildHref(prevWord.id!))}
          disabled={!prevWord}
          className="flex-1 flex items-center justify-start gap-2 px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 dark:border-slate-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          <ChevronLeft size={18} className="flex-shrink-0" />
          <div className="text-left min-w-0">
            <div className="text-xs text-gray-400">上一个</div>
            <div className="text-sm font-medium truncate dark:text-gray-200">
              {prevWord?.word ?? '已是第一个'}
            </div>
          </div>
        </button>
        <button
          onClick={() => nextWord && navigate(buildHref(nextWord.id!))}
          disabled={!nextWord}
          className="flex-1 flex items-center justify-end gap-2 px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 dark:border-slate-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          <div className="text-right min-w-0">
            <div className="text-xs text-gray-400">下一个</div>
            <div className="text-sm font-medium truncate dark:text-gray-200">
              {nextWord?.word ?? '已是最后一个'}
            </div>
          </div>
          <ChevronRight size={18} className="flex-shrink-0" />
        </button>
      </div>
      <div className="text-center text-xs text-gray-400 -mt-2 mb-3">
        {currentIdx >= 0 && list.length > 0
          ? `${currentIdx + 1} / ${list.length} · ${scopeLabel}`
          : ''}
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
                  <div className="flex gap-2">
                    <select
                      value={d.pos}
                      onChange={(e) => updateEditDefinition(i, 'pos', e.target.value)}
                      className="input-field w-24 shrink-0 text-sm"
                    >
                      {POS_OPTIONS.map((p) => (
                        <option key={p} value={p}>{p || '词性'}</option>
                      ))}
                    </select>
                    <input
                      value={d.def}
                      onChange={(e) => updateEditDefinition(i, 'def', e.target.value)}
                      className="input-field flex-1 text-sm"
                      placeholder="释义（英/日）"
                    />
                  </div>
                  <input
                    value={d.trans}
                    onChange={(e) => updateEditDefinition(i, 'trans', e.target.value)}
                    className="input-field text-sm"
                    placeholder="中文翻译"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-primary-600 dark:text-primary-400">释义</h3>
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
              <p className="text-lg dark:text-gray-200">{word.definition || '暂无释义'}</p>
            )}
          </div>
        )}

        {word.example && <SectionCard title="例句" content={word.example} highlight />}
        {word.notes && <SectionCard title="笔记" content={word.notes} />}

        <div className="card p-4">
          <h3 className="text-sm font-medium text-primary-600 dark:text-primary-400 mb-2">学习数据</h3>
          <div className="space-y-2 text-sm">
            <Row label="分类" value={word.category} />
            <Row label="学习状态" value={word.isLearned ? '已掌握' : '学习中'} />
            <Row label="复习次数" value={`${word.reviewCount} 次`} />
            <Row label="正确次数" value={`${word.correctCount} 次`} />
            <Row label="连续正确" value={`${word.streak} 次`} />
            <Row label="上次复习" value={dateFmt(word.lastReviewedAt)} />
            <Row label="添加时间" value={dateFmt(word.createdAt)} />
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
                  disabled={cat.name === word.category}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border dark:border-slate-700 transition-colors ${
                    cat.name === word.category
                      ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-800'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="flex-1 text-left dark:text-gray-200">{cat.name}</span>
                  {cat.name === word.category && (
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

      {confirmDelete && (
        <ConfirmModal
          title="删除这个单词?"
          message="删除后不可恢复（相关学习记录与计划引用会一并清理）"
          confirmText="删除"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}

function SectionCard({
  title,
  content,
  highlight,
}: {
  title: string
  content: string
  highlight?: boolean
}) {
  return (
    <div className="card p-4">
      <h3
        className={`text-sm font-medium mb-2 ${
          highlight ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'
        }`}
      >
        {title}
      </h3>
      <p className={`text-lg ${highlight ? 'italic text-primary-700 dark:text-primary-300' : 'dark:text-gray-200'}`}>{content}</p>
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
