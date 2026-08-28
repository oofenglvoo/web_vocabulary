import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { Word, Sentence, JapaneseWord, FavoriteFolder, FavoriteItem, JapaneseFavoriteFolder, JapaneseFavoriteItem } from '../types/word'

export type FavEntityType = 'word' | 'sentence' | 'japaneseWord'

/** 收藏夹重名错误 */
export class DuplicateFavoriteFolderError extends Error {
  constructor(name: string) {
    super(`收藏夹「${name}」已存在`)
    this.name = 'DuplicateFavoriteFolderError'
  }
}

export class DefaultFolderProtectedError extends Error {
  constructor() {
    super('系统默认收藏夹不可删除')
    this.name = 'DefaultFolderProtectedError'
  }
}

// “默认”夹通过固定名称识别（迁移时创建，且运行时防重名/防删除）
export const DEFAULT_FOLDER_NAME = '默认'

export function useJapaneseFavoriteFolders(): JapaneseFavoriteFolder[] {
  return useLiveQuery(async () => {
    await ensureJapaneseDefaultFolder()
    const folders = await db.japaneseFavoriteFolders.orderBy('createdAt').toArray()
    return folders.sort((a, b) => (a.name === DEFAULT_FOLDER_NAME ? -1 : b.name === DEFAULT_FOLDER_NAME ? 1 : a.createdAt - b.createdAt))
  }, []) ?? []
}

export function useJapaneseEntityFolderIds(entityId: number | undefined): number[] {
  return useLiveQuery(async () => entityId == null ? [] :
    (await db.japaneseFavoriteItems.toArray()).filter((item) => item.entityId === entityId).map((item) => item.folderId), [entityId]) ?? []
}

export async function ensureJapaneseDefaultFolder(): Promise<JapaneseFavoriteFolder> {
  return db.transaction('rw', db.japaneseFavoriteFolders, async () => {
    const existing = await db.japaneseFavoriteFolders.where('name').equals(DEFAULT_FOLDER_NAME).first()
    if (existing) return existing
    const now = Date.now()
    const id = Number(await db.japaneseFavoriteFolders.add({ name: DEFAULT_FOLDER_NAME, color: '#ef4444', createdAt: now }))
    return { id, name: DEFAULT_FOLDER_NAME, color: '#ef4444', createdAt: now }
  })
}

export async function createJapaneseFavoriteFolder(name: string, color: string): Promise<number> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('收藏夹名称不能为空')
  const existing = await db.japaneseFavoriteFolders.where('name').equalsIgnoreCase(trimmed).first()
  if (existing) throw new DuplicateFavoriteFolderError(existing.name)
  return Number(await db.japaneseFavoriteFolders.add({ name: trimmed, color, createdAt: Date.now() }))
}

export async function renameJapaneseFavoriteFolder(id: number, name: string) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('收藏夹名称不能为空')
  const existing = await db.japaneseFavoriteFolders.where('name').equalsIgnoreCase(trimmed).first()
  if (existing && existing.id !== id) throw new DuplicateFavoriteFolderError(existing.name)
  await db.japaneseFavoriteFolders.update(id, { name: trimmed })
}

export async function updateJapaneseFavoriteFolderColor(id: number, color: string) {
  await db.japaneseFavoriteFolders.update(id, { color })
}

export async function deleteJapaneseFavoriteFolder(id: number) {
  const folder = await db.japaneseFavoriteFolders.get(id)
  if (!folder) return
  if (folder.name === DEFAULT_FOLDER_NAME) throw new DefaultFolderProtectedError()
  await db.transaction('rw', db.japaneseFavoriteFolders, db.japaneseFavoriteItems, async () => {
    await db.japaneseFavoriteItems.where('folderId').equals(id).delete()
    await db.japaneseFavoriteFolders.delete(id)
  })
}

export async function setJapaneseItemFolders(entityId: number, folderIds: number[]) {
  const targets = [...new Set(folderIds)]
  return db.transaction('rw', db.japaneseFavoriteFolders, db.japaneseFavoriteItems, db.japaneseWords, async () => {
    const current = (await db.japaneseFavoriteItems.toArray()).filter((item) => item.entityId === entityId)
    const folders = new Set((await db.japaneseFavoriteFolders.toArray()).map((folder) => folder.id!))
    if (targets.some((id) => !folders.has(id))) throw new Error('目标收藏夹不存在')
    const old = new Set(current.map((item) => item.folderId))
    const added = targets.filter((id) => !old.has(id))
    const removed = current.filter((item) => !targets.includes(item.folderId))
    if (added.length) await db.japaneseFavoriteItems.bulkAdd(added.map((folderId) => ({ folderId, entityType: 'japaneseWord', entityId, createdAt: Date.now() } as JapaneseFavoriteItem)))
    if (removed.length) await db.japaneseFavoriteItems.bulkDelete(removed.map((item) => item.id!))
    await db.japaneseWords.update(entityId, { isFavorite: targets.length ? 1 : 0 })
    return { added: added.length, removed: removed.length }
  })
}

/** 日语收藏夹成员（含孤儿行惰性清理），与 useFolderMembers 对等 */
export function useJapaneseFolderMembers(folderId: number | 'all') {
  return useLiveQuery(async () => {
    const purgeOrphans = async (rows: JapaneseFavoriteItem[]) => {
      if (rows.length === 0) return rows
      const jaIds = new Set<number>(rows.map((r) => r.entityId))
      const aliveJaWords = await db.japaneseWords.bulkGet([...jaIds])
      const aliveIds = new Set(aliveJaWords.filter((w): w is JapaneseWord => !!w).map((w) => w.id!))
      const removable = rows.filter((r) => !aliveIds.has(r.entityId))
      if (removable.length > 0) {
        await db.japaneseFavoriteItems.bulkDelete(removable.map((r) => r.id!))
      }
      return rows.filter((r) => aliveIds.has(r.entityId))
    }

    if (folderId === 'all') {
      const rows = await db.japaneseFavoriteItems.toArray()
      return purgeOrphans(rows)
    }
    const rows = await db.japaneseFavoriteItems.where('folderId').equals(folderId as number).toArray()
    return purgeOrphans(rows)
  }, [folderId]) ?? []
}

const isDefaultFolder = (folder: FavoriteFolder) => folder.name === DEFAULT_FOLDER_NAME

// ---------- 读取 ----------

export function useFavoriteFolders(): FavoriteFolder[] {
  return (
    useLiveQuery(async () => {
      const folders = await db.favoriteFolders.orderBy('createdAt').toArray()
      // 默认夹排最前
      return [...folders].sort((a, b) => {
        const da = a.name === DEFAULT_FOLDER_NAME ? 0 : 1
        const db_ = b.name === DEFAULT_FOLDER_NAME ? 0 : 1
        return da - db_
      })
    }, []) ?? []
  )
}
export function useEntityFolderIds(entityType: FavEntityType, entityId: number | undefined): number[] {
  return (
    useLiveQuery(
      async () => {
        if (entityId == null) return []
        const items = (await db.favoriteItems.toArray()).filter(
          (item) => item.entityType === entityType && item.entityId === entityId
        )
        return items.map((it) => it.folderId)
      },
      [entityType, entityId]
    ) ?? []
  )
}

export function useFolderMembers(folderId: number | 'all') {
  return useLiveQuery(async () => {
    // 自动清理指向已删除实体的孤儿行（延迟兜底，正常删除路径已级联清理）
    const purgeOrphans = async (rows: FavoriteItem[]) => {
      if (rows.length === 0) return rows
      const wordIds = new Set<number>()
      const sentenceIds = new Set<number>()
      const japaneseWordIds = new Set<number>()
      for (const r of rows) {
        ;(r.entityType === 'word' ? wordIds : r.entityType === 'sentence' ? sentenceIds : japaneseWordIds).add(r.entityId)
      }
      const [aliveWords, aliveSentences, aliveJapaneseWords] = await Promise.all([
        db.words.bulkGet([...wordIds]),
        db.sentences.bulkGet([...sentenceIds]),
        db.japaneseWords.bulkGet([...japaneseWordIds]),
      ])
      const aliveWordIds = new Set(aliveWords.filter((w): w is Word => !!w).map((w) => w.id!))
      const aliveSentenceIds = new Set(aliveSentences.filter((s): s is Sentence => !!s).map((s) => s.id!))
      const aliveJapaneseWordIds = new Set(aliveJapaneseWords.filter((w): w is JapaneseWord => !!w).map((w) => w.id!))
      const removable = rows.filter((r) =>
        r.entityType === 'word' ? !aliveWordIds.has(r.entityId) : r.entityType === 'sentence' ? !aliveSentenceIds.has(r.entityId) : !aliveJapaneseWordIds.has(r.entityId)
      )
      if (removable.length > 0) {
        await db.favoriteItems.bulkDelete(removable.map((r) => r.id!))
      }
      return rows.filter((r) =>
        r.entityType === 'word' ? aliveWordIds.has(r.entityId) : r.entityType === 'sentence' ? aliveSentenceIds.has(r.entityId) : aliveJapaneseWordIds.has(r.entityId)
      )
    }

    if (folderId === 'all') {
      const rows = await db.favoriteItems.toArray()
      return purgeOrphans(rows)
    }
    const rows = await db.favoriteItems.where('folderId').equals(folderId as number).toArray()
    return purgeOrphans(rows)
  }, [folderId]) ?? []
}

// ---------- 写入 ----------

async function assertUniqueName(name: string, ignoreId?: number) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('收藏夹名称不能为空')
  const existing = await db.favoriteFolders.where('name').equalsIgnoreCase(trimmed).first()
  if (existing && existing.id !== ignoreId) throw new DuplicateFavoriteFolderError(existing.name)
  return trimmed
}

export async function ensureDefaultFolder(): Promise<FavoriteFolder> {
  // 事务内复查后写入，避免 StrictMode 双挂载/并发调用重复创建
  return db.transaction('rw', db.favoriteFolders, async () => {
    const existing = await db.favoriteFolders.where('name').equals(DEFAULT_FOLDER_NAME).first()
    if (existing) return existing
    const id = Number(
      await db.favoriteFolders.add({
        name: DEFAULT_FOLDER_NAME,
        color: '#ef4444',
        createdAt: Date.now(),
      } as FavoriteFolder)
    )
    return { id, name: DEFAULT_FOLDER_NAME, color: '#ef4444', createdAt: Date.now() }
  })
}

export async function createFolder(name: string, color: string): Promise<number> {
  const trimmed = await assertUniqueName(name)
  const folderCount = await db.favoriteFolders.count()
  if (folderCount === 0) {
    // 首个夹自动成为默认语义上的入口；名称沿用用户输入
  }
  return Number(await db.favoriteFolders.add({ name: trimmed, color, createdAt: Date.now() } as FavoriteFolder))
}

export async function renameFolder(id: number, name: string) {
  const trimmed = await assertUniqueName(name, id)
  await db.favoriteFolders.update(id, { name: trimmed })
}

export async function updateFolderColor(id: number, color: string) {
  await db.favoriteFolders.update(id, { color })
}

export async function deleteFolder(id: number) {
  const folder = await db.favoriteFolders.get(id)
  if (!folder) return
  if (isDefaultFolder(folder)) throw new DefaultFolderProtectedError()

  const entityIds = (await db.favoriteItems.where('folderId').equals(id).toArray())
    .map((i) => i.id)
    .filter((x): x is number => x != null)
  await db.transaction('rw', db.favoriteFolders, db.favoriteItems, async () => {
    await db.favoriteItems.bulkDelete(entityIds)
    await db.favoriteFolders.delete(id)
  })
}

/**
 * 设置词条所属的收藏夹集合（多归属差量更新），
 * 并同步派生标志 isFavorite = 属于至少一个夹。
 * 调用方事务需包含 favoriteTables。
 */
export const FAVORITE_TABLES = [db.favoriteFolders, db.favoriteItems] as const

export async function setItemFolders(
  entityType: FavEntityType,
  entityId: number,
  targetFolderIds: number[]
): Promise<{ added: number; removed: number }> {
  const uniqueTargets = Array.from(new Set(targetFolderIds))
  const table = entityType === 'word' ? db.words : entityType === 'sentence' ? db.sentences : db.japaneseWords

  let added = 0
  let removed = 0
  await db.transaction('rw', db.favoriteFolders, db.favoriteItems, table, async () => {
    const current = (await db.favoriteItems.toArray()).filter(
      (item) => item.entityType === entityType && item.entityId === entityId
    )
    const currentIds = new Set(current.map((c) => c.folderId))
    const targetSet = new Set(uniqueTargets)

    // 校验目标夹存在
    const allFolders = await db.favoriteFolders.toArray()
    const folderIds = new Set(allFolders.map((f) => f.id as number))
    for (const fid of targetSet) {
      if (!folderIds.has(fid)) throw new Error('目标收藏夹不存在')
    }

    const toAdd = uniqueTargets.filter((fid) => !currentIds.has(fid))
    const toRemove = current.filter((c) => !targetSet.has(c.folderId))

    if (toAdd.length > 0) {
      await db.favoriteItems.bulkAdd(
        toAdd.map((fid) => ({ folderId: fid, entityType, entityId, createdAt: Date.now() } as FavoriteItem))
      )
    }
    if (toRemove.length > 0) {
      await db.favoriteItems.bulkDelete(toRemove.map((r) => r.id!))
    }
    added = toAdd.length
    removed = toRemove.length

    // 同步派生标志
    const finalCount = current.length + added - toRemove.length
    await table.update(entityId, { isFavorite: finalCount > 0 ? 1 : 0 })
  })
  return { added, removed }
}
