import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * 顶层错误边界：任一页面渲染抛错时，兜底显示错误页并提供"重新加载"，
 * 而不是让整个应用白屏。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    // 上报 / 打印，便于排查
    console.error('[ErrorBoundary]', error)
  }

  private handleReset = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-gray-50 dark:bg-slate-900">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2 dark:text-gray-100">页面出错了</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            遇到一个意外错误，请重新加载。如果持续出现，可尝试清除浏览器数据。
          </p>
          <p className="text-xs text-red-500/70 mb-5 max-w-sm break-all">
            {this.state.error.message}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              重新加载
            </button>
            <button onClick={this.handleReset} className="btn-secondary">
              返回应用
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
