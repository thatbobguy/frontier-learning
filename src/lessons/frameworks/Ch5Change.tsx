import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Glow } from '../../art2/fx'
import { FONT2, N } from '../../art2/palette'
import { Person } from '../../art2/characters'
import { Title } from '../../art2/props'
import { useBeatTimeline } from '../../engine/useBeatTimeline'
import { useDrag } from '../../engine/svg'
import type { Chapter, ChapterProps, Cue } from '../../flow/types'
import { Bundle, NumberLine, PlaceNumber, Sheep, Stick, Valley } from './art'

/*
 * Chapter 5: Together and apart. A long market counter in the sun, and the camera glides
 * along it from cloth to cloth. Adding puts bundles with bundles and sticks with sticks;
 * twelve loose sticks overflow and ten get tied into a new bundle (its 1 carries over to the
 * violet tens tile). Taking away runs it backwards: a bundle is untied when there are not
 * enough loose sticks. Then the same moves as jumps on a number line, and at the end of the
 * counter a playground seesaw the learner balances.
 */

export const CUES: Cue[] = [
  { id: 'change', say: 'Now that amounts have names, we can see how they change. Putting amounts together is called adding.' },
  { id: 'add', say: 'Two bundles and five sticks, plus one bundle and three sticks. Bundles go with bundles. Sticks go with sticks. That makes three bundles and eight sticks: 38.' },
  { id: 'overflow', say: 'Sometimes the loose sticks overflow. Seven sticks plus five sticks is twelve loose sticks. Ten of them get tied into a brand new bundle! That makes 32.' },
  { id: 'predict', say: 'Your turn! Two bundles and five sticks. Take away three sticks. How many are left? Tap your guess.', play: true, quick: true },
  { id: 'take-apart', say: 'Taking away is adding run backwards. To take seven from 32, there are only two loose sticks. So we untie a bundle into ten loose sticks. Now there are twelve. Take away seven, and 25 are left.' },
  { id: 'number-line', say: 'On a number line, adding is jumping forward, and taking away is jumping back. 25 plus 13 is one big jump of ten, then three small jumps, to 38. 32 take away 7 is seven small jumps back, to 25.' },
  { id: 'balance', say: 'Now you try! The seesaw only balances when both sides have the same amount. Add or take away bundles and sticks on the right side until it balances.', play: true },
]

/* ------------------------------------------------------------------ */
/* Layout (stage coordinates; every station is its own 1600 x 900 frame) */
/* ------------------------------------------------------------------ */

type P = { x: number; y: number }
const range = (n: number) => Array.from({ length: n }, (_, i) => i)

const PAN = 1.6
/** How far the market across the street drifts per station: it is further away, so it moves less. */
const MID_STEP = 320
/** Piece scale on the counter cloths. */
const PS = 0.9
/** The top edge of the counter (chapter 4's counter ends at the same height). */
const COUNTER_Y = 640
/** Where pieces stand on a cloth. */
const FEET = 772
/** Number tiles: size, the row above the cloths, and the written sum at the top. */
const TS = 60
const TILE_Y = 548
const SUM_Y = 176
const tileW = (size = TS) => size * 1.05
const tensTileX = (cx: number, size = TS) => cx - tileW(size) / 2 - 5
const onesTileX = (cx: number, size = TS) => cx + tileW(size) / 2 + 5
/** A gold ones tile holding two digits ("12") is wider; its left edge stays where the one-digit tile's is. */
const WIDE_W = TS * 1.05 + TS * 0.58
const WIDE_DX = (WIDE_W - tileW()) / 2

interface ClothSpec {
  x: number
  w: number
  /** Width of the bundles side (the rest is the loose sticks side). */
  tens: number
}
const big = (x: number): ClothSpec => ({ x, w: 690, tens: 300 })
const small = (x: number): ClothSpec => ({ x, w: 310, tens: 130 })
const tensAt = (c: ClothSpec, k: number) => (c.tens < 200 ? c.x + c.tens / 2 : c.x + 58 + k * 96)
const onesAt = (c: ClothSpec, k: number) => c.x + c.tens + 34 + k * 27 + Math.floor(k / 5) * 14
const centre = (c: ClothSpec) => c.x + c.w / 2
/** Stick i of a bundle, the way the shared Bundle draws them. */
const fan = (i: number, s = PS) => ({ dx: (i - 4.5) * 8 * s, r: (i - 4.5) * 0.7 })

const A1 = big(205)
const B1 = small(1085)
const A2 = big(205)
const B2 = small(1085)
const P3: ClothSpec = { x: 150, w: 520, tens: 300 }
const A4 = big(330)
/** Station 1 and 2 glide the camera this far once the second cloth is empty, so the result sits centre stage. */
const CAM_SHIFT = 240
const PLUS_X = 990
/** Where ten sticks gather to be tied (station 2) and where a bundle comes undone (station 4). */
const TIE2 = { x: (onesAt(A2, 0) + onesAt(A2, 9)) / 2, y: FEET - 46 }
const UNTIE4 = { x: (onesAt(A4, 2) + onesAt(A4, 11)) / 2, y: FEET - 46 }
const BASKET = { x: 1290, y: 806 }
/** The predict cards. */
const CARDS = [22, 25, 28] as const
const CARD = { y: 716, w: 184, h: 164, x0: 905, step: 205 }
/** The number line on the slate board. */
const NL = { x: 230, y: 430, unit: 57, from: 20, to: 40 }
const nlx = (n: number) => NL.x + (n - NL.from) * NL.unit
const HOP_Y = NL.y - 6

const STATE: string[] = [
  'A sunny market counter. A cream cloth arrives with 2 bundles of ten and 5 loose sticks, named 25 by the tiles above it (violet 2 for the bundles, gold 5 for the loose sticks). A second cloth slides in with 1 bundle and 3 sticks (13). The two slide together and a plus sign appears between them: putting amounts together is adding.',
  '25 + 13. The bundle from 13 hops over to join the two bundles, and its violet 1 joins the tens tile (2 becomes 3). Then its 3 loose sticks join the 5 loose sticks, and its gold 3 joins the ones tile (5 becomes 8). Result: 3 bundles and 8 sticks, 38. Written at the top: 25 + 13 = 38.',
  '27 + 5. The 5 loose sticks join the 7 loose sticks: 12 loose sticks, too many for one gold ones tile (it shows 12 and wobbles). Ten of them leap together and get tied into a new violet bundle, which moves to the bundles side, and the 1 of the 12 carries over to the violet tens tile. Result: 3 bundles and 2 sticks, 32. Written at the top: 27 + 5 = 32.',
  '',
  '32 − 7 at the counter. The cloth has 3 bundles and only 2 loose sticks, not enough to take 7. One bundle is untied: its violet ribbon flies off and its 10 sticks spill onto the loose side, making 2 bundles and 12 loose sticks. Then 7 sticks fly into a basket, leaving 2 bundles and 5 sticks: 25. Written at the top: 32 − 7 = 25.',
  'A number line from 20 to 40 on a slate board. A little sheep starts at 25, makes one big violet jump of ten to 35, then three small gold jumps to 38 (25 + 13 = 38). Then it starts at 32 and makes seven small jumps back to 25 (32 − 7 = 25).',
  '',
]

/* ------------------------------------------------------------------ */
/* Number tiles and signs                                               */
/* ------------------------------------------------------------------ */

/** One digit tile drawn exactly like PlaceNumber's: violet for tens, gold for ones. Centred on (0, 0). */
function DigitTile({ text, tens = false, size = TS }: { text: string; tens?: boolean; size?: number }) {
  const w = size * 1.05 + (text.length - 1) * size * 0.58
  const h = size * 1.3
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h * 0.28} fill={tens ? N.violet : N.gold} />
      <rect x={-w / 2} y={h / 2 - h * 0.2} width={w} height={h * 0.2} rx={h * 0.1} fill={N.shadow} opacity={0.18} />
      <rect x={-w / 2 + 8} y={-h / 2 + 6} width={w - 16} height={h * 0.13} rx={h * 0.06} fill={N.white} opacity={0.3} />
      <text y={size * 0.36} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={size} fill={tens ? N.white : N.night0}>
        {text}
      </text>
    </g>
  )
}

/** A cream round badge with a plus or minus sign. */
function OpBadge({ sign, size = TS }: { sign: '+' | '−'; size?: number }) {
  const r = size * 0.48
  return (
    <g>
      <circle cy={4} r={r} fill={N.shadow} opacity={0.18} />
      <circle r={r} fill={N.cream} />
      <rect x={-r * 0.55} y={-size * 0.07} width={r * 1.1} height={size * 0.14} rx={size * 0.07} fill={N.night0} />
      {sign === '+' && <rect x={-size * 0.07} y={-r * 0.55} width={size * 0.14} height={r * 1.1} rx={size * 0.07} fill={N.night0} />}
    </g>
  )
}

/** The teal equals tile: the same amount on both sides. */
function EqTile({ size = TS }: { size?: number }) {
  const w = size * 1.15
  const h = size * 1.3
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h * 0.28} fill={N.teal} />
      <rect x={-w / 2} y={h / 2 - h * 0.2} width={w} height={h * 0.2} rx={h * 0.1} fill={N.shadow} opacity={0.18} />
      <rect x={-w * 0.3} y={-size * 0.2} width={w * 0.6} height={size * 0.13} rx={size * 0.06} fill={N.night0} />
      <rect x={-w * 0.3} y={size * 0.08} width={w * 0.6} height={size * 0.13} rx={size * 0.06} fill={N.night0} />
    </g>
  )
}

/** The pink question tile: the amount we are trying to find. */
function QTile({ size = TS }: { size?: number }) {
  const w = size * 1.05
  const h = size * 1.3
  return (
    <g>
      <Glow r={size * 1.1} color="pink" opacity={0.45} />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h * 0.28} fill={N.pink} />
      <rect x={-w / 2} y={h / 2 - h * 0.2} width={w} height={h * 0.2} rx={h * 0.1} fill={N.shadow} opacity={0.18} />
      <text y={size * 0.36} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={size} fill={N.white}>
        ?
      </text>
    </g>
  )
}

type EqItem = number | '+' | '−' | '=' | '?'

function eqWidth(it: EqItem, size: number) {
  if (typeof it === 'number') return it >= 10 ? 2 * tileW(size) + 10 : tileW(size)
  if (it === '=') return size * 1.15
  if (it === '?') return tileW(size)
  return size * 0.96
}

/** The centre x of each item when the row is centred on `cx`. */
function eqCentres(items: EqItem[], cx: number, size: number) {
  const gap = size * 0.3
  const ws = items.map((it) => eqWidth(it, size))
  let x = cx - (ws.reduce((a, b) => a + b, 0) + gap * (items.length - 1)) / 2
  return ws.map((w) => {
    const c = x + w / 2
    x += w + gap
    return c
  })
}

function EqPiece({ it, x, y, size }: { it: EqItem; x: number; y: number; size: number }) {
  if (typeof it === 'number') return <PlaceNumber value={it} x={x} y={y} size={size} />
  return (
    <g transform={`translate(${x} ${y})`}>
      {it === '=' ? <EqTile size={size} /> : it === '?' ? <QTile size={size} /> : <OpBadge sign={it} size={size} />}
    </g>
  )
}

/** A sum written with number tiles. Each item is `<cls> <cls>-<i>` so a timeline can bring them in one by one. */
function EqRow({ items, x, y, size = TS, cls, tutor }: { items: EqItem[]; x: number; y: number; size?: number; cls: string; tutor?: string }) {
  const cs = eqCentres(items, x, size)
  return (
    <g data-tutor={tutor}>
      {items.map((it, i) => (
        <g key={i} className={`${cls} ${cls}-${i}`}>
          <EqPiece it={it} x={cs[i]} y={y} size={size} />
        </g>
      ))}
    </g>
  )
}

/** A soft oval of light behind something the narration is pointing at. */
function GlowE({ x, y, rx, ry, color = 'warm', className }: { x: number; y: number; rx: number; ry: number; color?: 'warm' | 'violet' | 'teal'; className?: string }) {
  return <ellipse className={className} cx={x} cy={y} rx={rx} ry={ry} fill={`url(#fx-glow-${color})`} />
}

/** The violet ribbon of a bundle on its own, drawn exactly where the shared Bundle draws it. */
function Ribbon() {
  return (
    <g>
      <rect x={-46} y={-82} width={92} height={18} rx={8} fill={N.violet} />
      <rect x={-46} y={-82} width={92} height={6} rx={3} fill={N.violetLight} opacity={0.8} />
      <path d="M0 -74 Q-26 -98 -30 -76 Q-26 -60 0 -74 Q26 -98 30 -76 Q26 -60 0 -74 Z" fill={N.violetDark} />
      <circle cy={-74} r={6} fill={N.violetLight} />
    </g>
  )
}

/** A four-point sparkle. */
function Spark({ r = 12, color = N.white }: { r?: number; color?: string }) {
  const k = r * 0.22
  return <path d={`M0 ${-r} L${k} ${-k} L${r} 0 L${k} ${k} L0 ${r} L${-k} ${k} L${-r} 0 L${-k} ${-k} Z`} fill={color} />
}

/* ------------------------------------------------------------------ */
/* The market                                                           */
/* ------------------------------------------------------------------ */

const STALL_TONES: [string, string][] = [
  [N.sky, N.cream],
  [N.leaf, N.cream],
  [N.skyDark, N.mist],
  [N.leafDark, N.leafLight],
]

/** A stall across the street: posts, a striped awning, a table of pots and baskets. Its bottom hides behind the counter. */
function FarStall({ x, tone, seed }: { x: number; tone: [string, string]; seed: number }) {
  const w = 400
  const pots = [
    [-120, 26, N.mist, N.skyDark],
    [-60, 34, N.woodLight, N.wood],
    [40, 22, N.skyLight, N.sky],
    [110, 30, N.sandLight, N.sandDark],
  ] as const
  return (
    <g transform={`translate(${x} 0)`}>
      <rect x={-w / 2 + 8} y={330} width={12} height={330} fill={N.woodDark} />
      <rect x={w / 2 - 20} y={330} width={12} height={330} fill={N.woodDark} />
      <rect x={-w / 2 + 20} y={356} width={w - 40} height={300} fill={tone[1]} opacity={0.4} />
      {seed % 2 === 0 && (
        <Person x={0} y={640} s={0.62} robe={N.leaf} robeLight={N.leafLight} robeDark={N.leafDark} head="cap" headColor={N.skyDark} headDark={N.night2} skin={N.skin1} skinDark={N.skin1Dark} pose={seed % 4 === 0 ? 'wave' : 'down'} />
      )}
      <rect x={-w / 2 + 4} y={560} width={w - 8} height={14} rx={5} fill={N.woodLight} />
      <rect x={-w / 2 + 12} y={574} width={w - 24} height={90} fill={tone[0]} opacity={0.6} />
      {pots.map(([px, r, light, base], i) =>
        (i + seed) % 3 === 2 ? (
          <g key={i} transform={`translate(${px} 560)`}>
            <path d={`M${-r - 6} -${r} H${r + 6} L${r} 0 H${-r} Z`} fill={N.sand} />
            <path d={`M${-r - 6} -${r} H${r + 6}`} stroke={N.sandDark} strokeWidth={5} />
            {range(3).map((k) => (
              <circle key={k} cx={(k - 1) * r * 0.6} cy={-r - 8} r={r * 0.34} fill={k === 1 ? N.leaf : N.leafLight} />
            ))}
          </g>
        ) : (
          <g key={i} transform={`translate(${px} 560)`}>
            <ellipse cy={-r * 0.9} rx={r} ry={r * 0.9} fill={base} />
            <ellipse cx={-r * 0.3} cy={-r * 1.1} rx={r * 0.35} ry={r * 0.5} fill={light} opacity={0.7} />
            <rect x={-r * 0.45} y={-r * 2.05} width={r * 0.9} height={r * 0.4} rx={4} fill={base} />
          </g>
        ),
      )}
      {range(8).map((i) => (
        <path key={i} d={`M${-w / 2 + (i * w) / 8} 300 h${w / 8} v46 q${-w / 16} 18 ${-w / 8} 0 Z`} fill={i % 2 ? tone[1] : tone[0]} />
      ))}
      <rect x={-w / 2 - 8} y={290} width={w + 16} height={16} rx={6} fill={N.woodDark} />
    </g>
  )
}

/** The market across the street, wide enough for the whole walk along the counter. */
function FarMarket() {
  return (
    <g pointerEvents="none">
      {range(6).map((i) => (
        <FarStall key={i} x={140 + i * 470} tone={STALL_TONES[i % STALL_TONES.length]} seed={i} />
      ))}
      {/* the market gives way to trees where the playground starts */}
      {[3020, 3200, 3420].map((x, i) => (
        <g key={x} transform={`translate(${x} 660) scale(${1.3 - i * 0.15})`}>
          <rect x={-10} y={-110} width={20} height={112} rx={8} fill={N.woodDark} />
          <circle cy={-150} r={78} fill="#2f8a50" />
          <circle cx={-26} cy={-172} r={44} fill="#4fae6c" opacity={0.8} />
        </g>
      ))}
      {/* a little haze pushes it back */}
      <rect x={-400} y={250} width={4400} height={420} fill={N.white} opacity={0.14} />
    </g>
  )
}

/** The striped awning over our counter, with bunting. Spans past both edges so neighbouring stations join up. */
function Valance({ x0 = -400, x1 = 2000 }: { x0?: number; x1?: number }) {
  const sw = 80
  const n = Math.ceil((x1 - x0) / sw)
  const flags = [N.cream, N.skyLight, N.leafLight, N.white]
  return (
    <g pointerEvents="none">
      {range(Math.ceil((x1 - x0) / 400)).map((s) => {
        const a = x0 + s * 400
        return (
          <g key={s}>
            <path d={`M${a} 92 Q${a + 200} 128 ${a + 400} 92`} stroke={N.woodDark} strokeWidth={3} fill="none" />
            {range(6).map((k) => {
              const t = (k + 0.5) / 6
              const fx = a + t * 400
              const fy = 92 + 4 * 36 * t * (1 - t)
              return <path key={k} d={`M${fx - 15} ${fy} L${fx + 15} ${fy} L${fx} ${fy + 30} Z`} fill={flags[(s + k) % flags.length]} />
            })}
          </g>
        )
      })}
      {range(n).map((i) => (
        <path key={i} d={`M${x0 + i * sw} 0 h${sw} v56 q${-sw / 2} 22 ${-sw} 0 Z`} fill={i % 2 ? N.cream : N.sky} />
      ))}
      <rect x={x0} y={-10} width={x1 - x0} height={22} fill={N.skyDark} />
    </g>
  )
}

/** Our long wooden counter: its top edge at y = 640, the top surface, a lip, and the front. */
function Counter({ x0 = -400, x1 = 2000, cap = false }: { x0?: number; x1?: number; cap?: boolean }) {
  return (
    <g pointerEvents="none">
      <rect x={x0} y={COUNTER_Y} width={x1 - x0} height={196} fill={N.woodLight} />
      <rect x={x0} y={COUNTER_Y} width={x1 - x0} height={8} fill={N.woodDark} opacity={0.35} />
      {[700, 760].map((y) => (
        <rect key={y} x={x0} y={y} width={x1 - x0} height={3} fill={N.wood} opacity={0.35} />
      ))}
      <rect x={x0} y={828} width={x1 - x0} height={16} fill="#e0a676" />
      <rect x={x0} y={844} width={x1 - x0} height={80} fill={N.wood} />
      {range(Math.ceil((x1 - x0) / 240)).map((i) => (
        <rect key={i} x={x0 + 30 + i * 240} y={858} width={190} height={60} rx={10} fill={N.woodDark} opacity={0.3} />
      ))}
      {cap && <rect x={x1 - 18} y={COUNTER_Y - 4} width={22} height={300} rx={8} fill={N.woodDark} />}
    </g>
  )
}

/** A cream cloth on the counter: the bundles side has a violet edge, the loose-sticks side a gold one. */
function Cloth({ c, className, tutor }: { c: ClothSpec; className?: string; tutor?: string }) {
  const y0 = 682
  const y1 = 812
  const d = `M${c.x + 12} ${y0} H${c.x + c.w - 12} L${c.x + c.w} ${y1} H${c.x} Z`
  const split = c.x + c.tens
  return (
    <g className={className} data-tutor={tutor}>
      <path d={d} fill={N.shadow} opacity={0.16} transform="translate(0 7)" />
      <path d={d} fill={N.cream} />
      <path d={`M${c.x + 12} ${y0} H${split} V${y1} H${c.x} Z`} fill={N.violetLight} opacity={0.18} />
      <path d={`M${split} ${y0} H${c.x + c.w - 12} L${c.x + c.w} ${y1} H${split} Z`} fill={N.goldLight} opacity={0.3} />
      <rect x={c.x + 20} y={y0 + 7} width={c.tens - 32} height={9} rx={4.5} fill={N.violet} opacity={0.6} />
      <rect x={split + 12} y={y0 + 7} width={c.w - c.tens - 36} height={9} rx={4.5} fill={N.gold} opacity={0.8} />
      <line x1={split} y1={y0 + 4} x2={split} y2={y1 - 4} stroke={N.sandDark} strokeWidth={3} strokeDasharray="8 8" opacity={0.55} />
    </g>
  )
}

/** A wicker basket on the counter, in two layers so taken-away sticks can drop inside it. */
function BasketBack({ x, y }: { x: number; y: number }) {
  return (
    <g pointerEvents="none">
      <ellipse cx={x} cy={y + 6} rx={104} ry={14} fill={N.shadow} opacity={0.25} />
      <ellipse cx={x} cy={y - 96} rx={96} ry={20} fill={N.sandDark} />
      <ellipse cx={x} cy={y - 94} rx={84} ry={14} fill={N.woodDark} />
    </g>
  )
}
function BasketFront({ x, y }: { x: number; y: number }) {
  return (
    <g pointerEvents="none" data-tutor="the basket of taken-away sticks">
      <path d={`M${x - 96} ${y - 96} Q${x} ${y - 70} ${x + 96} ${y - 96} L${x + 76} ${y} Q${x} ${y + 10} ${x - 76} ${y} Z`} fill={N.sand} />
      {range(4).map((k) => (
        <path key={k} d={`M${x - 90 + k * 4} ${y - 74 + k * 20} Q${x} ${y - 52 + k * 22} ${x + 90 - k * 4} ${y - 74 + k * 20}`} stroke={N.sandDark} strokeWidth={4} fill="none" opacity={0.7} />
      ))}
      {range(7).map((k) => (
        <line key={k} x1={x - 72 + k * 24} y1={y - 82} x2={x - 58 + k * 19.5} y2={y - 4} stroke={N.sandLight} strokeWidth={3} opacity={0.6} />
      ))}
      <path d={`M${x - 98} ${y - 98} Q${x} ${y - 70} ${x + 98} ${y - 98}`} stroke={N.sandDark} strokeWidth={10} fill="none" strokeLinecap="round" />
    </g>
  )
}

/** A slate board standing on the counter, for the number line. */
function Slate() {
  return (
    <g pointerEvents="none">
      {[300, 1300].map((x) => (
        <rect key={x} x={x - 12} y={600} width={24} height={110} rx={8} fill={N.woodDark} />
      ))}
      <rect x={104} y={124} width={1392} height={576} rx={30} fill={N.shadow} opacity={0.2} transform="translate(0 10)" />
      <rect x={104} y={124} width={1392} height={576} rx={30} fill={N.woodDark} />
      <rect x={124} y={144} width={1352} height={536} rx={18} fill={N.night1} />
      <ellipse cx={520} cy={300} rx={300} ry={90} fill={N.white} opacity={0.03} />
      <ellipse cx={1150} cy={560} rx={260} ry={70} fill={N.white} opacity={0.03} />
      <rect x={140} y={160} width={1320} height={10} rx={5} fill={N.white} opacity={0.05} />
    </g>
  )
}

/** A thin arc from a to b on the number line, drawn with a stroke dash so it can trace itself. */
function HopArc({ cls, a, b, h, color }: { cls: string; a: number; b: number; h: number; color: string }) {
  const x1 = nlx(a)
  const x2 = nlx(b)
  return (
    <path
      className={cls}
      d={`M${x1} ${HOP_Y} Q${(x1 + x2) / 2} ${HOP_Y - 2 * h} ${x2} ${HOP_Y}`}
      pathLength={1}
      strokeDasharray="1 1"
      stroke={color}
      strokeWidth={7}
      strokeLinecap="round"
      fill="none"
    />
  )
}

/* ------------------------------------------------------------------ */
/* Small pieces the timeline moves                                       */
/* ------------------------------------------------------------------ */

/** A bundle or loose stick, drawn at the origin: the timeline places it with x and y. */
function Piece({ cls, kind, tutor }: { cls: string; kind: 'b' | 's'; tutor?: string }) {
  return <g className={cls}>{kind === 'b' ? <Bundle s={PS} tutor={tutor} /> : <Stick s={PS} tutor={tutor} />}</g>
}

/** A digit tile the timeline flies around. */
function FlyTile({ cls, text, tens }: { cls: string; text: string; tens?: boolean }) {
  return (
    <g className={cls}>
      <DigitTile text={text} tens={tens} />
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* CSS-driven movement for the playable parts                            */
/* ------------------------------------------------------------------ */

interface Pose {
  x: number
  y: number
  r?: number
  s?: number
  o?: number
}

/** Moves its children to `to` with a CSS transition. With `from`, it first renders there and then glides to `to`. */
function Mover({ to, from, dur = 0.5, delay = 0, ease = 'cubic-bezier(.3,1.25,.5,1)', instant = false, children }: { to: Pose; from?: Pose; dur?: number; delay?: number; ease?: string; instant?: boolean; children: ReactNode }) {
  const [arrived, setArrived] = useState(!from)
  useEffect(() => {
    if (arrived) return
    let b = 0
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => setArrived(true))
    })
    return () => {
      cancelAnimationFrame(a)
      cancelAnimationFrame(b)
    }
  }, [arrived])
  const p = arrived || !from ? to : from
  return (
    <g
      style={{
        transform: `translate(${p.x}px, ${p.y}px) rotate(${p.r ?? 0}deg) scale(${p.s ?? 1})`,
        opacity: p.o ?? 1,
        transition: instant ? 'none' : `transform ${dur}s ${ease} ${delay}s, opacity ${dur}s ease ${delay}s`,
      }}
    >
      {children}
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Quick play: 25 take away 3                                            */
/* ------------------------------------------------------------------ */

const PREDICT_LINES = {
  22: 'Yes! Two bundles and two sticks: 22.',
  25: 'Good guess! But three sticks went away, so there are fewer. Two bundles and two sticks: 22.',
  28: 'Good guess! 28 would be adding three. Taking away leaves fewer: two bundles and two sticks, 22.',
} as const

const PREDICT_HINTS = [
  'Look at the loose sticks on the cloth. How many are there?',
  'Taking away makes an amount smaller. Which cards are smaller than 25?',
  'Three loose sticks leave. The two bundles stay where they are.',
]

const P3_EQ: EqItem[] = [25, '−', 3, '=', '?']
const P3_EQ_X = eqCentres(P3_EQ, centre(P3), TS)

function PredictStation({ active, pick, shown, onPick }: { active: boolean; pick: number | null; shown: boolean; onPick: (n: number) => void }) {
  return (
    <g>
      <Cloth c={P3} tutor="two bundles and five sticks" />
      {[0, 1].map((k) => (
        <Bundle key={k} x={tensAt(P3, k)} y={FEET} s={PS} tutor="a bundle of ten" />
      ))}
      {[0, 1].map((k) => (
        <Stick key={k} x={onesAt(P3, k)} y={FEET} s={PS} tutor="a loose stick" />
      ))}
      {[2, 3, 4].map((k, j) => (
        <Mover key={k} to={shown ? { x: onesAt(P3, k) + 140 + j * 50, y: FEET - 300 - j * 30, r: 40 + j * 15, o: 0 } : { x: onesAt(P3, k), y: FEET }} dur={1.0} delay={j * 0.2} ease="cubic-bezier(.45,0,.3,1)">
          <g data-tutor="the three sticks to take away">
            <Glow y={-60} r={70} color="warm" opacity={active && !shown ? 0.5 : 0} />
            <Stick s={PS} />
          </g>
        </Mover>
      ))}

      {/* 25 − 3 = ? */}
      <g data-tutor="the take-away sum">
        {P3_EQ.slice(0, 4).map((it, i) => (
          <EqPiece key={i} it={it} x={P3_EQ_X[i]} y={TILE_Y} size={TS} />
        ))}
        <g transform={`translate(${P3_EQ_X[4]} ${TILE_Y})`}>
          <Mover to={{ x: 0, y: 0, s: shown ? 0.2 : 1, o: shown ? 0 : 1 }} dur={0.35}>
            <QTile />
          </Mover>
        </g>
        <g transform={`translate(${P3_EQ_X[4] + tileW() / 2 + 5} ${TILE_Y})`}>
          <Mover to={{ x: 0, y: 0, s: shown ? 1 : 0.2, o: shown ? 1 : 0 }} dur={0.5} delay={shown ? 1.2 : 0}>
            <PlaceNumber value={22} x={0} y={0} size={TS} tutor="the answer, 22" />
          </Mover>
        </g>
      </g>

      {/* the guess cards */}
      {CARDS.map((n, i) => {
        const cx = CARD.x0 + i * CARD.step
        const picked = pick === n
        const answer = shown && n === 22
        const dim = pick !== null && !picked && !answer
        return (
          <g key={n} transform={`translate(${cx} ${CARD.y})`} data-tutor={`the ${n} card`}>
            <Mover to={{ x: 0, y: picked ? -18 : 0, o: dim ? 0.55 : 1 }} dur={0.35}>
              <g
                onClick={() => active && onPick(n)}
                style={{ cursor: active ? 'pointer' : 'default' }}
                className={active ? 'hot' : undefined}
              >
                {answer && <Glow r={170} color="teal" opacity={0.8} />}
                <rect x={-CARD.w / 2} y={-CARD.h / 2 + 8} width={CARD.w} height={CARD.h} rx={28} fill={N.shadow} opacity={0.22} />
                <rect x={-CARD.w / 2} y={-CARD.h / 2} width={CARD.w} height={CARD.h} rx={28} fill={N.cream} />
                <rect x={-CARD.w / 2 + 12} y={-CARD.h / 2 + 10} width={CARD.w - 24} height={12} rx={6} fill={N.white} opacity={0.6} />
                <PlaceNumber value={n} x={0} y={4} size={54} />
                {answer && <rect x={-CARD.w / 2 - 8} y={-CARD.h / 2 - 8} width={CARD.w + 16} height={CARD.h + 16} rx={34} fill="none" stroke={N.teal} strokeWidth={8} />}
                {picked && !answer && <rect x={-CARD.w / 2 - 8} y={-CARD.h / 2 - 8} width={CARD.w + 16} height={CARD.h + 16} rx={34} fill="none" stroke={N.white} strokeWidth={6} />}
                {active && <rect className="hot-ring" x={-CARD.w / 2} y={-CARD.h / 2} width={CARD.w} height={CARD.h} rx={28} fill="none" stroke={N.white} strokeWidth={5} style={{ animationDelay: `${i * 0.3}s` }} />}
              </g>
            </Mover>
          </g>
        )
      })}
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* The seesaw game                                                      */
/* ------------------------------------------------------------------ */

type Kind = 'bundle' | 'stick'

const ROUNDS = [
  { left: 15, rb: 0, rs: 8 },
  { left: 32, rb: 4, rs: 0 },
  { left: 26, rb: 1, rs: 9 },
] as const

/** Said when a round balances: the change in words. The last one ends the learner's turn. */
const ROUND_WIN = ['Balanced! 8 and 7 more makes 15.', 'Balanced! 40 take away 8 leaves 32.', 'Balanced! 19 and 7 more makes 26.'] as const
const ROUND_START = ['', 'Here is a new one. Make it balance!', 'One more. Make it balance!'] as const
const ROUND_SUM = ['8 + 7 = 15', '40 − 8 = 32', '19 + 7 = 26'] as const

/** What the world says back while the learner plays. */
const SEESAW_LINES = {
  heavy: 'Now the right side is too heavy. See how it tips?',
  light: 'Now the right side is too light. See how it tips?',
  untied: 'Untied! One bundle became ten loose sticks.',
  tied: 'Tied! Ten loose sticks make one bundle.',
  left: 'The left side stays the same. Change the right side.',
  tap: 'To take a stick away, drag it off.',
  fullB: 'There is no room for more bundles.',
  fullS: 'That is a lot of loose sticks! Try tying ten into a bundle.',
  untieMany: 'There are lots of loose sticks already. Try tying ten into a bundle first.',
} as const

const SEESAW_HINTS = [
  [
    'Look at the seesaw. The lower side has more. Does the right side need more, or less?',
    'A bundle is ten and a loose stick is one. How far apart are the two sides?',
    'Try adding loose sticks one at a time, and watch the seesaw.',
  ],
  [
    'Which side is lower? The lower side has more.',
    'Four bundles is forty. How far is that from the left side?',
    'There are no loose sticks to take away. Tap a bundle to untie it into ten loose sticks, then drag some off.',
  ],
  [
    'Does the right side need more, or less?',
    'Count each side the bundle way, then find how far apart they are.',
    'Ten or more loose sticks? Tap the ribbon button to tie ten into a bundle.',
  ],
]

const TRAY = { w: 430, h: 236, tens: 176 }
/** Piece scale on the seesaw trays. */
const BPS = 0.56
/** Feet of the front and back rows on a tray (tray-local, the tray's base at y = 0). */
const ROW_Y = [-22, -124]
const PIV = { x: 800, y: 600 }
const ARM = 400
const PLANK_TOP = -16
const MAX_B = 6
const MAX_S = 20
const bSlot = (k: number): P => ({ x: -TRAY.w / 2 + 32 + (k % 3) * 56, y: ROW_Y[Math.floor(k / 3)] })
const sSlot = (k: number): P => {
  const c = k % 10
  return { x: -TRAY.w / 2 + TRAY.tens + 22 + c * 22 + (c >= 5 ? 8 : 0), y: ROW_Y[Math.floor(k / 10)] }
}
/** Where ten loose sticks gather to be tied (tray-local). */
const CL = { x: -TRAY.w / 2 + TRAY.tens + (TRAY.w - TRAY.tens) / 2, y: -50 }
const tiltOf = (d: number) => (d === 0 ? 0 : Math.sign(d) * Math.min(11, 3 + Math.abs(d) * 0.6))
const TILT = 'transform 0.9s cubic-bezier(.34,1.45,.55,1)'
const BOX_B = { x: 1150, y: 830 }
const BOX_S = { x: 1408, y: 830 }
const TIE_BTN = { x: 902, y: 838 }
const NUM_Y = 150

interface TrayPiece {
  id: number
  kind: Kind
  from?: Pose
}

interface Game {
  round: number
  right: TrayPiece[]
  phase: 'play' | 'busy' | 'won'
  gather: number[]
  ribbon: boolean
  pops: { id: number; x: number; y: number }[]
  untied: boolean
  tied: boolean
  wrongSaid: boolean
  leftSaid: boolean
  tapSaid: boolean
  solved: number
}

const countOf = (ps: TrayPiece[], kind: Kind) => ps.filter((p) => p.kind === kind).length
const totalOf = (ps: TrayPiece[]) => countOf(ps, 'bundle') * 10 + countOf(ps, 'stick')
const startOf = (r: number) => ROUNDS[r].rb * 10 + ROUNDS[r].rs

let pieceIds = 1
const makePiece = (kind: Kind, extra: Partial<TrayPiece> = {}): TrayPiece => ({ id: pieceIds++, kind, ...extra })

function freshRound(r: number, solved: number): Game {
  return {
    round: r,
    right: [...range(ROUNDS[r].rb).map(() => makePiece('bundle')), ...range(ROUNDS[r].rs).map(() => makePiece('stick'))],
    phase: 'play',
    gather: [],
    ribbon: false,
    pops: [],
    untied: false,
    tied: false,
    wrongSaid: false,
    leftSaid: false,
    tapSaid: false,
    solved,
  }
}

/** Where each piece on the right tray sits right now. */
function layout(g: Game) {
  let bi = 0
  let si = 0
  return g.right.map((p) => {
    if (p.kind === 'bundle') return { p, pose: { ...bSlot(bi++) } as Pose }
    const gi = g.gather.indexOf(p.id)
    const slot = si++
    if (gi >= 0) {
      const f = fan(gi, BPS)
      return { p, pose: { x: CL.x + f.dx, y: CL.y, r: f.r } as Pose }
    }
    return { p, pose: { ...sSlot(slot) } as Pose }
  })
}

/** What Pip is told about the seesaw: both amounts, the pieces, the difference, the answer and the mix-ups. */
function describeSeesaw(g: Game) {
  const L = ROUNDS[g.round].left
  const R0 = startOf(g.round)
  const bundles = countOf(g.right, 'bundle')
  const loose = countOf(g.right, 'stick')
  const total = bundles * 10 + loose
  const change = total - R0
  const need = L - total
  const tip = [
    'From the start the answer is to add 7 (8 and 7 more makes 15): for example add 7 loose sticks, or add 1 bundle and take away 3 sticks.',
    'From the start the answer is to take away 8 (40 take away 8 leaves 32). The right side starts as 4 bundles and no loose sticks, so the learner taps a bundle to untie it into ten loose sticks, then drags 8 sticks off, leaving 3 bundles and 2 sticks. Taking a whole bundle off and adding 2 sticks also works.',
    'From the start the answer is to add 7 (19 and 7 more makes 26). 9 loose sticks and 7 more is 16 loose sticks; ten of them can be tied into a bundle, giving 2 bundles and 6 sticks.',
  ][g.round]
  const seen: string[] = []
  if (g.round === 1 && total > R0) seen.push('The learner is adding, but this round needs taking away.')
  if (g.round === 1 && total < L && !g.untied && bundles < 4) seen.push('They took a whole bundle (ten) off instead of untying it.')
  if (g.round !== 1 && total > L && bundles > ROUNDS[g.round].rb) seen.push('They added a bundle; they may be counting a bundle as one stick instead of ten.')
  return [
    `A playground seesaw at the end of the market counter: balance game, round ${g.round + 1} of 3 (${g.solved} solved).`,
    `Left side (fixed): ${L}, shown as ${Math.floor(L / 10)} bundles and ${L % 10} loose sticks, with the number ${L} above it.`,
    `Right side now: ${total}, shown as ${bundles} bundle${bundles === 1 ? '' : 's'} and ${loose} loose stick${loose === 1 ? '' : 's'} (it started at ${R0}; change so far ${change >= 0 ? '+' : ''}${change}).`,
    total > L ? 'The right side is heavier, so the seesaw tips down on the right with a coral glow.' : total < L ? 'The left side is heavier, so the seesaw tips down on the left with a coral glow.' : 'Both sides are equal: the seesaw is level and glows teal.',
    need > 0 ? `The right side needs ${need} more.` : need < 0 ? `The right side has ${-need} too many.` : '',
    `Answer: ${tip}`,
    g.phase === 'won' ? `This round is solved: ${ROUND_SUM[g.round]}.` : '',
    seen.join(' '),
    'Likely mix-ups: adding when they should take away (the lower side has more), forgetting to untie a bundle when there are no loose sticks to take away, or counting a bundle as one instead of ten.',
    'Controls: drag (or tap) the bundle crate or the stick crate to put pieces on the right side; drag a piece off the right side to take it away; tap a bundle on the right side to untie it; tap the violet "tie 10" button to tie ten loose sticks into a bundle.',
  ]
    .filter(Boolean)
    .join(' ')
}

/** Converts a stage point into an element's own coordinates (works inside tilted and moving groups). */
function toLocal(el: SVGGraphicsElement | null, q: P): P | null {
  const m = el?.getScreenCTM()
  const s = el?.ownerSVGElement?.getScreenCTM()
  if (!m || !s) return null
  const pt = new DOMPoint(q.x, q.y).matrixTransform(s).matrixTransform(m.inverse())
  return { x: pt.x, y: pt.y }
}
const onTray = (l: P | null, pad = 30) => !!l && l.x > -TRAY.w / 2 - pad && l.x < TRAY.w / 2 + pad && l.y > -TRAY.h - pad - 40 && l.y < pad

function TrayArt({ glow }: { glow: boolean }) {
  const { w, h, tens } = TRAY
  return (
    <g>
      <rect x={-w / 2 - 8} y={-h - 4} width={w + 16} height={h + 8} rx={26} fill={N.shadow} opacity={0.18} transform="translate(0 8)" />
      <rect x={-w / 2 - 8} y={-h - 4} width={w + 16} height={h + 8} rx={26} fill={N.woodDark} />
      <rect x={-w / 2} y={-h} width={w} height={h} rx={20} fill={N.cream} />
      <path d={`M${-w / 2 + 20} ${-h} H${-w / 2 + tens} V0 H${-w / 2 + 20} Q${-w / 2} 0 ${-w / 2} -20 V${-h + 20} Q${-w / 2} ${-h} ${-w / 2 + 20} ${-h} Z`} fill={N.violetLight} opacity={0.2} />
      <path d={`M${-w / 2 + tens} ${-h} H${w / 2 - 20} Q${w / 2} ${-h} ${w / 2} ${-h + 20} V-20 Q${w / 2} 0 ${w / 2 - 20} 0 H${-w / 2 + tens} Z`} fill={N.goldLight} opacity={0.32} />
      <rect x={-w / 2 + 16} y={-h + 10} width={tens - 28} height={9} rx={4.5} fill={N.violet} opacity={0.6} />
      <rect x={-w / 2 + tens + 12} y={-h + 10} width={w - tens - 28} height={9} rx={4.5} fill={N.gold} opacity={0.8} />
      <line x1={-w / 2 + tens} y1={-h + 6} x2={-w / 2 + tens} y2={-6} stroke={N.sandDark} strokeWidth={3} strokeDasharray="8 8" opacity={0.5} />
      <rect x={-w / 2 - 14} y={-h - 10} width={w + 28} height={h + 20} rx={32} fill="none" stroke={N.teal} strokeWidth={8} style={{ opacity: glow ? 1 : 0, transition: 'opacity 0.5s' }} />
    </g>
  )
}

/** A wooden crate of bundles or loose sticks. Drag from it, or tap it to add one. */
function Crate({ kind, at, enabled, onGhost, onRelease }: { kind: Kind; at: P; enabled: boolean; onGhost: (q: P | null) => void; onRelease: (q: P | null) => void }) {
  const start = useRef<P | null>(null)
  const moved = useRef(false)
  const drag = useDrag({
    onStart: (q) => {
      start.current = q
      moved.current = false
    },
    onMove: (q) => {
      const s = start.current
      if (!s) return
      if (!moved.current && Math.hypot(q.x - s.x, q.y - s.y) < 12) return
      moved.current = true
      onGhost(q)
    },
    onEnd: (q) => {
      const m = moved.current
      start.current = null
      moved.current = false
      onGhost(null)
      onRelease(m ? q : null)
    },
  })
  const bundle = kind === 'bundle'
  return (
    <g transform={`translate(${at.x} ${at.y})`} {...(enabled ? drag : {})} className={enabled ? 'hot' : undefined} data-tutor={bundle ? 'the bundle crate' : 'the stick crate'}>
      <rect x={-122} y={-128} width={244} height={190} fill="transparent" />
      {enabled && <rect className="hot-ring" x={-112} y={-44} width={224} height={92} rx={16} fill="none" stroke={N.white} strokeWidth={4} style={{ animationDelay: bundle ? '0s' : '0.6s' }} />}
      {bundle
        ? [-64, 0, 64].map((x, i) => (
            <g key={i} transform={`translate(${x} -34) rotate(${(i - 1) * 7})`}>
              <Bundle s={0.56} />
            </g>
          ))
        : range(8).map((i) => (
            <g key={i} transform={`translate(${-70 + i * 20} -36) rotate(${(i - 3.5) * 3})`}>
              <Stick s={0.56} />
            </g>
          ))}
      <rect x={-112} y={-38} width={224} height={92} rx={14} fill={N.shadow} opacity={0.2} />
      <rect x={-112} y={-44} width={224} height={92} rx={14} fill={N.woodLight} />
      <rect x={-112} y={-44} width={224} height={16} rx={8} fill={N.woodDark} opacity={0.45} />
      {[-70, 0, 70].map((x) => (
        <rect key={x} x={x - 26} y={-18} width={52} height={56} rx={8} fill={N.wood} opacity={0.4} />
      ))}
    </g>
  )
}

function Seesaw({
  active,
  say,
  emit,
  reportState,
  setHints,
  onPlayDone,
  onCheer,
}: {
  active: boolean
  say: (text: string) => Promise<void>
  emit: ChapterProps['emit']
  reportState: (d: string) => void
  setHints: (h: string[]) => void
  onPlayDone: () => void
  onCheer: () => void
}) {
  const [g, setG] = useState<Game>(() => freshRound(0, 0))
  const live = useRef(g)
  const commit = (next: Game) => {
    live.current = next
    setG(next)
  }
  const update = (fn: (d: Game) => void) => {
    const c = live.current
    const d: Game = { ...c, right: [...c.right], gather: [...c.gather], pops: [...c.pops] }
    fn(d)
    commit(d)
  }
  const [ghost, setGhost] = useState<{ kind: Kind; x: number; y: number } | null>(null)
  const [drag, setDrag] = useState<{ id: number; x: number; y: number } | null>(null)
  const timers = useRef<number[]>([])
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }
  useEffect(() => {
    const list = timers.current
    return () => list.forEach((t) => window.clearTimeout(t))
  }, [])

  const rootRef = useRef<SVGGElement>(null)
  const rightRef = useRef<SVGGElement>(null)
  const leftRef = useRef<SVGGElement>(null)
  const talking = useRef(false)

  const enabled = active && g.phase === 'play'
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const L = ROUNDS[g.round].left
  const bundles = countOf(g.right, 'bundle')
  const loose = countOf(g.right, 'stick')
  const total = bundles * 10 + loose
  const change = total - startOf(g.round)
  const balanced = total === L
  const angle = tiltOf(total - L)

  useEffect(() => {
    if (active) setHints(SEESAW_HINTS[g.round])
  }, [active, g.round, setHints])
  useEffect(() => {
    if (active) reportState(describeSeesaw(g))
  }, [active, g, reportState])

  /** One line from the world, never two on top of each other. Said as say(SEESAW_LINES[key]) so the voice scan finds them. */
  const line = (key: keyof typeof SEESAW_LINES, force = false) => {
    if (talking.current && !force) return
    talking.current = true
    void say(SEESAW_LINES[key]).then(() => {
      talking.current = false
    })
  }

  const win = (d: Game) => {
    const r = d.round
    d.phase = 'won'
    d.solved = r + 1
    emit({ type: 'attempt', correct: true, detail: `balanced round ${r + 1}: ${ROUND_SUM[r]}` })
    onCheer()
    const tidy = countOf(d.right, 'stick') >= 10
    // Ten loose sticks or more: tie ten into a bundle so the right side looks like the left.
    if (tidy) later(() => tieTen(), 700)
    talking.current = true
    const last = r === ROUNDS.length - 1
    void say(ROUND_WIN[r]).then(() => {
      talking.current = false
      if (last) return
      later(() => {
        commit(freshRound(r + 1, r + 1))
        talking.current = true
        void say(ROUND_START[r + 1]).then(() => {
          talking.current = false
        })
      }, tidy ? 1500 : 900)
    })
    if (last) onPlayDone()
  }

  /** After any change on the right: balanced, closer, or further away? */
  const review = (d: Game, prevTotal: number, detail: string) => {
    const t = totalOf(d.right)
    const target = ROUNDS[d.round].left
    if (t === target) {
      win(d)
      return 'won'
    }
    if (Math.abs(t - target) > Math.abs(prevTotal - target)) {
      emit({ type: 'attempt', correct: false, detail: `${detail}, which moved the right side further from ${target} (now ${t})` })
      if (!d.wrongSaid) {
        d.wrongSaid = true
        line(t > target ? 'heavy' : 'light')
      }
    } else {
      emit({ type: 'progress', detail: `${detail} (right side now ${t}, left side ${target})` })
    }
    return 'play'
  }

  const addPiece = (kind: Kind, at: P | null) => {
    const c = live.current
    if (c.phase !== 'play') return
    if (kind === 'bundle' && countOf(c.right, 'bundle') >= MAX_B) return line('fullB')
    if (kind === 'stick' && countOf(c.right, 'stick') >= MAX_S) return line('fullS')
    const box = kind === 'bundle' ? BOX_B : BOX_S
    const f = toLocal(rightRef.current, at ? { x: at.x, y: at.y + 40 } : { x: box.x, y: box.y - 40 }) ?? { x: 0, y: 0 }
    update((d) => {
      const prev = totalOf(d.right)
      d.right = [...d.right, makePiece(kind, { from: { x: f.x, y: f.y } })]
      review(d, prev, kind === 'bundle' ? 'put a bundle (ten) on the right side' : 'put a loose stick (one) on the right side')
    })
  }

  const removePiece = (p: TrayPiece) => {
    if (live.current.phase !== 'play') return
    update((d) => {
      const prev = totalOf(d.right)
      d.right = d.right.filter((q) => q.id !== p.id)
      review(d, prev, p.kind === 'bundle' ? 'took a whole bundle (ten) off the right side' : 'took a loose stick (one) off the right side')
    })
  }

  const untie = (p: TrayPiece) => {
    const c = live.current
    if (c.phase !== 'play') return
    if (countOf(c.right, 'stick') > MAX_S - 10) return line('untieMany')
    const k = c.right.filter((q) => q.kind === 'bundle').findIndex((q) => q.id === p.id)
    if (k < 0) return
    const pos = bSlot(k)
    const prev = totalOf(c.right)
    update((d) => {
      d.right = [
        ...d.right.filter((q) => q.id !== p.id),
        ...range(10).map((i) => {
          const f = fan(i, BPS)
          return makePiece('stick', { from: { x: pos.x + f.dx, y: pos.y, r: f.r } })
        }),
      ]
      d.pops = [...d.pops, { id: p.id, x: pos.x, y: pos.y }]
      d.phase = 'busy'
      d.untied = true
    })
    line('untied', true)
    later(
      () =>
        update((d) => {
          d.pops = d.pops.filter((q) => q.id !== p.id)
          d.phase = 'play'
          review(d, prev, 'untied a bundle into ten loose sticks')
        }),
      800,
    )
  }

  /** Ten loose sticks gather, a ribbon wraps them, and they become one bundle. */
  const tieTen = (byHand = false) => {
    const c = live.current
    const ls = c.right.filter((q) => q.kind === 'stick')
    if (ls.length < 10) return
    if (byHand && c.phase !== 'play') return
    if (countOf(c.right, 'bundle') >= MAX_B) return line('fullB')
    const ten = ls.slice(0, 10).map((q) => q.id)
    update((d) => {
      d.gather = ten
      if (d.phase === 'play') d.phase = 'busy'
    })
    later(() => update((d) => void (d.ribbon = true)), 550)
    later(() => {
      update((d) => {
        const prev = totalOf(d.right)
        d.right = [...d.right.filter((q) => !ten.includes(q.id)), makePiece('bundle', { from: { x: CL.x, y: CL.y } })]
        d.gather = []
        d.ribbon = false
        d.tied = true
        if (d.phase === 'busy') {
          d.phase = 'play'
          review(d, prev, 'tied ten loose sticks into a bundle')
        }
      })
      if (byHand) line('tied', true)
    }, 1100)
  }

  /** Dragging on the bundles side or the loose side of the right tray picks up the nearest piece of that kind. */
  const grab = useRef<{ id: number; kind: Kind; start: P; moved: boolean } | null>(null)
  const zoneHandlers = (kind: Kind) => ({
    onStart: (q: P) => {
      grab.current = null
      if (!enabledRef.current) return
      const l = toLocal(rightRef.current, q)
      if (!l) return
      let best = -1
      let bestD = Infinity
      for (const { p, pose } of layout(live.current)) {
        if (p.kind !== kind) continue
        const dd = Math.hypot(pose.x - l.x, pose.y - 40 - l.y)
        if (dd < bestD) {
          bestD = dd
          best = p.id
        }
      }
      grab.current = { id: best, kind, start: q, moved: false }
    },
    onMove: (q: P) => {
      const gr = grab.current
      if (!gr || gr.id < 0) return
      if (!gr.moved && Math.hypot(q.x - gr.start.x, q.y - gr.start.y) < 14) return
      gr.moved = true
      const l = toLocal(rightRef.current, q)
      if (l) setDrag({ id: gr.id, x: l.x, y: l.y + 40 })
    },
    onEnd: (q: P) => {
      const gr = grab.current
      grab.current = null
      setDrag(null)
      if (!gr || !enabledRef.current) return
      const p = live.current.right.find((x) => x.id === gr.id)
      if (gr.moved) {
        if (p && !onTray(toLocal(rightRef.current, q), 20)) removePiece(p)
        return
      }
      if (gr.kind === 'bundle' && p) return untie(p)
      if (gr.kind === 'stick' && !live.current.tapSaid) {
        update((d) => void (d.tapSaid = true))
        line('tap')
      }
    },
  })
  const tensDrag = useDrag(zoneHandlers('bundle'))
  const onesDrag = useDrag(zoneHandlers('stick'))

  const releaseSupply = (kind: Kind, q: P | null) => {
    if (!enabledRef.current) return
    if (!q) return addPiece(kind, null)
    if (onTray(toLocal(rightRef.current, q), 50)) return addPiece(kind, q)
    if (onTray(toLocal(leftRef.current, q), 40) && !live.current.leftSaid) {
      update((d) => void (d.leftSaid = true))
      line('left')
    }
  }
  const showGhost = (kind: Kind, q: P | null) => {
    const l = q && toLocal(rootRef.current, q)
    setGhost(l ? { kind, x: l.x, y: l.y } : null)
  }

  const placed = layout(g)
  const showTie = loose >= 10 && g.phase !== 'won'
  const rad = (angle * Math.PI) / 180
  const lowEnd = angle > 0 ? { x: PIV.x + ARM * Math.cos(rad), y: PIV.y + ARM * Math.sin(rad) } : { x: PIV.x - ARM * Math.cos(rad), y: PIV.y - ARM * Math.sin(rad) }
  const leftKey = `L${g.round}`

  return (
    <g ref={rootRef}>
      {/* light: teal when level, coral under the side that sinks */}
      <g style={{ opacity: balanced ? 1 : 0, transition: 'opacity 0.6s' }} pointerEvents="none">
        <Glow x={PIV.x} y={PIV.y - 140} r={640} color="teal" opacity={0.75} />
      </g>
      <ellipse cx={lowEnd.x} cy={lowEnd.y - 60} rx={300} ry={190} fill="url(#c5-coral-glow)" style={{ opacity: balanced ? 0 : 0.85, transition: 'opacity 0.6s, cx 0.9s, cy 0.9s' }} pointerEvents="none" />

      {/* the two amounts, written above their sides */}
      <PlaceNumber value={L} x={PIV.x - ARM} y={NUM_Y} size={TS} tutor="the left amount" />
      <PlaceNumber value={total} x={PIV.x + ARM} y={NUM_Y} size={TS} tutor="the right amount" />
      {change !== 0 && g.phase !== 'won' && (
        <g transform={`translate(${PIV.x + ARM + 150} ${NUM_Y})`} data-tutor="the change so far">
          <rect x={-58} y={-30} width={116} height={60} rx={30} fill={N.cream} />
          <text y={13} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={38} fill={N.night0}>
            {`${change > 0 ? '+' : '−'}${Math.abs(change)}`}
          </text>
        </g>
      )}
      <g transform={`translate(${PIV.x} ${NUM_Y})`}>
        <Mover to={{ x: 0, y: 0, s: balanced ? 1 : 0.3, o: balanced ? 1 : 0 }} dur={0.45}>
          <EqTile />
        </Mover>
      </g>
      {/* rounds */}
      <g data-tutor="rounds">
        {range(3).map((i) => (
          <circle key={i} cx={PIV.x - 40 + i * 40} cy={58} r={13} fill={i < g.solved ? N.teal : N.white} opacity={i < g.solved || i === g.round ? 1 : 0.5} stroke={N.night0} strokeOpacity={0.25} strokeWidth={3} />
        ))}
      </g>

      {/* the seesaw */}
      <g data-tutor="the seesaw">
        <ellipse cx={PIV.x} cy={790} rx={170} ry={18} fill={N.shadow} opacity={0.25} />
        <path d={`M${PIV.x - 18} ${PIV.y} L${PIV.x - 120} 786 H${PIV.x - 84} L${PIV.x} ${PIV.y + 40} L${PIV.x + 84} 786 H${PIV.x + 120} L${PIV.x + 18} ${PIV.y} Z`} fill={N.sky} />
        <path d={`M${PIV.x + 18} ${PIV.y} L${PIV.x + 120} 786 H${PIV.x + 100} L${PIV.x} ${PIV.y + 20} Z`} fill={N.skyDark} opacity={0.6} />
        <rect x={PIV.x - 130} y={780} width={260} height={16} rx={8} fill={N.skyDark} />
        <g transform={`translate(${PIV.x} ${PIV.y})`}>
          <g style={{ transform: `rotate(${angle}deg)`, transition: TILT }}>
            {/* plank and handles */}
            <rect x={-490} y={-16} width={980} height={32} rx={16} fill={N.wood} />
            <rect x={-490} y={-16} width={980} height={11} rx={5} fill={N.woodLight} />
            <rect x={-490} y={6} width={980} height={10} rx={5} fill={N.woodDark} opacity={0.4} />
            {[-1, 1].map((sd) => (
              <g key={sd} transform={`translate(${sd * (ARM - TRAY.w / 2 - 34)} 0)`}>
                <rect x={-8} y={-96} width={16} height={84} rx={8} fill={N.skyDark} />
                <rect x={-28} y={-104} width={56} height={18} rx={9} fill={N.sky} />
              </g>
            ))}
            {/* left side: fixed for the round */}
            <g ref={leftRef} transform={`translate(${-ARM} ${PLANK_TOP})`} data-tutor="the left side">
              <TrayArt glow={balanced} />
              <g key={leftKey}>
                <Mover from={{ x: 0, y: 0, o: 0 }} to={{ x: 0, y: 0, o: 1 }} dur={0.5}>
                  {range(Math.floor(L / 10)).map((k) => (
                    <Bundle key={`b${k}`} x={bSlot(k).x} y={bSlot(k).y} s={BPS} tutor="a bundle on the left" />
                  ))}
                  {range(L % 10).map((k) => (
                    <Stick key={`s${k}`} x={sSlot(k).x} y={sSlot(k).y} s={BPS} tutor="a loose stick on the left" />
                  ))}
                </Mover>
              </g>
            </g>
            {/* right side: the learner's */}
            <g ref={rightRef} transform={`translate(${ARM} ${PLANK_TOP})`} data-tutor="the right side">
              <TrayArt glow={balanced} />
              {placed.map(({ p, pose }) => {
                const held = drag && drag.id === p.id
                return (
                  <Mover key={p.id} to={held ? { x: drag.x, y: drag.y, s: 1.15 } : pose} from={p.from} instant={!!held} dur={0.5}>
                    {p.kind === 'bundle' ? <Bundle s={BPS} tutor="a bundle on the right" /> : <Stick s={BPS} tutor="a loose stick on the right" />}
                  </Mover>
                )
              })}
              {g.ribbon && (
                <Mover from={{ x: CL.x, y: CL.y, s: 0.05, r: -160 }} to={{ x: CL.x, y: CL.y, s: BPS }} dur={0.4}>
                  <Ribbon />
                </Mover>
              )}
              {g.pops.map((q) => (
                <Mover key={q.id} from={{ x: q.x, y: q.y, s: BPS }} to={{ x: q.x + 40, y: q.y - 110, r: 160, s: BPS, o: 0 }} dur={0.8} ease="ease-out">
                  <Ribbon />
                </Mover>
              ))}
              {/* the two sides of the tray are the handles for picking pieces up */}
              <rect {...(enabled ? tensDrag : {})} x={-TRAY.w / 2} y={-TRAY.h} width={TRAY.tens} height={TRAY.h + 10} fill="transparent" data-tutor="the bundles side of the right tray" />
              <rect {...(enabled ? onesDrag : {})} x={-TRAY.w / 2 + TRAY.tens} y={-TRAY.h} width={TRAY.w - TRAY.tens} height={TRAY.h + 10} fill="transparent" data-tutor="the loose sticks side of the right tray" />
            </g>
          </g>
          <circle r={26} fill={N.night0} opacity={0.2} cy={4} />
          <circle r={24} style={{ fill: balanced ? N.teal : N.coral, transition: 'fill 0.5s' }} stroke={N.white} strokeWidth={5} />
        </g>
        {g.phase === 'won' && (
          <g transform={`translate(${PIV.x} ${PIV.y})`} pointerEvents="none">
            <Mover key={`ring${g.round}`} from={{ x: 0, y: 0, s: 0.3, o: 1 }} to={{ x: 0, y: 0, s: 3, o: 0 }} dur={1.2} ease="ease-out">
              <circle r={120} fill="none" stroke={N.tealLight} strokeWidth={10} />
            </Mover>
          </g>
        )}
      </g>

      {/* supplies and the tie button */}
      <Crate kind="bundle" at={BOX_B} enabled={enabled} onGhost={(q) => showGhost('bundle', q)} onRelease={(q) => releaseSupply('bundle', q)} />
      <Crate kind="stick" at={BOX_S} enabled={enabled} onGhost={(q) => showGhost('stick', q)} onRelease={(q) => releaseSupply('stick', q)} />
      {showTie && (
        <g transform={`translate(${TIE_BTN.x} ${TIE_BTN.y})`} onClick={() => enabled && tieTen(true)} style={{ cursor: enabled ? 'pointer' : 'default' }} data-tutor="the tie 10 button">
          <Mover from={{ x: 0, y: 0, s: 0.3, o: 0 }} to={{ x: 0, y: 0 }} dur={0.4}>
            {enabled && <rect className="hot-ring" x={-110} y={-48} width={220} height={96} rx={48} fill="none" stroke={N.violetLight} strokeWidth={5} />}
            <rect x={-110} y={-42} width={220} height={96} rx={48} fill={N.shadow} opacity={0.2} />
            <rect x={-110} y={-48} width={220} height={96} rx={48} fill={N.violet} />
            <g transform="translate(-62 50) scale(0.62)">
              <path d="M0 -74 Q-26 -98 -30 -76 Q-26 -60 0 -74 Q26 -98 30 -76 Q26 -60 0 -74 Z" fill={N.violetDark} />
              <circle cy={-74} r={7} fill={N.violetLight} />
            </g>
            <text x={22} y={13} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={38} fill={N.white}>
              tie 10
            </text>
          </Mover>
        </g>
      )}
      {ghost && (
        <g transform={`translate(${ghost.x} ${ghost.y + 40}) scale(${BPS * 1.15})`} style={{ pointerEvents: 'none' }}>
          {ghost.kind === 'bundle' ? <Bundle /> : <Stick />}
        </g>
      )}
    </g>
  )
}

/** Grass and a few flowers past the end of the counter. */
function Playground() {
  return (
    <g pointerEvents="none">
      <path d="M-60 772 Q300 744 800 770 T2000 762 V1000 H-60 Z" fill="#6ccb88" />
      <path d="M-60 790 Q300 764 800 790 T2000 782 V1000 H-60 Z" fill="#3c9c5d" />
      {[
        [150, 846],
        [430, 872],
        [640, 836],
        [1010, 880],
        [1530, 856],
      ].map(([x, y], i) => (
        <g key={i}>
          <path d={`M${x - 14} ${y + 6} Q${x - 10} ${y - 10} ${x - 4} ${y + 6} M${x - 2} ${y + 6} Q${x + 2} ${y - 14} ${x + 8} ${y + 6}`} stroke="#2e8a4f" strokeWidth={4} fill="none" strokeLinecap="round" />
          <circle cx={x + 18} cy={y - 2} r={6} fill={i % 2 ? N.cream : N.sandLight} />
        </g>
      ))}
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* The chapter                                                          */
/* ------------------------------------------------------------------ */

export function Ch5Change({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const sheepRef = useRef<SVGGElement>(null)
  const [pick, setPick] = useState<number | null>(null)
  const [gone, setGone] = useState(false)
  const timers = useRef<number[]>([])
  useEffect(() => {
    const list = timers.current
    return () => list.forEach((t) => window.clearTimeout(t))
  }, [])

  const guessing = cueIndex === 3 && pick === null
  /** Past the guess, the answer stays shown even if the learner never tapped. */
  const shown = gone || cueIndex > 3

  const build = useCallback((tl: gsap.core.Timeline) => {
    const later = { immediateRender: false }
    const at0 = (sel: string | string[], vars: gsap.TweenVars) => tl.set(sel, vars, 0)
    const pop = (sel: string | string[], t: number, dur = 0.45) =>
      tl.fromTo(sel, { opacity: 0, scale: 0.3, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: dur, ease: 'back.out(2.2)', ...later }, t)
    const hide = (sel: string | string[], t: number, dur = 0.4) => tl.to(sel, { opacity: 0, duration: dur }, t)
    const swap = (out: string | string[], inn: string | string[], t: number) => {
      tl.set(out, { opacity: 0 }, t)
      tl.set(inn, { opacity: 1 }, t)
    }
    const pulse = (sel: string, t: number, k = 1.22) => tl.to(sel, { scale: k, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.out', transformOrigin: '50% 50%' }, t)
    /** A tile that has just changed lands with a little bump. */
    const bump = (sel: string, t: number) => tl.fromTo(sel, { scale: 1.4 }, { scale: 1, duration: 0.45, ease: 'back.out(3)', transformOrigin: '50% 50%', ...later }, t)
    const flash = (sel: string, t: number, hold = 1) => {
      tl.to(sel, { opacity: 1, duration: 0.3 }, t)
      tl.to(sel, { opacity: 0, duration: 0.5 }, t + hold)
    }
    const hop = (sel: string, to: P, t: number, dur = 0.8, lift = 120, fromY = FEET) => {
      tl.to(sel, { x: to.x, duration: dur, ease: 'power1.inOut' }, t)
      tl.to(sel, { y: Math.min(fromY, to.y) - lift, duration: dur / 2, ease: 'sine.out' }, t)
      tl.to(sel, { y: to.y, duration: dur / 2, ease: 'sine.in' }, t + dur / 2)
    }
    const land = (sel: string, t: number) => tl.to(sel, { scaleY: 0.86, scaleX: 1.08, duration: 0.09, yoyo: true, repeat: 1, ease: 'power1.out', transformOrigin: '50% 100%' }, t)
    const place = (sel: string, p: P, extra: gsap.TweenVars = {}) => at0(sel, { x: p.x, y: p.y, ...extra })
    const pan = (from: number, to: number, t: number, k: number) => {
      tl.to(`.st${from}`, { x: -1600, duration: PAN, ease: 'power3.inOut' }, t)
      tl.to(`.st${to}`, { x: 0, duration: PAN, ease: 'power3.inOut' }, t)
      tl.to('.c5-front', { x: -1600 * k, duration: PAN, ease: 'power3.inOut' }, t)
      // Once out of sight, a station steps right out of the way.
      tl.set(`.st${from}`, { x: -3200 }, t + PAN)
      tl.to('.c5-mid', { x: -MID_STEP * k, duration: PAN, ease: 'power3.inOut' }, t)
      tl.set('.c5-sheep', { '--walk': 1 }, t)
      tl.set('.c5-sheep', { '--walk': 0 }, t + PAN)
    }
    const sheepHop = (t: number) => tl.to('.c5-sheep-hop', { y: -46, duration: 0.2, yoyo: true, repeat: 3, ease: 'power2.out' }, t)
    const sparkles = (cls: string, t: number) =>
      range(10).forEach((i) => {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2
        const r = 110 + (i % 3) * 26
        tl.fromTo(`.${cls}${i}`, { x: 0, y: 0, scale: 0.2, opacity: 1 }, { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.8, scale: 1, opacity: 0, duration: 0.9, ease: 'power2.out', ...later }, t)
      })

    /* ---------- starting state */
    at0('.st1', { x: 0 })
    at0(['.st2', '.st3', '.st4', '.st5', '.st6'], { x: 1600 })
    at0('.c5-mid', { x: 0 })
    at0('.c5-front', { x: 0 })
    at0('.c5-glow', { opacity: 0 })

    // station 1: 25 + 13
    at0('.s1-A', { x: -90 })
    at0('.s1-B', { x: 560 })
    at0('.s1-cam', { x: 0 })
    ;[0, 1].forEach((k) => place(`.s1-ab${k}`, { x: tensAt(A1, k), y: FEET }))
    range(5).forEach((k) => place(`.s1-as${k}`, { x: onesAt(A1, k), y: FEET }))
    place('.s1-bb0', { x: tensAt(B1, 0), y: FEET })
    range(3).forEach((k) => place(`.s1-bs${k}`, { x: onesAt(B1, k), y: FEET }))
    place('.s1-bt-t', { x: tensTileX(centre(B1)), y: TILE_Y })
    place('.s1-bt-o', { x: onesTileX(centre(B1)), y: TILE_Y })
    at0(['.s1-n35', '.s1-n38', '.s1-plus', '.s1-word', '.s1-sum'], { opacity: 0 })

    // station 2: 27 + 5
    at0('.s2-cam', { x: 0 })
    ;[0, 1].forEach((k) => place(`.s2-ab${k}`, { x: tensAt(A2, k), y: FEET }))
    range(7).forEach((k) => place(`.s2-as${k}`, { x: onesAt(A2, k), y: FEET }, { rotation: 0 }))
    range(5).forEach((k) => place(`.s2-bs${k}`, { x: onesAt(B2, k), y: FEET }, { rotation: 0 }))
    place('.s2-bt', { x: centre(B2), y: TILE_Y })
    place('.s2-carry', { x: onesTileX(centre(A2)) - 6, y: TILE_Y })
    place('.s2-nb', TIE2)
    place('.s2-rib', { x: TIE2.x, y: TIE2.y })
    at0(['.s2-c', '.s2-n32', '.s2-carry', '.s2-nb', '.s2-rib', '.s2-ring10', '.s2-sum', '.s2-sp'], { opacity: 0 })

    // station 4: 32 − 7
    ;[0, 1, 2].forEach((k) => place(`.s4-b${k}`, { x: tensAt(A4, k), y: FEET }))
    ;[0, 1].forEach((k) => place(`.s4-s${k}`, { x: onesAt(A4, k), y: FEET }, { rotation: 0 }))
    range(10).forEach((i) => place(`.s4-u${i}`, { x: UNTIE4.x + fan(i).dx, y: UNTIE4.y }, { rotation: fan(i).r, transformOrigin: '50% 100%' }))
    place('.s4-rib', { x: UNTIE4.x, y: UNTIE4.y }, { rotation: 0, scale: PS, transformOrigin: '50% 50%' })
    at0(['.s4-u', '.s4-rib', '.s4-c', '.s4-n25', '.s4-bk7', '.s4-sum'], { opacity: 0 })

    // station 5: the number line
    place('.s5-hopper', { x: nlx(25), y: HOP_Y })
    at0('.s5-hopper', { opacity: 0 })
    at0('.s5-face', { scaleX: 1, transformOrigin: '50% 50%' })
    at0('.s5-arc', { strokeDashoffset: 1, opacity: 1 })
    at0(['.s5-eq1', '.s5-eq2', '.s5-hl', '.s5-icon'], { opacity: 0 })

    /* ---------- 0. Two amounts arrive and slide together: adding. */
    tl.addLabel('b0', 0)
    tl.set('.c5-sheep', { '--walk': 1 }, 0)
    tl.set('.c5-sheep', { '--walk': 0 }, PAN)
    tl.fromTo('.c5-world', { scale: 1.05 }, { scale: 1, duration: 7, ease: 'sine.inOut', svgOrigin: '800 700' }, 0)
    tl.to('.s1-B', { x: 170, duration: 1.4, ease: 'power3.out' }, 2.0)
    land('.s1-bb0', 3.3)
    tl.to('.s1-A', { x: 0, duration: 1.2, ease: 'power2.inOut' }, 4.5)
    tl.to('.s1-B', { x: 0, duration: 1.2, ease: 'power2.inOut' }, 4.5)
    pop('.s1-plus', 5.3)
    tl.fromTo('.s1-word', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', ...later }, 5.7)

    /* ---------- 1. 25 + 13: bundles with bundles, sticks with sticks. */
    const b1 = 7.0
    tl.addLabel('b1', b1)
    flash('.s1-g-ab', b1 + 0.3, 1.0)
    pulse('.s1-n25 .pv-tens', b1 + 0.4)
    flash('.s1-g-as', b1 + 1.2, 1.0)
    pulse('.s1-n25 .pv-ones', b1 + 1.3)
    flash('.s1-g-bb', b1 + 2.3, 0.9)
    pulse('.s1-bt-t', b1 + 2.4)
    flash('.s1-g-bs', b1 + 3.1, 0.9)
    pulse('.s1-bt-o', b1 + 3.2)
    hop('.s1-bb0', { x: tensAt(A1, 2), y: FEET }, b1 + 4.4, 1.0, 150)
    land('.s1-bb0', b1 + 5.4)
    hop('.s1-bt-t', { x: tensTileX(centre(A1)), y: TILE_Y }, b1 + 4.5, 0.9, 60, TILE_Y)
    swap(['.s1-n25', '.s1-bt-t'], '.s1-n35', b1 + 5.4)
    bump('.s1-n35 .pv-tens', b1 + 5.4)
    range(3).forEach((k) => {
      hop(`.s1-bs${k}`, { x: onesAt(A1, 5 + k), y: FEET }, b1 + 6.2 + k * 0.25, 0.75, 110)
      land(`.s1-bs${k}`, b1 + 6.95 + k * 0.25)
    })
    hop('.s1-bt-o', { x: onesTileX(centre(A1)), y: TILE_Y }, b1 + 6.6, 0.9, 60, TILE_Y)
    swap(['.s1-n35', '.s1-bt-o'], '.s1-n38', b1 + 7.5)
    bump('.s1-n38 .pv-ones', b1 + 7.5)
    hide(['.s1-clothB', '.s1-plus', '.s1-word'], b1 + 7.5, 0.5)
    tl.to(['.s1-cam', '.c5-front'], { x: CAM_SHIFT, duration: 1.4, ease: 'power2.inOut' }, b1 + 7.8)
    flash('.s1-g-rb', b1 + 8.3, 0.9)
    pulse('.s1-n38 .pv-tens', b1 + 8.4)
    flash('.s1-g-rs', b1 + 9.1, 0.9)
    pulse('.s1-n38 .pv-ones', b1 + 9.2)
    tl.fromTo('.s1-sum', { opacity: 0, y: -30 }, { opacity: 1, y: 0, duration: 0.6, ease: 'back.out(1.8)', ...later }, b1 + 9.9)

    /* ---------- 2. 27 + 5: twelve loose sticks overflow, ten are tied, and the 1 carries. */
    const b2 = b1 + 11.0
    tl.addLabel('b2', b2)
    pan(1, 2, b2, 1)
    flash('.s2-g-as', b2 + 2.3, 1.0)
    pulse('.s2-n27 .pv-ones', b2 + 2.4)
    flash('.s2-g-bs', b2 + 3.2, 0.8)
    pulse('.s2-bt', b2 + 3.3)
    range(5).forEach((k) => {
      hop(`.s2-bs${k}`, { x: onesAt(A2, 7 + k), y: FEET }, b2 + 3.9 + k * 0.16, 0.7, 120)
      land(`.s2-bs${k}`, b2 + 4.6 + k * 0.16)
    })
    hop('.s2-bt', { x: onesTileX(centre(A2)) + WIDE_DX, y: TILE_Y }, b2 + 4.5, 0.8, 70, TILE_Y)
    swap(['.s2-n27', '.s2-bt'], ['.s2-c-t', '.s2-c-o12'], b2 + 5.3)
    bump('.s2-c-o12', b2 + 5.3)
    tl.to('.s2-c-o12', { rotation: 7, duration: 0.08, yoyo: true, repeat: 5, ease: 'sine.inOut', transformOrigin: '50% 50%' }, b2 + 5.8)
    hide(['.s2-clothB', '.s2-plus'], b2 + 5.4, 0.5)
    flash('.s2-ring10', b2 + 5.8, 0.6)
    const TEN = [...range(7).map((k) => `.s2-as${k}`), '.s2-bs0', '.s2-bs1', '.s2-bs2']
    TEN.forEach((sel, i) => {
      const f = fan(i)
      const t = b2 + 6.2 + i * 0.03
      hop(sel, { x: TIE2.x + f.dx, y: TIE2.y }, t, 0.75, 80)
      tl.to(sel, { rotation: f.r, duration: 0.75, ease: 'power2.inOut', transformOrigin: '50% 100%' }, t)
    })
    tl.fromTo('.s2-rib', { opacity: 0, scale: 0.1, rotation: -160 }, { opacity: 1, scale: PS, rotation: 0, duration: 0.45, ease: 'back.out(2)', transformOrigin: '50% 50%', ...later }, b2 + 7.0)
    swap([...TEN, '.s2-rib'], '.s2-nb', b2 + 7.45)
    tl.fromTo('.s2-nb', { scale: 1.25 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.45)', transformOrigin: '50% 100%', ...later }, b2 + 7.45)
    flash('.s2-g-tie', b2 + 7.45, 0.7)
    sparkles('s2-sp', b2 + 7.45)
    sheepHop(b2 + 7.55)
    hop('.s2-nb', { x: tensAt(A2, 2), y: FEET }, b2 + 8.3, 0.9, 80, TIE2.y)
    land('.s2-nb', b2 + 9.2)
    tl.to('.s2-bs3', { x: onesAt(A2, 0), duration: 0.6, ease: 'power2.inOut' }, b2 + 8.5)
    tl.to('.s2-bs4', { x: onesAt(A2, 1), duration: 0.6, ease: 'power2.inOut' }, b2 + 8.58)
    swap('.s2-c-o12', '.s2-carry', b2 + 8.4)
    hop('.s2-carry', { x: tensTileX(centre(A2)), y: TILE_Y }, b2 + 8.4, 0.8, 80, TILE_Y)
    pop('.s2-c-o2', b2 + 8.65, 0.35)
    swap(['.s2-c-t', '.s2-c-o2', '.s2-carry'], '.s2-n32', b2 + 9.2)
    bump('.s2-n32 .pv-tens', b2 + 9.2)
    tl.to('.s2-cam', { x: CAM_SHIFT, duration: 1.3, ease: 'power2.inOut' }, b2 + 9.4)
    tl.to('.c5-front', { x: -1600 + CAM_SHIFT, duration: 1.3, ease: 'power2.inOut' }, b2 + 9.4)
    flash('.s2-g-all', b2 + 9.9, 0.9)
    pulse('.s2-n32', b2 + 10.0)
    tl.fromTo('.s2-sum', { opacity: 0, y: -30 }, { opacity: 1, y: 0, duration: 0.6, ease: 'back.out(1.8)', ...later }, b2 + 10.3)

    /* ---------- 3. The learner guesses 25 take away 3 (the pieces and cards are React's). */
    const b3 = b2 + 11.3
    tl.addLabel('b3', b3)
    pan(2, 3, b3, 2)

    /* ---------- 4. 32 − 7: untie a bundle, then seven sticks go in the basket. */
    const b4 = b3 + PAN + 0.2
    tl.addLabel('b4', b4)
    pan(3, 4, b4, 3)
    pulse('.s4-minus', b4 + 1.9)
    pulse('.s4-seven', b4 + 3.1)
    pulse('.s4-n32', b4 + 3.7)
    flash('.s4-g-s2', b4 + 5.2, 1.3)
    pulse('.s4-n32 .pv-ones', b4 + 5.3)
    tl.to(['.s4-s0', '.s4-s1'], { rotation: 6, duration: 0.1, yoyo: true, repeat: 3, ease: 'sine.inOut', transformOrigin: '50% 100%' }, b4 + 5.7)
    flash('.s4-g-b2', b4 + 7.1, 0.9)
    hop('.s4-b2', UNTIE4, b4 + 7.4, 0.9, 50)
    swap('.s4-b2', ['.s4-u', '.s4-rib'], b4 + 8.3)
    tl.to('.s4-rib', { x: UNTIE4.x + 120, y: UNTIE4.y - 200, rotation: 220, opacity: 0, duration: 0.9, ease: 'power2.out', transformOrigin: '50% 50%' }, b4 + 8.35)
    swap('.s4-n32', ['.s4-c-t', '.s4-c-o2'], b4 + 8.4)
    bump('.s4-c-t', b4 + 8.4)
    range(10).forEach((i) => {
      const t = b4 + 8.6 + i * 0.07
      hop(`.s4-u${i}`, { x: onesAt(A4, 2 + i), y: FEET }, t, 0.6, 40, UNTIE4.y)
      tl.to(`.s4-u${i}`, { rotation: 0, duration: 0.6, ease: 'power2.out' }, t)
    })
    swap('.s4-c-o2', '.s4-c-o12', b4 + 10.0)
    bump('.s4-c-o12', b4 + 10.0)
    flash('.s4-g-ones', b4 + 10.9, 1.0)
    pulse('.s4-c-o12', b4 + 11.0)
    range(7).forEach((j) => {
      const sel = `.s4-u${j + 3}`
      const t = b4 + 12.4 + j * 0.2
      hop(sel, { x: BASKET.x - 74 + j * 6, y: BASKET.y - 34 }, t, 0.75, 170)
      tl.to(sel, { rotation: 62 + j * 2, duration: 0.75, ease: 'power1.inOut' }, t)
    })
    pop('.s4-bk7', b4 + 14.1)
    swap(['.s4-c-t', '.s4-c-o12'], '.s4-n25', b4 + 14.4)
    bump('.s4-n25 .pv-ones', b4 + 14.4)
    flash('.s4-g-all', b4 + 14.8, 0.9)
    pulse('.s4-n25', b4 + 14.9)
    tl.fromTo('.s4-sum', { opacity: 0, y: -30 }, { opacity: 1, y: 0, duration: 0.6, ease: 'back.out(1.8)', ...later }, b4 + 15.1)

    /* ---------- 5. The same moves as jumps on a number line. */
    const b5 = b4 + 16.0
    tl.addLabel('b5', b5)
    pan(4, 5, b5, 4)
    tl.fromTo('.s5-cam', { scale: 1 }, { scale: 1.035, duration: 14, ease: 'sine.inOut', svgOrigin: '800 430', ...later }, b5 + PAN)
    tl.to('.s5-hopper', { opacity: 1, duration: 0.2 }, b5 + 2.0)
    tl.fromTo('.s5-hopper', { y: HOP_Y - 220 }, { y: HOP_Y, duration: 0.8, ease: 'bounce.out', ...later }, b5 + 2.0)
    ;[0, 1, 2].forEach((i) => pop(`.s5-eq1-${i}`, b5 + 5.6 + i * 0.2))
    tl.fromTo('.s5-arc-big', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.0, ease: 'none', ...later }, b5 + 6.6)
    hop('.s5-hopper', { x: nlx(35), y: HOP_Y }, b5 + 6.6, 1.0, 165, HOP_Y)
    pop('.s5-icon-big', b5 + 7.0)
    pulse('.nl-label-35', b5 + 7.6, 1.35)
    range(3).forEach((k) => {
      const t = b5 + 8.3 + k * 0.55
      tl.fromTo(`.s5-arc-f${k}`, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.45, ease: 'none', ...later }, t)
      hop('.s5-hopper', { x: nlx(36 + k), y: HOP_Y }, t, 0.45, 55, HOP_Y)
      pop(`.s5-icon-f${k}`, t + 0.2, 0.3)
    })
    pop('.s5-hl-38', b5 + 10.1)
    pop('.s5-eq1-3', b5 + 10.4)
    pop('.s5-eq1-4', b5 + 10.6)
    hide(['.s5-fwd', '.s5-icon', '.s5-hl-38', '.s5-eq1'], b5 + 11.3, 0.5)
    tl.to('.s5-hopper', { opacity: 0, duration: 0.25 }, b5 + 11.3)
    tl.set('.s5-hopper', { x: nlx(32) }, b5 + 11.6)
    tl.set('.s5-face', { scaleX: -1 }, b5 + 11.6)
    tl.to('.s5-hopper', { opacity: 1, duration: 0.25 }, b5 + 11.6)
    ;[0, 1, 2].forEach((i) => pop(`.s5-eq2-${i}`, b5 + 11.8 + i * 0.2))
    range(7).forEach((k) => {
      const t = b5 + 12.4 + k * 0.36
      tl.fromTo(`.s5-arc-b${k}`, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.32, ease: 'none', ...later }, t)
      hop('.s5-hopper', { x: nlx(31 - k), y: HOP_Y }, t, 0.32, 45, HOP_Y)
      pop(`.s5-icon-b${k}`, t + 0.15, 0.25)
    })
    pop('.s5-hl-25', b5 + 15.0)
    pop('.s5-eq2-3', b5 + 15.1)
    pop('.s5-eq2-4', b5 + 15.3)

    /* ---------- 6. Past the end of the counter: the playground seesaw. */
    const b6 = b5 + 16.2
    tl.addLabel('b6', b6)
    pan(5, 6, b6, 5)
    tl.addLabel('b7', b6 + PAN + 0.2)
  }, [])

  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  // What Pip sees, and hints for the guess.
  useEffect(() => {
    if (cueIndex === 3) {
      reportState(
        'Quick guess. A cloth on the market counter shows 25: 2 bundles of ten and 5 loose sticks. Above it: 25 − 3 = ? (pink question tile). ' +
          'Three cards stand on the counter: 22, 25 and 28. The learner taps a guess; any guess is fine, and then the 3 sticks are taken away to show the answer. ' +
          (pick === null ? 'They have not picked yet. ' : `They picked ${pick}. `) +
          'Correct answer: 22 (2 bundles and 2 sticks). Likely mix-ups: 28 (adding 3 instead of taking away) or 25 (thinking nothing changes).',
      )
      setHints(PREDICT_HINTS)
    } else if (cueIndex !== 6) {
      reportState(STATE[cueIndex] ?? '')
    }
  }, [cueIndex, pick, reportState, setHints])

  const choose = (n: number) => {
    if (!guessing) return
    const key = n as keyof typeof PREDICT_LINES
    setPick(n)
    emit({ type: 'attempt', correct: n === 22, detail: `guessed ${n} for 25 take away 3 (answer 22)` })
    void say(PREDICT_LINES[key])
    timers.current.push(window.setTimeout(() => setGone(true), 250))
    // Long enough to watch the three sticks go, even when the line is short.
    timers.current.push(window.setTimeout(onPlayDone, 2000))
  }

  const cheer = useCallback(() => {
    sheepRef.current?.animate(
      [
        { transform: 'translateY(0px)' },
        { transform: 'translateY(-48px)', offset: 0.25 },
        { transform: 'translateY(0px)', offset: 0.5 },
        { transform: 'translateY(-36px)', offset: 0.75 },
        { transform: 'translateY(0px)' },
      ],
      { duration: 900, easing: 'ease-in-out' },
    )
  }, [])

  const s1n = centre(A1)
  const s2n = centre(A2)
  const s4n = centre(A4)
  const S4_CHIP = { minus: s4n + 128, seven: s4n + 200 }

  return (
    <g ref={root}>
      <defs>
        {/* Tipping light for the seesaw. The kit has no coral glow, so it lives here. */}
        <radialGradient id="c5-coral-glow">
          <stop offset="0" stopColor={N.coralLight} stopOpacity="0.75" />
          <stop offset="0.45" stopColor={N.coral} stopOpacity="0.3" />
          <stop offset="1" stopColor={N.coral} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Far away: the valley sky and hills. They barely move as we walk along. */}
      <Valley time="day" />
      <g className="c5-mid">
        <FarMarket />
      </g>

      {/* ---------------- station 1: 25 + 13 */}
      <g className="c5-world">
      {/* Our counter, its awning, and the grass past its end: one long strip the stations slide along. */}
      <g className="c5-front">
        <Valance x1={6400 + 1560} />
        <Counter x1={6400 + 1540} cap />
        <g transform="translate(8000 0)">
          <Playground />
        </g>
      </g>

      <g className="st1">
        <g>
          <g className="s1-cam">
            <GlowE className="c5-glow s1-g-ab" x={tensAt(A1, 0.5)} y={FEET - 70} rx={150} ry={120} color="violet" />
            <GlowE className="c5-glow s1-g-as" x={(onesAt(A1, 0) + onesAt(A1, 4)) / 2} y={FEET - 70} rx={130} ry={110} />
            <GlowE className="c5-glow s1-g-bb" x={tensAt(B1, 0)} y={FEET - 70} rx={110} ry={120} color="violet" />
            <GlowE className="c5-glow s1-g-bs" x={onesAt(B1, 1)} y={FEET - 70} rx={100} ry={110} />
            <GlowE className="c5-glow s1-g-rb" x={tensAt(A1, 1)} y={FEET - 70} rx={190} ry={120} color="violet" />
            <GlowE className="c5-glow s1-g-rs" x={(onesAt(A1, 0) + onesAt(A1, 7)) / 2} y={FEET - 70} rx={170} ry={110} />
            <g className="s1-A">
              <Cloth c={A1} tutor="the first amount, 25" />
              <Piece cls="s1-ab0" kind="b" tutor="a bundle of ten" />
              <Piece cls="s1-ab1" kind="b" tutor="a bundle of ten" />
              {range(5).map((k) => (
                <Piece key={k} cls={`s1-as${k}`} kind="s" tutor="a loose stick" />
              ))}
              <PlaceNumber className="s1-n25" value={25} x={s1n} y={TILE_Y} tutor="the number 25" />
              <PlaceNumber className="s1-n35" value={35} x={s1n} y={TILE_Y} />
              <PlaceNumber className="s1-n38" value={38} x={s1n} y={TILE_Y} tutor="the total, 38" />
            </g>
            <g className="s1-B">
              <Cloth c={B1} className="s1-clothB" tutor="the second amount, 13" />
              <Piece cls="s1-bb0" kind="b" tutor="the bundle from 13" />
              {range(3).map((k) => (
                <Piece key={k} cls={`s1-bs${k}`} kind="s" tutor="a loose stick from 13" />
              ))}
              <FlyTile cls="s1-bt-t" text="1" tens />
              <FlyTile cls="s1-bt-o" text="3" />
            </g>
            <g className="s1-plus" transform={`translate(${PLUS_X} ${TILE_Y})`}>
              <OpBadge sign="+" />
            </g>
            <g className="s1-word">
              <Title x={PLUS_X} y={662} size={44}>
                adding
              </Title>
            </g>
          </g>
        </g>
        <g className="s1-sum">
          <EqRow items={[25, '+', 13, '=', 38]} x={800} y={SUM_Y} cls="s1-sumi" tutor="25 + 13 = 38" />
        </g>
      </g>

      {/* ---------------- station 2: 27 + 5, with an overflow */}
      <g className="st2">
        <g className="s2-cam">
          <GlowE className="c5-glow s2-g-as" x={(onesAt(A2, 0) + onesAt(A2, 6)) / 2} y={FEET - 70} rx={160} ry={110} />
          <GlowE className="c5-glow s2-g-bs" x={onesAt(B2, 2)} y={FEET - 70} rx={120} ry={110} />
          <GlowE className="c5-glow s2-g-tie" x={TIE2.x} y={TIE2.y - 70} rx={160} ry={150} color="violet" />
          <GlowE className="c5-glow s2-g-all" x={centre(A2)} y={FEET - 70} rx={380} ry={140} />
          <Cloth c={A2} tutor="the first amount, 27" />
          <Cloth c={B2} className="s2-clothB" tutor="the second amount, 5" />
          <rect className="s2-ring10" x={onesAt(A2, 0) - 22} y={FEET - 150} width={onesAt(A2, 9) - onesAt(A2, 0) + 44} height={168} rx={26} fill="none" stroke={N.violet} strokeWidth={6} strokeDasharray="14 10" />
          <Piece cls="s2-ab0" kind="b" tutor="a bundle of ten" />
          <Piece cls="s2-ab1" kind="b" tutor="a bundle of ten" />
          {range(7).map((k) => (
            <Piece key={k} cls={`s2-as${k}`} kind="s" tutor="a loose stick" />
          ))}
          {range(5).map((k) => (
            <Piece key={k} cls={`s2-bs${k}`} kind="s" tutor="a loose stick" />
          ))}
          <g className="s2-rib">
            <Ribbon />
          </g>
          <Piece cls="s2-nb" kind="b" tutor="the brand new bundle" />
          <g transform={`translate(${TIE2.x} ${TIE2.y - 70})`} pointerEvents="none">
            {range(10).map((i) => (
              <g key={i} className={`s2-sp s2-sp${i}`}>
                <Spark r={i % 2 ? 11 : 16} color={i % 3 === 0 ? N.violetLight : N.white} />
              </g>
            ))}
          </g>
          <PlaceNumber className="s2-n27" value={27} x={s2n} y={TILE_Y} tutor="the number 27" />
          <g className="s2-c s2-c-t" transform={`translate(${tensTileX(s2n)} ${TILE_Y})`}>
            <DigitTile text="2" tens />
          </g>
          <g className="s2-c s2-c-o12" transform={`translate(${onesTileX(s2n) + WIDE_DX} ${TILE_Y})`} data-tutor="twelve loose sticks">
            <DigitTile text="12" />
          </g>
          <g className="s2-c s2-c-o2" transform={`translate(${onesTileX(s2n)} ${TILE_Y})`}>
            <DigitTile text="2" />
          </g>
          <FlyTile cls="s2-carry" text="1" tens />
          <PlaceNumber className="s2-n32" value={32} x={s2n} y={TILE_Y} tutor="the total, 32" />
          <FlyTile cls="s2-bt" text="5" />
          <g className="s2-plus" transform={`translate(${PLUS_X} ${TILE_Y})`}>
            <OpBadge sign="+" />
          </g>
        </g>
        <g className="s2-sum">
          <EqRow items={[27, '+', 5, '=', 32]} x={800} y={SUM_Y} cls="s2-sumi" tutor="27 + 5 = 32" />
        </g>
      </g>

      {/* ---------------- station 3: guess 25 take away 3 */}
      <g className="st3">
        <PredictStation active={guessing} pick={pick} shown={shown} onPick={choose} />
      </g>

      {/* ---------------- station 4: 32 − 7, untie a bundle */}
      <g className="st4">
        <GlowE className="c5-glow s4-g-s2" x={(onesAt(A4, 0) + onesAt(A4, 1)) / 2} y={FEET - 70} rx={90} ry={110} />
        <GlowE className="c5-glow s4-g-b2" x={tensAt(A4, 2)} y={FEET - 70} rx={110} ry={120} color="violet" />
        <GlowE className="c5-glow s4-g-ones" x={(onesAt(A4, 0) + onesAt(A4, 11)) / 2} y={FEET - 70} rx={230} ry={120} />
        <GlowE className="c5-glow s4-g-all" x={centre(A4)} y={FEET - 70} rx={400} ry={140} />
        <BasketBack x={BASKET.x} y={BASKET.y} />
        <Cloth c={A4} tutor="the cloth with 32" />
        {[0, 1, 2].map((k) => (
          <Piece key={k} cls={`s4-b${k}`} kind="b" tutor="a bundle of ten" />
        ))}
        {[0, 1].map((k) => (
          <Piece key={k} cls={`s4-s${k}`} kind="s" tutor="one of the two loose sticks" />
        ))}
        {range(10).map((i) => (
          <Piece key={i} cls={`s4-u s4-u${i}`} kind="s" tutor="a stick from the untied bundle" />
        ))}
        <g className="s4-rib">
          <Ribbon />
        </g>
        <BasketFront x={BASKET.x} y={BASKET.y} />
        <g className="s4-bk7" transform={`translate(${BASKET.x} ${BASKET.y - 170})`}>
          <DigitTile text="7" />
        </g>
        <PlaceNumber className="s4-n32" value={32} x={s4n} y={TILE_Y} tutor="the number 32" />
        <g className="s4-c s4-c-t" transform={`translate(${tensTileX(s4n)} ${TILE_Y})`}>
          <DigitTile text="2" tens />
        </g>
        <g className="s4-c s4-c-o2" transform={`translate(${onesTileX(s4n)} ${TILE_Y})`}>
          <DigitTile text="2" />
        </g>
        <g className="s4-c s4-c-o12" transform={`translate(${onesTileX(s4n) + WIDE_DX} ${TILE_Y})`} data-tutor="twelve loose sticks">
          <DigitTile text="12" />
        </g>
        <PlaceNumber className="s4-n25" value={25} x={s4n} y={TILE_Y} tutor="what is left, 25" />
        <g className="s4-minus" transform={`translate(${S4_CHIP.minus + WIDE_DX + 14} ${TILE_Y})`}>
          <OpBadge sign="−" />
        </g>
        <g className="s4-seven" transform={`translate(${S4_CHIP.seven + WIDE_DX + 14} ${TILE_Y})`} data-tutor="take away 7">
          <DigitTile text="7" />
        </g>
        <g className="s4-sum">
          <EqRow items={[32, '−', 7, '=', 25]} x={800} y={SUM_Y} cls="s4-sumi" tutor="32 − 7 = 25" />
        </g>
      </g>

      {/* ---------------- station 5: the number line */}
      <g className="st5">
        <g className="s5-cam">
          <Slate />
          <NumberLine x={NL.x} y={NL.y} from={NL.from} to={NL.to} unit={NL.unit} size={36} tutor="the number line from 20 to 40" />
          <g className="s5-hl s5-hl-38" transform={`translate(${nlx(38)} ${NL.y + 44})`}>
            <circle r={32} fill="none" stroke={N.goldLight} strokeWidth={6} />
          </g>
          <g className="s5-hl s5-hl-25" transform={`translate(${nlx(25)} ${NL.y + 44})`}>
            <circle r={32} fill="none" stroke={N.goldLight} strokeWidth={6} />
          </g>
          <HopArc cls="s5-arc s5-fwd s5-arc-big" a={25} b={35} h={150} color={N.violetLight} />
          {range(3).map((k) => (
            <HopArc key={k} cls={`s5-arc s5-fwd s5-arc-f${k}`} a={35 + k} b={36 + k} h={46} color={N.gold} />
          ))}
          {range(7).map((k) => (
            <HopArc key={k} cls={`s5-arc s5-arc-b${k}`} a={32 - k} b={31 - k} h={46} color={N.gold} />
          ))}
          <g className="s5-icon s5-icon-big" transform={`translate(${nlx(30)} ${HOP_Y - 160})`}>
            <Bundle s={0.36} />
          </g>
          {range(3).map((k) => (
            <g key={k} className={`s5-icon s5-icon-f${k}`} transform={`translate(${nlx(35.5 + k)} ${HOP_Y - 52})`}>
              <Stick s={0.26} />
            </g>
          ))}
          {range(7).map((k) => (
            <g key={k} className={`s5-icon s5-icon-b${k}`} transform={`translate(${nlx(31.5 - k)} ${HOP_Y - 52})`}>
              <Stick s={0.26} />
            </g>
          ))}
          <g className="s5-hopper">
            <g className="s5-face">
              <Sheep s={0.42} flip tutor="the hopping sheep" />
            </g>
          </g>
          <EqRow items={[25, '+', 13, '=', 38]} x={800} y={612} size={54} cls="s5-eq1" tutor="25 + 13 = 38" />
          <EqRow items={[32, '−', 7, '=', 25]} x={800} y={612} size={54} cls="s5-eq2" tutor="32 − 7 = 25" />
        </g>
      </g>

      {/* ---------------- station 6: the playground seesaw */}
      <g className="st6">
        <Seesaw active={cueIndex === 6} say={say} emit={emit} reportState={reportState} setHints={setHints} onPlayDone={onPlayDone} onCheer={cheer} />
      </g>
      </g>

      {/* A little sheep walks along the counter with us. */}
      <g className="c5-sheep" transform="translate(96 892)" pointerEvents="none">
        <g className="c5-sheep-hop">
          <g ref={sheepRef}>
            <Sheep s={1.05} flip tutor="the little sheep" />
          </g>
        </g>
      </g>
    </g>
  )
}

export const ch5: Chapter = {
  id: 'change',
  title: 'Together and apart',
  cues: CUES,
  Scene: Ch5Change,
  enter: { type: 'pan', dir: 'left' },
}
