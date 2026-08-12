import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Save, Plus, X } from 'lucide-react'
import { addWord, useCategories } from '../hooks/useWords'
import { useToast } from '../components/Toast'
import { BackButton } from '../components/BackButton'
import { Definition } from '../types/word'

const POS_OPTIONS = ['', 'n.', 'v.', 'adj.', 'adv.', 'prep.', 'conj.', 'pron.', 'interj.', 'art.']

export function AddWord() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()
  const categories = useCategories()
  const presetCategory = searchParams.get('category') ?? '默认'
  const [form, setForm] = useState({
    word: '',
    phonetic: '',
    example: '',
    category: presetCategory,
    difficulty: 1,
    notes: '',
  })
  const [definitions, setDefinitions] = useState<Definition[]>([
    { pos: '', def: '', trans: '' },
  ])
  const [error, setError] = useState('')

  const addDefinition = () => {
    setDefinitions([...definitions, { pos: '', def: '', trans: '' }])
  }

  const removeDefinition = (index: number) => {
    if (definitions.length <= 1) return
    setDefinitions(definitions.filter((_, i) => i !== index))
  }

  const updateDefinition = (index: number, field: keyof Definition, value: string) => {
    const next = [...definitions]
    next[index] = { ...next[index], [field]: value }
    setDefinitions(next)
  }

  const handleSubmit = async () => {
    if (!form.word.trim()) {
      setError('单词不能为空')
      return
    }
    const validDefs = definitions.filter((d) => d.def.trim() || d.trans.trim())
    if (validDefs.length === 0) {
      setError('至少需要一个释义')
      return
    }

    // 向前兼容：将第一个释义写入旧字段
    const primary = validDefs[0]

    try {
      await addWord({
        word: form.word.trim(),
        phonetic: form.phonetic.trim(),
        definition: primary.def.trim(),
        translation: primary.trans.trim(),
        definitions: validDefs.map((d) => ({
          pos: d.pos.trim(),
          def: d.def.trim(),
          trans: d.trans.trim(),
        })),
        example: form.example.trim(),
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
      toast('success', '单词已保存')
      navigate('/words')
    } catch (e) {
      setError((e as Error).message || '保存失败，请重试')
    }
  }

  const difficultyLabels = ['简单', '较易', '中等', '较难', '困难']

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <BackButton />
        <h1 className="page-title-accent">添加单词</h1>
        <button onClick={handleSubmit} className="btn-primary flex items-center gap-1">
          <Save size={18} /> 保存
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-xl mb-4 text-sm">{error}</div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">单词 *</label>
          <input
            value={form.word}
            onChange={(e) => setForm({ ...form, word: e.target.value })}
            className="input-field"
            placeholder="输入英文单词"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">音标</label>
          <input
            value={form.phonetic}
            onChange={(e) => setForm({ ...form, phonetic: e.target.value })}
            className="input-field"
            placeholder="/həˈloʊ/"
          />
        </div>

        {/* 多释义区域 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium dark:text-gray-300">释义 *</label>
            <button
              type="button"
              onClick={addDefinition}
              className="text-sm text-primary-600 dark:text-primary-400 flex items-center gap-1 hover:underline"
            >
              <Plus size={14} /> 添加释义
            </button>
          </div>
          <div className="space-y-3">
            {definitions.map((d, i) => (
              <div
                key={i}
                className="bg-gray-50 dark:bg-slate-700/60 rounded-xl p-3 space-y-2 relative"
              >
                {definitions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeDefinition(i)}
                    className="absolute top-2 right-2 p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                    aria-label="删除此释义"
                  >
                    <X size={14} className="text-gray-400" />
                  </button>
                )}
                <div className="flex gap-2">
                  <select
                    value={d.pos}
                    onChange={(e) => updateDefinition(i, 'pos', e.target.value)}
                    className="input-field w-24 shrink-0 text-sm"
                  >
                    {POS_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p || '词性'}</option>
                    ))}
                  </select>
                  <input
                    value={d.def}
                    onChange={(e) => updateDefinition(i, 'def', e.target.value)}
                    className="input-field flex-1 text-sm"
                    placeholder="英文释义"
                  />
                </div>
                <input
                  value={d.trans}
                  onChange={(e) => updateDefinition(i, 'trans', e.target.value)}
                  className="input-field text-sm"
                  placeholder="中文翻译"
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">例句</label>
          <textarea
            value={form.example}
            onChange={(e) => setForm({ ...form, example: e.target.value })}
            className="input-field min-h-[60px]"
            placeholder="输入例句"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">分类</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="input-field"
          >
            {categories.map((cat) => (
              <option key={cat.name} value={cat.name}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">难度: {difficultyLabels[form.difficulty - 1]}</label>
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
          <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">笔记</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="input-field min-h-[60px]"
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
