# 测试说明

基于 **Playwright** 的浏览器端到端（E2E）测试套件，覆盖应用核心功能。

## 运行测试

```bash
# 全量运行（自动启动 dev server）
npm run test:e2e

# Playwright UI 模式（可视化查看每个步骤）
npm run test:e2e:ui

# 生成 HTML 测试报告
npx playwright test --reporter=html
npx playwright show-report   # 打开报告
```

## 测试覆盖（26 用例 / 11 文件）

| 文件 | 覆盖功能 |
|------|---------|
| `smoke.spec.ts` | 首页加载、添加单词 |
| `words.spec.ts` | 添加单词、多释义、搜索过滤、收藏、重复检测 |
| `study.spec.ts` | 回忆式（认识通过不再重复、忘记后重排） |
| `quick.spec.ts` | 快速自测（列表视图、展开释义、三选项自评） |
| `choice.spec.ts` | 选择题（选项显示、答对进入下一题） |
| `plan.spec.ts` | 创建学习计划、今日任务学习入口 |
| `review.spec.ts` | 学习入口、复习按钮可用性 |
| `extra.spec.ts` | 计划今日新词统计 |
| `sentences.spec.ts` | 添加短句、统计页、暗色模式切换 |
| `checkin.spec.ts` | 打卡页、打卡天数统计、分类显示 |
| `import.spec.ts` | 批量导入、导入后单词显示 |

## 测试隔离

每个测试使用独立浏览器上下文（Playwright 自动隔离 IndexedDB），互不干扰。
`e2e/helpers.ts` 提供 `url()` 构造带 base 路径的 URL。

## 发现的 Bug（已修复）

| Bug | 根因 | 修复 |
|-----|------|------|
| 切题型后界面不刷新 | `studyType` 渲染时读 localStorage，`setDone(false)` 为 no-op 不触发重渲染 | 新增 `studyTypeVersion` state 递增强制重渲染（`Study.tsx` / `SentenceStudy.tsx`） |

## 注意事项

- 串行运行（`workers: 1`），避免数据库状态冲突
- dev server 端口固定 5199，若占用会启动失败（先 `taskkill //F //IM node.exe`）
- 测试产物 `test-results/`、`playwright-report/` 已加入 `.gitignore`