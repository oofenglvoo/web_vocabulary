import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Play,
  Heart,
  FolderOpen,
  Plus,
  Target,
  Sparkles,
  BarChart3,
  Settings,
  RefreshCw,
  Flame,
  Zap,
  MessageSquare,
  CalendarCheck,
} from 'lucide-react'
import {
  useStats,
  useFavoriteWords,
} from '../hooks/useWords'
import { useActivePlan, usePlanProgress } from '../hooks/useStudyPlan'

export function Home() {
  const navigate = useNavigate()
  const stats = useStats()
  const favorites = useFavoriteWords()
  const activePlan = useActivePlan()
  const planProgress = usePlanProgress(activePlan)
  const overallProgress =
    stats.total > 0 ? Math.round((stats.learned / stats.total) * 100) : 0

  const todayNewRemaining = planProgress.todayNewRemaining
  const todayReviewRemaining = planProgress.todayReviewRemaining
  const taskCount = todayNewRemaining + todayReviewRemaining
  const estimatedMinutes = taskCount > 0 ? Math.max(1, Math.ceil(taskCount * 0.5)) : 0
  // 今日新词是否学满(配额内)且还有未掌握可学 → 点"学习"弹确认
  const newQuotaDone = todayNewRemaining === 0 && planProgress.remainingNew > 0
  const [confirmExtra, setConfirmExtra] = useState(false)

  return (
    <div className="pb-2">
      {/* 顶部渐变 Hero 区 */}
      <div className="relative overflow-hidden bg-gradient-primary text-white px-5 pt-6 pb-6 rounded-b-[28px] shadow-card">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 -left-8 w-40 h-40 rounded-full bg-white/10" />
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/80 text-xs">今日</p>
              <h1 className="text-2xl font-bold tracking-tight mt-0.5">单词记忆</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/checkin"
                className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition-colors"
                aria-label="打卡"
              >
                <CalendarCheck size={18} />
              </Link>
              <Link
                to="/stats"
                className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition-colors"
                aria-label="统计"
              >
                <Settings size={18} />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <HeroStat label="总词汇" value={stats.total} />
            <HeroStat label="已掌握" value={stats.learned} />
            <HeroStat label="学习中" value={stats.total - stats.learned} />
          </div>

          {/* 连续学习天数 */}
          {stats.streak > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 flex items-center justify-center gap-1.5 text-sm"
            >
              <Flame size={16} className="text-yellow-300" />
              <span className="text-white/90 font-medium">连续学习 {stats.streak} 天</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* 主内容 */}
      <div className="px-4 mt-4 space-y-4">
        {/* 今日任务引导 (有计划时) */}
        {activePlan && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card p-4 bg-white dark:bg-slate-800/90 shadow-card"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center text-white shadow-glow shrink-0">
                <Zap size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold truncate dark:text-gray-100">今日任务</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{activePlan.name}</p>
              </div>
            </div>

            <div className="rounded-xl bg-primary-50 dark:bg-primary-900/30 p-3 mb-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">今天还需要完成</div>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-bold text-gradient">{taskCount}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">个任务</span>
                  </div>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {estimatedMinutes > 0 ? `约 ${estimatedMinutes} 分钟` : '今日已完成'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-primary-50 dark:bg-primary-900/30 rounded-xl p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">待学新词</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-gradient">
                    {todayNewRemaining}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">词</span>
                </div>
              </div>
              <div className="bg-accent-50 dark:bg-accent-900/30 rounded-xl p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">待复习</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-accent-600">{todayReviewRemaining}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">词</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => (newQuotaDone ? setConfirmExtra(true) : navigate(`/study?plan=${activePlan.id}&mode=learn`))}
                className="btn-primary py-2.5 text-sm gap-1.5"
              >
                <Play size={14} fill="currentColor" /> {todayNewRemaining > 0 ? '开始学习' : '额外学习'}
              </button>
              <button
                onClick={() => navigate(`/study?plan=${activePlan.id}&mode=review`)}
                className={`py-2.5 text-sm gap-1.5 flex items-center justify-center rounded-xl font-medium transition-all ${
                  todayReviewRemaining > 0
                    ? 'bg-accent-500 text-white shadow-glow active:scale-95'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-400'
                }`}
                disabled={todayReviewRemaining === 0}
              >
                <RefreshCw size={14} /> {todayReviewRemaining > 0 ? '开始复习' : '已完成复习'}
              </button>
            </div>

            {/* 今日新词学满 → 确认是否加学 */}
            {confirmExtra && (
              <div className="modal-overlay">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className="modal-content max-w-xs text-center"
                >
                  <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-warn flex items-center justify-center shadow-glow">
                    <Sparkles size={28} className="text-white" />
                  </div>
                  <h3 className="font-bold text-lg mb-1 dark:text-gray-100">今日新词已学满</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    本日配额已用完（{planProgress.todayNewDisplay}/{planProgress.todayNewTarget}）
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">
                    是否继续额外学习？（不计入今日配额）
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmExtra(false)} className="btn-secondary flex-1">
                      取消
                    </button>
                    <button
                      onClick={() => {
                        setConfirmExtra(false)
                        navigate(`/study?plan=${activePlan.id}&mode=learn&extra=1`)
                      }}
                      className="btn-primary flex-1"
                    >
                      额外学习
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </motion.div>
        )}

        {/* 无计划时的整体进度卡片 */}
        {!activePlan && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card p-4 bg-white dark:bg-slate-800/90 shadow-card"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center text-white shadow-glow shrink-0">
                  <Sparkles size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold truncate dark:text-gray-100">
                    {stats.total > 0 ? `共 ${stats.total} 个单词` : '还没有单词'}
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {stats.total > 0 ? '持续学习,掌握更多词汇' : '添加单词开始学习'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
              <span>整体进度</span>
              <span className="font-medium text-gradient">{overallProgress}%</span>
            </div>
            <div className="progress-track h-2 mb-3 progress-shimmer">
              <div
                className="progress-fill"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => navigate('/study?mode=learn')}
                className="btn-primary py-2.5 text-sm gap-1.5"
              >
                <Play size={14} fill="currentColor" /> 学习
              </button>
              <button
                onClick={() => navigate('/study?mode=quiz')}
                className="btn-secondary py-2.5 text-sm gap-1.5"
              >
                <Target size={14} /> 测验
              </button>
            </div>
          </motion.div>
        )}

        {/* 学习计划卡片 */}
        {activePlan ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card p-4 bg-gradient-card border-primary-100 dark:border-primary-900/30"
          >
            <Link to="/plan" className="block">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-gradient-success flex items-center justify-center text-white shadow-soft">
                    <Target size={18} />
                  </div>
                  <div>
                    <div className="text-[10px] text-success-600 dark:text-success-400 font-medium">
                      进行中的计划
                    </div>
                    <h3 className="font-semibold text-sm dark:text-gray-100">{activePlan.name}</h3>
                  </div>
                </div>
                <span className="text-xs text-gradient font-medium">
                  {planProgress.overallPercent}%
                </span>
              </div>

              <div className="progress-track h-1.5 mb-2 progress-shimmer">
                <div
                  className="progress-fill"
                  style={{ width: `${planProgress.overallPercent}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-sm font-bold text-gray-700 dark:text-gray-200">
                    {planProgress.learnedWords}/{planProgress.totalWords}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">已掌握</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-primary-600 dark:text-primary-400">
                    {planProgress.startedWords - planProgress.learnedWords}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">学习中</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-warn-600 dark:text-warn-400">
                    {planProgress.remainingNew}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">未开始</div>
                </div>
              </div>
            </Link>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Link
              to="/plan"
              className="card p-4 flex items-center gap-3 hover:shadow-glow transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-primary flex items-center justify-center text-white shadow-glow">
                <Target size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm dark:text-gray-100">创建学习计划</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  设定每日新词与复习数,科学背单词
                </p>
              </div>
              <span className="text-primary-600 dark:text-primary-400 text-xs font-medium">→</span>
            </Link>
          </motion.div>
        )}

        {/* 快速操作 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-4 gap-2"
        >
          <QuickAction
            to="/add"
            icon={<Plus size={20} />}
            label="添加"
            color="from-primary-500 to-primary-600"
          />
          <QuickAction
            to="/favorites"
            icon={<Heart size={20} />}
            label={`收藏 ${favorites.length}`}
            color="from-accent-500 to-accent-600"
          />
          <QuickAction
            to="/categories"
            icon={<FolderOpen size={20} />}
            label="分类"
            color="from-warn-500 to-warn-600"
          />
          <QuickAction
            to="/stats"
            icon={<BarChart3 size={20} />}
            label="统计"
            color="from-success-500 to-success-600"
          />
        </motion.div>

        {/* 短句入口 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Link
            to="/sentences"
            className="card p-4 flex items-center gap-3 hover:shadow-glow transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white shadow-soft">
              <MessageSquare size={20} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm dark:text-gray-100">短句学习</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                管理和复习常用短句、短语
              </p>
            </div>
            <span className="text-purple-600 dark:text-purple-400 text-xs font-medium">→</span>
          </Link>
        </motion.div>
      </div>
    </div>
  )
}

function HeroStat({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <div className="bg-white/15 backdrop-blur rounded-xl p-2.5 text-center">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[10px] text-white/80 mt-0.5">{label}</div>
    </div>
  )
}

function QuickAction({
  to,
  icon,
  label,
  color,
}: {
  to: string
  icon: React.ReactNode
  label: string
  color: string
}) {
  return (
    <Link
      to={to}
      className="card p-3 flex flex-col items-center gap-1.5 hover:shadow-glow transition-all"
    >
      <div
        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white shadow-soft`}
      >
        {icon}
      </div>
      <span className="text-[11px] text-gray-700 dark:text-gray-300">{label}</span>
    </Link>
  )
}
