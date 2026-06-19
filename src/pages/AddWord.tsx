import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { addWord, useCategories } from '../hooks/useWords'

export function AddWord() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const categories = useCategories()
  const presetCategory = searchParams.get('category') ?? '默认'
  const [form, setForm] = useState({
    word: '',
    phonetic: '',
    definition: '',
    example: '',
    translation: '',
    category: presetCategory,
    difficulty: 1,
    notes: '',
  })
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!form.word.trim() || !form.definition.trim()) {
      setError('单词和释义不能为空')
      return
    }
    await addWord({
      word: form.word.trim(),
      phonetic: form.phonetic.trim(),
      definition: form.definition.trim(),
      example: form.example.trim(),
      translation: form.translation.trim(),
      category: form.category,
      difficulty: form.difficulty,
      notes: form.notes.trim(),
      lastReviewedAt: 0,
      reviewCount: 0,
      correctCount: 0,
      streak: 0,
      easeFactor: 2.5,
      interval: 0,
      nextReviewAt: Date.now(),
      isLearned: 0,
      isFavorite: 0,
    })
    navigate('/words')
  }

  const difficultyLabels = ['简单', '较易', '中等', '较难', '困难']

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">添加单词</h1>
        <button onClick={handleSubmit} className="btn-primary flex items-center gap-1">
          <Save size={18} /> 保存
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">单词 *</label>
          <input
            value={form.word}
            onChange={(e) => setForm({ ...form, word: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 focus:border-primary-600 focus:outline-none"
            placeholder="输入英文单词"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">音标</label>
          <input
            value={form.phonetic}
            onChange={(e) => setForm({ ...form, phonetic: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 focus:border-primary-600 focus:outline-none"
            placeholder="/həˈloʊ/"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">英文释义 *</label>
          <textarea
            value={form.definition}
            onChange={(e) => setForm({ ...form, definition: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 focus:border-primary-600 focus:outline-none min-h-[80px]"
            placeholder="输入英文释义"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">中文翻译</label>
          <input
            value={form.translation}
            onChange={(e) => setForm({ ...form, translation: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 focus:border-primary-600 focus:outline-none"
            placeholder="输入中文翻译"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">例句</label>
          <textarea
            value={form.example}
            onChange={(e) => setForm({ ...form, example: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 focus:border-primary-600 focus:outline-none min-h-[60px]"
            placeholder="输入例句"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">分类</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 focus:border-primary-600 focus:outline-none"
          >
            {categories.map((cat) => (
              <option key={cat.name} value={cat.name}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">难度: {difficultyLabels[form.difficulty - 1]}</label>
          <input
            type="range"
            min={1}
            max={5}
            value={form.difficulty}
            onChange={(e) => setForm({ ...form, difficulty: Number(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            {difficultyLabels.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">笔记</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 focus:border-primary-600 focus:outline-none min-h-[60px]"
            placeholder="个人笔记..."
          />
        </div>

        <button onClick={handleSubmit} className="btn-primary w-full flex items-center justify-center gap-2">
          <Save size={18} /> 保存单词
        </button>
      </div>
    </div>
  )
}
