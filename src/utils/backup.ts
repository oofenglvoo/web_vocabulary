import { db } from '../db/database'
import { downloadFile } from './export'
import { DARK_KEY } from './theme'

const BACKUP_VERSION = 1
const PREF_KEYS = ['vocab.dark', 'vocab.tts.accent', 'vocab.tts.provider', 'vocab.study.prefs', 'vocab.achievements']

export interface BackupPayload {
  format: 'web-vocabulary-backup'
  version: number
  exportedAt: string
  data: {
    words: unknown[]
    sentences: unknown[]
    categories: unknown[]
    studySessions: unknown[]
    studyPlans: unknown[]
  }
  preferences: Record<string, string | null>
}

export interface BackupPreview {
  exportedAt: string
  counts: Record<keyof BackupPayload['data'], number>
  preferenceCount: number
}

export async function createBackup(): Promise<string> {
  const data = {
    words: await db.words.toArray(),
    sentences: await db.sentences.toArray(),
    categories: await db.categories.toArray(),
    studySessions: await db.studySessions.toArray(),
    studyPlans: await db.studyPlans.toArray(),
  }
  const preferences = Object.fromEntries(PREF_KEYS.map((key) => [key, localStorage.getItem(key)]))
  const payload: BackupPayload = {
    format: 'web-vocabulary-backup',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
    preferences,
  }
  return JSON.stringify(payload, null, 2)
}

export function parseBackup(content: string): { payload: BackupPayload; preview: BackupPreview } {
  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch {
    throw new Error('备份文件不是有效的 JSON')
  }
  const payload = raw as Partial<BackupPayload>
  if (payload.format !== 'web-vocabulary-backup' || payload.version !== BACKUP_VERSION || !payload.data) {
    throw new Error('不支持的备份文件格式或版本')
  }
  const tableNames: (keyof BackupPayload['data'])[] = ['words', 'sentences', 'categories', 'studySessions', 'studyPlans']
  for (const name of tableNames) {
    if (!Array.isArray(payload.data[name])) throw new Error(`备份缺少 ${name} 数据`)
  }
  const preferences = payload.preferences ?? {}
  const preview: BackupPreview = {
    exportedAt: payload.exportedAt ?? '',
    counts: Object.fromEntries(tableNames.map((name) => [name, payload.data![name].length])) as BackupPreview['counts'],
    preferenceCount: Object.values(preferences).filter((value) => value != null).length,
  }
  return { payload: { ...payload, preferences } as BackupPayload, preview }
}

export async function restoreBackup(payload: BackupPayload): Promise<void> {
  const preferences = payload.preferences ?? {}
  await db.transaction('rw', db.words, db.sentences, db.categories, db.studySessions, db.studyPlans, async () => {
    await Promise.all([
      db.words.clear(),
      db.sentences.clear(),
      db.categories.clear(),
      db.studySessions.clear(),
      db.studyPlans.clear(),
    ])
    await db.categories.bulkAdd(payload.data.categories as any[])
    await db.words.bulkAdd(payload.data.words as any[])
    await db.sentences.bulkAdd(payload.data.sentences as any[])
    await db.studySessions.bulkAdd(payload.data.studySessions as any[])
    await db.studyPlans.bulkAdd(payload.data.studyPlans as any[])
  })
  for (const key of PREF_KEYS) {
    const value = preferences[key]
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  }
  // The next boot will apply the restored theme; update it immediately too.
  if (preferences[DARK_KEY] === 'true') document.documentElement.classList.add('dark')
  if (preferences[DARK_KEY] === 'false') document.documentElement.classList.remove('dark')
}

export async function downloadBackup(): Promise<void> {
  const content = await createBackup()
  const date = new Date().toISOString().slice(0, 10)
  await downloadFile(content, `vocabulary-backup-${date}.json`, 'application/json')
}
