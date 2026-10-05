import { useMemo } from 'react'

/** The narration line, with the word being spoken highlighted. */
export function Captions({ text, charIndex }: { text: string; charIndex: number }) {
  const words = useMemo(() => [...text.matchAll(/\S+/g)].map((m) => ({ w: m[0], i: m.index ?? 0 })), [text])
  if (!text) return null
  let active = -1
  words.forEach((w, k) => {
    if (charIndex >= w.i) active = k
  })
  return (
    <div className="captions" aria-live="polite">
      <p>
        {words.map((w, k) => (
          <span key={k}>
            <span className={k === active ? 'word on' : k < active ? 'word said' : 'word'}>{w.w}</span>{' '}
          </span>
        ))}
      </p>
    </div>
  )
}
