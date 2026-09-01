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
import { useLang } from '../context/Language'
import {
  useLangWordById,
  useLangWords,
  useLangFavoriteWords,
  useLangWordsByCategory,
  useLangCategories,
  deleteLangWord,
  markLangWordLearned,
  updateLangWord,
} from '../hooks/languageAware'
import { FavoriteButton } from '../components/FavoriteButton'
import { speakWord } from '../utils/tts'
import { getDefinitions } from '../utils/definitions'
import { BackButton } from '../components/BackButton'
import { ConfirmModal } from '../components/ConfirmModal'
import { useToast } from '../components/Toast'
import { NotesBlock } from '../components/NotesBlock'
import { SkeletonCard } from '../components/Skeleton'
import { Definition, JapaneseDefinition, JapaneseWord, Word } from '../types/word'
import type { LangWord } from '../hooks/languageAware'

const POS_OPTIONS = ['', 'n.', 'v.', 'adj.', 'adv.', 'prep.', 'conj.', 'pron.', 'interj.', 'art.', '名', '动', '形', '副']

// 浏览来源:从哪个列表进入了这个详情页 → 决定上一个/下一个的取数集
type Scope = 'all' | 'favorites' | 'category'

export function WordDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()
  const lang = useLang()
  const isJa = lang === 'ja'

  const word = useLangWordById(Number(id))
  const categories = useLangCategories()
  const [showMove, setShowMove] = useState(false)
  const [editingDefs, setEditingDefs] = useState(false)
  const [editDefinitions, setEditDefinitions] = useState<Definition[]>([])
  // 日语：整卡编辑模式（词干/假名/元信息/释义/例句/笔记）
  const [editingJa, setEditingJa] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [markingLearned, setMarkingLearned] = useState(false)

  // 切换单词时重置编辑状态，避免残留上一个单词的释义编辑面板
  useEffect(() => {
    setEditingDefs(false)
    setEditDefinitions([])
    setEditingJa(false)
  }, [id])

  // 上一个/下一个的来源
  const scopeParam = (searchParams.get('scope') as Scope) || 'all'
  const scopeCategory = searchParams.get('category') || ''
  const scope: Scope =
    scopeParam === 'category' && scopeCategory ? 'category' : scopeParam === 'favorites' ? 'favorites' : 'all'

  const allWords = useLangWords()
  const favWords = useLangFavoriteWords()
  const catWords = useLangWordsByCategory(scopeCategory)

  // 预习列表可能来自计划/随机队列，详情页必须沿用预习时的顺序计算上下词
  const studyIds = searchParams.get('studyPreview') === '1'
    ? (searchParams.get('studyIds') || '').split(',').map(Number).filter((value) => Number.isFinite(value))
    : []
  const studyWordMap = new Map(allWords.map((item) => [item.id, item]))
  const studyPreviewList = studyIds
    .map((studyId) => studyWordMap.get(studyId))
    .filter((item): item is LangWord => !!item)
  const list = studyPreviewList.length > 0
    ? studyPreviewList
    : scope === 'favorites' ? favWords : scope === 'category' ? catWords : allWords
  const currentIdx = list.findIndex((w) => w.id === Number(id))
  const prevWord = currentIdx > 0 ? list[currentIdx - 1] : null
  const nextWord = currentIdx >= 0 && currentIdx < list.length - 1 ? list[currentIdx + 1] : null
  const isStudyPreview = searchParams.get('studyPreview') === '1' && studyIds.length > 0
  const studyPath = searchParams.get('studyPath')

  const buildHref = (wordId: number) => {
    const params = new URLSearchParams()
    if (searchParams.get('studyPreview') === '1') {
      params.set('studyPreview', '1')
      params.set('studyIds', studyIds.join(','))
      if (studyPath) params.set('studyPath', studyPath)
    }
    params.set('scope', scope)
    if (scope === 'category' && scopeCategory) params.set('category', scopeCategory)
    return `/word/${wordId}?${params.toString()}`
  }

  const startStudyTest = () => {
    if (!studyPath) return
    navigate(`${studyPath}${studyPath.includes('?') ? '&' : '?'}autoStartTest=1`)
  }

  // 键盘 ←/→ 切换上下一个
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName.match(/INPUT|TEXTAREA|SELECT/)) return
      if (e.key === 'ArrowLeft' && prevWord) {
        navigate(buildHref(prevWord.id!), { replace: true })
      } else if (e.key === 'ArrowRight' && nextWord) {
        navigate(buildHref(nextWord.id!), { replace: true })
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

  const jaWord = isJa ? (word as JapaneseWord) : null
  const enWord = isJa ? null : (word as Word)

  const speak = () => {
    speakWord(word.word, isJa ? { lang: 'ja' } : undefined)
  }

  const handleDelete = async () => {
    const idToDelete = word.id!
    // 删除前确定下一个目标
    const after = nextWord ?? prevWord
    await deleteLangWord(idToDelete)
    toast('success', isJa ? '日语词已删除' : '单词已删除')
    if (after) {
      navigate(buildHref(after.id!), { replace: true })
    } else {
      navigate('/words')
    }
  }

  const handleMoveTo = async (cat: string) => {
    await updateLangWord(word.id!, { category: cat })
    toast('success', `已移动到「${cat}」`)
    setShowMove(false)
  }

  const handleMarkLearned = async () => {
    if (word.isLearned || markingLearned) return
    setMarkingLearned(true)
    try {
      await markLangWordLearned(word.id!)
      toast('success', '已加入已掌握')
    } finally {
      setMarkingLearned(false)
    }
  }

  const startEditDefs = () => {
    const defs = getDefinitions(word as Word)
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
    await updateLangWord(word.id!, {
      definitions: validDefs.map((d) => ({ pos: d.pos.trim(), def: d.def.trim(), trans: d.trans.trim() })),
      // 向前兼容旧字段
      definition: primary.def.trim(),
      translation: primary.trans.trim(),
    } as Partial<Word>)
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
    scope === 'favorites' ? '收藏夹' : scope === 'category' ? scopeCategory : isJa ? '全部日语词' : '全部单词'

  const defs = isJa ? [] : getDefinitions(word as Word)

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <BackButton />
        <div className="flex items-center gap-2">
          {!word.isLearned && (
            <button
              onClick={handleMarkLearned}
              disabled={markingLearned}
              className="btn-success px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {markingLearned ? '处理中...' : '掌握'}
            </button>
          )}
          <FavoriteButton
            entityType={isJa ? 'japaneseWord' : 'word'}
            entityId={word.id!}
            title={word.word}
          />
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
            aria-label={isJa ? '删除日语词' : '删除单词'}
          >
            <Trash2 size={20} className="text-gray-400 hover:text-red-500" />
          </button>
        </div>
      </div>

      {/* 上一个 / 下一个 */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <button
          onClick={() => prevWord && navigate(buildHref(prevWord.id!), { replace: true })}
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
          onClick={() => nextWord && navigate(buildHref(nextWord.id!), { replace: true })}
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

      <div className="card p-6 text-center mb-4">
        <div className="flex items-center justify-center gap-3">
          <h1 className="text-3xl font-bold text-gradient">{word.word}</h1>
          <button onClick={speak} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors" aria-label="发音">
            <Volume2 size={24} />
          </button>
        </div>
        {isJa ? (
          jaWord!.reading && <p className="text-gray-500 dark:text-gray-400 mt-1">{jaWord!.reading}</p>
        ) : (
          enWord!.phonetic && <p className="text-gray-500 dark:text-gray-400 mt-1">{enWord!.phonetic}</p>
        )}
        <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
          <span className="inline-block px-3 py-1 rounded-full text-sm bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
            {difficultyLabels[word.difficulty - 1]}
          </span>
          {isJa && jaWord!.accent && (
            <span className="inline-block px-3 py-1 rounded-full text-sm bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300">
              {jaWord!.accent}
            </span>
          )}
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

      {isStudyPreview && !nextWord && studyPath && (
        <button onClick={startStudyTest} className="btn-primary w-full mb-4">
          开始测试
        </button>
      )}

      <div className="space-y-3">
        {isJa ? (
          <JapaneseDetailBody
            word={jaWord!}
            editing={editingJa}
            onEdit={() => setEditingJa(true)}
            onClose={() => setEditingJa(false)}
            onSaved={() => {
              setEditingJa(false)
              toast('success', '日语词已更新')
            }}
          />
        ) : (
          <>
            {/* 释义区域（英语） */}
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
                  <p className="text-lg dark:text-gray-200">{(word as Word).definition || '暂无释义'}</p>
                )}
              </div>
            )}

            {enWord!.example && <SectionCard title="例句" content={enWord!.example} highlight />}
            {enWord!.notes && <SectionCard title="笔记" content={enWord!.notes} />}
          </>
        )}

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
          title={isJa ? '删除这个日语词?' : '删除这个单词?'}
          message="删除后不可恢复（相关学习记录与计划引用会一并清理）"
          confirmText="删除"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}

/** 日语词条展示 + 整卡编辑（假名/音调/多释义/例句三件套/笔记） */
function JapaneseDetailBody({
  word,
  editing,
  onEdit,
  onClose,
  onSaved,
}: {
  word: JapaneseWord
  editing: boolean
  onEdit: () => void
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [form, setForm] = useState<JapaneseWord>(word)

  // 切换词条时重置表单
  useEffect(() => {
    setForm(word)
  }, [word.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof JapaneseWord>(key: K, value: JapaneseWord[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const save = async () => {
    if (!form.word.trim()) {
      toast('warning', '表记不能为空')
      return
    }
    if (!form.reading.trim()) {
      toast('warning', '假名读音不能为空')
      return
    }
    const validDefs = form.definitions.filter((d) => d.meaning.trim() || d.translation.trim())
    if (validDefs.length === 0) {
      toast('warning', '至少需要一个释义')
      return
    }
    await updateLangWord(word.id!, {
      word: form.word.trim(),
      reading: form.reading.trim(),
      accent: form.accent,
      partOfSpeech: form.partOfSpeech,
      category: form.category,
      difficulty: form.difficulty,
      definitions: validDefs.map((d) => ({
        pos: d.pos.trim(),
        meaning: d.meaning.trim(),
        translation: d.translation.trim(),
      })),
      example: form.example,
      exampleReading: form.exampleReading,
      exampleTranslation: form.exampleTranslation,
      notes: form.notes,
    } as Partial<JapaneseWord>)
    onSaved()
  }

  if (editing) {
    return (
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-primary-600 dark:text-primary-400">编辑日语词</h3>
          <div className="flex gap-3">
            <button onClick={save} className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Check size={14} /> 保存
            </button>
            <button onClick={onClose} className="text-sm text-gray-400">取消</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input value={form.word} onChange={(e) => set('word', e.target.value)} className="input-field text-sm" placeholder="表记 *" />
          <input value={form.reading} onChange={(e) => set('reading', e.target.value)} className="input-field text-sm" placeholder="假名读音 *" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input value={form.partOfSpeech} onChange={(e) => set('partOfSpeech', e.target.value)} className="input-field text-sm" placeholder="词性" />
          <input value={form.accent} onChange={(e) => set('accent', e.target.value)} className="input-field text-sm" placeholder="音调（如 ⓪ / ①）" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select value={form.category} onChange={(e) => set('category', e.target.value)} className="input-field text-sm">
            <option value="">未分类</option>
            <option value="默认">默认</option>
            <option value="日语">日语</option>
            <option value="N5">N5</option>
            <option value="N4">N4</option>
            <option value="N3">N3</option>
            <option value="标准日本语">标准日本语</option>
          </select>
          <select value={form.difficulty} onChange={(e) => set('difficulty', Number(e.target.value))} className="input-field text-sm">
            {[1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={d}>难度 {d}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">释义</span>
            <button
              onClick={() => set('definitions', [...form.definitions, { pos: '', meaning: '', translation: '' }])}
              className="text-xs text-primary-600 dark:text-primary-400 flex items-center gap-1"
            >
              <Plus size={12} /> 添加释义
            </button>
          </div>
          {form.definitions.map((d, i) => (
            <div key={i} className="bg-gray-50 dark:bg-slate-700/60 rounded-xl p-2.5 space-y-2 relative">
              {form.definitions.length > 1 && (
                <button
                  type="button"
                  onClick={() => set('definitions', form.definitions.filter((_, j) => j !== i))}
                  className="absolute top-2 right-2 p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600"
                  aria-label="删除此释义"
                >
                  <X size={13} className="text-gray-400" />
                </button>
              )}
              <input
                value={d.pos}
                onChange={(e) => {
                  const next = [...form.definitions]
                  next[i] = { ...next[i], pos: e.target.value }
                  set('definitions', next)
                }}
                className="input-field text-sm"
                placeholder="词性（如 动/他动一）"
              />
              <input
                value={d.meaning}
                onChange={(e) => {
                  const next = [...form.definitions]
                  next[i] = { ...next[i], meaning: e.target.value }
                  set('definitions', next)
                }}
                className="input-field text-sm"
                placeholder="日文释义"
              />
              <input
                value={d.translation}
                onChange={(e) => {
                  const next = [...form.definitions]
                  next[i] = { ...next[i], translation: e.target.value }
                  set('definitions', next)
                }}
                className="input-field text-sm"
                placeholder="中文翻译"
              />
            </div>
          ))}
        </div>
        <textarea value={form.example} onChange={(e) => set('example', e.target.value)} className="input-field text-sm" rows={2} placeholder="例句" />
        <div className="grid grid-cols-2 gap-2">
          <input value={form.exampleReading} onChange={(e) => set('exampleReading', e.target.value)} className="input-field text-sm" placeholder="例句读音" />
          <input value={form.exampleTranslation} onChange={(e) => set('exampleTranslation', e.target.value)} className="input-field text-sm" placeholder="例句翻译" />
        </div>
        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} className="input-field text-sm" rows={2} placeholder="笔记" />
      </div>
    )
  }

  const defs: JapaneseDefinition[] = word.definitions ?? []

  return (
    <>
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-primary-600 dark:text-primary-400">释义</h3>
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="编辑日语词"
          >
            <Pencil size={14} className="text-gray-400" />
          </button>
        </div>
        {defs.length > 0 ? (
          <div className="space-y-2">
            {defs.map((d, i) => (
              <div key={i} className="flex items-start gap-2">
                {(d.pos || word.partOfSpeech) && (
                  <span className="text-sm font-medium text-primary-500 dark:text-primary-400 shrink-0 mt-0.5">
                    {d.pos || word.partOfSpeech}
                  </span>
                )}
                <div className="flex-1">
                  {d.translation && (
                    <p className="text-lg dark:text-gray-200 font-medium">{d.translation}</p>
                  )}
                  {d.meaning && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{d.meaning}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-lg dark:text-gray-200">暂无释义</p>
        )}
      </div>
      {word.example && (
        <div className="card p-4">
          <h3 className="text-sm font-medium text-primary-600 dark:text-primary-400 mb-2">例句</h3>
          <p className="text-base dark:text-gray-200">{word.example}</p>
          {word.exampleReading && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{word.exampleReading}</p>}
          {word.exampleTranslation && <p className="text-sm text-primary-700 dark:text-primary-300 mt-1">{word.exampleTranslation}</p>}
        </div>
      )}
      <NotesBlock notes={word.notes} onSave={async (n) => { await updateLangWord(word.id!, { notes: n }) }} />
    </>
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
