import Dexie, { Table } from 'dexie'
import { Word, Category, StudySession, StudyPlan, Sentence, Definition } from '../types/word'

class VocabularyDatabase extends Dexie {
  words!: Table<Word>
  sentences!: Table<Sentence>
  categories!: Table<Category>
  studySessions!: Table<StudySession>
  studyPlans!: Table<StudyPlan>

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
  }
}

export const db = new VocabularyDatabase()
