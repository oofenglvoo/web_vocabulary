import Dexie, { Table } from 'dexie'
import { Word, Category, StudySession, StudyPlan, Sentence, Definition, FavoriteFolder, FavoriteItem, JapaneseWord, JapaneseFavoriteFolder, JapaneseFavoriteItem, JapaneseStudyPlan } from '../types/word'

class VocabularyDatabase extends Dexie {
  words!: Table<Word>
  sentences!: Table<Sentence>
  japaneseWords!: Table<JapaneseWord>
  categories!: Table<Category>
  studySessions!: Table<StudySession>
  studyPlans!: Table<StudyPlan>
  favoriteFolders!: Table<FavoriteFolder>
  favoriteItems!: Table<FavoriteItem>
  japaneseFavoriteFolders!: Table<JapaneseFavoriteFolder>
  japaneseFavoriteItems!: Table<JapaneseFavoriteItem>
  japaneseStudyPlans!: Table<JapaneseStudyPlan>

  constructor() {
    super('VocabularyDB_v2')
    this.version(2).stores({
      words: '++id, word, category, nextReviewAt, isLearned, isFavorite, createdAt',
      categories: '++id, name',
      studySessions: '++id, wordId, timestamp',
    })
    this.version(3).stores({
      words: '++id, word, category, nextReviewAt, isLearned, isFavorite, createdAt',
      categories: '++id, name',
      studySessions: '++id, wordId, timestamp',
      studyPlans: '++id, name, sourceKind, isActive, isArchived, createdAt',
    })
    // 新增 sentences 表 + studyPlans 增加 entityType 索引(用于区分单词/短句计划)
    this.version(4).stores({
      words: '++id, word, category, nextReviewAt, isLearned, isFavorite, createdAt',
      sentences: '++id, sentence, category, nextReviewAt, isLearned, isFavorite, createdAt',
      categories: '++id, name',
      studySessions: '++id, wordId, timestamp',
      studyPlans: '++id, name, sourceKind, isActive, isArchived, entityType, createdAt',
    })
    // 新增 definitions 字段：将旧 definition/translation 迁移为结构化数组
    this.version(5).stores({
      words: '++id, word, category, nextReviewAt, isLearned, isFavorite, createdAt',
      sentences: '++id, sentence, category, nextReviewAt, isLearned, isFavorite, createdAt',
      categories: '++id, name',
      studySessions: '++id, wordId, timestamp',
      studyPlans: '++id, name, sourceKind, isActive, isArchived, entityType, createdAt',
    }).upgrade(async (tx) => {
      // 迁移单词表（必须 await，否则 Dexie 会在事务提交前返回导致迁移未完成）
      const wordTable = tx.table<Word>('words')
      await wordTable.toCollection().modify((word) => {
        if (!word.definitions || word.definitions.length === 0) {
          const defs: Definition[] = []
          if (word.definition || word.translation) {
            defs.push({
              pos: '',
              def: word.definition ?? '',
              trans: word.translation ?? '',
            })
          }
          if (defs.length > 0) {
            word.definitions = defs
          }
        }
      })
      // 迁移短句表
      const sentenceTable = tx.table<Sentence>('sentences')
      await sentenceTable.toCollection().modify((s) => {
        if (!s.definitions || s.definitions.length === 0) {
          if (s.translation) {
            s.definitions = [{ pos: '', def: '', trans: s.translation }]
          }
        }
      })
    })
    // v6: 艾宾浩斯 7 周期制。words/sentences 增加 srsStage/stageProgress；
    //     studySessions 增加 kind('new'|'review') 区分新学/复习(打卡双圈用)。
    //     srsStage: 0=未学, 1-6=学习中周期, 7=已掌握；stageProgress=当前周期内连续答对数
    this.version(6).stores({
      words: '++id, word, category, nextReviewAt, isLearned, isFavorite, createdAt, srsStage',
      sentences: '++id, sentence, category, nextReviewAt, isLearned, isFavorite, createdAt, srsStage',
      categories: '++id, name',
      studySessions: '++id, wordId, timestamp, kind',
      studyPlans: '++id, name, sourceKind, isActive, isArchived, entityType, createdAt',
    }).upgrade(async (tx) => {
      // 老数据映射: 已掌握 → 周期 7；有复习记录 → 周期 1；否则未学
      await tx.table('words').toCollection().modify((w: any) => {
        if (w.isLearned === 1) w.srsStage = 7
        else if (w.reviewCount > 0) w.srsStage = 1
        else w.srsStage = 0
        w.stageProgress = 0
      })
      await tx.table('sentences').toCollection().modify((s: any) => {
        if (s.isLearned === 1) s.srsStage = 7
        else if (s.reviewCount > 0) s.srsStage = 1
        else s.srsStage = 0
        s.stageProgress = 0
      })
      // 旧会话记录统一视为复习
      await tx.table('studySessions').toCollection().modify((s: any) => {
        if (!s.kind) s.kind = 'review'
      })
    })
    // v7: 计划增加 todayExtraDone(今日加学完成数),用于统计显示"配额内+加学"总数。
    //     已有计划的 todayExtraDone 默认补 0。
    this.version(7).stores({
      words: '++id, word, category, nextReviewAt, isLearned, isFavorite, createdAt, srsStage',
      sentences: '++id, sentence, category, nextReviewAt, isLearned, isFavorite, createdAt, srsStage',
      categories: '++id, name',
      studySessions: '++id, wordId, timestamp, kind',
      studyPlans: '++id, name, sourceKind, isActive, isArchived, entityType, createdAt',
    }).upgrade(async (tx) => {
      await tx.table('studyPlans').toCollection().modify((p: any) => {
        if (typeof p.todayExtraDone !== 'number') p.todayExtraDone = 0
      })
    })
    // v8: 学习会话区分单词/短句，避免两个表的自增 ID 冲突。
    this.version(8).stores({
      words: '++id, word, category, nextReviewAt, isLearned, isFavorite, createdAt, srsStage',
      sentences: '++id, sentence, category, nextReviewAt, isLearned, isFavorite, createdAt, srsStage',
      categories: '++id, name',
      studySessions: '++id, wordId, entityId, entityType, timestamp, kind',
      studyPlans: '++id, name, sourceKind, isActive, isArchived, entityType, createdAt',
    }).upgrade(async (tx) => {
      // v7 之前只有单词学习会话；短句学习在 v8 才开始写入会话表。
      await tx.table('studySessions').toCollection().modify((s: any) => {
        s.entityType = 'word'
        s.entityId = s.wordId
      })
    })
    // v9: 分类增加 entityType（单词/短句单一类型化）。
    //     按现有内容推断：只有单词→word；只有短句→sentence；混合或空→undefined。
    this.version(9).stores({
      words: '++id, word, category, nextReviewAt, isLearned, isFavorite, createdAt, srsStage',
      sentences: '++id, sentence, category, nextReviewAt, isLearned, isFavorite, createdAt, srsStage',
      categories: '++id, name',
      studySessions: '++id, wordId, entityId, entityType, timestamp, kind',
      studyPlans: '++id, name, sourceKind, isActive, isArchived, entityType, createdAt',
    }).upgrade(async (tx) => {
      const wordCats = new Set<string>()
      await tx.table('words').toCollection().each((w: any) => {
        if (w.category) wordCats.add(w.category)
      })
      const sentenceCats = new Set<string>()
      await tx.table('sentences').toCollection().each((s: any) => {
        if (s.category) sentenceCats.add(s.category)
      })
      await tx.table('categories').toCollection().modify((c: any) => {
        const hasWord = wordCats.has(c.name)
        const hasSentence = sentenceCats.has(c.name)
        if (hasWord && !hasSentence) c.entityType = 'word'
        else if (hasSentence && !hasWord) c.entityType = 'sentence'
        // 混合或空 → 保持 undefined（运行时锁定新增 / 待首次写入定型）
      })
    })
    // v10: 多收藏夹。favoriteFolders 存目录；favoriteItems 为 word/sentence 与夹的多对多行。
    //      旧 isFavorite=1 的内容迁入系统"默认"收藏夹；标志继续双写（=属于至少一个夹）。
    this.version(10).stores({
      words: '++id, word, category, nextReviewAt, isLearned, isFavorite, createdAt, srsStage',
      sentences: '++id, sentence, category, nextReviewAt, isLearned, isFavorite, createdAt, srsStage',
      categories: '++id, name',
      studySessions: '++id, wordId, entityId, entityType, timestamp, kind',
      studyPlans: '++id, name, sourceKind, isActive, isArchived, entityType, createdAt',
      favoriteFolders: '++id, name, createdAt',
      favoriteItems: '++id, folderId, entityId, [entityType+entityId]',
    }).upgrade(async (tx) => {
      // 已存在收藏夹数据则视为已完成迁移（理论上首次到 v10 才会走这里）
      const existing = await tx.table('favoriteFolders').count()
      let defaultFolderId: number
      if (existing === 0) {
        defaultFolderId = Number(
          await tx.table('favoriteFolders').add({
            name: '默认',
            color: '#ef4444',
            createdAt: Date.now(),
          } as FavoriteFolder)
        )
      } else {
        const first = await tx.table('favoriteFolders').orderBy('createdAt').first()
        defaultFolderId = first!.id!
      }
      const rows: FavoriteItem[] = []
      await tx.table('words').where('isFavorite').equals(1).each((w: any) => {
        rows.push({ folderId: defaultFolderId, entityType: 'word', entityId: w.id, createdAt: Date.now() })
      })
      await tx.table('sentences').where('isFavorite').equals(1).each((s: any) => {
        rows.push({ folderId: defaultFolderId, entityType: 'sentence', entityId: s.id, createdAt: Date.now() })
      })
      if (rows.length > 0) await tx.table('favoriteItems').bulkAdd(rows)
    })
    // v11: 为已有 v10 数据库补建 favoriteFolders.createdAt 索引。
    // v10 已发布后修改声明不会影响已经打开过的数据库，必须升版本才能真正更新 schema。
    this.version(11).stores({
      words: '++id, word, category, nextReviewAt, isLearned, isFavorite, createdAt, srsStage',
      sentences: '++id, sentence, category, nextReviewAt, isLearned, isFavorite, createdAt, srsStage',
      categories: '++id, name',
      studySessions: '++id, wordId, entityId, entityType, timestamp, kind',
      studyPlans: '++id, name, sourceKind, isActive, isArchived, entityType, createdAt',
      favoriteFolders: '++id, name, createdAt',
      favoriteItems: '++id, folderId, entityId, [entityType+entityId]',
    })
    // v12: 新增独立日语词库，复用词条的分类、收藏和 SRS 索引。
    this.version(12).stores({
      words: '++id, word, category, nextReviewAt, isLearned, isFavorite, createdAt, srsStage',
      sentences: '++id, sentence, category, nextReviewAt, isLearned, isFavorite, createdAt, srsStage',
      japaneseWords: '++id, word, reading, category, nextReviewAt, isLearned, isFavorite, createdAt, srsStage',
      categories: '++id, name',
      studySessions: '++id, wordId, entityId, entityType, timestamp, kind',
      studyPlans: '++id, name, sourceKind, isActive, isArchived, entityType, createdAt',
      favoriteFolders: '++id, name, createdAt',
      favoriteItems: '++id, folderId, entityId, [entityType+entityId]',
    })
    // v13: 日语收藏夹与学习计划完全独立于英语/短句数据。
    this.version(13).stores({
      words: '++id, word, category, nextReviewAt, isLearned, isFavorite, createdAt, srsStage',
      sentences: '++id, sentence, category, nextReviewAt, isLearned, isFavorite, createdAt, srsStage',
      japaneseWords: '++id, word, reading, category, nextReviewAt, isLearned, isFavorite, createdAt, srsStage',
      categories: '++id, name',
      studySessions: '++id, wordId, entityId, entityType, timestamp, kind',
      studyPlans: '++id, name, sourceKind, isActive, isArchived, entityType, createdAt',
      favoriteFolders: '++id, name, createdAt',
      favoriteItems: '++id, folderId, entityId, [entityType+entityId]',
      japaneseFavoriteFolders: '++id, name, createdAt',
      japaneseFavoriteItems: '++id, folderId, entityId, [entityType+entityId]',
      japaneseStudyPlans: '++id, name, sourceKind, isActive, isArchived, createdAt',
    }).upgrade(async (tx) => {
      const folders = tx.table<JapaneseFavoriteFolder>('japaneseFavoriteFolders')
      if (await folders.count() === 0) {
        await folders.add({ name: '默认', color: '#ef4444', createdAt: Date.now() })
      }
    })
    // v14: 分类增加语言归属 lang('en'|'ja')，实现英语/日语分类互不可见。
    //      非索引字段，无需变更索引声明；仅补标旧数据：
    //      含日语词条且无英语词/短句的分类 → 'ja'；其余 → 'en'（默认）。
    this.version(14).stores({
      words: '++id, word, category, nextReviewAt, isLearned, isFavorite, createdAt, srsStage',
      sentences: '++id, sentence, category, nextReviewAt, isLearned, isFavorite, createdAt, srsStage',
      japaneseWords: '++id, word, reading, category, nextReviewAt, isLearned, isFavorite, createdAt, srsStage',
      categories: '++id, name',
      studySessions: '++id, wordId, entityId, entityType, timestamp, kind',
      studyPlans: '++id, name, sourceKind, isActive, isArchived, entityType, createdAt',
      favoriteFolders: '++id, name, createdAt',
      favoriteItems: '++id, folderId, entityId, [entityType+entityId]',
      japaneseFavoriteFolders: '++id, name, createdAt',
      japaneseFavoriteItems: '++id, folderId, entityId, [entityType+entityId]',
      japaneseStudyPlans: '++id, name, sourceKind, isActive, isArchived, createdAt',
    }).upgrade(async (tx) => {
      const jaCats = new Set<string>()
      await tx.table('japaneseWords').toCollection().each((w: any) => {
        if (w.category) jaCats.add(w.category)
      })
      const enCats = new Set<string>()
      await tx.table('words').toCollection().each((w: any) => {
        if (w.category) enCats.add(w.category)
      })
      await tx.table('sentences').toCollection().each((s: any) => {
        if (s.category) enCats.add(s.category)
      })
      // 内容为空、但名字明确面向日语的预置分类也归日语
      const jaHintNames = new Set(['日语', 'N5', 'N4', 'N3', '标准日本语'])
      await tx.table('categories').toCollection().modify((c: any) => {
        if (c.lang) return
        if (jaCats.has(c.name) && !enCats.has(c.name)) c.lang = 'ja'
        else if (!enCats.has(c.name) && jaHintNames.has(c.name)) c.lang = 'ja'
        else c.lang = 'en'
      })
    })
  }
}

export const db = new VocabularyDatabase()
