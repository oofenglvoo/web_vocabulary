import { db } from '../db/database'

export type CategoryEntityType = 'word' | 'sentence'

/** 分类与写入内容类型冲突时抛出，便于 UI 层展示友好提示 */
export class CategoryTypeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CategoryTypeError'
  }
}

const TYPE_LABEL: Record<CategoryEntityType, string> = {
  word: '单词',
  sentence: '短句',
}

/**
 * 校验目标分类是否允许写入指定类型的内容：
 * - 分类不存在 → 放行（与既有行为一致，不隐式建分类）
 * - 已定型且不符 → 抛错
 * - 未定型：已有另一类内容（或已是混合）→ 抛错；空/仅同类 → 盖戳定型后放行
 *
 * 在 Dexie 事务中调用时，调用方必须把 db.categories 加入事务表清单。
 */
export async function ensureCategoryWritable(
  entityType: CategoryEntityType,
  categoryName: string
): Promise<void> {
  const name = categoryName?.trim()
  if (!name) return
  const cat = await db.categories.where('name').equals(name).first()
  if (!cat || cat.id == null) return

  if (cat.entityType) {
    if (cat.entityType !== entityType) {
      throw new CategoryTypeError(
        `分类「${name}」仅用于${TYPE_LABEL[cat.entityType]}，不能添加${TYPE_LABEL[entityType]}`
      )
    }
    return
  }

  // 未定型：检查两侧内容，防止制造新的混合分类
  const [ownCount, otherCount] = await Promise.all([
    entityType === 'word'
      ? db.words.where('category').equals(name).count()
      : db.sentences.where('category').equals(name).count(),
    entityType === 'word'
      ? db.sentences.where('category').equals(name).count()
      : db.words.where('category').equals(name).count(),
  ])

  if (otherCount > 0) {
    throw new CategoryTypeError(
      ownCount > 0
        ? `分类「${name}」同时包含单词与短句，请先移出其中一类后再添加新内容`
        : `分类「${name}」已包含${TYPE_LABEL[entityType === 'word' ? 'sentence' : 'word']}，请先清空后再添加${TYPE_LABEL[entityType]}`
    )
  }

  await db.categories.update(cat.id, { entityType })
}
