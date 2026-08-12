import { Word, Sentence, Definition } from '../types/word'

/**
 * 获取单词的有效释义列表。
 * 优先使用新的 definitions 数组；若为空则从旧字段 definition/translation 构造单条释义。
 */
export function getDefinitions(word: Word): Definition[] {
  if (word.definitions && word.definitions.length > 0) {
    return word.definitions
  }
  // 向前兼容：从旧字段构造
  const defs: Definition[] = []
  if (word.translation || word.definition) {
    defs.push({
      pos: '',
      def: word.definition ?? '',
      trans: word.translation ?? '',
    })
  }
  return defs
}

/**
 * 获取短句的有效释义列表。
 * 优先使用 definitions 数组；若为空则从 translation 构造。
 */
export function getSentenceDefinitions(sentence: Sentence): Definition[] {
  if (sentence.definitions && sentence.definitions.length > 0) {
    return sentence.definitions
  }
  if (sentence.translation) {
    return [{ pos: '', def: '', trans: sentence.translation }]
  }
  return []
}

/**
 * 获取短句的首选翻译（用于卡片摘要、测验等场景）
 */
export function getSentencePrimaryTranslation(sentence: Sentence): string {
  const defs = getSentenceDefinitions(sentence)
  if (defs.length > 0) {
    const withTrans = defs.find((d) => d.trans)
    if (withTrans) return withTrans.trans
    return defs[0].def
  }
  return sentence.translation ?? ''
}

/**
 * 获取单词的首选中文翻译（用于卡片摘要、测验等场景）
 */
export function getPrimaryTranslation(word: Word): string {
  const defs = getDefinitions(word)
  if (defs.length > 0) {
    // 优先取第一条有中文翻译的
    const withTrans = defs.find((d) => d.trans)
    if (withTrans) return withTrans.trans
    return defs[0].def
  }
  return word.translation ?? ''
}

/**
 * 获取单词的首选英文释义（用于卡片摘要）
 */
export function getPrimaryDefinition(word: Word): string {
  const defs = getDefinitions(word)
  if (defs.length > 0) {
    const withDef = defs.find((d) => d.def)
    if (withDef) return withDef.def
    return defs[0].trans
  }
  return word.definition ?? ''
}

/**
 * 将旧字段 definition/translation 迁移为 definitions 数组。
 * 仅在 definitions 为空/不存在时执行。
 */
export function migrateToDefinitions(word: Word): Partial<Word> | null {
  if (word.definitions && word.definitions.length > 0) return null
  const defs = getDefinitions(word)
  if (defs.length === 0) return null
  return { definitions: defs }
}
