import gsap from 'gsap'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import '../art2/art2.css'
import { Defs } from '../art2/fx'
import { preloadLines, setMuted as setNarratorMuted, speak, stop as stopSpeech } from '../engine/narrator'
import { snapshotStage } from '../engine/svg'
import type { LessonEvent } from '../engine/types'
import { TutorPanel, type LessonApi, type TutorHandle } from '../tutor/TutorPanel'
import { Captions } from '../ui/Captions'
import './flow.css'
import type { Enter, FlowLesson } from './types'

interface Pos {
  ch: number
  cue: number
  /** Bumped to remount the chapter, which replays it from the current cue. */
  take: number
}

interface Leaving extends Pos {
  enter: Enter
}

interface Pointer {
  x: number
  y: number
  w: number
  h: number
}

const IDLE_HINT_MS = 16_000
const TRANSITION_S = 1.6
const noop = () => {}
const noopSay = () => Promise.resolve()

/**
 * Handy for testing and sharing: ?chapter=3&cue=2 opens chapter 3 at cue 2 (both counted
 * from 1), &start=1 skips the start screen, &mute=1 turns the voice off. For automated
 * run-throughs only, &autoplay=1 finishes each learner's turn by itself.
 */
function readLink(lesson: FlowLesson) {
  const q = new URLSearchParams(window.location.search)
  const num = (k: string) => Math.max(0, (parseInt(q.get(k) ?? '1', 10) || 1) - 1)
  const ch = Math.min(num('chapter'), lesson.chapters.length - 1)
  const cue = Math.min(num('cue'), lesson.chapters[ch].cues.length - 1)
  return { ch, cue, start: q.get('start') === '1', mute: q.get('mute') === '1', autoplay: q.get('autoplay') === '1' }
}

/**
 * Plays a lesson like a video: narration runs line after line with no gaps, chapters
 * glide into each other, and when it is the learner's turn the same picture simply
 * becomes playable. There are no slides and no "next" buttons.
 */
export function FlowPlayer({ lesson, onExit }: { lesson: FlowLesson; onExit: () => void }) {
  const [link] = useState(() => readLink(lesson))
  const [started, setStarted] = useState(link.start)
  const [pos, setPos] = useState<Pos>({ ch: link.ch, cue: link.cue, take: 0 })
  const [leaving, setLeaving] = useState<Leaving | null>(null)
  const [playing, setPlaying] = useState(link.start)
  const [speechDone, setSpeechDone] = useState(false)
  const [animDone, setAnimDone] = useState(false)
  const [playDone, setPlayDone] = useState(false)
  const [talking, setTalking] = useState(false)
  const [ended, setEnded] = useState(false)
  const [caption, setCaption] = useState({ text: '', word: -1 })
  const [showCaptions, setShowCaptions] = useState(true)
  const [muted, setMuted] = useState(() => {
    if (link.mute) setNarratorMuted(true)
    return link.mute
  })
  const [pointer, setPointer] = useState<Pointer | null>(null)

  const stageRef = useRef<SVGSVGElement>(null)
  const slotRefs = useRef(new Map<string, SVGGElement>())
  const tutorRef = useRef<TutorHandle>(null)
  const speakToken = useRef(0)
  /** Bumped whenever the cue changes, so a chapter's queued line is dropped if the flow has moved on. */
  const cueToken = useRef(0)
  /** The current cue's narration; a chapter's own line waits for it rather than cutting it off. */
  const narration = useRef<Promise<unknown>>(Promise.resolve())
  const sceneState = useRef('')
  const hints = useRef<string[]>([])
  const recent = useRef<string[]>([])
  const misses = useRef(0)
  const lastEventAt = useRef(Date.now())
  const lastNudgeAt = useRef(0)
  const memory = useRef<Record<string, unknown>>({})

  const chapter = lesson.chapters[pos.ch]
  const cue = chapter.cues[pos.cue]
  const slotKey = (p: Pos) => `${lesson.chapters[p.ch].id}-${p.take}`

  const goTo = useCallback((ch: number, cueIndex: number, remount = false) => {
    speakToken.current++
    cueToken.current++
    stopSpeech()
    setSpeechDone(false)
    setAnimDone(false)
    setPlayDone(false)
    setTalking(false)
    setEnded(false)
    setPointer(null)
    sceneState.current = ''
    hints.current = []
    misses.current = 0
    lastEventAt.current = Date.now()
    setPos((p) => ({ ch, cue: cueIndex, take: remount || p.ch !== ch ? p.take + 1 : p.take }))
  }, [])

  /** Moves to another chapter with a camera move from the current picture. */
  const cutTo = useCallback(
    (ch: number, cueIndex: number, enter: Enter) => {
      setLeaving({ ...pos, enter })
      goTo(ch, cueIndex, true)
    },
    [pos, goTo],
  )

  // Fetch this chapter's and the next chapter's recordings ahead.
  useEffect(() => {
    if (!started) return
    preloadLines(chapter.cues.map((c) => c.say))
    const nextCh = lesson.chapters[pos.ch + 1]
    if (nextCh) preloadLines(nextCh.cues.map((c) => c.say))
  }, [started, chapter, lesson, pos.ch])

  // Say the current cue. Resuming after a pause says it again from the start.
  useEffect(() => {
    if (!started || !playing || speechDone || ended) return
    const token = ++speakToken.current
    setCaption({ text: cue.say, word: 0 })
    narration.current = speak(cue.say, {
      onWord: (i) => token === speakToken.current && setCaption((c) => ({ ...c, word: i })),
    }).then((ok) => {
      if (ok && token === speakToken.current) setSpeechDone(true)
    })
  }, [started, playing, speechDone, ended, cue])

  const next = useCallback(() => {
    if (pos.cue < chapter.cues.length - 1) goTo(pos.ch, pos.cue + 1)
    else if (pos.ch < lesson.chapters.length - 1) cutTo(pos.ch + 1, 0, lesson.chapters[pos.ch + 1].enter ?? { type: 'dissolve' })
    else setEnded(true)
  }, [pos, chapter, lesson, goTo, cutTo])

  // Move on the moment the line is said and the picture has played (or the learner has done their part).
  useEffect(() => {
    if (!started || !playing || ended) return
    if (talking) return
    // A play cue waits for the learner and the picture. A watched cue moves on as soon as its
    // line is said: if the picture is still animating, it gets a moment, then glides on
    // into the next beat rather than leaving a silent gap.
    if (cue.play) {
      if (!playDone || !animDone) return
      const t = window.setTimeout(next, 250)
      return () => window.clearTimeout(t)
    }
    if (!speechDone) return
    const t = window.setTimeout(next, animDone ? 0 : 450)
    return () => window.clearTimeout(t)
  }, [started, playing, ended, cue, speechDone, animDone, playDone, talking, next])

  // Camera move between chapters: the old picture flies, glides or melts away while the new one plays.
  useLayoutEffect(() => {
    if (!leaving) return
    const out = slotRefs.current.get(slotKey(leaving))
    const inn = slotRefs.current.get(slotKey(pos))
    if (!out || !inn) {
      setLeaving(null)
      return
    }
    const e = leaving.enter
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(inn, { clearProps: 'transform,opacity' })
        setLeaving(null)
      },
    })
    if (e.type === 'zoom') {
      tl.fromTo(out, { scale: 1, opacity: 1, svgOrigin: `${e.x} ${e.y}` }, { scale: 5, duration: TRANSITION_S, ease: 'power3.in' }, 0)
      tl.to(out, { opacity: 0, duration: TRANSITION_S * 0.45, ease: 'power1.in' }, TRANSITION_S * 0.55)
      tl.fromTo(inn, { scale: 0.6, opacity: 0, svgOrigin: '800 450' }, { scale: 1, opacity: 1, duration: TRANSITION_S * 0.75, ease: 'power3.out' }, TRANSITION_S * 0.45)
    } else if (e.type === 'pan') {
      const dx = e.dir === 'left' ? -1600 : e.dir === 'right' ? 1600 : 0
      const dy = e.dir === 'up' ? 900 : e.dir === 'down' ? -900 : 0
      tl.fromTo(out, { x: 0, y: 0 }, { x: dx, y: dy, duration: TRANSITION_S, ease: 'power3.inOut' }, 0)
      tl.fromTo(inn, { x: -dx, y: -dy }, { x: 0, y: 0, duration: TRANSITION_S, ease: 'power3.inOut' }, 0)
    } else {
      tl.fromTo(out, { opacity: 1 }, { opacity: 0, duration: TRANSITION_S * 0.7, ease: 'power1.inOut' }, 0)
    }
    return () => {
      tl.kill()
    }
    // Runs once per chapter change; pos is read for the incoming slot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving])

  const pause = useCallback(() => {
    setPlaying(false)
    speakToken.current++
    stopSpeech()
  }, [])

  const resume = useCallback(() => {
    setPointer(null)
    setPlaying(true)
    if (!started) setStarted(true)
  }, [started])

  const replay = useCallback(() => {
    if (cue.play) {
      setSpeechDone(false)
      setPlaying(true)
      return
    }
    goTo(pos.ch, pos.cue, true)
    setPlaying(true)
  }, [cue, pos, goTo])

  // The learner's turn is over: carry on, and let Pip invite them to explain without stopping anything.
  const played = useCallback(() => {
    setPlayDone(true)
    if (!cue.quick) {
      window.setTimeout(() => tutorRef.current?.invite('Nice one! How did you figure that out? Tap me and tell me.'), 1600)
    }
  }, [cue])

  // A chapter's own line: said in the narrator's voice once the cue's narration has finished; the flow waits for it.
  const say = useCallback((text: string) => {
    const cueAt = cueToken.current
    setTalking(true)
    return narration.current.then(() => {
      if (cueAt !== cueToken.current) return
      const token = ++speakToken.current
      setSpeechDone(true)
      setCaption({ text, word: 0 })
      return speak(text, { onWord: (i) => token === speakToken.current && setCaption((c) => ({ ...c, word: i })) }).then(() => {
        if (token === speakToken.current) setTalking(false)
      })
    })
  }, [])

  const nudge = useCallback((reason: string) => {
    lastNudgeAt.current = Date.now()
    lastEventAt.current = Date.now()
    tutorRef.current?.nudge(reason)
  }, [])

  const emit = useCallback(
    (ev: LessonEvent) => {
      lastEventAt.current = Date.now()
      const line = ev.type === 'attempt' ? `${ev.correct ? 'right' : 'missed'}${ev.detail ? `: ${ev.detail}` : ''}` : `progress${ev.detail ? `: ${ev.detail}` : ''}`
      recent.current = [...recent.current.slice(-7), line]
      if (ev.type === 'attempt' && !ev.correct) {
        if (++misses.current >= 2) {
          misses.current = 0
          nudge('The learner has missed twice in a row.')
        }
      } else {
        misses.current = 0
      }
    },
    [nudge],
  )

  // Test run-throughs: take the learner's turn after a moment.
  useEffect(() => {
    if (!link.autoplay || !playing || !cue.play || playDone || !animDone) return
    const t = window.setTimeout(() => setPlayDone(true), 1500)
    return () => window.clearTimeout(t)
  }, [link, playing, cue, playDone, animDone])

  // If the learner sits on their turn without doing anything, Pip offers a hint. Nothing stops.
  useEffect(() => {
    if (!playing || !cue.play || playDone) return
    const id = window.setInterval(() => {
      const quiet = Date.now() - lastEventAt.current
      if (quiet > IDLE_HINT_MS && Date.now() - lastNudgeAt.current > IDLE_HINT_MS) {
        nudge('The learner has not done anything on their turn for a while.')
      }
    }, 2000)
    return () => window.clearInterval(id)
  }, [playing, cue, playDone, nudge])

  // Space bar pauses and plays, like a video.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || (e.target as HTMLElement)?.closest('input, textarea, button')) return
      e.preventDefault()
      if (playing) pause()
      else resume()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing, pause, resume])

  const reportState = useCallback((d: string) => {
    sceneState.current = d
  }, [])
  const setHints = useCallback((h: string[]) => {
    hints.current = h
  }, [])
  const animDoneCb = useCallback(() => setAnimDone(true), [])

  const pointAt = useCallback((target: string) => {
    const svg = stageRef.current
    const el = svg?.querySelector(`.flow-current [data-tutor="${CSS.escape(target)}"]`)
    if (!svg || !el) return false
    const sr = svg.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    const k = 1600 / sr.width
    setPointer({ x: (r.left - sr.left) * k, y: (r.top - sr.top) * k, w: r.width * k, h: r.height * k })
    window.setTimeout(() => setPointer(null), 6000)
    return true
  }, [])

  const script = useMemo(
    () =>
      lesson.chapters
        .map((c, i) => `Chapter ${i + 1}: ${c.title}\n${c.cues.map((q, k) => `  ${k + 1}. ${q.play ? "[learner's turn] " : ''}${q.say}`).join('\n')}`)
        .join('\n\n'),
    [lesson],
  )

  const api: LessonApi = useMemo(
    () => ({
      lessonTitle: lesson.title,
      script,
      context: () => {
        const svg = stageRef.current
        const targets = svg
          ? [...svg.querySelectorAll('.flow-current [data-tutor]')].filter((el) => isShown(el, svg)).map((el) => el.getAttribute('data-tutor') ?? '')
          : []
        return {
          stopNumber: pos.ch + 1,
          stopTitle: chapter.title,
          beatNumber: pos.cue + 1,
          beatCount: chapter.cues.length,
          narration: cue.say,
          inChallenge: !!cue.play && !playDone,
          sceneState: sceneState.current,
          hints: hints.current,
          recentEvents: recent.current,
          targets: [...new Set(targets.filter(Boolean))],
        }
      },
      snapshot: () => (stageRef.current ? snapshotStage(stageRef.current) : Promise.resolve(null)),
      pause,
      resume,
      replay,
      pointAt,
      isPlaying: () => playing,
    }),
    [lesson, script, pos, chapter, cue, playDone, pause, resume, replay, pointAt, playing],
  )

  const slots = [pos, ...(leaving ? [leaving] : [])]
  const totalCues = lesson.chapters.reduce((n, c) => n + c.cues.length, 0)
  const Poster = lesson.Poster

  return (
    <div className={playing ? 'flow' : 'flow flow-paused'}>
      <header className="flow-top">
        <button className="flow-back" onClick={onExit}>
          ← Lessons
        </button>
        <span className="flow-title">{lesson.title}</span>
      </header>

      <div className="flow-stage-wrap">
        <div className="flow-stage">
          <svg ref={stageRef} viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" role="img" aria-label={started ? `${chapter.title}: ${cue.say}` : lesson.title}>
            <Defs />
            {/* During a camera move each chapter is cut to its own frame, so art drawn off-stage never slides over the other one. */}
            <clipPath id="flow-slot-frame">
              <rect width={1600} height={900} />
            </clipPath>
            {!started && <Poster />}
            {started &&
              slots.map((p) => {
                const isLeaving = p !== pos
                const S = lesson.chapters[p.ch].Scene
                const key = slotKey(p)
                return (
                  <g
                    key={key}
                    className={isLeaving ? 'flow-leaving' : 'flow-current'}
                    clipPath={isLeaving || leaving?.enter.type === 'pan' ? 'url(#flow-slot-frame)' : undefined}
                    pointerEvents={isLeaving ? 'none' : undefined}
                    ref={(el) => {
                      if (el) slotRefs.current.set(key, el)
                      else slotRefs.current.delete(key)
                    }}
                  >
                    <S
                      cueIndex={p.cue}
                      playing={isLeaving ? false : playing && !ended}
                      onAnimDone={isLeaving ? noop : animDoneCb}
                      onPlayDone={isLeaving ? noop : played}
                      say={isLeaving ? noopSay : say}
                      emit={isLeaving ? noop : emit}
                      reportState={isLeaving ? noop : reportState}
                      setHints={isLeaving ? noop : setHints}
                      memory={memory.current}
                    />
                  </g>
                )
              })}
            {pointer && <rect x={pointer.x - 14} y={pointer.y - 14} width={pointer.w + 28} height={pointer.h + 28} rx={24} fill="none" stroke="#FFC23D" strokeWidth={8} className="tutor-pointer" />}
          </svg>

          {!started && (
            <div className="flow-poster">
              <p className="flow-eyebrow">{lesson.age} · about {lesson.minutes} minutes</p>
              <h1>{lesson.title}</h1>
              <p className="flow-tagline">{lesson.tagline}</p>
              <button className="flow-play-big" onClick={resume} aria-label="Play the lesson">
                <svg viewBox="0 0 40 40" aria-hidden>
                  <path d="M14 10 L31 20 L14 30 Z" fill="currentColor" />
                </svg>
              </button>
              <p className="flow-fine">Sound on. Pip the owl is here if you get stuck or curious.</p>
            </div>
          )}
          {started && !playing && !ended && (
            <button className="flow-paused-overlay" onClick={resume} aria-label="Play">
              <span>
                <svg viewBox="0 0 40 40" aria-hidden>
                  <path d="M14 10 L31 20 L14 30 Z" fill="currentColor" />
                </svg>
              </span>
            </button>
          )}
          {ended && (
            <div className="flow-end">
              <h2>You did it!</h2>
              {lesson.next?.length ? (
                <>
                  <p>Where this branch of the knowledge tree grows next:</p>
                  <div className="flow-next">
                    {lesson.next.map((n) =>
                      n.href ? (
                        <a key={n.title} className="flow-next-card ready" href={n.href}>
                          <strong>{n.title}</strong>
                          <span>{n.blurb}</span>
                          <em>Play it now</em>
                        </a>
                      ) : (
                        <div key={n.title} className="flow-next-card">
                          <strong>{n.title}</strong>
                          <span>{n.blurb}</span>
                          <em>Coming soon</em>
                        </div>
                      ),
                    )}
                  </div>
                </>
              ) : null}
              <div className="flow-end-actions">
                <button onClick={() => cutTo(0, 0, { type: 'dissolve' })}>Watch again</button>
                <button className="primary" onClick={onExit}>
                  Back to all lessons
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flow-captions">{showCaptions && started && !ended && <Captions text={caption.text} charIndex={caption.word} />}</div>

        <div className="flow-bar">
          <button className="flow-pp" onClick={playing ? pause : resume} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? (
              <svg viewBox="0 0 40 40" aria-hidden>
                <rect x={11} y={10} width={6} height={20} rx={2} fill="currentColor" />
                <rect x={23} y={10} width={6} height={20} rx={2} fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 40 40" aria-hidden>
                <path d="M14 10 L31 20 L14 30 Z" fill="currentColor" />
              </svg>
            )}
          </button>
          <div className="flow-progress" role="group" aria-label="Chapters">
            {lesson.chapters.map((c, i) => {
              const fill = !started ? 0 : i < pos.ch || ended ? 1 : i > pos.ch ? 0 : (pos.cue + (speechDone ? 1 : 0.5)) / c.cues.length
              return (
                <button
                  key={c.id}
                  className={i === pos.ch && started ? 'flow-seg on' : 'flow-seg'}
                  style={{ flexGrow: c.cues.length / totalCues }}
                  onClick={() => {
                    if (!started) setStarted(true)
                    setPlaying(true)
                    cutTo(i, 0, { type: 'dissolve' })
                  }}
                  title={c.title}
                  aria-label={`Chapter ${i + 1}: ${c.title}`}
                >
                  <span className="flow-seg-fill" style={{ transform: `scaleX(${Math.min(1, fill)})` }} />
                </button>
              )
            })}
          </div>
          <span className="flow-chapter">{started ? chapter.title : `${lesson.chapters.length} chapters`}</span>
          <button className={showCaptions ? 'flow-toggle on' : 'flow-toggle'} onClick={() => setShowCaptions((v) => !v)} aria-label="Captions">
            CC
          </button>
          <button
            className={muted ? 'flow-toggle' : 'flow-toggle on'}
            aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
            onClick={() => {
              setNarratorMuted(!muted)
              setMuted(!muted)
              if (!muted) setSpeechDone(false)
            }}
          >
            {muted ? 'Sound off' : 'Sound on'}
          </button>
        </div>
      </div>

      <TutorPanel ref={tutorRef} lesson={api} />
    </div>
  )
}

/** True when an element is actually visible on the stage (GSAP hides things with opacity). */
function isShown(el: Element, stop: Element) {
  for (let n: Element | null = el; n && n !== stop; n = n.parentElement) {
    const op = parseFloat(getComputedStyle(n).opacity || '1')
    if (op < 0.05 || getComputedStyle(n).display === 'none') return false
  }
  return true
}
