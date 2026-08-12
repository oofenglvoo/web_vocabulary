import { ACHIEVEMENTS, getUnlocked } from '../utils/achievements'

/** 单个勋章卡片：未解锁显示锁定遮罩 */
export function AchievementCard({ id }: { id: string }) {
  const a = ACHIEVEMENTS.find((x) => x.id === id)
  if (!a) return null
  const unlocked = getUnlocked().includes(id)
  return (
    <div
      className={`relative flex flex-col items-center justify-center p-3 rounded-xl text-center transition-all ${
        unlocked
          ? 'bg-white/80 dark:bg-slate-700/40 border border-primary-200/60 dark:border-primary-800/40'
          : 'bg-white/40 dark:bg-slate-700/20 opacity-60 grayscale'
      }`}
    >
      <div className="text-3xl mb-1">{a.icon}</div>
      <div className="text-xs font-medium dark:text-gray-200">{a.title}</div>
      <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{a.desc}</div>
      {!unlocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/60 dark:bg-slate-800/60 rounded-xl text-gray-400 dark:text-gray-500 text-[10px]">
          🔒 未解锁
        </div>
      )}
    </div>
  )
}
