import gsap from 'gsap'
import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Bloom, Glow, Motes, Stars, Vignette } from '../../art2/fx'
import { FONT2, N } from '../../art2/palette'
import { Title } from '../../art2/props'
import { useBeatTimeline } from '../../engine/useBeatTimeline'
import type { Chapter, ChapterProps, Cue } from '../../flow/types'
import { Ama, Bag, Pebble, Pen, Sheep, Valley } from './art'

export const CUES: Cue[] = [
  { id: 'meet-ama', say: 'Long, long ago, before anyone had numbers, a shepherd named Ama looked after a flock of sheep.' },
  { id: 'morning', say: 'Every morning, Ama let her sheep out of the pen to munch grass on the hills.' },
  { id: 'night', say: 'Every night, she brought them home. But Ama had a problem. How could she tell if a sheep was missing? She had no number words at all.' },
  { id: 'try-guess', say: 'Here is the flock tonight. Is every sheep home? Take a guess!', play: true, quick: true },
  { id: 'idea', say: 'Ama had a clever idea. Each morning, as each sheep walked out the gate, she dropped one pebble into her bag.' },
  { id: 'one-for-one', say: 'One sheep, one pebble. One sheep, one pebble. The bag now holds a pebble for every sheep.' },
  { id: 'coming-home', say: 'At night, as each sheep came home, Ama took one pebble out.' },
  { id: 'left-over', say: 'Look! One pebble is left in the bag. That means one sheep is still out there!' },
  { id: 'matching', say: 'This is the first big idea of math: matching. One thing for one thing. Sheep, pebbles, or marks, they all keep track the same way.' },
  { id: 'history', say: 'People really did this! Long ago, people carved one notch on a bone for each thing. Later they used clay tokens, and then they wrote numbers down.' },
  { id: 'night-watch', say: 'Now you keep watch! The pebbles are from this morning, one for each sheep that went out. Drag one pebble onto each sheep that came home. Then tell me, is every sheep home?', play: true },
]

/** The scene's own lines. Fixed strings, so they can be recorded ahead. */
const LINES = {
  guess: "Hard to tell just by looking, isn't it? Ama couldn't tell either.",
  twice: 'That sheep already has a pebble. Just one each.',
  allHome: 'Look by the bag. One pebble has no sheep.',
  won: 'Yes! Matching told you. One pebble has no sheep, so one sheep is missing.',
} as const

/*
 * Chapter 1: why math was born. Everything happens in Ama's valley, and the time of day is
 * the chapter's clock: day, sunset, night, dawn, and day again. Sheep walk out of the pen in
 * the morning and home at night; pebbles go into the bag and come back out, one for one,
 * with a teal flash for each match. The camera then tilts up into the night sky, where the
 * idea is drawn as a clean chart and a short history, and comes back down for the learner's
 * own night watch. It ends at dawn, wide on the valley, for chapter 2 to slide in beside.
 */

/* ------------------------------------------------------------------ */
/* Where things are (world coordinates; the wide shot is the identity)  */
/* ------------------------------------------------------------------ */

interface Pt {
  x: number
  y: number
}
interface SPt extends Pt {
  s?: number
}

const PEN = { x: 1100, y: 806, s: 0.8, w: 600 }
const GATE_IN: Pt = { x: 1100, y: 776 }
const GATE_OUT: Pt = { x: 1100, y: 874 }
/** Where sheep turn off the path towards the hills. */
const LANE: SPt = { x: 830, y: 878, s: 0.58 }
const AMA = { x: 1330, y: 880, s: 0.8 }
const BAG = { x: 1218, y: 884, s: 0.72 }
const MOUTH: Pt = { x: BAG.x, y: BAG.y - 90 * BAG.s }
/** Ama's hand in the "drop" pose, right over the bag. */
const HAND: Pt = { x: AMA.x - 118 * AMA.s, y: AMA.y - 150 * AMA.s }
const CROOK = { x: 1458, y: 888 }
const SHEEP_S = 0.58
/** Places inside the pen, in the order the sheep walk out. */
const HOME: Pt[] = [
  { x: 1130, y: 770 },
  { x: 1010, y: 768 },
  { x: 1070, y: 740 },
  { x: 1250, y: 770 },
  { x: 945, y: 744 },
  { x: 1195, y: 742 },
]
/** Back row first, so the front row stands in front of it. */
const DRAW_ORDER = [2, 4, 5, 0, 1, 3]
/** Where each sheep grazes on the hills. */
const GRAZE: Required<SPt>[] = [
  { x: 700, y: 872, s: 0.6 },
  { x: 505, y: 848, s: 0.58 },
  { x: 612, y: 752, s: 0.47 },
  { x: 300, y: 874, s: 0.6 },
  { x: 410, y: 740, s: 0.46 },
  { x: 175, y: 766, s: 0.5 },
]
/** Sheep 5 wanders off to the far hill and gets lost. */
const LOST: Required<SPt> = { x: 205, y: 598, s: 0.28 }
const LOST_SHEEP = 5
/** The pebbles Ama takes out at night lie in a row in front of the bag. */
const ROW = (k: number): Pt => ({ x: 1140 + k * 52, y: 918 })
const PEB_S = 1.3
/** Sheep that came home on the night of the watch, and the pebbles from that morning. */
const HOME_COUNT = 5
const PEBBLES = 6
/** How each sheep mills about in the pen when the flock is restless. */
const MILL = [
  { dx: 34, dur: 2.9, delay: 0 },
  { dx: 30, dur: 2.5, delay: 0.5 },
  { dx: 36, dur: 3.3, delay: 0.9 },
  { dx: 30, dur: 2.7, delay: 0.25 },
  { dx: 32, dur: 3.1, delay: 0.7 },
  { dx: 28, dur: 2.8, delay: 1.1 },
]
/** After walking home, a sheep faces the way it walked in: right (-1) or left (1). */
const FACE_HOME = HOME.map((h) => (h.x > GATE_IN.x ? -1 : 1))

/** The two answers, as thought bubbles over the pen, and the question between them. */
const B_ALL: Pt = { x: 925, y: 502 }
const B_MISS: Pt = { x: 1295, y: 502 }
const B_R = 88
const Q_AT: Pt = { x: 1110, y: 530 }

/** The night sky high above the valley, where the big idea is drawn (stage coordinates inside it). */
const SKY_Y = -1010
const MATCH_COLS = [330, 518, 706, 894, 1082, 1270]
const HIST_X = [330, 800, 1270]

/** Camera: the world point at the centre of the stage, and the log of the zoom. */
interface Cam {
  cx: number
  cy: number
  lz: number
}
const cam = (cx: number, cy: number, z: number): Cam => ({ cx, cy, lz: Math.log(z) })
const F = {
  wide: cam(800, 450, 1),
  drift: cam(830, 462, 1.05),
  ama: cam(1160, 690, 1.75),
  meadow: cam(590, 668, 1.6),
  threads: cam(735, 605, 1.3),
  gate: cam(1150, 738, 2.1),
  play: cam(1125, 640, 1.45),
  watch: cam(1150, 716, 1.9),
  lost: cam(360, 540, 2),
  sky: cam(800, SKY_Y + 450, 1),
  meet: cam(760, 610, 1.3),
}

/* ------------------------------------------------------------------ */
/* What Pip sees                                                         */
/* ------------------------------------------------------------------ */

const STATE: string[] = [
  "A wide, sunny valley long, long ago. Ama the shepherd stands by her stone pen with her flock of six sheep inside. The camera eases in on Ama, who waves. There are no numbers yet in this story.",
  'Morning. Ama opens the gate and her six sheep trot out onto the hills to graze.',
  'The sun sets and night falls while the six sheep trot home into the pen. Ama looks unsure, and a pink question mark floats over the flock: with no number words, how can she tell if a sheep is missing?',
  '',
  'Morning again. Ama has an idea: as each sheep walks out of the gate she drops one pebble into her bag, and a teal flash links that sheep to its pebble.',
  'One sheep, one pebble: the rest of the six sheep walk out, one pebble drops into the bag for each, and then teal threads link every grazing sheep to the bag.',
  'Night. As each sheep comes home through the gate, Ama takes one pebble out of the bag and lays it on the ground, with a teal flash linking them. Five sheep come home; one has wandered off to a far hill.',
  'One pebble is left in the bag. It rises up glowing coral (coral means missing), and a coral line leads the camera across the valley to the lost sheep, far off on a hill.',
  'Up in the night sky, a clean chart called Matching: six sheep, six pebbles and six tally marks in columns, each joined one for one by teal links. Same idea, three kinds of things.',
  'A quick, true history of matching: a bone with carved notches about 20,000 years ago (the Ishango bone), clay tokens about 10,000 years ago, and numbers written on clay tablets about 5,000 years ago.',
  '',
]

/* ------------------------------------------------------------------ */
/* Local art                                                             */
/* ------------------------------------------------------------------ */

const CSS = `
.c1-graze .sheep-head { transform-box: fill-box; transform-origin: 85% 85%; animation: c1-nib 2.6s ease-in-out infinite; }
.c1-graze .c1-rig:nth-child(2n) .sheep-head { animation-delay: -1.1s; animation-duration: 3.1s; }
.c1-graze .c1-rig:nth-child(3n) .sheep-head { animation-delay: -0.5s; }
@keyframes c1-nib { 0%, 30%, 100% { transform: rotate(0deg); } 48%, 82% { transform: rotate(calc((1 - var(--walk, 0)) * -26deg)); } }
.c1-pop { transform-box: fill-box; transform-origin: center; animation: c1-pop 0.55s cubic-bezier(0.3, 1.6, 0.5, 1) both; }
@keyframes c1-pop { from { transform: scale(0.2); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.c1-draw { stroke-dasharray: 1 1; animation: c1-draw 1.2s ease-out both; }
@keyframes c1-draw { 0% { stroke-dashoffset: 1; opacity: 1; } 30% { stroke-dashoffset: 0; opacity: 1; } 100% { stroke-dashoffset: 0; opacity: 0; } }
.c1-pulse { transform-box: fill-box; transform-origin: center; animation: c1-pulse 1s ease-in-out infinite; }
@keyframes c1-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.3); opacity: 0.45; } }
.c1-flap { transform-box: fill-box; transform-origin: center; animation: c1-flap 0.42s ease-in-out infinite alternate; }
@keyframes c1-flap { from { transform: scaleY(1); } to { transform: scaleY(-0.5); } }
.c1-choice { transform-box: fill-box; transform-origin: center; transition: transform 0.35s cubic-bezier(0.3, 1.6, 0.5, 1), opacity 0.4s; }
.c1-choice.on { cursor: pointer; }
.c1-choice.on:hover { transform: scale(1.05); }
.c1-choice.picked { transform: scale(1.1); }
.c1-choice.dim { opacity: 0.35; }
.c1-fade { transition: opacity 0.5s; }
.c1-peb { transition: transform 0.35s cubic-bezier(0.3, 1.4, 0.5, 1); }
.c1-peb.held { transition: none; }
.c1-peb.on { cursor: grab; }
.c1-peb.held { cursor: grabbing; }
.flow-paused .c1-graze .sheep-head, .flow-paused .c1-flap, .flow-paused .c1-pulse { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) { .c1-graze .sheep-head, .c1-flap, .c1-pulse { animation: none; } }
`

const STONE = ['#a99f9c', '#c9c1bb', '#b4aba7']

/** A row of dry stones from (x1, y1) to (x2, y2), two courses high. */
function StoneRow({ x1, y1, x2, y2, s = 0.6 }: { x1: number; y1: number; x2: number; y2: number; s?: number }) {
  const len = Math.hypot(x2 - x1, y2 - y1)
  const n = Math.max(2, Math.round(len / (40 * s)))
  const stones: [number, number, number][] = []
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i <= n; i++) {
      const t = Math.min(1, (i + (row % 2) * 0.5) / n)
      stones.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t - row * 20 * s - 10 * s, row])
    }
  }
  return (
    <g>
      {stones.map(([x, y, row], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx={24 * s} ry={14 * s} fill={STONE[(i + row) % 3]} />
          <ellipse cx={x + 5 * s} cy={y + 5 * s} rx={17 * s} ry={7 * s} fill="#7b706f" opacity={0.5} />
        </g>
      ))}
    </g>
  )
}

/** The inside of the pen: a trodden floor, the back wall and the two side walls. */
function PenBack() {
  const half = (PEN.w / 2) * PEN.s
  return (
    <g>
      <path d={`M${PEN.x - half + 10} ${PEN.y} L${PEN.x - half + 44} 722 L${PEN.x + half - 44} 722 L${PEN.x + half - 10} ${PEN.y} Z`} fill={N.shadow} opacity={0.14} />
      <StoneRow x1={PEN.x - half + 40} y1={724} x2={PEN.x + half - 40} y2={724} s={0.5} />
      <StoneRow x1={PEN.x - half + 6} y1={PEN.y - 4} x2={PEN.x - half + 40} y2={724} s={0.62} />
      <StoneRow x1={PEN.x + half - 6} y1={PEN.y - 4} x2={PEN.x + half - 40} y2={724} s={0.62} />
    </g>
  )
}

/** Ama's crook, planted upright in the ground beside her. */
function PlantedCrook({ x, y }: Pt) {
  return (
    <g transform={`translate(${x} ${y}) scale(0.8)`}>
      <ellipse cx={0} cy={2} rx={18} ry={5} fill={N.shadow} opacity={0.3} />
      <path d="M0 0 V-300 Q0 -352 38 -352 Q74 -352 74 -316" stroke={N.woodDark} strokeWidth={12} fill="none" strokeLinecap="round" />
      <path d="M-4 -6 V-296 Q-4 -344 34 -346" stroke={N.woodLight} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.7} />
    </g>
  )
}

/** A little bird, wings flapping. */
function Bird({ x, y, s = 1, d = 0 }: Pt & { s?: number; d?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="c1-flap" style={{ animationDelay: `${-d}s` }}>
        <path d="M-18 0 Q-9 -10 0 0 Q9 -10 18 0" stroke={N.night1} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  )
}

/** A four-point twinkle. */
function Twinkle({ x, y, r = 20, color = N.cream }: Pt & { r?: number; color?: string }) {
  const k = r * 0.22
  return <path d={`M${x} ${y - r} L${x + k} ${y - k} L${x + r} ${y} L${x + k} ${y + k} L${x} ${y + r} L${x - k} ${y + k} L${x - r} ${y} L${x - k} ${y - k} Z`} fill={color} />
}

/** A soft coral light (coral means missing in this lesson). */
function CoralGlow({ x, y, r }: Pt & { r: number }) {
  return <circle cx={x} cy={y} r={r} fill="url(#c1-glow-coral)" />
}

/** A curved link between two points, drawn by animating its dash (pathLength 1). */
function arc(a: Pt, b: Pt, lift = 60) {
  const mx = (a.x + b.x) / 2 + 30
  const my = Math.min(a.y, b.y) - lift
  return `M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}`
}

/** A teal flash linking a sheep and its pebble: a glowing arc with a burst at each end. */
function Flash({ className, a, b, lift = 60 }: { className: string; a: Pt; b: Pt; lift?: number }) {
  return (
    <g className={className} opacity={0} pointerEvents="none">
      <Glow x={a.x} y={a.y} r={70} color="teal" />
      <Glow x={b.x} y={b.y} r={56} color="teal" />
      <path className="c1-fl-path" d={arc(a, b, lift)} pathLength={1} strokeDasharray="1 1" stroke={N.teal} strokeWidth={7} strokeLinecap="round" fill="none" filter="url(#fx-glow)" />
    </g>
  )
}

/* ---- Ama's thought bubbles: the two answers ---- */

function NightDisc({ children }: { children: ReactNode }) {
  const id = `c1-disc-${useId().replace(/:/g, '')}`
  return (
    <g clipPath={`url(#${id})`}>
      <clipPath id={id}>
        <circle r={B_R - 6} />
      </clipPath>
      <circle r={B_R - 6} fill={N.night1} />
      <circle cx={-46} cy={-46} r={11} fill={N.cream} opacity={0.9} />
      {[
        [30, -60],
        [52, -30],
        [-10, -68],
        [-62, -10],
        [10, -40],
      ].map(([sx, sy], i) => (
        <circle key={i} cx={sx} cy={sy} r={2.2} fill={N.white} opacity={0.8} />
      ))}
      {children}
    </g>
  )
}

/** "All home": three sheep snug behind the pen wall under the moon. */
function AllHomePic() {
  return (
    <NightDisc>
      <path d={`M${-B_R} 28 Q0 12 ${B_R} 28 V${B_R} H${-B_R} Z`} fill="#22337a" />
      {[-44, 0, 44].map((sx, i) => (
        <Sheep key={sx} x={sx} y={46 - (i === 1 ? 6 : 0)} s={0.38} flip={i === 2} />
      ))}
      <StoneRow x1={-72} y1={58} x2={72} y2={58} s={0.55} />
    </NightDisc>
  )
}

/** "One missing": one small sheep alone on a far hill, with a coral glow. */
function MissingPic() {
  return (
    <NightDisc>
      <path d={`M${-B_R} 40 Q-20 -14 ${B_R} 34 V${B_R} H${-B_R} Z`} fill="#22337a" />
      <CoralGlow x={4} y={6} r={44} />
      <Sheep x={4} y={22} s={0.4} />
    </NightDisc>
  )
}

/** Little thought circles rising from Ama's head towards her two thoughts. */
function ThoughtTrail() {
  return (
    <g pointerEvents="none">
      {[
        [AMA.x - 46, 684, 6],
        [AMA.x - 94, 672, 8],
        [AMA.x - 146, 652, 10],
      ].map(([tx, ty, r], i) => (
        <circle key={i} cx={tx} cy={ty} r={r} fill={N.cream} opacity={0.9} />
      ))}
    </g>
  )
}

/**
 * The two answers, drawn as Ama's thought bubbles: all home (teal ring) and one missing
 * (coral ring), with the pink question between them. Tapping one answers.
 */
function ChoiceBubbles({ active, picked, onPick }: { active: boolean; picked: 'all' | 'miss' | null; onPick: (c: 'all' | 'miss') => void }) {
  return (
    <g>
      <ThoughtTrail />
      <QMark at={Q_AT} size={120} />
      <ChoiceBubble which="all" active={active} picked={picked} onPick={onPick} />
      <ChoiceBubble which="miss" active={active} picked={picked} onPick={onPick} />
    </g>
  )
}

/** The pink question mark: the question we are trying to answer. */
function QMark({ at, size }: { at: Pt; size: number }) {
  return (
    <g transform={`translate(${at.x} ${at.y})`}>
      <g className="float">
        <Glow r={size * 0.8} color="pink" opacity={0.55} />
        <text y={size * 0.36} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={size} fill={N.pink} stroke={N.shadow} strokeOpacity={0.35} strokeWidth={size * 0.08} paintOrder="stroke">
          ?
        </text>
      </g>
    </g>
  )
}

/* ---- The sky chart and the history ---- */

/** One tally mark, scratched upright. */
function Mark({ x, y, tilt = 0 }: Pt & { tilt?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
      <rect x={-9} y={-62} width={18} height={124} rx={9} fill={N.cream} />
      <rect x={-9} y={-62} width={7} height={124} rx={3.5} fill={N.white} opacity={0.6} />
    </g>
  )
}

/** A teal link in the chart: a bright line over a soft glow, drawn by its dash. */
function ChartLink({ className, x, y1, y2 }: { className: string; x: number; y1: number; y2: number }) {
  const d = `M${x} ${y1} V${y2}`
  return (
    <g className={className}>
      <path d={d} pathLength={1} strokeDasharray="1 1" stroke={N.teal} strokeWidth={22} strokeLinecap="round" opacity={0.25} />
      <path d={d} pathLength={1} strokeDasharray="1 1" stroke={N.tealLight} strokeWidth={8} strokeLinecap="round" />
    </g>
  )
}

function MatchingChart() {
  return (
    <g className="c1-match" data-tutor="the matching chart">
      <rect className="c1-mpanel" x={170} y={70} width={1260} height={760} rx={48} fill={N.night0} opacity={0.62} stroke={N.night3} strokeWidth={3} />
      <g className="c1-mtitle">
        <Title y={190} size={96} color={N.tealLight}>
          Matching
        </Title>
      </g>
      {MATCH_COLS.map((x, k) => (
        <g key={x}>
          <rect className={`c1-mcol c1-mcol-${k}`} x={x - 74} y={286} width={148} height={500} rx={36} fill={N.teal} fillOpacity={0.1} stroke={N.teal} strokeWidth={4} opacity={0} />
          <g className={`c1-ms c1-ms-${k}`}>
            <Sheep x={x} y={392} s={0.72} flip={k % 2 === 1} />
          </g>
          <ChartLink className={`c1-mla c1-mla-${k}`} x={x} y1={414} y2={474} />
          <g className={`c1-mp c1-mp-${k}`}>
            <Pebble x={x} y={512} s={2} seed={k} />
          </g>
          <ChartLink className={`c1-mlb c1-mlb-${k}`} x={x} y1={552} y2={610} />
          <g className={`c1-mm c1-mm-${k}`}>
            <Mark x={x} y={694} tilt={k % 2 ? 4 : -3} />
          </g>
        </g>
      ))}
    </g>
  )
}

const CLAY = { base: '#c98652', light: '#e3a876', dark: '#9a5f36' }

/** The Ishango bone: a long bone with groups of carved notches. Centred on (0, 0). */
function NotchedBone() {
  const notches = [-96, -84, -72, -40, -28, -16, -4, 30, 42, 54, 66, 78]
  return (
    <g data-tutor="the notched bone">
      <ellipse cx={0} cy={44} rx={150} ry={10} fill={N.shadow} opacity={0.3} />
      <circle cx={-136} cy={-12} r={22} fill={N.sandLight} />
      <circle cx={-134} cy={14} r={19} fill={N.sandLight} />
      <circle cx={138} cy={-9} r={19} fill={N.sandLight} />
      <circle cx={136} cy={13} r={17} fill={N.sandLight} />
      <path d="M-134 -18 Q0 -30 136 -18 L136 18 Q0 30 -134 18 Z" fill={N.sandLight} />
      <path d="M-134 6 Q0 18 136 6 L136 18 Q0 30 -134 18 Z" fill={N.sand} opacity={0.7} />
      <path d="M-110 -16 Q0 -26 110 -16" stroke={N.white} strokeWidth={5} fill="none" opacity={0.5} strokeLinecap="round" />
      {notches.map((x, i) => (
        <g key={x} className={`c1-notch c1-notch-${i}`}>
          <path d={`M${x} -22 L${x + 2} 6`} stroke={N.woodDark} strokeWidth={5} strokeLinecap="round" />
        </g>
      ))}
    </g>
  )
}

/** Small clay counting tokens: a cone, a ball, a disc and a cylinder. Centred on (0, 0). */
function ClayTokens() {
  return (
    <g data-tutor="the clay tokens">
      <ellipse cx={0} cy={46} rx={150} ry={10} fill={N.shadow} opacity={0.3} />
      <g className="c1-tok c1-tok-0" transform="translate(-96 0)">
        <path d="M-26 34 L0 -30 L26 34 Q0 46 -26 34 Z" fill={CLAY.base} />
        <path d="M0 -30 L26 34 Q14 40 4 41 Z" fill={CLAY.dark} opacity={0.6} />
      </g>
      <g className="c1-tok c1-tok-1" transform="translate(-30 8)">
        <circle cy={2} r={30} fill={CLAY.base} />
        <circle cx={-9} cy={-8} r={10} fill={CLAY.light} opacity={0.8} />
        <path d="M26 -12 A30 30 0 0 1 -14 30 A34 34 0 0 0 26 -12 Z" fill={CLAY.dark} opacity={0.5} />
      </g>
      <g className="c1-tok c1-tok-2" transform="translate(40 20)">
        <ellipse cy={10} rx={34} ry={13} fill={CLAY.dark} />
        <rect x={-34} y={-2} width={68} height={12} fill={CLAY.dark} />
        <ellipse cy={-2} rx={34} ry={13} fill={CLAY.base} />
        <ellipse cx={-8} cy={-5} rx={14} ry={5} fill={CLAY.light} opacity={0.8} />
      </g>
      <g className="c1-tok c1-tok-3" transform="translate(104 4)">
        <rect x={-18} y={-26} width={36} height={60} rx={14} fill={CLAY.base} />
        <rect x={4} y={-26} width={14} height={60} rx={7} fill={CLAY.dark} opacity={0.5} />
        <ellipse cy={-24} rx={18} ry={6} fill={CLAY.light} />
      </g>
    </g>
  )
}

/** A clay tablet with written numbers (wedge marks). Centred on (0, 0). */
function Tablet() {
  const wedge = (x: number, y: number, i: number) => (
    <g key={`${x}-${y}`} className={`c1-wedge c1-wedge-${i}`}>
      <path d={`M${x - 9} ${y - 22} L${x + 9} ${y - 22} L${x} ${y - 8} Z`} fill={CLAY.dark} />
      <path d={`M${x} ${y - 12} V${y + 22}`} stroke={CLAY.dark} strokeWidth={5} strokeLinecap="round" />
    </g>
  )
  const corner = (x: number, y: number, i: number) => (
    <g key={`c${x}`} className={`c1-wedge c1-wedge-${i}`}>
      <path d={`M${x + 18} ${y - 20} L${x - 14} ${y} L${x + 18} ${y + 20}`} stroke={CLAY.dark} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`M${x - 20} ${y - 8} L${x - 8} ${y} L${x - 20} ${y + 8} Z`} fill={CLAY.dark} />
    </g>
  )
  return (
    <g data-tutor="the clay tablet with numbers">
      <ellipse cx={0} cy={96} rx={130} ry={10} fill={N.shadow} opacity={0.3} />
      <rect x={-118} y={-84} width={236} height={176} rx={30} fill={CLAY.dark} />
      <rect x={-118} y={-90} width={236} height={172} rx={30} fill={CLAY.base} />
      <rect x={-102} y={-76} width={204} height={144} rx={22} fill="none" stroke={CLAY.light} strokeWidth={3} opacity={0.6} />
      {[wedge(-70, -36, 0), wedge(-46, -36, 1), wedge(-22, -36, 2), corner(30, -36, 3), wedge(64, -36, 4), corner(-56, 26, 5), corner(-20, 26, 6), wedge(28, 26, 7), wedge(52, 26, 8), wedge(76, 26, 9)]}
    </g>
  )
}

function History() {
  const date = (x: number, num: string) => (
    <g>
      <Title x={x} y={722} size={60}>
        {num}
      </Title>
      <Title x={x} y={776} size={38} color={N.mist} weight={700}>
        years ago
      </Title>
    </g>
  )
  return (
    <g className="c1-hist">
      <path className="c1-harrow" d="M110 626 H1430" pathLength={1} strokeDasharray="1 1" stroke={N.cream} strokeWidth={8} strokeLinecap="round" opacity={0.85} />
      <path className="c1-hhead" d="M1420 604 L1456 626 L1420 648" stroke={N.cream} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
      {HIST_X.map((x, i) => (
        <g key={x} className={`c1-hst c1-hst-${i}`}>
          <Glow x={x} y={430} r={270} color="cool" opacity={0.6} />
          <circle cx={x} cy={626} r={16} fill={N.cream} />
          <g transform={`translate(${x} ${i === 2 ? 420 : 446}) scale(1.35)`}>
            <g className={`c1-hpic c1-hpic-${i}`}>{i === 0 ? <NotchedBone /> : i === 1 ? <ClayTokens /> : <Tablet />}</g>
          </g>
          {date(x, ['20,000', '10,000', '5,000'][i])}
        </g>
      ))}
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* A sheep on the stage, with every handle the animation needs          */
/* ------------------------------------------------------------------ */

/**
 * Nested groups, outside in: .sh (walks: x, y, --walk), .shh (hops), .shm (mills about
 * in the pen), .shs (perspective scale), .shd (faces left 1 or right -1), .shf (turns
 * while milling). The sheep's feet are at (0, 0) of every inner group.
 */
function SheepRig({ i, pebble, tutor }: { i: number; pebble: number | null; tutor: string }) {
  const k = 1 / SHEEP_S
  return (
    <g className={`c1-rig sh-${i}`}>
      <g className={`shh-${i}`}>
        <g className={`shm-${i}`}>
          <g className={`shs-${i}`}>
            <g className={`shd-${i}`}>
              <g className={`shf-${i}`}>
                {pebble !== null && <Glow y={-60} r={120} color="teal" opacity={0.9} />}
                <g className={`c1-body-${i}`}>
                  <Sheep tutor={tutor} />
                </g>
                {pebble !== null && (
                  <g transform={`translate(0 ${-112}) scale(${k})`}>
                    <g className="c1-pop">
                      <circle r={25} fill="none" stroke={N.teal} strokeWidth={5} />
                      <Pebble s={1.1} seed={pebble} />
                    </g>
                  </g>
                )}
              </g>
            </g>
          </g>
        </g>
      </g>
    </g>
  )
}

/** Ama in all her moods, stacked; the timeline shows one at a time. */
const AMA_V = {
  idle: { pose: 'down', face: 'smile', flip: false },
  wave: { pose: 'wave', face: 'smile', flip: false },
  point: { pose: 'point', face: 'smile', flip: true },
  drop: { pose: 'point', face: 'calm', flip: true },
  think: { pose: 'think', face: 'think', flip: false },
  idea: { pose: 'cheer', face: 'wow', flip: false },
  wow: { pose: 'down', face: 'wow', flip: false },
  cheer: { pose: 'cheer', face: 'smile', flip: false },
} as const
type AmaMood = keyof typeof AMA_V

/* ------------------------------------------------------------------ */
/* The scene                                                             */
/* ------------------------------------------------------------------ */

interface CamApi {
  cam: Cam
  apply: () => void
}

export function Ch1Pebbles({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints, memory }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const worldRef = useRef<SVGGElement>(null)
  const camApi = useRef<CamApi | null>(null)

  // The quick guess.
  const [picked, setPicked] = useState<'all' | 'miss' | null>(null)
  // The night watch: which pebble each sheep that came home carries.
  const [matched, setMatched] = useState<(number | null)[]>(() => Array(HOME_COUNT).fill(null))
  const [drag, setDrag] = useState<{ k: number; x: number; y: number } | null>(null)
  const [links, setLinks] = useState<{ id: number; a: Pt; b: Pt }[]>([])
  const [wrong, setWrong] = useState(false)
  const [won, setWon] = useState(false)
  const [watchReady, setWatchReady] = useState(false)
  const lastLine = useRef(0)
  const linkId = useRef(0)
  const endTl = useRef<gsap.core.Timeline | null>(null)
  const endCtx = useRef<gsap.Context | null>(null)
  const pullTween = useRef<gsap.core.Tween | null>(null)
  const mills = useRef(new Map<number, gsap.core.Timeline>())
  const cueRef = useRef(cueIndex)
  cueRef.current = cueIndex
  const playDoneRef = useRef(onPlayDone)
  playDoneRef.current = onPlayDone
  const playingRef = useRef(playing)
  playingRef.current = playing

  const guessing = cueIndex === 3 && picked === null
  const watching = cueIndex === 10 && !won
  const used = new Set(matched.filter((m): m is number => m !== null))
  const allMatched = matched.every((m) => m !== null)
  const leftover = Array.from({ length: PEBBLES }, (_, k) => k).find((k) => !used.has(k)) ?? PEBBLES - 1

  const build = useCallback((tl: gsap.core.Timeline) => {
    const el = root.current
    const world = worldRef.current
    if (!el || !world) return
    const skyL = el.querySelector('.c1-skyL')
    const later = { immediateRender: false }

    /* The camera: a plain object that every move tweens; the far stars follow it at 0.6. */
    const c: Cam = { ...F.wide }
    const apply = () => {
      const z = Math.exp(c.lz)
      world.setAttribute('transform', `matrix(${z} 0 0 ${z} ${800 - z * c.cx} ${450 - z * c.cy})`)
      const p = 0.6
      const zl = Math.exp(c.lz * p)
      const cx = 800 + (c.cx - 800) * p
      const cy = 450 + (c.cy - 450) * p
      skyL?.setAttribute('transform', `matrix(${zl} 0 0 ${zl} ${800 - zl * cx} ${450 - zl * cy})`)
    }
    camApi.current = { cam: c, apply }
    let cur: Cam = { ...F.wide }
    const move = (at: number, dur: number, to: Partial<Cam>, ease = 'power2.inOut') => {
      const from: Partial<Cam> = {}
      for (const key of Object.keys(to) as (keyof Cam)[]) from[key] = cur[key]
      tl.fromTo(c, from, { ...to, duration: dur, ease, ...later, onUpdate: apply }, at)
      cur = { ...cur, ...to }
    }

    /* Ama's moods, with a little squash each time she changes. */
    const mood = (name: AmaMood, at: number) => {
      tl.set('.c1-ama-v', { opacity: 0 }, at)
      tl.set(`.c1-ama-${name}`, { opacity: 1 }, at)
      tl.fromTo('.c1-ama-b', { scaleY: 0.93, scaleX: 1.04 }, { scaleY: 1, scaleX: 1, duration: 0.4, ease: 'back.out(3)', ...later }, at)
    }

    /* Sheep: where each one is, which way it faces and how big it is (perspective). */
    const sp = HOME.map((h) => ({ x: h.x, y: h.y, s: SHEEP_S, face: 1 }))
    /** Walk sheep i through these points. `face` turns it once at the start and keeps it facing that way. */
    const trot = (i: number, pts: SPt[], at: number, speed = 360, face?: 1 | -1) => {
      let t = at
      tl.set(`.sh-${i}`, { '--walk': 1 }, t)
      if (face !== undefined && face !== sp[i].face) {
        tl.to(`.shd-${i}`, { scaleX: face, duration: 0.2, ease: 'power1.inOut' }, t)
        sp[i].face = face
      }
      pts.forEach((p, n) => {
        const st = sp[i]
        const dur = Math.max(0.16, Math.hypot(p.x - st.x, p.y - st.y) / speed)
        if (face === undefined && Math.abs(p.x - st.x) > 8) {
          const face = p.x < st.x ? 1 : -1
          if (face !== st.face) {
            tl.to(`.shd-${i}`, { scaleX: face, duration: 0.2, ease: 'power1.inOut' }, t)
            st.face = face
          }
        }
        const ease = n === pts.length - 1 ? 'power1.out' : 'none'
        tl.to(`.sh-${i}`, { x: p.x, y: p.y, duration: dur, ease }, t)
        if (p.s !== undefined && p.s !== st.s) {
          tl.to(`.shs-${i}`, { scale: p.s, duration: dur, ease }, t)
          st.s = p.s
        }
        st.x = p.x
        st.y = p.y
        t += dur
      })
      tl.set(`.sh-${i}`, { '--walk': 0 }, t)
      return t
    }
    /** How long sheep i takes to walk these points at this speed. */
    const span = (i: number, pts: Pt[], speed: number) => {
      let { x, y } = sp[i]
      let d = 0
      for (const p of pts) {
        d += Math.max(0.16 * speed, Math.hypot(p.x - x, p.y - y))
        x = p.x
        y = p.y
      }
      return d / speed
    }
    const hop = (i: number, at: number, h = 16) => tl.fromTo(`.shh-${i}`, { y: 0 }, { y: -h, duration: 0.16, yoyo: true, repeat: 1, ease: 'power1.out', ...later }, at)
    const bagBounce = (at: number) => tl.fromTo('.c1-bagb', { scaleY: 0.88, scaleX: 1.08 }, { scaleY: 1, scaleX: 1, duration: 0.45, ease: 'elastic.out(1, 0.4)', ...later }, at)
    const flash = (sel: string, at: number) => {
      tl.fromTo(`${sel} .c1-fl-path`, { attr: { 'stroke-dashoffset': 1 } }, { attr: { 'stroke-dashoffset': 0 }, duration: 0.28, ease: 'power2.out', ...later }, at)
      tl.fromTo(sel, { opacity: 0 }, { opacity: 1, duration: 0.08, ...later }, at)
      tl.to(sel, { opacity: 0, duration: 0.45, ease: 'power1.in' }, at + 0.35)
    }
    const gate = (open: boolean, at: number) => tl.to('.pen-gate', { scaleX: open ? 0.12 : 1, duration: 0.55, ease: open ? 'back.out(1.4)' : 'back.out(2)' }, at)

    /* Time of day. The Valley holds every sky at once; these fade between them. */
    const dusk = (at: number, d = 1) => {
      tl.to('.vl-sun', { y: 560, duration: 2.4 * d, ease: 'power1.in' }, at)
      tl.to('.c1-sunset', { opacity: 1, duration: 1.1 * d, ease: 'sine.inOut' }, at + 0.2 * d)
      tl.to('.vl-dusk', { opacity: 1, duration: 1.5 * d, ease: 'sine.inOut' }, at + 0.5 * d)
      tl.to('.vl-land-night', { opacity: 0.45, duration: 1.5 * d }, at + 0.5 * d)
    }
    const night = (at: number, d = 1) => {
      tl.to('.c1-sunset', { opacity: 0, duration: 1.2 * d }, at)
      tl.to('.vl-night', { opacity: 1, duration: 1.6 * d, ease: 'sine.inOut' }, at)
      tl.to('.c1-wstars', { opacity: 1, duration: 1.6 * d, ease: 'sine.inOut' }, at)
      tl.to('.vl-land-night', { opacity: 1, duration: 1.6 * d }, at + 0.01)
      tl.to('.vl-moon', { y: 0, duration: 2.4 * d, ease: 'power2.out' }, at + 0.2 * d)
      tl.to('.c1-flies', { opacity: 1, duration: 1.2 * d }, at + 1.0 * d)
    }
    const morning = (at: number, d = 1) => {
      tl.to('.c1-flies', { opacity: 0, duration: 0.6 * d }, at)
      tl.to('.vl-moon', { y: 420, duration: 1.4 * d, ease: 'power1.in' }, at)
      tl.to('.vl-night', { opacity: 0, duration: 0.9 * d, ease: 'sine.inOut' }, at)
      tl.to('.c1-wstars', { opacity: 0, duration: 0.9 * d, ease: 'sine.inOut' }, at)
      tl.to('.vl-land-night', { opacity: 0.45, duration: 0.9 * d }, at)
      tl.to('.c1-dawnglow', { opacity: 1, duration: 0.7 * d }, at + 0.3 * d)
      tl.to('.vl-dusk', { opacity: 0, duration: 1.0 * d, ease: 'sine.inOut' }, at + 0.95 * d)
      tl.to('.vl-land-night', { opacity: 0, duration: 1.0 * d }, at + 0.95 * d)
      tl.to('.c1-dawnglow', { opacity: 0, duration: 0.8 * d }, at + 1.4 * d)
      tl.to('.vl-sun', { y: 0, duration: 1.7 * d, ease: 'power2.out' }, at + 0.7 * d)
    }

    /* ---------------- Starting state: a sunny morning, the flock in the pen ---------------- */
    tl.set(c, { ...F.wide, onComplete: apply })
    tl.set('.vl-dusk', { opacity: 0 })
    tl.set('.vl-night', { opacity: 0 })
    tl.set('.vl-land-night', { opacity: 0 })
    tl.set('.vl-sun', { y: 0 })
    tl.set('.vl-moon', { y: 420 })
    tl.set(['.c1-sunset', '.c1-dawnglow', '.c1-flies', '.c1-wstars', '.c1-lostglow', '.c1-q', '.c1-tg', '.c1-coral', '.c1-spark', '.c1-th', '.c1-bagglow', '.c1-sp', '.c1-sky', '.c1-hist', '.c1-game'], { opacity: 0 })
    tl.set('.c1-vig', { opacity: 1 })
    tl.set('.pen-gate', { scaleX: 1, transformOrigin: '0% 50%' })
    tl.set('.c1-ama-v', { opacity: 0 })
    tl.set('.c1-ama-idle', { opacity: 1 })
    tl.set('.c1-ama-b', { svgOrigin: `${AMA.x} ${AMA.y}` })
    tl.set('.c1-bagb', { svgOrigin: `${BAG.x} ${BAG.y}` })
    HOME.forEach((h, i) => {
      tl.set(`.sh-${i}`, { x: h.x, y: h.y, '--walk': 0 })
      tl.set(`.shs-${i}`, { scale: SHEEP_S, svgOrigin: '0 0' })
      tl.set(`.shd-${i}`, { scaleX: 1, svgOrigin: '0 0' })
      tl.set(`.shf-${i}`, { scaleX: 1, svgOrigin: '0 0' })
    })
    for (let k = 0; k < PEBBLES; k++) {
      tl.set(`.c1-sp-${k}`, { x: HAND.x, y: HAND.y })
      tl.set(`.c1-sps-${k}`, { scale: 1, svgOrigin: '0 0' })
    }
    tl.set('.c1-spcoral', { opacity: 0 })
    tl.set('.c1-qs', { scale: 0, svgOrigin: '0 0' })
    tl.set('.c1-q', { x: 1100, y: 612 })
    tl.set(['.c1-tgb-0', '.c1-tgb-1'], { scale: 0.3, svgOrigin: '0 0' })
    tl.set('.c1-fl-path', { attr: { 'stroke-dashoffset': 1 } })
    tl.set('.c1-th path', { attr: { 'stroke-dashoffset': 1 } })
    tl.set('.c1-coral path', { attr: { 'stroke-dashoffset': 1 } })
    tl.set(['.c1-ms', '.c1-mp', '.c1-mm'], { opacity: 0, y: 24 })
    tl.set(['.c1-mla path', '.c1-mlb path'], { attr: { 'stroke-dashoffset': 1 } })
    tl.set(['.c1-mpanel', '.c1-mtitle'], { opacity: 0 })
    tl.set('.c1-mtitle', { scale: 0.6, svgOrigin: '800 160' })
    tl.set('.c1-harrow', { attr: { 'stroke-dashoffset': 1 } })
    tl.set('.c1-hhead', { opacity: 0 })
    tl.set('.c1-hst', { opacity: 0 })
    tl.set('.c1-hpic', { scale: 0.4, svgOrigin: '0 0' })
    tl.set('.c1-notch', { opacity: 0 })
    tl.set('.c1-tok', { opacity: 0, y: -60 })
    tl.set('.c1-wedge', { opacity: 0 })
    tl.set('.c1-birds', { x: 0, y: 0 })
    tl.set('.vl-clouds', { x: 0 })

    /* 0. Wide on the valley in daylight, then the camera eases in on Ama by her pen. */
    tl.addLabel('b0', 0)
    move(0, 2.4, F.drift, 'sine.inOut')
    move(2.4, 3.6, F.ama, 'power2.inOut')
    tl.fromTo('.vl-clouds', { x: 0 }, { x: 90, duration: 24, ease: 'none', ...later }, 0)
    tl.fromTo('.c1-birds', { x: 0, y: 0 }, { x: -1250, y: -60, duration: 9, ease: 'none', ...later }, 0.2)
    tl.to('.c1-birds', { opacity: 0, duration: 1 }, 8.4)
    mood('wave', 4.3)
    hop(0, 5.0)
    hop(3, 5.25)
    hop(2, 5.5)
    mood('idle', 6.2)

    /* 1. Morning: the gate swings open and the sheep trot out to the hills. */
    tl.addLabel('b1', 6.4)
    const b1 = tl.labels.b1
    mood('point', b1 + 0.15)
    gate(true, b1 + 0.35)
    move(b1 + 0.6, 3.4, F.meadow, 'power2.inOut')
    HOME.forEach((_, i) => {
      const t = trot(i, [GATE_IN, GATE_OUT], b1 + 0.7 + i * 0.4, 380, 1)
      trot(i, [LANE, GRAZE[i]], t, 380)
    })
    mood('idle', b1 + 4.2)

    /* 2. Sunset to night; the flock trots home. Ama can't tell if one is missing. */
    tl.addLabel('b2', b1 + 6.0)
    const b2 = tl.labels.b2
    dusk(b2, 1)
    night(b2 + 2.0, 1)
    const order2 = [0, 2, 1, 4, 3, 5]
    order2.forEach((i, n) => trot(i, [LANE, GATE_OUT, GATE_IN, HOME[i]], b2 + 0.6 + n * 0.32, 400))
    gate(false, b2 + 5.2)
    move(b2 + 1.2, 3.8, F.ama, 'power2.inOut')
    mood('think', b2 + 4.4)
    tl.to('.c1-q', { opacity: 1, duration: 0.2 }, b2 + 5.2)
    tl.to('.c1-qs', { scale: 1, duration: 0.6, ease: 'back.out(2.4)' }, b2 + 5.2)

    /* 3. The quick guess: the flock mills about, and Ama's two thoughts appear. */
    tl.addLabel('b3', b2 + 7.0)
    const b3 = tl.labels.b3
    move(b3, 1.6, F.play, 'power2.inOut')
    tl.to('.c1-q', { x: Q_AT.x, y: Q_AT.y, duration: 1.2, ease: 'power2.inOut' }, b3 + 0.2)
    tl.to('.c1-tg', { opacity: 1, duration: 0.3 }, b3 + 0.8)
    tl.to('.c1-tgb-0', { scale: 1, duration: 0.6, ease: 'back.out(2)' }, b3 + 0.8)
    tl.to('.c1-tgb-1', { scale: 1, duration: 0.6, ease: 'back.out(2)' }, b3 + 1.05)

    /* 4. Ama's idea, and morning again: one pebble into the bag for each sheep at the gate. */
    tl.addLabel('b4', b3 + 2.0)
    const b4 = tl.labels.b4
    tl.to(['.c1-tg', '.c1-q'], { opacity: 0, duration: 0.4 }, b4)
    mood('idea', b4 + 0.2)
    tl.fromTo('.c1-spark', { opacity: 0, scale: 0.3, svgOrigin: `${AMA.x} ${AMA.y - 300}` }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(3)', ...later }, b4 + 0.25)
    tl.to('.c1-spark', { opacity: 0, duration: 0.5 }, b4 + 1.5)
    morning(b4 + 0.7, 0.9)
    move(b4 + 0.5, 2.6, F.gate, 'power2.inOut')
    mood('idle', b4 + 1.9)
    gate(true, b4 + 2.6)

    /** Sheep i steps out of the gate at T and stands while its pebble drops in, then trots off. */
    const outBeat = (i: number, T: number, pause: number, speed = 330, outSpeed = 400) => {
      const pts = [GATE_IN, GATE_OUT]
      trot(i, pts, T - span(i, pts, speed), speed, 1)
      trot(i, [LANE, GRAZE[i]], T + pause, outSpeed)
      const p = `.c1-sp-${i}`
      tl.set(p, { x: HAND.x, y: HAND.y, opacity: 1 }, T - 0.12)
      tl.fromTo(`.c1-sps-${i}`, { scale: 0 }, { scale: 1, duration: 0.16, ease: 'back.out(3)', ...later }, T - 0.12)
      tl.to(p, { x: MOUTH.x, y: MOUTH.y, duration: 0.3, ease: 'power2.in' }, T + 0.1)
      tl.to(`.c1-sps-${i}`, { scale: 0.6, duration: 0.1 }, T + 0.4)
      tl.to(p, { opacity: 0, duration: 0.1 }, T + 0.4)
      bagBounce(T + 0.4)
      flash(`.c1-fd-${i % 2}`, T + 0.4)
    }
    mood('drop', b4 + 3.6)
    outBeat(0, b4 + 4.6, 0.75)
    outBeat(1, b4 + 6.5, 0.7)

    /* 5. One sheep, one pebble, in rhythm; then threads from every sheep to the bag. */
    tl.addLabel('b5', b4 + 7.6)
    const b5 = tl.labels.b5
    outBeat(2, b5 + 0.35, 0.5)
    outBeat(3, b5 + 1.85, 0.5)
    outBeat(4, b5 + 3.1, 0.4, 330, 470)
    outBeat(5, b5 + 3.95, 0.35, 330, 520)
    move(b5 + 4.3, 1.9, F.threads, 'power2.inOut')
    mood('idle', b5 + 4.5)
    tl.to('.c1-th', { opacity: 1, duration: 0.1 }, b5 + 5.4)
    GRAZE.forEach((_, i) => {
      tl.fromTo(`.c1-th-${i} path`, { attr: { 'stroke-dashoffset': 1 } }, { attr: { 'stroke-dashoffset': 0 }, duration: 0.55, ease: 'power2.out', ...later }, b5 + 5.4 + i * 0.1)
    })
    tl.fromTo('.c1-bagglow', { opacity: 0 }, { opacity: 1, duration: 0.5, ...later }, b5 + 5.9)

    /* 6. Night again: each sheep that comes home takes one pebble out of the bag. */
    tl.addLabel('b6', b5 + 6.7)
    const b6 = tl.labels.b6
    tl.to(['.c1-th', '.c1-bagglow'], { opacity: 0, duration: 0.5 }, b6)
    dusk(b6, 0.5)
    night(b6 + 0.8, 0.6)
    move(b6 + 0.2, 1.8, F.gate, 'power2.inOut')
    trot(LOST_SHEEP, [{ x: 190, y: 680, s: 0.4 }, LOST], b6 + 0.3, 150)
    mood('drop', b6 + 1.0)
    for (let k = 0; k < HOME_COUNT; k++) {
      const T = b6 + 1.5 + k * 0.62
      const pts = [LANE, GATE_OUT]
      trot(k, pts, T - span(k, pts, 430), 430)
      trot(k, [GATE_IN, HOME[k]], T + 0.3, 380)
      const p = `.c1-sp-${k}`
      const r = ROW(k)
      tl.set(p, { x: MOUTH.x, y: MOUTH.y, opacity: 1 }, T - 0.05)
      tl.fromTo(`.c1-sps-${k}`, { scale: 0.6 }, { scale: 1, duration: 0.3, ...later }, T - 0.05)
      tl.to(p, { x: r.x, duration: 0.42, ease: 'none' }, T - 0.05)
      tl.to(p, { y: MOUTH.y - 70, duration: 0.18, ease: 'power2.out' }, T - 0.05)
      tl.to(p, { y: r.y, duration: 0.24, ease: 'power2.in' }, T + 0.13)
      tl.fromTo(`.c1-sps-${k}`, { scale: 1.25 }, { scale: 1, duration: 0.3, ease: 'back.out(3)', ...later }, T + 0.37)
      bagBounce(T - 0.05)
      flash(`.c1-fh-${k}`, T + 0.37)
    }
    mood('idle', b6 + 4.8)

    /* 7. One pebble is left over. It glows coral, and a coral line leads to the lost sheep. */
    tl.addLabel('b7', b6 + 5.3)
    const b7 = tl.labels.b7
    const LEFT_AT = { x: BAG.x, y: 694 }
    mood('wow', b7 + 0.2)
    tl.set('.c1-sp-5', { x: MOUTH.x, y: MOUTH.y, opacity: 1 }, b7 + 0.6)
    tl.fromTo('.c1-sps-5', { scale: 0.5 }, { scale: 1.7, duration: 0.7, ease: 'back.out(2)', ...later }, b7 + 0.6)
    tl.to('.c1-sp-5', { x: LEFT_AT.x, y: LEFT_AT.y, duration: 0.7, ease: 'power2.out' }, b7 + 0.6)
    bagBounce(b7 + 0.6)
    tl.to('.c1-spcoral', { opacity: 1, duration: 0.4 }, b7 + 1.0)
    mood('point', b7 + 2.6)
    tl.to('.c1-coral', { opacity: 1, duration: 0.1 }, b7 + 2.7)
    tl.to('.c1-coral path', { attr: { 'stroke-dashoffset': 0 }, duration: 2.0, ease: 'power1.inOut' }, b7 + 2.7)
    move(b7 + 2.6, 2.6, F.lost, 'power2.inOut')
    tl.to('.c1-lostglow', { opacity: 1, duration: 0.8 }, b7 + 4.2)
    hop(LOST_SHEEP, b7 + 4.8, 10)
    hop(LOST_SHEEP, b7 + 5.2, 10)

    /* 8. Up into the night sky: matching, drawn as a clean chart. */
    tl.addLabel('b8', b7 + 6.0)
    const b8 = tl.labels.b8
    move(b8, 2.2, F.sky, 'power2.inOut')
    tl.to(['.c1-coral', '.c1-lostglow'], { opacity: 0, duration: 0.6 }, b8 + 0.3)
    // Out of sight, the left-over pebble joins the others for the night watch.
    tl.set('.c1-sp-5', ROW(5), b8 + 1.0)
    tl.set('.c1-sps-5', { scale: 1 }, b8 + 1.0)
    tl.set('.c1-spcoral', { opacity: 0 }, b8 + 1.0)
    mood('idle', b8 + 1.0)
    tl.set('.c1-sky', { opacity: 1 }, b8)
    tl.to('.c1-mpanel', { opacity: 1, duration: 0.8 }, b8 + 1.3)
    MATCH_COLS.forEach((_, k) => {
      tl.to(`.c1-ms-${k}`, { opacity: 1, y: 0, duration: 0.45, ease: 'back.out(2.2)' }, b8 + 1.6 + k * 0.12)
      tl.to(`.c1-mla-${k} path`, { attr: { 'stroke-dashoffset': 0 }, duration: 0.3, ease: 'power2.out' }, b8 + 3.6 + k * 0.22)
      tl.to(`.c1-mp-${k}`, { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(2.5)' }, b8 + 3.75 + k * 0.22)
      tl.to(`.c1-mlb-${k} path`, { attr: { 'stroke-dashoffset': 0 }, duration: 0.3, ease: 'power2.out' }, b8 + 5.3 + k * 0.16)
      tl.to(`.c1-mm-${k}`, { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(2.5)' }, b8 + 5.45 + k * 0.16)
      tl.fromTo(`.c1-mcol-${k}`, { opacity: 0 }, { opacity: 1, duration: 0.3, yoyo: true, repeat: 1, ease: 'sine.inOut', ...later }, b8 + 7.0 + k * 0.16)
    })
    tl.to('.c1-mtitle', { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(2)' }, b8 + 2.9)

    /* 9. A quick history: notched bone, clay tokens, numbers written on clay. */
    tl.addLabel('b9', b8 + 8.8)
    const b9 = tl.labels.b9
    tl.to('.c1-match', { opacity: 0, duration: 0.7, ease: 'power1.in' }, b9)
    tl.set('.c1-hist', { opacity: 1 }, b9)
    tl.to('.c1-harrow', { attr: { 'stroke-dashoffset': 0 }, duration: 1.4, ease: 'power2.inOut' }, b9 + 0.2)
    tl.to('.c1-hhead', { opacity: 0.85, duration: 0.3 }, b9 + 1.5)
    const station = (i: number, at: number) => {
      tl.to(`.c1-hst-${i}`, { opacity: 1, duration: 0.4 }, at)
      tl.to(`.c1-hpic-${i}`, { scale: 1, duration: 0.7, ease: 'back.out(2)' }, at)
    }
    station(0, b9 + 2.6)
    for (let n = 0; n < 12; n++) tl.to(`.c1-notch-${n}`, { opacity: 1, duration: 0.08 }, b9 + 3.3 + n * 0.14)
    station(1, b9 + 6.9)
    for (let n = 0; n < 4; n++) tl.to(`.c1-tok-${n}`, { opacity: 1, y: 0, duration: 0.5, ease: 'bounce.out' }, b9 + 7.1 + n * 0.16)
    station(2, b9 + 9.0)
    for (let n = 0; n < 10; n++) tl.to(`.c1-wedge-${n}`, { opacity: 1, duration: 0.08 }, b9 + 9.3 + n * 0.07)

    /* 10. Back down to the pen for the learner's own night watch. */
    tl.addLabel('b10', b9 + 10.4)
    const b10 = tl.labels.b10
    tl.to('.c1-hist', { opacity: 0, duration: 0.6 }, b10)
    move(b10 + 0.2, 2.6, F.watch, 'power2.inOut')
    tl.set('.c1-sp', { opacity: 0 }, b10)
    tl.set('.c1-game', { opacity: 1 }, b10)
    for (let k = 0; k < PEBBLES; k++) {
      tl.fromTo(`.c1-gpw-${k}`, { scale: 1 }, { scale: 1.3, duration: 0.2, yoyo: true, repeat: 1, ease: 'sine.inOut', svgOrigin: `${ROW(k).x} ${ROW(k).y}`, ...later }, b10 + 3.0 + k * 0.14)
    }
    tl.addLabel('b11', b10 + 4.2)
  }, [])

  /** The night watch's picture settles once the camera is back down; only then can it end. */
  const animDone = useCallback(() => {
    if (cueRef.current === 10) setWatchReady(true)
    onAnimDone()
  }, [onAnimDone])
  useBeatTimeline(root, build, cueIndex, playing, animDone)

  /* ---------------- The flock mills about in the pen (the quick guess and the night watch) ---------------- */
  useEffect(() => {
    const el = root.current
    if (!el) return
    const want = new Set<number>()
    if (cueIndex === 3) HOME.forEach((_, i) => want.add(i))
    if (cueIndex === 10 && !won) matched.forEach((m, i) => m === null && want.add(i))
    const running = mills.current
    for (const [i, t] of running) {
      if (want.has(i)) continue
      t.kill()
      running.delete(i)
      const m = el.querySelector<SVGGElement>(`.shm-${i}`)
      const f = el.querySelector(`.shf-${i}`)
      gsap.to(m, { x: 0, duration: 0.6, ease: 'power2.out' })
      gsap.to(f, { scaleX: 1, svgOrigin: '0 0', duration: 0.25 })
      m?.style.removeProperty('--walk')
    }
    for (const i of want) {
      if (running.has(i)) continue
      const m = el.querySelector<SVGGElement>(`.shm-${i}`)
      const f = el.querySelector(`.shf-${i}`)
      if (!m || !f) continue
      const dx = FACE_HOME[i] === -1 ? MILL[i].dx : -MILL[i].dx
      m.style.setProperty('--walk', '1')
      const t = gsap.timeline({ repeat: -1, delay: MILL[i].delay, paused: !playingRef.current })
      t.to(m, { x: dx, duration: MILL[i].dur, ease: 'sine.inOut' })
        .to(f, { scaleX: -1, svgOrigin: '0 0', duration: 0.22, ease: 'power1.inOut' })
        .to(m, { x: 0, duration: MILL[i].dur, ease: 'sine.inOut' })
        .to(f, { scaleX: 1, svgOrigin: '0 0', duration: 0.22, ease: 'power1.inOut' })
      running.set(i, t)
    }
  }, [cueIndex, matched, won])

  // Pause and resume everything that runs outside the main timeline.
  useEffect(() => {
    for (const t of mills.current.values()) {
      if (playing) t.resume()
      else t.pause()
    }
    for (const e of [endTl.current, pullTween.current]) {
      if (!e) continue
      if (playing) e.resume()
      else e.pause()
    }
  }, [playing])

  useEffect(
    () => () => {
      for (const t of mills.current.values()) t.kill()
      mills.current.clear()
      endTl.current?.kill()
      endCtx.current?.kill()
      pullTween.current?.kill()
    },
    [],
  )

  /* ---------------- Every sheep has a pebble: the camera eases back to show Ama's two thoughts ---------------- */
  const pulledBack = useRef(false)
  useEffect(() => {
    const api = camApi.current
    if (cueIndex !== 10 || !allMatched || !watchReady || pulledBack.current || !api) return
    pulledBack.current = true
    const t = gsap.to(api.cam, { ...F.play, duration: 1.4, ease: 'power2.inOut', onUpdate: api.apply, paused: !playingRef.current })
    pullTween.current = t
  }, [cueIndex, allMatched, watchReady])

  /* ---------------- Dawn: Ama spots the lost sheep and brings it home ---------------- */
  useEffect(() => {
    if (!won || !watchReady || endTl.current) return
    const el = root.current
    const api = camApi.current
    if (!el || !api) return
    const { cam: c, apply } = api
    pullTween.current?.kill()
    endCtx.current = gsap.context(() => {
      const et = gsap.timeline({ paused: !playingRef.current, onComplete: () => playDoneRef.current() })
      endTl.current = et
      const camTo = (at: number, dur: number, to: Cam, ease = 'power2.inOut') => et.to(c, { ...to, duration: dur, ease, onUpdate: apply }, at)
      const mood = (name: AmaMood, at: number) => {
        et.set('.c1-ama-v', { opacity: 0 }, at)
        et.set(`.c1-ama-${name}`, { opacity: 1 }, at)
        et.fromTo('.c1-ama-b', { scaleY: 0.93, scaleX: 1.04 }, { scaleY: 1, scaleX: 1, duration: 0.4, ease: 'back.out(3)', immediateRender: false }, at)
      }
      const s = LOST_SHEEP
      let pos: SPt = { ...LOST }
      const walk = (pts: Required<SPt>[], at: number, speed: number) => {
        let t = at
        et.set(`.sh-${s}`, { '--walk': 1 }, t)
        for (const p of pts) {
          const dur = Math.max(0.16, Math.hypot(p.x - pos.x, p.y - pos.y) / speed)
          et.to(`.sh-${s}`, { x: p.x, y: p.y, duration: dur, ease: 'none' }, t)
          et.to(`.shs-${s}`, { scale: p.s, duration: dur, ease: 'none' }, t)
          pos = p
          t += dur
        }
        et.set(`.sh-${s}`, { '--walk': 0 }, t)
        return t
      }
      const amaWalk = (dx: number, at: number, dur: number) => {
        et.to('.c1-ama', { x: dx, duration: dur, ease: 'sine.inOut' }, at)
        et.fromTo('.c1-ama-w', { y: 0 }, { y: -9, duration: dur / 10, yoyo: true, repeat: 9, ease: 'sine.inOut', immediateRender: false }, at)
      }

      // Dawn breaks over the valley; Ama looks out towards the hills.
      et.to('.c1-nwq', { opacity: 0, duration: 0.5 }, 0)
      mood('point', 0.4)
      et.to('.vl-night', { opacity: 0, duration: 2.4, ease: 'sine.inOut' }, 0.5)
      et.to('.c1-wstars', { opacity: 0, duration: 1.8 }, 0.5)
      et.to('.vl-moon', { y: 420, duration: 2.6, ease: 'power1.in' }, 0.5)
      et.to('.vl-land-night', { opacity: 0.45, duration: 2.4 }, 0.5)
      et.to('.c1-flies', { opacity: 0, duration: 1.2 }, 0.5)
      et.to('.c1-dawnglow', { opacity: 1, duration: 2.2 }, 1.0)
      camTo(1.0, 2.6, F.lost)
      et.to('.c1-lostglow', { opacity: 1, duration: 0.8 }, 2.6)
      // The lost sheep hears her, turns and trots down the hill while Ama walks out to meet it.
      et.fromTo(`.shh-${s}`, { y: 0 }, { y: -12, duration: 0.16, yoyo: true, repeat: 3, ease: 'power1.out', immediateRender: false }, 3.5)
      et.to(`.shd-${s}`, { scaleX: -1, duration: 0.22 }, 4.2)
      walk(
        [
          { x: 330, y: 690, s: 0.42 },
          { x: 560, y: 800, s: 0.52 },
          { x: 760, y: 876, s: SHEEP_S },
        ],
        4.4,
        260,
      )
      mood('wave', 4.2)
      amaWalk(860 - AMA.x, 4.2, 2.4)
      camTo(4.0, 2.8, F.meet)
      et.to('.c1-lostglow', { opacity: 0, duration: 0.8 }, 5.6)
      // Home together. The left-over pebble finds its sheep: coral turns to teal.
      mood('cheer', 6.7)
      walk([{ x: GATE_OUT.x, y: GATE_OUT.y, s: SHEEP_S }, { ...GATE_IN, s: SHEEP_S }, { ...HOME[s], s: SHEEP_S }], 7.0, 330)
      amaWalk(0, 7.5, 2.4)
      et.fromTo('.c1-endflash .c1-fl-path', { attr: { 'stroke-dashoffset': 1 } }, { attr: { 'stroke-dashoffset': 0 }, duration: 0.3, ease: 'power2.out', immediateRender: false }, 8.05)
      et.fromTo('.c1-endflash', { opacity: 0 }, { opacity: 1, duration: 0.08, immediateRender: false }, 8.05)
      et.to('.c1-endflash', { opacity: 0, duration: 0.8 }, 8.7)
      et.to('.c1-left-coral', { opacity: 0, duration: 0.3 }, 8.3)
      et.to('.c1-left-teal', { opacity: 1, duration: 0.3 }, 8.3)
      et.to('.pen-gate', { scaleX: 1, duration: 0.55, ease: 'back.out(2)' }, 9.6)
      mood('cheer', 9.9)
      camTo(7.4, 3.0, F.wide)
      // The last frame: wide on the valley under the dawn sky, vignette kept so the edges match chapter 2.
      et.to('.c1-dawnglow', { opacity: 0, duration: 1.6 }, 9.4)
      et.to({}, { duration: 0.4 }, 11.0)
    }, el)
    // The ending starts once; it is cleaned up on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won, watchReady])

  /* ---------------- What Pip sees, and hints ---------------- */
  useEffect(() => {
    if (cueIndex === 3) {
      reportState(
        `Night. Six sheep are milling about inside Ama's pen, moving and overlapping. Over the pen float two of Ama's thought bubbles: "All home" (teal ring, sheep snug in the pen) and "One missing" (coral ring, one sheep alone on a hill), with a pink question mark between them. ` +
          `The learner is asked to guess whether every sheep is home. This is only a warm-up guess: there is no right answer, because you really cannot tell just by looking, which is the point. ` +
          (picked ? `The learner guessed "${picked === 'all' ? 'All home' : 'One missing'}".` : 'The learner has not guessed yet.'),
      )
      setHints(['Any guess is fine here. Tap the bubble you think is right.', 'One bubble shows every sheep home. The other shows one sheep still out on the hill.'])
    } else if (cueIndex === 10) {
      const n = matched.filter((m) => m !== null).length
      reportState(
        `The night watch. Six pebbles from this morning (one for each sheep that went out) lie in a row in front of Ama's bag. Five sheep came home and are milling about in the pen. ` +
          `The learner drags one pebble onto each sheep that came home; each match gets a teal glow. So far ${n} of the 5 sheep have a pebble. ` +
          (allMatched
            ? `Every sheep in the pen has a pebble and one pebble is left over by the bag. Two thought bubbles are showing: "All home" and "One missing". ${wrong ? 'The learner tapped "All home", which is not right; the left-over pebble is pulsing coral. ' : ''}`
            : '') +
          (won ? 'The learner answered correctly. Dawn is breaking and Ama is bringing the lost sheep home. ' : '') +
          'Correct answer: No, not every sheep is home. One pebble is left over with no sheep, so one sheep is still out (it is on a far hill). ' +
          'Likely mix-ups: trying to count the moving sheep instead of matching, giving one sheep two pebbles, or thinking the left-over pebble is just a spare.',
      )
      setHints([
        'Give each sheep in the pen just one pebble.',
        'Drag a pebble from beside the bag onto a sheep. Every sheep that came home gets one.',
        'When every sheep has a pebble, look beside the bag. Is any pebble still waiting for its sheep?',
      ])
    } else {
      reportState(STATE[cueIndex] ?? '')
    }
  }, [cueIndex, picked, matched, allMatched, wrong, won, reportState, setHints])

  /* ---------------- The quick guess ---------------- */
  const pickGuess = (c: 'all' | 'miss') => {
    if (!guessing) return
    setPicked(c)
    memory.flockGuess = c === 'all' ? 'all home' : 'one missing'
    emit({ type: 'progress', detail: `guessed ${c === 'all' ? 'all home' : 'one missing'}` })
    void say(LINES.guess)
    onPlayDone()
  }

  /* ---------------- The night watch ---------------- */
  const toWorld = (clientX: number, clientY: number): Pt => {
    const m = worldRef.current?.getScreenCTM()
    if (!m) return { x: 0, y: 0 }
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }
  /** Where each sheep in the pen is right now (it may be milling), in world coordinates. */
  const sheepAt = (i: number): Pt | null => {
    const b = root.current?.querySelector(`.c1-body-${i}`)
    if (!b) return null
    const r = b.getBoundingClientRect()
    return toWorld(r.left + r.width / 2, r.top + r.height * 0.45)
  }
  const sayOnce = (line: string) => {
    if (Date.now() - lastLine.current < 4000) return
    lastLine.current = Date.now()
    void say(line)
  }

  const dropAt = (k: number, p: Pt) => {
    let best = -1
    let bestD = 95
    for (let i = 0; i < HOME_COUNT; i++) {
      const c = sheepAt(i)
      if (!c) continue
      const d = Math.hypot(c.x - p.x, c.y - p.y)
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    if (best < 0) return
    if (matched[best] !== null) {
      emit({ type: 'attempt', correct: false, detail: 'tried to give a second pebble to a sheep that already has one' })
      sayOnce(LINES.twice)
      return
    }
    const at = sheepAt(best) ?? p
    setMatched((m) => m.map((v, i) => (i === best ? k : v)))
    setLinks((l) => [...l.slice(-4), { id: ++linkId.current, a: { x: ROW(k).x, y: ROW(k).y - 12 }, b: at }])
    emit({ type: 'progress', detail: `put a pebble on a sheep (${matched.filter((m) => m !== null).length + 1} of ${HOME_COUNT})` })
  }

  const startDrag = (k: number) => (e: ReactPointerEvent<SVGGElement>) => {
    if (!watching || used.has(k)) return
    e.preventDefault()
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    const p0 = toWorld(e.clientX, e.clientY)
    const home = ROW(k)
    const off = { x: home.x - p0.x, y: home.y - p0.y }
    setDrag({ k, x: home.x, y: home.y })
    const at = (ev: PointerEvent) => {
      const p = toWorld(ev.clientX, ev.clientY)
      return { x: p.x + off.x, y: p.y + off.y }
    }
    const moveH = (ev: PointerEvent) => setDrag({ k, ...at(ev) })
    const up = (ev: PointerEvent) => {
      target.removeEventListener('pointermove', moveH)
      target.removeEventListener('pointerup', up)
      target.removeEventListener('pointercancel', up)
      setDrag(null)
      dropAt(k, at(ev))
    }
    target.addEventListener('pointermove', moveH)
    target.addEventListener('pointerup', up)
    target.addEventListener('pointercancel', up)
  }

  const answer = (c: 'all' | 'miss') => {
    if (!watching || !allMatched) return
    if (c === 'all') {
      setWrong(true)
      emit({ type: 'attempt', correct: false, detail: 'said every sheep is home, but one pebble is left over' })
      sayOnce(LINES.allHome)
      return
    }
    setWon(true)
    emit({ type: 'attempt', correct: true, detail: 'said one sheep is missing, because one pebble has no sheep' })
    void say(LINES.won)
  }

  /* ---------------- The picture ---------------- */
  const graze = [0, 1, 4, 5, 6, 7].includes(cueIndex) || won

  return (
    <g ref={root}>
      <style>{CSS}</style>
      <defs>
        <radialGradient id="c1-glow-coral">
          <stop offset="0" stopColor={N.coralLight} stopOpacity="0.9" />
          <stop offset="0.4" stopColor={N.coral} stopOpacity="0.35" />
          <stop offset="1" stopColor={N.coral} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* The night sky high above the valley, drifting slower than the world (parallax). */}
      <g className="c1-skyL">
        <rect x={-1200} y={-2600} width={4000} height={3200} fill={N.space} />
        <Bloom x={300} y={-900} r={520} color="violet" opacity={0.12} />
        <Bloom x={1350} y={-500} r={460} color="plum" opacity={0.14} />
        <Stars w={2000} h={1900} y={-1500} count={300} seed={41} />
      </g>

      <g className="c1-world" ref={worldRef}>
        <Valley />
        {/* More stars, where the valley's own sky ends and the high sky begins. */}
        <g className="c1-wstars">
          <Stars w={2000} h={380} y={-360} count={50} seed={5} />
        </g>
        <g className="c1-sunset" pointerEvents="none">
          <Glow x={1240} y={640} r={620} color="warm" opacity={0.85} />
        </g>
        <g className="c1-dawnglow" pointerEvents="none">
          <Glow x={360} y={650} r={640} color="warm" opacity={0.45} />
        </g>
        <g className="c1-birds" pointerEvents="none">
          <Bird x={1520} y={250} s={1.1} />
          <Bird x={1580} y={214} s={0.9} d={0.15} />
          <Bird x={1600} y={286} s={0.8} d={0.3} />
        </g>
        <g className="c1-lostglow">
          <CoralGlow x={LOST.x} y={LOST.y - 16} r={90} />
        </g>

        <PenBack />
        <g className={graze ? 'c1-sheep c1-graze' : 'c1-sheep'}>
          {DRAW_ORDER.map((i) => (
            <SheepRig key={i} i={i} pebble={i < HOME_COUNT ? matched[i] : null} tutor={i === LOST_SHEEP ? 'the lost sheep' : `sheep ${i + 1}`} />
          ))}
        </g>
        <Pen x={PEN.x} y={PEN.y} s={PEN.s} w={PEN.w} />
        <PlantedCrook {...CROOK} />
        <g className="c1-bagglow">
          <Glow x={MOUTH.x} y={MOUTH.y + 20} r={120} color="teal" />
        </g>
        <g className="c1-bagb">
          <Bag x={BAG.x} y={BAG.y} s={BAG.s} open />
        </g>
        <g className="c1-ama" data-tutor="Ama the shepherd">
          <g className="c1-ama-w">
            <g className="c1-ama-b">
              {(Object.keys(AMA_V) as AmaMood[]).map((name) => {
                const v = AMA_V[name]
                return (
                  <g key={name} className={`c1-ama-v c1-ama-${name}`}>
                    <Ama x={AMA.x} y={AMA.y} s={AMA.s} staff={false} pose={v.pose} face={v.face} flip={v.flip} />
                  </g>
                )
              })}
            </g>
          </g>
        </g>
        <g className="c1-spark" pointerEvents="none">
          <Twinkle x={AMA.x} y={AMA.y - 300} r={30} />
          <Twinkle x={AMA.x - 50} y={AMA.y - 270} r={14} />
          <Twinkle x={AMA.x + 48} y={AMA.y - 280} r={18} />
        </g>
        <g className="c1-flies" pointerEvents="none">
          <g transform="translate(0 480)">
            <Motes w={1600} h={380} count={22} seed={13} color={N.leafLight} />
          </g>
        </g>

        {/* Teal threads: every grazing sheep has its pebble in the bag. */}
        <g className="c1-th" pointerEvents="none">
          {GRAZE.map((g, i) => (
            <g key={i} className={`c1-th-${i}`}>
              <path d={arc({ x: g.x, y: g.y - 60 * g.s }, MOUTH, 120)} pathLength={1} strokeDasharray="1 1" stroke={N.teal} strokeWidth={5} strokeLinecap="round" fill="none" filter="url(#fx-glow)" opacity={0.9} />
            </g>
          ))}
        </g>
        {/* Teal flashes: a sheep at the gate and its pebble. */}
        <Flash className="c1-fd-0" a={{ x: GATE_OUT.x, y: GATE_OUT.y - 52 }} b={MOUTH} lift={54} />
        <Flash className="c1-fd-1" a={{ x: GATE_OUT.x, y: GATE_OUT.y - 52 }} b={MOUTH} lift={54} />
        {Array.from({ length: HOME_COUNT }, (_, k) => (
          <Flash key={k} className={`c1-fh-${k}`} a={{ x: GATE_OUT.x, y: GATE_OUT.y - 52 }} b={{ x: ROW(k).x, y: ROW(k).y - 8 }} lift={40} />
        ))}

        {/* The story's pebbles: into the bag in the morning, out again at night. */}
        {Array.from({ length: PEBBLES }, (_, k) => (
          <g key={k} className={`c1-sp c1-sp-${k}`} pointerEvents="none">
            <g className={`c1-sps-${k}`}>
              {k === PEBBLES - 1 && (
                <g className="c1-spcoral">
                  <CoralGlow x={0} y={0} r={60} />
                  <circle r={27} fill="none" stroke={N.coral} strokeWidth={4} />
                </g>
              )}
              <Pebble s={PEB_S} seed={k} tutor={k === PEBBLES - 1 ? 'the left-over pebble' : undefined} />
            </g>
          </g>
        ))}
        {/* The coral line from the left-over pebble to the sheep that is still out. */}
        <g className="c1-coral" pointerEvents="none">
          <path d={`M${BAG.x - 20} 700 C 900 470, 520 450, ${LOST.x + 22} ${LOST.y - 26}`} pathLength={1} strokeDasharray="1 1" stroke={N.coral} strokeWidth={6} strokeLinecap="round" fill="none" filter="url(#fx-glow)" />
        </g>

        {/* Ama's question over the flock. */}
        <g className="c1-q" pointerEvents="none">
          <g className="c1-qs">
            <QMark at={{ x: 0, y: 0 }} size={130} />
          </g>
        </g>
        {/* The quick guess: two thought bubbles. */}
        <g className="c1-tg" pointerEvents={guessing ? undefined : 'none'}>
          <ThoughtTrail />
          <g transform={`translate(${B_ALL.x} ${B_ALL.y})`}>
            <g className="c1-tgb-0">
              <g transform={`translate(${-B_ALL.x} ${-B_ALL.y})`}>
                <ChoiceBubble which="all" active={guessing} picked={picked} onPick={pickGuess} />
              </g>
            </g>
          </g>
          <g transform={`translate(${B_MISS.x} ${B_MISS.y})`}>
            <g className="c1-tgb-1">
              <g transform={`translate(${-B_MISS.x} ${-B_MISS.y})`}>
                <ChoiceBubble which="miss" active={guessing} picked={picked} onPick={pickGuess} />
              </g>
            </g>
          </g>
        </g>

        {/* The night watch: the morning's pebbles by the bag, ready to drag onto the sheep. */}
        <g className="c1-game">
          {links.map((l) => (
            <path key={l.id} className="c1-draw" d={arc(l.a, l.b, 50)} pathLength={1} stroke={N.teal} strokeWidth={6} strokeLinecap="round" fill="none" filter="url(#fx-glow)" pointerEvents="none" />
          ))}
          {won && (
            <Flash className="c1-endflash" a={{ x: GATE_OUT.x, y: GATE_OUT.y - 52 }} b={{ x: ROW(leftover).x, y: ROW(leftover).y - 8 }} lift={40} />
          )}
          {Array.from({ length: PEBBLES }, (_, k) => {
            if (used.has(k)) return null
            const home = ROW(k)
            const p = drag?.k === k ? drag : home
            const isLeft = allMatched && k === leftover
            const cls = ['c1-peb', watching && 'on', drag?.k === k && 'held'].filter(Boolean).join(' ')
            return (
              <g key={k} className={`c1-gpw-${k}`}>
                <g className={cls} style={{ transform: `translate(${p.x}px, ${p.y}px)` }} onPointerDown={startDrag(k)} data-tutor={isLeft ? 'the left-over pebble' : `pebble ${k + 1}`}>
                  <circle r={48} fill="transparent" />
                  {watching && !drag && matched.every((m) => m === null) && <circle className="hot-ring" r={30} fill="none" stroke={N.cream} strokeWidth={4} />}
                  {isLeft && (wrong || won) && (
                    <g className="c1-left-coral">
                      <CoralGlow x={0} y={0} r={64} />
                      <circle className={won ? undefined : 'c1-pulse'} r={30} fill="none" stroke={N.coral} strokeWidth={5} />
                    </g>
                  )}
                  {isLeft && won && (
                    <g className="c1-left-teal" opacity={0}>
                      <Glow r={70} color="teal" />
                      <circle r={30} fill="none" stroke={N.teal} strokeWidth={5} />
                    </g>
                  )}
                  <Pebble s={drag?.k === k ? PEB_S * 1.15 : PEB_S} seed={k} />
                </g>
              </g>
            )
          })}
          {allMatched && (
            <g className="c1-nwq c1-fade" pointerEvents={watching ? undefined : 'none'}>
              <g className="c1-pop">
                <ChoiceBubbles active={watching} picked={won ? 'miss' : null} onPick={answer} />
              </g>
            </g>
          )}
        </g>

        {/* High in the night sky: the big idea as a chart, then its history. */}
        <g className="c1-sky" transform={`translate(0 ${SKY_Y})`}>
          <MatchingChart />
          <History />
        </g>
      </g>

      <g className="c1-vig" pointerEvents="none">
        <Vignette />
      </g>
    </g>
  )
}

/** One answer bubble, centred on its place over the pen. The quick guess pops them in one at a time. */
function ChoiceBubble({ which, active, picked, onPick }: { which: 'all' | 'miss'; active: boolean; picked: 'all' | 'miss' | null; onPick: (c: 'all' | 'miss') => void }) {
  const at = which === 'all' ? B_ALL : B_MISS
  const ring = which === 'all' ? N.teal : N.coral
  const label = which === 'all' ? 'All home' : 'One missing'
  const cls = ['c1-choice', active && 'on', picked === which && 'picked', picked && picked !== which && 'dim'].filter(Boolean).join(' ')
  return (
    <g transform={`translate(${at.x} ${at.y})`}>
      <g className={cls} onClick={active ? () => onPick(which) : undefined} data-tutor={which === 'all' ? 'the all home bubble' : 'the one missing bubble'} role={active ? 'button' : undefined} aria-label={active ? label : undefined}>
        <rect x={-B_R - 20} y={-B_R - 20} width={2 * B_R + 40} height={2 * B_R + 92} rx={40} fill="transparent" />
        <circle r={B_R + 14} fill="none" stroke={ring} strokeWidth={7} opacity={0.9} />
        {active && !picked && <circle className="hot-ring" r={B_R + 14} fill="none" stroke={ring} strokeWidth={6} />}
        {which === 'all' ? <AllHomePic /> : <MissingPic />}
        <circle r={B_R - 4} fill="none" stroke={N.cream} strokeWidth={9} />
        <Title x={0} y={B_R + 50} size={29}>
          {label}
        </Title>
      </g>
    </g>
  )
}

export const ch1: Chapter = {
  id: 'origin',
  title: 'Why math was born',
  cues: CUES,
  Scene: Ch1Pebbles,
}
