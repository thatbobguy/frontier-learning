import gsap from 'gsap'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { camera } from '../../../cine/camera'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { POSES, Person, rig } from '../../../cine/people'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { useDrag } from '../../../engine/svg'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Chip, Dust, Label, Pool, Slider, Vignette, fade, useAmbient } from '../shared/kit'
import { LabSky, LabWall } from '../shared/sets'
import { ADA, MiniKitchen, Tag, useTicker } from './art'
import { ScalingReading } from './readings'
import { BUDGET, SPLITS, successRate, testKitchens } from './sim'

export const CUES: Cue[] = [
  { id: 'question', say: 'Now the big question for anyone collecting data. If you can afford sixteen hundred demonstrations, should you record them all in one kitchen, or a few in many kitchens?' },
  { id: 'rooms', say: 'Split the budget. Choose how many rooms, and the demos per room follow. Then test the robot in rooms it has never seen.', play: true },
  { id: 'mix', say: 'The same goes for mixing data from different robots and the web. One home-robot model scored ninety-four percent in unseen homes with its full data mix, and thirty-one percent with only its own home data.' },
]

const HINTS = ['One kitchen teaches it that kitchen.', 'Try lots of rooms with fewer demos each.']

const STATE = [
  'Ada stands in the dark lab between two pictures. On the left, one big kitchen with a huge pile of 1,600 tiny lime demo tiles. On the right, a grid of 32 different little kitchens, each with a small stack of 50 tiles. Ada has her arms folded. The question: with a budget of 1,600 demonstrations, record them all in one kitchen, or a few in many kitchens?',
  '',
  'A horizontal lime bar chart builds bar by bar: full data mix 94%, no web data 74%, no other robots’ data 49%, only home robot data 31%, success in homes the model never saw. Label: π0.5, Physical Intelligence, 2025. Idea: co-training on diverse sources (web, other robots, many homes) is what makes a home robot generalise.',
]

/** b2's bars (π0.5 ablations, out-of-distribution success in unseen homes). */
const BARS: [string, number, string][] = [
  ['full data mix', 94, 'web + other robots + many homes'],
  ['no web data', 74, ''],
  ['no other robots’ data', 49, ''],
  ['only its own home data', 31, ''],
]

/* ---------------- play geometry ---------------- */
const CHART = { x: 960, y: 140, w: 520, h: 290 }
const lx = (n: number) => CHART.x + (Math.log(n) / Math.log(64)) * CHART.w
const ly = (p: number) => CHART.y + CHART.h - p * CHART.h
const TEST = { x: 960, y: 590, cols: 5, w: 100, h: 56, gap: 6 }
const TRAIN = { x: 70, y: 140, w: 700, h: 400 }

/** Columns and rows that fit n kitchens in the training area. */
function grid(n: number) {
  const cols = Math.ceil(Math.sqrt(n * (TRAIN.w / TRAIN.h)))
  const rows = Math.ceil(n / cols)
  const cw = TRAIN.w / cols
  const ch = TRAIN.h / rows
  return { cols, rows, cw, ch }
}

interface Test {
  n: number
  pred: number
  passed: boolean[]
  id: number
}

const CURVE = (() => {
  const pts: string[] = []
  for (let i = 0; i <= 60; i++) {
    const n = Math.pow(64, i / 60)
    pts.push(`${i ? 'L' : 'M'}${lx(n).toFixed(1)} ${ly(successRate(n)).toFixed(1)}`)
  }
  return pts.join(' ')
})()

export function Ch3Diversity({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const qRef = useRef<SVGGElement>(null)
  const barRef = useRef<SVGGElement>(null)

  const build = useCallback((tl: gsap.core.Timeline) => {
    const cam = camera(qRef.current, { x: 800, y: 520, zoom: 1.5 })
    const camB = camera(barRef.current, { x: 800, y: 450, zoom: 1.05 })
    const ada = rig(root.current, 'd3-ada', FOLD)
    tl.set('.d3-play, .d3-bars', { opacity: 0 }, 0)
    tl.set('.d3-q', { opacity: 1 }, 0)
    tl.set('.d3-pile', { scaleY: 0, svgOrigin: '330 700' }, 0)
    tl.set('.d3-k32', { opacity: 0 }, 0)
    tl.set('.d3-stack', { scaleY: 0, transformOrigin: '50% 100%' }, 0)
    BARS.forEach((_, i) => tl.set(`.d3-bar-${i}`, { scaleX: 0, svgOrigin: `500 ${280 + i * 120}` }, 0))

    /* b0: one kitchen and a mountain of demos, or 32 kitchens and a little stack each. */
    tl.addLabel('b0', 0)
    cam.to(tl, { x: 800, y: 470, zoom: 1 }, 0.3, 5, 'power2.inOut')
    ada.idle(tl, 0, 12)
    tl.fromTo('.d3-pile', { scaleY: 0 }, { scaleY: 1, duration: 3.4, ease: 'power2.out', svgOrigin: '330 700', immediateRender: false }, 1.6)
    fade(tl, '.d3-lab-one', 1, 2.6)
    tl.fromTo('.d3-k32', { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.4, stagger: 0.07, ease: 'back.out(2)', transformOrigin: '50% 50%', immediateRender: false }, 5.6)
    tl.fromTo('.d3-stack', { scaleY: 0 }, { scaleY: 1, duration: 0.5, stagger: 0.07, ease: 'power2.out', transformOrigin: '50% 100%', immediateRender: false }, 6.0)
    fade(tl, '.d3-lab-many', 1, 8.4)
    fade(tl, '.d3-lab-q', 1, 10.6)
    cam.to(tl, { x: 800, y: 480, zoom: 1.06 }, 9, 5, 'sine.inOut')
    tl.to({}, { duration: 0.6 }, 13.6)

    /* b1: the play: the split, the prediction, the test in unseen kitchens. */
    const b1 = 14.2
    tl.addLabel('b1', b1)
    fade(tl, '.d3-q', 0, b1, 0.6, 1)
    fade(tl, '.d3-play', 1, b1 + 0.3, 0.8)
    tl.to({}, { duration: 1.5 }, b1 + 0.3)

    /* b2: the π0.5 data-mix bars. */
    const b2 = b1 + 2
    tl.addLabel('b2', b2)
    fade(tl, '.d3-play', 0, b2, 0.6, 1)
    fade(tl, '.d3-bars', 1, b2 + 0.3, 0.8)
    camB.to(tl, { x: 800, y: 440, zoom: 1.12 }, b2, 13, 'sine.inOut')
    BARS.forEach((_, i) => {
      const at = b2 + 1.6 + i * 2.2
      tl.fromTo(`.d3-bar-${i}`, { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: 'power3.out', svgOrigin: `500 ${280 + i * 120}`, immediateRender: false }, at)
      fade(tl, `.d3-barlab-${i}`, 1, at + 0.6, 0.5)
    })
    fade(tl, '.d3-src', 1, b2 + 2.4)
    tl.fromTo('.d3-drop', { opacity: 0 }, { opacity: 1, duration: 0.6, immediateRender: false }, b2 + 9.8)
    tl.to({}, { duration: 1.4 }, b2 + 11.8)
  }, [])
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.d3-glow', { opacity: 0.6, duration: 2.6, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    // .d3-pulse is rendered conditionally, so it pulses with the CSS loop hd-pulse instead
  })

  /* ---------------- the play ---------------- */
  const inPlay = cueIndex === 1
  const [idx, setIdx] = useState(0)
  const n = SPLITS[idx]
  const per = BUDGET / n
  const [pred, setPred] = useState<number | null>(null)
  const [tests, setTests] = useState<Test[]>([])
  const [reveal, setReveal] = useState(1)
  const [won, setWon] = useState(false)
  const idRef = useRef(1)
  const lastTest = tests[tests.length - 1]
  const testing = reveal < 1

  const distinct = useMemo(() => [...new Set(tests.map((t) => t.n))], [tests])
  const showCurve = tests.length >= 2

  const chartDrag = useDrag({
    onStart: (p) => inPlay && !testing && !won && setPred(Math.max(0, Math.min(1, (CHART.y + CHART.h - p.y) / CHART.h))),
    onMove: (p) => inPlay && !testing && !won && setPred(Math.max(0, Math.min(1, (CHART.y + CHART.h - p.y) / CHART.h))),
    onEnd: () => {
      if (inPlay && pred !== null) emit({ type: 'progress', detail: `predicted ${Math.round((pred ?? 0) * 100)}% success for ${n} rooms` })
    },
  })

  const runTest = () => {
    if (pred === null || testing) return
    const passed = testKitchens(n, idRef.current * 3 + 1)
    const t: Test = { n, pred, passed, id: idRef.current++ }
    setTests((x) => [...x, t])
    setReveal(0)
    const k = passed.filter(Boolean).length
    emit({ type: 'attempt', correct: n >= 16, detail: `tested ${n} rooms × ${per} demos: predicted ${Math.round(pred * 100)}%, ${k} of 20 unseen kitchens passed` })
  }

  /** Once a test has finished lighting up: done, or ready for a fresh prediction. */
  const settle = () => {
    const ds = new Set(tests.map((t) => t.n))
    if (ds.size >= 3 && [...ds].some((x) => x >= 16)) {
      setWon(true)
      void say('Thirty-two rooms with about fifty demos each reached roughly ninety percent in places it had never seen. Variety beats repetition.')
      onPlayDone()
    } else setPred(null)
  }
  useTicker(inPlay && playing && testing, (dt) => {
    const next = Math.min(1, reveal + dt / 3)
    setReveal(next)
    if (next >= 1) settle()
  })



  useEffect(() => {
    if (cueIndex !== 1) {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
      return
    }
    reportState(
      `The learner’s turn. A budget of 1,600 demonstrations. Left: the training kitchens for the current split (${n} rooms × ${per} demos each), drawn as little kitchens with lime stacks of demos. ` +
        `Below it a slider sets the number of rooms (1 to 64; demos per room = 1,600 ÷ rooms). Right: a chart of success in unseen rooms against number of rooms (log scale). ` +
        `Before each test the learner must drag on the chart to place a prediction; then "Test in 20 new kitchens" lights up a grid of 20 unseen kitchens (lime pass, red fail). After two tests the model curve is revealed. ` +
        `Progress: current split ${n} rooms; prediction ${pred === null ? 'not placed yet' : `${Math.round(pred * 100)}%`}; tests so far: ${tests.map((t) => `${t.n} rooms → ${t.passed.filter(Boolean).length}/20 (predicted ${Math.round(t.pred * 100)}%)`).join('; ') || 'none'}. ` +
        `Done after testing three different splits including one with 16 or more rooms. The model (shaped like Lin et al. 2024): success rises as a power law in the number of environments and saturates in demos per environment; it peaks around 32 rooms × 50 demos ≈ 89%; 1 room gives about 10%; 64 rooms × 25 demos dips slightly (too few demos per room). Likely mix-up: thinking more demos in the same place keeps helping.`,
    )
    setHints(HINTS)
  }, [cueIndex, n, per, pred, tests, reportState, setHints])

  const g = grid(n)
  const shown = Math.min(n, 64)
  const stackH = (h: number) => Math.min(h * 0.7, 4 + Math.sqrt(per) * h * 0.017)

  return (
    <g ref={root}>
      <defs>
        <pattern id="d3-tiles" width={7} height={7} patternUnits="userSpaceOnUse">
          <rect width={6} height={6} rx={1} fill={C.lime} opacity={0.85} />
        </pattern>
        <pattern id="d3-tiles-s" width={4} height={4} patternUnits="userSpaceOnUse">
          <rect width={3.2} height={3.2} fill={C.lime} opacity={0.85} />
        </pattern>
      </defs>

      {/* ================= b0: the question ================= */}
      <g className="d3-q" ref={qRef} pointerEvents="none">
        <g data-depth="0.25">
          <LabSky />
        </g>
        <g data-depth="0.6">
          <g filter="url(#cn-dof-2)">
            <LabWall />
          </g>
          <rect x={-600} y={-500} width={2800} height={1900} fill={C.ink} opacity={0.55} />
        </g>
        <g data-depth="1">
          <rect x={-600} y={780} width={2800} height={600} fill={C.ink1} />
          {/* one kitchen, a mountain of demos */}
          <g>
            <Pool x={330} y={520} r={420} color="key" opacity={0.55} />
            <MiniKitchen x={90} y={300} w={480} h={360} seed={3} />
            <path className="d3-pile" d="M110 700 Q 200 560 330 520 Q 460 560 550 700 Z" fill="url(#d3-tiles)" />
            <Label className="d3-lab-one" x={330} y={540} tx={330} ty={240} text="1 kitchen × 1,600 demos" color={C.lime} size={30} anchor="middle" />
          </g>
          {/* thirty-two kitchens, a little stack each */}
          <g>
            <Pool x={1270} y={500} r={460} color="rim" opacity={0.35} />
            {Array.from({ length: 32 }, (_, i) => {
              const c = i % 8
              const r = Math.floor(i / 8)
              const x = 1000 + c * 68
              const y = 330 + r * 92
              return (
                <g key={i} className="d3-k32">
                  <MiniKitchen x={x} y={y} w={62} h={52} seed={i + 10} />
                  <rect className="d3-stack" x={x + 22} y={y + 52 - 30} width={18} height={30} fill="url(#d3-tiles-s)" />
                </g>
              )
            })}
            <Label className="d3-lab-many" x={1270} y={330} tx={1270} ty={240} text="32 kitchens × 50 demos" color={C.lime} size={30} anchor="middle" />
          </g>
          {/* Ada between them */}
          <g>
            <Pool x={800} y={560} r={220} color="key" opacity={0.45} />
            <Person name="d3-ada" x={790} y={790} s={1.25} pose={FOLD} light="key-left" {...ADA} />
          </g>
          <g className="d3-lab-q" opacity={0}>
            <text x={800} y={150} textAnchor="middle" fill={C.paper} fontFamily={SERIF} fontSize={46} fontWeight={600}>
              Same budget. Which copes in a new kitchen?
            </text>
          </g>
          <Dust x={0} y={100} w={1600} h={700} count={30} seed={23} size={0.8} />
        </g>
      </g>

      {/* ================= b1: the play ================= */}
      <g className="d3-play" opacity={0} pointerEvents={inPlay ? 'auto' : 'none'}>
        <rect x={-100} y={-100} width={1800} height={1100} fill={C.ink1} />
        <rect x={-100} y={-100} width={1800} height={1100} fill="url(#cn-grid)" opacity={0.25} />
        <g className="d3-glow" opacity={0.35}>
          <Pool x={420} y={340} r={520} color="key" opacity={0.5} />
        </g>
        {/* the training kitchens for this split */}
        <text x={TRAIN.x} y={110} fill={C.mist} fontFamily={SANS} fontSize={24}>
          where the 1,600 demos are recorded
        </text>
        <g pointerEvents="none">
          {Array.from({ length: shown }, (_, i) => {
            const c = i % g.cols
            const r = Math.floor(i / g.cols)
            const x = TRAIN.x + c * g.cw
            const y = TRAIN.y + r * g.ch
            const h = stackH(g.ch)
            return (
              <g key={`${n}-${i}`}>
                <MiniKitchen x={x + 2} y={y + 2} w={g.cw - 4} h={g.ch - 4} seed={i + 1} />
                <rect x={x + g.cw * 0.3} y={y + g.ch - 2 - h} width={Math.max(4, g.cw * 0.28)} height={h} fill={per > 200 ? 'url(#d3-tiles)' : 'url(#d3-tiles-s)'} />
              </g>
            )
          })}
        </g>
        <text x={TRAIN.x + TRAIN.w / 2} y={TRAIN.y + TRAIN.h + 50} textAnchor="middle" fill={C.lime} fontFamily={MONO} fontSize={32}>
          {`${n} ${n === 1 ? 'room' : 'rooms'} × ${per.toLocaleString('en-GB')} demos`}
        </text>
        <Slider
          x={TRAIN.x + 30}
          y={TRAIN.y + TRAIN.h + 130}
          w={TRAIN.w - 60}
          value={idx / (SPLITS.length - 1)}
          onChange={(v) => {
            if (testing || won) return
            const k = Math.round(v * (SPLITS.length - 1))
            if (k !== idx) {
              setIdx(k)
              setPred(null)
              emit({ type: 'progress', detail: `chose ${SPLITS[k]} rooms × ${BUDGET / SPLITS[k]} demos` })
            }
          }}
          color={C.lime}
          label="rooms"
          valueText={`${n}`}
          tutor="rooms-slider"
          ticks={[1, 4, 16, 32, 64].map((v) => ({ at: SPLITS.indexOf(v) / (SPLITS.length - 1), text: String(v) }))}
          disabled={testing || won}
        />

        {/* the chart: predict, then see */}
        <text x={CHART.x} y={CHART.y - 40} fill={C.mist} fontFamily={SANS} fontSize={24}>
          success in kitchens it has never seen
        </text>
        <rect x={CHART.x - 20} y={CHART.y - 10} width={CHART.w + 40} height={CHART.h + 20} fill={C.ink} opacity={0.5} rx={8} {...chartDrag} style={{ cursor: testing ? 'default' : 'ns-resize', touchAction: 'none' }} data-tutor="prediction-chart" />
        <g pointerEvents="none">
          <path d={`M${CHART.x} ${CHART.y} V${CHART.y + CHART.h} H${CHART.x + CHART.w}`} stroke={C.fog} strokeWidth={2} fill="none" />
          {[0, 0.5, 1].map((p) => (
            <g key={p}>
              <line x1={CHART.x} x2={CHART.x + CHART.w} y1={ly(p)} y2={ly(p)} stroke={C.fog} strokeOpacity={0.2} />
              <Tag x={CHART.x - 10} y={ly(p) + 6} anchor="end" size={16}>
                {`${p * 100}%`}
              </Tag>
            </g>
          ))}
          {[1, 4, 16, 32, 64].map((v) => (
            <Tag key={v} x={lx(v)} y={CHART.y + CHART.h + 26} anchor="middle" size={16}>
              {String(v)}
            </Tag>
          ))}
          <Tag x={CHART.x + CHART.w + 14} y={CHART.y + CHART.h + 6} size={16}>
            rooms →
          </Tag>
          {/* where the learner is predicting */}
          <line x1={lx(n)} x2={lx(n)} y1={CHART.y} y2={CHART.y + CHART.h} stroke={C.lime} strokeOpacity={0.3} strokeDasharray="4 6" />
          {showCurve && (
            <g>
              <path d={CURVE} stroke={C.lime} strokeWidth={3} fill="none" opacity={0.8} />
              <Tag x={CHART.x + CHART.w - 6} y={CHART.y + CHART.h - 14} anchor="end" color={C.lime} size={15}>
                curve: model shaped like Lin et al. 2024
              </Tag>
            </g>
          )}
          {tests.map((t, i) => {
            const done = i < tests.length - 1 || reveal >= 1
            const k = t.passed.filter(Boolean).length
            return (
              <g key={t.id}>
                <circle cx={lx(t.n) - 8} cy={ly(t.pred)} r={8} fill="none" stroke={C.paper} strokeWidth={2.5} />
                {done && <circle cx={lx(t.n) + 8} cy={ly(k / 20)} r={9} fill={C.lime} />}
              </g>
            )
          })}
          {pred !== null && !testing && (
            <g>
              <circle cx={lx(n)} cy={ly(pred)} r={11} fill="none" stroke={C.paper} strokeWidth={3} />
              <Tag x={lx(n) + (n > 20 ? -18 : 18)} y={ly(pred) + 6} anchor={n > 20 ? 'end' : 'start'} color={C.paper} size={18}>
                {`your guess ${Math.round(pred * 100)}%`}
              </Tag>
            </g>
          )}
          {pred === null && !testing && inPlay && !won && (
            <g className="d3-pulse hd-pulse">
              <Tag x={lx(n) + (n > 20 ? -14 : 14)} y={ly(0.55)} anchor={n > 20 ? 'end' : 'start'} color={C.paper} size={18}>
                drag here: your prediction
              </Tag>
            </g>
          )}
          <g transform={`translate(${CHART.x + CHART.w - 4} ${CHART.y + 18})`}>
            <circle cx={-170} cy={-6} r={7} fill="none" stroke={C.paper} strokeWidth={2} />
            <Tag x={-158} y={0} size={14} color={C.paper}>
              guess
            </Tag>
            <circle cx={-90} cy={-6} r={7} fill={C.lime} />
            <Tag x={-78} y={0} size={14} color={C.lime}>
              measured
            </Tag>
          </g>
        </g>

        {/* the test: 20 unseen kitchens */}
        <Chip x={CHART.x + CHART.w / 2} y={TEST.y - 44} w={360} text="Test in 20 new kitchens" color={C.lime} disabled={!inPlay || pred === null || testing || won} onClick={runTest} tutor="test" />
        <g pointerEvents="none">
          {Array.from({ length: 20 }, (_, i) => {
            const c = i % TEST.cols
            const r = Math.floor(i / TEST.cols)
            const x = TEST.x + c * (TEST.w + TEST.gap)
            const y = TEST.y + r * (TEST.h + TEST.gap)
            const shownNow = lastTest && (tests.length > 1 || reveal * 20 > i) && reveal * 20 > i
            const ok = lastTest?.passed[i]
            return (
              <g key={i}>
                <MiniKitchen x={x} y={y} w={TEST.w} h={TEST.h} seed={200 + i}>
                  {shownNow && <rect x={x} y={y} width={TEST.w} height={TEST.h} fill={ok ? C.lime : C.danger} opacity={0.38} />}
                </MiniKitchen>
                {shownNow && (
                  <text x={x + TEST.w / 2} y={y + TEST.h / 2 + 10} textAnchor="middle" fill={ok ? C.limeLight : C.danger} fontFamily={SANS} fontSize={30} fontWeight={700} style={{ paintOrder: 'stroke' }} stroke={C.ink} strokeWidth={5}>
                    {ok ? '✓' : '✕'}
                  </text>
                )}
              </g>
            )
          })}
          {lastTest && (
            <Tag x={TEST.x + 2.5 * (TEST.w + TEST.gap)} y={TEST.y + 4 * (TEST.h + TEST.gap) + 34} anchor="middle" size={22} color={C.lime}>
              {reveal >= 1 ? `${lastTest.passed.filter(Boolean).length} of 20 passed · ${lastTest.n} rooms × ${BUDGET / lastTest.n} demos` : 'testing…'}
            </Tag>
          )}
          <Tag x={TRAIN.x} y={TRAIN.y + TRAIN.h + 210} size={18}>
            {`splits tested: ${distinct.length ? distinct.join(', ') : 'none yet'}`}
          </Tag>
        </g>
      </g>

      {/* ================= b2: the data-mix bars ================= */}
      <g className="d3-bars" ref={barRef} opacity={0} pointerEvents="none">
        <g data-depth="0.5">
          <rect x={-600} y={-500} width={2800} height={1900} fill={C.ink1} />
          <rect x={-600} y={-500} width={2800} height={1900} fill="url(#cn-grid-big)" opacity={0.6} />
          <Pool x={900} y={420} r={800} color="rim" opacity={0.2} />
        </g>
        <g data-depth="1">
          <text x={500} y={170} fill={C.mist} fontFamily={SANS} fontSize={28}>
            success in homes it had never seen
          </text>
          {BARS.map(([name, v, sub], i) => {
            const y = 280 + i * 120
            return (
              <g key={name}>
                <text x={470} y={y + 12} textAnchor="end" fill={C.paper} fontFamily={SANS} fontSize={30}>
                  {name}
                </text>
                {sub && (
                  <text x={470} y={y + 46} textAnchor="end" fill={C.mist} fontFamily={MONO} fontSize={17}>
                    {sub}
                  </text>
                )}
                <rect x={500} y={y - 26} width={900} height={52} rx={6} fill={C.ink3} />
                <rect className={`d3-bar-${i}`} x={500} y={y - 26} width={9 * v} height={52} rx={6} fill={C.lime} opacity={1 - i * 0.15} filter={i === 0 ? 'url(#cn-bloom)' : undefined} />
                <text className={`d3-barlab-${i}`} x={500 + 9 * v + 16} y={y + 14} fill={C.lime} fontFamily={MONO} fontSize={38} fontWeight={600} opacity={0}>
                  {`${v}%`}
                </text>
              </g>
            )
          })}
          <g className="d3-drop" opacity={0}>
            <path d={`M${500 + 9 * 94} 230 C ${500 + 9 * 94 + 60} 400 ${500 + 9 * 31 + 120} 560 ${500 + 9 * 31 + 30} 620`} stroke={C.danger} strokeWidth={3} strokeDasharray="6 8" fill="none" markerEnd="url(#cn-arrow)" opacity={0.8} />
            <Tag x={500 + 9 * 70} y={470} color={C.danger} size={22}>
              take away the variety
            </Tag>
          </g>
          <g className="d3-src" opacity={0}>
            <Tag x={1400} y={800} anchor="end" size={22} color={C.lime}>
              π0.5, Physical Intelligence, 2025
            </Tag>
          </g>
          <Dust x={0} y={100} w={1600} h={700} count={24} seed={27} color={C.rim} size={0.7} />
        </g>
      </g>
      <Vignette />
    </g>
  )
}

/** Ada with her arms folded. */
const FOLD = { ...POSES.stand, head: 4, armN: 28, elbowN: 118, wristN: 10, armF: 22, elbowF: 112, wristF: 8 }

export const ch3: Chapter = {
  id: 'diversity',
  title: 'Many rooms or many reps?',
  cues: CUES,
  Scene: Ch3Diversity,
  deeper: [ScalingReading],
}
