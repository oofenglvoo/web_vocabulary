import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Trash2 } from 'lucide-react'

interface ConfirmModalProps {
  title: string
  message?: ReactNode
  confirmText?: string
  cancelText?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** 统一的确认弹窗，替代 window.confirm，支持暗色与样式一致 */
export function ConfirmModal({
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div className="modal-overlay">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300 }}
        className="modal-content max-w-xs text-center"
      >
        <div
          className={`w-14 h-14 mx-auto mb-3 rounded-2xl ${
            danger ? 'bg-gradient-warn' : 'bg-gradient-primary'
          } flex items-center justify-center shadow-glow`}
        >
          <Trash2 size={28} className="text-white" />
        </div>
        <h3 className="font-bold text-lg mb-1 dark:text-gray-100">{title}</h3>
        {message && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{message}</p>
        )}
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-secondary flex-1">
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm()
              onCancel()
            }}
            className={`${danger ? 'btn-danger' : 'btn-primary'} flex-1`}
          >
            {confirmText}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
