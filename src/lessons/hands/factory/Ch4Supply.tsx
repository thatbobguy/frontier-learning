import gsap from 'gsap'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { camera } from '../../../cine/camera'
import { Hand3D, GRASPS, useHandStore } from '../../../cine/hand3d'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Blueprint, Chip, Dust, FiveMap, Label, Pool, Readout, Slider, Vignette, fade, useAmbient } from '../shared/kit'
import { FactoryCSS, FlatHand, Gear, PriceTag, SourceNote, money } from './factoryKit'
import { arcPath, dotPaths, graticule } from './globe'
import { SupplyReading } from './readings'

export const CUES: Cue[] = [
  { id: 'inside', say: 'Look inside any hand and you’ll find the same tiny parts: micro motors, miniature screws, gears smaller than a lentil, and powerful magnets.' },
  { id: 'magnets', say: 'Those magnets are made with rare earth metals. China mines about seventy percent of them, and processes nearly all.' },
  { id: 'gap', say: 'One estimate put Tesla’s robot at forty-six thousand dollars to build with Chinese suppliers, and a hundred and thirty-one thousand without them.' },
  { id: 'wright', say: 'There’s good news. Every time total production doubles, costs tend to fall by a steady share. It happened to solar panels and batteries, and it’s starting for robot hands.' },
  { id: 'curve', say: 'Drag the year forward. How many hands must the world build for one to cost under a thousand dollars?', play: true },
  { id: 'wallend', say: 'So the wall isn’t one problem. It’s tooling, part count, durability and supply, all at once. The companies that solve it will build the hands everyone else uses.' },
]

const STATE = [
  'Macro shots in the dark with shallow depth of field, the camera gliding along a black table: a coreless micro motor cut away to show its copper winding cup, a precision-ground lead screw with a nut and a glint running along its thread, a tiny metal-injection-moulded gear sitting on a human fingertip (smaller than a lentil), and a neodymium magnet that snaps onto a steel spanner with a clack. These are the parts inside almost every robot hand.',
  'A night globe made of dots turns until China faces us, its dots glowing gold. Gold arcs flow from Chinese mines and refineries to factories in Japan, Korea, Vietnam, India, Germany and the United States. Label: China ~69% of rare earths mined (2025), ~90% processed. Then the arcs flicker red: "export licences, April 2025" (China began requiring licences to export several heavy rare earths and magnets). Hand micro motors need these magnets, especially heat-resistant ones that use dysprosium and terbium.',
  'Two stacked gold bars rise side by side: $46,000 to build Tesla’s Optimus robot with Chinese suppliers, $131,000 without them (actuators $22k vs $58k, chips $3k vs $7k, the rest $21k vs $66k). A bracket marks the gap: about 2.8 times. Label: Morgan Stanley estimate. Point: China’s supply chain makes humanoids far cheaper today.',
  'A learning-curve chart on log axes: cost per unit against cumulative units built, with each doubling marked. Lithium-ion battery cells fall in a straight line, about 19% cheaper per doubling ($9,200/kWh in 1991 to $78 in 2024). Solar panels follow a similar straight line (shown schematically). A gold dot marks robot hands at the very start of their line, with many doublings ahead. This is Wright’s law.',
  '',
  'Back to the five-question map: the gold ring of the wall settles and all five coloured rings (shape, muscle, tendons, touch, brain) glow together around the robot hand. The camera rises above the map toward a dark horizon scattered with question marks, hinting at the next film about the frontier. Point: the wall is tooling, part count, durability and supply all at once.',
]

/* ------------------------------------------------------------------ */
/* Wright's law                                                         */
/* ------------------------------------------------------------------ */
const N0 = 30000
const C0 = 5000
const RATES = [0.1, 0.19, 0.25]
const costAt = (N: number, lr: number) => C0 * Math.pow(1 - lr, Math.log2(N / N0))
const nFor = (target: number, lr: number) => N0 * Math.pow(2, Math.log(target / C0) / Math.log(1 - lr))
const WX = (N: number) => 240 + ((Math.log10(N) - 4) / 4) * 920
const WY = (c: number) => 740 - ((Math.log10(c) - 2) / 2) * 560
const nOfT = (t: number) => Math.max(N0, Math.pow(10, 4 + 4 * t))
const tOfN = (N: number) => (Math.log10(N) - 4) / 4
const fmtN = (N: number) => (N >= 1e9 ? `${(N / 1e9).toFixed(1)} billion` : N >= 1e6 ? `${(N / 1e6).toFixed(N >= 1e7 ? 0 : 1)} million` : `${Math.round(N / 1000)}k`)

/* The learning-curve chart in b3 (schematic doublings) */
const LX = (d: number) => 240 + d * 95
const LY = (logc: number) => 160 + (5.0 - logc) * 260

/* The gap bars */
const BARS = { y1: 790, scale: 600 / 131 }
const GAP_ROWS = [
  { name: 'actuators', a: 22, b: 58, color: C.goldDark },
  { name: 'chips and software', a: 3, b: 7, color: C.goldLight },
  { name: 'everything else', a: 21, b: 66, color: C.gold },
]

/* The globe */
const G = { cx: 800, cy: 480, R: 340, lat0: 24 }
const SOURCES: [number, number][] = [[112, 31]]
const DESTS: [number, number][] = [[137, 35.5], [127, 37.5], [106, 16], [77, 21], [10, 50], [-90, 40], [150, -30]]

export function Ch4Supply({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints, memory }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const macroShot = useRef<SVGGElement>(null)
  const gapShot = useRef<SVGGElement>(null)
  const mapShot = useRef<SVGGElement>(null)
  const hand = useHandStore({ pose: GRASPS.relaxed, view: { yaw: -30, pitch: 12, roll: 0, s: 1.25 } })

  /* ---------- the curve play's state ---------- */
  const [t, setT] = useState(tOfN(N0))
  const [lr, setLr] = useState(0.19)
  const [locks, setLocks] = useState<Record<string, number>>({})
  const [tried, setTried] = useState<number[]>([0.19])
  const [movedAfterSwitch, setMovedAfterSwitch] = useState(false)
  const [won, setWon] = useState(false)
  const playDoneRef = useRef(onPlayDone)
  playDoneRef.current = onPlayDone
  const active = cueIndex === 4
  const N = nOfT(t)
  const cost = costAt(N, lr)
  const doublings = Math.log2(N / N0)
  const under = cost < 1000

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const RT = root.current
      const camMacro = camera(macroShot.current, { x: 420, y: 470, zoom: 1.35 })
      const camGap = camera(gapShot.current, { x: 800, y: 470, zoom: 1.0 })
      const camMap = camera(mapShot.current, { x: 800, y: 470, zoom: 0.66 })
      const shots = ['.f4-macro', '.f4-globe', '.f4-gap', '.f4-wright', '.f4-curve', '.f4-map']
      const show = (sel: string, at: number, dur = 0.01) => {
        for (const s of shots) {
          if (s === sel) fade(tl, s, 1, at, dur, 0)
          else tl.set(s, { opacity: 0 }, at + dur)
        }
      }

      /* b0: macro shots, gliding along the dark table */
      tl.addLabel('b0', 0)
      show('.f4-macro', 0)
      camMacro.to(tl, { x: 1150, y: 470, zoom: 1.35 }, 0.3, 2.4, 'power2.inOut')
      fade(tl, '.f4-ml-0', 1, 0.3, 0.4)
      tl.fromTo('.f4-glint', { x: -140 }, { x: 200, duration: 1.4, ease: 'power1.inOut', immediateRender: false }, 2.4)
      fade(tl, '.f4-ml-1', 1, 2.5, 0.4)
      camMacro.to(tl, { x: 1900, y: 470, zoom: 1.4 }, 3.0, 2.2, 'power2.inOut')
      fade(tl, '.f4-ml-2', 1, 4.6, 0.4)
      camMacro.to(tl, { x: 2650, y: 470, zoom: 1.35 }, 5.4, 2.0, 'power2.inOut')
      tl.fromTo('.f4-magnet', { x: -260, rotation: -20 }, { x: 0, rotation: 0, duration: 0.35, ease: 'power4.in', immediateRender: false }, 7.2)
      camMacro.shake(tl, 7.55, 0.9, 0.3)
      fade(tl, '.f4-clack', 1, 7.55, 0.05)
      fade(tl, '.f4-clack', 0, 7.7, 0.4, 1)
      fade(tl, '.f4-ml-3', 1, 7.6, 0.4)
      tl.to({}, { duration: 0.1 }, 9.0)

      /* b1: the globe turns to China; arcs flow; then they flicker red */
      const b1 = 9.2
      tl.addLabel('b1', b1)
      show('.f4-globe', b1, 0.6)
      const g = { lon: 40 }
      const front = RT?.querySelector('.f4-dots-front')
      const limb = RT?.querySelector('.f4-dots-limb')
      const china = RT?.querySelector('.f4-dots-china')
      const grat = RT?.querySelector('.f4-grat')
      const arcs = RT ? [...RT.querySelectorAll('.f4-arc')] : []
      const redArcs = RT ? [...RT.querySelectorAll('.f4-redarc')] : []
      const draw = () => {
        const d = dotPaths(g.lon, G.lat0, G.R, G.cx, G.cy)
        front?.setAttribute('d', d.front)
        limb?.setAttribute('d', d.limb)
        china?.setAttribute('d', d.china)
        grat?.setAttribute('d', graticule(g.lon, G.lat0, G.R, G.cx, G.cy))
        let k = 0
        for (const s of SOURCES)
          for (const dd of DESTS) {
            const p = arcPath(s, dd, g.lon, G.lat0, G.R, G.cx, G.cy)
            arcs[k]?.setAttribute('d', p)
            redArcs[k]?.setAttribute('d', p)
            k++
          }
      }
      draw()
      tl.fromTo(g, { lon: 40 }, { lon: 96, duration: 3.2, ease: 'power2.out', onUpdate: draw, immediateRender: false }, b1)
      tl.fromTo(g, { lon: 96 }, { lon: 104, duration: 4.0, ease: 'none', onUpdate: draw, immediateRender: false }, b1 + 3.2)
      fade(tl, '.f4-arcs', 1, b1 + 1.4, 1.0)
      fade(tl, '.f4-chinalab', 1, b1 + 2.6, 0.5)
      fade(tl, '.f4-redarcs', 1, b1 + 4.4, 0.05)
      tl.fromTo('.f4-redarcs', { opacity: 1 }, { opacity: 0.2, duration: 0.08, yoyo: true, repeat: 7, immediateRender: false }, b1 + 4.45)
      fade(tl, '.f4-licence', 1, b1 + 4.5, 0.2)
      tl.to({}, { duration: 0.1 }, b1 + 7.1)

      /* b2: two gold bars */
      const b2 = b1 + 7.3
      tl.addLabel('b2', b2)
      show('.f4-gap', b2, 0.6)
      camGap.to(tl, { x: 800, y: 470, zoom: 1.0 }, b2, 0.01)
      GAP_ROWS.forEach((_, i) => {
        tl.set(`.f4-ga-${i}`, { scaleY: 0, svgOrigin: `0 ${BARS.y1 - GAP_ROWS.slice(0, i).reduce((s, r) => s + r.a, 0) * BARS.scale}` }, 0)
        tl.set(`.f4-gb-${i}`, { scaleY: 0, svgOrigin: `0 ${BARS.y1 - GAP_ROWS.slice(0, i).reduce((s, r) => s + r.b, 0) * BARS.scale}` }, 0)
        tl.fromTo(`.f4-ga-${i}`, { scaleY: 0 }, { scaleY: 1, duration: 0.6, ease: 'power2.out', svgOrigin: `0 ${BARS.y1 - GAP_ROWS.slice(0, i).reduce((s, r) => s + r.a, 0) * BARS.scale}`, immediateRender: false }, b2 + 0.6 + i * 0.5)
        tl.fromTo(`.f4-gb-${i}`, { scaleY: 0 }, { scaleY: 1, duration: 0.9, ease: 'power2.out', svgOrigin: `0 ${BARS.y1 - GAP_ROWS.slice(0, i).reduce((s, r) => s + r.b, 0) * BARS.scale}`, immediateRender: false }, b2 + 1.2 + i * 0.6)
      })
      fade(tl, '.f4-gtop-a', 1, b2 + 2.0, 0.4)
      fade(tl, '.f4-gtop-b', 1, b2 + 3.2, 0.4)
      fade(tl, '.f4-glabs', 1, b2 + 3.6, 0.6)
      fade(tl, '.f4-gbrace', 1, b2 + 4.4, 0.6)
      camGap.to(tl, { x: 830, y: 400, zoom: 1.18 }, b2 + 4.4, 4.4, 'sine.inOut')
      fade(tl, '.f4-ms', 1, b2 + 5.0, 0.5)
      tl.to({}, { duration: 0.1 }, b2 + 8.9)

      /* b3: the learning curve */
      const b3 = b2 + 9.1
      tl.addLabel('b3', b3)
      show('.f4-wright', b3, 0.6)
      fade(tl, '.f4-waxes', 1, b3 + 0.3, 0.5)
      tl.fromTo('.f4-wline-bat', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 2.6, ease: 'power1.inOut', immediateRender: false }, b3 + 1.0)
      fade(tl, '.f4-wlab-bat', 1, b3 + 3.0, 0.5)
      tl.fromTo('.f4-wline-sol', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 2.6, ease: 'power1.inOut', immediateRender: false }, b3 + 2.4)
      fade(tl, '.f4-wlab-sol', 1, b3 + 4.6, 0.5)
      fade(tl, '.f4-doubles', 1, b3 + 4.0, 0.6)
      fade(tl, '.f4-handdot', 1, b3 + 6.6, 0.4)
      tl.fromTo('.f4-handdot', { scale: 3 }, { scale: 1, duration: 0.6, ease: 'back.out(2)', transformOrigin: '50% 50%', immediateRender: false }, b3 + 6.6)
      tl.fromTo('.f4-wline-hand', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 3.0, ease: 'power1.inOut', immediateRender: false }, b3 + 7.4)
      fade(tl, '.f4-wlab-hand', 1, b3 + 7.6, 0.5)
      tl.to({}, { duration: 0.1 }, b3 + 12.9)

      /* b4: the play */
      const b4 = b3 + 13.1
      tl.addLabel('b4', b4)
      show('.f4-curve', b4, 0.8)

      /* b5: back to the map; all rings glow; we rise toward the frontier */
      const b5 = b4 + 1.2
      tl.addLabel('b5', b5)
      show('.f4-map', b5, 1.0)
      camMap.to(tl, { x: 800, y: 470, zoom: 0.66 }, b5, 0.01)
      fade(tl, '.f4m-ring-wall', 1, b5 + 0.2, 0.6, 0.6)
      tl.fromTo('.f4-wallglow', { strokeWidth: 70, opacity: 0.8 }, { strokeWidth: 6, opacity: 0.5, duration: 2.0, ease: 'power2.out', immediateRender: false }, b5 + 0.2)
      ;(['shape', 'muscle', 'tendons', 'touch', 'brain'] as const).forEach((q, i) => {
        fade(tl, `.f4m-ring-${q}`, 1, b5 + 1.6 + i * 0.35, 0.5, 0.22)
        fade(tl, `.f4m-lab-${q}`, 1, b5 + 1.6 + i * 0.35, 0.5, 0.35)
      })
      fade(tl, '.f4-wallwords', 1, b5 + 3.4, 0.8)
      hand.to(tl, { view: { yaw: 20 }, pose: GRASPS.open }, b5, 5, 'sine.inOut')
      camMap.to(tl, { x: 800, y: -120, zoom: 0.5 }, b5 + 6.0, 5.6, 'power2.inOut')
      fade(tl, '.f4-horizon', 1, b5 + 6.4, 2.0)
      tl.to({}, { duration: 0.1 }, b5 + 11.9)
    },
    [hand],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.f4-arc', { strokeDashoffset: -60, duration: 1.6, repeat: -1, ease: 'none' })
    gsap.to('.f4-qm', { opacity: 0.25, duration: 2.6, yoyo: true, repeat: -1, stagger: 0.3, ease: 'sine.inOut' })
    gsap.to('.f4-coil', { opacity: 0.6, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  /* ---------- the curve play ---------- */
  useEffect(() => {
    if (!active || !under || locks[String(lr)] !== undefined) return
    const at = nFor(1000, lr)
    setLocks((l) => ({ ...l, [String(lr)]: at }))
    emit({ type: 'attempt', correct: true, detail: `found under $1,000 at ${Math.round(lr * 100)}%: ${fmtN(at)} hands` })
  }, [active, under, lr, locks, emit])

  const hits = Object.keys(locks).length
  const explored = tried.length >= 2 && movedAfterSwitch
  useEffect(() => {
    if (!active || won || hits < 1 || !explored) return
    const id = window.setTimeout(() => {
      setWon(true)
      memory.wright = { locks }
      void say('At a nineteen percent learning rate, it takes about eight doublings: millions of hands. A small change in the rate changes the answer by years.')
      playDoneRef.current()
    }, 1600)
    return () => window.clearTimeout(id)
  }, [active, won, hits, explored, locks, memory, say])

  const pickRate = (r: number) => {
    if (!active || won) return
    setLr(r)
    if (!tried.includes(r)) setTried((x) => [...x, r])
    if (r !== lr) setMovedAfterSwitch(false)
    emit({ type: 'progress', detail: `learning rate ${Math.round(r * 100)}%` })
  }
  const drag = (v: number) => {
    if (!active || won) return
    setT(Math.max(tOfN(N0), v))
    if (tried.length >= 2) setMovedAfterSwitch(true)
  }

  /* ---------- what Pip sees ---------- */
  useEffect(() => {
    if (cueIndex === 4) {
      reportState(
        'Wright’s law play. A log-log chart: cumulative hands built (10 thousand to 100 million) across, cost of one hand down the side ($100 to $10,000). The line starts at $5,000 when 30,000 hands have been built. The learner drags a slider forward (more hands built over the years) and the gold line extends; a little hand rides the end with its price tag. Chips set the learning rate (cost drop per doubling): 10%, 19% (default, like batteries) or 25%. cost = 5000 × (1 − rate)^(number of doublings). ' +
          `Now: rate ${Math.round(lr * 100)}%, ${fmtN(N)} hands built, ${doublings.toFixed(1)} doublings, $${Math.round(cost).toLocaleString('en-US')} a hand. Found so far: ${Object.entries(locks).map(([k, v]) => `${Math.round(+k * 100)}% → ${fmtN(v)}`).join(', ') || 'nothing yet'}. Rates tried: ${tried.map((r) => Math.round(r * 100) + '%').join(', ')}. ` +
          'Goal: push until a hand costs under $1,000, then try a second learning rate to feel how sensitive the answer is. Answers: 19% needs about 7.6 doublings, about 6 million hands; 25% about 5.6 doublings, about 1.4 million hands; 10% needs over 15 doublings, about 1.2 billion hands, beyond the slider. ' +
          'Likely mix-ups: thinking cost falls with time rather than with how many have been built, and expecting a small change in the rate to matter little.',
      )
      setHints(['Each doubling of production cuts the cost by the same share.', 'Try a lower learning rate and see how many more hands it takes.'])
    } else {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
    }
  }, [cueIndex, lr, N, doublings, cost, locks, tried, reportState, setHints])

  /* the play chart's line, from the start to where the learner is */
  const lineTo = (r: number, Nend: number) => {
    const pts: string[] = []
    const steps = 40
    for (let i = 0; i <= steps; i++) {
      const n = N0 * Math.pow(Nend / N0, i / steps)
      pts.push(`${WX(n).toFixed(1)} ${WY(Math.max(100, costAt(n, r))).toFixed(1)}`)
    }
    return 'M' + pts.join(' L')
  }
  const hx = WX(N)
  const hy = WY(Math.max(100, cost))

  /* the b3 schematic lines */
  const batLine = `M${LX(0)} ${LY(4.4)} L${LX(11.5)} ${LY(4.4 - 11.5 * Math.log10(1 / 0.81))}`
  const solLine = `M${LX(0.5)} ${LY(3.8)} L${LX(11.5)} ${LY(3.8 - 11 * 0.0915)}`

  return (
    <g ref={root}>
      <FactoryCSS />
      <defs>
        <pattern id="f4-coilpat" width={10} height={10} patternUnits="userSpaceOnUse" patternTransform="rotate(60)">
          <rect width={10} height={10} fill="#a8622a" />
          <rect width={4} height={10} fill="#ffd2a1" opacity={0.7} />
        </pattern>
        <pattern id="f4-thread" width={14} height={40} patternUnits="userSpaceOnUse" patternTransform="skewX(-25)">
          <rect width={14} height={40} fill="#8e99aa" />
          <rect width={6} height={40} fill="#e4ebf4" />
        </pattern>
        <radialGradient id="f4-globegrad" cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#1b2944" />
          <stop offset="1" stopColor="#070b14" />
        </radialGradient>
      </defs>

      {/* ---------- b0: the tiny parts, in macro ---------- */}
      <g className="f4-macro" ref={macroShot} pointerEvents="none">
        <g data-depth="0.4">
          <rect x={-800} y={-600} width={5600} height={2100} fill={C.ink} />
          <g filter="url(#cn-dof-3)" opacity={0.7}>
            {Array.from({ length: 14 }, (_, i) => (
              <circle key={i} cx={-200 + i * 260} cy={260 + (i % 3) * 90} r={30 + (i % 4) * 10} fill={i % 2 ? C.key : C.rim} opacity={0.25} />
            ))}
          </g>
        </g>
        <g data-depth="1">
          <rect x={-800} y={640} width={5600} height={900} fill={C.ink1} />
          <rect x={-800} y={640} width={5600} height={3} fill={C.key} opacity={0.25} />
          {[420, 1150, 1900, 2650].map((x) => (
            <Pool key={x} x={x} y={520} r={420} color="key" opacity={0.7} />
          ))}
          {/* 1: a coreless micro motor, cut away */}
          <g transform="translate(420 520)">
            <ellipse cx={0} cy={124} rx={260} ry={18} fill="#000" opacity={0.6} filter="url(#cn-dof-1)" />
            <rect x={-200} y={-90} width={320} height={180} rx={20} fill="url(#cn-metal)" />
            <path d="M-60 -90 L120 -90 L120 90 L-60 90 Z" fill={C.ink2} />
            <g className="f4-coil">
              <rect x={-50} y={-74} width={160} height={148} rx={10} fill="url(#f4-coilpat)" />
            </g>
            <rect x={-50} y={-74} width={160} height={148} rx={10} fill="none" stroke="#7a3d14" strokeWidth={3} />
            <rect x={-20} y={-14} width={150} height={28} fill={C.metal} />
            <rect x={120} y={-10} width={160} height={20} rx={4} fill="url(#cn-metal)" />
            <rect x={-230} y={-60} width={34} height={120} rx={8} fill={C.metalDark} />
            <Label className="f4-ml-0" x={30} y={-60} tx={-60} ty={-200} text="coreless micro motor" sub="copper cup, no iron core" color={C.paper} anchor="middle" />
          </g>
          {/* 2: a ground lead screw with its nut */}
          <g transform="translate(1150 520)">
            <ellipse cx={0} cy={110} rx={340} ry={14} fill="#000" opacity={0.6} filter="url(#cn-dof-1)" />
            <rect x={-330} y={-22} width={660} height={44} rx={8} fill="url(#f4-thread)" />
            <rect x={-60} y={-60} width={120} height={120} rx={10} fill={C.metalDark} />
            <rect x={-60} y={-60} width={120} height={20} rx={8} fill={C.metal} opacity={0.6} />
            <clipPath id="f4-screwclip">
              <rect x={-330} y={-22} width={660} height={44} rx={8} />
            </clipPath>
            <g clipPath="url(#f4-screwclip)">
              <rect className="f4-glint" x={-200} y={-30} width={40} height={60} fill={C.white} opacity={0.65} filter="url(#cn-dof-1)" />
            </g>
            <Label className="f4-ml-1" x={200} y={-20} tx={200} ty={-170} text="precision-ground lead screw" color={C.paper} anchor="middle" />
          </g>
          {/* 3: a MIM gear on a fingertip */}
          <g transform="translate(1900 520)">
            <path d="M-400 240 L-120 40 Q-40 -20 40 10 Q110 40 100 110 Q90 170 20 190 L-260 330 Z" fill={C.skinB} />
            <path d="M-120 40 Q-40 -20 40 10 Q110 40 100 110" fill="none" stroke={C.keyLight} strokeWidth={6} opacity={0.6} />
            <path d="M-20 30 Q20 0 60 30" fill="none" stroke={C.skinBDark} strokeWidth={3} opacity={0.5} />
            <Gear x={10} y={30} r={20} teeth={12} />
            <Label className="f4-ml-2" x={10} y={10} tx={140} ty={-170} text="a gear smaller than a lentil" color={C.paper} />
          </g>
          {/* 4: a neodymium magnet snapping to a steel spanner */}
          <g transform="translate(2650 520)">
            <path d="M-60 70 L260 -30 Q300 -50 330 -20 L340 30 Q320 60 290 40 L-40 110 Z" fill="url(#cn-metal)" stroke={C.metalDark} strokeWidth={2} />
            <g className="f4-magnet">
              <rect x={-150} y={-40} width={110} height={80} rx={6} fill="#c9d1dc" stroke="#7d889a" strokeWidth={2} transform="rotate(-17 -95 0)" />
              <text x={-95} y={10} textAnchor="middle" fill={C.ink3} fontFamily={MONO} fontSize={22} fontWeight={700} transform="rotate(-17 -95 0)">
                NdFeB
              </text>
            </g>
            <circle className="f4-clack" cx={-40} cy={10} r={60} fill="none" stroke={C.paper} strokeWidth={4} opacity={0} />
            <Label className="f4-ml-3" x={-95} y={-30} tx={-120} ty={-190} text="neodymium magnet" sub="rare earths inside" color={C.paper} anchor="middle" />
          </g>
        </g>
        <g data-depth="1.8">
          <g filter="url(#cn-dof-3)">
            <rect x={760} y={560} width={70} height={400} fill={C.ink} />
            <circle cx={1540} cy={760} r={120} fill={C.ink} />
            <rect x={2260} y={600} width={60} height={400} fill={C.ink} />
          </g>
        </g>
        <Vignette />
      </g>

      {/* ---------- b1: the globe ---------- */}
      <g className="f4-globe" opacity={0} pointerEvents="none">
        <rect x={-100} y={-100} width={1800} height={1100} fill={C.ink} />
        <Dust x={0} y={0} w={1600} h={900} count={50} seed={12} color={C.paper} size={0.4} />
        <circle cx={G.cx} cy={G.cy} r={G.R + 30} fill="url(#cn-pool-rim)" opacity={0.6} />
        <circle cx={G.cx} cy={G.cy} r={G.R} fill="url(#f4-globegrad)" />
        <path className="f4-grat" d="" fill="none" stroke={C.rimDeep} strokeWidth={1} opacity={0.25} />
        <path className="f4-dots-limb" d="" fill="none" stroke={C.slate} strokeWidth={4} strokeLinecap="round" />
        <path className="f4-dots-front" d="" fill="none" stroke={C.mist} strokeWidth={4.5} strokeLinecap="round" opacity={0.75} />
        <path className="f4-dots-china" d="" fill="none" stroke={C.gold} strokeWidth={5.5} strokeLinecap="round" filter="url(#cn-bloom)" />
        <circle cx={G.cx} cy={G.cy} r={G.R} fill="none" stroke={C.rim} strokeWidth={2} opacity={0.4} />
        <g className="f4-arcs" opacity={0}>
          {Array.from({ length: SOURCES.length * DESTS.length }, (_, k) => (
            <path key={k} className="f4-arc" d="" fill="none" stroke={C.gold} strokeWidth={3} strokeDasharray="14 16" strokeLinecap="round" opacity={0.9} />
          ))}
        </g>
        <g className="f4-redarcs" opacity={0}>
          {Array.from({ length: SOURCES.length * DESTS.length }, (_, k) => (
            <path key={k} className="f4-redarc" d="" fill="none" stroke={C.danger} strokeWidth={4} strokeLinecap="round" />
          ))}
        </g>
        <g className="f4-chinalab" opacity={0}>
          <Label x={835} y={395} tx={1200} ty={200} text="China: ~69% mined" sub="~90% processed" color={C.gold} size={32} hidden={false} />
        </g>
        <g className="f4-licence" opacity={0}>
          <text x={800} y={880} textAnchor="middle" fill={C.danger} fontFamily={MONO} fontSize={30} fontWeight={600}>
            export licences, April 2025
          </text>
        </g>
        <SourceNote className="f4-chinalab" x={60} y={870}>
          rare earths, 2025
        </SourceNote>
        <Vignette />
      </g>

      {/* ---------- b2: $46k and $131k ---------- */}
      <g className="f4-gap" ref={gapShot} opacity={0} pointerEvents="none">
        <g data-depth="0.5">
          <Blueprint />
          <Pool x={800} y={500} r={700} color="gold" opacity={0.16} />
        </g>
        <g data-depth="1">
          <line x1={300} x2={1300} y1={BARS.y1} y2={BARS.y1} stroke={C.fog} strokeWidth={2} />
          {(['a', 'b'] as const).map((side) => {
            const x = side === 'a' ? 470 : 930
            let acc = 0
            return (
              <g key={side}>
                {GAP_ROWS.map((r, i) => {
                  const v = side === 'a' ? r.a : r.b
                  const y = BARS.y1 - (acc + v) * BARS.scale
                  acc += v
                  return <rect key={i} className={`f4-g${side}-${i}`} x={x} y={y} width={200} height={v * BARS.scale - 2} fill={r.color} opacity={0.85} />
                })}
                <text className={`f4-gtop-${side}`} x={x + 100} y={BARS.y1 - acc * BARS.scale - 24} opacity={0} textAnchor="middle" fill={C.gold} fontFamily={SERIF} fontSize={64} fontWeight={600}>
                  ${side === 'a' ? '46' : '131'}k
                </text>
                <text x={x + 100} y={BARS.y1 + 42} textAnchor="middle" fill={C.paper} fontFamily={SANS} fontSize={24}>
                  {side === 'a' ? 'with Chinese suppliers' : 'without them'}
                </text>
              </g>
            )
          })}
          <g className="f4-glabs" opacity={0}>
            {GAP_ROWS.map((r, i) => {
              const yb = BARS.y1 - (GAP_ROWS.slice(0, i).reduce((s, q) => s + q.b, 0) + r.b / 2) * BARS.scale
              return (
                <text key={i} x={1150} y={yb + 8} fill={r.color} fontFamily={SANS} fontSize={22}>
                  {r.name}: ${r.a}k → ${r.b}k
                </text>
              )
            })}
          </g>
          <g className="f4-gbrace" opacity={0}>
            <path d={`M700 ${BARS.y1 - 46 * BARS.scale} H900 M900 ${BARS.y1 - 131 * BARS.scale} V${BARS.y1 - 46 * BARS.scale}`} stroke={C.goldLight} strokeWidth={2} strokeDasharray="6 6" fill="none" />
            <text x={800} y={BARS.y1 - 90 * BARS.scale} textAnchor="middle" fill={C.goldLight} fontFamily={SERIF} fontSize={54} fontWeight={600} fontStyle="italic">
              ≈ 2.8×
            </text>
          </g>
          <SourceNote className="f4-ms" x={800} y={880} anchor="middle" color={C.goldLight}>
            Morgan Stanley estimate, Tesla Optimus Gen 2 bill of materials
          </SourceNote>
        </g>
        <Vignette />
      </g>

      {/* ---------- b3: Wright's law ---------- */}
      <g className="f4-wright" opacity={0} pointerEvents="none">
        <Blueprint />
        <g className="f4-waxes" opacity={0}>
          <line x1={240} y1={740} x2={1380} y2={740} stroke={C.fog} strokeWidth={2} />
          <line x1={240} y1={740} x2={240} y2={140} stroke={C.fog} strokeWidth={2} />
          <text x={810} y={800} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={22}>
            total units ever built (each step: ×2)
          </text>
          <text x={240} y={118} fill={C.mist} fontFamily={SANS} fontSize={22}>
            cost per unit (log scale)
          </text>
        </g>
        <g className="f4-doubles" opacity={0}>
          {Array.from({ length: 12 }, (_, d) => (
            <g key={d}>
              <line x1={LX(d)} x2={LX(d)} y1={740} y2={752} stroke={C.mist} />
              {d > 0 && (
                <text x={LX(d) - 47} y={772} textAnchor="middle" fill={C.fog} fontFamily={MONO} fontSize={15}>
                  ×2
                </text>
              )}
            </g>
          ))}
        </g>
        <path className="f4-wline-bat" d={batLine} pathLength={1} fill="none" stroke={C.mist} strokeWidth={5} strokeDasharray="1 1" strokeDashoffset={1} strokeLinecap="round" />
        <path className="f4-wline-sol" d={solLine} pathLength={1} fill="none" stroke={C.fog} strokeWidth={4} strokeDasharray="1 1" strokeDashoffset={1} strokeLinecap="round" />
        <g className="f4-wlab-bat" opacity={0}>
          <text x={LX(7.4)} y={LY(4.4 - 7.4 * 0.0915) - 22} fill={C.paper} fontFamily={SANS} fontSize={24} fontWeight={600}>
            batteries: −19% per doubling
          </text>
          <text x={LX(0.2)} y={LY(4.4) - 16} fill={C.mist} fontFamily={MONO} fontSize={17}>
            $9,200/kWh, 1991
          </text>
          <text x={LX(11.5)} y={LY(4.4 - 11.5 * 0.0915) + 34} textAnchor="end" fill={C.mist} fontFamily={MONO} fontSize={17}>
            $78/kWh, 2024
          </text>
        </g>
        <g className="f4-wlab-sol" opacity={0}>
          <text x={LX(3.0)} y={LY(3.8 - 2.5 * 0.0915) + 40} fill={C.fog} fontFamily={SANS} fontSize={22}>
            solar panels (schematic)
          </text>
        </g>
        <path className="f4-wline-hand" d={`M${LX(0.3)} ${LY(4.9)} L${LX(8)} ${LY(4.9 - 7.7 * 0.0915)}`} pathLength={1} fill="none" stroke={C.gold} strokeWidth={3} strokeDasharray="0.02 0.02" strokeDashoffset={1} opacity={0.8} />
        <g className="f4-handdot" opacity={0}>
          <circle cx={LX(0.3)} cy={LY(4.9)} r={16} fill={C.gold} filter="url(#cn-bloom)" />
        </g>
        <Label className="f4-wlab-hand" x={LX(0.3) + 14} y={LY(4.9) - 10} tx={LX(1.6)} ty={LY(4.9) - 60} text="robot hands: just starting" color={C.gold} size={28} />
        <Vignette />
      </g>

      {/* ---------- b4: the play: drag the year forward ---------- */}
      <g className="f4-curve" opacity={0}>
        <Blueprint />
        <Pool x={700} y={500} r={700} color="gold" opacity={0.1} />
        {/* axes */}
        <line x1={240} y1={740} x2={1160} y2={740} stroke={C.fog} strokeWidth={2} />
        <line x1={240} y1={740} x2={240} y2={170} stroke={C.fog} strokeWidth={2} />
        {[1e4, 1e5, 1e6, 1e7, 1e8].map((v) => (
          <g key={v}>
            <line x1={WX(v)} x2={WX(v)} y1={180} y2={740} stroke={C.ink4} strokeDasharray="3 9" />
            <text x={WX(v)} y={770} textAnchor="middle" fill={C.mist} fontFamily={MONO} fontSize={18}>
              {v >= 1e6 ? `${v / 1e6}M` : `${v / 1e3}k`}
            </text>
          </g>
        ))}
        {[100, 1000, 10000].map((c) => (
          <text key={c} x={226} y={WY(c) + 6} textAnchor="end" fill={C.mist} fontFamily={MONO} fontSize={18}>
            ${c >= 1000 ? `${c / 1000}k` : c}
          </text>
        ))}
        <text x={240} y={140} fill={C.mist} fontFamily={SANS} fontSize={22}>
          cost of one hand
        </text>
        <line x1={240} x2={1160} y1={WY(1000)} y2={WY(1000)} stroke={C.paper} strokeWidth={2} strokeDasharray="8 8" opacity={0.6} />
        <text x={250} y={WY(1000) - 12} fill={C.paper} fontFamily={SANS} fontSize={20} opacity={0.8}>
          under $1,000?
        </text>
        {/* the lines found so far, faint */}
        {Object.keys(locks).map((k) =>
          +k !== lr ? <path key={k} d={lineTo(+k, locks[k])} fill="none" stroke={C.goldDark} strokeWidth={3} opacity={0.5} /> : null,
        )}
        {tried.filter((r) => r !== lr && locks[String(r)] === undefined).map((r) => (
          <path key={r} d={lineTo(r, 1e8)} fill="none" stroke={C.goldDark} strokeWidth={3} strokeDasharray="6 8" opacity={0.4} />
        ))}
        <path d={lineTo(lr, N)} fill="none" stroke={C.gold} strokeWidth={6} strokeLinecap="round" filter="url(#cn-bloom)" />
        <circle cx={WX(N0)} cy={WY(C0)} r={9} fill={C.gold} />
        <text x={WX(N0) + 14} y={WY(C0) - 14} fill={C.goldLight} fontFamily={MONO} fontSize={17}>
          today: $5,000 · 30k built
        </text>
        {/* the rider: a hand with its price tag */}
        <g transform={`translate(${hx} ${hy})`}>
          <FlatHand x={0} y={-80} s={0.24} prefix="f4-rider" fill={under ? 'url(#cn-shell)' : C.shellMid} />
          <PriceTag x={0} y={10} text={money(Math.round(cost / 10) * 10)} size={24} len={16} color={under ? C.lime : C.gold} />
        </g>
        {/* readouts */}
        <Readout x={240} y={96} color={C.paper} size={26}>
          {fmtN(N)} hands built · {doublings.toFixed(1)} doublings
        </Readout>
        {/* learning rate chips */}
        <text x={1220} y={190} fill={C.mist} fontFamily={SANS} fontSize={18} letterSpacing={2}>
          COST DROP PER DOUBLING
        </text>
        {RATES.map((r, i) => (
          <Chip key={r} x={1262 + i * 84} y={232} w={72} h={46} text={`${Math.round(r * 100)}%`} color={C.gold} active={lr === r} disabled={!active || won} onClick={() => pickRate(r)} tutor={`rate-${Math.round(r * 100)}`} />
        ))}
        <text x={1220} y={320} fill={C.mist} fontFamily={SANS} fontSize={18} letterSpacing={2}>
          UNDER $1,000 AT…
        </text>
        {RATES.map((r, i) => (
          <text key={r} x={1220} y={360 + i * 40} fill={locks[String(r)] !== undefined ? C.lime : C.fog} fontFamily={MONO} fontSize={21}>
            {Math.round(r * 100)}%: {locks[String(r)] !== undefined ? `${fmtN(locks[String(r)])} hands` : tried.includes(r) && r === lr && N >= 9.9e7 ? 'not by 100M' : tried.includes(r) && r !== lr && r === 0.1 ? 'not by 100M' : '?'}
          </text>
        ))}
        {hits > 0 && !explored && (
          <text x={1220} y={500} fill={C.goldLight} fontFamily={SANS} fontSize={19}>
            now try another rate
          </text>
        )}
        <g pointerEvents={active && !won ? 'auto' : 'none'}>
          <Slider x={240} y={840} w={920} value={t} onChange={drag} color={C.gold} tutor="hands-built" disabled={!active || won} />
        </g>
        <text x={1160} y={812} textAnchor="end" fill={C.mist} fontFamily={SANS} fontSize={18}>
          drag forward in time: more hands built →
        </text>
        <Vignette />
      </g>

      {/* ---------- b5: the map, all rings lit; rising to the frontier ---------- */}
      <g className="f4-map" ref={mapShot} opacity={0} pointerEvents="none">
        <g data-depth="0.4">
          <Blueprint opacity={0.6} />
          <Dust x={-600} y={-900} w={2800} h={2200} count={50} seed={93} color={C.goldLight} size={0.7} />
        </g>
        <g data-depth="1">
          <g className="f4-horizon" opacity={0}>
            <rect x={-1400} y={-1500} width={4400} height={900} fill="url(#cn-fade-up)" />
            <rect x={-1400} y={-640} width={4400} height={3} fill={C.rim} opacity={0.5} filter="url(#cn-bloom)" />
            {Array.from({ length: 22 }, (_, i) => {
              const x = -800 + ((i * 397) % 3200)
              const y = -760 - ((i * 131) % 520)
              const s = 40 + ((i * 53) % 90)
              return (
                <text key={i} className="f4-qm hd-drift" x={x} y={y} fill={i % 4 === 0 ? C.rim : C.mist} opacity={0.7} fontFamily={SERIF} fontSize={s} fontStyle="italic" textAnchor="middle" style={{ animationDelay: `${-i * 0.7}s` }}>
                  ?
                </text>
              )
            })}
          </g>
          <Pool x={800} y={470} r={520} color="rim" opacity={0.3} />
          <FiveMap cx={800} cy={470} prefix="f4m" lit={['wall']} />
          <circle className="f4-wallglow" cx={800} cy={470} r={620} fill="none" stroke={C.gold} strokeWidth={6} opacity={0.5} filter="url(#cn-bloom-big)" />
          <Hand3D store={hand} x={800} y={590} look="robot" arm={80} light={[0.7, -0.6]} />
          <text className="f4-wallwords" x={800} y={1085} opacity={0} textAnchor="middle" fill={C.gold} fontFamily={SANS} fontSize={40} fontWeight={600} letterSpacing={3}>
            tooling · part count · durability · supply
          </text>
        </g>
        <Vignette />
      </g>
    </g>
  )
}

export const ch4: Chapter = {
  id: 'supply',
  title: 'Where the parts come from',
  cues: CUES,
  Scene: Ch4Supply,
  enter: { type: 'zoom', x: 1200, y: 600 },
  deeper: [SupplyReading],
}
