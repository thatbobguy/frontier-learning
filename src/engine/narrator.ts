/**
 * The lesson's voice. Lines recorded ahead of time with ElevenLabs (public/voice,
 * made by scripts/voice/render.mjs) play first. A sentence with no recording is
 * made on the spot with ElevenLabs when a key is set in Pip's settings, and
 * otherwise the whole line falls back to the browser's built-in voice.
 */
import { splitSentences, voiceKey, VOICE_CHOICES, type Clip, type VoiceManifest, type VoiceName } from './voiceKey'

export interface SpeakOptions {
  /** 'narrator' tells the story; 'tutor' is Pip's voice, a little higher and quicker. */
  voice?: VoiceName
  /** Called with the character index of each word as it is spoken, for caption highlighting. */
  onWord?: (charIndex: number) => void
}

const VOICE_DIR = `${import.meta.env.BASE_URL}voice/`
const LIVE_MODEL = 'eleven_flash_v2_5'
const LIVE_KEY_STORAGE = 'frontier-learning.elevenlabs-key'

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
let manifest: VoiceManifest | null = null
let liveKey = typeof window === 'undefined' ? '' : loadLiveVoiceKey()
let liveVoices: Promise<Record<VoiceName, string> | null> | null = null
const liveClips = new Map<string, Promise<{ src: string; words: [number, number][]; ms: number } | null>>()
const audio = typeof Audio === 'undefined' ? null : new Audio()

const manifestReady =
  typeof window === 'undefined'
    ? Promise.resolve()
    : fetch(`${VOICE_DIR}manifest.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((m: VoiceManifest | null) => {
          manifest = m && m.clips ? m : null
        })
        .catch(() => {})
// A stalled request for the list must never hold the lesson up: after a few seconds, carry on without it.
const manifestOrTimeout = typeof window === 'undefined' ? manifestReady : Promise.race([manifestReady, new Promise<void>((r) => window.setTimeout(r, 6000))])

function loadVoices() {
  if (!('speechSynthesis' in window)) return
  voices = window.speechSynthesis.getVoices()
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices()
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices)
}

// Some browsers (Safari) only let an audio element play after it has played once
// inside a tap or key press, so play a moment of silence on the first one.
if (typeof window !== 'undefined' && audio) {
  const unlock = () => {
    window.removeEventListener('pointerdown', unlock, true)
    window.removeEventListener('keydown', unlock, true)
    if (!audio.src) {
      audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
      audio.play().catch(() => {})
    }
  }
  window.addEventListener('pointerdown', unlock, true)
  window.addEventListener('keydown', unlock, true)
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

/** The ElevenLabs key saved in Pip's settings, if any. */
export function loadLiveVoiceKey(): string {
  try {
    return localStorage.getItem(LIVE_KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}

/** An ElevenLabs key from Pip's settings, used to voice lines that were not recorded ahead. */
export function setLiveVoiceKey(key: string) {
  try {
    if (key) localStorage.setItem(LIVE_KEY_STORAGE, key)
    else localStorage.removeItem(LIVE_KEY_STORAGE)
  } catch {
    /* storage can be blocked; the key then lasts only for this page */
  }
  if (key === liveKey) return
  liveKey = key
  liveVoices = null
  liveClips.clear()
}

/** Resolves once the list of recorded lines has loaded (or failed to), so line lengths are known. */
export function voiceReady() {
  return manifestOrTimeout
}

/** How long a line takes to say, in seconds: the recording's length when there is one, else an estimate. */
export function lineSeconds(text: string, voice: VoiceName = 'narrator') {
  const sentences = splitSentences(text)
  const clips = sentences.map((s) => manifest?.clips[voiceKey(voice, s)])
  if (sentences.length && clips.every(Boolean)) return clips.reduce((t, c) => t + c!.ms, 0) / 1000
  return estimateSeconds(text)
}

/** Starts downloading the recordings for lines that are about to be said. */
export function preloadLines(lines: string[], voice: VoiceName = 'narrator') {
  manifestReady.then(() => {
    if (!manifest) return
    for (const line of lines) {
      for (const s of splitSentences(line)) {
        const clip = manifest.clips[voiceKey(voice, s)]
        if (clip) fetch(VOICE_DIR + clip.file).catch(() => {})
      }
    }
  })
}

/** Stops whatever is being said. The pending speak() promise resolves as cancelled. */
export function stop() {
  current?.cancel()
  current = null
  if (speechAvailable()) window.speechSynthesis.cancel()
  audio?.pause()
}

interface Part {
  src: string
  words: [number, number][]
  ms: number
  /** Where this sentence starts in the whole line. */
  offset: number
}

async function liveVoiceIds(): Promise<Record<VoiceName, string> | null> {
  if (manifest?.voices?.narrator && manifest.voices.tutor) return manifest.voices
  liveVoices ??= fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': liveKey }, signal: AbortSignal.timeout(8000) })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then(({ voices: list }: { voices: { voice_id: string; name: string }[] }) => {
      const find = (role: VoiceName) =>
        VOICE_CHOICES[role].map((n) => list.find((v) => v.name.toLowerCase().startsWith(n.toLowerCase()))).find(Boolean) ?? list[0]
      const narrator = find('narrator')
      const tutor = find('tutor')
      return narrator && tutor ? { narrator: narrator.voice_id, tutor: tutor.voice_id } : null
    })
    .catch(() => null)
  return liveVoices
}

/** Makes one sentence with ElevenLabs right now. Results are kept for replays. */
function liveClip(voice: VoiceName, text: string) {
  const key = voiceKey(voice, text)
  let p = liveClips.get(key)
  if (!p) {
    p = (async () => {
      const ids = await liveVoiceIds()
      if (!ids) return null
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ids[voice]}/with-timestamps?output_format=mp3_44100_64`, {
        method: 'POST',
        headers: { 'xi-api-key': liveKey, 'content-type': 'application/json' },
        body: JSON.stringify({ text, model_id: LIVE_MODEL }),
        signal: AbortSignal.timeout(12000),
      })
      if (!res.ok) return null
      const data = (await res.json()) as {
        audio_base64: string
        alignment?: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] }
      }
      const bytes = Uint8Array.from(atob(data.audio_base64), (c) => c.charCodeAt(0))
      const src = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }))
      const a = data.alignment
      const ms = Math.round((a?.character_end_times_seconds.at(-1) ?? estimateSeconds(text)) * 1000)
      const exact = a && a.characters.join('') === text
      const words = [...text.matchAll(/\S+/g)].map((m): [number, number] => [
        m.index,
        Math.round(exact ? a.character_start_times_seconds[m.index] * 1000 : (m.index / text.length) * ms),
      ])
      return { src, words, ms }
    })().catch(() => null)
    liveClips.set(key, p)
    p.then((c) => c || liveClips.delete(key))
  }
  return p
}

/** Finds a recording for every sentence of a line, or null if any is missing. */
async function partsFor(text: string, voice: VoiceName): Promise<Part[] | null> {
  await manifestOrTimeout
  const sentences = splitSentences(text)
  if (!sentences.length) return null
  let from = 0
  const found = sentences.map((s) => {
    const offset = Math.max(0, text.indexOf(s.split(' ')[0], from))
    from = offset + s.length
    const clip: Clip | undefined = manifest?.clips[voiceKey(voice, s)]
    return { s, offset, clip }
  })
  if (found.every((f) => f.clip)) {
    return found.map(({ clip, offset }) => ({ src: VOICE_DIR + clip!.file, words: clip!.words, ms: clip!.ms, offset }))
  }
  if (!liveKey) {
    if (import.meta.env.DEV && manifest) console.info('[voice] no recording for:', found.filter((f) => !f.clip).map((f) => f.s))
    return null
  }
  const parts = await Promise.all(
    found.map(async ({ s, offset, clip }) => {
      if (clip) return { src: VOICE_DIR + clip.file, words: clip.words, ms: clip.ms, offset }
      const live = await liveClip(voice, s)
      return live && { ...live, offset }
    }),
  )
  return parts.every(Boolean) ? (parts as Part[]) : null
}

/** Plays recorded sentences one after another. Resolves 'done', 'stopped' or 'failed'. */
function playParts(parts: Part[], onWord: SpeakOptions['onWord'], isCancelled: () => boolean, onCancel: (fn: () => void) => void) {
  return new Promise<'done' | 'stopped' | 'failed'>((resolve) => {
    if (!audio) return resolve('failed')
    let i = 0
    let raf = 0
    let safety = 0
    let settled = false
    const finish = (r: 'done' | 'stopped' | 'failed') => {
      if (settled) return
      settled = true
      cancelAnimationFrame(raf)
      window.clearTimeout(safety)
      audio.onended = null
      audio.onerror = null
      resolve(r)
    }
    onCancel(() => {
      audio.pause()
      finish('stopped')
    })
    const playNext = () => {
      if (isCancelled()) return finish('stopped')
      if (i >= parts.length) return finish('done')
      const part = parts[i++]
      let w = 0
      audio.src = part.src
      audio.onended = () => {
        window.clearTimeout(safety)
        playNext()
      }
      audio.onerror = () => finish(i === 1 ? 'failed' : 'done')
      const tick = () => {
        const t = audio.currentTime * 1000
        while (w < part.words.length && part.words[w][1] <= t + 60) onWord?.(part.offset + part.words[w++][0])
        raf = requestAnimationFrame(tick)
      }
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(tick)
      window.clearTimeout(safety)
      safety = window.setTimeout(playNext, part.ms * 1.5 + 4000)
      audio.play().catch(() => finish(i === 1 ? 'failed' : 'done'))
    }
    playNext()
  })
}

function speakWithBrowser(text: string, opts: SpeakOptions, finish: (ok: boolean) => void, timers: number[]) {
  const est = estimateSeconds(text)
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
}

/**
 * Says a line. Resolves true when it finishes, false if it was stopped first.
 * When muted, or when there is no voice at all, it waits about as long as the line
 * would take, so captions still pace the lesson.
 */
export function speak(text: string, opts: SpeakOptions = {}): Promise<boolean> {
  stop()
  return new Promise((resolve) => {
    let settled = false
    let cancelled = false
    let cancelPlayback: (() => void) | null = null
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
        cancelled = true
        cancelPlayback?.()
        if (speechAvailable()) window.speechSynthesis.cancel()
        finish(false)
      },
    }
    current = handle

    const fakeTiming = () => {
      const est = estimateSeconds(text)
      // Fake word timing so the caption highlight still moves.
      if (opts.onWord) {
        const words = [...text.matchAll(/\S+/g)]
        words.forEach((m, i) => {
          timers.push(window.setTimeout(() => opts.onWord?.(m.index ?? 0), (i / words.length) * est * 1000))
        })
      }
      timers.push(window.setTimeout(() => finish(true), est * 1000))
    }
    if (muted) return fakeTiming()

    const voice = opts.voice ?? 'narrator'
    partsFor(text, voice).then(async (parts) => {
      if (cancelled) return
      if (parts) {
        const result = await playParts(parts, opts.onWord, () => cancelled, (fn) => (cancelPlayback = fn))
        if (result !== 'failed') return finish(result === 'done')
      }
      if (cancelled) return
      if (speechAvailable()) speakWithBrowser(text, opts, finish, timers)
      else fakeTiming()
    })
  })
}
