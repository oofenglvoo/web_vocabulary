import { useState } from 'react'
import { Settings2 } from 'lucide-react'
import { getStudyPrefs, setStudyType, StudyType } from '../utils/studyPrefs'
import { StudyTypePicker } from './StudyTypePicker'

/** 计划级题型上下文：有计划=改当前计划，无计划=改全局默认 */
export interface PlanTypeContext {
  planName: string
  newType?: StudyType
  reviewType?: StudyType
  /** 写入计划题型；type 为 undefined 表示改回跟随全局 */
  onPersist: (patch: { newType?: StudyType; reviewType?: StudyType }) => Promise<void>
}

interface StudyTypeSettingsProps {
  /** 题型变化时的回调（父级用于重置会话状态，如 done/index） */
  onChange?: () => void
  /** 带计划的学习会话传入；不传则改全局默认题型 */
  plan?: PlanTypeContext
}

/** 学习页头部的题型设置入口：新学/复习分别配置题型（计划内改计划，自由学习改全局） */
export function StudyTypeSettings({ onChange, plan }: StudyTypeSettingsProps) {
  const [open, setOpen] = useState(false)
  // 全局模式下 localStorage 非响应式，改动后靠自增触发重渲染
  const [, setTick] = useState(0)
  const [saving, setSaving] = useState(false)

  const globalPrefs = getStudyPrefs()
  const current = plan
    ? { newType: plan.newType, reviewType: plan.reviewType }
    : globalPrefs

  const change = async (target: 'newType' | 'reviewType', type?: StudyType) => {
    if (plan) {
      if (saving) return
      setSaving(true)
      try {
        await plan.onPersist(target === 'newType' ? { newType: type } : { reviewType: type })
        onChange?.()
      } catch {
        // 错误提示由父级负责，这里保持原选中值
      } finally {
        setSaving(false)
      }
      return
    }
    // 全局模式没有「跟随全局」这一档
    if (!type) return
    setStudyType(target, type)
    setTick((t) => t + 1)
    onChange?.()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
        aria-label="题型设置"
      >
        <Settings2 size={18} className="text-gray-500 dark:text-gray-400" />
      </button>

      {open && (
        <div className="modal-overlay" style={{ alignItems: 'center' }}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-sm animate-scale-in">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-lg dark:text-gray-100">题型设置</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 text-sm">
                关闭
              </button>
            </div>
            {plan ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                当前计划：{plan.planName} · 改动仅对本计划生效
              </p>
            ) : (
              <div className="mb-4" />
            )}

            <div className="space-y-4">
              <StudyTypePicker
                label="新学题型"
                value={current.newType}
                globalType={globalPrefs.newType}
                allowFollowGlobal={!!plan}
                disabled={saving}
                onChange={(type) => change('newType', type)}
              />
              <StudyTypePicker
                label="复习题型"
                value={current.reviewType}
                globalType={globalPrefs.reviewType}
                allowFollowGlobal={!!plan}
                disabled={saving}
                onChange={(type) => change('reviewType', type)}
              />
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
              {plan
                ? '「跟随全局」会随学习页的全局题型设置变化。'
                : '回忆式=翻卡自评(认识/模糊/忘记) · 选择题=看词选义 · 快速自测=逐条翻卡后批量提交'}
            </p>
          </div>
        </div>
      )}
    </>
  )
}
