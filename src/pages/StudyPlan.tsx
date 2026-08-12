import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
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
  List,
  CheckSquare,
  Square,
  CheckCheck,
  Search,
  RotateCcw,
  RefreshCw,
  RefreshCcw,
} from 'lucide-react'
import { motion } from 'framer-motion'
import {
  useActivePlan,
  useAllPlans,
  usePlanProgress,
  usePlanById,
  usePlanWords,
  createPlan,
  activatePlan,
  archivePlan,
  deletePlan,
  ensureTodayReset,
  markPlanWordLearned,
  refreshPlanWords,
  getPlanNewWordCount,
} from '../hooks/useStudyPlan'
import {
  useActiveSentencePlan,
  useAllSentencePlans,
  useSentencePlanProgress,
  createSentencePlan,
  activateSentencePlan,
  archiveSentencePlan,
  deleteSentencePlan,
  ensureSentenceTodayReset,
  refreshSentencePlanWords,
  getSentencePlanNewWordCount,
} from '../hooks/useSentencePlan'
import { useCategories, useCategoryStats, useStats, useFavoriteWords, bulkMarkLearned, unmarkWordLearned } from '../hooks/useWords'
import { useSentenceStats, useFavoriteSentences, useSentenceCategoryStats } from '../hooks/useSentences'
import { StudyPlan as PlanType } from '../types/word'
import { BackButton } from '../components/BackButton'
import { useToast } from '../components/Toast'

const SOURCE_LABEL: Record<string, string> = {
  category: '分类',
  favorites: '收藏夹',
  all: '全部单词',
  allSentences: '全部短句',
}

export function StudyPlanPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'word' | 'sentence'>('word')
  const activePlan = useActivePlan()
  const allPlans = useAllPlans()
  const progress = usePlanProgress(activePlan)
  const activeSentencePlan = useActiveSentencePlan()
  const allSentencePlans = useAllSentencePlans()
  const sentenceProgress = useSentencePlanProgress(activeSentencePlan)
  const [showCreate, setShowCreate] = useState(false)
  const [showCreateSentence, setShowCreateSentence] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [newWordCount, setNewWordCount] = useState(0)
  const [syncingS, setSyncingS] = useState(false)
  const [newSentenceCount, setNewSentenceCount] = useState(0)

  useEffect(() => {
    if (activePlan?.id) {
      ensureTodayReset(activePlan.id)
      getPlanNewWordCount(activePlan.id).then(setNewWordCount)
    }
  }, [activePlan?.id])

  useEffect(() => {
    if (activeSentencePlan?.id) {
      ensureSentenceTodayReset(activeSentencePlan.id)
      getSentencePlanNewWordCount(activeSentencePlan.id).then(setNewSentenceCount)
    }
  }, [activeSentencePlan?.id])

  return (
    <div className="min-h-screen bg-gradient-mesh">
      <div className="p-4 space-y-5">
        <div className="flex items-center justify-between">
          <BackButton />
          <h1 className="page-title-accent flex items-center gap-2">
            <Target size={20} className="text-primary-600 dark:text-primary-400" /> 学习计划
          </h1>
          <button
            onClick={() => tab === 'word' ? setShowCreate(true) : setShowCreateSentence(true)}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            <Plus size={22} className="text-primary-600 dark:text-primary-400" />
          </button>
        </div>

        {/* 单词计划 | 短句计划 Tab */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab('word')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === 'word'
                ? 'bg-primary-500 text-white'
                : 'bg-white/70 dark:bg-slate-700/70 text-gray-600 dark:text-gray-300'
            }`}
          >
            单词计划
          </button>
          <button
            onClick={() => setTab('sentence')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === 'sentence'
                ? 'bg-primary-500 text-white'
                : 'bg-white/70 dark:bg-slate-700/70 text-gray-600 dark:text-gray-300'
            }`}
          >
            短句计划
          </button>
        </div>

        {tab === 'word' ? (
          <>
            {activePlan ? (
              <ActivePlanCard
                plan={activePlan}
                progress={progress}
                newWordCount={newWordCount}
                onStart={() => navigate(`/study?plan=${activePlan.id}`)}
                onReview={() => navigate(`/study?plan=${activePlan.id}&mode=review`)}
                onSync={async () => {
                  setSyncing(true)
                  await refreshPlanWords(activePlan.id!)
                  const cnt = await getPlanNewWordCount(activePlan.id!)
                  setNewWordCount(cnt)
                  setSyncing(false)
                }}
                syncing={syncing}
              />
            ) : (
              <EmptyPlan onCreate={() => setShowCreate(true)} label="单词学习计划" />
            )}

            {allPlans.length > 0 && (
              <div>
                <h2 className="font-semibold text-base mb-2 px-1 flex items-center gap-1.5 dark:text-gray-200">
                  <Layers size={16} className="text-gray-500 dark:text-gray-400" /> 全部计划
                  <span className="text-xs text-gray-400 font-normal">({allPlans.length})</span>
                </h2>
                <div className="space-y-2">
                  {allPlans.map((p, index) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <PlanRow
                        plan={p}
                        isActive={p.id === activePlan?.id}
                        onActivate={() => activatePlan(p.id!)}
                        onArchive={() => archivePlan(p.id!)}
                        onDelete={() => deletePlan(p.id!)}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {activeSentencePlan ? (
              <ActiveSentencePlanCard
                plan={activeSentencePlan}
                progress={sentenceProgress}
                newWordCount={newSentenceCount}
                onStart={() => navigate(`/sentences/study?plan=${activeSentencePlan.id}`)}
                onReview={() => navigate(`/sentences/study?plan=${activeSentencePlan.id}&mode=review`)}
                onSync={async () => {
                  setSyncingS(true)
                  await refreshSentencePlanWords(activeSentencePlan.id!)
                  const cnt = await getSentencePlanNewWordCount(activeSentencePlan.id!)
                  setNewSentenceCount(cnt)
                  setSyncingS(false)
                }}
                syncing={syncingS}
              />
            ) : (
              <EmptyPlan onCreate={() => setShowCreateSentence(true)} label="短句学习计划" />
            )}

            {allSentencePlans.length > 0 && (
              <div>
                <h2 className="font-semibold text-base mb-2 px-1 flex items-center gap-1.5 dark:text-gray-200">
                  <Layers size={16} className="text-gray-500 dark:text-gray-400" /> 全部计划
                  <span className="text-xs text-gray-400 font-normal">({allSentencePlans.length})</span>
                </h2>
                <div className="space-y-2">
                  {allSentencePlans.map((p, index) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <PlanRow
                        plan={p}
                        isActive={p.id === activeSentencePlan?.id}
                        onActivate={() => activateSentencePlan(p.id!)}
                        onArchive={() => archiveSentencePlan(p.id!)}
                        onDelete={() => deleteSentencePlan(p.id!)}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showCreate && (
        <CreatePlanModal
          onClose={() => setShowCreate(false)}
          onCreated={() => setShowCreate(false)}
        />
      )}

      {showCreateSentence && (
        <CreateSentencePlanModal
          onClose={() => setShowCreateSentence(false)}
          onCreated={() => setShowCreateSentence(false)}
        />
      )}
    </div>
  )
}

function EmptyPlan({ onCreate, label }: { onCreate: () => void; label?: string }) {
  const title = label ? `还没有${label}` : '还没有学习计划'
  const hint = label?.includes('短句')
    ? '选择分类或收藏夹,设定每日新短句与复习数量,逐步掌握全部短句'
    : '选择分类或收藏夹,设定每日新词与复习数量,逐步掌握全部单词'
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="card p-8 text-center"
    >
      <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
        <Target size={28} className="text-white" />
      </div>
      <h3 className="font-bold text-lg mb-1 dark:text-gray-100">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{hint}</p>
      <button onClick={onCreate} className="btn-primary inline-flex items-center gap-1.5">
        <Sparkles size={16} /> 创建学习计划
      </button>
    </motion.div>
  )
}

function ActivePlanCard({
  plan,
  progress,
  newWordCount,
  onStart,
  onReview,
  onSync,
  syncing,
}: {
  plan: PlanType
  progress: ReturnType<typeof usePlanProgress>
  newWordCount: number
  onStart: () => void
  onReview: () => void
  onSync: () => void
  syncing: boolean
}) {
  const newDone = Math.min(progress.todayNewDone, progress.todayNewTarget)
  const reviewDone = Math.min(progress.todayReviewDone, progress.dueReview)
  const newPct = progress.todayNewTarget > 0 ? (newDone / progress.todayNewTarget) * 100 : 0
  const reviewPct = progress.dueReview > 0 ? (reviewDone / progress.dueReview) * 100 : 0

  const sourceLabel =
    plan.sourceKind === 'category'
      ? plan.sourceCategory
      : SOURCE_LABEL[plan.sourceKind]

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="card p-5 bg-gradient-card border-primary-100 dark:border-primary-900/30"
    >
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 mb-1">
            <Flame size={12} /> 进行中
          </div>
          <h2 className="text-lg font-bold truncate dark:text-gray-100">{plan.name}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            来源: {sourceLabel} · 共 {progress.totalWords} 词
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onStart} className="btn-primary flex items-center gap-1.5 shrink-0">
            <Play size={16} /> 学习
          </button>
          <button
            onClick={onReview}
            className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
              progress.dueReview > 0
                ? 'bg-accent-500 text-white shadow-glow'
                : 'btn-secondary opacity-50'
            }`}
            disabled={progress.dueReview === 0}
          >
            <RefreshCw size={16} /> 复习
          </button>
          <Link
            to={`/plan/${plan.id}/words`}
            className="btn-secondary flex items-center gap-1.5 shrink-0"
          >
            <List size={16} /> 单词
          </Link>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
          <span>总进度</span>
          <span>{progress.learnedWords} / {progress.totalWords} 已掌握</span>
        </div>
        <div className="h-2.5 bg-white/70 dark:bg-slate-700/60 rounded-full overflow-hidden progress-shimmer">
          <div
            className="h-full bg-gradient-primary rounded-full transition-all duration-500"
            style={{ width: `${progress.overallPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-gray-400 dark:text-gray-500 mt-1">
          <span className="text-gradient font-medium">{progress.overallPercent}%</span>
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
          target={progress.dueReview}
          pct={reviewPct}
          color="accent"
        />
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <MiniStat label="已开始" value={progress.startedWords} />
        <MiniStat label="已掌握" value={progress.learnedWords} />
        <MiniStat label="待复习" value={progress.dueReview} highlight={progress.dueReview > 0} />
      </div>

      {/* 同步新单词提示 */}
      {newWordCount > 0 && (
        <button
          onClick={onSync}
          disabled={syncing}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs font-medium hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
        >
          <RefreshCcw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? '同步中...' : `有 ${newWordCount} 个新单词可同步到计划`}
        </button>
      )}
    </motion.div>
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
  const textColor = color === 'primary' ? 'text-primary-600 dark:text-primary-400' : 'text-accent-600 dark:text-accent-400'
  const completed = done >= target && target > 0
  return (
    <div className="bg-white/70 dark:bg-slate-700/40 rounded-xl p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-500 dark:text-gray-400">{title}</span>
        {completed && <CheckCircle2 size={14} className="text-success-500" />}
      </div>
      <div className="flex items-baseline gap-1 mb-2">
        <span className={`text-xl font-bold ${textColor}`}>{done}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500">/ {target}</span>
      </div>
      <div className="h-1.5 bg-gray-100 dark:bg-slate-600 rounded-full overflow-hidden">
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
    <div className="bg-white/50 dark:bg-slate-700/30 rounded-lg py-2">
      <div className={`text-base font-bold ${highlight ? 'text-warn-600 dark:text-warn-400' : 'text-gray-700 dark:text-gray-200'}`}>
        {value}
      </div>
      <div className="text-[10px] text-gray-400 dark:text-gray-500">{label}</div>
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
  const [confirmDelete, setConfirmDelete] = useState(false)
  const sourceLabel =
    plan.sourceKind === 'category' ? plan.sourceCategory : SOURCE_LABEL[plan.sourceKind]
  return (
    <div className="card p-3 flex items-center gap-3">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          isActive ? 'bg-gradient-primary text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
        }`}
      >
        <Target size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate dark:text-gray-200">{plan.name}</span>
          {plan.isArchived === 1 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400">
              已归档
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {sourceLabel} · 每日 {plan.newPerDay} 新 / {plan.reviewPerDay} 复习
        </div>
      </div>
      <div className="flex items-center gap-1">
        {!isActive && plan.isArchived === 0 && (
          <button
            onClick={onActivate}
            className="p-2 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/30 text-primary-600 dark:text-primary-400"
            aria-label="激活"
          >
            <Play size={16} />
          </button>
        )}
        {plan.isArchived === 0 && (
          <button
            onClick={onArchive}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400"
            aria-label="归档"
          >
            <Archive size={16} />
          </button>
        )}
        <button
          onClick={() => setConfirmDelete(true)}
          className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
          aria-label="删除"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {confirmDelete && (
        <div className="modal-overlay">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300 }}
            className="modal-content max-w-xs text-center"
          >
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-warn flex items-center justify-center shadow-glow">
              <Trash2 size={28} className="text-white" />
            </div>
            <h3 className="font-bold text-lg mb-1 dark:text-gray-100">删除计划?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              计划: <span className="font-medium text-gray-700 dark:text-gray-200">{plan.name}</span>
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">
              删除后不可恢复（不会删除单词本身）
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary flex-1">
                取消
              </button>
              <button
                onClick={() => {
                  setConfirmDelete(false)
                  onDelete()
                }}
                className="btn-danger flex-1"
              >
                确认删除
              </button>
            </div>
          </motion.div>
        </div>
      )}
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
  const { toast } = useToast()
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
      toast('success', `计划「${n}」已创建`)
      onCreated()
    } catch (e) {
      setError((e as Error).message || '创建失败，请重试')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="modal-overlay" style={{ alignItems: 'flex-end' }}>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] overflow-auto"
      >
        <div className="sticky top-0 bg-white dark:bg-slate-800 px-5 pt-5 pb-3 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg flex items-center gap-2 dark:text-gray-100">
              <Sparkles size={18} className="text-primary-600 dark:text-primary-400" /> 新建学习计划
            </h3>
            <button onClick={onClose} className="text-gray-400 dark:text-gray-500 text-sm">
              取消
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-2.5 rounded-xl text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">计划名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如: CET-4 三十天冲刺"
              className="input-field"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">单词来源</label>
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
                      : 'bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-600'
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
              <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">选择分类</label>
              <div className="max-h-40 overflow-auto border rounded-xl dark:border-slate-700 p-1.5 space-y-1">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSourceCategory(c.name)}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-lg transition-colors ${
                      sourceCategory === c.name ? 'bg-primary-50 dark:bg-primary-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="text-sm flex-1 text-left dark:text-gray-200">{c.name}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{categoryWordCount(c.name)} 词</span>
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

          <div className="bg-gradient-card dark:bg-slate-700/40 rounded-xl p-3.5 flex items-center gap-3">
            <Calendar size={20} className="text-primary-600 dark:text-primary-400 shrink-0" />
            <div className="flex-1 text-sm">
              <div className="text-gray-700 dark:text-gray-200">
                来源共 <span className="font-bold text-gradient">{previewCount}</span> 词
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                按当前节奏,预计 {estimatedDays} 天学完新词
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-slate-800 px-5 py-3 border-t border-gray-100 dark:border-slate-700 flex gap-2">
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
      </motion.div>
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
      <label className="block text-sm font-medium mb-1.5 flex items-center gap-1 dark:text-gray-300">
        <Icon size={14} className="text-gray-400 dark:text-gray-500" /> {label}
      </label>
      <div className="flex items-center border rounded-xl dark:border-slate-600 overflow-hidden">
        <button
          onClick={() => set(value - 1)}
          className="px-3 py-2.5 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 active:bg-gray-100"
        >
          −
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => set(Number(e.target.value) || 0)}
          className="flex-1 text-center py-2.5 outline-none font-medium bg-transparent dark:text-gray-200"
          min={min}
          max={max}
        />
        <button
          onClick={() => set(value + 1)}
          className="px-3 py-2.5 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 active:bg-gray-100"
        >
          +
        </button>
      </div>
    </div>
  )
}

// === 短句计划: 复用 ActivePlanCard 结构但数据来自 useSentencePlan ===

function ActiveSentencePlanCard({
  plan,
  progress,
  newWordCount,
  onStart,
  onReview,
  onSync,
  syncing,
}: {
  plan: PlanType
  progress: ReturnType<typeof useSentencePlanProgress>
  newWordCount: number
  onStart: () => void
  onReview: () => void
  onSync: () => void
  syncing: boolean
}) {
  const newDone = Math.min(progress.todayNewDone, progress.todayNewTarget)
  const reviewDone = Math.min(progress.todayReviewDone, progress.dueReview)
  const newPct = progress.todayNewTarget > 0 ? (newDone / progress.todayNewTarget) * 100 : 0
  const reviewPct = progress.dueReview > 0 ? (reviewDone / progress.dueReview) * 100 : 0

  const sourceLabel =
    plan.sourceKind === 'category'
      ? plan.sourceCategory
      : plan.sourceKind === 'favorites'
      ? '收藏夹'
      : '全部短句'

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="card p-5 bg-gradient-card border-primary-100 dark:border-primary-900/30"
    >
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 mb-1">
            <Flame size={12} /> 进行中
          </div>
          <h2 className="text-lg font-bold truncate dark:text-gray-100">{plan.name}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            来源: {sourceLabel} · 共 {progress.totalSentences} 条
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onStart} className="btn-primary flex items-center gap-1.5 shrink-0">
            <Play size={16} /> 学习
          </button>
          <button
            onClick={onReview}
            className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
              progress.dueReview > 0
                ? 'bg-accent-500 text-white shadow-glow'
                : 'btn-secondary opacity-50'
            }`}
            disabled={progress.dueReview === 0}
          >
            <RefreshCw size={16} /> 复习
          </button>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
          <span>总进度</span>
          <span>{progress.learnedSentences} / {progress.totalSentences} 已掌握</span>
        </div>
        <div className="h-2.5 bg-white/70 dark:bg-slate-700/60 rounded-full overflow-hidden progress-shimmer">
          <div
            className="h-full bg-gradient-primary rounded-full transition-all duration-500"
            style={{ width: `${progress.overallPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-gray-400 dark:text-gray-500 mt-1">
          <span className="text-gradient font-medium">{progress.overallPercent}%</span>
          <span>预计还需 {progress.estimatedDaysLeft} 天</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TodayCard
          title="今日新句"
          done={newDone}
          target={progress.todayNewTarget}
          pct={newPct}
          color="primary"
        />
        <TodayCard
          title="今日复习"
          done={reviewDone}
          target={progress.dueReview}
          pct={reviewPct}
          color="accent"
        />
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <MiniStat label="已开始" value={progress.startedSentences} />
        <MiniStat label="已掌握" value={progress.learnedSentences} />
        <MiniStat label="待复习" value={progress.dueReview} highlight={progress.dueReview > 0} />
      </div>

      {newWordCount > 0 && (
        <button
          onClick={onSync}
          disabled={syncing}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs font-medium hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
        >
          <RefreshCcw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? '同步中...' : `有 ${newWordCount} 个新短句可同步到计划`}
        </button>
      )}
    </motion.div>
  )
}

function CreateSentencePlanModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const { toast } = useToast()
  const categories = useCategories()
  const sentenceStats = useSentenceStats()
  const sentenceCategoryStats = useSentenceCategoryStats()
  const favSentences = useFavoriteSentences()
  const [name, setName] = useState('')
  const [sourceKind, setSourceKind] = useState<'category' | 'favorites' | 'all'>('all')
  const [sourceCategory, setSourceCategory] = useState(categories[0]?.name ?? '默认')
  const [newPerDay, setNewPerDay] = useState(5)
  const [reviewPerDay, setReviewPerDay] = useState(10)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (sourceKind === 'category' && !categories.find((c) => c.name === sourceCategory)) {
      setSourceCategory(categories[0]?.name ?? '默认')
    }
  }, [sourceKind, categories, sourceCategory])

  const previewCount =
    sourceKind === 'category'
      ? sentenceCategoryStats[sourceCategory] ?? 0
      : sourceKind === 'favorites'
      ? favSentences.length
      : sentenceStats.total

  const estimatedDays = newPerDay > 0 ? Math.ceil(previewCount / newPerDay) : 0

  const handleCreate = async () => {
    const n = name.trim()
    if (!n) {
      setError('请填写计划名称')
      return
    }
    if (newPerDay < 1) {
      setError('每日新短句数至少为 1')
      return
    }
    setCreating(true)
    try {
      await createSentencePlan({
        name: n,
        sourceKind,
        sourceCategory: sourceKind === 'category' ? sourceCategory : '',
        newPerDay,
        reviewPerDay,
      })
      toast('success', `短句计划「${n}」已创建`)
      onCreated()
    } catch (e) {
      setError((e as Error).message || '创建失败，请重试')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="modal-overlay" style={{ alignItems: 'flex-end' }}>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] overflow-auto"
      >
        <div className="sticky top-0 bg-white dark:bg-slate-800 px-5 pt-5 pb-3 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg flex items-center gap-2 dark:text-gray-100">
              <Sparkles size={18} className="text-primary-600 dark:text-primary-400" /> 新建短句学习计划
            </h3>
            <button onClick={onClose} className="text-gray-400 dark:text-gray-500 text-sm">
              取消
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-2.5 rounded-xl text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">计划名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如: 日常对话两周冲刺"
              className="input-field"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">短句来源</label>
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
                      : 'bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-600'
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
              <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">选择分类</label>
              <div className="max-h-40 overflow-auto border rounded-xl dark:border-slate-700 p-1.5 space-y-1">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSourceCategory(c.name)}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-lg transition-colors ${
                      sourceCategory === c.name ? 'bg-primary-50 dark:bg-primary-900/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="text-sm flex-1 text-left dark:text-gray-200">{c.name}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{sentenceCategoryStats[c.name] ?? 0} 条</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <NumberStepper
              label="每日新句"
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

          <div className="bg-gradient-card dark:bg-slate-700/40 rounded-xl p-3.5 flex items-center gap-3">
            <Calendar size={20} className="text-primary-600 dark:text-primary-400 shrink-0" />
            <div className="flex-1 text-sm">
              <div className="text-gray-700 dark:text-gray-200">
                来源共 <span className="font-bold text-gradient">{previewCount}</span> 条
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                按当前节奏,预计 {estimatedDays} 天学完新短句
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-slate-800 px-5 py-3 border-t border-gray-100 dark:border-slate-700 flex gap-2">
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
      </motion.div>
    </div>
  )
}

// === 计划单词列表页 (含批量掌握) ===

type WordStatus = 'new' | 'started' | 'mastered'

function getWordStatus(word: { isLearned: number; reviewCount: number }, startedSet: Set<number>, wordId: number): WordStatus {
  if (word.isLearned === 1) return 'mastered'
  if (startedSet.has(wordId) || word.reviewCount > 0) return 'started'
  return 'new'
}

const STATUS_LABEL: Record<WordStatus, string> = {
  new: '未学习',
  started: '学习中',
  mastered: '已掌握',
}

const STATUS_STYLE: Record<WordStatus, string> = {
  new: 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400',
  started: 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400',
  mastered: 'bg-success-50 dark:bg-success-900/30 text-success-600 dark:text-success-400',
}

export function PlanWordList() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const planId = Number(id)
  const plan = usePlanById(planId)
  const words = usePlanWords(plan)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<WordStatus | 'all'>('all')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [confirmBatch, setConfirmBatch] = useState(false)
  const [confirmUnmaster, setConfirmUnmaster] = useState<number | null>(null)

  const startedSet = useMemo(
    () => new Set(plan?.startedIds ?? []),
    [plan?.startedIds]
  )

  const enriched = words.map((w) => ({
    ...w,
    status: getWordStatus(w, startedSet, w.id!),
  }))

  const filtered = enriched.filter((w) => {
    const q = search.toLowerCase()
    const defs = w.definitions ?? []
    const defsText = defs.map((d: any) => `${d.pos ?? ''} ${d.def ?? ''} ${d.trans ?? ''}`).join(' ')
    const matchSearch =
      search === '' ||
      w.word.toLowerCase().includes(q) ||
      (w.translation ?? '').includes(search) ||
      (w.definition ?? '').toLowerCase().includes(q) ||
      defsText.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || w.status === statusFilter
    return matchSearch && matchStatus
  })

  const selectableIds = enriched
    .filter((w) => w.status !== 'mastered')
    .map((w) => w.id!)

  function toggleSelect(wordId: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(wordId)) next.delete(wordId)
      else next.add(wordId)
      return next
    })
  }

  function selectAll() {
    const filteredIds = new Set(filtered.map((w) => w.id))
    const masteredIds = new Set(enriched.filter((w) => w.status === 'mastered').map((w) => w.id))
    setSelected(new Set(selectableIds.filter((id) => filteredIds.has(id) && !masteredIds.has(id))))
  }

  function deselectAll() {
    setSelected(new Set())
  }

  async function handleBatchMaster() {
    if (selected.size === 0) return
    const ids = Array.from(selected)
    await bulkMarkLearned(ids)
    if (plan) {
      // 用 Map 避免每次 find 都是 O(n)
      const byId = new Map(enriched.map((w) => [w.id, w]))
      for (const wordId of ids) {
        const w = byId.get(wordId)
        if (w) {
          const wasReview = w.status === 'started'
          await markPlanWordLearned(plan.id!, wordId, wasReview)
        }
      }
    }
    toast('success', `已标记 ${ids.length} 个单词为已掌握`)
    setSelected(new Set())
    setSelectMode(false)
    setConfirmBatch(false)
  }

  async function handleUnmaster(wordId: number) {
    await unmarkWordLearned(wordId)
    toast('info', '已取消掌握标记')
    setConfirmUnmaster(null)
  }

  const counts = {
    all: enriched.length,
    new: enriched.filter((w) => w.status === 'new').length,
    started: enriched.filter((w) => w.status === 'started').length,
    mastered: enriched.filter((w) => w.status === 'mastered').length,
  }

  return (
    <div className="min-h-screen bg-gradient-mesh">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/plan')}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="page-title-accent flex items-center gap-2">
            <List size={20} className="text-primary-600 dark:text-primary-400" /> {plan?.name ?? '计划单词'}
          </h1>
          <button
            onClick={() => {
              setSelectMode(!selectMode)
              if (selectMode) {
                setSelected(new Set())
              }
            }}
            className={`p-2 rounded-xl transition-colors ${selectMode ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'hover:bg-gray-100 dark:hover:bg-slate-700'}`}
          >
            {selectMode ? <CheckCheck size={22} /> : <CheckSquare size={22} className="text-primary-600 dark:text-primary-400" />}
          </button>
        </div>

        {/* 搜索 */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索单词、释义..."
            className="input-field pl-10"
          />
        </div>

        {/* 状态筛选 */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {([
            { key: 'all', label: `全部 ${counts.all}` },
            { key: 'new', label: `未学习 ${counts.new}` },
            { key: 'started', label: `学习中 ${counts.started}` },
            { key: 'mastered', label: `已掌握 ${counts.mastered}` },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all ${
                statusFilter === key
                  ? 'bg-gradient-primary text-white shadow-glow'
                  : 'bg-white/70 dark:bg-slate-700/70 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 选择模式操作栏 */}
        {selectMode && (
          <div className="flex items-center justify-between bg-white/80 dark:bg-slate-800/80 rounded-xl px-4 py-2.5 shadow-soft">
            <div className="flex items-center gap-3">
              <button onClick={selectAll} className="text-xs text-primary-600 dark:text-primary-400 font-medium hover:underline">
                全选
              </button>
              <button onClick={deselectAll} className="text-xs text-gray-500 dark:text-gray-400 hover:underline">
                取消全选
              </button>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              已选 {selected.size} 个
            </span>
          </div>
        )}

        {/* 单词列表 */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <List size={40} className="mx-auto mb-3 opacity-40" />
            <p>{search ? '未找到匹配的单词' : '暂无单词'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((w, index) => (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.5) }}
                onClick={() => {
                  if (selectMode && w.status !== 'mastered') {
                    toggleSelect(w.id!)
                  } else if (!selectMode) {
                    navigate(`/word/${w.id}?scope=all`)
                  }
                }}
                className={`card p-3.5 flex items-center gap-3 transition-all cursor-default ${
                  selectMode && w.status !== 'mastered' ? 'cursor-pointer active:scale-[0.98]' : !selectMode ? 'cursor-pointer' : ''
                } ${selected.has(w.id!) ? 'ring-2 ring-primary-400 dark:ring-primary-600 bg-primary-50/50 dark:bg-primary-900/20' : ''}`}
              >
                {selectMode && w.status !== 'mastered' && (
                  <div className="shrink-0">
                    {selected.has(w.id!) ? (
                      <CheckSquare size={20} className="text-primary-600 dark:text-primary-400" />
                    ) : (
                      <Square size={20} className="text-gray-300 dark:text-gray-600" />
                    )}
                  </div>
                )}
                {selectMode && w.status === 'mastered' && (
                  <div className="shrink-0">
                    <CheckSquare size={20} className="text-success-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base dark:text-gray-100">{w.word}</span>
                    <span className={`chip text-[10px] ${STATUS_STYLE[w.status]}`}>
                      {STATUS_LABEL[w.status]}
                    </span>
                  </div>
                  {(() => {
                    const defs = w.definitions ?? []
                    if (defs.length > 0) {
                      return (
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate mt-0.5">
                          {defs.map((d: any) => [d.pos, d.trans || d.def].filter(Boolean).join(' ')).join('; ')}
                        </p>
                      )
                    }
                    return w.translation ? (
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate mt-0.5">{w.translation}</p>
                    ) : null
                  })()}
                </div>
                {!selectMode && w.status === 'mastered' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmUnmaster(w.id!)
                    }}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-warn-600 dark:text-warn-400 bg-warn-50 dark:bg-warn-900/30 hover:bg-warn-100 dark:hover:bg-warn-900/50 transition-colors"
                  >
                    <RotateCcw size={13} /> 取消掌握
                  </button>
                )}
                {!selectMode && w.status !== 'mastered' && (
                  <ArrowLeft size={16} className="text-gray-300 dark:text-gray-600 rotate-180 shrink-0" />
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* 批量掌握底栏 */}
      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700 px-4 py-3 flex items-center justify-between shadow-lg z-40">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            已选择 <span className="font-bold text-gradient">{selected.size}</span> 个单词
          </span>
          <button
            onClick={() => setConfirmBatch(true)}
            className="btn-success flex items-center gap-1.5"
          >
            <CheckCheck size={16} /> 批量掌握
          </button>
        </div>
      )}

      {/* 批量掌握确认弹窗 */}
      {confirmBatch && (
        <div className="modal-overlay">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300 }}
            className="modal-content max-w-xs text-center"
          >
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-success flex items-center justify-center shadow-glow">
              <CheckCheck size={28} className="text-white" />
            </div>
            <h3 className="font-bold text-lg mb-1 dark:text-gray-100">批量标记为已掌握?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              共 <span className="font-bold text-gradient">{selected.size}</span> 个单词
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">
              标记后将不再进入复习队列
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmBatch(false)} className="btn-secondary flex-1">
                取消
              </button>
              <button onClick={handleBatchMaster} className="btn-success flex-1">
                确认掌握
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 取消掌握确认弹窗 */}
      {confirmUnmaster !== null && (
        <div className="modal-overlay">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300 }}
            className="modal-content max-w-xs text-center"
          >
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-warn flex items-center justify-center shadow-glow">
              <RotateCcw size={28} className="text-white" />
            </div>
            <h3 className="font-bold text-lg mb-1 dark:text-gray-100">取消掌握?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              单词: <span className="font-medium text-gray-700 dark:text-gray-200">{enriched.find((w) => w.id === confirmUnmaster)?.word}</span>
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">
              取消后该单词将重新进入复习队列
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmUnmaster(null)} className="btn-secondary flex-1">
                取消
              </button>
              <button onClick={() => handleUnmaster(confirmUnmaster)} className="btn-primary flex-1">
                确认
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
