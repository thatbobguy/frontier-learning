import gsap from 'gsap'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { camera } from '../../../cine/camera'
import { GRASPS, Hand3D, useHandStore } from '../../../cine/hand3d'
import { C, MONO, SANS } from '../../../cine/palette'
import { POSES, Person, Robot, rig } from '../../../cine/people'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Chip, Dust, Label, Letterbox, Pool, Vignette, fade, letterbox, useAmbient } from '../shared/kit'
import { LabFloor, LabSky, LabWall, Workbench } from '../shared/sets'
import { ADA, Monitor, Tag, Thumb, TopCup, TopGripper, TopTable, TopThing, along, drawOn, useTicker } from './art'
import { BehaviourCloningReading } from './readings'
import { CHUNK, DRIFT_TRACK, LANE, Runner, expertDemos, pathD, recoveryDemos, spline, trainPolicy, type DriftOptions, type Pt, type Sample } from './sim'

export const CUES: Cue[] = [
  { id: 'copy', say: 'The simplest way to learn from demonstrations is to copy them. Show the robot what Kofi did in each situation, and train it to do the same. It’s called behaviour cloning.' },
  { id: 'small', say: 'But no copy is perfect. A tiny error moves the robot somewhere slightly unfamiliar, where it’s never seen what to do. So it makes a bigger error. Then a bigger one.' },
  { id: 'drift', say: 'Try it. Train a robot from five perfect demonstrations and watch it run. Then fix it.', play: true },
  { id: 'chunks', say: 'Predicting a short burst of actions at once helps too: fewer decisions, fewer chances to wander. Today’s best robots plan about fifty steps ahead, fifty times a second.' },
]

const HINTS = ['Watch where it goes wrong: had it ever seen that spot?', 'Try showing it how to recover, not just how to succeed.', 'Or step in yourself when it starts to drift.']

const STATE = [
  'Ada’s monitor in the dark lab: pairs of camera frames and the action Kofi took (lime arrows) slide along a conveyor into a lime box labelled policy, and a training-loss curve drops. Then a medium shot: Seven stands at a table; a translucent lime ghost of Kofi reaches for a mug and Seven copies the same reach a beat later, following a lime dotted hand path. Idea: behaviour cloning means supervised learning on (observation, action) pairs.',
  'Top-down view of a table. A lime expert path runs from a gripper to a mug near the table edge, with a faint lime band showing where the demonstrations went. The robot gripper follows, wobbles slightly, then drifts further and further off, inside a widening red cone labelled unfamiliar states, and finally clips the mug and knocks it off the table. Idea: compounding error. Small errors take the robot to states it never saw in training, where its errors are bigger.',
  '',
  'Close-up: Seven’s robot hand travels toward a shelf; ahead of it its path is drawn as overlapping lime arcs, each one a chunk of 50 small steps planned at once. A readout ticks at 50 Hz. Label: π0, 50-step chunks at up to 50 Hz. Idea: action chunking means fewer decisions, so fewer chances for errors to compound.',
]

/* ---------------- the watched cues' geometry ---------------- */

/** b1: the expert line on the table, and the robot's drifting copy of it. */
const EXPERT_B1 = spline([
  { x: 250, y: 660 },
  { x: 470, y: 560 },
  { x: 720, y: 540 },
  { x: 960, y: 470 },
  { x: 1160, y: 430 },
  { x: 1270, y: 418 },
], 24)
const CUP_B1 = { x: 1318, y: 414 }
const DRIFT_B1: Pt[] = (() => {
  const n = EXPERT_B1.length
  const out = EXPERT_B1.map((p, i) => {
    const t = i / (n - 1)
    const a = EXPERT_B1[Math.max(0, i - 1)]
    const b = EXPERT_B1[Math.min(n - 1, i + 1)]
    const tl = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const nx = -(b.y - a.y) / tl
    const ny = (b.x - a.x) / tl
    // error grows like t squared, with a small wobble on top; at the very end it lunges back for the mug
    const k = t < 0.8 ? 0 : ((t - 0.8) / 0.2) ** 2
    const dev = (5 * Math.sin(t * 19) * t + 150 * t * t) * (1 - k)
    return { x: p.x + nx * dev, y: p.y + ny * dev }
  })
  // and overshoots straight into it
  const e = EXPERT_B1[n - 1]
  out.push({ x: e.x + 30, y: e.y - 2 }, { x: e.x + 52, y: e.y - 4 })
  return out
})()
/** The widening cone of unfamiliar states around the drifting path, in slices. */
const CONE = (() => {
  const out: string[] = []
  const n = DRIFT_B1.length
  for (let i = 4; i < n - 1; i += 3) {
    const j = Math.min(n - 1, i + 3)
    const w = (k: number) => 4 + 60 * (k / (n - 1)) ** 2
    const side = (k: number, s: number) => {
      const a = DRIFT_B1[Math.max(0, k - 1)]
      const b = DRIFT_B1[Math.min(n - 1, k + 1)]
      const tl = Math.hypot(b.x - a.x, b.y - a.y) || 1
      return { x: DRIFT_B1[k].x + (-(b.y - a.y) / tl) * w(k) * s, y: DRIFT_B1[k].y + ((b.x - a.x) / tl) * w(k) * s }
    }
    const p = [side(i, 1), side(j, 1), side(j, -1), side(i, -1)]
    out.push(`M${p.map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' L')} Z`)
  }
  return out
})()

/** b0: Kofi's recorded hand path over the table (stage coords of the medium shot). */
const SEVEN = { x: 470, y: 800, s: 1.3 }
const TABLE_TOP = 612
const MUG = { x: 760, y: TABLE_TOP }
const KOFI_PATH = spline([
  { x: 612, y: 600 },
  { x: 660, y: 520 },
  { x: 720, y: 520 },
  { x: 752, y: 580 },
], 18)
const GRAB = { ...POSES.reach, torso: 16, head: 14, armN: 62, elbowN: 26, wristN: 10 }
const HOVER = { ...POSES.reach, torso: 8, head: 8, armN: 76, elbowN: 34, wristN: 0 }

/** b3: the hand's route, split into overlapping chunks. */
const CHUNK_ROUTE = spline([
  { x: 200, y: 360 },
  { x: 420, y: 300 },
  { x: 650, y: 350 },
  { x: 880, y: 290 },
  { x: 1100, y: 330 },
  { x: 1300, y: 300 },
  { x: 1352, y: 360 },
], 30)
const NCHUNKS = 9

/* ---------------- the play's world ---------------- */

const OBJ_KINDS = ['book', 'bottle', 'plant', 'box', 'jar', 'tape'] as const
const RADIUS: Record<(typeof OBJ_KINDS)[number], number> = { book: 30, bottle: 24, plant: 30, box: 30, jar: 20, tape: 20 }
interface Obj {
  kind: (typeof OBJ_KINDS)[number]
  x: number
  y: number
  rot: number
}
const OBJECTS: Obj[] = (() => {
  const out: Obj[] = []
  let k = 0
  for (let s = 70; s < DRIFT_TRACK.length - 60; s += 58) {
    for (const side of [-1, 1]) {
      const kind = OBJ_KINDS[(k * 7 + (side > 0 ? 3 : 0)) % OBJ_KINDS.length]
      const r = RADIUS[kind]
      const p = DRIFT_TRACK.offset(s + (side > 0 ? 24 : 0), side * (LANE + r + 6))
      k++
      // drop anything that would sit inside the lane somewhere else on the route
      if (DRIFT_TRACK.nearest(p).dist < LANE + r) continue
      if (out.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < RADIUS[o.kind] + r + 4)) continue
      out.push({ kind, x: p.x, y: p.y, rot: (k * 47) % 360 })
    }
  }
  return out
})()
const DEMOS = expertDemos()
const RECOVERY = recoveryDemos()
const START = DRIFT_TRACK.at(0)
const END = DRIFT_TRACK.at(DRIFT_TRACK.length)

/** The error plot. */
const PLOT = { x: 1070, y: 196, w: 380, h: 120, steps: 340 }
const smooth = (e: number[]) => e.map((_, i) => {
  const a = Math.max(0, i - 6)
  let t = 0
  for (let k = a; k <= i; k++) t += e[k]
  return t / (i - a + 1)
})
const plotPath = (errs: number[]) =>
  smooth(errs)
    .map((e, i) => `${i ? 'L' : 'M'}${(PLOT.x + (i / PLOT.steps) * PLOT.w).toFixed(1)} ${(PLOT.y + PLOT.h - Math.min(1.08, e / LANE) * PLOT.h).toFixed(1)}`)
    .join(' ')

interface RunRecord {
  errs: number[]
  trail: Pt[]
  status: 'success' | 'crash'
  helps: number
  decisions: number
  opts: DriftOptions
}

const fixName = (o: DriftOptions) => [o.recovery && 'recovery demos', o.dagger && 'stepping in', o.chunk && '10-step chunks'].filter(Boolean).join(' + ') || 'no fixes'

export function Ch1Drift({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const monRef = useRef<SVGGElement>(null)
  const copyRef = useRef<SVGGElement>(null)
  const topRef = useRef<SVGGElement>(null)
  const chunkRef = useRef<SVGGElement>(null)
  const gripB1 = useRef<SVGGElement>(null)
  const handGo = useRef<SVGGElement>(null)
  const hand = useHandStore({ pose: GRASPS.relaxed, view: { yaw: 70, pitch: -10, roll: 180, s: 1.5 } })

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const camM = camera(monRef.current, { x: 800, y: 450, zoom: 1 })
      const camC = camera(copyRef.current, { x: 640, y: 520, zoom: 1.25 })
      const camT = camera(topRef.current, { x: 760, y: 470, zoom: 1.02 })
      const camK = camera(chunkRef.current, { x: 800, y: 450, zoom: 1.05 })
      const seven = rig(root.current, 'd1-seven', POSES.stand)
      const kofi = rig(root.current, 'd1-kofi', POSES.stand)
      const ada = rig(root.current, 'd1-ada', POSES.type)

      tl.set('.d1-copy, .d1-top, .d1-play, .d1-chunk', { opacity: 0 }, 0)
      tl.set('.d1-mon', { opacity: 1 }, 0)

      /* b0: Ada's monitor; pairs flow into the policy; the loss falls. Then Seven copies Kofi. */
      tl.addLabel('b0', 0)
      camM.to(tl, { x: 860, y: 430, zoom: 1.16 }, 0, 5.4, 'sine.inOut')
      tl.fromTo('.d1-belt', { x: -300 }, { x: 260, duration: 5.4, ease: 'none', immediateRender: false }, 0)
      drawOn(tl, '.d1-loss', 0.6, 4.2, 'power1.out')
      fade(tl, '.d1-lab-pairs', 1, 0.8)
      fade(tl, '.d1-lab-policy', 1, 1.6)
      fade(tl, '.d1-lab-loss', 1, 3.0)
      tl.fromTo('.d1-pulse', { opacity: 0.3 }, { opacity: 1, duration: 0.25, repeat: 9, yoyo: true, immediateRender: false }, 0.5)
      ada.to(tl, { ...POSES.type, head: 10 }, 0.4, 1.2)
      ada.to(tl, { ...POSES.type, wristN: -4, head: 4 }, 2.2, 1.2)
      ada.to(tl, POSES.type, 3.6, 1.2)

      const c0 = 5.4
      fade(tl, '.d1-mon', 0, c0, 0.35, 1)
      fade(tl, '.d1-copy', 1, c0, 0.35)
      camC.to(tl, { x: 660, y: 540, zoom: 1.45 }, c0, 4.6, 'sine.inOut')
      // the ghost of Kofi reaches first; Seven follows a beat behind along the same path
      kofi.to(tl, HOVER, c0 + 0.3, 0.9)
      kofi.to(tl, GRAB, c0 + 1.2, 0.8)
      drawOn(tl, '.d1-kpath', c0 + 0.4, 1.6)
      seven.to(tl, HOVER, c0 + 1.1, 0.9)
      seven.to(tl, GRAB, c0 + 2.0, 0.8)
      fade(tl, '.d1-lab-kofi', 1, c0 + 0.8)
      fade(tl, '.d1-lab-seven', 1, c0 + 2.4)
      tl.fromTo('.d1-mug', { y: 0 }, { y: -40, duration: 0.7, ease: 'power2.out', immediateRender: false }, c0 + 3.0)
      seven.to(tl, { ...GRAB, armN: 70, elbowN: 30 }, c0 + 3.0, 0.7)
      kofi.to(tl, { ...GRAB, armN: 70, elbowN: 30 }, c0 + 2.5, 0.7)

      /* b1: top-down. The copy drifts off the expert's line and knocks the mug off. */
      const b1 = c0 + 4.6
      tl.addLabel('b1', b1)
      fade(tl, '.d1-copy', 0, b1, 0.5, 1)
      fade(tl, '.d1-top', 1, b1, 0.6)
      camT.to(tl, { x: 700, y: 520, zoom: 1.12 }, b1, 3)
      drawOn(tl, '.d1-expert', b1 + 0.3, 1.5)
      fade(tl, '.d1-band', 0.22, b1 + 0.8, 1)
      fade(tl, '.d1-lab-expert', 1, b1 + 1.2)
      const g0 = b1 + 1.5
      const gd = 6.0
      const driftLine = root.current?.querySelector('.d1-drift')
      along(tl, gripB1.current, DRIFT_B1, g0, gd, { rotate: true, ease: 'sine.in', onT: (t) => driftLine?.setAttribute('stroke-dashoffset', String(1 - t)) })
      camT.to(tl, { x: 980, y: 440, zoom: 1.3 }, g0 + 1.4, gd - 0.8)
      tl.fromTo('.d1-cone', { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: gd / CONE.length, ease: 'power1.out', immediateRender: false }, g0 + 0.5)
      fade(tl, '.d1-lab-small', 1, g0 + 1.6)
      fade(tl, '.d1-lab-bigger', 1, g0 + 4.6)
      fade(tl, '.d1-lab-unfam', 1, g0 + 5.2)
      // the hit
      const hit = g0 + gd
      cameraShake(camT, tl, hit)
      tl.fromTo('.d1-cupb1', { x: 0, y: 0, rotation: 0 }, { x: 150, y: -16, rotation: 60, duration: 0.55, ease: 'power2.out', svgOrigin: `${CUP_B1.x} ${CUP_B1.y}`, immediateRender: false }, hit)
      tl.fromTo('.d1-cupb1', { scale: 1, opacity: 1 }, { scale: 0.55, opacity: 0, duration: 0.5, ease: 'power2.in', svgOrigin: `${CUP_B1.x + 150} ${CUP_B1.y}`, immediateRender: false }, hit + 0.5)
      fade(tl, '.d1-hit', 1, hit, 0.12)
      fade(tl, '.d1-hit', 0, hit + 0.5, 0.8, 1)
      tl.to({}, { duration: 1.4 }, hit + 0.6)

      /* b2: the play. */
      const b2 = hit + 2.0
      tl.addLabel('b2', b2)
      fade(tl, '.d1-top', 0, b2, 0.6, 1)
      fade(tl, '.d1-play', 1, b2 + 0.2, 0.8)
      tl.fromTo('.d1-play-in', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.12, ease: 'power2.out', immediateRender: false }, b2 + 0.6)
      tl.to({}, { duration: 0.4 }, b2 + 1.8)

      /* b3: chunks. The hand's path, planned fifty steps at a time. */
      const b3 = b2 + 2.2
      tl.addLabel('b3', b3)
      fade(tl, '.d1-play', 0, b3, 0.6, 1)
      fade(tl, '.d1-chunk', 1, b3 + 0.2, 0.8)
      letterbox(tl, '.d1-lb', true, b3)
      camK.to(tl, { x: 780, y: 450, zoom: 1.1 }, b3, 9.4, 'sine.inOut')
      const k0 = b3 + 0.8
      const kd = 7.4
      along(tl, handGo.current, CHUNK_ROUTE, k0, kd, { ease: 'sine.inOut' })
      hand.to(tl, { pose: GRASPS.open }, k0, 1.2)
      hand.to(tl, { pose: GRASPS.claw, view: { yaw: 60, pitch: -4, roll: 180, s: 1.5 } }, k0 + kd - 1.4, 1.2)
      for (let i = 0; i < NCHUNKS; i++) {
        const at = k0 + (i / NCHUNKS) * kd * 0.96
        tl.fromTo(`.d1-ch-${i}`, { opacity: 0 }, { opacity: 1, duration: 0.25, immediateRender: false }, at - 0.1)
        drawOn(tl, `.d1-ch-${i} .d1-chline`, at - 0.1, 0.35, 'power1.out')
        tl.to(`.d1-ch-${i}`, { opacity: 0.35, duration: 0.8 }, at + 1.4)
      }
      fade(tl, '.d1-lab-chunk', 1, b3 + 2.2)
      fade(tl, '.d1-lab-pi0', 1, b3 + 5.0)
      tl.to({}, { duration: 0.6 }, b3 + 9.6)
    },
    [hand],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.d1-glow', { opacity: 0.55, duration: 2.2, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.d1-hz', { textContent: 50, duration: 1, repeat: -1, ease: 'none', snap: { textContent: 1 } })
    gsap.fromTo('.d1-warn', { scale: 1 }, { scale: 1.25, duration: 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '50% 50%' })
  })

  /* ---------------- the play ---------------- */
  const inPlay = cueIndex === 2
  const [opts, setOpts] = useState<DriftOptions>({ recovery: false, dagger: false, chunk: false })
  const [collect, setCollect] = useState(0)
  const [recov, setRecov] = useState(0)
  const [history, setHistory] = useState<RunRecord[]>([])
  const [streak, setStreak] = useState(0)
  const [won, setWon] = useState(false)
  const [, setTick] = useState(0)
  const runRef = useRef<Runner | null>(null)
  const [run, setRun] = useState<Runner | null>(null)
  const [chaining, setChaining] = useState(false)
  const streakRef = useRef(0)
  const helpsRef = useRef(0)
  const daggerRef = useRef<Sample[]>([])
  const [daggerPts, setDaggerPts] = useState<Pt[]>([])
  const chainRef = useRef(0)
  const seedRef = useRef(1)
  const [crashAt, setCrashAt] = useState<{ p: Pt; obj: number; id: number } | null>(null)

  const startRun = useCallback(() => {
    const pol = trainPolicy(opts, daggerRef.current)
    const nr = new Runner(DRIFT_TRACK, pol, opts, 17 + seedRef.current++ * 13)
    runRef.current = nr
    setRun(nr)
    helpsRef.current = 0
    setCrashAt(null)
    emit({ type: 'progress', detail: `trained on ${pol.data.length} samples (${fixName(opts)}) and started a run` })
    setTick((t) => t + 1)
  }, [opts, emit])

  const finishRun = useCallback(
    (r: Runner) => {
      daggerRef.current = r.policy.data.filter((s) => s.kind === 'dagger')
      const status = r.status === 'success' ? 'success' : 'crash'
      const helps = helpsRef.current
      setHistory((h) => [...h.slice(-5), { errs: r.errs, trail: r.trail, status, helps, decisions: r.decisions, opts: { ...r.opts } }])
      runRef.current = null
      setRun(null)
      if (status === 'crash') {
        let best = 0
        OBJECTS.forEach((o, i) => {
          if (Math.hypot(o.x - r.p.x, o.y - r.p.y) < Math.hypot(OBJECTS[best].x - r.p.x, OBJECTS[best].y - r.p.y)) best = i
        })
        setCrashAt({ p: { ...r.p }, obj: best, id: Date.now() })
        streakRef.current = 0
        setStreak(0)
        chainRef.current = 0
        setChaining(false)
        emit({ type: 'attempt', correct: false, detail: `the robot drifted off the path and hit something after ${r.t} steps (${fixName(r.opts)})` })
        return
      }
      emit({ type: 'attempt', correct: true, detail: `the robot reached the shelf (${fixName(r.opts)}${helpsRef.current ? `, stepped in ${helpsRef.current} times` : ''})` })
      const n = streakRef.current + 1
      streakRef.current = n
      setStreak(n)
      if (n >= 3) {
        setWon(true)
        void say('Perfect demonstrations aren’t enough. A robot learns most from the moments it went wrong and someone showed it the way back.')
        onPlayDone()
      } else {
        chainRef.current = 0.9
        setChaining(true)
      }
    },
    [emit, say, onPlayDone],
  )

  const busy = !!run || chaining
  const animDemos = collect > 0 && collect < 1
  const animRecov = opts.recovery && recov < 1
  useTicker(inPlay && playing && (busy || animDemos || animRecov), (dt) => {
    if (animDemos) setCollect((c) => Math.min(1, c + dt / 2.6))
    if (animRecov && collect >= 1) setRecov((c) => Math.min(1, c + dt / 1.6))
    if (chainRef.current > 0) {
      chainRef.current -= dt
      if (chainRef.current <= 0) {
        chainRef.current = 0
        setChaining(false)
        startRun()
      }
      return
    }
    const r = runRef.current
    if (!r) return
    if (r.status === 'needs-help') return
    for (let i = 0; i < 2; i++) {
      const s = r.step()
      if (s === 'success' || s === 'crash') {
        finishRun(r)
        break
      }
      if (s === 'needs-help') break
    }
    setTick((t) => t + 1)
  })

  const stepIn = () => {
    const r = runRef.current
    if (!r || r.status !== 'needs-help') return
    const added = r.stepIn()
    helpsRef.current++
    if (added) setDaggerPts((d) => [...d, ...added].slice(-900))
    emit({ type: 'progress', detail: 'stepped in and showed it the way back (DAgger correction)' })
    setTick((t) => t + 1)
  }

  const toggle = (k: keyof DriftOptions) => {
    if (runRef.current) return
    setOpts((o) => ({ ...o, [k]: !o[k] }))
    if (k === 'recovery' && !opts.recovery) setRecov(0)
    emit({ type: 'progress', detail: `${opts[k] ? 'turned off' : 'turned on'} ${k === 'recovery' ? 'recovery demos' : k === 'dagger' ? 'stepping in (DAgger)' : 'action chunking (10 steps at a time)'}` })
  }

  const live = run ? run.trail : null
  const last = history[history.length - 1]

  useEffect(() => {
    if (cueIndex !== 2) {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
      return
    }
    const runs = history.length
    const desc =
      `The learner’s turn. Top-down tabletop obstacle course: a gripper carrying a mug must travel from a dock on the left, along a winding lane between books, bottles and plants, to a shelf on the right. ` +
      `Buttons: Collect 5 demos, Train and run; toggles: Add recovery demos, Step in when it drifts (DAgger), Predict 10 steps at a time (action chunking). A small plot top right shows distance off the demo path over time for each run. ` +
      `Progress: demos ${collect >= 1 ? 'collected' : 'not collected yet'}; fixes on: ${fixName(opts)}; ${runs} runs so far` +
      (last ? `; last run ${last.status === 'success' ? 'reached the shelf' : 'drifted and crashed'}${last.helps ? ` with ${last.helps} step-ins` : ''}` : '') +
      `; ${streak} successful runs in a row (3 needed). ${run?.status === 'needs-help' ? 'Right now the run is paused, waiting for the learner to tap to step in. ' : ''}` +
      `What is happening: the policy is a nearest-neighbour copy of the demonstrations with a small error each decision; with only five perfect demos it never saw off-path states, so its errors grow and it crashes (error curve bends upward like T squared). ` +
      `Any fix works: recovery demos give it data in drifted states, stepping in (DAgger) labels the states it actually visits, chunking cuts the number of decisions by ten. Likely mix-up: thinking more perfect demos would help; they don’t cover the drifted states.`
    reportState(desc)
    setHints(HINTS)
  }, [cueIndex, history, streak, opts, collect, run?.status, last, reportState, setHints, run])

  const crashObj = crashAt ? OBJECTS[crashAt.obj] : null
  const heading = (() => {
    const t = live ?? last?.trail
    if (!t || t.length < 2) return 0
    const a = t[Math.max(0, t.length - 4)]
    const b = t[t.length - 1]
    return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
  })()
  const gp = live ? live[live.length - 1] : last ? last.trail[last.trail.length - 1] : START
  const unf = run ? Math.min(1, run.trail.length > 1 ? (DRIFT_TRACK.nearest(gp).dist / LANE) ** 1.3 : 0) : 0
  const demoD = useMemo(() => DEMOS.map((d) => pathD(d.states)), [])
  const recovD = useMemo(() => RECOVERY.map((d) => pathD(d.states)), [])
  const trackD = useMemo(() => pathD(DRIFT_TRACK.pts), [])

  return (
    <g ref={root}>
      {/* ================= b0a: Ada's monitor ================= */}
      <g className="d1-mon" ref={monRef} pointerEvents="none">
        <g data-depth="0.4">
          <rect x={-600} y={-500} width={2800} height={1900} fill={C.ink} />
          <g filter="url(#cn-dof-3)" opacity={0.6}>
            <rect x={1300} y={80} width={260} height={480} fill={C.ink2} />
            <circle cx={1420} cy={180} r={40} fill={C.rim} opacity={0.3} />
            <circle cx={120} cy={160} r={30} fill={C.key} opacity={0.25} />
          </g>
        </g>
        <g data-depth="1">
          <Pool x={800} y={420} r={720} color="rim" opacity={0.35} />
          <Monitor x={200} y={110} w={1200} h={620}>
            <rect x={200} y={110} width={1200} height={620} fill="url(#cn-grid)" opacity={0.25} />
            <Tag x={232} y={150} color={C.lime} size={20}>
              train_policy.py · behaviour cloning
            </Tag>
            {/* the conveyor of (frame, action) pairs */}
            <clipPath id="d1-belt-clip">
              <rect x={210} y={180} width={600} height={360} />
            </clipPath>
            <g clipPath="url(#d1-belt-clip)">
              <g className="d1-belt">
                {Array.from({ length: 9 }, (_, i) => {
                  const a = ((i * 53) % 120) - 60
                  return (
                    <g key={i} transform={`translate(${i * 190 - 340} ${230 + (i % 2) * 140})`}>
                      <Thumb x={0} y={0} w={124} h={84} seed={i + 3} />
                      <g transform={`translate(156 42) rotate(${a})`}>
                        <line x1={-20} y1={0} x2={20} y2={0} stroke={C.lime} strokeWidth={5} markerEnd="url(#cn-arrow)" />
                      </g>
                      <text x={80} y={112} fill={C.mist} fontFamily={MONO} fontSize={17} textAnchor="middle">
                        (frame, action)
                      </text>
                    </g>
                  )
                })}
              </g>
            </g>
            <path d="M790 370 L850 370" stroke={C.lime} strokeWidth={3} markerEnd="url(#cn-arrow)" opacity={0.7} />
            {/* the policy */}
            <g className="d1-pulse">
              <rect x={860} y={280} width={200} height={180} rx={24} fill={C.lime} fillOpacity={0.08} stroke={C.lime} strokeWidth={3} filter="url(#cn-bloom)" />
              {[0, 1, 2].map((c) => [0, 1, 2, 3].map((r) => <circle key={`${c}${r}`} cx={905 + c * 55} cy={315 + r * 36 + (c === 1 ? 0 : 8)} r={7} fill={C.lime} opacity={0.8} />))}
              {[0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((q) => <line key={`a${r}${q}`} x1={905} y1={323 + r * 36} x2={960} y2={315 + q * 36} stroke={C.lime} strokeOpacity={0.25} />))}
              {[0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((q) => <line key={`b${r}${q}`} x1={960} y1={315 + r * 36} x2={1015} y2={323 + q * 36} stroke={C.lime} strokeOpacity={0.25} />))}
            </g>
            {/* the loss curve */}
            <path d="M1110 220 V500 H1370" stroke={C.fog} strokeWidth={2} fill="none" />
            <path className="d1-loss" pathLength={1} strokeDashoffset={1} strokeDasharray="1 1" d="M1114 232 C 1140 330 1150 390 1180 430 S 1230 466 1260 474 S 1330 484 1366 486" stroke={C.lime} strokeWidth={4} fill="none" />
            <Tag x={1370} y={530} size={17} anchor="end">
              training steps →
            </Tag>
            <Label className="d1-lab-loss" x={1180} y={430} tx={1220} ty={330} text="error on the demos falls" color={C.lime} size={22} />
            <Label className="d1-lab-pairs" x={500} y={600} tx={500} ty={610} text="what Kofi saw, and what Kofi did" color={C.mist} size={26} anchor="middle" dot={false} />
            <Label className="d1-lab-policy" x={960} y={460} tx={960} ty={510} text="policy" color={C.lime} size={30} anchor="middle" />
          </Monitor>
          <g className="d1-glow" opacity={0.3}>
            <Pool x={800} y={420} r={500} color="lime" opacity={0.25} />
          </g>
        </g>
        <g data-depth="1.6">
          <g filter="url(#cn-dof-2)">
            <Person name="d1-ada" x={-60} y={1230} s={2.7} pose={POSES.type} light="screen" {...ADA} />
          </g>
        </g>
      </g>

      {/* ================= b0b: Seven copies Kofi ================= */}
      <g className="d1-copy" ref={copyRef} opacity={0} pointerEvents="none">
        <g data-depth="0.25">
          <LabSky />
        </g>
        <g data-depth="0.6">
          <LabWall />
        </g>
        <g data-depth="1">
          <LabFloor />
          <Workbench x={820} y={TABLE_TOP} w={560} lampClass="d1-lamp" />
          <g className="d1-mug">
            <rect x={MUG.x - 22} y={MUG.y - 46} width={44} height={46} rx={6} fill="#e8b44a" />
            <path d={`M${MUG.x + 22} ${MUG.y - 36} q 18 0 18 14 q 0 14 -18 14`} fill="none" stroke="#e8b44a" strokeWidth={6} />
            <rect x={MUG.x - 18} y={MUG.y - 42} width={8} height={36} rx={3} fill={C.white} opacity={0.35} />
          </g>
          <g opacity={0.45} filter="url(#cn-bloom)">
            <Person name="d1-kofi" x={SEVEN.x - 40} y={SEVEN.y} s={SEVEN.s} pose={POSES.stand} silhouette={C.lime} headset outfit="tee" />
          </g>
          <path className="d1-kpath" pathLength={1} strokeDashoffset={1} strokeDasharray="1 1" d={pathD(KOFI_PATH)} stroke={C.lime} strokeWidth={3} fill="none" opacity={0.9} />
          <Robot name="d1-seven" x={SEVEN.x} y={SEVEN.y} s={SEVEN.s} pose={POSES.stand} light="key-left" />
          <Label className="d1-lab-kofi" x={700} y={520} tx={790} ty={420} text="Kofi’s recorded reach" color={C.lime} size={24} />
          <Label className="d1-lab-seven" x={SEVEN.x + 20} y={SEVEN.y - 330} tx={SEVEN.x - 90} ty={SEVEN.y - 400} text="Seven, copying it" color={C.paper} size={24} anchor="end" />
          <Dust x={200} y={200} w={1200} h={500} count={30} seed={8} color={C.rim} size={0.8} />
        </g>
      </g>

      {/* ================= b1: top-down drift ================= */}
      <g className="d1-top" ref={topRef} opacity={0} pointerEvents="none">
        <g data-depth="0.8">
          <TopTable x={130} y={150} w={1260} h={640} seed={6} lampX={760} lampY={460} />
        </g>
        <g data-depth="1">
          <path className="d1-band" d={pathD(EXPERT_B1)} stroke={C.lime} strokeWidth={18} strokeLinecap="round" fill="none" opacity={0} />
          <path className="d1-expert" pathLength={1} strokeDashoffset={1} strokeDasharray="1 1" d={pathD(EXPERT_B1)} stroke={C.lime} strokeWidth={4} fill="none" />
          {CONE.map((d, i) => (
            <path key={i} className="d1-cone" d={d} fill={C.danger} opacity={0} fillOpacity={0.22} />
          ))}
          <path className="d1-drift" pathLength={1} strokeDashoffset={1} strokeDasharray="1 1" d={pathD(DRIFT_B1)} stroke={C.cyan} strokeWidth={3.5} fill="none" />
          <g className="d1-cupb1">
            <TopCup x={CUP_B1.x} y={CUP_B1.y} s={0.9} rot={30} />
          </g>
          <g ref={gripB1} transform={`translate(${DRIFT_B1[0].x} ${DRIFT_B1[0].y})`}>
            <TopGripper />
          </g>
          <g className="d1-hit" opacity={0}>
            <Pool x={CUP_B1.x} y={CUP_B1.y} r={170} color="danger" opacity={0.9} />
          </g>
          <Label className="d1-lab-expert" x={EXPERT_B1[90].x} y={EXPERT_B1[90].y} tx={EXPERT_B1[90].x - 40} ty={EXPERT_B1[90].y - 90} text="Kofi’s path" color={C.lime} size={24} anchor="end" />
          <Label className="d1-lab-small" x={DRIFT_B1[30].x} y={DRIFT_B1[30].y} tx={DRIFT_B1[30].x - 20} ty={DRIFT_B1[30].y + 110} text="a tiny error" color={C.cyan} size={24} anchor="middle" />
          <Label className="d1-lab-bigger" x={DRIFT_B1[80].x} y={DRIFT_B1[80].y} tx={DRIFT_B1[80].x - 80} ty={DRIFT_B1[80].y + 120} text="a bigger one" color={C.cyan} size={24} anchor="middle" />
          <Label className="d1-lab-unfam" x={DRIFT_B1[100].x} y={DRIFT_B1[100].y + 40} tx={DRIFT_B1[100].x + 30} ty={DRIFT_B1[100].y + 150} text="unfamiliar states" sub="it never saw these spots" color={C.danger} size={26} anchor="middle" />
          <Dust x={150} y={150} w={1260} h={640} count={22} seed={12} size={0.7} />
        </g>
      </g>

      {/* ================= b2: the play ================= */}
      <g className="d1-play" opacity={0} pointerEvents={inPlay ? 'auto' : 'none'}>
        <TopTable x={70} y={150} w={1460} h={620} seed={9} lampX={800} lampY={430} />
        {/* the hit area for stepping in */}
        <rect x={70} y={150} width={1460} height={620} fill="transparent" onClick={stepIn} style={{ cursor: run?.status === 'needs-help' ? 'pointer' : 'default' }} />
        <g pointerEvents="none">
          {/* the dock and the shelf */}
          <circle cx={START.x} cy={START.y} r={40} fill={C.ink2} stroke={C.cyan} strokeWidth={2} strokeDasharray="6 6" />
          <g transform={`translate(${END.x + 34} ${END.y - 70})`}>
            <rect x={0} y={0} width={70} height={140} rx={6} fill="#2b2f3a" />
            <rect x={6} y={8} width={58} height={124} rx={4} fill="#3b4250" />
            <Tag x={35} y={-12} anchor="middle" size={16}>
              shelf
            </Tag>
          </g>
          {/* a faint lane, the route Kofi drove */}
          <path d={trackD} stroke={C.paper} strokeOpacity={0.05} strokeWidth={LANE * 2} fill="none" strokeLinecap="round" />
          {OBJECTS.map((o, i) => (
            <g key={i} className={crashObj === o ? 'd1-crashobj' : undefined}>
              <TopThing kind={o.kind} x={o.x} y={o.y} rot={o.rot} s={0.9} />
            </g>
          ))}
          {crashAt && crashObj && (
            <g key={crashAt.id}>
              <Pool x={crashObj.x} y={crashObj.y} r={90} color="danger" opacity={0.85} />
              <circle cx={crashAt.p.x} cy={crashAt.p.y} r={14} fill="none" stroke={C.danger} strokeWidth={4} />
            </g>
          )}
          {/* the data */}
          {demoD.map((d, i) => (
            <path key={i} d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - Math.max(0, Math.min(1, collect * 5 - i))} stroke={C.lime} strokeWidth={2.5} fill="none" opacity={0.75} />
          ))}
          {opts.recovery &&
            recovD.map((d, i) => (
              <path key={i} d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - Math.max(0, Math.min(1, recov * 3 - (i / recovD.length) * 2))} stroke={C.limeLight} strokeWidth={1.4} fill="none" opacity={0.5} />
            ))}
          {daggerPts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={2.4} fill={C.lime} opacity={0.8} />
          ))}
          {/* earlier runs, faint */}
          {history.slice(-3).map((h, i) => (
            <path key={i} d={pathD(h.trail)} stroke={h.status === 'crash' ? C.danger : C.cyan} strokeOpacity={0.28} strokeWidth={2} fill="none" />
          ))}
          {live && <path d={pathD(live)} stroke={C.cyan} strokeWidth={3} fill="none" />}
          {/* the gripper with its mug */}
          <g transform={`translate(${gp.x} ${gp.y}) rotate(${heading})`}>
            {run && <circle r={22 + unf * 60} fill={C.danger} opacity={0.12 + unf * 0.25} />}
            <TopGripper open={0.3} />
            <TopCup x={34} y={0} s={0.5} />
          </g>
          {run?.status === 'needs-help' && (
            <g transform={`translate(${gp.x} ${gp.y})`}>
              <circle className="d1-warn" r={48} fill="none" stroke={C.lime} strokeWidth={4} />
              <Tag x={0} y={-66} anchor="middle" color={C.lime} size={20}>
                tap to step in
              </Tag>
            </g>
          )}
          {/* the error plot */}
          <rect x={PLOT.x - 30} y={PLOT.y - 40} width={PLOT.w + 54} height={PLOT.h + 76} rx={10} fill={C.ink} fillOpacity={0.72} />
          <path d={`M${PLOT.x} ${PLOT.y} V${PLOT.y + PLOT.h} H${PLOT.x + PLOT.w}`} stroke={C.fog} strokeWidth={2} fill="none" />
          <line x1={PLOT.x} x2={PLOT.x + PLOT.w} y1={PLOT.y} y2={PLOT.y} stroke={C.danger} strokeDasharray="5 5" strokeWidth={1.5} opacity={0.7} />
          <Tag x={PLOT.x + PLOT.w} y={PLOT.y - 8} anchor="end" color={C.danger} size={14}>
            hits something
          </Tag>
          <Tag x={PLOT.x} y={PLOT.y - 16} size={15}>
            off the demo path
          </Tag>
          <Tag x={PLOT.x + PLOT.w} y={PLOT.y + PLOT.h + 22} anchor="end" size={15}>
            time →
          </Tag>
          {/* reference shapes: error growing like T² and like T */}
          <path d={`M${PLOT.x} ${PLOT.y + PLOT.h} Q ${PLOT.x + PLOT.w * 0.32} ${PLOT.y + PLOT.h} ${PLOT.x + PLOT.w * 0.45} ${PLOT.y}`} stroke={C.danger} strokeOpacity={0.35} strokeDasharray="2 5" fill="none" strokeWidth={2} />
          <Tag x={PLOT.x + PLOT.w * 0.47} y={PLOT.y + 20} color={C.danger} size={14}>
            ε·T²
          </Tag>
          <path d={`M${PLOT.x} ${PLOT.y + PLOT.h} L ${PLOT.x + PLOT.w} ${PLOT.y + PLOT.h * 0.62}`} stroke={C.lime} strokeOpacity={0.35} strokeDasharray="2 5" fill="none" strokeWidth={2} />
          <Tag x={PLOT.x + PLOT.w - 4} y={PLOT.y + PLOT.h * 0.62 - 8} anchor="end" color={C.lime} size={14}>
            ε·T
          </Tag>
          {history.map((h, i) => (
            <path key={i} d={plotPath(h.errs)} stroke={h.status === 'crash' ? C.danger : C.lime} strokeWidth={2} fill="none" opacity={0.35 + (0.6 * (i + 1)) / history.length} />
          ))}
          {run && <path d={plotPath(run.errs)} stroke={C.cyan} strokeWidth={2.5} fill="none" />}
          {/* the streak */}
          <g transform="translate(110 200)">
            <text x={0} y={0} fill={C.mist} fontFamily={SANS} fontSize={24}>
              runs in a row
            </text>
            {[0, 1, 2].map((i) => (
              <circle key={i} cx={180 + i * 34} cy={-8} r={12} fill={i < streak ? C.lime : 'none'} stroke={C.lime} strokeWidth={2} />
            ))}
            {(run || last) && (
              <Tag x={0} y={34} size={20} color={run ? C.cyan : last?.status === 'crash' ? C.danger : C.lime}>
                {run
                  ? `run ${history.length + 1} · ${run.decisions} decisions`
                  : `run ${history.length} · ${last?.status === 'crash' ? 'crashed' : 'reached the shelf'}${last?.helps ? ` · stepped in ×${last.helps}` : ''}`}
              </Tag>
            )}
            {opts.chunk && (
              <Tag x={0} y={62} size={18} color={C.lime}>
                {`one decision per ${CHUNK} steps`}
              </Tag>
            )}
          </g>
        </g>
        {/* the controls */}
        <g className="d1-play-in">
          <Chip x={175} y={835} w={270} text={collect >= 1 ? '5 demos ✓' : 'Collect 5 demos'} color={C.lime} active={collect >= 1} disabled={collect > 0 || !inPlay} onClick={() => setCollect(0.001)} tutor="collect-demos" />
        </g>
        <g className="d1-play-in">
          <Chip x={470} y={835} w={280} text={history.length ? 'Train and run again' : 'Train and run'} color={C.cyan} disabled={collect < 1 || busy || animRecov || won || !inPlay} onClick={() => startRun()} tutor="train-run" />
        </g>
        <g className="d1-play-in">
          <Chip x={470} y={98} w={290} text="Add recovery demos" color={C.lime} active={opts.recovery} disabled={busy || !inPlay} onClick={() => toggle('recovery')} tutor="fix-recovery" />
        </g>
        <g className="d1-play-in">
          <Chip x={790} y={98} w={310} text="Step in when it drifts" color={C.lime} active={opts.dagger} disabled={busy || !inPlay} onClick={() => toggle('dagger')} tutor="fix-dagger" />
        </g>
        <g className="d1-play-in">
          <Chip x={1100} y={98} w={270} text="10 steps at a time" color={C.lime} active={opts.chunk} disabled={busy || !inPlay} onClick={() => toggle('chunk')} tutor="fix-chunk" />
        </g>
      </g>

      {/* ================= b3: chunks ================= */}
      <g className="d1-chunk" ref={chunkRef} opacity={0} pointerEvents="none">
        <g data-depth="0.4">
          <rect x={-600} y={-500} width={2800} height={1900} fill={C.ink1} />
          <g filter="url(#cn-dof-3)" opacity={0.7}>
            <rect x={-100} y={80} width={300} height={600} fill={C.ink3} />
            <rect x={1250} y={120} width={420} height={560} fill={C.ink3} />
            <circle cx={1400} cy={240} r={50} fill={C.rim} opacity={0.3} />
            <circle cx={200} cy={200} r={36} fill={C.key} opacity={0.3} />
          </g>
          <Pool x={760} y={460} r={760} color="key" opacity={0.6} />
        </g>
        <g data-depth="1">
          {/* the bench the hand works over, and the mug it is heading for */}
          <rect x={-200} y={640} width={2000} height={400} fill={C.ink2} />
          <rect x={-200} y={640} width={2000} height={5} fill={C.keyDeep} opacity={0.7} />
          <ellipse cx={800} cy={650} rx={760} ry={40} fill={C.key} opacity={0.12} filter="url(#cn-dof-2)" />
          <g filter="url(#cn-dof-1)">
            <rect x={120} y={596} width={150} height={20} rx={3} fill="#7a3b3b" />
            <rect x={130} y={576} width={130} height={20} rx={3} fill="#3d5a7a" />
            <rect x={140} y={556} width={110} height={20} rx={3} fill="#a07b4f" />
            <path d="M560 640 Q 600 592 660 592 Q 720 592 760 640 Z" fill="#2d5d73" />
          </g>
          <rect x={1334} y={566} width={52} height={74} rx={8} fill="#e8b44a" />
          <path d="M1386 578 q 22 0 22 18 q 0 18 -22 18" fill="none" stroke="#e8b44a" strokeWidth={7} />
          <rect x={1340} y={572} width={10} height={60} rx={4} fill={C.white} opacity={0.35} />
          {Array.from({ length: NCHUNKS }, (_, i) => {
            const n = CHUNK_ROUTE.length
            const a = Math.floor((i / NCHUNKS) * n)
            const b = Math.min(n - 1, a + Math.floor(n / NCHUNKS * 1.7))
            // each chunk is planned from where the hand is, so it differs a little from the last
            const seg = CHUNK_ROUTE.slice(a, b + 1).map((p, k) => ({ x: p.x, y: p.y + 140 + Math.sin(i * 1.7) * 6 * (k / (b - a + 1)) }))
            return (
              <g key={i} className={`d1-ch-${i}`} opacity={0}>
                <path className="d1-chline" pathLength={1} strokeDashoffset={1} strokeDasharray="1 1" d={pathD(seg)} stroke={C.lime} strokeWidth={14} strokeOpacity={0.22} fill="none" strokeLinecap="round" />
                <path d={pathD(seg)} stroke={C.limeLight} strokeWidth={5} strokeDasharray="0.1 7" strokeLinecap="round" fill="none" />
                <circle cx={seg[0].x} cy={seg[0].y} r={7} fill={C.lime} filter="url(#cn-bloom)" />
              </g>
            )
          })}
          <g ref={handGo} transform={`translate(${CHUNK_ROUTE[0].x} ${CHUNK_ROUTE[0].y})`}>
            <Hand3D store={hand} x={0} y={0} look="robot" arm={520} light={[0.6, -0.8]} />
          </g>
          <Label className="d1-lab-chunk" x={CHUNK_ROUTE[50].x} y={CHUNK_ROUTE[50].y + 146} tx={CHUNK_ROUTE[50].x + 30} ty={720} text="one decision, a whole burst of steps" color={C.lime} size={26} />
          <g className="d1-lab-pi0" opacity={0}>
            <Label x={560} y={480} tx={260} ty={200} text="π0: 50-step chunks at up to 50 Hz" color={C.lime} size={32} hidden={false} anchor="start" />
            <text x={268} y={256} fill={C.mist} fontFamily={MONO} fontSize={20}>
              step <tspan className="d1-hz">0</tspan> / 50
            </text>
          </g>
          <Dust x={100} y={100} w={1400} h={700} count={34} seed={31} size={0.8} />
        </g>
      </g>

      <Vignette />
      <Letterbox className="d1-lb" />
    </g>
  )
}

/** A short shake for a camera built on this file's layers. */
function cameraShake(cam: ReturnType<typeof camera>, tl: gsap.core.Timeline, at: number) {
  cam.shake(tl, at, 0.9, 0.45)
}

export const ch1: Chapter = {
  id: 'drift',
  title: 'Copy, and drift',
  cues: CUES,
  Scene: Ch1Drift,
  deeper: [BehaviourCloningReading],
}
