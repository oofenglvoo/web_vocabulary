// 扩展 popup：iframe 内嵌 app（?embed=1），把待收藏数据通过 postMessage 交给 app。
// 分类列表由 app 提供，目标分类持久化到 chrome.storage.local。

import {
  APP_EMBED_URL,
  EMBED_MESSAGE,
  EMBED_PROTOCOL_VERSION,
  RUNTIME_MESSAGE,
  EmbedCollectedWord,
  PendingCollect,
} from '../shared/protocol'

const TARGET_CATEGORY_KEY = 'vocab.targetCategory'

const frame = document.getElementById('appFrame') as HTMLIFrameElement
const statusEl = document.getElementById('status') as HTMLSpanElement
const categorySelect = document.getElementById('category') as HTMLSelectElement
const collectBtn = document.getElementById('collectBtn') as HTMLButtonElement
const refreshBtn = document.getElementById('refreshCategories') as HTMLButtonElement
const pendingEl = document.getElementById('pending') as HTMLDivElement
const toastEl = document.getElementById('toast') as HTMLDivElement

let ready = false
let categories: string[] = []
let pending: PendingCollect | null = null
/** 是否为「气泡点收藏 → 自动弹出」触发的自动提交（无需用户再点） */
let autoSubmit = false
let autoSubmitAttempted = false

function toast(msg: string) {
  toastEl.textContent = msg
  toastEl.classList.add('show')
  window.setTimeout(() => toastEl.classList.remove('show'), 2000)
}

function postToApp(data: unknown) {
  frame.contentWindow?.postMessage(data, new URL(APP_EMBED_URL).origin)
}

function renderCategories() {
  const current = categorySelect.value
  categorySelect.innerHTML = ''
  if (categories.length === 0) {
    const opt = document.createElement('option')
    opt.value = ''
    opt.textContent = '（暂无分类）'
    categorySelect.appendChild(opt)
    return
  }
  for (const name of categories) {
    const opt = document.createElement('option')
    opt.value = name
    opt.textContent = name
    categorySelect.appendChild(opt)
  }
  if (current && categories.includes(current)) categorySelect.value = current
}

function renderPending() {
  if (!pending || pending.words.length === 0) {
    pendingEl.innerHTML = '<div class="empty">暂无待收藏单词</div>'
    collectBtn.disabled = true
    return
  }
  pendingEl.innerHTML = ''
  for (const w of pending.words) {
    const row = document.createElement('div')
    row.className = 'row'
    const wEl = document.createElement('span')
    wEl.className = 'w'
    wEl.textContent = w.word
    const tEl = document.createElement('span')
    tEl.className = 't'
    tEl.textContent = w.definitions?.[0]?.trans || w.definitions?.[0]?.def || ''
    row.appendChild(wEl)
    row.appendChild(tEl)
    pendingEl.appendChild(row)
  }
  collectBtn.disabled = false
}

async function loadPending() {
  const res = await chrome.runtime.sendMessage({ type: 'runtime:pull-pending' })
  if (res?.pending) {
    pending = res.pending
    autoSubmit = !!res.pending.autoSubmit
    if (pending && pending.category && !categorySelect.value) {
      categorySelect.value = pending.category
    }
  }
  renderPending()
  maybeAutoSubmit()
}

/** 自动提交：气泡点收藏触发的 popup，就绪且有待办时直接落库 */
function maybeAutoSubmit() {
  if (!autoSubmit || autoSubmitAttempted) return
  if (!ready || !pending || pending.words.length === 0) return
  autoSubmitAttempted = true
  submitPending()
}

function submitPending() {
  if (!pending || pending.words.length === 0) return
  if (!ready) {
    toast('应用尚未就绪')
    return
  }
  const category = categorySelect.value || pending.category || '划词收藏'
  chrome.storage.local.set({ [TARGET_CATEGORY_KEY]: category })
  postToApp({
    type: EMBED_MESSAGE.collect,
    requestId: `req-${Date.now()}`,
    category,
    words: pending.words as EmbedCollectedWord[],
  })
}

async function loadTargetCategory() {
  const stored = await chrome.storage.local.get(TARGET_CATEGORY_KEY)
  const saved = stored?.[TARGET_CATEGORY_KEY]
  if (typeof saved === 'string' && saved) categorySelect.value = saved
}

async function refreshCategories() {
  if (!ready) return
  postToApp({ type: EMBED_MESSAGE.requestCategories })
}

window.addEventListener('message', (event) => {
  if (event.origin !== new URL(APP_EMBED_URL).origin) return
  const data = event.data

  if (data?.type === EMBED_MESSAGE.ready) {
    ready = true
    statusEl.textContent = '已连接'
    postToApp({ type: EMBED_MESSAGE.ping, version: EMBED_PROTOCOL_VERSION })
    refreshCategories()
    maybeAutoSubmit()
    return
  }

  if (data?.type === EMBED_MESSAGE.categoryList) {
    categories = Array.isArray(data.categories) ? data.categories : []
    renderCategories()
    maybeAutoSubmit()
    return
  }

  if (data?.type === EMBED_MESSAGE.collectResult) {
    const { added, skipped, errors } = data
    if (added > 0) toast(`已收藏 ${added} 个${skipped ? `，跳过 ${skipped} 个` : ''}`)
    else if (skipped > 0) toast(`全部已存在，跳过 ${skipped} 个`)
    else if (errors?.length) toast(errors[0])
    else toast('没有可收藏的单词')
    // 收藏完成后清空待办，并把结果回传给来源标签页
    const tabId = pending?.tabId
    const wasAuto = autoSubmit
    if (added > 0 || skipped > 0) {
      void chrome.runtime.sendMessage({ type: 'runtime:clear-pending' }).then(() => {
        pending = null
        renderPending()
      })
      void chrome.runtime.sendMessage({
        type: RUNTIME_MESSAGE.reportResult,
        tabId,
        result: { added, skipped, errors, category: data.category },
      })
      // 自动提交的面板完成后自动关闭，避免残留窗口
      if (wasAuto) {
        window.setTimeout(() => window.close(), 600)
      }
    }
  }
})

categorySelect.addEventListener('change', () => {
  chrome.storage.local.set({ [TARGET_CATEGORY_KEY]: categorySelect.value })
})

refreshBtn.addEventListener('click', refreshCategories)

collectBtn.addEventListener('click', () => {
  if (!pending || pending.words.length === 0) return
  submitPending()
})

// 启动
frame.src = APP_EMBED_URL
void loadTargetCategory().then(loadPending)
