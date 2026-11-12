import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// 扩展独立构建：输出到 extension/dist/
// MV3 要求 background service worker 与 content script 文件名稳定（不能带 hash），
// 因此对这些入口关闭 hash，popup 走标准 HTML 入口。
export default defineConfig({
  root: resolve(__dirname),
  publicDir: resolve(__dirname, 'public'),
  // 词典代理前缀：测试构建时可指向本地 mock 服务器（默认 r.jina.ai）
  define: {
    'import.meta.env.VITE_DICT_PROXY': JSON.stringify(process.env.VITE_DICT_PROXY || 'https://r.jina.ai/'),
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        offscreen: resolve(__dirname, 'src/offscreen/index.html'),
        background: resolve(__dirname, 'src/background.ts'),
        content: resolve(__dirname, 'src/content.ts'),
      },
      output: {
        // 入口文件用固定名（对应 manifest / offscreen.createDocument 中的路径）
        entryFileNames: (chunk) => {
          if (chunk.name === 'background' || chunk.name === 'content') {
            return 'src/[name].js'
          }
          return 'assets/[name]-[hash].js'
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
