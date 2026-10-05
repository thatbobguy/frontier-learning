/** Push-to-talk speech recognition in the browser (Chrome, Edge and Safari support it). */

interface RecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type RecognitionCtor = new () => RecognitionLike

function ctor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function canListen() {
  return typeof window !== 'undefined' && ctor() !== null
}

/**
 * Starts listening. `onText` gets the words so far; `onDone` gets the final words
 * (empty if nothing was heard). Returns a function that stops listening early.
 */
export function listen(onText: (text: string) => void, onDone: (text: string, error?: string) => void): () => void {
  const Rec = ctor()
  if (!Rec) {
    onDone('', 'unsupported')
    return () => {}
  }
  const rec = new Rec()
  rec.lang = 'en-US'
  rec.interimResults = true
  rec.continuous = false
  let text = ''
  let error: string | undefined
  rec.onresult = (e) => {
    text = Array.from(e.results)
      .map((r) => r[0]?.transcript ?? '')
      .join(' ')
      .trim()
    onText(text)
  }
  rec.onerror = (e) => {
    error = e.error
  }
  rec.onend = () => onDone(text, error)
  try {
    rec.start()
  } catch {
    onDone('', 'start-failed')
  }
  return () => rec.stop()
}
