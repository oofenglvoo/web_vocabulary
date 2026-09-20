import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Save, Plus, X, BookMarked, RotateCw } from 'lucide-react'
import { useLang } from '../context/Language'
import { addWord, useCategories } from '../hooks/useWords'
import { addJapaneseWord } from '../hooks/useJapaneseWords'
import { useToast } from '../components/Toast'
import { BackButton } from '../components/BackButton'
import { DictionaryPanel } from '../components/DictionaryPanel'
import { emptyDictionaryResult, lookupDictionary, type DictionaryResult } from '../utils/dictionary'
import { Definition, JapaneseDefinition } from '../types/word'

const POS_OPTIONS = ['', 'n.', 'v.', 'vt.', 'vi.', 'adj.', 'adv.', 'prep.', 'conj.', 'pron.', 'interj.', 'art.', 'det.', 'num.', '名', '动', '形', '副']

export function AddWord() {
  const lang = useLang()
  return lang === 'ja' ? <AddJapaneseWord /> : <AddEnglishWord />
}

function AddEnglishWord() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()
  const categories = useCategories()
  const presetCategory = searchParams.get('category') ?? '默认'
  const [form, setForm] = useState({
    word: '',
    phonetic: '',
    example: '',
    exampleTranslation: '',
    category: presetCategory,
    difficulty: 1,
    notes: '',
  })
  const [definitions, setDefinitions] = useState<Definition[]>([
    { pos: '', def: '', trans: '' },
  ])
  const [error, setError] = useState('')
  const [dict, setDict] = useState<DictionaryResult | null>(null)
  const [dictLoading, setDictLoading] = useState(false)
  const [dictError, setDictError] = useState('')

  const lookupOnline = async () => {
    const word = form.word.trim()
    if (!word) {
      setDictError('请先输入单词')
      return
    }
    setDictLoading(true)
    setDictError('')
    setDict(null)
    try {
      setDict(await lookupDictionary(word))
    } catch {
      setDictError('未找到该词的词典释义，请检查拼写或网络后重试')
    } finally {
      setDictLoading(false)
    }
  }

  const fillFromDictionary = {
    onFillPhonetic: (phonetic: string) => setForm((f) => ({ ...f, phonetic })),
    onFillSense: (sense: { pos: string; trans: string }) => {
      setDefinitions((prev) => {
        const index = prev.findIndex((item) => !item.def.trim() && !item.trans.trim())
        if (index === -1) return [...prev, { pos: sense.pos, def: '', trans: sense.trans }]
        const next = [...prev]
        next[index] = { ...next[index], pos: sense.pos || next[index].pos, trans: sense.trans }
        return next
      })
    },
    onFillExample: (example: { en: string; zh: string }) =>
      setForm((f) => ({ ...f, example: example.en, exampleTranslation: example.zh })),
  }

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
        exampleTranslation: form.exampleTranslation.trim(),
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
        srsStage: 0,
        stageProgress: 0,
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
          <div className="flex gap-2">
            <input
              value={form.word}
              onChange={(e) => setForm({ ...form, word: e.target.value })}
              className="input-field flex-1 min-w-0"
              placeholder="输入单词（英/日）"
            />
            <button
              type="button"
              onClick={() => void lookupOnline()}
              disabled={dictLoading || !form.word.trim()}
              className="btn-secondary px-3 py-2 text-sm gap-1.5 shrink-0 disabled:opacity-50"
            >
              {dictLoading ? <RotateCw size={15} className="animate-spin" /> : <BookMarked size={15} />}
              查词典
            </button>
          </div>
        </div>

        {(dictLoading || dictError || dict) && (
          <DictionaryPanel
            result={dict ?? emptyDictionaryResult(form.word.trim())}
            loading={dictLoading}
            error={dictError}
            title="在线词典"
            fill={fillFromDictionary}
          />
        )}

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
                    placeholder="释义（英/日）"
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
          <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">例句翻译</label>
          <input
            value={form.exampleTranslation}
            onChange={(e) => setForm({ ...form, exampleTranslation: e.target.value })}
            className="input-field"
            placeholder="例句中文翻译（可选）"
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

/** 日语添加表单：表记+假名必填，含音调/多释义/例句三件套 */
function AddJapaneseWord() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [form, setForm] = useState({
    word: '',
    reading: '',
    accent: '',
    partOfSpeech: '',
    example: '',
    exampleReading: '',
    exampleTranslation: '',
    category: '日语',
    difficulty: 1,
    notes: '',
  })
  const [definitions, setDefinitions] = useState<JapaneseDefinition[]>([
    { pos: '', meaning: '', translation: '' },
  ])
  const [error, setError] = useState('')

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const addDefinition = () => {
    setDefinitions([...definitions, { pos: '', meaning: '', translation: '' }])
  }

  const removeDefinition = (index: number) => {
    if (definitions.length <= 1) return
    setDefinitions(definitions.filter((_, i) => i !== index))
  }

  const updateDefinition = (index: number, field: keyof JapaneseDefinition, value: string) => {
    const next = [...definitions]
    next[index] = { ...next[index], [field]: value }
    setDefinitions(next)
  }

  const handleSubmit = async () => {
    if (!form.word.trim()) {
      setError('表记不能为空')
      return
    }
    if (!form.reading.trim()) {
      setError('假名读音不能为空')
      return
    }
    const validDefs = definitions.filter((d) => d.meaning.trim() || d.translation.trim())
    if (validDefs.length === 0) {
      setError('至少需要一个释义')
      return
    }

    try {
      await addJapaneseWord({
        word: form.word.trim(),
        reading: form.reading.trim(),
        accent: form.accent.trim(),
        partOfSpeech: form.partOfSpeech.trim(),
        definitions: validDefs.map((d) => ({
          pos: d.pos.trim(),
          meaning: d.meaning.trim(),
          translation: d.translation.trim(),
        })),
        example: form.example.trim(),
        exampleReading: form.exampleReading.trim(),
        exampleTranslation: form.exampleTranslation.trim(),
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
        srsStage: 0,
        stageProgress: 0,
        isLearned: 0,
        isFavorite: 0,
      })
      toast('success', '日语词已保存')
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
        <h1 className="page-title-accent">添加日语词</h1>
        <button onClick={handleSubmit} className="btn-primary flex items-center gap-1">
          <Save size={18} /> 保存
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-xl mb-4 text-sm">{error}</div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">表记 *</label>
            <input
              value={form.word}
              onChange={(e) => set('word', e.target.value)}
              className="input-field"
              placeholder="如：食べる"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">假名读音 *</label>
            <input
              value={form.reading}
              onChange={(e) => set('reading', e.target.value)}
              className="input-field"
              placeholder="如：たべる"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">词性</label>
            <input
              value={form.partOfSpeech}
              onChange={(e) => set('partOfSpeech', e.target.value)}
              className="input-field"
              placeholder="如：他动一"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">音调</label>
            <input
              value={form.accent}
              onChange={(e) => set('accent', e.target.value)}
              className="input-field"
              placeholder="如：⓪ / ① / ⓪①"
            />
          </div>
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
                <input
                  value={d.pos}
                  onChange={(e) => updateDefinition(i, 'pos', e.target.value)}
                  className="input-field text-sm"
                  placeholder="词性（可留空，默认用上方词性）"
                />
                <input
                  value={d.meaning}
                  onChange={(e) => updateDefinition(i, 'meaning', e.target.value)}
                  className="input-field text-sm"
                  placeholder="日文释义"
                />
                <input
                  value={d.translation}
                  onChange={(e) => updateDefinition(i, 'translation', e.target.value)}
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
            onChange={(e) => set('example', e.target.value)}
            className="input-field min-h-[60px]"
            placeholder="输入日语例句"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">例句读音</label>
            <input
              value={form.exampleReading}
              onChange={(e) => set('exampleReading', e.target.value)}
              className="input-field"
              placeholder="假名"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">例句翻译</label>
            <input
              value={form.exampleTranslation}
              onChange={(e) => set('exampleTranslation', e.target.value)}
              className="input-field"
              placeholder="中文"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">分类</label>
          <select
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
            className="input-field"
          >
            {['日语', '默认', 'N5', 'N4', 'N3', '标准日本语'].map((c) => (
              <option key={c} value={c}>{c}</option>
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
            onChange={(e) => set('difficulty', Number(e.target.value))}
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
            onChange={(e) => set('notes', e.target.value)}
            className="input-field min-h-[60px]"
            placeholder="个人笔记..."
          />
        </div>

        <button onClick={handleSubmit} className="btn-primary w-full flex items-center justify-center gap-2">
          <Save size={18} /> 保存日语词
        </button>
      </div>
    </div>
  )
}
