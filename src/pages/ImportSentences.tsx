import { useState, useRef, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Upload, FileText, Save, Heart } from 'lucide-react'
import { bulkAddSentences, BulkAddSentenceResult } from '../hooks/useSentences'
import { useCategories, addCategory } from '../hooks/useWords'
import {
  parseSentencesJson,
  parseSentencesCsv,
  parseSentencesText,
  ImportableSentence,
  SentenceParseResult,
} from '../utils/import'
import { BackButton } from '../components/BackButton'
import { useToast } from '../components/Toast'

type Format = 'json' | 'csv' | 'text'
// 分类选择特殊值
const KEEP_FILE_CATEGORY = '__keep__'
const NEW_CATEGORY = '__new__'

const SAMPLES: Record<Format, string> = {
  json: `[
  {
    "sentence": "How's it going?",
    "definitions": [
      { "pos": "", "def": "", "trans": "最近怎么样？" },
      { "pos": "", "def": "", "trans": "你好吗？" }
    ],
    "example": "Hey, how's it going?",
    "category": "日常用语",
    "difficulty": 2,
    "notes": "非正式问候"
  },
  {
    "sentence": "I'm looking forward to it.",
    "translation": "我很期待。",
    "example": "I'm looking forward to the weekend.",
    "category": "日常用语",
    "difficulty": 3
  }
]`,
  csv: `sentence,translation,example,category,difficulty,notes,definitions
"How's it going?","最近怎么样？","Hey, how's it going?",日常用语,2,非正式问候,"[{""pos"":"""",""def"":"""",""trans"":""最近怎么样？""},{""pos"":"""",""def"":"""",""trans"":""你好吗？""}]"
"I'm looking forward to it.","我很期待。","I'm looking forward to the weekend.",日常用语,3,,`,
  text: `How's it going?	最近怎么样？;你好吗？	日常用语	2
I'm looking forward to it.	我很期待。	日常用语	3`,
}

export function ImportSentences() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const categories = useCategories()
  const [format, setFormat] = useState<Format>('json')
  const [content, setContent] = useState('')
  const [parsed, setParsed] = useState<SentenceParseResult | null>(null)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<BulkAddSentenceResult | null>(null)

  const [categoryChoice, setCategoryChoice] = useState<string>(KEEP_FILE_CATEGORY)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [autoFavorite, setAutoFavorite] = useState(false)

  const presetCategory = searchParams.get('category')
  const presetFavorite = searchParams.get('favorite')

  useEffect(() => {
    if (presetCategory) {
      setCategoryChoice(presetCategory)
    }
    if (presetFavorite === '1' || presetFavorite === 'true') {
      setAutoFavorite(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFile = async (file: File) => {
    // 限制文件大小，避免大文件把页面卡死
    if (file.size > 10 * 1024 * 1024) {
      toast('error', '文件过大(>10MB)，请拆分后导入')
      return
    }
    try {
      const text = await file.text()
      setContent(text)
      setResult(null)
      const lower = file.name.toLowerCase()
      const fmt: Format = lower.endsWith('.json')
        ? 'json'
        : lower.endsWith('.csv')
        ? 'csv'
        : 'text'
      setFormat(fmt)
      parse(text, fmt)
    } catch (e) {
      toast('error', '读取文件失败: ' + (e as Error).message)
    }
  }

  const parse = (text: string, fmt: Format = format) => {
    if (!text.trim()) {
      setParsed(null)
      return
    }
    const r =
      fmt === 'json'
        ? parseSentencesJson(text)
        : fmt === 'csv'
        ? parseSentencesCsv(text)
        : parseSentencesText(text)
    setParsed(r)
  }

  const handleParse = () => {
    parse(content)
    setResult(null)
  }

  const previewCategory = useMemo(() => {
    if (categoryChoice === KEEP_FILE_CATEGORY) return null
    if (categoryChoice === NEW_CATEGORY) return newCategoryName.trim() || '(待填写)'
    return categoryChoice
  }, [categoryChoice, newCategoryName])

  const handleImport = async () => {
    if (!parsed || parsed.sentences.length === 0) return

    let targetCategory: string | undefined
    if (categoryChoice === NEW_CATEGORY) {
      const name = newCategoryName.trim()
      if (!name) {
        toast('warning', '请填写新分类名称')
        return
      }
      targetCategory = name
      // 如果新分类还不存在,先建一个；并发/竞态下若已存在则忽略
      const exists = categories.some((c) => c.name === name)
      if (!exists) {
        try {
          await addCategory(name)
        } catch (e) {
          toast('warning', '分类创建失败: ' + (e as Error).message)
        }
      }
    } else if (categoryChoice !== KEEP_FILE_CATEGORY) {
      targetCategory = categoryChoice
    }

    setImporting(true)
    try {
      const r = await bulkAddSentences(parsed.sentences as ImportableSentence[], {
        skipDuplicates,
        overrideCategory: targetCategory,
        forceFavorite: autoFavorite,
      })
      setResult(r)
      toast('success', `成功导入 ${r.added} 个短句`)
    } catch (e) {
      toast('error', '导入失败: ' + (e as Error).message)
      setResult(null)
    } finally {
      setImporting(false)
    }
  }

  const useSample = () => {
    setContent(SAMPLES[format])
    parse(SAMPLES[format])
    setResult(null)
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <BackButton />
        <h1 className="page-title-accent">批量导入短句</h1>
        <div className="w-10" />
      </div>

      {/* 格式切换 */}
      <div>
        <label className="block text-sm font-medium mb-2 dark:text-gray-300">数据格式</label>
        <div className="flex gap-2">
          {(['json', 'csv', 'text'] as Format[]).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFormat(f)
                if (content) parse(content, f)
              }}
              className={`px-4 py-2 rounded-xl text-sm transition-all ${
                format === f
                  ? 'bg-gradient-primary text-white shadow-glow'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {format === 'json' && '支持短句数组，每个对象可含 definitions 数组实现多翻译，也兼容旧格式 translation'}
          {format === 'csv' && '表头含 definitions 列时值为 JSON 数组；也可用旧列 translation'}
          {format === 'text' && '每行: sentence [Tab/逗号/|] 翻译。多翻译用分号分隔，如: 最近怎么样？;你好吗？'}
        </p>
      </div>

      {/* 文件上传 */}
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv,.txt"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn-secondary flex-1 flex items-center justify-center gap-2"
        >
          <Upload size={18} /> 选择文件
        </button>
        <button
          onClick={useSample}
          className="btn-secondary flex-1 flex items-center justify-center gap-2"
        >
          <FileText size={18} /> 使用示例
        </button>
      </div>

      {/* 文本输入 */}
      <div>
        <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">粘贴内容</label>
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            setResult(null)
          }}
          placeholder={SAMPLES[format]}
          className="input-field font-mono min-h-[200px]"
        />
        <button onClick={handleParse} className="btn-secondary mt-2 text-sm">
          解析预览
        </button>
      </div>

      {/* 导入选项 */}
      <div className="card p-4 space-y-3">
        <h3 className="font-medium dark:text-gray-200">导入选项</h3>

        <div>
          <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">目标分类</label>
          <select
            value={categoryChoice}
            onChange={(e) => setCategoryChoice(e.target.value)}
            className="input-field"
          >
            <option value={KEEP_FILE_CATEGORY}>保持文件中的分类</option>
            <option disabled>──────────</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
            <option value={NEW_CATEGORY}>+ 新建分类...</option>
          </select>
          {categoryChoice === NEW_CATEGORY && (
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="新分类名称"
              className="input-field mt-2"
            />
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {categoryChoice === KEEP_FILE_CATEGORY
              ? '使用文件中每条记录自带的分类(缺失则为空)'
              : `所有导入的短句都会归到「${previewCategory}」分类`}
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer dark:text-gray-300">
          <input
            type="checkbox"
            checked={autoFavorite}
            onChange={(e) => setAutoFavorite(e.target.checked)}
          />
          <Heart size={16} className={autoFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'} />
          <span>导入后自动加入收藏夹</span>
        </label>

        <label className="flex items-center gap-2 text-sm cursor-pointer dark:text-gray-300">
          <input
            type="checkbox"
            checked={skipDuplicates}
            onChange={(e) => setSkipDuplicates(e.target.checked)}
          />
          <span>跳过已存在的短句 (按 sentence 字段去重)</span>
        </label>
      </div>

      {/* 解析结果 */}
      {parsed && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium dark:text-gray-200">解析结果</h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              共 {parsed.sentences.length} 个有效短句
              {parsed.errors.length > 0 && `, ${parsed.errors.length} 条错误`}
            </span>
          </div>

          {parsed.errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl p-3 text-xs max-h-32 overflow-auto">
              {parsed.errors.slice(0, 20).map((err, i) => (
                <div key={i}>{err}</div>
              ))}
              {parsed.errors.length > 20 && (
                <div>... 还有 {parsed.errors.length - 20} 条</div>
              )}
            </div>
          )}

          {parsed.sentences.length > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 max-h-40 overflow-auto border rounded-xl dark:border-slate-700">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-700 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1">短句</th>
                    <th className="text-left px-2 py-1">翻译</th>
                    <th className="text-left px-2 py-1">分类</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.sentences.slice(0, 50).map((s, i) => (
                    <tr key={i} className="border-t dark:border-slate-700">
                      <td className="px-2 py-1 font-medium">{s.sentence}</td>
                      <td className="px-2 py-1 truncate max-w-[200px]">
                        {s.definitions && s.definitions.length > 0
                          ? s.definitions.map((d: any) => d.trans || d.def).filter(Boolean).join('; ')
                          : s.translation}
                      </td>
                      <td className="px-2 py-1">
                        {previewCategory ?? s.category}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.sentences.length > 50 && (
                <div className="text-center py-1 text-gray-400">
                  ... 仅展示前 50 条,共 {parsed.sentences.length} 条
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={importing || parsed.sentences.length === 0}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save size={18} />
            {importing ? '导入中...' : `导入 ${parsed.sentences.length} 个短句`}
            {autoFavorite && <Heart size={14} className="fill-white" />}
          </button>
        </div>
      )}

      {/* 导入结果 */}
      {result && (
        <div className="card p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <h3 className="font-medium text-green-700 dark:text-green-400 mb-2">导入完成</h3>
          <div className="text-sm space-y-1 dark:text-gray-300">
            <div>新增: {result.added} 个</div>
            <div>跳过: {result.skipped} 个</div>
            {previewCategory && result.added > 0 && (
              <div>分类: {previewCategory}</div>
            )}
            {autoFavorite && result.added > 0 && (
              <div className="flex items-center gap-1">
                <Heart size={14} className="fill-red-500 text-red-500" />
                已全部加入收藏
              </div>
            )}
          </div>
          {result.skippedSentences.length > 0 && (
            <details className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              <summary className="cursor-pointer">查看跳过的短句</summary>
              <div className="mt-1 max-h-32 overflow-auto">
                {result.skippedSentences.join(', ')}
              </div>
            </details>
          )}
          <div className="flex gap-2 mt-3">
            {autoFavorite && result.added > 0 ? (
              <button
                onClick={() => navigate('/favorites')}
                className="btn-secondary flex-1 text-sm flex items-center justify-center gap-1"
              >
                <Heart size={14} /> 查看收藏夹
              </button>
            ) : previewCategory && result.added > 0 ? (
              <button
                onClick={() =>
                  navigate(`/categories/${encodeURIComponent(previewCategory)}`)
                }
                className="btn-secondary flex-1 text-sm"
              >
                查看「{previewCategory}」
              </button>
            ) : (
              <button
                onClick={() => navigate('/sentences')}
                className="btn-secondary flex-1 text-sm"
              >
                查看短句列表
              </button>
            )}
            <button
              onClick={() => {
                setContent('')
                setParsed(null)
                setResult(null)
              }}
              className="btn-primary flex-1 text-sm"
            >
              继续导入
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
