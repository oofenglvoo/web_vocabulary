import { defineConfig, devices } from '@playwright/test'

// 测试访问路径：dev server 默认 base=/web_vocabulary/（必须带尾斜杠，否则 404）
const BASE_URL = process.env.PW_BASE_URL || 'http://127.0.0.1:5199/web_vocabulary/'

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: false,
  workers: 1, // 串行，避免 IndexedDB 数据互相干扰
  retries: 2, // 偶发时序失败的测试自动重试 2 次
  reporter: [['list'], ['html', { outputFolder: 'playwright-report' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // 每个测试用独立浏览器上下文，隔离 IndexedDB
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // 启动 dev server（--host 监听所有接口，避免 IPv6/IPv4 探测不一致）
  webServer: {
    command: 'npx vite --port 5199 --strictPort --host 0.0.0.0',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
