import { defineConfig } from '@playwright/test'

// 扩展端到端测试专用配置。
// 扩展需要真实加载到 Chrome（launchPersistentContext），与 web spec 的 fixture 模型不同，
// 因此单独一份配置，避免改动主 playwright.config.ts。
//
// 运行：npx playwright test --config playwright.extension.config.ts
// 前置：先执行 npm run build:extension 生成 extension/dist。
export default defineConfig({
  testDir: './tests',
  testMatch: /extension\.spec\.ts/,
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
