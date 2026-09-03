import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle, Sparkles, Target, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { db } from '../db/database'
import { getRandomSentences, recordSentenceReview, markSentenceLearned } from '../hooks/useSentences'
import {
  getTodayNewSentences,
  getTodayReviewSentences,
  getExtraNewSentences,
  markSentenceStarted,
  markExtraSentenceStarted,
  markSentenceReviewDone,
} from '../hooks/useSentencePlan'
import { Sentence, StudyPlan } from '../types/word'
import { speakWord, unlockTts } from '../utils/tts'
import { getSentencePrimaryTranslation, getSentenceDefinitions } from '../utils/definitions'
import { getStudyType } from '../utils/studyPrefs'
import { StudyItem } from '../components/study/types'
import { RecallMode } from '../components/study/RecallMode'
import { ChoiceMode } from '../components/study/ChoiceMode'
import { QuickMode, QuickRating } from '../components/study/QuickMode'
import { StudyTypeSettings } from '../components/StudyTypeSettings'
import { BackButton } from '../components/BackButton'
import { useToast } from '../components/Toast'

export function SentenceStudy() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const planId = searchParams.get('plan')
  const planIdNum = planId ? Number(planId) : null
  const isReviewMode = searchParams.get('mode') === 'review'
  // 加学模式:今日配额学满后的独立一轮,不计入今日配额
  const isExtra = searchParams.get('extra') === '1'

  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [queue, setQueue] = useState<StudyItem[]>([])
  const [index, setIndex] = useState(0)
  // 本轮初始条数(回忆式进度用)
  const [startTotal, setStartTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [learnStats, setLearnStats] = useState({ newDone: 0, reviewDone: 0 })
  const [confirmMaster, setConfirmMaster] = useState(false)
  const [done, setDone] = useState(false)
  // 题型版本号：切题型时递增，强制重渲染让 studyType 重新读 localStorage
  const [studyTypeVersion, setStudyTypeVersion] = useState(0)
  // 依赖 studyTypeVersion，切题型后重新读 localStorage
  const studyType = useMemo(
    () => getStudyType(isReviewMode),
    [studyTypeVersion, isReviewMode] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const [choiceDistractors, setChoiceDistractors] = useState<string[]>([])

  const allTranslationsRef = useRef<string[] | null>(null)
  const requeuedRef = useRef<Set<number>>(new Set())
  // 失败后需要连续确认；忘记的确认次数高于模糊。
  const recallProgressRef = useRef<Map<number, { level: 'fuzzy' | 'forgotten'; recognized: number }>>(new Map())

  useEffect(() => {
    // 组件卸载时无需清理(无 setInterval)；保留结构以对齐 Study.tsx
  }, [])


  useEffect(() => {
    startStudy()
    unlockTts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planIdNum, isReviewMode])

  function renderSentenceDefs(s: Sentence) {
    const defs = getSentenceDefinitions(s)
    return (
      <div className="space-y-3">
        {defs.length > 0 ? (
          defs.map((d, i) => (
            <div key={i} className="bg-gray-50 dark:bg-slate-700/60 rounded-xl p-3.5">
              {d.trans && (
                <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">{d.trans}</p>
              )}
              {d.def && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{d.def}</p>
              )}
            </div>
          ))
        ) : (
          s.translation && (
            <div className="bg-gray-50 dark:bg-slate-700/60 rounded-xl p-3.5">
              <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">{s.translation}</p>
            </div>
          )
        )}
        {s.example && (
          <div className="bg-gray-50 dark:bg-slate-700/60 rounded-xl p-3.5">
            <div className="text-xs font-medium text-primary-600 dark:text-primary-400 mb-1">用法说明</div>
            <p className="text-sm italic text-primary-700 dark:text-primary-300">{s.example}</p>
          </div>
        )}
        {s.notes && (
          <div className="bg-gray-50 dark:bg-slate-700/60 rounded-xl p-3.5">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">笔记</div>
            <p className="text-sm text-gray-800 dark:text-gray-200">{s.notes}</p>
          </div>
        )}
      </div>
    )
  }

  async function startStudy() {
    setLoading(true)
    setLearnStats({ newDone: 0, reviewDone: 0 })
    setDone(false)
    requeuedRef.current = new Set()
    recallProgressRef.current = new Map()
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
      } else if (isExtra) {
        // 加学:取一批新句,独立于今日配额
        const extraSentences = await getExtraNewSentences(p)
        items = extraSentences.map((s) => ({ sentence: s, isReview: false }))
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

    const studyItems: StudyItem[] = items.map(({ sentence, isReview }) => ({
      id: sentence.id!,
      isReview,
      title: sentence.sentence,
      phonetic: '',
      primaryTranslation: getSentencePrimaryTranslation(sentence),
      renderDefs: () => renderSentenceDefs(sentence),
    }))
    setQueue(studyItems)
    setStartTotal(studyItems.length)
    setIndex(0)
    setLoading(false)
  }

  const currentItem = queue[index]
  const total = queue.length

  const loadDistractors = async (current: StudyItem) => {
    if (allTranslationsRef.current === null) {
      const all = await db.sentences.toArray()
      allTranslationsRef.current = all.map((s) => getSentencePrimaryTranslation(s)).filter(Boolean)
    }
    const others = allTranslationsRef.current.filter((t) => t !== current.primaryTranslation)
    setChoiceDistractors([...new Set(others)].slice(0, 3))
  }

  useEffect(() => {
    if (studyType === 'choice' && currentItem) {
      loadDistractors(currentItem)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyType, currentItem?.id])

  async function handleRate(item: StudyItem, quality: number) {
    try {
      await recordSentenceReview(item.id, quality, 0, item.isReview ? 'review' : 'new')
    } catch (e) {
      toast('error', '记录失败: ' + (e as Error).message)
      return
    }
    // 回忆式(Moji)：认识(quality>=3) → 计数 + 从队列移除(通过不再出现)；模糊/忘记(quality<3) → 重排到队尾，重复直到认识
    if (studyType === 'recall') {
      if (quality < 3) {
        const previous = recallProgressRef.current.get(item.id)
        const level = previous?.level === 'forgotten' || quality === 1 ? 'forgotten' : 'fuzzy'
        recallProgressRef.current.set(item.id, { level, recognized: 0 })
        setQueue((q) => {
          const idx = q.findIndex((x) => x.id === item.id)
          if (idx === -1) return q
          return [...q.slice(0, idx), ...q.slice(idx + 1), item]
        })
        return // 不计数、不推进（当前词重排到队尾，下一个词自动顶到当前位置）
      }
      const recallProgress = recallProgressRef.current.get(item.id)
      if (recallProgress) {
        const required = recallProgress.level === 'forgotten' ? 3 : 2
        recallProgress.recognized += 1
        if (recallProgress.recognized < required) {
          setQueue((q) => {
            const idx = q.findIndex((x) => x.id === item.id)
            if (idx === -1) return q
            return [...q.slice(0, idx), ...q.slice(idx + 1), item]
          })
          return
        }
        recallProgressRef.current.delete(item.id)
      }
      if (planIdNum) {
        try {
          if (item.isReview) {
            await markSentenceReviewDone(planIdNum)
            setLearnStats((s) => ({ ...s, reviewDone: s.reviewDone + 1 }))
          } else if (isExtra) {
            await markExtraSentenceStarted(planIdNum, item.id)
            setLearnStats((s) => ({ ...s, newDone: s.newDone + 1 }))
          } else {
            await markSentenceStarted(planIdNum, item.id)
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
          await markSentenceReviewDone(planIdNum)
          setLearnStats((s) => ({ ...s, reviewDone: s.reviewDone + 1 }))
        } else if (isExtra) {
          await markExtraSentenceStarted(planIdNum, item.id)
          setLearnStats((s) => ({ ...s, newDone: s.newDone + 1 }))
        } else {
          await markSentenceStarted(planIdNum, item.id)
          setLearnStats((s) => ({ ...s, newDone: s.newDone + 1 }))
        }
      } catch (e) {
        toast('error', '记录失败: ' + (e as Error).message)
        return
      }
    }
    if (item.isReview && quality < 3 && !requeuedRef.current.has(item.id)) {
      requeuedRef.current.add(item.id)
      setQueue((q) => {
        const idx = q.findIndex((x) => x.id === item.id)
        if (idx === -1) return q
        return [...q.slice(0, idx), ...q.slice(idx + 1), item]
      })
      return
    }
    setIndex((i) => i + 1)
  }

  async function handleQuickSubmit(results: QuickRating[]): Promise<boolean> {
    for (const { item, quality, mastered } of results) {
      try {
        await recordSentenceReview(item.id, quality, 0, item.isReview ? 'review' : 'new')
        // "掌握" → 永久标记已掌握
        if (mastered) {
          await markSentenceLearned(item.id)
        }
      } catch (e) {
        toast('error', '记录失败: ' + (e as Error).message)
        return false
      }
      if (planIdNum) {
        try {
          if (item.isReview) {
            await markSentenceReviewDone(planIdNum)
            setLearnStats((s) => ({ ...s, reviewDone: s.reviewDone + 1 }))
          } else if (isExtra) {
            await markExtraSentenceStarted(planIdNum, item.id)
            setLearnStats((s) => ({ ...s, newDone: s.newDone + 1 }))
          } else {
            await markSentenceStarted(planIdNum, item.id)
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
      await markSentenceLearned(item.id)
      if (planIdNum) {
        if (item.isReview) {
          await markSentenceReviewDone(planIdNum)
          setLearnStats((s) => ({ ...s, reviewDone: s.reviewDone + 1 }))
        } else if (isExtra) {
          await markExtraSentenceStarted(planIdNum, item.id)
          setLearnStats((s) => ({ ...s, newDone: s.newDone + 1 }))
        } else {
          await markSentenceStarted(planIdNum, item.id)
          setLearnStats((s) => ({ ...s, newDone: s.newDone + 1 }))
        }
      }
    } catch (e) {
      toast('error', '操作失败: ' + (e as Error).message)
      return
    }
    setQueue((q) => q.filter((x) => x.id !== item.id))
    setIndex((i) => i + 1)
  }

  const speak = (item: StudyItem) => speakWord(item.title)

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
            {isReviewMode ? '暂无待复习短句' : '今日学习已完成!'}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-5">
            {plan?.name && `「${plan.name}」`}
            {isReviewMode ? '当前没有需要复习的内容' : '本日新短句与复习均已结束'}
          </p>
          <div className="flex gap-3">
            <button onClick={() => navigate('/plan')} className="btn-secondary flex-1">
              返回计划
            </button>
            {isReviewMode ? (
              <button
                onClick={() => navigate(`/sentences/study?plan=${planIdNum}`)}
                className="btn-primary flex-1"
              >
                去学习
              </button>
            ) : (
              <button onClick={() => navigate(-1)} className="btn-primary flex-1">
                返回
              </button>
            )}
          </div>
        </motion.div>
      </div>
    )
  }

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
          <p className="text-gray-500 dark:text-gray-400 mb-5">本轮共 {total} 条短句</p>

          {planIdNum && (learnStats.newDone > 0 || learnStats.reviewDone > 0) && (
            <div className="grid grid-cols-2 gap-2 mb-5">
              <div className="bg-primary-50 dark:bg-primary-900/30 rounded-xl p-3">
                <div className="text-2xl font-bold text-gradient">{learnStats.newDone}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">新句掌握</div>
              </div>
              <div className="bg-accent-50 dark:bg-accent-900/30 rounded-xl p-3">
                <div className="text-2xl font-bold text-accent-600">{learnStats.reviewDone}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">复习掌握</div>
              </div>
            </div>
          )}

          <button
            onClick={() => navigate(planIdNum ? '/plan' : '/')}
            className="btn-primary w-full"
          >
            {planIdNum ? '返回计划' : '返回首页'}
          </button>
        </motion.div>
      </div>
    )
  }

  // 回忆式进度 = 已完成(移除)数 / 本轮总数；其他模式 = index/total
  const progressPct =
    studyType === 'recall'
      ? Math.round(((startTotal - queue.length) / Math.max(startTotal, 1)) * 100)
      : Math.round(((index) / Math.max(total, 1)) * 100)

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
            entityType="sentence"
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
            entityType="sentence"
          />
        )}
        {studyType === 'quick' && (
          <QuickMode
            key={`quick-${studyType}-${queue.length}`}
            items={queue}
            onRateAll={handleQuickSubmit}
            onSpeak={speak}
            entityType="sentence"
          />
        )}
      </div>

      {/* 掌握确认弹窗 */}
      {confirmMaster && currentItem && (
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
              <button onClick={() => handleMaster(currentItem)} className="btn-primary flex-1">
                确认
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
