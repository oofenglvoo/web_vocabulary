import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ToastProvider } from './components/Toast'
import { Home } from './pages/Home'
import { Study } from './pages/Study'
import { WordList } from './pages/WordList'
import { AddWord } from './pages/AddWord'
import { WordDetail } from './pages/WordDetail'
import { Stats } from './pages/Stats'
import { ImportWords } from './pages/ImportWords'
import { ImportSentences } from './pages/ImportSentences'
import { Favorites } from './pages/Favorites'
import { Categories } from './pages/Categories'
import { CategoryDetail } from './pages/CategoryDetail'
import { StudyPlanPage, PlanWordList } from './pages/StudyPlan'
import { Sentences } from './pages/Sentences'
import { AddSentence } from './pages/AddSentence'
import { SentenceDetail } from './pages/SentenceDetail'
import { SentenceStudy } from './pages/SentenceStudy'
import { initDefaultCategories } from './hooks/useWords'

function App() {
  useEffect(() => {
    initDefaultCategories()
  }, [])
  return (
    <ToastProvider>
      <BrowserRouter basename="/web_vocabulary">
        <Layout>
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
          </Routes>
        </Layout>
      </BrowserRouter>
    </ToastProvider>
  )
}

export default App
