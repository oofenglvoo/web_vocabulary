# 单词记忆 (Web版)

基于 React + TypeScript + Vite + Tailwind CSS + Dexie.js 的网页版英语/日语单词与短句记忆应用。纯本地存储，免登录、无后端，支持 GitHub Pages 与安卓 APK（Capacitor）部署。

## 功能特性

### 双语言记忆（英语 / 日语）
- **统一页面架构**: 首页顶部「英语 / 日语」切换入口（默认英语，选择持久化），切换后单词库、学习、计划、收藏、分类、统计、打卡全部切换到对应语言的数据源
- **日语词库**: 表记 + 假名读音（不使用罗马字）、多释义（词性/日文释义/中文翻译）、JLPT 等级、教材出处、例句三件套（例句/例句读音/例句翻译）
- **数据完全隔离**: 英语单词、短句、日语词分别为独立数据表；收藏夹、学习计划、分类、学习记录、连击天数均按语言独立
- **日语发音**: 学习卡片与词库发音按钮使用 `ja-JP` 语音
- **旧链接兼容**: 旧 `/japanese/*` 路由自动重定向到统一页面并切换语言

### 学习内容
- **单词管理**: 添加、查看、删除单词，支持音标、多释义（definitions 数组）、例句、翻译、分类、难度、笔记
- **短句/短语**: 与单词平行的独立实体（英语专属），支持多翻译、分类、例句、SRS 复习

### 学习体验（复刻 Moji辞书）
- **三种学习题型**（新学/复习可分别配置）:
  - **回忆式**: 点卡片翻面看释义，自评「认识 / 模糊 / 忘记」。认识 → 通过不再重复；模糊/忘记 → 重排到队尾，重复直到认识
  - **选择题**: 看词选义（四选一），答错在复习时重排
  - **快速自测**: 列表视图同时列出所有词，点击展开释义，逐词点选「忘记 / 记得 / 掌握」（掌握=永久标记已掌握），选后自动展开下一个，全部评完后统一提交
- **艾宾浩斯 7 周期 SRS**: 间隔 1-2-4-7-10-15-20 天，连续答对晋级，答错停留当前周期，第 7 周期全对 = 已掌握

### 学习计划
- **单词计划 / 短句计划** 独立创建，来源可选分类 / 收藏夹 / 全部；日语模式使用独立的日语计划表，能力与英语对齐（激活/归档/删除/编辑/同步/加学）
- 每日新词配额 + 复习配额，各计划进度独立（同一分类多计划互不串味）
- **今日新词学满后**点「学习」弹确认框，可选择"额外学习"再学一轮（不计入今日配额，仅计入 startedIds）
- **今日新词统计**显示配额内 + 额外学习的总数（如 20/10）
- 复习队列按剩余量加载（到期总数 - 今日已完成），与显示一致
- 已掌握的词全局共享，不再作为任何计划的新词

### 打卡与激励
- **打卡日历**: 月视图，每天内圈=新学完成、外圈=复习完成；累计天数 / 连续天数 / 累计分钟（按当前语言独立计算）
- **成就勋章**: 累计学习次数、连续天数、已掌握数、创建计划数，解锁 13 枚勋章（按当前语言的进度解锁）

### 其他
- **语音朗读**: 有道真人发音，失败回退浏览器 SpeechSynthesis；自动检测日语（假名 → ja-JP 语音）
- **暗色模式**: 跟随系统或手动切换
- **批量导入/导出**: JSON / CSV / Text 多格式，支持多释义（definitions 数组）；日语支持 JSON 导入（兼容 expression/kana 别名，自动创建缺失的日语分类）；完整备份包含全部语言数据
- **收藏夹**: 多目录收藏、默认收藏到上次目录、成功提示可跳转其他目录（英语/短句与日语各自独立一套收藏夹）
- **搜索**: 子串 + 拼音首字母 + 模糊匹配（日语按表记/假名/词性/教科书/释义检索）
- **分类语言隔离**: 分类归属语言（en/ja），各语言只见自己的分类；导入时缺失的日语分类自动创建
- **本地存储**: IndexedDB (Dexie.js v14) 持久化，无需后端

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

# 运行 E2E 测试（95 用例，含语言切换/数据隔离回归）
npm run test:e2e

# 安卓 APK 打包（需先配置 Capacitor）
npm run build:android   # VITE_ANDROID=1 tsc && vite build
```

> 测试说明见 [`tests/TESTING.md`](tests/TESTING.md)，覆盖单词/短句/学习/计划/打卡/导入/分类/收藏等全功能模块；`tests/language.spec.ts` 为语言切换与数据隔离专项。

## 部署

- **GitHub Pages**: `npm run deploy`（构建到 `dist/` 并推送 gh-pages 分支，base 为 `/web_vocabulary/`）
- **安卓**: `VITE_ANDROID=1 npm run build` 构建到 `dist-android/`，配合 Capacitor 打包 APK（base 为 `/`）

## 项目结构

```
src/
  context/        # 全局上下文 (Language: 英语/日语切换与持久化)
  components/     # 通用组件 (Layout, StatCard, WordCard, JapaneseWordCard, SentenceCard, ConfirmModal, ErrorBoundary, ...)
    study/        # 学题型组件 (RecallMode, ChoiceMode, QuickMode, FlipCard)
  pages/          # 统一页面 (Home, Study, WordList, AddWord, WordDetail, Stats, Sentences, SentenceStudy, StudyPlan, CheckIn, Favorites, Categories, ...)
  hooks/          # 数据操作 hooks
    languageAware.tsx     # 语言感知数据层：统一页面按 lang 分发到英语/日语数据源
    useWords / useSentences / useStudyPlan / useSentencePlan   # 英语数据源
    useJapaneseWords / useJapaneseStudyPlan                    # 日语数据源
    useFavorites / useCheckIn                                  # 收藏夹与打卡
  db/             # Dexie 数据库配置与迁移 (v14: 分类语言归属)
  types/          # TypeScript 类型定义
  utils/          # 工具函数 (srs 7周期算法, tts, import, export, search, achievements, studyPrefs, categoryType)
```

## 架构说明：双语言统一页面

- 页面只有一套，通过 `useLang()` 读取当前语言，由 `hooks/languageAware.tsx` 把数据操作分发到对应语言的表（`words`/`sentences` 或 `japaneseWords`；收藏夹、计划、统计同理）
- 学习题型的 `StudyItem` 抽象统一两种词条：英语音标槽 / 日语假名槽，释义渲染由各语言映射函数提供
- 分类通过 `Category.lang` 字段隔离；日语导入自动创建缺失的日语分类
- 备份（`utils/backup.ts`）包含全部 11 张表，覆盖两种语言的完整数据
