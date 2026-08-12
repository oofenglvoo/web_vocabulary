# 单词记忆 (Web版)

基于 React + TypeScript + Vite + Tailwind CSS + Dexie.js 的网页版英语/日语单词与短句记忆应用。纯本地存储，免登录、无后端，支持 GitHub Pages 与安卓 APK（Capacitor）部署。

## 功能特性

### 学习内容
- **单词管理**: 添加、查看、删除单词，支持音标、多释义（definitions 数组）、例句、翻译、分类、难度、笔记
- **短句/短语**: 与单词平行的独立实体，支持多翻译、分类、例句、SRS 复习

### 学习体验（复刻 Moji辞书）
- **三种学习题型**（新学/复习可分别配置）:
  - **回忆式**: 点卡片翻面看释义，自评「认识 / 模糊 / 忘记」。认识 → 通过不再重复；模糊/忘记 → 重排到队尾，重复直到认识
  - **选择题**: 看词选义（四选一），答错在复习时重排
  - **快速自测**: 逐条翻卡，全部看完后一次性批量提交掌握情况
- **艾宾浩斯 7 周期 SRS**: 间隔 1-2-4-7-10-15-20 天，连续答对晋级，答错停留当前周期，第 7 周期全对 = 已掌握

### 学习计划
- **单词计划 / 短句计划** 独立创建，来源可选分类 / 收藏夹 / 全部
- 每日新词配额 + 复习配额，各计划进度独立（同一分类多计划互不串味）
- **加学入口**: 今日新词学满后，可"加学"独立一轮（不计入今日配额）
- 已掌握的词全局共享，不再作为任何计划的新词

### 打卡与激励
- **打卡日历**: 月视图，每天内圈=新学完成、外圈=复习完成；累计天数 / 连续天数 / 累计分钟
- **成就勋章**: 累计学习次数、连续天数、已掌握数、创建计划数，解锁 13 枚勋章

### 其他
- **语音朗读**: 有道真人发音，失败回退浏览器 SpeechSynthesis；自动检测日语（假名 → ja-JP 语音）
- **暗色模式**: 跟随系统或手动切换
- **批量导入/导出**: JSON / CSV / Text 多格式，支持多释义（definitions 数组）
- **搜索**: 子串 + 拼音首字母 + 模糊匹配
- **本地存储**: IndexedDB (Dexie.js) 持久化，无需后端

## 技术栈

- React 18 + TypeScript
- Vite (构建工具) + Capacitor (安卓打包)
- Tailwind CSS (样式)
- React Router (路由)
- Dexie.js (IndexedDB 封装)
- framer-motion (动画)、canvas-confetti (庆祝效果)
- lucide-react (图标)

## 安装与运行

```bash
# 进入项目目录
cd web-vocabulary-app

# 安装依赖
npm install

# 开发服务器
npm run dev

# 构建生产版本（Web，GitHub Pages）
npm run build

# 安卓 APK 打包（需先配置 Capacitor）
npm run build:android   # VITE_ANDROID=1 tsc && vite build
```

## 部署

- **GitHub Pages**: `npm run deploy`（构建到 `dist/` 并推送 gh-pages 分支，base 为 `/web_vocabulary/`）
- **安卓**: `VITE_ANDROID=1 npm run build` 构建到 `dist-android/`，配合 Capacitor 打包 APK（base 为 `/`）

## 项目结构

```
src/
  components/     # 通用组件 (Layout, StatCard, WordCard, SentenceCard, ConfirmModal, ErrorBoundary)
    study/        # 学习题型组件 (RecallMode, ChoiceMode, QuickMode, FlipCard)
  pages/          # 页面 (Home, Study, WordList, AddWord, WordDetail, Stats, Sentences, SentenceStudy, StudyPlan, CheckIn, ...)
  hooks/          # 数据操作 hooks (useWords, useSentences, useStudyPlan, useSentencePlan, useCheckIn)
  db/             # Dexie 数据库配置与迁移
  types/          # TypeScript 类型定义
  utils/          # 工具函数 (srs 7周期算法, tts, import, export, search, achievements, studyPrefs)
```
