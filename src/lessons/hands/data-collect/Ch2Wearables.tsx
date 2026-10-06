import gsap from 'gsap'
import { useCallback, useEffect, useRef, useState } from 'react'
import { camera } from '../../../cine/camera'
import { GRASPS, Hand3D, useHandStore, type FingerName, type HandPose, type HandStore } from '../../../cine/hand3d'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { POSES, Person, Robot, rig } from '../../../cine/people'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Blueprint, Chip, Dust, Label, Letterbox, Pool, Vignette, fade, letterbox, useAmbient } from '../shared/kit'
import { LabSky } from '../shared/sets'
import { Arm2D, DcDefs, NOOR, Tag, clamp, drive, setArm, type ArmAngles } from './common'
import { WearablesReading } from './readings'

export const CUES: Cue[] = [
  { id: 'umi', say: 'In 2024, a team at Stanford had an idea. Skip the robot. Give a person a handheld copy of the robot’s gripper, with the same camera the robot will wear.' },
  { id: 'track', say: 'The camera’s own motion tells you where the gripper went. That path becomes the action label. No robot needed, so it can go into any home.' },
  { id: 'match', say: 'The trick only works if the device matches the robot. Design a data glove for our robot hand: decide what it must track, and what it must stop the human from doing.', play: true },
  { id: 'sunday', say: 'One company shipped two thousand of these gloves, at about two hundred dollars each, into five hundred homes. Its robot learned to load a dishwasher with no puppeting at all.' },
  { id: 'spork', say: 'The catch: a glove isn’t the robot. Arms have different reach and speed, and the stronger the learning gets, the more it notices the difference. One researcher calls this data a spork: half spoon, half fork, not quite either.' },
]

const HINTS = [
  'If the person can do a move the robot can’t, the recording is useless.',
  'Our robot’s ring and little fingers move together.',
  'Put the camera where the robot’s camera will be.',
]

const STATE = [
  'A home kitchen at night, lit by one pendant lamp. Noor, the lab’s hardware engineer, holds a handheld gripper (two soft fingers on a 3D-printed body) with a GoPro camera on top, and picks a cup off the counter and sets it on a rack. A round fisheye inset shows what that camera sees: the gripper’s own fingers at the bottom of the view, closing on the cup. Label: “UMI: about $400 of parts”. The point: skip the robot; give a person a copy of the robot’s gripper with the same camera the robot will wear.',
  'The camera’s path through the kitchen draws itself as a lime ribbon with little camera keyframes along it (worked out from the video and the camera’s motion sensors, called SLAM). Then the scene cuts to the lab, where a white robot arm with the same camera at its wrist follows the exact same lime ribbon. The point: the camera’s motion is the action label, so no robot is needed while collecting, and it can go into any home.',
  '', // the play: described live
  'A neighbourhood at night. Window after window lights up lime: people wearing data gloves at home. Lime streams flow from all the houses to one robot that loads a dishwasher. Labels: “2,000 gloves · 500 homes” and “Sunday: $200 glove vs $20,000 teleop rig (company figures)”. The point: cheap device-matched gloves gave Sunday Robotics a dishwasher-loading robot trained with zero teleoperation.',
  'A spork glints under the lamp (half spoon, half fork). Then a split screen: Noor reaches a cup on a high shelf easily; Seven, the robot, tries the same reach and stops short, its reach limit drawn as a red arc. The point: a glove isn’t the robot. Bodies differ in reach and speed, and stronger models notice the difference. Sergey Levine calls this kind of surrogate data a “spork”.',
]

/* ------------------------------------------------------------------ */
/* The glove play: what each choice does                                */
/* ------------------------------------------------------------------ */

type Feature = 'all20' | 'track6' | 'couple' | 'brace' | 'pads' | 'wristcam'
type Cfg = Record<Feature, boolean>
const FEATURES: { id: Feature; text: string }[] = [
  { id: 'all20', text: 'track all 20 human joints' },
  { id: 'track6', text: 'track only the robot’s 6 motions' },
  { id: 'couple', text: 'lock ring + little together' },
  { id: 'brace', text: 'thumb brace: robot’s range only' },
  { id: 'pads', text: 'fingertip pressure pads' },
  { id: 'wristcam', text: 'wrist camera, same as robot’s' },
]
const TASK_NAMES = ['pinch a coin', 'hold a mug', 'pour'] as const
type Why = 'none' | 'garbled' | 'couple' | 'brace' | 'camera'
const WHY_TEXT: Record<Why, string> = {
  none: 'nothing was recorded',
  garbled: '20 joints recorded, robot has 6',
  couple: 'robot can’t bend these separately',
  brace: 'thumb went where the robot’s can’t',
  camera: 'robot’s camera never saw this view',
}

/** Why task k's replay fails with this glove (null: it works). */
function failure(k: number, c: Cfg): Why | null {
  if (!c.all20 && !c.track6) return 'none'
  if (c.all20) return 'garbled'
  if (k === 1 && !c.couple) return 'couple'
  if (k === 0 && !c.brace) return 'brace'
  if (!c.wristcam) return 'camera'
  return null
}

/** What the person's hand does for each task, given what the glove lets it do. */
function humanPose(k: number, c: Cfg): HandPose {
  if (k === 0) {
    // pinch a coin: unbraced, a human thumb swings far across the palm
    return { ...GRASPS.pinch, thumb: c.brace ? [44, 30, 14, 16] : [78, 40, 18, 22] }
  }
  if (k === 1) {
    const ring: [number, number, number, number] = [54, 70, 36, 0]
    return { ...GRASPS.power, ring, little: c.couple ? [56, 70, 36, 2] : [10, 14, 6, 14], wrist: [6, 0] }
  }
  return { ...GRASPS.power, wrist: [6, 34] }
}

/** The robot's version of a pose: its thumb swing stops at 46°, ring and little share one motor. */
function robotPose(p: HandPose): HandPose {
  const avg = p.ring.map((v, i) => (v + p.little[i]) / 2) as [number, number, number, number]
  return { ...p, thumb: [Math.min(46, p.thumb[0]), p.thumb[1], p.thumb[2], p.thumb[3]], ring: [...avg] as typeof avg, little: [...avg] as typeof avg }
}
const GARBLED: HandPose = { thumb: [8, 50, 0, 30], index: [84, 6, 70, 0], middle: [6, 92, 4, 0], ring: [60, 0, 80, 0], little: [0, 70, 24, 0], wrist: [-10, -12] }

/** Tween a hand from wherever it is now (live), so the loop can restart at any moment. */
function liveTo(tl: gsap.core.Timeline, store: HandStore, target: () => { pose: HandPose; touch?: Partial<Record<FingerName, number>> }, at: number, dur: number) {
  const o = { u: 0 }
  let from: HandPose | null = null
  let fromT: Record<FingerName, number> | null = null
  let to: { pose: HandPose; touch?: Partial<Record<FingerName, number>> } | null = null
  const keys = ['thumb', 'index', 'middle', 'ring', 'little', 'wrist'] as const
  tl.fromTo(
    o,
    { u: 0 },
    {
      u: 1,
      duration: dur,
      ease: 'power2.inOut',
      immediateRender: false,
      onStart: () => {
        from = JSON.parse(JSON.stringify(store.state.pose))
        fromT = { ...store.state.touch }
        to = target()
      },
      onUpdate: () => {
        if (!from || !to || !fromT) return
        for (const k of keys) {
          const a = from[k] as number[]
          const b = to.pose[k] as number[]
          ;(store.state.pose[k] as number[]).forEach((_, i, arr) => (arr[i] = a[i] + (b[i] - a[i]) * o.u))
        }
        for (const f of ['thumb', 'index', 'middle', 'ring', 'little'] as FingerName[]) store.state.touch[f] = fromT[f] + ((to.touch?.[f] ?? 0) - fromT[f]) * o.u
        store.notify()
      },
    },
    at,
  )
}

/* ------------------------------------------------------------------ */
/* Where things are                                                     */
/* ------------------------------------------------------------------ */
const NOOR_AT = { x: 470, y: 900, s: 1.32 }
const COUNTER_Y = 664
/** The camera's path through the kitchen (stage points), and the same path replayed in the lab. */
const PATH_K = [
  [640, 742],
  [716, 694],
  [774, 642],
  [767, 595],
  [838, 584],
  [898, 600],
  [903, 644],
] as const
const LAB_ARM = { x: 600, y: 820, s: 1.3, lens: [210, 190, 60] as [number, number, number] }
const toLab = (p: readonly [number, number]) => [700 + (p[0] - 640) * 1.1, 540 + (p[1] - 584) * 1.1] as [number, number]
const PATH_L = PATH_K.map(toLab)

const smoothPath = (pts: readonly (readonly [number, number])[]) => {
  let d = `M${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`
  }
  return d
}
const samplePath = (pts: readonly (readonly [number, number])[], u: number) => {
  const segs = pts.length - 1
  const f = clamp(u) * segs
  const i = Math.min(segs - 1, Math.floor(f))
  const t = f - i
  const p0 = pts[Math.max(0, i - 1)]
  const p1 = pts[i]
  const p2 = pts[i + 1]
  const p3 = pts[Math.min(pts.length - 1, i + 2)]
  // Catmull-Rom, matching smoothPath
  const cr = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t)
  return [cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])] as [number, number]
}

/** Two-link inverse kinematics for Arm2D with the gripper pointing straight down. */
function ikDown(lens: [number, number, number], s: number, base: { x: number; y: number }, p: [number, number]): ArmAngles {
  const X = (p[0] - base.x) / s
  const Y = -((p[1] - base.y) / s - lens[2]) // wrist sits one link above the tip; Y up
  const [l1, l2] = lens
  const d = Math.min(l1 + l2 - 0.01, Math.hypot(X, Y))
  const c2 = clamp((d * d - l1 * l1 - l2 * l2) / (2 * l1 * l2), -1, 1)
  // Elbow up, for an arm reaching to its right.
  const q2 = -Math.acos(c2)
  const q1 = Math.atan2(Y, X) - Math.atan2(l2 * Math.sin(q2), l1 + l2 * Math.cos(q2))
  const a1 = 90 - (q1 * 180) / Math.PI
  const a2 = -(q2 * 180) / Math.PI
  return [a1, a2, 180 - a1 - a2]
}

export function Ch2Wearables({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const kitchenRef = useRef<SVGGElement>(null)
  const labRef = useRef<SVGGElement>(null)
  const playRef = useRef<SVGGElement>(null)
  const townRef = useRef<SVGGElement>(null)
  const sporkRef = useRef<SVGGElement>(null)
  const human = useHandStore({ pose: GRASPS.relaxed, view: { yaw: 14, pitch: 6, roll: 0, s: 1.45 } })
  const robot = useHandStore({ pose: robotPose(GRASPS.relaxed), view: { yaw: 14, pitch: 6, roll: 0, s: 1.45 } })

  // ---- the play's state
  const [cfg, setCfg] = useState<Cfg>({ all20: false, track6: false, couple: false, brace: false, pads: false, wristcam: false })
  const cfgRef = useRef(cfg)
  cfgRef.current = cfg
  const [task, setTask] = useState(0)
  const [phase, setPhase] = useState<'human' | 'replay' | 'result'>('human')
  const [outcome, setOutcome] = useState<Why | null>(null)
  const [results, setResults] = useState<({ key: string; why: Why | null } | null)[]>([null, null, null])
  const resultsRef = useRef(results)
  const [done, setDone] = useState(false)
  const doneRef = useRef(false)
  const loopRef = useRef<gsap.core.Timeline | null>(null)
  const taskRef = useRef(0)
  const playingRef = useRef(playing)
  playingRef.current = playing
  const cfgKey = FEATURES.map((f) => (cfg[f.id] ? 1 : 0)).join('')
  const active = cueIndex === 2

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const el = root.current
      const camK = camera(kitchenRef.current, { x: 760, y: 470, zoom: 1.08 })
      const camL = camera(labRef.current, { x: 880, y: 560, zoom: 1.1 })
      const camP = camera(playRef.current, { x: 800, y: 450, zoom: 1.08 })
      const camT = camera(townRef.current, { x: 800, y: 450, zoom: 1.05 })
      const camS = camera(sporkRef.current, { x: 800, y: 460, zoom: 1.6 })
      const noor = rig(el, 'c2-noor', POSES.stand)
      const sunbot = rig(el, 'c2-sunbot', POSES.stand)
      const noor2 = rig(el, 'c2-noor2', POSES.stand)
      const seven = rig(el, 'c2-seven', POSES.stand)
      const shots = ['.c2-kitchen', '.c2-lab', '.c2-play', '.c2-town', '.c2-spork']
      const show = (which: string, at: number) => shots.forEach((s) => tl.set(s, { opacity: s === which ? 1 : 0 }, at + 0.02))

      /* b0: Noor and the handheld gripper in a real kitchen. */
      tl.addLabel('b0', 0)
      show('.c2-kitchen', 0)
      camK.to(tl, { x: 720, y: 520, zoom: 1.28 }, 0, 9.6, 'sine.inOut')
      fade(tl, '.c2-inset', 1, 1.2, 0.8)
      noor.to(tl, { torso: 12, head: 16, armN: 60, elbowN: 34, wristN: 6, armF: 6, elbowF: 30 }, 0.8, 1.3)
      noor.to(tl, { torso: 18, head: 22, armN: 80, elbowN: 20, wristN: 10 }, 2.1, 1.1)
      // grip the cup: it leaves the counter (the inset shows the jaws closing)
      tl.set('.c2-cup-counter', { opacity: 1 }, 0)
      tl.set('.c2-cup-rack', { opacity: 0 }, 0)
      tl.set('.c2-cup-carry', { opacity: 0 }, 0)
      tl.set('.c2-cup-counter', { opacity: 0 }, 3.5)
      tl.set('.c2-cup-carry', { opacity: 1 }, 3.5)
      noor.to(tl, { torso: 10, head: 12, armN: 88, elbowN: 10, wristN: 10 }, 3.6, 0.9)
      noor.to(tl, { x: 50, legN: 18, kneeN: 10, legF: -14 }, 4.5, 0.6, 'sine.inOut')
      noor.to(tl, { x: 100, legN: 2, kneeN: 0, legF: -2 }, 5.1, 0.6, 'sine.inOut')
      noor.to(tl, { torso: 16, head: 20, armN: 80, elbowN: 14, wristN: 14 }, 5.7, 0.7)
      tl.set('.c2-cup-carry', { opacity: 0 }, 6.4)
      tl.set('.c2-cup-rack', { opacity: 1 }, 6.4)
      noor.to(tl, { torso: 4, head: 4, armN: 30, elbowN: 50, wristN: 0 }, 6.6, 1.2)
      // the inset: the cup comes closer, the jaws close, it lifts away
      tl.fromTo('.c2-fish-cup', { scale: 0.45, x: 60, y: -60 }, { scale: 1.15, x: 0, y: 0, duration: 2.4, ease: 'power2.inOut', svgOrigin: '1270 320', immediateRender: false }, 1.0)
      tl.fromTo('.c2-jaw-l', { x: 0 }, { x: 34, duration: 0.4, ease: 'power2.in', immediateRender: false }, 3.3)
      tl.fromTo('.c2-jaw-r', { x: 0 }, { x: -34, duration: 0.4, ease: 'power2.in', immediateRender: false }, 3.3)
      tl.fromTo('.c2-fish-world', { y: 0, x: 0 }, { y: 70, x: -90, duration: 2.6, ease: 'power2.inOut', immediateRender: false }, 3.7)
      tl.fromTo('.c2-jaw-l', { x: 34 }, { x: 0, duration: 0.4, immediateRender: false }, 6.4)
      tl.fromTo('.c2-jaw-r', { x: -34 }, { x: 0, duration: 0.4, immediateRender: false }, 6.4)
      fade(tl, '.c2-fish-cup', 0, 6.6, 0.4, 1)
      fade(tl, '.c2-lab-umi', 1, 2.0, 0.6)
      fade(tl, '.c2-lab-same', 1, 4.4, 0.6)

      /* b1: the camera's path becomes the action label; the robot arm replays it. */
      const b1 = 9.6
      tl.addLabel('b1', b1)
      fade(tl, '.c2-lab-umi, .c2-lab-same', 0, b1, 0.4, 1)
      camK.to(tl, { x: 740, y: 560, zoom: 1.55 }, b1, 2.4, 'power2.inOut')
      fade(tl, '.c2-inset', 0, b1, 0.5, 1)
      tl.fromTo('.c2-ribbon', { strokeDashoffset: 900 }, { strokeDashoffset: 0, duration: 3.6, ease: 'power1.inOut', immediateRender: false }, b1 + 0.3)
      fade(tl, '.c2-ribbon-g', 1, b1 + 0.3, 0.3)
      fade(tl, '.c2-kf', 1, b1 + 0.9, 0.4)
      tl.fromTo('.c2-kf', { scale: 0.3 }, { scale: 1, duration: 0.4, stagger: 0.5, ease: 'back.out(3)', immediateRender: false }, b1 + 0.9)
      fade(tl, '.c2-lab-label', 1, b1 + 2.8, 0.6)
      noor.to(tl, { armN: 10, elbowN: 30, torso: 0, head: 0, x: 40 }, b1, 1.2)
      // cut to the lab: the same ribbon, the robot follows it
      const lab = b1 + 4.6
      show('.c2-lab', lab)
      camL.to(tl, { x: 780, y: 560, zoom: 1.1 }, lab, 0.001)
      camL.to(tl, { x: 800, y: 540, zoom: 1.15 }, lab + 0.01, 6, 'sine.inOut')
      fade(tl, '.c2-lribbon', 1, lab + 0.2, 0.5)
      drive(tl, lab + 0.6, 4.6, (u) => {
        const p = samplePath(PATH_L, u)
        setArm(el, 'c2-arm', ikDown(LAB_ARM.lens, LAB_ARM.s, LAB_ARM, p), LAB_ARM.lens)
        el?.querySelector('.c2-dot')?.setAttribute('transform', `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})`)
      }, 'sine.inOut')
      fade(tl, '.c2-lab-copy', 1, lab + 1.4, 0.6)
      fade(tl, '.c2-lab-anyhome', 1, lab + 3.2, 0.6)

      /* b2: the glove bench (the play takes over once it's set up). */
      const b2 = lab + 6
      tl.addLabel('b2', b2)
      show('.c2-play', b2)
      camP.to(tl, { x: 800, y: 450, zoom: 1.08 }, b2, 0.001)
      camP.to(tl, { x: 800, y: 450, zoom: 1.0 }, b2 + 0.01, 3, 'power2.out')
      fade(tl, '.c2-glove', 1, b2 + 0.4, 0.8)

      /* b3: Sunday: windows light up, data flows to one robot at a dishwasher. */
      const b3 = b2 + 3.2
      tl.addLabel('b3', b3)
      show('.c2-town', b3)
      camT.to(tl, { x: 700, y: 460, zoom: 1.12 }, b3, 0.001)
      camT.to(tl, { x: 920, y: 470, zoom: 1.04 }, b3 + 0.01, 10.5, 'sine.inOut')
      tl.fromTo('.c2-win', { opacity: 0 }, { opacity: 1, duration: 0.25, stagger: { each: 0.06, from: 'random' }, immediateRender: false }, b3 + 0.4)
      fade(tl, '.c2-streams', 1, b3 + 3.2, 1.2)
      fade(tl, '.c2-count', 1, b3 + 1.0, 0.6)
      drive(tl, b3 + 1.0, 3.2, (u) => {
        const g = el?.querySelector('.c2-count-n')
        if (g) g.textContent = `${Math.round(u * 2000).toLocaleString('en-US')} gloves · ${Math.round(u * 500)} homes`
      }, 'power2.out')
      fade(tl, '.c2-lab-sunday', 1, b3 + 5.6, 0.6)
      for (let i = 0; i < 3; i++) {
        const t = b3 + 1.5 + i * 3
        sunbot.to(tl, { torso: 34, head: 20, armN: 30, elbowN: 10, armF: 20, elbowF: 20 }, t, 1.2)
        fade(tl, `.c2-plate-${i}`, 1, t + 1.2, 0.3)
        sunbot.to(tl, { torso: 6, head: 0, armN: 60, elbowN: 40, armF: 10, elbowF: 30 }, t + 1.4, 1.2)
      }

      /* b4: the spork, then reach: the human reaches the shelf, the robot can't. */
      const b4 = b3 + 10.8
      tl.addLabel('b4', b4)
      show('.c2-spork', b4)
      tl.set('.c2-split', { opacity: 0 }, b4)
      tl.set('.c2-sporkshot', { opacity: 1 }, b4)
      camS.to(tl, { x: 800, y: 460, zoom: 1.6 }, b4, 0.001)
      camS.to(tl, { x: 800, y: 470, zoom: 1.45 }, b4 + 0.01, 3.6, 'sine.inOut')
      tl.fromTo('.c2-glint', { x: -260 }, { x: 260, duration: 1.0, ease: 'power2.inOut', immediateRender: false }, b4 + 0.8)
      tl.fromTo('.c2-star', { scale: 0, rotation: 0, svgOrigin: '905 452' }, { scale: 1.2, rotation: 90, duration: 0.5, yoyo: true, repeat: 1, ease: 'power2.out', immediateRender: false }, b4 + 1.4)
      fade(tl, '.c2-lab-spork', 1, b4 + 2.0, 0.5)
      const sp = b4 + 3.8
      tl.set('.c2-sporkshot', { opacity: 0 }, sp)
      tl.set('.c2-split', { opacity: 1 }, sp)
      camS.to(tl, { x: 800, y: 450, zoom: 1.0 }, sp, 0.001)
      camS.to(tl, { x: 800, y: 470, zoom: 1.06 }, sp + 0.01, 8, 'sine.inOut')
      noor2.to(tl, { ...POSES.reachHigh, head: -24, armN: 150, elbowN: 16, torso: 2 }, sp + 0.6, 1.4)
      fade(tl, '.c2-n-cup', 0, sp + 2.0, 0.01, 1)
      fade(tl, '.c2-n-cuphand', 1, sp + 2.0, 0.01)
      noor2.to(tl, { ...POSES.hold }, sp + 2.6, 1.2)
      seven.to(tl, { torso: -2, head: -20, armN: 140, elbowN: 14 }, sp + 1.0, 1.6)
      seven.to(tl, { torso: -5, head: -24, armN: 150, elbowN: 4, y: -4 }, sp + 2.6, 0.5, 'power2.out')
      tl.fromTo('.c2-reach', { strokeDashoffset: 900 }, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.out', immediateRender: false }, sp + 3.0)
      fade(tl, '.c2-reach-g', 1, sp + 3.0, 0.3)
      fade(tl, '.c2-lab-reach', 1, sp + 3.6, 0.5)
      seven.to(tl, { torso: 0, head: -16, armN: 130, elbowN: 16, y: 0 }, sp + 4.2, 0.6)
      seven.to(tl, { torso: -5, head: -24, armN: 150, elbowN: 4, y: -4 }, sp + 5.0, 0.5, 'power2.out')
      fade(tl, '.c2-lab-noor', 1, sp + 1.6, 0.5)
      fade(tl, '.c2-lab-speed', 1, sp + 6.0, 0.5)
      letterbox(tl, '.c2-lb', true, sp + 8.2)
      tl.to({}, { duration: 0.3 }, sp + 10.8)
    },
    [],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.c2-hum', { opacity: 0.7, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.c2-flow', { strokeDashoffset: -200, duration: 3, repeat: -1, ease: 'none' })
    gsap.to('.c2-recdot', { opacity: 0.2, duration: 0.6, yoyo: true, repeat: -1, ease: 'steps(1)' })
    gsap.to('.c2-lamp', { rotation: 2, duration: 3.4, yoyo: true, repeat: -1, ease: 'sine.inOut', svgOrigin: '760 -40' })
  })

  /* ---------------- the play loop: the person does a task, the robot replays it ---------------- */
  useEffect(() => {
    if (!active) {
      loopRef.current?.kill()
      loopRef.current = null
      return
    }
    const tl = gsap.timeline({ repeat: -1, delay: loopRef.current ? 0.1 : 1.6 })
    loopRef.current?.kill()
    const start = taskRef.current
    for (let n = 0; n < 3; n++) {
      const k = (start + n) % 3
      const t0 = n * 3.6
      tl.call(() => {
        taskRef.current = k
        setTask(k)
        setPhase('human')
        setOutcome(null)
      }, [], t0)
      liveTo(tl, robot, () => ({ pose: robotPose(GRASPS.relaxed) }), t0, 0.4)
      liveTo(tl, human, () => ({ pose: humanPose(k, cfgRef.current), touch: cfgRef.current.pads ? { thumb: 0.7, index: 0.7, middle: k ? 0.6 : 0, ring: k ? 0.5 : 0 } : {} }), t0 + 0.1, 0.8)
      tl.call(() => setPhase('replay'), [], t0 + 1.1)
      liveTo(
        tl,
        robot,
        () => {
          const c = cfgRef.current
          const why = failure(k, c)
          const hp = humanPose(k, c)
          const pose = why === 'none' ? robotPose(GRASPS.relaxed) : why === 'garbled' ? GARBLED : robotPose(hp)
          return { pose, touch: c.pads && !why ? { thumb: 0.8, index: 0.8, middle: k ? 0.7 : 0, ring: k ? 0.6 : 0, little: k ? 0.6 : 0 } : {} }
        },
        t0 + 1.1,
        0.8,
      )
      tl.call(() => {
        const c = cfgRef.current
        const why = failure(k, c)
        const key = FEATURES.map((f) => (c[f.id] ? 1 : 0)).join('')
        setOutcome(why)
        setPhase('result')
        const next = resultsRef.current.map((x, i) => (i === k ? { key, why } : x))
        resultsRef.current = next
        setResults(next)
        if (!doneRef.current && next.every((x) => x && x.key === key && !x.why)) {
          doneRef.current = true
          setDone(true)
          emit({ type: 'attempt', correct: true, detail: 'all three replays succeeded: the glove tracks only the robot’s motions, couples ring and little, braces the thumb and has a wrist camera' })
          void say('A good glove makes the human move like the robot. That’s how DexUMI and Sunday’s glove close the gap: the data is cheap, but it still fits the robot’s body.')
          onPlayDone()
        } else if (why && !doneRef.current) {
          emit({ type: 'attempt', correct: false, detail: `${TASK_NAMES[k]} replay failed: ${WHY_TEXT[why]}` })
        }
      }, [], t0 + 1.95)
      liveTo(tl, human, () => ({ pose: GRASPS.relaxed }), t0 + 3.1, 0.5)
    }
    tl.to({}, { duration: 0.01 }, 10.8)
    loopRef.current = tl
    if (!playingRef.current) tl.pause()
    return () => {
      tl.kill()
    }
    // The loop restarts whenever the glove changes, from the task it was on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, cfgKey])

  useEffect(() => {
    const tl = loopRef.current
    if (!tl) return
    if (playing) tl.resume()
    else tl.pause()
  }, [playing])

  const toggle = (f: Feature) => {
    if (!active) return
    setCfg((c) => {
      const next = { ...c, [f]: !c[f] }
      if (f === 'all20' && next.all20) next.track6 = false
      if (f === 'track6' && next.track6) next.all20 = false
      return next
    })
    emit({ type: 'progress', detail: `${cfg[f] ? 'removed' : 'added'} “${FEATURES.find((x) => x.id === f)?.text}”` })
  }

  /* ---------------- what Pip sees ---------------- */
  useEffect(() => {
    if (cueIndex === 2) {
      const on = FEATURES.filter((f) => cfg[f.id]).map((f) => `“${f.text}”`)
      const res = results.map((r, i) => `${TASK_NAMES[i]}: ${r && r.key === cfgKey ? (r.why ? `fails (${WHY_TEXT[r.why]})` : 'replays fine') : 'not yet tried with this glove'}`)
      reportState(
        'The data-glove design bench. Left: a human hand wearing the glove. Right: our robot hand, which has 6 motions (2 for the thumb, whose swing is shorter than a human thumb’s; 1 each for index and middle; ring and little fingers share 1 motor; 1 at the wrist). Centre: the glove being designed, which grows each feature the learner switches on. Six switches along the bottom: track all 20 human joints; track only the robot’s 6 motions; lock ring + little together; thumb brace (robot’s range only); fingertip pressure pads; wrist camera, same as the robot’s. ' +
          'On a loop the person does three tasks (pinch a coin, hold a mug, pour) and the robot replays each recording; a failed replay drops the object, shows a red ghost of what the human did, and gives a reason. ' +
          `Switched on now: ${on.length ? on.join(', ') : 'nothing'}. Results: ${res.join('; ')}. ${done ? 'All three replays succeeded: the learner is done.' : ''} ` +
          'Correct answer: track only the robot’s 6 motions (not all 20 joints), lock ring and little together, add the thumb brace, and put the camera on the wrist like the robot’s; pressure pads are optional (they add grip force data). ' +
          'Likely mix-ups: thinking more tracking (all 20 joints) is better, when the robot can’t replay joints it doesn’t have; forgetting that a free human thumb or independent little finger makes moves the robot can’t copy; forgetting the camera has to match what the robot will see.',
      )
      setHints(HINTS)
    } else {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
    }
  }, [cueIndex, cfg, cfgKey, results, done, reportState, setHints])

  /* ---------------- objects that follow the fingertips ---------------- */
  const placeObj = (side: 'h' | 'r', tips: Record<FingerName, { x: number; y: number }>) => {
    const g = playRef.current?.querySelector(`.c2-obj-${side}`)
    const coin = playRef.current?.querySelector(`.c2-coin-${side}`)
    const wx = side === 'h' ? H.x : R.x
    const wy = H.y
    // the hand's axis, from the wrist to the middle fingertip: the mug and jug sit in the palm
    const ax = Math.atan2(tips.middle.x - wx, -(tips.middle.y - wy))
    // sit the object in the palm, nudged towards the thumb so it shows beside the hand
    const px = wx + Math.sin(ax) * 74 + Math.cos(ax) * 46
    const py = wy - Math.cos(ax) * 74 + Math.sin(ax) * 46
    g?.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${((ax * 180) / Math.PI).toFixed(1)})`)
    coin?.setAttribute('transform', `translate(${((tips.thumb.x + tips.index.x) / 2).toFixed(1)} ${((tips.thumb.y + tips.index.y) / 2).toFixed(1)})`)
    if (side === 'r') {
      const ring = playRef.current?.querySelector('.c2-badtip')
      const pick = outcomeRef.current === 'couple' ? tips.little : tips.thumb
      ring?.setAttribute('transform', `translate(${pick.x.toFixed(1)} ${pick.y.toFixed(1)})`)
    }
  }
  const outcomeRef = useRef<Why | null>(null)
  outcomeRef.current = outcome

  const H = { x: 260, y: 640 }
  const R = { x: 1340, y: 640 }
  const showObjH = active && phase !== 'human' ? 1 : active ? 0.0 : 0
  const robotHolds = active && phase === 'result' && !outcome
  const robotDrops = active && phase === 'result' && !!outcome && outcome !== 'none'
  const ghost = active && phase === 'result' && (outcome === 'couple' || outcome === 'brace')

  const objectArt = (k: number) =>
    k === 0 ? (
      <g>
        <ellipse rx={20} ry={20} fill={C.gold} stroke={C.goldDark} strokeWidth={3} />
        <ellipse rx={11} ry={11} fill="none" stroke={C.goldDark} strokeWidth={2} />
      </g>
    ) : k === 1 ? (
      <g transform="translate(0 10)">
        <path d="M44 -50 q 40 0 40 34 q 0 30 -40 30" fill="none" stroke="#c9d6e6" strokeWidth={12} />
        <rect x={-48} y={-80} width={96} height={130} rx={10} fill="#c9d6e6" />
        <rect x={-48} y={-80} width={30} height={130} rx={10} fill="#ffffff" opacity={0.45} />
        <ellipse cx={0} cy={-80} rx={48} ry={10} fill="#e8eef6" />
      </g>
    ) : (
      <g transform="translate(0 10)">
        <path d="M-40 50 L-46 -60 L-20 -86 L34 -86 L46 -60 L40 50 Z" fill="#9fd2ff" opacity={0.75} />
        <path d="M-46 -60 L-74 -84" stroke="#9fd2ff" strokeWidth={10} strokeLinecap="round" opacity={0.75} />
        <rect x={-40} y={-20} width={80} height={70} fill={C.cyan} opacity={0.35} />
      </g>
    )

  const statusX = [300, 800, 1300]

  return (
    <g ref={root}>
      <DcDefs />
      <style>{`
        .c2-fall { animation: c2-fall 0.9s cubic-bezier(.5,0,.9,.6) forwards; }
        @keyframes c2-fall { from { transform: translate(0,0) rotate(0); opacity: 1 } to { transform: translate(40px, 420px) rotate(80deg); opacity: 0 } }
        .flow-paused .c2-fall { animation-play-state: paused; }
        .c2-feat { transition: opacity 0.35s ease; }
      `}</style>

      {/* ---------------- the kitchen at night ---------------- */}
      <g className="c2-kitchen" ref={kitchenRef} pointerEvents="none">
        <g data-depth="0.25">
          <LabSky flashClass="c2-flash" seed={23} />
        </g>
        <g data-depth="0.7">
          <path d="M-600 -500 H2200 V1400 H-600 Z M1060 120 h360 v380 h-360 Z" fill="#141c2a" fillRule="evenodd" />
          {/* tiles */}
          <g opacity={0.25}>
            {Array.from({ length: 16 }, (_, i) => (
              <line key={i} x1={-200 + i * 80} y1={420} x2={-200 + i * 80} y2={664} stroke={C.ink4} strokeWidth={1.5} />
            ))}
            {[460, 520, 580, 640].map((y) => (
              <line key={y} x1={-200} y1={y} x2={1060} y2={y} stroke={C.ink4} strokeWidth={1.5} />
            ))}
          </g>
          <rect x={1052} y={112} width={376} height={14} fill={C.ink1} />
          <rect x={1052} y={496} width={376} height={16} fill={C.ink1} />
          <rect x={1236} y={120} width={8} height={380} fill={C.ink1} />
          {/* upper cabinets */}
          {[-80, 160, 400, 640].map((x) => (
            <g key={x}>
              <rect x={x} y={80} width={220} height={260} rx={4} fill={C.ink2} stroke={C.ink1} strokeWidth={4} />
              <rect x={x + 180} y={200} width={8} height={40} rx={4} fill={C.slate} />
            </g>
          ))}
          {/* fridge on the right, humming */}
          <rect x={1480} y={60} width={300} height={700} rx={10} fill={C.ink3} />
          <rect x={1496} y={290} width={8} height={120} rx={4} fill={C.slate} />
          <rect className="c2-hum" x={1500} y={100} width={6} height={6} fill={C.cyan} opacity={0.5} />
        </g>
        <g data-depth="1">
          {/* pendant lamp */}
          <g className="c2-lamp">
            <line x1={760} y1={-40} x2={760} y2={260} stroke={C.ink4} strokeWidth={3} />
            <path d="M700 300 L820 300 L790 256 L730 256 Z" fill={C.ink3} />
            <ellipse cx={760} cy={300} rx={60} ry={8} fill={C.keyLight} />
          </g>
          <g className="c2-hum">
            <Pool x={760} y={600} r={520} color="key" opacity={0.95} />
          </g>
          {/* counter */}
          <rect x={-600} y={COUNTER_Y} width={2800} height={20} fill={C.ink4} />
          <rect x={-600} y={COUNTER_Y} width={2800} height={4} fill={C.keyDeep} opacity={0.7} />
          <rect x={-600} y={COUNTER_Y + 20} width={2800} height={600} fill={C.ink2} />
          {[-80, 200, 480, 760, 1040, 1320].map((x) => (
            <g key={x}>
              <rect x={x} y={COUNTER_Y + 40} width={260} height={300} rx={4} fill="none" stroke={C.ink1} strokeWidth={4} />
              <rect x={x + 110} y={COUNTER_Y + 60} width={40} height={7} rx={3} fill={C.slate} />
            </g>
          ))}
          {/* things on the counter */}
          <g className="c2-cup-counter">
            <Mug x={774} y={COUNTER_Y} />
          </g>
          {/* a drying rack */}
          <g transform={`translate(910 ${COUNTER_Y})`}>
            <rect x={-60} y={-8} width={160} height={8} fill={C.metalDark} />
            {[-50, 40, 70, 100].map((x) => (
              <line key={x} x1={x} y1={-8} x2={x - 6} y2={-60} stroke={C.metalDark} strokeWidth={3} />
            ))}
            <rect x={56} y={-62} width={30} height={54} rx={5} fill="#b9c8d8" />
          </g>
          <g className="c2-cup-rack" opacity={0}>
            <Mug x={903} y={COUNTER_Y - 8} />
          </g>
          <rect x={300} y={COUNTER_Y - 70} width={70} height={70} rx={8} fill={C.ink3} />
          <rect x={312} y={COUNTER_Y - 82} width={46} height={14} rx={4} fill={C.ink4} />
          <ellipse cx={1150} cy={COUNTER_Y - 12} rx={70} ry={12} fill={C.ink3} />
          <Person
            name="c2-noor"
            x={NOOR_AT.x}
            y={NOOR_AT.y}
            s={NOOR_AT.s}
            pose={POSES.stand}
            light="key-right"
            {...NOOR}
            holdN={
              <g>
                <rect x={-7} y={-4} width={14} height={30} rx={5} fill={C.ink3} />
                <rect x={-18} y={22} width={36} height={30} rx={6} fill={C.shellMid} />
                <rect x={-17} y={50} width={9} height={30} rx={4} fill={C.ink4} />
                <rect x={8} y={50} width={9} height={30} rx={4} fill={C.ink4} />
                <rect x={16} y={18} width={26} height={22} rx={4} fill={C.ink} />
                <circle cx={40} cy={29} r={7} fill={C.ink2} stroke={C.slate} strokeWidth={2} />
                <circle className="c2-recdot" cx={22} cy={22} r={2.4} fill={C.danger} />
                <g className="c2-cup-carry" opacity={0}>
                  <g transform="translate(0 66) rotate(94)">
                    <Mug x={0} y={23} />
                  </g>
                </g>
              </g>
            }
          />
          <Label className="c2-lab-umi" x={770} y={600} tx={600} ty={380} text="a handheld copy of the gripper" sub="UMI: about $400 of parts" color={C.keyLight} />
          <Dust x={420} y={240} w={700} h={420} count={26} seed={14} />
          {/* the camera's path, worked out from its own video and motion sensors */}
          <g className="c2-ribbon-g" opacity={0}>
            <path className="c2-ribbon" d={smoothPath(PATH_K)} fill="none" stroke={C.lime} strokeWidth={16} strokeOpacity={0.25} strokeLinecap="round" strokeDasharray="900" strokeDashoffset={900} transform="translate(5 -8)" />
            <path className="c2-ribbon" d={smoothPath(PATH_K)} fill="none" stroke={C.lime} strokeWidth={4} strokeLinecap="round" strokeDasharray="900" strokeDashoffset={900} filter="url(#cn-bloom)" />
          </g>
          {[1, 3, 4, 6].map((i, n) => (
            <g key={i} transform={`translate(${PATH_K[i][0]} ${PATH_K[i][1]})`}>
              <g className="c2-kf" opacity={0}>
                <path d="M-8 -6 h10 v12 h-10 Z M2 -3 L12 -9 V9 L2 3" fill={C.ink} stroke={C.limeLight} strokeWidth={1.6} transform={`rotate(${[-30, 20, -40, 10][n]})`} />
              </g>
            </g>
          ))}
          <Label className="c2-lab-label" x={838} y={584} tx={820} ty={400} text="the camera’s path = the action label" color={C.lime} />
        </g>
        <g data-depth="1.6">
          <g filter="url(#cn-dof-3)">
            <path d="M-120 900 Q-40 640 60 560 Q90 620 40 700 Q120 660 160 600 Q160 760 60 900 Z" fill={C.ink} />
          </g>
        </g>
        {/* the inset: what the gripper's camera sees (fisheye) */}
        <g className="c2-inset" opacity={0}>
          <clipPath id="c2-fishclip">
            <circle cx={1270} cy={250} r={170} />
          </clipPath>
          <g clipPath="url(#c2-fishclip)">
            <rect x={1090} y={70} width={360} height={360} fill="#1b2433" />
            <g className="c2-fish-world">
              <circle cx={1270} cy={250} r={170} fill="url(#cn-pool-key)" opacity={0.5} />
              <path d="M1060 330 Q1270 270 1480 330 L1480 480 L1060 480 Z" fill={C.ink4} />
              <path d="M1060 330 Q1270 270 1480 330" fill="none" stroke={C.keyDeep} strokeWidth={4} />
              <path d="M1100 140 Q1270 100 1440 140" fill="none" stroke={C.ink3} strokeWidth={30} />
              <g className="c2-fish-cup">
                <rect x={1236} y={250} width={68} height={84} rx={8} fill="#e7dccb" />
                <rect x={1236} y={250} width={20} height={84} rx={8} fill="#fff" opacity={0.4} />
                <path d="M1304 268 q 28 0 28 24 q 0 24 -28 24" fill="none" stroke="#e7dccb" strokeWidth={9} />
              </g>
            </g>
            {/* the gripper's own fingers, always in view: same as on the robot */}
            <path className="c2-jaw-l" d="M1150 440 L1186 318 Q1200 304 1212 318 L1214 440 Z" fill={C.ink4} stroke={C.mist} strokeWidth={2} />
            <path className="c2-jaw-r" d="M1390 440 L1354 318 Q1340 304 1328 318 L1326 440 Z" fill={C.ink4} stroke={C.mist} strokeWidth={2} />
            <circle cx={1270} cy={250} r={170} fill="url(#cn-vignette)" />
          </g>
          <circle cx={1270} cy={250} r={170} fill="none" stroke={C.paper} strokeWidth={3} opacity={0.6} />
          <circle className="c2-recdot" cx={1150} cy={110} r={7} fill={C.danger} />
          <Tag x={1270} y={448} anchor="middle" color={C.mist} size={18}>
            the gripper camera’s view
          </Tag>
          <Label className="c2-lab-same" x={1210} y={390} tx={1000} ty={400} text="same view the robot gets" color={C.lime} />
        </g>
      </g>

      {/* ---------------- the lab: the robot arm replays the ribbon ---------------- */}
      <g className="c2-lab" ref={labRef} opacity={0} pointerEvents="none">
        <g data-depth="0.4">
          <Blueprint />
        </g>
        <g data-depth="1">
          <Pool x={900} y={560} r={560} color="rim" opacity={0.5} />
          <rect x={-600} y={LAB_ARM.y} width={2800} height={500} fill={C.ink2} />
          <rect x={-600} y={LAB_ARM.y} width={2800} height={4} fill={C.rim} opacity={0.4} />
          <g className="c2-lribbon" opacity={0}>
            <path d={smoothPath(PATH_L)} fill="none" stroke={C.lime} strokeWidth={18} strokeOpacity={0.2} strokeLinecap="round" transform="translate(6 -9)" />
            <path d={smoothPath(PATH_L)} fill="none" stroke={C.lime} strokeWidth={4} strokeLinecap="round" filter="url(#cn-bloom)" />
          </g>
          <Arm2D
            cls="c2-arm"
            x={LAB_ARM.x}
            y={LAB_ARM.y}
            s={LAB_ARM.s}
            lens={LAB_ARM.lens}
            a={ikDown(LAB_ARM.lens, LAB_ARM.s, LAB_ARM, PATH_L[0])}
            tip={
              <g>
                <rect x={-20} y={-12} width={40} height={14} rx={3} fill={C.carbon} />
                <rect x={-18} y={-40} width={10} height={30} rx={4} fill={C.ink4} />
                <rect x={8} y={-40} width={10} height={30} rx={4} fill={C.ink4} />
                <rect x={18} y={-8} width={24} height={18} rx={3} fill={C.ink} />
                <circle cx={38} cy={1} r={6} fill={C.ink2} stroke={C.lime} strokeWidth={1.5} />
              </g>
            }
          />
          <g className="c2-dot">
            <circle r={9} fill={C.lime} filter="url(#cn-bloom)" />
          </g>
          <Label className="c2-lab-copy" x={PATH_L[5][0]} y={PATH_L[5][1]} tx={1060} ty={330} text="the robot replays the path" sub="same camera at its wrist" color={C.lime} />
          <Label className="c2-lab-anyhome" x={PATH_L[1][0]} y={PATH_L[1][1]} tx={420} ty={300} text="no robot in the kitchen" sub="so it can go into any home" color={C.keyLight} />
        </g>
      </g>

      {/* ---------------- the play: design the glove ---------------- */}
      <g className="c2-play" ref={playRef} opacity={0}>
        <g data-depth="0.5">
          <Blueprint />
        </g>
        <g data-depth="1">
          <Pool x={H.x} y={500} r={380} color="key" opacity={0.6} />
          <Pool x={R.x} y={500} r={380} color="rim" opacity={0.45} />
          <Pool x={800} y={470} r={300} color="lime" opacity={0.18} />
          {/* the glove being designed */}
          <GloveSpec cfg={cfg} />
          {/* task status along the top */}
          <g>
            {TASK_NAMES.map((name, i) => {
              const r = results[i]
              const fresh = r && r.key === cfgKey
              const ok = fresh && !r.why
              const color = !fresh ? C.fog : ok ? C.lime : C.danger
              const now = active && task === i
              return (
                <g key={name} opacity={active || done ? 1 : 0}>
                  <text x={statusX[i]} y={120} textAnchor="middle" fill={now ? C.paper : C.mist} fontFamily={SANS} fontSize={24} fontWeight={600}>
                    {name}
                  </text>
                  {now && <line x1={statusX[i] - 70} x2={statusX[i] + 70} y1={132} y2={132} stroke={C.paper} strokeWidth={2} opacity={0.6} />}
                  <text x={statusX[i]} y={162} textAnchor="middle" fill={color} fontFamily={MONO} fontSize={18}>
                    {!fresh ? '· not tried with this glove ·' : ok ? '✓ the robot replays it' : `✕ ${WHY_TEXT[r.why as Why]}`}
                  </text>
                </g>
              )
            })}
          </g>
          {/* the human: the objects sit behind the fingers */}
          <g className="c2-obj-h" opacity={showObjH && task ? 1 : 0}>
            {objectArt(task)}
          </g>
          <Hand3D store={human} x={H.x} y={H.y} look="human" arm={120} light={[-0.8, -0.6]} onTips={(t) => placeObj('h', t)} />
          <g className="c2-coin-h" opacity={showObjH && !task ? 1 : 0}>
            {objectArt(0)}
          </g>
          <text x={H.x} y={250} textAnchor="middle" fill={C.keyLight} fontFamily={SANS} fontSize={22} opacity={active ? 1 : 0}>
            a person, wearing your glove
          </text>
          {/* the robot */}
          <g className="c2-obj-r" opacity={robotHolds && task ? 1 : 0}>
            {objectArt(task)}
          </g>
          {robotDrops && (
            <g key={`drop-${task}-${cfgKey}`} transform={`translate(${R.x} ${R.y - 190})`}>
              <g className="c2-fall">{objectArt(task)}</g>
            </g>
          )}
          <Hand3D store={robot} x={R.x} y={R.y} look="robot" arm={120} light={[0.8, -0.5]} onTips={(t) => placeObj('r', t)} />
          <g className="c2-coin-r" opacity={robotHolds && !task ? 1 : 0}>
            {objectArt(0)}
          </g>
          <g opacity={ghost ? 1 : 0} filter="url(#dc-red)" pointerEvents="none">
            <Hand3D store={human} x={R.x} y={R.y} look="silhouette" arm={0} />
          </g>
          <g opacity={ghost ? 1 : 0}>
            <g className="c2-badtip">
              <circle r={30} fill="none" stroke={C.danger} strokeWidth={3} strokeDasharray="7 5" />
            </g>
          </g>
          {active && phase === 'result' && outcome && (
            <text x={R.x} y={250} textAnchor="middle" fill={C.danger} fontFamily={SANS} fontSize={22}>
              {outcome === 'couple' || outcome === 'brace' ? 'red: what the person did' : WHY_TEXT[outcome]}
            </text>
          )}
          {!(active && phase === 'result' && outcome) && (
            <text x={R.x} y={250} textAnchor="middle" fill={C.rim} fontFamily={SANS} fontSize={22} opacity={active ? 1 : 0}>
              {active && phase === 'replay' ? 'the robot replays the recording…' : 'our robot hand: 6 motions'}
            </text>
          )}
          {active && phase === 'result' && outcome === 'camera' && (
            <g transform={`translate(${R.x + 80} ${R.y + 40})`}>
              <rect x={-18} y={-12} width={36} height={24} rx={4} fill={C.ink} stroke={C.danger} strokeWidth={2} />
              <path d="M-26 -20 L26 20 M26 -20 L-26 20" stroke={C.danger} strokeWidth={3} />
            </g>
          )}
        </g>
        {/* the switches */}
        {active && (
          <g>
            {FEATURES.map((f, i) => (
              <Chip
                key={f.id}
                x={280 + (i % 3) * 520}
                y={i < 3 ? 784 : 846}
                w={490}
                h={50}
                text={f.text}
                color={f.id === 'pads' ? C.magenta : f.id === 'brace' ? C.cyan : C.lime}
                active={cfg[f.id]}
                onClick={() => toggle(f.id)}
                tutor={`glove-${f.id}`}
              />
            ))}
          </g>
        )}
      </g>

      {/* ---------------- Sunday: a neighbourhood of gloves ---------------- */}
      <g className="c2-town" ref={townRef} opacity={0} pointerEvents="none">
        <g data-depth="0.3">
          <rect x={-600} y={-500} width={2800} height={1900} fill="url(#cn-sky-night)" />
          <circle cx={1200} cy={140} r={60} fill={C.paper} opacity={0.12} filter="url(#cn-dof-2)" />
          <Dust x={-200} y={-100} w={2000} h={500} count={30} seed={31} color={C.paper} size={0.5} />
        </g>
        <g data-depth="0.6">
          <Town seed={3} y={520} scale={0.7} rows={1} cls="c2-win" />
        </g>
        <g data-depth="0.85">
          <Town seed={7} y={680} scale={1} rows={1} cls="c2-win" />
        </g>
        <g data-depth="1">
          {/* streams of data to one robot */}
          <g className="c2-streams" opacity={0}>
            {Array.from({ length: 9 }, (_, i) => {
              const x0 = -60 + i * 150
              const y0 = 640 - (i % 3) * 60
              return <path key={i} className="c2-flow" d={`M${x0} ${y0} C ${x0 + 300} ${y0 - 260} 1100 ${260 + i * 12} 1330 ${560}`} fill="none" stroke={C.lime} strokeWidth={2.4} strokeDasharray="4 16" opacity={0.75} />
            })}
          </g>
          {/* the robot at a dishwasher, on the right */}
          <path d="M1120 850 V430 L1360 290 L1600 430 V850 Z" fill={C.ink2} stroke={C.ink1} strokeWidth={10} />
          <Pool x={1340} y={620} r={300} color="key" opacity={0.85} />
          <rect x={1230} y={470} width={90} height={110} fill={C.ink1} />
          <rect x={1238} y={478} width={74} height={94} fill={C.lime} opacity={0.18} />
          <rect x={1140} y={820} width={500} height={80} fill={C.ink3} />
          <g transform="translate(1420 820)">
            <rect x={-70} y={-150} width={140} height={150} fill={C.ink3} stroke={C.ink4} strokeWidth={3} />
            <path d="M-70 0 L-120 40 L120 40 L70 0 Z" fill={C.metalDark} />
            <path d="M-60 -20 H60 M-60 -60 H60" stroke={C.metal} strokeWidth={3} />
            {[0, 1, 2].map((i) => (
              <ellipse key={i} className={`c2-plate-${i}`} cx={-40 + i * 40} cy={-40} rx={8} ry={28} fill={C.paper} opacity={0} />
            ))}
          </g>
          <Robot name="c2-sunbot" x={1290} y={820} s={0.95} pose={POSES.stand} light="key-right" />
          <g className="c2-count" opacity={0}>
            <text className="c2-count-n" x={260} y={150} fill={C.lime} fontFamily={MONO} fontSize={34}>
              0 gloves · 0 homes
            </text>
          </g>
          <Label className="c2-lab-sunday" x={1330} y={540} tx={1120} ty={250} text="Sunday: $200 glove vs $20,000 teleop rig" sub="company figures · zero teleop data" color={C.gold} />
        </g>
      </g>

      {/* ---------------- the spork, and the reach ---------------- */}
      <g className="c2-spork" ref={sporkRef} opacity={0} pointerEvents="none">
        <g data-depth="0.5">
          <rect x={-600} y={-500} width={2800} height={1900} fill={C.ink1} />
        </g>
        <g data-depth="1">
          <g className="c2-sporkshot">
            <Pool x={800} y={470} r={420} color="key" opacity={0.95} />
            <rect x={-600} y={520} width={2800} height={800} fill={C.ink2} />
            <rect x={-600} y={520} width={2800} height={3} fill={C.keyDeep} opacity={0.6} />
            <g transform="translate(800 500) rotate(-12)">
              <clipPath id="c2-sporkclip">
                <path d="M-190 -8 L40 -10 Q60 -36 110 -36 Q170 -34 176 0 Q170 34 110 36 Q60 36 40 10 L-190 8 Q-200 0 -190 -8 Z" />
              </clipPath>
              <ellipse cx={0} cy={44} rx={200} ry={14} fill="#000" opacity={0.4} filter="url(#cn-dof-1)" />
              <path d="M-190 -8 L40 -10 Q60 -36 110 -36 Q170 -34 176 0 Q170 34 110 36 Q60 36 40 10 L-190 8 Q-200 0 -190 -8 Z" fill="url(#cn-metal)" />
              <path d="M130 -30 L176 -14 M134 -10 L178 -2 M134 10 L178 6 M130 30 L174 16" stroke={C.ink2} strokeWidth={3} />
              <g clipPath="url(#c2-sporkclip)">
                <rect className="c2-glint" x={-30} y={-60} width={40} height={120} fill={C.white} opacity={0.75} transform="skewX(-20)" />
              </g>
            </g>
            <g className="c2-star" transform="translate(905 452)">
              <path d="M0 -26 L5 -5 L26 0 L5 5 L0 26 L-5 5 L-26 0 L-5 -5 Z" fill={C.white} filter="url(#cn-bloom)" />
            </g>
            <Label className="c2-lab-spork" x={900} y={470} tx={1000} ty={330} text="half spoon, half fork" sub="not quite either" color={C.keyLight} />
          </g>
          <g className="c2-split" opacity={0}>
            <rect x={-600} y={-500} width={1400} height={1900} fill={C.ink1} />
            <rect x={800} y={-500} width={1400} height={1900} fill="#0c1422" />
            <Pool x={420} y={420} r={420} color="key" opacity={0.75} />
            <Pool x={1200} y={420} r={420} color="rim" opacity={0.45} />
            <line x1={800} y1={-100} x2={800} y2={1000} stroke={C.paper} strokeWidth={2} opacity={0.3} />
            <rect x={-600} y={820} width={2800} height={400} fill={C.ink2} />
            {/* shelves with a cup up high */}
            {[300, 1080].map((x) => (
              <g key={x}>
                <rect x={x + 30} y={290} width={220} height={12} fill={C.ink4} />
                <rect x={x + 30} y={520} width={220} height={12} fill={C.ink4} />
              </g>
            ))}
            <g className="c2-n-cup">
              <Mug x={372} y={290} />
            </g>
            <Mug x={1150} y={290} />
            <Person
              name="c2-noor2"
              x={330}
              y={820}
              s={1.45}
              pose={POSES.stand}
              light="key-right"
              {...NOOR}
              holdN={
                <g className="c2-n-cuphand" opacity={0}>
                  <rect x={-14} y={6} width={30} height={34} rx={5} fill="#e7dccb" />
                </g>
              }
            />
            <Robot name="c2-seven" x={1110} y={820} s={1.32} pose={POSES.stand} light="cool-right" />
            <g className="c2-reach-g" opacity={0}>
              <path className="c2-reach" d="M944 422 A 196 196 0 0 1 1292 422" fill="none" stroke={C.danger} strokeWidth={4} strokeDasharray="12 8" />
              <path d="M1150 300 L1150 318" stroke={C.danger} strokeWidth={4} />
            </g>
            <Label className="c2-lab-reach" x={1240} y={340} tx={1290} ty={200} text="out of reach" sub="the demo assumed it" color={C.danger} />
            <Label className="c2-lab-noor" x={400} y={250} tx={520} ty={180} text="a person: easy" color={C.keyLight} />
            <Label className="c2-lab-speed" x={1080} y={640} tx={1220} ty={700} text="slower, shorter, stiffer" sub="the model notices" color={C.rim} />
          </g>
        </g>
      </g>
      <Vignette />
      <Letterbox className="c2-lb" />
    </g>
  )
}

/** A mug standing on (x, y). */
function Mug({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M20 -36 q 16 0 16 13 q 0 13 -16 13" fill="none" stroke="#e7dccb" strokeWidth={6} />
      <rect x={-20} y={-46} width={40} height={46} rx={5} fill="#e7dccb" />
      <rect x={-20} y={-46} width={12} height={46} rx={5} fill="#fff" opacity={0.45} />
      <ellipse cx={0} cy={-46} rx={20} ry={4} fill="#f6efe3" />
    </g>
  )
}

/** A row of house silhouettes whose windows can glow (class `cls`). */
function Town({ seed, y, scale, rows, cls }: { seed: number; y: number; scale: number; rows: number; cls: string }) {
  let s = seed
  const r = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  const houses = Array.from({ length: 14 }, (_, i) => ({ x: -300 + i * 150 + r() * 30, w: 110 + r() * 40, h: 90 + r() * 60 }))
  return (
    <g transform={`translate(0 ${y}) scale(${scale})`}>
      {Array.from({ length: rows }).map((_, row) => (
        <g key={row}>
          {houses.map((h, i) => (
            <g key={i} transform={`translate(${h.x} 0)`}>
              <path d={`M0 0 V${-h.h} L${h.w / 2} ${-h.h - 50} L${h.w} ${-h.h} V0 Z`} fill={C.ink1} />
              {[0, 1].map((k) => (
                <g key={k}>
                  <rect x={18 + k * (h.w / 2)} y={-h.h + 26} width={26} height={26} fill={C.ink3} />
                  <rect className={r() > 0.25 ? cls : undefined} x={18 + k * (h.w / 2)} y={-h.h + 26} width={26} height={26} fill={C.lime} opacity={0} />
                </g>
              ))}
            </g>
          ))}
          <rect x={-600} y={0} width={2800} height={600} fill={C.ink} />
        </g>
      ))}
    </g>
  )
}

/** The glove being designed, centre stage: it grows each feature that is switched on. */
function GloveSpec({ cfg }: { cfg: Cfg }) {
  const fingers = [
    { cx: 754, top: 372 },
    { cx: 786, top: 334 },
    { cx: 818, top: 318 },
    { cx: 850, top: 336 },
  ]
  const on = (b: boolean) => ({ opacity: b ? 1 : 0, className: 'c2-feat' })
  return (
    <g className="c2-glove" opacity={0}>
      <text x={800} y={226} textAnchor="middle" fill={C.paper} fontFamily={SERIF} fontSize={34} fontWeight={600}>
        your glove
      </text>
      <g fill="none" stroke={C.mist} strokeWidth={2.5}>
        <rect x={738} y={446} width={128} height={136} rx={24} fill={C.ink2} />
        {fingers.map((f) => (
          <rect key={f.cx} x={f.cx - 14} y={f.top} width={28} height={470 - f.top} rx={14} fill={C.ink2} />
        ))}
        <rect x={0} y={0} width={30} height={110} rx={15} fill={C.ink2} transform="translate(866 540) rotate(-40)" />
        <rect x={750} y={582} width={104} height={44} rx={6} fill={C.ink3} />
      </g>
      {/* all 20 joints */}
      <g {...on(cfg.all20)} fill={C.mist}>
        {fingers.flatMap((f) => [0, 1, 2, 3].map((k) => <circle key={`${f.cx}-${k}`} cx={f.cx} cy={f.top + 14 + k * ((462 - f.top) / 3.4)} r={5} />))}
        {[0, 1, 2, 3].map((k) => (
          <circle key={k} cx={878 + k * 18} cy={548 - k * 22} r={5} />
        ))}
        <text x={680} y={300} textAnchor="end" fill={C.mist} fontFamily={MONO} fontSize={18} stroke="none">
          20 sensors
        </text>
      </g>
      {/* only the robot's 6 */}
      <g {...on(cfg.track6)}>
        {[
          [880, 546],
          [916, 506],
          [850, 400],
          [818, 384],
          [770, 412],
          [802, 604],
        ].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={11} fill={C.lime} opacity={0.25} />
            <circle cx={x} cy={y} r={6} fill={C.lime} />
          </g>
        ))}
        <text x={680} y={330} textAnchor="end" fill={C.lime} fontFamily={MONO} fontSize={18}>
          6 motions, like the robot
        </text>
      </g>
      {/* ring + little locked */}
      <g {...on(cfg.couple)}>
        <rect x={738} y={398} width={64} height={22} rx={8} fill={C.lime} opacity={0.85} />
        <text x={730} y={404} textAnchor="end" fill={C.lime} fontFamily={MONO} fontSize={18}>
          ring + little: one
        </text>
      </g>
      {/* thumb brace */}
      <g {...on(cfg.brace)}>
        <path d="M876 572 L938 498" stroke={C.cyan} strokeWidth={10} strokeLinecap="round" opacity={0.85} />
        <path d="M870 556 L960 470 A 120 120 0 0 1 990 540 Z" fill={C.cyan} opacity={0.18} />
        <text x={960} y={470} fill={C.cyan} fontFamily={MONO} fontSize={18}>
          robot’s thumb range
        </text>
      </g>
      {/* pressure pads */}
      <g {...on(cfg.pads)}>
        {fingers.map((f) => (
          <circle key={f.cx} cx={f.cx} cy={f.top + 12} r={8} fill={C.magenta} filter="url(#cn-bloom)" />
        ))}
        <circle cx={940} cy={486} r={8} fill={C.magenta} filter="url(#cn-bloom)" />
        <text x={960} y={360} fill={C.magentaLight} fontFamily={MONO} fontSize={18}>
          + grip force recorded
        </text>
      </g>
      {/* wrist camera */}
      <g {...on(cfg.wristcam)}>
        <rect x={858} y={588} width={36} height={26} rx={4} fill={C.ink} stroke={C.lime} strokeWidth={2} />
        <circle cx={888} cy={601} r={6} fill={C.ink2} stroke={C.lime} strokeWidth={2} />
        <path d="M894 594 L990 540 M894 608 L990 650" stroke={C.lime} strokeWidth={1.5} strokeDasharray="5 6" />
        <text x={960} y={670} fill={C.lime} fontFamily={MONO} fontSize={18}>
          sees the robot’s view
        </text>
      </g>
    </g>
  )
}

export const ch2: Chapter = {
  id: 'wearables',
  title: 'The glove and the gripper',
  cues: CUES,
  Scene: Ch2Wearables,
  enter: { type: 'pan', dir: 'right' },
  deeper: [WearablesReading],
}
