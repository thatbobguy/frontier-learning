import gsap from 'gsap'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { rng } from '../../../art2/fx'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { camera } from '../../../cine/camera'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { POSES, Person, rig } from '../../../cine/people'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Blueprint, Chip, Dust, Label, Pool, Vignette, fade, useAmbient } from '../shared/kit'
import { LabFloor, LabSky, LabWall } from '../shared/sets'
import { Arm, Block, Mug, armRig } from './props'
import { EvaluationReading } from './readings'

export const CUES: Cue[] = [
  { id: 'test', say: 'So how do you know a robot is good enough? You test it. And testing robots is slow, expensive and surprisingly noisy.' },
  { id: 'noise', say: 'Run fifty trials and see eighty percent success, and the honest answer is: somewhere between about seventy and ninety.' },
  { id: 'which', say: 'Two robot brains. One is genuinely better. Each trial costs you time. Find out which, with as few trials as you can, and without fooling yourself.', play: true },
  { id: 'memorise', say: 'Benchmarks can fool you too. Top robot models scored about ninety-seven percent on a popular simulated test. Move the objects a little, and many dropped to near zero. They had memorised it.' },
  { id: 'arena', say: 'One new idea borrows from chatbots: let many labs pit two robot brains against each other on tasks they choose, without knowing which is which, and rank them from thousands of match-ups.' },
]

const STATE = [
  'A robotics lab test bay at night (the same rainy lab as film 1). A robot arm on a table picks up a mug and sets it on a tape mark; then Theo, a technician in a beanie and hoodie, reaches in and puts the mug back and straightens a towel, again and again. The wall clock spins as time passes and a tally of trials on a whiteboard slowly grows. The point: every real-world trial needs a human reset, so testing is slow and expensive.',
  'A blueprint chart. Fifty little dots appear (40 lime successes, 10 red failures), then fall together into one lime dot at 80% on a 50%-to-100% axis. A wide error bar stretches from 69% to 91%: "50 trials: ±11 points". The point: with 50 trials, an 80% result honestly means anywhere from about 70% to 90% (95% confidence interval, 1.96 × √(0.8 × 0.2 / 50) ≈ 0.11).',
  '',
  'A simulated tabletop in flat blueprint colours (a "SIM" view). A robot arm picks a block and drops it in a bowl: success, "97%". Then the block and the bowl shift a few centimetres, and the arm replays exactly the same motion, closing its gripper on empty air. A dashed path shows the two motions are identical. Label: "LIBERO 97% → LIBERO-PRO ~0%". The point: top models had memorised the benchmark rather than learned the skill; benchmarks can measure memorisation.',
  'A dark globe at night with seven glowing lab dots. Each lab has a small window where two unnamed robot brains (A and B, hidden) take turns at a task the lab chose: fold a towel, stack cups, open a drawer, and so on. Lime votes stream from the windows into a ranking ladder on the right, which reshuffles as results arrive. Label: "RoboArena, 2025". The point: crowdsourced, double-blind, pairwise A/B tests across many labs, ranked like chess players (a Bradley-Terry model), make evaluation cheaper and fairer.',
]

/* ---------------- the test bay ---------------- */
const TABLE = { x: 520, y: 610, w: 700 }
const BAY_ARM = { x: 640, y: 610, s: 1.15 }
const MUG_Y = -30
const MUG_START = 250
const MUG_GOAL = 120
const THEO = { x: 1340, y: 800 }

/* ---------------- the noise chart ---------------- */
const NX = (v: number) => 330 + ((v - 0.5) / 0.5) * 940
const NOISE_Y = 560
const TRIALS = (() => {
  const r = rng(12)
  const a = Array.from({ length: 50 }, (_, i) => i < 40)
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
})()
const gridX = (i: number) => 530 + (i % 10) * 60
const gridY = (i: number) => 170 + Math.floor(i / 10) * 52

/* ---------------- the play ---------------- */
const BETTER = 0.85
const WORSE = 0.78
const SIM_BETTER = 0.81
const SIM_WORSE = 0.86
const MIN_PER_TRIAL = 3
const ROW = { A: 420, B: 500 }
const WIN = { A: { x: 120, y: 60 }, B: { x: 840, y: 60 } }
const WIN_W = 640
const WIN_H = 200

/** The 95% Wilson interval for k successes in n trials. */
function wilson(k: number, n: number) {
  if (n === 0) return null
  const z = 1.96
  const p = k / n
  const d = 1 + (z * z) / n
  const c = (p + (z * z) / (2 * n)) / d
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d
  return { p, lo: Math.max(0, c - h), hi: Math.min(1, c + h) }
}
const clampX = (v: number) => NX(Math.max(0.5, Math.min(1, v)))

type Side = 'A' | 'B'
type Verdict = { pick: Side; correct: boolean; overlap: boolean; sim: boolean; kind: 'confident' | 'lucky' | 'fooled' }

/* ---------------- memorise ---------------- */
const SIMARM = { x: 430, y: 690, s: 1.45 }
const BLOCK0 = { x: 270, y: -18 }
const BOWL_X = 120
const SHIFT = 70

/* ---------------- arena ---------------- */
const GLOBE = { x: 600, y: 520, r: 240 }
const LABS = [
  { a: -150, d: 0.62, wx: 170, wy: 230, task: 'fold the towel' },
  { a: -110, d: 0.8, wx: 380, wy: 110, task: 'stack the cups' },
  { a: -60, d: 0.55, wx: 640, wy: 100, task: 'open the drawer' },
  { a: -20, d: 0.7, wx: 920, wy: 190, task: 'wipe the table' },
  { a: 160, d: 0.5, wx: 150, wy: 560, task: 'pour the beans' },
  { a: 120, d: 0.75, wx: 260, wy: 800, task: 'hang the mug' },
  { a: 40, d: 0.66, wx: 940, wy: 790, task: 'sort the blocks' },
]
const labDot = (i: number) => {
  const l = LABS[i]
  const a = (l.a * Math.PI) / 180
  return { x: GLOBE.x + Math.cos(a) * GLOBE.r * l.d, y: GLOBE.y + Math.sin(a) * GLOBE.r * l.d * 0.9 }
}
const LADDER = { x: 1160, y: 250, step: 62 }
const BRAINS = ['brain 1', 'brain 2', 'brain 3', 'brain 4', 'brain 5', 'brain 6', 'brain 7']
/** Rank of each brain (row) at three moments as the votes come in. */
const RANKS = [
  [0, 1, 2, 3, 4, 5, 6],
  [2, 0, 1, 5, 3, 4, 6],
  [3, 0, 1, 6, 2, 4, 5],
]
const SCORES = [
  [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
  [0.62, 0.71, 0.55, 0.38, 0.45, 0.58, 0.3],
  [0.6, 0.78, 0.66, 0.34, 0.5, 0.7, 0.26],
]

export function Ch2Eval({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const bayRef = useRef<SVGGElement>(null)
  const simRef = useRef<SVGGElement>(null)

  /* ---------------- the play's state ---------------- */
  const [betterIsA, setBetterIsA] = useState(() => Math.random() < 0.5)
  const [res, setRes] = useState<{ A: boolean[]; B: boolean[] }>({ A: [], B: [] })
  const [sim, setSim] = useState<{ A: boolean[]; B: boolean[] }>({ A: [], B: [] })
  const [spent, setSpent] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [done, setDone] = useState(false)
  const trialTl = useRef<Record<Side, gsap.core.Timeline | null>>({ A: null, B: null })
  const live = cueIndex === 2 && !done
  const canTest = live && !verdict

  const ci = { A: wilson(res.A.filter(Boolean).length, res.A.length), B: wilson(res.B.filter(Boolean).length, res.B.length) }
  const simRate = { A: sim.A.length ? sim.A.filter(Boolean).length / sim.A.length : null, B: sim.B.length ? sim.B.filter(Boolean).length / sim.B.length : null }
  const overlap = !ci.A || !ci.B || (ci.A.lo <= ci.B.hi && ci.B.lo <= ci.A.hi)
  const trueRate = (s: Side) => ((s === 'A') === betterIsA ? BETTER : WORSE)
  const simTrue = (s: Side) => ((s === 'A') === betterIsA ? SIM_BETTER : SIM_WORSE)
  const hours = (spent * MIN_PER_TRIAL) / 60

  const build = useCallback((tl: gsap.core.Timeline) => {
    const cam = camera(bayRef.current, { x: 820, y: 470, zoom: 1.05 })
    const scam = camera(simRef.current, { x: 800, y: 450, zoom: 1 })
    const arm = armRig(root.current, 'bay', { a1: -80, a2: 120, a3: 50, ox: MUG_START, oy: MUG_Y })
    const theo = rig(root.current, 'theo', POSES.stand)
    const sarm = armRig(root.current, 'sim', { a1: -80, a2: 120, a3: 50, ox: BLOCK0.x, oy: BLOCK0.y })

    tl.set('.c2-stats, .c2-play, .c2-sim, .c2-arena', { opacity: 0 }, 0)
    tl.set('.c2-bay', { opacity: 1 }, 0)
    tl.set('.c2-nbar', { scaleX: 0, svgOrigin: '0 0' }, 0)

    /* b0: the test bay. Trial, reset, trial, reset. The clock spins. */
    tl.addLabel('b0', 0)
    cam.to(tl, { x: 900, y: 500, zoom: 1.25 }, 0, 9.8, 'sine.inOut')
    const cycle = (t: number) => {
      arm.reach(tl, MUG_START, -120, t, 0.5, { grip: 1 })
      arm.reach(tl, MUG_START, MUG_Y, t + 0.5, 0.35)
      arm.to(tl, { grip: 0.3 }, t + 0.85, 0.15)
      arm.grab(tl, t + 1.0)
      arm.reach(tl, MUG_START, -130, t + 1.0, 0.35)
      arm.reach(tl, MUG_GOAL, -130, t + 1.35, 0.45)
      arm.reach(tl, MUG_GOAL, MUG_Y, t + 1.8, 0.3)
      arm.release(tl, t + 2.1)
      arm.to(tl, { grip: 1 }, t + 2.1, 0.15)
      arm.to(tl, { a1: -80, a2: 120, a3: 50 }, t + 2.25, 0.4)
      // Theo reaches in and puts the mug back, then straightens the towel
      theo.to(tl, { ...POSES.reach, torso: 18, armN: 74 }, t + 2.3, 0.5)
      arm.to(tl, { ox: MUG_START }, t + 2.65, 0.55)
      theo.to(tl, { ...POSES.reach, torso: 12, armN: 60, armF: 50, elbowF: 30 }, t + 3.15, 0.35)
      tl.fromTo('.c2-towel', { skewX: 0 }, { skewX: -10, duration: 0.18, yoyo: true, repeat: 1, svgOrigin: '1060 600', immediateRender: false }, t + 3.2)
      theo.to(tl, POSES.stand, t + 3.5, 0.45)
    }
    cycle(0.4)
    cycle(4.4)
    tl.fromTo('.c2-min', { rotation: 0 }, { rotation: 360 * 3, duration: 9.6, ease: 'none', svgOrigin: '0 0', immediateRender: false }, 0)
    tl.fromTo('.c2-hour', { rotation: 60 }, { rotation: 150, duration: 9.6, ease: 'none', svgOrigin: '0 0', immediateRender: false }, 0)
    tl.fromTo('.c2-tally', { opacity: 0 }, { opacity: 1, duration: 0.1, stagger: 0.42, immediateRender: false }, 0.6)
    fade(tl, '.c2-lab-reset', 1, 3, 0.5)
    fade(tl, '.c2-lab-reset', 0, 8.2, 0.5, 1)

    /* b1: fifty trials fall into one honest dot, and its error bar. */
    const b1 = 10
    tl.addLabel('b1', b1)
    fade(tl, '.c2-bay', 0, b1, 0.6, 1)
    fade(tl, '.c2-stats', 1, b1, 0.6)
    fade(tl, '.c2-noise', 1, b1, 0.01)
    tl.fromTo('.c2-tdot', { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.2, stagger: 0.03, transformOrigin: '50% 50%', immediateRender: false }, b1 + 0.3)
    fade(tl, '.c2-ncount', 1, b1 + 1.2, 0.4)
    tl.fromTo('.c2-tdot', { x: 0, y: 0 }, { x: (i) => NX(0.8) - gridX(i), y: (i) => NOISE_Y - gridY(i), duration: 0.9, ease: 'power3.in', stagger: 0.012, immediateRender: false }, b1 + 2.4)
    tl.to('.c2-tdot', { opacity: 0, duration: 0.2 }, b1 + 3.5)
    fade(tl, '.c2-ncount', 0, b1 + 2.4, 0.4, 1)
    fade(tl, '.c2-axis', 1, b1 + 1.6, 0.6)
    fade(tl, '.c2-ndot', 1, b1 + 3.3, 0.3)
    tl.fromTo('.c2-nbar', { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: 'power3.out', svgOrigin: '0 0', immediateRender: false }, b1 + 4.6)
    fade(tl, '.c2-nband', 1, b1 + 4.8, 1)
    fade(tl, '.c2-lab-noise', 1, b1 + 5.6, 0.6)
    tl.to({}, { duration: 0.1 }, b1 + 8.3)

    /* b2: the learner's turn. */
    const b2 = b1 + 8.5
    tl.addLabel('b2', b2)
    fade(tl, '.c2-noise', 0, b2, 0.5, 1)
    fade(tl, '.c2-play', 1, b2 + 0.3, 0.8)
    tl.fromTo('.c2-pc', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, immediateRender: false }, b2 + 0.4)
    tl.to({}, { duration: 0.1 }, b2 + 2.2)

    /* b3: a simulated benchmark, aced; nudge the objects, and the same motion grabs air. */
    const b3 = b2 + 2.4
    tl.addLabel('b3', b3)
    fade(tl, '.c2-stats, .c2-play', 0, b3, 0.5, 1)
    fade(tl, '.c2-sim', 1, b3, 0.6)
    scam.to(tl, { x: 760, y: 470, zoom: 1.12 }, b3, 5)
    const motion = (t: number, carry: boolean) => {
      sarm.reach(tl, BLOCK0.x, -120, t, 0.6, { grip: 1 })
      sarm.reach(tl, BLOCK0.x, BLOCK0.y, t + 0.6, 0.4)
      sarm.to(tl, { grip: 0.25 }, t + 1.0, 0.2)
      if (carry) sarm.grab(tl, t + 1.2)
      sarm.reach(tl, BLOCK0.x, -150, t + 1.2, 0.45)
      sarm.reach(tl, BOWL_X, -150, t + 1.65, 0.55)
      sarm.reach(tl, BOWL_X, -64, t + 2.2, 0.35)
      if (carry) sarm.release(tl, t + 2.55)
      sarm.to(tl, { grip: 1 }, t + 2.55, 0.2)
      sarm.to(tl, { a1: -80, a2: 120, a3: 50 }, t + 2.8, 0.6)
    }
    motion(b3 + 0.3, true)
    // the block drops into the bowl
    sarm.to(tl, { oy: -30 }, b3 + 2.6, 0.25, 'power2.in')
    tl.fromTo('.c2-path1', { strokeDashoffset: 900 }, { strokeDashoffset: 0, duration: 2.3, ease: 'none', immediateRender: false }, b3 + 0.5)
    fade(tl, '.c2-ok', 1, b3 + 2.9, 0.3)
    fade(tl, '.c2-score1', 1, b3 + 3.0, 0.4)
    // reset, then move things a few centimetres
    fade(tl, '.c2-ok', 0, b3 + 4.6, 0.3, 1)
    sarm.to(tl, { ox: BLOCK0.x, oy: BLOCK0.y }, b3 + 4.6, 0.01, 'none')
    tl.fromTo('.c2-reset', { opacity: 0.9 }, { opacity: 0, duration: 0.5, immediateRender: false }, b3 + 4.6)
    tl.fromTo('.c2-shift', { x: 0 }, { x: SHIFT * SIMARM.s, duration: 0.7, ease: 'power2.inOut', immediateRender: false }, b3 + 5.2)
    sarm.to(tl, { ox: BLOCK0.x + SHIFT }, b3 + 5.2, 0.7)
    fade(tl, '.c2-lab-shift', 1, b3 + 5.5, 0.4)
    motion(b3 + 6.2, false)
    tl.fromTo('.c2-path2', { strokeDashoffset: 900 }, { strokeDashoffset: 0, duration: 2.3, ease: 'none', immediateRender: false }, b3 + 6.4)
    fade(tl, '.c2-air', 1, b3 + 7.2, 0.3)
    fade(tl, '.c2-air', 0, b3 + 8.4, 0.5, 1)
    fade(tl, '.c2-miss', 1, b3 + 8.8, 0.3)
    fade(tl, '.c2-lab-same', 1, b3 + 8.6, 0.5)
    fade(tl, '.c2-libero', 1, b3 + 9.4, 0.6)
    tl.fromTo('.c2-libero', { scale: 0.92 }, { scale: 1, duration: 1.2, ease: 'power2.out', transformOrigin: '50% 50%', immediateRender: false }, b3 + 9.4)
    fade(tl, '.c2-memo', 1, b3 + 11.4, 0.4)
    tl.fromTo('.c2-memo', { scale: 1.5, rotation: -14 }, { scale: 1, rotation: -8, duration: 0.3, ease: 'back.out(2)', transformOrigin: '50% 50%', immediateRender: false }, b3 + 11.4)
    scam.shake(tl, b3 + 11.6, 0.4, 0.3)
    tl.to({}, { duration: 0.1 }, b3 + 12.8)

    /* b4: the arena: labs around the world, blind A/B match-ups, a ranking ladder. */
    const b4 = b3 + 13
    tl.addLabel('b4', b4)
    fade(tl, '.c2-sim', 0, b4, 0.6, 1)
    fade(tl, '.c2-arena', 1, b4, 0.6)
    tl.fromTo('.c2-globe', { rotation: -8 }, { rotation: 0, duration: 13, ease: 'none', svgOrigin: `${GLOBE.x} ${GLOBE.y}`, immediateRender: false }, b4)
    tl.fromTo('.c2-labdot', { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.3, stagger: 0.15, transformOrigin: '50% 50%', ease: 'back.out(3)', immediateRender: false }, b4 + 0.6)
    tl.fromTo('.c2-win', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.18, immediateRender: false }, b4 + 1.4)
    tl.fromTo('.c2-wire', { strokeDashoffset: 400 }, { strokeDashoffset: 0, duration: 0.6, stagger: 0.18, immediateRender: false }, b4 + 1.2)
    fade(tl, '.c2-ab', 1, b4 + 3.6, 0.4)
    fade(tl, '.c2-ladder', 1, b4 + 6.2, 0.6)
    // votes stream into the ladder in waves; the ladder reshuffles
    for (let w = 0; w < 3; w++) {
      for (let j = 0; j < LABS.length * 3; j++) {
        const lab = LABS[Math.floor(j / 3)]
        const rung = (Math.floor(j / 3) + (j % 3) * 2 + w) % 7
        const at = b4 + 6.4 + w * 1.9 + j * 0.05
        tl.fromTo(`.c2-vote-${j}`, { x: 0, y: 0 }, { x: LADDER.x - 24 - lab.wx, y: LADDER.y + rung * LADDER.step - lab.wy, duration: 1.0, ease: 'power2.in', immediateRender: false }, at)
        tl.fromTo(`.c2-vote-${j}`, { opacity: 0 }, { opacity: 1, duration: 0.1, immediateRender: false }, at)
        tl.to(`.c2-vote-${j}`, { opacity: 0, duration: 0.1 }, at + 1.0)
      }
    }
    for (let k = 1; k < 3; k++) {
      const at = b4 + 7.6 + (k - 1) * 2.8
      BRAINS.forEach((_, i) => {
        tl.fromTo(`.c2-rung-${i}`, { y: RANKS[k - 1][i] * LADDER.step }, { y: RANKS[k][i] * LADDER.step, duration: 0.7, ease: 'power2.inOut', immediateRender: false }, at)
        tl.fromTo(`.c2-rbar-${i}`, { scaleX: SCORES[k - 1][i] }, { scaleX: SCORES[k][i], duration: 0.7, ease: 'power2.out', svgOrigin: '0 0', immediateRender: false }, at)
      })
    }
    fade(tl, '.c2-lab-arena', 1, b4 + 9.0, 0.6)
    tl.to({}, { duration: 0.1 }, b4 + 13.4)
  }, [])
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.c2-blink', { opacity: 0.3, duration: 0.8, yoyo: true, repeat: -1, ease: 'steps(1)' })
    gsap.to('.c2-ring', { scale: 2.4, opacity: 0, duration: 2, repeat: -1, ease: 'power1.out', transformOrigin: '50% 50%', stagger: 0.3 })
    gsap.to('.c2-qm', { opacity: 0.35, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.2 })
    gsap.to('.c2-screen', { opacity: 0.6, duration: 1.7, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  /* ---------------- Pip ---------------- */
  useEffect(() => {
    if (cueIndex === 2) {
      const f = (s: Side) => {
        const c = ci[s]
        return c ? `${s}: ${res[s].filter(Boolean).length}/${res[s].length} = ${(c.p * 100).toFixed(0)}%, 95% interval ${(c.lo * 100).toFixed(0)}–${(c.hi * 100).toFixed(0)}%` : `${s}: not tested yet`
      }
      reportState(
        'The learner\'s turn: "Is it really 85%?". Two hidden robot brains, A and B, each in a small test bay at the top. One is truly 85% successful and the other 78%. ' +
          `Buttons: "test A once", "test B once", "test both × 10", "cheap simulator test" (instant, but secretly biased toward the worse brain), and "A is better" / "B is better" to declare. ` +
          `Real results so far: ${f('A')}; ${f('B')}. ${simRate.A !== null ? `Simulator says A ${Math.round((simRate.A ?? 0) * 100)}%, B ${Math.round((simRate.B ?? 0) * 100)}%. ` : ''}` +
          `The intervals ${overlap ? 'still overlap' : 'no longer overlap'}. Trials spent: ${spent} (≈ ${hours.toFixed(1)} hours of resets at 3 minutes each). Declarations so far: ${attempts}. ` +
          `Truth (hidden from the learner): ${betterIsA ? 'A' : 'B'} is the 85% brain. ` +
          (verdict ? `Last call: picked ${verdict.pick}, ${verdict.correct ? 'right' : 'wrong'}, ${verdict.overlap ? 'with overlapping intervals' : 'with separated intervals'}. ` : '') +
          'The play ends after a correct call with non-overlapping intervals, or after two calls. Separating 78% from 85% cleanly takes roughly 470 trials each. ' +
          'Likely mix-ups: declaring a winner from the dots alone after a handful of trials; trusting the simulator, which ranks the brains the wrong way round; thinking a 5-point gap shows up quickly.',
      )
      setHints(['Look at the bars, not just the dots. Do they overlap?', 'The simulator is fast, but is it telling the truth?'])
    } else {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
    }
    // ci and simRate are derived from res and sim
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cueIndex, res, sim, spent, attempts, verdict, betterIsA, overlap, reportState, setHints])

  /* ---------------- the play ---------------- */
  const animTrial = (s: Side, ok: boolean) => {
    trialTl.current[s]?.kill()
    const name = s === 'A' ? 'pa' : 'pb'
    const a = armRig(root.current, name, { a1: -80, a2: 120, a3: 50, ox: MUG_START, oy: MUG_Y })
    const t = gsap.timeline()
    a.reach(t, MUG_START, -110, 0, 0.22, { grip: 1 })
    a.reach(t, MUG_START, MUG_Y, 0.22, 0.16)
    a.to(t, { grip: 0.3 }, 0.38, 0.08)
    a.grab(t, 0.46)
    a.reach(t, MUG_START, -120, 0.46, 0.18)
    if (ok) {
      a.reach(t, MUG_GOAL, -120, 0.64, 0.2)
      a.reach(t, MUG_GOAL, MUG_Y, 0.84, 0.14)
      a.release(t, 0.98)
      a.to(t, { grip: 1 }, 0.98, 0.08)
    } else {
      a.reach(t, MUG_START - 60, -120, 0.64, 0.12)
      a.release(t, 0.7)
      a.to(t, { grip: 1, oy: MUG_Y }, 0.7, 0.25, 'power2.in')
    }
    a.to(t, { a1: -80, a2: 120, a3: 50 }, 1.08, 0.25)
    a.to(t, { ox: MUG_START, oy: MUG_Y }, 1.35, 0.01, 'none')
    t.fromTo(`.c2-flash-${s}`, { opacity: 0 }, { opacity: 0.9, duration: 0.1, yoyo: true, repeat: 1 }, ok ? 1.0 : 0.85)
    t.set(`.c2-flash-${s}`, { attr: { fill: ok ? C.lime : C.danger } }, 0)
    trialTl.current[s] = t
  }

  const run = (s: Side, n: number) => {
    const out: boolean[] = []
    for (let i = 0; i < n; i++) out.push(Math.random() < trueRate(s))
    return out
  }
  const test = (sides: Side[], n: number) => {
    if (!canTest) return
    const add = { A: [] as boolean[], B: [] as boolean[] }
    for (const s of sides) add[s] = run(s, n)
    setRes((r) => ({ A: [...r.A, ...add.A], B: [...r.B, ...add.B] }))
    setSpent((k) => k + n * sides.length)
    for (const s of sides) animTrial(s, add[s][add[s].length - 1])
    emit({ type: 'progress', detail: `tested ${sides.join(' and ')} ${n} time${n > 1 ? 's' : ''}` })
  }
  const simTest = () => {
    if (!canTest) return
    const mk = (s: Side) => Array.from({ length: 200 }, () => Math.random() < simTrue(s))
    setSim((r) => ({ A: [...r.A, ...mk('A')], B: [...r.B, ...mk('B')] }))
    emit({ type: 'progress', detail: 'ran the cheap simulator test (200 simulated trials each)' })
  }
  const declare = (pick: Side) => {
    if (!canTest) return
    const correct = (pick === 'A') === betterIsA
    const simFav: Side | null = simRate.A === null || simRate.B === null ? null : simRate.A > simRate.B ? 'A' : 'B'
    const kind: Verdict['kind'] = !overlap && correct ? 'confident' : correct ? 'lucky' : 'fooled'
    const v: Verdict = { pick, correct, overlap, sim: !correct && simFav === pick, kind }
    setVerdict(v)
    const n = attempts + 1
    setAttempts(n)
    emit({ type: 'attempt', correct: correct && !overlap, detail: `declared ${pick} better (${correct ? 'right' : 'wrong'}, intervals ${overlap ? 'overlapping' : 'separate'}) after ${spent} trials` })
    if (kind === 'confident' || n >= 2) {
      setDone(true)
      void say('It took you dozens of trials just to tell seventy-eight from eighty-five. Now imagine testing thousands of tasks in thousands of homes.')
      onPlayDone()
    }
  }
  const retry = () => {
    if (!live) return
    setBetterIsA(Math.random() < 0.5)
    setRes({ A: [], B: [] })
    setSim({ A: [], B: [] })
    setVerdict(null)
    emit({ type: 'progress', detail: 'started a new round with a fresh pair of brains' })
  }

  /* ---------------- static art ---------------- */
  const tally = useMemo(
    () =>
      Array.from({ length: 23 }, (_, i) => {
        const g = Math.floor(i / 5)
        const k = i % 5
        const x = 186 + g * 64 + k * 11
        return k === 4 ? <line key={i} className="c2-tally" x1={x - 50} y1={392} x2={x + 2} y2={350} stroke={C.paper} strokeWidth={3} opacity={0} /> : <line key={i} className="c2-tally" x1={x} y1={346} x2={x} y2={396} stroke={C.paper} strokeWidth={3} opacity={0} />
      }),
    [],
  )

  const dots = (s: Side) => {
    const r = res[s]
    const show = r.slice(-48)
    const x0 = WIN[s].x + 10
    return show.map((ok, i) => <circle key={i} cx={x0 + (i % 24) * 26 + 10} cy={WIN[s].y + WIN_H + 26 + Math.floor(i / 24) * 22} r={8} fill={ok ? C.lime : C.danger} />)
  }
  const row = (s: Side) => {
    const c = ci[s]
    const y = ROW[s]
    const sr = simRate[s]
    return (
      <g key={s}>
        <text x={NX(0.5) - 40} y={y + 10} fill={C.paper} fontFamily={SERIF} fontSize={34} fontWeight={600} textAnchor="end">
          {s}
        </text>
        <line x1={NX(0.5)} x2={NX(1)} y1={y} y2={y} stroke={C.slate} strokeWidth={2} strokeDasharray="4 6" />
        {c && (
          <g>
            <rect x={clampX(c.lo)} y={y - 7} width={clampX(c.hi) - clampX(c.lo)} height={14} rx={7} fill={C.lime} opacity={0.35} style={{ transition: 'all 0.4s' }} />
            <line x1={clampX(c.lo)} x2={clampX(c.lo)} y1={y - 14} y2={y + 14} stroke={C.lime} strokeWidth={3} />
            <line x1={clampX(c.hi)} x2={clampX(c.hi)} y1={y - 14} y2={y + 14} stroke={C.lime} strokeWidth={3} />
            <circle cx={clampX(c.p)} cy={y} r={11} fill={C.lime} stroke={C.ink} strokeWidth={3} />
            <text x={NX(1) + 24} y={y + 8} fill={C.limeLight} fontFamily={MONO} fontSize={20}>
              {Math.round(c.p * 100)}% ±{Math.round(((c.hi - c.lo) / 2) * 100)}
            </text>
          </g>
        )}
        {sr !== null && (
          <g>
            <path d={`M${clampX(sr)} ${y - 26} l10 10 l-10 10 l-10 -10 Z`} fill="none" stroke={C.cyan} strokeWidth={2.5} strokeDasharray="3 2" />
            <text x={clampX(sr)} y={y - 32} fill={C.cyan} fontFamily={MONO} fontSize={15} textAnchor="middle">
              sim {Math.round(sr * 100)}%
            </text>
          </g>
        )}
        {verdict && (
          <g>
            <line x1={NX(trueRate(s))} x2={NX(trueRate(s))} y1={y - 22} y2={y + 22} stroke={C.paper} strokeWidth={4} />
            <text x={NX(trueRate(s))} y={y + 40} fill={C.paper} fontFamily={MONO} fontSize={16} textAnchor="middle">
              true {Math.round(trueRate(s) * 100)}%
            </text>
          </g>
        )}
      </g>
    )
  }
  const verdictText = verdict
    ? verdict.kind === 'confident'
      ? `confident, and right: ${verdict.pick} really is the 85% brain`
      : verdict.sim
        ? `fooled by the simulator: it favours the worse brain`
        : verdict.kind === 'lucky'
          ? 'you got lucky: the bars overlap, so it could have gone either way'
          : `fooled by noise: ${verdict.pick === 'A' ? 'B' : 'A'} was really the 85% brain`
    : null

  return (
    <g ref={root}>
      {/* ---------- the test bay ---------- */}
      <g className="c2-bay" ref={bayRef} pointerEvents="none">
        <g data-depth="0.25">
          <LabSky flashClass="c2-flash" seed={17} />
        </g>
        <g data-depth="0.6">
          <LabWall windows={[[620, 60, 360, 640], [1160, 60, 360, 640]]} />
          {/* a whiteboard with the tally */}
          <rect x={150} y={280} width={360} height={150} fill="#d8dde6" opacity={0.85} />
          <rect x={150} y={280} width={360} height={150} fill={C.ink} opacity={0.35} />
          <text x={168} y={316} fill={C.ink2} fontFamily={SANS} fontSize={22} fontWeight={600}>
            trials
          </text>
          {tally}
          {/* the clock */}
          <g transform="translate(330 170)">
            <circle r={52} fill="#141b28" stroke="#2a3446" strokeWidth={5} />
            {Array.from({ length: 12 }, (_, i) => (
              <rect key={i} x={-1.5} y={-46} width={3} height={8} fill={C.mist} opacity={0.6} transform={`rotate(${i * 30})`} />
            ))}
            <g className="c2-hour">
              <line x1={0} y1={0} x2={0} y2={-24} stroke={C.paper} strokeWidth={5} strokeLinecap="round" />
            </g>
            <g className="c2-min">
              <line x1={0} y1={0} x2={0} y2={-38} stroke={C.paper} strokeWidth={3} strokeLinecap="round" />
            </g>
            <circle r={4} fill={C.paper} />
          </g>
        </g>
        <g data-depth="1">
          <LabFloor />
          <Pool x={900} y={520} r={560} color="key" opacity={0.85} />
          {/* the test table, with its tape marks */}
          <rect x={TABLE.x} y={TABLE.y} width={TABLE.w} height={20} fill={C.ink3} />
          <rect x={TABLE.x} y={TABLE.y} width={TABLE.w} height={4} fill={C.keyDeep} opacity={0.7} />
          <rect x={TABLE.x + 30} y={TABLE.y + 20} width={18} height={170} fill={C.ink1} />
          <rect x={TABLE.x + TABLE.w - 48} y={TABLE.y + 20} width={18} height={170} fill={C.ink1} />
          <rect x={BAY_ARM.x + MUG_GOAL * BAY_ARM.s - 30} y={TABLE.y - 3} width={60} height={4} fill={C.gold} />
          <rect x={BAY_ARM.x + MUG_START * BAY_ARM.s - 30} y={TABLE.y - 3} width={60} height={4} fill={C.mist} opacity={0.6} />
          <g className="c2-towel">
            <path d="M1010 610 l10 -16 h90 l10 16 Z" fill="#c86a4a" />
            <path d="M1020 600 h90" stroke="#e8a080" strokeWidth={3} />
          </g>
          <Arm name="bay" x={BAY_ARM.x} y={BAY_ARM.y} s={BAY_ARM.s} ox={MUG_START} oy={MUG_Y} obj={<Mug />} />
          <Person name="theo" x={THEO.x} y={THEO.y} s={1.05} flip hair="beanie" outfit="hoodie" top="#3d4a6b" topDark="#283250" skin={C.skinA} skinDark={C.skinADark} light="key-right" />
          <Label className="c2-lab-reset" x={THEO.x - 110} y={560} tx={THEO.x - 180} ty={340} text="every trial needs a reset" sub="≈ 1 to 5 minutes, by hand" color={C.keyLight} anchor="end" />
          <Dust x={300} y={200} w={1000} h={500} count={22} seed={8} />
        </g>
      </g>

      {/* ---------- the stats space: noise, then the play ---------- */}
      <g className="c2-stats" opacity={0} pointerEvents="none">
        <Blueprint />
        <g className="c2-noise">
          {TRIALS.map((ok, i) => (
            <g key={i} className="c2-tdot" opacity={0}>
              <circle cx={gridX(i)} cy={gridY(i)} r={14} fill={ok ? C.lime : C.danger} />
            </g>
          ))}
          <text className="c2-ncount" x={800} y={130} fill={C.mist} fontFamily={SANS} fontSize={26} textAnchor="middle" opacity={0}>
            50 trials: 40 worked, 10 failed
          </text>
          <g className="c2-axis" opacity={0}>
            <line x1={NX(0.5)} x2={NX(1)} y1={NOISE_Y} y2={NOISE_Y} stroke={C.mist} strokeWidth={2} opacity={0.6} />
            {[0.5, 0.6, 0.7, 0.8, 0.9, 1].map((v) => (
              <g key={v}>
                <line x1={NX(v)} x2={NX(v)} y1={NOISE_Y + 8} y2={NOISE_Y + 20} stroke={C.mist} strokeWidth={2} />
                <text x={NX(v)} y={NOISE_Y + 50} fill={C.mist} fontFamily={MONO} fontSize={22} textAnchor="middle">
                  {Math.round(v * 100)}%
                </text>
              </g>
            ))}
            <text x={NX(0.5)} y={NOISE_Y + 90} fill={C.fog} fontFamily={SANS} fontSize={20}>
              how often the robot succeeds
            </text>
          </g>
          <g className="c2-nband" opacity={0}>
            <rect x={NX(0.69)} y={NOISE_Y - 150} width={NX(0.91) - NX(0.69)} height={170} fill={C.lime} opacity={0.07} />
          </g>
          <g transform={`translate(${NX(0.8)} ${NOISE_Y})`}>
            <g className="c2-nbar">
              <rect x={NX(0.69) - NX(0.8)} y={-8} width={NX(0.91) - NX(0.69)} height={16} rx={8} fill={C.lime} opacity={0.45} />
              <line x1={NX(0.69) - NX(0.8)} x2={NX(0.69) - NX(0.8)} y1={-22} y2={22} stroke={C.lime} strokeWidth={4} />
              <line x1={NX(0.91) - NX(0.8)} x2={NX(0.91) - NX(0.8)} y1={-22} y2={22} stroke={C.lime} strokeWidth={4} />
            </g>
          </g>
          <g className="c2-ndot" opacity={0}>
            <circle cx={NX(0.8)} cy={NOISE_Y} r={22} fill={C.lime} stroke={C.ink} strokeWidth={4} filter="url(#cn-bloom)" />
          </g>
          <Label className="c2-lab-noise" x={NX(0.91)} y={NOISE_Y - 22} tx={NX(0.91) + 40} ty={NOISE_Y - 130} text="50 trials: ±11 points" sub="69% to 91%, at 95% confidence" color={C.limeLight} size={30} />
        </g>
      </g>

      {/* ---------- the play: is it really 85%? ---------- */}
      <g className="c2-play" opacity={0} pointerEvents={live || done ? 'auto' : 'none'}>
        {(['A', 'B'] as Side[]).map((s) => (
          <g key={s} className="c2-pc">
            <rect x={WIN[s].x} y={WIN[s].y} width={WIN_W} height={WIN_H} rx={10} fill={C.ink2} stroke={C.slate} strokeWidth={2} />
            <g clipPath={`url(#c2-clip-${s})`}>
              <Pool x={WIN[s].x + 360} y={WIN[s].y + 120} r={300} color="key" opacity={0.6} />
              <rect x={WIN[s].x} y={WIN[s].y + 170} width={WIN_W} height={30} fill={C.ink3} />
              <rect x={WIN[s].x + 200 + MUG_GOAL * 0.62 - 20} y={WIN[s].y + 168} width={40} height={3} fill={C.gold} />
              <Arm name={s === 'A' ? 'pa' : 'pb'} x={WIN[s].x + 200} y={WIN[s].y + 170} s={0.62} ox={MUG_START} oy={MUG_Y} obj={<Mug />} />
              <rect className={`c2-flash-${s}`} x={WIN[s].x} y={WIN[s].y} width={WIN_W} height={WIN_H} fill={C.lime} opacity={0} />
            </g>
            <clipPath id={`c2-clip-${s}`}>
              <rect x={WIN[s].x} y={WIN[s].y} width={WIN_W} height={WIN_H} rx={10} />
            </clipPath>
            <text x={WIN[s].x + 30} y={WIN[s].y + 64} fill={C.paper} fontFamily={SERIF} fontSize={56} fontWeight={600}>
              {s}
            </text>
            <text className="c2-qm" x={WIN[s].x + 74} y={WIN[s].y + 64} fill={C.mist} fontFamily={SERIF} fontSize={40}>
              ?
            </text>
            <text x={WIN[s].x + WIN_W - 20} y={WIN[s].y + 34} fill={C.mist} fontFamily={MONO} fontSize={18} textAnchor="end">
              {res[s].length} real trials
            </text>
            {dots(s)}
          </g>
        ))}
        <g className="c2-pc">
          {[0.5, 0.6, 0.7, 0.8, 0.9, 1].map((v) => (
            <text key={v} x={NX(v)} y={ROW.B + 64} fill={C.fog} fontFamily={MONO} fontSize={18} textAnchor="middle">
              {Math.round(v * 100)}%
            </text>
          ))}
          {row('A')}
          {row('B')}
          {verdictText && (
            <text x={800} y={604} fill={verdict?.kind === 'confident' ? C.lime : verdict?.correct ? C.gold : C.danger} fontFamily={SANS} fontSize={26} fontWeight={600} textAnchor="middle">
              {verdictText}
            </text>
          )}
          {verdict && verdict.kind !== 'confident' && (
            <text x={800} y={634} fill={C.mist} fontFamily={SANS} fontSize={19} textAnchor="middle">
              telling 78% from 85% cleanly takes roughly 470 trials each
            </text>
          )}
        </g>
        <g className="c2-pc">
          <Chip x={240} y={700} w={210} h={52} text="test A once" color={C.lime} onClick={() => test(['A'], 1)} disabled={!canTest} tutor="test A" />
          <Chip x={470} y={700} w={210} h={52} text="test B once" color={C.lime} onClick={() => test(['B'], 1)} disabled={!canTest} tutor="test B" />
          <Chip x={720} y={700} w={250} h={52} text="test both × 10" color={C.lime} onClick={() => test(['A', 'B'], 10)} disabled={!canTest} tutor="test both" />
          <Chip x={1010} y={700} w={290} h={52} text="cheap simulator test" color={C.cyan} onClick={simTest} disabled={!canTest} tutor="simulator" />
          <text x={1010} y={748} fill={C.cyan} fontFamily={SANS} fontSize={17} textAnchor="middle" opacity={0.85}>
            fast, but not the real world
          </text>
        </g>
        <g className="c2-pc">
          <Chip x={300} y={810} w={220} h={56} text="A is better" color={C.paper} onClick={() => declare('A')} disabled={!canTest} tutor="declare A" />
          <Chip x={540} y={810} w={220} h={56} text="B is better" color={C.paper} onClick={() => declare('B')} disabled={!canTest} tutor="declare B" />
          {verdict && !done && <Chip x={790} y={810} w={220} h={56} text="try a new pair" color={C.gold} onClick={retry} tutor="new round" />}
          <g transform="translate(1240 806)">
            <circle r={30} fill="none" stroke={C.mist} strokeWidth={3} />
            <line x1={0} y1={0} x2={0} y2={-20} stroke={C.mist} strokeWidth={3} transform={`rotate(${(spent * MIN_PER_TRIAL * 6) % 360})`} style={{ transition: 'transform 0.4s' }} />
            <text x={46} y={-6} fill={C.paper} fontFamily={MONO} fontSize={22}>
              {spent} trials
            </text>
            <text x={46} y={22} fill={C.mist} fontFamily={SANS} fontSize={18}>
              ≈ {hours < 10 ? hours.toFixed(1) : Math.round(hours)} hours of resetting
            </text>
          </g>
        </g>
      </g>

      {/* ---------- memorised: a simulated benchmark ---------- */}
      <g className="c2-sim" ref={simRef} opacity={0} pointerEvents="none">
        <g data-depth="0.5">
          <rect x={-600} y={-500} width={2800} height={1900} fill="#0a1426" />
          <rect x={-600} y={-500} width={2800} height={1900} fill="url(#cn-grid-big)" opacity={0.7} />
        </g>
        <g data-depth="1">
          {/* a flat simulated floor and table */}
          <path d="M-400 900 L400 700 L1500 700 L2200 900 Z" fill="#12213a" />
          {Array.from({ length: 14 }, (_, i) => (
            <line key={i} x1={400 + i * 85} y1={700} x2={-400 + i * 200} y2={900} stroke={C.cyan} strokeOpacity={0.18} />
          ))}
          <rect x={SIMARM.x - 120} y={SIMARM.y} width={900} height={18} fill="#2a4a6a" stroke={C.cyan} strokeWidth={2} />
          <text x={140} y={110} fill={C.cyan} fontFamily={MONO} fontSize={22}>
            SIM · task 37: put the block in the bowl
          </text>
          <circle className="c2-blink" cx={118} cy={102} r={7} fill={C.danger} />
          {/* the bowl */}
          <g className="c2-shift">
            <path d={`M${SIMARM.x + (BOWL_X - 60) * SIMARM.s} ${SIMARM.y - 46} q${60 * SIMARM.s} 70 ${120 * SIMARM.s} 0 Z`} fill="#3a6a9a" stroke={C.cyanLight} strokeWidth={2} />
          </g>
          <rect className="c2-reset" x={-600} y={-500} width={2800} height={1900} fill={C.cyan} opacity={0} />
          <g>
            <Arm name="sim" x={SIMARM.x} y={SIMARM.y} s={SIMARM.s} ox={BLOCK0.x} oy={BLOCK0.y} obj={<Block color={C.amber} />} shell="#b8d4ec" />
          </g>
          {/* the paths: the same motion, twice */}
          <path className="c2-path1" d={pathD()} fill="none" stroke={C.cyan} strokeWidth={3} strokeDasharray="900" strokeDashoffset="900" opacity={0.8} />
          <path className="c2-path2" d={pathD()} fill="none" stroke={C.danger} strokeWidth={3} strokeDasharray="10 8" strokeDashoffset="900" opacity={0.9} />
          <g className="c2-ok" opacity={0}>
            <circle cx={SIMARM.x + BOWL_X * SIMARM.s} cy={SIMARM.y - 120} r={34} fill="none" stroke={C.lime} strokeWidth={5} />
            <path d={`M${SIMARM.x + BOWL_X * SIMARM.s - 14} ${SIMARM.y - 120} l10 12 l20 -24`} stroke={C.lime} strokeWidth={6} fill="none" />
          </g>
          <text className="c2-score1" x={1260} y={300} fill={C.lime} fontFamily={MONO} fontSize={64} textAnchor="middle" opacity={0}>
            97%
          </text>
          <g className="c2-air" opacity={0}>
            <circle cx={SIMARM.x + BLOCK0.x * SIMARM.s} cy={SIMARM.y + BLOCK0.y * SIMARM.s} r={40} fill="url(#cn-pool-danger)" />
          </g>
          <g className="c2-miss" opacity={0}>
            <path d={`M${SIMARM.x + BLOCK0.x * SIMARM.s - 16} ${SIMARM.y - 150} l32 32 m0 -32 l-32 32`} stroke={C.danger} strokeWidth={6} />
          </g>
          <Label className="c2-lab-shift" x={SIMARM.x + (BLOCK0.x + SHIFT) * SIMARM.s} y={SIMARM.y - 40} tx={SIMARM.x + (BLOCK0.x + SHIFT) * SIMARM.s + 60} ty={SIMARM.y - 200} text="moved a few centimetres" color={C.amberLight} />
          <Label className="c2-lab-same" x={SIMARM.x + BLOCK0.x * SIMARM.s} y={SIMARM.y - 160} tx={SIMARM.x + BLOCK0.x * SIMARM.s - 120} ty={250} text="exactly the same motion, into empty air" color={C.danger} anchor="end" />
          <g className="c2-libero" opacity={0}>
            <text x={800} y={170} fill={C.paper} fontFamily={MONO} fontSize={46} textAnchor="middle">
              LIBERO 97% <tspan fill={C.danger}>→ LIBERO-PRO ~0%</tspan>
            </text>
          </g>
          <g className="c2-memo" opacity={0}>
            <rect x={1040} y={530} width={280} height={64} rx={6} fill="none" stroke={C.danger} strokeWidth={4} />
            <text x={1180} y={574} fill={C.danger} fontFamily={SANS} fontSize={32} fontWeight={700} textAnchor="middle" letterSpacing={3}>
              MEMORISED
            </text>
          </g>
        </g>
      </g>

      {/* ---------- the arena ---------- */}
      <g className="c2-arena" opacity={0} pointerEvents="none">
        <rect x={-600} y={-500} width={2800} height={1900} fill={C.ink} />
        <Dust x={0} y={0} w={1600} h={900} count={40} seed={44} color={C.paper} size={0.5} />
        <circle cx={GLOBE.x} cy={GLOBE.y} r={GLOBE.r + 60} fill="url(#cn-pool-rim)" opacity={0.4} />
        <g className="c2-globe">
          <circle cx={GLOBE.x} cy={GLOBE.y} r={GLOBE.r} fill="#0c1a2e" stroke={C.rimDeep} strokeWidth={2} />
          {[-60, -30, 0, 30, 60].map((lat) => (
            <ellipse key={lat} cx={GLOBE.x} cy={GLOBE.y + Math.sin((lat * Math.PI) / 180) * GLOBE.r} rx={Math.cos((lat * Math.PI) / 180) * GLOBE.r} ry={Math.cos((lat * Math.PI) / 180) * GLOBE.r * 0.12} fill="none" stroke={C.rim} strokeOpacity={0.18} />
          ))}
          {[0.25, 0.6, 0.9].map((k) => (
            <ellipse key={k} cx={GLOBE.x} cy={GLOBE.y} rx={GLOBE.r * k} ry={GLOBE.r} fill="none" stroke={C.rim} strokeOpacity={0.15} />
          ))}
          {/* continents, roughly */}
          <path d={`M${GLOBE.x - 170} ${GLOBE.y - 120} q60 -50 120 -20 q30 40 -10 70 q-40 20 -30 70 q-30 30 -60 -10 q-40 -40 -20 -110 Z`} fill="#1a3350" />
          <path d={`M${GLOBE.x + 10} ${GLOBE.y - 150} q70 -30 140 10 q40 50 0 80 q-40 10 -60 60 q-30 60 -50 20 q-10 -60 -40 -90 q-20 -40 10 -80 Z`} fill="#1a3350" />
          <path d={`M${GLOBE.x - 60} ${GLOBE.y + 70} q40 -10 60 30 q10 60 -20 100 q-30 -30 -40 -130 Z`} fill="#1a3350" />
          <circle cx={GLOBE.x} cy={GLOBE.y} r={GLOBE.r} fill="url(#cn-pool-dark)" opacity={0.6} />
        </g>
        {LABS.map((l, i) => {
          const d = labDot(i)
          return (
            <g key={i}>
              <path className="c2-wire" d={`M${d.x} ${d.y} L${l.wx} ${l.wy + 60}`} stroke={C.lime} strokeOpacity={0.45} strokeWidth={1.5} strokeDasharray="400" strokeDashoffset="400" fill="none" />
              <g className="c2-labdot" opacity={0}>
                <circle cx={d.x} cy={d.y} r={7} fill={C.lime} />
                <circle className="c2-ring" cx={d.x} cy={d.y} r={7} fill="none" stroke={C.lime} strokeWidth={2} />
              </g>
              <g className="c2-win" opacity={0}>
                <rect x={l.wx - 95} y={l.wy - 58} width={190} height={116} rx={8} fill={C.ink2} stroke={C.slate} strokeWidth={2} />
                <rect className="c2-screen" x={l.wx - 95} y={l.wy - 58} width={190} height={116} rx={8} fill={C.key} opacity={0.12} />
                {/* two hidden brains taking turns */}
                {[-1, 1].map((sd) => (
                  <g key={sd} transform={`translate(${l.wx + sd * 46} ${l.wy + 30})`}>
                    <path d={`M0 0 L0 -26 L${sd * 22} -40 L${sd * 30} -26`} stroke={C.shell} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    <rect x={-14} y={0} width={28} height={8} fill={C.carbon} />
                  </g>
                ))}
                <g className="c2-ab" opacity={0}>
                  <text x={l.wx - 46} y={l.wy - 28} fill={C.paper} fontFamily={MONO} fontSize={16} textAnchor="middle">
                    A?
                  </text>
                  <text x={l.wx + 46} y={l.wy - 28} fill={C.paper} fontFamily={MONO} fontSize={16} textAnchor="middle">
                    B?
                  </text>
                </g>
                <text x={l.wx} y={l.wy + 52} fill={C.mist} fontFamily={SANS} fontSize={15} textAnchor="middle">
                  {l.task}
                </text>
              </g>
              {[0, 1, 2].map((k) => (
                <circle key={k} className={`c2-vote-${i * 3 + k}`} cx={l.wx} cy={l.wy} r={6} fill={C.lime} opacity={0} />
              ))}
            </g>
          )
        })}
        <g className="c2-ladder" opacity={0}>
          <text x={LADDER.x} y={LADDER.y - 50} fill={C.paper} fontFamily={SERIF} fontSize={30} fontWeight={600}>
            Ranking
          </text>
          {BRAINS.map((b, i) => (
            <g key={b} className={`c2-rung-${i}`} transform={`translate(0 ${RANKS[0][i] * LADDER.step})`}>
              <text x={LADDER.x} y={LADDER.y + 7} fill={C.limeLight} fontFamily={MONO} fontSize={20}>
                {b}
              </text>
              <rect x={LADDER.x + 120} y={LADDER.y - 9} width={240} height={18} rx={9} fill={C.ink3} />
              <g transform={`translate(${LADDER.x + 120} ${LADDER.y - 9})`}>
                <rect className={`c2-rbar-${i}`} x={0} y={0} width={240} height={18} rx={9} fill={C.lime} transform={`scale(${SCORES[0][i]} 1)`} />
              </g>
            </g>
          ))}
        </g>
        <Label className="c2-lab-arena" x={LADDER.x + 4} y={LADDER.y + 6 * LADDER.step + 24} tx={LADDER.x + 4} ty={LADDER.y + 6 * LADDER.step + 90} text="RoboArena, 2025" sub="blind A/B match-ups, ranked like chess" color={C.limeLight} anchor="start" />
      </g>

      <Vignette />
    </g>
  )
}

/** The gripper's path for the simulated pick-and-place, in stage units (it is the same both times). */
function pathD() {
  const s = SIMARM.s
  const pts = [
    [BLOCK0.x, -120],
    [BLOCK0.x, BLOCK0.y],
    [BLOCK0.x, -150],
    [BOWL_X, -150],
    [BOWL_X, -64],
  ]
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${(SIMARM.x + x * s).toFixed(1)} ${(SIMARM.y + y * s).toFixed(1)}`).join(' ')
}

export const ch2: Chapter = {
  id: 'eval',
  title: 'Is it really 85%?',
  cues: CUES,
  Scene: Ch2Eval,
  deeper: [EvaluationReading],
}
