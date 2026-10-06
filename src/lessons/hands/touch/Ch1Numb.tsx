import gsap from 'gsap'
import { useCallback, useEffect, useRef } from 'react'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { camera } from '../../../cine/camera'
import { GRASPS, Hand3D, makeHandStore, tipOnStage, useHandStore, type FingerName, type HandPose } from '../../../cine/hand3d'
import { C, MONO, SANS } from '../../../cine/palette'
import { POSES, Person, Profile, Robot, rig } from '../../../cine/people'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Blueprint, DeskLamp, Dust, FiveMap, Label, Letterbox, Pool, Vignette, fade, letterbox, useAmbient } from '../shared/kit'
import { ForeShelf, LabFloor, LabSky, LabWall, Workbench } from '../shared/sets'
import { DimRoom, Flame, Glass, Match, Matchbox, Mono, draw, stopwatch, ticker } from './parts'
import { JohanssonReading } from './readings'
import './touch.css'

export const CUES: Cue[] = [
  { id: 'match', say: 'Question four: touch. To see why it matters, meet a famous experiment from a lab in Sweden.' },
  { id: 'normal', say: 'A volunteer picks up a match and strikes it. Easy. A few seconds.' },
  { id: 'numbed', say: 'Then the doctors numb just the fingertips. The volunteer can still see perfectly, and move perfectly. But now the same task is slow and clumsy: fumbling, over-squeezing, dropping the match.' },
  { id: 'margin', say: 'Touch is what lets you grip just hard enough. You normally squeeze only ten to forty percent more than you need to stop something slipping, and you adjust within about a tenth of a second when it starts to slide.' },
  { id: 'robot', say: 'A robot that can only see is in the volunteer’s position: watching its own fingers, guessing how hard to squeeze.' },
]

const STATE = [
  'The five-question map of the course: five tilted coloured rings around a robot hand, inside the gold wall. The magenta ring, question 4 "Touch: sensing", flares bright and the camera dives into it. It comes out in a dim lab room in Umeå, Sweden: a volunteer (a woman with a bun, rust jacket) sits at a small table under a warm desk lamp; a doctor stands in shadow behind. On the table: a matchbox and a single match. The setup for Roland Johansson’s anaesthesia experiment.',
  'Close-up on the table: a human hand comes down, pinches the match, lifts it and strikes it along the side of the matchbox. A bright flame flares and lights the volunteer’s face in profile (warm light, half in shadow). A stopwatch in the corner stops at about 7 seconds. The point: with normal touch, picking up and striking a match is quick and easy.',
  'Same table, now in cooler light. The volunteer’s fingertips are tinted dead grey (anaesthetised: no touch, but sight and movement are normal). The hand fumbles: it grips, lifts, and the match slips out and drops; it re-grabs it, wobbles, then squeezes so hard the match snaps in two. The stopwatch runs on past the first time (7 s, marked) and turns red, heading towards 25-30 s. The point: without touch, people over-squeeze and fumble even though they can see perfectly. (The ~7 s vs ~25-30 s timings are commonly quoted but not verified from the original paper.)',
  'A human hand holds a glass. Under it a graph draws itself left to right: an amber "grip force" line hovering just above a dashed "slip threshold" line (a 10-40% safety margin). The glass gets bumped: the slip threshold jumps up, a magenta "slip!" spike appears on the touch trace, the fingertips flash magenta, and about 0.1 s later the grip line jumps up above the new threshold (label "~100 ms reflex"). The point: touch lets you grip just hard enough, and correct fast when something starts to slide.',
  'The night lab: Seven, the white humanoid robot, leans over the workbench under the desk lamp reaching for a cup. A camera-feed inset shows what its head camera sees: its own robot hand coming down over the cup and hiding the exact moment of contact (label "the hand hides the contact from the camera", magenta question mark at the hidden contact). The point: a robot with vision only is like the numbed volunteer, guessing grip force.',
]

/* ---------- the close-up of the match ---------- */
const VIEW = { yaw: -96, pitch: 14, roll: 112, s: 1.85 }
/** Where the hand is drawn (its wrist), and where the match lies on the table. */
const HAND = { x: 1150, y: 420 }
const MATCH = { x: 960, y: 652 }
/** The match is held this far back from its head. */
const GRIP = 104
/** Fingertip pinch point of the closed pose, for placing the hand so the pinch lands on the match. */
const PINCH: HandPose = { ...GRASPS.pinch }
const OPENISH: HandPose = { ...GRASPS.pinch, thumb: [40, 30, 6, 6], index: [24, 26, 12, 0] }
const SQUEEZE: HandPose = { ...GRASPS.pinch, thumb: [64, 38, 22, 26], index: [48, 52, 30, 0] }
const pinchAt = (() => {
  const s = makeHandStore({ pose: PINCH, view: VIEW })
  const a = tipOnStage(s, 'thumb', HAND.x, HAND.y)
  const b = tipOnStage(s, 'index', HAND.x, HAND.y)
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
})()
/** Offset the hand group so the pinch sits on the match's grip point. */
const HOFF = { x: MATCH.x + GRIP - pinchAt.x, y: MATCH.y - pinchAt.y }
/** The striker strip on the box (the head runs along it). */
const BOX = { x: 640, y: 664 }
const STRIKE_Y = BOX.y - 30 - MATCH.y
const UP = -150
/** Where the match breaks, on stage, at the moment it snaps. */
const SNAP = { x: MATCH.x + 70 + HOFF.x + BOX.x - 60 - MATCH.x, y: MATCH.y + HOFF.y + STRIKE_Y - 50 }

/* ---------- the glass and the graph ---------- */
const G = { x0: 150, y0: 740, w: 800, h: 300 }
const T = 2.4 // seconds across the graph
const tx = (t: number) => G.x0 + (t / T) * G.w
const ly = (v: number) => G.y0 - v * G.h
const BUMP = 1.35
const S1 = 0.3
const S2 = 0.6
const GR1 = S1 * 1.28
const GR2 = S2 * 1.28
const GRIP_D = `M${tx(0)} ${ly(GR1)} L${tx(BUMP + 0.1)} ${ly(GR1)} L${tx(BUMP + 0.16)} ${ly(GR2 + 0.06)} L${tx(BUMP + 0.24)} ${ly(GR2)} L${tx(T)} ${ly(GR2)}`
const SLIP_D = `M${tx(0)} ${ly(S1)} L${tx(BUMP)} ${ly(S1)} L${tx(BUMP + 0.03)} ${ly(S2)} L${tx(T)} ${ly(S2)}`
const TOUCH_Y = G.y0 - G.h - 70
const TOUCH_D = `M${tx(0)} ${TOUCH_Y} L${tx(BUMP)} ${TOUCH_Y} L${tx(BUMP + 0.02)} ${TOUCH_Y - 44} L${tx(BUMP + 0.04)} ${TOUCH_Y + 18} L${tx(BUMP + 0.07)} ${TOUCH_Y - 14} L${tx(BUMP + 0.1)} ${TOUCH_Y} L${tx(T)} ${TOUCH_Y}`
const GLASS = { x: 1170, y: 560 }

/* ---------- the lab ---------- */
const SEVEN = { x: 690, y: 800, s: 1.25 }
const BENCH = { x: 1080, y: 640 }

export function Ch1Numb({ cueIndex, playing, onAnimDone, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const mapRef = useRef<SVGGElement>(null)
  const closeRef = useRef<SVGGElement>(null)
  const labRef = useRef<SVGGElement>(null)
  const numbRef = useRef<SVGGElement>(null)
  const mapHand = useHandStore({ pose: GRASPS.relaxed, view: { yaw: -24, pitch: 8, roll: 0, s: 1.45 } })
  const hand = useHandStore({ pose: OPENISH, view: VIEW })
  const glassHand = useHandStore({ pose: { ...GRASPS.power, wrist: [0, 0] }, view: { yaw: 160, pitch: 10, roll: 90, s: 2.0 } })
  const camHand = useHandStore({ pose: GRASPS.open, view: { yaw: 82, pitch: -6, roll: 180, s: 1.45 } })

  /** The numbed fingertips: grey caps placed on the human hand's tips every frame. */
  const onTips = useCallback((tips: Record<FingerName, { x: number; y: number }>) => {
    const g = numbRef.current
    if (!g) return
    ;(['thumb', 'index', 'middle', 'ring', 'little'] as FingerName[]).forEach((f, i) => {
      const c = g.children[i] as SVGCircleElement | undefined
      c?.setAttribute('cx', String(tips[f].x))
      c?.setAttribute('cy', String(tips[f].y))
    })
  }, [])

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const el = root.current
      const cam = camera(mapRef.current, { x: 800, y: 470, zoom: 1 })
      const cam2 = camera(closeRef.current, { x: 800, y: 450, zoom: 1 })
      const cam3 = camera(labRef.current, { x: 800, y: 460, zoom: 1 })
      const vol = rig(el, 'n-vol', POSES.sitForward)
      const seven = rig(el, 'n-seven', POSES.workbench)
      const watch = el?.querySelector('.n-watch-t')

      /* b0: the map, the magenta ring flares, dive in; the dim room in Umeå. */
      tl.addLabel('b0', 0)
      tl.set('.n-room, .n-close, .n-glassshot, .n-lab, .n-watch, .n-inset', { opacity: 0 }, 0)
      tl.set('.n-map', { opacity: 1 }, 0)
      cam.to(tl, { x: 800, y: 470, zoom: 1.08 }, 0, 1.6, 'sine.inOut')
      tl.fromTo('.fm-ring-touch', { opacity: 0.22 }, { opacity: 1, duration: 0.6, immediateRender: false }, 0.6)
      tl.fromTo('.fm-lab-touch', { opacity: 0.35 }, { opacity: 1, duration: 0.6, immediateRender: false }, 0.6)
      fade(tl, '.n-mapglow', 1, 0.6, 1)
      mapHand.to(tl, { touch: { thumb: 1, index: 1, middle: 1, ring: 0.7, little: 0.5 } }, 0.9, 0.8)
      cam.to(tl, { x: 1139, y: 599, zoom: 4.2 }, 2.4, 1.5, 'power3.in')
      fade(tl, '.n-map', 0, 3.6, 0.5, 1)
      fade(tl, '.n-room', 1, 3.6, 0.6)
      cam2.cut(tl, { x: 700, y: 520, zoom: 1.0 }, 3.6)
      cam2.to(tl, { x: 820, y: 560, zoom: 1.32 }, 3.6, 5.2, 'sine.inOut')
      vol.idle(tl, 3.6, 4.8)
      fade(tl, '.n-lab-umea', 1, 4.6, 0.8)

      /* b1: close on the table. Pick up, strike, flare. The face lights up. */
      const b1 = 8.6
      tl.addLabel('b1', b1)
      tl.set('.n-room', { opacity: 0 }, b1)
      tl.set('.n-close', { opacity: 1 }, b1)
      fade(tl, '.n-watch', 1, b1, 0.4)
      cam2.cut(tl, { x: 900, y: 600, zoom: 1.45 }, b1)
      tl.fromTo('.n-hand', { x: HOFF.x + 40, y: HOFF.y + UP - 120 }, { x: HOFF.x, y: HOFF.y, duration: 1.0, ease: 'power2.out', immediateRender: false }, b1)
      hand.to(tl, { pose: PINCH }, b1 + 0.75, 0.3)
      tl.set('.n-tablematch', { opacity: 0 }, b1 + 1.05)
      tl.set('.n-held', { opacity: 1 }, b1 + 1.05)
      tl.fromTo('.n-hand', { x: HOFF.x, y: HOFF.y }, { x: HOFF.x - 40, y: HOFF.y + UP, duration: 0.6, ease: 'power2.inOut', immediateRender: false }, b1 + 1.15)
      tl.fromTo('.n-hand', { x: HOFF.x - 40, y: HOFF.y + UP }, { x: HOFF.x + (BOX.x + 120 - MATCH.x), y: HOFF.y + STRIKE_Y, duration: 0.5, ease: 'power2.inOut', immediateRender: false }, b1 + 1.75)
      tl.fromTo('.n-hand', { x: HOFF.x + (BOX.x + 120 - MATCH.x) }, { x: HOFF.x + (BOX.x - 140 - MATCH.x), duration: 0.22, ease: 'power3.in', immediateRender: false }, b1 + 2.3)
      fade(tl, '.n-sparks', 1, b1 + 2.42, 0.05)
      fade(tl, '.n-sparks', 0, b1 + 2.6, 0.3, 1)
      tl.fromTo('.n-flame', { scale: 0 }, { scale: 1, duration: 0.35, ease: 'back.out(3)', immediateRender: false }, b1 + 2.45)
      tl.fromTo('.n-hand', { y: HOFF.y + STRIKE_Y }, { y: HOFF.y + UP + 20, duration: 1.2, ease: 'power2.out', immediateRender: false }, b1 + 2.6)
      fade(tl, '.n-flarelight', 1, b1 + 2.45, 0.3)
      cam2.to(tl, { x: 700, y: 470, zoom: 1.02 }, b1 + 2.5, 3.0, 'power2.inOut')
      ticker(tl, watch, 0, 7, b1, 2.5, stopwatch)

      /* b2: numbed. Cooler light, grey fingertips, fumbling, over-squeezing, a snap. */
      const b2 = b1 + 6
      tl.addLabel('b2', b2)
      fade(tl, '.n-dip', 1, b2, 0.35)
      fade(tl, '.n-dip', 0, b2 + 0.5, 0.5, 1)
      tl.set('.n-flame', { scale: 0 }, b2 + 0.35)
      tl.set('.n-flarelight', { opacity: 0 }, b2 + 0.35)
      tl.set('.n-held', { opacity: 0 }, b2 + 0.35)
      tl.set('.n-tablematch', { opacity: 1 }, b2 + 0.35)
      tl.set('.n-hand', { x: HOFF.x + 40, y: HOFF.y + UP - 60 }, b2 + 0.35)
      hand.to(tl, { pose: OPENISH }, b2 + 0.3, 0.05)
      fade(tl, '.n-warm', 0, b2 + 0.35, 0.05, 1)
      fade(tl, '.n-cool', 1, b2 + 0.35, 0.05)
      fade(tl, '.n-numb', 1, b2 + 0.6, 0.8)
      cam2.cut(tl, { x: 860, y: 560, zoom: 1.3 }, b2 + 0.35)
      cam2.to(tl, { x: 800, y: 520, zoom: 1.16 }, b2 + 0.4, 12, 'sine.inOut')
      fade(tl, '.n-lab-numb', 1, b2 + 1.2, 0.6)
      fade(tl, '.n-lab-numb', 0, b2 + 4.4, 0.6, 1)
      ticker(tl, watch, 0, 0, b2 + 0.35, 0.01, stopwatch)
      fade(tl, '.n-ghost', 1, b2 + 1, 0.6)
      ticker(tl, watch, 0, 27.4, b2 + 0.9, 12.4, stopwatch)
      tl.fromTo('.n-watch-t', { fill: C.paper }, { fill: C.danger, duration: 0.4, immediateRender: false }, b2 + 0.9 + 12.4 * (7 / 27.4))
      // grab (too hard), lift, the match slips out and drops
      tl.fromTo('.n-hand', { x: HOFF.x + 40, y: HOFF.y + UP - 60 }, { x: HOFF.x, y: HOFF.y, duration: 0.9, ease: 'power2.inOut', immediateRender: false }, b2 + 1.0)
      hand.to(tl, { pose: SQUEEZE }, b2 + 1.7, 0.35)
      tl.set('.n-tablematch', { opacity: 0 }, b2 + 2.0)
      tl.set('.n-held', { opacity: 1 }, b2 + 2.0)
      tl.fromTo('.n-hand', { x: HOFF.x, y: HOFF.y }, { x: HOFF.x - 20, y: HOFF.y + UP, duration: 0.8, ease: 'power2.inOut', immediateRender: false }, b2 + 2.2)
      hand.to(tl, { pose: OPENISH }, b2 + 2.55, 0.25)
      tl.fromTo('.n-heldin', { x: 0, y: 0, rotation: 0 }, { x: 20, y: -UP, rotation: 14, duration: 0.45, ease: 'power2.in', svgOrigin: `${MATCH.x + GRIP} ${MATCH.y}`, immediateRender: false }, b2 + 2.6)
      tl.to('.n-heldin', { rotation: 0, duration: 0.25, ease: 'bounce.out', svgOrigin: `${MATCH.x + GRIP} ${MATCH.y}` }, b2 + 3.05)
      // reach down again, fumble it back
      tl.fromTo('.n-hand', { x: HOFF.x - 20, y: HOFF.y + UP }, { x: HOFF.x, y: HOFF.y, duration: 0.8, ease: 'power2.inOut', immediateRender: false }, b2 + 3.6)
      tl.fromTo('.n-heldin', { x: 20, y: -UP }, { x: 0, y: 0, duration: 0.8, ease: 'power2.inOut', immediateRender: false }, b2 + 3.6)
      hand.to(tl, { pose: SQUEEZE }, b2 + 4.3, 0.3)
      tl.fromTo('.n-hand', { x: HOFF.x, y: HOFF.y }, { x: HOFF.x - 60, y: HOFF.y + UP, duration: 0.9, ease: 'power2.inOut', immediateRender: false }, b2 + 4.8)
      tl.fromTo('.n-heldin', { rotation: 0 }, { rotation: -12, duration: 0.3, yoyo: true, repeat: 3, ease: 'sine.inOut', svgOrigin: `${MATCH.x + GRIP} ${MATCH.y}`, immediateRender: false }, b2 + 5.0)
      // a clumsy strike: miss, then crush it
      tl.fromTo('.n-hand', { x: HOFF.x - 60, y: HOFF.y + UP }, { x: HOFF.x + (BOX.x + 120 - MATCH.x), y: HOFF.y + STRIKE_Y - 50, duration: 0.9, ease: 'power2.inOut', immediateRender: false }, b2 + 6.2)
      tl.fromTo('.n-hand', { x: HOFF.x + (BOX.x + 120 - MATCH.x) }, { x: HOFF.x + (BOX.x - 60 - MATCH.x), duration: 0.6, ease: 'power1.inOut', immediateRender: false }, b2 + 7.2)
      hand.to(tl, { pose: { ...SQUEEZE, thumb: [72, 44, 30, 30], index: [56, 60, 36, 0] }, touch: {} }, b2 + 8.2, 0.25, 'power3.in')
      tl.fromTo('.n-mh', { rotation: 0, x: 0, y: 0 }, { rotation: -55, x: -20, y: 30, duration: 0.25, ease: 'power3.out', svgOrigin: `${MATCH.x + 70} ${MATCH.y}`, immediateRender: false }, b2 + 8.42)
      tl.fromTo('.n-mh', { y: 30 }, { y: 130, x: -50, rotation: -100, duration: 0.6, ease: 'power2.in', svgOrigin: `${MATCH.x + 70} ${MATCH.y}`, immediateRender: false }, b2 + 8.67)
      cam2.shake(tl, b2 + 8.42, 0.5, 0.3)
      fade(tl, '.n-snap', 1, b2 + 8.42, 0.05)
      fade(tl, '.n-snap', 0, b2 + 8.6, 0.4, 1)
      fade(tl, '.n-lab-squeeze', 1, b2 + 8.6, 0.5)
      tl.fromTo('.n-hand', { x: HOFF.x + (BOX.x - 60 - MATCH.x), y: HOFF.y + STRIKE_Y - 50 }, { x: HOFF.x + (BOX.x - 20 - MATCH.x), y: HOFF.y + UP + 10, duration: 1.6, ease: 'power2.inOut', immediateRender: false }, b2 + 9.4)

      /* b3: the glass and the grip-force graph. */
      const b3 = b2 + 13.6
      tl.addLabel('b3', b3)
      fade(tl, '.n-close', 0, b3, 0.5, 1)
      fade(tl, '.n-watch', 0, b3, 0.4, 1)
      fade(tl, '.n-glassshot', 1, b3, 0.6)
      tl.fromTo('.n-glasscam', { scale: 1.12 }, { scale: 1, duration: 4, ease: 'power2.out', svgOrigin: `${GLASS.x} 450`, immediateRender: false }, b3)
      draw(tl, '.n-axes', b3 + 0.4, 0.8)
      const sweep = 7.6
      tl.fromTo('.n-reveal', { attr: { width: 0 } }, { attr: { width: G.w }, duration: sweep, ease: 'none', immediateRender: false }, b3 + 1.2)
      tl.fromTo('.n-cursor', { x: 0 }, { x: G.w, duration: sweep, ease: 'none', immediateRender: false }, b3 + 1.2)
      fade(tl, '.n-cursor', 1, b3 + 1.2, 0.3)
      fade(tl, '.n-lab-grip, .n-lab-slip', 1, b3 + 2.4, 0.6)
      fade(tl, '.n-margin', 1, b3 + 3.0, 0.6)
      const bumpAt = b3 + 1.2 + sweep * (BUMP / T)
      // the bump: a knock from the left, the glass starts to slide
      tl.fromTo('.n-knock', { x: -260, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, ease: 'power3.in', immediateRender: false }, bumpAt - 0.35)
      tl.to('.n-knock', { x: -80, opacity: 0, duration: 0.6, ease: 'power2.out' }, bumpAt)
      tl.fromTo('.n-glassmove', { y: 0, rotation: 0 }, { y: 14, rotation: -3, duration: 0.3, ease: 'power2.out', svgOrigin: `${GLASS.x} ${GLASS.y - 140}`, immediateRender: false }, bumpAt)
      glassHand.to(tl, { touch: { thumb: 1, index: 1, middle: 1, ring: 0.6, little: 0.4 } }, bumpAt, 0.12)
      glassHand.to(tl, { pose: { ...GRASPS.power, wrist: [0, 0], index: [56, 76, 40, 0], middle: [60, 78, 42, 0], ring: [62, 78, 40, 0], little: [64, 76, 38, 2] }, touch: { thumb: 0.5, index: 0.5, middle: 0.5, ring: 0.3, little: 0.2 } }, bumpAt + 0.3, 0.35, 'power3.out')
      glassHand.to(tl, { touch: { thumb: 0.2, index: 0.2, middle: 0.2, ring: 0.1, little: 0.1 } }, bumpAt + 1.2, 1.2)
      cam2.shake(tl, bumpAt, 0.4, 0.25)
      fade(tl, '.n-lab-slipspike', 1, bumpAt, 0.3)
      fade(tl, '.n-reflex', 1, bumpAt + 1.4, 0.6)
      tl.to({}, { duration: 0.6 }, b3 + 14.4)

      /* b4: the lab. Seven reaches; its own hand hides the contact from its camera. */
      const b4 = b3 + 15
      tl.addLabel('b4', b4)
      fade(tl, '.n-glassshot', 0, b4, 0.6, 1)
      fade(tl, '.n-lab', 1, b4, 0.8)
      cam3.cut(tl, { x: 760, y: 470, zoom: 1.0 }, b4)
      cam3.to(tl, { x: 900, y: 520, zoom: 1.28 }, b4, 9, 'sine.inOut')
      seven.to(tl, { ...POSES.workbench, armN: 70, elbowN: 34 }, b4 + 0.6, 1.6)
      seven.to(tl, { ...POSES.workbench, armN: 62, elbowN: 44, head: 26 }, b4 + 3.2, 1.6)
      fade(tl, '.n-inset', 1, b4 + 1.2, 0.6)
      tl.fromTo('.n-insetin', { scale: 0.9 }, { scale: 1, duration: 0.8, ease: 'back.out(1.6)', svgOrigin: '1250 310', immediateRender: false }, b4 + 1.2)
      tl.fromTo('.n-camhand', { y: -230 }, { y: 0, duration: 3.2, ease: 'power2.inOut', immediateRender: false }, b4 + 1.6)
      camHand.to(tl, { pose: { ...GRASPS.claw, index: [30, 30, 20, 0], middle: [30, 30, 20, 0], ring: [30, 30, 20, 0], little: [30, 30, 20, 0] } }, b4 + 4.2, 0.8)
      fade(tl, '.n-q', 1, b4 + 4.8, 0.4)
      fade(tl, '.n-lab-hides', 1, b4 + 4.9, 0.6)
      letterbox(tl, '.n-lb', true, b4 + 4.6)
      tl.to({}, { duration: 0.5 }, b4 + 9.2)
    },
    [mapHand, hand, glassHand, camHand],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.n-lamp', { opacity: 0.82, duration: 1.9, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.n-ringpulse', { opacity: 0.5, duration: 1.3, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  useEffect(() => {
    reportState(STATE[cueIndex] ?? '')
    setHints([])
  }, [cueIndex, reportState, setHints])

  return (
    <g ref={root}>
      {/* ---------- the map ---------- */}
      <g className="n-map" ref={mapRef}>
        <g data-depth="0.5">
          <Blueprint />
        </g>
        <g data-depth="1">
          <g className="n-mapglow" opacity={0}>
            <Pool x={1139} y={599} r={420} color="magenta" />
          </g>
          <FiveMap cx={800} cy={470} />
          <g className="n-ringpulse">
            <circle cx={1139} cy={599} r={22} fill="none" stroke={C.magenta} strokeWidth={3} filter="url(#cn-bloom)" />
          </g>
          <Hand3D store={mapHand} x={800} y={610} look="robot" arm={0} />
        </g>
      </g>

      {/* ---------- the close-up of the table (and the room, sharing one camera) ---------- */}
      <g ref={closeRef}>
        <g className="n-room" opacity={0}>
          <g data-depth="0.4">
            <DimRoom />
            {/* a window with rain far behind */}
            <rect x={60} y={90} width={300} height={420} fill="url(#cn-sky-night)" />
            <rect x={60} y={90} width={300} height={420} fill={C.rim} opacity={0.05} />
            <rect x={205} y={90} width={8} height={420} fill={C.ink1} />
            <rect x={60} y={290} width={300} height={8} fill={C.ink1} />
          </g>
          <g data-depth="1">
            <rect x={-600} y={790} width={2800} height={800} fill={C.ink2} />
            <g className="n-lamp">
              <Pool x={900} y={600} r={560} color="key" opacity={0.9} />
            </g>
            {/* the doctor in shadow */}
            <Person name="n-doc" x={1330} y={800} s={1.35} flip pose={{ ...POSES.stand, head: 10, armN: 20, elbowN: 70 }} silhouette={C.ink} />
            <Pool x={1330} y={500} r={240} color="rim" opacity={0.25} />
            {/* table */}
            <rect x={640} y={610} width={520} height={18} fill={C.ink3} />
            <rect x={640} y={610} width={520} height={3} fill={C.keyDeep} opacity={0.8} />
            <rect x={670} y={628} width={14} height={172} fill={C.ink1} />
            <rect x={1116} y={628} width={14} height={172} fill={C.ink1} />
            <DeskLamp x={1100} y={610} s={0.9} />
            <Matchbox x={900} y={612} s={0.42} />
            <g transform="translate(990 606) scale(0.42)">
              <Match />
            </g>
            <Person name="n-vol" x={520} y={800} s={1.38} pose={POSES.sitForward} hair="bun" top="#9c4a2c" topDark="#6a2e1a" skin={C.skinB} skinDark={C.skinBDark} light="key-right" />
            {/* the chair */}
            <path d="M440 712 L560 712 L560 726 L440 726 Z M452 726 L452 800 M548 726 L548 800 M444 712 L430 560" stroke={C.ink} strokeWidth={10} fill={C.ink} />
            <Dust x={500} y={300} w={700} h={400} count={22} seed={31} />
            <Label className="n-lab-umea" x={900} y={598} tx={980} ty={470} text="a matchbox, one match" sub="Umeå, Sweden" color={C.keyLight} hidden />
          </g>
        </g>

        <g className="n-close" opacity={0}>
          <g data-depth="0.4">
            <DimRoom />
          </g>
          <g data-depth="1">
            <g className="n-warm">
              <g className="n-lamp">
                <Pool x={860} y={560} r={720} color="key" opacity={0.95} />
              </g>
            </g>
            <g className="n-cool" opacity={0}>
              <Pool x={860} y={520} r={760} color="rim" opacity={0.75} />
            </g>
            {/* the volunteer's face, in profile, half in shadow */}
            <g opacity={0.95}>
              <Profile x={-150} y={150} s={1.05} light="key-right" half={0.7} hair={C.hairDark} skin={C.skinB} skinDark={C.skinBDark} />
            </g>
            <rect className="n-faceshade" x={-200} y={0} width={620} height={900} fill={C.ink} opacity={0.35} />
            {/* table top */}
            <rect x={-600} y={680} width={2800} height={800} fill={C.ink2} />
            <rect x={-600} y={680} width={2800} height={4} fill={C.keyDeep} opacity={0.5} />
            <g className="n-warm">
              <ellipse cx={860} cy={700} rx={640} ry={50} fill={C.key} opacity={0.16} filter="url(#cn-dof-2)" />
            </g>
            <Matchbox x={BOX.x} y={BOX.y + 20} s={1} />
            <g className="n-tablematch" transform={`translate(${MATCH.x} ${MATCH.y + 14})`}>
              <ellipse cx={80} cy={8} rx={80} ry={5} fill="#000" opacity={0.5} filter="url(#cn-dof-1)" />
              <Match />
            </g>
            <g className="n-sparks" opacity={0}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <path key={i} d={`M${BOX.x - 120} ${BOX.y - 22} l ${-30 - i * 12} ${-18 + i * 7}`} stroke={C.keyLight} strokeWidth={3} strokeLinecap="round" />
              ))}
            </g>
            <g className="n-hand" transform={`translate(${HOFF.x} ${HOFF.y})`}>
              <Hand3D store={hand} x={HAND.x} y={HAND.y} look="human" arm={420} light={[-0.6, -0.8]} onTips={onTips} />
              <g className="n-held" opacity={0}>
                <g className="n-heldin">
                  <g transform={`translate(${MATCH.x} ${MATCH.y})`}>
                    {/* the head half and the tail half, so it can snap */}
                    <g className="n-mh">
                      <rect x={4} y={-3.5} width={70} height={7} rx={2} fill="#e8c88f" />
                      <ellipse cx={4} cy={0} rx={10} ry={7} fill="#b8322a" />
                      <ellipse cx={1} cy={-2} rx={4} ry={2.4} fill="#e3584a" />
                      <g className="n-flame" transform="scale(0)">
                        <g transform="rotate(-70)">
                          <g className="tc-flicker">
                            <Flame />
                          </g>
                        </g>
                      </g>
                    </g>
                    <rect x={74} y={-3.5} width={80} height={7} rx={2} fill="#e8c88f" />
                  </g>
                </g>
              </g>
              <g className="n-numb" opacity={0} ref={numbRef}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <circle key={i} r={13} fill="#8d96a3" opacity={0.85} stroke="#c9d1dc" strokeWidth={1.5} />
                ))}
              </g>
              <g className="n-snap" opacity={0}>
                <circle cx={MATCH.x + 70} cy={MATCH.y} r={30} fill={C.paper} opacity={0.4} filter="url(#cn-bloom)" />
              </g>
            </g>
            <g className="n-flarelight" opacity={0} pointerEvents="none">
              <Pool x={560} y={420} r={620} color="key" opacity={0.9} />
            </g>
            <Label className="n-lab-numb" x={1000} y={560} tx={700} ty={330} text="fingertips numbed" sub="sight and movement normal" color={C.mist} hidden />
            <Label className="n-lab-squeeze" x={SNAP.x} y={SNAP.y} tx={SNAP.x - 120} ty={SNAP.y - 170} text="over-squeezed: snap" color={C.danger} hidden />
          </g>
          <rect className="n-dip" x={-100} y={-100} width={1800} height={1100} fill="#000" opacity={0} pointerEvents="none" />
        </g>
      </g>

      {/* ---------- the glass and the graph ---------- */}
      <g className="n-glassshot" opacity={0}>
        <rect x={-100} y={-100} width={1800} height={1100} fill={C.ink1} />
        <g className="n-glasscam">
          <g filter="url(#cn-dof-3)" opacity={0.6}>
            <circle cx={200} cy={200} r={60} fill={C.key} opacity={0.25} />
            <circle cx={1400} cy={160} r={50} fill={C.rim} opacity={0.3} />
            <rect x={1200} y={60} width={300} height={420} fill={C.ink3} />
          </g>
          <Pool x={GLASS.x} y={420} r={560} color="key" opacity={0.8} />
          <Dust x={700} y={100} w={800} h={600} count={26} seed={12} />
          <rect x={-100} y={GLASS.y + 2} width={1800} height={600} fill={C.ink2} opacity={0.5} />
          <rect x={-100} y={GLASS.y} width={1800} height={8} fill={C.ink3} opacity={0} />
          <g className="n-glassmove">
            <Hand3D store={glassHand} x={GLASS.x + 165} y={GLASS.y - 145} look="human" arm={420} light={[-0.7, -0.7]} />
            <g transform={`translate(${GLASS.x} ${GLASS.y})`}>
              <Glass w={128} h={272} />
            </g>
          </g>
          <g className="n-knock" opacity={0}>
            {[0, 1, 2].map((i) => (
              <path key={i} d={`M${GLASS.x - 90} ${GLASS.y - 150 + i * 30} l -110 ${-4 + i * 4}`} stroke={C.paper} strokeWidth={4 - i} strokeLinecap="round" opacity={0.6} />
            ))}
          </g>
        </g>
        {/* the graph */}
        <g>
          <Pool x={G.x0 + G.w / 2} y={(TOUCH_Y + G.y0) / 2} r={640} color="dark" />
          <path className="n-axes" d={`M${G.x0} ${G.y0 - G.h - 10} V${G.y0} H${G.x0 + G.w}`} fill="none" stroke={C.fog} strokeWidth={2} pathLength={1} strokeDasharray="1" strokeDashoffset={1} />
          <text x={G.x0 + G.w} y={G.y0 + 30} textAnchor="end" fill={C.fog} fontFamily={SANS} fontSize={20}>
            time →
          </text>
          <clipPath id="n-graph-clip">
            <rect className="n-reveal" x={G.x0} y={TOUCH_Y - 70} width={0} height={G.y0 - TOUCH_Y + 80} />
          </clipPath>
          <g clipPath="url(#n-graph-clip)">
            <path d={TOUCH_D} fill="none" stroke={C.magenta} strokeWidth={3} filter="url(#cn-bloom)" />
            <path d={SLIP_D} fill="none" stroke={C.mist} strokeWidth={3} strokeDasharray="12 9" />
            <path d={GRIP_D} fill="none" stroke={C.amber} strokeWidth={5} strokeLinejoin="round" filter="url(#cn-bloom)" />
          </g>
          <text x={G.x0 - 14} y={TOUCH_Y + 6} textAnchor="end" fill={C.magenta} fontFamily={SANS} fontSize={20} opacity={0.85}>
            touch
          </text>
          <g className="n-cursor" opacity={0}>
            <line x1={G.x0} x2={G.x0} y1={TOUCH_Y - 60} y2={G.y0} stroke={C.paper} strokeWidth={1.5} opacity={0.5} />
          </g>
          <Label className="n-lab-grip" x={tx(0.5)} y={ly(GR1)} tx={tx(0.62)} ty={ly(GR1) - 66} text="grip force" color={C.amber} hidden size={28} />
          <Label className="n-lab-slip" x={tx(0.9)} y={ly(S1)} tx={tx(0.9)} ty={ly(S1) + 34} text="slip threshold" color={C.mist} hidden size={24} dot={false} />
          <g className="n-margin" opacity={0}>
            <path d={`M${tx(0.75)} ${ly(S1) - 2} V${ly(GR1) + 2}`} stroke={C.amberLight} strokeWidth={2.5} />
            <path d={`M${tx(0.75) - 8} ${ly(S1) - 2} H${tx(0.75) + 8} M${tx(0.75) - 8} ${ly(GR1) + 2} H${tx(0.75) + 8}`} stroke={C.amberLight} strokeWidth={2.5} />
            <text x={tx(0.75) + 16} y={(ly(S1) + ly(GR1)) / 2 + 8} fill={C.amberLight} fontFamily={SANS} fontSize={24} fontWeight={600}>
              +10–40%
            </text>
          </g>
          <Label className="n-lab-slipspike" x={tx(BUMP + 0.02)} y={TOUCH_Y - 44} tx={tx(BUMP + 0.22)} ty={TOUCH_Y - 64} text="slip!" color={C.magenta} hidden size={24} />
          <g className="n-reflex" opacity={0}>
            <path d={`M${tx(BUMP)} ${ly(GR2) - 34} V${ly(GR2) - 46} H${tx(BUMP + 0.16)} V${ly(GR2) - 34}`} fill="none" stroke={C.paper} strokeWidth={2} />
            <text x={tx(BUMP + 0.08)} y={ly(GR2) - 60} textAnchor="middle" fill={C.paper} fontFamily={SANS} fontSize={26} fontWeight={600}>
              ~100 ms reflex
            </text>
          </g>
        </g>
      </g>

      {/* ---------- the lab: Seven and its camera ---------- */}
      <g className="n-lab" opacity={0} ref={labRef}>
        <g data-depth="0.25">
          <LabSky />
        </g>
        <g data-depth="0.6">
          <LabWall />
        </g>
        <g data-depth="1">
          <LabFloor />
          <Workbench x={BENCH.x} y={BENCH.y} w={560} />
          {/* a cup on the bench */}
          <path d={`M${BENCH.x - 222} ${BENCH.y - 60} L${BENCH.x - 216} ${BENCH.y} L${BENCH.x - 172} ${BENCH.y} L${BENCH.x - 166} ${BENCH.y - 60} Z`} fill={C.shellMid} />
          <ellipse cx={BENCH.x - 194} cy={BENCH.y - 60} rx={28} ry={6} fill={C.ink3} />
          <Pool x={SEVEN.x} y={SEVEN.y - 280} r={420} color="rim" opacity={0.3} />
          <ellipse cx={SEVEN.x} cy={SEVEN.y + 4} rx={110} ry={12} fill="#000" opacity={0.5} filter="url(#cn-dof-1)" />
          <Robot name="n-seven" x={SEVEN.x} y={SEVEN.y} s={SEVEN.s} pose={POSES.workbench} light="cool-left" />
          <Dust x={-200} y={0} w={2000} h={800} count={34} seed={44} color={C.rim} size={0.8} />
        </g>
        <g data-depth="1.7">
          <ForeShelf x={1520} />
        </g>
      </g>

      {/* the camera feed inset: what Seven's head camera sees */}
      <g className="n-inset" opacity={0} pointerEvents="none">
        {/* lowered so the letterbox (96px) never covers the feed's top edge */}
        <g transform="translate(0 140)">
        <g className="n-insetin">
          <clipPath id="n-inset-clip">
            <rect x={1000} y={150} width={500} height={320} rx={10} />
          </clipPath>
          <g clipPath="url(#n-inset-clip)">
            <rect x={1000} y={150} width={500} height={320} fill="#0c1410" />
            <rect x={1000} y={380} width={500} height={90} fill="#18241d" />
            <Pool x={1250} y={370} r={260} color="key" opacity={0.5} />
            {/* the cup, from above and in front */}
            <path d="M1200 290 L1208 400 L1292 400 L1300 290 Z" fill={C.shellMid} />
            <path d="M1200 290 L1208 400 L1230 400 L1222 290 Z" fill={C.white} opacity={0.5} />
            <ellipse cx={1250} cy={290} rx={50} ry={10} fill={C.ink3} />
            <g className="n-camhand">
              <Hand3D store={camHand} x={1262} y={150} look="robot" arm={300} light={[0.8, -0.5]} />
            </g>
            <g className="n-q" opacity={0}>
              <text x={1250} y={372} textAnchor="middle" fill={C.magenta} fontFamily={SANS} fontSize={64} fontWeight={700} filter="url(#cn-bloom)">
                ?
              </text>
            </g>
            {/* scanlines and grain */}
            <g opacity={0.18}>
              {Array.from({ length: 40 }, (_, i) => (
                <rect key={i} x={1000} y={150 + i * 8} width={500} height={2} fill="#000" />
              ))}
            </g>
            <rect className="hd-scan" x={1000} y={250} width={500} height={60} fill={C.lime} opacity={0.04} />
          </g>
          <rect x={1000} y={150} width={500} height={320} rx={10} fill="none" stroke={C.lime} strokeWidth={2} opacity={0.6} />
          <circle className="hd-blink" cx={1026} cy={176} r={7} fill={C.danger} />
          <text x={1042} y={183} fill={C.lime} fontFamily={MONO} fontSize={18}>
            HEAD CAM · 30 fps
          </text>
        </g>
        <Label className="n-lab-hides" x={1250} y={472} tx={1250} ty={506} text="the hand hides the contact from the camera" color={C.paper} anchor="middle" size={24} dot={false} hidden />
        </g>
      </g>

      {/* the stopwatch, in screen space */}
      <g className="n-watch" opacity={0} pointerEvents="none">
        <text x={1500} y={86} textAnchor="end" fill={C.mist} fontFamily={SANS} fontSize={18} letterSpacing={4}>
          STOPWATCH
        </text>
        <text className="n-watch-t" x={1500} y={140} textAnchor="end" fill={C.paper} fontFamily={MONO} fontSize={52} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {stopwatch(0)}
        </text>
        <g className="n-ghost" opacity={0}>
          <Mono x={1500} y={180} anchor="end" color={C.keyLight} size={24}>
            with touch: 00:07.0
          </Mono>
        </g>
      </g>
      <Vignette />
      <Letterbox className="n-lb" />
    </g>
  )
}

export const ch1: Chapter = {
  id: 'numb',
  title: 'Numb fingers',
  cues: CUES,
  Scene: Ch1Numb,
  deeper: [JohanssonReading],
}
