# 单词记忆 (Web版)

基于 React + TypeScript + Vite + Tailwind CSS + Dexie.js 的网页版英语单词记忆应用。

## 功能特性

- **单词管理**: 添加、查看、删除单词，支持音标、释义、例句、翻译、分类、难度、笔记
- **智能复习**: 基于 SM-2 间隔重复算法，自动安排下次复习时间
- **三种学习模式**:
  - 闪卡模式: 先看单词，点击显示答案后自评
  - 测验模式: 四选一选择正确释义
  - 拼写模式: 根据释义拼写单词
- **语音朗读**: 浏览器原生 SpeechSynthesis API 发音
- **学习统计**: 总词量、已掌握、待复习、今日/本周正确率
- **分类管理**: 默认含 CET-4/6、雅思、托福、GRE 等分类，可自定义添加
- **数据导出**: 支持导出 JSON 和 CSV 格式
- **本地存储**: 使用 IndexedDB (Dexie.js) 持久化数据，无需后端

## 技术栈

- React 18 + TypeScript
- Vite (构建工具)
- Tailwind CSS (样式)
- React Router (路由)
- Dexie.js (IndexedDB 封装)
- lucide-react (图标)

## 安装与运行

```bash
# 进入项目目录
cd web-vocabulary-app

# 安装依赖
npm install

# 开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 构建产物

运行 `npm run build` 后，`dist/` 目录包含纯静态文件，可以:
- 直接用浏览器打开 `dist/index.html`
- 部署到任何静态托管服务 (GitHub Pages, Vercel, Netlify 等)

## 项目结构

```
src/
  components/    # 通用组件 (Layout, StatCard, WordCard)
  pages/         # 页面 (Home, Study, WordList, AddWord, WordDetail, Stats)
  hooks/         # 数据操作 hooks (useWords)
  db/            # Dexie 数据库配置
  types/         # TypeScript 类型定义
  utils/         # 工具函数 (SRS算法、TTS、导入导出)
```
