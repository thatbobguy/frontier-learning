/**
 * Narration through the browser's built-in speech voice. It is a stand-in for a
 * premium voice (for example ElevenLabs) and keeps the same shape: speak a line,
 * resolve when it ends.
 */

export interface SpeakOptions {
  /** 'narrator' tells the story; 'tutor' is Pip's voice, a little higher and quicker. */
  voice?: 'narrator' | 'tutor'
  /** Called with the character index of each word as it is spoken, for caption highlighting. */
  onWord?: (charIndex: number) => void
}

const PREFERRED = [
  'Google US English',
  'Microsoft Aria Online (Natural) - English (United States)',
  'Microsoft Jenny Online (Natural) - English (United States)',
  'Samantha',
  'Karen',
  'Moira',
  'Daniel',
]

let voices: SpeechSynthesisVoice[] = []
let muted = false
let current: { cancel: () => void } | null = null

function loadVoices() {
  if (!('speechSynthesis' in window)) return
  voices = window.speechSynthesis.getVoices()
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices()
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices)
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  for (const name of PREFERRED) {
    const v = voices.find((x) => x.name === name)
    if (v) return v
  }
  return voices.find((v) => v.lang?.startsWith('en') && v.localService) ?? voices.find((v) => v.lang?.startsWith('en'))
}

/** Roughly how long a line takes to say, used when speech is muted or unavailable. */
export function estimateSeconds(text: string) {
  const words = text.trim().split(/\s+/).length
  return Math.max(1.6, words / 2.5 + 0.5)
}

export function setMuted(value: boolean) {
  muted = value
  if (value) stop()
}

export function isMuted() {
  return muted
}

export function speechAvailable() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** Stops whatever is being said. The pending speak() promise resolves as cancelled. */
export function stop() {
  current?.cancel()
  current = null
  if (speechAvailable()) window.speechSynthesis.cancel()
}

/**
 * Says a line. Resolves true when it finishes, false if it was stopped first.
 * When muted, or when the browser has no voice, it waits about as long as the line
 * would take, so captions still pace the lesson.
 */
export function speak(text: string, opts: SpeakOptions = {}): Promise<boolean> {
  stop()
  return new Promise((resolve) => {
    let settled = false
    const timers: number[] = []
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      timers.forEach((t) => window.clearTimeout(t))
      if (current === handle) current = null
      resolve(ok)
    }
    const handle = {
      cancel: () => {
        if (speechAvailable()) window.speechSynthesis.cancel()
        finish(false)
      },
    }
    current = handle

    const est = estimateSeconds(text)
    if (muted || !speechAvailable()) {
      // Fake word timing so the caption highlight still moves.
      if (opts.onWord) {
        const words = [...text.matchAll(/\S+/g)]
        words.forEach((m, i) => {
          timers.push(window.setTimeout(() => opts.onWord?.(m.index ?? 0), (i / words.length) * est * 1000))
        })
      }
      timers.push(window.setTimeout(() => finish(true), est * 1000))
      return
    }

    const u = new SpeechSynthesisUtterance(text)
    const v = pickVoice()
    if (v) u.voice = v
    u.lang = v?.lang ?? 'en-US'
    if (opts.voice === 'tutor') {
      u.rate = 1.02
      u.pitch = 1.35
    } else {
      u.rate = 0.94
      u.pitch = 1.02
    }
    u.onboundary = (e) => {
      if (e.name === 'word' || e.name === undefined) opts.onWord?.(e.charIndex)
    }
    u.onend = () => finish(true)
    u.onerror = (e) => finish(e.error !== 'interrupted' && e.error !== 'canceled')
    // Some browsers never fire onend; this keeps the lesson from stalling.
    timers.push(window.setTimeout(() => finish(true), (est * 2 + 3) * 1000))
    window.speechSynthesis.speak(u)
  })
}
