import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

interface BackButtonProps {
  className?: string
  onBack?: () => void
}

export function BackButton({ className = '', onBack }: BackButtonProps) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => onBack ? onBack() : navigate(-1)}
      aria-label="返回"
      className={`p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors ${className}`}
    >
      <ArrowLeft size={22} />
    </button>
  )
}
