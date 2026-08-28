// 单词发音工具
// 优先使用在线真人/合成音频,失败回退到浏览器原生 Web Speech API。
//
// 英语: 有道词典真人发音 https://dict.youdao.com/dictvoice?audio=<word>&type=<1|2>
//   type=1 英音, type=2 美音
// 日语: Google 翻译 TTS https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=<word>
//   (有道 dictvoice 对日文只返回无效音频,不能用作日语发音源)
// 注意: 两者均为公开但非官方的接口,无 SLA 保证。

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

// 平假名/片假名/假名扩展/长音符/日文引号/小写假名：用于自动检测日语
// 注：纯汉字(如「日本」)无法可靠区分中文/日文，此处只覆盖含假名或日文特有字符的词
const JA_RE = /[぀-ヿㇰ-ㇿ・ー「」『』ぁぃぅぇぉゃゅょゎゕゖっんゔ]/

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
    // 日语 0.9 倍速听感拖沓,用默认语速更自然
    utterance.rate = 1
  } else {
    utterance.lang = accent === 'uk' ? 'en-GB' : 'en-US'
    utterance.rate = 0.9
  }
  // 候选按语言前缀筛选,再优先挑选更自然的音色:
  // Edge 的 Online (Natural) 神经语音 > Chrome 的 Google 网络语音 > 其余本地音色
  const target = utterance.lang.toLowerCase()
  const prefix = target.split('-')[0]
  const candidates = voices.filter((v) => {
    const vl = v.lang.toLowerCase().replace('_', '-')
    return vl === target || vl.startsWith(prefix)
  })
  const voice =
    candidates.find((v) => /natural/i.test(v.name)) ||
    candidates.find((v) => /google/i.test(v.name)) ||
    candidates[0]
  if (voice) utterance.voice = voice
  synth.speak(utterance)
  return true
}

// ---- 在线音频(有道/Google) ----
// 用 token 标识当前播放,旧的 token 不允许触发 fallback
let currentAudio: HTMLAudioElement | null = null
let speakToken = 0

function youdaoUrl(word: string, accent: Accent) {
  const type = accent === 'uk' ? 1 : 2
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type}`
}

function googleTtsUrl(word: string) {
  // 仅用于日语发音(英语走有道真人音频)
  return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=${encodeURIComponent(word.slice(0, 200))}`
}

/**
 * 播放在线音频。返回 'played' 表示已开始播放(不一定播完),'failed' 表示无法播放。
 * 关键点:只要 audio.play() 这个 Promise 成功 resolve,就认为播放成功——
 * 不再等 'ended',避免 5s 超时误触发 fallback 把已经在响的音频盖掉。
 */
function speakRemoteAudio(url: string, myToken: number): Promise<'played' | 'failed'> {
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

    const audio = new Audio(url)
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

  if (lang === 'ja') {
    // 有道 dictvoice 对日文返回无效音频;自动模式下日语改用 Google 翻译 TTS
    if (provider === 'auto') {
      const result = await speakRemoteAudio(googleTtsUrl(w), myToken)
      if (myToken !== speakToken) return
      if (result === 'played') return
    }
    speakNative(w, accent, lang)
    return
  }

  const result = await speakRemoteAudio(youdaoUrl(w, accent), myToken)
  // 如果当前 token 已经被新的播放请求顶替,直接返回,避免叠加播放
  if (myToken !== speakToken) return
  if (result === 'played') return
  // 在线发音失败 → 回退原生
  speakNative(w, accent, lang)
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
