import gsap from 'gsap'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { camera } from '../../../cine/camera'
import { GRASPS, Hand3D, useHandStore } from '../../../cine/hand3d'
import { C, MONO, SANS } from '../../../cine/palette'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { useDrag } from '../../../engine/svg'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Chip, Dust, Label, Pool, Vignette, fade, useAmbient } from '../shared/kit'
import { Tag, TopCup, TopGripper, TopTable, TopVase, drawOn, useTicker } from './art'
import { MultimodalityReading } from './readings'
import { CLEAR, GOAL, START, VASE, averagePath, denoise, hitIndex, modeOf, pathD, samplePath, seedsForSides, strokeToPath, tenDemos, rand, type Mode, type P3, type Pt } from './sim'

export const CUES: Cue[] = [
  { id: 'obstacle', say: 'Here’s a stranger problem. Half the demonstrations go around a vase on the left. Half go around on the right. Both are fine.' },
  { id: 'average', say: 'A simple learner averages what it saw. And the average of left and right is straight down the middle.' },
  { id: 'diffusion', say: 'So modern robot policies learn the whole spread of good options, then pick one. The popular methods start from random noise and refine it, step by step, into a confident action, the same idea that powers AI image generators.' },
  { id: 'pick', say: 'Train two robots on the same messy demonstrations, one that averages and one that samples. Then add a third way around and see which one copes.', play: true },
]

const HINTS = ['Draw some paths left and some right of the vase.', 'Watch where the averager’s path goes.']

const STATE = [
  'Top-down view of a table: a vase of flowers in the middle, a mug beyond it, a robot gripper near the viewer. Ten lime demonstration paths draw in one by one: five curve round the vase on the left, five on the right. Both ways are fine. Idea: demonstrations can be multimodal (more than one good way to do the task).',
  'A white dashed line draws straight up the middle: the point-by-point average of all ten demonstrations, which goes straight through the vase. Cut to a side view: Seven’s robot hand follows the averaged path and knocks the vase over in slow motion; the camera shakes. Idea: a learner trained to minimise mean squared error predicts the average, and the average of two good options can be a bad one.',
  'Back on the tabletop: a cloud of random lime points around the vase refines step by step into a clean path that commits to the left side; run again with a new random seed, it commits to the right. Label: diffusion policy / flow matching. Idea: these policies model the whole distribution of good actions and sample one, by starting from noise and denoising it, like AI image generators.',
  '',
]

const modeName: Record<Mode, string> = { left: 'left', right: 'right', over: 'over the top' }

/** b0-b2: the ten demonstrations and what the two learners make of them. */
const DEMOS10 = tenDemos()
const AVG10 = averagePath(DEMOS10)
const MODES2 = [averagePath(DEMOS10.filter((d) => modeOf(d) === 'left')), averagePath(DEMOS10.filter((d) => modeOf(d) === 'right'))]
const SEEDS = seedsForSides(MODES2)
const NOISE_L = denoise(MODES2, SEEDS.left)
const NOISE_R = denoise(MODES2, SEEDS.right)
const NDOTS = NOISE_L[0].length

/** b1 side view: the hand's sweep and the vase. */
const SIDE = { table: 650, vaseX: 820 }

interface Demo {
  id: number
  path: P3[]
  mode: Mode
}
interface Result {
  id: number
  avg: P3[]
  avgHit: number
  sample: P3[]
  sampleMode: Mode
  sampleHit: number
  share: number
}

/** A path for drawing on the tabletop; lifted parts are drawn offset up (closer to the camera). */
const liftD = (p: P3[]) => pathD(p.map((q) => ({ x: q.x + q.z * 14, y: q.y - q.z * 22 })))

export function Ch2Modes({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const topRef = useRef<SVGGElement>(null)
  const sideRef = useRef<SVGGElement>(null)
  const dotsRef = useRef<SVGGElement>(null)
  const sweepRef = useRef<SVGGElement>(null)
  const hand = useHandStore({ pose: GRASPS.open, view: { yaw: 84, pitch: -8, roll: 180, s: 1.7 } })

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const cam = camera(topRef.current, { x: 800, y: 470, zoom: 0.94 })
      const camS = camera(sideRef.current, { x: 800, y: 470, zoom: 1.05 })
      tl.set('.d2-side', { opacity: 0 }, 0)
      tl.set('.d2-top', { opacity: 1 }, 0)

      /* b0: ten demonstrations, five each side. */
      tl.addLabel('b0', 0)
      cam.to(tl, { x: 800, y: 470, zoom: 1.04 }, 0, 9, 'sine.inOut')
      fade(tl, '.d2-lab-vase', 1, 0.4)
      DEMOS10.forEach((_, i) => {
        const at = 0.9 + i * 0.62
        drawOn(tl, `.d2-demo-${i}`, at, 1.0, 'power1.inOut')
      })
      fade(tl, '.d2-lab-left', 1, 3.4)
      fade(tl, '.d2-lab-right', 1, 4.0)
      fade(tl, '.d2-lab-fine', 1, 6.4)

      /* b1: the average goes straight through; side view, the hand knocks the vase over. */
      const b1 = 8.8
      tl.addLabel('b1', b1)
      fade(tl, '.d2-lab-left, .d2-lab-right, .d2-lab-fine, .d2-lab-vase', 0, b1, 0.5, 1)
      tl.fromTo('.d2-demos', { opacity: 1 }, { opacity: 0.4, duration: 0.8, immediateRender: false }, b1)
      drawOn(tl, '.d2-avg', b1 + 0.3, 1.6)
      fade(tl, '.d2-lab-avg', 1, b1 + 1.2)
      cam.to(tl, { x: 800, y: 470, zoom: 1.12 }, b1, 2.4)
      fade(tl, '.d2-top', 0, b1 + 2.6, 0.3, 1)
      fade(tl, '.d2-side', 1, b1 + 2.6, 0.3)
      camS.to(tl, { x: 840, y: 470, zoom: 1.18 }, b1 + 2.6, 5, 'sine.inOut')
      tl.fromTo(sweepRef.current, { x: -620 }, { x: 0, duration: 1.6, ease: 'power1.in', immediateRender: false }, b1 + 2.8)
      // slow motion: the vase tips, hangs, and lands on its side
      const hit = b1 + 4.4
      tl.fromTo(sweepRef.current, { x: 0 }, { x: 120, duration: 1.4, ease: 'power3.out', immediateRender: false }, hit)
      tl.fromTo('.d2-svase', { rotation: 0 }, { rotation: 88, duration: 1.9, ease: 'power2.in', svgOrigin: `${SIDE.vaseX + 46} ${SIDE.table}`, immediateRender: false }, hit)
      fade(tl, '.d2-slowmo', 1, hit, 0.3)
      camS.to(tl, { x: 900, y: 560, zoom: 1.45 }, hit, 1.9, 'power1.inOut')
      const land = hit + 1.9
      camS.shake(tl, land, 1.3, 0.55)
      fade(tl, '.d2-spill', 1, land, 0.4)
      tl.fromTo('.d2-petal', { x: 0, y: 0, opacity: 0 }, { x: (i) => [-60, 90, 140, 40, 200, -20][i % 6], y: (i) => [-30, -60, -20, -80, -10, -50][i % 6], opacity: 1, rotation: (i) => i * 80, duration: 0.6, ease: 'power2.out', immediateRender: false }, land)
      tl.to('.d2-petal', { y: '+=60', duration: 0.6, ease: 'power2.in' }, land + 0.6)
      fade(tl, '.d2-slowmo', 0, land + 0.2, 0.3, 1)
      fade(tl, '.d2-hitflash', 1, land, 0.1)
      fade(tl, '.d2-hitflash', 0, land + 0.2, 0.8, 1)
      tl.to({}, { duration: 1.2 }, land + 0.6)

      /* b2: denoising: noise refines into a committed path, left; again, right. */
      const b2 = land + 1.8
      tl.addLabel('b2', b2)
      fade(tl, '.d2-side', 0, b2, 0.5, 1)
      fade(tl, '.d2-top', 1, b2, 0.5)
      tl.fromTo('.d2-avg, .d2-lab-avg', { opacity: 1 }, { opacity: 0, duration: 0.5, immediateRender: false }, b2)
      tl.fromTo('.d2-demos', { opacity: 0.4 }, { opacity: 0.12, duration: 0.5, immediateRender: false }, b2)
      cam.to(tl, { x: 800, y: 470, zoom: 1.02 }, b2, 1.4)
      const runNoise = (frames: P3[][], at: number, dur: number) => {
        const proxy = { k: 0 }
        const apply = () => {
          const g = dotsRef.current
          if (!g) return
          const k = Math.min(frames.length - 1.001, proxy.k)
          const a = frames[Math.floor(k)]
          const b = frames[Math.ceil(k)]
          const f = k - Math.floor(k)
          const dots = g.querySelectorAll('circle')
          const pts: Pt[] = []
          for (let i = 0; i < NDOTS; i++) {
            const x = a[i].x + (b[i].x - a[i].x) * f
            const y = a[i].y + (b[i].y - a[i].y) * f
            pts.push({ x, y })
            dots[i]?.setAttribute('cx', x.toFixed(1))
            dots[i]?.setAttribute('cy', y.toFixed(1))
          }
          g.querySelector('path')?.setAttribute('d', pathD(pts))
          g.querySelector('path')?.setAttribute('stroke-opacity', String(Math.max(0, (k / frames.length - 0.35) * 1.4)))
          const step = g.querySelector('.d2-step')
          if (step) step.textContent = `denoising step ${Math.round(k) + 1} of ${frames.length}`
        }
        tl.fromTo(proxy, { k: 0 }, { k: frames.length - 1, duration: dur, ease: 'power1.inOut', immediateRender: false, onUpdate: apply }, at)
      }
      fade(tl, '.d2-dots', 1, b2 + 0.6, 0.4)
      runNoise(NOISE_L, b2 + 0.8, 4.4)
      fade(tl, '.d2-lab-noise', 1, b2 + 1.0)
      fade(tl, '.d2-lab-noise', 0, b2 + 4.2, 0.4, 1)
      drawOn(tl, '.d2-commitL', b2 + 5.0, 0.8)
      fade(tl, '.d2-lab-commitL', 1, b2 + 5.2)
      fade(tl, '.d2-lab-method', 1, b2 + 5.8)
      runNoise(NOISE_R, b2 + 7.0, 4.0)
      tl.fromTo('.d2-commitL', { opacity: 1 }, { opacity: 0.35, duration: 0.6, immediateRender: false }, b2 + 7.0)
      drawOn(tl, '.d2-commitR', b2 + 11.0, 0.8)
      fade(tl, '.d2-lab-commitR', 1, b2 + 11.2)
      fade(tl, '.d2-lab-image', 1, b2 + 11.8)
      tl.to({}, { duration: 1.6 }, b2 + 12.4)

      /* b3: the play. A clean table, the learner's own demonstrations. */
      const b3 = b2 + 14.2
      tl.addLabel('b3', b3)
      fade(tl, '.d2-dots, .d2-commitL, .d2-commitR, .d2-lab-commitL, .d2-lab-commitR, .d2-lab-method, .d2-lab-image', 0, b3, 0.6, 1)
      tl.fromTo('.d2-demos', { opacity: 0.12 }, { opacity: 0, duration: 0.6, immediateRender: false }, b3)
      fade(tl, '.d2-play', 1, b3 + 0.4, 0.8)
      cam.to(tl, { x: 800, y: 470, zoom: 1 }, b3, 1)
      tl.to({}, { duration: 0.8 }, b3 + 1.2)
    },
    [],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.d2-flowers', { rotation: 4, duration: 3.4, yoyo: true, repeat: -1, ease: 'sine.inOut', svgOrigin: `${VASE.x} ${VASE.y}` })
    gsap.to('.d2-shand', { y: -6, duration: 1.8, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    // .d2-pulse is rendered conditionally, so it pulses with the CSS loop hd-pulse instead
  })

  /* ---------------- the play ---------------- */
  const inPlay = cueIndex === 3
  const [demos, setDemos] = useState<Demo[]>([])
  const [stroke, setStroke] = useState<Pt[] | null>(null)
  const [rejected, setRejected] = useState<{ d: string; id: number } | null>(null)
  const [lift, setLift] = useState(false)
  const [results, setResults] = useState<Result[]>([])
  const [runT, setRunT] = useState(1)
  const [qualified, setQualified] = useState(false)
  const [won, setWon] = useState(false)
  const graceRef = useRef(0)
  const idRef = useRef(1)
  const seedRef = useRef(1)

  const modes = useMemo(() => {
    const c: Record<Mode, number> = { left: 0, right: 0, over: 0 }
    for (const d of demos) c[d.mode]++
    return c
  }, [demos])
  const nModes = (['left', 'right', 'over'] as Mode[]).filter((m) => modes[m] > 0).length

  const finish = useCallback(() => {
    if (won) return
    setWon(true)
    void say('The averager splits the difference and crashes. The sampler commits to one good option. That’s why robot learning borrowed the maths behind image generators.')
    onPlayDone()
  }, [won, say, onPlayDone])

  const drawing = inPlay && runT >= 1 && !won
  const strokeRef = useRef<Pt[] | null>(null)
  const drag = useDrag({
    onStart: (p) => {
      if (!drawing) return
      strokeRef.current = [p]
      setStroke([p])
    },
    onMove: (p) => {
      const s = strokeRef.current
      if (!drawing || !s) return
      const l = s[s.length - 1]
      if (Math.hypot(p.x - l.x, p.y - l.y) > 6) {
        strokeRef.current = [...s, p]
        setStroke(strokeRef.current)
      }
    },
    onEnd: () => {
      const s = strokeRef.current
      strokeRef.current = null
      setStroke(null)
      if (!s || s.length < 2) return
      let len = 0
      for (let i = 1; i < s.length; i++) len += Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y)
      if (len < 160) return
      const path = strokeToPath(s, lift)
      if (hitIndex(path) >= 0) {
        setRejected({ d: pathD(s), id: idRef.current++ })
        emit({ type: 'attempt', correct: false, detail: 'drew a demonstration that goes through the vase (demonstrations must be good ones)' })
        return
      }
      const mode = modeOf(path)
      const id = idRef.current++
      setDemos((d) => [...d, { id, path, mode }].slice(-14))
      emit({ type: 'progress', detail: `drew a demonstration going ${modeName[mode]} of the vase` })
    },
  })

  const runBoth = () => {
    if (demos.length < 4 || runT < 1) return
    const paths = demos.map((d) => d.path)
    const avg = averagePath(paths)
    const r = rand(seedRef.current++ * 977)
    r.u()
    const s = samplePath(paths, r.u())
    const res: Result = { id: idRef.current++, avg, avgHit: hitIndex(avg), sample: s.path, sampleMode: s.mode, sampleHit: hitIndex(s.path), share: s.share }
    setResults((x) => [...x.slice(-3), res])
    setRunT(0)
    emit({
      type: 'attempt',
      correct: res.avgHit >= 0 && res.sampleHit < 0,
      detail: `ran both robots on ${demos.length} demos (${modes.left} left, ${modes.right} right, ${modes.over} over): averager ${res.avgHit >= 0 ? 'hit the vase' : 'got through'}, sampler went ${modeName[s.mode]} and ${res.sampleHit >= 0 ? 'hit' : 'reached the mug'}`,
    })
    if (qualified) {
      // a second look, or the third way tried: that's enough
      graceRef.current = nModes >= 3 ? 3.5 : 4.5
    } else if (nModes >= 2) {
      setQualified(true)
      graceRef.current = nModes >= 3 ? 3.5 : 14
    }
  }

  useTicker(inPlay && playing && (runT < 1 || (qualified && !won)), (dt) => {
    if (runT < 1) setRunT((t) => Math.min(1, t + dt / 2.8))
    if (graceRef.current > 0 && runT >= 1) {
      graceRef.current -= dt
      if (graceRef.current <= 0) {
        graceRef.current = 0
        finish()
      }
    }
  })
  useEffect(() => {
    if (!rejected) return
    const t = window.setTimeout(() => setRejected(null), 1200)
    return () => window.clearTimeout(t)
  }, [rejected])

  const last = results[results.length - 1]
  useEffect(() => {
    if (cueIndex !== 3) {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
      return
    }
    reportState(
      `The learner’s turn. Top-down tabletop: gripper near the viewer, vase in the middle, mug beyond. The learner drags to draw demonstration paths from the gripper to the mug (at least 4), then presses Run both robots. ` +
        `An averager (white) follows the point-by-point mean of all demos; a sampler (lime) picks one cluster of demos (left, right, or over the top) with probability in proportion to its size and follows that cluster’s mean. ` +
        `After the first run a toggle "Draw over the top" lets them add lifted paths, a third way round. ` +
        `Progress: ${demos.length} demos (${modes.left} left, ${modes.right} right, ${modes.over} over the top); ${results.length} runs` +
        (last ? `; last run: averager ${last.avgHit >= 0 ? 'crashed into the vase' : 'got through'}, sampler went ${modeName[last.sampleMode]} and ${last.sampleHit >= 0 ? 'crashed' : 'reached the mug'}` : '') +
        `. Done when they have drawn demos on at least two sides and run both. The point: with demos on both sides the average goes down the middle into the vase; the sampler commits to one real option. Even with lifted paths mixed in, the averager only lifts part of the way and still hits. Likely mix-up: thinking the averager is just less accurate; it is systematically wrong whenever the good options are separated.`,
    )
    setHints(HINTS)
  }, [cueIndex, demos, modes, results, last, reportState, setHints])

  /* where each robot is during a run */
  const at = (p: P3[], t: number, hit: number) => {
    const end = hit >= 0 ? hit : p.length - 1
    const k = Math.min(end, t * (p.length - 1))
    const i = Math.floor(k)
    const j = Math.min(p.length - 1, i + 1)
    const f = k - i
    return { x: p[i].x + (p[j].x - p[i].x) * f, y: p[i].y + (p[j].y - p[i].y) * f, z: p[i].z + (p[j].z - p[i].z) * f, dir: Math.atan2(p[j].y - p[i].y, p[j].x - p[i].x) }
  }
  const crashed = last && last.avgHit >= 0 && runT * (last.avg.length - 1) >= last.avgHit
  const showPrompt = qualified && modes.over === 0 && !won

  return (
    <g ref={root}>
      {/* ================= top-down table ================= */}
      <g className="d2-top" ref={topRef}>
        <g data-depth="0.85">
          <TopTable x={360} y={70} w={880} h={800} seed={4} lampX={800} lampY={420} />
        </g>
        <g data-depth="1">
          <TopCup x={GOAL.x} y={GOAL.y - 10} s={1} rot={-20} />
          <g transform={crashed ? `rotate(9 ${VASE.x} ${VASE.y}) translate(10 -14)` : undefined}>
            <g className="d2-flowers">
              <TopVase x={VASE.x} y={VASE.y} s={1.05} />
            </g>
          </g>
          <circle cx={VASE.x} cy={VASE.y} r={CLEAR} fill="none" stroke={C.danger} strokeDasharray="4 8" strokeOpacity={0.35} />
          <Label className="d2-lab-vase" x={VASE.x + 40} y={VASE.y - 40} tx={VASE.x + 150} ty={VASE.y - 150} text="a vase in the way" color={C.paper} size={24} />
          <g className="d2-demos">
            {DEMOS10.map((d, i) => (
              <path key={i} className={`d2-demo-${i}`} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1} d={pathD(d)} stroke={C.lime} strokeWidth={3} fill="none" opacity={0.85} />
            ))}
          </g>
          <Label className="d2-lab-left" x={VASE.x - 210} y={VASE.y} tx={VASE.x - 330} ty={VASE.y - 90} text="five go left" color={C.lime} size={26} />
          <Label className="d2-lab-right" x={VASE.x + 215} y={VASE.y} tx={VASE.x + 330} ty={VASE.y - 90} text="five go right" color={C.lime} size={26} />
          <g className="d2-lab-fine" opacity={0}>
            <Tag x={850} y={860} anchor="start" color={C.lime} size={22}>
              both are fine
            </Tag>
          </g>
          <path className="d2-avg" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1} d={pathD(AVG10)} stroke={C.paper} strokeWidth={5} fill="none" />
          <Label className="d2-lab-avg" x={AVG10[30].x} y={AVG10[30].y} tx={AVG10[30].x + 120} ty={AVG10[30].y - 40} text="the average: straight through" color={C.paper} size={26} />

          {/* the denoising cloud */}
          <g className="d2-dots" ref={dotsRef} opacity={0}>
            <path d="" stroke={C.lime} strokeWidth={2} fill="none" strokeOpacity={0} />
            {Array.from({ length: NDOTS }, (_, i) => (
              <circle key={i} cx={NOISE_L[0][i].x} cy={NOISE_L[0][i].y} r={6} fill={C.lime} opacity={0.85} />
            ))}
            <text className="d2-step" x={300} y={120} fill={C.lime} fontFamily={MONO} fontSize={22}>
              denoising step 1
            </text>
          </g>
          <path className="d2-commitL" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1} d={pathD(NOISE_L[NOISE_L.length - 1])} stroke={C.lime} strokeWidth={6} fill="none" filter="url(#cn-bloom)" />
          <path className="d2-commitR" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1} d={pathD(NOISE_R[NOISE_R.length - 1])} stroke={C.lime} strokeWidth={6} fill="none" filter="url(#cn-bloom)" />
          <Label className="d2-lab-noise" x={VASE.x + 240} y={VASE.y + 120} tx={VASE.x + 330} ty={VASE.y + 220} text="start from random noise" color={C.lime} size={24} />
          <Label className="d2-lab-commitL" x={VASE.x - 200} y={VASE.y + 30} tx={VASE.x - 330} ty={VASE.y + 170} text="commits: left" color={C.lime} size={26} />
          <Label className="d2-lab-commitR" x={VASE.x + 200} y={VASE.y + 30} tx={VASE.x + 330} ty={VASE.y + 170} text="new seed: right" color={C.lime} size={26} />
          <g className="d2-lab-method" opacity={0}>
            <text x={850} y={815} textAnchor="start" fill={C.lime} fontFamily={SANS} fontSize={30} fontWeight={600} style={{ paintOrder: 'stroke' }} stroke={C.ink} strokeWidth={6} strokeOpacity={0.6}>
              diffusion policy / flow matching
            </text>
          </g>
          <g className="d2-lab-image" opacity={0}>
            <Tag x={852} y={850} anchor="start" size={20}>
              the same idea as AI image generators
            </Tag>
          </g>
          <g transform={`translate(${START.x} ${START.y}) rotate(-90)`}>
            <TopGripper />
          </g>
          <Dust x={360} y={70} w={880} h={800} count={20} seed={41} size={0.7} />
        </g>
      </g>

      {/* ================= the play, on the same table ================= */}
      <g className="d2-play" opacity={0} pointerEvents={inPlay ? 'auto' : 'none'}>
        <rect x={360} y={70} width={880} height={800} fill="transparent" {...drag} style={{ cursor: drawing ? 'crosshair' : 'default', touchAction: 'none' }} data-tutor="draw-area" />
        <g pointerEvents="none">
          {demos.map((d) => (
            <g key={d.id}>
              {d.mode === 'over' && <path d={pathD(d.path)} stroke="#000" strokeOpacity={0.35} strokeWidth={4} fill="none" />}
              <path d={d.mode === 'over' ? liftD(d.path) : pathD(d.path)} stroke={C.lime} strokeWidth={3} strokeDasharray={d.mode === 'over' ? '10 6' : undefined} fill="none" opacity={0.75} />
            </g>
          ))}
          {stroke && <path d={pathD(stroke)} stroke={lift ? C.limeLight : C.lime} strokeWidth={4} fill="none" strokeDasharray={lift ? '10 6' : undefined} />}
          {rejected && (
            <g key={rejected.id}>
              <path d={rejected.d} stroke={C.danger} strokeWidth={4} fill="none" opacity={0.8} />
              <Tag x={VASE.x} y={VASE.y + 110} anchor="middle" color={C.danger} size={20}>
                that one hits the vase: demos should be good ones
              </Tag>
            </g>
          )}
          {!demos.length && !stroke && inPlay && (
            <g className="d2-pulse hd-pulse">
              <path d={`M${START.x} ${START.y - 40} q -200 -150 -190 -330 q 10 -170 180 -250`} stroke={C.lime} strokeDasharray="4 10" strokeWidth={3} fill="none" />
              <Tag x={START.x - 230} y={START.y - 40} anchor="end" color={C.lime} size={22}>
                drag from the gripper to the mug
              </Tag>
            </g>
          )}
          {/* the two learned paths and the two robots */}
          {last && (
            <g>
              <path d={liftD(last.avg)} stroke={C.paper} strokeWidth={4} strokeDasharray="12 8" fill="none" opacity={0.85} />
              <path d={liftD(last.sample)} stroke={C.limeLight} strokeWidth={5} fill="none" filter="url(#cn-bloom)" />
              {(() => {
                const a = at(last.avg, runT, last.avgHit)
                const s = at(last.sample, runT, last.sampleHit)
                return (
                  <>
                    <g transform={`translate(${s.x + s.z * 14} ${s.y - s.z * 22}) rotate(${(s.dir * 180) / Math.PI}) scale(${0.8 + s.z * 0.18})`}>
                      <TopGripper accent={C.lime} glow={C.lime} />
                    </g>
                    <g transform={`translate(${a.x + a.z * 14} ${a.y - a.z * 22}) rotate(${(a.dir * 180) / Math.PI}) scale(${0.8 + a.z * 0.18})`}>
                      <TopGripper accent={C.paper} />
                    </g>
                    <Tag x={a.x - 50} y={a.y + 52} anchor="end" color={C.paper} size={20}>
                      averager
                    </Tag>
                    <Tag x={s.x + 50} y={s.y + 52} color={C.lime} size={20}>
                      sampler
                    </Tag>
                  </>
                )
              })()}
              {crashed && (
                <g>
                  <Pool x={VASE.x} y={VASE.y} r={190} color="danger" opacity={0.8} />
                  <Tag x={VASE.x} y={VASE.y - 90} anchor="middle" color={C.danger} size={24}>
                    crash
                  </Tag>
                </g>
              )}
              {runT >= 1 && last.sampleHit < 0 && (
                <Tag x={GOAL.x + 60} y={GOAL.y + 8} color={C.lime} size={22}>
                  {`✓ went ${modeName[last.sampleMode]}`}
                </Tag>
              )}
            </g>
          )}
          {/* tally */}
          <g transform="translate(400 120)">
            <text x={0} y={0} fill={C.mist} fontFamily={SANS} fontSize={24}>
              {`your demos: ${demos.length}`}
            </text>
            <Tag x={0} y={32} size={19} color={C.lime}>
              {`left ${modes.left} · right ${modes.right} · over ${modes.over}`}
            </Tag>
          </g>
          {showPrompt && (
            <g className="d2-pulse hd-pulse">
              <Tag x={40} y={336} color={C.limeLight} size={22}>
                now add a third way:
              </Tag>
              <Tag x={40} y={366} color={C.limeLight} size={22}>
                over the top
              </Tag>
            </g>
          )}
        </g>
        <Chip x={185} y={420} w={300} text={lift ? 'Drawing over the top' : 'Draw over the top'} color={C.limeLight} active={lift} disabled={!inPlay || won || !results.length} onClick={() => setLift((l) => !l)} tutor="lift" />
        <Chip x={185} y={500} w={300} text="Run both robots" color={C.cyan} disabled={!inPlay || demos.length < 4 || runT < 1} onClick={runBoth} tutor="run-both" />
        <Chip x={185} y={580} w={300} text="Clear my demos" color={C.fog} disabled={!inPlay || !demos.length || runT < 1 || won} onClick={() => {
          setDemos([])
          setResults([])
        }} tutor="clear" />
      </g>

      {/* ================= side view: the average knocks the vase over ================= */}
      <g className="d2-side" ref={sideRef} opacity={0} pointerEvents="none">
        <g data-depth="0.4">
          <rect x={-600} y={-500} width={2800} height={1900} fill={C.ink1} />
          <g filter="url(#cn-dof-3)" opacity={0.7}>
            <rect x={-100} y={60} width={340} height={560} fill={C.ink3} />
            <rect x={1260} y={40} width={420} height={600} fill={C.ink3} />
            <circle cx={1420} cy={200} r={44} fill={C.rim} opacity={0.35} />
            <circle cx={120} cy={240} r={30} fill={C.key} opacity={0.3} />
          </g>
          <Pool x={820} y={520} r={720} color="key" opacity={0.8} />
        </g>
        <g data-depth="1">
          <rect x={-600} y={SIDE.table} width={2800} height={800} fill={C.ink2} />
          <rect x={-600} y={SIDE.table} width={2800} height={5} fill={C.keyDeep} opacity={0.7} />
          <g className="d2-spill" opacity={0}>
            <ellipse cx={SIDE.vaseX + 280} cy={SIDE.table + 6} rx={260} ry={12} fill={C.rim} opacity={0.35} />
          </g>
          {/* the vase, side on */}
          <g className="d2-svase">
            <path d={`M${SIDE.vaseX - 40} ${SIDE.table} Q ${SIDE.vaseX - 62} ${SIDE.table - 120} ${SIDE.vaseX - 26} ${SIDE.table - 190} L ${SIDE.vaseX + 26} ${SIDE.table - 190} Q ${SIDE.vaseX + 62} ${SIDE.table - 120} ${SIDE.vaseX + 40} ${SIDE.table} Z`} fill="#2d5d73" />
            <path d={`M${SIDE.vaseX - 30} ${SIDE.table - 20} Q ${SIDE.vaseX - 48} ${SIDE.table - 120} ${SIDE.vaseX - 18} ${SIDE.table - 180}`} stroke="#7fb8cf" strokeWidth={6} fill="none" opacity={0.5} />
            {[-30, -10, 12, 30].map((dx, i) => (
              <g key={i}>
                <path d={`M${SIDE.vaseX + dx * 0.4} ${SIDE.table - 190} Q ${SIDE.vaseX + dx} ${SIDE.table - 260} ${SIDE.vaseX + dx * 1.8} ${SIDE.table - 300 - i * 14}`} stroke="#3f7a3a" strokeWidth={5} fill="none" />
                <circle cx={SIDE.vaseX + dx * 1.8} cy={SIDE.table - 300 - i * 14} r={16} fill={i % 2 ? '#e86a6a' : '#f2e3c4'} />
                <circle cx={SIDE.vaseX + dx * 1.8} cy={SIDE.table - 300 - i * 14} r={6} fill={C.gold} />
              </g>
            ))}
          </g>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <ellipse key={i} className="d2-petal" cx={SIDE.vaseX + 220} cy={SIDE.table - 30} rx={9} ry={5} fill={i % 2 ? '#e86a6a' : '#f2e3c4'} opacity={0} />
          ))}
          <g className="d2-hitflash" opacity={0}>
            <Pool x={SIDE.vaseX + 200} y={SIDE.table - 40} r={260} color="danger" opacity={0.7} />
          </g>
          {/* the averaged path, side on: dead level, at vase height */}
          <line x1={-200} x2={1800} y1={SIDE.table - 120} y2={SIDE.table - 120} stroke={C.paper} strokeWidth={3} strokeDasharray="12 8" opacity={0.5} />
          <Tag x={420} y={SIDE.table - 136} color={C.paper} size={22}>
            following the average
          </Tag>
          <g ref={sweepRef}>
            <g className="d2-shand">
              <Hand3D store={hand} x={SIDE.vaseX - 150} y={SIDE.table - 280} look="robot" arm={520} light={[0.7, -0.6]} />
            </g>
          </g>
          <g className="d2-slowmo" opacity={0}>
            <Tag x={300} y={200} color={C.mist} size={24}>
              slow motion · ¼ speed
            </Tag>
          </g>
          <Dust x={200} y={100} w={1200} h={600} count={26} seed={14} size={0.8} />
        </g>
      </g>

      <Vignette />
    </g>
  )
}

export const ch2: Chapter = {
  id: 'modes',
  title: 'Left or right?',
  cues: CUES,
  Scene: Ch2Modes,
  enter: { type: 'pan', dir: 'right' },
  deeper: [MultimodalityReading],
}
