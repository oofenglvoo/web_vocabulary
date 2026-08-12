import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

const DARK_KEY = 'vocab.dark'

function initDarkMode() {
  if (typeof localStorage === 'undefined') return
  const saved = localStorage.getItem(DARK_KEY)
  if (saved === 'true') {
    document.documentElement.classList.add('dark')
  } else if (saved === 'false') {
    document.documentElement.classList.remove('dark')
  } else {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark')
    }
  }
}

initDarkMode()

export function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark')
}

export function toggleDarkMode(): boolean {
  const next = !document.documentElement.classList.contains('dark')
  document.documentElement.classList.toggle('dark', next)
  localStorage.setItem(DARK_KEY, String(next))
  return next
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
