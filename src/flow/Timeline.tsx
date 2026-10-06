import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

/** One line of the film on the timeline. */
export interface TimelineCue {
  ch: number
  cue: number
  /** Seconds from the start of the film. */
  start: number
  /** Seconds the line takes to say. */
  dur: number
  say: string
  play: boolean
}

export interface TimelineChapter {
  title: string
  start: number
  dur: number
}

/** Lays every cue of a film end to end, using the recorded length of each line. */
export function layoutTimeline(chapters: { title: string; cues: { say: string; play?: boolean }[] }[], seconds: (text: string) => number) {
  const cues: TimelineCue[] = []
  const chs: TimelineChapter[] = []
  let t = 0
  chapters.forEach((c, ch) => {
    const start = t
    c.cues.forEach((q, cue) => {
      // A learner's turn takes as long as it takes; on the timeline it gets the length of its line plus a beat.
      const dur = seconds(q.say) + (q.play ? 4 : 0)
      cues.push({ ch, cue, start: t, dur, say: q.say, play: !!q.play })
      t += dur
    })
    chs.push({ title: c.title, start, dur: t - start })
  })
  return { cues, chapters: chs, total: t }
}

export function formatTime(s: number) {
  const n = Math.max(0, Math.round(s))
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`
}

/** The cue playing at a time on the timeline. */
export function cueAt(cues: TimelineCue[], t: number) {
  let found = cues[0]
  for (const c of cues) {
    if (c.start <= t + 0.01) found = c
    else break
  }
  return found
}

/**
 * A video-style scrub bar: one track split into chapters, a playhead you can drag anywhere,
 * and a preview of the chapter and line under the pointer. Letting go jumps the film there.
 */
export function Timeline({
  layout,
  time,
  onSeek,
}: {
  layout: ReturnType<typeof layoutTimeline>
  time: number
  onSeek: (ch: number, cue: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const { cues, chapters, total } = layout

  const timeAtX = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect()
    if (!r || r.width === 0) return 0
    return Math.min(total, Math.max(0, ((clientX - r.left) / r.width) * total))
  }

  const shown = dragging && hover !== null ? hover : time
  const preview = hover !== null ? cueAt(cues, hover) : null
  const previewPct = hover !== null && total ? (hover / total) * 100 : 0

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    setHover(timeAtX(e.clientX))
  }
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => setHover(timeAtX(e.clientX))
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    setDragging(false)
    const c = cueAt(cues, timeAtX(e.clientX))
    if (c) onSeek(c.ch, c.cue)
    if (e.pointerType !== 'mouse') setHover(null)
  }

  const label = useMemo(() => {
    const c = cueAt(cues, time)
    return c ? `${chapters[c.ch]?.title ?? ''}, ${formatTime(time)} of ${formatTime(total)}` : ''
  }, [cues, chapters, time, total])

  return (
    <div className="flow-timeline">
      <div
        ref={trackRef}
        className={dragging ? 'flow-track dragging' : 'flow-track'}
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(total)}
        aria-valuenow={Math.round(time)}
        aria-valuetext={label}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => {
          setDragging(false)
          setHover(null)
        }}
        onPointerLeave={() => !dragging && setHover(null)}
      >
        {chapters.map((c, i) => {
          const fill = c.dur ? Math.min(1, Math.max(0, (shown - c.start) / c.dur)) : 0
          return (
            <span key={i} className="flow-track-seg" style={{ left: `${(c.start / total) * 100}%`, width: `max(2px, calc(${(c.dur / total) * 100}% - 3px))` }}>
              <span className="flow-track-fill" style={{ transform: `scaleX(${fill})` }} />
              {hover !== null && hover >= c.start && hover < c.start + c.dur && <span className="flow-track-hover" />}
            </span>
          )
        })}
        <span className="flow-knob" style={{ left: `${total ? (shown / total) * 100 : 0}%` }} />
        {preview && (
          <span className="flow-preview" style={{ left: `clamp(110px, ${previewPct}%, calc(100% - 110px))` }}>
            <strong>
              {chapters[preview.ch]?.title} · {formatTime(hover ?? 0)}
            </strong>
            <span>{preview.play ? 'Your turn: ' : ''}{preview.say.length > 90 ? `${preview.say.slice(0, 88)}…` : preview.say}</span>
          </span>
        )}
      </div>
      <span className="flow-time">
        {formatTime(shown)} / {formatTime(total)}
      </span>
    </div>
  )
}
