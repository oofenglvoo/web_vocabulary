import { Link, useNavigate } from 'react-router-dom'
import {
  Play,
  Heart,
  FolderOpen,
  Plus,
  Target,
  Sparkles,
  BarChart3,
  Settings,
} from 'lucide-react'
import {
  useDueCount,
  useStats,
  useFavoriteWords,
} from '../hooks/useWords'
import { useActivePlan, usePlanProgress } from '../hooks/useStudyPlan'

export function Home() {
  const navigate = useNavigate()
  const dueCount = useDueCount()
  const stats = useStats()
  const favorites = useFavoriteWords()
  const activePlan = useActivePlan()
  const planProgress = usePlanProgress(activePlan)
  const overallProgress =
    stats.total > 0 ? Math.round((stats.learned / stats.total) * 100) : 0

  return (
    <div className="pb-2 animate-fade-in">
      {/* 顶部渐变 Hero 区(只放标题与统计) */}
      <div className="relative overflow-hidden bg-gradient-primary text-white px-5 pt-6 pb-6 rounded-b-[28px] shadow-card">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 -left-8 w-40 h-40 rounded-full bg-white/10" />
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/80 text-xs">今日</p>
              <h1 className="text-2xl font-bold mt-0.5">单词记忆</h1>
            </div>
            <Link
              to="/stats"
              className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30"
              aria-label="设置"
            >
              <Settings size={18} />
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <HeroStat label="总词汇" value={stats.total} />
            <HeroStat label="已掌握" value={stats.learned} />
            <HeroStat label="待复习" value={dueCount} highlight={dueCount > 0} />
          </div>
        </div>
      </div>

      {/* 主内容(Hero 与卡片之间留正向间距) */}
      <div className="px-4 mt-4 space-y-4">
        {/* 快速学习卡片 */}
        <div className="card p-4 bg-white shadow-card animate-slide-up">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center text-white shadow-glow shrink-0">
                <Sparkles size={18} />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold truncate">
                  {dueCount > 0 ? `${dueCount} 个单词待复习` : '没有待复习的单词'}
                </h2>
                <p className="text-xs text-gray-500 truncate">
                  {dueCount > 0 ? '巩固记忆,持续进步' : '学习新单词或开始计划'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>整体进度</span>
            <span className="font-medium">{overallProgress}%</span>
          </div>
          <div className="progress-track h-2 mb-3">
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
        </div>

        {/* 学习计划卡片 */}
        {activePlan ? (
          <div className="card p-4 bg-gradient-card border-primary-100 animate-slide-up">
            <Link to="/plan" className="block">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-gradient-success flex items-center justify-center text-white shadow-soft">
                    <Target size={18} />
                  </div>
                  <div>
                    <div className="text-[10px] text-success-600 font-medium">
                      进行中的计划
                    </div>
                    <h3 className="font-semibold text-sm">{activePlan.name}</h3>
                  </div>
                </div>
                <span className="text-xs text-primary-600 font-medium">
                  {planProgress.overallPercent}%
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-2 text-center">
                <div>
                  <div className="text-base font-bold text-primary-600">
                    {planProgress.todayNewDone}/{planProgress.todayNewTarget}
                  </div>
                  <div className="text-[10px] text-gray-500">今日新词</div>
                </div>
                <div>
                  <div className="text-base font-bold text-accent-600">
                    {planProgress.todayReviewDone}/{planProgress.todayReviewTarget}
                  </div>
                  <div className="text-[10px] text-gray-500">今日复习</div>
                </div>
                <div>
                  <div className="text-base font-bold text-warn-600">
                    {planProgress.dueReview}
                  </div>
                  <div className="text-[10px] text-gray-500">待复习</div>
                </div>
              </div>

              <div className="progress-track h-1.5">
                <div
                  className="progress-fill"
                  style={{ width: `${planProgress.overallPercent}%` }}
                />
              </div>
            </Link>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                onClick={() =>
                  navigate(`/study?plan=${activePlan.id}&mode=learn`)
                }
                className="btn-primary py-2 text-sm gap-1.5"
              >
                <Play size={14} fill="currentColor" /> 学习
              </button>
              <button
                onClick={() =>
                  navigate(`/study?plan=${activePlan.id}&mode=quiz`)
                }
                className="btn-secondary py-2 text-sm gap-1.5"
              >
                <Target size={14} /> 测验
              </button>
            </div>
          </div>
        ) : (
          <Link
            to="/plan"
            className="card p-4 flex items-center gap-3 hover:shadow-glow transition-all animate-slide-up"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-primary flex items-center justify-center text-white shadow-glow">
              <Target size={20} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm">创建学习计划</h3>
              <p className="text-xs text-gray-500">
                设定每日新词与复习数,科学背单词
              </p>
            </div>
            <span className="text-primary-600 text-xs font-medium">→</span>
          </Link>
        )}

        {/* 快速操作 */}
        <div className="grid grid-cols-4 gap-2">
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
        </div>
      </div>
    </div>
  )
}

function HeroStat({
  label,
  value,
  highlight,
}: {
  label: string
  value: number | string
  highlight?: boolean
}) {
  return (
    <div className="bg-white/15 backdrop-blur rounded-xl p-2.5 text-center">
      <div className={`text-xl font-bold ${highlight ? 'text-yellow-200' : ''}`}>
        {value}
      </div>
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
      <span className="text-[11px] text-gray-700">{label}</span>
    </Link>
  )
}
