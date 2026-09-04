import { Volume2 } from 'lucide-react'
import { speakWord } from '../utils/tts'

interface SpeakButtonProps {
  text: string
  /** 显式语言；不传则由 speakWord 自动检测（含假名→日语） */
  lang?: 'en' | 'ja'
  size?: number
  className?: string
  label?: string
}

/** 通用发音按钮：播放任意文本（例句等），点击不冒泡以免触发卡片翻面 */
export function SpeakButton({ text, lang, size = 16, className = '', label = '播放' }: SpeakButtonProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        speakWord(text, lang ? { lang } : undefined)
      }}
      className={`shrink-0 p-1 rounded-lg hover:bg-gray-200/70 dark:hover:bg-slate-600 transition-colors ${className}`}
      aria-label={label}
      title={label}
    >
      <Volume2 size={size} className="text-primary-500 dark:text-primary-400" />
    </button>
  )
}
