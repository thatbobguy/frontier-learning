import gsap from 'gsap'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { camera } from '../../../cine/camera'
import { GRASPS, Hand3D, makeHandStore, useHandStore, type FingerName, type HandPose, type HandView } from '../../../cine/hand3d'
import { C, MONO, SANS } from '../../../cine/palette'
import { POSES, Robot, rig, type Pose } from '../../../cine/people'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Beam, Dust, Label, Letterbox, Pool, Readout, Vignette, fade, letterbox, useAmbient } from '../shared/kit'
import { AtTips, dragIn, resetHand, type Pt } from './fx'
import { GrippersReading, IndustryReading } from './readings'

export const CUES: Cue[] = [
  { id: 'room', say: 'Look around any room, and you’ll see a world designed for human hands.' },
  { id: 'gripper', say: 'Most factory robots don’t use hands at all. They use a gripper: two fingers that open and close. Cheap, strong, and very reliable.' },
  { id: 'sort', say: 'So when do you really need a hand? Drag each task to the gripper or the hand, depending on what it truly needs.', play: true },
  { id: 'pattern', say: 'A gripper can hold things. A hand can hold something and work it at the same time: twist it, squeeze part of it, shift it in the fingers.' },
  { id: 'race', say: 'That’s why companies racing to build humanoid robots are pouring money into hands. Tesla’s leaders have said the hand is the hardest part of their whole robot.' },
  { id: 'stakes', say: 'A humanoid without good hands is just a very expensive gripper on legs.' },
]

const STATE = [
  'A slow pan across a kitchen at night: rain on the window, the fridge door ajar spilling cool light. As the camera passes, everyday objects light up with a thin cyan outline and a ghostly hand showing how each is used: turning a door handle, flicking a light switch, lifting and pouring a kettle, threading fingers through scissors, squeezing a spray bottle’s trigger, pulling a drawer, twisting keys, opening the fridge. The point: the world is designed for human hands.',
  'A factory line: an industrial robot arm with a two-finger parallel-jaw gripper picks boxes off a conveyor and drops them on another, in a fast steady rhythm, with a counter of picks. The point: most factory robots use simple grippers, which are cheap, strong and reliable.',
  '',
  'Three close-up vignettes of a white robot hand: holding a spray bottle while the index finger pulls the trigger ("hold + operate"); rolling a pen from the fingertips into the palm ("in-hand reorientation"); holding a jar while the thumb flicks open the lid ("tool use"). The point: a hand can hold something and work it at the same time.',
  'A dark showroom full of rows of humanoid robots standing in shadow. The camera pushes in on one robot in a spotlight: its forearm ends in a stump with wires dangling, no hand. Label: "Oct 2025: Optimus bodies waiting for hands". Tesla paused production with a stockpile of bodies waiting for hands; its leaders have called the hand the hardest part of the robot.',
  'The handless robot tips its head down to look at its stump. The picture cuts to black. The point: a humanoid without good hands is just an expensive gripper on legs.',
]

const HINTS = [
  'Ask yourself: does this need fingers moving separately?',
  'Could a strong two-finger pinch on a turning wrist do it?',
  'Scissors and spray bottles need you to hold and squeeze at once.',
]

/* ------------------------------------------------------------------ */
/* The kitchen                                                          */
/* ------------------------------------------------------------------ */

const FLOOR = 860
const TOP = 600

const ghost = (pose: HandPose, view: Partial<HandView>) => makeHandStore({ pose, view: { yaw: 0, pitch: 0, roll: 0, s: 0.95, ...view } })
/** Where each ghost hand sits (its wrist), what it does, and the point it moves about. */
const USES: { id: string; x: number; y: number; tx: number; ty: number; text: string; store: ReturnType<typeof makeHandStore>; move: gsap.TweenVars; ox: number; oy: number; at: number }[] = [
  { id: 'door', x: 214, y: 392, tx: 150, ty: 330, text: 'turn', store: ghost(GRASPS.hook as HandPose, { yaw: 90, roll: 180 }), move: { rotation: 28 }, ox: 246, oy: 546, at: 0.5 },
  { id: 'switch', x: 430, y: 640, tx: 520, ty: 420, text: 'flick', store: ghost(GRASPS.point as HandPose, { yaw: -50 }), move: { y: -14 }, ox: 430, oy: 640, at: 1.1 },
  { id: 'kettle', x: 1060, y: 560, tx: 900, ty: 400, text: 'lift + pour', store: ghost(GRASPS.power as HandPose, { yaw: 180, roll: 90 }), move: { rotation: -24, y: -30 }, ox: 840, oy: 560, at: 1.9 },
  { id: 'scissors', x: 980, y: 420, tx: 1130, ty: 470, text: 'thread fingers', store: ghost(GRASPS.tripod as HandPose, { yaw: 80, roll: 150 }), move: { rotation: -10 }, ox: 1080, oy: 590, at: 2.7 },
  { id: 'spray', x: 1820, y: 500, tx: 1700, ty: 400, text: 'squeeze trigger', store: ghost({ ...GRASPS.power, index: [20, 30, 16, 0] } as HandPose, { yaw: 180, roll: 90 }), move: { x: -10 }, ox: 1640, oy: 500, at: 3.6 },
  { id: 'drawer', x: 1880, y: 500, tx: 2030, ty: 560, text: 'pull', store: ghost(GRASPS.hook as HandPose, { yaw: 90, roll: 180 }), move: { scale: 1.14 }, ox: 1880, oy: 668, at: 4.4 },
  { id: 'keys', x: 2310, y: 450, tx: 2250, ty: 330, text: 'pinch + twist', store: ghost(GRASPS.lateral as HandPose, { yaw: 180, roll: 90 }), move: { rotation: 40 }, ox: 2140, oy: 440, at: 5.2 },
  { id: 'fridge', x: 2540, y: 380, tx: 2560, ty: 250, text: 'swing open', store: ghost(GRASPS.hook as HandPose, { yaw: 0, roll: -90 }), move: { x: 40 }, ox: 2720, oy: 380, at: 6.0 },
]

/** The thin cyan outline drawn around each object when its use lights up. */
function Glow({ id, d }: { id: string; d: string }) {
  return (
    <g className={`c2-ol c2-ol-${id}`} opacity={0} pointerEvents="none">
      <path d={d} fill="none" stroke={C.cyan} strokeWidth={6} opacity={0.35} filter="url(#cn-bloom)" />
      <path d={d} fill="none" stroke={C.cyanLight} strokeWidth={2} />
    </g>
  )
}

function Kitchen() {
  return (
    <g pointerEvents="none">
      {/* wall and floor */}
      <rect x={-800} y={-600} width={4600} height={2000} fill={C.ink2} />
      <rect x={-800} y={-600} width={4600} height={2000} fill="url(#cn-wall)" opacity={0.9} />
      <rect x={-800} y={FLOOR} width={4600} height={600} fill="url(#cn-floor)" />
      {/* the window over the sink: the city at night, rain on the glass */}
      <g>
        <clipPath id="c2-win">
          <rect x={1170} y={110} width={420} height={330} />
        </clipPath>
        <g clipPath="url(#c2-win)">
          <rect x={1170} y={110} width={420} height={330} fill="url(#cn-sky-night)" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={1180 + i * 70} y={300 - (i % 3) * 50} width={50} height={300} fill={C.ink1} />
          ))}
          {Array.from({ length: 16 }, (_, i) => (
            <circle key={i} className="hd-bokeh" style={{ animationDelay: `${-i * 0.7}s` }} cx={1190 + ((i * 97) % 400)} cy={250 + ((i * 53) % 170)} r={6 + (i % 4) * 3} fill={i % 2 ? C.key : C.rim} opacity={0.5} filter="url(#cn-dof-1)" />
          ))}
          <g opacity={0.4}>
            {Array.from({ length: 30 }, (_, i) => (
              <g key={i} transform={`translate(${1170 + ((i * 47) % 440)} ${100 + ((i * 89) % 330)})`}>
                <line className="hd-rain" style={{ animationDelay: `${-(i % 7) * 0.13}s` }} x1={0} y1={0} x2={-5} y2={28} stroke={C.rim} strokeWidth={1.2} />
              </g>
            ))}
          </g>
        </g>
        <rect x={1160} y={100} width={440} height={12} fill={C.ink1} />
        <rect x={1160} y={438} width={440} height={16} fill={C.ink1} />
        <rect x={1160} y={100} width={12} height={350} fill={C.ink1} />
        <rect x={1590} y={100} width={12} height={350} fill={C.ink1} />
        <rect x={1376} y={110} width={8} height={330} fill={C.ink1} />
        <Pool x={1380} y={300} r={360} color="rim" opacity={0.45} />
      </g>
      {/* the door on the left, with its lever handle */}
      <rect x={-40} y={40} width={300} height={FLOOR - 40} fill={C.ink3} />
      <rect x={-20} y={60} width={260} height={FLOOR - 70} fill="none" stroke={C.ink1} strokeWidth={6} />
      <path d="M250 548 l-4 -12 h-56 a10 10 0 0 0 0 20 h56 Z" fill={C.metal} />
      <circle cx={246} cy={546} r={12} fill={C.metalDark} />
      {/* the light switch */}
      <rect x={400} y={430} width={46} height={72} rx={6} fill={C.shellMid} />
      <rect x={414} y={448} width={18} height={36} rx={3} fill={C.shell} />
      {/* upper cabinets */}
      {[480, 700, 920, 1660, 1880, 2100].map((x) => (
        <g key={x}>
          <rect x={x} y={70} width={210} height={250} fill={C.ink3} />
          <rect x={x + 12} y={82} width={186} height={226} fill="none" stroke={C.ink1} strokeWidth={4} />
          <rect x={x + 170} y={260} width={8} height={36} rx={4} fill={C.metalDark} />
        </g>
      ))}
      {/* counter and lower cabinets */}
      <rect x={480} y={TOP + 18} width={1860} height={FLOOR - TOP - 18} fill={C.ink3} />
      {[480, 700, 920, 1140, 1360].map((x) => (
        <g key={x}>
          <rect x={x + 10} y={TOP + 34} width={200} height={FLOOR - TOP - 60} fill="none" stroke={C.ink1} strokeWidth={4} />
          <rect x={x + 170} y={TOP + 60} width={8} height={40} rx={4} fill={C.metalDark} />
        </g>
      ))}
      {/* the drawers */}
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={1760} y={TOP + 34 + i * 76} width={240} height={66} fill={C.ink3} stroke={C.ink1} strokeWidth={4} />
          <rect x={1840} y={TOP + 60 + i * 76} width={80} height={10} rx={5} fill={C.metal} />
        </g>
      ))}
      <rect x={2010} y={TOP + 34} width={320} height={FLOOR - TOP - 60} fill="none" stroke={C.ink1} strokeWidth={4} />
      <rect x={460} y={TOP} width={1900} height={22} fill={C.ink4} />
      <rect x={460} y={TOP} width={1900} height={3} fill={C.keyDeep} opacity={0.6} />
      {/* sink and tap */}
      <rect x={1270} y={TOP - 4} width={220} height={10} rx={4} fill={C.metalDark} />
      <path d="M1380 596 v-70 q0 -24 -26 -24 h-28" fill="none" stroke={C.metal} strokeWidth={9} strokeLinecap="round" />
      {/* the kettle */}
      <g>
        <path d="M770 596 q-10 -70 10 -100 h80 q20 30 10 100 Z" fill={C.metalDark} />
        <path d="M780 500 q-4 50 4 92" stroke={C.metal} strokeWidth={6} opacity={0.6} fill="none" />
        <path d="M858 512 q46 0 46 38 q0 30 -34 36" fill="none" stroke={C.ink1} strokeWidth={12} strokeLinecap="round" />
        <path d="M772 520 l-46 -26 l-8 6 l40 34 Z" fill={C.metalDark} />
        <rect x={800} y={486} width={40} height={12} rx={4} fill={C.ink1} />
      </g>
      {/* scissors lying on the counter */}
      <g transform="translate(1060 588) rotate(-8)">
        <ellipse cx={-30} cy={0} rx={18} ry={11} fill="none" stroke={C.danger} strokeWidth={6} opacity={0.85} />
        <ellipse cx={-6} cy={8} rx={18} ry={11} fill="none" stroke={C.danger} strokeWidth={6} opacity={0.85} />
        <path d="M8 2 L110 -10 L12 10 Z" fill={C.metal} />
        <path d="M14 8 L108 6 L10 14 Z" fill={C.shellMid} />
      </g>
      {/* the spray bottle */}
      <g>
        <rect x={1610} y={506} width={56} height={92} rx={12} fill="#2f7d6d" />
        <rect x={1618} y={530} width={40} height={36} rx={4} fill={C.paper} opacity={0.75} />
        <rect x={1626} y={486} width={24} height={22} fill={C.shellMid} />
        <path d="M1622 470 h44 l8 10 h-18 v10 h-34 Z" fill={C.shell} />
        <path d="M1640 490 q-14 10 -10 30" stroke={C.shell} strokeWidth={6} fill="none" strokeLinecap="round" />
      </g>
      {/* keys on a hook rail */}
      <rect x={2090} y={392} width={120} height={8} rx={4} fill={C.metalDark} />
      <g transform="translate(2140 400)">
        <circle cx={0} cy={14} r={12} fill="none" stroke={C.gold} strokeWidth={4} />
        <path d="M-4 26 v44 l8 0 v-8 h6 v-6 h-6 v-6 h6 v-6 h-6 v-18 Z" fill={C.goldDark} />
        <path d="M10 22 l20 34 l-6 4 l-20 -34 Z" fill={C.metal} />
      </g>
      {/* the fridge, door ajar, light spilling out */}
      <rect x={2380} y={20} width={380} height={FLOOR - 20} fill={C.shellDark} />
      <Beam x={2560} y={60} w1={300} w2={900} len={900} angle={-18} fill="url(#cn-beam-white)" opacity={0.6} />
      <rect x={2400} y={40} width={300} height={FLOOR - 50} fill={C.paper} opacity={0.12} />
      <path d={`M2700 30 L2830 0 L2830 ${FLOOR + 30} L2700 ${FLOOR}`} fill={C.shellMid} />
      <rect x={2716} y={300} width={10} height={160} rx={5} fill={C.ink3} />
      <Pool x={2600} y={FLOOR + 40} r={420} color="paper" opacity={0.35} />

      <Glow id="door" d="M246 534 h-56 a12 12 0 0 0 0 24 h56 Z" />
      <Glow id="switch" d="M398 428 h50 v76 h-50 Z" />
      <Glow id="kettle" d="M770 596 q-10 -70 10 -100 h80 q20 30 10 100 Z M858 512 q46 0 46 38 q0 30 -34 36" />
      <Glow id="scissors" d="M1000 590 a20 13 0 1 0 40 -6 a20 13 0 1 0 -40 6 M1070 590 L1170 572" />
      <Glow id="spray" d="M1610 506 h56 v92 h-56 Z M1622 470 h44 l8 10 h-18 v10 h-34 Z" />
      <Glow id="drawer" d="M1760 634 h240 v66 h-240 Z" />
      <Glow id="keys" d="M2128 412 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0 M2136 426 v44 h8 v-44 Z" />
      <Glow id="fridge" d="M2700 30 L2830 0 L2830 890 L2700 860 Z" />
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* The factory: an arm with a parallel gripper, two conveyors           */
/* ------------------------------------------------------------------ */

const T = 2.0
const V = 150
const PICK = { x: 700, y: 594 }
const PLACE = { x: 1270, y: 616 }
const UP = 450
const SHOULDER = { x: 985, y: 520 }
const L1 = 300
const L2 = 270
const GRIP = 96
const BOX = { w: 90, h: 72 }

const smooth = (t: number) => t * t * (3 - 2 * t)
/** The gripper tip and jaw opening at a phase of the pick cycle. */
function cycle(ph: number) {
  const K: [number, number, number, number][] = [
    [0, PICK.x, UP, 1],
    [0.22, PICK.x, PICK.y, 1],
    [0.3, PICK.x, PICK.y, 0],
    [0.5, PICK.x, UP, 0],
    [1.05, PLACE.x, UP, 0],
    [1.25, PLACE.x, PLACE.y, 0],
    [1.33, PLACE.x, PLACE.y, 1],
    [1.5, PLACE.x, UP, 1],
    [2.0, PICK.x, UP, 1],
  ]
  for (let i = 0; i < K.length - 1; i++) {
    const [t0, x0, y0, j0] = K[i]
    const [t1, x1, y1, j1] = K[i + 1]
    if (ph >= t0 && ph <= t1) {
      const u = smooth((ph - t0) / (t1 - t0 || 1))
      return { x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u, jaw: j0 + (j1 - j0) * u }
    }
  }
  return { x: PICK.x, y: UP, jaw: 1 }
}
/** Two-link arm, elbow up: shoulder and elbow angles (radians) to put the wrist at (x, y). */
function ik(x: number, y: number) {
  const dx = x - SHOULDER.x
  const dy = y - SHOULDER.y
  const d = Math.min(L1 + L2 - 1, Math.hypot(dx, dy))
  const a = Math.atan2(dy, dx)
  const b = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))
  const s = a - b * Math.sign(dx || 1)
  const ex = SHOULDER.x + Math.cos(s) * L1
  const ey = SHOULDER.y + Math.sin(s) * L1
  return { ex, ey }
}

function Arm({ cls }: { cls: string }) {
  return (
    <g className={cls}>
      <rect x={SHOULDER.x - 60} y={SHOULDER.y + 40} width={120} height={FLOOR - SHOULDER.y} fill={C.ink4} />
      <rect x={SHOULDER.x - 80} y={FLOOR - 30} width={160} height={30} fill={C.ink3} />
      <path className={`${cls}-l1`} d="" stroke={C.shellMid} strokeWidth={54} strokeLinecap="round" fill="none" />
      <path className={`${cls}-l1h`} d="" stroke={C.shell} strokeWidth={18} strokeLinecap="round" fill="none" opacity={0.7} />
      <path className={`${cls}-l2`} d="" stroke={C.shellMid} strokeWidth={40} strokeLinecap="round" fill="none" />
      <path className={`${cls}-l2h`} d="" stroke={C.shell} strokeWidth={12} strokeLinecap="round" fill="none" opacity={0.7} />
      <circle cx={SHOULDER.x} cy={SHOULDER.y} r={44} fill={C.carbon} />
      <circle cx={SHOULDER.x} cy={SHOULDER.y} r={18} fill={C.metal} />
      <g className={`${cls}-elbow`}>
        <circle r={30} fill={C.carbon} />
        <circle r={12} fill={C.metal} />
      </g>
      <g className={`${cls}-wrist`}>
        <circle r={20} fill={C.carbon} />
        <rect x={-34} y={10} width={68} height={40} rx={6} fill={C.metalDark} />
        <rect x={-44} y={46} width={88} height={14} rx={3} fill={C.metal} />
        <g className={`${cls}-jawL`}>
          <rect x={-44} y={58} width={16} height={GRIP - 58} rx={3} fill={C.shell} />
          <rect x={-44} y={GRIP - 18} width={16} height={18} fill={C.rubber} />
        </g>
        <g className={`${cls}-jawR`}>
          <rect x={28} y={58} width={16} height={GRIP - 58} rx={3} fill={C.shell} />
          <rect x={28} y={GRIP - 18} width={16} height={18} fill={C.rubber} />
        </g>
      </g>
    </g>
  )
}

function CardboardBox({ cls }: { cls: string }) {
  return (
    <g className={cls}>
      <rect x={-BOX.w / 2} y={-BOX.h / 2} width={BOX.w} height={BOX.h} rx={3} fill="#9c7048" />
      <rect x={-BOX.w / 2} y={-BOX.h / 2} width={BOX.w} height={14} fill="#b8875a" />
      <rect x={-8} y={-BOX.h / 2} width={16} height={BOX.h} fill="#c9a074" opacity={0.7} />
      <rect x={-BOX.w / 2} y={BOX.h / 2 - 8} width={BOX.w} height={8} fill="#000" opacity={0.2} />
    </g>
  )
}

function Conveyor({ x0, x1, y }: { x0: number; x1: number; y: number }) {
  return (
    <g>
      <rect x={x0} y={y} width={x1 - x0} height={26} rx={13} fill={C.ink4} />
      <rect x={x0} y={y} width={x1 - x0} height={5} fill={C.slate} />
      <g className="c2-belt">
        {Array.from({ length: Math.ceil((x1 - x0) / 40) }, (_, i) => (
          <circle key={i} cx={x0 + 20 + i * 40} cy={y + 14} r={7} fill={C.ink2} stroke={C.slate} strokeWidth={2} />
        ))}
      </g>
      {Array.from({ length: Math.ceil((x1 - x0) / 220) + 1 }, (_, i) => (
        <rect key={i} x={x0 + 30 + i * 220} y={y + 26} width={14} height={FLOOR - y - 26} fill={C.ink3} />
      ))}
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* The sort play                                                        */
/* ------------------------------------------------------------------ */

type Zone = 'gripper' | 'hand'
const TASKS: { id: string; lines: string[]; short: string; clear?: Zone; why: Record<Zone, string> }[] = [
  { id: 'box', lines: ['Lift a box'], short: 'lift a box', clear: 'gripper', why: { gripper: 'a firm pinch is enough', hand: 'no finger work needed' } },
  { id: 'key', lines: ['Turn a key', 'in a lock'], short: 'turn a key', why: { gripper: 'a wrist can do the twist', hand: 'fingers pinch and twist' } },
  { id: 'scissors', lines: ['Cut paper', 'with scissors'], short: 'use scissors', clear: 'hand', why: { gripper: 'needs fingers moving independently', hand: 'fingers move independently' } },
  { id: 'sock', lines: ['Pull one sock from', 'a tangled pile'], short: 'pull one sock', why: { gripper: 'a fine pinch can tug one', hand: 'fingers tease one free' } },
  { id: 'pen', lines: ['Spin a pen around', 'your fingers'], short: 'spin a pen', clear: 'hand', why: { gripper: 'can’t roll it in the fingers', hand: 'rolled finger by finger' } },
  { id: 'spray', lines: ['Squeeze a spray bottle', 'while aiming it'], short: 'spray and aim', clear: 'hand', why: { gripper: 'can’t hold and squeeze at once', hand: 'holding AND squeezing' } },
  { id: 'bag', lines: ['Carry a', 'shopping bag'], short: 'carry a bag', clear: 'gripper', why: { gripper: 'one hook, no finger work', hand: 'a simple hook will do' } },
  { id: 'jar', lines: ['Unscrew', 'a jar lid'], short: 'open a jar', why: { gripper: 'strong grip, wrist twists', hand: 'grip and twist the lid' } },
]
const SLOT = (i: number) => ({ x: i % 2 ? 960 : 640, y: 240 + Math.floor(i / 2) * 118 })
const TW = 290
const TH = 92
const ZX: Record<Zone, number> = { gripper: 200, hand: 1400 }

function TaskIcon({ id }: { id: string }) {
  const s = { fill: 'none', stroke: C.mist, strokeWidth: 2.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  switch (id) {
    case 'box':
      return <path {...s} d="M-14 -6 h28 v20 h-28 Z M-14 -6 l6 -8 h28 l-6 8 M20 -14 v20 l-6 8" />
    case 'key':
      return <path {...s} d="M-16 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M-2 0 h18 M10 0 v6 M15 0 v5" />
    case 'scissors':
      return <path {...s} d="M-10 8 a5 5 0 1 0 0.1 0 M-10 -8 a5 5 0 1 0 0.1 0 M-6 6 L16 -8 M-6 -6 L16 8" />
    case 'sock':
      return <path {...s} d="M-6 -16 h12 v16 l8 6 q4 8 -4 10 l-16 -8 Z" />
    case 'pen':
      return <path {...s} d="M-14 12 L12 -14 l4 4 L-10 16 Z M-14 12 l-3 5 l5 -2 M10 -18 a16 16 0 0 1 10 12" />
    case 'spray':
      return <path {...s} d="M-8 -4 h14 v20 h-14 Z M-6 -4 v-6 h10 v6 M-6 -10 h-8 M6 -10 l4 6" />
    case 'bag':
      return <path {...s} d="M-14 -4 h28 l-3 20 h-22 Z M-7 -4 q0 -12 7 -12 q7 0 7 12" />
    case 'jar':
      return <path {...s} d="M-11 -6 h22 v20 h-22 Z M-13 -12 h26 v6 h-26 Z M17 -12 a6 6 0 0 1 0 8" />
  }
  return null
}

function TaskCard({ t, x, y, dragProps, glow, wrong, moving }: { t: (typeof TASKS)[number]; x: number; y: number; dragProps?: object; glow?: boolean; wrong?: boolean; moving?: boolean }) {
  return (
    <g style={{ transform: `translate(${x}px, ${y}px)`, transition: moving ? 'none' : 'transform 0.55s cubic-bezier(0.34, 1.4, 0.64, 1)' }} data-tutor={`task-${t.id}`}>
      <g {...dragProps}>
        <rect x={-TW / 2} y={-TH / 2} width={TW} height={TH} rx={16} fill={C.ink1} fillOpacity={0.9} stroke={wrong ? C.danger : glow ? C.paper : C.slate} strokeWidth={glow || wrong ? 3 : 2} />
        <g transform={`translate(${-TW / 2 + 38} 0)`}>
          <circle r={26} fill={C.ink3} />
          <TaskIcon id={t.id} />
        </g>
        {t.lines.map((l, i) => (
          <text key={i} x={-TW / 2 + 78} y={8 + (i - (t.lines.length - 1) / 2) * 26} fill={C.paper} fontFamily={SANS} fontSize={21} fontWeight={500}>
            {l}
          </text>
        ))}
      </g>
    </g>
  )
}

const zoneHand = makeHandStore({ pose: GRASPS.relaxed as HandPose, view: { yaw: -20, pitch: 4, roll: 0, s: 0.95 } })

/* ------------------------------------------------------------------ */
/* The showroom robot: where its hands would be                         */
/* ------------------------------------------------------------------ */

const PV = { shoulderN: [6, -238], elbowN: [6, -172], wristN: [6, -112], shoulderF: [-2, -240], elbowF: [-2, -174], wristF: [-2, -114], hip: [0, -150] } as const
const rot = (p: [number, number], a: number, c: readonly [number, number]): [number, number] => {
  const r = (a * Math.PI) / 180
  const x = p[0] - c[0]
  const y = p[1] - c[1]
  return [c[0] + x * Math.cos(r) - y * Math.sin(r), c[1] + x * Math.sin(r) + y * Math.cos(r)]
}
/** A point drawn in the near (or far) hand's frame, in figure coordinates for a pose. */
function handPoint(p: Pose, local: [number, number], side: 'N' | 'F') {
  const w = side === 'N' ? PV.wristN : PV.wristF
  let q = rot(local, -(side === 'N' ? p.wristN : p.wristF), w)
  q = rot(q, -(side === 'N' ? p.elbowN : p.elbowF), side === 'N' ? PV.elbowN : PV.elbowF)
  q = rot(q, -(side === 'N' ? p.armN : p.armF), side === 'N' ? PV.shoulderN : PV.shoulderF)
  q = rot(q, p.torso, PV.hip)
  q = rot(q, p.lean, [0, -150])
  return [q[0] + p.x, q[1] + p.y] as [number, number]
}
const HERO = { x: 800, y: 850, s: 1.75 }
const HERO_POSE: Pose = { ...POSES.stand, armN: 34, elbowN: 64, wristN: 0, armF: 24, elbowF: 56 }
const HERO_LOOK: Pose = { ...HERO_POSE, head: 34, torso: 4, armN: 46, elbowN: 84 }

/* ------------------------------------------------------------------ */
/* The vignettes: hold and work at once                                 */
/* ------------------------------------------------------------------ */

const VIG = [
  { x: 330, y: 560, label: 'hold + operate' },
  { x: 800, y: 560, label: 'in-hand reorientation' },
  { x: 1270, y: 560, label: 'tool use' },
]
const SPRAY_VIEW: HandView = { yaw: 180, pitch: 0, roll: -90, s: 1.25 }
const PEN_VIEW: HandView = { yaw: -30, pitch: 10, roll: 0, s: 1.3 }
const JAR_VIEW: HandView = { yaw: 180, pitch: 0, roll: -90, s: 1.2 }
const SPRAY_HOLD: HandPose = { ...GRASPS.power, index: [30, 40, 20, 0] } as HandPose
const SPRAY_PULL: HandPose = { ...GRASPS.power, index: [52, 62, 34, 0] } as HandPose
const JAR_HOLD: HandPose = { ...GRASPS.power, thumb: [20, 30, 10, 6] } as HandPose
const JAR_FLICK: HandPose = { ...GRASPS.power, thumb: [-4, 50, -20, -16] } as HandPose

export function Ch2World({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const kitchen = useRef<SVGGElement>(null)
  const factory = useRef<SVGGElement>(null)
  const show = useRef<SVGGElement>(null)
  const stage = useRef<SVGGElement>(null)
  const spray = useHandStore({ pose: SPRAY_HOLD, view: SPRAY_VIEW })
  const pen = useHandStore({ pose: GRASPS.tripod as HandPose, view: PEN_VIEW })
  const jar = useHandStore({ pose: JAR_HOLD, view: JAR_VIEW })
  const penRoll = useRef({ k: 0, spin: 0 })
  const jarLid = useRef({ k: 0 })

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      resetHand(tl, spray, { pose: SPRAY_HOLD, view: SPRAY_VIEW })
      resetHand(tl, pen, { pose: GRASPS.tripod as HandPose, view: PEN_VIEW })
      resetHand(tl, jar, { pose: JAR_HOLD, view: JAR_VIEW })
      const camK = camera(kitchen.current, { x: 700, y: 430, zoom: 1.12 })
      const camF = camera(factory.current, { x: 980, y: 520, zoom: 1.05 })
      const camS = camera(show.current, { x: 800, y: 420, zoom: 0.95 })
      const seven = rig(root.current, 'c2-hero', HERO_POSE)
      const q = (s: string) => root.current?.querySelector(s)
      const qa = (s: string) => [...(root.current?.querySelectorAll(s) ?? [])]

      tl.set('.c2-factory, .c2-vign, .c2-show, .c2-dim', { opacity: 0 }, 0)

      /* b0: pan across the kitchen; each object lights up with its use. */
      tl.addLabel('b0', 0)
      tl.set('.c2-kitchen', { opacity: 1 }, 0)
      camK.to(tl, { x: 2060, y: 450, zoom: 1.12 }, 0, 7.4, 'sine.inOut')
      for (const u of USES) {
        fade(tl, `.c2-ol-${u.id}`, 1, u.at, 0.4)
        fade(tl, `.c2-use-${u.id}`, 1, u.at + 0.15, 0.5)
        tl.fromTo(`.c2-ghost-${u.id}`, { x: 0, y: 0, rotation: 0, scale: 1 }, { ...u.move, duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: 1, svgOrigin: `${u.ox} ${u.oy}`, immediateRender: false }, u.at + 0.4)
        fade(tl, `.c2-ol-${u.id}`, 0.25, u.at + 2.6, 0.8, 1)
        fade(tl, `.c2-use-${u.id}`, 0, u.at + 2.6, 0.8, 1)
      }
      fade(tl, '.c2-roomlab', 1, 4.2, 0.8)
      fade(tl, '.c2-roomlab', 0, 7.4, 0.3, 1)

      /* b1: cut to the factory line: an arm with a gripper picks boxes in rhythm. */
      const b1 = 7.6
      tl.addLabel('b1', b1)
      tl.set('.c2-kitchen', { opacity: 0 }, b1)
      tl.set('.c2-factory', { opacity: 1 }, b1)
      camF.cut(tl, { x: 900, y: 560, zoom: 1.3 }, b1)
      camF.to(tl, { x: 980, y: 520, zoom: 1.0 }, b1 + 0.1, 3, 'power2.out')
      camF.to(tl, { x: 900, y: 540, zoom: 1.08 }, b1 + 3.2, 6, 'sine.inOut')
      const line = { t: 0 }
      const els = {
        boxes: qa('.c2-box'),
        l1: q('.c2-arm-l1'),
        l1h: q('.c2-arm-l1h'),
        l2: q('.c2-arm-l2'),
        l2h: q('.c2-arm-l2h'),
        elbow: q('.c2-arm-elbow'),
        wrist: q('.c2-arm-wrist'),
        jawL: q('.c2-arm-jawL'),
        jawR: q('.c2-arm-jawR'),
        spark: q('.c2-spark'),
        count: q('.c2-count'),
        belt: qa('.c2-belt'),
        back: qa('.c2-back'),
      }
      const drawLine = () => {
        const t = line.t
        const ph = ((t % T) + T) % T
        const g = cycle(ph)
        const w = { x: g.x, y: g.y - GRIP }
        const { ex, ey } = ik(w.x, w.y)
        const seg = (a: { x: number; y: number }, b: { x: number; y: number }) => `M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${b.x.toFixed(1)} ${b.y.toFixed(1)}`
        els.l1?.setAttribute('d', seg(SHOULDER, { x: ex, y: ey }))
        els.l1h?.setAttribute('d', seg({ x: SHOULDER.x - 6, y: SHOULDER.y - 10 }, { x: ex - 6, y: ey - 10 }))
        els.l2?.setAttribute('d', seg({ x: ex, y: ey }, w))
        els.l2h?.setAttribute('d', seg({ x: ex - 4, y: ey - 8 }, { x: w.x - 4, y: w.y - 8 }))
        els.elbow?.setAttribute('transform', `translate(${ex} ${ey})`)
        els.wrist?.setAttribute('transform', `translate(${w.x} ${w.y})`)
        const open = g.jaw * 22
        els.jawL?.setAttribute('transform', `translate(${-open} 0)`)
        els.jawR?.setAttribute('transform', `translate(${open} 0)`)
        // boxes: box i reaches the pick spot at i*T + 0.22, is lifted at i*T + 0.3 and let go at i*T + 1.33
        els.boxes.forEach((el, k) => {
          const i = k - 1
          const tp = i * T + 0.3
          const tr = i * T + 1.33
          let x: number
          let y: number
          if (t < tp) {
            x = PICK.x - V * (i * T + 0.22 - t)
            if (t > i * T + 0.22) x = PICK.x
            y = 640 - BOX.h / 2
          } else if (t < tr) {
            const c = cycle(t - i * T)
            x = c.x
            y = c.y + (640 - BOX.h / 2 - PICK.y)
          } else {
            x = PLACE.x + V * (t - tr)
            y = 662 - BOX.h / 2
          }
          el.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`)
        })
        const n = Math.max(0, Math.floor((t - 0.3) / T) + 1)
        if (els.count) els.count.textContent = `picks ${String(1204 + n).padStart(5, ' ')}`
        const sp = ph - 0.3
        els.spark?.setAttribute('opacity', sp > 0 && sp < 0.18 ? String(1 - sp / 0.18) : '0')
        els.belt.forEach((b, i) => b.setAttribute('transform', `translate(${((t * V) % 40) * (i === 0 ? 1 : 1)} 0)`))
        els.back.forEach((b, i) => {
          const a = Math.sin(t * 3.1 + i * 2) * 14
          b.setAttribute('transform', `rotate(${a.toFixed(2)})`)
        })
      }
      drawLine()
      tl.fromTo(line, { t: 0 }, { t: 9.6, duration: 9.6, ease: 'none', onUpdate: drawLine, immediateRender: false }, b1)
      fade(tl, '.c2-lab-grip', 1, b1 + 2.4, 0.6)
      fade(tl, '.c2-countwrap', 1, b1 + 1, 0.6)
      fade(tl, '.c2-lab-why', 1, b1 + 5.6, 0.6)

      /* b2: the sort. The kitchen comes back, dimmed; the cards come in (React). */
      const b2 = b1 + 9.6
      tl.addLabel('b2', b2)
      fade(tl, '.c2-factory', 0, b2, 0.6, 1)
      fade(tl, '.c2-kitchen', 1, b2, 0.6, 0)
      camK.cut(tl, { x: 1400, y: 420, zoom: 1.0 }, b2)
      camK.to(tl, { x: 1300, y: 430, zoom: 1.03 }, b2 + 0.1, 8, 'sine.inOut')
      fade(tl, '.c2-dim', 0.72, b2, 0.8)
      fade(tl, '.c2-sortwrap', 1, b2 + 0.4, 0.8)
      tl.to({}, { duration: 2 }, b2 + 1.2)

      /* b3: three vignettes. Hold and work at the same time. */
      const b3 = b2 + 3.4
      tl.addLabel('b3', b3)
      fade(tl, '.c2-sortwrap', 0, b3, 0.5, 1)
      fade(tl, '.c2-kitchen', 0, b3 + 0.2, 0.6, 1)
      fade(tl, '.c2-vign', 1, b3 + 0.2, 0.8)
      tl.fromTo('.c2-vlab', { opacity: 0 }, { opacity: 0.35, duration: 0.6, immediateRender: false }, b3 + 0.6)
      // 1: hold the bottle, pull the trigger
      fade(tl, '.c2-v0-lit', 1, b3 + 0.8, 0.6)
      fade(tl, '.c2-vlab-0', 1, b3 + 0.8, 0.5, 0.35)
      for (let i = 0; i < 3; i++) {
        spray.to(tl, { pose: SPRAY_PULL, touch: { index: 0.9 } }, b3 + 1.2 + i * 0.9, 0.3, 'power2.in')
        spray.to(tl, { pose: SPRAY_HOLD, touch: { index: 0 } }, b3 + 1.55 + i * 0.9, 0.4)
        tl.fromTo('.c2-mist', { opacity: 0.9, scale: 0.3 }, { opacity: 0, scale: 1.4, duration: 0.7, ease: 'power1.out', svgOrigin: `${VIG[0].x - 120} ${VIG[0].y - 170}`, immediateRender: false }, b3 + 1.45 + i * 0.9)
      }
      // 2: the pen rolls from the fingertips into the palm
      fade(tl, '.c2-v1-lit', 1, b3 + 3.6, 0.6)
      fade(tl, '.c2-vlab-1', 1, b3 + 3.6, 0.5, 0.35)
      pen.to(tl, { pose: { ...GRASPS.tripod, thumb: [40, 20, 6, 4], index: [20, 20, 10, 2] } as HandPose }, b3 + 3.8, 0.8)
      tl.fromTo(penRoll.current, { k: 0, spin: 0 }, { k: 1, spin: 1, duration: 2.6, ease: 'power1.inOut', immediateRender: false, onUpdate: () => pen.notify() }, b3 + 3.9)
      pen.to(tl, { pose: { ...GRASPS.power, index: [46, 60, 30, 0] } as HandPose }, b3 + 5.0, 1.4)
      // 3: hold the jar, the thumb flicks the lid
      fade(tl, '.c2-v2-lit', 1, b3 + 6.6, 0.6)
      fade(tl, '.c2-vlab-2', 1, b3 + 6.6, 0.5, 0.35)
      jar.to(tl, { pose: JAR_FLICK, touch: { thumb: 0.8 } }, b3 + 7.2, 0.35, 'power3.in')
      tl.fromTo(jarLid.current, { k: 0 }, { k: 1, duration: 0.5, ease: 'back.out(2)', immediateRender: false, onUpdate: () => jar.notify() }, b3 + 7.45)
      jar.to(tl, { pose: JAR_HOLD, touch: { thumb: 0 } }, b3 + 8.2, 0.8)
      tl.fromTo('.c2-vlab', { opacity: 0.35 }, { opacity: 1, duration: 0.6, immediateRender: false }, b3 + 9.2)
      fade(tl, '.c2-v0-lit, .c2-v1-lit, .c2-v2-lit', 1, b3 + 9.2, 0.6, 0.6)

      /* b4: the showroom. Rows of bodies in the dark; push in on one with no hands. */
      const b4 = b3 + 10.6
      tl.addLabel('b4', b4)
      fade(tl, '.c2-vign', 0, b4, 0.6, 1)
      fade(tl, '.c2-show', 1, b4 + 0.2, 1.2)
      camS.cut(tl, { x: 800, y: 380, zoom: 0.86 }, b4)
      camS.to(tl, { x: 900, y: 520, zoom: 1.45 }, b4 + 1.2, 9, 'power1.inOut')
      fade(tl, '.c2-spot', 1, b4 + 2.2, 1.6)
      fade(tl, '.c2-lab-stock', 1, b4 + 6, 0.8)
      tl.to({}, { duration: 0.3 }, b4 + 10.6)

      /* b5: it looks down at its stump. Cut to black. */
      const b5 = b4 + 11
      tl.addLabel('b5', b5)
      fade(tl, '.c2-lab-stock', 0, b5, 0.5, 1)
      seven.to(tl, HERO_LOOK, b5 + 0.3, 2.2, 'power2.inOut')
      camS.to(tl, { x: 900, y: 480, zoom: 2.0 }, b5, 3.6, 'power2.inOut')
      letterbox(tl, '.c2-lb', true, b5 + 0.4)
      fade(tl, '.c2-black', 1, b5 + 4.4, 0.25)
      tl.to({}, { duration: 0.6 }, b5 + 4.7)

      // keep the masks and wires on the hero's moving arms
      const heroEls = { mN: q('.c2-maskN'), mF: q('.c2-maskF'), wN: q('.c2-wiresN'), wF: q('.c2-wiresF') }
      const place = () => {
        const p = seven.state
        const at = (side: 'N' | 'F', local: [number, number]) => {
          const [x, y] = handPoint(p, local, side)
          return { x: HERO.x + x * HERO.s, y: HERO.y + y * HERO.s }
        }
        const n = at('N', [PV.wristN[0] + 3, PV.wristN[1] + 17])
        const f = at('F', [PV.wristF[0] + 3, PV.wristF[1] + 17])
        heroEls.mN?.setAttribute('cx', String(n.x))
        heroEls.mN?.setAttribute('cy', String(n.y))
        heroEls.mF?.setAttribute('cx', String(f.x))
        heroEls.mF?.setAttribute('cy', String(f.y))
        const wn = at('N', [PV.wristN[0], PV.wristN[1] - 4])
        const wf = at('F', [PV.wristF[0], PV.wristF[1] - 4])
        heroEls.wN?.setAttribute('transform', `translate(${wn.x} ${wn.y})`)
        heroEls.wF?.setAttribute('transform', `translate(${wf.x} ${wf.y})`)
      }
      place()
      tl.fromTo({ v: 0 }, { v: 0 }, { v: 1, duration: 5.3, ease: 'none', onUpdate: place, immediateRender: false }, b5)
      tl.fromTo({ v: 0 }, { v: 0 }, { v: 1, duration: 0.2, ease: 'none', onUpdate: place, immediateRender: false }, b4)
    },
    [spray, pen, jar],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.c2-fridgehum', { opacity: 0.6, duration: 2.2, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.c2-wire', { rotation: 6, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.3, transformOrigin: '0 0' })
    gsap.to('.c2-spotflick', { opacity: 0.75, duration: 0.08, yoyo: true, repeat: -1, repeatDelay: 3.4, ease: 'none' })
    gsap.to('.c2-visor', { opacity: 0.35, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  /* ---------------- the sort play ---------------- */
  const PLAY = 2
  const active = cueIndex === PLAY
  const [placed, setPlaced] = useState<{ id: string; zone: Zone }[]>([])
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null)
  const [bounce, setBounce] = useState<{ id: string; zone: Zone; text: string; n: number } | null>(null)
  const [won, setWon] = useState(false)
  const wonRef = useRef(false)
  const grab = useRef({ dx: 0, dy: 0 })

  useEffect(() => {
    if (!active) return
    setPlaced([])
    setBounce(null)
    setWon(false)
    wonRef.current = false
  }, [active])
  useEffect(() => {
    if (!bounce) return
    const t = window.setTimeout(() => setBounce(null), 2600)
    return () => window.clearTimeout(t)
  }, [bounce])

  const dropTask = (id: string, x: number) => {
    setDrag(null)
    const zone: Zone | null = x < 480 ? 'gripper' : x > 1120 ? 'hand' : null
    if (!zone) return
    const t = TASKS.find((k) => k.id === id)!
    if (t.clear && t.clear !== zone) {
      setBounce({ id, zone, text: t.why[zone], n: Date.now() })
      emit({ type: 'attempt', correct: false, detail: `put "${t.short}" on the ${zone}: ${t.why[zone]}` })
      return
    }
    const next = [...placed, { id, zone }]
    setPlaced(next)
    setBounce(null)
    emit({ type: t.clear ? 'attempt' : 'progress', correct: true, detail: `put "${t.short}" on the ${zone}: ${t.why[zone]}` } as Parameters<typeof emit>[0])
    if (next.length === TASKS.length && !wonRef.current) {
      wonRef.current = true
      setWon(true)
      void say('Good. Now look at what the hand tasks have in common.').then(() => onPlayDone())
    }
  }
  const taskDrag = (id: string, i: number) =>
    dragIn(() => stage.current, {
      start: (p) => {
        if (!active || wonRef.current) return
        const s = SLOT(i)
        grab.current = { dx: s.x - p.x, dy: s.y - p.y }
        setDrag({ id, x: s.x, y: s.y })
      },
      move: (p) => setDrag((d) => (d && d.id === id ? { id, x: p.x + grab.current.dx, y: p.y + grab.current.dy } : d)),
      end: (p) => {
        if (!active || wonRef.current) return setDrag(null)
        dropTask(id, p.x + grab.current.dx)
      },
    })

  useEffect(() => {
    if (cueIndex === PLAY) {
      const done = placed.map((p) => `${TASKS.find((t) => t.id === p.id)?.short} → ${p.zone}`)
      reportState(
        'The kitchen is dimmed behind eight task cards floating in the middle: Lift a box; Turn a key in a lock; Cut paper with scissors; Pull one sock from a tangled pile; Spin a pen around your fingers; Squeeze a spray bottle while aiming it; Carry a shopping bag; Unscrew a jar lid. ' +
          'On the left is a two-finger gripper, on the right a robot hand. The learner drags each card to the side that the task truly needs; each placed card shows a short reason. ' +
          `Placed so far (${placed.length} of 8): ${done.length ? done.join('; ') : 'none'}. ${bounce ? `Last drop bounced back: "${TASKS.find((t) => t.id === bounce.id)?.short}" on the ${bounce.zone} (${bounce.text}).` : ''} ${won ? 'All eight placed: done.' : ''} ` +
          'Answers: gripper for the box and the bag (a firm pinch or a hook is enough). Hand for scissors (fingers moving independently), spinning a pen (in-hand rolling) and the spray bottle (holding and squeezing at once). Either is accepted for the key and the jar lid (a gripper on a turning wrist can do the twist) and the sock (a fine pinch can tug one free, fingers do it better). Clear ones placed on the wrong side bounce back with the reason. ' +
          'Likely mix-up: thinking anything twisty needs a hand, when a wrist can twist.',
      )
      setHints(HINTS)
    } else {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
    }
  }, [cueIndex, placed, bounce, won, reportState, setHints])

  /* ---------------- vignette props, drawn at the fingertips ---------------- */
  const pr = penRoll.current
  const penAt = (tips: Record<FingerName, Pt>) => {
    const mx = (tips.thumb.x + tips.index.x) / 2
    const my = (tips.thumb.y + tips.index.y) / 2
    const palm = { x: VIG[1].x - 10, y: VIG[1].y - 70 }
    const ang = (Math.atan2(tips.index.y - tips.thumb.y, tips.index.x - tips.thumb.x) * 180) / Math.PI + 90 + pr.spin * 200
    return { x: mx + (palm.x - mx) * pr.k * 0.8, y: my + (palm.y - my) * pr.k * 0.8, a: ang }
  }

  /* ---------------- picture ---------------- */
  const placedIn = (z: Zone) => placed.filter((p) => p.zone === z)

  return (
    <g ref={root}>
      <defs>
        <filter id="c2-ghostfx" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0.2 0.4 0.08 0 -0.1  0.55 1.1 0.2 0 -0.25  0.6 1.2 0.25 0 -0.12  0 0 0 0.7 0" result="tint" />
          <feGaussianBlur in="tint" stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="tint" />
          </feMerge>
        </filter>
      </defs>

      {/* ================= the kitchen ================= */}
      <g className="c2-kitchen" ref={kitchen}>
        <g data-depth="1">
          <Kitchen />
          <g className="c2-fridgehum" opacity={0.9}>
            <Pool x={2560} y={500} r={520} color="paper" opacity={0.25} />
          </g>
          <Pool x={820} y={420} r={480} color="key" opacity={0.35} />
          <Dust x={-200} y={0} w={3200} h={860} count={60} seed={12} color={C.rim} size={0.8} />
          {USES.map((u) => (
            <g key={u.id} className={`c2-use-${u.id}`} opacity={0} pointerEvents="none">
              <g className={`c2-ghost-${u.id}`}>
                <g filter="url(#c2-ghostfx)">
                  <Hand3D store={u.store} x={u.x} y={u.y} look="human" arm={70} />
                </g>
              </g>
              <text x={u.tx} y={u.ty} fill={C.cyanLight} fontFamily={SANS} fontSize={24} fontWeight={500} textAnchor="middle" stroke={C.ink} strokeWidth={5} strokeOpacity={0.6} style={{ paintOrder: 'stroke' }}>
                {u.text}
              </text>
            </g>
          ))}
          <g className="c2-roomlab" opacity={0}>
            <text x={1500} y={40} fill={C.mist} fontFamily={SANS} fontSize={26} textAnchor="middle" letterSpacing={3}>
              EVERY HANDLE, SWITCH AND TRIGGER: SHAPED FOR FINGERS
            </text>
          </g>
        </g>
        <g data-depth="1.7" pointerEvents="none">
          {/* a chair back and table edge slide past, out of focus */}
          <g filter="url(#cn-dof-3)">
            <path d="M-80 1000 q40 -260 120 -420 q-30 180 10 420 Z M40 1000 q60 -300 200 -380 q-90 160 -100 380 Z M-40 1000 q-20 -200 -140 -300 q60 140 60 300 Z" fill={C.ink} />
            <rect x={1500} y={560} width={46} height={500} fill={C.ink} />
            <rect x={1480} y={540} width={300} height={46} rx={16} fill={C.ink} />
            <path d="M2700 1000 q30 -280 140 -400 q-40 200 0 400 Z" fill={C.ink} />
          </g>
        </g>
        <rect className="c2-dim" x={-200} y={-200} width={2000} height={1300} fill={C.ink} opacity={0} pointerEvents="none" />
      </g>

      {/* ================= the factory ================= */}
      <g className="c2-factory" ref={factory} opacity={0}>
        <g data-depth="0.4">
          <rect x={-900} y={-700} width={3600} height={2400} fill={C.ink1} />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <rect key={i} x={-300 + i * 360} y={-200} width={40} height={1300} fill={C.ink2} />
          ))}
          {/* other arms working in the haze */}
          <g filter="url(#cn-dof-2)" opacity={0.55}>
            {[60, 520, 1480, 1900].map((x, i) => (
              <g key={x} transform={`translate(${x} 640)`}>
                <rect x={-30} y={-20} width={60} height={240} fill={C.ink4} />
                <g className="c2-back">
                  <path d={`M0 -20 L${i % 2 ? 120 : -120} -170 L${i % 2 ? 230 : -230} -90`} stroke={C.slate} strokeWidth={30} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </g>
              </g>
            ))}
          </g>
          <rect x={-900} y={760} width={3600} height={600} fill={C.ink2} />
        </g>
        <g data-depth="1">
          {[300, 980, 1660].map((x) => (
            <g key={x}>
              <Beam x={x} y={-120} w1={80} w2={620} len={1000} fill="url(#cn-beam-key)" opacity={0.4} />
              <rect x={x - 70} y={-140} width={140} height={22} rx={6} fill={C.ink3} />
              <rect x={x - 60} y={-120} width={120} height={6} fill={C.keyLight} />
            </g>
          ))}
          <rect x={-900} y={FLOOR} width={3600} height={500} fill="url(#cn-floor)" />
          <Conveyor x0={-400} x1={860} y={640} />
          <Conveyor x0={1120} x1={2000} y={662} />
          <Arm cls="c2-arm" />
          {Array.from({ length: 9 }, (_, k) => (
            <CardboardBox key={k} cls="c2-box" />
          ))}
          <g className="c2-spark" opacity={0} pointerEvents="none">
            <circle cx={PICK.x} cy={PICK.y} r={60} fill={C.keyLight} opacity={0.35} filter="url(#cn-bloom)" />
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const a = (i / 6) * Math.PI * 2 + 0.3
              return <line key={i} x1={PICK.x + Math.cos(a) * 20} y1={PICK.y + Math.sin(a) * 20} x2={PICK.x + Math.cos(a) * 54} y2={PICK.y + Math.sin(a) * 54} stroke={C.keyLight} strokeWidth={3} strokeLinecap="round" />
            })}
          </g>
          <Label className="c2-lab-grip" x={PICK.x - 30} y={PICK.y - 60} tx={260} ty={210} text="a gripper: two fingers, open and close" sub="one motor" color={C.paper} anchor="start" />
          <g className="c2-countwrap" opacity={0}>
            <Readout x={1560} y={190} color={C.mist} size={30} anchor="end" className="c2-count">
              picks 1204
            </Readout>
          </g>
          <g className="c2-lab-why" opacity={0}>
            <text x={1560} y={232} fill={C.paper} fontFamily={SANS} fontSize={28} fontWeight={500} textAnchor="end">
              cheap · strong · reliable
            </text>
          </g>
          <Dust x={-300} y={-100} w={2400} h={900} count={50} seed={77} color={C.keyLight} size={0.9} />
        </g>
      </g>

      {/* ================= three vignettes ================= */}
      <g className="c2-vign" opacity={0}>
        <rect x={-100} y={-100} width={1800} height={1100} fill={C.ink} />
        {VIG.map((v, i) => (
          <g key={i}>
            <g className={`c2-v${i}-lit`} opacity={0.4}>
              <Pool x={v.x} y={v.y - 160} r={330} color="key" opacity={0.9} />
            </g>
            {i > 0 && <line x1={v.x - 235} x2={v.x - 235} y1={120} y2={780} stroke={C.slate} strokeWidth={1.5} opacity={0.5} />}
          </g>
        ))}
        {/* 1: the spray bottle, held while the index finger works the trigger */}
        <g>
          <g transform={`translate(${VIG[0].x - 30} ${VIG[0].y - 150})`}>
            <rect x={-40} y={20} width={80} height={250} rx={18} fill="#2f7d6d" />
            <rect x={-30} y={80} width={60} height={70} rx={6} fill={C.paper} opacity={0.75} />
            <rect x={-18} y={-20} width={36} height={44} fill={C.shellMid} />
            <path d="M-26 -50 h80 l14 16 h-30 v14 h-64 Z" fill={C.shell} />
          </g>
          <g className="c2-mist" opacity={0}>
            {[0, 1, 2, 3, 4, 5, 6].map((k) => (
              <circle key={k} cx={VIG[0].x + 60 + k * 14} cy={VIG[0].y - 196 + ((k * 7) % 5) * 6 - 10} r={4 + (k % 3)} fill={C.cyanLight} opacity={0.7} />
            ))}
          </g>
          <Hand3D store={spray} x={VIG[0].x - 170} y={VIG[0].y - 70} look="robot" arm={110} light={[-0.6, -0.8]} />
          <AtTips store={spray} x={VIG[0].x - 170} y={VIG[0].y - 70} render={(t) => <path d={`M${VIG[0].x - 4} ${VIG[0].y - 170} Q ${VIG[0].x + 20} ${VIG[0].y - 140} ${t.index.x} ${t.index.y}`} stroke={C.shell} strokeWidth={9} strokeLinecap="round" fill="none" />} />
        </g>
        {/* 2: the pen, rolled from the fingertips into the palm */}
        <g>
          <Hand3D store={pen} x={VIG[1].x} y={VIG[1].y + 40} look="robot" arm={100} light={[-0.6, -0.8]} />
          <AtTips
            store={pen}
            x={VIG[1].x}
            y={VIG[1].y + 40}
            render={(t) => {
              const p = penAt(t)
              return (
                <g transform={`translate(${p.x} ${p.y}) rotate(${p.a})`}>
                  <rect x={-6} y={-90} width={12} height={180} rx={5} fill={C.amberDark} />
                  <rect x={-6} y={-90} width={12} height={34} rx={4} fill={C.ink3} />
                  <path d="M-6 90 L0 104 L6 90 Z" fill={C.shellMid} />
                </g>
              )
            }}
          />
        </g>
        {/* 3: the jar, held while the thumb flicks the lid */}
        <g>
          <g transform={`translate(${VIG[2].x + 40} ${VIG[2].y - 120})`}>
            <rect x={-70} y={-40} width={140} height={190} rx={22} fill="#c9e3ee" opacity={0.2} stroke={C.mist} strokeWidth={3} />
            <rect x={-60} y={40} width={120} height={100} rx={14} fill="#d9772b" opacity={0.75} />
            <rect x={-56} y={-56} width={112} height={18} rx={4} fill={C.metalDark} />
          </g>
          <Hand3D store={jar} x={VIG[2].x - 170} y={VIG[2].y - 50} look="robot" arm={110} light={[-0.6, -0.8]} />
          <AtTips
            store={jar}
            x={VIG[2].x - 170}
            y={VIG[2].y - 50}
            render={() => (
              <g transform={`translate(${VIG[2].x + 104} ${VIG[2].y - 176}) rotate(${-jarLid.current.k * 75})`}>
                <rect x={-136} y={-16} width={136} height={22} rx={6} fill={C.metal} />
                <rect x={-136} y={-16} width={136} height={6} rx={3} fill={C.shell} />
                <circle cx={0} cy={-4} r={6} fill={C.metalDark} />
              </g>
            )}
          />
        </g>
        {VIG.map((v, i) => (
          <text key={i} className={`c2-vlab c2-vlab-${i}`} x={v.x} y={830} fill={C.paper} fontFamily={SANS} fontSize={32} fontWeight={500} textAnchor="middle" opacity={0}>
            {v.label}
          </text>
        ))}
      </g>

      {/* ================= the showroom ================= */}
      <g className="c2-show" ref={show} opacity={0}>
        <g data-depth="0.45">
          <rect x={-1200} y={-900} width={4000} height={2800} fill={C.ink} />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <rect key={i} x={-260 + i * 300} y={-100} width={6} height={700} fill={C.rimDeep} opacity={0.2} />
          ))}
          <g filter="url(#cn-dof-2)" opacity={0.5}>
            {Array.from({ length: 11 }, (_, i) => (
              <Robot key={i} name={`c2-far-${i}`} x={-260 + i * 210} y={620} s={0.6} silhouette={C.ink3} pose={{ ...POSES.stand, head: (i % 3) * 4 }} />
            ))}
          </g>
          <rect x={-1200} y={620} width={4000} height={1400} fill={C.ink1} />
        </g>
        <g data-depth="0.7">
          <g filter="url(#cn-dof-1)" opacity={0.8}>
            {Array.from({ length: 8 }, (_, i) => (
              <Robot key={i} name={`c2-mid-${i}`} x={-200 + i * 280} y={760} s={0.95} silhouette={C.ink2} pose={{ ...POSES.stand, head: 6 }} />
            ))}
          </g>
        </g>
        <g data-depth="1">
          <rect x={-1200} y={HERO.y} width={4000} height={900} fill="url(#cn-floor)" opacity={0.6} />
          {[-560, 360, 1240, 2160].map((x) => (
            <Robot key={x} name={`c2-near-${x}`} x={x} y={HERO.y + 10} s={HERO.s} silhouette="#0b111c" pose={{ ...POSES.stand, head: 8 }} />
          ))}
          <g className="c2-spot" opacity={0}>
            <g className="c2-spotflick">
              <path d={`M${HERO.x + 10} -300 L${HERO.x + 70} -300 L${HERO.x + 320} ${HERO.y} L${HERO.x - 240} ${HERO.y} Z`} fill="url(#cn-beam-white)" opacity={0.5} filter="url(#cn-dof-2)" />
              <Pool x={HERO.x + 20} y={HERO.y} r={360} color="paper" opacity={0.3} />
            </g>
          </g>
          <ellipse cx={HERO.x + 10} cy={HERO.y + 4} rx={120} ry={12} fill="#000" opacity={0.6} filter="url(#cn-dof-1)" />
          <mask id="c2-handless" maskUnits="userSpaceOnUse" x={-2000} y={-2000} width={6000} height={6000}>
            <rect x={-2000} y={-2000} width={6000} height={6000} fill="#fff" />
            <circle className="c2-maskN" r={21 * HERO.s} fill="#000" />
            <circle className="c2-maskF" r={21 * HERO.s} fill="#000" />
          </mask>
          <g mask="url(#c2-handless)">
            <Robot name="c2-hero" x={HERO.x} y={HERO.y} s={HERO.s} pose={HERO_POSE} light="cool-left" />
          </g>
          {(['N', 'F'] as const).map((side) => (
            <g key={side} className={`c2-wires${side}`} pointerEvents="none">
              <ellipse rx={7 * HERO.s} ry={4 * HERO.s} fill={C.ink} />
              {[
                [C.danger, -4, 26],
                [C.cyan, 0, 34],
                [C.gold, 4, 22],
                [C.slate, 2, 30],
              ].map(([col, dx, len], i) => (
                <path key={i} className="c2-wire" d={`M${(dx as number) * HERO.s} 0 q ${4 * HERO.s} ${((len as number) * HERO.s) / 2} ${((dx as number) - 3) * HERO.s} ${(len as number) * HERO.s}`} stroke={col as string} strokeWidth={2.2} fill="none" opacity={side === 'F' ? 0.5 : 0.9} />
              ))}
            </g>
          ))}
          <Label className="c2-lab-stock" x={HERO.x + 140} y={HERO.y - 262} tx={HERO.x + 200} ty={HERO.y - 450} text="Optimus bodies waiting for hands" sub="Oct 2025: production paused" color={C.paper} size={24} anchor="start" />
        </g>
        <g data-depth="1.8" pointerEvents="none">
          <defs>
            <linearGradient id="c2-pillar" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor={C.ink} stopOpacity={0} />
              <stop offset="0.3" stopColor={C.ink} stopOpacity={0.95} />
              <stop offset="0.7" stopColor={C.ink} stopOpacity={0.95} />
              <stop offset="1" stopColor={C.ink} stopOpacity={0} />
            </linearGradient>
          </defs>
          <rect x={1400} y={-400} width={160} height={1800} fill="url(#c2-pillar)" />
          <rect x={-280} y={-400} width={130} height={1800} fill="url(#c2-pillar)" />
        </g>
      </g>

      {/* ================= the sort play (on the stage) ================= */}
      <g ref={stage}>
        <g className="c2-sortwrap" opacity={0}>
          {(cueIndex === PLAY || cueIndex === PLAY + 1) && (
            <g>
              {/* the two sides */}
              {(['gripper', 'hand'] as Zone[]).map((z) => {
                const x = ZX[z]
                const hot = drag && (z === 'gripper' ? drag.x < 480 : drag.x > 1120)
                return (
                  <g key={z} data-tutor={`zone-${z}`}>
                    <Pool x={x} y={220} r={260} color={hot ? 'cyan' : 'key'} opacity={hot ? 0.6 : 0.4} />
                    {z === 'gripper' ? (
                      <g transform={`translate(${x} 190) scale(1.5)`}>
                        <rect x={-36} y={-70} width={72} height={34} rx={6} fill={C.metalDark} />
                        <rect x={-46} y={-38} width={92} height={22} rx={4} fill={C.metal} />
                        <rect x={-44} y={-16} width={18} height={72} rx={4} fill={C.shell} />
                        <rect x={26} y={-16} width={18} height={72} rx={4} fill={C.shell} />
                        <rect x={-44} y={36} width={18} height={20} fill={C.rubber} />
                        <rect x={26} y={36} width={18} height={20} fill={C.rubber} />
                      </g>
                    ) : (
                      <Hand3D store={zoneHand} x={x} y={300} look="robot" arm={30} light={[-0.6, -0.8]} />
                    )}
                    <rect x={x - 190} y={50} width={380} height={800} rx={28} fill="none" stroke={hot ? C.cyan : C.slate} strokeWidth={2} strokeDasharray="10 10" opacity={0.7} />
                    <text x={x} y={394} fill={C.paper} fontFamily={SANS} fontSize={34} fontWeight={600} textAnchor="middle">
                      {z === 'gripper' ? 'gripper' : 'hand'}
                    </text>
                    {placedIn(z).map((p, k) => {
                      const t = TASKS.find((q) => q.id === p.id)!
                      return (
                        <g key={p.id} transform={`translate(${x} ${450 + k * 64})`}>
                          <g transform="translate(-150 6)">
                            <circle r={20} fill={C.ink3} />
                            <g transform="scale(0.75)">
                              <TaskIcon id={t.id} />
                            </g>
                          </g>
                          <text x={-118} y={0} fill={C.paper} fontFamily={SANS} fontSize={22} fontWeight={500}>
                            {t.short}
                          </text>
                          <text x={-118} y={24} fill={t.clear ? C.lime : C.cyanLight} fontFamily={MONO} fontSize={15}>
                            {t.why[z]}
                          </text>
                        </g>
                      )
                    })}
                    {bounce?.zone === z && (
                      <text key={bounce.n} x={x} y={450 + placedIn(z).length * 64} fill={C.danger} fontFamily={SANS} fontSize={21} fontWeight={600} textAnchor="middle">
                        {bounce.text}
                      </text>
                    )}
                  </g>
                )
              })}
              {TASKS.map((t, i) => {
                if (placed.some((p) => p.id === t.id)) return null
                const d = drag?.id === t.id ? drag : null
                const s = SLOT(i)
                return (
                  <g key={t.id} className={d ? undefined : 'hd-drift'} style={{ animationDelay: `${-i * 1.3}s` }}>
                    <TaskCard t={t} x={d ? d.x : s.x} y={d ? d.y : s.y} glow={!!d} moving={!!d} wrong={bounce?.id === t.id} dragProps={taskDrag(t.id, i)} />
                  </g>
                )
              })}
              <text x={800} y={140} fill={won ? C.lime : C.mist} fontFamily={MONO} fontSize={20} textAnchor="middle" pointerEvents="none">
                {won ? 'all eight sorted' : `${placed.length} of 8 sorted`}
              </text>
            </g>
          )}
        </g>
      </g>

      <rect className="c2-black" x={-100} y={-100} width={1800} height={1100} fill="#000" opacity={0} pointerEvents="none" />
      <Vignette />
      <Letterbox className="c2-lb" />
    </g>
  )
}

export const ch2: Chapter = {
  id: 'world',
  title: 'A world built for hands',
  cues: CUES,
  Scene: Ch2World,
  enter: { type: 'dissolve' },
  deeper: [GrippersReading, IndustryReading],
}
