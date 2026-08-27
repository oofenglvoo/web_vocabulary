import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { Word, Sentence, FavoriteFolder, FavoriteItem } from '../types/word'

export type FavEntityType = 'word' | 'sentence'

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
        const items = await db.favoriteItems
          .where('[entityType+entityId]')
          .equals([entityType, entityId])
          .toArray()
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
      for (const r of rows) {
        ;(r.entityType === 'word' ? wordIds : sentenceIds).add(r.entityId)
      }
      const [aliveWords, aliveSentences] = await Promise.all([
        db.words.bulkGet([...wordIds]),
        db.sentences.bulkGet([...sentenceIds]),
      ])
      const aliveWordIds = new Set(aliveWords.filter((w): w is Word => !!w).map((w) => w.id!))
      const aliveSentenceIds = new Set(aliveSentences.filter((s): s is Sentence => !!s).map((s) => s.id!))
      const removable = rows.filter((r) =>
        r.entityType === 'word' ? !aliveWordIds.has(r.entityId) : !aliveSentenceIds.has(r.entityId)
      )
      if (removable.length > 0) {
        await db.favoriteItems.bulkDelete(removable.map((r) => r.id!))
      }
      return rows.filter((r) =>
        r.entityType === 'word' ? aliveWordIds.has(r.entityId) : aliveSentenceIds.has(r.entityId)
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
  const table = entityType === 'word' ? db.words : db.sentences

  let added = 0
  let removed = 0
  await db.transaction('rw', db.favoriteFolders, db.favoriteItems, table, async () => {
    const current = await db.favoriteItems
      .where('[entityType+entityId]')
      .equals([entityType, entityId])
      .toArray()
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
