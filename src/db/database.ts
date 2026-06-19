import Dexie, { Table } from 'dexie'
import { Word, Category, StudySession, StudyPlan } from '../types/word'

class VocabularyDatabase extends Dexie {
  words!: Table<Word>
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
  }
}

export const db = new VocabularyDatabase()
