import { useState } from 'react'
import { Settings2 } from 'lucide-react'
import { getStudyPrefs, setStudyType, StudyType, STUDY_TYPE_LABEL } from '../utils/studyPrefs'

interface StudyTypeSettingsProps {
  /** 题型变化时的回调（父级用于重置会话状态，如 done/index） */
  onChange?: () => void
}

/** 学习页头部的题型设置入口：新学/复习分别配置题型 */
export function StudyTypeSettings({ onChange }: StudyTypeSettingsProps) {
  const [open, setOpen] = useState(false)
  const [prefs, setPrefs] = useState(() => getStudyPrefs())

  const change = (target: 'newType' | 'reviewType', type: StudyType) => {
    setStudyType(target, type)
    setPrefs(getStudyPrefs())
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg dark:text-gray-100">题型设置</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 text-sm">
                关闭
              </button>
            </div>

            {(['newType', 'reviewType'] as const).map((target) => (
              <div key={target} className="mb-4">
                <div className="text-sm font-medium mb-2 dark:text-gray-300">
                  {target === 'newType' ? '新学题型' : '复习题型'}
                </div>
                <div className="flex gap-2">
                  {(['recall', 'choice', 'quick'] as StudyType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => change(target, t)}
                      className={`flex-1 py-2 rounded-xl text-sm transition-all ${
                        prefs[target] === t
                          ? 'bg-gradient-primary text-white shadow-glow'
                          : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {STUDY_TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <p className="text-xs text-gray-500 dark:text-gray-400">
              回忆式=翻卡自评(认识/模糊/忘记) · 选择题=看词选义 · 快速自测=逐条翻卡后批量提交
            </p>
          </div>
        </div>
      )}
    </>
  )
}
