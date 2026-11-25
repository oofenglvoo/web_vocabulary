import { StudyType, STUDY_TYPE_LABEL } from '../utils/studyPrefs'

interface StudyTypePickerProps {
  /** 分组标题，如「新学题型」 */
  label: string
  /** 当前选中值；undefined 表示跟随全局 */
  value?: StudyType
  /** 全局当前题型，用于「跟随全局」按钮上的说明 */
  globalType: StudyType
  /** 是否提供「跟随全局」选项（计划级配置才有） */
  allowFollowGlobal?: boolean
  /** 选择变化；type 为 undefined 表示改回跟随全局 */
  onChange: (type?: StudyType) => void
  disabled?: boolean
}

const TYPES: StudyType[] = ['recall', 'choice', 'quick']

/** 题型选择器：回忆式 / 选择题 / 快速自测（可选「跟随全局」） */
export function StudyTypePicker({
  label,
  value,
  globalType,
  allowFollowGlobal = false,
  onChange,
  disabled = false,
}: StudyTypePickerProps) {
  const shownValue = allowFollowGlobal ? value : (value ?? globalType)
  return (
    <div>
      <div className="text-sm font-medium mb-2 dark:text-gray-300">{label}</div>
      <div className={`grid gap-2 ${allowFollowGlobal ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {allowFollowGlobal && (
          <button
            type="button"
            disabled={disabled}
            aria-pressed={value === undefined}
            onClick={() => onChange(undefined)}
            className={`px-2 py-2 rounded-xl text-xs leading-tight transition-all ${
              value === undefined
                ? 'bg-gradient-primary text-white shadow-glow'
                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
            }`}
          >
            跟随全局（当前：{STUDY_TYPE_LABEL[globalType]}）
          </button>
        )}
        {TYPES.map((t) => (
          <button
            key={t}
            type="button"
            disabled={disabled}
            aria-pressed={shownValue === t}
            onClick={() => onChange(t)}
            className={`px-2 py-2 rounded-xl text-sm transition-all ${
              shownValue === t
                ? 'bg-gradient-primary text-white shadow-glow'
                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
            }`}
          >
            {STUDY_TYPE_LABEL[t]}
          </button>
        ))}
      </div>
    </div>
  )
}
