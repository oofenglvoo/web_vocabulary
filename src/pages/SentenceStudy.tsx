import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Volume2,
  CheckCircle,
  Sparkles,
  Target,
  RefreshCw,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { db } from '../db/database'
import { getRandomSentences, recordSentenceReview, markSentenceLearned } from '../hooks/useSentences'
import {
  getTodayNewSentences,
  getTodayReviewSentences,
  markSentenceStarted,
  markSentenceReviewDone,
} from '../hooks/useSentencePlan'
import { Sentence, StudyPlan } from '../types/word'
import { speakWord, unlockTts } from '../utils/tts'
import { getSentencePrimaryTranslation } from '../utils/definitions'
import { BackButton } from '../components/BackButton'

interface QuizItem {
  sentence: Sentence
  isReview: boolean
  wrongCount: number
  correctStreak: number
  requiredCorrect: number
}

export function SentenceStudy() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const planId = searchParams.get('plan')
  const planIdNum = planId ? Number(planId) : null
  const isReviewMode = searchParams.get('mode') === 'review'

  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [quizQueue, setQuizQueue] = useState<QuizItem[]>([])
  const [quizOptions, setQuizOptions] = useState<string[]>([])
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [quizRevealed, setQuizRevealed] = useState(false)
  const [quizStats, setQuizStats] = useState({ correct: 0, wrong: 0, total: 0 })
  const [quizStarted, setQuizStarted] = useState(false)
  const [quizFinished, setQuizFinished] = useState(false)
  const [loading, setLoading] = useState(true)
  const [, setLearnStats] = useState({ newDone: 0, reviewDone: 0 })
  const [confirmMaster, setConfirmMaster] = useState(false)

  useEffect(() => {
    startStudy()
    unlockTts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planIdNum])

  async function startStudy() {
    setLoading(true)
    setLearnStats({ newDone: 0, reviewDone: 0 })
    let items: { sentence: Sentence; isReview: boolean }[] = []

    if (planIdNum) {
      const p = await db.studyPlans.get(planIdNum)
      if (!p) {
        setLoading(false)
        return
      }
      setPlan(p)

      if (isReviewMode) {
        const reviewSentences = await getTodayReviewSentences(p)
        items = reviewSentences.map((s) => ({ sentence: s, isReview: true }))
      } else {
        const reviewSentences = await getTodayReviewSentences(p)
        const newSentences = await getTodayNewSentences(p)
        items = [
          ...reviewSentences.map((s) => ({ sentence: s, isReview: true })),
          ...newSentences.map((s) => ({ sentence: s, isReview: false })),
        ]
      }
    } else {
      const sentences = await getRandomSentences(20)
      items = sentences.map((s) => ({ sentence: s, isReview: false }))
    }

    const quizItems: QuizItem[] = items.map((q) => ({
      ...q,
      wrongCount: 0,
      correctStreak: 0,
      requiredCorrect: 1,
    }))
    quizItems.sort(() => Math.random() - 0.5)
    setQuizQueue(quizItems)
    setQuizStarted(true)
    setQuizFinished(false)
    setQuizStats({ correct: 0, wrong: 0, total: quizItems.length })
    setLoading(false)
  }

  const currentQuiz = quizQueue[0]
  const quizTotal = quizStats.total
  const quizRemaining = quizQueue.length
  const quizPassed = quizTotal - quizRemaining

  useEffect(() => {
    if (currentQuiz) {
      prepareQuiz(currentQuiz.sentence)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuiz?.sentence.id])

  async function prepareQuiz(sentence: Sentence) {
    const primaryTrans = getSentencePrimaryTranslation(sentence)
    const all = await db.sentences.toArray()
    const others = all
      .filter((s) => s.id !== sentence.id)
      .map((s) => getSentencePrimaryTranslation(s))
      .filter((t) => t && t !== primaryTrans)
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
    const correct = option === getSentencePrimaryTranslation(currentQuiz.sentence)
    const sentenceId = currentQuiz.sentence.id!

    if (correct) {
      await recordSentenceReview(sentenceId, 5)
      const newStreak = currentQuiz.correctStreak + 1
      if (newStreak >= currentQuiz.requiredCorrect) {
        setQuizStats((s) => ({ ...s, correct: s.correct + 1 }))
        if (planIdNum) {
          if (currentQuiz.isReview) {
            await markSentenceReviewDone(planIdNum)
            setLearnStats((s) => ({ ...s, reviewDone: s.reviewDone + 1 }))
          } else {
            await markSentenceStarted(planIdNum, sentenceId)
            setLearnStats((s) => ({ ...s, newDone: s.newDone + 1 }))
          }
        }
        setTimeout(() => {
          setQuizQueue((q) => q.slice(1))
          setSelectedOption(null)
          setQuizRevealed(false)
        }, 900)
      } else {
        setTimeout(() => {
          setQuizQueue((q) => {
            const [head, ...rest] = q
            return [...rest, { ...head!, correctStreak: newStreak }]
          })
          setSelectedOption(null)
          setQuizRevealed(false)
        }, 900)
      }
    } else {
      await recordSentenceReview(sentenceId, 1)
      setQuizStats((s) => ({ ...s, wrong: s.wrong + 1 }))
      setTimeout(() => {
        setQuizQueue((q) => {
          const [head, ...rest] = q
          if (!head) return q
          return [
            ...rest,
            { ...head, wrongCount: head.wrongCount + 1, correctStreak: 0, requiredCorrect: 2 },
          ]
        })
        setSelectedOption(null)
        setQuizRevealed(false)
      }, 1200)
    }
  }

  async function handleMaster() {
    if (!currentQuiz) return
    setConfirmMaster(false)
    const sentenceId = currentQuiz.sentence.id!
    await markSentenceLearned(sentenceId)
    if (planIdNum) {
      if (currentQuiz.isReview) {
        await markSentenceReviewDone(planIdNum)
        setLearnStats((s) => ({ ...s, reviewDone: s.reviewDone + 1 }))
      } else {
        await markSentenceStarted(planIdNum, sentenceId)
        setLearnStats((s) => ({ ...s, newDone: s.newDone + 1 }))
      }
    }
    setQuizQueue((q) => q.slice(1))
    setSelectedOption(null)
    setQuizRevealed(false)
  }

  // 测验完成
  useEffect(() => {
    if (quizStarted && !quizFinished && quizQueue.length === 0 && quizStats.total > 0) {
      setQuizFinished(true)
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.7 },
        colors: ['#6366f1', '#8b5cf6', '#ec4899', '#10b981'],
      })
      setTimeout(() => {
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
    if (currentQuiz) speakWord(currentQuiz.sentence.sentence)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    )
  }

  // 无可学习内容
  if (quizQueue.length === 0 && quizStats.total === 0) {
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
            <h2 className="text-2xl font-bold mb-2">
              {isReviewMode ? '暂无待复习短句' : '今日学习已完成!'}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {plan?.name && `「${plan.name}」`}
              {isReviewMode ? '当前没有需要复习的短句' : '本日新短句与复习均已结束'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => navigate('/plan')} className="btn-secondary">
                <Target size={16} className="mr-1" /> 返回计划
              </button>
              {!isReviewMode && (
                <button
                  onClick={() => navigate(`/sentences/study?plan=${planIdNum}`)}
                  className="btn-primary"
                >
                  开始测验
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold mb-4">没有可学习的短句</h2>
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

  // 测验完成页
  if (quizFinished) {
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
          <p className="text-gray-500 dark:text-gray-400 mb-5">共 {quizStats.total} 条短句</p>

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
            {quizPassed} / {quizTotal}
          </span>
        </div>
      </div>

      {/* 复习模式标签 */}
      {isReviewMode && (
        <div className="flex justify-center mb-2">
          <span className="chip bg-accent-50 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400">
            <RefreshCw size={11} /> 复习测验
          </span>
        </div>
      )}

      {/* 队列类型标签 */}
      {planIdNum && !isReviewMode && currentQuiz?.isReview && (
        <div className="flex justify-center mb-2">
          <span className="chip bg-accent-50 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400">
            <RefreshCw size={11} /> 复习
          </span>
        </div>
      )}
      {planIdNum && !isReviewMode && currentQuiz && !currentQuiz.isReview && (
        <div className="flex justify-center mb-2">
          <span className="chip bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
            <Sparkles size={11} /> 新学
          </span>
        </div>
      )}

      {currentQuiz && (
        <div className="flex-1 flex flex-col max-w-lg mx-auto w-full">
          {/* 进度条 */}
          <div className="h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden mb-6">
            <motion.div
              className="h-full bg-gradient-primary rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${quizTotal > 0 ? (quizPassed / quizTotal) * 100 : 0}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* 题目卡片 */}
          <div className="card p-6 mb-6 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-gradient leading-relaxed">
                {currentQuiz.sentence.sentence}
              </h2>
              <button
                onClick={speak}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors shrink-0"
              >
                <Volume2 size={22} className="text-primary-500" />
              </button>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">选择正确的中文翻译</p>

            {currentQuiz.wrongCount > 0 && (
              <div className="flex items-center justify-center gap-1.5 mt-3 text-warn-600 dark:text-warn-400 text-xs">
                <AlertCircle size={13} />
                此句已错 {currentQuiz.wrongCount} 次,需连续答对 {currentQuiz.requiredCorrect} 次通过
              </div>
            )}
          </div>

          {/* 选项 */}
          <div className="space-y-3 flex-1">
            {quizOptions.map((option, idx) => {
              const isCorrect = quizRevealed && option === getSentencePrimaryTranslation(currentQuiz.sentence)
              const isWrong = quizRevealed && selectedOption === option && !isCorrect
              const dimmed = quizRevealed && !isCorrect && !isWrong

              return (
                <motion.button
                  key={idx}
                  whileTap={{ scale: quizRevealed ? 1 : 0.97 }}
                  onClick={() => handleQuizSelect(option)}
                  disabled={quizRevealed}
                  className={`w-full p-4 rounded-2xl text-left transition-all duration-300 border-2 ${
                    isCorrect
                      ? 'bg-success-50 dark:bg-success-900/30 border-success-300 dark:border-success-700'
                      : isWrong
                      ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700'
                      : dimmed
                      ? 'opacity-40 border-gray-100 dark:border-slate-700'
                      : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-700 active:scale-[0.98]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                        isCorrect
                          ? 'bg-success-500 text-white'
                          : isWrong
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {isCorrect ? (
                        <CheckCircle size={18} />
                      ) : isWrong ? (
                        <XCircle size={18} />
                      ) : (
                        String.fromCharCode(65 + idx)
                      )}
                    </div>
                    <span className="text-base font-medium dark:text-gray-200">{option}</span>
                  </div>
                </motion.button>
              )
            })}
          </div>

          {/* 底部操作 */}
          <div className="mt-6">
            {quizRevealed && selectedOption !== getSentencePrimaryTranslation(currentQuiz.sentence) && (
              <button
                onClick={() => setConfirmMaster(true)}
                className="w-full py-3 rounded-xl text-sm font-medium bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors mb-2"
              >
                标记为已掌握
              </button>
            )}
          </div>
        </div>
      )}

      {/* 掌握确认 */}
      {confirmMaster && (
        <div className="modal-overlay">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="modal-content max-w-xs text-center"
          >
            <h3 className="font-bold text-lg mb-2 dark:text-gray-100">标记为已掌握?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">掌握后将不再进入复习队列</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmMaster(false)} className="btn-secondary flex-1">
                取消
              </button>
              <button onClick={handleMaster} className="btn-primary flex-1">
                确认
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
