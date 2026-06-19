import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Plus, Upload } from 'lucide-react'
import { useAllWords, toggleFavorite, deleteWord } from '../hooks/useWords'
import { WordCard } from '../components/WordCard'

export function WordList() {
  const navigate = useNavigate()
  const words = useAllWords()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('全部')

  const categories = ['全部', ...new Set(words.map((w) => w.category))]

  const filtered = words.filter((w) => {
    const matchSearch =
      search === '' ||
      w.word.toLowerCase().includes(search.toLowerCase()) ||
      w.definition.toLowerCase().includes(search.toLowerCase()) ||
      w.translation.includes(search)
    const matchCategory = category === '全部' || w.category === category
    return matchSearch && matchCategory
  })

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">单词列表</h1>
        <div className="flex gap-2">
          <Link to="/import" className="btn-secondary flex items-center gap-1">
            <Upload size={18} /> 导入
          </Link>
          <Link to="/add" className="btn-primary flex items-center gap-1">
            <Plus size={18} /> 添加
          </Link>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索单词、释义..."
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:border-primary-600 focus:outline-none"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
              category === cat
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>{search ? '未找到匹配的单词' : '暂无单词'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((word) => (
            <WordCard
              key={word.id}
              word={word}
              onClick={() => navigate(`/word/${word.id}?scope=all`)}
              onFavorite={() => toggleFavorite(word.id!, word.isFavorite)}
              onDelete={() => { if (confirm('确定删除?')) deleteWord(word.id!) }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
