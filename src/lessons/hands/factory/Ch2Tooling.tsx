import gsap from 'gsap'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { camera } from '../../../cine/camera'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Blueprint, Chip, Dust, Label, Pool, Readout, Vignette, fade, useAmbient } from '../shared/kit'
import { FactoryBack, FactoryCSS, FingerShell, Gear, MouldBlock, PriceTag, SourceNote, money } from './factoryKit'
import { ProcessReading } from './readings'

export const CUES: Cue[] = [
  { id: 'fixed', say: 'Every factory process is a bet. A steel mould might cost fifteen thousand dollars before you make a single part. After that, each part costs pennies.' },
  { id: 'formula', say: 'So the true cost of one part is the per-part cost, plus the mould’s price shared across every part you make.' },
  { id: 'curves', say: 'Plot it, and every process becomes a curve. Machining is flat: expensive at any volume. Moulds start sky-high and plunge.' },
  { id: 'bet', say: 'You’re the factory manager. Pick how to make each part of the hand, then see what happens when the orders come in.', play: true },
  { id: 'mim', say: 'Tiny metal gears and linkages use metal injection moulding: metal powder mixed with glue, moulded, then baked until it shrinks by a fifth. It only pays off around a hundred thousand parts a year.' },
]

const STATE = [
  'A dark workshop table under a hanging lamp. A gleaming steel injection mould block drops heavily onto it (the camera shakes), and a gold price tag reading $15,000 swings from it. Then a conveyor slides a stream of identical plastic finger shells past, each tagged $0.40. Point: a mould is a big fixed cost up front, and then each part is cheap.',
  'Concreteness fading on a blueprint background. Left: a pile of 100 finger shells with the mould’s $15,000 sliced over them: $150 a part. Right: 10,000 parts with tiny slices: $1.50 a part. Then the formula writes itself in mono: unit cost = v + F / V, with v the per-part cost, F the tooling cost, V the volume (how many parts you make).',
  'A log-log chart draws itself: unit cost against volume (10 to a million parts). Machining (CNC) is a flat high line; 3D printing a flat lower line; injection moulding starts very high and falls steeply; metal injection moulding and die casting start even higher and fall later. Where the curves cross, gold points glow: those crossovers are the volumes where it pays to switch process. These numbers are illustrative.',
  '',
  'Metal injection moulding (MIM) in four steps, the camera panning along: grey feedstock pellets (fine metal powder mixed with a plastic binder), a moulded "green" gear that is oversized and dull, the binder burned off (wisps of smoke), then sintered in a glowing furnace where the gear visibly shrinks by about 15 to 20 percent into a small shiny metal gear. Label: worth it at about 100,000 parts a year. Point: MIM makes tiny strong metal parts cheaply, but only at high volume because the tooling costs tens of thousands of dollars.',
]

/* ------------------------------------------------------------------ */
/* The tooling bet: parts, processes, rounds                            */
/* ------------------------------------------------------------------ */

interface Proc {
  id: string
  name: string
  /** Tooling cost, dollars (0 for no tool). */
  F: number
  /** Cost per part, dollars. */
  v: number
  /** Lead time, weeks, to the first good part. */
  wk: number
  /** A soft tool wears out after this many parts and must be bought again. */
  life?: number
}
interface Part {
  id: 'shell' | 'gear' | 'palm' | 'skin'
  name: string
  procs: Proc[]
}

const CNC = (v: number): Proc => ({ id: 'cnc', name: 'CNC', F: 0, v, wk: 1 })
const PRINT = (v: number): Proc => ({ id: 'print', name: '3D print', F: 0, v, wk: 1 })
const PARTS: Part[] = [
  { id: 'shell', name: 'finger shell', procs: [CNC(60), PRINT(12), { id: 'rapid', name: 'rapid mould', F: 4000, v: 0.5, wk: 3, life: 5000 }, { id: 'steel', name: 'steel mould', F: 15000, v: 0.4, wk: 10 }] },
  { id: 'gear', name: 'tiny gear', procs: [CNC(40), PRINT(8), { id: 'mim', name: 'MIM', F: 40000, v: 1.2, wk: 12 }] },
  { id: 'palm', name: 'palm frame', procs: [CNC(200), PRINT(30), { id: 'die', name: 'die cast', F: 60000, v: 4, wk: 12 }] },
  { id: 'skin', name: 'fingertip skin', procs: [{ id: 'soft', name: 'soft mould', F: 2500, v: 3, wk: 2, life: 5000 }, { id: 'over', name: 'overmould', F: 12000, v: 0.8, wk: 10 }] },
]
const ROUNDS = [
  { V: 200, text: 'A lab orders 200 hands.' },
  { V: 50000, text: 'A humanoid maker orders 50,000.' },
  { V: 50000, text: 'Surprise: the design changes. Your moulds are scrap. Order 50,000 more of the new design.' },
]
const TARGET = 1_000_000
type Picks = Record<Part['id'], string>
const START: Picks = { shell: 'cnc', gear: 'cnc', palm: 'cnc', skin: 'soft' }

const procOf = (part: Part, id: string) => part.procs.find((p) => p.id === id) ?? part.procs[0]
function partCost(p: Proc, V: number) {
  const tools = p.F ? (p.life ? Math.ceil(V / p.life) : 1) : 0
  return { tool: tools * p.F, run: p.v * V, tools }
}
function roundCost(picks: Picks, V: number) {
  return PARTS.reduce((s, part) => {
    const c = partCost(procOf(part, picks[part.id]), V)
    return s + c.tool + c.run
  }, 0)
}
const BEST = ROUNDS.map((r) => PARTS.map((part) => part.procs.reduce((b, p) => (partCost(p, r.V).tool + partCost(p, r.V).run < partCost(b, r.V).tool + partCost(b, r.V).run ? p : b)).name))
const perHand = (v: number) => (v >= 100 ? money(v) : `$${v.toFixed(2)}`)

/* Board layout */
const ROW_Y = [268, 398, 528, 658]
const CHIP_X = 410
const CHIP_W = 150
const CHIP_GAP = 160
const BAR_X = 1010
const BAR_W = 190
const PANEL_X = 1260

/* ------------------------------------------------------------------ */
/* The cost curves chart                                                */
/* ------------------------------------------------------------------ */

const CX = (V: number) => 260 + ((Math.log10(V) - 1) / 5) * 1120
const CY = (c: number) => 740 - ((Math.log10(c) + 1) / 5) * 580
const CURVES = [
  { id: 'cnc', name: 'machining (CNC)', F: 0, v: 120, color: C.mist },
  { id: 'print', name: '3D print', F: 0, v: 20, color: C.fog },
  { id: 'inj', name: 'injection mould', F: 15000, v: 0.4, color: C.gold },
  { id: 'mim', name: 'metal injection moulding', F: 40000, v: 1.5, color: C.goldLight },
  { id: 'die', name: 'die cast', F: 60000, v: 3, color: C.goldDark },
]
const curvePath = (F: number, v: number) => {
  const pts: string[] = []
  for (let i = 0; i <= 60; i++) {
    const V = Math.pow(10, 1 + (5 * i) / 60)
    pts.push(`${CX(V).toFixed(1)} ${CY(v + F / V).toFixed(1)}`)
  }
  return 'M' + pts.join(' L')
}
const CROSS = [
  { V: 15000 / 119.6, c: 120 },
  { V: 15000 / 19.6, c: 20 },
  { V: 40000 / 18.5, c: 20 },
  { V: 60000 / 117, c: 120 },
]

/* The MIM line: four stations along a bench. */
const ST = [260, 650, 1040, 1420]

export function Ch2Tooling({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints, memory }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const benchShot = useRef<SVGGElement>(null)
  const chartShot = useRef<SVGGElement>(null)
  const mimShot = useRef<SVGGElement>(null)
  const boardBg = useRef<SVGGElement>(null)

  /* ---------- the play's state ---------- */
  const [picks, setPicks] = useState<Picks>(START)
  const [round, setRound] = useState(0)
  const [results, setResults] = useState<number[]>([])
  const [scrapped, setScrapped] = useState<Picks | null>(null)
  const [attempt, setAttempt] = useState(1)
  const [phase, setPhase] = useState<'pick' | 'running' | 'over' | 'done'>('pick')
  const [runT, setRunT] = useState(0)
  const runTween = useRef<gsap.core.Tween | null>(null)
  const playingRef = useRef(playing)
  playingRef.current = playing
  const playDoneRef = useRef(onPlayDone)
  playDoneRef.current = onPlayDone
  const betting = cueIndex === 3 && phase !== 'done'

  const build = useCallback((tl: gsap.core.Timeline) => {
    const camBench = camera(benchShot.current, { x: 800, y: 470, zoom: 1.1 })
    const camChart = camera(chartShot.current, { x: 800, y: 450, zoom: 1 })
    const camMim = camera(mimShot.current, { x: ST[0] + 60, y: 520, zoom: 1.6 })
    const camBoard = camera(boardBg.current, { x: 800, y: 450, zoom: 1.05 })
    const shots = ['.f2-bench', '.f2-formula', '.f2-chart', '.f2-board', '.f2-mim']
    const show = (sel: string, at: number, dur = 0.01) => {
      for (const s of shots) {
        if (s === sel) fade(tl, s, 1, at, dur, 0)
        else tl.set(s, { opacity: 0 }, at + dur)
      }
    }

    /* b0: a steel mould lands; the price tag swings; then the cheap parts stream past. */
    tl.addLabel('b0', 0)
    show('.f2-bench', 0)
    camBench.to(tl, { x: 800, y: 500, zoom: 1.2 }, 0, 5, 'sine.inOut')
    tl.fromTo('.f2-mould', { y: -700 }, { y: 0, duration: 0.7, ease: 'power3.in', immediateRender: false }, 0.6)
    camBench.shake(tl, 1.3, 1.3, 0.55)
    fade(tl, '.f2-dustpuff', 0.8, 1.3, 0.1)
    tl.fromTo('.f2-dustpuff', { scale: 0.4 }, { scale: 1.6, opacity: 0, duration: 1.2, ease: 'power2.out', transformOrigin: '50% 50%', immediateRender: false }, 1.35)
    fade(tl, '.f2-tag', 1, 1.4, 0.2)
    const swing = [0, 26, -18, 12, -7, 3, 0]
    swing.slice(1).forEach((r, i) => tl.fromTo('.f2-tag', { rotation: swing[i] }, { rotation: r, duration: 0.5, ease: 'sine.inOut', svgOrigin: '960 470', immediateRender: false }, 1.4 + i * 0.5))
    camBench.to(tl, { x: 800, y: 600, zoom: 1.05 }, 5.2, 2, 'power2.inOut')
    fade(tl, '.f2-belt', 1, 5.0, 0.6)
    tl.fromTo('.f2-stream', { x: -900 }, { x: 260, duration: 5.6, ease: 'none', immediateRender: false }, 5.4)
    fade(tl, '.f2-lab-pennies', 1, 7.0, 0.5)

    /* b1: the mould's price, sliced over a hundred parts, then ten thousand; then the formula. */
    const b1 = 11.2
    tl.addLabel('b1', b1)
    show('.f2-formula', b1, 0.6)
    fade(tl, '.f2-p100', 1, b1 + 0.3, 0.5)
    tl.fromTo('.f2-goldbar-a', { scaleX: 1, opacity: 1 }, { scaleX: 1, opacity: 1, duration: 0.01, immediateRender: false }, b1 + 0.6)
    tl.fromTo('.f2-goldbar-a', { y: 0 }, { y: 70, opacity: 0, duration: 0.8, ease: 'power2.in', immediateRender: false }, b1 + 1.2)
    tl.fromTo('.f2-cap', { opacity: 0, y: -30 }, { opacity: 1, y: 0, duration: 0.3, stagger: 0.006, immediateRender: false }, b1 + 1.6)
    fade(tl, '.f2-t100', 1, b1 + 2.0, 0.4)
    fade(tl, '.f2-p10k', 1, b1 + 2.8, 0.5)
    tl.fromTo('.f2-goldbar-b', { opacity: 0 }, { opacity: 1, duration: 0.2, immediateRender: false }, b1 + 3.0)
    tl.fromTo('.f2-goldbar-b', { y: 0, scaleY: 1 }, { y: 80, scaleY: 0.1, duration: 0.8, ease: 'power2.in', svgOrigin: '1080 250', immediateRender: false }, b1 + 3.3)
    tl.fromTo('.f2-goldbar-b', { opacity: 1 }, { opacity: 0, duration: 0.3, immediateRender: false }, b1 + 3.9)
    fade(tl, '.f2-film', 1, b1 + 4.0, 0.4)
    fade(tl, '.f2-t10k', 1, b1 + 4.2, 0.4)
    fade(tl, '.f2-eq', 1, b1 + 4.9, 0.2)
    tl.fromTo('.f2-eqclip', { attr: { width: 0 } }, { attr: { width: 900 }, duration: 1.4, ease: 'steps(21)', immediateRender: false }, b1 + 5.0)
    fade(tl, '.f2-lab-v', 1, b1 + 6.4, 0.4)
    fade(tl, '.f2-lab-F', 1, b1 + 6.8, 0.4)
    fade(tl, '.f2-lab-V', 1, b1 + 7.2, 0.4)

    /* b2: the curves draw; crossovers glow. */
    const b2 = b1 + 8.8
    tl.addLabel('b2', b2)
    show('.f2-chart', b2, 0.6)
    camChart.to(tl, { x: 760, y: 460, zoom: 1.06 }, b2, 10, 'sine.inOut')
    fade(tl, '.f2-axes', 1, b2 + 0.3, 0.6)
    CURVES.forEach((c, i) => {
      const t = b2 + 1.0 + (i < 2 ? i * 0.9 : 2.6 + (i - 2) * 1.4)
      tl.fromTo(`.f2-curve-${c.id}`, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.6, ease: 'power1.inOut', immediateRender: false }, t)
      fade(tl, `.f2-cname-${c.id}`, 1, t + 1.3, 0.4)
    })
    CROSS.forEach((_, i) => {
      fade(tl, `.f2-cross-${i}`, 1, b2 + 7.2 + i * 0.35, 0.3)
      tl.fromTo(`.f2-cross-${i}`, { scale: 2.4 }, { scale: 1, duration: 0.5, ease: 'back.out(2)', transformOrigin: '50% 50%', immediateRender: false }, b2 + 7.2 + i * 0.35)
    })
    fade(tl, '.f2-lab-cross', 1, b2 + 8.4, 0.5)
    fade(tl, '.f2-illus', 1, b2 + 8.8, 0.5)

    /* b3: the factory floor becomes the manager's board. */
    const b3 = b2 + 10.4
    tl.addLabel('b3', b3)
    show('.f2-board', b3, 0.8)
    camBoard.to(tl, { x: 800, y: 450, zoom: 1.0 }, b3, 2.2, 'sine.out')
    fade(tl, '.f2-board-ui', 1, b3 + 0.5, 0.8)

    /* b4: metal injection moulding, step by step along a bench. */
    const b4 = b3 + 2.4
    tl.addLabel('b4', b4)
    show('.f2-mim', b4, 0.6)
    camMim.to(tl, { x: ST[0] + 60, y: 520, zoom: 1.6 }, b4, 0.01)
    fade(tl, '.f2-mlab-0', 1, b4 + 0.6, 0.4)
    camMim.to(tl, { x: ST[1] + 40, y: 520, zoom: 1.6 }, b4 + 2.2, 1.4, 'power2.inOut')
    tl.fromTo('.f2-greengear', { y: -220, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out', immediateRender: false }, b4 + 3.0)
    fade(tl, '.f2-mlab-1', 1, b4 + 3.5, 0.4)
    camMim.to(tl, { x: ST[2] + 20, y: 520, zoom: 1.6 }, b4 + 5.0, 1.4, 'power2.inOut')
    fade(tl, '.f2-smoke', 1, b4 + 5.6, 0.6)
    fade(tl, '.f2-debound', 1, b4 + 4.9, 0.5)
    tl.fromTo('.f2-debound', { opacity: 1 }, { opacity: 0.55, duration: 1.6, immediateRender: false }, b4 + 5.8)
    fade(tl, '.f2-mlab-2', 1, b4 + 6.0, 0.4)
    camMim.to(tl, { x: ST[3] - 40, y: 520, zoom: 1.5 }, b4 + 7.4, 1.4, 'power2.inOut')
    fade(tl, '.f2-sinter', 1, b4 + 7.4, 0.5)
    fade(tl, '.f2-furnaceglow', 1, b4 + 8.0, 0.8, 0.3)
    tl.fromTo('.f2-sinter', { scale: 1 }, { scale: 0.82, duration: 1.8, ease: 'power2.inOut', svgOrigin: `${ST[3]} 520`, immediateRender: false }, b4 + 8.4)
    fade(tl, '.f2-shiny', 1, b4 + 9.4, 0.8)
    fade(tl, '.f2-ghostsize', 1, b4 + 8.4, 0.4)
    fade(tl, '.f2-mlab-3', 1, b4 + 9.2, 0.4)
    camMim.to(tl, { x: 840, y: 470, zoom: 0.98 }, b4 + 10.2, 2.0, 'power2.inOut')
    fade(tl, '.f2-worth', 1, b4 + 11.0, 0.6)
    tl.to({}, { duration: 0.2 }, b4 + 13.0)
  }, [])
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.f2-lamp', { opacity: 0.75, duration: 1.9, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.f2-crossglow', { opacity: 0.35, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.f2-flame', { opacity: 0.6, duration: 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  /* keep the round animation in step with pause */
  useEffect(() => {
    const t = runTween.current
    if (!t) return
    if (playing) t.resume()
    else t.pause()
  }, [playing])
  useEffect(() => () => void runTween.current?.kill(), [])

  /* ---------- what Pip sees ---------- */
  const V = ROUNDS[Math.min(round, 2)].V
  const projected = roundCost(picks, V)
  const total = results.reduce((a, b) => a + b, 0)
  useEffect(() => {
    if (cueIndex === 3) {
      const pickText = PARTS.map((p) => `${p.name}: ${procOf(p, picks[p.id]).name}`).join(', ')
      reportState(
        'The tooling bet play. The learner is the factory manager. Four hand parts in rows (finger shell, tiny gear, palm frame, fingertip skin), each with process chips showing tooling cost F, per-part cost v and lead time. ' +
          'Options: finger shell CNC ($0 tool, $60/part), 3D print ($0, $12), rapid mould ($4,000 tool that wears out every 5,000 parts, $0.50), steel mould ($15,000, $0.40); tiny gear CNC ($40), print ($8), MIM ($40,000 tool, $1.20); palm frame CNC ($200), print ($30), die cast ($60,000 die, $4); fingertip skin soft silicone mould ($2,500, wears out every 5,000, $3) or steel overmould tool ($12,000, $0.80). ' +
          `Three rounds: 200 hands, then 50,000, then a design change scraps the moulds and 50,000 more of the new design. Target: finish all three rounds under $1,000,000 total. Attempt ${attempt} of 2. ` +
          `Now: round ${round + 1} (${ROUNDS[Math.min(round, 2)].V.toLocaleString('en-US')} hands), phase ${phase}. Current picks: ${pickText}. This round would cost ${money(projected)} (${perHand(projected / V)} a hand). Results so far: ${results.map((r, i) => `round ${i + 1} ${money(r)}`).join(', ') || 'none'}; running total ${money(total)}. ` +
          `Best choices: round 1 (200 hands) ${BEST[0].join(', ')}; rounds 2 and 3 (50,000) ${BEST[1].join(', ')}, which gives about $907,000 in total. ` +
          'Likely mix-ups: buying moulds for a 200-hand order (a $15,000 mould is $75 a hand), printing or machining 50,000 parts, choosing soft tools that wear out every 5,000 parts for a 50,000 order, and forgetting that a design change means paying for the tools again.',
      )
      setHints(['With only two hundred hands, a fifteen-thousand-dollar mould costs seventy-five dollars a hand before any plastic.', 'Before a big order, ask which mould pays for itself.', 'Tesla redesigned its hand after tooling up. Leave room for change.'])
    } else {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
    }
  }, [cueIndex, picks, round, results, phase, attempt, projected, total, V, reportState, setHints])

  /* ---------- play actions ---------- */
  const pick = (part: Part, id: string) => {
    if (!betting || phase !== 'pick') return
    setPicks((p) => ({ ...p, [part.id]: id }))
    emit({ type: 'progress', detail: `round ${round + 1}: ${part.name} → ${procOf(part, id).name}` })
  }

  const finish = (all: number[]) => {
    const sum = all.reduce((a, b) => a + b, 0)
    const under = sum <= TARGET
    emit({ type: 'attempt', correct: under, detail: `finished three rounds at ${money(sum)} (target ${money(TARGET)})` })
    memory.toolingTotal = sum
    if (under || attempt >= 2) {
      setPhase('done')
      void say('Tool too early and a design change scraps your moulds. Tool too late and every part costs a fortune. Timing the switch is the whole game.')
      playDoneRef.current()
    } else {
      setPhase('over')
    }
  }

  const run = () => {
    if (!betting || phase !== 'pick') return
    const cost = roundCost(picks, V)
    setPhase('running')
    setRunT(0)
    const o = { t: 0 }
    runTween.current?.kill()
    runTween.current = gsap.to(o, {
      t: 1,
      duration: 2.6,
      ease: 'power1.inOut',
      paused: !playingRef.current,
      onUpdate: () => setRunT(o.t),
      onComplete: () => {
        const all = [...results, cost]
        setResults(all)
        setRunT(0)
        emit({ type: 'progress', detail: `ran round ${round + 1}: ${money(cost)}` })
        if (round < 2) {
          if (round === 1) setScrapped(picks)
          setRound(round + 1)
          setPhase('pick')
        } else {
          finish(all)
        }
      },
    })
  }

  const retry = () => {
    if (phase !== 'over') return
    setAttempt(2)
    setRound(0)
    setResults([])
    setScrapped(null)
    setPicks(START)
    setPhase('pick')
    emit({ type: 'progress', detail: 'started a second try' })
  }

  /* ---------- board helpers ---------- */
  const roundCosts = PARTS.map((part) => partCost(procOf(part, picks[part.id]), V))
  const maxRow = Math.max(...roundCosts.map((c) => c.tool + c.run), 1)
  const shown = phase === 'running' ? projected * runT : projected
  const builtNow = phase === 'running' ? Math.round(V * runT) : 0
  const meterMax = TARGET * 1.6
  const totalShown = total + (phase === 'running' ? projected * runT : 0)

  return (
    <g ref={root}>
      <FactoryCSS />
      <defs>
        <pattern id="f2-tiny" width={10} height={6} patternUnits="userSpaceOnUse">
          <rect x={1} y={1} width={8} height={4} rx={2} fill={C.shellMid} />
        </pattern>
        <clipPath id="f2-eqclipper">
          <rect className="f2-eqclip" x={380} y={680} width={0} height={110} />
        </clipPath>
      </defs>

      {/* ---------- b0: the steel mould and the cheap parts ---------- */}
      <g className="f2-bench" ref={benchShot} pointerEvents="none">
        <g data-depth="0.4">
          <FactoryBack seed={12} />
          <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink} opacity={0.45} />
        </g>
        <g data-depth="1">
          <g className="f2-lamp">
            <Pool x={820} y={560} r={560} color="key" opacity={0.95} />
          </g>
          {/* the table */}
          <rect x={200} y={600} width={1200} height={30} fill={C.ink3} />
          <rect x={200} y={600} width={1200} height={5} fill={C.keyDeep} opacity={0.7} />
          <rect x={240} y={630} width={24} height={300} fill={C.ink1} />
          <rect x={1336} y={630} width={24} height={300} fill={C.ink1} />
          <ellipse className="f2-dustpuff" cx={800} cy={600} rx={260} ry={40} fill={C.keyLight} opacity={0} filter="url(#cn-dof-2)" />
          <g className="f2-mould">
            <MouldBlock x={800} y={490} s={1.05} />
            <g className="f2-tag" opacity={0}>
              <PriceTag x={960} y={470} text="$15,000" size={40} len={70} />
            </g>
          </g>
          {/* the belt of parts in front */}
          <g className="f2-belt" opacity={0}>
            <rect x={-400} y={800} width={2400} height={36} fill={C.ink2} />
            <rect x={-400} y={800} width={2400} height={4} fill={C.slate} />
            {Array.from({ length: 30 }, (_, i) => (
              <circle key={i} cx={-380 + i * 80} cy={818} r={12} fill={C.ink3} stroke={C.ink4} strokeWidth={2} />
            ))}
            <g className="f2-stream">
              {Array.from({ length: 9 }, (_, i) => (
                <g key={i} transform={`translate(${180 + i * 170} 770)`}>
                  <FingerShell x={0} y={0} s={0.55} />
                  <PriceTag x={30} y={14} text="$0.40" size={20} len={18} color={C.goldLight} />
                </g>
              ))}
            </g>
            <Label className="f2-lab-pennies" x={1100} y={740} tx={1240} ty={680} text="each part: pennies" color={C.goldLight} />
          </g>
        </g>
        <g data-depth="1.6">
          <rect x={-400} y={-300} width={160} height={1400} fill={C.ink} filter="url(#cn-dof-3)" />
        </g>
      </g>

      {/* ---------- b1: the mould's price sliced over the parts; the formula ---------- */}
      <g className="f2-formula" opacity={0} pointerEvents="none">
        <Blueprint />
        <Pool x={800} y={400} r={700} color="gold" opacity={0.12} />
        {/* a hundred parts */}
        <g className="f2-p100" opacity={0}>
          <text x={350} y={200} textAnchor="middle" fill={C.paper} fontFamily={SANS} fontSize={30} fontWeight={600}>
            100 parts
          </text>
          {Array.from({ length: 100 }, (_, i) => (
            <rect key={i} x={160 + (i % 10) * 38} y={300 + Math.floor(i / 10) * 26} width={32} height={14} rx={7} fill={C.shell} />
          ))}
          {Array.from({ length: 100 }, (_, i) => (
            <rect key={i} className="f2-cap" x={160 + (i % 10) * 38} y={296 + Math.floor(i / 10) * 26} width={32} height={6} rx={3} fill={C.gold} opacity={0} />
          ))}
          <g className="f2-goldbar-a">
            <rect x={160} y={226} width={374} height={34} rx={4} fill={C.gold} filter="url(#cn-bloom)" />
            <text x={347} y={252} textAnchor="middle" fill={C.ink} fontFamily={MONO} fontSize={24} fontWeight={700}>
              mould $15,000
            </text>
          </g>
          <Readout className="f2-t100" x={347} y={604} anchor="middle" color={C.gold} size={30} hidden>
            $15,000 ÷ 100 = $150 a part
          </Readout>
        </g>
        {/* ten thousand parts */}
        <g className="f2-p10k" opacity={0}>
          <text x={1150} y={200} textAnchor="middle" fill={C.paper} fontFamily={SANS} fontSize={30} fontWeight={600}>
            10,000 parts
          </text>
          <rect x={900} y={300} width={500} height={250} fill="url(#f2-tiny)" />
          <rect className="f2-film" x={900} y={300} width={500} height={250} fill={C.gold} opacity={0} style={{ mixBlendMode: 'screen' }} fillOpacity={0.14} />
          <g className="f2-goldbar-b" opacity={0}>
            <rect x={900} y={226} width={374} height={34} rx={4} fill={C.gold} filter="url(#cn-bloom)" />
            <text x={1087} y={252} textAnchor="middle" fill={C.ink} fontFamily={MONO} fontSize={24} fontWeight={700}>
              mould $15,000
            </text>
          </g>
          <Readout className="f2-t10k" x={1150} y={604} anchor="middle" color={C.gold} size={30} hidden>
            $15,000 ÷ 10,000 = $1.50 a part
          </Readout>
        </g>
        {/* the formula, typed out */}
        <g className="f2-eq" opacity={0}>
          <g clipPath="url(#f2-eqclipper)">
            <text x={397} y={752} fill={C.paper} fontFamily={MONO} fontSize={64} style={{ fontVariantNumeric: 'tabular-nums' }}>
              unit cost = <tspan fill={C.goldLight}>v</tspan> + <tspan fill={C.gold}>F</tspan> / <tspan fill={C.mist}>V</tspan>
            </text>
          </g>
          <Label className="f2-lab-v" x={877} y={770} tx={830} ty={840} text="v: per-part cost" color={C.goldLight} anchor="end" />
          <Label className="f2-lab-F" x={1031} y={770} tx={1031} ty={850} text="F: tooling" color={C.gold} anchor="middle" />
          <Label className="f2-lab-V" x={1184} y={770} tx={1240} ty={840} text="V: how many you make" color={C.mist} anchor="start" />
        </g>
        <Vignette />
      </g>

      {/* ---------- b2: every process is a curve ---------- */}
      <g className="f2-chart" ref={chartShot} opacity={0} pointerEvents="none">
        <g data-depth="0.5">
          <Blueprint />
          <Dust x={-200} y={0} w={2000} h={900} count={24} seed={31} color={C.goldLight} size={0.6} />
        </g>
        <g data-depth="1">
          <g className="f2-axes" opacity={0}>
            <line x1={260} y1={740} x2={1400} y2={740} stroke={C.fog} strokeWidth={2} />
            <line x1={260} y1={740} x2={260} y2={150} stroke={C.fog} strokeWidth={2} />
            {[10, 100, 1000, 1e4, 1e5, 1e6].map((v) => (
              <g key={v}>
                <line x1={CX(v)} x2={CX(v)} y1={740} y2={160} stroke={C.ink4} strokeDasharray="3 9" />
                <text x={CX(v)} y={774} textAnchor="middle" fill={C.mist} fontFamily={MONO} fontSize={19}>
                  {v >= 1e6 ? '1M' : v >= 1000 ? `${v / 1000}k` : v}
                </text>
              </g>
            ))}
            {[0.1, 1, 10, 100, 1000, 10000].map((c) => (
              <text key={c} x={244} y={CY(c) + 6} textAnchor="end" fill={C.mist} fontFamily={MONO} fontSize={19}>
                {c < 1 ? '$0.10' : c >= 1000 ? `$${c / 1000}k` : `$${c}`}
              </text>
            ))}
            <text x={830} y={820} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={22}>
              how many parts you make (log scale)
            </text>
            <text x={260} y={128} fill={C.mist} fontFamily={SANS} fontSize={22}>
              cost of one part (log scale)
            </text>
          </g>
          {CURVES.map((c) => (
            <g key={c.id}>
              <path className={`f2-curve-${c.id}`} d={curvePath(c.F, c.v)} pathLength={1} fill="none" stroke={c.color} strokeWidth={c.id === 'inj' ? 6 : 4} strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset={1} opacity={c.id === 'print' ? 0.85 : 1} filter={c.id === 'inj' ? 'url(#cn-bloom)' : undefined} />
              <text className={`f2-cname-${c.id}`} x={1392} y={CY(c.v + c.F / 1e6) + (c.id === 'mim' ? 14 : c.id === 'die' ? -6 : 6)} opacity={0} textAnchor="end" fill={c.color} fontFamily={SANS} fontSize={22} fontWeight={600} stroke={C.ink1} strokeWidth={5} style={{ paintOrder: 'stroke' }} transform="translate(0 -14)">
                {c.name}
              </text>
            </g>
          ))}
          {CROSS.map((x, i) => (
            <g key={i} className={`f2-cross-${i}`} opacity={0}>
              <circle className="f2-crossglow" cx={CX(x.V)} cy={CY(x.c)} r={22} fill={C.gold} opacity={0.2} />
              <circle cx={CX(x.V)} cy={CY(x.c)} r={8} fill={C.gold} filter="url(#cn-bloom)" />
            </g>
          ))}
          <Label className="f2-lab-cross" x={CX(CROSS[1].V)} y={CY(20) + 10} tx={CX(CROSS[1].V) + 40} ty={CY(20) + 120} text="crossover: switch process here" color={C.gold} />
          <SourceNote className="f2-illus" x={1392} y={128} anchor="end">
            illustrative numbers
          </SourceNote>
        </g>
        <Vignette />
      </g>

      {/* ---------- b3: the manager's board (the play) ---------- */}
      <g className="f2-board" opacity={0}>
        <g ref={boardBg} pointerEvents="none">
          <g data-depth="0.5">
            <FactoryBack seed={21} />
            <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink} opacity={0.72} />
            <Pool x={600} y={460} r={700} color="gold" opacity={0.1} />
          </g>
        </g>
        <g className="f2-board-ui" opacity={0}>
          {/* header: the round and the order */}
          <text x={70} y={92} fill={C.paper} fontFamily={SERIF} fontSize={44} fontWeight={600}>
            {phase === 'done' ? 'All three rounds done' : `Round ${Math.min(round, 2) + 1} of 3`}
            {attempt === 2 && phase !== 'done' && (
              <tspan fill={C.mist} fontSize={24} fontFamily={SANS} fontWeight={400}>
                {'  '}· second try
              </tspan>
            )}
          </text>
          <text x={70} y={140} fill={round === 2 ? C.danger : C.goldLight} fontFamily={SANS} fontSize={26} fontWeight={500}>
            {ROUNDS[Math.min(round, 2)].text}
          </text>
          <text x={CHIP_X - CHIP_W / 2} y={200} fill={C.fog} fontFamily={SANS} fontSize={18} letterSpacing={2}>
            HOW TO MAKE IT · tooling · per part · lead time
          </text>
          <text x={BAR_X} y={200} fill={C.fog} fontFamily={SANS} fontSize={18} letterSpacing={2}>
            THIS ROUND
          </text>

          {PARTS.map((part, r) => {
            const y = ROW_Y[r]
            const cur = procOf(part, picks[part.id])
            const c = roundCosts[r]
            const sum = c.tool + c.run
            return (
              <g key={part.id}>
                {/* the part itself */}
                <g transform={`translate(110 ${y - 8})`}>
                  {part.id === 'shell' && <FingerShell x={0} y={0} s={0.42} />}
                  {part.id === 'gear' && <Gear x={0} y={0} r={30} teeth={12} />}
                  {part.id === 'palm' && (
                    <g>
                      <rect x={-44} y={-34} width={88} height={68} rx={12} fill="url(#cn-metal)" stroke={C.metalDark} strokeWidth={2} />
                      {[-24, 0, 24].map((hx) => (
                        <circle key={hx} cx={hx} cy={-16} r={6} fill={C.ink2} />
                      ))}
                      <rect x={-28} y={4} width={56} height={18} rx={6} fill={C.ink2} />
                    </g>
                  )}
                  {part.id === 'skin' && (
                    <g>
                      <path d="M-20 30 L-20 -10 Q-20 -36 0 -36 Q20 -36 20 -10 L20 30 Z" fill="#3a3f4c" stroke={C.slate} strokeWidth={2} />
                      <path d="M-12 -20 Q-6 -30 4 -30" stroke={C.mist} strokeWidth={3} fill="none" opacity={0.6} />
                    </g>
                  )}
                </g>
                <text x={170} y={y - 4} fill={C.paper} fontFamily={SANS} fontSize={24} fontWeight={600}>
                  {part.name}
                </text>
                <text x={170} y={y + 22} fill={C.fog} fontFamily={SANS} fontSize={16}>
                  one per hand
                </text>
                {part.procs.map((p, k) => {
                  const cx = CHIP_X + k * CHIP_GAP
                  const on = cur.id === p.id
                  return (
                    <g key={p.id}>
                      <Chip x={cx} y={y - 10} w={CHIP_W} h={46} text={p.name} color={p.F ? C.gold : C.mist} active={on} disabled={!betting || phase !== 'pick'} onClick={() => pick(part, p.id)} tutor={`${part.id}-${p.id}`} />
                      <text x={cx} y={y + 32} textAnchor="middle" fill={on ? C.goldLight : C.fog} fontFamily={MONO} fontSize={14}>
                        {p.F ? `tool $${p.F / 1000}k${p.life ? ' /5k parts' : ''}` : 'no tool'}
                      </text>
                      <text x={cx} y={y + 50} textAnchor="middle" fill={on ? C.goldLight : C.fog} fontFamily={MONO} fontSize={14}>
                        {`$${p.v < 1 ? p.v.toFixed(2) : p.v.toFixed(p.v % 1 ? 2 : 0)} · ${p.wk} wk`}
                      </text>
                      {scrapped && round === 2 && scrapped[part.id] === p.id && p.F > 0 && (
                        <g transform={`translate(${cx + 34} ${y - 40}) rotate(-8)`} pointerEvents="none">
                          <rect x={-48} y={-14} width={96} height={28} rx={4} fill={C.ink1} stroke={C.danger} strokeWidth={2.5} />
                          <text x={0} y={7} textAnchor="middle" fill={C.danger} fontFamily={MONO} fontSize={18} fontWeight={700} letterSpacing={3}>
                            SCRAP
                          </text>
                        </g>
                      )}
                    </g>
                  )
                })}
                {/* this part's cost this round: tooling (bright gold) and running (dark gold) */}
                <g>
                  <rect x={BAR_X} y={y - 22} width={BAR_W} height={22} rx={4} fill={C.ink3} />
                  <rect x={BAR_X} y={y - 22} width={(BAR_W * c.tool) / maxRow * (phase === 'running' ? runT : 1)} height={22} rx={4} fill={C.gold} />
                  <rect x={BAR_X + (BAR_W * c.tool) / maxRow * (phase === 'running' ? runT : 1)} y={y - 22} width={(BAR_W * c.run) / maxRow * (phase === 'running' ? runT : 1)} height={22} fill={C.goldDark} opacity={0.75} />
                  <text x={BAR_X} y={y + 18} fill={C.goldLight} fontFamily={MONO} fontSize={18}>
                    {money(phase === 'running' ? sum * runT : sum)}
                  </text>
                  <text x={BAR_X + BAR_W} y={y + 18} textAnchor="end" fill={C.fog} fontFamily={MONO} fontSize={14}>
                    {c.tools > 0 ? `${c.tools} tool${c.tools > 1 ? 's' : ''}` : 'no tool'}
                  </text>
                </g>
              </g>
            )
          })}

          {/* the order book on the right */}
          <g>
            <text x={PANEL_X} y={200} fill={C.fog} fontFamily={SANS} fontSize={18} letterSpacing={2}>
              ORDER BOOK
            </text>
            {ROUNDS.map((r, i) => (
              <g key={i}>
                <text x={PANEL_X} y={244 + i * 38} fill={i === round && phase !== 'done' ? C.paper : C.mist} fontFamily={SANS} fontSize={20}>
                  {i + 1}. {r.V.toLocaleString('en-US')} hands
                </text>
                <text x={1550} y={244 + i * 38} textAnchor="end" fill={results[i] !== undefined ? C.gold : C.fog} fontFamily={MONO} fontSize={20}>
                  {results[i] !== undefined ? money(results[i]) : i === round && phase === 'running' ? money(shown) : '—'}
                </text>
              </g>
            ))}
            <line x1={PANEL_X} x2={1550} y1={366} y2={366} stroke={C.ink4} strokeWidth={2} />
            <text x={PANEL_X} y={400} fill={C.mist} fontFamily={SANS} fontSize={18}>
              total so far
            </text>
            <Readout x={1550} y={444} anchor="end" color={totalShown > TARGET ? C.danger : C.gold} size={40}>
              {money(totalShown)}
            </Readout>
            {/* budget meter: target marked */}
            <rect x={PANEL_X} y={466} width={290} height={14} rx={7} fill={C.ink3} />
            <rect x={PANEL_X} y={466} width={Math.min(290, (290 * totalShown) / meterMax)} height={14} rx={7} fill={totalShown > TARGET ? C.danger : C.gold} />
            <line x1={PANEL_X + (290 * TARGET) / meterMax} x2={PANEL_X + (290 * TARGET) / meterMax} y1={456} y2={490} stroke={C.paper} strokeWidth={2} strokeDasharray="3 3" />
            <text x={PANEL_X + (290 * TARGET) / meterMax} y={510} textAnchor="middle" fill={C.paper} fontFamily={MONO} fontSize={15}>
              budget $1M
            </text>
            {/* this round's plan */}
            {phase !== 'done' && phase !== 'over' && (
              <g>
                <text x={PANEL_X} y={560} fill={C.mist} fontFamily={SANS} fontSize={18}>
                  {phase === 'running' ? `building… ${builtNow.toLocaleString('en-US')} hands` : 'this round, as picked'}
                </text>
                <Readout x={PANEL_X} y={600} color={C.goldLight} size={30}>
                  {money(shown)}
                </Readout>
                <text x={PANEL_X} y={630} fill={C.goldLight} fontFamily={MONO} fontSize={18} opacity={0.85}>
                  = {perHand(projected / V)} a hand
                </text>
                {/* the order filling up: ten crates */}
                {Array.from({ length: 10 }, (_, i) => (
                  <rect key={i} x={PANEL_X + i * 29} y={652} width={24} height={20} rx={3} fill={phase === 'running' && runT * 10 > i ? C.gold : C.ink3} />
                ))}
                <Chip x={PANEL_X + 145} y={730} w={290} h={60} text={phase === 'running' ? 'Building…' : `Run round ${round + 1}`} color={C.gold} active={phase === 'pick' && betting} disabled={!betting || phase !== 'pick'} onClick={run} tutor="run-round" />
              </g>
            )}
            {phase === 'over' && (
              <g>
                <text x={PANEL_X} y={570} fill={C.danger} fontFamily={SANS} fontSize={22} fontWeight={600}>
                  Over budget by {money(total - TARGET)}
                </text>
                <text x={PANEL_X} y={602} fill={C.mist} fontFamily={SANS} fontSize={18}>
                  Look at which rows ate the money.
                </text>
                <Chip x={PANEL_X + 145} y={680} w={290} h={60} text="Try again" color={C.gold} active onClick={retry} tutor="retry" />
              </g>
            )}
            {phase === 'done' && (
              <text x={PANEL_X} y={580} fill={total <= TARGET ? C.lime : C.mist} fontFamily={SANS} fontSize={24} fontWeight={600}>
                {total <= TARGET ? `Under budget: ${money(total)}` : `Finished at ${money(total)}`}
              </text>
            )}
          </g>
        </g>
        <Vignette />
      </g>

      {/* ---------- b4: metal injection moulding ---------- */}
      <g className="f2-mim" ref={mimShot} opacity={0} pointerEvents="none">
        <g data-depth="0.45">
          <FactoryBack seed={33} />
          <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink} opacity={0.4} />
        </g>
        <g data-depth="1">
          {/* the bench */}
          <rect x={-200} y={600} width={2100} height={26} fill={C.ink3} />
          <rect x={-200} y={600} width={2100} height={4} fill={C.keyDeep} opacity={0.6} />
          <rect x={-200} y={626} width={2100} height={400} fill={C.ink1} />
          {ST.map((x) => (
            <Pool key={x} x={x} y={520} r={260} color="key" opacity={0.55} />
          ))}
          {/* 1: feedstock pellets */}
          <g>
            <path d={`M${ST[0] - 120} 600 Q${ST[0]} 470 ${ST[0] + 120} 600 Z`} fill={C.slate} />
            {Array.from({ length: 46 }, (_, i) => {
              const a = (i * 137.5 * Math.PI) / 180
              const rr = Math.sqrt(i / 46)
              const px = ST[0] + Math.cos(a) * rr * 100
              const pyy = 590 - Math.abs(Math.sin(a)) * rr * 90 - (1 - rr) * 60
              return <ellipse key={i} cx={px} cy={pyy} rx={9} ry={7} fill={i % 3 ? '#8b93a1' : '#a3abb8'} stroke={C.ink3} strokeWidth={1} />
            })}
            <Label className="f2-mlab-0" x={ST[0]} y={520} tx={ST[0]} ty={360} text="metal powder + glue" sub="feedstock pellets" color={C.paper} anchor="middle" />
          </g>
          {/* 2: the green part, out of the mould, oversized and dull */}
          <g>
            <rect x={ST[1] - 150} y={420} width={110} height={180} fill="url(#cn-metal)" stroke={C.metalDark} strokeWidth={2} />
            <rect x={ST[1] + 140} y={420} width={110} height={180} fill="url(#cn-metal)" stroke={C.metalDark} strokeWidth={2} />
            <g className="f2-greengear" opacity={0}>
              <Gear x={ST[1] + 50} y={520} r={80} teeth={16} fill="#6f7685" stroke="#545b69" />
            </g>
            <Label className="f2-mlab-1" x={ST[1] + 50} y={440} tx={ST[1] + 50} ty={330} text="moulded “green” gear" sub="oversized, dull, fragile" color={C.paper} anchor="middle" />
          </g>
          {/* 3: the glue burned off */}
          <g>
            <g className="f2-debound" opacity={0}>
              <Gear x={ST[2]} y={520} r={80} teeth={16} fill="#6f7685" stroke="#545b69" />
            </g>
            <g className="f2-smoke" opacity={0}>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <circle key={i} className="f5-rise" style={{ animationDelay: `${-i * 0.5}s` }} cx={ST[2] - 50 + i * 16} cy={450} r={10 + (i % 3) * 5} fill={C.mist} opacity={0.3} />
              ))}
            </g>
            <Label className="f2-mlab-2" x={ST[2] + 70} y={470} tx={ST[2] + 70} ty={310} text="glue burned off" color={C.paper} anchor="middle" />
          </g>
          {/* 4: the furnace; it shrinks and turns to solid metal */}
          <g>
            <rect x={ST[3] - 190} y={330} width={380} height={290} rx={12} fill={C.ink3} />
            <rect x={ST[3] - 160} y={360} width={320} height={240} rx={6} fill={C.ink} />
            <g className="f2-furnaceglow" opacity={0.3}>
              <rect x={ST[3] - 160} y={360} width={320} height={240} rx={6} fill={C.keyDeep} opacity={0.7} />
              <g className="f2-flame">
                <Pool x={ST[3]} y={520} r={260} color="key" opacity={1} />
              </g>
            </g>
            <circle className="f2-ghostsize" cx={ST[3]} cy={520} r={80} fill="none" stroke={C.paper} strokeWidth={2} strokeDasharray="6 6" opacity={0} />
            <g className="f2-sinter" opacity={0}>
              <Gear x={ST[3]} y={520} r={80} teeth={16} fill="#7a808c" stroke="#545b69" />
              <g className="f2-shiny" opacity={0}>
                <Gear x={ST[3]} y={520} r={80} teeth={16} />
              </g>
            </g>
            <Label className="f2-mlab-3" x={ST[3] + 70} y={470} tx={ST[3] + 30} ty={290} text="baked: shrinks 15–20%" sub="solid, strong, precise" color={C.paper} anchor="middle" />
          </g>
          <text className="f2-worth" x={840} y={790} opacity={0} textAnchor="middle" fill={C.gold} fontFamily={SANS} fontSize={40} fontWeight={600}>
            worth it at ~100,000 parts a year
          </text>
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M${ST[i] + 150} 700 L${ST[i + 1] - 150} 700`} stroke={C.goldDark} strokeWidth={3} markerEnd="url(#cn-arrow)" opacity={0.7} />
          ))}
        </g>
        <Vignette />
      </g>
    </g>
  )
}

export const ch2: Chapter = {
  id: 'tooling',
  title: 'The tooling bet',
  cues: CUES,
  Scene: Ch2Tooling,
  enter: { type: 'dissolve' },
  deeper: [ProcessReading],
}
