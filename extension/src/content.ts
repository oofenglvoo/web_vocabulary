// content script：捕获网页划词 → 拆词 → 气泡展示词典释义 → 收藏到 app。
// 注意：content script 不能使用 ESM import，协议字符串在此内联（与 shared/protocol.ts 保持一致）。

interface LookupResult {
  word: string
  phonetic: string
  senses: Array<{ pos: string; trans: string }>
  definitions: Array<{ pos: string; def: string; trans: string }>
  dictionaryExamples: Array<{ en: string; zh: string; source?: string }>
  error?: string
}

interface BubbleItem {
  word: string
  status: 'loading' | 'ok' | 'error'
  result?: LookupResult
}

const RUNTIME_LOOKUP = 'runtime:lookup'
const RUNTIME_COLLECT = 'runtime:collect'
const RUNTIME_COLLECT_DONE = 'content:collect-done'

const MIN_WORD_LENGTH = 2
const MAX_WORD_LENGTH = 32
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'of', 'to', 'in', 'on', 'at', 'by',
  'for', 'with', 'as', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did',
  'have', 'has', 'had', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we',
  'they', 'them', 'his', 'her', 'our', 'their', 'my', 'your', 'me', 'us', 'so', 'not', 'no', 'yes',
  'will', 'would', 'can', 'could', 'should', 'may', 'might', 'must', 'from', 'into', 'than', 'too',
  'very', 'just', 'also', 'only', 'more', 'most', 'some', 'any', 'all', 'each', 'every', 'other',
])

/** 划选文本 → 去重单词数组 */
function tokenize(text: string): string[] {
  if (!text) return []
  const matches = text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of matches) {
    const cleaned = raw.replace(/['’-]+$/, '').trim()
    if (cleaned.length < MIN_WORD_LENGTH || cleaned.length > MAX_WORD_LENGTH) continue
    if (!/^[A-Za-z]+(?:['’-][A-Za-z]+)*$/.test(cleaned)) continue
    const key = cleaned.toLowerCase()
    if (STOP_WORDS.has(key) || seen.has(key)) continue
    seen.add(key)
    out.push(cleaned)
  }
  return out
}

// ---------- 气泡 UI（Shadow DOM 隔离，避免污染宿主页样式） ----------

const HOST_ID = 'vocab-helper-bubble-host'
let hostEl: HTMLDivElement | null = null
let shadow: ShadowRoot | null = null
let items: BubbleItem[] = []
let bubbleVisible = false

function ensureHost(): ShadowRoot {
  if (shadow) return shadow
  hostEl = document.createElement('div')
  hostEl.id = HOST_ID
  hostEl.style.all = 'initial'
  hostEl.style.position = 'absolute'
  hostEl.style.zIndex = '2147483647'
  hostEl.style.top = '0'
  hostEl.style.left = '0'
  document.documentElement.appendChild(hostEl)
  shadow = hostEl.attachShadow({ mode: 'open' })
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .bubble {
        position: fixed;
        min-width: 220px;
        max-width: 360px;
        max-height: 420px;
        overflow: auto;
        background: #ffffff;
        color: #1f2937;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        box-shadow: 0 8px 28px rgba(0,0,0,.16);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
        font-size: 13px;
        line-height: 1.5;
        padding: 10px 12px;
      }
      .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
      .head .title { font-size: 12px; font-weight: 600; color: #2f6b5c; }
      .head .actions { display: flex; gap: 6px; }
      .head button {
        font-size: 12px; padding: 3px 8px; border-radius: 6px; cursor: pointer;
        border: 1px solid #d1d5db; background: #fff; color: #374151;
      }
      .head button.primary { border: none; background: #2f6b5c; color: #fff; }
      .item { padding: 6px 0; border-top: 1px solid #f3f4f6; }
      .item:first-of-type { border-top: none; }
      .item .w { font-weight: 600; color: #111827; }
      .item .ph { color: #6b7280; font-size: 12px; margin-left: 6px; }
      .item .sense { color: #374151; font-size: 12px; }
      .item .sense .pos { color: #9ca3af; margin-right: 4px; }
      .item .err { color: #b91c1c; font-size: 12px; }
      .item .row { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
      .item button.collect {
        flex: none; font-size: 11px; padding: 2px 7px; border-radius: 5px; cursor: pointer;
        border: 1px solid #2f6b5c; background: #fff; color: #2f6b5c;
      }
      .item button.collect:disabled { border-color: #d1d5db; color: #9ca3af; cursor: default; }
      .empty { color: #9ca3af; font-size: 12px; }
      .footer { margin-top: 8px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
      .footer .count { font-size: 11px; color: #9ca3af; }
      .footer button.clear { font-size: 11px; padding: 2px 7px; border-radius: 5px; cursor: pointer; border: 1px solid #d1d5db; background: #fff; color: #6b7280; }
    </style>
    <div class="bubble" id="bubble"></div>
  `
  const bubble = shadow.getElementById('bubble')!
  bubble.addEventListener('mousedown', (e) => e.stopPropagation())
  return shadow
}

function render(position: { x: number; y: number }) {
  const root = ensureHost()
  const bubble = root.getElementById('bubble') as HTMLDivElement

  const collected = items.filter((i) => i.status === 'ok').length
  const listHtml = items
    .map((item, idx) => {
      if (item.status === 'loading') {
        return `<div class="item"><span class="w">${escapeHtml(item.word)}</span> <span class="ph">查询中…</span></div>`
      }
      if (item.status === 'error' || !item.result) {
        const msg = item.result?.error ?? '查询失败'
        return `<div class="item"><div class="w">${escapeHtml(item.word)}</div><div class="err">${escapeHtml(msg)}</div></div>`
      }
      const r = item.result
      const senses = r.senses.length
        ? r.senses
            .slice(0, 4)
            .map((s) => `<div class="sense">${s.pos ? `<span class="pos">${escapeHtml(s.pos)}</span>` : ''}${escapeHtml(s.trans)}</div>`)
            .join('')
        : '<div class="empty">无释义</div>'
      return `<div class="item">
        <div class="row">
          <div>
            <span class="w">${escapeHtml(r.word || item.word)}</span>
            ${r.phonetic ? `<span class="ph">/${escapeHtml(r.phonetic)}/</span>` : ''}
          </div>
          <button class="collect" data-collect="${idx}">收藏</button>
        </div>
        ${senses}
      </div>`
    })
    .join('')

  bubble.innerHTML = `
    <div class="head">
      <span class="title">划词释义</span>
      <span class="actions">
        <button class="primary" id="collectAll">全部收藏</button>
        <button id="closeBubble">关闭</button>
      </span>
    </div>
    ${listHtml || '<div class="empty">未识别到可查询的单词</div>'}
    <div class="footer">
      <span class="count">共 ${items.length} 个，已查 ${collected} 个</span>
      <button class="clear" id="clearBubble">清空</button>
    </div>
  `

  bubble.querySelectorAll('button[data-collect]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const idx = Number((btn as HTMLButtonElement).dataset.collect)
      void collectOne(idx)
    })
  })
  bubble.querySelector('#collectAll')?.addEventListener('click', (e) => {
    e.stopPropagation()
    void collectAll()
  })
  bubble.querySelector('#closeBubble')?.addEventListener('click', (e) => {
    e.stopPropagation()
    hideBubble()
  })
  bubble.querySelector('#clearBubble')?.addEventListener('click', (e) => {
    e.stopPropagation()
    items = []
    hideBubble()
  })

  // 定位在选区附近
  bubble.style.position = 'fixed'
  const rect = bubble.getBoundingClientRect()
  const maxX = window.innerWidth - rect.width - 8
  const maxY = window.innerHeight - rect.height - 8
  bubble.style.left = `${Math.max(8, Math.min(position.x, maxX))}px`
  bubble.style.top = `${Math.max(8, Math.min(position.y, maxY))}px`
  bubbleVisible = true
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}

function hideBubble() {
  if (shadow) {
    const bubble = shadow.getElementById('bubble') as HTMLDivElement | null
    if (bubble) bubble.innerHTML = ''
  }
  bubbleVisible = false
}

// ---------- 查词 ----------

async function lookupWord(word: string): Promise<LookupResult> {
  try {
    const res = await chrome.runtime.sendMessage({ type: RUNTIME_LOOKUP, word })
    return res as LookupResult
  } catch (e) {
    return { word, phonetic: '', senses: [], definitions: [], dictionaryExamples: [], error: (e as Error)?.message ?? '查询失败' }
  }
}

async function lookupAll(position: { x: number; y: number }) {
  render(position)
  // 串行查询，避免瞬时并发过多触发 r.jina.ai 限流
  for (let i = 0; i < items.length; i++) {
    if (items[i].status !== 'loading') continue
    const result = await lookupWord(items[i].word)
    items[i] = { word: items[i].word, status: result.error ? 'error' : 'ok', result }
    if (bubbleVisible) render(position)
  }
}

// ---------- 收藏 ----------

async function collectOne(idx: number) {
  const item = items[idx]
  if (!item || item.status !== 'ok' || !item.result) return
  const word = {
    word: item.result.word || item.word,
    phonetic: item.result.phonetic,
    definitions: item.result.definitions,
    dictionaryExamples: item.result.dictionaryExamples,
    sourceUrl: location.href,
    sourceTitle: document.title,
  }
  await chrome.runtime.sendMessage({ type: RUNTIME_COLLECT, words: [word], category: '' })
}

async function collectAll() {
  const words = items
    .filter((i) => i.status === 'ok' && i.result)
    .map((i) => ({
      word: i.result!.word || i.word,
      phonetic: i.result!.phonetic,
      definitions: i.result!.definitions,
      dictionaryExamples: i.result!.dictionaryExamples,
      sourceUrl: location.href,
      sourceTitle: document.title,
    }))
  if (words.length === 0) return
  await chrome.runtime.sendMessage({ type: RUNTIME_COLLECT, words, category: '' })
}

// ---------- 划词捕获 ----------

function handleSelection() {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) return
  const text = sel.toString().trim()
  if (!text) return
  const words = tokenize(text)
  if (words.length === 0) return

  const range = sel.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  const position = { x: rect.left, y: rect.bottom + 8 }

  items = words.map((w) => ({ word: w, status: 'loading' }))
  void lookupAll(position)
}

let selectionTimer: number | null = null
document.addEventListener('mouseup', () => {
  if (selectionTimer) window.clearTimeout(selectionTimer)
  selectionTimer = window.setTimeout(() => {
    handleSelection()
  }, 120)
})

document.addEventListener('mousedown', (e) => {
  // 点击气泡外时收起
  if (hostEl && e.composedPath().includes(hostEl)) return
  if (bubbleVisible) hideBubble()
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && bubbleVisible) hideBubble()
})

// ---------- 收藏结果回执 ----------

const TOAST_ID = 'vocab-helper-toast-host'
let toastHost: HTMLDivElement | null = null
let toastTimer: number | null = null

/** 轻量提示：收藏结果回执（气泡可能已收起，故独立于气泡） */
function showToast(message: string) {
  if (!toastHost) {
    toastHost = document.createElement('div')
    toastHost.id = TOAST_ID
    toastHost.style.cssText = 'all:initial;position:fixed;z-index:2147483647;'
    const shadow = toastHost.attachShadow({ mode: 'open' })
    shadow.innerHTML = `
      <style>
        .toast {
          position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%);
          background: rgba(31,41,55,.94); color: #fff; font-size: 13px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
          padding: 8px 16px; border-radius: 8px; box-shadow: 0 6px 20px rgba(0,0,0,.2);
          opacity: 0; transition: opacity .2s; pointer-events: none; white-space: nowrap;
        }
        .toast.show { opacity: 1; }
      </style>
      <div class="toast" id="toast"></div>
    `
    document.documentElement.appendChild(toastHost)
  }
  const toast = toastHost.shadowRoot!.getElementById('toast') as HTMLDivElement
  toast.textContent = message
  toast.classList.add('show')
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2600)
}

chrome.runtime.onMessage.addListener((message: any) => {
  if (message?.type !== RUNTIME_COLLECT_DONE) return
  const r = message.result
  if (!r) return
  if (r.added > 0) showToast(`已收藏 ${r.added} 个到「${r.category}」${r.skipped ? `，跳过 ${r.skipped} 个` : ''}`)
  else if (r.skipped > 0) showToast(`全部已存在，跳过 ${r.skipped} 个`)
  else if (r.errors?.length) showToast(r.errors[0])
})

console.debug('[划词词汇助手] content script 已加载')
