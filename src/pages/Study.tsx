import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
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

type StudyMode = 'learn' | 'quiz'

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
  const [searchParams] = useSearchParams()
  const planId = searchParams.get('plan')
  const planIdNum = planId ? Number(planId) : null
  const initialMode = (searchParams.get('mode') as StudyMode) || 'learn'

  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [mode, setMode] = useState<StudyMode>(initialMode)

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

  useEffect(() => {
    startStudy()
    unlockTts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planIdNum])

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
      const reviewWords = await getTodayReviewWords(p)
      const newWords = await getTodayNewWords(p)
      items = [
        ...reviewWords.map((w) => ({ word: w, isReview: true })),
        ...newWords.map((w) => ({ word: w, isReview: false })),
      ]
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
  }

  // === 学习模式 ===
  const learnItem = learnQueue[learnIndex]
  const learnFinished = learnQueue.length > 0 && learnIndex >= learnQueue.length

  function handleLearnPrev() {
    setLearnIndex((i) => Math.max(0, i - 1))
  }
  function handleLearnNext() {
    setLearnIndex((i) => Math.min(learnQueue.length, i + 1))
  }

  async function handleLearnMaster() {
    if (!learnItem) return
    setConfirmMaster(false)
    const wordId = learnItem.word.id!
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
    // 掌握后从队列移除,直接进入下一个
    const next = learnQueue.filter((_, i) => i !== learnIndex)
    setLearnQueue(next)
    if (learnIndex >= next.length) {
      setLearnIndex(Math.max(0, next.length))
    }
  }

  // === 测验模式 ===
  // 切到测验时弹确认框
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
  }

  function confirmStartQuizNow() {
    setConfirmStartQuiz(false)
    const items: QuizItem[] = learnQueue.map((q) => ({
      ...q,
      wrongCount: 0,
      correctStreak: 0,
      requiredCorrect: 1,
    }))
    // 打乱顺序
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
    const all = await getRandomWords(30)
    const others = all
      .filter((w) => w.id !== word.id)
      .map((w) => w.translation)
      .filter(Boolean)
    const opts = [word.translation, ...others.slice(0, 3)].sort(() => Math.random() - 0.5)
    setQuizOptions(opts)
    setSelectedOption(null)
    setQuizRevealed(false)
  }

  async function handleQuizSelect(option: string) {
    if (quizRevealed || !currentQuiz) return
    setSelectedOption(option)
    setQuizRevealed(true)
    const correct = option === currentQuiz.word.translation
    const wordId = currentQuiz.word.id!

    if (correct) {
      // 写一次答题记录(SRS)
      await recordReview(wordId, 5)
      const newStreak = currentQuiz.correctStreak + 1
      if (newStreak >= currentQuiz.requiredCorrect) {
        // 通过
        setQuizStats((s) => ({ ...s, correct: s.correct + 1 }))
        if (planIdNum) {
          if (currentQuiz.isReview) {
            await markReviewDone(planIdNum)
            setLearnStats((s) => ({ ...s, reviewDone: s.reviewDone + 1 }))
          } else {
            await markWordStarted(planIdNum, wordId)
            setLearnStats((s) => ({ ...s, newDone: s.newDone + 1 }))
          }
        }
        setTimeout(() => {
          setQuizQueue((q) => q.slice(1))
          setSelectedOption(null)
          setQuizRevealed(false)
        }, 900)
      } else {
        // 还需再答对一次:放到队尾
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
      // 答错:写一次错题记录,requiredCorrect 提到 2,correctStreak 归零,放队尾
      await recordReview(wordId, 1)
      setQuizStats((s) => ({ ...s, wrong: s.wrong + 1 }))
      setTimeout(() => {
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
    setQuizQueue((q) => q.slice(1))
    setSelectedOption(null)
    setQuizRevealed(false)
  }

  // 测验完成检测
  useEffect(() => {
    if (quizStarted && !quizFinished && quizQueue.length === 0 && quizStats.total > 0) {
      setQuizFinished(true)
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

  if (learnQueue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 text-center">
        {planIdNum ? (
          <>
            <CheckCircle size={64} className="text-success-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">今日学习已完成!</h2>
            <p className="text-gray-500 mb-6">
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

  // 测验完成页
  if (mode === 'quiz' && quizFinished) {
    const accuracy = quizStats.total > 0 ? Math.round((quizStats.correct / quizStats.total) * 100) : 0
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-gradient-mesh">
        <div className="card p-8 max-w-sm w-full animate-scale-in">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-success flex items-center justify-center shadow-glow">
            <CheckCircle size={28} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-1">测验完成!</h2>
          <p className="text-gray-500 mb-5">共 {quizStats.total} 个单词</p>

          <div className="grid grid-cols-3 gap-2 mb-5">
            <div className="bg-success-50 rounded-xl p-3">
              <div className="text-2xl font-bold text-success-600">{quizStats.correct}</div>
              <div className="text-xs text-gray-500 mt-0.5">通过</div>
            </div>
            <div className="bg-red-50 rounded-xl p-3">
              <div className="text-2xl font-bold text-red-500">{quizStats.wrong}</div>
              <div className="text-xs text-gray-500 mt-0.5">出错</div>
            </div>
            <div className="bg-primary-50 rounded-xl p-3">
              <div className="text-2xl font-bold text-primary-600">{accuracy}%</div>
              <div className="text-xs text-gray-500 mt-0.5">正确率</div>
            </div>
          </div>

          <div className="flex gap-3">
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
            <button
              onClick={() => navigate(planIdNum ? '/plan' : '/')}
              className="btn-primary flex-1"
            >
              {planIdNum ? '返回计划' : '返回首页'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 学习模式完成(浏览到末尾)
  if (mode === 'learn' && learnFinished) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-gradient-mesh">
        <div className="card p-8 max-w-sm w-full animate-scale-in">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <GraduationCap size={28} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-1">学习完成!</h2>
          <p className="text-gray-500 mb-5">已浏览全部 {learnQueue.length + learnStats.newDone + learnStats.reviewDone} 个单词</p>

          {planIdNum && (learnStats.newDone > 0 || learnStats.reviewDone > 0) && (
            <div className="grid grid-cols-2 gap-2 mb-5">
              <div className="bg-primary-50 rounded-xl p-3">
                <div className="text-2xl font-bold text-primary-600">{learnStats.newDone}</div>
                <div className="text-xs text-gray-500 mt-0.5">新词掌握</div>
              </div>
              <div className="bg-accent-50 rounded-xl p-3">
                <div className="text-2xl font-bold text-accent-600">{learnStats.reviewDone}</div>
                <div className="text-xs text-gray-500 mt-0.5">复习掌握</div>
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
            {!quizStarted && (
              <button
                onClick={() => setConfirmStartQuiz(true)}
                className="btn-primary flex-1"
              >
                <Target size={16} className="mr-1" /> 开始测验
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const currentWord = mode === 'learn' ? learnItem?.word : currentQuiz?.word

  return (
    <div className="p-4 min-h-screen flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-xl">
          <ArrowLeft size={22} />
        </button>
        <div className="flex items-center gap-2">
          {planIdNum && plan && (
            <span className="chip bg-primary-50 text-primary-700">
              <Target size={11} /> {plan.name}
            </span>
          )}
          <span className="text-sm text-gray-500">
            {mode === 'learn'
              ? `${learnIndex + 1} / ${learnQueue.length}`
              : `${quizPassed} / ${quizTotal}`}
          </span>
        </div>
      </div>

      {/* 学习 / 测验 切换 */}
      <div className="flex gap-2 mb-3 p-1 bg-gray-100 rounded-xl">
        <button
          onClick={() => handleModeChange('learn')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === 'learn'
              ? 'bg-gradient-primary text-white shadow-glow'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <GraduationCap size={16} /> 学习
        </button>
        <button
          onClick={() => handleModeChange('quiz')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === 'quiz'
              ? 'bg-gradient-primary text-white shadow-glow'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Target size={16} /> 测验
        </button>
      </div>

      {/* 队列类型标签 */}
      {planIdNum && (
        <div className="flex justify-center mb-2">
          {((mode === 'learn' && learnItem?.isReview) ||
            (mode === 'quiz' && currentQuiz?.isReview)) ? (
            <span className="chip bg-accent-50 text-accent-600">
              <RefreshCw size={11} /> 复习
            </span>
          ) : (
            <span className="chip bg-primary-50 text-primary-600">
              <Sparkles size={11} /> 新词
            </span>
          )}
        </div>
      )}

      {/* 进度条 */}
      <div className="progress-track h-2 mb-3">
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
        <div className="flex items-center justify-center gap-1.5 mb-2 text-xs text-warn-600">
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
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border bg-white text-sm disabled:opacity-40 hover:bg-gray-50"
            >
              <ChevronLeft size={16} /> 上一个
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
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border bg-white text-sm disabled:opacity-40 hover:bg-gray-50"
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
        {/* 学习模式:纯浏览,展示全部信息 */}
        {mode === 'learn' && learnItem && currentWord && (
          <div className="card flex-1 flex flex-col p-6 animate-scale-in overflow-auto">
            <div className="flex items-center justify-center gap-3 mb-2">
              <h2 className="text-3xl font-bold">{currentWord.word}</h2>
              <button
                type="button"
                onClick={speak}
                className="p-2 hover:bg-gray-100 rounded-full"
                aria-label="发音"
              >
                <Volume2 size={22} />
              </button>
            </div>
            {currentWord.phonetic && (
              <p className="text-gray-500 text-base text-center mb-4">{currentWord.phonetic}</p>
            )}

            <div className="space-y-3 mt-2">
              {currentWord.definition && (
                <InfoBlock title="英文释义" content={currentWord.definition} />
              )}
              {currentWord.translation && (
                <InfoBlock title="中文翻译" content={currentWord.translation} />
              )}
              {currentWord.example && (
                <InfoBlock title="例句" content={currentWord.example} highlight />
              )}
              {currentWord.notes && <InfoBlock title="笔记" content={currentWord.notes} />}
            </div>

            <div className="mt-auto pt-5 text-center text-xs text-gray-400">
              浏览模式 · 点击「掌握」标记此词,或用「上一个 / 下一个」切换
            </div>
          </div>
        )}

        {/* 测验模式:选择题 */}
        {mode === 'quiz' && currentQuiz && currentWord && (
          <div className="card flex-1 flex flex-col items-center justify-center p-6 animate-scale-in">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-3xl font-bold">{currentWord.word}</h2>
              <button
                type="button"
                onClick={speak}
                className="p-2 hover:bg-gray-100 rounded-full"
                aria-label="发音"
              >
                <Volume2 size={20} />
              </button>
            </div>
            <p className="text-gray-500 mb-6">选择正确的中文释义</p>
            <div className="w-full max-w-sm space-y-2.5">
              {quizOptions.map((option) => {
                const isCorrect = option === currentWord.translation
                const isSelected = selectedOption === option
                let btnClass =
                  'w-full text-left px-4 py-3 rounded-xl border bg-white hover:bg-gray-50 transition-all'
                if (quizRevealed) {
                  if (isCorrect)
                    btnClass =
                      'w-full text-left px-4 py-3 rounded-xl bg-gradient-success text-white shadow-glow'
                  else if (isSelected)
                    btnClass = 'w-full text-left px-4 py-3 rounded-xl bg-red-500 text-white'
                  else btnClass = 'w-full text-left px-4 py-3 rounded-xl border bg-white opacity-50'
                } else if (isSelected) {
                  btnClass = 'w-full text-left px-4 py-3 rounded-xl bg-primary-50 border-primary-300'
                }
                return (
                  <button
                    key={option}
                    onClick={() => handleQuizSelect(option)}
                    disabled={quizRevealed}
                    className={btnClass}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
            {quizRevealed && selectedOption && (
              <div className="mt-4 flex items-center gap-2 text-sm">
                {selectedOption === currentWord.translation ? (
                  <span className="flex items-center gap-1 text-success-600">
                    <CheckCircle size={16} /> 答对了!
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-500">
                    <XCircle size={16} /> 答错了,这个词将再次出现
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 掌握确认弹窗 */}
      {confirmMaster && currentWord && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full text-center animate-scale-in">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-success flex items-center justify-center shadow-glow">
              <CheckCircle size={28} className="text-white" />
            </div>
            <h3 className="font-bold text-lg mb-1">标记为已掌握?</h3>
            <p className="text-sm text-gray-500 mb-1">
              单词: <span className="font-medium text-gray-700">{currentWord.word}</span>
            </p>
            <p className="text-xs text-gray-400 mb-5">
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
          </div>
        </div>
      )}

      {/* 测验开始确认弹窗 */}
      {confirmStartQuiz && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full text-center animate-scale-in">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Target size={28} className="text-white" />
            </div>
            <h3 className="font-bold text-lg mb-1">开始测验?</h3>
            <p className="text-sm text-gray-500 mb-1">
              共 <span className="font-medium text-gray-700">{learnQueue.length}</span> 个单词
            </p>
            <p className="text-xs text-gray-400 mb-5">
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
          </div>
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
    <div className="bg-gray-50 rounded-xl p-3.5">
      <div
        className={`text-xs font-medium mb-1 ${
          highlight ? 'text-primary-600' : 'text-gray-500'
        }`}
      >
        {title}
      </div>
      <p className={`text-sm ${highlight ? 'italic text-primary-700' : 'text-gray-800'}`}>
        {content}
      </p>
    </div>
  )
}
