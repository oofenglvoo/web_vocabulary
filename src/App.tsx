import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Study } from './pages/Study'
import { WordList } from './pages/WordList'
import { AddWord } from './pages/AddWord'
import { WordDetail } from './pages/WordDetail'
import { Stats } from './pages/Stats'
import { ImportWords } from './pages/ImportWords'
import { Favorites } from './pages/Favorites'
import { Categories } from './pages/Categories'
import { CategoryDetail } from './pages/CategoryDetail'
import { StudyPlanPage } from './pages/StudyPlan'
import { initDefaultCategories } from './hooks/useWords'

function App() {
  useEffect(() => {
    initDefaultCategories()
  }, [])
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/study" element={<Study />} />
          <Route path="/words" element={<WordList />} />
          <Route path="/add" element={<AddWord />} />
          <Route path="/import" element={<ImportWords />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/categories/:name" element={<CategoryDetail />} />
          <Route path="/word/:id" element={<WordDetail />} />
          <Route path="/plan" element={<StudyPlanPage />} />
          <Route path="/stats" element={<Stats />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
