import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Upload, FileUp, Volume2 } from 'lucide-react'
import { useStats, useAllWords, useCategories, addCategory } from '../hooks/useWords'
import { StatCard } from '../components/StatCard'
import { exportWordsToJson, exportWordsToCsv, downloadFile } from '../utils/export'
import {
  getAccent,
  setAccent,
  getProvider,
  setProvider,
  speakWord,
  Accent,
  TtsProvider,
} from '../utils/tts'
import { useState } from 'react'

export function Stats() {
  const navigate = useNavigate()
  const stats = useStats()
  const words = useAllWords()
  const categories = useCategories()
  const [showAddCat, setShowAddCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [accent, setAccentState] = useState<Accent>(getAccent())
  const [provider, setProviderState] = useState<TtsProvider>(getProvider())

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

  const handleExportJson = () => {
    const json = exportWordsToJson(words)
    downloadFile(json, 'vocabulary.json', 'application/json')
  }

  const handleExportCsv = () => {
    const csv = exportWordsToCsv(words)
    downloadFile(csv, 'vocabulary.csv', 'text/csv')
  }

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return
    await addCategory(newCatName.trim())
    setNewCatName('')
    setShowAddCat(false)
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">统计与设置</h1>
        <div className="w-10" />
      </div>

      <div>
        <h2 className="font-semibold text-lg mb-3">学习统计</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard title="总单词" value={stats.total} />
          <StatCard title="已掌握" value={stats.learned} color="text-success-600" />
          <StatCard title="待复习" value={stats.due} color="text-warn-600" />
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-medium mb-3">今日学习</h3>
        <div className="space-y-2 text-sm">
          <Row label="答题数" value={stats.todayTotal} />
          <Row label="正确数" value={stats.todayCorrect} />
          <Row label="正确率" value={`${todayAccuracy}%`} />
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-medium mb-3">本周学习</h3>
        <div className="space-y-2 text-sm">
          <Row label="答题数" value={stats.weekTotal} />
          <Row label="正确数" value={stats.weekCorrect} />
          <Row label="正确率" value={`${weekAccuracy}%`} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg">分类管理</h2>
          <button onClick={() => setShowAddCat(true)} className="text-sm text-primary-600 hover:underline">
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
                <span>{cat.name}</span>
              </div>
              <span className="text-sm text-gray-400">{cat.wordCount} 词</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-lg mb-3">发音设置</h2>
        <div className="card p-4 space-y-4">
          <div>
            <div className="text-sm font-medium mb-2">口音</div>
            <div className="flex gap-2">
              {(['us', 'uk'] as Accent[]).map((a) => (
                <button
                  key={a}
                  onClick={() => handleAccentChange(a)}
                  className={`flex-1 py-2 rounded-lg text-sm ${
                    accent === a
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {a === 'us' ? '美音' : '英音'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">发音源</div>
            <div className="flex gap-2">
              {([
                ['auto', '自动'],
                ['youdao', '有道真人'],
                ['native', '浏览器合成'],
              ] as [TtsProvider, string][]).map(([p, label]) => (
                <button
                  key={p}
                  onClick={() => handleProviderChange(p)}
                  className={`flex-1 py-2 rounded-lg text-xs ${
                    provider === p
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
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

      <div>
        <h2 className="font-semibold text-lg mb-3">数据导入/导出</h2>
        <Link
          to="/import"
          className="btn-primary w-full flex items-center justify-center gap-2 mb-3"
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

      {showAddCat && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-lg mb-4">添加分类</h3>
            <input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="分类名称"
              className="w-full border rounded-lg px-3 py-2 mb-4 focus:border-primary-600 focus:outline-none"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setShowAddCat(false)} className="btn-secondary flex-1">取消</button>
              <button onClick={handleAddCategory} className="btn-primary flex-1">添加</button>
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
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
