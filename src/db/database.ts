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
  }
}

export const db = new VocabularyDatabase()
