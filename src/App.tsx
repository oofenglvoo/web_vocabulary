import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ToastProvider } from './components/Toast'
import { ErrorBoundary } from './components/ErrorBoundary'
import { NotFound } from './components/NotFound'
import { Home } from './pages/Home'
import { initDefaultCategories } from './hooks/useWords'
import { ensureDefaultFolder } from './hooks/useFavorites'

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

function App() {
  useEffect(() => {
    // 全新数据库不会执行 Dexie upgrade 回调，默认收藏夹需在启动时惰性确保存在
    initDefaultCategories()
    ensureDefaultFolder().catch(() => {})
  }, [])
  return (
    <ErrorBoundary>
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
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </Layout>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App
