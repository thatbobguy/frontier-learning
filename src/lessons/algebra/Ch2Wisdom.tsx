import gsap from 'gsap'
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { Person } from '../../art2/characters'
import { Glow, Motes, Stars, Vignette, rng } from '../../art2/fx'
import { FONT2, N } from '../../art2/palette'
import { Book, Equation, NumberMachine, Sack, Scale, Title, Weight, weightSpots } from '../../art2/props'
import { Lantern } from '../../art2/scenery'
import { useDrag } from '../../engine/svg'
import { useBeatTimeline } from '../../engine/useBeatTimeline'
import type { Chapter, ChapterProps, Cue } from '../../flow/types'
import { AlKhwarizmi } from './art'

export const CUES: Cue[] = [
  { id: 'library', say: 'Across the city stood the House of Wisdom, a giant library where scholars gathered books from all over the world.' },
  { id: 'scholar', say: 'One of them was Muhammad al-Khwarizmi. He noticed that merchants, builders and judges all got stuck on the same kind of puzzle.' },
  { id: 'forward', say: 'Ordinary arithmetic runs forward. Put eight into a machine that adds three, and out comes eleven.' },
  { id: 'backward', say: 'But their puzzles ran backwards. Eleven came out. What went in? Pull the lever to run the machine backwards.', play: true, quick: true },
  { id: 'book', say: 'Around the year 820, al-Khwarizmi wrote a book that showed, step by step, how to run puzzles like this backwards. He called his main move al-jabr, which means restoring.' },
  { id: 'name', say: 'The idea spread around the world, and its name came with it. Al-jabr became algebra.' },
]

const BACK_LINE = 'Eight went in. Running it backwards means taking the three away.'

/* ------------------------------------------------------------------ */
/* Where things are                                                     */
/* ------------------------------------------------------------------ */

/**
 * The hall is drawn in three depth layers that the camera pans at different speeds.
 * CAM is the middle layer's offset; the back wall moves at PAR.bg of it and the near pillars at PAR.fg.
 */
const CAM = { start: { x: 150, y: 560 }, hall: { x: 0, y: 0 }, drift: { x: -220, y: 0 }, desk: { x: -760, y: 0 } }
const PAR = { bg: 0.75, fg: 1.4, fgY: 1.2 }
/** The push-in on al-Khwarizmi's desk (screen coordinates). */
const ZOOM = { x: 800, y: 640, s: 1.15, think: 1.6 }
/** Al-Khwarizmi's seat and the closed book on his desk (middle-layer coordinates). */
const AK = { x: 1560, y: 800 }
const DESKBOOK = { x: 1668, y: 768 }
/** On screen once the camera has settled on the desk. */
const zoomed = (x: number, y: number) => ({ x: ZOOM.x + (x + CAM.desk.x - ZOOM.x) * ZOOM.s, y: ZOOM.y + (y - ZOOM.y) * ZOOM.s })
const HEAD = zoomed(AK.x, AK.y - 230)
const DESKBOOK_ON_SCREEN = zoomed(DESKBOOK.x, DESKBOOK.y)

/** The number machine on stage, and the spots above its funnel and beside its pipe (machine coordinates). */
const M = { x: 720, y: 500, s: 1.1 }
const HOVER = { x: -90, y: -345 }
const OUT = { x: 352, y: 68 }
/** The lever: pivot (machine coordinates), arm length, and its angles in degrees from straight up. */
const LEVER = { x: -180, y: 30, len: 180, up: -35, down: -150 }
const PIVOT = { x: M.x + LEVER.x * M.s, y: M.y + LEVER.y * M.s }

/** The thought bubbles around al-Khwarizmi (screen coordinates). */
const BUBBLES = [
  { x: 380, y: 320, label: 'merchant', q: { x: -62, y: -78 } },
  { x: 800, y: 228, label: 'builder', q: { x: 10, y: 6 } },
  { x: 1220, y: 320, label: 'judge', q: { x: 0, y: 6 } },
]
const BUB_R = 150

/** The book scene, and the broken balance beam that gets restored. */
const BOOK = { x: 560, y: 830, s: 1.75 }
const BEAM = { x: 1185, y: 600, half: 220 }

/** The world map: Baghdad and where the idea travelled. */
const BAGHDAD = { x: 975, y: 385 }
const TRAILS = [
  { name: 'Europe', to: { x: 575, y: 330 }, c: { x: 780, y: 205 } },
  { name: 'Africa', to: { x: 700, y: 615 }, c: { x: 850, y: 520 } },
  { name: 'India', to: { x: 1185, y: 545 }, c: { x: 1110, y: 400 } },
  { name: 'China', to: { x: 1405, y: 330 }, c: { x: 1190, y: 235 } },
]
const quad = (a: number, c: number, b: number, t: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b

/** The word on its way from Baghdad: al-jabr turns into algebra, letter by letter. */
const WORD = [
  { t: 'al-jabr', hi: -1 },
  { t: 'aljabr', hi: -1 },
  { t: 'algabr', hi: 2 },
  { t: 'algebr', hi: 3 },
  { t: 'algebra', hi: 6 },
  { t: 'algebra', hi: -1 },
]
const WORD_SIZE = 120
const WORD_AT = { book: { x: 800, y: 238, s: 1 }, baghdad: { x: BAGHDAD.x, y: BAGHDAD.y - 34, s: 0.4 }, end: { x: 800, y: 488, s: 1.2 } }

/* ------------------------------------------------------------------ */
/* The hall                                                             */
/* ------------------------------------------------------------------ */

/** Book spines: anything but pink, gold and teal, which carry meaning in this lesson. */
const SPINES = [N.violet, N.violetDark, N.violetLight, N.sky, N.skyDark, N.leaf, N.leafDark, N.sand, N.sandDark, N.stone, N.stoneLight, N.wood, N.woodLight, N.cream, N.plum, N.coralDark]
const ALCOVES = [-190, 140, 470, 800, 1130, 1460, 1790, 2120]
/** Where books stand on the shelves inside an alcove. */
const SHELVES = [236, 336, 436, 536, 636]
const AW = 250
/** Empty spots on the shelves that the arriving books fill. */
const GAPS = [
  { a: 2, s: 1, x: -42 },
  { a: 3, s: 0, x: 34 },
  { a: 4, s: 2, x: -28 },
  { a: 5, s: 1, x: 30 },
]
const GAP_W = 100
/** The books that fly in: from where (back-wall coordinates), and into which gap. */
const ARRIVALS = [
  { from: { x: -260, y: 140 }, gap: 0, c: N.sky },
  { from: { x: 900, y: -260 }, gap: 1, c: N.leaf },
  { from: { x: 1900, y: 260 }, gap: 2, c: N.violetLight },
  { from: { x: -280, y: 520 }, gap: 0, c: N.sand },
  { from: { x: 1960, y: 110 }, gap: 3, c: N.coralDark },
  { from: { x: 560, y: -300 }, gap: 1, c: N.stoneLight },
  { from: { x: 1920, y: 560 }, gap: 3, c: N.skyLight },
  { from: { x: 1300, y: -300 }, gap: 2, c: N.leafLight },
]
const gapSpot = (g: number, k: number) => ({ x: ALCOVES[GAPS[g].a] + GAPS[g].x, y: SHELVES[GAPS[g].s] - 11 - k * 21 })

function Alcove({ cx, seed }: { cx: number; seed: number }) {
  const r = rng(seed)
  const ai = ALCOVES.indexOf(cx)
  const gaps = GAPS.filter((g) => g.a === ai)
  const l = cx - AW / 2
  const rr = cx + AW / 2
  const arch = (p: number) => `M${l - p} 700 V150 Q${l - p} ${70 - p} ${cx} ${18 - p} Q${rr + p} ${70 - p} ${rr + p} 150 V700 Z`
  const books: ReactElement[] = []
  SHELVES.forEach((sy, si) => {
    const gap = gaps.find((g) => g.s === si)
    let x = l + 12
    while (x < rr - 20) {
      const w = 15 + r() * 15
      const h = 50 + r() * 34
      if (gap && x + w > cx + gap.x - GAP_W / 2 && x < cx + gap.x + GAP_W / 2) {
        x = cx + gap.x + GAP_W / 2 + 3
        continue
      }
      if (x + w > rr - 10) break
      const c = SPINES[Math.floor(r() * SPINES.length)]
      const scroll = r() < 0.12
      if (scroll) {
        // a little pile of scrolls, seen end on
        const n = 3
        books.push(
          <g key={`${si}-${x}`}>
            {Array.from({ length: n }, (_, k) => (
              <g key={k}>
                <circle cx={x + 12 + (k % 2) * 22} cy={sy - 12 - Math.floor(k / 2) * 21} r={11} fill={N.cream} />
                <circle cx={x + 12 + (k % 2) * 22} cy={sy - 12 - Math.floor(k / 2) * 21} r={4} fill={N.sandDark} />
              </g>
            ))}
          </g>,
        )
        x += 48
        continue
      }
      books.push(
        <g key={`${si}-${x}`}>
          <rect x={x} y={sy - h} width={w} height={h} rx={3} fill={c} />
          <rect x={x + w * 0.62} y={sy - h} width={w * 0.38} height={h} rx={2} fill={N.shadow} opacity={0.22} />
          <rect x={x + 2} y={sy - h + 9} width={w - 4} height={3} fill={N.shadow} opacity={0.3} />
          <rect x={x + 2} y={sy - 15} width={w - 4} height={3} fill={N.shadow} opacity={0.3} />
        </g>,
      )
      x += w + 2
    }
  })
  return (
    <g>
      <path d={arch(22)} fill={N.violetDark} />
      <path d={arch(10)} fill={N.stone} opacity={0.55} />
      <path d={arch(0)} fill={N.night1} />
      <Glow x={cx} y={420} r={230} color="warm" opacity={0.22} />
      {/* a star window in the top of the arch */}
      <g transform={`translate(${cx} 96)`}>
        <circle r={30} fill={N.night0} />
        <path d="M0 -24 L7 -7 L24 0 L7 7 L0 24 L-7 7 L-24 0 L-7 -7 Z" fill={N.violetLight} opacity={0.5} />
      </g>
      {SHELVES.map((sy) => (
        <g key={sy}>
          <rect x={l} y={sy} width={AW} height={9} fill={N.woodLight} />
          <rect x={l} y={sy + 9} width={AW} height={6} fill={N.woodDark} />
        </g>
      ))}
      {books}
      <rect x={l} y={646} width={AW} height={54} fill={N.woodDark} />
      <rect x={l + 14} y={656} width={AW / 2 - 20} height={34} rx={6} fill={N.wood} opacity={0.5} />
      <rect x={cx + 6} y={656} width={AW / 2 - 20} height={34} rx={6} fill={N.wood} opacity={0.5} />
    </g>
  )
}

/** The inside of the great dome, with a ring of night windows and a chandelier hanging in the middle. */
function Dome() {
  const ribs = Array.from({ length: 13 }, (_, i) => -1 + (2 * i) / 12)
  return (
    <g>
      <rect x={-500} y={-900} width={3200} height={900} fill={N.night1} />
      <ellipse cx={800} cy={-120} rx={1150} ry={720} fill={N.night2} />
      {ribs.map((k, i) => (
        <path key={i} d={`M800 -830 Q${800 + k * 900} -620 ${800 + k * 1120} -120`} stroke={N.night1} strokeWidth={14} fill="none" opacity={0.8} />
      ))}
      <Glow x={800} y={-780} r={260} color="cool" opacity={0.8} />
      <circle cx={800} cy={-830} r={70} fill={N.night0} />
      <circle cx={800} cy={-830} r={70} fill="none" stroke={N.violetLight} strokeWidth={6} opacity={0.5} />
      {/* the drum: a ring of arched windows looking out at the night */}
      <rect x={-500} y={-150} width={3200} height={150} fill={N.night3} />
      <rect x={-500} y={-160} width={3200} height={16} fill={N.violetDark} />
      <rect x={-500} y={-10} width={3200} height={14} fill={N.violetDark} />
      {Array.from({ length: 16 }, (_, i) => {
        const wx = -330 + i * 170
        return (
          <g key={i}>
            <path d={`M${wx - 28} -24 V-100 A28 28 0 0 1 ${wx + 28} -100 V-24 Z`} fill={N.night0} />
            <circle cx={wx - 6} cy={-80} r={2.5} fill={N.white} opacity={0.8} />
            <circle cx={wx + 10} cy={-56} r={1.6} fill={N.white} opacity={0.6} />
            <path d={`M${wx - 28} -24 V-100 A28 28 0 0 1 ${wx + 28} -100 V-24 Z`} fill="none" stroke={N.stone} strokeWidth={4} opacity={0.6} />
          </g>
        )
      })}
      {/* the chandelier */}
      <line x1={800} y1={-760} x2={800} y2={-300} stroke={N.night0} strokeWidth={5} />
      <Glow x={800} y={-260} r={520} color="warm" opacity={0.55} />
      <ellipse cx={800} cy={-250} rx={170} ry={34} fill="none" stroke={N.sandDark} strokeWidth={10} />
      {Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2
        const fx = 800 + Math.cos(a) * 170
        const fy = -250 + Math.sin(a) * 34
        return (
          <g key={i} className="blink-light" style={{ animationDelay: `${-i * 0.23}s`, animationDuration: `${0.9 + (i % 3) * 0.3}s` }}>
            <circle cx={fx} cy={fy - 16} r={16} fill={N.goldLight} opacity={0.25} />
            <path d={`M${fx} ${fy - 30} Q${fx + 8} ${fy - 14} ${fx} ${fy - 6} Q${fx - 8} ${fy - 14} ${fx} ${fy - 30} Z`} fill={N.cream} />
          </g>
        )
      })}
      {[-220, 220].map((dx) => (
        <line key={dx} x1={800} y1={-330} x2={800 + dx * 0.77} y2={-252} stroke={N.night0} strokeWidth={3} />
      ))}
    </g>
  )
}

/** A low wooden table; people drawn before it look as if they sit behind it. */
function LowTable({ x, y, w = 280 }: { x: number; y: number; w?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx={0} cy={78} rx={w * 0.6} ry={16} fill={N.shadow} opacity={0.35} />
      <rect x={-w / 2} y={-8} width={w} height={18} rx={7} fill={N.woodLight} />
      <rect x={-w / 2 + 10} y={10} width={w - 20} height={56} rx={6} fill={N.wood} />
      <rect x={-w / 2 + 10} y={10} width={w - 20} height={10} fill={N.woodDark} opacity={0.6} />
      <path d={`M${-w / 2 + 30} 30 h${w - 60}`} stroke={N.woodDark} strokeWidth={4} opacity={0.5} />
      <rect x={-w / 2 + 16} y={66} width={16} height={12} fill={N.woodDark} />
      <rect x={w / 2 - 32} y={66} width={16} height={12} fill={N.woodDark} />
    </g>
  )
}

/** A small oil lamp with a flickering flame and a warm pool of light. */
function OilLamp({ x, y, glow = 1 }: { x: number; y: number; glow?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <Glow y={-30} r={170} color="warm" opacity={0.75 * glow} />
      <path d="M-26 0 Q-30 -18 -6 -20 L22 -22 Q34 -20 30 -10 Q24 0 -26 0 Z" fill={N.sandDark} />
      <path d="M-18 -18 Q-4 -26 14 -21" stroke={N.sandLight} strokeWidth={3} fill="none" opacity={0.7} />
      <g className="blink-light">
        <path d="M27 -24 Q36 -40 30 -54 Q22 -40 27 -24 Z" fill={N.goldLight} />
        <path d="M28 -27 Q32 -36 29 -44 Q25 -36 28 -27 Z" fill={N.white} />
      </g>
    </g>
  )
}

/** A book lying flat, seen a little from above, centred on (0, 0). */
function FlatBook({ c, w = 86 }: { c: string; w?: number }) {
  return (
    <g>
      <rect x={-w / 2} y={-10} width={w} height={20} rx={4} fill={c} />
      <rect x={-w / 2 + 4} y={-16} width={w - 8} height={8} rx={2} fill={N.cream} />
      <rect x={-w / 2} y={-10} width={w} height={6} rx={3} fill={N.white} opacity={0.18} />
      <rect x={-w / 2 + 12} y={-10} width={5} height={20} fill={N.shadow} opacity={0.25} />
      <rect x={w / 2 - 17} y={-10} width={5} height={20} fill={N.shadow} opacity={0.25} />
    </g>
  )
}

/** The closed book on al-Khwarizmi's desk, standing on (0, 0). */
function ClosedBook() {
  return (
    <g>
      <ellipse cx={0} cy={2} rx={66} ry={8} fill={N.shadow} opacity={0.4} />
      <path d="M-60 0 L-48 -22 H62 L50 0 Z" fill={N.violetDark} />
      <path d="M-60 0 H50 V8 H-60 Z" fill={N.cream} />
      <path d="M-40 -16 H48 L44 -6 H-44 Z" fill="none" stroke={N.sandLight} strokeWidth={2.5} opacity={0.8} />
    </g>
  )
}

/** One gear, drawn like the machine's own, centred on (0, 0). */
function Gear({ r, color }: { r: number; color: string }) {
  const teeth = Math.round(r / 4)
  return (
    <g>
      {Array.from({ length: teeth }, (_, i) => (
        <rect key={i} x={-r * 0.16} y={-r - 6} width={r * 0.32} height={14} rx={3} fill={color} transform={`rotate(${(360 / teeth) * i})`} />
      ))}
      <circle r={r} fill={color} />
      <circle r={r * 0.35} fill={N.night1} />
    </g>
  )
}

/** A pink question mark: something we don't know yet. */
function Q({ x = 0, y = 0, size = 90, className, tutor }: { x?: number; y?: number; size?: number; className?: string; tutor?: string }) {
  return (
    <g transform={`translate(${x} ${y})`} data-tutor={tutor}>
      <g className={className}>
        <Glow y={-size * 0.3} r={size * 0.9} color="pink" opacity={0.6} />
        <text y={size * 0.05} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={size} fill={N.pink} stroke={N.shadow} strokeOpacity={0.35} strokeWidth={size * 0.1} paintOrder="stroke">
          ?
        </text>
      </g>
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Al-Khwarizmi's three puzzles, each drawn around (0, 0) in a bubble   */
/* ------------------------------------------------------------------ */

/** Where the main question mark sits in each bubble, for the line that links them. */
const QSPOT = [
  { x: -81, y: 14, size: 56 },
  { x: 52, y: 40, size: 50 },
  { x: 0, y: 58, size: 44 },
]
const qCentre = (i: number) => ({ x: BUBBLES[i].x + QSPOT[i].x, y: BUBBLES[i].y + QSPOT[i].y - QSPOT[i].size * 0.34 })

/** A merchant's puzzle: a sealed sack balanced against weights. */
function MerchantPuzzle() {
  return (
    <g>
      <g transform="translate(0 95) scale(0.27)">
        <Scale
          left={<Sack s={1.05} />}
          right={weightSpots(5, 3).map(([x, y], i) => (
            <Weight key={i} x={x} y={y} s={0.9} />
          ))}
        />
      </g>
      <Q x={QSPOT[0].x} y={QSPOT[0].y} size={QSPOT[0].size} className="c2-vq" tutor="the merchant's unknown sack" />
    </g>
  )
}

/** A builder's puzzle: a wall with some bricks missing. */
function BuilderPuzzle() {
  const rows = 7
  const bricks: ReactElement[] = []
  for (let k = 0; k < rows; k++) {
    const top = 100 - 26 * (k + 1)
    const off = k % 2 ? 26 : 0
    for (let c = -4; c <= 3; c++) {
      const bx = c * 52 + off
      const inGap = (k === 2 && (bx === 0 || bx === 52)) || (k === 3 && bx === 26)
      if (inGap) continue
      const tone = (k * 7 + c * 3 + 20) % 3
      bricks.push(
        <g key={`${k}-${c}`}>
          <rect x={bx + 2} y={top + 2} width={48} height={22} rx={4} fill={tone === 0 ? N.sand : tone === 1 ? N.sandDark : N.stoneLight} />
          <rect x={bx + 2} y={top + 2} width={48} height={6} rx={3} fill={N.white} opacity={0.18} />
        </g>,
      )
    }
  }
  const gap = 'M0 48 H104 V22 H78 V-4 H26 V22 H0 Z'
  return (
    <g>
      <rect x={-150} y={100} width={300} height={60} fill={N.night2} />
      {bricks}
      <path d={gap} fill={N.night0} />
      <path d={gap} fill="none" stroke={N.pinkLight} strokeWidth={4} strokeDasharray="10 8" strokeLinejoin="round" />
      <g transform="translate(-92 86) rotate(-8)">
        <rect x={-24} y={-11} width={48} height={22} rx={4} fill={N.sandDark} />
      </g>
      <Q x={QSPOT[1].x} y={QSPOT[1].y} size={QSPOT[1].size} className="c2-vq" tutor="the builder's missing bricks" />
    </g>
  )
}

/** A judge's puzzle: a pile of coins to share out fairly. How much does each person get? */
function JudgePuzzle() {
  const coin = (x: number, y: number, k: string) => (
    <g key={k}>
      <ellipse cx={x} cy={y + 4} rx={22} ry={8} fill={N.goldDark} />
      <ellipse cx={x} cy={y} rx={22} ry={8} fill={N.gold} />
      <ellipse cx={x - 5} cy={y - 2} rx={9} ry={3} fill={N.goldLight} />
    </g>
  )
  const bowls = [-88, 0, 88]
  return (
    <g>
      {[-30, 0, 30].map((sx, s) => Array.from({ length: 4 - Math.abs(s - 1) }, (_, k) => coin(sx, -40 - k * 11 + Math.abs(sx) * 0.3, `${s}-${k}`)))}
      {coin(-56, -24, 'a')}
      {coin(54, -26, 'b')}
      {bowls.map((bx) => (
        <g key={bx}>
          <path d={`M${bx * 0.35} -6 L${bx * 0.85} 34`} stroke={N.cream} strokeWidth={5} strokeLinecap="round" opacity={0.7} />
          <path d={`M${bx * 0.85 - 9} 22 L${bx * 0.85} 36 L${bx * 0.85 + 6} 20`} stroke={N.cream} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.7} />
          <path d={`M${bx - 36} 72 Q${bx} 112 ${bx + 36} 72 Z`} fill={N.wood} />
          <rect x={bx - 38} y={68} width={76} height={9} rx={4} fill={N.woodLight} />
        </g>
      ))}
      {bowls.map((bx, i) => (
        <Q key={bx} x={bx} y={QSPOT[2].y + (i === 1 ? 0 : 4)} size={QSPOT[2].size} className="c2-vq" tutor={i === 1 ? "the judge's unknown shares" : undefined} />
      ))}
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* The machine's lever, the broken beam and the world map               */
/* ------------------------------------------------------------------ */

/** A balance beam broken in two. The halves meet along the same zigzag, so they fit back together. */
function BeamHalf({ side }: { side: -1 | 1 }) {
  const h = BEAM.half
  const end = side * (h - 16)
  return (
    <g>
      <path d={`M${end} 0 L${end - side * 46} 104 M${end} 0 L${end + side * 46} 104 M${end} 0 V98`} stroke={N.stone} strokeWidth={3} />
      <path d={`M${end - 62} 104 Q${end} 140 ${end + 62} 104 Z`} fill={N.stoneLight} />
      <rect x={end - 66} y={98} width={132} height={9} rx={4} fill={N.stone} />
      <path d={`M${side * h} -11 L0 -11 L7 -4 L-6 3 L5 11 L${side * h} 11 Z`} fill={N.coral} />
      <path d={`M${side * h} 3 L-6 3 L5 11 L${side * h} 11 Z`} fill={N.coralDark} />
      <circle cx={end} cy={0} r={7} fill={N.coralLight} />
    </g>
  )
}

function WorldMap() {
  const land = [
    // Europe
    'M520 335 Q515 300 560 296 Q585 262 640 262 Q630 222 676 204 Q690 150 735 112 Q775 92 805 120 Q790 160 812 192 Q850 172 905 182 L915 280 Q870 286 845 304 Q815 296 795 320 Q772 306 748 318 Q724 336 700 312 Q664 322 640 352 Q600 372 560 366 Q526 360 520 335 Z',
    'M548 236 Q540 206 562 196 Q582 210 576 240 Q562 254 548 236 Z',
    // Africa
    'M560 430 Q600 396 680 404 Q740 394 800 420 Q850 424 888 456 Q930 510 985 538 Q968 590 925 612 Q905 690 865 752 Q830 815 792 812 Q760 770 752 712 Q735 650 690 612 Q625 602 585 568 Q545 510 560 430 Z',
    'M940 700 Q955 680 962 700 Q958 740 944 748 Q934 730 940 700 Z',
    // Arabia and Asia
    'M902 446 Q950 436 992 462 Q1040 498 1056 522 Q1018 562 966 546 Q930 506 902 446 Z',
    'M880 300 Q868 250 900 214 Q880 190 905 160 Q960 120 1050 112 Q1150 84 1270 92 Q1410 100 1500 150 Q1565 196 1528 262 Q1490 300 1458 330 Q1468 382 1426 420 Q1385 452 1345 440 Q1322 478 1344 520 Q1306 542 1275 505 Q1252 472 1222 486 Q1205 540 1175 582 Q1145 545 1124 494 Q1094 462 1054 462 Q1004 446 962 424 Q930 404 918 372 Q888 344 880 300 Z',
    'M1540 270 Q1556 250 1566 268 Q1560 310 1540 330 Q1530 300 1540 270 Z',
  ]
  return (
    <g>
      <rect x={-300} y={-300} width={2200} height={1500} fill={N.night0} />
      <Stars h={900} count={50} seed={77} />
      {Array.from({ length: 9 }, (_, i) => (
        <line key={`h${i}`} x1={-300} y1={50 + i * 100} x2={1900} y2={50 + i * 100} stroke={N.night1} strokeWidth={2} />
      ))}
      {Array.from({ length: 15 }, (_, i) => (
        <line key={`v${i}`} x1={-40 + i * 120} y1={-300} x2={-40 + i * 120} y2={1200} stroke={N.night1} strokeWidth={2} />
      ))}
      <Glow x={BAGHDAD.x} y={BAGHDAD.y} r={520} color="violet" opacity={0.35} />
      {land.map((d, i) => (
        <path key={`r${i}`} d={d} fill={N.night3} transform="translate(-4 -5)" />
      ))}
      {land.map((d, i) => (
        <path key={i} d={d} fill={N.night2} />
      ))}
      {[
        [1390, 575, 34, 12],
        [1460, 602, 26, 10],
        [1505, 556, 14, 20],
      ].map(([cx, cy, rx, ry]) => (
        <ellipse key={cx} cx={cx} cy={cy} rx={rx} ry={ry} fill={N.night2} />
      ))}
      <g className="c2-map-labels">
        <Title x={690} y={160} size={32} color={N.mist} weight={700}>
          Europe
        </Title>
        <Title x={770} y={700} size={32} color={N.mist} weight={700}>
          Africa
        </Title>
        <Title x={1290} y={200} size={32} color={N.mist} weight={700}>
          Asia
        </Title>
      </g>
    </g>
  )
}
