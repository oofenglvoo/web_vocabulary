import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Upload, FileUp, Volume2, BarChart3, Moon, Sun, DatabaseBackup, FileJson } from 'lucide-react'
import { useLang } from '../context/Language'
import { useLangStats, useLangCategories, useLangCategoryStats, addLangCategory, useLangSessionTypes } from '../hooks/languageAware'
import { useAllWords } from '../hooks/useWords'
import { useAllSentences, useSentenceStats } from '../hooks/useSentences'
import { StatCard } from '../components/StatCard'
import { exportWordsToJson, exportWordsToCsv, exportSentencesToJson, exportSentencesToCsv, downloadFile } from '../utils/export'
import {
  getAccent,
  setAccent,
  getProvider,
  setProvider,
  speakWord,
  Accent,
  TtsProvider,
} from '../utils/tts'
import { db } from '../db/database'
import { useLiveQuery } from 'dexie-react-hooks'
import { isDarkMode, toggleDarkMode } from '../utils/theme'
import { BackButton } from '../components/BackButton'
import { useToast } from '../components/Toast'
import { BackupPreview, downloadBackup, parseBackup, restoreBackup } from '../utils/backup'

export function Stats() {
  const { toast } = useToast()
  const lang = useLang()
  const isJa = lang === 'ja'
  const stats = useLangStats()
  const words = useAllWords()
  const categories = useLangCategories()
  const categoryStats = useLangCategoryStats()
  const sentences = useAllSentences()
  const sentenceStats = useSentenceStats()
  const [showAddCat, setShowAddCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [accent, setAccentState] = useState<Accent>(getAccent())
  const [provider, setProviderState] = useState<TtsProvider>(getProvider())
  const [dark, setDarkState] = useState(isDarkMode())
  const [tab, setTab] = useState<'stats' | 'settings' | 'data'>('stats')
  const [backupPreview, setBackupPreview] = useState<BackupPreview | null>(null)
  const [backupPayload, setBackupPayload] = useState<Parameters<typeof restoreBackup>[0] | null>(null)
  const [restoring, setRestoring] = useState(false)

  const handleAccentChange = (value: Accent) => {
    setAccent(value)
    setAccentState(value)
  }
  const handleProviderChange = (value: TtsProvider) => {
    setProvider(value)
    setProviderState(value)
  }

  const todayAccuracy = stats.todayTotal > 0 ? Math.round((stats.todayCorrect / stats.todayTotal) * 100) : 0
  const weekAccuracy = stats.weekTotal > 0 ? Math.round((stats.weekCorrect / stats.weekTotal) * 100) : 0

  const handleExportJson = async () => {
    const json = exportWordsToJson(words)
    try {
      await downloadFile(json, 'vocabulary.json', 'application/json')
      toast('success', 'JSON 导出成功')
    } catch (e) {
      toast('error', '导出失败: ' + (e as Error).message)
    }
  }

  const handleExportCsv = async () => {
    const csv = exportWordsToCsv(words)
    try {
      await downloadFile(csv, 'vocabulary.csv', 'text/csv')
      toast('success', 'CSV 导出成功')
    } catch (e) {
      toast('error', '导出失败: ' + (e as Error).message)
    }
  }

  const handleExportSentencesJson = async () => {
    const json = exportSentencesToJson(sentences)
    try {
      await downloadFile(json, 'sentences.json', 'application/json')
      toast('success', '短句 JSON 导出成功')
    } catch (e) {
      toast('error', '导出失败: ' + (e as Error).message)
    }
  }

  const handleExportSentencesCsv = async () => {
    const csv = exportSentencesToCsv(sentences)
    try {
      await downloadFile(csv, 'sentences.csv', 'text/csv')
      toast('success', '短句 CSV 导出成功')
    } catch (e) {
      toast('error', '导出失败: ' + (e as Error).message)
    }
  }

  const handleAddCategory = async () => {
    const name = newCatName.trim()
    if (!name) return
    try {
      await addLangCategory(name)
      toast('success', `分类「${name}」已创建`)
      setNewCatName('')
      setShowAddCat(false)
    } catch (e) {
      toast('error', (e as Error).message || '创建失败')
    }
  }

  const handleBackupFile = async (file: File) => {
    try {
      const parsed = parseBackup(await file.text())
      setBackupPayload(parsed.payload)
      setBackupPreview(parsed.preview)
    } catch (e) {
      toast('error', (e as Error).message)
    }
  }

  const handleRestore = async () => {
    if (!backupPayload) return
    setRestoring(true)
    try {
      await restoreBackup(backupPayload)
      toast('success', '数据已恢复，页面将刷新')
      window.setTimeout(() => window.location.reload(), 300)
    } catch (e) {
      toast('error', '恢复失败: ' + (e as Error).message)
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <BackButton />
        <h1 className="page-title-accent">统计与设置</h1>
        <div className="w-10" />
      </div>

      <div
        className="grid grid-cols-3 gap-2 rounded-xl bg-gray-100/80 dark:bg-slate-800 p-1"
        role="tablist"
        aria-label="统计与设置分区"
      >
        {([
          ['stats', '学习统计'],
          ['settings', '设置'],
          ['data', '数据管理'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`py-2 rounded-lg text-xs font-medium transition-all ${
              tab === value
                ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-soft'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <section hidden={tab !== 'stats'} aria-label="学习统计" className="space-y-6">
      <div>
        <h2 className="font-semibold text-lg mb-3 dark:text-gray-200">学习统计</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard title={isJa ? '总日语词' : '总单词'} value={stats.total} />
          <StatCard title="已掌握" value={stats.learned} color="text-success-600" />
          <StatCard title="待复习" value={stats.due} color="text-warn-600" />
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-medium mb-3 dark:text-gray-200">今日学习</h3>
        <div className="space-y-2 text-sm">
          <Row label="答题数" value={stats.todayTotal} />
          <Row label="正确数" value={stats.todayCorrect} />
          <Row label="正确率" value={`${todayAccuracy}%`} />
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-medium mb-3 dark:text-gray-200">本周学习</h3>
        <div className="space-y-2 text-sm">
          <Row label="答题数" value={stats.weekTotal} />
          <Row label="正确数" value={stats.weekCorrect} />
          <Row label="正确率" value={`${weekAccuracy}%`} />
        </div>
      </div>

      {/* 近7日学习趋势（按当前语言过滤） */}
      <WeeklyChart />

      {!isJa && (
        <div>
          <h2 className="font-semibold text-lg mb-3 dark:text-gray-200">短句统计</h2>
          <div className="grid grid-cols-3 gap-3">
            <StatCard title="总短句" value={sentenceStats.total} />
            <StatCard title="已掌握" value={sentenceStats.learned} color="text-success-600" />
          </div>
        </div>
      )}
      </section>

      <section hidden={tab !== 'data'} aria-label="分类管理">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg dark:text-gray-200">分类管理</h2>
          <button onClick={() => setShowAddCat(true)} className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
            添加分类
          </button>
        </div>
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.id} className="card p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="dark:text-gray-200">{cat.name}</span>
              </div>
              <span className="text-sm text-gray-400 dark:text-gray-500">
                {categoryStats.find((s) => s.name === cat.name)?.wordCount ?? 0} 词
              </span>
            </div>
          ))}
        </div>
      </div>
      </section>

      {/* 深色模式切换 */}
      <section hidden={tab !== 'settings'} aria-label="设置" className="space-y-6">
      <div>
        <h2 className="font-semibold text-lg mb-3 dark:text-gray-200">外观</h2>
        <div className="card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium dark:text-gray-200">深色模式</div>
            <button
              onClick={() => {
                toggleDarkMode()
                setDarkState(!dark)
              }}
              className={`p-2 rounded-xl transition-all ${
                dark
                  ? 'bg-slate-700 text-yellow-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-yellow-300'
              }`}
            >
              {dark ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
        </div>
      </div>
      </section>

      {/* 发音设置 */}
      <section hidden={tab !== 'settings'} aria-label="发音设置">
      <div>
        <h2 className="font-semibold text-lg mb-3 dark:text-gray-200">发音设置</h2>
        <div className="card p-4 space-y-4">
          <div>
            <div className="text-sm font-medium mb-2 dark:text-gray-200">口音</div>
            <div className="flex gap-2">
              {(['us', 'uk'] as Accent[]).map((a) => (
                <button
                  key={a}
                  onClick={() => handleAccentChange(a)}
                  className={`flex-1 py-2 rounded-xl text-sm transition-all ${
                    accent === a
                      ? 'bg-gradient-primary text-white shadow-glow'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {a === 'us' ? '美音' : '英音'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2 dark:text-gray-200">发音源</div>
            <div className="flex gap-2">
              {([
                ['auto', '自动'],
                ['youdao', '有道真人'],
                ['native', '浏览器合成'],
              ] as [TtsProvider, string][]).map(([p, label]) => (
                <button
                  key={p}
                  onClick={() => handleProviderChange(p)}
                  className={`flex-1 py-2 rounded-xl text-xs transition-all ${
                    provider === p
                      ? 'bg-gradient-primary text-white shadow-glow'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              自动: 优先有道真人发音,失败回退浏览器合成
            </p>
          </div>

          <button
            onClick={() => speakWord('hello world')}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            <Volume2 size={18} /> 测试发音
          </button>
        </div>
      </div>
      </section>

      <section hidden={tab !== 'data'} aria-label="数据导入导出">
      <div>
        <h2 className="font-semibold text-lg mb-3 dark:text-gray-200">数据导入/导出</h2>

        <div className="card p-4 mb-4 border-primary-100 dark:border-primary-900/40">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary text-white flex items-center justify-center shrink-0">
              <DatabaseBackup size={19} />
            </div>
            <div>
              <h3 className="font-medium dark:text-gray-200">完整数据备份</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">备份单词、短句、计划、学习记录和设置，数据只保存在你的设备中。</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => downloadBackup().then(() => toast('success', '完整备份已下载')).catch((e) => toast('error', '备份失败: ' + e.message))} className="btn-primary py-2.5 text-sm">
              <Download size={16} /> 导出完整备份
            </button>
            <label className="btn-secondary py-2.5 text-sm cursor-pointer">
              <FileJson size={16} /> 恢复备份
              <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && handleBackupFile(e.target.files[0])} />
            </label>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">恢复前会显示数据数量并要求确认，恢复会替换当前本地数据。</p>
        </div>

        {/* 单词/短句导入导出（日语模式下数据管理走完整备份，避免跨语言误导出） */}
        {!isJa && (
          <>
            <div className="mb-3">
              <h3 className="text-sm font-medium mb-2 dark:text-gray-300">单词</h3>
              <Link
                to="/import"
                className="btn-primary w-full flex items-center justify-center gap-2 mb-2"
              >
                <FileUp size={18} /> 批量导入单词
              </Link>
              <div className="flex gap-3">
                <button onClick={handleExportJson} className="btn-secondary flex-1 flex items-center justify-center gap-2">
                  <Download size={18} /> JSON
                </button>
                <button onClick={handleExportCsv} className="btn-secondary flex-1 flex items-center justify-center gap-2">
                  <Upload size={18} /> CSV
                </button>
              </div>
            </div>

            {/* 短句 */}
            <div>
              <h3 className="text-sm font-medium mb-2 dark:text-gray-300">短句</h3>
              <Link
                to="/sentences/import"
                className="btn-primary w-full flex items-center justify-center gap-2 mb-2"
              >
                <FileUp size={18} /> 批量导入短句
              </Link>
              <div className="flex gap-3">
                <button onClick={handleExportSentencesJson} className="btn-secondary flex-1 flex items-center justify-center gap-2">
                  <Download size={18} /> JSON
                </button>
                <button onClick={handleExportSentencesCsv} className="btn-secondary flex-1 flex items-center justify-center gap-2">
                  <Upload size={18} /> CSV
                </button>
              </div>
            </div>
          </>
        )}
        {isJa && (
          <div className="mb-3">
            <h3 className="text-sm font-medium mb-2 dark:text-gray-300">日语词</h3>
            <Link
              to="/import"
              className="btn-primary w-full flex items-center justify-center gap-2 mb-2"
            >
              <FileUp size={18} /> 批量导入日语词
            </Link>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              日语词导出请使用「导出完整备份」，其中包含日语词库与学习数据。
            </p>
          </div>
        )}
      </div>
      </section>

      {showAddCat && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="font-bold text-lg mb-4 dark:text-gray-100">添加分类</h3>
            <input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="分类名称"
              className="input-field mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setShowAddCat(false)} className="btn-secondary flex-1">取消</button>
              <button onClick={handleAddCategory} className="btn-primary flex-1">添加</button>
            </div>
          </div>
        </div>
      )}

      {backupPreview && backupPayload && (
        <div className="modal-overlay">
          <div className="modal-content max-w-sm">
            <h3 className="font-bold text-lg mb-2 dark:text-gray-100">确认恢复备份</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">备份时间：{new Date(backupPreview.exportedAt).toLocaleString()}</p>
            <div className="grid grid-cols-2 gap-2 text-sm mb-4">
              <Row label="单词" value={backupPreview.counts.words} />
              <Row label="短句" value={backupPreview.counts.sentences} />
              <Row label="学习记录" value={backupPreview.counts.studySessions} />
              <Row label="学习计划" value={backupPreview.counts.studyPlans} />
            </div>
            <p className="text-xs text-red-500 mb-4">恢复会替换当前所有本地数据，建议先导出当前备份。</p>
            <div className="flex gap-2">
              <button onClick={() => { setBackupPreview(null); setBackupPayload(null) }} className="btn-secondary flex-1">取消</button>
              <button onClick={handleRestore} disabled={restoring} className="btn-danger flex-1">{restoring ? '恢复中...' : '确认恢复'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-medium dark:text-gray-200">{value}</span>
    </div>
  )
}

// 近7日学习趋势图（按当前语言的会话过滤）
function WeeklyChart() {
  const [tooltip, setTooltip] = useState<{ index: number; data: { total: number; correct: number } } | null>(null)
  const sessionTypes = useLangSessionTypes()
  const dailyData = useLiveQuery(async () => {
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    const days: { date: string; label: string; total: number; correct: number }[] = []

    for (let i = 6; i >= 0; i--) {
      const dayStart = now - i * dayMs
      const start = new Date(dayStart)
      start.setHours(0, 0, 0, 0)
      const end = new Date(start.getTime() + dayMs)

      const sessions = await db.studySessions
        .where('timestamp')
        .between(start.getTime(), end.getTime())
        .toArray()
      const filtered = sessions.filter((s) => sessionTypes.includes(s.entityType))

      const d = new Date(start.getTime())
      const label = `${d.getMonth() + 1}/${d.getDate()}`
      const weekdays = ['日', '一', '二', '三', '四', '五', '六']
      const dayLabel = weekdays[d.getDay()]

      days.push({
        date: label,
        label: dayLabel,
        total: filtered.length,
        correct: filtered.filter((s) => s.result === 'correct' || s.result === 'mastered').length,
      })
    }
    return days
  }, [sessionTypes]) ?? []

  const maxTotal = Math.max(1, ...dailyData.map((d) => d.total))

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={18} className="text-primary-600 dark:text-primary-400" />
        <h3 className="font-medium dark:text-gray-200">近7日学习趋势</h3>
      </div>

      <div className="flex items-end gap-2 h-36 relative">
        {dailyData.map((d, i) => {
          const totalH = (d.total / maxTotal) * 100
          const correctH = d.total > 0 ? (d.correct / maxTotal) * 100 : 0
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-1 h-full"
              onMouseEnter={() => d.total > 0 && setTooltip({ index: i, data: { total: d.total, correct: d.correct } })}
              onMouseLeave={() => setTooltip(null)}
            >
              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium shrink-0">
                {d.total > 0 ? d.total : ''}
              </span>
              <div className="flex-1 w-full flex flex-col justify-end relative">
                {/* 正确部分 - 渐变填充 */}
                <div
                  className="w-full rounded-t-md transition-all duration-500 bg-gradient-to-t from-primary-600 to-primary-400 dark:from-primary-500 dark:to-primary-300"
                  style={{ height: `${correctH}%`, minHeight: d.correct > 0 ? '4px' : '0' }}
                />
                {/* 总量-正确部分 (错误) */}
                {d.total > d.correct && (
                  <div
                    className="w-full rounded-none transition-all duration-500 bg-gradient-to-t from-warn-500 to-warn-300 dark:from-warn-600 dark:to-warn-400"
                    style={{ height: `${totalH - correctH}%`, minHeight: '2px' }}
                  />
                )}

                {/* Tooltip */}
                {tooltip && tooltip.index === i && (
                  <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-gray-800 dark:bg-slate-600 text-white text-[10px] px-2 py-1.5 rounded-lg shadow-lg whitespace-nowrap z-10">
                    <div>正确: {d.correct}</div>
                    <div>出错: {d.total - d.correct}</div>
                    <div>总计: {d.total}</div>
                  </div>
                )}
              </div>
              <div className="text-center shrink-0">
                <div className="text-[10px] text-gray-400 dark:text-gray-500">{d.date}</div>
                <div className="text-[10px] text-gray-300 dark:text-gray-600">{d.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-primary-600 to-primary-400" />
          <span className="text-[10px] text-gray-500 dark:text-gray-400">正确</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-warn-500 to-warn-300" />
          <span className="text-[10px] text-gray-500 dark:text-gray-400">出错</span>
        </div>
      </div>
    </div>
  )
}
