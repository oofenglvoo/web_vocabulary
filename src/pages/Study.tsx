import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { CheckCircle, Sparkles, Target, RefreshCw, BookOpen, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import {
  getLangPlan,
  getLangTodayNewWords,
  getLangTodayReviewWords,
  getLangExtraNewWords,
  markLangWordStarted,
  markLangExtraWordStarted,
  markLangReviewDone,
  recordLangReview,
  markLangWordLearned,
  getRandomLangWords,
  toLangStudyItem,
  getLangAllTranslations,
} from '../hooks/languageAware'
import { LangWord } from '../hooks/languageAware'
import { useLang } from '../context/Language'
import type { LangPlan } from '../hooks/languageAware'
import { speakWord, unlockTts } from '../utils/tts'
import { getStudyType } from '../utils/studyPrefs'
import { StudyItem } from '../components/study/types'
import { RecallMode } from '../components/study/RecallMode'
import { ChoiceMode } from '../components/study/ChoiceMode'
import { QuickMode, QuickRating } from '../components/study/QuickMode'
import { StudyTypeSettings } from '../components/StudyTypeSettings'
import { BackButton } from '../components/BackButton'
import { useToast } from '../components/Toast'

export function Study() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const lang = useLang()
  const isJa = lang === 'ja'
  const [searchParams] = useSearchParams()
  const planId = searchParams.get('plan')
  const planIdNum = planId ? Number(planId) : null
  const isReviewMode = searchParams.get('mode') === 'review'
  // 加学模式:今日配额学满后的独立一轮,不计入今日配额
  const isExtra = searchParams.get('extra') === '1'

  const [plan, setPlan] = useState<LangPlan | null>(null)
  const [queue, setQueue] = useState<StudyItem[]>([])
  const [initialItems, setInitialItems] = useState<StudyItem[]>([])
  const [index, setIndex] = useState(0)
  // 本轮初始词数(回忆式进度用)
  const [startTotal, setStartTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [learnStats, setLearnStats] = useState({ newDone: 0, reviewDone: 0 })
  const [confirmMaster, setConfirmMaster] = useState(false)
  const [done, setDone] = useState(false)
  // Moji 流程：先看当天词表，点击开始测试后才进入题型测验
  const [studyStarted, setStudyStarted] = useState(false)
  const [confirmStartTest, setConfirmStartTest] = useState(false)
  // 题型版本号：切题型时递增，强制重渲染让 studyType 重新读 localStorage
  const [studyTypeVersion, setStudyTypeVersion] = useState(0)
  // 依赖 studyTypeVersion：切题型时重算题型（重新读 localStorage）
  const studyType = useMemo(
    () => getStudyType(isReviewMode),
    [studyTypeVersion, isReviewMode] // eslint-disable-line react-hooks/exhaustive-deps
  )
  // 选择题当前项的干扰项
  const [choiceDistractors, setChoiceDistractors] = useState<string[]>([])

  // 延迟回调定时器：组件卸载时统一清理
  const timersRef = useRef<number[]>([])
  // 全表翻译缓存(选择题干扰项)
  const allTranslationsRef = useRef<string[] | null>(null)
  // 复习答错重排去重：同一词一轮只重排一次，避免无限循环
  const requeuedRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((t) => clearTimeout(t))
      timers.length = 0
    }
  }, [])

  // 语言切换时重新加载队列（数据源完全不同）
  useEffect(() => {
    startStudy()
    unlockTts()
    // isReviewMode 也作为依赖：仅改 mode 参数(plan 不变)时也要重新加载队列
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planIdNum, isReviewMode, lang])

  async function startStudy() {
    setLoading(true)
    setLearnStats({ newDone: 0, reviewDone: 0 })
    setDone(false)
    setStudyStarted(false)
    setConfirmStartTest(false)
    requeuedRef.current = new Set()
    allTranslationsRef.current = null
    let items: { word: LangWord; isReview: boolean }[] = []
    if (planIdNum) {
      const p = await getLangPlan(planIdNum)
      if (!p) {
        setLoading(false)
        return
      }
      setPlan(p)
      if (isReviewMode) {
        const reviewWords = await getLangTodayReviewWords(p)
        items = reviewWords.map((w) => ({ word: w, isReview: true }))
      } else if (isExtra) {
        // 加学:取一批新词,独立于今日配额
        const extraWords = await getLangExtraNewWords(p)
        items = extraWords.map((w) => ({ word: w, isReview: false }))
      } else {
        // 学习入口只包含今日新词配额；到期复习由首页"开始复习"(mode=review)独立进入
        const newWords = await getLangTodayNewWords(p)
        items = newWords.map((w) => ({ word: w, isReview: false }))
      }
    } else {
      const words = await getRandomLangWords(20)
      items = words.map((w) => ({ word: w, isReview: false }))
    }
    const studyItems: StudyItem[] = items.map(({ word, isReview }) =>
      toLangStudyItem(word, isReview)
    )
    setQueue(studyItems)
    setInitialItems(studyItems)
    setStartTotal(studyItems.length)
    setIndex(0)
    // 复习不需要预学习列表，进入页面后直接开始复习测试。
    setStudyStarted(isReviewMode)
    setLoading(false)
  }

  const currentItem = queue[index]
  const total = queue.length

  // 选择题干扰项缓存 + 异步加载（按当前语言词库构建候选池）
  const loadDistractors = async (current: StudyItem) => {
    if (allTranslationsRef.current === null) {
      allTranslationsRef.current = await getLangAllTranslations()
    }
    const others = allTranslationsRef.current.filter((t) => t !== current.primaryTranslation)
    setChoiceDistractors([...new Set(others)].slice(0, 3))
  }

  // 切到选择题且切换词条时刷新干扰项
  useEffect(() => {
    if (studyType === 'choice' && currentItem) {
      loadDistractors(currentItem)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyType, currentItem?.id])

  async function handleRate(item: StudyItem, quality: number) {
    try {
      await recordLangReview(item.id, quality, 0, item.isReview ? 'review' : 'new')
    } catch (e) {
      toast('error', '记录失败: ' + (e as Error).message)
      return
    }
    // 回忆式(Moji)：认识(quality>=3) → 计数 + 从队列移除(通过不再出现)；模糊/忘记(quality<3) → 重排到队尾，重复直到认识
    if (studyType === 'recall') {
      if (quality < 3) {
        setQueue((q) => {
          const idx = q.findIndex((x) => x.id === item.id)
          if (idx === -1) return q
          return [...q.slice(0, idx), ...q.slice(idx + 1), item]
        })
        return // 不计数、不推进（当前词重排到队尾，下一个词自动顶到当前位置）
      }
      if (planIdNum) {
        try {
          if (item.isReview) {
            await markLangReviewDone(planIdNum)
            setLearnStats((s) => ({ ...s, reviewDone: s.reviewDone + 1 }))
          } else if (isExtra) {
            // 加学:只写 startedIds,不计入今日配额
            await markLangExtraWordStarted(planIdNum, item.id)
            setLearnStats((s) => ({ ...s, newDone: s.newDone + 1 }))
          } else {
            await markLangWordStarted(planIdNum, item.id)
            setLearnStats((s) => ({ ...s, newDone: s.newDone + 1 }))
          }
        } catch (e) {
          toast('error', '记录失败: ' + (e as Error).message)
          return
        }
      }
      // 认识 → 移除当前词；index 不推进（下一个词顶到当前位置，避免跳过）
      setQueue((q) => q.filter((x) => x.id !== item.id))
      return
    }
    if (planIdNum) {
      try {
        if (item.isReview) {
          await markLangReviewDone(planIdNum)
          setLearnStats((s) => ({ ...s, reviewDone: s.reviewDone + 1 }))
        } else if (isExtra) {
          await markLangExtraWordStarted(planIdNum, item.id)
          setLearnStats((s) => ({ ...s, newDone: s.newDone + 1 }))
        } else {
          await markLangWordStarted(planIdNum, item.id)
          setLearnStats((s) => ({ ...s, newDone: s.newDone + 1 }))
        }
      } catch (e) {
        toast('error', '记录失败: ' + (e as Error).message)
        return
      }
    }
    // 复习答错 → 重排到队尾(每轮一次)
    if (item.isReview && quality < 3 && !requeuedRef.current.has(item.id)) {
      requeuedRef.current.add(item.id)
      setQueue((q) => {
        const idx = q.findIndex((x) => x.id === item.id)
        if (idx === -1) return q
        return [...q.slice(0, idx), ...q.slice(idx + 1), item]
      })
      return
    }
    advance()
  }

  function advance() {
    setIndex((i) => i + 1)
  }

  // 快速自测批量提交
  async function handleQuickSubmit(results: QuickRating[]): Promise<boolean> {
    for (const { item, quality, mastered } of results) {
      try {
        await recordLangReview(item.id, quality, 0, item.isReview ? 'review' : 'new')
        // "掌握" → 永久标记已掌握
        if (mastered) {
          await markLangWordLearned(item.id)
        }
      } catch (e) {
        toast('error', '记录失败: ' + (e as Error).message)
        return false
      }
      if (planIdNum) {
        try {
          if (item.isReview) {
            await markLangReviewDone(planIdNum)
            setLearnStats((s) => ({ ...s, reviewDone: s.reviewDone + 1 }))
          } else if (isExtra) {
            await markLangExtraWordStarted(planIdNum, item.id)
            setLearnStats((s) => ({ ...s, newDone: s.newDone + 1 }))
          } else {
            await markLangWordStarted(planIdNum, item.id)
            setLearnStats((s) => ({ ...s, newDone: s.newDone + 1 }))
          }
        } catch (e) {
          toast('error', '记录失败: ' + (e as Error).message)
          return false
        }
      }
    }
    setDone(true)
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.7 },
      colors: ['#6366f1', '#8b5cf6', '#ec4899', '#10b981'],
    })
    return true
  }

  async function handleMaster(item: StudyItem) {
    setConfirmMaster(false)
    try {
      await markLangWordLearned(item.id)
      if (planIdNum) {
        if (item.isReview) {
          await markLangReviewDone(planIdNum)
          setLearnStats((s) => ({ ...s, reviewDone: s.reviewDone + 1 }))
        } else if (isExtra) {
          await markLangExtraWordStarted(planIdNum, item.id)
          setLearnStats((s) => ({ ...s, newDone: s.newDone + 1 }))
        } else {
          await markLangWordStarted(planIdNum, item.id)
          setLearnStats((s) => ({ ...s, newDone: s.newDone + 1 }))
        }
      }
    } catch (e) {
      toast('error', '操作失败: ' + (e as Error).message)
      return
    }
    setQueue((q) => q.filter((x) => x.id !== item.id))
    advance()
  }

  const speak = (item: StudyItem) =>
    isJa ? speakWord(item.title, { lang: 'ja' }) : speakWord(item.title)

  function startTestFromCompletion() {
    setQueue(initialItems)
    setStartTotal(initialItems.length)
    setIndex(0)
    setDone(false)
    setStudyStarted(true)
    requeuedRef.current = new Set()
  }

  // 到达末尾 → 完成页(触发庆祝)
  // 回忆式：队列清空(所有词都"认识")即完成；其他模式：index 走完
  useEffect(() => {
    // 回忆式：加载完成后队列清空(所有词都"认识")才算完成；
    // 其他模式：index 走完。都需 !loading，避免初始空队列/未加载时误判完成
    const completed = !loading
      ? studyType === 'recall'
        ? queue.length === 0
        : total > 0 && index >= total
      : false
    if (completed && !done) {
      setDone(true)
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.7 },
        colors: ['#6366f1', '#8b5cf6', '#ec4899', '#10b981'],
      })
    }
  }, [loading, index, total, done, queue.length, studyType])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    )
  }

  // 空队列
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-gradient-mesh">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="card p-8 max-w-sm w-full"
        >
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-accent flex items-center justify-center shadow-glow">
            <RefreshCw size={28} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-1">
            {isReviewMode
              ? isJa ? '暂无待复习日语词' : '暂无待复习单词'
              : '今日学习已完成!'}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-5">
            {plan?.name && `「${plan.name}」`}
            {isReviewMode
              ? '当前没有需要复习的内容'
              : planIdNum
                ? '本日新词与复习均已结束'
                : isJa
                  ? '暂无可学习的日语词，请先导入'
                  : '暂无可学习的单词，请先添加单词'}
          </p>
          <div className="flex gap-3">
            <button onClick={() => navigate('/plan')} className="btn-secondary flex-1">
              返回计划
            </button>
            {isReviewMode ? (
              <button
                onClick={() => navigate(`/study?plan=${planIdNum}`)}
                className="btn-primary flex-1"
              >
                去学习
              </button>
            ) : (
              <Link to="/study" className="btn-primary flex-1">
                自由学习
              </Link>
            )}
          </div>
          {!isReviewMode && initialItems.length > 0 && (
            <button onClick={startTestFromCompletion} className="btn-primary w-full mt-3">
              开始测试
            </button>
          )}
        </motion.div>
      </div>
    )
  }

  // 完成页
  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-gradient-mesh">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="card p-8 max-w-sm w-full"
        >
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-success flex items-center justify-center shadow-glow">
            <CheckCircle size={28} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-1">{isReviewMode ? '复习完成!' : '学习完成!'}</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-5">本轮共 {startTotal} 个词条</p>

          {planIdNum && (learnStats.newDone > 0 || learnStats.reviewDone > 0) && (
            <div className="grid grid-cols-2 gap-2 mb-5">
              <div className="bg-primary-50 dark:bg-primary-900/30 rounded-xl p-3">
                <div className="text-2xl font-bold text-gradient">{learnStats.newDone}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">新词掌握</div>
              </div>
              <div className="bg-accent-50 dark:bg-accent-900/30 rounded-xl p-3">
                <div className="text-2xl font-bold text-accent-600">{learnStats.reviewDone}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">复习掌握</div>
              </div>
            </div>
          )}

          <button
            onClick={startTestFromCompletion}
            className="btn-primary w-full mb-2"
          >
            开始测试
          </button>
          <button
            onClick={() => navigate(planIdNum ? '/plan' : '/')}
            className="btn-secondary w-full"
          >
            {planIdNum ? '返回计划' : '返回首页'}
          </button>
        </motion.div>
      </div>
    )
  }

  // 预学习阶段：当天词条完整展示，用户主动开始测试后锁定进入题型
  if (!studyStarted) {
    return (
      <div className="p-4 min-h-screen flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <BackButton />
          <div className="flex items-center gap-2">
            {planIdNum && plan && (
              <span className="chip bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                <Target size={11} /> {plan.name}
              </span>
            )}
            <StudyTypeSettings onChange={() => { setDone(false); setStudyTypeVersion((v) => v + 1) }} />
          </div>
        </div>
        <div className="flex justify-center mb-3">
          <span className="chip bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
            <BookOpen size={11} /> 今日学习 · {total} 个词条
          </span>
        </div>
        <div className="card p-4 flex-1 space-y-3 overflow-auto">
          <div>
            <h1 className="text-xl font-bold dark:text-gray-100">先学习当天词条</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              点击单词查看完整详情，准备好后再开始测试。
            </p>
          </div>
          <div className="space-y-2">
            {queue.map((item) => (
              <Link
                key={item.id}
                to={`/word/${item.id}?studyPreview=1&studyIds=${queue.map((entry) => entry.id).join(',')}`}
                aria-label={item.title}
                className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 dark:bg-slate-700/60 px-4 py-3 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
              >
                <span className="font-semibold dark:text-gray-100">{item.title}</span>
                <ChevronRight size={16} className="text-gray-400 dark:text-gray-500 shrink-0" />
              </Link>
            ))}
          </div>
          <button onClick={() => setConfirmStartTest(true)} className="btn-primary w-full mt-auto">
            开始测试
          </button>
        </div>
        {confirmStartTest && (
          <div className="modal-overlay">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="modal-content max-w-sm text-center"
            >
              <h2 className="font-bold text-lg dark:text-gray-100">开始测试？</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-5">
                开始测试后将进入{STUDY_TYPE_LABEL_ZH[studyType]}，不能返回当天学习列表。
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmStartTest(false)} className="btn-secondary flex-1">继续学习</button>
                <button onClick={() => { setConfirmStartTest(false); setStudyStarted(true) }} className="btn-primary flex-1">确认开始</button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    )
  }

  // 回忆式进度 = 已完成(移除)数 / 本轮总数；其他模式 = index/total
  const progressPct =
    studyType === 'recall'
      ? Math.round(((startTotal - queue.length) / Math.max(startTotal, 1)) * 100)
      : Math.round(((index) / Math.max(total, 1)) * 100)

  const entityType = isJa ? ('japaneseWord' as const) : ('word' as const)

  return (
    <div className="p-4 min-h-screen flex flex-col" data-study-quiz>
      <div className="flex items-center justify-between mb-3">
        <BackButton />
        <div className="flex items-center gap-2">
          {planIdNum && plan && (
            <span className="chip bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
              <Target size={11} /> {plan.name}
            </span>
          )}
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {studyType === 'recall'
              ? `剩余 ${queue.length}`
              : `${Math.min(index + 1, total)} / ${total}`}
          </span>
          <StudyTypeSettings onChange={() => { setDone(false); setStudyTypeVersion((v) => v + 1) }} />
        </div>
      </div>

      {/* 模式标签 */}
      <div className="flex justify-center mb-2">
        {isReviewMode ? (
          <span className="chip bg-accent-50 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400">
            <RefreshCw size={11} /> 复习 · {STUDY_TYPE_LABEL_ZH[studyType]}
          </span>
        ) : isExtra ? (
          <span className="chip bg-warn-50 dark:bg-warn-900/30 text-warn-600 dark:text-warn-400">
            <Sparkles size={11} /> 加学 · {STUDY_TYPE_LABEL_ZH[studyType]}
          </span>
        ) : (
          <span className="chip bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
            <Sparkles size={11} /> 新学 · {STUDY_TYPE_LABEL_ZH[studyType]}
          </span>
        )}
      </div>

      {/* 进度条 */}
      <div className="progress-track h-2 mb-3 progress-shimmer">
        <div className="progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="flex-1 flex flex-col">
        {studyType === 'recall' && currentItem && (
          <RecallMode
            key={currentItem.id}
            item={currentItem}
            onRate={(q) => handleRate(currentItem, q)}
            onMaster={() => setConfirmMaster(true)}
            onSpeak={() => speak(currentItem)}
            entityType={entityType}
          />
        )}
        {studyType === 'choice' && currentItem && (
          <ChoiceMode
            key={currentItem.id}
            item={currentItem}
            distractors={choiceDistractors}
            onRate={(q) => handleRate(currentItem, q)}
            onMaster={() => setConfirmMaster(true)}
            onSpeak={() => speak(currentItem)}
            entityType={entityType}
          />
        )}
        {studyType === 'quick' && (
          <QuickMode
            key={`quick-${studyType}-${queue.length}`}
            items={queue}
            onRateAll={handleQuickSubmit}
            onSpeak={speak}
            entityType={entityType}
          />
        )}
      </div>

      {/* 掌握确认弹窗 */}
      {confirmMaster && currentItem && (
        <div className="modal-overlay">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300 }}
            className="modal-content max-w-xs text-center"
          >
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-success flex items-center justify-center shadow-glow">
              <CheckCircle size={28} className="text-white" />
            </div>
            <h3 className="font-bold text-lg mb-1 dark:text-gray-100">标记为已掌握?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              词条: <span className="font-medium text-gray-700 dark:text-gray-200">{currentItem.title}</span>
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">
              标记后将加入已掌握列表,不再进入复习队列
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmMaster(false)} className="btn-secondary flex-1">
                取消
              </button>
              <button onClick={() => handleMaster(currentItem)} className="btn-success flex-1">
                确认掌握
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

const STUDY_TYPE_LABEL_ZH: Record<string, string> = {
  recall: '回忆式',
  choice: '选择题',
  quick: '快速自测',
}
