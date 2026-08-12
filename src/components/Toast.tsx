import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: number
  type: ToastType
  message: string
  duration: number
}

interface ToastContextValue {
  toast: (type: ToastType, message: string, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

let toastId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((type: ToastType, message: string, duration = 3000) => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, type, message, duration }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: Toast[]
  onRemove: (id: number) => void
}) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none max-w-md w-full px-4">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), toast.duration)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onRemove])

  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle size={18} className="text-emerald-500 shrink-0" />,
    error: <XCircle size={18} className="text-red-500 shrink-0" />,
    warning: <AlertCircle size={18} className="text-amber-500 shrink-0" />,
    info: <Info size={18} className="text-primary-500 shrink-0" />,
  }

  const bgMap: Record<ToastType, string> = {
    success: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/40 dark:border-emerald-800',
    error: 'bg-red-50 border-red-200 dark:bg-red-900/40 dark:border-red-800',
    warning: 'bg-amber-50 border-amber-200 dark:bg-amber-900/40 dark:border-amber-800',
    info: 'bg-primary-50 border-primary-200 dark:bg-primary-900/40 dark:border-primary-800',
  }

  return (
    <div
      className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-card backdrop-blur-sm animate-slide-up ${bgMap[toast.type]}`}
    >
      {icons[toast.type]}
      <span className="text-sm font-medium text-gray-800 dark:text-gray-100 flex-1">
        {toast.message}
      </span>
      <button
        onClick={() => onRemove(toast.id)}
        className="shrink-0 p-0.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      >
        <X size={14} className="text-gray-400" />
      </button>
    </div>
  )
}
