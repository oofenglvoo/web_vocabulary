import { useLiveQuery } from 'dexie-react-hooks'
import { ReactNode } from 'react'
import { db } from '../db/database'
import {
  Word,
  JapaneseWord,
  JapaneseStudyPlan,
  Category,
  FavoriteFolder,
  FavoriteItem,
  StudyPlan,
  StudyKind,
  Flag,
  StudySession,
} from '../types/word'
import { useLang, getCurrentLang } from '../context/Language'
import { NotesBlock } from '../components/NotesBlock'
import { LANG_SESSION_TYPES, useStats } from './useWords'
import { useAllWords, useDueCount, useDueWords, useWordsByCategory, useFavoriteWords } from './useWords'
import {
  deleteWord,
  bulkDeleteWords,
  bulkSetCategory,
  bulkSetFavorite,
  toggleFavorite,
  recordReview,
  markWordLearned,
  unmarkWordLearned,
  getRandomWords,
  addCategory,
  DuplicateCategoryError,
} from './useWords'
import {
  useAllJapaneseWords,
  useJapaneseWord,
  useJapaneseDueWords,
  useJapaneseDueCount,
  deleteJapaneseWord,
  bulkDeleteJapaneseWords,
  bulkSetJapaneseWordCategory,
  bulkSetJapaneseWordFavorite,
  recordJapaneseReview,
  markJapaneseWordLearned,
  unmarkJapaneseWordLearned,
  getRandomJapaneseWords,
  updateJapaneseWord,
} from './useJapaneseWords'
import {
  useActivePlan,
  useAllPlans,
  usePlanById,
  usePlanWords,
  usePlanProgress,
  PlanProgress,
  createPlan,
  activatePlan,
  archivePlan,
  deletePlan,
  updatePlanSettings,
  refreshPlanWords,
  getPlanNewWordCount,
  getTodayNewWords,
  getExtraNewWords,
  getTodayReviewWords,
  markWordStarted,
  markExtraWordStarted,
  markReviewDone,
  markPlanWordLearned,
  ensureTodayReset,
  isTodayNewQuotaDone,
} from './useStudyPlan'
import {
  useActiveJapaneseStudyPlan,
  useAllJapanesePlans,
  useJapanesePlanById,
  useJapanesePlanWords,
  useJapanesePlanProgress,
  createJapaneseStudyPlan,
  activateJapaneseStudyPlan,
  archiveJapaneseStudyPlan,
  deleteJapaneseStudyPlan,
  updateJapaneseStudyPlanSettings,
  refreshJapanesePlanWords,
  getJapanesePlanNewWordCount,
  getTodayJapaneseNewWords,
  getExtraJapaneseNewWords,
  getTodayJapaneseReviewWords,
  markJapaneseWordStarted,
  markExtraJapaneseWordStarted,
  markJapaneseReviewDone,
  markJapanesePlanWordLearned,
  ensureJapaneseTodayReset,
  isTodayJapaneseNewQuotaDone,
} from './useJapaneseStudyPlan'
import {
  useFavoriteFolders,
  useEntityFolderIds,
  useFolderMembers,
  createFolder,
  renameFolder,
  updateFolderColor,
  deleteFolder,
  setItemFolders,
  ensureDefaultFolder,
  useJapaneseFavoriteFolders,
  useJapaneseFolderMembers,
  createJapaneseFavoriteFolder,
  renameJapaneseFavoriteFolder,
  updateJapaneseFavoriteFolderColor,
  deleteJapaneseFavoriteFolder,
  setJapaneseItemFolders,
  ensureJapaneseDefaultFolder,
} from './useFavorites'
import { getDefinitions, getPrimaryTranslation } from '../utils/definitions'
import { StudyItem } from '../components/study/types'

// ================== 通用类型 ==================

/** 当前语言的词条：英语 Word 或日语 JapaneseWord */
export type LangWord = Word | JapaneseWord
/** 日语计划与 StudyPlan 结构兼容（缺省 entityType 视为 'word'），统一以 StudyPlan 消费 */
export type LangPlan = StudyPlan

export function isJaWord(w: LangWord): w is JapaneseWord {
  return 'reading' in w
}

const ja = (): boolean => getCurrentLang() === 'ja'

// ================== 词条读取 ==================

export function useLangWords(): LangWord[] {
  const lang = useLang()
  const en = useAllWords()
  const jaWords = useAllJapaneseWords()
  return lang === 'ja' ? jaWords : en
}

export function useLangWordById(id: number): LangWord | undefined {
  const lang = useLang()
  const en = useLiveQuery(() => db.words.get(id), [id])
  const jaWord = useJapaneseWord(id)
  return lang === 'ja' ? jaWord : en
}

export function useLangWordsByCategory(category: string): LangWord[] {
  const lang = useLang()
  const en = useWordsByCategory(category)
  const jaWords =
    useLiveQuery(() => db.japaneseWords.where('category').equals(category).toArray(), [category]) ?? []
  return lang === 'ja' ? jaWords : en
}

export function useLangFavoriteWords(): LangWord[] {
  const lang = useLang()
  const en = useFavoriteWords()
  const jaWords = useLiveQuery(() => db.japaneseWords.where('isFavorite').equals(1).toArray(), []) ?? []
  return lang === 'ja' ? jaWords : en
}

export function useLangDueWords(): LangWord[] {
  const lang = useLang()
  const en = useDueWords()
  const jaWords = useJapaneseDueWords()
  return lang === 'ja' ? jaWords : en
}

export function useLangDueCount(): number {
  const lang = useLang()
  const en = useDueCount()
  const jaCount = useJapaneseDueCount()
  return lang === 'ja' ? jaCount : en
}

/** 语言分组的统计（词条数按语言表；会话按语言实体类型过滤） */
export function useLangStats() {
  const lang = useLang()
  const total = useLiveQuery(() => (lang === 'ja' ? db.japaneseWords.count() : db.words.count()), [lang]) ?? 0
  const learned =
    useLiveQuery(
      () => (lang === 'ja' ? db.japaneseWords.where('isLearned').equals(1).count() : db.words.where('isLearned').equals(1).count()),
      [lang]
    ) ?? 0
  const due = useLangDueCount()
  const sessions = useStats(LANG_SESSION_TYPES[lang])
  return {
    total,
    learned,
    due,
    todayTotal: sessions.todayTotal,
    todayCorrect: sessions.todayCorrect,
    weekTotal: sessions.weekTotal,
    weekCorrect: sessions.weekCorrect,
    streak: sessions.streak,
  }
}

// ================== 词条写入 ==================

export async function deleteLangWord(id: number) {
  return ja() ? deleteJapaneseWord(id) : deleteWord(id)
}

export async function bulkDeleteLangWords(ids: number[]) {
  return ja() ? bulkDeleteJapaneseWords(ids) : bulkDeleteWords(ids)
}

export async function bulkSetLangCategory(ids: number[], category: string) {
  return ja() ? bulkSetJapaneseWordCategory(ids, category) : bulkSetCategory(ids, category)
}

export async function bulkSetLangFavorite(ids: number[], favorite: boolean) {
  return ja() ? bulkSetJapaneseWordFavorite(ids, favorite) : bulkSetFavorite(ids, favorite)
}

/** 一键收藏/取消（旧语义：默认夹单目录快速收藏） */
export async function toggleLangFavorite(id: number, current: Flag) {
  if (ja()) {
    if (current) {
      await setJapaneseItemFolders(id, [])
    } else {
      const def = await ensureJapaneseDefaultFolder()
      await setJapaneseItemFolders(id, [def.id!])
    }
    return
  }
  return toggleFavorite(id, current)
}

export async function recordLangReview(id: number, quality: number, durationMs = 0, kind: StudyKind = 'review') {
  return ja() ? recordJapaneseReview(id, quality, durationMs, kind) : recordReview(id, quality, durationMs, kind)
}

export async function markLangWordLearned(id: number) {
  return ja() ? markJapaneseWordLearned(id) : markWordLearned(id)
}

export async function unmarkLangWordLearned(id: number) {
  return ja() ? unmarkJapaneseWordLearned(id) : unmarkWordLearned(id)
}

export async function getRandomLangWords(limit: number): Promise<LangWord[]> {
  return ja() ? getRandomJapaneseWords(limit) : getRandomWords(limit)
}

export async function updateLangWord(id: number, changes: Partial<Word> | Partial<JapaneseWord>) {
  if (ja()) return updateJapaneseWord(id, changes as Partial<JapaneseWord>)
  return db.words.update(id, changes as Partial<Word>)
}

// ================== 学习条目映射 ==================

/** 首选中文翻译（两语言通用，用于选择题/卡片摘要） */
export function getLangPrimaryTranslation(w: LangWord): string {
  if (isJaWord(w)) {
    return w.definitions?.find((d) => d.translation)?.translation ?? w.definitions?.[0]?.translation ?? ''
  }
  return getPrimaryTranslation(w)
}

function renderJaDefs(w: JapaneseWord): ReactNode {
  return (
    <div className="space-y-3">
      <div className="bg-primary-50 dark:bg-primary-900/30 rounded-xl p-3.5">
        <div className="text-xs text-primary-600 dark:text-primary-400 mb-1">假名{w.accent ? ' · 音调' : ''}</div>
        <p className="text-base font-medium dark:text-gray-100">
          {w.reading}
          {w.accent && <span className="ml-2 text-rose-600 dark:text-rose-300">{w.accent}</span>}
        </p>
      </div>
      {w.definitions?.map((d, i) => (
        <div key={i} className="bg-gray-50 dark:bg-slate-700/60 rounded-xl p-3.5">
          {d.pos && <div className="text-xs text-primary-500 mb-1">{d.pos}</div>}
          <p className="text-sm font-medium dark:text-gray-200">{d.translation}</p>
          {d.meaning && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{d.meaning}</p>}
        </div>
      ))}
      {w.example && (
        <div className="bg-gray-50 dark:bg-slate-700/60 rounded-xl p-3.5">
          <div className="text-xs font-medium text-primary-600 dark:text-primary-400 mb-1">例句</div>
          <p className="text-sm dark:text-gray-200">{w.example}</p>
          {w.exampleReading && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{w.exampleReading}</p>}
          {w.exampleTranslation && <p className="text-sm text-primary-700 dark:text-primary-300 mt-1">{w.exampleTranslation}</p>}
        </div>
      )}
      <NotesBlock notes={w.notes} onSave={async (n) => { await updateLangWord(w.id!, { notes: n }) }} />
    </div>
  )
}

function renderEnDefs(w: Word): ReactNode {
  const defs = getDefinitions(w)
  return (
    <>
      <div className="space-y-3">
        {defs.length > 0 ? (
          defs.map((d, i) => (
            <div key={i} className="bg-gray-50 dark:bg-slate-700/60 rounded-xl p-3.5">
              <div className="flex items-start gap-2">
                {d.pos && (
                  <span className="text-xs font-medium text-primary-500 dark:text-primary-400 shrink-0 mt-0.5">{d.pos}</span>
                )}
                <div className="flex-1">
                  {d.trans && <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">{d.trans}</p>}
                  {d.def && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{d.def}</p>}
                </div>
              </div>
            </div>
          ))
        ) : (
          <>
            {w.definition && <InfoBlock title="释义" content={w.definition} />}
            {w.translation && <InfoBlock title="中文翻译" content={w.translation} />}
          </>
        )}
      </div>
      {w.example && <InfoBlock title="例句" content={w.example} highlight />}
      {w.notes && <InfoBlock title="笔记" content={w.notes} />}
    </>
  )
}

function InfoBlock({ title, content, highlight }: { title: string; content: string; highlight?: boolean }) {
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

/** 词条 → 学习会话条目（英语：音标槽；日语：假名放音标槽） */
export function toLangStudyItem(w: LangWord, isReview: boolean): StudyItem {
  if (isJaWord(w)) {
    return {
      id: w.id!,
      isReview,
      title: w.word,
      phonetic: w.reading,
      notes: w.notes,
      primaryTranslation: getLangPrimaryTranslation(w),
      renderDefs: () => renderJaDefs(w),
    }
  }
  return {
    id: w.id!,
    isReview,
    title: w.word,
    phonetic: w.phonetic,
    notes: w.notes,
    primaryTranslation: getPrimaryTranslation(w),
    renderDefs: () => renderEnDefs(w),
  }
}

/** 选择题干扰项候选翻译池（按当前语言的词库构建） */
export async function getLangAllTranslations(): Promise<string[]> {
  if (ja()) {
    const all = await db.japaneseWords.toArray()
    return all.flatMap((w) => w.definitions?.map((d) => d.translation) ?? []).filter(Boolean)
  }
  const all = await db.words.toArray()
  return all.map((w) => getPrimaryTranslation(w)).filter(Boolean)
}

// ================== 学习计划 ==================

export function useLangActivePlan(): LangPlan | undefined {
  const lang = useLang()
  const en = useActivePlan()
  const jaPlan = useActiveJapaneseStudyPlan()
  return lang === 'ja' ? (jaPlan as LangPlan | undefined) : en
}

export function useLangAllPlans(): LangPlan[] {
  const lang = useLang()
  const en = useAllPlans()
  const jaPlans = useAllJapanesePlans()
  return lang === 'ja' ? (jaPlans as LangPlan[]) : en
}

export function useLangPlanById(id: number): LangPlan | undefined {
  const lang = useLang()
  const en = usePlanById(id)
  const jaPlan = useJapanesePlanById(id)
  return lang === 'ja' ? (jaPlan as LangPlan | undefined) : en
}

export function useLangPlanWords(plan: LangPlan | undefined): LangWord[] {
  const lang = useLang()
  const en = usePlanWords(plan)
  const jaWords = useJapanesePlanWords(plan as JaPlan | undefined)
  return lang === 'ja' ? jaWords : en
}

// japaneseWords 版 hook/函数接受 JapaneseStudyPlan；LangPlan 结构兼容
type JaPlan = JapaneseStudyPlan

export function useLangPlanProgress(plan: LangPlan | undefined): PlanProgress {
  const lang = useLang()
  const en = usePlanProgress(plan)
  const jaProgress = useJapanesePlanProgress(plan as JaPlan | undefined)
  return lang === 'ja' ? jaProgress : en
}

export async function getLangPlan(id: number): Promise<LangPlan | undefined> {
  return ja() ? ((await db.japaneseStudyPlans.get(id)) as LangPlan | undefined) : db.studyPlans.get(id)
}

export async function createLangPlan(input: {
  name: string
  sourceKind: 'category' | 'favorites' | 'all'
  sourceCategory?: string
  newPerDay: number
  reviewPerDay: number
}): Promise<number> {
  return ja() ? createJapaneseStudyPlan(input) : createPlan(input)
}

export async function activateLangPlan(id: number) {
  return ja() ? activateJapaneseStudyPlan(id) : activatePlan(id)
}

export async function archiveLangPlan(id: number) {
  return ja() ? archiveJapaneseStudyPlan(id) : archivePlan(id)
}

export async function deleteLangPlan(id: number) {
  return ja() ? deleteJapaneseStudyPlan(id) : deletePlan(id)
}

export async function updateLangPlanSettings(id: number, changes: { name?: string; newPerDay?: number; reviewPerDay?: number }) {
  return ja() ? updateJapaneseStudyPlanSettings(id, changes) : updatePlanSettings(id, changes)
}

export async function refreshLangPlanWords(id: number): Promise<number> {
  return ja() ? refreshJapanesePlanWords(id) : refreshPlanWords(id)
}

export async function getLangPlanNewWordCount(id: number): Promise<number> {
  return ja() ? getJapanesePlanNewWordCount(id) : getPlanNewWordCount(id)
}

export async function getLangTodayNewWords(plan: LangPlan): Promise<LangWord[]> {
  return ja() ? getTodayJapaneseNewWords(plan as JaPlan) : getTodayNewWords(plan)
}

export async function getLangExtraNewWords(plan: LangPlan): Promise<LangWord[]> {
  return ja() ? getExtraJapaneseNewWords(plan as JaPlan) : getExtraNewWords(plan)
}

export async function getLangTodayReviewWords(plan: LangPlan): Promise<LangWord[]> {
  return ja() ? getTodayJapaneseReviewWords(plan as JaPlan) : getTodayReviewWords(plan)
}

export async function markLangWordStarted(planId: number, wordId: number) {
  return ja() ? markJapaneseWordStarted(planId, wordId) : markWordStarted(planId, wordId)
}

export async function markLangExtraWordStarted(planId: number, wordId: number) {
  return ja() ? markExtraJapaneseWordStarted(planId, wordId) : markExtraWordStarted(planId, wordId)
}

export async function markLangReviewDone(planId: number) {
  return ja() ? markJapaneseReviewDone(planId) : markReviewDone(planId)
}

/** 在计划上下文中把词条标记为已掌握（区分新词/复习计数） */
export async function markLangPlanWordLearned(planId: number, wordId: number, wasReview: boolean) {
  return ja()
    ? markJapanesePlanWordLearned(planId, wordId, wasReview)
    : markPlanWordLearned(planId, wordId, wasReview)
}

/** 跨日重置今日计数（读取时调用） */
export async function ensureLangTodayReset(planId: number) {
  return ja() ? ensureJapaneseTodayReset(planId) : ensureTodayReset(planId)
}

export function isLangTodayNewQuotaDone(plan: LangPlan): boolean {
  return ja() ? isTodayJapaneseNewQuotaDone(plan as JaPlan) : isTodayNewQuotaDone(plan)
}

// ================== 收藏夹 ==================

export function useLangFavoriteFolders(): FavoriteFolder[] {
  const lang = useLang()
  const en = useFavoriteFolders()
  const jaFolders = useJapaneseFavoriteFolders()
  return lang === 'ja' ? (jaFolders as FavoriteFolder[]) : en
}

export function useLangEntityFolderIds(entityId: number | undefined, entityType: 'word' | 'sentence' = 'word'): number[] {
  const lang = useLang()
  const en = useEntityFolderIds(entityType, entityId)
  const jaIds = useLiveQuery(
    async () =>
      entityId == null
        ? []
        : (await db.japaneseFavoriteItems.toArray()).filter((item) => item.entityId === entityId).map((item) => item.folderId),
    [entityId]
  ) ?? []
  return lang === 'ja' ? jaIds : en
}

export function useLangFolderMembers(folderId: number | 'all'): FavoriteItem[] {
  const lang = useLang()
  const en = useFolderMembers(folderId)
  const jaMembers = useJapaneseFolderMembers(folderId)
  return lang === 'ja' ? (jaMembers as FavoriteItem[]) : en
}

export async function createLangFolder(name: string, color: string): Promise<number> {
  return ja() ? createJapaneseFavoriteFolder(name, color) : createFolder(name, color)
}

export async function renameLangFolder(id: number, name: string) {
  return ja() ? renameJapaneseFavoriteFolder(id, name) : renameFolder(id, name)
}

export async function updateLangFolderColor(id: number, color: string) {
  return ja() ? updateJapaneseFavoriteFolderColor(id, color) : updateFolderColor(id, color)
}

export async function deleteLangFolder(id: number) {
  return ja() ? deleteJapaneseFavoriteFolder(id) : deleteFolder(id)
}

export async function setLangItemFolders(
  entityId: number,
  targetFolderIds: number[],
  entityType: 'word' | 'sentence' = 'word'
): Promise<{ added: number; removed: number }> {
  return ja()
    ? setJapaneseItemFolders(entityId, targetFolderIds)
    : setItemFolders(entityType, entityId, targetFolderIds)
}

export async function ensureLangDefaultFolder(): Promise<FavoriteFolder> {
  return ja() ? (ensureJapaneseDefaultFolder() as Promise<FavoriteFolder>) : ensureDefaultFolder()
}

// ================== 分类 ==================

export function useLangCategories(): Category[] {
  const lang = useLang()
  return (
    useLiveQuery(async () => {
      const cats = await db.categories.toArray()
      return cats.filter((c) => (c.lang ?? 'en') === lang)
    }, [lang]) ?? []
  )
}

export interface LangCategoryStat extends Category {
  wordCount: number
  sentenceCount: number
}

/** 语言维度的分类统计：en 计 words+sentences；ja 计 japaneseWords */
export function useLangCategoryStats(): LangCategoryStat[] {
  const lang = useLang()
  return (
    useLiveQuery(async () => {
      const cats = await db.categories.toArray()
      const scoped = cats.filter((c) => (c.lang ?? 'en') === lang)
      if (lang === 'ja') {
        const [jaWords, jaCats] = await Promise.all([
          db.japaneseWords.toArray(),
          Promise.resolve(scoped),
        ])
        const counts: Record<string, number> = {}
        for (const w of jaWords) counts[w.category] = (counts[w.category] ?? 0) + 1
        return jaCats.map((c) => ({ ...c, wordCount: counts[c.name] ?? 0, sentenceCount: 0 }))
      }
      const [words, sentences] = await Promise.all([db.words.toArray(), db.sentences.toArray()])
      const wordCounts: Record<string, number> = {}
      for (const w of words) wordCounts[w.category] = (wordCounts[w.category] ?? 0) + 1
      const sentenceCounts: Record<string, number> = {}
      for (const s of sentences) sentenceCounts[s.category] = (sentenceCounts[s.category] ?? 0) + 1
      return scoped.map((c) => ({
        ...c,
        wordCount: wordCounts[c.name] ?? 0,
        sentenceCount: sentenceCounts[c.name] ?? 0,
      }))
    }, [lang]) ?? []
  )
}

export { DuplicateCategoryError }

/** 新建分类：自动归属当前语言 */
export async function addLangCategory(
  name: string,
  description = '',
  color = '#8b5cf6',
  entityType?: 'word' | 'sentence'
): Promise<number> {
  const lang = getCurrentLang()
  return addCategory(name, description, color, entityType, lang) as Promise<number>
}

/** 分类下当前语言的词条数（空态/删除确认用） */
export async function countLangWordsInCategory(name: string): Promise<number> {
  if (ja()) return db.japaneseWords.where('category').equals(name).count()
  const [words, sentences] = await Promise.all([
    db.words.where('category').equals(name).count(),
    db.sentences.where('category').equals(name).count(),
  ])
  return words + sentences
}

// ================== 学习会话（统计/打卡用） ==================

export function useLangSessionTypes(): StudySession['entityType'][] {
  const lang = useLang()
  return LANG_SESSION_TYPES[lang]
}

/** 供 CheckIn 等按语言过滤会话使用 */
export function langSessionFilter(s: Pick<StudySession, 'entityType'>): boolean {
  return LANG_SESSION_TYPES[getCurrentLang()].includes(s.entityType)
}
