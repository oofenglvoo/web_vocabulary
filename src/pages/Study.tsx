import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  Volume2,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Target,
  RefreshCw,
  GraduationCap,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { db } from '../db/database'
import { getRandomWords, recordReview, markWordLearned } from '../hooks/useWords'
import {
  getTodayNewWords,
  getTodayReviewWords,
  markWordStarted,
  markReviewDone,
} from '../hooks/useStudyPlan'
import { Word, StudyPlan } from '../types/word'
import { speakWord, unlockTts } from '../utils/tts'
import { getDefinitions, getPrimaryTranslation } from '../utils/definitions'
import { BackButton } from '../components/BackButton'
import { useToast } from '../components/Toast'

type StudyMode = 'learn' | 'quiz' | 'review'

interface QueueItem {
  word: Word
  isReview: boolean
}

interface QuizItem extends QueueItem {
  wrongCount: number
  correctStreak: number
  requiredCorrect: number
}

export function Study() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const planId = searchParams.get('plan')
  const planIdNum = planId ? Number(planId) : null
  const initialMode = (searchParams.get('mode') as StudyMode) || 'learn'
  const isReviewMode = initialMode === 'review'

  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [mode, setMode] = useState<StudyMode>(isReviewMode ? 'quiz' : initialMode)

  // 学习队列(纯浏览)
  const [learnQueue, setLearnQueue] = useState<QueueItem[]>([])
  const [learnIndex, setLearnIndex] = useState(0)

  // 测验队列(错词重测)
  const [quizQueue, setQuizQueue] = useState<QuizItem[]>([])
  const [quizOptions, setQuizOptions] = useState<string[]>([])
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [quizRevealed, setQuizRevealed] = useState(false)
  const [quizStats, setQuizStats] = useState({ correct: 0, wrong: 0, total: 0 })
  const [quizStarted, setQuizStarted] = useState(false)
  const [quizFinished, setQuizFinished] = useState(false)
  const [confirmStartQuiz, setConfirmStartQuiz] = useState(false)

  const [loading, setLoading] = useState(true)
  const [learnStats, setLearnStats] = useState({ newDone: 0, reviewDone: 0 })
  const [confirmMaster, setConfirmMaster] = useState(false)

  // 翻转状态
  const [isFlipped, setIsFlipped] = useState(false)

  // 延迟回调定时器：组件卸载时统一清理，避免在已卸载组件上 setState
  const timersRef = useRef<number[]>([])
  const allTranslationsRef = useRef<string[] | null>(null)

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((t) => clearTimeout(t))
      timers.length = 0
    }
  }, [])

  useEffect(() => {
    startStudy()
    unlockTts()
    // isReviewMode 也作为依赖：仅改 mode 参数(plan 不变)时也要重新加载队列
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planIdNum, isReviewMode])

  // 登记延迟回调，统一随组件卸载清理
  const schedule = (fn: () => void, ms: number) => {
    const t = window.setTimeout(fn, ms)
    timersRef.current.push(t)
  }

  async function startStudy() {
    setLoading(true)
    setLearnStats({ newDone: 0, reviewDone: 0 })
    let items: QueueItem[] = []
    if (planIdNum) {
      const p = await db.studyPlans.get(planIdNum)
      if (!p) {
        setLoading(false)
        return
      }
      setPlan(p)

      if (isReviewMode) {
        // 复习模式：只加载待复习单词
        const reviewWords = await getTodayReviewWords(p)
        items = reviewWords.map((w) => ({ word: w, isReview: true }))
      } else {
        const reviewWords = await getTodayReviewWords(p)
        const newWords = await getTodayNewWords(p)
        items = [
          ...reviewWords.map((w) => ({ word: w, isReview: true })),
          ...newWords.map((w) => ({ word: w, isReview: false })),
        ]
      }
    } else {
      const words = await getRandomWords(20)
      items = words.map((w) => ({ word: w, isReview: false }))
    }
    setLearnQueue(items)
    setLearnIndex(0)
    setQuizQueue([])
    setQuizStarted(false)
    setQuizFinished(false)
    setQuizStats({ correct: 0, wrong: 0, total: items.length })
    setLoading(false)

    // 复习模式自动进入测验
    if (isReviewMode && items.length > 0) {
      const quizItems: QuizItem[] = items.map((q) => ({
        ...q,
        wrongCount: 0,
        correctStreak: 0,
        requiredCorrect: 1,
      }))
      quizItems.sort(() => Math.random() - 0.5)
      setQuizQueue(quizItems)
      setQuizStarted(true)
      setQuizStats({ correct: 0, wrong: 0, total: quizItems.length })
    }
  }

  // === 学习模式 ===
  const learnItem = learnQueue[learnIndex]
  const learnFinished = learnQueue.length > 0 && learnIndex >= learnQueue.length

  function handleLearnPrev() {
    setLearnIndex((i) => Math.max(0, i - 1))
    setIsFlipped(false)
  }
  function handleLearnNext() {
    setLearnIndex((i) => Math.min(learnQueue.length, i + 1))
    setIsFlipped(false)
  }

  async function handleLearnMaster() {
    if (!learnItem) return
    setConfirmMaster(false)
    const wordId = learnItem.word.id!
    try {
      await markWordLearned(wordId)
      if (planIdNum) {
        if (learnItem.isReview) {
          await markReviewDone(planIdNum)
          setLearnStats((s) => ({ ...s, reviewDone: s.reviewDone + 1 }))
        } else {
          await markWordStarted(planIdNum, wordId)
          setLearnStats((s) => ({ ...s, newDone: s.newDone + 1 }))
        }
      }
    } catch (e) {
      toast('error', '操作失败: ' + (e as Error).message)
      return
    }
    // 按 wordId 移除，避免使用可能过期的 learnIndex 删错项
    setLearnQueue((prev) => {
      const next = prev.filter((q) => q.word.id !== wordId)
      setLearnIndex((i) => Math.min(i, Math.max(0, next.length - 1)))
      return next
    })
    setIsFlipped(false)
  }

  // === 测验模式 ===
  function handleModeChange(next: StudyMode) {
    if (next === 'quiz') {
      if (learnQueue.length === 0) return
      if (!quizStarted) {
        setConfirmStartQuiz(true)
        return
      }
    }
    setMode(next)
    setSelectedOption(null)
    setQuizRevealed(false)
    setIsFlipped(false)
  }

  function confirmStartQuizNow() {
    setConfirmStartQuiz(false)
    const items: QuizItem[] = learnQueue.map((q) => ({
      ...q,
      wrongCount: 0,
      correctStreak: 0,
      requiredCorrect: 1,
    }))
    items.sort(() => Math.random() - 0.5)
    setQuizQueue(items)
    setQuizStarted(true)
    setQuizFinished(false)
    setQuizStats({ correct: 0, wrong: 0, total: items.length })
    setMode('quiz')
    setSelectedOption(null)
    setQuizRevealed(false)
  }

  const currentQuiz = quizQueue[0]
  const quizTotal = quizStats.total
  const quizRemaining = quizQueue.length
  const quizPassed = quizTotal - quizRemaining

  useEffect(() => {
    if (mode === 'quiz' && currentQuiz) {
      prepareQuiz(currentQuiz.word)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuiz?.word.id, mode])

  async function prepareQuiz(word: Word) {
    const primaryTrans = getPrimaryTranslation(word)
    // 全表翻译列表只加载一次并缓存，避免每道题都 toArray 全表读取
    if (allTranslationsRef.current === null) {
      const all = await db.words.toArray()
      allTranslationsRef.current = all.map((w) => getPrimaryTranslation(w)).filter(Boolean)
    }
    const others = allTranslationsRef.current.filter((t) => t !== primaryTrans)
    // 去重并取干扰项
    const uniqueOthers = [...new Set(others)]
    const distractors = uniqueOthers.slice(0, 3)
    const opts = [primaryTrans, ...distractors].sort(() => Math.random() - 0.5)
    setQuizOptions(opts)
    setSelectedOption(null)
    setQuizRevealed(false)
  }

  async function handleQuizSelect(option: string) {
    if (quizRevealed || !currentQuiz) return
    setSelectedOption(option)
    setQuizRevealed(true)
    const primaryTrans = getPrimaryTranslation(currentQuiz.word)
    const correct = option === primaryTrans
    const wordId = currentQuiz.word.id!

    if (correct) {
      try {
        await recordReview(wordId, 5)
      } catch (e) {
        toast('error', '记录失败: ' + (e as Error).message)
      }
      const newStreak = currentQuiz.correctStreak + 1
      if (newStreak >= currentQuiz.requiredCorrect) {
        setQuizStats((s) => ({ ...s, correct: s.correct + 1 }))
        if (planIdNum) {
          try {
            if (currentQuiz.isReview) {
              await markReviewDone(planIdNum)
              setLearnStats((s) => ({ ...s, reviewDone: s.reviewDone + 1 }))
            } else {
              await markWordStarted(planIdNum, wordId)
              setLearnStats((s) => ({ ...s, newDone: s.newDone + 1 }))
            }
          } catch (e) {
            toast('error', '记录失败: ' + (e as Error).message)
          }
        }
        schedule(() => {
          setQuizQueue((q) => q.slice(1))
          setSelectedOption(null)
          setQuizRevealed(false)
        }, 900)
      } else {
        schedule(() => {
          setQuizQueue((q) => {
            const [head, ...rest] = q
            return [...rest, { ...head!, correctStreak: newStreak }]
          })
          setSelectedOption(null)
          setQuizRevealed(false)
        }, 900)
      }
    } else {
      try {
        await recordReview(wordId, 1)
      } catch (e) {
        toast('error', '记录失败: ' + (e as Error).message)
      }
      setQuizStats((s) => ({ ...s, wrong: s.wrong + 1 }))
      schedule(() => {
        setQuizQueue((q) => {
          const [head, ...rest] = q
          if (!head) return q
          return [
            ...rest,
            {
              ...head,
              wrongCount: head.wrongCount + 1,
              correctStreak: 0,
              requiredCorrect: 2,
            },
          ]
        })
        setSelectedOption(null)
        setQuizRevealed(false)
      }, 1200)
    }
  }

  async function handleQuizMaster() {
    if (!currentQuiz) return
    setConfirmMaster(false)
    const wordId = currentQuiz.word.id!
    try {
      await markWordLearned(wordId)
      if (planIdNum) {
        if (currentQuiz.isReview) {
          await markReviewDone(planIdNum)
          setLearnStats((s) => ({ ...s, reviewDone: s.reviewDone + 1 }))
        } else {
          await markWordStarted(planIdNum, wordId)
          setLearnStats((s) => ({ ...s, newDone: s.newDone + 1 }))
        }
      }
    } catch (e) {
      toast('error', '操作失败: ' + (e as Error).message)
      return
    }
    setQuizQueue((q) => q.slice(1))
    setSelectedOption(null)
    setQuizRevealed(false)
  }

  // 测验完成时触发庆祝动画
  useEffect(() => {
    if (quizStarted && !quizFinished && quizQueue.length === 0 && quizStats.total > 0) {
      setQuizFinished(true)
      // 触发 confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.7 },
        colors: ['#6366f1', '#8b5cf6', '#ec4899', '#10b981'],
      })
      // 第二波
      schedule(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#6366f1', '#ec4899'],
        })
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#10b981', '#8b5cf6'],
        })
      }, 250)
    }
  }, [quizQueue.length, quizStarted, quizFinished, quizStats.total])

  function speak(e?: React.MouseEvent) {
    e?.stopPropagation()
    e?.preventDefault()
    const w = mode === 'learn' ? learnItem?.word : currentQuiz?.word
    if (!w) return
    speakWord(w.word)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (learnQueue.length === 0 && !isReviewMode) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 text-center">
        {planIdNum ? (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              <CheckCircle size={64} className="text-success-500 mb-4" />
            </motion.div>
            <h2 className="text-2xl font-bold mb-2">今日学习已完成!</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {plan?.name && `「${plan.name}」`}本日新词与复习均已结束
            </p>
            <div className="flex gap-3">
              <button onClick={() => navigate('/plan')} className="btn-secondary">
                <Target size={16} className="mr-1" /> 返回计划
              </button>
              <Link to="/study" className="btn-primary">
                自由学习
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold mb-4">没有可学习的单词</h2>
            <button onClick={startStudy} className="btn-primary">
              重新加载
            </button>
            <button onClick={() => navigate(-1)} className="btn-secondary mt-3">
              返回
            </button>
          </>
        )}
      </div>
    )
  }

  // 复习模式无待复习单词
  if (isReviewMode && learnQueue.length === 0) {
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
          <h2 className="text-2xl font-bold mb-1">暂无待复习单词</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-5">
            {plan?.name && `「${plan.name}」`}当前没有需要复习的单词
          </p>
          <div className="flex gap-3">
            <button onClick={() => navigate('/plan')} className="btn-secondary flex-1">
              返回计划
            </button>
            <button
              onClick={() => navigate(`/study?plan=${planIdNum}`)}
              className="btn-primary flex-1"
            >
              去学习
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // 测验完成页
  if (mode === 'quiz' && quizFinished) {
    const accuracy = quizStats.total > 0 ? Math.round((quizStats.correct / quizStats.total) * 100) : 0
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-gradient-mesh">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="card p-8 max-w-sm w-full"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
            className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-success flex items-center justify-center shadow-glow"
          >
            <CheckCircle size={28} className="text-white" />
          </motion.div>
          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold mb-1"
          >
            {isReviewMode ? '复习完成!' : '测验完成!'}
          </motion.h2>
          <p className="text-gray-500 dark:text-gray-400 mb-5">共 {quizStats.total} 个单词</p>

          <div className="grid grid-cols-3 gap-2 mb-5">
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-success-50 dark:bg-success-900/30 rounded-xl p-3"
            >
              <div className="text-2xl font-bold text-success-600">{quizStats.correct}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">通过</div>
            </motion.div>
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-red-50 dark:bg-red-900/30 rounded-xl p-3"
            >
              <div className="text-2xl font-bold text-red-500">{quizStats.wrong}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">出错</div>
            </motion.div>
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="bg-primary-50 dark:bg-primary-900/30 rounded-xl p-3"
            >
              <div className="text-2xl font-bold text-gradient">{accuracy}%</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">正确率</div>
            </motion.div>
          </div>

          <div className="flex gap-3">
            {!isReviewMode && (
              <button
                onClick={() => {
                  setMode('learn')
                  setQuizStarted(false)
                  setQuizFinished(false)
                }}
                className="btn-secondary flex-1"
              >
                返回学习
              </button>
            )}
            <button
              onClick={() => navigate(planIdNum ? '/plan' : '/')}
              className="btn-primary flex-1"
            >
              {planIdNum ? '返回计划' : '返回首页'}
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // 学习模式完成(浏览到末尾)
  if (mode === 'learn' && learnFinished) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-gradient-mesh">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="card p-8 max-w-sm w-full"
        >
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <GraduationCap size={28} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-1">学习完成!</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-5">已浏览全部 {learnQueue.length + learnStats.newDone + learnStats.reviewDone} 个单词</p>

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

          <div className="flex gap-3">
            <button
              onClick={() => navigate(planIdNum ? '/plan' : '/')}
              className="btn-secondary flex-1"
            >
              {planIdNum ? '返回计划' : '返回首页'}
            </button>
            <button
              onClick={() => setConfirmStartQuiz(true)}
              className="btn-primary flex-1"
            >
              <Target size={16} className="mr-1" /> 开始测验
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  const currentWord = mode === 'learn' ? learnItem?.word : currentQuiz?.word

  // 翻转处理
  const handleFlip = () => {
    setIsFlipped(!isFlipped)
  }

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
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {mode === 'learn'
              ? `${learnIndex + 1} / ${learnQueue.length}`
              : `${quizPassed} / ${quizTotal}`}
          </span>
        </div>
      </div>

      {/* 学习 / 测验 切换 (复习模式不显示) */}
      {!isReviewMode && (
        <div className="flex gap-2 mb-3 p-1 bg-gray-100 dark:bg-slate-700 rounded-xl">
          <button
            onClick={() => handleModeChange('learn')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'learn'
                ? 'bg-gradient-primary text-white shadow-glow'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <GraduationCap size={16} /> 学习
          </button>
          <button
            onClick={() => handleModeChange('quiz')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'quiz'
                ? 'bg-gradient-primary text-white shadow-glow'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Target size={16} /> 测验
          </button>
        </div>
      )}

      {/* 复习模式标签 */}
      {isReviewMode && (
        <div className="flex justify-center mb-2">
          <span className="chip bg-accent-50 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400">
            <RefreshCw size={11} /> 复习测验
          </span>
        </div>
      )}

      {/* 队列类型标签 (非复习模式) */}
      {planIdNum && !isReviewMode && (
        <div className="flex justify-center mb-2">
          {((mode === 'learn' && learnItem?.isReview) ||
            (mode === 'quiz' && currentQuiz?.isReview)) ? (
            <span className="chip bg-accent-50 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400">
              <RefreshCw size={11} /> 复习
            </span>
          ) : (
            <span className="chip bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
              <Sparkles size={11} /> 新词
            </span>
          )}
        </div>
      )}

      {/* 进度条 */}
      <div className="progress-track h-2 mb-3 progress-shimmer">
        <div
          className="progress-fill"
          style={{
            width: `${
              mode === 'learn'
                ? ((learnIndex + 1) / learnQueue.length) * 100
                : (quizPassed / Math.max(quizTotal, 1)) * 100
            }%`,
          }}
        />
      </div>

      {/* 测验模式:错词提示 */}
      {mode === 'quiz' && currentQuiz && currentQuiz.wrongCount > 0 && (
        <div className="flex items-center justify-center gap-1.5 mb-2 text-xs text-warn-600 dark:text-warn-400">
          <AlertCircle size={12} />
          此词已错 {currentQuiz.wrongCount} 次,需连续答对 {currentQuiz.requiredCorrect} 次通过
          (剩余 {currentQuiz.requiredCorrect - currentQuiz.correctStreak})
        </div>
      )}

      {/* 上一个 / 掌握 / 下一个 */}
      <div className="flex items-center justify-between gap-2 mb-3">
        {mode === 'learn' ? (
          <>
            <button
              type="button"
              onClick={handleLearnPrev}
              disabled={learnIndex === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft size={16} /> 上一个
            </button>
            <button
              type="button"
              onClick={handleFlip}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-accent text-white text-sm shadow-soft hover:shadow-glow active:scale-95 transition-all"
            >
              翻转
            </button>
            <button
              type="button"
              onClick={() => setConfirmMaster(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-success text-white text-sm shadow-soft hover:shadow-glow active:scale-95 transition-all"
            >
              <CheckCircle size={16} /> 掌握
            </button>
            <button
              type="button"
              onClick={handleLearnNext}
              disabled={learnIndex >= learnQueue.length - 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 text-sm disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              下一个 <ChevronRight size={16} />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmMaster(true)}
            disabled={!currentQuiz}
            className="mx-auto flex items-center gap-1 px-4 py-1.5 rounded-xl bg-gradient-success text-white text-sm shadow-soft hover:shadow-glow active:scale-95 transition-all disabled:opacity-50"
          >
            <CheckCircle size={16} /> 标记为已掌握
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col">
        {/* 学习模式:翻转卡片 */}
        {mode === 'learn' && learnItem && currentWord && (
          <motion.div
            key={currentWord.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="card flex-1 flex flex-col p-6 overflow-auto"
            style={{ perspective: '1000px' }}
            drag={mode === 'learn' ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.3}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60 && learnIndex < learnQueue.length - 1) {
                handleLearnNext()
              } else if (info.offset.x > 60 && learnIndex > 0) {
                handleLearnPrev()
              }
            }}
          >
            <AnimatePresence mode="wait">
              {!isFlipped ? (
                <motion.div
                  key="front"
                  initial={{ rotateY: -90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: 90, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex-1 flex flex-col"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <h2 className="text-3xl font-bold text-gradient">{currentWord.word}</h2>
                    <button
                      type="button"
                      onClick={speak}
                      className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                      aria-label="发音"
                    >
                      <Volume2 size={22} />
                    </button>
                  </div>
                  {currentWord.phonetic && (
                    <p className="text-gray-500 dark:text-gray-400 text-base text-center mb-4">{currentWord.phonetic}</p>
                  )}

                  <div className="text-center text-xs text-gray-400 dark:text-gray-500 mt-2">
                    点击「翻转」查看释义
                  </div>

                  <div className="mt-auto pt-5 text-center text-xs text-gray-400 dark:text-gray-500">
                    浏览模式 · 点击「掌握」标记此词,或用「上一个 / 下一个」切换
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="back"
                  initial={{ rotateY: 90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: -90, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex-1 flex flex-col"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200">{currentWord.word}</h2>
                  </div>

                  <div className="space-y-3 mt-2">
                    {(() => {
                      const defs = getDefinitions(currentWord)
                      if (defs.length > 0) {
                        return defs.map((d, i) => (
                          <div key={i} className="bg-gray-50 dark:bg-slate-700/60 rounded-xl p-3.5">
                            <div className="flex items-start gap-2">
                              {d.pos && (
                                <span className="text-xs font-medium text-primary-500 dark:text-primary-400 shrink-0 mt-0.5">
                                  {d.pos}
                                </span>
                              )}
                              <div className="flex-1">
                                {d.trans && (
                                  <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">{d.trans}</p>
                                )}
                                {d.def && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{d.def}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      }
                      // fallback
                      return (
                        <>
                          {currentWord.definition && (
                            <InfoBlock title="英文释义" content={currentWord.definition} />
                          )}
                          {currentWord.translation && (
                            <InfoBlock title="中文翻译" content={currentWord.translation} />
                          )}
                        </>
                      )
                    })()}
                    {currentWord.example && (
                      <InfoBlock title="例句" content={currentWord.example} highlight />
                    )}
                    {currentWord.notes && <InfoBlock title="笔记" content={currentWord.notes} />}
                  </div>

                  <div className="mt-auto pt-5 text-center text-xs text-gray-400 dark:text-gray-500">
                    点击「翻转」回到单词面
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* 测验模式:选择题 */}
        {mode === 'quiz' && currentQuiz && currentWord && (
          <motion.div
            key={currentWord.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="card flex-1 flex flex-col items-center justify-center p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-3xl font-bold text-gradient">{currentWord.word}</h2>
              <button
                type="button"
                onClick={speak}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                aria-label="发音"
              >
                <Volume2 size={20} />
              </button>
            </div>
            <p className="text-gray-500 dark:text-gray-400 mb-6">选择正确的中文释义</p>
            <div className="w-full max-w-sm space-y-2.5">
              {quizOptions.map((option) => {
                const primaryTrans = getPrimaryTranslation(currentWord)
                const isCorrect = option === primaryTrans
                const isSelected = selectedOption === option
                let btnClass =
                  'w-full text-left px-4 py-3 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all'
                if (quizRevealed) {
                  if (isCorrect)
                    btnClass =
                      'w-full text-left px-4 py-3 rounded-xl bg-gradient-success text-white shadow-glow'
                  else if (isSelected)
                    btnClass = 'w-full text-left px-4 py-3 rounded-xl bg-red-500 text-white'
                  else btnClass = 'w-full text-left px-4 py-3 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 opacity-50'
                } else if (isSelected) {
                  btnClass = 'w-full text-left px-4 py-3 rounded-xl bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700'
                }
                return (
                  <motion.button
                    key={option}
                    onClick={() => handleQuizSelect(option)}
                    disabled={quizRevealed}
                    className={btnClass}
                    whileTap={{ scale: 0.97 }}
                  >
                    {option}
                  </motion.button>
                )
              })}
            </div>
            {quizRevealed && selectedOption && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-center gap-2 text-sm"
              >
                {selectedOption === getPrimaryTranslation(currentWord) ? (
                  <span className="flex items-center gap-1 text-success-600">
                    <CheckCircle size={16} /> 答对了!
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-500">
                    <XCircle size={16} /> 答错了,这个词将再次出现
                  </span>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </div>

      {/* 掌握确认弹窗 */}
      {confirmMaster && currentWord && (
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
              单词: <span className="font-medium text-gray-700 dark:text-gray-200">{currentWord.word}</span>
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">
              标记后将加入已掌握列表,不再进入复习队列
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmMaster(false)} className="btn-secondary flex-1">
                取消
              </button>
              <button
                onClick={() => (mode === 'learn' ? handleLearnMaster() : handleQuizMaster())}
                className="btn-success flex-1"
              >
                确认掌握
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 测验开始确认弹窗 */}
      {confirmStartQuiz && (
        <div className="modal-overlay">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300 }}
            className="modal-content max-w-xs text-center"
          >
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Target size={28} className="text-white" />
            </div>
            <h3 className="font-bold text-lg mb-1 dark:text-gray-100">开始测验?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              共 <span className="font-medium text-gray-700 dark:text-gray-200">{learnQueue.length}</span> 个单词
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">
              答错的词会再次出现,直到连续答对方可通过
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmStartQuiz(false)}
                className="btn-secondary flex-1"
              >
                取消
              </button>
              <button onClick={confirmStartQuizNow} className="btn-primary flex-1">
                开始测验
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

function InfoBlock({
  title,
  content,
  highlight,
}: {
  title: string
  content: string
  highlight?: boolean
}) {
  return (
    <div className="bg-gray-50 dark:bg-slate-700/60 rounded-xl p-3.5">
      <div
        className={`text-xs font-medium mb-1 ${
          highlight ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'
        }`}
      >
        {title}
      </div>
      <p className={`text-sm ${highlight ? 'italic text-primary-700 dark:text-primary-300' : 'text-gray-800 dark:text-gray-200'}`}>
        {content}
      </p>
    </div>
  )
}
