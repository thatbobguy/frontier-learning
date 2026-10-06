import gsap from 'gsap'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { camera } from '../../../cine/camera'
import { GRASPS, handSegments, useHandStore, type HandPose, type HandStore } from '../../../cine/hand3d'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { POSES, Person, rig } from '../../../cine/people'
import { useDrag } from '../../../engine/svg'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Blueprint, Dust, FiveMap, Label, Letterbox, Pool, Vignette, fade, letterbox, useAmbient } from '../shared/kit'
import { Hand3DX, projector } from './hand4'
import { Live, Mono, Tick, chime, useVals, type Pt } from './parts'
import { ThumbReading } from './readings'

export const CUES: Cue[] = [
  { id: 'master', say: 'Of all the fingers, the thumb is the hardest to build. It has to swing across the palm and meet every fingertip, a move called opposition.' },
  { id: 'saddle', say: 'Its base is a saddle-shaped joint with two tilted axes, buried in the palm where space is tight. And it must push back against all four fingers at once.' },
  { id: 'place', say: 'Design challenge. Place the thumb’s base and set its swing axis so the thumb can reach the index fingertip and the ring fingertip.', play: true },
  { id: 'pinky', say: 'And sometimes the smartest design choice is a missing finger. In 2026, Boston Dynamics built a new hand for its Atlas robot with no pinky.' },
  { id: 'tape', say: 'To test the idea, staff taped their ring and little fingers together for a day. The tasks hardly suffered, and the hand lost cost, size, and things that can break.' },
  { id: 'lesson', say: 'That’s the real lesson of shape: copy what the job needs, not what the human body happens to have.' },
]

const STATE = [
  'A close-up of a human hand, palm towards us, warmly lit. The thumb swings across the palm and touches the tip of the index, then the middle, ring and little fingers in turn (the pads glow magenta as they meet). The thumb’s base joint deep in the palm is highlighted with a small saddle shape. The move is called opposition.',
  'Blueprint. An exploded view of the thumb’s base joint: a saddle-shaped surface (curving up one way and down the other) with two cyan rotation axes that are tilted and offset from each other. Then a force diagram: four amber arrows from the four fingertips converge on the thumb pad, and the thumb pushes back with one much thicker amber arrow. The thumb has to resist all four fingers at once from a joint buried in the palm.',
  '',
  'Letterboxed, near darkness. A white robot hand with only four fingers (three fingers and a thumb, no pinky) turns slowly in cool rim light. Label: "Atlas hand, Oct 2026: 4 fingers, 13 DOF". Boston Dynamics chose to drop the little finger.',
  'Theo, the technician, works at a bench with his ring and little fingers taped together (a close-up shows the white tape band). He opens a drawer, types and holds a mug; a tick appears after each. Boston Dynamics says dropping the pinky cut cost, size, actuator count and failure points without much loss of function.',
  'Back out to the five-question map. The bone-white Shape ring settles to a steady light, and the amber Muscle ring (question 2, actuation) starts to pulse: that is the next film.',
]

/* ---------------- opposition (thumb meets each fingertip; solved offline from the kit's skeleton) ---------------- */
const OPP: { f: 'index' | 'middle' | 'ring' | 'little'; thumb: HandPose['thumb']; finger: HandPose['index'] }[] = [
  { f: 'index', thumb: [35, 0, 40, 0], finger: [60, 60, 30, 0] },
  { f: 'middle', thumb: [65, 10, 0, 40], finger: [50, 80, 40, 0] },
  { f: 'ring', thumb: [45, 20, 40, 30], finger: [70, 70, 35, 0] },
  { f: 'little', thumb: [65, 50, 10, 0], finger: [70, 50, 25, 0] },
]
const CLOSE = { x: 800, y: 900 }
const CLOSE_VIEW = { yaw: -8, pitch: 4, roll: 0, s: 2.4 }

/* ---------------- the design challenge (top view of a palm) ---------------- */
const PALM = { x0: 620, x1: 880, y0: 330, y1: 710 }
const FINGERS = [
  { name: 'index', x: 655, len: 200 },
  { name: 'middle', x: 715, len: 222 },
  { name: 'ring', x: 775, len: 206 },
  { name: 'little', x: 835, len: 165 },
]
const ZONES = { index: { x: 655, y: 500 }, ring: { x: 775, y: 610 } }
const ZR = 40
const REACH = 45
const TH = { L1: 120, L2: 90, d0: -100 }
const BASE_Y: [number, number] = [360, 690]
const DIAL = { x: 1230, y: 560, r: 110 }
const rad = (d: number) => (d * Math.PI) / 180

/** The thumb tip for a swing psi about the axis (angle phi in the palm plane) through the base, with the end joint bent by beta. */
function thumbTip(by: number, phi: number, psi: number, beta: number) {
  const d0 = [Math.cos(rad(TH.d0)), Math.sin(rad(TH.d0)), 0]
  const a = [Math.cos(rad(phi)), Math.sin(rad(phi)), 0]
  const rot = (v: number[]) => {
    const c = Math.cos(rad(psi))
    const s = Math.sin(rad(psi))
    const axv = [a[1] * v[2] - a[2] * v[1], a[2] * v[0] - a[0] * v[2], a[0] * v[1] - a[1] * v[0]]
    const ad = a[0] * v[0] + a[1] * v[1] + a[2] * v[2]
    return [0, 1, 2].map((k) => v[k] * c + axv[k] * s + a[k] * ad * (1 - c))
  }
  const j = rot([TH.L1 * d0[0], TH.L1 * d0[1], 0])
  const t = rot([TH.L1 * d0[0] + TH.L2 * Math.cos(rad(beta)) * d0[0], TH.L1 * d0[1] + TH.L2 * Math.cos(rad(beta)) * d0[1], TH.L2 * Math.sin(rad(beta))])
  return { joint: { x: PALM.x0 + j[0], y: by + j[1], z: j[2] }, tip: { x: PALM.x0 + t[0], y: by + t[1], z: t[2] } }
}

/** Every place the tip can reach in front of the palm: one curve per end-joint bend. */
function sweep(by: number, phi: number) {
  const curves: Pt[][] = []
  for (let b = 0; b <= 60; b += 15) {
    let cur: Pt[] = []
    for (let p = -180; p <= 180; p += 4) {
      const { tip } = thumbTip(by, phi, p, b)
      if (tip.z < -5) {
        if (cur.length > 1) curves.push(cur)
        cur = []
        continue
      }
      cur.push({ x: tip.x, y: tip.y })
    }
    if (cur.length > 1) curves.push(cur)
  }
  return curves
}
const reaches = (curves: Pt[][], z: Pt) => curves.some((c) => c.some((p) => Math.hypot(p.x - z.x, p.y - z.y) < REACH))

/* ---------------- the pinky ---------------- */
const ATLAS = { x: 800, y: 760 }
const TAPE_POSE = (base: HandPose): HandPose => ({ ...base, ring: [base.ring[0], base.ring[1], base.ring[2], 3], little: [base.ring[0], base.ring[1], base.ring[2], -12] })
const INSET = { x: 1150, y: 830 }
const INSET_VIEW = { yaw: -20, pitch: 6, roll: 0, s: 2.1 }

/** The white tape band around the ring and little fingers, pinned to the hand. */
function Tape({ store, x, y }: { store: HandStore; x: number; y: number }) {
  const [, force] = useReducer((n: number) => n + 1, 0)
  useEffect(() => store.subscribe(force), [store])
  const proj = projector(store.state.view, x, y)
  const { segs } = handSegments(store.state.pose)
  const mid = (f: 'ring' | 'little') => {
    const s = segs.find((g) => g.finger === f && g.k === 0)
    if (!s) return { x, y }
    return proj([(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2, (s.a[2] + s.b[2]) / 2])
  }
  const a = mid('ring')
  const b = mid('little')
  const k = store.state.view.s
  return (
    <g pointerEvents="none">
      <path d={`M${a.x} ${a.y} L${b.x} ${b.y}`} stroke="#f4f1ea" strokeWidth={20 * k} strokeLinecap="round" opacity={0.95} />
      <path d={`M${a.x} ${a.y} L${b.x} ${b.y}`} stroke="#d9d3c6" strokeWidth={20 * k} strokeLinecap="round" strokeDasharray="2 10" opacity={0.6} />
    </g>
  )
}

/** The saddle joint at the base of the thumb, pinned to the close-up hand. */
function SaddleMark({ store }: { store: HandStore }) {
  const [, force] = useReducer((n: number) => n + 1, 0)
  useEffect(() => store.subscribe(force), [store])
  const proj = projector(store.state.view, CLOSE.x, CLOSE.y)
  const { segs } = handSegments(store.state.pose)
  const s = segs.find((g) => g.finger === 'thumb' && g.k === 0)
  const p = s ? proj(s.a) : { x: CLOSE.x, y: CLOSE.y }
  return (
    <g transform={`translate(${p.x} ${p.y})`} pointerEvents="none">
      <circle r={70} fill="url(#cn-pool-cyan)" opacity={0.7} />
      <path d="M-40 -6 Q 0 26 40 -6" stroke={C.bone} strokeWidth={4} fill="none" />
      <path d="M-40 6 Q 0 -26 40 6" stroke={C.cyan} strokeWidth={4} fill="none" />
      <circle r={6} fill={C.cyanLight} />
    </g>
  )
}

/** Where the pinky would be: a dashed ghost, pinned to the Atlas hand. */
function GhostPinky({ store, x, y }: { store: HandStore; x: number; y: number }) {
  const [, force] = useReducer((n: number) => n + 1, 0)
  useEffect(() => store.subscribe(force), [store])
  const proj = projector(store.state.view, x, y)
  const { segs } = handSegments(store.state.pose)
  const k = store.state.view.s
  const pts = segs.filter((g) => g.finger === 'little')
  if (!pts.length) return null
  const ps = [proj(pts[0].a), ...pts.map((g) => proj(g.b))]
  const d = 'M' + ps.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L')
  const end = ps[ps.length - 1]
  return (
    <g pointerEvents="none">
      <path d={d} stroke={C.mist} strokeWidth={15 * k} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.08} />
      <path d={d} stroke={C.mist} strokeWidth={2} strokeDasharray="6 8" fill="none" opacity={0.6} />
      <g className="t-lab-nopinky" opacity={0}>
        <path d={`M${end.x + 10} ${end.y} L${end.x + 120} ${end.y + 40}`} stroke={C.mist} strokeWidth={1.5} />
        <text x={end.x + 128} y={end.y + 48} fill={C.mist} fontFamily={MONO} fontSize={18}>
          no pinky
        </text>
      </g>
    </g>
  )
}

/* ---------------- the saddle, exploded ---------------- */
function saddlePts(u: number, v: number) {
  return { x: 520 + 210 * u - 120 * v, y: 500 + 60 * u + 80 * v - 85 * (u * u - v * v) }
}

export function Ch4Thumb({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints, memory }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const world = useRef<SVGGElement>(null)
  const mapRef = useRef<SVGGElement>(null)
  const closeHand = useHandStore({ pose: GRASPS.relaxed, view: CLOSE_VIEW })
  const atlas = useHandStore({ pose: GRASPS.relaxed, view: { yaw: -25, pitch: 8, roll: 0, s: 2.3 } })
  const taped = useHandStore({ pose: TAPE_POSE(GRASPS.relaxed), view: INSET_VIEW })
  const mapHand = useHandStore({ pose: GRASPS.relaxed, view: { yaw: 10, pitch: 6, roll: 0, s: 1.0 } })
  const phase = useVals({ t: 0 })

  /* the play */
  const [by, setBy] = useState(400)
  const [phi, setPhi] = useState(-90)
  const [solved, setSolved] = useState(false)
  const inPlay = cueIndex === 2
  const curves = useMemo(() => sweep(by, phi), [by, phi])
  const hitI = reaches(curves, ZONES.index)
  const hitR = reaches(curves, ZONES.ring)
  const vertical = Math.abs(Math.abs(phi) - 90) < 22
  const feedback = hitI && hitR ? 'both fingertips reached' : vertical ? 'axis along the fingers: it only swings sideways' : by < 470 && hitI ? 'too high: it can’t reach the ring finger' : !hitI && hitR ? 'it misses the index fingertip' : 'the sweep misses: tilt the axis across the palm'

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const cam = camera(world.current, { x: 820, y: 520, zoom: 1.15 })
      const mapCam = camera(mapRef.current, { x: 580, y: 481, zoom: 6 })
      const theo = rig(root.current, 't-theo', { ...POSES.workbench })

      /* b0: the thumb meets each fingertip in turn. */
      tl.addLabel('b0', 0)
      tl.set('.t-map', { opacity: 0 }, 0)
      cam.to(tl, { x: 800, y: 500, zoom: 1.0 }, 0, 0.01)
      cam.to(tl, { x: 830, y: 540, zoom: 1.12 }, 0.05, 10.5, 'sine.inOut')
      fade(tl, '.t-lab-opp', 1, 2.6, 0.5)
      OPP.forEach((o, i) => {
        const at = 1.0 + i * 2.2
        closeHand.to(tl, { pose: { ...GRASPS.relaxed, thumb: o.thumb, [o.f]: o.finger }, touch: { thumb: 0, index: 0, middle: 0, ring: 0, little: 0 } }, at, 1.0, 'power2.inOut')
        closeHand.to(tl, { touch: { thumb: 1, [o.f]: 1 } }, at + 0.9, 0.3)
      })
      closeHand.to(tl, { pose: GRASPS.relaxed, touch: { thumb: 0, little: 0 } }, 9.8, 0.8)
      fade(tl, '.t-saddlemark', 1, 7.4, 0.6)
      fade(tl, '.t-lab-saddle', 1, 7.8, 0.5)

      /* b1: the saddle, exploded; four forces against one. */
      const b1 = 10.8
      tl.addLabel('b1', b1)
      fade(tl, '.t-close', 0, b1, 0.6, 1)
      fade(tl, '.t-bp', 1, b1, 0.6)
      cam.to(tl, { x: 800, y: 450, zoom: 0.9 }, b1, 0.01)
      cam.to(tl, { x: 640, y: 470, zoom: 1.12 }, b1 + 0.05, 5.4, 'sine.inOut')
      tl.fromTo('.t-mesh', { strokeDashoffset: 600, opacity: 0 }, { strokeDashoffset: 0, opacity: 1, duration: 1.4, stagger: 0.06, immediateRender: false }, b1 + 0.4)
      tl.fromTo('.t-axis', { strokeDashoffset: 700, opacity: 0 }, { strokeDashoffset: 0, opacity: 1, duration: 1, stagger: 0.6, immediateRender: false }, b1 + 2.2)
      fade(tl, '.t-lab-axes', 1, b1 + 3.6, 0.5)
      fade(tl, '.t-lab-buried', 1, b1 + 4.6, 0.5)
      tl.fromTo('.t-rock', { rotation: -6, svgOrigin: '520 500' }, { rotation: 6, svgOrigin: '520 500', duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: 3, immediateRender: false }, b1 + 0.5)
      cam.to(tl, { x: 980, y: 450, zoom: 1.0 }, b1 + 5.8, 1.4)
      fade(tl, '.t-forces', 1, b1 + 6.0, 0.5)
      tl.fromTo('.t-farrow', { strokeDashoffset: 300, opacity: 0 }, { strokeDashoffset: 0, opacity: 1, duration: 0.6, stagger: 0.25, immediateRender: false }, b1 + 6.4)
      tl.fromTo('.t-tarrow', { scaleY: 0, svgOrigin: '1290 780' }, { scaleY: 1, svgOrigin: '1290 780', duration: 0.7, ease: 'back.out(2)', immediateRender: false }, b1 + 8.0)
      cam.shake(tl, b1 + 8.5, 0.4, 0.3)
      fade(tl, '.t-lab-push', 1, b1 + 8.6, 0.5)

      /* b2: the play. */
      const b2 = b1 + 12
      tl.addLabel('b2', b2)
      fade(tl, '.t-bp', 0, b2, 0.5, 1)
      fade(tl, '.t-play', 1, b2 + 0.3, 0.6)
      cam.to(tl, { x: 800, y: 450, zoom: 1 }, b2, 0.8)

      /* b3: the missing pinky. */
      const b3 = b2 + 1.2
      tl.addLabel('b3', b3)
      fade(tl, '.t-play', 0, b3, 0.4, 1)
      fade(tl, '.t-atlas', 1, b3 + 0.3, 1.2)
      letterbox(tl, '.t-lb', true, b3 + 0.2)
      cam.to(tl, { x: 800, y: 470, zoom: 1.0 }, b3, 0.01)
      cam.to(tl, { x: 800, y: 440, zoom: 1.12 }, b3 + 0.05, 10, 'sine.inOut')
      atlas.to(tl, { view: { yaw: 25 } }, b3 + 0.2, 9.8, 'sine.inOut')
      atlas.to(tl, { pose: GRASPS.tripod }, b3 + 4.2, 1.4)
      atlas.to(tl, { pose: GRASPS.relaxed }, b3 + 7.0, 1.4)
      fade(tl, '.t-lab-atlas', 1, b3 + 5.0, 0.8)
      fade(tl, '.t-ghostpinky', 1, b3 + 7.6, 0.6)
      fade(tl, '.t-lab-nopinky', 1, b3 + 7.8, 0.5)

      /* b4: the tape test. */
      const b4 = b3 + 10.4
      tl.addLabel('b4', b4)
      letterbox(tl, '.t-lb', false, b4)
      fade(tl, '.t-atlas', 0, b4, 0.6, 1)
      fade(tl, '.t-lab-atlas', 0, b4, 0.4, 1)
      fade(tl, '.t-bench', 1, b4 + 0.2, 0.8)
      cam.to(tl, { x: 800, y: 470, zoom: 1.0 }, b4, 0.01)
      cam.to(tl, { x: 780, y: 480, zoom: 1.04 }, b4 + 0.05, 12, 'sine.inOut')
      fade(tl, '.t-lab-tape', 1, b4 + 1.2, 0.5)
      // a drawer
      theo.to(tl, { ...POSES.reach, armN: 60, elbowN: 20 }, b4 + 1.4, 0.6)
      theo.to(tl, { x: -30, armN: 50, elbowN: 50, torso: 4 }, b4 + 2.0, 0.6)
      tl.fromTo('.t-drawer', { x: 0 }, { x: -70, duration: 0.6, immediateRender: false }, b4 + 2.0)
      taped.to(tl, { pose: TAPE_POSE(GRASPS.hook) }, b4 + 1.4, 0.6)
      fade(tl, '.t-tick-0', 1, b4 + 2.7, 0.3)
      // typing
      theo.to(tl, { ...POSES.type, x: -30 }, b4 + 3.6, 0.7)
      taped.to(tl, { pose: TAPE_POSE({ ...GRASPS.relaxed, index: [30, 30, 14, 0], middle: [34, 34, 16, 0] }) }, b4 + 3.6, 0.6)
      for (let k = 0; k < 4; k++) {
        taped.to(tl, { pose: { index: k % 2 ? [30, 30, 14, 0] : [44, 40, 20, 0], middle: k % 2 ? [48, 44, 22, 0] : [34, 34, 16, 0] } }, b4 + 4.3 + k * 0.35, 0.3)
        theo.to(tl, { elbowN: k % 2 ? 64 : 58 }, b4 + 4.3 + k * 0.35, 0.3)
      }
      fade(tl, '.t-tick-1', 1, b4 + 5.8, 0.3)
      // a mug
      theo.to(tl, { ...POSES.hold, x: -30 }, b4 + 6.6, 0.8)
      fade(tl, '.t-mug', 1, b4 + 6.8, 0.4)
      fade(tl, '.t-benchmug', 0, b4 + 6.8, 0.3, 1)
      taped.to(tl, { pose: TAPE_POSE(GRASPS.power) }, b4 + 6.6, 0.8)
      fade(tl, '.t-tick-2', 1, b4 + 8.0, 0.3)
      fade(tl, '.t-lab-lost', 1, b4 + 9.0, 0.6)

      /* b5: back to the map. */
      const b5 = b4 + 12.4
      tl.addLabel('b5', b5)
      fade(tl, '.t-world', 0, b5, 0.8, 1)
      fade(tl, '.t-map', 1, b5, 0.8)
      mapCam.to(tl, { x: 580, y: 481, zoom: 6 }, b5, 0.01)
      mapCam.to(tl, { x: 800, y: 470, zoom: 0.92 }, b5 + 0.05, 2.8, 'power3.out')
      mapHand.to(tl, { view: { yaw: -30 } }, b5, 7.8, 'sine.inOut')
      tl.fromTo('.fm-ring-shape', { opacity: 0.22 }, { opacity: 1, duration: 0.6, immediateRender: false }, b5 + 0.3)
      tl.fromTo('.fm-lab-shape', { opacity: 0.35 }, { opacity: 1, duration: 0.6, immediateRender: false }, b5 + 0.3)
      fade(tl, '.t-lab-shape', 1, b5 + 2.6, 0.5)
      tl.fromTo('.fm-ring-muscle', { opacity: 0.22 }, { opacity: 1, duration: 0.6, ease: 'sine.inOut', yoyo: true, repeat: 5, immediateRender: false }, b5 + 3.6)
      tl.fromTo('.fm-lab-muscle', { opacity: 0.35 }, { opacity: 1, duration: 0.6, immediateRender: false }, b5 + 3.6)
      fade(tl, '.t-next', 1, b5 + 4.2, 0.6)
      tl.to({}, { duration: 0.3 }, b5 + 7.8)
    },
    [closeHand, atlas, taped, mapHand],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.fromTo(phase.state, { t: 0 }, { t: 1, duration: 2.6, yoyo: true, repeat: -1, ease: 'sine.inOut', onUpdate: phase.notify })
    gsap.to('.t-heat', { opacity: 0.5, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  /* ---------------- the play ---------------- */
  useEffect(() => {
    if (!inPlay || solved) return
    if (hitI && hitR) {
      setSolved(true)
      chime(true)
      memory.jointsThumb = { baseY: by, axis: phi }
      emit({ type: 'attempt', correct: true, detail: `placed the thumb base low (y ${Math.round(by)}) with the axis tilted across the palm (${Math.round(phi)} degrees)` })
      void say('Low on the palm, swinging across it. That’s why robot thumbs often get two motors of their own.').then(() => onPlayDone())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hitI, hitR, inPlay])

  const lastEmit = useRef(0)
  const note = () => {
    if (Date.now() - lastEmit.current < 2500) return
    lastEmit.current = Date.now()
    emit({ type: 'attempt', correct: false, detail: feedback })
  }
  const moveBase = (p: Pt) => {
    if (!inPlay || solved) return
    setBy(Math.max(BASE_Y[0], Math.min(BASE_Y[1], p.y)))
  }
  const moveDial = (p: Pt) => {
    if (!inPlay || solved) return
    let a = (Math.atan2(p.y - DIAL.y, p.x - DIAL.x) * 180) / Math.PI
    // an axis has no direction: fold onto -90..90
    if (a > 90) a -= 180
    if (a < -90) a += 180
    setPhi(a)
  }
  const dragBase = useDrag({ onStart: moveBase, onMove: moveBase, onEnd: note })
  const dragDial = useDrag({ onStart: moveDial, onMove: moveDial, onEnd: note })

  useEffect(() => {
    if (inPlay) {
      reportState(
        'The play: a top-down blueprint of a robot palm with four fixed fingers pointing up. Two small cyan zones mark where the index and ring fingertips land when they curl. On the palm’s left edge is the thumb’s base, which the learner drags up and down; a dial on the right sets the direction of the thumb’s swing axis (drawn as a dashed cyan line through the base). The translucent magenta band is everywhere the thumb tip can reach as it swings about that axis. ' +
          `Now: base ${Math.round(((by - BASE_Y[0]) / (BASE_Y[1] - BASE_Y[0])) * 100)}% of the way down the palm edge, axis at ${Math.round(phi)} degrees (-90 or 90 = parallel to the fingers, 0 = straight across, negative tilts up to the right). Reaches index zone: ${hitI ? 'yes' : 'no'}; ring zone: ${hitR ? 'yes' : 'no'}. On screen: "${feedback}". ` +
          (solved ? 'Solved. ' : '') +
          'Correct answer: put the base low on the palm (lower half, near the wrist) and tilt the axis diagonally, about 30 to 60 degrees up to the right, so the thumb swings across the palm. Likely mix-ups: base too high (near the index knuckle, so it cannot get down to the ring fingertip), or the axis parallel to the fingers (the thumb only swings sideways, never across).',
      )
      setHints(['Where does your own thumb’s base sit on your palm?', 'The thumb has to swing across the palm, not along it.'])
    } else {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
    }
  }, [inPlay, cueIndex, by, phi, hitI, hitR, feedback, solved, reportState, setHints])

  const ax = Math.cos(rad(phi))
  const ay = Math.sin(rad(phi))
  const mesh = useMemo(() => {
    const lines: string[] = []
    for (let i = 0; i <= 8; i++) {
      const u = -1 + i / 4
      const a: string[] = []
      const b: string[] = []
      for (let k = 0; k <= 16; k++) {
        const t = -1 + k / 8
        const p = saddlePts(u, t)
        const q = saddlePts(t, u)
        a.push(`${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        b.push(`${q.x.toFixed(1)} ${q.y.toFixed(1)}`)
      }
      lines.push('M' + a.join(' L'), 'M' + b.join(' L'))
    }
    return lines
  }, [])

  return (
    <g ref={root}>
      <g className="t-world">
        <g ref={world}>
          <g data-depth="0.4">
            <Blueprint />
            <Dust x={-300} y={-200} w={2200} h={1300} count={34} seed={41} color={C.cyan} size={0.6} />
          </g>
          <g data-depth="1">
            {/* ---------- the close-up: opposition ---------- */}
            <g className="t-close" pointerEvents="none">
              <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink1} />
              <Pool x={CLOSE.x} y={CLOSE.y - 380} r={640} color="key" opacity={0.85} />
              <Hand3DX store={closeHand} x={CLOSE.x} y={CLOSE.y} look="human" arm={220} light={[-0.7, -0.6]} />
              <g className="t-saddlemark" opacity={0}>
                <SaddleMark store={closeHand} />
              </g>
              <Label className="t-lab-opp" x={CLOSE.x + 40} y={CLOSE.y - 330} tx={CLOSE.x + 300} ty={CLOSE.y - 640} text="opposition" sub="thumb pad meets each fingertip" color={C.magentaLight} size={34} />
              <Label className="t-lab-saddle" x={CLOSE.x + 60} y={CLOSE.y - 40} tx={CLOSE.x + 300} ty={CLOSE.y - 120} text="a saddle joint, deep in the palm" color={C.cyan} />
            </g>

            {/* ---------- the saddle, exploded ---------- */}
            <g className="t-bp" opacity={0} pointerEvents="none">
              <g className="t-rock">
                {mesh.map((d, i) => (
                  <path key={i} className="t-mesh" d={d} stroke={i % 2 ? C.bone : C.boneDark} strokeWidth={2} fill="none" strokeDasharray="600" strokeDashoffset="600" opacity={0} />
                ))}
                <path className="t-axis" d="M260 470 L800 610" stroke={C.cyan} strokeWidth={6} strokeDasharray="700" strokeDashoffset="700" opacity={0} markerEnd="url(#cn-arrow)" markerStart="url(#cn-arrow)" />
                <path className="t-axis" d="M600 260 L470 700" stroke={C.cyan} strokeWidth={6} strokeDasharray="700" strokeDashoffset="700" opacity={0} markerEnd="url(#cn-arrow)" markerStart="url(#cn-arrow)" />
              </g>
              <Label className="t-lab-axes" x={790} y={605} tx={830} ty={700} text="two tilted axes" sub="not at right angles, not crossing" color={C.cyan} />
              <g className="t-lab-buried" opacity={0}>
                <g className="t-heat" opacity={0.8}>
                  <Pool x={520} y={500} r={330} color="amber" opacity={0.35} />
                </g>
                <text x={300} y={200} fill={C.paper} fontFamily={SANS} fontSize={30}>
                  buried in the palm, where space is tight
                </text>
              </g>
              {/* four fingers push; one thumb pushes back */}
              <g className="t-forces" opacity={0}>
                {[1110, 1220, 1330, 1440].map((x, i) => (
                  <g key={x}>
                    <circle cx={x} cy={300} r={26} fill={C.ink2} stroke={C.bone} strokeWidth={3} />
                    <path className="t-farrow" d={`M${x} ${334} L${1290 + (x - 1275) * 0.22} ${500}`} stroke={C.amber} strokeWidth={7} strokeLinecap="round" strokeDasharray="300" strokeDashoffset="300" opacity={0} markerEnd="url(#cn-arrow)" />
                    <text x={x} y={262} textAnchor="middle" fill={C.mist} fontFamily={MONO} fontSize={16}>
                      {['index', 'middle', 'ring', 'little'][i]}
                    </text>
                  </g>
                ))}
                <circle cx={1290} cy={560} r={44} fill={C.ink2} stroke={C.bone} strokeWidth={3} />
                <text x={1350} y={566} fill={C.mist} fontFamily={MONO} fontSize={16}>
                  thumb pad
                </text>
                <path className="t-tarrow" d="M1290 780 L1290 625" stroke={C.amber} strokeWidth={22} strokeLinecap="round" markerEnd="url(#cn-arrow)" />
              </g>
              <Label className="t-lab-push" x={1300} y={720} tx={1000} ty={790} text="one thumb pushes back against four" color={C.amber} />
            </g>

            {/* ---------- the play: place the thumb ---------- */}
            <g className="t-play" opacity={0}>
              {inPlay && (
                <g>
                  <text x={110} y={190} fill={C.paper} fontFamily={SERIF} fontSize={42} fontWeight={600}>
                    <tspan x={110}>Reach the index</tspan>
                    <tspan x={110} dy={52}>
                      and the ring fingertips
                    </tspan>
                  </text>
                  <text x={110} y={290} fill={C.mist} fontFamily={SANS} fontSize={22}>
                    <tspan x={110}>magenta = everywhere</tspan>
                    <tspan x={110} dy={28}>
                      the thumb tip can go
                    </tspan>
                  </text>
                  {/* palm and fingers, top view */}
                  {FINGERS.map((f) => (
                    <g key={f.name}>
                      <rect x={f.x - 26} y={PALM.y0 - f.len} width={52} height={f.len + 20} rx={26} fill={C.ink2} stroke={C.bone} strokeWidth={3} />
                      {[0.36, 0.66].map((t) => (
                        <line key={t} x1={f.x - 20} x2={f.x + 20} y1={PALM.y0 - f.len * t} y2={PALM.y0 - f.len * t} stroke={C.bone} strokeWidth={2} opacity={0.5} />
                      ))}
                      <text x={f.x} y={PALM.y0 - f.len - 16} textAnchor="middle" fill={C.mist} fontFamily={MONO} fontSize={16}>
                        {f.name}
                      </text>
                    </g>
                  ))}
                  <rect x={PALM.x0} y={PALM.y0} width={PALM.x1 - PALM.x0} height={PALM.y1 - PALM.y0} rx={30} fill={C.ink2} stroke={C.bone} strokeWidth={3} />
                  {/* the fingertip zones */}
                  {(['index', 'ring'] as const).map((z) => {
                    const hit = z === 'index' ? hitI : hitR
                    return (
                      <g key={z}>
                        <path d={`M${ZONES[z].x} ${PALM.y0 - 30} L${ZONES[z].x} ${ZONES[z].y - ZR}`} stroke={C.cyan} strokeWidth={2} strokeDasharray="4 8" opacity={0.6} />
                        <circle cx={ZONES[z].x} cy={ZONES[z].y} r={ZR} fill={C.cyan} opacity={hit ? 0.45 : 0.18} />
                        <circle className="t-zonepulse" cx={ZONES[z].x} cy={ZONES[z].y} r={ZR} fill="none" stroke={hit ? C.lime : C.cyan} strokeWidth={3} />
                        {hit && <path d={`M${ZONES[z].x - 12} ${ZONES[z].y} l8 9 l16 -18`} stroke={C.lime} strokeWidth={5} fill="none" strokeLinecap="round" />}
                      </g>
                    )
                  })}
                  <Mono x={PALM.x1 + 20} y={ZONES.ring.y - 4} color={C.cyanLight} size={16}>
                    <tspan x={PALM.x1 + 20}>curled fingertips</tspan>
                    <tspan x={PALM.x1 + 20} dy={20}>
                      land here
                    </tspan>
                  </Mono>
                  {/* the reachable sweep */}
                  <g style={{ mixBlendMode: 'screen' }}>
                    {curves.map((c, i) => (
                      <path key={i} d={'M' + c.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L')} stroke={C.magenta} strokeWidth={26} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.2} />
                    ))}
                  </g>
                  {/* the swing axis */}
                  <path d={`M${PALM.x0 - ax * 260} ${by - ay * 260} L${PALM.x0 + ax * 260} ${by + ay * 260}`} stroke={C.cyan} strokeWidth={3} strokeDasharray="12 8" />
                  {/* the thumb itself, swinging */}
                  <Live store={phase}>
                    {(s) => {
                      // swing back and forth over the reachable range (in front of the palm)
                      const ps: number[] = []
                      for (let p = -180; p <= 180; p += 6) if (thumbTip(by, phi, p, 30).tip.z >= -5) ps.push(p)
                      const psi = ps.length ? ps[Math.round(s.t * (ps.length - 1))] : 0
                      const { joint, tip } = thumbTip(by, phi, psi, 30)
                      const lift = Math.max(0, tip.z) / 210
                      return (
                        <g>
                          <path d={`M${PALM.x0} ${by} L${joint.x} ${joint.y} L${tip.x} ${tip.y}`} stroke={C.bone} strokeWidth={46 + lift * 14} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.9} />
                          <path d={`M${PALM.x0} ${by} L${joint.x} ${joint.y} L${tip.x} ${tip.y}`} stroke={C.ink2} strokeWidth={40 + lift * 14} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                          <circle cx={joint.x} cy={joint.y} r={10} fill={C.bone} />
                          <circle cx={tip.x} cy={tip.y} r={14} fill={C.magenta} filter="url(#cn-bloom)" />
                        </g>
                      )
                    }}
                  </Live>
                  {/* the base handle */}
                  <line x1={PALM.x0} x2={PALM.x0} y1={BASE_Y[0]} y2={BASE_Y[1]} stroke={C.bone} strokeWidth={4} strokeDasharray="2 10" strokeLinecap="round" />
                  <g data-tutor="thumb-base" {...(solved ? {} : dragBase)}>
                    <circle cx={PALM.x0} cy={by} r={44} fill="transparent" />
                    <circle cx={PALM.x0} cy={by} r={24} fill={C.ink1} stroke={C.bone} strokeWidth={4} className={solved ? undefined : 'hd-pulse'} />
                    <circle cx={PALM.x0} cy={by} r={8} fill={C.bone} />
                  </g>
                  <text x={PALM.x0 - 44} y={by + 8} textAnchor="end" fill={C.bone} fontFamily={SANS} fontSize={22}>
                    base ↕
                  </text>
                  {/* the axis dial */}
                  <g data-tutor="axis-dial" {...(solved ? {} : dragDial)}>
                    <circle cx={DIAL.x} cy={DIAL.y} r={DIAL.r + 30} fill="transparent" />
                    <circle cx={DIAL.x} cy={DIAL.y} r={DIAL.r} fill={C.ink1} fillOpacity={0.7} stroke={C.slate} strokeWidth={3} />
                    <path d={`M${DIAL.x - ax * DIAL.r} ${DIAL.y - ay * DIAL.r} L${DIAL.x + ax * DIAL.r} ${DIAL.y + ay * DIAL.r}`} stroke={C.cyan} strokeWidth={6} strokeLinecap="round" />
                    <circle cx={DIAL.x + ax * DIAL.r} cy={DIAL.y + ay * DIAL.r} r={20} fill={C.ink1} stroke={C.cyan} strokeWidth={4} className={solved ? undefined : 'hd-pulse'} />
                    <circle cx={DIAL.x - ax * DIAL.r} cy={DIAL.y - ay * DIAL.r} r={20} fill={C.ink1} stroke={C.cyan} strokeWidth={4} />
                    <circle cx={DIAL.x} cy={DIAL.y} r={6} fill={C.cyan} />
                  </g>
                  <text x={DIAL.x} y={DIAL.y - DIAL.r - 26} textAnchor="middle" fill={C.cyanLight} fontFamily={SANS} fontSize={22}>
                    swing axis ↻
                  </text>
                  <text x={DIAL.x} y={DIAL.y + DIAL.r + 50} textAnchor="middle" fill={hitI && hitR ? C.lime : C.magentaLight} fontFamily={SANS} fontSize={24} fontWeight={500}>
                    {feedback}
                  </text>
                </g>
              )}
            </g>

            {/* ---------- Atlas: four fingers ---------- */}
            <g className="t-atlas" opacity={0} pointerEvents="none">
              <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink} />
              <Pool x={ATLAS.x + 120} y={ATLAS.y - 360} r={560} color="rim" opacity={0.55} />
              <Hand3DX store={atlas} x={ATLAS.x} y={ATLAS.y} look="robot" arm={240} light={[-0.8, -0.4]} hide={['little']} shell="#dfe4ea" />
              <g className="t-ghostpinky" opacity={0}>
                <GhostPinky store={atlas} x={ATLAS.x} y={ATLAS.y} />
              </g>
              <Label className="t-lab-atlas" x={ATLAS.x + 110} y={ATLAS.y - 330} tx={ATLAS.x + 280} ty={ATLAS.y - 470} text="Atlas hand, Oct 2026" sub="4 fingers, 13 DOF" color={C.paper} size={34} />
            </g>

            {/* ---------- the tape test ---------- */}
            <g className="t-bench" opacity={0} pointerEvents="none">
              <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink1} />
              <Pool x={420} y={560} r={520} color="key" opacity={0.8} />
              <rect x={-400} y={840} width={2400} height={300} fill={C.ink2} />
              {/* the bench, with a drawer, a keyboard and a mug */}
              <rect x={360} y={600} width={420} height={24} rx={4} fill={C.ink3} />
              <rect x={380} y={624} width={380} height={216} fill={C.ink2} />
              <g className="t-drawer">
                <rect x={396} y={650} width={180} height={70} rx={4} fill={C.ink3} stroke={C.slate} strokeWidth={2} />
                <rect x={460} y={680} width={50} height={10} rx={5} fill={C.metal} />
              </g>
              <rect x={560} y={588} width={140} height={14} rx={3} fill={C.slate} />
              <g className="t-benchmug">
                <rect x={720} y={556} width={44} height={46} rx={6} fill="#c9d3e3" />
              </g>
              <g className="t-theo">
                <Person name="t-theo" x={330} y={860} s={1.4} hair="beanie" outfit="hoodie" top="#3d4a6b" topDark="#283250" skin={C.skinA} light="key-left" pose={POSES.workbench} holdN={<g className="t-mug" opacity={0}><rect x={-22} y={-4} width={44} height={46} rx={6} fill="#c9d3e3" /></g>} />
              </g>
              {/* the close-up of the taped hand */}
              <circle cx={INSET.x} cy={INSET.y - 330} r={300} fill={C.ink} opacity={0.6} />
              <Pool x={INSET.x} y={INSET.y - 330} r={330} color="key" opacity={0.5} />
              <Hand3DX store={taped} x={INSET.x} y={INSET.y} look="human" arm={140} light={[-0.7, -0.6]} />
              <Tape store={taped} x={INSET.x} y={INSET.y} />
              <Label className="t-lab-tape" x={INSET.x - 70} y={INSET.y - 260} tx={INSET.x - 280} ty={INSET.y - 540} text="ring and little fingers taped" sub="for a whole day" color={C.paper} />
              {['open a drawer', 'type', 'hold a mug'].map((t, i) => (
                <g key={t}>
                  <Tick x={100 + i * 280} y={150} className={`t-tick-${i}`} color={C.lime} />
                  <text x={140 + i * 280} y={158} fill={C.paper} fontFamily={SANS} fontSize={24} opacity={0.85}>
                    {t}
                  </text>
                </g>
              ))}
              <g className="t-lab-lost" opacity={0}>
                <text x={560} y={880} textAnchor="middle" fill={C.gold} fontFamily={SANS} fontSize={30} fontWeight={600} style={{ paintOrder: 'stroke' }} stroke={C.ink} strokeWidth={6}>
                  −1 finger: less cost, less size, fewer things to break
                </text>
              </g>
            </g>
          </g>
        </g>
      </g>

      {/* ---------- the map ---------- */}
      <g className="t-map" ref={mapRef} opacity={0} pointerEvents="none">
        <g data-depth="0.4">
          <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink} />
          <circle cx={800} cy={470} r={760} fill="url(#cn-pool-rim)" opacity={0.18} />
          <Dust x={-200} y={-100} w={2000} h={1100} count={40} seed={8} color={C.mist} size={0.7} />
        </g>
        <g data-depth="1">
          <FiveMap cx={800} cy={470} />
          <Hand3DX store={mapHand} x={800} y={660} look="robot" arm={70} light={[0.7, -0.6]} />
          <g className="t-lab-shape" opacity={0}>
            <text x={800} y={860} textAnchor="middle" fill={C.bone} fontFamily={SANS} fontSize={26}>
              shape: copy the job, not the body
            </text>
          </g>
          <g className="t-next" opacity={0}>
            <text x={1250} y={250} fill={C.amber} fontFamily={SERIF} fontSize={40} fontWeight={600}>
              next: muscle
            </text>
          </g>
        </g>
      </g>
      <Vignette />
      <Letterbox className="t-lb" />
    </g>
  )
}

export const ch4: Chapter = {
  id: 'thumb',
  title: 'The thumb, and the missing pinky',
  cues: CUES,
  Scene: Ch4Thumb,
  enter: { type: 'dissolve' },
  deeper: [ThumbReading],
}
