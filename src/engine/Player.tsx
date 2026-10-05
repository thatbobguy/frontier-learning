import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pip } from '../art/kit'
import { Captions } from '../ui/Captions'
import { KnowledgePath } from '../ui/KnowledgePath'
import { TutorPanel, type LessonApi, type TutorHandle } from '../tutor/TutorPanel'
import { setMuted as setNarratorMuted, speak, stop as stopSpeech } from './narrator'
import { snapshotStage } from './svg'
import type { LessonEvent, Stop } from './types'

interface Pos {
  stop: number
  beat: number
  /** Bumped to remount the scene, which replays the current beat from its start. */
  take: number
}

interface Pointer {
  x: number
  y: number
  w: number
  h: number
}

const IDLE_NUDGE_MS = 30_000

/**
 * Handy for testing and for sharing a link to one part: ?stop=3&beat=2 opens stop 3 at
 * step 2 (both counted from 1), &start=1 skips the start card, &mute=1 turns the voice off.
 */
function readLink(stopCount: number) {
  const q = new URLSearchParams(window.location.search)
  const num = (k: string) => Math.max(0, (parseInt(q.get(k) ?? '1', 10) || 1) - 1)
  const stop = Math.min(num('stop'), stopCount - 1)
  return { stop, beat: num('beat'), start: q.get('start') === '1', mute: q.get('mute') === '1' }
}

export function Player({ stops, lessonTitle }: { stops: Stop[]; lessonTitle: string }) {
  const [link] = useState(() => readLink(stops.length))
  const [started, setStarted] = useState(link.start)
  const [pos, setPos] = useState<Pos>(() => ({ stop: link.stop, beat: Math.min(link.beat, stops[link.stop].beats.length - 1), take: 0 }))
  const [playing, setPlaying] = useState(link.start)
  const [speechDone, setSpeechDone] = useState(false)
  const [animDone, setAnimDone] = useState(false)
  const [challengeDone, setChallengeDone] = useState(false)
  const [caption, setCaption] = useState({ text: '', word: -1 })
  const [showCaptions, setShowCaptions] = useState(true)
  const [muted, setMuted] = useState(() => {
    if (link.mute) setNarratorMuted(true)
    return link.mute
  })
  const [visited, setVisited] = useState<Set<number>>(new Set())
  const [chooser, setChooser] = useState(false)
  const [pointer, setPointer] = useState<Pointer | null>(null)
  /** After a game, Pip asks the student how they figured it out; the lesson waits for that. */
  const [explaining, setExplaining] = useState(false)

  const stageRef = useRef<SVGSVGElement>(null)
  const tutorRef = useRef<TutorHandle>(null)
  const speakToken = useRef(0)
  const sceneState = useRef('')
  const hints = useRef<string[]>([])
  const recent = useRef<string[]>([])
  const misses = useRef(0)
  const lastEventAt = useRef(Date.now())
  const lastNudgeAt = useRef(0)

  const stop = stops[pos.stop]
  const beat = stop.beats[pos.beat]
  const teaserIdx = useMemo(() => stops.map((s, i) => (s.teaser ? i : -1)).filter((i) => i >= 0), [stops])

  const goTo = useCallback((stopIndex: number, beatIndex: number, remount = false) => {
    speakToken.current++
    stopSpeech()
    setChooser(false)
    setExplaining(false)
    setSpeechDone(false)
    setAnimDone(false)
    setChallengeDone(false)
    setPointer(null)
    sceneState.current = ''
    hints.current = []
    misses.current = 0
    lastEventAt.current = Date.now()
    setPos((p) => ({
      stop: stopIndex,
      beat: beatIndex,
      take: remount || p.stop !== stopIndex ? p.take + 1 : p.take,
    }))
  }, [])

  // Narrate the current beat. Resuming after a pause says the line again from the start.
  useEffect(() => {
    if (!started || !playing || speechDone || chooser) return
    const token = ++speakToken.current
    setCaption({ text: beat.say, word: 0 })
    speak(beat.say, {
      onWord: (i) => token === speakToken.current && setCaption((c) => ({ ...c, word: i })),
    }).then((ok) => {
      if (ok && token === speakToken.current) setSpeechDone(true)
    })
  }, [started, playing, speechDone, chooser, beat])

  const finishStop = useCallback(() => {
    setVisited((v) => new Set(v).add(pos.stop))
    const nextIdx = pos.stop + 1
    if (nextIdx < stops.length && !stops[nextIdx].teaser) {
      goTo(nextIdx, 0)
    } else {
      stopSpeech()
      setChooser(true)
    }
  }, [pos.stop, stops, goTo])

  const next = useCallback(() => {
    if (pos.beat < stop.beats.length - 1) goTo(pos.stop, pos.beat + 1)
    else finishStop()
  }, [pos, stop, goTo, finishStop])

  // Move on once the line is said and the animation has played (or the challenge is solved).
  useEffect(() => {
    if (!playing || chooser || explaining) return
    const ready = beat.challenge ? challengeDone && animDone : speechDone && animDone
    if (!ready) return
    const t = window.setTimeout(next, beat.challenge ? 1200 : 450)
    return () => window.clearTimeout(t)
  }, [playing, chooser, explaining, beat, speechDone, animDone, challengeDone, next])

  const solved = useCallback(() => {
    setChallengeDone(true)
    if (beat.quick) return
    setExplaining(true)
    // Give the scene's own "well done" line a moment before Pip speaks up.
    window.setTimeout(() => tutorRef.current?.askToExplain(() => setExplaining(false)), 2600)
  }, [beat])

  const pause = useCallback(() => {
    setPlaying(false)
    speakToken.current++
    stopSpeech()
  }, [])

  const resume = useCallback(() => {
    setPointer(null)
    setPlaying(true)
  }, [])

  const replay = useCallback(() => {
    if (beat.challenge) {
      setSpeechDone(false)
      setPlaying(true)
      return
    }
    goTo(pos.stop, pos.beat, true)
    setPlaying(true)
  }, [beat, pos, goTo])

  const back = useCallback(() => {
    if (pos.beat > 0) goTo(pos.stop, pos.beat - 1)
    else if (pos.stop > 0) goTo(pos.stop - 1, 0)
    setPlaying(true)
  }, [pos, goTo])

  // Challenge feedback lines: said in the narrator's voice, without disturbing the beat.
  const say = useCallback((text: string) => {
    const token = ++speakToken.current
    setSpeechDone(true)
    setCaption({ text, word: 0 })
    speak(text, { onWord: (i) => token === speakToken.current && setCaption((c) => ({ ...c, word: i })) })
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
        misses.current++
        if (misses.current >= 3) {
          misses.current = 0
          nudge('The student has missed three times in a row.')
        }
      } else {
        misses.current = 0
      }
    },
    [nudge],
  )

  // Offer help if a student sits in a challenge without doing anything.
  useEffect(() => {
    if (!playing || !beat.challenge || challengeDone) return
    const id = window.setInterval(() => {
      const quiet = Date.now() - lastEventAt.current
      if (quiet > IDLE_NUDGE_MS && Date.now() - lastNudgeAt.current > IDLE_NUDGE_MS) {
        nudge('The student has not done anything in this challenge for about 30 seconds.')
      }
    }, 2000)
    return () => window.clearInterval(id)
  }, [playing, beat, challengeDone, nudge])

  const reportState = useCallback((d: string) => {
    sceneState.current = d
  }, [])
  const setHints = useCallback((h: string[]) => {
    hints.current = h
  }, [])
  const animDoneCb = useCallback(() => setAnimDone(true), [])

  const pointAt = useCallback((target: string) => {
    const svg = stageRef.current
    const el = svg?.querySelector(`[data-tutor="${CSS.escape(target)}"]`)
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
      stops
        .map((s, i) => `Stop ${i + 1}: ${s.title}${s.teaser ? ' (a short sneak peek branch)' : ''}\n${s.beats.map((b, k) => `  ${k + 1}. ${b.challenge ? '[Now you try] ' : ''}${b.say}`).join('\n')}`)
        .join('\n\n'),
    [stops],
  )

  const api: LessonApi = useMemo(
    () => ({
      lessonTitle,
      script,
      context: () => {
        const svg = stageRef.current
        const targets = svg
          ? [...svg.querySelectorAll('[data-tutor]')]
              .filter((el) => isShown(el, svg))
              .map((el) => el.getAttribute('data-tutor') ?? '')
          : []
        return {
          stopNumber: pos.stop + 1,
          stopTitle: stop.title,
          beatNumber: pos.beat + 1,
          beatCount: stop.beats.length,
          narration: beat.say,
          inChallenge: !!beat.challenge && !challengeDone,
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
    [lessonTitle, script, pos, stop, beat, challengeDone, pause, resume, replay, pointAt, playing],
  )

  const Scene = stop.Scene
  const nowYouTry = beat.challenge && !challengeDone && started

  if (!started) {
    return (
      <div className="start">
        <div className="start-card">
          <svg viewBox="-90 -100 180 180" className="start-pip" aria-hidden>
            <Pip />
          </svg>
          <p className="eyebrow">Lesson 1</p>
          <h1>{lessonTitle}</h1>
          <p className="lede">How people invented math, and the first big ideas that grew out of it. Watch, then try it yourself. Ask Pip the owl anything along the way.</p>
          <button
            className="big-button"
            onClick={() => {
              setStarted(true)
              setPlaying(true)
            }}
          >
            Start the lesson
          </button>
          <p className="fine">Turn your sound on. Works best on a laptop or tablet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={playing ? 'player' : 'player paused'}>
      <KnowledgePath stops={stops} current={pos.stop} visited={visited} onJump={(i) => { goTo(i, 0); setPlaying(true) }} />

      <div className="stage-wrap">
        <div className="stage">
          <svg ref={stageRef} viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${stop.title}: ${beat.say}`}>
            <Scene
              key={`${stop.id}-${pos.take}`}
              beatIndex={pos.beat}
              playing={playing && !chooser}
              onAnimDone={animDoneCb}
              onChallengeDone={solved}
              say={say}
              emit={emit}
              reportState={reportState}
              setHints={setHints}
            />
            {pointer && (
              <rect
                x={pointer.x - 14}
                y={pointer.y - 14}
                width={pointer.w + 28}
                height={pointer.h + 28}
                rx={24}
                fill="none"
                stroke="#FFC94A"
                strokeWidth={8}
                className="tutor-pointer"
              />
            )}
          </svg>
          {nowYouTry && <div className={beat.quick ? 'now-you-try quick' : 'now-you-try'}>{beat.quick ? 'Your turn!' : 'Now you try!'}</div>}
          {!playing && !chooser && (
            <button className="paused-overlay" onClick={resume} aria-label="Resume">
              <span>▶</span>
            </button>
          )}
          {chooser && <Chooser stops={stops} teaserIdx={teaserIdx} visited={visited} onPick={(i) => { goTo(i, 0); setPlaying(true) }} onRestart={() => { goTo(0, 0); setPlaying(true) }} />}
        </div>
        <div className="caption-band">{showCaptions && !chooser && <Captions text={caption.text} charIndex={caption.word} />}</div>

        <div className="controls">
          <button onClick={back} aria-label="Back one step" title="Back one step">⏮</button>
          {playing ? (
            <button className="primary" onClick={pause} aria-label="Pause">❚❚ Pause</button>
          ) : (
            <button className="primary" onClick={resume} aria-label="Play">▶ Play</button>
          )}
          <button onClick={replay} aria-label="Replay this part" title="Replay this part">↺ Again</button>
          <button onClick={next} aria-label="Skip ahead one step" title="Skip ahead">⏭</button>
          <span className="spacer" />
          <button className={showCaptions ? 'toggle on' : 'toggle'} onClick={() => setShowCaptions((v) => !v)}>CC</button>
          <button
            className={muted ? 'toggle' : 'toggle on'}
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

function Chooser({
  stops,
  teaserIdx,
  visited,
  onPick,
  onRestart,
}: {
  stops: Stop[]
  teaserIdx: number[]
  visited: Set<number>
  onPick: (i: number) => void
  onRestart: () => void
}) {
  return (
    <div className="chooser">
      <h2>Where do you want to go next?</h2>
      <p>You've walked the main path. Pick a branch to explore.</p>
      <div className="chooser-cards">
        {teaserIdx.map((i) => (
          <button key={i} className={`chooser-card branch-${stops[i].branch}`} onClick={() => onPick(i)}>
            <span className="chooser-title">{stops[i].title}</span>
            <span className="chooser-sub">{visited.has(i) ? 'Visited ✓ ' : ''}A sneak peek</span>
          </button>
        ))}
      </div>
      <button className="link-button" onClick={onRestart}>Start again from the beginning</button>
    </div>
  )
}

