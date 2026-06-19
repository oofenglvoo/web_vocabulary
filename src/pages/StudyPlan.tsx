import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Target,
  Play,
  Archive,
  Trash2,
  CheckCircle2,
  Flame,
  Layers,
  TrendingUp,
  Calendar,
  Sparkles,
} from 'lucide-react'
import {
  useActivePlan,
  useAllPlans,
  usePlanProgress,
  createPlan,
  activatePlan,
  archivePlan,
  deletePlan,
  ensureTodayReset,
} from '../hooks/useStudyPlan'
import { useCategories, useCategoryStats, useStats, useFavoriteWords } from '../hooks/useWords'
import { StudyPlan as PlanType } from '../types/word'

const SOURCE_LABEL: Record<string, string> = {
  category: '分类',
  favorites: '收藏夹',
  all: '全部单词',
}

export function StudyPlanPage() {
  const navigate = useNavigate()
  const activePlan = useActivePlan()
  const allPlans = useAllPlans()
  const progress = usePlanProgress(activePlan)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    if (activePlan?.id) {
      ensureTodayReset(activePlan.id)
    }
  }, [activePlan?.id])

  return (
    <div className="min-h-screen bg-gradient-mesh">
      <div className="p-4 space-y-5">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/60 rounded-xl"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Target size={20} className="text-primary-600" /> 学习计划
          </h1>
          <button
            onClick={() => setShowCreate(true)}
            className="p-2 hover:bg-white/60 rounded-xl"
          >
            <Plus size={22} className="text-primary-600" />
          </button>
        </div>

        {activePlan ? (
          <ActivePlanCard
            plan={activePlan}
            progress={progress}
            onStart={() => navigate(`/study?plan=${activePlan.id}`)}
          />
        ) : (
          <EmptyPlan onCreate={() => setShowCreate(true)} />
        )}

        {allPlans.length > 0 && (
          <div>
            <h2 className="font-semibold text-base mb-2 px-1 flex items-center gap-1.5">
              <Layers size={16} className="text-gray-500" /> 全部计划
              <span className="text-xs text-gray-400 font-normal">
                ({allPlans.length})
              </span>
            </h2>
            <div className="space-y-2">
              {allPlans.map((p) => (
                <PlanRow
                  key={p.id}
                  plan={p}
                  isActive={p.id === activePlan?.id}
                  onActivate={() => activatePlan(p.id!)}
                  onArchive={() => archivePlan(p.id!)}
                  onDelete={() => {
                    if (confirm(`删除计划「${p.name}」?`)) deletePlan(p.id!)
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreatePlanModal
          onClose={() => setShowCreate(false)}
          onCreated={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}

function EmptyPlan({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="card p-8 text-center animate-scale-in">
      <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
        <Target size={28} className="text-white" />
      </div>
      <h3 className="font-bold text-lg mb-1">还没有学习计划</h3>
      <p className="text-sm text-gray-500 mb-4">
        选择分类或收藏夹,设定每日新词与复习数量,逐步掌握全部单词
      </p>
      <button onClick={onCreate} className="btn-primary inline-flex items-center gap-1.5">
        <Sparkles size={16} /> 创建学习计划
      </button>
    </div>
  )
}

function ActivePlanCard({
  plan,
  progress,
  onStart,
}: {
  plan: PlanType
  progress: ReturnType<typeof usePlanProgress>
  onStart: () => void
}) {
  const newDone = Math.min(progress.todayNewDone, progress.todayNewTarget)
  const reviewDone = Math.min(progress.todayReviewDone, progress.todayReviewTarget)
  const newPct = progress.todayNewTarget > 0 ? (newDone / progress.todayNewTarget) * 100 : 0
  const reviewPct = progress.todayReviewTarget > 0 ? (reviewDone / progress.todayReviewTarget) * 100 : 0

  const sourceLabel =
    plan.sourceKind === 'category'
      ? plan.sourceCategory
      : SOURCE_LABEL[plan.sourceKind]

  return (
    <div className="card p-5 bg-gradient-card border-primary-100 animate-scale-in">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-primary-600 mb-1">
            <Flame size={12} /> 进行中
          </div>
          <h2 className="text-lg font-bold truncate">{plan.name}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            来源: {sourceLabel} · 共 {progress.totalWords} 词
          </p>
        </div>
        <button onClick={onStart} className="btn-primary flex items-center gap-1.5 shrink-0">
          <Play size={16} /> 开始
        </button>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>总进度</span>
          <span>{progress.learnedWords} / {progress.totalWords} 已掌握</span>
        </div>
        <div className="h-2.5 bg-white/70 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-primary rounded-full transition-all duration-500"
            style={{ width: `${progress.overallPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-gray-400 mt-1">
          <span>{progress.overallPercent}%</span>
          <span>预计还需 {progress.estimatedDaysLeft} 天</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TodayCard
          title="今日新词"
          done={newDone}
          target={progress.todayNewTarget}
          pct={newPct}
          color="primary"
        />
        <TodayCard
          title="今日复习"
          done={reviewDone}
          target={progress.todayReviewTarget}
          pct={reviewPct}
          color="accent"
        />
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <MiniStat label="已开始" value={progress.startedWords} />
        <MiniStat label="已掌握" value={progress.learnedWords} />
        <MiniStat label="待复习" value={progress.dueReview} highlight={progress.dueReview > 0} />
      </div>
    </div>
  )
}

function TodayCard({
  title,
  done,
  target,
  pct,
  color,
}: {
  title: string
  done: number
  target: number
  pct: number
  color: 'primary' | 'accent'
}) {
  const barColor = color === 'primary' ? 'bg-primary-500' : 'bg-accent-500'
  const textColor = color === 'primary' ? 'text-primary-600' : 'text-accent-600'
  const completed = done >= target && target > 0
  return (
    <div className="bg-white/70 rounded-xl p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-500">{title}</span>
        {completed && <CheckCircle2 size={14} className="text-success-500" />}
      </div>
      <div className="flex items-baseline gap-1 mb-2">
        <span className={`text-xl font-bold ${textColor}`}>{done}</span>
        <span className="text-xs text-gray-400">/ {target}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  )
}

function MiniStat({
  label,
  value,
  highlight,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div className="bg-white/50 rounded-lg py-2">
      <div className={`text-base font-bold ${highlight ? 'text-warn-600' : 'text-gray-700'}`}>
        {value}
      </div>
      <div className="text-[10px] text-gray-400">{label}</div>
    </div>
  )
}

function PlanRow({
  plan,
  isActive,
  onActivate,
  onArchive,
  onDelete,
}: {
  plan: PlanType
  isActive: boolean
  onActivate: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  const sourceLabel =
    plan.sourceKind === 'category' ? plan.sourceCategory : SOURCE_LABEL[plan.sourceKind]
  return (
    <div className="card p-3 flex items-center gap-3">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          isActive ? 'bg-gradient-primary text-white' : 'bg-gray-100 text-gray-500'
        }`}
      >
        <Target size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{plan.name}</span>
          {plan.isArchived === 1 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
              已归档
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 truncate">
          {sourceLabel} · 每日 {plan.newPerDay} 新 / {plan.reviewPerDay} 复习
        </div>
      </div>
      <div className="flex items-center gap-1">
        {!isActive && plan.isArchived === 0 && (
          <button
            onClick={onActivate}
            className="p-2 rounded-lg hover:bg-primary-50 text-primary-600"
            aria-label="激活"
          >
            <Play size={16} />
          </button>
        )}
        {plan.isArchived === 0 && (
          <button
            onClick={onArchive}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"
            aria-label="归档"
          >
            <Archive size={16} />
          </button>
        )}
        <button
          onClick={onDelete}
          className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
          aria-label="删除"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}

function CreatePlanModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const categories = useCategories()
  const categoryStats = useCategoryStats()
  const stats = useStats()
  const favorites = useFavoriteWords()
  const [name, setName] = useState('')
  const [sourceKind, setSourceKind] = useState<'category' | 'favorites' | 'all'>('category')
  const [sourceCategory, setSourceCategory] = useState(categories[0]?.name ?? '默认')
  const [newPerDay, setNewPerDay] = useState(10)
  const [reviewPerDay, setReviewPerDay] = useState(20)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (sourceKind === 'category' && !categories.find((c) => c.name === sourceCategory)) {
      setSourceCategory(categories[0]?.name ?? '默认')
    }
  }, [sourceKind, categories, sourceCategory])

  const categoryWordCount = (name: string) =>
    categoryStats.find((c) => c.name === name)?.wordCount ?? 0

  const previewCount =
    sourceKind === 'category'
      ? categoryWordCount(sourceCategory)
      : sourceKind === 'favorites'
      ? favorites.length
      : stats.total

  const estimatedDays = newPerDay > 0 ? Math.ceil(previewCount / newPerDay) : 0

  const handleCreate = async () => {
    const n = name.trim()
    if (!n) {
      setError('请填写计划名称')
      return
    }
    if (newPerDay < 1 || reviewPerDay < 0) {
      setError('每日新词数至少为 1')
      return
    }
    setCreating(true)
    try {
      await createPlan({
        name: n,
        sourceKind,
        sourceCategory: sourceKind === 'category' ? sourceCategory : '',
        newPerDay,
        reviewPerDay,
      })
      onCreated()
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] overflow-auto animate-slide-up">
        <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Sparkles size={18} className="text-primary-600" /> 新建学习计划
            </h3>
            <button onClick={onClose} className="text-gray-400 text-sm">
              取消
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-2.5 rounded-lg text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">计划名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如: CET-4 三十天冲刺"
              className="w-full border rounded-xl px-3 py-2.5 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">单词来源</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { kind: 'category', label: '分类', icon: Layers },
                { kind: 'favorites', label: '收藏', icon: TrendingUp },
                { kind: 'all', label: '全部', icon: Target },
              ] as const).map(({ kind, label, icon: Icon }) => (
                <button
                  key={kind}
                  onClick={() => setSourceKind(kind)}
                  className={`py-2.5 rounded-xl text-sm flex flex-col items-center gap-1 transition-all ${
                    sourceKind === kind
                      ? 'bg-gradient-primary text-white shadow-glow'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {sourceKind === 'category' && (
            <div>
              <label className="block text-sm font-medium mb-1.5">选择分类</label>
              <div className="max-h-40 overflow-auto border rounded-xl p-1.5 space-y-1">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSourceCategory(c.name)}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-lg transition-colors ${
                      sourceCategory === c.name ? 'bg-primary-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="text-sm flex-1 text-left">{c.name}</span>
                    <span className="text-xs text-gray-400">{categoryWordCount(c.name)} 词</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <NumberStepper
              label="每日新词"
              value={newPerDay}
              onChange={setNewPerDay}
              min={1}
              max={50}
              icon={Sparkles}
            />
            <NumberStepper
              label="每日复习"
              value={reviewPerDay}
              onChange={setReviewPerDay}
              min={0}
              max={100}
              icon={TrendingUp}
            />
          </div>

          <div className="bg-gradient-card rounded-xl p-3.5 flex items-center gap-3">
            <Calendar size={20} className="text-primary-600 shrink-0" />
            <div className="flex-1 text-sm">
              <div className="text-gray-700">
                来源共 <span className="font-bold text-primary-600">{previewCount}</span> 词
              </div>
              <div className="text-xs text-gray-500">
                按当前节奏,预计 {estimatedDays} 天学完新词
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white px-5 py-3 border-t border-gray-100 flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">
            取消
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="btn-primary flex-1 flex items-center justify-center gap-1.5"
          >
            <Target size={16} /> {creating ? '创建中...' : '创建计划'}
          </button>
        </div>
      </div>
    </div>
  )
}

function NumberStepper({
  label,
  value,
  onChange,
  min,
  max,
  icon: Icon,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  icon: React.ComponentType<any>
}) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)))
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5 flex items-center gap-1">
        <Icon size={14} className="text-gray-400" /> {label}
      </label>
      <div className="flex items-center border rounded-xl overflow-hidden">
        <button
          onClick={() => set(value - 1)}
          className="px-3 py-2.5 text-gray-500 hover:bg-gray-50 active:bg-gray-100"
        >
          −
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => set(Number(e.target.value) || 0)}
          className="flex-1 text-center py-2.5 outline-none font-medium"
          min={min}
          max={max}
        />
        <button
          onClick={() => set(value + 1)}
          className="px-3 py-2.5 text-gray-500 hover:bg-gray-50 active:bg-gray-100"
        >
          +
        </button>
      </div>
    </div>
  )
}
