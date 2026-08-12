import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { initDarkMode } from './utils/theme'

initDarkMode()

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('找不到 #root 挂载点，请检查 index.html')
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
