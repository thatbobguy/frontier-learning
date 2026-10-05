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
      <ellipse cx={0} cy={2} rx={70} ry={8} fill={N.shadow} opacity={0.4} />
      <path d="M-62 0 V-16 L-50 -34 H64 V-18 L52 0 Z" fill={N.violetDark} />
      <path d="M-58 -2 V-14 H50 V-2 Z" fill={N.cream} />
      <path d="M-54 -10 H46 M-54 -6 H46" stroke={N.sandDark} strokeWidth={1.5} opacity={0.6} />
      <path d="M-62 -16 L-50 -34 H64 L52 -16 Z" fill={N.violet} />
      <path d="M-40 -20 L-32 -30 H50 L42 -20 Z" fill="none" stroke={N.sandLight} strokeWidth={2.5} opacity={0.85} />
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
  { x: -90, y: -4, size: 58 },
  { x: 52, y: 40, size: 50 },
  { x: 0, y: 58, size: 44 },
]
const qCentre = (i: number) => ({ x: BUBBLES[i].x + QSPOT[i].x, y: BUBBLES[i].y + QSPOT[i].y - QSPOT[i].size * 0.34 })

/** A merchant's puzzle: a sealed sack balanced against weights. */
function MerchantPuzzle() {
  return (
    <g>
      <g transform="translate(0 104) scale(0.3)">
        <Scale
          left={<Sack s={1.35} />}
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

/* ------------------------------------------------------------------ */
/* The scene                                                            */
/* ------------------------------------------------------------------ */

const STATE: string[] = [
  'Inside the House of Wisdom in Baghdad: a huge lamplit library hall under a great dome, with tall arched shelves of books and scrolls and scholars reading at low tables. New books fly in from the edges and land on the shelves: books gathered from all over the world.',
  'The camera comes to rest on Muhammad al-Khwarizmi (violet robe, cream turban) at his desk. Three thought bubbles pop up around him: a merchant with a sealed pink sack on a scale, a builder with bricks missing from a wall, and a judge sharing gold coins into three bowls. Each has a pink question mark on the part nobody knows, and a pink line links them: it is the same kind of puzzle.',
  'A number machine with "+3" on its screen. A gold 8 drops into the funnel on top, the gears turn, and a gold 11 comes out of the pipe on the right. An arrow labelled "forwards" shows the direction.',
  '',
  'Al-Khwarizmi at his desk, around the year 820. The camera pushes into his book, which opens with a glow; its lines light up one by one. The word "al-jabr" appears, then "restoring", while a broken coral balance beam on the right snaps back together, level and teal.',
  'A world map at night. Glowing trails run from Baghdad to Europe, Africa, India and China. The word "al-jabr" travels along the trail to Europe and changes letter by letter into "algebra", which ends big in the middle of the map.',
]

const ARROW_F = 'M-10 -365 Q300 -400 352 -12'
const ARROW_B = 'M352 -12 Q300 -400 -10 -365'

export function Ch2Wisdom({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const armRef = useRef<SVGGElement>(null)
  const [pulled, setPulled] = useState(false)
  const [animAt, setAnimAt] = useState(-1)
  const pulledRef = useRef(false)
  const gears = useRef({ a: 0 })
  const lever = useRef({ deg: LEVER.up, dragging: false, moved: 0, x: 0, y: 0, touched: false })
  const runTl = useRef<gsap.core.Timeline | null>(null)
  const cueRef = useRef(cueIndex)
  cueRef.current = cueIndex

  const myTurn = cueIndex === 3 && animAt === 3 && !pulled
  const leverDown = pulled || cueIndex > 3

  const applyGears = useCallback(() => {
    const a = gears.current.a
    const r = root.current
    r?.querySelector('.c2-gear-a')?.setAttribute('transform', `rotate(${a})`)
    r?.querySelector('.c2-gear-b')?.setAttribute('transform', `rotate(${(-a * 34) / 26})`)
    r?.querySelector('.c2-gear-c')?.setAttribute('transform', `rotate(${(a * 34) / 18})`)
  }, [])

  const setArm = useCallback((deg: number) => {
    lever.current.deg = deg
    armRef.current?.setAttribute('transform', `rotate(${deg})`)
  }, [])

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const word = root.current?.querySelector('.c2-word') ?? null
      const W = { x: WORD_AT.book.x, y: WORD_AT.book.y, s: 0.6 }
      const applyWord = () => word?.setAttribute('transform', `translate(${W.x} ${W.y}) scale(${W.s})`)
      applyWord()
      const G = gears.current
      const cam = (x: number, y: number, at: number, duration: number, ease: string) => {
        tl.to('.c2-pan-bg', { x: x * PAR.bg, y, duration, ease }, at)
        tl.to('.c2-pan-mid', { x, y, duration, ease }, at)
        tl.to('.c2-pan-fg', { x: x * PAR.fg, y: y * PAR.fgY, duration, ease }, at)
      }

      // Start: looking up into the dome, with everything else hidden.
      tl.set('.c2-pan-bg', { x: CAM.start.x * PAR.bg, y: CAM.start.y })
      tl.set('.c2-pan-mid', { x: CAM.start.x, y: CAM.start.y })
      tl.set('.c2-pan-fg', { x: CAM.start.x * PAR.fg, y: CAM.start.y * PAR.fgY })
      tl.set('.c2-zoom', { scale: 1, svgOrigin: `${ZOOM.x} ${ZOOM.y}` })
      tl.set('.c2-zoom2', { scale: 1, svgOrigin: `${DESKBOOK.x + CAM.desk.x} ${DESKBOOK.y}` })
      tl.set('.c2-title', { opacity: 0, y: 24 })
      tl.set('.c2-fb', { opacity: 0 })
      tl.set(['.c2-thoughts', '.c2-dark', '.c2-mach', '.c2-bk', '.c2-year', '.c2-map', '.c2-word', '.c2-link', '.c2-spot', '.c2-deskglow', '.c2-hall-dim'], { opacity: 0 })
      tl.set('.c2-bub', { scale: 0.2, opacity: 0, svgOrigin: '0 0' })
      tl.set('.c2-dot', { scale: 0, transformOrigin: '50% 50%' })
      tl.set('.c2-link-path', { strokeDashoffset: 1 })
      // the machine
      tl.set('.c2-mach-in', { scale: 0.2, svgOrigin: `${HEAD.x} ${HEAD.y}` })
      tl.set('.c2-in8', { y: -240, opacity: 0, scale: 1, svgOrigin: '0 0' })
      tl.set('.c2-out11', { x: -96, scale: 0.35, opacity: 0, svgOrigin: '0 0' })
      tl.set('.c2-out11-glow', { opacity: 0 })
      tl.set('.c2-out8', { y: 120, scale: 0.5, opacity: 0, svgOrigin: '0 0' })
      tl.set('.c2-ring8', { opacity: 0 })
      tl.set('.c2-qf', { scale: 0, opacity: 0, svgOrigin: '0 -38' })
      tl.set(['.c2-arrow-f', '.c2-arrow-b'], { strokeDashoffset: 1 })
      tl.set(['.c2-arrow-fh', '.c2-arrow-fl', '.c2-arrow-bh', '.c2-arrow-bl'], { opacity: 0 })
      tl.set('.c2-op-minus', { opacity: 0 })
      tl.set('.c2-op-plus', { opacity: 1 })
      tl.set('.c2-screen', { scaleY: 1, svgOrigin: '0 -55' })
      // the book
      tl.set('.c2-bk-in', { scale: 0.3, svgOrigin: `${DESKBOOK_ON_SCREEN.x} ${DESKBOOK_ON_SCREEN.y}` })
      tl.set('.c2-bk-out', { scale: 1, svgOrigin: `${BAGHDAD.x} ${BAGHDAD.y}` })
      tl.set('.c2-bk-open', { opacity: 0 })
      tl.set('.c2-bk-cover', { scaleX: 1, opacity: 1, svgOrigin: '0 0' })
      tl.set('.c2-bk-line', { opacity: 0 })
      tl.set('.c2-bk-glow', { opacity: 0.35 })
      tl.set('.c2-beam', { opacity: 0 })
      tl.set('.c2-beam-l', { x: -70, y: 64, rotation: -24, svgOrigin: '0 0' })
      tl.set('.c2-beam-r', { x: 74, y: 84, rotation: 28, svgOrigin: '0 0' })
      tl.set(['.c2-beam-teal', '.c2-beam-flash'], { opacity: 0 })
      tl.set('.c2-restoring', { opacity: 0, y: 16 })
      // the map
      tl.set('.c2-map-zoom', { scale: 3, svgOrigin: `${BAGHDAD.x} ${BAGHDAD.y}` })
      tl.set('.c2-trail', { strokeDashoffset: 1 })
      tl.set('.c2-dest', { scale: 0, opacity: 0, svgOrigin: '0 0' })
      tl.set('.c2-scrim', { opacity: 0 })
      tl.set('.c2-wst', { opacity: 0 })
      tl.set('.c2-wst0', { opacity: 1 })
      tl.set('.c2-word-pop', { scale: 1, svgOrigin: '0 0' })

      // 0. Inside the House of Wisdom: the camera tilts down from the dome and drifts along the shelves as books fly in.
      tl.addLabel('b0')
      // (The first second or so happens while the city picture is still flying away.)
      cam(CAM.hall.x, CAM.hall.y, 1.2, 3.2, 'power2.inOut')
      cam(CAM.drift.x, CAM.drift.y, 4.4, 3.6, 'sine.inOut')
      tl.to('.c2-title', { opacity: 1, y: 0, duration: 1, ease: 'power2.out' }, 1.5)
      tl.to('.c2-title', { opacity: 0, y: -12, duration: 0.6, ease: 'power1.in' }, 5.0)
      ARRIVALS.forEach((a, i) => {
        const k = ARRIVALS.slice(0, i).filter((b) => b.gap === a.gap).length
        const to = gapSpot(a.gap, k)
        const at = 3.4 + i * 0.42
        const sel = `.c2-fb${i}`
        tl.set(sel, { x: a.from.x, y: a.from.y, rotation: i % 2 ? 60 : -50, scale: 1.9, opacity: 1, svgOrigin: '0 0' }, at)
        tl.to(sel, { x: to.x, duration: 1.2, ease: 'power2.out' }, at)
        tl.to(sel, { y: to.y, duration: 1.2, ease: 'power2.in' }, at)
        tl.to(sel, { rotation: 0, scale: 1, duration: 1.2, ease: 'power2.inOut' }, at)
        tl.to(`${sel} .c2-fbg`, { opacity: 0, duration: 0.5 }, at + 1.15)
      })

      // 1. Over to al-Khwarizmi's desk. Three puzzles pop up around him, each with the same pink question mark.
      tl.addLabel('b1', 8.0)
      const b1 = tl.labels.b1
      cam(CAM.desk.x, CAM.desk.y, b1, 2.6, 'power2.inOut')
      tl.to('.c2-zoom', { scale: ZOOM.s, duration: 2.2, ease: 'power2.inOut' }, b1 + 0.8)
      tl.to('.c2-spot', { opacity: 1, duration: 1.2 }, b1 + 1.4)
      tl.to('.c2-hall-dim', { opacity: 0.45, duration: 1.2 }, b1 + 1.6)
      tl.to('.c2-thoughts', { opacity: 1, duration: 0.01 }, b1 + 3.0)
      tl.to('.c2-dot', { scale: 1, duration: 0.3, stagger: 0.07, ease: 'back.out(3)' }, b1 + 3.0)
      BUBBLES.forEach((_, i) => tl.to(`.c2-bub${i}`, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.7)' }, b1 + 3.5 + i * 0.6))
      tl.to('.c2-link', { opacity: 1, duration: 0.2 }, b1 + 6.5)
      tl.to('.c2-link-path', { strokeDashoffset: 0, duration: 1.0, ease: 'power1.inOut' }, b1 + 6.5)
      tl.to('.c2-vq', { scale: 1.3, duration: 0.25, yoyo: true, repeat: 3, ease: 'sine.inOut', transformOrigin: '50% 50%' }, b1 + 6.6)

      // 2. Into his thoughts: the number machine runs forwards, 8 in and 11 out.
      tl.addLabel('b2', b1 + 8.4)
      const b2 = tl.labels.b2
      BUBBLES.forEach((b, i) => tl.to(`.c2-bub${i}`, { x: HEAD.x - b.x, y: HEAD.y - b.y, scale: 0, opacity: 0, duration: 0.55, ease: 'power2.in' }, b2 + i * 0.06))
      tl.to(['.c2-dot', '.c2-link'], { opacity: 0, duration: 0.3 }, b2)
      tl.to('.c2-zoom', { scale: ZOOM.think, duration: 1.3, ease: 'power2.in' }, b2 + 0.2)
      tl.to('.c2-dark', { opacity: 0.88, duration: 1.0, ease: 'power1.in' }, b2 + 0.4)
      tl.to('.c2-mach', { opacity: 1, duration: 0.5 }, b2 + 0.7)
      tl.to('.c2-mach-in', { scale: 1, duration: 1.2, ease: 'power3.out' }, b2 + 0.7)
      tl.to('.c2-arrow-f', { strokeDashoffset: 0, duration: 0.8, ease: 'power1.inOut' }, b2 + 1.2)
      tl.to(['.c2-arrow-fh', '.c2-arrow-fl'], { opacity: 1, duration: 0.3 }, b2 + 1.8)
      tl.to('.c2-in8', { y: 0, opacity: 1, duration: 0.6, ease: 'bounce.out' }, b2 + 2.0)
      tl.to('.c2-in8', { y: 150, scale: 0.7, duration: 0.45, ease: 'power2.in' }, b2 + 3.0)
      tl.to('.c2-in8', { opacity: 0, duration: 0.05 }, b2 + 3.45)
      tl.fromTo(G, { a: 0 }, { a: 540, duration: 1.8, ease: 'power1.inOut', onUpdate: applyGears }, b2 + 3.3)
      tl.to('.c2-out11', { x: 0, scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(1.6)' }, b2 + 4.9)
      tl.to('.c2-out11-glow', { opacity: 1, duration: 0.4, yoyo: true, repeat: 1 }, b2 + 5.5)

      // 3. The learner's turn: "?" over the funnel, the 11 glows, the lever waits.
      tl.addLabel('b3', b2 + 6.3)
      const b3 = tl.labels.b3
      tl.to(['.c2-arrow-f', '.c2-arrow-fh', '.c2-arrow-fl'], { opacity: 0, duration: 0.4 }, b3)
      tl.to('.c2-qf', { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(2.5)' }, b3 + 0.2)
      tl.to('.c2-out11-glow', { opacity: 1, duration: 0.35, yoyo: true, repeat: 1 }, b3 + 0.6)

      // 4. The book. (Just after the label: how the machine looks once it has run backwards, for arriving here directly.)
      tl.addLabel('b4', b3 + 1.4)
      const b4 = tl.labels.b4
      const after = b4 + 0.01
      tl.set('.c2-out11', { opacity: 0, x: -96, scale: 0.35 }, after)
      tl.set('.c2-qf', { opacity: 0 }, after)
      tl.set('.c2-out8', { opacity: 1, y: 0, scale: 1 }, after)
      tl.set('.c2-op-plus', { opacity: 0 }, after)
      tl.set('.c2-op-minus', { opacity: 1 }, after)
      tl.set('.c2-arrow-b', { strokeDashoffset: 0 }, after)
      tl.set(['.c2-arrow-bh', '.c2-arrow-bl'], { opacity: 1 }, after)
      tl.to('.c2-mach-in', { scale: 0.2, duration: 0.9, ease: 'power3.in' }, b4 + 0.2)
      tl.to('.c2-mach', { opacity: 0, duration: 0.5 }, b4 + 0.6)
      tl.to('.c2-dark', { opacity: 0.15, duration: 1.0 }, b4 + 0.6)
      tl.to('.c2-zoom', { scale: ZOOM.s, duration: 1.3, ease: 'power2.out' }, b4 + 0.5)
      tl.to('.c2-year', { opacity: 1, duration: 0.8 }, b4 + 0.8)
      tl.to('.c2-year', { opacity: 0, duration: 0.6 }, b4 + 3.4)
      tl.to('.c2-deskglow', { opacity: 1, duration: 0.6 }, b4 + 2.2)
      tl.to('.c2-zoom2', { scale: 2.4, duration: 1.4, ease: 'power3.in' }, b4 + 3.0)
      tl.to('.c2-deskbook', { opacity: 0, duration: 0.4 }, b4 + 3.9)
      tl.to('.c2-dark', { opacity: 0.97, duration: 0.8 }, b4 + 3.7)
      tl.to('.c2-bk', { opacity: 1, duration: 0.6 }, b4 + 3.8)
      tl.to('.c2-bk-in', { scale: 1, duration: 1.3, ease: 'power3.out' }, b4 + 3.8)
      tl.to('.c2-bk-cover', { scaleX: 0, duration: 0.35, ease: 'power2.in' }, b4 + 4.7)
      tl.to('.c2-bk-open', { opacity: 1, duration: 0.05 }, b4 + 5.0)
      tl.to('.c2-bk-cover', { scaleX: -1, duration: 0.35, ease: 'power2.out' }, b4 + 5.05)
      tl.to('.c2-bk-cover', { opacity: 0, duration: 0.25 }, b4 + 5.3)
      tl.to('.c2-bk-glow', { opacity: 1, duration: 0.8 }, b4 + 5.0)
      tl.to('.c2-beam', { opacity: 1, duration: 0.6 }, b4 + 5.2)
      tl.to('.c2-bk-line', { opacity: 1, duration: 0.3, stagger: 0.32 }, b4 + 5.5)
      tl.to('.c2-word', { opacity: 1, duration: 0.5 }, b4 + 8.9)
      tl.to(W, { s: 1, duration: 0.8, ease: 'back.out(2)', onUpdate: applyWord }, b4 + 8.9)
      tl.to('.c2-restoring', { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, b4 + 10.1)
      tl.to(['.c2-beam-l', '.c2-beam-r'], { x: 0, y: 0, rotation: 0, duration: 0.8, ease: 'back.out(1.4)' }, b4 + 10.2)
      tl.to('.c2-beam-teal', { opacity: 1, duration: 0.35 }, b4 + 10.95)
      tl.to('.c2-beam-flash', { opacity: 1, duration: 0.3, yoyo: true, repeat: 1 }, b4 + 10.95)

      // 5. Out to the world map: trails from Baghdad, and al-jabr travels and turns into algebra.
      tl.addLabel('b5', b4 + 11.8)
      const b5 = tl.labels.b5
      tl.to('.c2-bk-out', { scale: 0.12, duration: 1.1, ease: 'power3.in' }, b5)
      tl.to('.c2-bk', { opacity: 0, duration: 0.5 }, b5 + 0.6)
      tl.to('.c2-map', { opacity: 1, duration: 0.7 }, b5 + 0.3)
      tl.to('.c2-map-zoom', { scale: 1, duration: 1.6, ease: 'power3.out' }, b5 + 0.3)
      tl.to(W, { x: WORD_AT.baghdad.x, y: WORD_AT.baghdad.y, s: WORD_AT.baghdad.s, duration: 1.2, ease: 'power2.inOut', onUpdate: applyWord }, b5 + 0.1)
      TRAILS.forEach((_, i) => {
        tl.to(`.c2-trail${i}`, { strokeDashoffset: 0, duration: 1.0, ease: 'power1.inOut' }, b5 + 1.0 + i * 0.2)
        tl.to(`.c2-dest${i}`, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(3)' }, b5 + 1.9 + i * 0.2)
      })
      const T = { t: 0 }
      const eu = TRAILS[0]
      tl.to(
        T,
        {
          t: 1,
          duration: 2.0,
          ease: 'sine.inOut',
          onUpdate: () => {
            W.x = quad(BAGHDAD.x, eu.c.x, eu.to.x, T.t)
            W.y = quad(BAGHDAD.y, eu.c.y, eu.to.y, T.t) - 34
            applyWord()
          },
        },
        b5 + 2.4,
      )
      const steps = [4.55, 4.9, 5.25, 5.6, 6.2]
      steps.forEach((t, i) => {
        tl.set(`.c2-wst${i}`, { opacity: 0 }, b5 + t)
        tl.set(`.c2-wst${i + 1}`, { opacity: 1 }, b5 + t)
        tl.fromTo('.c2-word-pop', { scale: 1.25 }, { scale: 1, duration: 0.3, ease: 'back.out(3)', immediateRender: false }, b5 + t)
      })
      tl.to('.c2-baghdad-label', { opacity: 0, duration: 0.4 }, b5 + 4.4)
      tl.to('.c2-scrim', { opacity: 0.75, duration: 0.8 }, b5 + 4.9)
      tl.to(W, { x: WORD_AT.end.x, y: WORD_AT.end.y, s: WORD_AT.end.s, duration: 1.4, ease: 'power2.inOut', onUpdate: applyWord }, b5 + 4.7)
      tl.addLabel('b6', b5 + 6.6)
    },
    [applyGears],
  )

  const animDone = useCallback(() => {
    setAnimAt(cueRef.current)
    onAnimDone()
  }, [onAnimDone])

  useBeatTimeline(root, build, cueIndex, playing, animDone)

  // The learner's turn: pulling the lever runs the machine backwards.
  const runBackwards = useCallback(() => {
    const r = root.current
    if (!r) return
    const q = gsap.utils.selector(r)
    const G = gears.current
    const arm = { d: lever.current.deg }
    const tl = gsap.timeline({
      onComplete: () => {
        void say(BACK_LINE)
        onPlayDone()
      },
    })
    runTl.current = tl
    tl.to(arm, { d: LEVER.down, duration: 0.35, ease: 'back.out(2.2)', onUpdate: () => setArm(arm.d) }, 0)
    tl.to(q('.c2-mach-shake'), { x: 5, duration: 0.05, yoyo: true, repeat: 7, ease: 'sine.inOut' }, 0.12)
    tl.to(q('.c2-screen'), { scaleY: 0, duration: 0.16, ease: 'power2.in' }, 0.2)
    tl.set(q('.c2-op-plus'), { opacity: 0 }, 0.36)
    tl.set(q('.c2-op-minus'), { opacity: 1 }, 0.36)
    tl.to(q('.c2-screen'), { scaleY: 1, duration: 0.3, ease: 'back.out(3)' }, 0.36)
    tl.to(q('.c2-arrow-b'), { strokeDashoffset: 0, duration: 0.8, ease: 'power1.inOut' }, 0.45)
    tl.to(q('.c2-arrow-bh, .c2-arrow-bl'), { opacity: 1, duration: 0.3 }, 1.05)
    tl.to(G, { a: G.a - 540, duration: 1.7, ease: 'power1.inOut', onUpdate: applyGears }, 0.4)
    tl.to(q('.c2-out11'), { x: -96, scale: 0.35, opacity: 0, duration: 0.65, ease: 'power2.in' }, 0.5)
    tl.to(q('.c2-qf'), { scale: 0.3, opacity: 0, duration: 0.3, ease: 'power2.in' }, 1.5)
    tl.to(q('.c2-out8'), { y: 0, scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(2)' }, 1.55)
    tl.fromTo(q('.c2-ring8'), { scale: 0.5, opacity: 0.9, svgOrigin: '0 0' }, { scale: 1.9, opacity: 0, duration: 0.8, ease: 'power2.out' }, 1.95)
    tl.to({}, { duration: 0.3 }, 2.45)
    if (!playing) tl.pause()
  }, [say, onPlayDone, setArm, applyGears, playing])

  const pull = useCallback(() => {
    if (pulledRef.current) return
    pulledRef.current = true
    lever.current.dragging = false
    setPulled(true)
    emit({ type: 'attempt', correct: true, detail: 'pulled the lever: the 11 went back in through −3 and an 8 came out of the funnel' })
    runBackwards()
  }, [emit, runBackwards])

  const springBack = useCallback(() => {
    const arm = { d: lever.current.deg }
    gsap.to(arm, { d: LEVER.up, duration: 0.7, ease: 'elastic.out(1, 0.45)', onUpdate: () => setArm(arm.d) })
  }, [setArm])

  const angleAt = (p: { x: number; y: number }) => {
    const dx = p.x - PIVOT.x
    const dy = p.y - PIVOT.y
    let d = (Math.atan2(dx, -dy) * 180) / Math.PI
    if (d > 0) d = dy < 0 ? LEVER.up : LEVER.down
    return Math.max(LEVER.down, Math.min(LEVER.up, d))
  }
  const progressAt = (deg: number) => (LEVER.up - deg) / (LEVER.up - LEVER.down)

  const drag = useDrag({
    onStart: (p) => {
      if (!myTurn) return
      const L = lever.current
      L.dragging = true
      L.moved = 0
      L.x = p.x
      L.y = p.y
      if (!L.touched) {
        L.touched = true
        emit({ type: 'progress', detail: 'grabbed the lever' })
      }
    },
    onMove: (p) => {
      const L = lever.current
      if (!L.dragging || pulledRef.current) return
      L.moved = Math.max(L.moved, Math.hypot(p.x - L.x, p.y - L.y))
      const d = angleAt(p)
      setArm(d)
      if (progressAt(d) > 0.8) pull()
    },
    onEnd: () => {
      const L = lever.current
      if (!L.dragging || pulledRef.current) return
      L.dragging = false
      // A tap pulls it too; a half pull springs back up so it can be tried again.
      if (L.moved < 12) pull()
      else springBack()
    },
  })

  useEffect(() => {
    const t = runTl.current
    if (!t) return
    if (playing) t.resume()
    else t.pause()
  }, [playing])

  useEffect(() => () => void runTl.current?.kill(), [])

  // What Pip sees, and hints for the lever.
  useEffect(() => {
    if (cueIndex === 3) {
      reportState(
        pulled
          ? 'The learner pulled the lever. The machine ran backwards: its screen flipped from "+3" to "−3", the gears turned the other way, the gold 11 slid back into the pipe and a gold 8 popped out of the funnel where the pink question mark was. 8 went in, because taking the 3 away from 11 leaves 8.'
          : 'A number machine with "+3" on its screen. A gold 11 has come out of its pipe and a pink question mark floats over the funnel: what went in? The learner should drag the round blue handle of the big lever on the left side of the machine down to run the machine backwards (a tap on the handle works too). Nothing can go wrong here. The answer is 8 (11 take away 3). A likely mix-up is 14, from adding the 3 again instead of undoing it.',
      )
      setHints([
        'Look at the big lever on the left side of the machine.',
        'Grab its round handle and pull it all the way down.',
        'Running a machine backwards undoes what it did. This machine adds 3.',
      ])
    } else {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
    }
  }, [cueIndex, pulled, reportState, setHints])

  const restDeg = leverDown ? LEVER.down : LEVER.up
  const fgPillars = [60, 2560]
  const nearLanterns = [[1250, -480]]
  const linkD = (() => {
    const [a, b, c] = [qCentre(0), qCentre(1), qCentre(2)]
    return `M${a.x} ${a.y} Q${(a.x + b.x) / 2} ${Math.min(a.y, b.y) - 120} ${b.x} ${b.y} Q${(b.x + c.x) / 2} ${Math.min(b.y, c.y) - 120} ${c.x} ${c.y}`
  })()

  return (
    <g ref={root}>
      <defs>
        <clipPath id="c2-bubclip">
          <circle r={BUB_R - 5} />
        </clipPath>
        <radialGradient id="c2-scrim-g">
          <stop offset="0" stopColor={N.night0} stopOpacity="0.9" />
          <stop offset="0.6" stopColor={N.night0} stopOpacity="0.6" />
          <stop offset="1" stopColor={N.night0} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* The hall: the back wall, the floor with its people, and near pillars, each panned at its own speed */}
      <g className="c2-hall" pointerEvents="none">
        <g className="c2-zoom">
          <g className="c2-zoom2">
            <g className="c2-pan-bg">
              <Dome />
              <rect x={-500} y={-4} width={3200} height={720} fill={N.dusk} />
              <rect x={-500} y={-4} width={3200} height={26} fill={N.violetDark} />
              {[140, 800, 1460, 2120].map((gx) => (
                <Glow key={gx} x={gx} y={360} r={560} color="warm" opacity={0.2} />
              ))}
              {ALCOVES.map((cx, i) => (
                <Alcove key={cx} cx={cx} seed={41 + i * 13} />
              ))}
              {ALCOVES.map((cx) => (
                <g key={cx}>
                  <rect x={cx + 165 - 22} y={40} width={44} height={660} fill={N.plum} />
                  <rect x={cx + 165 + 6} y={40} width={16} height={660} fill={N.shadow} opacity={0.25} />
                  <rect x={cx + 165 - 30} y={28} width={60} height={20} rx={6} fill={N.violetDark} />
                  <rect x={cx + 165 - 30} y={672} width={60} height={28} rx={6} fill={N.violetDark} />
                </g>
              ))}
              <rect x={-500} y={694} width={3200} height={18} fill={N.violetDark} />
              {ARRIVALS.map((a, i) => (
                <g key={i} className={`c2-fb c2-fb${i}`}>
                  <g className="c2-fbg">
                    <Glow r={80} color="warm" opacity={0.75} />
                  </g>
                  <FlatBook c={a.c} />
                </g>
              ))}
            </g>

            <g className="c2-pan-mid">
              <rect x={-700} y={706} width={3800} height={700} fill={N.night1} />
              <rect x={-700} y={706} width={3800} height={10} fill={N.night2} />
              <rect x={-700} y={846} width={3800} height={60} fill={N.plum} opacity={0.6} />
              <rect x={-700} y={854} width={3800} height={4} fill={N.dusk} />
              <rect x={-700} y={894} width={3800} height={4} fill={N.dusk} />
              {/* two scholars reading a scroll together */}
              <Glow x={340} y={700} r={300} color="warm" opacity={0.35} />
              <Person x={250} y={792} s={0.85} skin={N.skin2} skinDark={N.skin2Dark} robe={N.sky} robeLight={N.skyLight} robeDark={N.skyDark} head="turban" headColor={N.sand} headDark={N.sandDark} beard={N.night0} pose="hold" face="calm" />
              <Person x={432} y={792} s={0.85} flip skin={N.skin1} skinDark={N.skin1Dark} robe={N.leaf} robeLight={N.leafLight} robeDark={N.leafDark} head="hijab" headColor={N.stone} headDark={N.stoneDark} pose="point" face="smile" />
              <LowTable x={340} y={772} w={300} />
              <path d="M262 760 H418 V766 H262 Z" fill={N.cream} />
              <circle cx={262} cy={763} r={7} fill={N.sandLight} />
              <circle cx={418} cy={763} r={7} fill={N.sandLight} />
              <OilLamp x={455} y={764} glow={0.8} />
              {/* a scholar carrying newly arrived books */}
              <Person
                x={690}
                y={880}
                s={0.95}
                flip
                skin={N.skin1}
                skinDark={N.skin1Dark}
                robe={N.stone}
                robeLight={N.stoneLight}
                robeDark={N.stoneDark}
                head="cap"
                headColor={N.sandDark}
                beard={N.wood}
                pose="hold"
                face="smile"
                holding={
                  <g transform="translate(0 -126) scale(0.75)">
                    <g transform="translate(0 0)">
                      <FlatBook c={N.sky} />
                    </g>
                    <g transform="translate(4 -22)">
                      <FlatBook c={N.violetLight} />
                    </g>
                    <g transform="translate(-3 -44)">
                      <FlatBook c={N.leaf} />
                    </g>
                  </g>
                }
              />
              {/* a scholar writing by lamplight */}
              <Glow x={1000} y={720} r={260} color="warm" opacity={0.35} />
              <Person x={1000} y={792} s={0.85} skin={N.skin2} skinDark={N.skin2Dark} robe={N.sand} robeLight={N.sandLight} robeDark={N.sandDark} head="turban" headColor={N.stoneLight} headDark={N.stone} beard={N.night1} pose="down" face="calm" />
              <LowTable x={1000} y={772} w={260} />
              <Book x={1010} y={770} s={0.3} />
              <OilLamp x={1100} y={764} glow={0.8} />

              <rect className="c2-hall-dim" x={-1200} y={-1400} width={4400} height={2800} fill={N.night0} />

              {/* al-Khwarizmi at his desk */}
              <g className="c2-spot">
                <Glow x={AK.x} y={AK.y - 170} r={420} color="warm" opacity={0.55} />
              </g>
              <AlKhwarizmi x={AK.x} y={AK.y} s={1} pose={cueIndex === 0 ? 'down' : cueIndex <= 3 ? 'think' : 'down'} face={cueIndex >= 1 && cueIndex <= 3 ? 'think' : 'smile'} />
              <g data-tutor="al-Khwarizmi">
                <rect x={AK.x - 70} y={AK.y - 270} width={140} height={260} fill="transparent" />
              </g>
              <LowTable x={AK.x} y={AK.y - 28} w={380} />
              <OilLamp x={AK.x - 140} y={AK.y - 36} />
              <g transform={`translate(${AK.x - 70} ${AK.y - 36})`}>
                <path d="M-12 0 Q-16 -18 -8 -22 H8 Q16 -18 12 0 Z" fill={N.night0} />
                <path d="M2 -20 L22 -58" stroke={N.sandLight} strokeWidth={4} strokeLinecap="round" />
              </g>
              <g className="c2-deskglow">
                <Glow x={DESKBOOK.x} y={DESKBOOK.y - 20} r={130} color="warm" />
              </g>
              <g transform={`translate(${DESKBOOK.x} ${DESKBOOK.y})`}>
                <g className="c2-deskbook">
                  <ClosedBook />
                </g>
              </g>
            </g>

            <g className="c2-pan-fg">
              {nearLanterns.map(([lx, ly], i) => (
                <g key={lx} transform={`translate(${lx} ${ly})`}>
                  <line x1={0} y1={-900} x2={0} y2={-120} stroke={N.night0} strokeWidth={5} />
                  <g className="sway" style={{ animationDelay: `${-i * 1.7}s` }}>
                    <Lantern y={0} s={2.1} rope={60} color={i ? N.sky : N.coral} />
                  </g>
                </g>
              ))}
              {fgPillars.map((px) => (
                <g key={px}>
                  <rect x={px - 70} y={-1600} width={140} height={2900} fill={N.night0} />
                  <rect x={px - 70} y={-1600} width={22} height={2900} fill={N.violetDark} opacity={0.6} />
                  <rect x={px + 52} y={-1600} width={18} height={2900} fill={N.shadow} opacity={0.5} />
                  <rect x={px - 86} y={-40} width={172} height={36} rx={8} fill={N.night1} />
                  <rect x={px - 86} y={1010} width={172} height={40} rx={8} fill={N.night1} />
                </g>
              ))}
            </g>
          </g>
        </g>
      </g>

      <g pointerEvents="none">
        <Motes count={22} seed={5} />
      </g>

      <g className="c2-title" pointerEvents="none">
        <Title y={175} size={80}>
          The House of Wisdom
        </Title>
      </g>

      {/* Al-Khwarizmi's thoughts: three puzzles of the same kind */}
      <g className="c2-thoughts" pointerEvents="none">
        {[-1, 1].map((side) =>
          [0, 1, 2].map((k) => <circle key={`${side}-${k}`} className="c2-dot" cx={HEAD.x + side * (70 + k * 70)} cy={HEAD.y - 40 - k * 40} r={8 + k * 4} fill={N.cream} opacity={0.85} />),
        )}
        {BUBBLES.map((b, i) => (
          <g key={b.label} transform={`translate(${b.x} ${b.y})`} data-tutor={`the ${b.label}'s puzzle`}>
            <g className={`c2-bub c2-bub${i}`}>
              <circle r={BUB_R + 14} fill={N.cream} opacity={0.1} />
              <circle r={BUB_R} fill={N.night0} opacity={0.94} />
              <g clipPath="url(#c2-bubclip)">
                <Glow y={20} r={170} color="violet" opacity={0.5} />
                {i === 0 ? <MerchantPuzzle /> : i === 1 ? <BuilderPuzzle /> : <JudgePuzzle />}
              </g>
              <circle r={BUB_R} fill="none" stroke={N.cream} strokeWidth={5} opacity={0.9} />
              <rect x={-(b.label.length * 10 + 26)} y={BUB_R - 22} width={b.label.length * 20 + 52} height={48} rx={24} fill={N.night0} stroke={N.cream} strokeWidth={3} />
              <text y={BUB_R + 12} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={30} fill={N.cream}>
                {b.label}
              </text>
            </g>
          </g>
        ))}
        <g className="c2-link">
          <path className="c2-link-path" d={linkD} pathLength={1} strokeDasharray="1 1" stroke={N.pinkLight} strokeWidth={5} strokeLinecap="round" fill="none" filter="url(#fx-glow)" />
        </g>
      </g>

      <rect className="c2-dark" pointerEvents="none" x={-200} y={-200} width={2000} height={1300} fill={N.space} />

      <g className="c2-year" pointerEvents="none">
        <Title y={150} size={52} color={N.cream}>
          around the year 820
        </Title>
      </g>

      {/* The number machine, inside al-Khwarizmi's head */}
      <g className="c2-mach">
        <Glow x={M.x + 60} y={M.y - 60} r={520} color="violet" opacity={0.55} />
        <g className="c2-mach-in">
          <g transform={`translate(${M.x} ${M.y}) scale(${M.s})`}>
            <g className="c2-mach-shake">
              {/* behind the machine, so they vanish into the funnel and the pipe */}
              <g transform={`translate(${HOVER.x} ${HOVER.y})`}>
                <g className="c2-in8">
                  <Equation terms={[{ t: '8', k: 'num' }]} x={0} y={0} size={64} />
                </g>
                <g className="c2-out8" data-tutor="the 8 that went in">
                  <circle className="c2-ring8" r={62} fill="none" stroke={N.goldLight} strokeWidth={6} />
                  <Equation terms={[{ t: '8', k: 'num' }]} x={0} y={0} size={64} />
                </g>
              </g>
              <g transform={`translate(${OUT.x} ${OUT.y})`}>
                <g className="c2-out11" data-tutor="the 11 that came out">
                  <g className="c2-out11-glow">
                    <Glow r={120} color="warm" />
                  </g>
                  <Equation terms={[{ t: '11', k: 'num' }]} x={0} y={0} size={64} />
                </g>
              </g>
              <NumberMachine op=" " tutor="the number machine" />
              {/* our own screen and gears over the machine's, so they can flip and turn both ways */}
              <g className="c2-screen">
                <text className="c2-op-plus" y={-28} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={76} fill={N.tealLight}>
                  +3
                </text>
                <text className="c2-op-minus" y={-28} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={76} fill={N.tealLight}>
                  −3
                </text>
              </g>
              <rect x={-120} y={20} width={240} height={100} rx={20} fill={N.night1} />
              <g transform="translate(-50 70)">
                <g className="c2-gear-a">
                  <Gear r={34} color={N.gold} />
                </g>
              </g>
              <g transform="translate(26 62)">
                <g className="c2-gear-b">
                  <Gear r={26} color={N.coral} />
                </g>
              </g>
              <g transform="translate(84 84)">
                <g className="c2-gear-c">
                  <Gear r={18} color={N.teal} />
                </g>
              </g>

              {/* forwards and backwards */}
              <path className="c2-arrow-f" d={ARROW_F} pathLength={1} strokeDasharray="1 1" stroke={N.mist} strokeWidth={7} strokeLinecap="round" fill="none" />
              <path className="c2-arrow-fh" d="M0 0 L-26 -15 L-26 15 Z" fill={N.mist} transform="translate(352 -12) rotate(82.4)" />
              <text className="c2-arrow-fl" x={150} y={-222} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={34} fill={N.mist}>
                forwards
              </text>
              <path className="c2-arrow-b" d={ARROW_B} pathLength={1} strokeDasharray="1 1" stroke={N.white} strokeWidth={7} strokeLinecap="round" fill="none" />
              <path className="c2-arrow-bh" d="M0 0 L-26 -15 L-26 15 Z" fill={N.white} transform="translate(-10 -365) rotate(173.6)" />
              <text className="c2-arrow-bl" x={150} y={-222} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={34} fill={N.white}>
                backwards
              </text>

              {/* the lever */}
              <g transform={`translate(${LEVER.x} ${LEVER.y})`} data-tutor="the lever">
                <rect x={-30} y={-40} width={36} height={80} rx={14} fill={N.stoneDark} />
                <g ref={armRef} transform={`rotate(${restDeg})`}>
                  <rect x={-10} y={-LEVER.len} width={20} height={LEVER.len} rx={10} fill={N.stoneLight} />
                  <rect x={2} y={-LEVER.len} width={8} height={LEVER.len} rx={4} fill={N.stone} />
                  <g transform={`translate(0 ${-LEVER.len})`} {...drag} className={myTurn ? 'hot' : undefined} style={{ ...drag.style, cursor: myTurn ? 'grab' : 'default' }}>
                    <circle r={66} fill="transparent" />
                    {myTurn && <Glow r={110} color="cool" opacity={0.8} />}
                    {myTurn && <circle className="hot-ring" r={54} fill="none" stroke={N.white} strokeWidth={5} />}
                    <circle r={38} fill={N.sky} />
                    <circle r={38} fill="none" stroke={N.skyDark} strokeWidth={7} />
                    <circle cx={-11} cy={-12} r={11} fill={N.skyLight} opacity={0.9} />
                  </g>
                </g>
                <circle r={20} fill={N.stone} />
                <circle r={8} fill={N.stoneDark} />
              </g>

              <Q x={HOVER.x} y={HOVER.y + 38} size={110} className="c2-qf" tutor="the question mark over the funnel" />
            </g>
          </g>
        </g>
      </g>

      {/* Al-Khwarizmi's book, and the broken beam that al-jabr restores */}
      <g className="c2-bk" pointerEvents="none">
        <g className="c2-bk-out">
          <g className="c2-bk-in">
            <g className="c2-bk-glow">
              <Glow x={BOOK.x} y={BOOK.y - 180} r={500} color="warm" />
            </g>
            <g transform={`translate(${BOOK.x} ${BOOK.y}) scale(${BOOK.s})`} data-tutor="al-Khwarizmi's book">
              <g className="c2-bk-open">
                <Book diagram />
                {Array.from({ length: 8 }, (_, i) => {
                  const side = i < 6 ? -1 : 1
                  const k = i < 6 ? i : i - 6
                  return (
                    <path
                      key={i}
                      className="c2-bk-line"
                      d={`M${side * 22} ${-150 + k * 20} q${side * 30} -6 ${side * 60} 0 t${side * 60} 0`}
                      stroke={N.white}
                      strokeWidth={4.5}
                      fill="none"
                      strokeLinecap="round"
                      filter="url(#fx-glow)"
                    />
                  )
                })}
              </g>
              <g className="c2-bk-cover">
                <path d="M0 -6 Q82 -22 166 -4 V-182 Q82 -200 0 -182 Z" fill={N.violetDark} />
                <path d="M0 -6 Q82 -22 166 -4 V-14 Q82 -32 0 -16 Z" fill={N.shadow} opacity={0.3} />
                <path d="M14 -24 Q82 -38 152 -22 V-168 Q82 -182 14 -170 Z" fill="none" stroke={N.sandLight} strokeWidth={3} opacity={0.8} />
                <path d="M83 -128 L92 -104 L116 -95 L92 -86 L83 -62 L74 -86 L50 -95 L74 -104 Z" fill={N.sandLight} opacity={0.85} />
              </g>
            </g>
            <g transform={`translate(${BEAM.x} ${BEAM.y})`}>
              <g className="c2-beam" data-tutor="the balance beam">
                <rect x={-14} y={0} width={28} height={220} rx={8} fill={N.stone} />
                <rect x={4} y={0} width={10} height={220} fill={N.stoneDark} opacity={0.6} />
                <path d="M-90 236 Q-80 206 -30 202 H30 Q80 206 90 236 Z" fill={N.stone} />
                <g className="c2-beam-l">
                  <BeamHalf side={-1} />
                </g>
                <g className="c2-beam-r">
                  <BeamHalf side={1} />
                </g>
                <g className="c2-beam-teal">
                  <g className="c2-beam-flash">
                    <Glow r={300} color="teal" />
                  </g>
                  <rect x={-BEAM.half - 5} y={-13} width={BEAM.half * 2 + 10} height={26} rx={12} fill={N.teal} />
                  <rect x={-BEAM.half} y={3} width={BEAM.half * 2} height={8} rx={4} fill={N.tealDark} />
                  <rect x={-BEAM.half + 10} y={-8} width={BEAM.half * 2 - 20} height={5} rx={2.5} fill={N.tealLight} />
                  <path d="M-8 -10 L0 -66 L8 -10 Z" fill={N.teal} />
                </g>
                <circle r={18} fill={N.stone} />
                <circle r={7} fill={N.stoneDark} />
              </g>
            </g>
            <g className="c2-restoring">
              <Title y={352} size={58} color={N.mist}>
                restoring
              </Title>
            </g>
          </g>
        </g>
      </g>

      {/* The world map */}
      <g className="c2-map" data-tutor="the world map" pointerEvents="none">
        <g className="c2-map-zoom">
          <WorldMap />
          {TRAILS.map((t, i) => (
            <g key={t.name}>
              <path
                className={`c2-trail c2-trail${i}`}
                d={`M${BAGHDAD.x} ${BAGHDAD.y} Q${t.c.x} ${t.c.y} ${t.to.x} ${t.to.y}`}
                pathLength={1}
                strokeDasharray="1 1"
                stroke={N.cream}
                strokeWidth={5}
                strokeLinecap="round"
                fill="none"
                filter="url(#fx-glow)"
              />
              <g transform={`translate(${t.to.x} ${t.to.y})`}>
                <g className={`c2-dest c2-dest${i}`}>
                  <Glow r={56} color="cool" />
                  <circle r={10} fill={N.cream} />
                </g>
              </g>
            </g>
          ))}
          <g transform={`translate(${BAGHDAD.x} ${BAGHDAD.y})`}>
            <Glow r={100} color="warm" opacity={0.9} />
            <circle r={22} fill="none" stroke={N.cream} strokeWidth={4} opacity={0.7} />
            <circle r={12} fill={N.cream} />
          </g>
          <g className="c2-baghdad-label">
            <Title x={BAGHDAD.x} y={BAGHDAD.y + 58} size={30} color={N.cream}>
              Baghdad
            </Title>
          </g>
        </g>
        <ellipse className="c2-scrim" cx={WORD_AT.end.x} cy={WORD_AT.end.y - 10} rx={560} ry={190} fill="url(#c2-scrim-g)" />
      </g>

      {/* The word: al-jabr, and later algebra */}
      <g className="c2-word" data-tutor="the word al-jabr" pointerEvents="none">
        <g className="c2-word-pop">
          <Glow r={250} color="warm" opacity={0.5} />
          {WORD.map((w, i) => (
            <text
              key={i}
              className={`c2-wst c2-wst${i}`}
              y={WORD_SIZE * 0.34}
              textAnchor="middle"
              fontFamily={FONT2}
              fontWeight={800}
              fontSize={WORD_SIZE}
              fill={N.white}
              stroke={N.shadow}
              strokeWidth={WORD_SIZE * 0.12}
              strokeOpacity={0.45}
              paintOrder="stroke"
              strokeLinejoin="round"
            >
              {w.t.split('').map((ch, k) => (
                <tspan key={k} fill={k === w.hi ? N.skyLight : undefined}>
                  {ch}
                </tspan>
              ))}
            </text>
          ))}
        </g>
      </g>

      <Vignette />
    </g>
  )
}

export const ch2: Chapter = {
  id: 'wisdom',
  title: 'The House of Wisdom',
  cues: CUES,
  Scene: Ch2Wisdom,
  enter: { type: 'zoom', x: 1180, y: 380 },
}
