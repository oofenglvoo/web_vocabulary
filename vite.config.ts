import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_ANDROID=1: 打包安卓 APK 专用(webDir=dist-android, base='/' 适配 WebView 的 https://localhost)
// 否则为 web 部署(默认 base=/web_vocabulary/, outDir=dist),兼容 GitHub Pages
// VITE_BASE / VITE_OUT_DIR 可单独覆盖上述默认值
const isAndroid = process.env.VITE_ANDROID === '1'
const appBase = isAndroid ? '/' : process.env.VITE_BASE || '/web_vocabulary'

export default defineConfig({
  plugins: [react()],
  base: isAndroid ? '/' : process.env.VITE_BASE || '/web_vocabulary/',
  build: {
    outDir: isAndroid ? 'dist-android' : process.env.VITE_OUT_DIR || 'dist',
  },
  // 注入客户端可读的 basename(绕过 shell 对 '/' 的路径转换)
  define: {
    'import.meta.env.VITE_APP_BASE': JSON.stringify(appBase),
  },
})
