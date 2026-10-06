import gsap from 'gsap'
import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import '../art2/art2.css'
import { Defs } from '../art2/fx'
import { Grain } from '../art2/Grain'
import { estimateSeconds, lineSeconds, preloadLines, setMuted as setNarratorMuted, speak, stop as stopSpeech, voiceReady } from '../engine/narrator'
import { snapshotStage } from '../engine/svg'
import type { LessonEvent } from '../engine/types'
import { TutorPanel, type LessonApi, type TutorHandle } from '../tutor/TutorPanel'
import { Captions } from '../ui/Captions'
import { CourseNext } from '../courses/CourseNext'
import { courses } from '../courses'
import { markFinished } from '../courses/types'
import './flow.css'
import { layoutTimeline, Timeline } from './Timeline'
import type { Enter, FlowLesson, Reading } from './types'

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
  const [deeperOpen, setDeeperOpen] = useState(false)
  const [reading, setReading] = useState<{ r: Reading; wasPlaying: boolean } | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [voiceLoaded, setVoiceLoaded] = useState(false)
  const [, setTick] = useState(0)

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
  const rootRef = useRef<HTMLDivElement>(null)
  /** When the current line started being said, and how far it had got if paused. */
  const lineStartedAt = useRef(0)
  const lineElapsed = useRef(0)
  /** Every attempt and step the learner has made in this film, for Pip. */
  const journal = useRef<string[]>([])
  /** Bumped by each chapter line, so only the latest one clears the "talking" hold. */
  const sayToken = useRef(0)

  const posRef = useRef(pos)
  posRef.current = pos
  /** Kept in step with pause() and resume() at once, so Pip sees the change before the next render. */
  const playingRef = useRef(playing)
  playingRef.current = playing
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
    lineStartedAt.current = 0
    lineElapsed.current = 0
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
    lineStartedAt.current = Date.now()
    lineElapsed.current = 0
    narration.current = speak(cue.say, {
      onWord: (i) => token === speakToken.current && setCaption((c) => ({ ...c, word: i })),
    }).then(() => {
      // If something else cut the line off (Pip speaking, a browser voice hiccup) rather than a
      // pause or a jump, count it as said: the film must never sit there waiting forever.
      if (token === speakToken.current) setSpeechDone(true)
    })
  }, [started, playing, speechDone, ended, cue])

  // A safety net under every line: if neither the voice nor the picture reports back in good time, carry on.
  useEffect(() => {
    if (!started || !playing || ended) return
    if (!speechDone) {
      const t = window.setTimeout(() => {
        speakToken.current++
        stopSpeech()
        setSpeechDone(true)
      }, (Math.max(lineSeconds(cue.say), estimateSeconds(cue.say)) * 2 + 8) * 1000)
      return () => window.clearTimeout(t)
    }
    if (talking) {
      const t = window.setTimeout(() => setTalking(false), 30_000)
      return () => window.clearTimeout(t)
    }
    if (cue.play && !animDone) {
      const t = window.setTimeout(() => setAnimDone(true), 8000)
      return () => window.clearTimeout(t)
    }
  }, [started, playing, ended, cue, speechDone, talking, animDone])

  const next = useCallback(() => {
    if (pos.cue < chapter.cues.length - 1) goTo(pos.ch, pos.cue + 1)
    else if (pos.ch < lesson.chapters.length - 1) cutTo(pos.ch + 1, 0, lesson.chapters[pos.ch + 1].enter ?? { type: 'dissolve' })
    else {
      setEnded(true)
      markFinished(lesson.id)
    }
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
    playingRef.current = false
    setPlaying(false)
    if (lineStartedAt.current) lineElapsed.current = (Date.now() - lineStartedAt.current) / 1000
    lineStartedAt.current = 0
    speakToken.current++
    stopSpeech()
  }, [])

  const resume = useCallback(() => {
    setPointer(null)
    playingRef.current = true
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
    const cueNow = cueToken.current
    const mine = ++sayToken.current
    setTalking(true)
    return narration.current.then(() => {
      if (cueNow !== cueToken.current) return
      const token = ++speakToken.current
      setSpeechDone(true)
      setCaption({ text, word: 0 })
      return speak(text, { onWord: (i) => token === speakToken.current && setCaption((c) => ({ ...c, word: i })) }).then(() => {
        // However the line ended (said, paused, or talked over), the flow is free to move on.
        if (mine === sayToken.current && cueNow === cueToken.current) setTalking(false)
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
      journal.current = [...journal.current.slice(-40), `chapter ${posRef.current.ch + 1} line ${posRef.current.cue + 1}: ${line}`]
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

  // The timeline: every line laid end to end, sized by its recording once the list of recordings has loaded.
  useEffect(() => {
    let live = true
    void voiceReady().then(() => live && setVoiceLoaded(true))
    return () => {
      live = false
    }
  }, [])
  const timeline = useMemo(() => layoutTimeline(lesson.chapters, (t) => lineSeconds(t)), [lesson, voiceLoaded]) // eslint-disable-line react-hooks/exhaustive-deps
  const here = timeline.cues.find((c) => c.ch === pos.ch && c.cue === pos.cue) ?? timeline.cues[0]
  const lineNow = speechDone ? here.dur : Math.min(here.dur, playing && lineStartedAt.current ? (Date.now() - lineStartedAt.current) / 1000 : lineElapsed.current)
  const time = !started ? 0 : ended ? timeline.total : here.start + lineNow

  // Move the playhead along while a line is being said.
  useEffect(() => {
    if (!started || !playing || speechDone || ended) return
    const id = window.setInterval(() => setTick((n) => n + 1), 250)
    return () => window.clearInterval(id)
  }, [started, playing, speechDone, ended])

  /** Jumps to any line of the film, like scrubbing a video. Pausing stays as it was. */
  const seek = useCallback(
    (ch: number, cueIndex: number) => {
      setDeeperOpen(false)
      if (!started) {
        setStarted(true)
        setPlaying(true)
      }
      if (ch === pos.ch && cueIndex === pos.cue && started && !ended) goTo(ch, cueIndex, true)
      else cutTo(ch, cueIndex, { type: 'dissolve' })
    },
    [started, ended, pos, goTo, cutTo],
  )

  const step = useCallback(
    (dir: 1 | -1) => {
      const i = timeline.cues.indexOf(here) + dir
      const c = timeline.cues[Math.min(timeline.cues.length - 1, Math.max(0, i))]
      seek(c.ch, c.cue)
    },
    [timeline, here, seek],
  )

  // Full screen: the real thing where the browser allows it, else the player simply fills the window.
  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    else if (fullscreen) setFullscreen(false)
    else if (el?.requestFullscreen) el.requestFullscreen().catch(() => setFullscreen(true))
    else setFullscreen(true)
  }, [fullscreen])
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // Keys, like a video: space plays and pauses, arrows step a line back or on, F is full screen, C is captions.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement
      if (t?.closest('input, textarea, .reading') || document.querySelector('.reading')) return
      if (e.code === 'Space') {
        if (t?.closest('button')) return
        e.preventDefault()
        if (playing) pause()
        else resume()
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        if (!started) return
        e.preventDefault()
        step(e.code === 'ArrowLeft' ? -1 : 1)
      } else if (e.code === 'KeyF') {
        toggleFullscreen()
      } else if (e.code === 'KeyC') {
        setShowCaptions((v) => !v)
      } else if (e.code === 'Escape' && fullscreen && !document.fullscreenElement) {
        setFullscreen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing, pause, resume, started, step, toggleFullscreen, fullscreen])

  const reportState = useCallback((d: string) => {
    sceneState.current = d
  }, [])
  const setHints = useCallback((h: string[]) => {
    hints.current = h
  }, [])
  const animDoneCb = useCallback(() => setAnimDone(true), [])
  // A chapter that crashes is skipped over rather than taking the whole page down with it.
  const sceneFailed = useCallback(() => {
    setAnimDone(true)
    setPlayDone(true)
  }, [])

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
      audience: lesson.audience,
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
          paused: !playingRef.current,
          ended,
          heardSoFar: chapter.cues.slice(0, pos.cue).map((q) => q.say),
          reading: readingText(),
          memory: describeMemory(memory.current),
          journal: journal.current,
          course: describeCourse(lesson),
        }
      },
      snapshot: () => (stageRef.current ? snapshotStage(stageRef.current) : Promise.resolve(null)),
      pause,
      resume,
      replay,
      pointAt,
      isPlaying: () => playingRef.current,
    }),
    [lesson, script, pos, chapter, cue, playDone, pause, resume, replay, pointAt, playing, ended],
  )

  const slots = [pos, ...(leaving ? [leaving] : [])]
  const Poster = lesson.Poster

  return (
    <div ref={rootRef} className={`flow${lesson.look === 'cine' ? ' flow-cine' : ''}${playing ? '' : ' flow-paused'}${fullscreen ? ' flow-full' : ''}`}>
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
            {lesson.Defs && <lesson.Defs />}
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
                    <SceneGuard onError={isLeaving ? noop : sceneFailed}>
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
                    </SceneGuard>
                  </g>
                )
              })}
            {pointer && <rect x={pointer.x - 14} y={pointer.y - 14} width={pointer.w + 28} height={pointer.h + 28} rx={24} fill="none" stroke="#FFC23D" strokeWidth={8} className="tutor-pointer" />}
          </svg>
          <Grain />

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
          {started && !ended && !!chapter.deeper?.length && (
            <>
              <button className="flow-deeper" onClick={() => setDeeperOpen((v) => !v)} aria-expanded={deeperOpen}>
                <i>+</i> Go deeper
              </button>
              {deeperOpen && (
                <div className="flow-deeper-menu" role="menu">
                  {chapter.deeper.map((r) => (
                    <button
                      key={r.id}
                      role="menuitem"
                      onClick={() => {
                        setDeeperOpen(false)
                        setReading({ r, wasPlaying: playing })
                        pause()
                      }}
                    >
                      <strong>{r.title}</strong>
                      <span>
                        {r.blurb} · {r.minutes} min read
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {started && !playing && !ended && !deeperOpen && (
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
              <h2>{lesson.course ? 'End of this stop' : 'You did it!'}</h2>
              {lesson.course ? (
                <CourseNext courseId={lesson.course} lessonId={lesson.id} />
              ) : lesson.next?.length ? (
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
          <Timeline layout={timeline} time={time} onSeek={seek} />
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
          <button className="flow-toggle flow-fs" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'} title={fullscreen ? 'Exit full screen (F)' : 'Full screen (F)'}>
            <svg viewBox="0 0 24 24" aria-hidden>
              {fullscreen ? (
                <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {reading && (
        <div
          className="reading"
          onClick={(e) => {
            if (e.target !== e.currentTarget) return
            const back = reading.wasPlaying
            setReading(null)
            if (back) resume()
          }}
        >
          <article className="reading-sheet" aria-label={reading.r.title}>
            <div className="reading-top">
              <span>Go deeper · {chapter.title}</span>
              <button
                onClick={() => {
                  const back = reading.wasPlaying
                  setReading(null)
                  if (back) resume()
                }}
              >
                Back to the film
              </button>
            </div>
            <h2>{reading.r.title}</h2>
            <p className="reading-meta">
              {reading.r.blurb} · {reading.r.minutes} min read
            </p>
            <reading.r.Body />
          </article>
        </div>
      )}

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

/** Catches a chapter that throws while drawing, so the rest of the film carries on. */
class SceneGuard extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err: unknown) {
    console.error('[flow] a chapter failed to draw and was skipped', err)
    this.props.onError()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

/** The text of the "go deeper" reading the learner has open, if any, for Pip. */
function readingText() {
  const el = document.querySelector('.reading-sheet') as HTMLElement | null
  if (!el) return ''
  const text = el.innerText.replace(/\n{3,}/g, '\n\n').trim()
  return text.length > 6000 ? `${text.slice(0, 6000)}…` : text
}

/** What earlier chapters remembered about the learner (their guesses, choices), as short text. */
function describeMemory(m: Record<string, unknown>) {
  try {
    const text = JSON.stringify(m)
    if (!text || text === '{}') return ''
    return text.length > 1500 ? `${text.slice(0, 1500)}…` : text
  } catch {
    return ''
  }
}

/** Where this film sits in its course: the course, the other films and which come before and after. */
function describeCourse(lesson: FlowLesson) {
  const c = lesson.course ? courses[lesson.course] : undefined
  if (!c) return ''
  const branch = (id: string) => c.branches.find((b) => b.id === id)?.title ?? id
  const films = c.nodes.map((n) => `${n.id === lesson.id ? '(this film) ' : ''}"${n.lesson?.title ?? n.title}" on the ${branch(n.branch)} branch${n.parent ? `, after "${c.nodes.find((p) => p.id === n.parent)?.title ?? n.parent}"` : ''}: ${n.blurb ?? ''}`)
  return `This film is one stop in the course "${c.title}" (${c.tagline}). The films in the course:\n${films.map((f) => `- ${f}`).join('\n')}`
}
