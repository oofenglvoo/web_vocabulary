// 日语释义文本处理：把「1、… 2、…」这类编号多义拆成列表，供详情页与学习卡统一换行展示。
export function splitNumberedJapaneseText(text: string): { items: string[]; numbered: boolean } {
  const matches = [...text.matchAll(/(?:^|(?<=[^\d]))\d{1,3}[、．.)](?=\s|[\u3000-\u9fff\u3040-\u30ff])/g)]
  if (matches.length < 2) return { items: [text.trim()], numbered: false }
  const items = matches.map((match, index) => {
    const marker = match[0].match(/\d{1,3}[、．.)]/)!
    const start = (match.index ?? 0) + (match[0].indexOf(marker[0]) + marker[0].length)
    const end = index + 1 < matches.length ? matches[index + 1].index : text.length
    return text.slice(start, end).trim()
  }).filter(Boolean)
  return { items, numbered: true }
}
