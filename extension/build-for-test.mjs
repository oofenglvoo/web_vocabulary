// 扩展测试构建：把词典代理前缀指向本地 mock 服务器，再构建 extension/dist。
// 供 playwright 扩展测试使用（offscreen 的 fetch 无法被 Playwright 路由拦截，只能改端点）。
import { build } from 'vite'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const here = fileURLToPath(new URL('.', import.meta.url))
process.env.VITE_DICT_PROXY = process.env.VITE_DICT_PROXY || 'http://127.0.0.1:5397/'

await build({
  configFile: resolve(here, 'vite.config.ts'),
})
console.log(`[build-extension:test] VITE_DICT_PROXY=${process.env.VITE_DICT_PROXY}`)
