import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_ANDROID=1: 打包安卓 APK 专用(webDir=dist-android, base='/' 适配 WebView 的 https://localhost)
// 否则为 web 部署(默认 base=/web_vocabulary/, outDir=dist),兼容 GitHub Pages
// VITE_BASE / VITE_OUT_DIR 可单独覆盖上述默认值
const isAndroid = process.env.VITE_ANDROID === '1'
const appBase = isAndroid ? '/' : process.env.VITE_BASE || '/web_vocabulary'

/** 让本地开发时无尾斜杠的 base URL 也能正常打开和刷新 */
function redirectBaseWithoutSlash(): Plugin {
  return {
    name: 'redirect-base-without-slash',
    configureServer(server) {
      if (appBase === '/') return
      server.middlewares.use((req, res, next) => {
        const [pathname, query = ''] = (req.url || '').split('?')
        if (pathname !== appBase) {
          next()
          return
        }
        res.statusCode = 302
        res.setHeader('Location', `${appBase}/${query ? `?${query}` : ''}`)
        res.end()
      })
    },
  }
}

export default defineConfig({
  plugins: [redirectBaseWithoutSlash(), react()],
  base: isAndroid ? '/' : process.env.VITE_BASE || '/web_vocabulary/',
  build: {
    outDir: isAndroid ? 'dist-android' : process.env.VITE_OUT_DIR || 'dist',
  },
  // 注入客户端可读的 basename(绕过 shell 对 '/' 的路径转换)
  define: {
    'import.meta.env.VITE_APP_BASE': JSON.stringify(appBase),
  },
})
