import gsap from 'gsap'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { camera } from '../../../cine/camera'
import { GRASPS, handSegments, useHandStore, type FingerName, type HandStore } from '../../../cine/hand3d'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { useDrag } from '../../../engine/svg'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Blueprint, Dust, Label, Pool, Vignette, fade, useAmbient } from '../shared/kit'
import { BIG, BIG_POSE, BIG_VIEW, motorSpots } from './Ch1Dof'
import { Hand3DX, projector } from './hand4'
import { Finger2D, Live, Mono, chain, chime, solveAdaptive, useVals, type AdaptiveFinger, type Obstacle, type Pt } from './parts'
import { UnderReading } from './readings'

export const CUES: Cue[] = [
  { id: 'cheat', say: 'Engineers have a way out: let one motor drive several joints. It’s called underactuation.' },
  { id: 'rigid', say: 'The simplest version is a fixed linkage: when one joint bends, the next bends with it, always in the same ratio. Your own fingertip joint works a bit like this.' },
  { id: 'adaptive', say: 'The clever version uses one tendon and some springs. In free air, the finger curls the same way every time. But when it touches something, the touching link stops, and the rest keep wrapping around.' },
  { id: 'wrap', say: 'Try it. Pull the single tendon and grab each object. You can’t steer the joints: only pull.', play: true },
  { id: 'tradeoff', say: 'That’s the trade. Underactuated hands are cheap, light and forgiving: they grab things even when the robot misjudges where they are. But they give up precise fingertip control.' },
  { id: 'real', say: 'Real hands mix both. A popular Chinese workhorse hand drives twelve joints with just six motors. Tesla’s latest patents describe one actuator per joint, pulled from the forearm.' },
]

const STATE = [
  'The x-ray robot hand from the last chapter, crammed with twenty glowing amber motors, deflates: the hand shrinks back to normal and most motors fade away, leaving six (one per finger and two for the thumb). Cyan drive lines run from each remaining motor through several joints of its finger. The idea named: underactuation, fewer motors than joints.',
  'Blueprint. A white robot finger, side-on, with an amber linear actuator in its first link and cyan linkage rods. The actuator pushes and the middle and end joints curl together in a fixed ratio; the fingertip traces one fixed cyan dotted path, always the same. The camera pans right to a human finger trying to bend only its tip joint: the middle joint is dragged along too. Your end finger joint is coupled to the middle one, like a fixed linkage.',
  'An adaptive finger: three white links standing up from a small base on a conveyor, one cyan tendon running along the inside of every joint, small springs on the back of each joint. Pulled in free air it curls the same way each time. Then a ball arrives: the base link touches it and stops, and the outer links keep curling and wrap around it (magenta contact dots). Then the same with a square block. No sensing or control needed: the shape adapts itself.',
  '',
  'The adaptive finger rests over the coin on the conveyor, the coin rocking under its fingertip. Two columns of text appear on the blueprint. Gains: fewer motors, cheap, robust, self-adapting. Loses: precise fingertips, in-hand moves, predictable shape. The point: underactuated hands are cheap and forgiving but give up precise fingertip control.',
  'Two robot hands side by side in x-ray. Left: six amber actuators packed in the palm with cyan linkage rods to the fingers, labelled "6 motors, 12 joints" (this is the Inspire RH56 style, a Chinese workhorse hand). Right: a long forearm full of slim amber actuators with cyan tendons running to the fingers, labelled "about one per joint, in the forearm", with a footnote: patent design; Tesla says it has since changed. Tesla Optimus V3 patents describe about 25 actuators per hand and forearm.',
]

/* ---------------- the adaptive finger rig ---------------- */
const BASE = { x: 600, y: 690 }
const TABLE = 720
const FING: AdaptiveFinger = { x: BASE.x, y: BASE.y, a0: -90, lens: [150, 115, 90], qmax: [80, 100, 90], w: 22, give: [1, 0.7, 0.5] }
const POST = { x0: 965, x1: 1000, y0: 660 }
const HANDLE = { x: 420, y0: 470, range: 250 }
const R = (x0: number, y0: number, x1: number, y1: number): Pt[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
]

type ObjId = 'none' | 'ball' | 'block' | 'mug' | 'wrench' | 'coin'
const OBJ_IDS: ObjId[] = ['none', 'ball', 'block', 'mug', 'wrench', 'coin']
const SEQ: ObjId[] = ['ball', 'mug', 'wrench', 'coin']
const NAMES: Record<ObjId, string> = { none: '', ball: 'a ball', block: 'a block', mug: 'a mug', wrench: 'a wrench handle', coin: 'a coin' }

function obstacleFor(o: ObjId, dx: number, coinOff: number): Obstacle | null {
  switch (o) {
    case 'ball':
      return { kind: 'circle', x: 740 + dx, y: 640, r: 80, id: 'obj' }
    case 'block':
      return { kind: 'poly', id: 'obj', pts: R(680 + dx, 580, 820 + dx, TABLE) }
    case 'mug':
      return { kind: 'poly', id: 'obj', pts: R(670 + dx, 580, 810 + dx, TABLE) }
    case 'wrench':
      return { kind: 'circle', x: 690 + dx, y: 590, r: 36, id: 'obj' }
    case 'coin':
      return { kind: 'poly', id: 'obj', pts: R(830 + dx + coinOff, TABLE - 9, 920 + dx + coinOff, TABLE) }
    default:
      return null
  }
}

/** Solve the finger for a pull, with the object (if it is in place) and, in the play, the thumb post. */
function solve(pull: number, o: ObjId, dx: number, post: boolean) {
  const base: Obstacle[] = [{ kind: 'floor', y: TABLE, id: 'table' }]
  if (post) base.push({ kind: 'poly', id: 'post', pts: R(POST.x0, POST.y0, POST.x1, TABLE) })
  if (o === 'wrench') base.push({ kind: 'poly', id: 'table', pts: R(668 + dx, 624, 712 + dx, TABLE) })
  // the coin gets shoved along once the fingertip is down on it
  const coinOff = o === 'coin' ? Math.max(0, Math.min(40, (pull - 0.5) * 160)) : 0
  const ob = Math.abs(dx) < 40 ? obstacleFor(o, dx, coinOff) : null
  const r = solveAdaptive(FING, pull, ob ? [...base, ob] : base)
  return { ...r, coinOff }
}

/** The tendon's path along the inside of the finger, from the pulley to the tip. */
function tendonPath(pts: Pt[]) {
  const inner = (a: Pt, b: Pt, k: number) => {
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1
    return { x: (-(b.y - a.y) / l) * k, y: ((b.x - a.x) / l) * k }
  }
  const out: Pt[] = [{ x: BASE.x + 16, y: BASE.y + 40 }]
  for (let i = 0; i < 3; i++) {
    const n = inner(pts[i], pts[i + 1], 12 - i * 2)
    out.push({ x: pts[i].x + n.x, y: pts[i].y + n.y })
    out.push({ x: pts[i + 1].x + n.x * 0.9 - (pts[i + 1].x - pts[i].x) * 0.12, y: pts[i + 1].y + n.y * 0.9 - (pts[i + 1].y - pts[i].y) * 0.12 })
  }
  return 'M' + out.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L')
}

/** A spring drawn on the back of a joint. */
function spring(p: Pt, a: Pt, w: number) {
  const ang = Math.atan2(p.y - a.y, p.x - a.x)
  const nx = Math.cos(ang - Math.PI / 2)
  const ny = Math.sin(ang - Math.PI / 2)
  const c = { x: p.x - nx * w * 1.15, y: p.y - ny * w * 1.15 }
  const ux = Math.cos(ang)
  const uy = Math.sin(ang)
  let d = `M${c.x - ux * 22} ${c.y - uy * 22}`
  for (let i = 1; i <= 6; i++) {
    const t = -22 + (44 * i) / 6
    const s = i % 2 ? 7 : -7
    d += ` L${c.x + ux * t - nx * s} ${c.y + uy * t - ny * s}`
  }
  return d
}

function ObjectArt({ o, dx, coinOff, rock = 0 }: { o: ObjId; dx: number; coinOff: number; rock?: number }) {
  const sh = <ellipse cx={740 + dx} cy={TABLE + 4} rx={90} ry={8} fill="#000" opacity={0.4} />
  if (o === 'ball')
    return (
      <g>
        {sh}
        <circle cx={740 + dx} cy={640} r={80} fill={C.key} />
        <circle cx={740 + dx} cy={640} r={80} fill="url(#cn-pool-dark)" opacity={0.5} />
        <path d={`M${680 + dx} 600 Q${740 + dx} 560 ${800 + dx} 600`} stroke={C.keyLight} strokeWidth={6} fill="none" opacity={0.6} />
        <circle cx={712 + dx} cy={608} r={16} fill={C.white} opacity={0.35} />
      </g>
    )
  if (o === 'block')
    return (
      <g>
        {sh}
        <rect x={680 + dx} y={580} width={140} height={140} rx={6} fill={C.ink4} stroke={C.mist} strokeWidth={3} />
        <rect x={694 + dx} y={594} width={50} height={20} rx={4} fill={C.mist} opacity={0.3} />
      </g>
    )
  if (o === 'mug')
    return (
      <g>
        {sh}
        <path d={`M${810 + dx} 610 q 52 4 50 50 q -2 40 -50 40`} stroke="#c9d3e3" strokeWidth={16} fill="none" />
        <rect x={670 + dx} y={580} width={140} height={140} rx={10} fill="#c9d3e3" />
        <rect x={670 + dx} y={580} width={140} height={14} rx={7} fill="#e8ecf3" />
        <rect x={684 + dx} y={604} width={18} height={100} rx={9} fill={C.white} opacity={0.4} />
      </g>
    )
  if (o === 'wrench')
    return (
      <g>
        <path d={`M${668 + dx} ${TABLE} L${668 + dx} 624 L${712 + dx} 624 L${712 + dx} ${TABLE} Z`} fill={C.ink4} stroke={C.slate} strokeWidth={2} />
        <circle cx={690 + dx} cy={590} r={36} fill="url(#cn-metal)" stroke={C.metalDark} strokeWidth={3} />
        <circle cx={690 + dx} cy={590} r={20} fill="none" stroke={C.metalDark} strokeWidth={2} opacity={0.6} />
        <text x={690 + dx} y={548} textAnchor="middle" fill={C.mist} fontFamily={MONO} fontSize={15} opacity={0.8}>
          handle, end-on
        </text>
      </g>
    )
  if (o === 'coin')
    return (
      <g transform={`rotate(${rock} ${875 + dx + coinOff} ${TABLE})`}>
        <rect x={830 + dx + coinOff} y={TABLE - 9} width={90} height={9} rx={4} fill={C.gold} />
        <rect x={834 + dx + coinOff} y={TABLE - 9} width={82} height={3} rx={1.5} fill={C.goldLight} />
      </g>
    )
  return null
}

/** The adaptive finger, its tendon and springs, the base, and the (optional) thumb post. */
function Rig({ pull, o, dx, post, lift = 0, held = false, rock = 0, showTendon = true }: { pull: number; o: ObjId; dx: number; post: boolean; lift?: number; held?: boolean; rock?: number; showTendon?: boolean }) {
  const r = solve(pull, o, dx, post)
  const pts = r.pts
  return (
    <g>
      {!held && <ObjectArt o={o} dx={dx} coinOff={r.coinOff} rock={rock} />}
      <g transform={`translate(0 ${lift})`}>
        {held && <ObjectArt o={o} dx={dx} coinOff={r.coinOff} />}
        {/* the cable housing from the base to the pull handle */}
        <path d={`M${BASE.x - 50} ${BASE.y + 36} C ${BASE.x - 140} ${BASE.y + 40}, ${HANDLE.x} ${BASE.y - 20}, ${HANDLE.x} ${HANDLE.y0 - 24}`} stroke={C.ink} strokeWidth={14} fill="none" strokeLinecap="round" />
        <path d={`M${BASE.x - 50} ${BASE.y + 36} C ${BASE.x - 140} ${BASE.y + 40}, ${HANDLE.x} ${BASE.y - 20}, ${HANDLE.x} ${HANDLE.y0 - 24}`} stroke={C.slate} strokeWidth={9} fill="none" strokeLinecap="round" />
        <path d={`M${BASE.x - 50} ${BASE.y + 36} C ${BASE.x - 140} ${BASE.y + 40}, ${HANDLE.x} ${BASE.y - 20}, ${HANDLE.x} ${HANDLE.y0 - 24}`} stroke={C.cyan} strokeWidth={2} fill="none" strokeDasharray="3 9" opacity={0.6 + pull * 0.4} />
        {/* base */}
        <rect x={BASE.x - 60} y={BASE.y - 6} width={120} height={70} rx={10} fill={C.carbon} stroke={C.slate} strokeWidth={2} />
        <rect x={BASE.x - 52} y={BASE.y + 6} width={104} height={8} rx={4} fill={C.shellDark} opacity={0.5} />
        {post && (
          <g>
            <rect x={POST.x0} y={POST.y0} width={POST.x1 - POST.x0} height={TABLE - POST.y0 + 30} rx={14} fill={C.shell} />
            <rect x={POST.x0} y={POST.y0} width={12} height={TABLE - POST.y0 + 30} rx={6} fill={C.shellDark} opacity={0.4} />
            <rect x={POST.x0 - 4} y={POST.y0 - 4} width={POST.x1 - POST.x0 + 8} height={16} rx={8} fill={C.rubber} />
          </g>
        )}
        {/* springs on the back of each joint */}
        {[0, 1, 2].map((i) => (
          <path key={i} d={spring(pts[i], pts[i + 1], FING.w * (1 - i * 0.1))} stroke={C.cyanLight} strokeWidth={2.5} fill="none" opacity={0.75} strokeLinejoin="round" />
        ))}
        <Finger2D x={FING.x} y={FING.y} a0={FING.a0} lens={FING.lens} q={r.q} look="robot" w={FING.w} />
        {showTendon && <path d={tendonPath(pts)} stroke={pull > 0.05 ? C.cyanLight : C.cyan} strokeWidth={3 + pull * 2} fill="none" strokeLinejoin="round" filter={pull > 0.3 ? 'url(#cn-bloom)' : undefined} />}
        {/* where links touch the object: touch is magenta */}
        {r.contact.map((c, i) =>
          c === 'obj' ? (
            <g key={i}>
              <circle cx={(pts[i].x + pts[i + 1].x) / 2} cy={(pts[i].y + pts[i + 1].y) / 2} r={18} fill={C.magenta} opacity={0.35} filter="url(#cn-bloom)" />
              <circle cx={(pts[i].x + pts[i + 1].x) / 2} cy={(pts[i].y + pts[i + 1].y) / 2} r={6} fill={C.magentaLight} />
            </g>
          ) : null,
        )}
      </g>
    </g>
  )
}

/* ---------------- the rigid linkage finger ---------------- */
const RF = { x: 380, y: 380, lens: [230, 150, 115], w: 30 }
const RATIO = 0.8
const rigidTip = (p: number) => chain(RF.x, RF.y, 0, RF.lens, [0, p, p * RATIO])[3]
const RIGID_PATH = Array.from({ length: 31 }, (_, i) => rigidTip(i * 3.4))
/** The human finger in the callback, off to the right. */
const HF = { x: 1580, y: 420, lens: [210, 135, 100], w: 36 }

/* ---------------- the motors that stay ---------------- */
const KEEP = [1, 5, 9, 13, 16, 17]
function fingerLines(): Record<FingerName, Pt[]> {
  const { segs } = handSegments(BIG_POSE)
  const proj = projector(BIG_VIEW, BIG.x, BIG.y)
  const out = {} as Record<FingerName, Pt[]>
  for (const sg of segs) {
    const f = sg.finger as FingerName
    out[f] = out[f] ?? []
    if (sg.k === 0) out[f].push(proj(sg.a))
    out[f].push(proj(sg.b))
  }
  return out
}

/* ---------------- real hands ---------------- */
const LEFT = { x: 480, y: 700 }
const RIGHT = { x: 1150, y: 520 }
const VIEW_L = { yaw: 12, pitch: 4, roll: 0, s: 2.4 }
const VIEW_R = { yaw: -12, pitch: 4, roll: 0, s: 1.6 }

export function Ch2Under({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints, memory }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const world = useRef<SVGGElement>(null)
  const bigHand = useHandStore({ pose: BIG_POSE, view: BIG_VIEW, xray: 1 })
  const left = useHandStore({ pose: GRASPS.relaxed, view: VIEW_L, xray: 0.75 })
  const right = useHandStore({ pose: GRASPS.relaxed, view: VIEW_R, xray: 0.75 })
  const spots = useMemo(motorSpots, [])
  const lines = useMemo(fingerLines, [])
  /** Timeline-driven values: the rigid finger, the human finger, the adaptive demo. */
  const v = useVals({ rp: 0, hp: 0, hd: 0, pull: 0, obj: 0, dx: 0, rock: 0 })
  /** The play's values. */
  const w = useVals({ pull: 0, dx: 500, lift: 0 })

  const [idx, setIdx] = useState(0)
  const [busy, setBusy] = useState(false)
  const [held, setHeld] = useState(false)
  const [fails, setFails] = useState(0)
  const [note, setNote] = useState<string | null>(null)
  const [got, setGot] = useState<ObjId[]>([])
  const [discovered, setDiscovered] = useState(false)
  const inPlay = cueIndex === 3
  const tweens = useRef<gsap.core.Animation[]>([])
  const coinTimer = useRef<number | null>(null)

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const cam = camera(world.current, { x: 800, y: 470, zoom: 1.12 })

      /* b0: the crowded hand deflates; six motors stay, each driving several joints. */
      tl.addLabel('b0', 0)
      tl.set('.u-motor', { scale: 1.75 }, 0)
      fade(tl, '.u-motor-hot', 0, 0.2, 1.2, 0.6)
      fade(tl, '.u-heat', 0, 0.2, 1.4, 1)
      tl.fromTo('.u-bloat', { scale: 1.1 }, { scale: 1, duration: 1.4, ease: 'power2.inOut', svgOrigin: `${BIG.x} ${BIG.y - 200}`, immediateRender: false }, 0.2)
      tl.fromTo('.u-motor', { scale: 1.75 }, { scale: 1, duration: 1.2, ease: 'power2.inOut', immediateRender: false }, 0.2)
      tl.fromTo('.u-motor-go', { opacity: 1 }, { opacity: 0, duration: 0.5, stagger: 0.05, immediateRender: false }, 1.4)
      tl.fromTo('.u-motor-keep', { scale: 1 }, { scale: 1.5, duration: 0.5, ease: 'back.out(3)', immediateRender: false }, 2.4)
      tl.fromTo('.u-drive', { strokeDashoffset: 900, opacity: 0 }, { strokeDashoffset: 0, opacity: 1, duration: 1.4, stagger: 0.12, ease: 'power2.inOut', immediateRender: false }, 2.6)
      cam.to(tl, { x: 800, y: 450, zoom: 1 }, 0, 3)
      fade(tl, '.u-lab-under', 1, 3.6, 0.6)
      cam.to(tl, { x: 820, y: 430, zoom: 1.06 }, 3, 3.6, 'sine.inOut')

      /* b1: the rigid linkage, then a human finger that can't bend only its tip. */
      const b1 = 6.6
      tl.addLabel('b1', b1)
      fade(tl, '.u-crowd', 0, b1, 0.6, 1)
      fade(tl, '.u-rigid', 1, b1 + 0.3, 0.6)
      cam.to(tl, { x: 760, y: 450, zoom: 1 }, b1, 0.8)
      v.to(tl, { rp: 90 }, b1 + 1.0, 1.6, 'power2.inOut')
      tl.fromTo('.u-path', { strokeDashoffset: 1200, opacity: 0 }, { strokeDashoffset: 0, opacity: 1, duration: 1.6, ease: 'power2.inOut', immediateRender: false }, b1 + 1.0)
      fade(tl, '.u-lab-rigid', 1, b1 + 1.6, 0.5)
      v.to(tl, { rp: 10 }, b1 + 2.8, 1.2, 'power2.inOut')
      v.to(tl, { rp: 80 }, b1 + 4.0, 1.2, 'power2.inOut')
      fade(tl, '.u-lab-path', 1, b1 + 4.4, 0.5)
      // pan across to a human finger
      fade(tl, '.u-lab-rigid, .u-lab-path', 0, b1 + 6.2, 0.4, 1)
      cam.to(tl, { x: 1640, y: 470, zoom: 1 }, b1 + 6.4, 1.4, 'power2.inOut')
      fade(tl, '.u-human', 1, b1 + 6.4, 0.6)
      v.to(tl, { hd: 50, hp: 46 }, b1 + 8.2, 1.2, 'power2.inOut')
      fade(tl, '.u-lab-human', 1, b1 + 8.8, 0.5)
      v.to(tl, { hd: 8, hp: 6 }, b1 + 10.4, 0.8)
      v.to(tl, { hd: 50, hp: 46 }, b1 + 11.2, 0.8)

      /* b2: the adaptive finger: free air, then a ball, then a block. */
      const b2 = b1 + 12.6
      tl.addLabel('b2', b2)
      cam.to(tl, { x: 760, y: 520, zoom: 1.05 }, b2, 0.001)
      fade(tl, '.u-rigid, .u-human', 0, b2, 0.3, 1)
      fade(tl, '.u-adapt', 1, b2, 0.6)
      v.to(tl, { pull: 0, obj: 0, dx: 0 }, b2, 0.01)
      v.to(tl, { pull: 0.62 }, b2 + 0.8, 1.6, 'sine.inOut')
      fade(tl, '.u-freepath', 1, b2 + 1.0, 1.2)
      fade(tl, '.u-lab-free', 1, b2 + 1.6, 0.5)
      v.to(tl, { pull: 0 }, b2 + 2.8, 1.0, 'sine.inOut')
      v.to(tl, { pull: 0.62 }, b2 + 3.9, 1.3, 'sine.inOut')
      v.to(tl, { pull: 0 }, b2 + 5.3, 0.8, 'sine.inOut')
      fade(tl, '.u-lab-free', 0, b2 + 5.3, 0.4, 1)
      // a ball slides in on the belt
      v.to(tl, { obj: 1, dx: 500 }, b2 + 6.1, 0.01)
      v.to(tl, { dx: 0 }, b2 + 6.15, 1.1, 'power2.out')
      cam.to(tl, { x: 740, y: 560, zoom: 1.2 }, b2 + 6.2, 2.4)
      v.to(tl, { pull: 1 }, b2 + 7.4, 2.4, 'sine.inOut')
      fade(tl, '.u-lab-stop', 1, b2 + 8.0, 0.4)
      fade(tl, '.u-lab-wrap', 1, b2 + 9.0, 0.4)
      v.to(tl, { pull: 0 }, b2 + 10.4, 0.7)
      fade(tl, '.u-lab-stop, .u-lab-wrap', 0, b2 + 10.4, 0.3, 1)
      v.to(tl, { dx: -600 }, b2 + 11.0, 0.8, 'power2.in')
      v.to(tl, { obj: 2, dx: 500 }, b2 + 11.8, 0.01)
      v.to(tl, { dx: 0 }, b2 + 11.85, 1.0, 'power2.out')
      v.to(tl, { pull: 1 }, b2 + 12.9, 1.8, 'sine.inOut')
      cam.to(tl, { x: 760, y: 520, zoom: 1.08 }, b2 + 12.6, 2)

      /* b3: the play (the scene takes over the rig). */
      const b3 = b2 + 15.2
      tl.addLabel('b3', b3)
      v.to(tl, { pull: 0 }, b3, 0.5)
      cam.to(tl, { x: 760, y: 500, zoom: 1.05 }, b3, 0.8)
      fade(tl, '.u-adapt', 0, b3, 0.4, 1)
      fade(tl, '.u-play', 1, b3 + 0.2, 0.5)

      /* b4: the trade. */
      const b4 = b3 + 1
      tl.addLabel('b4', b4)
      fade(tl, '.u-play', 0, b4, 0.4, 1)
      fade(tl, '.u-adapt', 1, b4, 0.4)
      v.to(tl, { obj: 5, dx: 0, pull: 0.75 }, b4, 0.01)
      cam.to(tl, { x: 800, y: 470, zoom: 0.95 }, b4, 1.4)
      fade(tl, '.u-gains', 1, b4 + 1.2, 0.6)
      tl.fromTo('.u-gain', { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.5, stagger: 0.45, immediateRender: false }, b4 + 1.6)
      fade(tl, '.u-loses', 1, b4 + 6.0, 0.6)
      tl.fromTo('.u-lose', { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.5, stagger: 0.45, immediateRender: false }, b4 + 6.4)
      for (let i = 0; i < 5; i++) v.to(tl, { rock: i % 2 ? -3 : 3 }, b4 + 1 + i * 1.8, 1.8, 'sine.inOut')
      v.to(tl, { pull: 0.95 }, b4 + 4, 3, 'sine.inOut')
      cam.to(tl, { x: 800, y: 470, zoom: 1.0 }, b4 + 1.4, 9.4, 'sine.inOut')

      /* b5: real hands. */
      const b5 = b4 + 11.6
      tl.addLabel('b5', b5)
      fade(tl, '.u-adapt, .u-gains, .u-loses', 0, b5, 0.5, 1)
      fade(tl, '.u-real', 1, b5 + 0.3, 0.8)
      cam.to(tl, { x: 800, y: 480, zoom: 0.9 }, b5, 0.01)
      cam.to(tl, { x: 800, y: 460, zoom: 1.0 }, b5 + 0.1, 11, 'sine.inOut')
      left.to(tl, { pose: GRASPS.power }, b5 + 1.2, 1.2)
      tl.fromTo('.u-inspire', { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.4, stagger: 0.12, ease: 'back.out(2)', immediateRender: false }, b5 + 1.2)
      fade(tl, '.u-rod', 1, b5 + 2.0, 0.8)
      fade(tl, '.u-lab-l', 1, b5 + 3.2, 0.6)
      left.to(tl, { pose: GRASPS.relaxed }, b5 + 4.2, 1.2)
      tl.fromTo('.u-slim', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.3, stagger: 0.05, immediateRender: false }, b5 + 6.2)
      right.to(tl, { pose: GRASPS.pinch, pull: { thumb: 1, index: 1 } }, b5 + 7.2, 1.2)
      fade(tl, '.u-lab-r', 1, b5 + 7.6, 0.6)
      fade(tl, '.u-foot', 1, b5 + 9.0, 0.6)
      left.to(tl, { pose: GRASPS.power }, b5 + 8.4, 1.4)
      tl.to({}, { duration: 0.4 }, b5 + 11.4)
    },
    [bigHand, left, right, v],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.fromTo('.u-belt', { x: 0 }, { x: -40, duration: 1.2, repeat: -1, ease: 'none' })
    gsap.to('.u-drive-pulse', { opacity: 0.45, duration: 0.8, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.u-slimglow', { opacity: 0.5, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  /* ---------------- the play ---------------- */
  const cur = SEQ[Math.min(idx, SEQ.length - 1)]
  const kill = () => {
    tweens.current.forEach((t) => t.kill())
    tweens.current = []
  }
  const anim = (vars: gsap.TweenVars & { pull?: number; dx?: number; lift?: number }) => {
    const t = gsap.to(w.state, { ...vars, onUpdate: w.notify })
    tweens.current.push(t)
    return t
  }

  // a new object rolls in on the belt
  useEffect(() => {
    if (!inPlay || discovered) return
    w.set({ dx: 500, pull: 0, lift: 0 })
    setHeld(false)
    anim({ dx: 0, duration: 1.1, ease: 'power2.out', onComplete: () => setBusy(false) })
    setBusy(true)
    if (cur === 'coin') {
      coinTimer.current = window.setTimeout(() => setDiscovered(true), 10000 + 1100)
    }
    return () => {
      if (coinTimer.current) window.clearTimeout(coinTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, inPlay])

  useEffect(() => () => kill(), [])

  useEffect(() => {
    if (!discovered || !inPlay) return
    memory.jointsCoin = true
    emit({ type: 'attempt', correct: true, detail: 'found that the single-tendon finger cannot pinch a flat coin' })
    setNote('it can’t pinch a coin: no way to aim the fingertip')
    void say('It wraps anything round with one pull. But it can’t pinch a coin, because you can’t tell the fingertip where to go.').then(() => onPlayDone())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discovered])

  const grab = () => {
    const r = solve(w.state.pull, cur, w.state.dx, true)
    const n = r.contact.filter((c) => c === 'obj').length
    setBusy(true)
    if (cur !== 'coin' && n >= 2) {
      chime()
      setHeld(true)
      setNote(`${NAMES[cur]}: wrapped, ${n} contacts`)
      setGot((g) => [...g, cur])
      emit({ type: 'progress', detail: `grabbed ${NAMES[cur]} with ${n} contacts` })
      anim({ lift: -120, duration: 0.6, ease: 'power2.out' })
      anim({ dx: -700, duration: 0.8, delay: 1.2, ease: 'power2.in' })
      anim({
        lift: 0,
        pull: 0,
        duration: 0.6,
        delay: 2.0,
        onComplete: () => {
          setHeld(false)
          setNote(null)
          setIdx((i) => i + 1)
        },
      })
      return
    }
    // the coin: the finger lies over it and lifts away with nothing
    const nf = fails + 1
    setFails(nf)
    setNote('nothing to pinch: the fingertip just slides over it')
    emit({ type: 'attempt', correct: false, detail: `tried to pick up the coin (attempt ${nf}); the finger wraps over it and shoves it` })
    anim({ lift: -120, duration: 0.6, ease: 'power2.out' })
    anim({ lift: 0, pull: 0, duration: 0.6, delay: 1.3, onComplete: () => (nf >= 2 ? setDiscovered(true) : setBusy(false)) })
  }

  const setPull = (p: Pt) => {
    if (!inPlay || busy || discovered) return
    const pull = Math.max(0, Math.min(1, (p.y - HANDLE.y0) / HANDLE.range))
    w.set({ pull })
    if (pull >= 0.92) grab()
  }
  const release = () => {
    if (!inPlay || busy || discovered) return
    anim({ pull: 0, duration: 0.5, ease: 'power2.out' })
  }
  const drag = useDrag({ onStart: setPull, onMove: setPull, onEnd: release })

  /* ---------------- Pip ---------------- */
  useEffect(() => {
    if (inPlay) {
      reportState(
        'The play: one adaptive robot finger (three links, one cyan tendon, springs) stands on a small base beside a conveyor, opposite a short fixed thumb post. On the left is a T-handle on the tendon; dragging it down pulls the tendon and the finger curls by itself (links curl until each touches something, then the rest wrap). Pulling all the way down tries to lift the object. ' +
          `Objects in order: ball, mug, wrench handle (seen end-on on a stand), coin. Now on the belt: ${NAMES[cur]}. Grabbed so far: ${got.length ? got.join(', ') : 'nothing'}. ` +
          (cur === 'coin' ? `Coin attempts: ${fails}. ` : '') +
          (note ? `On screen: "${note}". ` : '') +
          'Correct behaviour: ball, mug and wrench are wrapped with two or more contacts and lift away; the flat coin cannot be picked up, because the finger cannot place its fingertip precisely: it lies over the coin and shoves it along. The coin is meant to fail; that is the discovery. Likely mix-up: thinking you are doing it wrong on the coin, or looking for a way to steer individual joints (there is none).',
      )
      setHints(['Just pull the tendon. The springs decide the rest.', 'For the coin, watch what the fingertip does when the first link hits the table.'])
    } else {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
    }
  }, [inPlay, cueIndex, cur, got, fails, note, reportState, setHints])

  /* ---------------- the picture ---------------- */
  const keep = new Set(KEEP)
  const drives: { f: FingerName; from: Pt }[] = [
    { f: 'index', from: spots[1] },
    { f: 'middle', from: spots[5] },
    { f: 'ring', from: spots[9] },
    { f: 'little', from: spots[13] },
    { f: 'thumb', from: spots[16] },
    { f: 'thumb', from: spots[17] },
  ]

  return (
    <g ref={root}>
      <g ref={world}>
        <g data-depth="0.4">
          <Blueprint />
          <Dust x={-300} y={-200} w={3000} h={1300} count={40} seed={22} color={C.cyan} size={0.6} />
        </g>
        <g data-depth="1">
          {/* ---------- the crowded hand, deflating ---------- */}
          <g className="u-crowd" pointerEvents="none">
            <g className="u-bloat">
              <Pool x={BIG.x} y={BIG.y - 260} r={520} color="rim" opacity={0.35} />
              <Hand3DX store={bigHand} x={BIG.x} y={BIG.y} look="robot" arm={260} light={[0.6, -0.7]} />
              <g className="u-heat">
                <Pool x={BIG.x} y={BIG.y - 250} r={380} color="danger" opacity={0.6} />
              </g>
              {drives.map((d, i) => {
                const ln = d.f === 'thumb' ? lines.thumb.slice(i === 4 ? 0 : 1) : lines[d.f]
                const pts = [d.from, ...ln]
                return <path key={i} className="u-drive" d={'M' + pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L')} stroke={C.cyan} strokeWidth={5} fill="none" strokeDasharray="900" strokeDashoffset="900" opacity={0} strokeLinejoin="round" filter="url(#cn-bloom)" />
              })}
              {spots.map((p, i) => (
                <g key={i} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.a.toFixed(1)})`}>
                  <g className={keep.has(i) ? 'u-motor-keep' : 'u-motor-go'}>
                    <g className="u-motor">
                      <rect x={-20} y={-11} width={40} height={22} rx={11} fill={C.amberDark} stroke={C.amber} strokeWidth={2.5} />
                      <rect className={keep.has(i) ? 'u-drive-pulse' : undefined} x={-12} y={-5} width={24} height={10} rx={5} fill={C.amberLight} />
                      <rect className="u-motor-hot" x={-20} y={-11} width={40} height={22} rx={11} fill={C.danger} opacity={0} />
                    </g>
                  </g>
                </g>
              ))}
            </g>
            <Label className="u-lab-under" x={spots[13].x - 20} y={spots[13].y + 10} tx={BIG.x - 250} ty={BIG.y - 250} text="6 motors, 16 joints" sub="underactuation" color={C.amber} size={34} />
          </g>

          {/* ---------- the rigid linkage ---------- */}
          <g className="u-rigid" opacity={0} pointerEvents="none">
            <Pool x={RF.x + 260} y={RF.y + 60} r={520} color="rim" opacity={0.3} />
            <path className="u-path" d={'M' + RIGID_PATH.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L')} stroke={C.cyan} strokeWidth={4} fill="none" strokeDasharray="2 12" strokeLinecap="round" opacity={0} />
            <rect x={RF.x - 150} y={RF.y - 48} width={150} height={96} rx={14} fill={C.carbon} stroke={C.slate} strokeWidth={2} />
            <Live store={v}>
              {(s) => {
                const q = [0, s.rp, s.rp * RATIO]
                const pts = chain(RF.x, RF.y, 0, RF.lens, q)
                const along = (i: number, t: number, off: number) => {
                  const a = pts[i]
                  const b = pts[i + 1]
                  const l = Math.hypot(b.x - a.x, b.y - a.y) || 1
                  return { x: a.x + (b.x - a.x) * t - ((b.y - a.y) / l) * -off, y: a.y + (b.y - a.y) * t + ((b.x - a.x) / l) * off }
                }
                const actA = along(0, 0.12, 0)
                const actB = along(0, 0.55, 0)
                const piston = along(0, 0.55 + (s.rp / 90) * 0.18, 0)
                const crank = along(1, 0.08, 20)
                const c1 = along(0, 0.86, 22)
                const c2 = along(2, 0.12, 18)
                return (
                  <g>
                    <Finger2D x={RF.x} y={RF.y} lens={RF.lens} q={q} look="robot" w={RF.w} />
                    {/* the actuator in the first link */}
                    <path d={`M${actA.x} ${actA.y} L${actB.x} ${actB.y}`} stroke={C.amberDark} strokeWidth={26} strokeLinecap="round" />
                    <path d={`M${actA.x} ${actA.y} L${actB.x} ${actB.y}`} stroke={C.amber} strokeWidth={14} strokeLinecap="round" />
                    <path d={`M${actB.x} ${actB.y} L${piston.x} ${piston.y} L${crank.x} ${crank.y}`} stroke={C.cyan} strokeWidth={7} strokeLinecap="round" fill="none" />
                    {/* the coupling rod: it ties the end joint to the middle one */}
                    <path d={`M${c1.x} ${c1.y} L${c2.x} ${c2.y}`} stroke={C.cyan} strokeWidth={7} strokeLinecap="round" />
                    {[c1, c2, crank].map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r={6} fill={C.ink} stroke={C.cyanLight} strokeWidth={2.5} />
                    ))}
                    <circle cx={pts[3].x} cy={pts[3].y} r={10} fill={C.cyan} filter="url(#cn-bloom)" />
                  </g>
                )
              }}
            </Live>
            <Label className="u-lab-rigid" x={RF.x + 130} y={RF.y - 2} tx={RF.x + 40} ty={RF.y - 170} text="one actuator pushes" sub="two joints bend in a fixed ratio" color={C.amber} />
            <Label className="u-lab-path" x={rigidTip(60).x} y={rigidTip(60).y} tx={rigidTip(60).x + 160} ty={rigidTip(60).y + 120} text="one fixed path, every time" color={C.cyan} />
          </g>
          <g className="u-human" opacity={0} pointerEvents="none">
            <Pool x={HF.x + 240} y={HF.y + 40} r={460} color="key" opacity={0.55} />
            <rect x={HF.x - 220} y={HF.y - 58} width={230} height={116} rx={50} fill={C.skinB} />
            <rect x={HF.x - 220} y={HF.y - 58} width={230} height={40} rx={20} fill={C.skinA} opacity={0.3} />
            <Finger2D x={HF.x} y={HF.y} lens={HF.lens} q={[0, 0, 50]} look="ghost" w={HF.w} color={C.mist} />
            <Live store={v}>{(s) => <Finger2D x={HF.x} y={HF.y} lens={HF.lens} q={[0, s.hp, s.hd]} look="human" w={HF.w} />}</Live>
            <Label className="u-lab-human" x={HF.x + 250} y={HF.y + 60} tx={HF.x + 120} ty={HF.y + 260} text="bend only the tip? the middle joint comes too" color={C.keyLight} />
            <Mono x={HF.x + 330} y={HF.y - 60} color={C.mist} opacity={0.8}>
              your finger
            </Mono>
          </g>

          {/* ---------- the conveyor and the adaptive finger ---------- */}
          <g className="u-belt-all" pointerEvents="none" opacity={cueIndex >= 2 && cueIndex <= 4 ? 1 : 0}>
            <rect x={300} y={TABLE} width={1100} height={34} fill={C.ink3} />
            <g clipPath="url(#u-beltclip)">
              <g className="u-belt">
                {Array.from({ length: 32 }, (_, i) => (
                  <rect key={i} x={300 + i * 40} y={TABLE + 2} width={20} height={4} fill={C.slate} />
                ))}
              </g>
            </g>
            <clipPath id="u-beltclip">
              <rect x={300} y={TABLE} width={1100} height={34} />
            </clipPath>
            {[340, 620, 900, 1180, 1360].map((x) => (
              <circle key={x} cx={x} cy={TABLE + 17} r={12} fill={C.ink2} stroke={C.slate} strokeWidth={2} />
            ))}
          </g>
          <g className="u-adapt" opacity={0} pointerEvents="none">
            <path className="u-freepath" d={'M' + Array.from({ length: 21 }, (_, i) => solve((i / 20) * 0.62, 'none', 0, false).pts[3]).map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L')} stroke={C.cyan} strokeWidth={4} strokeDasharray="2 12" strokeLinecap="round" fill="none" opacity={0} />
            <Live store={v}>{(s) => <Rig pull={s.pull} o={OBJ_IDS[Math.round(s.obj)]} dx={s.dx} post={false} rock={s.rock} />}</Live>
            <Label className="u-lab-free" x={812} y={470} tx={940} ty={400} text="free air: the same curl every time" color={C.cyan} />
            <Label className="u-lab-stop" x={634} y={612} tx={430} ty={470} text="touches: this link stops" color={C.magenta} />
            <Label className="u-lab-wrap" x={820} y={560} tx={1000} ty={470} text="the rest keep wrapping" color={C.cyan} />
          </g>

          {/* ---------- the play ---------- */}
          <g className="u-play" opacity={0}>
            {inPlay && (
              <g>
                <Live store={w}>
                  {(s) => (
                    <g>
                      <Rig pull={s.pull} o={cur} dx={s.dx} post lift={s.lift} held={held} />
                      {/* the tendon handle */}
                      <g data-tutor="tendon-handle" {...(busy || discovered ? {} : drag)}>
                        <rect x={HANDLE.x - 50} y={HANDLE.y0 - 30} width={100} height={HANDLE.range + 60} fill="transparent" />
                        <rect x={HANDLE.x - 4} y={HANDLE.y0} width={8} height={HANDLE.range} rx={4} fill={C.ink3} />
                        <path d={`M${HANDLE.x} ${HANDLE.y0 - 24} L${HANDLE.x} ${HANDLE.y0 + s.pull * HANDLE.range}`} stroke={C.cyanLight} strokeWidth={4 + s.pull * 2} />
                        <g transform={`translate(${HANDLE.x} ${HANDLE.y0 + s.pull * HANDLE.range})`}>
                          <rect x={-44} y={-12} width={88} height={30} rx={15} fill={C.ink1} stroke={C.cyan} strokeWidth={4} className={busy ? undefined : 'hd-pulse'} />
                          <rect x={-30} y={-3} width={60} height={10} rx={5} fill={C.cyan} />
                        </g>
                        <text x={HANDLE.x} y={HANDLE.y0 + HANDLE.range + 66} textAnchor="middle" fill={C.cyanLight} fontFamily={SANS} fontSize={22}>
                          pull ↓
                        </text>
                      </g>
                    </g>
                  )}
                </Live>
                <text x={300} y={170} fill={C.paper} fontFamily={SERIF} fontSize={40} fontWeight={600}>
                  One pull. Grab {NAMES[cur]}.
                </text>
                <g transform="translate(300 210)">
                  {SEQ.map((o, i) => (
                    <g key={o} transform={`translate(${i * 130} 0)`}>
                      <circle r={13} fill={got.includes(o) ? C.lime : o === 'coin' && discovered ? C.danger : 'none'} stroke={i === idx ? C.paper : C.mist} strokeWidth={2.5} />
                      <text x={22} y={7} fill={i === idx ? C.paper : C.mist} fontFamily={MONO} fontSize={18}>
                        {o}
                      </text>
                    </g>
                  ))}
                </g>
                {note && (
                  <text x={1070} y={420} textAnchor="middle" fill={cur === 'coin' ? C.danger : C.magentaLight} fontFamily={SANS} fontSize={28} fontWeight={500} style={{ paintOrder: 'stroke' }} stroke={C.ink} strokeWidth={6}>
                    {note}
                  </text>
                )}
              </g>
            )}
          </g>

          {/* ---------- the trade ---------- */}
          <g className="u-gains" opacity={0} pointerEvents="none">
            <text x={130} y={250} fill={C.lime} fontFamily={SERIF} fontSize={46} fontWeight={600}>
              gains
            </text>
            {['fewer motors', 'cheap and light', 'robust', 'adapts to any shape'].map((t, i) => (
              <text key={t} className="u-gain" x={130} y={320 + i * 54} fill={C.paper} fontFamily={SANS} fontSize={32} opacity={0}>
                + {t}
              </text>
            ))}
          </g>
          <g className="u-loses" opacity={0} pointerEvents="none">
            <text x={1100} y={250} fill={C.danger} fontFamily={SERIF} fontSize={46} fontWeight={600}>
              loses
            </text>
            {['precise fingertips', 'in-hand moves', 'predictable shape'].map((t, i) => (
              <text key={t} className="u-lose" x={1100} y={320 + i * 54} fill={C.paper} fontFamily={SANS} fontSize={32} opacity={0}>
                − {t}
              </text>
            ))}
          </g>

          {/* ---------- real hands ---------- */}
          <g className="u-real" opacity={0} pointerEvents="none">
            <Pool x={LEFT.x} y={LEFT.y - 200} r={420} color="rim" opacity={0.4} />
            <Pool x={RIGHT.x} y={RIGHT.y - 60} r={460} color="rim" opacity={0.35} />
            <Hand3DX store={left} x={LEFT.x} y={LEFT.y} look="robot" arm={0} light={[0.6, -0.7]} />
            <RealOverlay store={left} />
            <g>
              <Hand3DX store={right} x={RIGHT.x} y={RIGHT.y} look="robot" arm={340} tendons light={[-0.6, -0.7]} />
              <Forearm />
            </g>
            <Label className="u-lab-l" x={LEFT.x} y={LEFT.y - 100} tx={LEFT.x} ty={LEFT.y + 90} text="6 motors, 12 joints" sub="motors in the palm, linkages to the fingers" color={C.amber} anchor="middle" size={32} />
            <Label className="u-lab-r" x={RIGHT.x - 40} y={RIGHT.y + 240} tx={RIGHT.x - 150} ty={RIGHT.y + 240} text="≈ one per joint" sub="in the forearm, pulling tendons" color={C.amber} size={32} />
            <g className="u-foot" opacity={0}>
              <text x={RIGHT.x - 150} y={RIGHT.y + 330} textAnchor="end" fill={C.mist} fontFamily={MONO} fontSize={18}>
                patent design; Tesla says it has since changed
              </text>
            </g>
          </g>
        </g>
      </g>
      <Vignette />
    </g>
  )
}

/** Six actuators in the palm with rods to the fingers (projected onto the left hand). */
function RealOverlay({ store }: { store: HandStore }) {
  const [, force] = useReducer((n: number) => n + 1, 0)
  useEffect(() => store.subscribe(force), [store])
        const proj = projector(store.state.view, LEFT.x, LEFT.y)
        const { segs, H } = handSegments(store.state.pose)
        const rot = (v: [number, number, number]) => {
          const m = H
          return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]] as [number, number, number]
        }
        const motors: [number, number, number][] = [
          [26, 40, 2],
          [8, 46, 2],
          [-10, 44, 2],
          [-27, 38, 2],
          [24, 14, 4],
          [12, 10, 4],
        ]
        const targets: FingerName[] = ['index', 'middle', 'ring', 'little', 'thumb', 'thumb']
        return (
          <g>
            {motors.map((m, i) => {
              const p = proj(rot(m))
              const seg = segs.find((s) => s.finger === targets[i] && s.k === (i === 5 ? 1 : 0))
              const t = seg ? proj(seg.b) : p
              return (
                <g key={i}>
                  <path className="u-rod" d={`M${p.x} ${p.y} L${t.x} ${t.y}`} stroke={C.cyan} strokeWidth={4} opacity={0} strokeLinecap="round" />
                  <g transform={`translate(${p.x} ${p.y})`}>
                    <g className="u-inspire" opacity={0}>
                      <rect x={-9} y={-24} width={18} height={48} rx={9} fill={C.amberDark} stroke={C.amber} strokeWidth={2.5} />
                      <rect x={-4} y={-14} width={8} height={28} rx={4} fill={C.amberLight} opacity={0.85} />
                    </g>
                  </g>
                </g>
              )
            })}
          </g>
        )
}

/** A bundle of slim actuators packed along the right hand's forearm. */
function Forearm() {
  const n = 22
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const col = i % 11
        const row = Math.floor(i / 11)
        const x = RIGHT.x - 44 + col * 8.6 + (row ? 4 : 0)
        const y = RIGHT.y + 120 + row * 130
        return (
          <g key={i} transform={`translate(${x} ${y})`}>
            <g className="u-slim" opacity={0}>
              <rect x={-3} y={0} width={6} height={110} rx={3} fill={C.amberDark} stroke={C.amber} strokeWidth={1.2} />
              <rect className="u-slimglow" x={-1.5} y={6} width={3} height={60} rx={1.5} fill={C.amberLight} opacity={0.9} />
            </g>
          </g>
        )
      })}
    </g>
  )
}

export const ch2: Chapter = {
  id: 'underactuation',
  title: 'Fewer motors than joints',
  cues: CUES,
  Scene: Ch2Under,
  enter: { type: 'dissolve' },
  deeper: [UnderReading],
}
