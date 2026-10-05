import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Backdrop, Glow, Motes, Stars, Vignette } from '../../art2/fx'
import { FONT2, N } from '../../art2/palette'
import { Equation, SCALE, Sack, Scale, Title, Weight, termWidth, terms, tiltFor, tiltScale, type Term } from '../../art2/props'
import { Moon, Skyline } from '../../art2/scenery'
import { useBeatTimeline } from '../../engine/useBeatTimeline'
import type { Chapter, ChapterProps, Cue } from '../../flow/types'
import { BalancePlay, equationText, isLevel, isSolved, type Balance, type Move } from './balance'

export const CUES: Cue[] = [
  { id: 'equals', say: 'The equals sign is the heart of it. It means both sides weigh exactly the same.' },
  { id: 'tip', say: "Add a weight to one side only, and the scale tips. The equation isn't true anymore." },
  { id: 'rule', say: 'So algebra has one golden rule: whatever you do to one side, do the same to the other.' },
  { id: 'both', say: 'Take a weight off both sides, and it stays level. Add one to both sides, and it stays level.' },
  { id: 'solve', say: 'Your turn. Take weights off until the sack is alone on its side. Keep the scale level, so the equation stays true.', play: true },
  { id: 'eight', say: "Eight! The sack weighs the same as eight weights. You took three from both sides, and that is exactly al-Khwarizmi's move." },
  { id: 'guess', say: "Remember your guess at the market? Here's how close you were." },
]

/** What the world says back while the learner plays. Each is said at most twice. */
const LINES = {
  tipped: "It tipped. The two sides aren't equal anymore.",
  level: 'Level again. You kept it fair.',
  sack: "That's the sack we want to weigh. Put it back on its pan.",
} as const

/** Said once the guess from chapter 1 is back on screen, depending on how close it was. */
const CLOSENESS = {
  exact: 'Spot on. You solved it in your head!',
  close: 'Really close. Now you can be sure, not just close.',
  far: 'Guessing got you part of the way. Algebra gets you all the way.',
} as const

const HINTS = [
  'Whatever you take off one side, take the same off the other side.',
  'The sack shares its pan with a few weights. Lift those off one at a time, and match each one on the other side.',
  'Count the weights sitting next to the sack. Take that many off the other side too.',
]

/** What one sack really weighs. */
const X = 8
const START: Balance = { left: { sacks: 1, weights: 3 }, right: { sacks: 0, weights: 11 } }
const SOLVED: Balance = { left: { sacks: 1, weights: 0 }, right: { sacks: 0, weights: 8 } }

/* ------------------------------------------------------------------ */
/* Where things stand (stage coordinates)                               */
/* ------------------------------------------------------------------ */

/** The playable scale's base, and its size. My own drawn copies stand exactly here too. */
const BP = { x: 800, y: 640, s: 0.85 }
const EQ = { y: 772, size: 56 }
const { H, L, DROP } = SCALE
const PIVOT_Y = BP.y - H * BP.s
/** The middle of each pan's top while the scale is level. */
const PAN = { lx: BP.x - L * BP.s, rx: BP.x + L * BP.s, y: BP.y + (-H + DROP - 7) * BP.s }
const TRAY = { dx: 600 * BP.s, w: 230, itemY: BP.y - 6 * BP.s }
/** The written working in cue 6, to the right of the scale. */
const WK = { x: 1268, top: 262, y1: 356, y2: 462, rule: 516, y3: 590, bottom: 668, size: 56 }
/** The number line in cue 7 (like the guess slate in chapter 1, bigger). */
const NL = { x0: 320, step: 64, y: 560, max: 15 }
const nx = (v: number) => NL.x0 + v * NL.step

/** Where things sit on a pan, (0, 0) being the middle of the pan's top. The same layout BalancePlay uses. */
function panSpots(n: number, m: number) {
  const PAN_W = 284
  const WW = 46
  const sw = n >= 3 ? 78 : 84
  const sackBlock = n * sw
  const perRow = n === 0 ? 6 : Math.max(1, Math.floor((PAN_W - sackBlock - 8) / WW))
  const wBlock = Math.min(perRow, m) * WW
  const total = sackBlock + (n && m ? 8 : 0) + wBlock
  const start = -total / 2
  const left = start + sackBlock + (n && m ? 8 : 0)
  const sacks = Array.from({ length: n }, (_, i): [number, number] => [start + sw * (i + 0.5), 0])
  const weights = Array.from({ length: m }, (_, j): [number, number] => {
    const row = Math.floor(j / perRow)
    const inRow = Math.min(perRow, m - row * perRow)
    const col = j % perRow
    return [n === 0 ? (col - (inRow - 1) / 2) * WW : left + WW * (col + 0.5) + ((perRow - inRow) * WW) / 2, -row * 50]
  })
  return { sacks, weights }
}

/** Spare weights side by side on a tray, (0, 0) being the middle of the tray's top. */
const traySpots = (m: number) => Array.from({ length: m }, (_, i) => -(m * 46) / 2 + 23 + i * 46)

/** The centre x of each tile when a row of terms is centred on `cx`, the way <Equation> lays them out. */
function slotsFor(ts: Term[], cx: number, size: number, gap = 16) {
  const widths = ts.map((t) => termWidth(t, size))
  let x = cx - (widths.reduce((a, b) => a + b, 0) + gap * (ts.length - 1)) / 2
  return widths.map((w) => {
    const c = x + w / 2
    x += w + gap
    return c
  })
}

const EQ_TERMS = terms('x + 3 = 11')
const [SX, SPLUS, SA, SEQ, SB] = slotsFor(EQ_TERMS, BP.x, EQ.size)
const [WX, WPLUS, WA, WEQ, WB] = slotsFor(EQ_TERMS, WK.x, WK.size)
const tileW = (t: string, k: Term['k'], size = EQ.size) => termWidth({ t, k }, size)

const L0 = panSpots(1, 3)
const R0 = panSpots(0, 11)

/** The two bars of the giant equals sign, and what they become: the scale's beam, and the "=" tile under it. */
const BAR1 = { x: 690, y: 382, width: 220, height: 44, rx: 22 }
const BAR2 = { x: 690, y: 474, width: 220, height: 44, rx: 22 }
const BEAM = { x: BP.x - (L + 10) * BP.s, y: PIVOT_Y - 9 * BP.s, width: (2 * L + 20) * BP.s, height: 18 * BP.s, rx: 9 * BP.s }
const EQ_TILE = { x: SEQ - tileW('=', 'eq') / 2, y: EQ.y - EQ.size * 0.65, width: tileW('=', 'eq'), height: EQ.size * 1.3, rx: EQ.size * 1.3 * 0.32 }

const STATE: string[] = [
  'A giant teal equals sign (where chapter 3 ended) turns into the beam of a brass balance scale. The pink sack (x) and 3 gold weights land on the left pan, 11 weights on the right, and the scale stays level. Under it the equation x + 3 = 11, with a teal equals sign.',
  'One extra weight drops onto the left pan only. The scale tips to the left and the equation under it becomes x + 4 ≠ 11, with a coral not-equal sign.',
  'The extra weight is lifted off again, so the scale is level with x + 3 = 11. Then the golden rule appears above the scale: "Whatever you do to one side, do the same to the other." The left pan and the left side of the equation light up, then the right pan and the right side.',
  'One weight is lifted off each side at the same time and goes to a tray beside the scale: it stays level and the equation reads x + 2 = 10. Then one weight goes back on each side: still level, x + 3 = 11.',
  '',
  'Solved: the sack is alone on its pan with 8 weights on the other side, level. The 3 weights taken off each side sit on the trays. Next to the scale the working is written out: x + 3 = 11, then − 3 under both sides, then x = 8. That is al-Khwarizmi\'s move: do the same to both sides.',
  '',
]

function readGuess(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(15, Math.round(v))) : undefined
}

/** One equation tile on its own, drawn exactly as <Equation> draws it in a row. */
function Tile({ t, k, x, y = EQ.y, size = EQ.size }: { t: string; k: Term['k']; x: number; y?: number; size?: number }) {
  return <Equation terms={[{ t, k }]} x={x} y={y} size={size} />
}

/** A wooden tray for spare things, drawn like BalancePlay's. */
function Tray({ x, children, tutor }: { x: number; children?: ReactNode; tutor: string }) {
  return (
    <g transform={`translate(${x} ${BP.y}) scale(${BP.s})`} data-tutor={tutor}>
      <ellipse cy={10} rx={TRAY.w / 2 + 10} ry={16} fill={N.shadow} opacity={0.3} />
      <rect x={-TRAY.w / 2} y={-6} width={TRAY.w} height={22} rx={11} fill={N.woodLight} />
      <rect x={-TRAY.w / 2} y={6} width={TRAY.w} height={10} rx={5} fill={N.woodDark} opacity={0.6} />
      <g transform="translate(0 -6)">{children}</g>
    </g>
  )
}

/** A coral "− 3" written under one side of the working. */
function MinusPill({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-58} y={-34} width={116} height={68} rx={22} fill={N.coral} />
      <rect x={-58} y={18} width={116} height={16} rx={8} fill={N.shadow} opacity={0.18} />
      <text y={17} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={50} fill={N.night0}>
        − 3
      </text>
    </g>
  )
}

export function Ch4Balance({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints, memory }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const [guess] = useState(() => readGuess(memory.guess))
  const [bal, setBal] = useState<Balance>(START)
  const [solvedBal, setSolvedBal] = useState<Balance>(SOLVED)
  const [done, setDone] = useState(false)
  const myTurn = cueIndex === 4 && !done
  const wasLevel = useRef(true)
  const told = useRef({ tipped: 0, level: 0, sack: 0 })
  const talking = useRef(false)
  const cueRef = useRef(cueIndex)
  cueRef.current = cueIndex
  const guessSaid = useRef(false)

  const dist = guess === undefined ? undefined : Math.abs(guess - X)
  const closeness = dist === undefined ? null : dist === 0 ? CLOSENESS.exact : dist <= 2 ? CLOSENESS.close : CLOSENESS.far

  const build = useCallback((tl: gsap.core.Timeline) => {
    const scaleEl = root.current?.querySelector('.c4-scale') ?? null
    const tilt = { deg: 0 }
    const tiltTo = (from: number, to: number, at: number, dur = 0.9, ease = 'elastic.out(1, 0.4)') =>
      tl.fromTo(tilt, { deg: from }, { deg: to, duration: dur, ease, immediateRender: false, onUpdate: () => tiltScale(scaleEl, tilt.deg) }, at)
    /** Turns one equation tile over into another, like a flip card. */
    const flip = (out: string, inn: string, x: number, at: number) => {
      tl.to(out, { scaleY: 0, duration: 0.14, ease: 'power2.in', svgOrigin: `${x} ${EQ.y}` }, at)
      tl.to(inn, { scaleY: 1, duration: 0.36, ease: 'back.out(2.4)', svgOrigin: `${x} ${EQ.y}` }, at + 0.14)
    }
    /** Lifts something along an arc to (x, y), relative to where it is drawn. */
    const arc = (sel: string, x: number, y: number, fromY: number, at: number, lift = 130) => {
      tl.to(sel, { x, duration: 1.0, ease: 'power1.inOut' }, at)
      tl.to(sel, { y: Math.min(fromY, y) - lift, duration: 0.45, ease: 'power2.out' }, at)
      tl.to(sel, { y, duration: 0.55, ease: 'power2.in' }, at + 0.45)
    }
    /** A teal ring that spreads from the pivot: "still level". */
    const levelPing = (at: number) => {
      tl.set('.c4-ring', { opacity: 0.95, scale: 0.4, svgOrigin: `${BP.x} ${PIVOT_Y}` }, at)
      tl.to('.c4-ring', { opacity: 0, scale: 2.8, duration: 1.1, ease: 'power2.out' }, at)
      tl.to('.c4-guide-hi', { opacity: 1, duration: 0.3, ease: 'power1.out' }, at)
      tl.to('.c4-guide-hi', { opacity: 0, duration: 0.8, ease: 'power1.in' }, at + 0.5)
    }
    // The left and right weights that hop to the trays in cue 4, in pan coordinates.
    const toTray = (side: 'l' | 'r', [wx, wy]: [number, number]) => ({
      x: ((side === 'l' ? BP.x - TRAY.dx - PAN.lx : BP.x + TRAY.dx - PAN.rx) / BP.s) - wx,
      y: (TRAY.itemY - PAN.y) / BP.s - wy,
    })
    const lHop = toTray('l', L0.weights[2])
    const rHop = toTray('r', R0.weights[10])

    // Start: only the giant equals sign. Everything else is waiting in the wings.
    tl.set('.c4-bp', { opacity: 0 })
    tl.set('.c4-solved', { opacity: 0 })
    tl.set('.c4-scalewrap', { opacity: 0, scale: 0.9, svgOrigin: `${BP.x} ${PIVOT_Y}` })
    tl.set('.c4-ledge', { opacity: 0, y: 160 })
    tl.set(['.c4-lload', '.c4-rload'], { y: -380, opacity: 0 })
    tl.set('.c4-extra', { y: -560, opacity: 0 })
    tl.set('.c4-guide', { opacity: 0, scaleX: 0.55, svgOrigin: `${BP.x} ${PIVOT_Y}` })
    tl.set(['.c4-guide-hi', '.c4-ring', '.c4-lvlglow', '.c4-tipglow', '.c4-pg-l', '.c4-pg-r', '.c4-eqhl-l', '.c4-eqhl-r'], { opacity: 0 })
    tl.set('.c4-trays', { opacity: 0, y: 40 })
    tl.set('.c4-t-eq', { opacity: 0 })
    tl.set(['.c4-t-a4', '.c4-t-a2'], { scaleY: 0, svgOrigin: `${SA} ${EQ.y}` })
    tl.set('.c4-t-neq', { scaleY: 0, svgOrigin: `${SEQ} ${EQ.y}` })
    tl.set('.c4-t-b10', { scaleY: 0, svgOrigin: `${SB} ${EQ.y}` })
    const flyFrom = (sel: string, slot: number, from: { x: number; y: number }) =>
      tl.set(sel, { x: from.x - slot, y: from.y - EQ.y, scale: 0.35, opacity: 0, svgOrigin: `${slot} ${EQ.y}` })
    flyFrom('.c4-fly-x', SX, { x: PAN.lx + L0.sacks[0][0] * BP.s, y: PAN.y - 40 })
    flyFrom('.c4-fly-plus', SPLUS, { x: PAN.lx + L0.weights[0][0] * BP.s, y: PAN.y - 24 })
    flyFrom('.c4-fly-a', SA, { x: PAN.lx + L0.weights[1][0] * BP.s, y: PAN.y - 24 })
    flyFrom('.c4-fly-b', SB, { x: PAN.rx, y: PAN.y - 50 })
    tl.set('.c4-big-body', { opacity: 1, scale: 1, svgOrigin: '800 450' })
    tl.set(['.c4-bar1', '.c4-bar2'], { opacity: 0 })
    tl.set('.c4-bar1', { attr: BAR1 })
    tl.set('.c4-bar2', { attr: BAR2 })
    tl.set(['.c4-rule-label', '.c4-rule1', '.c4-rule2'], { opacity: 0, y: 24 })
    tl.set('.c4-work', { opacity: 0 })
    tl.set(['.c4-w1', '.c4-w2', '.c4-w3'], { opacity: 0, scale: 0.4, transformOrigin: '50% 50%' })
    tl.set('.c4-wrule', { scaleX: 0, svgOrigin: `${WK.x} ${WK.rule}` })
    tl.set(['.c4-wsame', '.c4-wbox', '.c4-hl-sack', '.c4-hl-eight', '.c4-hl-trays', '.c4-s-eqglow'], { opacity: 0 })
    tl.set('.c4-slate', { opacity: 0, y: 460 })
    tl.set('.c4-scrim', { opacity: 0 })
    tl.set('.c4-guess', { opacity: 0, x: guess === undefined ? 0 : NL.x0 - 110 - nx(guess) })
    tl.set('.c4-true', { opacity: 0, y: -320 })
    tl.set('.c4-bracket', { strokeDashoffset: 1 })
    tl.set(['.c4-dist', '.c4-spot'], { opacity: 0 })

    // 0. Chapter 3's equals sign fills the screen, then becomes the scale: its top bar the beam, its bottom bar the "=" below.
    tl.addLabel('b0', 0)
    tl.fromTo('.c4-big', { scale: 0.92, svgOrigin: '800 450' }, { scale: 1, duration: 1.7, ease: 'power2.out' }, 0)
    tl.fromTo('.c4-big-pulse', { opacity: 0.6 }, { opacity: 1, duration: 0.8, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0.2)
    tl.to('.c4-big-body', { opacity: 0, scale: 1.35, duration: 0.7, ease: 'power2.in' }, 1.7)
    tl.to('.c4-big-bars', { opacity: 0, duration: 0.35 }, 1.75)
    tl.to(['.c4-bar1', '.c4-bar2'], { opacity: 1, duration: 0.35 }, 1.75)
    tl.to('.c4-bar1', { attr: BEAM, duration: 1.0, ease: 'power3.inOut' }, 2.05)
    tl.to('.c4-bar2', { attr: EQ_TILE, duration: 1.0, ease: 'power3.inOut' }, 2.05)
    tl.to('.c4-ledge', { opacity: 1, y: 0, duration: 1.0, ease: 'power3.out' }, 2.3)
    tl.to('.c4-scalewrap', { opacity: 1, scale: 1, duration: 0.8, ease: 'back.out(1.5)' }, 2.75)
    tl.to('.c4-bar1', { opacity: 0, duration: 0.5 }, 3.05)
    tl.to('.c4-guide', { opacity: 1, scaleX: 1, duration: 0.8, ease: 'power2.out' }, 3.05)
    tl.to('.c4-t-eq', { opacity: 1, duration: 0.25 }, 3.05)
    tl.to('.c4-bar2', { opacity: 0, duration: 0.3 }, 3.15)
    // Both sides load at the same moment, so the beam never moves.
    tl.to(['.c4-lload', '.c4-rload'], { y: 0, opacity: 1, duration: 0.75, ease: 'bounce.out' }, 3.25)
    // What is on each pan becomes the matching side of the equation.
    ;['.c4-fly-x', '.c4-fly-plus', '.c4-fly-a', '.c4-fly-b'].forEach((sel, i) =>
      tl.to(sel, { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.7, ease: 'power3.inOut' }, 4.0 + i * 0.09),
    )
    tl.to('.c4-lvlglow', { opacity: 1, duration: 0.8 }, 4.8)
    levelPing(4.9)

    // 1. One extra weight on the left only: the scale tips and the equation turns false. Then it's lifted off.
    const b1 = 6.0
    tl.addLabel('b1', b1)
    tl.fromTo('.c4-push', { scale: 1, svgOrigin: '800 560' }, { scale: 1.07, duration: 2.4, ease: 'sine.inOut' }, b1)
    tl.set('.c4-extra', { opacity: 1 }, b1 + 1.5)
    tl.to('.c4-extra', { y: 0, duration: 0.8, ease: 'bounce.out' }, b1 + 1.5)
    tiltTo(0, tiltFor(-1), b1 + 1.8, 1.1, 'elastic.out(1.1, 0.32)')
    flip('.c4-t-a3', '.c4-t-a4', SA, b1 + 1.8)
    flip('.c4-t-eq-on', '.c4-t-neq', SEQ, b1 + 1.9)
    tl.to('.c4-lvlglow', { opacity: 0.25, duration: 0.5 }, b1 + 1.8)
    tl.to('.c4-tipglow', { opacity: 1, duration: 0.5 }, b1 + 1.9)
    tl.to('.c4-eqslot', { scale: 1.28, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out', svgOrigin: `${SEQ} ${EQ.y}` }, b1 + 4.3)

    // 2. The extra weight is lifted off again, then the golden rule: one side lights up, then the other.
    const b2 = b1 + 6.3
    tl.addLabel('b2', b2)
    tl.to('.c4-extra', { y: -300, opacity: 0, duration: 0.7, ease: 'power2.in' }, b2)
    tiltTo(tiltFor(-1), 0, b2 + 0.2, 1.0, 'elastic.out(1, 0.45)')
    flip('.c4-t-a4', '.c4-t-a3', SA, b2 + 0.25)
    flip('.c4-t-neq', '.c4-t-eq-on', SEQ, b2 + 0.35)
    tl.to('.c4-tipglow', { opacity: 0, duration: 0.5 }, b2 + 0.2)
    tl.to('.c4-lvlglow', { opacity: 1, duration: 0.6 }, b2 + 0.3)
    tl.to('.c4-push', { scale: 1, duration: 1.2, ease: 'sine.inOut' }, b2)
    tl.to('.c4-rule-label', { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, b2 + 1.0)
    tl.to('.c4-rule1', { opacity: 1, y: 0, duration: 0.6, ease: 'back.out(1.8)' }, b2 + 2.3)
    tl.to(['.c4-pg-l', '.c4-eqhl-l'], { opacity: 1, duration: 0.5 }, b2 + 2.5)
    tl.to(['.c4-pg-l', '.c4-eqhl-l'], { opacity: 0, duration: 0.5 }, b2 + 4.4)
    tl.to('.c4-rule1', { opacity: 0.55, duration: 0.5 }, b2 + 4.4)
    tl.to('.c4-rule2', { opacity: 1, y: 0, duration: 0.6, ease: 'back.out(1.8)' }, b2 + 4.6)
    tl.to(['.c4-pg-r', '.c4-eqhl-r'], { opacity: 1, duration: 0.5 }, b2 + 4.8)
    tl.to('.c4-rule1', { opacity: 1, duration: 0.5 }, b2 + 6.0)
    tl.to(['.c4-pg-l', '.c4-eqhl-l'], { opacity: 1, duration: 0.5 }, b2 + 6.0)
    tl.to(['.c4-pg-l', '.c4-pg-r', '.c4-eqhl-l', '.c4-eqhl-r'], { opacity: 0, duration: 0.6 }, b2 + 6.7)

    // 3. One weight off each side at once (still level), then one back on each side (still level).
    const b3 = b2 + 7.4
    tl.addLabel('b3', b3)
    tl.to('.c4-trays', { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, b3)
    tl.to(['.c4-pg-l', '.c4-pg-r'], { opacity: 0.7, duration: 0.3, yoyo: true, repeat: 1 }, b3 + 0.6)
    arc('.c4-lw2', lHop.x, lHop.y, 0, b3 + 0.6)
    arc('.c4-rw10', rHop.x, rHop.y, 0, b3 + 0.6)
    flip('.c4-t-a3', '.c4-t-a2', SA, b3 + 1.6)
    flip('.c4-t-b11', '.c4-t-b10', SB, b3 + 1.6)
    levelPing(b3 + 2.6)
    tl.to(['.c4-pg-l', '.c4-pg-r'], { opacity: 0.7, duration: 0.3, yoyo: true, repeat: 1 }, b3 + 4.1)
    arc('.c4-lw2', 0, 0, lHop.y, b3 + 4.1)
    arc('.c4-rw10', 0, 0, rHop.y, b3 + 4.1)
    flip('.c4-t-a2', '.c4-t-a3', SA, b3 + 5.1)
    flip('.c4-t-b10', '.c4-t-b11', SB, b3 + 5.1)
    levelPing(b3 + 6.3)

    // 4. The learner's turn: the same picture, now the playable scale (same place, same contents).
    const b4 = b3 + 7.6
    tl.addLabel('b4', b4)
    tl.set('.c4-mine', { opacity: 0 }, b4 + 0.01)
    tl.set('.c4-bp', { opacity: 1 }, b4 + 0.01)
    tl.to(['.c4-rule-label', '.c4-rule1', '.c4-rule2'], { opacity: 0.8, duration: 0.6 }, b4 + 0.1)

    // 5. Eight! The camera moves the scale aside and the working is written out next to it.
    const b5 = b4 + 0.8
    tl.addLabel('b5', b5)
    tl.set('.c4-bp', { opacity: 0 }, b5 + 0.01)
    tl.set('.c4-solved', { opacity: 1 }, b5 + 0.01)
    tl.to('.c4-s-eqglow', { opacity: 1, duration: 0.3, yoyo: true, repeat: 1, ease: 'sine.inOut' }, b5 + 0.05)
    tl.to('.c4-s-eqpop', { scale: 1.2, duration: 0.3, yoyo: true, repeat: 1, ease: 'power2.out', svgOrigin: `${BP.x} ${EQ.y}` }, b5 + 0.05)
    tl.to(['.c4-rule-label', '.c4-rule1', '.c4-rule2'], { opacity: 0, y: -30, duration: 0.6, ease: 'power2.in' }, b5 + 0.2)
    tl.fromTo('.c4-cam6', { scale: 1, x: 0, y: 0, svgOrigin: '800 640' }, { scale: 0.78, x: -300, y: 0, duration: 1.5, ease: 'power3.inOut' }, b5 + 0.6)
    tl.to('.c4-s-eq', { opacity: 0, duration: 0.5 }, b5 + 1.0)
    tl.to('.c4-work', { opacity: 1, duration: 0.6 }, b5 + 1.2)
    tl.to('.c4-w1', { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)', stagger: 0.08 }, b5 + 1.5)
    tl.to('.c4-hl-sack', { opacity: 1, duration: 0.5 }, b5 + 2.0)
    tl.to('.c4-hl-eight', { opacity: 1, duration: 0.5 }, b5 + 2.5)
    tl.to(['.c4-hl-sack', '.c4-hl-eight'], { opacity: 0, duration: 0.6 }, b5 + 3.5)
    tl.to('.c4-hl-trays', { opacity: 1, duration: 0.4 }, b5 + 3.7)
    tl.to('.c4-w2', { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2.2)', stagger: 0.18 }, b5 + 3.8)
    tl.to('.c4-hl-trays', { opacity: 0, duration: 0.6 }, b5 + 5.0)
    tl.to('.c4-wrule', { scaleX: 1, duration: 0.5, ease: 'power2.out' }, b5 + 5.0)
    tl.to('.c4-w3', { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)', stagger: 0.1 }, b5 + 5.4)
    tl.to('.c4-wsame', { opacity: 1, duration: 0.4 }, b5 + 6.3)
    tl.to('.c4-w2', { scale: 1.12, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out' }, b5 + 6.4)
    tl.to('.c4-wbox', { opacity: 1, duration: 0.6 }, b5 + 7.2)

    // 6. Back to the market guess: the picture steps back and the number line rises in front.
    const b6 = b5 + 8.4
    tl.addLabel('b6', b6)
    tl.to('.c4-wsame', { opacity: 0, duration: 0.4 }, b6)
    tl.fromTo('.c4-cam7', { scale: 1, y: 0, svgOrigin: '800 130' }, { scale: 0.6, y: -70, duration: 1.4, ease: 'power3.inOut' }, b6)
    tl.to('.c4-scrim', { opacity: 0.74, duration: 1.2, ease: 'power1.inOut' }, b6 + 0.1)
    tl.to('.c4-far', { y: -40, duration: 1.4, ease: 'power3.inOut' }, b6)
    tl.to('.c4-slate', { opacity: 1, y: 0, duration: 1.1, ease: 'back.out(1.2)' }, b6 + 0.4)
    tl.to('.c4-guess', { opacity: 1, x: 0, duration: 1.0, ease: 'power3.out' }, b6 + 1.5)
    tl.to('.c4-true', { opacity: 1, y: 0, duration: 0.8, ease: 'bounce.out' }, b6 + 2.6)
    tl.to('.c4-bracket', { strokeDashoffset: 0, duration: 0.8, ease: 'power1.inOut' }, b6 + 3.5)
    tl.to(['.c4-dist', '.c4-spot'], { opacity: 1, duration: 0.5 }, b6 + 4.1)
    tl.addLabel('b7', b6 + 5.6)
    // The timeline is built once, when the chapter mounts; the guess is read then too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cue 7 ends with one line about the guess. Saying it before reporting the animation done keeps the flow waiting for it.
  const animDone = useCallback(() => {
    if (cueRef.current === 6 && closeness && !guessSaid.current) {
      guessSaid.current = true
      void say(closeness)
    }
    onAnimDone()
  }, [closeness, say, onAnimDone])

  useBeatTimeline(root, build, cueIndex, playing, animDone)

  // A short line from the world, never two on top of each other.
  const react = useCallback(
    (line: string, force = false) => {
      if (talking.current && !force) return false
      talking.current = true
      void say(line).then(() => {
        talking.current = false
      })
      return true
    },
    [say],
  )

  const onMove = useCallback(
    (b: Balance, move: Move) => {
      setBal(b)
      const level = isLevel(b, X)
      const was = wasLevel.current
      wasLevel.current = level
      const now = equationText(b, X)
      if (move.kind === 'remove' && move.item === 'sack') {
        emit({ type: 'attempt', correct: false, detail: `took the sack off the scale; now ${now}` })
        if (told.current.sack < 1 && react(LINES.sack, true)) {
          told.current.sack++
          return
        }
      } else if (move.kind === 'add' || move.kind === 'remove') {
        emit({ type: 'progress', detail: `${move.kind === 'add' ? 'put' : 'took'} a ${move.item} ${move.kind === 'add' ? 'on' : 'off'} the ${move.side} side; now ${now}` })
      }
      if (was && !level && told.current.tipped < 2) {
        if (react(LINES.tipped)) told.current.tipped++
      } else if (!was && level && !isSolved(b, X) && told.current.level < 2) {
        // Putting the sack back may cut the line asking for it; the fix deserves to be heard.
        if (react(LINES.level, move.kind === 'add' && move.item === 'sack')) told.current.level++
      }
    },
    [emit, react],
  )

  const onSolved = useCallback(
    (b: Balance) => {
      if (cueRef.current !== 4) return
      setDone(true)
      setBal(b)
      setSolvedBal(b)
      emit({ type: 'attempt', correct: true, detail: `the sack is alone and the scale is level: ${equationText(b, X)}` })
      talking.current = true
      void say('The sack is alone, and the scale is still level.')
      onPlayDone()
    },
    [emit, say, onPlayDone],
  )

  // What Pip sees, and hints for the learner's turn.
  useEffect(() => {
    if (cueIndex === 4) {
      const level = isLevel(bal, X)
      reportState(
        `The learner's turn on a playable balance scale. It started as x + 3 = 11: the pink sack and 3 gold weights on the left pan, 11 weights on the right. ` +
          `They lift things off (drag, or tap to send them to the tray beside that pan) and can put them back. The goal is the sack alone on its pan with the scale still level. ` +
          `Right now the pans read ${equationText(bal, X)}, and the scale is ${level ? 'level' : 'tipped'}${done ? '. Solved.' : '.'} ` +
          `The answer is x = 8: take 3 weights off each side. Likely mix-ups: taking weights off one side only (the scale tips), taking 3 off the left but a different number off the right, lifting the sack off, or thinking the answer is 11 or 14.`,
      )
      setHints(HINTS)
    } else if (cueIndex === 6) {
      reportState(
        `A number line from 0 to 15 in front of the solved scale. ` +
          (guess === undefined
            ? 'The learner skipped the guess at the market in chapter 1, so only the gold marker for the true value, 8, is shown.'
            : `The pink sack marker is the learner's guess from the market in chapter 1: ${guess}. A gold 8 marker lands on the true value, 8, ${dist ? `and a teal bracket shows they were ${dist} away.` : 'right on top of their guess: they were exactly right.'}`),
      )
    } else {
      reportState(STATE[cueIndex] ?? '')
    }
  }, [cueIndex, bal, done, guess, dist, reportState, setHints])

  // The solved scale for cue 6: whatever the learner ended with on the pans, with the spare weights on the trays.
  const sackLeft = solvedBal.left.sacks === 1
  const sL = panSpots(solvedBal.left.sacks, solvedBal.left.weights)
  const sR = panSpots(solvedBal.right.sacks, solvedBal.right.weights)
  const spare = Math.max(0, START.left.weights + START.right.weights - solvedBal.left.weights - solvedBal.right.weights)
  const sTrayL = traySpots(Math.ceil(spare / 2))
  const sTrayR = traySpots(Math.floor(spare / 2))
  const pans = (side: 'left' | 'right', spots: ReturnType<typeof panSpots>) => (
    <>
      {spots.sacks.map(([x, y], i) => (
        <Sack key={`s${i}`} x={x} y={y} s={0.8} tutor="the sack" />
      ))}
      {spots.weights.map(([x, y], i) => (
        <Weight key={`w${i}`} x={x} y={y} s={0.9} tutor={side === (sackLeft ? 'right' : 'left') ? 'the 8 weights' : 'a weight'} />
      ))}
    </>
  )

  const leftSpan = { l: SX - tileW('x', 'x') / 2 - 12, r: SA + tileW('3', 'num') / 2 + 7 }
  const rightSpan = { l: SB - tileW('11', 'num') / 2 - 7, r: SB + tileW('11', 'num') / 2 + 12 }
  const eqH = EQ.size * 1.3 + 22
  const minusL = (WPLUS - tileW('+', 'op', WK.size) / 2 + WA + tileW('3', 'num', WK.size) / 2) / 2
  const trueY = guess === X ? NL.y - 6 - 0.55 * 110 - 8 - 44 * 0.65 : NL.y - 6 - 44 * 0.65

  return (
    <g ref={root}>
      <defs>
        {/* "Not equal" light for the side that sinks. The kit has no coral glow, so it lives here. */}
        <radialGradient id="c4-coral-glow">
          <stop offset="0" stopColor={N.coralLight} stopOpacity="0.55" />
          <stop offset="0.45" stopColor={N.coral} stopOpacity="0.22" />
          <stop offset="1" stopColor={N.coral} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Far away: the night sky over Baghdad */}
      <g className="c4-far" pointerEvents="none">
        <Backdrop kind="deep">
          <Stars h={1000} count={120} seed={44} y={-80} />
        </Backdrop>
        <Moon x={1420} y={130} r={36} />
        <g opacity={0.6}>
          <Skyline y={650} seed={31} color={N.night2} windowColor={N.sandLight} windows={0.12} scale={0.6} />
        </g>
        <Glow x={BP.x} y={PIVOT_Y + 60} r={520} color="violet" opacity={0.35} />
      </g>

      <g className="c4-cam7">
        <g className="c4-cam6">
          <g className="c4-push">
            {/* The table the scale stands on */}
            <g className="c4-ledge" pointerEvents="none">
              <path d="M-1400 626 H3000 V664 H-1400 Z" fill={N.night2} />
              <rect x={-1400} y={662} width={4400} height={1600} fill={N.night1} />
              <rect x={-1400} y={662} width={4400} height={5} fill={N.night3} />
              <ellipse cx={BP.x} cy={646} rx={420} ry={22} fill={N.teal} opacity={0.08} />
              {Array.from({ length: 27 }, (_, i) => (
                <g key={i} transform={`translate(${-500 + i * 120} 860)`} opacity={0.5}>
                  <rect x={-22} y={-22} width={44} height={44} fill="none" stroke={N.night3} strokeWidth={4} />
                  <rect x={-22} y={-22} width={44} height={44} fill="none" stroke={N.night3} strokeWidth={4} transform="rotate(45)" />
                  <circle r={7} fill={N.night3} />
                </g>
              ))}
              <rect x={-1400} y={818} width={4400} height={4} fill={N.night2} />
            </g>

            {/* The level line: a dashed teal guide the beam lines up with while it is level */}
            <g className="c4-guide" pointerEvents="none">
              <line x1={BP.x - 380} y1={PIVOT_Y} x2={BP.x + 380} y2={PIVOT_Y} stroke={N.teal} strokeWidth={4} strokeDasharray="16 12" strokeLinecap="round" opacity={0.55} />
            </g>
            <g className="c4-guide-hi" pointerEvents="none">
              <line x1={BP.x - 380} y1={PIVOT_Y} x2={BP.x + 380} y2={PIVOT_Y} stroke={N.tealLight} strokeWidth={6} strokeDasharray="16 12" strokeLinecap="round" filter="url(#fx-glow)" />
            </g>

            {/* My drawn scale for cues 1 to 4. It matches the playable one exactly by the end of cue 4. */}
            <g className="c4-mine" pointerEvents="none">
              <g className="c4-lvlglow">
                <Glow x={BP.x} y={PIVOT_Y} r={300 * BP.s} color="teal" opacity={0.55} />
              </g>
              <g className="c4-tipglow">
                <circle cx={PAN.lx} cy={PAN.y + 6} r={200} fill="url(#c4-coral-glow)" />
              </g>
              {[
                ['c4-pg-l', PAN.lx],
                ['c4-pg-r', PAN.rx],
              ].map(([cls, px]) => (
                <g key={cls} className={cls as string}>
                  <Glow x={px as number} y={PAN.y - 40} r={240} color="cool" opacity={1} />
                  <rect x={(px as number) - 150} y={PAN.y - 132} width={300} height={186} rx={40} fill={N.sky} fillOpacity={0.1} stroke={N.skyLight} strokeWidth={4} />
                </g>
              ))}
              <g className="c4-trays">
                <Tray x={BP.x - TRAY.dx} tutor="the left tray" />
                <Tray x={BP.x + TRAY.dx} tutor="the right tray" />
              </g>
              <g className="c4-scalewrap">
                <g transform={`translate(${BP.x} ${BP.y}) scale(${BP.s})`}>
                  <Scale
                    className="c4-scale"
                    tutor="the balance scale"
                    left={
                      <>
                        <g className="c4-lload">
                          <g className="c4-lsack">
                            <Sack x={L0.sacks[0][0]} s={0.8} tutor="the sack" />
                          </g>
                          {L0.weights.map(([x, y], i) => (
                            <g key={i} className={`c4-lw${i}`}>
                              <Weight x={x} y={y} s={0.9} tutor="the weights next to the sack" />
                            </g>
                          ))}
                        </g>
                        <g className="c4-extra">
                          <Weight x={L0.weights[1][0]} y={-50} s={0.9} tutor="the extra weight" />
                        </g>
                      </>
                    }
                    right={
                      <g className="c4-rload">
                        {R0.weights.map(([x, y], i) => (
                          <g key={i} className={`c4-rw${i}`}>
                            <Weight x={x} y={y} s={0.9} tutor="the 11 weights" />
                          </g>
                        ))}
                      </g>
                    }
                  />
                </g>
              </g>

              {/* The equation under it, one tile at a time so single tiles can turn over */}
              <g data-tutor="the equation">
                <g className="c4-eqhl-l">
                  <rect x={leftSpan.l} y={EQ.y - eqH / 2} width={leftSpan.r - leftSpan.l} height={eqH} rx={30} fill={N.sky} fillOpacity={0.12} stroke={N.skyLight} strokeWidth={4} />
                </g>
                <g className="c4-eqhl-r">
                  <rect x={rightSpan.l} y={EQ.y - eqH / 2} width={rightSpan.r - rightSpan.l} height={eqH} rx={30} fill={N.sky} fillOpacity={0.12} stroke={N.skyLight} strokeWidth={4} />
                </g>
                <g className="c4-fly-x">
                  <Tile t="x" k="x" x={SX} />
                </g>
                <g className="c4-fly-plus">
                  <Tile t="+" k="op" x={SPLUS} />
                </g>
                <g className="c4-fly-a">
                  <g className="c4-t-a3">
                    <Tile t="3" k="num" x={SA} />
                  </g>
                  <g className="c4-t-a4">
                    <Tile t="4" k="num" x={SA} />
                  </g>
                  <g className="c4-t-a2">
                    <Tile t="2" k="num" x={SA} />
                  </g>
                </g>
                <g className="c4-t-eq">
                  <g className="c4-eqslot">
                    <g className="c4-t-eq-on">
                      <Tile t="=" k="eq" x={SEQ} />
                    </g>
                    <g className="c4-t-neq">
                      <Tile t="≠" k="neq" x={SEQ} />
                    </g>
                  </g>
                </g>
                <g className="c4-fly-b">
                  <g className="c4-t-b11">
                    <Tile t="11" k="num" x={SB} />
                  </g>
                  <g className="c4-t-b10">
                    <Tile t="10" k="num" x={SB} />
                  </g>
                </g>
              </g>
            </g>

            {/* My drawn copy of the solved scale, for cue 6 on */}
            <g className="c4-solved" pointerEvents="none">
              <Glow x={BP.x} y={PIVOT_Y} r={300 * BP.s} color="teal" opacity={0.55} />
              <g className="c4-hl-sack">
                <Glow x={sackLeft ? PAN.lx : PAN.rx} y={PAN.y - 40} r={170} color="pink" opacity={0.9} />
              </g>
              <g className="c4-hl-eight">
                <Glow x={sackLeft ? PAN.rx : PAN.lx} y={PAN.y - 40} r={210} color="warm" opacity={0.75} />
              </g>
              <g className="c4-hl-trays">
                <Glow x={BP.x - TRAY.dx} y={TRAY.itemY - 30} r={150} color="warm" opacity={0.8} />
                <Glow x={BP.x + TRAY.dx} y={TRAY.itemY - 30} r={150} color="warm" opacity={0.8} />
              </g>
              <Tray x={BP.x - TRAY.dx} tutor="the left tray">
                {sTrayL.map((x, i) => (
                  <Weight key={i} x={x} s={0.9} tutor="a weight taken off the left side" />
                ))}
              </Tray>
              <Tray x={BP.x + TRAY.dx} tutor="the right tray">
                {sTrayR.map((x, i) => (
                  <Weight key={i} x={x} s={0.9} tutor="a weight taken off the right side" />
                ))}
              </Tray>
              <g transform={`translate(${BP.x} ${BP.y}) scale(${BP.s})`}>
                <Scale tutor="the balance scale" left={pans('left', sL)} right={pans('right', sR)} />
              </g>
              <g className="c4-s-eq">
                <g className="c4-s-eqglow">
                  <Glow x={BP.x} y={EQ.y} r={260} color="warm" opacity={0.7} />
                </g>
                <g className="c4-s-eqpop">
                  <Equation terms={terms(equationText(solvedBal, X))} x={BP.x} y={EQ.y} size={EQ.size} tutor="the equation" />
                </g>
              </g>
            </g>

            {/* The playable scale. Same key all chapter, so it keeps what the learner did. */}
            <g className="c4-bp">
              <BalancePlay
                key="ch4-play"
                x={BP.x}
                y={BP.y}
                s={BP.s}
                value={X}
                start={START}
                active={myTurn}
                trays
                glow
                equation={{ y: EQ.y, size: EQ.size }}
                onMove={onMove}
                onSolved={onSolved}
                tutor="the balance scale"
              />
            </g>

            <g className="c4-ring" pointerEvents="none">
              <circle cx={BP.x} cy={PIVOT_Y} r={46} fill="none" stroke={N.tealLight} strokeWidth={5} />
            </g>
          </g>
        </g>

        {/* The written working, next to the scale in cue 6 */}
        <g className="c4-work" data-tutor="the written working" pointerEvents="none">
          <rect x={WK.x - 280} y={WK.top} width={560} height={WK.bottom - WK.top} rx={30} fill={N.night0} opacity={0.85} />
          <rect x={WK.x - 280} y={WK.top} width={560} height={WK.bottom - WK.top} rx={30} fill="none" stroke={N.mist} strokeOpacity={0.22} strokeWidth={3} />
          {[
            { t: 'x', k: 'x' as const, x: WX },
            { t: '+', k: 'op' as const, x: WPLUS },
            { t: '3', k: 'num' as const, x: WA },
            { t: '=', k: 'eq' as const, x: WEQ },
            { t: '11', k: 'num' as const, x: WB },
          ].map((p) => (
            <g key={p.t} className="c4-w1">
              <Tile t={p.t} k={p.k} x={p.x} y={WK.y1} size={WK.size} />
            </g>
          ))}
          <g className="c4-wsame">
            <rect x={minusL - 70} y={WK.y2 - 46} width={140} height={92} rx={30} fill="none" stroke={N.tealLight} strokeWidth={4} strokeDasharray="12 9" />
            <rect x={WB - 70} y={WK.y2 - 46} width={140} height={92} rx={30} fill="none" stroke={N.tealLight} strokeWidth={4} strokeDasharray="12 9" />
          </g>
          <g className="c4-w2">
            <MinusPill x={minusL} y={WK.y2} />
          </g>
          <g className="c4-w2">
            <MinusPill x={WB} y={WK.y2} />
          </g>
          <line className="c4-wrule" x1={WK.x - 230} y1={WK.rule} x2={WK.x + 230} y2={WK.rule} stroke={N.mist} strokeWidth={5} strokeLinecap="round" opacity={0.7} />
          <g className="c4-wbox">
            <rect x={WX - 62} y={WK.y3 - 54} width={WB - WX + 124} height={108} rx={34} fill={N.teal} fillOpacity={0.1} stroke={N.teal} strokeWidth={4} />
          </g>
          {[
            { t: 'x', k: 'x' as const, x: WX },
            { t: '=', k: 'eq' as const, x: WEQ },
            { t: '8', k: 'num' as const, x: WB },
          ].map((p) => (
            <g key={p.t} className="c4-w3">
              <Tile t={p.t} k={p.k} x={p.x} y={WK.y3} size={WK.size} />
            </g>
          ))}
        </g>
      </g>

      <rect className="c4-scrim" x={-100} y={-100} width={1800} height={1100} fill={N.space} pointerEvents="none" />

      {/* The golden rule */}
      <g data-tutor="the golden rule" pointerEvents="none">
        <g className="c4-rule-label">
          <Title y={76} size={34} weight={700} color={N.sandLight}>
            The golden rule
          </Title>
        </g>
        <g className="c4-rule1">
          <Title y={146} size={52}>
            Whatever you do to <tspan fill={N.skyLight}>one side</tspan>,
          </Title>
        </g>
        <g className="c4-rule2">
          <Title y={212} size={52}>
            do the same to <tspan fill={N.skyLight}>the other</tspan>.
          </Title>
        </g>
      </g>

      {/* The number line: the guess from the market, and the true value */}
      <g className="c4-slate" data-tutor="the number line" pointerEvents="none">
        {guess !== undefined && (
          <Title y={NL.y - 182} size={44}>
            Your guess at the market
          </Title>
        )}
        <rect x={NL.x0 - 80} y={NL.y - 146} width={NL.step * NL.max + 160} height={310} rx={32} fill={N.night0} opacity={0.94} />
        <rect x={NL.x0 - 80} y={NL.y - 146} width={NL.step * NL.max + 160} height={310} rx={32} fill="none" stroke={N.gold} strokeOpacity={0.35} strokeWidth={3} />
        <line x1={NL.x0} y1={NL.y} x2={nx(NL.max)} y2={NL.y} stroke={N.gold} strokeWidth={5} strokeLinecap="round" />
        {Array.from({ length: NL.max + 1 }, (_, i) => (
          <g key={i}>
            <line x1={nx(i)} y1={NL.y - (i % 5 ? 9 : 15)} x2={nx(i)} y2={NL.y + (i % 5 ? 9 : 15)} stroke={N.gold} strokeWidth={i % 5 ? 3 : 5} strokeLinecap="round" />
            <text x={nx(i)} y={NL.y + 48} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={30} fill={i === X ? N.goldLight : N.gold} opacity={i === X ? 1 : 0.75}>
              {i}
            </text>
          </g>
        ))}
        <path
          className="c4-bracket"
          d={guess !== undefined && guess !== X ? `M${nx(guess)} ${NL.y + 64} V${NL.y + 86} H${nx(X)} V${NL.y + 64}` : `M${nx(X)} ${NL.y + 64} h0.01`}
          pathLength={1}
          strokeDasharray="1 1"
          stroke={N.teal}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          filter="url(#fx-glow)"
          opacity={guess !== undefined && guess !== X ? 1 : 0}
          data-tutor="how far your guess was from 8"
        />
        <g className="c4-dist">
          {dist ? (
            <Title x={(nx(guess ?? X) + nx(X)) / 2} y={NL.y + 132} size={32} weight={700} color={N.mist}>
              {`${dist} away`}
            </Title>
          ) : null}
        </g>
        <g className="c4-spot">
          {dist === 0 && <rect x={nx(X) - 50} y={trueY - 40} width={100} height={NL.y + 4 - (trueY - 40)} rx={28} fill={N.teal} fillOpacity={0.08} stroke={N.tealLight} strokeWidth={5} filter="url(#fx-glow)" />}
        </g>
        <g className="c4-guess">
          {guess !== undefined && (
            <g transform={`translate(${nx(guess)} ${NL.y - 6})`}>
              <Sack s={0.55} tutor="your guess from the market" />
            </g>
          )}
        </g>
        <g className="c4-true" data-tutor="the true value, 8">
          <Glow x={nx(X)} y={trueY} r={80} color="warm" opacity={0.6} />
          <Tile t="8" k="num" x={nx(X)} y={trueY} size={44} />
        </g>
      </g>

      {/* The equals sign from chapter 3, filling the screen as this chapter opens */}
      <g className="c4-big" pointerEvents="none" data-tutor="the equals sign">
        <g className="c4-big-body">
          <g className="c4-big-pulse">
            <Glow x={800} y={450} r={540} color="teal" opacity={0.7} />
          </g>
          <rect x={590} y={228} width={420} height={444} rx={140} fill={N.teal} />
          <rect x={590} y={574} width={420} height={98} rx={49} fill={N.shadow} opacity={0.18} />
          <rect x={626} y={252} width={348} height={54} rx={27} fill={N.white} opacity={0.28} />
        </g>
        <g className="c4-big-bars">
          <rect {...BAR1} fill={N.night0} />
          <rect {...BAR2} fill={N.night0} />
        </g>
      </g>
      <rect className="c4-bar1" {...BAR1} fill={N.tealLight} filter="url(#fx-glow)" pointerEvents="none" />
      <rect className="c4-bar2" {...BAR2} fill={N.tealLight} filter="url(#fx-glow)" pointerEvents="none" />

      <g pointerEvents="none">
        <Motes count={16} seed={41} />
      </g>
      <Vignette />
    </g>
  )
}

export const ch4: Chapter = {
  id: 'balance',
  title: 'Keep it balanced',
  cues: CUES,
  Scene: Ch4Balance,
  enter: { type: 'zoom', x: 800, y: 450 },
}
