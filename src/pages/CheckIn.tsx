import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Flame, Clock, Trophy, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCheckInStats, useMonthCheckIns, dateKeyOf } from '../hooks/useCheckIn'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { ACHIEVEMENTS, getUnlocked, checkAchievements, AchievementStats } from '../utils/achievements'
import { AchievementCard } from '../components/AchievementCard'
import { BackButton } from '../components/BackButton'
import { useToast } from '../components/Toast'

const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六']

export function CheckIn() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const stats = useCheckInStats()

  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1) // 1-12
  const monthCheckIns = useMonthCheckIns(viewYear, viewMonth)

  // 累计学时（所有 session durationMs 求和）
  const totalMinutes = useLiveQuery(async () => {
    let sum = 0
    await db.studySessions.each((s) => {
      sum += s.durationMs || 0
    })
    return Math.round(sum / 60000)
  }, []) ?? 0

  // 勋章统计
  const totalSessions = useLiveQuery(() => db.studySessions.count(), []) ?? 0
  const totalLearned =
    (useLiveQuery(() => db.words.where('isLearned').equals(1).count(), []) ?? 0) +
    (useLiveQuery(() => db.sentences.where('isLearned').equals(1).count(), []) ?? 0)
  const totalPlans = useLiveQuery(() => db.studyPlans.count(), []) ?? 0

  // 页面打开时检查新解锁勋章
  useEffect(() => {
    const achStats: AchievementStats = {
      totalSessions,
      totalDays: stats.totalDays,
      streak: stats.streak,
      totalLearned,
      totalPlans,
    }
    const newly = checkAchievements(achStats)
    newly.forEach((a) => toast('success', `🏆 解锁勋章「${a.title}」`))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalSessions, totalLearned, totalPlans, stats.totalDays, stats.streak])

  // 构建当月日历格子（含上/下月补齐）
  const firstDay = new Date(viewYear, viewMonth - 1, 1)
  const startWeekday = firstDay.getDay() // 0=周日
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate()
  const cells: (number | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const changeMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth - 1 + delta, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth() + 1)
  }

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center justify-between">
        <BackButton />
        <h1 className="page-title-accent flex items-center gap-2">
          <Calendar size={20} className="text-primary-600 dark:text-primary-400" /> 打卡
        </h1>
        <div className="w-10" />
      </div>

      {/* 顶部统计 */}
      <div className="card p-4 bg-gradient-card">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-2xl font-bold text-gradient">{stats.totalDays}</div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">累计天数</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-accent-600 flex items-center justify-center gap-1">
              <Flame size={18} className="text-orange-500" /> {stats.streak}
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">连续天数</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary-600 flex items-center justify-center gap-1">
              <Clock size={16} /> {totalMinutes}
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">累计分钟</div>
          </div>
        </div>

        {/* 今日双圈提示 */}
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-600 dark:text-gray-300">
          <span className="flex items-center gap-1.5">
            <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${stats.todayNewDone > 0 ? 'border-primary-500 bg-primary-100 dark:bg-primary-900/40' : 'border-gray-300 dark:border-slate-600'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${stats.todayNewDone > 0 ? 'bg-primary-500' : ''}`} />
            </span>
            新学 {stats.todayNewDone > 0 ? '✓' : ''}
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${stats.todayReviewDone > 0 ? 'border-accent-500 bg-accent-100 dark:bg-accent-900/40' : 'border-gray-300 dark:border-slate-600'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${stats.todayReviewDone > 0 ? 'bg-accent-500' : ''}`} />
            </span>
            复习 {stats.todayReviewDone > 0 ? '✓' : ''}
          </span>
        </div>
      </div>

      {/* 月历 */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => changeMonth(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700" aria-label="上个月">
            <ChevronLeft size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
          <span className="font-semibold dark:text-gray-100">
            {viewYear} 年 {viewMonth} 月
          </span>
          <button onClick={() => changeMonth(1)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700" aria-label="下个月">
            <ChevronRight size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEK_DAYS.map((d) => (
            <div key={d} className="text-center text-[10px] text-gray-400 dark:text-gray-500">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={`e${i}`} />
            const date = new Date(viewYear, viewMonth - 1, day)
            const key = dateKeyOf(date.getTime())
            const entry = monthCheckIns.get(key)
            const isToday = key === dateKeyOf(Date.now())
            const newDone = entry?.newDone ?? 0
            const reviewDone = entry?.reviewDone ?? 0
            return (
              <div
                key={key}
                className={`flex flex-col items-center py-1.5 rounded-lg ${isToday ? 'bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-300 dark:ring-primary-700' : ''}`}
              >
                <span className="text-[11px] text-gray-600 dark:text-gray-300">{day}</span>
                {/* 双圈：内=新学 外=复习 */}
                <div className="mt-0.5 relative w-4 h-4">
                  <div
                    className={`absolute inset-0 rounded-full border-2 ${
                      reviewDone > 0 ? 'border-accent-500' : 'border-gray-200 dark:border-slate-700'
                    }`}
                  />
                  <div
                    className={`absolute inset-[3px] rounded-full ${
                      newDone > 0 ? 'bg-primary-500' : 'bg-gray-200 dark:bg-slate-700'
                    }`}
                  />
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-gray-400 dark:text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-primary-500" /> 新学完成
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full border-2 border-accent-500" /> 复习完成
          </span>
        </div>
      </div>

      {/* 勋章墙 */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={18} className="text-warn-600 dark:text-warn-400" />
          <h3 className="font-semibold dark:text-gray-100">我的勋章</h3>
          <span className="text-xs text-gray-400">
            {getUnlocked().length} / {ACHIEVEMENTS.length}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {ACHIEVEMENTS.map((a) => (
            <AchievementCard key={a.id} id={a.id} />
          ))}
        </div>
      </div>

      <button onClick={() => navigate('/study')} className="btn-primary w-full">
        去学习打卡
      </button>
    </div>
  )
}
