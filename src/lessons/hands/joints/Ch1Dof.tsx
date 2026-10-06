import gsap from 'gsap'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { camera } from '../../../cine/camera'
import { GRASPS, handSegments, useHandStore, type HandPose } from '../../../cine/hand3d'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { POSES, Person, rig } from '../../../cine/people'
import { useDrag } from '../../../engine/svg'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { Big, Blueprint, Chip, Dust, FiveMap, Label, Pool, Vignette, fade, useAmbient } from '../shared/kit'
import { Hand3DX, projector } from './hand4'
import { Finger2D, Live, Mono, arc, chain, chime, useVals, type Pt } from './parts'
import { DofReading } from './readings'

export const CUES: Cue[] = [
  { id: 'back', say: 'Question one on our map: shape. How many joints does a hand need, and where?' },
  { id: 'door', say: 'Start simple. A door swings one way: one degree of freedom. Your shoulder can swing, lift and twist: three.' },
  { id: 'finger', say: 'A finger has four: three hinges that bend, plus a sideways spread at the knuckle.' },
  { id: 'count', say: 'Your turn. Move the finger into each ghost pose. Then tell me how many motors it would need to do all of them.', play: true },
  { id: 'twenty', say: 'Do that for a whole hand, and you’re asking for around twenty motors, squeezed into something the size of, well, a hand.' },
  { id: 'warning', say: 'One warning before we go on. When a company says its hand has twenty-two degrees of freedom, ask: counted how? Joints are not the same as motors.' },
]

const STATE = [
  'The five-question map from film 1: five tilted orbit rings around a slowly turning white robot hand, with the gold wall around them. The bone-white ring, "1. Shape (kinematics)", flares bright, and the camera dives through it into a dark blueprint space where a single robot finger floats side-on: three bone-white links joined by three pin joints.',
  'Blueprint space. On the left a door swings open on its hinge, a cyan arc tracing its one path, labelled "1". On the right Noor, the lead engineer, swings her arm forward, lifts it overhead and twists it, and three cyan arcs appear at her shoulder labelled swing, lift and twist, with a big "3". The point: count the independent ways something can move.',
  'The floating finger, side-on. Its knuckle (MCP), middle joint (PIP) and end joint (DIP) each bend in turn, each drawing a cyan arc, while a mono counter ticks 1, 2, 3. Then a small top view of the knuckle shows the finger swinging sideways (spread), and the counter reaches 4. A finger has 4 degrees of freedom.',
  '',
  'A whole white robot hand in x-ray, palm towards us. Twenty small amber motor capsules fade in at every joint (four per finger, four for the thumb), crowding, overlapping and glowing hot until the hand seems to swell. Label: "20 motors in a hand-sized space?". The point: full actuation of a human-like hand needs about twenty motors, which is very hard to pack.',
  'A glossy spec sheet slides in shouting "22 DOF!". A magnifying glass stamps down on the small print, which reads "active DOF: 6". Two labels: "DOF = joints that can move" and "actuated DOF = motors that drive them". The point: product sheets often count joints, not motors; ask how it was counted.',
]

/* ---------------- the floating finger ---------------- */
const FX = 400
const FY = 410
const LENS = [260, 170, 125]
const FW = 36
/** Ghost poses for the play: [MCP, PIP, DIP, spread]. */
const GHOSTS: { name: string; q: [number, number, number, number] }[] = [
  { name: 'hook', q: [0, 85, 55, 0] },
  { name: 'fingertip-only curl', q: [0, 0, 60, 0] },
  { name: 'straight point, spread to the side', q: [30, 0, 0, 20] },
]
const TOL = 10
const LIMITS: [number, number][] = [
  [-15, 100],
  [0, 110],
  [0, 95],
]
/** The top view of the knuckle (spread). */
const TOP = { x: 1330, y: 470, len: 140 }

/** The map's centre, and the shape ring's marker on it (where the camera dives). */
const MAP = { x: 800, y: 470 }
const DIVE = { x: MAP.x - 220, y: MAP.y + 11 }

/* ---------------- twenty motors ---------------- */
export const BIG = { x: 800, y: 780 }
export const BIG_VIEW = { yaw: 0, pitch: 4, roll: 0, s: 2.55 }
export const BIG_POSE: HandPose = { ...GRASPS.open, thumb: [6, 16, 6, 6], index: [4, 4, 2, 8], middle: [4, 4, 2, 0], ring: [4, 4, 2, 6], little: [4, 4, 2, 12] }

/** Where twenty motors would sit for full control: four per finger and four for the thumb. */
export function motorSpots(): { x: number; y: number; a: number }[] {
  const { segs } = handSegments(BIG_POSE)
  const proj = projector(BIG_VIEW, BIG.x, BIG.y)
  const out: { x: number; y: number; a: number }[] = []
  for (const sg of segs) {
    const a = proj(sg.a)
    const b = proj(sg.b)
    const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
    const at = (t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    if (sg.k === 0) {
      // the knuckle (or the thumb's base) needs two: bend and spread
      out.push({ ...at(0.05), a: ang + 90 })
      out.push({ ...at(0.38), a: ang })
    } else out.push({ ...at(0.1), a: ang })
  }
  return out
}

/** Draw a stroked path on (dash offset) and show its arrowheads. */
function draw(tl: gsap.core.Timeline, sel: string, at: number, dur: number, len = 400) {
  tl.fromTo(sel, { strokeDashoffset: len, opacity: 0 }, { strokeDashoffset: 0, opacity: 1, duration: dur, ease: 'power2.inOut', immediateRender: false }, at)
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

export function Ch1Dof({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints, memory }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const mapRef = useRef<SVGGElement>(null)
  const bpRef = useRef<SVGGElement>(null)
  const mapHand = useHandStore({ pose: GRASPS.relaxed, view: { yaw: -30, pitch: 6, roll: 0, s: 1.25 } })
  const bigHand = useHandStore({ pose: BIG_POSE, view: BIG_VIEW, xray: 0 })
  const f = useVals({ m: 0, p: 0, d: 0, s: 0, door: 0 })
  const spots = useMemo(motorSpots, [])

  /* the play */
  const [stage, setStage] = useState(0)
  const [locked, setLocked] = useState<number[]>([])
  const [pick, setPick] = useState<number | null>(null)
  const [fail, setFail] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const playing3 = cueIndex === 3
  const allMatched = locked.length === 3
  const tries = useRef(0)
  const tryTl = useRef<gsap.core.Tween | null>(null)

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const mapCam = camera(mapRef.current, { x: 800, y: 470, zoom: 0.92 })
      const cam = camera(bpRef.current, { x: 800, y: 450, zoom: 0.55 })
      const noor = rig(root.current, 'd-noor', { ...POSES.stand })

      /* b0: the map; the bone ring flares; dive through it into the blueprint. */
      tl.addLabel('b0', 0)
      tl.set('.d-bp', { opacity: 0 }, 0)
      mapHand.to(tl, { view: { yaw: 24 } }, 0, 6.4, 'sine.inOut')
      mapCam.to(tl, { x: 760, y: 470, zoom: 1.02 }, 0, 2.2, 'sine.inOut')
      tl.fromTo('.fm-ring-shape', { opacity: 0.22 }, { opacity: 1, duration: 0.7, immediateRender: false }, 0.9)
      tl.fromTo('.fm-lab-shape', { opacity: 0.35 }, { opacity: 1, duration: 0.7, immediateRender: false }, 0.9)
      fade(tl, '.d-flare', 1, 1.1, 0.6)
      tl.fromTo('.d-flare', { scale: 0.4, svgOrigin: `${DIVE.x} ${DIVE.y}` }, { scale: 1.3, duration: 1.6, ease: 'power2.out', svgOrigin: `${DIVE.x} ${DIVE.y}`, immediateRender: false }, 1.1)
      fade(tl, '.fm-ring-muscle, .fm-ring-tendons, .fm-ring-touch, .fm-ring-brain, .fm-ring-wall', 0.06, 1.6, 1, 0.22)
      mapCam.to(tl, { x: DIVE.x, y: DIVE.y, zoom: 1.5 }, 2.2, 1.4, 'power1.in')
      mapCam.to(tl, { x: DIVE.x, y: DIVE.y, zoom: 9 }, 3.6, 1.2, 'power3.in')
      fade(tl, '.d-bp', 1, 4.2, 0.8)
      fade(tl, '.d-map', 0, 4.6, 0.4, 1)
      cam.to(tl, { x: 760, y: 450, zoom: 1 }, 4.2, 2.2, 'power3.out')
      fade(tl, '.d-lab-finger', 1, 5.4, 0.6)

      /* b1: the door (one), the shoulder (three). */
      const b1 = 6.6
      tl.addLabel('b1', b1)
      fade(tl, '.d-lab-finger', 0, b1, 0.4, 1)
      fade(tl, '.d-finger', 0, b1, 0.8, 1)
      cam.to(tl, { x: 800, y: 450, zoom: 1 }, b1, 1)
      fade(tl, '.d-door', 1, b1 + 0.3, 0.7)
      f.to(tl, { door: 78 }, b1 + 0.8, 1.6, 'power2.inOut')
      draw(tl, '.d-doorarc', b1 + 0.8, 1.6, 700)
      fade(tl, '.d-one', 1, b1 + 2.2, 0.5)
      f.to(tl, { door: 30 }, b1 + 2.6, 1.6, 'sine.inOut')
      f.to(tl, { door: 70 }, b1 + 4.2, 1.8, 'sine.inOut')
      f.to(tl, { door: 40 }, b1 + 6.0, 2, 'sine.inOut')
      fade(tl, '.d-noor', 1, b1 + 2.6, 0.8)
      // swing
      noor.to(tl, { armN: -40, elbowN: 4 }, b1 + 3.2, 0.5)
      noor.to(tl, { armN: 80, elbowN: 4 }, b1 + 3.7, 0.7)
      draw(tl, '.d-arc-0', b1 + 3.6, 0.8)
      fade(tl, '.d-arcl-0', 1, b1 + 3.9, 0.4)
      // lift
      noor.to(tl, { armN: 165, elbowN: 4, head: -12 }, b1 + 4.5, 0.8)
      draw(tl, '.d-arc-1', b1 + 4.5, 0.8)
      fade(tl, '.d-arcl-1', 1, b1 + 4.8, 0.4)
      // twist
      noor.to(tl, { armN: 70, elbowN: 90, wristN: 20, head: 0 }, b1 + 5.4, 0.6)
      noor.to(tl, { elbowN: 60, wristN: -20 }, b1 + 6.0, 0.4)
      noor.to(tl, { elbowN: 90, wristN: 20 }, b1 + 6.4, 0.4)
      draw(tl, '.d-arc-2', b1 + 5.6, 0.8)
      fade(tl, '.d-arcl-2', 1, b1 + 5.9, 0.4)
      fade(tl, '.d-three', 1, b1 + 6.7, 0.5)
      noor.to(tl, { ...POSES.relaxed }, b1 + 7.2, 1)

      /* b2: the finger's four. */
      const b2 = b1 + 8.6
      tl.addLabel('b2', b2)
      fade(tl, '.d-door, .d-noor', 0, b2, 0.6, 1)
      fade(tl, '.d-finger', 1, b2 + 0.2, 0.6, 0)
      cam.to(tl, { x: 820, y: 430, zoom: 1.04 }, b2, 6.2, 'sine.inOut')
      fade(tl, '.d-counter', 1, b2 + 0.4, 0.4)
      const bend = (k: 'm' | 'p' | 'd', v: number, at: number, n: number) => {
        f.to(tl, { [k]: v }, at, 0.7)
        draw(tl, `.d-jarc-${n}`, at, 0.7, 300)
        fade(tl, `.d-count-${n}`, 1, at + 0.5, 0.2)
        if (n > 0) fade(tl, `.d-count-${n - 1}`, 0, at + 0.5, 0.2, 1)
        f.to(tl, { [k]: 0 }, at + 1.0, 0.5)
        tl.to(`.d-jarc-${n}`, { opacity: 0.35, duration: 0.5 }, at + 1.0)
      }
      bend('m', 55, b2 + 0.5, 0)
      bend('p', 80, b2 + 1.9, 1)
      bend('d', 60, b2 + 3.2, 2)
      fade(tl, '.d-top', 1, b2 + 4.2, 0.5)
      f.to(tl, { s: 22 }, b2 + 4.4, 0.5)
      draw(tl, '.d-jarc-3', b2 + 4.4, 0.8, 300)
      f.to(tl, { s: -22 }, b2 + 4.9, 0.7)
      fade(tl, '.d-count-3', 1, b2 + 5.0, 0.2)
      fade(tl, '.d-count-2', 0, b2 + 5.0, 0.2, 1)
      tl.fromTo('.d-count-3', { scale: 1.6, svgOrigin: '1180 160' }, { scale: 1, duration: 0.5, ease: 'back.out(3)', svgOrigin: '1180 160', immediateRender: false }, b2 + 5.0)
      f.to(tl, { s: 0 }, b2 + 5.6, 0.5)

      /* b3: the play (the scene takes over the finger). */
      const b3 = b2 + 6.6
      tl.addLabel('b3', b3)
      fade(tl, '.d-jarcs', 0, b3, 0.4, 1)
      fade(tl, '.d-counter', 0, b3, 0.4, 1)
      cam.to(tl, { x: 800, y: 450, zoom: 1 }, b3, 0.8)
      f.to(tl, { m: 0, p: 0, d: 0, s: 0 }, b3, 0.4)
      fade(tl, '.d-play', 1, b3 + 0.3, 0.6)

      /* b4: twenty motors. */
      const b4 = b3 + 1.2
      tl.addLabel('b4', b4)
      fade(tl, '.d-play, .d-finger, .d-top', 0, b4, 0.6, 1)
      fade(tl, '.d-big', 1, b4 + 0.3, 0.8)
      bigHand.to(tl, { xray: 1 }, b4 + 0.6, 1.2)
      cam.to(tl, { x: 800, y: 520, zoom: 0.92 }, b4, 0.01)
      cam.to(tl, { x: 800, y: 470, zoom: 1.12 }, b4 + 0.2, 8.4, 'sine.inOut')
      tl.fromTo('.d-motor', { opacity: 0, scale: 0.2 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2.5)', stagger: 0.12, immediateRender: false }, b4 + 1.4)
      // crowding: they swell and run hot; the hand bloats
      tl.fromTo('.d-motor', { scale: 1 }, { scale: 1.75, duration: 2.4, ease: 'power1.in', stagger: 0.03, immediateRender: false }, b4 + 4.2)
      fade(tl, '.d-heat', 1, b4 + 4.4, 2)
      fade(tl, '.d-motor-hot', 0.6, b4 + 4.8, 2)
      tl.fromTo('.d-bloat', { scale: 1 }, { scale: 1.1, duration: 2.6, ease: 'power1.inOut', svgOrigin: `${BIG.x} ${BIG.y - 200}`, immediateRender: false }, b4 + 4.4)
      fade(tl, '.d-lab-20', 1, b4 + 5.2, 0.6)
      cam.shake(tl, b4 + 6.6, 0.5, 0.5)

      /* b5: the spec sheet, the magnifier, the two definitions. */
      const b5 = b4 + 9.4
      tl.addLabel('b5', b5)
      fade(tl, '.d-lab-20', 0, b5, 0.4, 1)
      tl.fromTo('.d-bigwrap', { opacity: 1 }, { opacity: 0.25, duration: 0.8, immediateRender: false }, b5)
      cam.to(tl, { x: 800, y: 450, zoom: 1 }, b5, 1.2)
      tl.fromTo('.d-sheet', { x: 900, rotation: 8, svgOrigin: '820 420' }, { x: 0, rotation: -4, svgOrigin: '820 420', duration: 1, ease: 'power3.out', immediateRender: false }, b5 + 0.2)
      fade(tl, '.d-sheet', 1, b5 + 0.2, 0.3)
      tl.fromTo('.d-lens', { x: 420, y: -380, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: 1, ease: 'power2.inOut', immediateRender: false }, b5 + 2.4)
      tl.fromTo('.d-lens', { scale: 1.2, svgOrigin: '960 590' }, { scale: 1, duration: 0.25, ease: 'power3.in', svgOrigin: '960 590', immediateRender: false }, b5 + 3.4)
      cam.shake(tl, b5 + 3.65, 0.6, 0.35)
      fade(tl, '.d-truth', 1, b5 + 3.6, 0.3)
      cam.to(tl, { x: 900, y: 540, zoom: 1.16 }, b5 + 3.6, 2.4, 'power2.out')
      fade(tl, '.d-def-a', 1, b5 + 6.4, 0.6)
      fade(tl, '.d-def-b', 1, b5 + 7.4, 0.6)
      cam.to(tl, { x: 800, y: 480, zoom: 0.98 }, b5 + 6.2, 1.8)
      tl.to({}, { duration: 0.4 }, b5 + 10.8)
    },
    [mapHand, bigHand, f],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.d-hover', { y: -10, duration: 2.6, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.d-heatpulse', { opacity: 0.55, duration: 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.d-ghostpulse', { opacity: 0.55, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.d-motor-in', { opacity: 0.4, duration: 0.35, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: { each: 0.07, repeat: -1, yoyo: true } })
  })

  /* ---------------- the play ---------------- */
  const live = f.state
  const angles = (): [number, number, number, number] => [live.m, live.p, live.d, live.s]
  const ghost = GHOSTS[Math.min(stage, 2)]
  const off = (q: number[], g: number[]) => Math.max(...q.map((v, i) => Math.abs(v - g[i])))

  const check = useCallback(() => {
    if (cueIndex !== 3 || done || allMatched) return
    const g = GHOSTS[stage]
    if (!g || locked.includes(stage)) return
    if (off(angles(), g.q) <= TOL) {
      chime()
      f.set({ m: g.q[0], p: g.q[1], d: g.q[2], s: g.q[3] })
      setLocked((l) => [...l, stage])
      emit({ type: 'progress', detail: `matched the ${g.name} ghost (${stage + 1} of 3)` })
      window.setTimeout(() => {
        if (stage < 2) {
          setStage(stage + 1)
        }
      }, 900)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cueIndex, done, allMatched, stage, locked, emit, f])

  const setJoint = (k: 0 | 1 | 2, p: Pt) => {
    if (!playing3 || allMatched || locked.includes(stage)) return
    const pts = chain(FX, FY, 0, LENS, [live.m, live.p, live.d])
    const j = pts[k]
    let a = (Math.atan2(p.y - j.y, p.x - j.x) * 180) / Math.PI
    const parent = [0, live.m, live.m + live.p][k]
    a -= parent
    if (a < -90) a += 360
    const v = clamp(a, LIMITS[k][0], LIMITS[k][1])
    f.set(k === 0 ? { m: v } : k === 1 ? { p: v } : { d: v })
    check()
  }
  const setSpread = (p: Pt) => {
    if (!playing3 || allMatched || locked.includes(stage)) return
    const a = (Math.atan2(p.x - TOP.x, TOP.y - p.y) * 180) / Math.PI
    f.set({ s: clamp(-a, -30, 30) })
    check()
  }
  const drag0 = useDrag({ onStart: (p) => setJoint(0, p), onMove: (p) => setJoint(0, p) })
  const drag1 = useDrag({ onStart: (p) => setJoint(1, p), onMove: (p) => setJoint(1, p) })
  const drag2 = useDrag({ onStart: (p) => setJoint(2, p), onMove: (p) => setJoint(2, p) })
  const dragS = useDrag({ onStart: setSpread, onMove: setSpread })
  const drags = [drag0, drag1, drag2]

  const choose = (n: number) => {
    if (!playing3 || !allMatched || done) return
    setPick(n)
    tryTl.current?.kill()
    if (n === 4) {
      setFail(null)
      setDone(true)
      memory.jointsMotors = 4
      emit({ type: 'attempt', correct: true, detail: 'four motors: one per independent motion' })
      void say('Four. One motor per independent motion, if you want full control.').then(() => onPlayDone())
      return
    }
    tries.current++
    if (n > 4) {
      setFail(n === 5 ? 'one is spare' : 'two are spare')
      emit({ type: 'attempt', correct: false, detail: `chose ${n} motors: more than the four independent motions` })
      return
    }
    // fewer than four: the finger tries the fingertip-only curl with joints sharing motors, and fails
    emit({ type: 'attempt', correct: false, detail: `chose ${n} motors: joints have to share, so the fingertip cannot curl alone` })
    setFail(n === 1 ? 'one motor: every joint curls together' : n === 2 ? 'two motors: the end joints are chained' : 'three motors: two joints have to share')
    const proxy = { t: 0 }
    f.set({ m: 0, p: 0, d: 0, s: 0 })
    tryTl.current = gsap.to(proxy, {
      t: 1,
      duration: 1.4,
      ease: 'power2.inOut',
      yoyo: true,
      repeat: 1,
      repeatDelay: 0.6,
      onUpdate: () => {
        const t = proxy.t
        // it aims for the tip (DIP 60) but the shared drive drags the other joints with it
        f.set({ d: 60 * t, p: n <= 3 ? 60 * t : 0, m: n === 1 ? 45 * t : 0 })
      },
    })
  }

  useEffect(() => () => void tryTl.current?.kill(), [])

  /* ---------------- Pip ---------------- */
  const [, setTick] = useState(0)
  useEffect(() => f.subscribe(() => setTick((n) => n + 1)), [f])
  useEffect(() => {
    if (cueIndex === 3) {
      const q = angles().map((v) => Math.round(v))
      reportState(
        'The play: a side-on robot finger on the blueprint with three draggable joint handles (MCP at the knuckle, PIP in the middle, DIP at the end) and a small top-view dial for sideways spread at the knuckle. ' +
          `Dashed ghost poses appear one at a time; the learner must drag each joint to match (within ${TOL} degrees). ` +
          (allMatched
            ? 'All three ghosts are matched. Now a row of number chips 1 to 6 asks "motors needed to make every pose?". '
            : `Current ghost ${stage + 1} of 3: "${ghost.name}" = MCP ${ghost.q[0]}, PIP ${ghost.q[1]}, DIP ${ghost.q[2]}, spread ${ghost.q[3]} degrees. The finger is at MCP ${q[0]}, PIP ${q[1]}, DIP ${q[2]}, spread ${q[3]}. Matched so far: ${locked.length}. `) +
          (pick !== null ? `The learner picked ${pick}. ` : '') +
          (fail ? `Feedback on screen: "${fail}". ` : '') +
          (done ? 'Solved. ' : '') +
          'Correct answer: 4 motors (one per independent joint motion: three bends plus the spread). Likely mix-ups: answering 3 (forgetting the sideways spread), or fewer because the poses look similar; with fewer motors two joints must share a drive, so the fingertip cannot curl on its own.',
      )
      setHints(['Drag each joint separately until the outline matches.', 'Each joint that must move on its own needs its own drive.'])
    } else {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cueIndex, stage, locked, pick, fail, done, allMatched, reportState, setHints, Math.round(live.m / 5), Math.round(live.p / 5), Math.round(live.d / 5), Math.round(live.s / 5)])

  /* ---------------- the picture ---------------- */
  const shoulder = { x: 1230 - 6 * 1.45, y: 860 - 238 * 1.45 }
  return (
    <g ref={root}>
      {/* ---------- the map ---------- */}
      <g className="d-map" ref={mapRef}>
        <g data-depth="0.4">
          <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink} />
          <circle cx={800} cy={470} r={760} fill="url(#cn-pool-rim)" opacity={0.18} />
          <Dust x={-200} y={-100} w={2000} h={1100} count={40} seed={8} color={C.mist} size={0.7} />
        </g>
        <g data-depth="1">
          <FiveMap cx={MAP.x} cy={MAP.y} />
          <Hand3DX store={mapHand} x={MAP.x} y={MAP.y + 110} look="robot" arm={70} light={[0.7, -0.6]} />
          <g className="d-flare" opacity={0}>
            <circle cx={DIVE.x} cy={DIVE.y} r={90} fill="url(#cn-pool-paper)" />
            <circle cx={DIVE.x} cy={DIVE.y} r={22} fill={C.bone} filter="url(#cn-bloom)" />
          </g>
        </g>
      </g>

      {/* ---------- the blueprint world ---------- */}
      <g className="d-bp" ref={bpRef} opacity={0}>
        <g data-depth="0.4">
          <Blueprint />
          <Dust x={-300} y={-200} w={2200} h={1300} count={34} seed={12} color={C.cyan} size={0.6} />
        </g>
        <g data-depth="1">
          {/* the finger */}
          <g className="d-finger">
            <g className="d-hover">
              <Live store={f}>
                {(s) => {
                  const pts = chain(FX, FY, 0, LENS, [s.m, s.p, s.d])
                  return (
                    <g>
                      <ellipse cx={FX + 220} cy={FY + 260} rx={300} ry={18} fill="#000" opacity={0.35} filter="url(#cn-dof-2)" />
                      {/* the palm stub it hangs from */}
                      <path d={`M${FX - 130} ${FY - 46} L${FX - 6} ${FY - 46} Q${FX + 18} ${FY} ${FX - 6} ${FY + 46} L${FX - 130} ${FY + 46} Z`} fill={C.ink2} stroke={C.bone} strokeWidth={3} opacity={0.8} />
                      <path d={`M${FX - 130} ${FY - 46} L${FX - 200} ${FY - 46} M${FX - 130} ${FY + 46} L${FX - 200} ${FY + 46}`} stroke={C.bone} strokeWidth={3} strokeDasharray="8 8" opacity={0.5} />
                      {/* the play's ghost */}
                      {playing3 && !allMatched && (
                        <g className="d-ghostpulse" opacity={0.9}>
                          <Finger2D x={FX} y={FY} lens={LENS} q={ghost.q.slice(0, 3)} look="ghost" w={FW} color={locked.includes(stage) ? C.lime : C.paper} />
                        </g>
                      )}
                      <Finger2D x={FX} y={FY} lens={LENS} q={[s.m, s.p, s.d]} look="bone" w={FW} />
                      {/* bend arcs, one per hinge */}
                      <g className="d-jarcs">
                        {[0, 1, 2].map((k) => {
                          const base = [0, s.m, s.m + s.p][k]
                          return <path key={k} className={`d-jarc-${k}`} d={arc(pts[k].x, pts[k].y, 86 - k * 10, base - 4, base + [62, 88, 68][k])} stroke={C.cyan} strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray="300" strokeDashoffset="300" opacity={0} markerEnd="url(#cn-arrow)" />
                        })}
                      </g>
                      {/* the joint handles */}
                      {playing3 &&
                        [0, 1, 2].map((k) => {
                          const a = pts[k]
                          const b = pts[k + 1]
                          const h = { x: a.x + (b.x - a.x) * 0.62, y: a.y + (b.y - a.y) * 0.62 }
                          const name = ['MCP', 'PIP', 'DIP'][k]
                          const lock = allMatched || locked.includes(stage)
                          return (
                            <g key={k} data-tutor={`joint-${name}`} {...(lock ? {} : drags[k])}>
                              <circle cx={h.x} cy={h.y} r={40} fill="transparent" />
                              <circle cx={h.x} cy={h.y} r={22} fill={C.ink1} fillOpacity={0.7} stroke={C.cyan} strokeWidth={4} className={lock ? undefined : 'hd-pulse'} />
                              <circle cx={h.x} cy={h.y} r={7} fill={C.cyan} />
                              <text x={a.x} y={a.y - 44} textAnchor="middle" fill={C.cyanLight} fontFamily={MONO} fontSize={20} pointerEvents="none" style={{ paintOrder: 'stroke' }} stroke={C.ink} strokeWidth={5}>
                                {name}
                              </text>
                            </g>
                          )
                        })}
                    </g>
                  )
                }}
              </Live>
            </g>
            <Label className="d-lab-finger" x={FX + 10} y={FY - 30} tx={FX + 60} ty={FY - 170} text="one robot finger, side-on" color={C.bone} />
          </g>

          {/* the top view of the knuckle: spread */}
          <g className="d-top" opacity={0}>
            <Live store={f}>
              {(s) => {
                const a = (-s.s * Math.PI) / 180
                const tip = { x: TOP.x + Math.sin(a) * TOP.len, y: TOP.y - Math.cos(a) * TOP.len }
                const g = playing3 && !allMatched ? (-ghost.q[3] * Math.PI) / 180 : null
                return (
                  <g>
                    <text x={TOP.x} y={TOP.y + 92} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={22}>
                      top view: spread
                    </text>
                    <rect x={TOP.x - 110} y={TOP.y + 14} width={220} height={40} rx={10} fill={C.ink2} stroke={C.bone} strokeWidth={2.5} opacity={0.8} />
                    <path className="d-jarc-3" d={arc(TOP.x, TOP.y, TOP.len + 30, -122, -58)} stroke={C.cyan} strokeWidth={5} fill="none" strokeLinecap="round" strokeDasharray="300" strokeDashoffset={cueIndex >= 3 ? 0 : 300} opacity={cueIndex >= 3 ? 1 : 0} markerEnd="url(#cn-arrow)" markerStart="url(#cn-arrow)" />
                    {g !== null && <path d={`M${TOP.x} ${TOP.y} L${TOP.x + Math.sin(g) * TOP.len} ${TOP.y - Math.cos(g) * TOP.len}`} stroke={C.paper} strokeWidth={30} strokeLinecap="round" opacity={0.18} strokeDasharray="10 8" />}
                    <path d={`M${TOP.x} ${TOP.y} L${tip.x} ${tip.y}`} stroke={C.bone} strokeWidth={26} strokeLinecap="round" />
                    <path d={`M${TOP.x} ${TOP.y} L${tip.x} ${tip.y}`} stroke={C.ink2} strokeWidth={20} strokeLinecap="round" />
                    <circle cx={TOP.x} cy={TOP.y} r={18} fill={C.ink1} stroke={C.bone} strokeWidth={3} />
                    <circle cx={TOP.x} cy={TOP.y} r={6} fill={C.bone} />
                    {playing3 && (
                      <g data-tutor="spread-dial" {...(allMatched || locked.includes(stage) ? {} : dragS)}>
                        <circle cx={TOP.x + Math.sin(a) * (TOP.len + 30)} cy={TOP.y - Math.cos(a) * (TOP.len + 30)} r={36} fill="transparent" />
                        <circle cx={TOP.x + Math.sin(a) * (TOP.len + 30)} cy={TOP.y - Math.cos(a) * (TOP.len + 30)} r={20} fill={C.ink1} stroke={C.cyan} strokeWidth={4} className={allMatched ? undefined : 'hd-pulse'} />
                        <circle cx={TOP.x + Math.sin(a) * (TOP.len + 30)} cy={TOP.y - Math.cos(a) * (TOP.len + 30)} r={6} fill={C.cyan} />
                      </g>
                    )}
                  </g>
                )
              }}
            </Live>
          </g>

          {/* the counter */}
          <g className="d-counter" opacity={0} pointerEvents="none">
            <text x={1180} y={118} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={22} letterSpacing={3}>
              DEGREES OF FREEDOM
            </text>
            {[1, 2, 3, 4].map((n, i) => (
              <text key={n} className={`d-count-${i}`} x={1180} y={196} textAnchor="middle" fill={C.cyan} fontFamily={MONO} fontSize={84} fontWeight={600} opacity={0}>
                {n}
              </text>
            ))}
          </g>

          {/* the door: one way to move */}
          <g className="d-door" opacity={0} pointerEvents="none">
            <Live store={f}>
              {(s) => {
                const hx = 300
                const top = 250
                const bot = 650
                const W = 210
                const a = (s.door * Math.PI) / 180
                const ex = hx + W * Math.cos(a)
                const dy = W * Math.sin(a) * 0.18
                return (
                  <g>
                    <ellipse cx={hx + 40} cy={bot + 6} rx={260} ry={22} fill="#000" opacity={0.4} filter="url(#cn-dof-2)" />
                    <rect x={hx - 8} y={top - 10} width={W + 16} height={bot - top + 10} fill="none" stroke={C.bone} strokeWidth={4} opacity={0.6} />
                    <path className="d-doorarc" d={`M${hx + W} ${bot} A ${W} ${W * 0.36} 0 0 1 ${hx + W * Math.cos(1.36)} ${bot + W * 0.36 * Math.sin(1.36)}`} stroke={C.cyan} strokeWidth={5} fill="none" strokeDasharray="700" strokeDashoffset="700" opacity={0} markerEnd="url(#cn-arrow)" />
                    <path d={`M${hx} ${top} L${ex} ${top + dy * 0.6} L${ex} ${bot + dy} L${hx} ${bot} Z`} fill={C.ink3} stroke={C.bone} strokeWidth={4} strokeLinejoin="round" />
                    <circle cx={hx + (ex - hx) * 0.82} cy={(top + bot) / 2 + dy * 0.8} r={8} fill={C.bone} />
                    {[top + 40, bot - 40].map((y) => (
                      <rect key={y} x={hx - 7} y={y - 14} width={14} height={28} rx={4} fill={C.cyan} />
                    ))}
                  </g>
                )
              }}
            </Live>
            <g className="d-one" opacity={0}>
              <Big x={640} y={420} size={130} color={C.cyan} hidden={false}>
                1
              </Big>
              <Mono x={640} y={466} anchor="middle" color={C.cyanLight}>
                one way to move
              </Mono>
            </g>
          </g>

          {/* the shoulder: three */}
          <g className="d-noor" opacity={0} pointerEvents="none">
            <Pool x={1230} y={520} r={460} color="key" opacity={0.45} />
            <ellipse cx={1230} cy={864} rx={130} ry={12} fill="#000" opacity={0.5} filter="url(#cn-dof-1)" />
            <Person name="d-noor" x={1230} y={860} s={1.45} flip hair="bun" top="#9c4a2c" topDark="#6a2e1a" skin={C.skinB} light="key-right" pose={POSES.stand} />
            <path className="d-arc-0" d={arc(shoulder.x, shoulder.y, 200, 96, 186)} stroke={C.cyan} strokeWidth={6} fill="none" strokeDasharray="400" strokeDashoffset="400" opacity={0} markerEnd="url(#cn-arrow)" markerStart="url(#cn-arrow)" />
            <path className="d-arc-1" d={arc(shoulder.x, shoulder.y, 250, 192, 262)} stroke={C.cyan} strokeWidth={6} fill="none" strokeDasharray="400" strokeDashoffset="400" opacity={0} markerEnd="url(#cn-arrow)" markerStart="url(#cn-arrow)" />
            <path className="d-arc-2" d={`M${shoulder.x - 80} ${shoulder.y - 40} a 34 64 -20 1 1 30 70`} stroke={C.cyan} strokeWidth={6} fill="none" strokeDasharray="400" strokeDashoffset="400" opacity={0} markerEnd="url(#cn-arrow)" />
            <Label className="d-arcl-0" x={shoulder.x - 150} y={shoulder.y + 132} tx={shoulder.x - 270} ty={shoulder.y + 200} text="swing" color={C.cyan} />
            <Label className="d-arcl-1" x={shoulder.x - 240} y={shoulder.y - 70} tx={shoulder.x - 340} ty={shoulder.y - 60} text="lift" color={C.cyan} />
            <Label className="d-arcl-2" x={shoulder.x - 90} y={shoulder.y - 90} tx={shoulder.x - 150} ty={shoulder.y - 200} text="twist" color={C.cyan} />
            <g className="d-three" opacity={0}>
              <Big x={1420} y={300} size={130} color={C.cyan} hidden={false}>
                3
              </Big>
            </g>
          </g>

          {/* the play: count the motors */}
          <g className="d-play" opacity={0}>
            {playing3 && (
              <g>
                <text x={FX - 160} y={130} fill={C.paper} fontFamily={SERIF} fontSize={40} fontWeight={600}>
                  {allMatched ? 'Motors needed to make every pose?' : `Match the ghost: ${ghost.name}`}
                </text>
                <g transform={`translate(${FX - 160} 175)`}>
                  {GHOSTS.map((g, i) => (
                    <g key={g.name} transform={`translate(${i * 46} 0)`}>
                      <circle r={14} fill={locked.includes(i) ? C.lime : 'none'} stroke={locked.includes(i) ? C.lime : C.mist} strokeWidth={2.5} />
                      {locked.includes(i) && <path d="M-6 0 L-2 5 L7 -5" stroke={C.ink} strokeWidth={3} fill="none" strokeLinecap="round" />}
                    </g>
                  ))}
                  <text x={150} y={7} fill={C.mist} fontFamily={MONO} fontSize={18}>
                    {locked.length} of 3 matched
                  </text>
                </g>
                {allMatched && (
                  <g>
                    {[1, 2, 3, 4, 5, 6].map((n, i) => (
                      <Chip key={n} x={FX - 100 + i * 96} y={790} w={78} h={64} text={String(n)} color={C.amber} active={pick === n} disabled={done} tutor={`motors-${n}`} onClick={() => choose(n)} />
                    ))}
                    {fail && (
                      <text x={FX + 140} y={860} textAnchor="middle" fill={pick !== null && pick < 4 ? C.danger : C.amberLight} fontFamily={SANS} fontSize={26} fontWeight={500}>
                        {fail}
                        {pick !== null && pick < 4 ? ': the tip can’t curl alone' : ''}
                      </text>
                    )}
                    {pick !== null && pick < 4 && <Finger2D x={FX} y={FY} lens={LENS} q={GHOSTS[1].q.slice(0, 3)} look="ghost" w={FW} color={C.danger} opacity={0.8} />}
                  </g>
                )}
              </g>
            )}
          </g>

          {/* twenty motors in a hand */}
          <g className="d-big" opacity={0} pointerEvents="none">
            <g className="d-bigwrap">
              <g className="d-bloat">
                <Pool x={BIG.x} y={BIG.y - 260} r={520} color="rim" opacity={0.35} />
                <Hand3DX store={bigHand} x={BIG.x} y={BIG.y} look="robot" arm={260} light={[0.6, -0.7]} />
                <g className="d-heat" opacity={0}>
                  <g className="d-heatpulse" opacity={0.9}>
                    <Pool x={BIG.x} y={BIG.y - 250} r={380} color="danger" opacity={0.7} />
                  </g>
                </g>
                {spots.map((p, i) => (
                  <g key={i} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.a.toFixed(1)})`}>
                    <g className="d-motor" opacity={0}>
                      <rect x={-20} y={-11} width={40} height={22} rx={11} fill={C.amberDark} stroke={C.amber} strokeWidth={2.5} />
                      <rect className="d-motor-in" x={-12} y={-5} width={24} height={10} rx={5} fill={C.amberLight} opacity={0.9} />
                      <rect className="d-motor-hot" x={-20} y={-11} width={40} height={22} rx={11} fill={C.danger} opacity={0} />
                    </g>
                  </g>
                ))}
              </g>
            </g>
            <Label className="d-lab-20" x={BIG.x + 150} y={BIG.y - 300} tx={BIG.x + 250} ty={BIG.y - 150} text="20 motors" sub="in a hand-sized space?" color={C.amber} size={40} />
          </g>

          {/* the spec sheet */}
          <g className="d-sheet" opacity={0} pointerEvents="none">
            <rect x={560} y={150} width={520} height={600} rx={10} fill="#f1ede4" />
            <rect x={560} y={150} width={520} height={110} rx={10} fill="#1d2433" />
            <text x={600} y={222} fill="#f1ede4" fontFamily={SANS} fontSize={34} fontWeight={700} letterSpacing={2}>
              MEGAHAND X
            </text>
            <text x={820} y={410} textAnchor="middle" fill="#c2237f" fontFamily={SERIF} fontSize={128} fontWeight={700}>
              22 DOF!
            </text>
            <text x={820} y={470} textAnchor="middle" fill="#3a3f4a" fontFamily={SANS} fontSize={28}>
              human-level dexterity
            </text>
            {[520, 548, 576].map((y, i) => (
              <rect key={y} x={600} y={y} width={[400, 340, 380][i]} height={10} rx={5} fill="#b9b3a6" />
            ))}
            <text x={880} y={600} fill="#8a8478" fontFamily={MONO} fontSize={13}>
              *active DOF: 6
            </text>
            <rect x={600} y={640} width={200} height={10} rx={5} fill="#cfc9bc" />
          </g>
          <g className="d-lens" opacity={0} pointerEvents="none">
            <g className="d-truth" opacity={0}>
              <circle cx={960} cy={590} r={118} fill="#f7f3ea" />
              <text x={960} y={568} textAnchor="middle" fill="#1d2433" fontFamily={MONO} fontSize={28} fontWeight={700}>
                active DOF
              </text>
              <text x={960} y={650} textAnchor="middle" fill="#c2237f" fontFamily={MONO} fontSize={84} fontWeight={700}>
                6
              </text>
            </g>
            <circle cx={960} cy={590} r={118} fill={C.rim} fillOpacity={0.08} stroke={C.ink3} strokeWidth={16} />
            <circle cx={960} cy={590} r={118} fill="none" stroke={C.metal} strokeWidth={4} />
            <path d="M1045 675 L1150 780" stroke={C.ink3} strokeWidth={30} strokeLinecap="round" />
            <path d="M920 510 Q960 490 1000 505" stroke={C.white} strokeWidth={6} fill="none" opacity={0.5} strokeLinecap="round" />
          </g>
          <g className="d-def-a" opacity={0} pointerEvents="none">
            <text x={420} y={830} textAnchor="middle" fill={C.bone} fontFamily={SANS} fontSize={38} style={{ paintOrder: 'stroke' }} stroke={C.ink} strokeWidth={6}>
              <tspan fontWeight={700}>DOF</tspan> = joints that can move
            </text>
          </g>
          <g className="d-def-b" opacity={0} pointerEvents="none">
            <text x={1180} y={830} textAnchor="middle" fill={C.amber} fontFamily={SANS} fontSize={38} style={{ paintOrder: 'stroke' }} stroke={C.ink} strokeWidth={6}>
              <tspan fontWeight={700}>actuated DOF</tspan> = motors that drive them
            </text>
          </g>
        </g>
      </g>
      <Vignette />
    </g>
  )
}

export const ch1: Chapter = {
  id: 'dof',
  title: 'Counting freedom',
  cues: CUES,
  Scene: Ch1Dof,
  deeper: [DofReading],
}
