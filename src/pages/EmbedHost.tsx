// embed 精简模式宿主：仅在 ?embed=1 时渲染，用于被浏览器扩展 popup 以 iframe 内嵌。
// 不渲染完整 app，只挂 postMessage 监听并执行划词落库，保证 popup 秒开。

import { useEffect, useState } from 'react'
import {
  EMBED_MESSAGE,
  EMBED_PROTOCOL_VERSION,
  EmbedCollectPayload,
  EmbedCollectResultPayload,
  EmbedCategoryListPayload,
  EmbedCollectedWord,
} from '../utils/embedProtocol'
import { collectEmbedWords, listEmbedCategories, CollectSummary } from '../utils/embedBridge'

interface LastResult {
  category: string
  added: number
  skipped: number
  skippedWords: string[]
  errors: string[]
}

function isCollectPayload(data: any): data is EmbedCollectPayload {
  return data && data.type === EMBED_MESSAGE.collect && typeof data.requestId === 'string' && Array.isArray(data.words)
}

export function EmbedHost() {
  const [connected, setConnected] = useState(false)
  const [last, setLast] = useState<LastResult | null>(null)

  useEffect(() => {
    // 仅接受来自父窗口（扩展 popup）的消息
    const handler = async (event: MessageEvent) => {
      if (event.source !== window.parent) return
      const data = event.data

      if (data?.type === EMBED_MESSAGE.ping) {
        setConnected(true)
        window.parent.postMessage(
          { type: EMBED_MESSAGE.ready, version: EMBED_PROTOCOL_VERSION },
          '*'
        )
        return
      }

      if (data?.type === EMBED_MESSAGE.requestCategories) {
        try {
          const categories = await listEmbedCategories()
          const payload: EmbedCategoryListPayload = { type: EMBED_MESSAGE.categoryList, categories }
          window.parent.postMessage(payload, '*')
        } catch (e) {
          const payload: EmbedCategoryListPayload = { type: EMBED_MESSAGE.categoryList, categories: [] }
          window.parent.postMessage(payload, '*')
        }
        return
      }

      if (isCollectPayload(data)) {
        let summary: CollectSummary
        try {
          summary = await collectEmbedWords(data.words as EmbedCollectedWord[], data.category)
        } catch (e) {
          summary = {
            added: 0,
            skipped: 0,
            skippedWords: [],
            errors: [(e as Error)?.message ?? '收藏失败'],
            category: data.category,
          }
        }
        setLast({
          category: summary.category,
          added: summary.added,
          skipped: summary.skipped,
          skippedWords: summary.skippedWords,
          errors: summary.errors,
        })
        const payload: EmbedCollectResultPayload = {
          type: EMBED_MESSAGE.collectResult,
          requestId: data.requestId,
          added: summary.added,
          skipped: summary.skipped,
          skippedWords: summary.skippedWords,
          errors: summary.errors,
          category: summary.category,
        }
        window.parent.postMessage(payload, '*')
      }
    }

    window.addEventListener('message', handler)
    // 主动告知父级：宿主已加载，可以握手
    window.parent.postMessage({ type: EMBED_MESSAGE.ready, version: EMBED_PROTOCOL_VERSION }, '*')
    return () => window.removeEventListener('message', handler)
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="text-sm text-gray-500 dark:text-gray-400">
        {connected ? '划词助手已连接' : '正在连接划词助手…'}
      </div>
      {last && (
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <div>
            已收藏 {last.added} 个到「{last.category}」
            {last.skipped > 0 ? `，跳过 ${last.skipped} 个已存在` : ''}
          </div>
          {last.errors.length > 0 && <div className="text-warn-500">{last.errors.join('；')}</div>}
        </div>
      )}
    </div>
  )
}
