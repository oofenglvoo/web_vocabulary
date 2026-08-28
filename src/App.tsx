import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ToastProvider } from './components/Toast'
import { ErrorBoundary } from './components/ErrorBoundary'
import { NotFound } from './components/NotFound'
import { Home } from './pages/Home'
import { LangProvider, useSetLang } from './context/Language'
import { initDefaultCategories, dedupeCategories } from './hooks/useWords'
import { ensureDefaultFolder, ensureJapaneseDefaultFolder } from './hooks/useFavorites'

// 按需加载重页面，减小首屏 bundle
const Study = lazy(() => import('./pages/Study').then((m) => ({ default: m.Study })))
const WordList = lazy(() => import('./pages/WordList').then((m) => ({ default: m.WordList })))
const AddWord = lazy(() => import('./pages/AddWord').then((m) => ({ default: m.AddWord })))
const WordDetail = lazy(() => import('./pages/WordDetail').then((m) => ({ default: m.WordDetail })))
const Stats = lazy(() => import('./pages/Stats').then((m) => ({ default: m.Stats })))
const ImportWords = lazy(() => import('./pages/ImportWords').then((m) => ({ default: m.ImportWords })))
const ImportSentences = lazy(() => import('./pages/ImportSentences').then((m) => ({ default: m.ImportSentences })))
const Favorites = lazy(() => import('./pages/Favorites').then((m) => ({ default: m.Favorites })))
const Categories = lazy(() => import('./pages/Categories').then((m) => ({ default: m.Categories })))
const CategoryDetail = lazy(() => import('./pages/CategoryDetail').then((m) => ({ default: m.CategoryDetail })))
const StudyPlanPage = lazy(() => import('./pages/StudyPlan').then((m) => ({ default: m.StudyPlanPage })))
const PlanWordList = lazy(() => import('./pages/StudyPlan').then((m) => ({ default: m.PlanWordList })))
const Sentences = lazy(() => import('./pages/Sentences').then((m) => ({ default: m.Sentences })))
const AddSentence = lazy(() => import('./pages/AddSentence').then((m) => ({ default: m.AddSentence })))
const SentenceDetail = lazy(() => import('./pages/SentenceDetail').then((m) => ({ default: m.SentenceDetail })))
const SentenceStudy = lazy(() => import('./pages/SentenceStudy').then((m) => ({ default: m.SentenceStudy })))
const CheckIn = lazy(() => import('./pages/CheckIn').then((m) => ({ default: m.CheckIn })))

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
    </div>
  )
}

/** 旧 /japanese/* 链接重定向到统一页面，并把语言切到日语 */
function JapaneseRedirect({ to }: { to: string }) {
  const setLang = useSetLang()
  useEffect(() => {
    setLang('ja')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <Navigate to={to} replace />
}

function App() {
  useEffect(() => {
    // 全新数据库不会执行 Dexie upgrade 回调，默认收藏夹需在启动时惰性确保存在
    initDefaultCategories()
    // 修复历史版本并发播种造成的同名重复分类（幂等）
    dedupeCategories().catch(() => {})
    ensureDefaultFolder().catch(() => {})
    ensureJapaneseDefaultFolder().catch(() => {})
  }, [])
  return (
    <ErrorBoundary>
      <LangProvider>
        <ToastProvider>
          {/* basename 默认按 GitHub Pages 部署;安卓 APK 打包时由 vite.config.ts 注入为 '/' */}
          <BrowserRouter basename={import.meta.env.VITE_APP_BASE || '/web_vocabulary'}>
            <Layout>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/study" element={<Study />} />
                  <Route path="/words" element={<WordList />} />
                  <Route path="/add" element={<AddWord />} />
                  <Route path="/import" element={<ImportWords />} />
                  <Route path="/sentences" element={<Sentences />} />
                  <Route path="/sentences/add" element={<AddSentence />} />
                  <Route path="/sentences/import" element={<ImportSentences />} />
                  <Route path="/sentences/study" element={<SentenceStudy />} />
                  <Route path="/sentence/:id" element={<SentenceDetail />} />
                  <Route path="/favorites" element={<Favorites />} />
                  <Route path="/categories" element={<Categories />} />
                  <Route path="/categories/:name" element={<CategoryDetail />} />
                  <Route path="/word/:id" element={<WordDetail />} />
                  <Route path="/plan" element={<StudyPlanPage />} />
                  <Route path="/plan/:id/words" element={<PlanWordList />} />
                  <Route path="/stats" element={<Stats />} />
                  <Route path="/checkin" element={<CheckIn />} />
                  {/* 旧日语路由 → 统一页面（自动切换语言） */}
                  <Route path="/japanese" element={<JapaneseRedirect to="/words" />} />
                  <Route path="/japanese/study" element={<JapaneseRedirect to="/study" />} />
                  <Route path="/japanese/plan" element={<JapaneseRedirect to="/plan" />} />
                  <Route path="/japanese/favorites" element={<JapaneseRedirect to="/favorites" />} />
                  <Route path="/japanese/import" element={<JapaneseRedirect to="/import" />} />
                  <Route path="/japanese/:id" element={<JapaneseRedirectFallback />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </Layout>
          </BrowserRouter>
        </ToastProvider>
      </LangProvider>
    </ErrorBoundary>
  )
}

/** /japanese/:id → /word/:id（Navigate 无法做参数拼接，用小组件转换） */
function JapaneseRedirectFallback() {
  const setLang = useSetLang()
  useEffect(() => {
    setLang('ja')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // 从当前路径提取词条 id
  const id = window.location.pathname.split('/').pop()
  return <Navigate to={`/word/${id}`} replace />
}

export default App
