// offscreen 文档：MV3 service worker 没有 DOM，无法运行 DOMParser。
// 这里在隐藏文档里复用 app 的 dictionary.ts 完成必应词典查询与解析。

import { lookupDictionary, DictionaryResult } from '../../../src/utils/dictionary'
import { OFFSCREEN_MESSAGE } from '../shared/protocol'

chrome.runtime.onMessage.addListener((message: any, _sender, sendResponse) => {
  if (message?.type !== OFFSCREEN_MESSAGE.lookup) return undefined
  const word = String(message.word ?? '').trim()
  lookupDictionary(word)
    .then((result: DictionaryResult) => sendResponse({ ok: true, result }))
    .catch((e) => sendResponse({ ok: false, error: (e as Error)?.message ?? '查询失败' }))
  return true
})
