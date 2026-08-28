import { useState, useRef, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Upload, FileText, Save, Heart } from 'lucide-react'
import { useLang } from '../context/Language'
import { useLangCategories, addLangCategory } from '../hooks/languageAware'
import { bulkAddWords, BulkAddResult } from '../hooks/useWords'
import {
  parseWordsJson,
  parseWordsCsv,
  parseWordsText,
  ImportableWord,
  ParseResult,
} from '../utils/import'
import { bulkAddJapaneseWords, BulkAddJapaneseResult } from '../hooks/useJapaneseWords'
import { JapaneseWord } from '../types/word'
import { BackButton } from '../components/BackButton'
import { useToast } from '../components/Toast'

type Format = 'json' | 'csv' | 'text'
// 分类选择特殊值
const KEEP_FILE_CATEGORY = '__keep__' // 使用文件中每条记录自带的 category
const NEW_CATEGORY = '__new__' // 新建分类

const EN_SAMPLES: Record<Format, string> = {
  json: `[
  {
    "word": "bank",
    "phonetic": "/bæŋk/",
    "definitions": [
      { "pos": "n.", "def": "a financial institution", "trans": "银行" },
      { "pos": "n.", "def": "the land alongside a river", "trans": "河岸" },
      { "pos": "v.", "def": "to deposit money", "trans": "存钱" }
    ],
    "example": "I need to go to the bank.",
    "category": "CET-4",
    "difficulty": 2
  },
  {
    "word": "hello",
    "phonetic": "/həˈloʊ/",
    "definition": "used as a greeting",
    "translation": "你好",
    "example": "Hello, world!",
    "category": "日常用语",
    "difficulty": 1
  }
]`,
  csv: `word,phonetic,definition,example,translation,category,difficulty,definitions
bank,/bæŋk/,a financial institution,"I need to go to the bank.",银行,CET-4,2,"[{""pos"":""n."",""def"":""a financial institution"",""trans"":""银行""},{""pos"":""n."",""def"":""the land alongside a river"",""trans"":""河岸""},{""pos"":""v."",""def"":""to deposit money"",""trans"":""存钱""}]"
hello,/həˈloʊ/,used as a greeting,"Hello, world!",你好,日常用语,1,`,
  text: `hello	你好	/həˈloʊ/
world	世界
bank	银行;河岸;存钱`,
}

const JA_SAMPLE = `[
  {
    "word": "食べる",
    "reading": "たべる",
    "partOfSpeech": "他动一",
    "jlptLevel": "N5",
    "definitions": [
      { "pos": "他动一", "meaning": "食物を口に入れて噛み飲み込む", "translation": "吃" },
      { "translation": "品尝" }
    ],
    "example": "朝ごはんを食べる。",
    "exampleReading": "あさごはんをたべる。",
    "exampleTranslation": "吃早饭。",
    "category": "N5",
    "textbook": "标准日本语初级",
    "difficulty": 2
  },
  {
    "expression": "先生",
    "kana": "せんせい",
    "translation": "老师",
    "jlptLevel": "N5"
  }
]`

/** 导入条目：允许缺省 SRS/标志字段 */
type JapaneseImportItem = Omit<JapaneseWord, 'id' | 'createdAt'>

interface JapaneseParseResult {
  words: JapaneseImportItem[]
  errors: string[]
}

const MAX_FIELD_LEN = 500
const cap = (v: unknown) => (typeof v === 'string' ? v.slice(0, MAX_FIELD_LEN) : '')

/** 日语 JSON 解析：兼容 expression→word、kana→reading 别名与多种释义字段名 */
function parseJapaneseJson(text: string): JapaneseParseResult {
  const errors: string[] = []
  const words: JapaneseImportItem[] = []
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (e) {
    return { words, errors: [`JSON 解析失败: ${(e as Error).message}`] }
  }
  if (!Array.isArray(data)) {
    return { words, errors: ['JSON 顶层必须是数组'] }
  }
  data.forEach((raw, i) => {
    const row = i + 1
    if (typeof raw !== 'object' || raw === null) {
      errors.push(`第 ${row} 行: 不是对象`)
      return
    }
    const item = raw as Record<string, unknown>
    const word = cap(item.word ?? item.expression).trim()
    if (!word) {
      errors.push(`第 ${row} 行: 缺少 word/expression`)
      return
    }
    const reading = cap(item.reading ?? item.kana).trim()
    if (!reading) {
      errors.push(`第 ${row} 行「${word}」: 缺少 reading/kana（假名读音）`)
      return
    }
    // 释义：definitions 数组优先；退化到顶层 translation（字符串或字符串数组）
    let definitions: JapaneseImportItem['definitions'] = []
    if (Array.isArray(item.definitions)) {
      definitions = (item.definitions as Record<string, unknown>[])
        .filter((d) => d && typeof d === 'object')
        .map((d) => ({
          pos: cap(d.pos ?? d.partOfSpeech).trim(),
          meaning: cap(d.meaning ?? d.def).trim(),
          translation: cap(d.translation ?? d.trans).trim(),
        }))
        .filter((d) => d.meaning || d.translation)
    }
    if (definitions.length === 0) {
      const topTrans = item.translation
      if (typeof topTrans === 'string' && topTrans.trim()) {
        definitions = [{ pos: '', meaning: '', translation: topTrans.trim().slice(0, MAX_FIELD_LEN) }]
      } else if (Array.isArray(topTrans)) {
        definitions = (topTrans as unknown[])
          .filter((t): t is string => typeof t === 'string' && !!t.trim())
          .map((t) => ({ pos: '', meaning: '', translation: t.trim().slice(0, MAX_FIELD_LEN) }))
      }
    }
    if (definitions.length === 0) {
      errors.push(`第 ${row} 行「${word}」: 缺少释义`)
      return
    }
    const difficultyRaw = Number(item.difficulty)
    words.push({
      word,
      reading,
      partOfSpeech: cap(item.partOfSpeech).trim(),
      jlptLevel: cap(item.jlptLevel).trim(),
      textbook: cap(item.textbook).trim(),
      definitions,
      example: cap(item.example).trim(),
      exampleReading: cap(item.exampleReading).trim(),
      exampleTranslation: cap(item.exampleTranslation).trim(),
      category: cap(item.category).trim() || '日语',
      difficulty: Number.isFinite(difficultyRaw) ? Math.min(5, Math.max(1, Math.round(difficultyRaw))) : 1,
      notes: cap(item.notes).trim(),
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
  })
  return { words, errors }
}

export function ImportWords() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const lang = useLang()
  const isJa = lang === 'ja'
  const [searchParams] = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const categories = useLangCategories()
  const [format, setFormat] = useState<Format>('json')
  const [content, setContent] = useState('')
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [jaParsed, setJaParsed] = useState<JapaneseParseResult | null>(null)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<BulkAddResult | BulkAddJapaneseResult | null>(null)

  // 目标分类:KEEP_FILE_CATEGORY 表示用文件原值;NEW_CATEGORY 表示要新建;其他为现有分类名
  const [categoryChoice, setCategoryChoice] = useState<string>(KEEP_FILE_CATEGORY)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [autoFavorite, setAutoFavorite] = useState(false)

  // 通过 URL 查询参数预设(从分类详情页/收藏夹页跳转过来时)
  // ?category=雅思  → 锁定目标分类
  // ?favorite=1     → 默认勾选自动收藏
  const presetCategory = searchParams.get('category')
  const presetFavorite = searchParams.get('favorite')

  useEffect(() => {
    if (presetCategory) {
      setCategoryChoice(presetCategory)
    }
    if (presetFavorite === '1' || presetFavorite === 'true') {
      setAutoFavorite(true)
    }
    // 仅在挂载时根据查询参数初始化一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isJa])

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
      if (isJa) {
        setFormat('json')
        parseJa(text)
        return
      }
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
        ? parseWordsJson(text)
        : fmt === 'csv'
        ? parseWordsCsv(text)
        : parseWordsText(text)
    setParsed(r)
  }

  const parseJa = (text: string) => {
    if (!text.trim()) {
      setJaParsed(null)
      return
    }
    setJaParsed(parseJapaneseJson(text))
  }

  const handleParse = () => {
    if (isJa) parseJa(content)
    else parse(content)
    setResult(null)
  }

  // 生成预览时使用的最终分类名(给每条记录展示)
  const previewCategory = useMemo(() => {
    if (categoryChoice === KEEP_FILE_CATEGORY) return null // 保持原值
    if (categoryChoice === NEW_CATEGORY) return newCategoryName.trim() || '(待填写)'
    return categoryChoice
  }, [categoryChoice, newCategoryName])

  const validCount = isJa ? jaParsed?.words.length ?? 0 : parsed?.words.length ?? 0
  const errorCount = isJa ? jaParsed?.errors.length ?? 0 : parsed?.errors.length ?? 0

  const handleImport = async () => {
    if (validCount === 0) return

    let targetCategory: string | undefined
    if (categoryChoice === NEW_CATEGORY) {
      const name = newCategoryName.trim()
      if (!name) {
        toast('warning', '请填写新分类名称')
        return
      }
      targetCategory = name
      // 如果新分类还不存在,先建一个（自动归属当前语言）；并发/竞态下若已存在则忽略
      const exists = categories.some((c) => c.name === name)
      if (!exists) {
        try {
          await addLangCategory(name)
        } catch (e) {
          // 分类已存在(或创建失败)不应中断整个导入
          toast('warning', '分类创建失败: ' + (e as Error).message)
        }
      }
    } else if (categoryChoice !== KEEP_FILE_CATEGORY) {
      targetCategory = categoryChoice
    }

    setImporting(true)
    try {
      if (isJa) {
        const r = await bulkAddJapaneseWords(jaParsed!.words, {
          skipDuplicates,
          overrideCategory: targetCategory,
          forceFavorite: autoFavorite,
        })
        setResult(r)
      } else {
        const r = await bulkAddWords(parsed!.words as ImportableWord[], {
          skipDuplicates,
          overrideCategory: targetCategory,
          forceFavorite: autoFavorite,
        })
        setResult(r)
      }
      toast('success', `成功导入 ${validCount} 个词条`)
    } catch (e) {
      toast('error', '导入失败: ' + (e as Error).message)
      setResult(null)
    } finally {
      setImporting(false)
    }
  }

  const useSample = () => {
    const sample = isJa ? JA_SAMPLE : EN_SAMPLES[format]
    setContent(sample)
    if (isJa) parseJa(sample)
    else parse(sample)
    setResult(null)
  }

  const noun = isJa ? '日语词' : '单词'

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <BackButton />
        <h1 className="page-title-accent">{isJa ? '导入日语词' : '批量导入'}</h1>
        <div className="w-10" />
      </div>

      {/* 格式切换（日语仅 JSON） */}
      {!isJa && (
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
            {format === 'json' && '支持单词数组，每个对象可含 definitions 数组实现多释义，也兼容旧格式 definition/translation'}
            {format === 'csv' && '表头含 definitions 列时值为 JSON 数组；也可用旧列 definition/translation'}
            {format === 'text' && '每行: word [Tab/逗号/|] 释义。多释义用分号分隔，如: 银行;河岸;存钱'}
          </p>
        </div>
      )}
      {isJa && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          仅支持 JSON 数组格式。每条必填 word（或 expression）与 reading（或 kana）假名读音，释义用 definitions 数组（或顶层 translation）。
        </p>
      )}

      {/* 文件上传 */}
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={isJa ? '.json' : '.json,.csv,.txt'}
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
          placeholder={isJa ? JA_SAMPLE : EN_SAMPLES[format]}
          className="input-field font-mono min-h-[200px]"
        />
        <button onClick={handleParse} className="btn-secondary mt-2 text-sm">
          解析预览
        </button>
      </div>

      {/* 导入选项 */}
      <div className="card p-4 space-y-3">
        <h3 className="font-medium dark:text-gray-200">导入选项</h3>

        {/* 目标分类 */}
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
              ? `使用文件中每条记录自带的分类(缺失则使用「${isJa ? '日语' : '默认'}」)`
              : `所有导入的${noun}都会归到「${previewCategory}」分类`}
          </p>
        </div>

        {/* 自动收藏 */}
        <label className="flex items-center gap-2 text-sm cursor-pointer dark:text-gray-300">
          <input
            type="checkbox"
            checked={autoFavorite}
            onChange={(e) => setAutoFavorite(e.target.checked)}
          />
          <Heart size={16} className={autoFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'} />
          <span>导入后自动加入收藏夹</span>
        </label>

        {/* 跳过重复 */}
        <label className="flex items-center gap-2 text-sm cursor-pointer dark:text-gray-300">
          <input
            type="checkbox"
            checked={skipDuplicates}
            onChange={(e) => setSkipDuplicates(e.target.checked)}
          />
          <span>跳过已存在的{noun} (按 word 字段去重)</span>
        </label>
      </div>

      {/* 解析结果 */}
      {(isJa ? jaParsed : parsed) && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium dark:text-gray-200">解析结果</h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              共 {validCount} 个有效{noun}
              {errorCount > 0 && `, ${errorCount} 条错误`}
            </span>
          </div>

          {errorCount > 0 && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl p-3 text-xs max-h-32 overflow-auto">
              {(isJa ? jaParsed!.errors : parsed!.errors).slice(0, 20).map((err, i) => (
                <div key={i}>{err}</div>
              ))}
              {errorCount > 20 && (
                <div>... 还有 {errorCount - 20} 条</div>
              )}
            </div>
          )}

          {validCount > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 max-h-40 overflow-auto border rounded-xl dark:border-slate-700">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-700 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1">{isJa ? '表记' : '单词'}</th>
                    {isJa && <th className="text-left px-2 py-1">假名</th>}
                    <th className="text-left px-2 py-1">释义/翻译</th>
                    <th className="text-left px-2 py-1">分类</th>
                  </tr>
                </thead>
                <tbody>
                  {(isJa
                    ? jaParsed!.words.slice(0, 50).map((w) => (
                        <tr key={w.word} className="border-t dark:border-slate-700">
                          <td className="px-2 py-1 font-medium">{w.word}</td>
                          <td className="px-2 py-1">{w.reading}</td>
                          <td className="px-2 py-1 truncate max-w-[200px]">
                            {w.definitions.map((d) => [d.pos, d.translation || d.meaning].filter(Boolean).join(' ')).join('; ')}
                          </td>
                          <td className="px-2 py-1">
                            {previewCategory ?? w.category}
                          </td>
                        </tr>
                      ))
                    : parsed!.words.slice(0, 50).map((w: any, i: number) => (
                        <tr key={i} className="border-t dark:border-slate-700">
                          <td className="px-2 py-1 font-medium">{w.word}</td>
                          <td className="px-2 py-1 truncate max-w-[200px]">
                            {w.definitions && w.definitions.length > 0
                              ? w.definitions.map((d: any) => [d.pos, d.trans || d.def].filter(Boolean).join(' ')).join('; ')
                              : (w.translation || w.definition)}
                          </td>
                          <td className="px-2 py-1">
                            {previewCategory ?? w.category}
                          </td>
                        </tr>
                      )))}
                </tbody>
              </table>
              {validCount > 50 && (
                <div className="text-center py-1 text-gray-400">
                  ... 仅展示前 50 条,共 {validCount} 条
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={importing || validCount === 0}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save size={18} />
            {importing ? '导入中...' : `导入 ${validCount} 个${noun}`}
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
          {result.skippedWords.length > 0 && (
            <details className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              <summary className="cursor-pointer">查看跳过的{noun}</summary>
              <div className="mt-1 max-h-32 overflow-auto">
                {result.skippedWords.join(', ')}
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
                onClick={() => navigate('/words')}
                className="btn-secondary flex-1 text-sm"
              >
                查看{isJa ? '日语词库' : '单词列表'}
              </button>
            )}
            <button
              onClick={() => {
                setContent('')
                setParsed(null)
                setJaParsed(null)
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
