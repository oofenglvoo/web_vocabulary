// 单词发音工具
// 优先使用有道词典真人发音 API,失败回退到浏览器原生 Web Speech API。
//
// 有道发音地址: https://dict.youdao.com/dictvoice?audio=<word>&type=<1|2>
//   type=1 英音, type=2 美音
// 注意: 这是一个公开但非官方的接口,无 SLA 保证。

export type Accent = 'us' | 'uk'
export type TtsProvider = 'auto' | 'youdao' | 'native'

const ACCENT_KEY = 'vocab.tts.accent'
const PROVIDER_KEY = 'vocab.tts.provider'

export function getAccent(): Accent {
  if (typeof localStorage === 'undefined') return 'us'
  return (localStorage.getItem(ACCENT_KEY) as Accent) || 'us'
}

export function setAccent(accent: Accent) {
  localStorage.setItem(ACCENT_KEY, accent)
}

export function getProvider(): TtsProvider {
  if (typeof localStorage === 'undefined') return 'auto'
  return (localStorage.getItem(PROVIDER_KEY) as TtsProvider) || 'auto'
}

export function setProvider(provider: TtsProvider) {
  localStorage.setItem(PROVIDER_KEY, provider)
}

// ---- 原生 Web Speech ----
let synth: SpeechSynthesis | null = null
let voices: SpeechSynthesisVoice[] = []

// 平假名/片假名/假名扩展：用于自动检测日语
const JA_RE = /[぀-ヿㇰ-ㇿ・]/

export function isJapanese(text: string): boolean {
  return JA_RE.test(text)
}

export function initTts() {
  if (typeof window === 'undefined') return
  if (!('speechSynthesis' in window)) return
  synth = window.speechSynthesis
  voices = synth.getVoices()
  if (voices.length === 0) {
    synth.onvoiceschanged = () => {
      voices = synth!.getVoices()
    }
  }
}

function speakNative(word: string, accent: Accent, lang: 'en' | 'ja'): boolean {
  if (typeof window === 'undefined') return false
  if (!('speechSynthesis' in window)) return false
  if (!synth) initTts()
  if (!synth) return false
  // 重新读取,防止之前 voices 还没填充
  if (voices.length === 0) voices = synth.getVoices()

  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(word)
  if (lang === 'ja') {
    utterance.lang = 'ja-JP'
  } else {
    utterance.lang = accent === 'uk' ? 'en-GB' : 'en-US'
  }
  utterance.rate = 0.9
  const target = utterance.lang.toLowerCase()
  const voice =
    voices.find((v) => v.lang.toLowerCase() === target) ||
    (lang === 'ja'
      ? voices.find((v) => v.lang.toLowerCase().startsWith('ja'))
      : voices.find((v) => v.lang.toLowerCase().startsWith('en')))
  if (voice) utterance.voice = voice
  synth.speak(utterance)
  return true
}

// ---- 有道发音 ----
// 用 token 标识当前播放,旧的 token 不允许触发 fallback
let currentAudio: HTMLAudioElement | null = null
let speakToken = 0

function youdaoUrl(word: string, accent: Accent) {
  const type = accent === 'uk' ? 1 : 2
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type}`
}

/**
 * 播放有道音频。返回 'played' 表示已开始播放(不一定播完),'failed' 表示无法播放。
 * 关键点:只要 audio.play() 这个 Promise 成功 resolve,就认为播放成功——
 * 不再等 'ended',避免 5s 超时误触发 fallback 把已经在响的音频盖掉。
 */
function speakYoudao(word: string, accent: Accent, myToken: number): Promise<'played' | 'failed'> {
  return new Promise((resolve) => {
    if (typeof Audio === 'undefined') return resolve('failed')
    // 取消上一个
    if (currentAudio) {
      currentAudio.onerror = null
      currentAudio.onended = null
      try {
        currentAudio.pause()
      } catch {}
      currentAudio = null
    }

    const audio = new Audio(youdaoUrl(word, accent))
    audio.preload = 'auto'
    currentAudio = audio

    const onError = () => {
      if (currentAudio === audio) currentAudio = null
      // 只有当前 token 仍然是这次调用时才认定失败,否则是被新调用主动取消
      if (myToken === speakToken) resolve('failed')
      else resolve('played') // 不重要,反正不会用结果
    }
    audio.addEventListener('error', onError)

    // 网络/解码失败兜底:3s 内既没开始播也没出错,认为失败
    const failTimer = window.setTimeout(() => {
      if (audio.readyState < 2) {
        onError()
      }
    }, 3000)

    audio.addEventListener(
      'playing',
      () => {
        window.clearTimeout(failTimer)
        resolve('played')
      },
      { once: true }
    )
    audio.addEventListener('ended', () => {
      if (currentAudio === audio) currentAudio = null
    })

    audio.play().catch(() => {
      window.clearTimeout(failTimer)
      onError()
    })
  })
}

// ---- 对外统一接口 ----
export async function speakWord(
  word: string,
  opts: { accent?: Accent; lang?: 'en' | 'ja' } = {}
) {
  const w = (word || '').trim()
  if (!w) return
  const accent = opts.accent ?? getAccent()
  // 自动检测日语(含假名)，显式 lang 优先
  const lang: 'en' | 'ja' = opts.lang ?? (isJapanese(w) ? 'ja' : 'en')
  const provider = getProvider()
  const myToken = ++speakToken

  if (provider === 'native') {
    speakNative(w, accent, lang)
    return
  }

  if (provider === 'youdao' || provider === 'auto') {
    // 有道接口无日语音频保证，日语直接走原生语音
    if (lang === 'ja') {
      speakNative(w, accent, lang)
      return
    }
    const result = await speakYoudao(w, accent, myToken)
    // 如果当前 token 已经被新的播放请求顶替,直接返回,避免叠加播放
    if (myToken !== speakToken) return
    if (result === 'played') return
    // 有道失败 → 回退原生
    speakNative(w, accent, lang)
    return
  }
}

export function stopSpeaking() {
  speakToken++
  if (currentAudio) {
    try {
      currentAudio.pause()
    } catch {}
    currentAudio = null
  }
  if (synth) synth.cancel()
}

/** 用户首次交互时调用,解决某些浏览器自动播放策略和 voices 未加载的问题 */
export function unlockTts() {
  initTts()
  // 触发一次空 utterance 让 Chrome/Safari 解锁 speechSynthesis
  if (synth) {
    try {
      const u = new SpeechSynthesisUtterance('')
      u.volume = 0
      synth.speak(u)
      synth.cancel()
    } catch {}
  }
}
