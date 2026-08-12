import { Link } from 'react-router-dom'

/** 404 兜底页：未知路径不再渲染空白 main */
export function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-gradient-mesh">
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
        <span className="text-white text-2xl font-bold">404</span>
      </div>
      <h1 className="text-2xl font-bold mb-2 dark:text-gray-100">页面不存在</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        你访问的页面不存在或已被移动
      </p>
      <Link to="/" className="btn-primary inline-flex items-center gap-1.5">
        返回首页
      </Link>
    </div>
  )
}
