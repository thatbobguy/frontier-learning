import gsap from 'gsap'
import { useCallback, useEffect, useRef } from 'react'
import { camera } from '../../../cine/camera'
import { GRASPS, Hand3D, useHandStore } from '../../../cine/hand3d'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { POSES, Robot } from '../../../cine/people'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Beam, Dust, Label, Pool, Vignette, fade, useAmbient } from '../shared/kit'
import { at, IndustryChart, MAKERS, MiniHand } from './industry'
import { IndustryReading } from './readings'

export const CUES: Cue[] = [
  { id: 'map', say: 'So who’s building hands in 2026? Picture a map: how dexterous on one side, how cheap and tough on the other.' },
  { id: 'corner', say: 'Notice the empty corner: dexterous, cheap and tough, all at once. Nobody is there yet. Whoever gets there first wins the market.' },
  { id: 'models', say: 'Companies are betting on different routes. Some build everything themselves. Some sell hands to the hundred and forty Chinese robot makers who can’t build their own. Some skip humanoids and put hands on factory arms.' },
  { id: 'china', say: 'Most hands shipped today come from China, where the whole supply chain sits in a few city clusters. Prices there are falling fastest.' },
]

const STATE = [
  'A dark gallery of robot hands on plinths fades into a chart. Up is "dexterous", right is "cheap + tough". Dots with small hand icons and gold labels: Robotiq gripper (bottom right: one motor, cheap, very tough, not dexterous), Inspire and AgiBot linkage hands (middle right: 6 motors, cheap-ish, tough), Wuji and Sharpa (upper middle: 20-22 DoF, $16k-50k), Shadow DEX-EE (top left: very dexterous and tough but very expensive), LEAP / ORCA / Aero (upper middle-left: cheap open-source research hands but fragile, with a red crack icon), and a dashed amber cluster of in-house humanoid hands (Tesla, Figure, 1X, Atlas). Placements are approximate judgements, not measurements.',
  'The top-right corner of the chart glows gold and is empty: dexterous, cheap and tough all at once. Nobody is there yet. The camera drifts toward it. This is the iron triangle from film 1: today you can usually pick two of dexterity, robustness and low cost.',
  'Three quick vignettes of business models. 1) A vertically integrated factory: one roof, every part made in-house (motors, gears, hands, robots), like Tesla, 1X or Unitree. 2) A hand supplier’s warehouse shipping crates of hands to many different robot makers (China had 140+ humanoid makers in 2025, most of which buy hands from suppliers like Inspire or Linkerbot). 3) A dexterous hand on an ordinary industrial arm at a factory bench, the Mimic approach: skip the humanoid, sell the hand on an arm as a service.',
  'A night map of eastern China. Glowing clusters: Beijing (Linkerbot, Inspire; about 300 robotics firms in Yizhuang), the Yangtze delta (Shanghai, Suzhou, Hangzhou: AgiBot, Unitree, Xynova; Suzhou’s Wuzhong district has over 1,000 robotics firms), Ningbo and Xinchang (screws and reducers), and Shenzhen (UBTech, motor makers, 70+ humanoid supply-chain firms). Supply lines pulse between them. Counters: over 30,000 dexterous hands shipped in 2025; average Chinese hand prices fell from about RMB 50-100k to RMB 20-35k ($3-5k).',
]

/* ---------------------------------------------------------------- the night map of China */

const px = (lon: number) => 300 + (lon - 100) * 36
const py = (lat: number) => 40 + (43 - lat) * 38
const poly = (pts: [number, number][]) => `M${pts.map(([lo, la]) => `${px(lo).toFixed(1)} ${py(la).toFixed(1)}`).join(' L')} Z`

const COAST: [number, number][] = [
  [124.4, 39.9], [123.0, 39.7], [121.6, 38.9], [121.2, 39.4], [122.0, 40.5], [121.0, 40.9], [119.8, 40.0], [118.9, 39.2], [117.8, 38.9], [118.4, 38.0],
  [118.9, 37.4], [119.5, 37.1], [120.7, 37.8], [122.6, 37.4], [121.4, 36.7], [120.3, 36.0], [119.4, 35.1], [120.3, 34.2], [121.0, 32.9], [121.9, 31.7],
  [121.9, 31.0], [121.2, 30.6], [120.5, 30.3], [121.6, 29.9], [122.0, 29.3], [121.4, 28.3], [120.6, 27.3], [119.6, 26.3], [119.0, 25.3], [118.1, 24.5],
  [116.7, 23.4], [115.4, 22.8], [114.2, 22.3], [113.5, 22.2], [112.5, 21.8], [111.0, 21.4], [110.3, 20.4], [109.9, 21.5], [108.5, 21.6], [107.9, 21.5],
  [106.0, 20.6], [96, 20.6], [96, 46], [130, 46], [130.4, 42.4], [126, 41.5],
]
const KOREA: [number, number][] = [[124.4, 39.9], [125.1, 38.5], [126.5, 37.6], [126.3, 35.5], [126.6, 34.4], [128.5, 34.8], [129.4, 35.6], [129.5, 37.0], [128.5, 38.5], [129.8, 40.8], [130.4, 42.4], [126, 41.5]]
const TAIWAN: [number, number][] = [[121.0, 25.3], [121.9, 25.0], [121.8, 24.0], [120.9, 22.0], [120.2, 22.9], [120.1, 23.9], [120.7, 24.8]]
const HAINAN: [number, number][] = [[108.6, 19.1], [110.5, 20.1], [111, 19.6], [110, 18.2], [109.0, 18.3]]

const CLUSTERS = [
  { id: 'bj', lon: 116.4, lat: 39.9, r: 70, name: 'Beijing', sub: 'Linkerbot · Inspire · ~300 firms', side: 'l' as const },
  { id: 'yz', lon: 120.9, lat: 31.2, r: 95, name: 'Shanghai · Suzhou · Hangzhou', sub: 'AgiBot · Unitree · Xynova', side: 'r' as const },
  { id: 'nb', lon: 121.0, lat: 29.4, r: 40, name: 'Ningbo · Xinchang', sub: 'screws and reducers', side: 'r' as const },
  { id: 'sz', lon: 114.1, lat: 22.6, r: 75, name: 'Shenzhen', sub: 'UBTech · motors · 70+ supply-chain firms', side: 'r' as const },
]
const ROUTES: [string, string][] = [
  ['bj', 'yz'],
  ['yz', 'sz'],
  ['nb', 'yz'],
  ['nb', 'sz'],
  ['bj', 'sz'],
]
const cl = (id: string) => CLUSTERS.find((c) => c.id === id)!
const routeD = (a: string, b: string) => {
  const A = { x: px(cl(a).lon), y: py(cl(a).lat) }
  const B = { x: px(cl(b).lon), y: py(cl(b).lat) }
  const mx = (A.x + B.x) / 2 - (B.y - A.y) * 0.25
  const my = (A.y + B.y) / 2 + (B.x - A.x) * 0.25
  return `M${A.x} ${A.y} Q${mx} ${my} ${B.x} ${B.y}`
}

/* ---------------------------------------------------------------- the business-model vignettes */

/** Panel centres in the models world (the camera pans across). */
const PANEL = [800, 2500, 4200]

function Factory({ x }: { x: number }) {
  // one long roof; parts made at every station, the robot at the end of the line
  const parts = ['magnet', 'motor', 'gear', 'finger', 'hand']
  return (
    <g pointerEvents="none">
      <Pool x={x} y={520} r={760} color="key" opacity={0.45} />
      <path d={`M${x - 640} 300 L${x - 640} 220 L${x - 420} 150 L${x - 420} 220 L${x - 200} 150 L${x - 200} 220 L${x + 20} 150 L${x + 20} 220 L${x + 240} 150 L${x + 240} 220 L${x + 640} 220 L${x + 640} 300 Z`} fill={C.ink3} />
      <rect x={x - 640} y={300} width={1280} height={10} fill={C.keyDeep} opacity={0.5} />
      {/* the conveyor */}
      <rect x={x - 600} y={690} width={1000} height={22} rx={11} fill={C.ink4} />
      {Array.from({ length: 24 }, (_, i) => (
        <circle key={i} cx={x - 590 + i * 42} cy={701} r={7} fill={C.slate} />
      ))}
      {parts.map((p, i) => {
        const sx = x - 520 + i * 200
        return (
          <g key={p}>
            {/* a station's machine */}
            <rect x={sx - 50} y={470} width={100} height={130} rx={8} fill={C.ink2} stroke={C.slate} strokeWidth={2} />
            <rect className="hd-flicker" x={sx - 34} y={490} width={68} height={30} fill={i % 2 ? C.cyanDark : C.amberDark} opacity={0.8} />
            <line x1={sx} y1={600} x2={sx} y2={650} stroke={C.slate} strokeWidth={5} />
            <text x={sx} y={455} textAnchor="middle" fill={C.mist} fontFamily={MONO} fontSize={17}>
              {p}
            </text>
          </g>
        )
      })}
      {/* parts riding the line */}
      <g className="c2-belt">
        {Array.from({ length: 10 }, (_, i) => (
          <g key={i} transform={`translate(${x - 600 + i * 100} 676)`}>
            {i % 5 === 4 ? <MiniHand x={0} y={0} s={0.7} fingers={5} color={C.shell} /> : <rect x={-14} y={-16} width={28} height={16} rx={3} fill={i % 2 ? C.amber : C.metal} />}
          </g>
        ))}
      </g>
      {/* the robots that come off the end */}
      {[0, 1, 2].map((i) => (
        <Robot key={i} name={`c2-ft-${i}`} x={x + 460 + i * 70} y={780} s={0.62} pose={POSES.stand} light="key-left" />
      ))}
      <text x={x} y={130} textAnchor="middle" fill={C.paper} fontFamily={SERIF} fontSize={46} fontWeight={600}>
        build everything yourself
      </text>
      <text x={x} y={178} textAnchor="middle" fill={C.amberLight} fontFamily={SANS} fontSize={24}>
        Tesla · 1X · Unitree · Figure
      </text>
    </g>
  )
}

function Supplier({ x }: { x: number }) {
  const robots = [
    { dx: 280, y: 330, shell: C.shell, visor: C.cyan },
    { dx: 440, y: 390, shell: '#d9c9a8', visor: C.amber },
    { dx: 560, y: 470, shell: '#9fb0cc', visor: C.lime },
    { dx: 600, y: 590, shell: C.shell, visor: C.magenta },
    { dx: 520, y: 700, shell: '#c9a27d', visor: C.cyan },
    { dx: 380, y: 780, shell: '#8f9db4', visor: C.gold },
  ]
  const wx = x - 360
  return (
    <g pointerEvents="none">
      <Pool x={wx} y={560} r={520} color="gold" opacity={0.3} />
      {/* the warehouse: racks of crates */}
      <rect x={wx - 300} y={300} width={420} height={480} fill={C.ink2} />
      <path d={`M${wx - 320} 300 L${wx - 90} 220 L${wx + 140} 300 Z`} fill={C.ink3} />
      {[0, 1, 2, 3].map((r) =>
        [0, 1, 2].map((c) => (
          <g key={`${r}${c}`} transform={`translate(${wx - 270 + c * 120} ${360 + r * 100})`}>
            <rect width={100} height={70} fill={C.goldDark} opacity={0.75} />
            <path d="M0 0 L100 70 M100 0 L0 70" stroke={C.ink} strokeOpacity={0.3} strokeWidth={2} />
            <text x={50} y={44} textAnchor="middle" fill={C.ink} fontFamily={MONO} fontSize={14} fontWeight={700}>
              HANDS
            </text>
          </g>
        )),
      )}
      {/* crates flying out to many makers */}
      {robots.map((r, i) => {
        const d = `M${wx + 130} ${520} Q${x + 60} ${(520 + r.y) / 2 - 60} ${x + r.dx - 40} ${r.y - 60}`
        return (
          <g key={i}>
            <path d={d} fill="none" stroke={C.gold} strokeWidth={2} strokeDasharray="6 8" opacity={0.6} />
            <g className="c2-crate" style={{ offsetPath: `path('${d}')` } as React.CSSProperties}>
              <rect x={-14} y={-10} width={28} height={20} fill={C.gold} />
            </g>
            <Robot name={`c2-mk-${i}`} x={x + r.dx} y={r.y + 70} s={0.34} pose={POSES.stand} shell={r.shell} visor={r.visor} light="none" />
          </g>
        )
      })}
      <text x={x} y={130} textAnchor="middle" fill={C.paper} fontFamily={SERIF} fontSize={46} fontWeight={600}>
        sell hands to everyone
      </text>
      <text x={x} y={178} textAnchor="middle" fill={C.goldLight} fontFamily={SANS} fontSize={24}>
        Inspire · Linkerbot · Sharpa → 140+ Chinese robot makers
      </text>
    </g>
  )
}

function ArmStation({ x, hand }: { x: number; hand: ReturnType<typeof useHandStore> }) {
  const bx = x - 240
  return (
    <g pointerEvents="none">
      <Pool x={x} y={560} r={600} color="key" opacity={0.6} />
      <Beam x={x + 40} y={60} w1={60} w2={560} len={760} opacity={0.3} />
      {/* the bench and a tray of parts */}
      <rect x={x - 520} y={700} width={1040} height={26} fill={C.ink3} />
      <rect x={x - 520} y={700} width={1040} height={4} fill={C.keyDeep} opacity={0.7} />
      <rect x={x - 500} y={726} width={18} height={180} fill={C.ink2} />
      <rect x={x + 482} y={726} width={18} height={180} fill={C.ink2} />
      <rect x={x + 100} y={670} width={220} height={30} rx={4} fill={C.ink4} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={x + 116 + i * 40} y={656} width={24} height={16} rx={3} fill={i === 2 ? C.amber : C.metal} />
      ))}
      {/* an ordinary industrial arm */}
      <g className="c2-arm">
        <rect x={bx - 70} y={640} width={140} height={60} rx={10} fill={C.gold} />
        <rect x={bx - 70} y={640} width={140} height={10} fill={C.goldLight} opacity={0.6} />
        <path d={`M${bx} 640 L${bx + 40} 380`} stroke={C.goldDark} strokeWidth={58} strokeLinecap="round" />
        <path d={`M${bx} 640 L${bx + 40} 380`} stroke={C.gold} strokeWidth={42} strokeLinecap="round" />
        <circle cx={bx + 40} cy={380} r={34} fill={C.ink3} />
        <path d={`M${bx + 40} 380 L${bx + 330} 330`} stroke={C.goldDark} strokeWidth={44} strokeLinecap="round" />
        <path d={`M${bx + 40} 380 L${bx + 330} 330`} stroke={C.gold} strokeWidth={30} strokeLinecap="round" />
        <circle cx={bx + 330} cy={330} r={24} fill={C.ink3} />
        <Hand3D store={hand} x={bx + 334} y={448} look="robot" arm={110} light={[0.8, -0.5]} />
      </g>
      <text x={x} y={130} textAnchor="middle" fill={C.paper} fontFamily={SERIF} fontSize={46} fontWeight={600}>
        hands on factory arms
      </text>
      <text x={x} y={178} textAnchor="middle" fill={C.cyanLight} fontFamily={SANS} fontSize={24}>
        Mimic: a dexterous hand on a standard arm, sold as a service
      </text>
    </g>
  )
}

export function Ch2Industry({ cueIndex, playing, onAnimDone, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const chartShot = useRef<SVGGElement>(null)
  const modelShot = useRef<SVGGElement>(null)
  const mapShot = useRef<SVGGElement>(null)
  const armHand = useHandStore({ pose: GRASPS.open, view: { yaw: 70, pitch: -10, roll: 180, s: 1.05 } })

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const camC = camera(chartShot.current, { x: 800, y: 470, zoom: 1.35 })
      const camM = camera(modelShot.current, { x: PANEL[0], y: 450, zoom: 1 })
      const camN = camera(mapShot.current, { x: 820, y: 450, zoom: 1.2 })
      const shots = ['.c2-chart', '.c2-models', '.c2-china']
      const only = (keep: string, t: number) => shots.forEach((s) => tl.set(s, { opacity: s === keep ? 1 : 0 }, t + 0.02))

      /* b0: a dark gallery, then the chart. */
      tl.addLabel('b0', 0)
      only('.c2-chart', 0)
      tl.set('.c2-dot, .c2-cluster, .c2-corner, .c2-axes', { opacity: 0 }, 0)
      fade(tl, '.c2-gallery', 1, 0, 0.01)
      camC.to(tl, { x: 820, y: 500, zoom: 1.15 }, 0, 3, 'sine.inOut')
      fade(tl, '.c2-gallery', 0, 2.6, 1.2, 1)
      fade(tl, '.c2-axes', 1, 2.9, 0.9)
      camC.to(tl, { x: 830, y: 470, zoom: 1 }, 3, 2.4, 'power2.inOut')
      const order = ['robotiq', 'inspire', 'dexee', 'leap', 'wuji', 'sharpa', 'tesla', 'figure', '1x', 'atlas']
      order.forEach((id, i) => {
        const m = MAKERS.find((k) => k.id === id)!
        const q = at(m.u, m.v)
        tl.fromTo(`.c2-dot-${id}`, { opacity: 0, scale: 0.4, svgOrigin: `${q.x} ${q.y}` }, { opacity: 1, scale: 1, svgOrigin: `${q.x} ${q.y}`, duration: 0.45, ease: 'back.out(2.2)', immediateRender: false }, 3.6 + i * 0.32)
      })
      fade(tl, '.c2-cluster', 1, 6.6, 0.8)

      /* b1: the empty corner glows. */
      const b1 = 8.8
      tl.addLabel('b1', b1)
      fade(tl, '.c2-corner', 1, b1 + 0.3, 1.2)
      tl.fromTo('.c2-dot', { opacity: 1 }, { opacity: 0.45, duration: 1.2, immediateRender: false }, b1 + 0.6)
      const cq = at(0.92, 0.92)
      camC.to(tl, { x: cq.x - 180, y: cq.y + 140, zoom: 1.45 }, b1 + 0.6, 8, 'sine.inOut')
      fade(tl, '.c2-tri', 1, b1 + 3.4, 1)

      /* b2: three business models. */
      const b2 = b1 + 9.4
      tl.addLabel('b2', b2)
      only('.c2-models', b2)
      camM.to(tl, { x: PANEL[0], y: 450, zoom: 1.12 }, b2, 0.01)
      camM.to(tl, { x: PANEL[0] + 40, y: 460, zoom: 1 }, b2 + 0.05, 3.6, 'sine.inOut')
      tl.fromTo('.c2-belt', { x: 0 }, { x: 300, duration: 4.4, ease: 'none', immediateRender: false }, b2)
      camM.to(tl, { x: PANEL[1], y: 450, zoom: 1 }, b2 + 4, 1.3, 'power3.inOut')
      tl.fromTo('.c2-crate', { offsetDistance: '0%', opacity: 0 }, { offsetDistance: '100%', opacity: 1, duration: 1.4, stagger: 0.25, repeat: 1, ease: 'power1.inOut', immediateRender: false }, b2 + 4.6)
      camM.to(tl, { x: PANEL[1] + 60, y: 440, zoom: 1.05 }, b2 + 5.3, 3.4, 'sine.inOut')
      camM.to(tl, { x: PANEL[2], y: 450, zoom: 1.05 }, b2 + 8.6, 1.3, 'power3.inOut')
      armHand.to(tl, { pose: GRASPS.open }, b2, 0.01)
      tl.fromTo('.c2-arm', { rotation: 0, svgOrigin: `${PANEL[2] - 240} 700` }, { rotation: 4, svgOrigin: `${PANEL[2] - 240} 700`, duration: 1.4, ease: 'sine.inOut', immediateRender: false }, b2 + 9.2)
      armHand.to(tl, { pose: GRASPS.pinch, touch: { thumb: 0.6, index: 0.6 } }, b2 + 10.4, 0.7)
      tl.to('.c2-arm', { rotation: 0, svgOrigin: `${PANEL[2] - 240} 700`, duration: 1.6, ease: 'sine.inOut' }, b2 + 11.2)
      camM.to(tl, { x: PANEL[2] - 40, y: 470, zoom: 1.15 }, b2 + 9.9, 3.6, 'sine.inOut')

      /* b3: the night map of China. */
      const b3 = b2 + 13.6
      tl.addLabel('b3', b3)
      only('.c2-china', b3)
      camN.to(tl, { x: 900, y: 430, zoom: 1.25 }, b3, 0.01)
      camN.to(tl, { x: 900, y: 460, zoom: 1.02 }, b3 + 0.05, 3.2, 'power2.inOut')
      tl.fromTo('.c2-glow', { opacity: 0, scale: 0.3, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, transformOrigin: '50% 50%', duration: 0.9, stagger: 0.35, ease: 'back.out(1.6)', immediateRender: false }, b3 + 0.6)
      tl.fromTo('.c2-route', { strokeDashoffset: 900 }, { strokeDashoffset: 0, duration: 1.4, stagger: 0.2, ease: 'power2.out', immediateRender: false }, b3 + 1.8)
      tl.fromTo('.c2-pulse', { offsetDistance: '0%' }, { offsetDistance: '100%', duration: 1.6, repeat: 4, stagger: 0.3, ease: 'none', immediateRender: false }, b3 + 2.4)
      tl.fromTo('.c2-clab', { opacity: 0 }, { opacity: 1, duration: 0.6, stagger: 0.4, immediateRender: false }, b3 + 1.2)
      fade(tl, '.c2-counter', 1, b3 + 3, 0.6)
      tl.fromTo('.c2-count', { textContent: 0 }, { textContent: 30000, duration: 3.6, ease: 'power2.out', snap: { textContent: 500 }, immediateRender: false }, b3 + 3)
      fade(tl, '.c2-price', 1, b3 + 6, 0.6)
      tl.fromTo('.c2-pricebar', { scaleY: 1, transformOrigin: '50% 100%' }, { scaleY: 0.38, transformOrigin: '50% 100%', duration: 1.6, ease: 'power2.inOut', immediateRender: false }, b3 + 6.4)
      camN.to(tl, { x: 880, y: 480, zoom: 1.08 }, b3 + 3.3, 6.6, 'sine.inOut')
      tl.to({}, { duration: 0.1 }, b3 + 9.9)
    },
    [armHand],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.c2-cornerpulse', { scale: 1.12, opacity: 0.5, transformOrigin: '50% 50%', duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.c2-spot', { opacity: 0.75, duration: 2.3, yoyo: true, repeat: -1, stagger: 0.4, ease: 'sine.inOut' })
    gsap.to('.c2-twinkle', { opacity: 0.25, duration: 0.8, yoyo: true, repeat: -1, stagger: { each: 0.07, repeat: -1, yoyo: true }, ease: 'sine.inOut' })
  })

  useEffect(() => {
    reportState(STATE[cueIndex] ?? '')
    setHints([])
  }, [cueIndex, reportState, setHints])

  const corner = at(0.92, 0.92)

  return (
    <g ref={root}>
      {/* ---------- the chart (and the gallery it grows out of) ---------- */}
      <g className="c2-chart" ref={chartShot}>
        <g data-depth="0.5">
          <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink1} />
          <Pool x={1200} y={200} r={800} color="gold" opacity={0.12} />
        </g>
        <g data-depth="1">
          <g className="c2-gallery" opacity={1}>
            <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink} />
            {[0, 1, 2, 3, 4].map((i) => {
              const x = 260 + i * 270
              return (
                <g key={i}>
                  <g className="c2-spot" opacity={0.5}>
                    <Beam x={x} y={-40} w1={40} w2={260} len={720} opacity={0.4} />
                    <Pool x={x} y={640} r={230} color="key" opacity={0.8} />
                  </g>
                  <rect x={x - 60} y={640} width={120} height={260} fill={C.ink3} />
                  <rect x={x - 70} y={630} width={140} height={14} fill={C.ink4} />
                  <MiniHand x={x} y={560} s={3.2} fingers={[2, 5, 3, 4, 5][i]} color={i === 2 ? C.shellMid : C.shell} opacity={0.9} />
                </g>
              )
            })}
          </g>
          <IndustryChart p="c2" />
          <g className="c2-corner" opacity={0}>
            <circle className="c2-cornerpulse" cx={corner.x} cy={corner.y} r={120} fill="none" stroke={C.gold} strokeWidth={3} opacity={0.9} />
            <g className="c2-tri" opacity={0}>
              <text x={corner.x} y={corner.y + 160} textAnchor="middle" fill={C.goldLight} fontFamily={SANS} fontSize={24}>
                dexterous + cheap + tough
              </text>
              <text x={corner.x} y={corner.y + 188} textAnchor="middle" fill={C.mist} fontFamily={MONO} fontSize={18}>
                today: pick two
              </text>
            </g>
          </g>
        </g>
        <g data-depth="1.5">
          <Dust x={-200} y={-100} w={2000} h={1000} count={26} seed={71} color={C.gold} size={0.8} />
        </g>
      </g>

      {/* ---------- the three business models ---------- */}
      <g className="c2-models" ref={modelShot} opacity={0}>
        <g data-depth="0.4">
          <rect x={-800} y={-600} width={7000} height={2100} fill={C.ink1} />
          <rect x={-800} y={-600} width={7000} height={2100} fill="url(#cn-grid-big)" opacity={0.2} />
        </g>
        <g data-depth="1">
          <rect x={-800} y={780} width={7000} height={600} fill={C.ink2} />
          <Factory x={PANEL[0]} />
          <Supplier x={PANEL[1]} />
          <ArmStation x={PANEL[2]} hand={armHand} />
          {[1650, 3350].map((x) => (
            <rect key={x} x={x - 3} y={-200} width={6} height={1300} fill={C.ink} />
          ))}
        </g>
        <g data-depth="1.6">
          <Dust x={-200} y={0} w={5200} h={900} count={50} seed={73} color={C.keyLight} />
        </g>
      </g>

      {/* ---------- the night map ---------- */}
      <g className="c2-china" ref={mapShot} opacity={0}>
        <g data-depth="0.5">
          <rect x={-800} y={-600} width={3200} height={2100} fill="#040812" />
          {Array.from({ length: 60 }, (_, i) => (
            <circle key={i} className="c2-twinkle" cx={(i * 397) % 2400 - 400} cy={(i * 211) % 1400 - 250} r={1.2} fill={C.rim} opacity={0.6} />
          ))}
        </g>
        <g data-depth="1">
          <path d={poly(COAST)} fill="#0d1626" stroke={C.slate} strokeWidth={1.5} />
          <path d={poly(KOREA)} fill="#0b1220" stroke={C.ink4} strokeWidth={1.2} />
          <path d={poly(TAIWAN)} fill="#0d1626" stroke={C.slate} strokeWidth={1.2} />
          <path d={poly(HAINAN)} fill="#0d1626" stroke={C.slate} strokeWidth={1.2} />
          <text x={px(104)} y={py(33)} fill={C.ink4} fontFamily={SANS} fontSize={34} letterSpacing={14}>
            CHINA
          </text>
          <text x={px(124.5)} y={py(27)} fill={C.ink4} fontFamily={SANS} fontSize={26} letterSpacing={8}>
            EAST CHINA SEA
          </text>
          {/* scattered city lights */}
          {Array.from({ length: 140 }, (_, i) => {
            const lon = 104 + ((i * 37) % 170) / 10
            const lat = 22 + ((i * 53) % 180) / 10
            const inland = px(lon) < px(118) + (lat - 30) * -6
            return inland || lat > 32 ? <circle key={i} cx={px(lon)} cy={py(lat)} r={1.6} fill={C.keyLight} opacity={0.3} /> : null
          })}
          {ROUTES.map(([a, b]) => (
            <g key={a + b}>
              <path className="c2-route" d={routeD(a, b)} fill="none" stroke={C.gold} strokeWidth={2.2} strokeDasharray={900} strokeDashoffset={900} opacity={0.7} />
              <circle className="c2-pulse" r={6} fill={C.goldLight} filter="url(#cn-bloom)" style={{ offsetPath: `path('${routeD(a, b)}')` } as React.CSSProperties} />
            </g>
          ))}
          {CLUSTERS.map((c) => {
            const x = px(c.lon)
            const y = py(c.lat)
            return (
              <g key={c.id}>
                <g className="c2-glow" opacity={0}>
                  <circle cx={x} cy={y} r={c.r * 2} fill="url(#cn-pool-gold)" />
                  <circle cx={x} cy={y} r={c.r * 0.5} fill="url(#cn-pool-amber)" />
                  {Array.from({ length: 14 }, (_, k) => (
                    <circle key={k} cx={x + Math.cos(k * 2.4) * c.r * 0.45 * ((k % 4) / 4 + 0.3)} cy={y + Math.sin(k * 2.4) * c.r * 0.45 * ((k % 4) / 4 + 0.3)} r={2.4} fill={C.goldLight} />
                  ))}
                </g>
                <g className="c2-clab" opacity={0}>
                  <Label x={x} y={y} tx={c.side === 'r' ? x + c.r + 70 : x - c.r - 70} ty={y - 30} text={c.name} sub={c.sub} color={C.goldLight} hidden={false} size={26} />
                </g>
              </g>
            )
          })}
          <g className="c2-counter" opacity={0}>
            <text x={230} y={640} fill={C.mist} fontFamily={SANS} fontSize={22}>
              dexterous hands shipped, 2025
            </text>
            <text x={230} y={700} fill={C.gold} fontFamily={MONO} fontSize={56} fontWeight={700}>
              <tspan className="c2-count">0</tspan>
              <tspan>+</tspan>
            </text>
            <text x={230} y={742} fill={C.mist} fontFamily={MONO} fontSize={17}>
              humanoids shipped: ~90% Chinese
            </text>
          </g>
          <g className="c2-price" opacity={0}>
            <text x={230} y={180} fill={C.mist} fontFamily={SANS} fontSize={22}>
              average hand price in China
            </text>
            <rect x={230} y={220} width={70} height={240} fill={C.ink4} />
            <rect className="c2-pricebar" x={320} y={220} width={70} height={240} fill={C.gold} />
            <text x={265} y={490} textAnchor="middle" fill={C.mist} fontFamily={MONO} fontSize={16}>
              before
            </text>
            <text x={355} y={490} textAnchor="middle" fill={C.goldLight} fontFamily={MONO} fontSize={16}>
              2026
            </text>
            <text x={410} y={300} fill={C.goldLight} fontFamily={MONO} fontSize={18}>
              ¥50-100k → ¥20-35k
            </text>
            <text x={410} y={328} fill={C.mist} fontFamily={MONO} fontSize={16}>
              ($7-15k → $3-5k)
            </text>
          </g>
        </g>
        <g data-depth="1.4">
          <Dust x={-200} y={0} w={2000} h={900} count={20} seed={75} color={C.gold} size={0.7} />
        </g>
      </g>
      <Vignette />
    </g>
  )
}

export const ch2: Chapter = {
  id: 'industry',
  title: 'Who is building what',
  cues: CUES,
  Scene: Ch2Industry,
  enter: { type: 'pan', dir: 'left' },
  deeper: [IndustryReading],
}

