import { Page } from '@playwright/test'

// 与 playwright.config.ts 的 BASE_URL 保持一致（带尾斜杠）
const BASE = process.env.PW_BASE_URL || 'http://127.0.0.1:5199/web_vocabulary/'

/** 构造带 base 路径的完整 URL，避免 goto 相对路径丢失 base */
export function url(path: string): string {
  // path 形如 "/add" → 拼接成 "/web_vocabulary/add"
  return new URL(path.replace(/^\//, ''), BASE).toString()
}

export { BASE }
