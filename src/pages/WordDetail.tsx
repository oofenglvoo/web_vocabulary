import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Heart,
  Trash2,
  Volume2,
  FolderInput,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import {
  useWordById,
  deleteWord,
  toggleFavorite,
  updateWord,
  useCategories,
  useAllWords,
  useFavoriteWords,
  useWordsByCategory,
} from '../hooks/useWords'
import { speakWord } from '../utils/tts'

// 浏览来源:从哪个列表进入了这个详情页 → 决定上一个/下一个的取数集
type Scope = 'all' | 'favorites' | 'category'

export function WordDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const word = useWordById(Number(id))
  const categories = useCategories()
  const [showMove, setShowMove] = useState(false)

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
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  const speak = () => {
    speakWord(word.word)
  }

  const handleDelete = async () => {
    if (!confirm('确定删除这个单词吗?')) return
    const idToDelete = word.id!
    // 删除前确定下一个目标
    const after = nextWord ?? prevWord
    await deleteWord(idToDelete)
    if (after) {
      navigate(buildHref(after.id!), { replace: true })
    } else {
      navigate('/words')
    }
  }

  const handleMoveTo = async (cat: string) => {
    await updateWord(word.id!, { category: cat })
    setShowMove(false)
  }

  const difficultyLabels = ['简单', '较易', '中等', '较难', '困难']
  const dateFmt = (t: number) => (t ? new Date(t).toLocaleString('zh-CN') : '无')
  const currentCat = categories.find((c) => c.name === word.category)

  const scopeLabel =
    scope === 'favorites' ? '收藏夹' : scope === 'category' ? scopeCategory : '全部单词'

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={24} />
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleFavorite(word.id!, word.isFavorite)}
            className="p-2 hover:bg-gray-100 rounded-lg"
            aria-label="收藏"
          >
            <Heart
              size={20}
              className={word.isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}
            />
          </button>
          <button
            onClick={() => setShowMove(true)}
            className="p-2 hover:bg-gray-100 rounded-lg"
            aria-label="移动分类"
          >
            <FolderInput size={20} className="text-gray-400" />
          </button>
          <button onClick={handleDelete} className="p-2 hover:bg-gray-100 rounded-lg">
            <Trash2 size={20} className="text-gray-400" />
          </button>
        </div>
      </div>

      <div className="card p-6 text-center mb-4">
        <div className="flex items-center justify-center gap-3">
          <h1 className="text-3xl font-bold">{word.word}</h1>
          <button onClick={speak} className="p-2 hover:bg-gray-100 rounded-full">
            <Volume2 size={24} />
          </button>
        </div>
        {word.phonetic && <p className="text-gray-500 mt-1">{word.phonetic}</p>}
        <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
          <span className="inline-block px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-600">
            {difficultyLabels[word.difficulty - 1]}
          </span>
          <Link
            to={`/categories/${encodeURIComponent(word.category)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-primary-50 text-primary-700 hover:bg-primary-100"
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
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-red-50 text-red-600">
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
          className="flex-1 flex items-center justify-start gap-2 px-3 py-2 rounded-lg border bg-white disabled:opacity-40 hover:bg-gray-50"
        >
          <ChevronLeft size={18} className="flex-shrink-0" />
          <div className="text-left min-w-0">
            <div className="text-xs text-gray-400">上一个</div>
            <div className="text-sm font-medium truncate">
              {prevWord?.word ?? '已是第一个'}
            </div>
          </div>
        </button>
        <button
          onClick={() => nextWord && navigate(buildHref(nextWord.id!))}
          disabled={!nextWord}
          className="flex-1 flex items-center justify-end gap-2 px-3 py-2 rounded-lg border bg-white disabled:opacity-40 hover:bg-gray-50"
        >
          <div className="text-right min-w-0">
            <div className="text-xs text-gray-400">下一个</div>
            <div className="text-sm font-medium truncate">
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
        <SectionCard title="释义" content={word.definition} />
        {word.translation && <SectionCard title="中文翻译" content={word.translation} />}
        {word.example && <SectionCard title="例句" content={word.example} highlight />}
        {word.notes && <SectionCard title="笔记" content={word.notes} />}

        <div className="card p-4">
          <h3 className="text-sm font-medium text-primary-600 mb-2">学习数据</h3>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm max-h-[80vh] overflow-auto">
            <h3 className="font-bold text-lg mb-4">移动到分类</h3>
            <div className="space-y-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleMoveTo(cat.name)}
                  disabled={cat.name === word.category}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border ${
                    cat.name === word.category
                      ? 'bg-primary-50 border-primary-200'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="flex-1 text-left">{cat.name}</span>
                  {cat.name === word.category && (
                    <span className="text-xs text-primary-600">当前</span>
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
          highlight ? 'text-primary-600' : 'text-gray-500'
        }`}
      >
        {title}
      </h3>
      <p className={`text-lg ${highlight ? 'italic text-primary-700' : ''}`}>{content}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span>{value}</span>
    </div>
  )
}
