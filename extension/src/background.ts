// 扩展 service worker：协调 content script 与 popup，负责暂存待收藏数据。
// MV3 限制：
//  - SW 无法直接向 iframe 发消息，因此收藏动作由 popup 打开后主动拉取待办。
//  - SW 没有 DOM（无 DOMParser），词典解析交给 offscreen 文档执行。

import {
  RUNTIME_MESSAGE,
  OFFSCREEN_MESSAGE,
  OFFSCREEN_PATH,
  RuntimeCollectMessage,
  RuntimeLookupMessage,
  LookupResult,
  PendingCollect,
} from './shared/protocol'
import type { DictionaryResult } from '../../src/utils/dictionary'

const PENDING_KEY = 'vocab.pendingCollect'
const POPUP_WINDOW_KEY = 'vocab.popupWindowId'
const POPUP_URL = 'src/popup/index.html'

let creatingOffscreen: Promise<void> | null = null

/** 按需创建 offscreen 文档（已存在则跳过，避免重复创建报错） */
async function ensureOffscreen(): Promise<void> {
  const has = await chrome.offscreen.hasDocument?.()
  if (has) return
  if (creatingOffscreen) return creatingOffscreen
  creatingOffscreen = chrome.offscreen
    .createDocument({
      url: OFFSCREEN_PATH,
      reasons: [chrome.offscreen.Reason.DOM_PARSER],
      justification: '解析必应词典 HTML 需要 DOMParser（service worker 无 DOM）',
    })
    .finally(() => {
      creatingOffscreen = null
    })
  return creatingOffscreen
}

async function setPending(pending: PendingCollect) {
  await chrome.storage.session.set({ [PENDING_KEY]: pending })
}

async function getPending(): Promise<PendingCollect | null> {
  const stored = await chrome.storage.session.get(PENDING_KEY)
  return (stored?.[PENDING_KEY] as PendingCollect) ?? null
}

async function clearPending() {
  await chrome.storage.session.remove(PENDING_KEY)
}

/**
 * 打开收藏面板：用小窗口承载 popup 页面（内嵌 app）。
 * 相比 chrome.action.openPopup()，独立窗口在自动化环境可观测、不依赖手势，
 * 且不会被点击页面立即关闭。已开则聚焦复用，避免重复窗口。
 */
async function openCollectPanel(): Promise<void> {
  const stored = await chrome.storage.session.get(POPUP_WINDOW_KEY)
  const existingId = stored?.[POPUP_WINDOW_KEY] as number | undefined
  if (existingId != null) {
    try {
      await chrome.windows.update(existingId, { focused: true })
      return
    } catch {
      // 窗口已关闭，继续新建
    }
  }
  const created = await chrome.windows.create({
    url: POPUP_URL,
    type: 'popup',
    width: 400,
    height: 620,
  })
  if (created?.id != null) {
    await chrome.storage.session.set({ [POPUP_WINDOW_KEY]: created.id })
  }
}

/** 查词：转交 offscreen 文档执行（有 DOM 可跑 DOMParser），再转成气泡需要的精简结构 */
async function handleLookup(word: string): Promise<LookupResult> {
  const trimmed = word.trim()
  if (!trimmed) {
    return { word: trimmed, phonetic: '', senses: [], definitions: [], dictionaryExamples: [], error: '查询内容为空' }
  }
  try {
    await ensureOffscreen()
    const response = await chrome.runtime.sendMessage({ type: OFFSCREEN_MESSAGE.lookup, word: trimmed })
    if (!response?.ok) {
      return {
        word: trimmed,
        phonetic: '',
        senses: [],
        definitions: [],
        dictionaryExamples: [],
        error: response?.error ?? '查询失败',
      }
    }
    const result = response.result as DictionaryResult
    return {
      word: result.word,
      phonetic: (result.usPhonetic || result.ukPhonetic || '').replace(/^\/+|\/+$/g, ''),
      senses: result.senses.map((s) => ({ pos: s.pos, trans: s.trans })),
      definitions: result.senses.map((s) => ({ pos: s.pos, def: '', trans: s.trans })),
      dictionaryExamples: result.examples.map((e) => ({ en: e.en, zh: e.zh, source: e.source })),
    }
  } catch (e) {
    return {
      word: trimmed,
      phonetic: '',
      senses: [],
      definitions: [],
      dictionaryExamples: [],
      error: (e as Error)?.message ?? '查询失败',
    }
  }
}

chrome.runtime.onMessage.addListener((message: any, _sender, sendResponse) => {
  const type = message?.type

  if (type === RUNTIME_MESSAGE.lookup) {
    const msg = message as RuntimeLookupMessage
    handleLookup(msg.word)
      .then((result) => sendResponse(result))
      .catch((e) => sendResponse({ word: msg.word, phonetic: '', senses: [], definitions: [], dictionaryExamples: [], error: String(e) }))
    return true
  }

  if (type === RUNTIME_MESSAGE.collect) {
    const msg = message as RuntimeCollectMessage
    const pending: PendingCollect = {
      words: msg.words ?? [],
      category: msg.category ?? '划词收藏',
      createdAt: Date.now(),
      autoSubmit: true,
      tabId: _sender?.tab?.id,
    }
    setPending(pending)
      .then(() => openCollectPanel())
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }))
    return true
  }

  if (type === RUNTIME_MESSAGE.reportResult) {
    // popup 收藏完成 → 转告来源标签页的 content script，弹提示
    const { tabId, result } = message as { tabId?: number; result?: unknown }
    if (tabId != null) {
      chrome.tabs.sendMessage(tabId, { type: RUNTIME_MESSAGE.collectDone, result }).catch(() => {
        // 标签页可能已关闭，忽略
      })
    }
    sendResponse({ ok: true })
    return true
  }

  if (type === RUNTIME_MESSAGE.requestCategories) {
    // content 侧不直接查分类，交给 popup 打开后拉取
    openCollectPanel()
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }))
    return true
  }

  if (type === RUNTIME_MESSAGE.pullPending) {
    getPending()
      .then((pending) => sendResponse({ ok: true, pending }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }))
    return true
  }

  if (type === 'runtime:clear-pending') {
    clearPending()
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }))
    return true
  }

  return undefined
})

// 面板窗口关闭时清掉记录的窗口 ID，便于下次重新打开
chrome.windows.onRemoved.addListener(async (windowId) => {
  const stored = await chrome.storage.session.get(POPUP_WINDOW_KEY)
  if (stored?.[POPUP_WINDOW_KEY] === windowId) {
    await chrome.storage.session.remove(POPUP_WINDOW_KEY)
  }
})
