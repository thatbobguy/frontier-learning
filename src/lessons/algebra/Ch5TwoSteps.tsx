import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Backdrop, Bloom, Glow, Motes, Stars, Vignette } from '../../art2/fx'
import { FONT2, N } from '../../art2/palette'
import { Equation, SCALE, Sack, Scale, Title, Weight, termWidth, terms, tiltFor, tiltScale, type Term } from '../../art2/props'
import { useBeatTimeline } from '../../engine/useBeatTimeline'
import type { Chapter, ChapterProps, Cue } from '../../flow/types'
import { BalancePlay, equationText, isLevel, isSolved, type Balance, type Move, type Side } from './balance'

export const CUES: Cue[] = [
  { id: 'harder', say: "Let's make it harder. Two identical sacks and one weight balance nine weights." },
  { id: 'undo-one', say: 'First, undo the plus one. Take one weight off each side.', play: true },
  { id: 'share', say: 'Now two sacks balance eight weights. Two equal sacks must share those eight equally.' },
  { id: 'split', say: 'Split both sides into two matching halves. Drag the glowing line down through the scale.', play: true },
  { id: 'four', say: 'One sack balances four weights. x equals 4.' },
  { id: 'order', say: 'Notice the order. You put on socks, then shoes, but you take off shoes first, then socks. Algebra undoes things in reverse order, too. Last on, first off.' },
]

/* ------------------------------------------------------------------ */
/* Lines the scene says                                                 */
/* ------------------------------------------------------------------ */

const UNDO_LINE = 'Two sacks against eight weights, still level.'
const SPLIT_LINE = 'Each sack balances four weights.'
const SACK_LINE = 'Leave the sacks on for now. This step only undoes the plus one.'
const TIP_LINES = ["The scale tipped. The two sides aren't equal anymore.", 'Still tipped. Whatever you take from one side, take from the other.']
const BLOCKED: Record<'tipped' | 'not-ready', string> = {
  tipped: 'The scale is tipped. Make it level first, then split.',
  'not-ready': 'Splitting works once the sacks are alone on their side.',
}

const HINTS_UNDO = [
  'Find the plus one on the scale. Which weight is it?',
  'Whatever you take off one side, take the same off the other side, or the scale tips.',
  'One weight off the left pan, one weight off the right pan. Keep both sacks on.',
]
const HINTS_SPLIT = [
  'Two equal sacks share the weights on the other side fairly. What does fair sharing between two look like?',
  'Grab the glowing circle above the scale and pull it all the way down through the beam.',
  'If the scale is tipped, put things back on the pans until it is level, then split.',
]

const STATE: string[] = [
  'A new brass balance scale on a dark stage. Two pink mystery sacks and one gold weight drop onto the left pan, nine gold weights onto the right pan, and the scale ends level. Under it the equation 2x + 1 = 9 writes itself, tile by tile. Each sack secretly weighs 4.',
  '',
  'The scale holds 2 sacks on the left and 8 weights on the right, level, and the equation 2x = 8 glows. Pink halos mark the two equal sacks; faint dashed lines down the middle of each pan hint at splitting both sides into two equal halves (1 sack and 4 weights each). The answer is x = 4. A likely mix-up is thinking each sack is 8, or halving only one side.',
  '',
  'The scale slides left: one sack alone balances four weights. Beside it the worked solution stacks up: 2x + 1 = 9; minus 1 on both sides gives 2x = 8; divide both sides by 2 gives x = 4. The answer x = 4 glows.',
  'A cartoon foot puts on a sock, then a shoe (arrows forward), then takes the shoe off first, then the sock (arrows backward). Below, two number machines, times 2 then plus 1, take x = 4 forward to 9. Then their screens flip to minus 1 and divide by 2, and the number runs back in reverse order, 9 to 8 to 4, landing on x = 4. Last on, first off: undo the last step first.',
]

/* ------------------------------------------------------------------ */
/* Layout                                                               */
/* ------------------------------------------------------------------ */

/** What one sack weighs. */
const X = 4
/** The scale's base and size, the same for the picture and the playable scale. */
const SC = { x: 800, y: 640, s: 0.85 }
/** The middle of each pan's top when the scale is level. */
const PAN = { l: SC.x - SCALE.L * SC.s, r: SC.x + SCALE.L * SC.s, y: SC.y + SC.s * (-SCALE.H + SCALE.DROP - 7) }
const EQ = { x: 800, y: 790, size: 56 }
/** Where the splitting line's handle rests. */
const KNIFE = { x: SC.x, y: SC.y - (SCALE.H + 120) * SC.s }

const START: Balance = { left: { sacks: 2, weights: 1 }, right: { sacks: 0, weights: 9 } }
const AFTER_ONE: Balance = { left: { sacks: 2, weights: 0 }, right: { sacks: 0, weights: 8 } }
const SOLVED: Balance = { left: { sacks: 1, weights: 0 }, right: { sacks: 0, weights: 4 } }
const same = (a: Balance, b: Balance) => a.left.sacks === b.left.sacks && a.left.weights === b.left.weights && a.right.sacks === b.right.sacks && a.right.weights === b.right.weights
/** Opening the chapter part-way through starts the scale where the story has got to. */
const startFor = (cue: number) => (cue >= 4 ? SOLVED : cue >= 2 ? AFTER_ONE : START)

/* The picture of the full scale in cue 1 sits exactly where BalancePlay draws the same things. */
const D_SACKS = [-69, 15]
const D_ONE = 111
const D_NINE: [number, number][] = [...[0, 1, 2, 3, 4, 5].map((c): [number, number] => [(c - 2.5) * 46, 0]), ...[0, 1, 2].map((c): [number, number] => [(c - 1) * 46, -50])]
const TRAY_W = 230
const TRAY_DX = 600

/** Centres and widths of a row of tiles, as <Equation> lays them out. */
function rowLayout(ts: Term[], size: number, gap = 16) {
  const widths = ts.map((t) => termWidth(t, size))
  const total = widths.reduce((a, b) => a + b, 0) + gap * (ts.length - 1)
  let cx = -total / 2
  const centres = widths.map((w) => {
    const c = cx + w / 2
    cx += w + gap
    return c
  })
  return { widths, centres }
}

/** Cue 1's equation, tile by tile, so each tile can arrive with what it stands for. */
const EQ1 = terms('2x + 1 = 9')
const EQ1_AT = rowLayout(EQ1, EQ.size).centres.map((c) => EQ.x + c)

/* The worked solution, lined up on its equals signs. */
const STACK_EQ_X = 1250
function stackRow(src: string, y: number, size: number) {
  const ts = terms(src)
  const { widths, centres } = rowLayout(ts, size)
  const e = ts.findIndex((t) => t.k === 'eq')
  const x = STACK_EQ_X - centres[e]
  const span = (a: number, b: number) => x + (centres[a] - widths[a] / 2 + centres[b] + widths[b] / 2) / 2
  return { src, y, size, x, left: span(0, e - 1), right: span(e + 1, ts.length - 1) }
}
const ROW_A = stackRow('2x + 1 = 9', 250, 52)
const ROW_B = stackRow('2x = 8', 400, 52)
const ROW_C = stackRow('x = 4', 552, 60)

/* The order scene: the foot's stops above, the number machines below, lined up. */
/** The foot's axis at each stop (its toes reach further right, so the foot looks centred on 345, 800, 1255). */
const FOOT_AT = [313, 768, 1223]
const FOOT_Y = 262
const FOOT_S = 0.85
const PANEL = { x: 225, y: 56, w: 1150, h: 236 }
const STOP = [330, 800, 1270]
const MACH = [565, 1035]
const MACH_Y = 450
const TOKEN_Y = MACH_Y + 30
const ARROW = { f: 148, b: 205 }
/** The order camera starts pushed in on the foot, pulls back, then creeps in on (800, 450) for chapter 6. */
const OCAM = { ox: 800, oy: 175, push: 1.3, endScale: 1.08 }

/* ------------------------------------------------------------------ */
/* Local art                                                            */
/* ------------------------------------------------------------------ */

function Tray({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cy={10} rx={TRAY_W / 2 + 10} ry={16} fill={N.shadow} opacity={0.3} />
      <rect x={-TRAY_W / 2} y={-6} width={TRAY_W} height={22} rx={11} fill={N.woodLight} />
      <rect x={-TRAY_W / 2} y={6} width={TRAY_W} height={10} rx={5} fill={N.woodDark} opacity={0.6} />
    </g>
  )
}

/** A lower leg and bare foot, side on, toes to the right; the sole's middle under the ankle is (0, 0). */
function FootArt() {
  return (
    <g>
      {/* rolled-up trouser leg */}
      <path d="M-46 -222 H46 L43 -170 H-43 Z" fill={N.stone} />
      <path d="M14 -222 H46 L43 -170 H18 Z" fill={N.stoneDark} opacity={0.7} />
      <rect x={-50} y={-186} width={100} height={26} rx={11} fill={N.stoneLight} />
      {/* leg and foot */}
      <path d="M-30 -164 H30 V-66 Q34 -46 64 -38 L104 -28 Q132 -20 132 -6 Q132 0 120 0 H-40 Q-58 0 -58 -20 Q-58 -46 -30 -60 Z" fill={N.skin1} />
      <rect x={12} y={-164} width={18} height={100} fill={N.skin1Dark} opacity={0.45} />
      <path d="M-56 -12 Q-50 0 -40 0 H120 Q132 0 132 -6 Q90 -9 -56 -12 Z" fill={N.skin1Dark} />
      <circle cx={-2} cy={-68} r={8} fill={N.skin1Dark} opacity={0.35} />
      {/* toes */}
      <circle cx={121} cy={-12} r={11} fill={N.skin1} />
      <circle cx={104} cy={-24} r={9} fill={N.skin1} />
      <circle cx={89} cy={-30} r={8} fill={N.skin1} />
      <ellipse cx={127} cy={-16} rx={4} ry={3} fill={N.cream} opacity={0.7} />
      <path d="M96 -10 q8 4 16 0" stroke={N.skin1Dark} strokeWidth={3} fill="none" strokeLinecap="round" />
    </g>
  )
}

function SockArt() {
  return (
    <g>
      <path d="M-35 -134 H35 V-66 Q39 -44 66 -36 L106 -26 Q138 -18 138 -5 Q138 6 122 6 H-42 Q-64 6 -64 -20 Q-64 -50 -35 -64 Z" fill={N.sky} />
      <path d="M-64 -20 Q-64 -48 -40 -60 Q-28 -30 -40 6 Q-64 6 -64 -20 Z" fill={N.skyDark} />
      <path d="M138 -5 Q138 -18 108 -27 Q98 -8 110 6 H122 Q138 6 138 -5 Z" fill={N.skyDark} />
      <rect x={-38} y={-142} width={76} height={24} rx={9} fill={N.skyLight} />
      <rect x={-35} y={-106} width={70} height={9} fill={N.skyLight} opacity={0.75} />
      <rect x={-35} y={-90} width={70} height={9} fill={N.skyLight} opacity={0.75} />
    </g>
  )
}

function ShoeArt() {
  return (
    <g>
      <path d="M-46 -80 H30 Q36 -56 70 -48 L112 -38 Q148 -28 148 -6 V4 H-70 V-20 Q-70 -62 -46 -80 Z" fill={N.leaf} />
      <path d="M78 -46 L112 -38 Q148 -28 148 -6 V4 H96 Q124 -20 78 -46 Z" fill={N.leafLight} opacity={0.55} />
      <path d="M-70 -20 Q-70 -62 -46 -80 H-24 Q-46 -50 -42 4 H-70 Z" fill={N.leafDark} />
      <ellipse cx={-8} cy={-80} rx={40} ry={8} fill={N.leafDark} />
      <path d="M26 -66 L42 -54 M38 -60 L54 -48 M50 -54 L66 -44" stroke={N.cream} strokeWidth={6} strokeLinecap="round" />
      <rect x={-74} y={-6} width={226} height={18} rx={8} fill={N.cream} />
      <rect x={-74} y={6} width={226} height={6} rx={3} fill={N.stoneLight} />
    </g>
  )
}

function Gear({ r, color }: { r: number; color: string }) {
  const teeth = Math.round(r / 3.4)
  return (
    <g>
      {Array.from({ length: teeth }, (_, i) => (
        <rect key={i} x={-r * 0.17} y={-r - 6} width={r * 0.34} height={13} rx={3} fill={color} transform={`rotate(${(360 / teeth) * i})`} />
      ))}
      <circle r={r} fill={color} />
      <circle r={r * 0.36} fill={N.night1} />
    </g>
  )
}

/** The operation on a machine's screen: the sign in white, the number in gold. */
function OpText({ sign, num }: { sign: string; num: string }) {
  return (
    <text y={-25} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={52}>
      <tspan fill={N.white}>{sign}</tspan>
      <tspan dx={14} fill={N.gold}>
        {num}
      </tspan>
    </text>
  )
}

/**
 * A number machine that things pass straight through, left to right or right to left.
 * Centred on (0, 0), 250 wide and 200 tall, with a port on each side at y = 30.
 * The screen shows `fwd`, and can flip to show `back`.
 */
function Machine({ id, fwd, back }: { id: string; fwd: [string, string]; back: [string, string] }) {
  return (
    <g>
      <ellipse cy={104} rx={160} ry={17} fill={N.shadow} opacity={0.45} />
      <g className={`ch5-m${id}-body`}>
        {[-1, 1].map((k) => (
          <g key={k}>
            <rect x={k < 0 ? -154 : 122} y={-24} width={32} height={108} rx={10} fill={N.stone} />
            <rect x={k < 0 ? -154 : 122} y={46} width={32} height={38} rx={10} fill={N.stoneDark} />
            <ellipse cx={k * 154} cy={30} rx={11} ry={52} fill={N.stoneLight} />
            <ellipse cx={k * 155} cy={30} rx={6} ry={44} fill={N.night0} />
          </g>
        ))}
        <rect x={-125} y={-100} width={250} height={200} rx={34} fill={N.violet} />
        <path d="M40 -100 H91 Q125 -100 125 -66 V66 Q125 100 91 100 H20 Q80 20 40 -100 Z" fill={N.violetDark} />
        <rect x={-108} y={-92} width={110} height={10} rx={5} fill={N.violetLight} opacity={0.7} />
        <rect x={-96} y={-82} width={192} height={76} rx={16} fill={N.night0} />
        <g className={`ch5-m${id}-glow`}>
          <Glow y={-44} r={110} color="cool" opacity={0.9} />
        </g>
        <g className={`ch5-m${id}-f`}>
          <OpText sign={fwd[0]} num={fwd[1]} />
        </g>
        <g className={`ch5-m${id}-b`}>
          <OpText sign={back[0]} num={back[1]} />
        </g>
        <rect x={-96} y={8} width={192} height={78} rx={16} fill={N.night1} />
        <g transform="translate(-42 48)">
          <g className={`ch5-m${id}-g`}>
            <Gear r={25} color={N.stoneLight} />
          </g>
        </g>
        <g transform="translate(14 38)">
          <g className={`ch5-m${id}-g`}>
            <Gear r={17} color={N.violetLight} />
          </g>
        </g>
        <g transform="translate(58 58)">
          <g className={`ch5-m${id}-g`}>
            <Gear r={14} color={N.stoneLight} />
          </g>
        </g>
      </g>
    </g>
  )
}

/** A straight arrow drawn from (x1, y) to (x2, y), with its head at x2. */
function Arrow({ cls, x1, x2, y, color }: { cls: string; x1: number; x2: number; y: number; color: string }) {
  const k = Math.sign(x2 - x1)
  return (
    <g>
      <path className={`${cls}-glow`} d={`M${x1} ${y} H${x2}`} stroke={color} strokeWidth={26} strokeLinecap="round" opacity={0} />
      <path className={`${cls}-line`} d={`M${x1} ${y} H${x2 - k * 6}`} pathLength={1} strokeDasharray="1 1" stroke={color} strokeWidth={7} strokeLinecap="round" fill="none" />
      <path className={`${cls}-head`} d={`M${x2 - k * 22} ${y - 15} L${x2} ${y} L${x2 - k * 22} ${y + 15}`} stroke={color} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </g>
  )
}

const sideDesc = (s: Side) =>
  [s.sacks ? `${s.sacks} sack${s.sacks > 1 ? 's' : ''}` : '', s.weights ? `${s.weights} weight${s.weights > 1 ? 's' : ''}` : ''].filter(Boolean).join(' and ') || 'nothing'

/* ------------------------------------------------------------------ */
/* The scene                                                            */
/* ------------------------------------------------------------------ */

export function Ch5TwoSteps({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const [start] = useState(() => startFor(cueIndex))
  const [bal, setBal] = useState<Balance>(start)
  const [undone, setUndone] = useState(cueIndex > 1)
  const [solved, setSolved] = useState(cueIndex > 3)
  const myTurn = (cueIndex === 1 && !undone) || (cueIndex === 3 && !solved)

  const cueRef = useRef(cueIndex)
  const api = useRef({ say, emit, onPlayDone })
  useLayoutEffect(() => {
    cueRef.current = cueIndex
    api.current = { say, emit, onPlayDone }
  })
  const flags = useRef({ undone: cueIndex > 1, solved: cueIndex > 3, tips: 0, sack: false, blocked: 0, sinceLevel: 0, last: null as Balance | null })
  const tipTimer = useRef(0)

  // A fresh turn gets fresh feedback.
  useEffect(() => {
    const f = flags.current
    f.tips = 0
    f.blocked = 0
    f.sinceLevel = 0
    window.clearTimeout(tipTimer.current)
  }, [cueIndex])
  useEffect(() => () => window.clearTimeout(tipTimer.current), [])

  const tipFeedback = useCallback(() => {
    const f = flags.current
    api.current.emit({ type: 'attempt', correct: false, detail: 'left the scale tipped' })
    if (f.tips >= TIP_LINES.length) return
    void api.current.say(TIP_LINES[f.tips])
    f.tips += 1
  }, [])

  const finishSplit = useCallback(() => {
    const f = flags.current
    if (f.solved) return
    f.solved = true
    setSolved(true)
    window.clearTimeout(tipTimer.current)
    api.current.emit({ type: 'attempt', correct: true, detail: 'split both sides into two equal halves: one sack balances four weights, x = 4' })
    void api.current.say(SPLIT_LINE)
    api.current.onPlayDone()
  }, [])

  const onMove = useCallback(
    (b: Balance, move: Move) => {
      setBal(b)
      const f = flags.current
      const cue = cueRef.current
      const { emit: report, onPlayDone: done } = api.current
      if (move.kind === 'split-blocked') {
        // The scale already said why; no second word about the tipping.
        window.clearTimeout(tipTimer.current)
        report({ type: 'attempt', correct: false, detail: move.reason === 'tipped' ? 'tried to split while the scale was tipped' : 'tried to split before the sacks were alone' })
        if (f.blocked < 2) {
          f.blocked += 1
          void api.current.say(BLOCKED[move.reason])
        }
        return
      }
      // Moving something from one pan to the other reports twice with the same picture.
      if (b === f.last) return
      f.last = b
      window.clearTimeout(tipTimer.current)
      if (cue === 1 && !f.undone) {
        if (same(b, AFTER_ONE)) {
          f.undone = true
          setUndone(true)
          report({ type: 'attempt', correct: true, detail: 'took one weight off each side: 2x = 8' })
          void api.current.say(UNDO_LINE)
          done()
          return
        }
        if (move.kind === 'remove' && move.item === 'sack' && !f.sack) {
          f.sack = true
          report({ type: 'attempt', correct: false, detail: 'took a sack off the scale' })
          void api.current.say(SACK_LINE)
          return
        }
      } else if (cue === 3 && !f.solved) {
        if (isSolved(b, X)) return finishSplit()
      } else return
      report({ type: 'progress', detail: `scale now reads ${equationText(b, X)}` })
      if (isLevel(b, X)) {
        f.sinceLevel = 0
        return
      }
      // One move off level is usually half of a pair; a second, or a long wait, gets a word.
      f.sinceLevel += 1
      if (f.sinceLevel >= 2) tipFeedback()
      else tipTimer.current = window.setTimeout(tipFeedback, 4000)
    },
    [tipFeedback, finishSplit],
  )

  const onSolved = useCallback(() => {
    if (cueRef.current === 3) finishSplit()
  }, [finishSplit])

  // What Pip sees, and hints for the two turns.
  useEffect(() => {
    const now = `Left pan: ${sideDesc(bal.left)}. Right pan: ${sideDesc(bal.right)}. The scale is ${isLevel(bal, X) ? 'level' : 'tipped'} and the equation under it reads ${equationText(bal, X)}.`
    if (cueIndex === 1) {
      reportState(
        `The learner's turn: undo the plus one in 2x + 1 = 9 by taking one weight off each side of the scale (drag or tap a weight; it goes to the tray beside that pan, and can be dragged back). ${now} ` +
          `${undone ? 'Done: 2 sacks balance 8 weights.' : 'Goal: 2 sacks on the left, 8 weights on the right, level, which is 2x = 8.'} ` +
          'Likely mix-ups: taking a weight off one side only (the scale tips), taking a sack off, or taking several weights from the right.',
      )
      setHints(HINTS_UNDO)
    } else if (cueIndex === 3) {
      reportState(
        `The learner's turn: split both sides into two equal halves by dragging the glowing teal line (its handle sits above the scale) down through the scale. ${now} ` +
          'The split only works while the scale is level with sacks alone on one side and only weights on the other; it then keeps one half of each side. ' +
          `${solved ? 'Done: 1 sack balances 4 weights.' : 'Correct result: 1 sack balances 4 weights, so x = 4.'} ` +
          'Likely mix-ups: lifting weights off instead of splitting, splitting while tipped, or thinking each sack is 8.',
      )
      setHints(HINTS_SPLIT)
    } else {
      reportState(STATE[cueIndex] ?? '')
    }
  }, [cueIndex, bal, undone, solved, reportState, setHints])

  const build = useCallback((tl: gsap.core.Timeline) => {
    const dscale = root.current?.querySelector('.ch5-dscale') ?? null
    const tilt = { deg: 0 }
    const tiltTo = (from: number, to: number, at: number, dur = 0.5, ease = 'power2.out') =>
      tl.fromTo(tilt, { deg: from }, { deg: to, duration: dur, ease, immediateRender: false, onUpdate: () => tiltScale(dscale, tilt.deg) }, at)
    const drop = (sel: string, at: number, dur = 0.5) => tl.fromTo(sel, { y: -260, opacity: 0 }, { y: 0, opacity: 1, duration: dur, ease: 'bounce.out' }, at)
    const pop = (sel: string, at: number, dur = 0.5) =>
      tl.fromTo(sel, { opacity: 0, scale: 0.3, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: dur, ease: 'back.out(2.6)' }, at)
    const fadeIn = (sel: string | string[], at: number, dur = 0.5) => tl.fromTo(sel, { opacity: 0 }, { opacity: 1, duration: dur, ease: 'power1.out' }, at)
    const spark = (sel: string, from: [number, number], to: [number, number], at: number) => {
      tl.fromTo(sel, { x: from[0], y: from[1], opacity: 0, scale: 0.6 }, { x: to[0], y: to[1], opacity: 1, scale: 1, duration: 0.5, ease: 'power2.in' }, at)
      tl.to(sel, { opacity: 0, scale: 1.8, duration: 0.25, ease: 'power1.out' }, at + 0.5)
    }
    const draw = (cls: string, at: number, dur = 0.6) => {
      tl.fromTo(`${cls}-line`, { attr: { 'stroke-dashoffset': 1 } }, { attr: { 'stroke-dashoffset': 0 }, duration: dur, ease: 'power2.inOut' }, at)
      tl.fromTo(`${cls}-head`, { opacity: 0 }, { opacity: 1, duration: 0.2 }, at + dur - 0.15)
    }
    const flash = (cls: string, at: number) => tl.fromTo(`${cls}-glow`, { opacity: 0 }, { opacity: 0.35, duration: 0.2, yoyo: true, repeat: 1, ease: 'sine.inOut', immediateRender: false }, at)

    // Start: the empty scale on its stage; everything else waits its turn.
    tl.set(['.ch5-d-item', '.ch5-de', '.ch5-spark', '.ch5-live', '.ch5-bp'], { opacity: 0 })
    tl.set('.ch5-dglow', { opacity: 0.15 })
    tl.set(['.ch5-g-plus1', '.ch5-g-lone', '.ch5-g-right', '.ch5-eqglow', '.ch5-halo-s', '.ch5-prevwrap', '.ch5-halves', '.ch5-burst', '.ch5-swipe', '.ch5-halo-x', '.ch5-halo-4'], { opacity: 0 })
    tl.set(['.ch5-row', '.ch5-note', '.ch5-rowC-glow'], { opacity: 0 })
    tl.set('.ch5-sceneB', { y: 900 })
    tl.set('.ch5-ordercam', { scale: OCAM.push, y: 410 - OCAM.oy, svgOrigin: `${OCAM.ox} ${OCAM.oy}` })
    tl.set(['.ch5-foot', '.ch5-sock', '.ch5-shoe', '.ch5-mrow', '.ch5-xglow', '.ch5-endglow', '.ch5-tv8', '.ch5-tv9', '.ch5-ghost'], { opacity: 0 })
    tl.set('.ch5-foot', { x: FOOT_AT[0] })
    tl.set(['.ch5-arr-f1-head', '.ch5-arr-f2-head', '.ch5-arr-b1-head', '.ch5-arr-b2-head', '.ch5-floor-f-head', '.ch5-floor-b-head'], { opacity: 0 })
    tl.set(['.ch5-arr-f1-line', '.ch5-arr-f2-line', '.ch5-arr-b1-line', '.ch5-arr-b2-line', '.ch5-floor-f-line', '.ch5-floor-b-line'], { attr: { 'stroke-dashoffset': 1 } })
    tl.set(['.ch5-mA-b', '.ch5-mB-b'], { scaleY: 0, transformOrigin: '50% 50%' })
    tl.set('.ch5-tok', { x: STOP[0], y: TOKEN_Y })
    tl.set(['.ch5-mA-glow', '.ch5-mB-glow'], { opacity: 0.4 })

    // 0. The new scale glides in; two sacks, one weight, then nine weights. 2x + 1 = 9 writes itself.
    tl.addLabel('b0')
    const b0 = tl.labels.b0
    tl.fromTo('.ch5-drift', { scale: 1.07, svgOrigin: '800 560' }, { scale: 1, duration: 5.6, ease: 'sine.inOut' }, b0)
    drop('.ch5-d-s0', b0 + 1.6)
    tiltTo(0, tiltFor(-4), b0 + 1.8, 0.6, 'elastic.out(1, 0.5)')
    drop('.ch5-d-s1', b0 + 1.95)
    tiltTo(tiltFor(-4), tiltFor(-8), b0 + 2.15, 0.6, 'elastic.out(1, 0.5)')
    spark('.ch5-spark-x', [528, 520], [EQ1_AT[0], EQ.y], b0 + 2.2)
    pop('.ch5-de0', b0 + 2.7)
    drop('.ch5-d-one', b0 + 2.75)
    spark('.ch5-spark-1', [646, 535], [EQ1_AT[2], EQ.y], b0 + 3.0)
    pop('.ch5-de1', b0 + 3.4)
    pop('.ch5-de2', b0 + 3.5)
    D_NINE.forEach((_, i) => {
      const at = b0 + 3.6 + i * 0.13
      drop(`.ch5-d-w${i}`, at, 0.42)
      tiltTo(tiltFor(i - 9), tiltFor(i + 1 - 9), at + 0.15, i === 8 ? 0.8 : 0.35, i === 8 ? 'elastic.out(1.1, 0.4)' : 'power2.out')
    })
    const level = b0 + 3.6 + 8 * 0.13 + 0.15
    tl.to('.ch5-dglow', { opacity: 0.55, duration: 0.4 }, level)
    spark('.ch5-spark-9', [PAN.r, 470], [EQ1_AT[4], EQ.y], level)
    pop('.ch5-de3', level + 0.3)
    pop('.ch5-de4', level + 0.5)
    // The picture hands over to the playable scale: the two are drawn identically, so nothing moves.
    const swap = b0 + 5.65
    tl.set(['.ch5-dset', '.ch5-deq'], { opacity: 0 }, swap)
    tl.set(['.ch5-bp', '.ch5-live'], { opacity: 1 }, swap)

    // 1. Learner's turn: the "+ 1" tile and its weight light up together, then a weight on each side.
    tl.addLabel('b1', b0 + 5.75)
    const b1 = tl.labels.b1
    fadeIn(['.ch5-g-plus1', '.ch5-g-lone'], b1 + 0.8, 0.4)
    tl.to('.ch5-g-plus1', { opacity: 0, duration: 0.6 }, b1 + 2.4)
    tl.to('.ch5-g-lone', { opacity: 0.35, duration: 0.4 }, b1 + 2.4)
    tl.to('.ch5-g-lone', { opacity: 1, duration: 0.4 }, b1 + 2.9)
    fadeIn('.ch5-g-right', b1 + 3.1, 0.4)
    tl.to(['.ch5-g-lone', '.ch5-g-right'], { opacity: 0, duration: 0.6 }, b1 + 4.1)

    // 2. Two sacks, eight weights: the equation glows, the sacks glow, and the halves are hinted.
    tl.addLabel('b2', b1 + 4.8)
    const b2 = tl.labels.b2
    fadeIn('.ch5-eqglow', b2 + 0.2, 0.6)
    tl.fromTo('.ch5-live', { scale: 1, svgOrigin: `${EQ.x} ${EQ.y}` }, { scale: 1.1, duration: 0.35, yoyo: true, repeat: 1, ease: 'sine.inOut' }, b2 + 0.3)
    tl.to('.ch5-eqglow', { opacity: 0.55, duration: 0.8 }, b2 + 1.9)
    fadeIn('.ch5-halo-s', b2 + 2.5, 0.6)
    tl.fromTo('.ch5-prev', { attr: { 'stroke-dashoffset': 1 } }, { attr: { 'stroke-dashoffset': 0 }, duration: 0.8, ease: 'power2.inOut' }, b2 + 3.6)
    fadeIn('.ch5-prevwrap', b2 + 3.6, 0.3)
    fadeIn('.ch5-halves', b2 + 3.9, 0.6)

    // 3. Learner's turn: the splitting line arrives in a burst of light; a ghost of the gesture runs down.
    // The halving lines stay, softer, for as long as the scale still reads 2 sacks against 8 weights.
    tl.addLabel('b3', b2 + 5.6)
    const b3 = tl.labels.b3
    tl.to(['.ch5-halves', '.ch5-halo-s', '.ch5-eqglow'], { opacity: 0, duration: 0.5 }, b3)
    tl.to('.ch5-prevwrap', { opacity: 0.55, duration: 0.5 }, b3)
    tl.fromTo('.ch5-burst', { opacity: 0, scale: 0.2, svgOrigin: `${KNIFE.x} ${KNIFE.y}` }, { opacity: 1, scale: 1.3, duration: 0.3, ease: 'power2.out' }, b3 + 0.05)
    tl.to('.ch5-burst', { opacity: 0, scale: 2, duration: 0.6, ease: 'power1.in' }, b3 + 0.35)
    tl.fromTo('.ch5-swipe', { opacity: 0, y: 0 }, { opacity: 1, duration: 0.3 }, b3 + 3.3)
    tl.to('.ch5-swipe', { y: 300, duration: 1.1, ease: 'power1.inOut' }, b3 + 3.3)
    tl.to('.ch5-swipe', { opacity: 0, duration: 0.3 }, b3 + 4.1)

    // 4. The scale steps aside and the worked solution stacks up beside it.
    tl.addLabel('b4', b3 + 4.6)
    const b4 = tl.labels.b4
    tl.to('.ch5-burst', { opacity: 0.9, scale: 1, duration: 0.15 }, b4)
    tl.to('.ch5-burst', { opacity: 0, scale: 0.2, duration: 0.4, ease: 'power2.in' }, b4 + 0.15)
    tl.to(['.ch5-live', '.ch5-prevwrap'], { opacity: 0, duration: 0.4 }, b4)
    tl.fromTo('.ch5-scalecam', { x: 0, scale: 1, svgOrigin: '800 560' }, { x: -300, scale: 0.75, duration: 1.0, ease: 'power2.inOut' }, b4)
    fadeIn(['.ch5-halo-x', '.ch5-halo-4'], b4 + 0.4, 0.6)
    const rowIn = (sel: string, at: number) => tl.fromTo(sel, { opacity: 0, x: 50 }, { opacity: 1, x: 0, duration: 0.45, ease: 'power3.out' }, at)
    const noteIn = (sel: string, at: number) => tl.fromTo(sel, { opacity: 0, y: -14 }, { opacity: 1, y: 0, duration: 0.35, ease: 'back.out(2)' }, at)
    rowIn('.ch5-rowA', b4 + 0.5)
    noteIn('.ch5-noteA', b4 + 0.85)
    rowIn('.ch5-rowB', b4 + 1.15)
    noteIn('.ch5-noteB', b4 + 1.5)
    rowIn('.ch5-rowC', b4 + 1.85)
    fadeIn('.ch5-rowC-glow', b4 + 2.2, 0.6)
    tl.fromTo('.ch5-rowC', { scale: 1 }, { scale: 1.1, duration: 0.3, yoyo: true, repeat: 1, ease: 'sine.inOut', transformOrigin: '50% 50%', immediateRender: false }, b4 + 2.3)

    // 5. Down to everyday life: socks then shoes, shoes off then socks; then the machines run backwards.
    tl.addLabel('b5', b4 + 3.2)
    const b5 = tl.labels.b5
    tl.fromTo('.ch5-sceneA', { y: 0 }, { y: -900, duration: 1.3, ease: 'power3.inOut' }, b5)
    tl.to('.ch5-sceneB', { y: 0, duration: 1.3, ease: 'power3.inOut' }, b5)
    tl.fromTo('.ch5-sky', { y: 0 }, { y: -220, duration: 1.3, ease: 'power3.inOut' }, b5)
    tl.fromTo('.ch5-foot', { opacity: 0, y: -50 }, { opacity: 1, y: 0, duration: 0.6, ease: 'back.out(2)' }, b5 + 0.9)
    const hop = (to: number, at: number, dur = 0.65) => {
      tl.to('.ch5-foot', { x: to, duration: dur, ease: 'power2.inOut' }, at)
      tl.to('.ch5-foot', { y: -60, duration: dur / 2, ease: 'power2.out' }, at)
      tl.to('.ch5-foot', { y: 0, duration: dur / 2, ease: 'power2.in' }, at + dur / 2)
    }
    // socks on
    hop(FOOT_AT[1], b5 + 2.1)
    tl.fromTo('.ch5-sock', { x: -40, y: -200, rotation: -25, opacity: 0, transformOrigin: '50% 100%' }, { x: 0, y: 0, rotation: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.3)' }, b5 + 2.15)
    draw('.ch5-arr-f1', b5 + 2.1)
    // then shoes on
    hop(FOOT_AT[2], b5 + 3.0)
    tl.fromTo('.ch5-shoe', { x: 60, y: -200, rotation: 25, opacity: 0, transformOrigin: '50% 100%' }, { x: 0, y: 0, rotation: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.3)' }, b5 + 3.05)
    draw('.ch5-arr-f2', b5 + 3.0)
    // shoes off first
    tl.to('.ch5-shoe', { x: 90, y: -120, rotation: 30, opacity: 0, duration: 0.55, ease: 'power2.in' }, b5 + 4.55)
    hop(FOOT_AT[1], b5 + 4.95)
    draw('.ch5-arr-b2', b5 + 4.95)
    // then socks off
    tl.to('.ch5-sock', { x: 80, y: -140, rotation: 30, opacity: 0, duration: 0.55, ease: 'power2.in' }, b5 + 5.95)
    hop(FOOT_AT[0], b5 + 6.3)
    draw('.ch5-arr-b1', b5 + 6.3)
    // pull back to reveal the machines below
    tl.to('.ch5-ordercam', { scale: 1, y: 0, duration: 1.0, ease: 'power2.inOut' }, b5 + 6.9)
    tl.fromTo('.ch5-mrow', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, b5 + 7.0)

    const work = (m: 'A' | 'B', at: number) => {
      tl.fromTo(`.ch5-m${m}-body`, { scaleX: 1, scaleY: 1 }, { scaleX: 1.03, scaleY: 0.94, duration: 0.12, yoyo: true, repeat: 1, ease: 'sine.inOut', transformOrigin: '50% 100%', immediateRender: false }, at - 0.1)
      tl.to(`.ch5-m${m}-g`, { rotation: '+=140', duration: 0.45, ease: 'power1.inOut', transformOrigin: '50% 50%' }, at - 0.25)
      tl.fromTo(`.ch5-m${m}-glow`, { opacity: 0.4 }, { opacity: 1, duration: 0.15, yoyo: true, repeat: 1, immediateRender: false }, at - 0.1)
    }
    const shows = (from: number, to: number, at: number) => {
      tl.set(`.ch5-tv${from}`, { opacity: 0 }, at)
      tl.set(`.ch5-tv${to}`, { opacity: 1 }, at)
    }
    const leg = (to: number, at: number, into: boolean) => tl.to('.ch5-tok', { x: to, duration: 0.32, ease: into ? 'power1.in' : 'power1.out' }, at)

    // forward: 4, times 2, is 8, plus 1, is 9
    const fw = b5 + 7.5
    draw('.ch5-floor-f', fw, 1.35)
    leg(MACH[0], fw, true)
    work('A', fw + 0.32)
    shows(4, 8, fw + 0.32)
    flash('.ch5-arr-f1', fw + 0.2)
    leg(STOP[1], fw + 0.36, false)
    leg(MACH[1], fw + 0.72, true)
    work('B', fw + 1.04)
    shows(8, 9, fw + 1.04)
    flash('.ch5-arr-f2', fw + 0.92)
    leg(STOP[2], fw + 1.08, false)

    // the screens flip to the undoing machines
    const fl = b5 + 8.9
    tl.to(['.ch5-floor-f-line', '.ch5-floor-f-head'], { opacity: 0.35, duration: 0.3 }, fl)
    tl.to('.ch5-mB-f', { scaleY: 0, duration: 0.16, ease: 'power2.in', transformOrigin: '50% 50%' }, fl)
    tl.to('.ch5-mB-b', { scaleY: 1, duration: 0.24, ease: 'back.out(2)' }, fl + 0.16)
    tl.to('.ch5-mA-f', { scaleY: 0, duration: 0.16, ease: 'power2.in', transformOrigin: '50% 50%' }, fl + 0.15)
    tl.to('.ch5-mA-b', { scaleY: 1, duration: 0.24, ease: 'back.out(2)' }, fl + 0.31)

    // backward, last on first off: 9, minus 1, is 8, divided by 2, is 4 (each stop keeps a faint copy)
    const bw = b5 + 9.3
    const endY = 450 - OCAM.oy - OCAM.endScale * (450 - OCAM.oy)
    tl.to('.ch5-ordercam', { scale: OCAM.endScale, y: endY, duration: 2.3, ease: 'sine.inOut' }, bw - 0.2)
    draw('.ch5-floor-b', bw, 1.35)
    fadeIn('.ch5-ghost9', bw + 0.05, 0.4)
    fadeIn('.ch5-ghost8', bw + 0.85, 0.4)
    leg(MACH[1], bw, true)
    work('B', bw + 0.32)
    shows(9, 8, bw + 0.32)
    flash('.ch5-arr-b2', bw + 0.2)
    leg(STOP[1], bw + 0.36, false)
    leg(MACH[0], bw + 0.8, true)
    work('A', bw + 1.12)
    shows(8, 4, bw + 1.12)
    flash('.ch5-arr-b1', bw + 1.0)
    leg(STOP[0], bw + 1.16, false)
    // back where it started: x = 4
    const end = bw + 1.5
    tl.fromTo('.ch5-tok', { scale: 1 }, { scale: 1.2, duration: 0.2, yoyo: true, repeat: 1, ease: 'sine.inOut', transformOrigin: '50% 50%', immediateRender: false }, end)
    fadeIn('.ch5-xglow', end, 0.4)
    fadeIn('.ch5-endglow', end + 0.1, 0.6)
    tl.addLabel('b6', end + 0.75)
  }, [])

  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  const liveTerms = terms(equationText(bal, X))
  const plusOneX = (() => {
    const c = rowLayout(terms('2x + 1 = 9'), EQ.size).centres
    return EQ.x + (c[1] + c[2]) / 2
  })()

  return (
    <g ref={root}>
      {/* Sky, a little behind everything, so it drifts slower than the stage */}
      <g className="ch5-sky">
        <Backdrop kind="deep" />
        <Stars h={1200} count={130} seed={55} />
        <Bloom x={1250} y={230} r={300} color="violet" opacity={0.1} />
      </g>

      {/* The balance scale on its stage */}
      <g className="ch5-sceneA">
        <g className="ch5-drift">
          <g className="ch5-scalecam">
            {/* spotlight and round stage */}
            <path d="M680 -40 H920 L1220 690 H380 Z" fill={N.skyLight} opacity={0.05} filter="url(#fx-soft)" />
            <ellipse cx={800} cy={676} rx={700} ry={66} fill={N.night1} />
            <ellipse cx={800} cy={660} rx={700} ry={64} fill={N.night2} />
            <ellipse cx={800} cy={660} rx={700} ry={64} fill="none" stroke={N.night3} strokeWidth={4} opacity={0.8} />
            <ellipse cx={800} cy={660} rx={460} ry={40} fill="url(#fx-glow-cool)" opacity={0.35} />

            {/* soft lights under the things that matter right now */}
            <g pointerEvents="none">
              <g opacity={bal.left.weights === 1 && bal.left.sacks === 2 ? 1 : 0}>
                <g className="ch5-g-lone">
                  <Glow x={PAN.l + D_ONE * SC.s} y={PAN.y - 22} r={80} color="warm" opacity={0.9} />
                  <circle cx={PAN.l + D_ONE * SC.s} cy={PAN.y - 24} r={40} fill="none" stroke={N.goldLight} strokeWidth={5} filter="url(#fx-glow)" />
                </g>
              </g>
              <g opacity={bal.right.weights >= 8 ? 1 : 0}>
                <g className="ch5-g-right">
                  <Glow x={PAN.r} y={PAN.y - 40} r={150} color="warm" opacity={0.75} />
                </g>
              </g>
              <g className="ch5-halo-s">
                <Glow x={PAN.l - 42 * SC.s} y={PAN.y - 34} r={85} color="pink" />
                <Glow x={PAN.l + 42 * SC.s} y={PAN.y - 34} r={85} color="pink" />
              </g>
              <g className="ch5-halves">
                <Glow x={PAN.r - 58 * SC.s} y={PAN.y - 32} r={80} color="warm" opacity={0.85} />
                <Glow x={PAN.r + 58 * SC.s} y={PAN.y - 32} r={80} color="warm" opacity={0.85} />
              </g>
              <g className="ch5-halo-x">
                <Glow x={PAN.l} y={PAN.y - 34} r={100} color="pink" />
              </g>
              <g className="ch5-halo-4">
                <Glow x={PAN.r} y={PAN.y - 22} r={120} color="warm" opacity={0.9} />
              </g>
            </g>

            {/* The playable scale: one key for cues 1 to 4, so the learner's progress carries over */}
            <g className="ch5-bp">
              <BalancePlay
                key="two-steps"
                x={SC.x}
                y={SC.y}
                s={SC.s}
                value={X}
                start={start}
                active={myTurn}
                canSplit={cueIndex === 3}
                trays
                glow
                onMove={onMove}
                onSolved={onSolved}
                tutor="the scale"
              />
            </g>

            {/* Cue 1's picture of the same scale, so things can drop on before it becomes playable */}
            <g className="ch5-dset" pointerEvents="none">
              <g className="ch5-dglow">
                <Glow x={SC.x} y={SC.y - SCALE.H * SC.s} r={300 * SC.s} color="teal" />
              </g>
              <Tray x={SC.x - TRAY_DX * SC.s} y={SC.y} s={SC.s} />
              <Tray x={SC.x + TRAY_DX * SC.s} y={SC.y} s={SC.s} />
              <g transform={`translate(${SC.x} ${SC.y}) scale(${SC.s})`}>
                <Scale
                  className="ch5-dscale"
                  tutor="the balance scale"
                  left={
                    <>
                      {D_SACKS.map((x, i) => (
                        <g key={i} transform={`translate(${x} 0)`}>
                          <g className={`ch5-d-item ch5-d-s${i}`}>
                            <Sack s={0.8} tutor="the two mystery sacks" />
                          </g>
                        </g>
                      ))}
                      <g transform={`translate(${D_ONE} 0)`}>
                        <g className="ch5-d-item ch5-d-one">
                          <Weight s={0.9} tutor="the one weight next to the sacks" />
                        </g>
                      </g>
                    </>
                  }
                  right={D_NINE.map(([x, y], i) => (
                    <g key={i} transform={`translate(${x} ${y})`}>
                      <g className={`ch5-d-item ch5-d-w${i}`}>
                        <Weight s={0.9} tutor="the nine weights" />
                      </g>
                    </g>
                  ))}
                />
              </g>
            </g>

            {/* Hints drawn over the scale: never in the way of a finger */}
            <g pointerEvents="none">
              <g className="ch5-prevwrap">
                <g opacity={same(bal, AFTER_ONE) ? 1 : 0} style={{ transition: 'opacity 0.3s' }}>
                  {/* (no filter on a straight line: its zero-width box would clip it away) */}
                  {[PAN.l, PAN.r].map((px) => (
                    <g key={px}>
                      <line x1={px} y1={PAN.y - 150 * SC.s} x2={px} y2={PAN.y + 14 * SC.s} stroke={N.teal} strokeWidth={22} strokeLinecap="round" opacity={0.18} />
                      <line className="ch5-prev" x1={px} y1={PAN.y - 150 * SC.s} x2={px} y2={PAN.y + 14 * SC.s} pathLength={1} strokeDasharray="0.06 0.05" stroke={N.tealLight} strokeWidth={6} strokeLinecap="round" />
                    </g>
                  ))}
                </g>
              </g>
              <g className="ch5-burst">
                <Glow x={KNIFE.x} y={KNIFE.y} r={130} color="teal" />
              </g>
              <g className="ch5-swipe">
                {[0, 1, 2].map((i) => (
                  <path
                    key={i}
                    d={`M${KNIFE.x - 22} ${KNIFE.y + 40 + i * 26} L${KNIFE.x} ${KNIFE.y + 60 + i * 26} L${KNIFE.x + 22} ${KNIFE.y + 40 + i * 26}`}
                    stroke={N.tealLight}
                    strokeWidth={7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    opacity={0.4 + i * 0.3}
                  />
                ))}
              </g>
              {/* sparks that carry each thing on the scale down into its tile */}
              <g className="ch5-spark ch5-spark-x">
                <Glow r={46} color="pink" />
                <circle r={10} fill={N.pinkLight} />
              </g>
              <g className="ch5-spark ch5-spark-1">
                <Glow r={40} color="warm" />
                <circle r={9} fill={N.goldLight} />
              </g>
              <g className="ch5-spark ch5-spark-9">
                <Glow r={52} color="warm" />
                <circle r={11} fill={N.goldLight} />
              </g>
            </g>

            {/* The equation under the scale */}
            <g pointerEvents="none">
              <g className="ch5-eqglow">
                <ellipse cx={EQ.x} cy={EQ.y} rx={300} ry={110} fill="url(#fx-glow-violet)" />
                <rect x={EQ.x - 150} y={EQ.y - 60} width={300} height={120} rx={36} fill="none" stroke={N.mist} strokeOpacity={0.7} strokeWidth={4} filter="url(#fx-glow)" />
              </g>
              <g opacity={bal.left.weights === 1 && bal.left.sacks === 2 ? 1 : 0}>
                <g className="ch5-g-plus1">
                  <ellipse cx={plusOneX} cy={EQ.y} rx={120} ry={70} fill="url(#fx-glow-warm)" />
                  <rect x={plusOneX - 82} y={EQ.y - 58} width={164} height={116} rx={30} fill="none" stroke={N.goldLight} strokeWidth={5} filter="url(#fx-glow)" />
                </g>
              </g>
            </g>
            <g className="ch5-live">
              <Equation terms={liveTerms} x={EQ.x} y={EQ.y} size={EQ.size} tutor="the equation" />
            </g>
            <g className="ch5-deq" pointerEvents="none">
              {EQ1.map((t, i) => (
                <g key={i} className={`ch5-de ch5-de${i}`}>
                  <Equation terms={[t]} x={EQ1_AT[i]} y={EQ.y} size={EQ.size} />
                </g>
              ))}
            </g>
          </g>

          {/* The worked solution */}
          <g className="ch5-stack" pointerEvents="none" data-tutor="the worked solution">
            <g className="ch5-rowC-glow">
              <Glow x={STACK_EQ_X} y={ROW_C.y} r={200} color="violet" />
            </g>
            {[ROW_A, ROW_B, ROW_C].map((r, i) => (
              <g key={r.src} className={`ch5-row ch5-row${'ABC'[i]}`}>
                <Equation terms={terms(r.src)} x={r.x} y={r.y} size={r.size} />
              </g>
            ))}
            {[
              { cls: 'ch5-noteA', row: ROW_A, text: '− 1', y: 330 },
              { cls: 'ch5-noteB', row: ROW_B, text: '÷ 2', y: 480 },
            ].map((n) => (
              <g key={n.cls} className={`ch5-note ${n.cls}`}>
                <Title x={n.row.left} y={n.y} size={36} color={N.coral}>
                  {n.text}
                </Title>
                <Title x={n.row.right} y={n.y} size={36} color={N.coral}>
                  {n.text}
                </Title>
              </g>
            ))}
          </g>
        </g>
      </g>

      {/* Socks and shoes, and the same idea as number machines */}
      <g className="ch5-sceneB" pointerEvents="none">
        <g className="ch5-ordercam">
          {/* the floor the machines stand on */}
          <rect x={-600} y={556} width={2800} height={800} fill={N.night1} opacity={0.6} />
          <rect x={-600} y={552} width={2800} height={6} fill={N.night3} opacity={0.6} />
          <Glow x={800} y={500} r={560} color="violet" opacity={0.2} />

          {/* everyday life, in a panel above */}
          <rect x={PANEL.x} y={PANEL.y} width={PANEL.w} height={PANEL.h} rx={40} fill={N.night1} opacity={0.6} />
          <rect x={PANEL.x} y={PANEL.y} width={PANEL.w} height={PANEL.h} rx={40} fill="none" stroke={N.mist} strokeOpacity={0.14} strokeWidth={3} />
          <line x1={PANEL.x + 40} y1={FOOT_Y + 2} x2={PANEL.x + PANEL.w - 40} y2={FOOT_Y + 2} stroke={N.night3} strokeWidth={4} strokeLinecap="round" opacity={0.8} />
          {FOOT_AT.map((fx) => (
            <ellipse key={fx} cx={fx + 32} cy={FOOT_Y + 2} rx={95} ry={10} fill={N.shadow} opacity={0.4} />
          ))}
          <Arrow cls="ch5-arr-f1" x1={460} x2={690} y={ARROW.f} color={N.cream} />
          <Arrow cls="ch5-arr-f2" x1={910} x2={1140} y={ARROW.f} color={N.cream} />
          <Arrow cls="ch5-arr-b2" x1={1140} x2={910} y={ARROW.b} color={N.violetLight} />
          <Arrow cls="ch5-arr-b1" x1={690} x2={460} y={ARROW.b} color={N.violetLight} />
          <g transform={`translate(0 ${FOOT_Y})`}>
            <g className="ch5-foot" data-tutor="the foot">
              <g transform={`scale(${FOOT_S})`}>
                <FootArt />
                <g className="ch5-sock">
                  <SockArt />
                </g>
                <g className="ch5-shoe">
                  <ShoeArt />
                </g>
              </g>
            </g>
          </g>

          {/* the number machines: times 2, then plus 1 */}
          <g className="ch5-mrow">
            <Arrow cls="ch5-floor-f" x1={300} x2={1300} y={592} color={N.cream} />
            <Arrow cls="ch5-floor-b" x1={1300} x2={300} y={640} color={N.violetLight} />
            <g className="ch5-endglow">
              <Glow x={800} y={MACH_Y} r={300} color="violet" opacity={0.7} />
            </g>
            {STOP.map((sx) => (
              <g key={sx}>
                <ellipse cx={sx} cy={TOKEN_Y + 46} rx={56} ry={13} fill={N.shadow} opacity={0.5} />
                <ellipse cx={sx} cy={TOKEN_Y + 44} rx={56} ry={13} fill="none" stroke={N.stoneLight} strokeOpacity={0.35} strokeWidth={3} />
              </g>
            ))}
            <g className="ch5-xglow">
              <Glow x={250} y={TOKEN_Y} r={190} color="violet" />
            </g>
            <Equation terms={terms('x =')} x={208} y={TOKEN_Y} size={44} tutor="x equals" />
            {[
              { v: 9, x: STOP[2] },
              { v: 8, x: STOP[1] },
            ].map((g) => (
              <g key={g.v} className={`ch5-ghost ch5-ghost${g.v}`} transform={`translate(${g.x} ${TOKEN_Y})`}>
                <circle r={40} fill={N.gold} opacity={0.22} />
                <circle r={40} fill="none" stroke={N.gold} strokeWidth={4} strokeDasharray="10 8" opacity={0.8} />
                <text y={16} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={46} fill={N.goldLight}>
                  {g.v}
                </text>
              </g>
            ))}
            <g className="ch5-tok" data-tutor="the number going through the machines">
              <Glow r={74} color="warm" opacity={0.55} />
              <circle r={40} fill={N.gold} />
              <path d="M-26 -22 Q-34 -4 -28 14" stroke={N.goldLight} strokeWidth={6} fill="none" strokeLinecap="round" />
              <circle r={40} fill="none" stroke={N.goldDark} strokeWidth={5} />
              {[4, 8, 9].map((v) => (
                <text key={v} className={`ch5-tv${v}`} y={16} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={46} fill={N.night0}>
                  {v}
                </text>
              ))}
            </g>
            <g transform={`translate(${MACH[0]} ${MACH_Y})`} data-tutor="the times 2 machine">
              <Machine id="A" fwd={['×', '2']} back={['÷', '2']} />
            </g>
            <g transform={`translate(${MACH[1]} ${MACH_Y})`} data-tutor="the plus 1 machine">
              <Machine id="B" fwd={['+', '1']} back={['−', '1']} />
            </g>
          </g>
        </g>
      </g>

      <Motes count={18} seed={15} />
      <Vignette />
    </g>
  )
}

export const ch5: Chapter = {
  id: 'two-steps',
  title: 'Two steps back',
  cues: CUES,
  Scene: Ch5TwoSteps,
  enter: { type: 'pan', dir: 'left' },
}
