import gsap from 'gsap'
import { useCallback, useEffect, useRef } from 'react'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { camera } from '../../../cine/camera'
import { Hand3D, GRASPS, useHandStore } from '../../../cine/hand3d'
import { C, MONO, SANS } from '../../../cine/palette'
import { POSES, Robot } from '../../../cine/people'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Blueprint, Dust, FiveMap, Label, Pool, Readout, Vignette, fade, useAmbient } from '../shared/kit'
import { CNCBox, FactoryBack, FactoryCSS, FactoryFloor, FactoryRows, FingerShell, FlatHand, PriceTag, SourceNote, count, money } from './factoryKit'
import { CostReading } from './readings'

export const CUES: Cue[] = [
  { id: 'wall', say: 'Every question so far had a clever answer. Now comes the wall around all of them: can you build a million?' },
  { id: 'proto', say: 'A prototype hand is built like a watch. Parts are carved from solid metal by computer-controlled mills, one at a time. Some take a week.' },
  { id: 'seconds', say: 'A factory part is squirted into a steel mould. Figure says parts that took over a week to machine now take under twenty seconds.' },
  { id: 'bom', say: 'And money matters. Analysts estimate the hands are around seventeen percent of a humanoid’s whole bill of materials. Most of the rest is motors and gearboxes too.' },
  { id: 'price', say: 'Prices are falling fast. Good Chinese hands that cost over ten thousand dollars a few years ago now sell for three to five thousand.' },
]

const STATE = [
  'The five-question map from film 1: a robot hand in the middle, five coloured orbit rings (shape, muscle, tendons, touch, brain), and the gold ring of "the wall" around them all. The gold ring thickens into a wall of glowing light, the camera pushes through it in a gold flash, and we are inside a factory at night: two long rows of dark machines with blinking status lights, gold safety lines on the floor, hanging lamps in haze, and one CNC machine glowing warm. The camera pushes toward it. The idea: after the clever answers to the five questions, the real wall is manufacturing, building a million hands cheaply that last.',
  'Inside the CNC machine, close up: a block of aluminium clamped in a vise. A spinning cutter moves along it, amber chips flying, carving a robot finger segment out of the solid block. A clock above runs up to "6 days 14 h" of machine time. Point: prototypes are machined one part at a time, slow and expensive; some parts take a week.',
  'Hard cut to an injection moulding machine: the clamp slams two steel mould halves together, plastic is injected, the mould opens and a finished finger shell drops into a bin. A counter reads 0:18 for each cycle, and it repeats: the parts pile up. Figure (the humanoid company) says parts that took over a week to machine now take under twenty seconds with tooling. Point: moulds turn a week into seconds.',
  'Seven, the lab humanoid, stands as a glowing gold outline. Gold blocks peel out of its body into a tall stacked bar: actuators across the body about 56% of the bill of materials, the two hands about 17% (glowing), and compute, battery and frame making up the rest. Label: Morgan Stanley estimate for Tesla Optimus. Point: hands are a big slice of a humanoid’s cost, and most of the robot is motors and gearboxes. Caveat: these are analyst estimates and the source tables are rough.',
  'A dark chart: a gold price line falls from left ("a few years ago") to right (2026). A small robot hand rides the line, its price tag shrinking from about $12,000 to about $4,000, leaving ghost hands with their old prices behind. Range bars show RMB 50,000 to 100,000 (about $7,000 to $15,000) then, RMB 20,000 to 35,000 (about $3,000 to $5,000) now, for Chinese dexterous hands.',
]

/* The price chart: price p (dollars) to height on the stage. */
const py = (p: number) => 700 - (p / 15000) * 480
/* The gold price line, a cubic from a few years ago to now. */
const P0 = [300, py(12000)]
const P1 = [560, 540]
const P2 = [820, 566]
const P3 = [1300, py(4000)]
const bez = (t: number) => {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return [a * P0[0] + b * P1[0] + c * P2[0] + d * P3[0], a * P0[1] + b * P1[1] + c * P2[1] + d * P3[1]]
}
const PRICE_PATH = `M${P0[0]} ${P0[1]} C${P1[0]} ${P1[1]} ${P2[0]} ${P2[1]} ${P3[0]} ${P3[1]}`

/* The CNC close-up: the stock block, and the top edge of the finger segment hiding inside it. */
const BLOCK = { x0: 450, x1: 1150, y0: 560, y1: 720 }
const partTop = (x: number) => {
  if (x < 500 || x > 1100) return BLOCK.y1
  const boss = (cx: number, r: number) => (Math.abs(x - cx) < r ? 650 - Math.sqrt(r * r - (x - cx) * (x - cx)) * 0.9 : 720)
  return Math.min(boss(560, 60), boss(1040, 60), 628)
}
const STRIPS = Array.from({ length: 28 }, (_, i) => {
  const x = BLOCK.x0 + i * 25
  return { x, top: partTop(x + 12.5) }
})
const PART_PATH = (() => {
  const pts: string[] = []
  for (let x = 500; x <= 1100; x += 10) pts.push(`${x} ${partTop(Math.min(1099, Math.max(501, x))).toFixed(1)}`)
  return `M500 720 L${pts.join(' L')} L1100 720 Z`
})()

/* The moulding machine. */
const SHIFT = 160
const BIN = { x: 720, y: 730 }
const STACK = [
  [-40, 52, -8],
  [30, 50, 6],
  [-10, 34, 14],
  [44, 30, -10],
  [-48, 18, 4],
  [6, 14, -4],
  [-22, -2, 10],
  [34, -6, -14],
]

/* Seven in the bill of materials shot. */
const S7 = { x: 520, y: 830, s: 1.9 }
const at7 = (fx: number, fy: number) => [S7.x + fx * S7.s, S7.y + fy * S7.s]
const BAR = { x: 1080, w: 110, y0: 180, y1: 780 }
const segY = (from: number, to: number) => [BAR.y1 - ((BAR.y1 - BAR.y0) * to) / 100, BAR.y1 - ((BAR.y1 - BAR.y0) * from) / 100]
const PIECES: { from: number[]; seg: 'act' | 'hand' | 'rest'; k: number }[] = [
  ...[[6, -172], [-2, -174], [4, -76], [-4, -76], [6, -238], [-2, -240], [4, -150], [-4, -150], [4, -6], [-4, -6]].map((p, k) => ({ from: at7(p[0], p[1]), seg: 'act' as const, k })),
  ...[[6, -112], [-2, -114], [10, -106]].map((p, k) => ({ from: at7(p[0], p[1]), seg: 'hand' as const, k })),
  ...[[14, -275], [6, -205], [2, -180]].map((p, k) => ({ from: at7(p[0], p[1]), seg: 'rest' as const, k })),
]

export function Ch1Scale({ cueIndex, playing, onAnimDone, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const mapShot = useRef<SVGGElement>(null)
  const facShot = useRef<SVGGElement>(null)
  const cncShot = useRef<SVGGElement>(null)
  const mouldShot = useRef<SVGGElement>(null)
  const bomShot = useRef<SVGGElement>(null)
  const priceShot = useRef<SVGGElement>(null)
  const hand = useHandStore({ pose: GRASPS.relaxed, view: { yaw: -30, pitch: 12, roll: 0, s: 1.25 } })

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      const R = root.current
      const camMap = camera(mapShot.current, { x: 800, y: 470, zoom: 0.62 })
      const camFac = camera(facShot.current, { x: 800, y: 460, zoom: 1.2 })
      const camCnc = camera(cncShot.current, { x: 800, y: 570, zoom: 1.2 })
      const camMould = camera(mouldShot.current, { x: 780, y: 520, zoom: 1.0 })
      const camBom = camera(bomShot.current, { x: 800, y: 450, zoom: 1 })
      const camPrice = camera(priceShot.current, { x: 800, y: 450, zoom: 1.04 })
      const shots = ['.f1-mapshot', '.f1-facshot', '.f1-cncshot', '.f1-mouldshot', '.f1-bomshot', '.f1-priceshot']
      const show = (sel: string, at: number) => {
        for (const s of shots) tl.set(s, { opacity: s === sel ? 1 : 0 }, at)
      }

      /* b0: the map; the gold ring becomes a wall of light; through it, into the factory. */
      tl.addLabel('b0', 0)
      show('.f1-mapshot', 0)
      camMap.to(tl, { zoom: 0.68 }, 0, 2.6, 'sine.inOut')
      hand.to(tl, { view: { yaw: 10 }, pose: GRASPS.open }, 0, 3.2, 'sine.inOut')
      fade(tl, '.fm-ring-wall', 1, 0.4, 1.2, 0.18)
      tl.fromTo('.f1-wallglow', { strokeWidth: 4, opacity: 0 }, { strokeWidth: 90, opacity: 0.85, duration: 2.2, ease: 'power2.in', immediateRender: false }, 1.0)
      camMap.to(tl, { x: 180, y: 470, zoom: 5 }, 2.6, 1.8, 'power3.in')
      tl.fromTo('.f1-flash', { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.in', immediateRender: false }, 3.95)
      show('.f1-facshot', 4.35)
      tl.fromTo('.f1-flash', { opacity: 1 }, { opacity: 0, duration: 1.0, ease: 'power2.out', immediateRender: false }, 4.4)
      camFac.to(tl, { x: 700, y: 480, zoom: 1.3 }, 4.35, 1.4, 'sine.out')
      camFac.to(tl, { x: 330, y: 560, zoom: 2.3 }, 5.7, 2.9, 'power2.inOut')
      fade(tl, '.f1-heroglow', 1, 5.4, 1.6, 0.4)

      /* b1: inside the mill. A cutter carves a finger segment; the clock runs for days. */
      const b1 = 8.6
      tl.addLabel('b1', b1)
      show('.f1-cncshot', b1)
      camCnc.to(tl, { x: 800, y: 600, zoom: 1.34 }, b1, 10.8, 'sine.inOut')
      fade(tl, '.f1-clock', 1, b1 + 0.3, 0.6)
      count(tl, R, '.f1-clocktext', 0, 158, b1 + 0.5, 9.8, (v) => `${Math.floor(v / 24)} days ${String(Math.floor(v % 24)).padStart(2, '0')} h`, 'power1.in')
      tl.fromTo('.f1-hand-c', { rotation: 0 }, { rotation: 360 * 9, duration: 9.8, ease: 'power1.in', svgOrigin: '800 168', immediateRender: false }, b1 + 0.5)
      fade(tl, '.f1-lab-block', 1, b1 + 0.4, 0.5)
      fade(tl, '.f1-lab-block', 0, b1 + 3.2, 0.5, 1)
      const cut0 = b1 + 1.0
      const cutDur = 7.6
      tl.fromTo('.f1-cutter', { x: BLOCK.x0 - 40, y: -110 }, { x: BLOCK.x0, y: 0, duration: 0.9, ease: 'power2.out', immediateRender: false }, b1 + 0.1)
      fade(tl, '.f1-chips', 1, cut0, 0.2)
      STRIPS.forEach((s, i) => {
        const t = cut0 + (i / STRIPS.length) * cutDur
        const dt = cutDur / STRIPS.length
        tl.fromTo('.f1-cutter', { x: s.x - BLOCK.x0 }, { x: s.x + 25 - BLOCK.x0, duration: dt, ease: 'none', immediateRender: false }, t)
        tl.fromTo('.f1-cutter', { y: i === 0 ? 0 : STRIPS[i - 1].top - BLOCK.y0 }, { y: s.top - BLOCK.y0, duration: dt * 0.5, ease: 'sine.inOut', immediateRender: false }, t)
        tl.fromTo(`.f1-strip-${i}`, { scaleY: 1 }, { scaleY: 0, duration: dt * 1.1, ease: 'power1.in', svgOrigin: `${s.x + 12.5} ${s.top}`, immediateRender: false }, t)
      })
      fade(tl, '.f1-chips', 0, cut0 + cutDur, 0.3, 1)
      tl.fromTo('.f1-cutter', { x: BLOCK.x1 - BLOCK.x0, y: BLOCK.y1 - BLOCK.y0 }, { x: 590 - BLOCK.x0, y: -140, duration: 0.8, ease: 'power2.inOut', immediateRender: false }, cut0 + cutDur)
      fade(tl, '.f1-lab-mill', 1, b1 + 3.6, 0.5)
      fade(tl, '.f1-holes', 1, cut0 + cutDur + 0.6, 0.4)
      tl.fromTo('.f1-sheen', { x: -300 }, { x: 900, duration: 1.2, ease: 'power2.inOut', immediateRender: false }, cut0 + cutDur + 0.7)
      fade(tl, '.f1-lab-part', 1, cut0 + cutDur + 0.9, 0.5)

      /* b2: hard cut. A steel mould slams shut, opens, drops a part. Again. Again. */
      const b2 = 19.6
      tl.addLabel('b2', b2)
      show('.f1-mouldshot', b2)
      camMould.to(tl, { x: 760, y: 530, zoom: 1.08 }, b2, 10, 'sine.inOut')
      fade(tl, '.f1-lab-mould', 1, b2 + 0.4, 0.5)
      fade(tl, '.f1-mcount', 1, b2 + 0.2, 0.3)
      for (let c = 0; c < 3; c++) {
        const t = b2 + 0.6 + c * 3
        tl.fromTo('.f1-moving', { x: 0 }, { x: SHIFT, duration: 0.3, ease: 'power3.in', immediateRender: false }, t)
        camMould.shake(tl, t + 0.3, 0.7, 0.35)
        tl.fromTo('.f1-shot', { opacity: 0 }, { opacity: 1, duration: 0.3, immediateRender: false }, t + 0.35)
        tl.fromTo('.f1-shot', { opacity: 1 }, { opacity: 0, duration: 0.6, immediateRender: false }, t + 0.8)
        tl.fromTo('.f1-barrelglow', { opacity: 0.4 }, { opacity: 1, duration: 0.25, yoyo: true, repeat: 1, immediateRender: false }, t + 0.35)
        tl.fromTo('.f1-moving', { x: SHIFT }, { x: 0, duration: 0.4, ease: 'power2.inOut', immediateRender: false }, t + 1.4)
        tl.fromTo('.f1-newpart', { opacity: 0, x: 0, y: 0, rotation: 0 }, { opacity: 1, duration: 0.01, immediateRender: false }, t + 1.75)
        tl.fromTo('.f1-newpart', { x: 0, y: 0, rotation: 0 }, { x: BIN.x + STACK[5 + c][0] - 700, y: BIN.y + STACK[5 + c][1] - 40 - 480, rotation: -70, transformOrigin: '50% 50%', duration: 0.55, ease: 'power2.in', immediateRender: false }, t + 1.85)
        tl.fromTo('.f1-newpart', { opacity: 1 }, { opacity: 0, duration: 0.01, immediateRender: false }, t + 2.4)
        tl.fromTo(`.f1-stack-${5 + c}`, { opacity: 0 }, { opacity: 1, duration: 0.01, immediateRender: false }, t + 2.4)
        camMould.shake(tl, t + 2.4, 0.25, 0.2)
        count(tl, R, '.f1-mcounttext', 0, 18, t - 0.05, 2.5, (v) => `0:${String(Math.round(v)).padStart(2, '0')}`)
      }
      fade(tl, '.f1-lab-part2', 1, b2 + 3.0, 0.5)
      fade(tl, '.f1-figure', 1, b2 + 4.4, 0.6)
      fade(tl, '.f1-ghostclock', 1, b2 + 4.8, 0.6)

      /* b3: Seven in gold; the bill of materials peels out into a bar. */
      const b3 = 29.8
      tl.addLabel('b3', b3)
      show('.f1-bomshot', b3)
      fade(tl, '.f1-seven', 1, b3 + 0.1, 1.0)
      camBom.to(tl, { x: 830, y: 470, zoom: 1.04 }, b3, 6, 'sine.inOut')
      fade(tl, '.f1-barframe', 1, b3 + 1.0, 0.6)
      PIECES.forEach((p, i) => {
        const [y0, y1] = p.seg === 'act' ? segY(0, 56) : p.seg === 'hand' ? segY(56, 73) : segY(73, 100)
        const tx = BAR.x + 20 + (p.k % 3) * 30
        const ty = y0 + ((y1 - y0) * ((p.k % 4) + 0.5)) / 4
        const t = b3 + 1.4 + (p.seg === 'act' ? i * 0.16 : p.seg === 'hand' ? 2.4 + p.k * 0.2 : 4.0 + p.k * 0.2)
        tl.fromTo(`.f1-piece-${i}`, { x: 0, y: 0, opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.2, immediateRender: false }, t)
        tl.fromTo(`.f1-piece-${i}`, { x: 0, y: 0 }, { x: tx - p.from[0], y: ty - p.from[1], duration: 0.9, ease: 'power2.inOut', immediateRender: false }, t + 0.15)
        tl.fromTo(`.f1-piece-${i}`, { opacity: 1 }, { opacity: 0, duration: 0.3, immediateRender: false }, t + 1.0)
      })
      tl.set('.f1-seg-act', { scaleY: 0, svgOrigin: `${BAR.x} ${BAR.y1}` }, 0)
      tl.set('.f1-seg-hand', { scaleY: 0, svgOrigin: `${BAR.x} ${segY(56, 73)[1]}` }, 0)
      tl.set('.f1-seg-rest', { scaleY: 0, svgOrigin: `${BAR.x} ${segY(73, 100)[1]}` }, 0)
      tl.fromTo('.f1-seg-act', { scaleY: 0 }, { scaleY: 1, duration: 2.0, ease: 'power1.inOut', svgOrigin: `${BAR.x} ${BAR.y1}`, immediateRender: false }, b3 + 1.8)
      fade(tl, '.f1-lab-act', 1, b3 + 3.4, 0.5)
      tl.fromTo('.f1-seg-hand', { scaleY: 0 }, { scaleY: 1, duration: 0.8, ease: 'power1.inOut', svgOrigin: `${BAR.x} ${segY(56, 73)[1]}`, immediateRender: false }, b3 + 4.2)
      fade(tl, '.f1-handglow', 1, b3 + 3.9, 0.8)
      fade(tl, '.f1-lab-hand', 1, b3 + 4.8, 0.5)
      tl.fromTo('.f1-seg-rest', { scaleY: 0 }, { scaleY: 1, duration: 0.8, ease: 'power1.inOut', svgOrigin: `${BAR.x} ${segY(73, 100)[1]}`, immediateRender: false }, b3 + 5.6)
      fade(tl, '.f1-lab-rest', 1, b3 + 6.2, 0.5)
      fade(tl, '.f1-ms', 1, b3 + 6.8, 0.6)
      camBom.to(tl, { x: 900, y: 460, zoom: 1.1 }, b3 + 7.2, 4.6, 'sine.inOut')

      /* b4: the price line falls; a hand rides it down. */
      const b4 = 41.8
      tl.addLabel('b4', b4)
      show('.f1-priceshot', b4)
      camPrice.to(tl, { x: 820, y: 460, zoom: 1.0 }, b4, 9, 'sine.inOut')
      fade(tl, '.f1-axes', 1, b4 + 0.1, 0.6)
      tl.fromTo('.f1-line', { strokeDashoffset: 1400 }, { strokeDashoffset: 0, duration: 4.2, ease: 'power1.inOut', immediateRender: false }, b4 + 0.6)
      const rider = R?.querySelector('.f1-rider')
      const tagText = R ? [...R.querySelectorAll('.f1-ridertag')] : []
      const o = { t: 0 }
      const place = () => {
        const [x, y] = bez(o.t)
        const p = ((700 - y) / 480) * 15000
        rider?.setAttribute('transform', `translate(${x} ${y}) scale(${1 - o.t * 0.3})`)
        for (const el of tagText) el.textContent = money(Math.round(p / 100) * 100)
      }
      tl.fromTo(o, { t: 0 }, { t: 1, duration: 4.2, ease: 'power1.inOut', immediateRender: false, onUpdate: place }, b4 + 0.6)
      fade(tl, '.f1-rider', 1, b4 + 0.5, 0.3)
      fade(tl, '.f1-ghost-0', 0.55, b4 + 0.8, 0.4)
      fade(tl, '.f1-ghost-1', 0.55, b4 + 2.4, 0.4)
      fade(tl, '.f1-range', 1, b4 + 5.0, 0.8)
      fade(tl, '.f1-lab-then', 1, b4 + 5.4, 0.5)
      fade(tl, '.f1-lab-now', 1, b4 + 5.8, 0.5)
      fade(tl, '.f1-rmb', 1, b4 + 6.4, 0.6)
      tl.to({}, { duration: 0.2 }, b4 + 9.0)
    },
    [hand],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.f1-breathe', { opacity: 0.55, duration: 2.2, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.f1-scanbar', { y: 560, duration: 3.6, repeat: -1, ease: 'none' })
    gsap.to('.f1-handpulse', { opacity: 0.45, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  useEffect(() => {
    reportState(STATE[cueIndex] ?? '')
    setHints([])
  }, [cueIndex, reportState, setHints])

  return (
    <g ref={root}>
      <FactoryCSS />
      <defs>
        <filter id="f5-goldline" x="-10%" y="-10%" width="120%" height="120%">
          <feMorphology in="SourceAlpha" operator="dilate" radius={2.2} result="d" />
          <feComposite in="d" in2="SourceAlpha" operator="out" result="edge" />
          <feFlood floodColor={C.gold} />
          <feComposite in2="edge" operator="in" result="g" />
          <feGaussianBlur in="g" stdDeviation={4} result="gb" />
          <feMerge>
            <feMergeNode in="gb" />
            <feMergeNode in="g" />
          </feMerge>
        </filter>
        <pattern id="f5-flutes" width={16} height={16} patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <rect width={16} height={16} fill={C.metal} />
          <rect width={6} height={16} fill={C.metalDark} />
        </pattern>
        <clipPath id="f1-cutclip">
          <rect x={-18} y={-100} width={36} height={100} />
        </clipPath>
      </defs>

      {/* ---------- the map, and the wall of light ---------- */}
      <g className="f1-mapshot" ref={mapShot}>
        <g data-depth="0.4">
          <Blueprint opacity={0.6} />
          <Dust x={-400} y={-200} w={2400} h={1300} count={40} seed={51} color={C.goldLight} size={0.7} />
        </g>
        <g data-depth="1">
          <Pool x={800} y={470} r={520} color="rim" opacity={0.3} />
          <FiveMap cx={800} cy={470} />
          <Hand3D store={hand} x={800} y={590} look="robot" arm={80} light={[0.7, -0.6]} />
          <circle className="f1-wallglow" cx={800} cy={470} r={620} fill="none" stroke={C.gold} strokeWidth={4} opacity={0} filter="url(#cn-bloom-big)" />
        </g>
      </g>

      {/* ---------- the factory at night ---------- */}
      <g className="f1-facshot" ref={facShot} opacity={0}>
        <g data-depth="0.35">
          <FactoryBack />
        </g>
        <g data-depth="1">
          <FactoryFloor y={560} />
          <FactoryRows skip={[-1, 1]} />
          <g className="f1-heroglow" opacity={0.4}>
            <Pool x={290} y={560} r={420} color="key" opacity={0.9} />
          </g>
          <CNCBox x={290} y={710} s={0.66} glowClass="f1-breathe" />
          {/* coolant mist catching the light above the machine */}
          <g opacity={0.6}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <circle key={i} className="f5-rise" style={{ animationDelay: `${-i * 0.45}s` }} cx={260 + (i % 4) * 14} cy={590} r={4 + (i % 3) * 3} fill={C.keyLight} opacity={0.4} />
            ))}
          </g>
        </g>
        <g data-depth="1.8">
          <rect x={-300} y={-200} width={120} height={1300} fill={C.ink} filter="url(#cn-dof-3)" />
          <rect x={1660} y={-200} width={140} height={1300} fill={C.ink} filter="url(#cn-dof-3)" />
        </g>
      </g>

      {/* ---------- inside the CNC machine ---------- */}
      <g className="f1-cncshot" ref={cncShot} opacity={0}>
        <g data-depth="0.5">
          <rect x={-600} y={-500} width={2800} height={1900} fill={C.ink1} />
          <Pool x={800} y={520} r={760} color="key" opacity={0.7} />
          <g filter="url(#cn-dof-2)" opacity={0.8}>
            <rect x={60} y={120} width={140} height={700} fill={C.ink3} />
            <rect x={1400} y={120} width={140} height={700} fill={C.ink3} />
            <rect x={200} y={300} width={1200} height={14} fill={C.ink3} />
            <circle cx={240} cy={260} r={18} fill={C.lime} opacity={0.4} />
            <circle cx={1360} cy={240} r={14} fill={C.danger} opacity={0.4} />
          </g>
        </g>
        <g data-depth="1">
          {/* the machine table and vise */}
          <rect x={-200} y={760} width={2000} height={400} fill={C.ink2} />
          <rect x={-200} y={760} width={2000} height={6} fill={C.keyDeep} opacity={0.5} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={160 + i * 230} y={772} width={150} height={10} fill={C.ink} />
          ))}
          <rect x={400} y={720} width={800} height={40} fill={C.metalDark} />
          <rect x={410} y={600} width={40} height={120} fill={C.metalDark} />
          <rect x={1150} y={600} width={40} height={120} fill={C.metalDark} />
          {/* the finished part hidden inside the block */}
          <path d={PART_PATH} fill="url(#cn-metal)" stroke={C.metalDark} strokeWidth={2} />
          <g className="f1-holes" opacity={0}>
            <circle cx={560} cy={660} r={20} fill={C.ink1} stroke={C.metalDark} strokeWidth={3} />
            <circle cx={1040} cy={660} r={20} fill={C.ink1} stroke={C.metalDark} strokeWidth={3} />
            <rect x={640} y={652} width={320} height={10} rx={5} fill={C.metalDark} opacity={0.6} />
          </g>
          <clipPath id="f1-partclip">
            <path d={PART_PATH} />
          </clipPath>
          <g clipPath="url(#f1-partclip)">
            <rect className="f1-sheen" x={480} y={560} width={60} height={200} fill={C.white} opacity={0.5} transform="skewX(-20)" />
          </g>
          {/* the stock still to be cut away */}
          {STRIPS.map((s, i) => (
            <rect key={i} className={`f1-strip-${i}`} x={s.x} y={BLOCK.y0} width={25.6} height={s.top - BLOCK.y0} fill="#9aa6b8" stroke="#8d99ab" strokeWidth={0.6} />
          ))}
          <rect x={BLOCK.x0} y={BLOCK.y0} width={BLOCK.x1 - BLOCK.x0} height={3} fill={C.white} opacity={0.35} />
          {/* the cutter: holder, shank, fluted end mill; amber chips fly from its tip */}
          <g transform={`translate(${BLOCK.x0} ${BLOCK.y0})`}>
            <g className="f1-cutter">
              <rect x={-60} y={-900} width={120} height={640} fill={C.ink3} />
              <rect x={-44} y={-260} width={88} height={90} fill={C.metalDark} />
              <rect x={-22} y={-170} width={44} height={70} fill={C.metal} />
              <g clipPath="url(#f1-cutclip)">
                <rect className="f5-spin" x={-18} y={-100} width={60} height={100} fill="url(#f5-flutes)" />
              </g>
              <rect x={-18} y={-100} width={36} height={100} fill="none" stroke={C.metalDark} strokeWidth={2} />
              <ellipse cx={0} cy={0} rx={30} ry={8} fill={C.keyLight} opacity={0.5} filter="url(#cn-bloom)" />
              <Label className="f1-lab-mill" x={-44} y={-220} tx={-200} ty={-300} text="computer-controlled mill" color={C.paper} />
              <g className="f1-chips" opacity={0}>
                {Array.from({ length: 14 }, (_, i) => {
                  const a = (-160 + (i * 140) / 13) * (Math.PI / 180)
                  const d = 90 + (i % 4) * 40
                  return (
                    <path
                      key={i}
                      className="f5-chip"
                      style={{ ['--dx' as string]: `${Math.cos(a) * d}px`, ['--dy' as string]: `${Math.sin(a) * d}px`, animationDelay: `${-i * 0.05}s`, animationDuration: `${0.4 + (i % 3) * 0.15}s` }}
                      d="M0 0 q8 -12 18 -4 q-6 8 -18 4 Z"
                      fill={i % 3 ? C.amber : C.amberLight}
                    />
                  )
                })}
              </g>
            </g>
          </g>
          {/* coolant spray from a nozzle on the left */}
          <path d="M150 380 L330 520" stroke={C.ink4} strokeWidth={16} strokeLinecap="round" />
          <g opacity={0.5}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <circle key={i} className="hd-drift" style={{ animationDelay: `${-i}s` }} cx={360 + i * 30} cy={540 - (i % 2) * 20} r={8 + (i % 3) * 4} fill={C.paper} opacity={0.15} />
            ))}
          </g>
          <Label className="f1-lab-block" x={1100} y={600} tx={1240} ty={500} text="solid aluminium" />
          <Label className="f1-lab-part" x={800} y={680} tx={800} ty={850} text="one finger segment" color={C.paper} anchor="middle" />
        </g>
        <g data-depth="1.5" pointerEvents="none">
          {/* the machine's glass door, catching streaks of light */}
          <path d="M-200 -100 L200 -100 L-100 1000 L-500 1000 Z" fill={C.white} opacity={0.035} />
          <path d="M1500 -100 L1560 -100 L1260 1000 L1200 1000 Z" fill={C.white} opacity={0.05} />
        </g>
        <g className="f1-clock" opacity={0} pointerEvents="none">
          <circle cx={800} cy={168} r={34} fill="none" stroke={C.mist} strokeWidth={3} />
          <line className="f1-hand-c" x1={800} y1={168} x2={800} y2={142} stroke={C.paper} strokeWidth={3} strokeLinecap="round" />
          <Readout className="f1-clocktext" x={860} y={182} color={C.paper} size={44}>
            0 days 00 h
          </Readout>
          <text x={860} y={120} fill={C.mist} fontFamily={SANS} fontSize={20} letterSpacing={3}>
            MACHINE TIME, ONE PART
          </text>
        </g>
      </g>

      {/* ---------- the injection moulding machine ---------- */}
      <g className="f1-mouldshot" ref={mouldShot} opacity={0}>
        <g data-depth="0.4">
          <FactoryBack seed={7} />
        </g>
        <g data-depth="1">
          <rect x={-600} y={700} width={2800} height={800} fill="url(#cn-floor)" />
          <Pool x={760} y={480} r={600} color="key" opacity={0.75} />
          {/* base */}
          <rect x={120} y={640} width={1380} height={70} fill={C.ink3} />
          <rect x={120} y={640} width={1380} height={6} fill={C.slate} />
          {/* tie bars */}
          <rect x={300} y={346} width={620} height={16} fill="url(#cn-metal)" />
          <rect x={300} y={598} width={620} height={16} fill="url(#cn-metal)" />
          {/* clamp cylinder */}
          <rect x={140} y={400} width={170} height={160} fill={C.ink3} />
          <rect x={140} y={400} width={170} height={10} fill={C.slate} />
          {/* fixed platen and mould half A */}
          <rect x={860} y={300} width={70} height={340} fill={C.ink3} />
          <rect x={780} y={360} width={80} height={240} fill="url(#cn-metal)" stroke={C.metalDark} strokeWidth={2} />
          <rect x={782} y={440} width={10} height={80} fill={C.ink2} />
          <Label className="f1-lab-mould" x={830} y={370} tx={980} ty={250} text="steel mould" color={C.paper} />
          {/* the injection barrel, hopper of pellets, heater bands */}
          <rect x={930} y={448} width={440} height={64} fill={C.ink3} />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} className="f5-heat" style={{ animationDelay: `${-i * 0.4}s` }} x={960 + i * 76} y={442} width={46} height={76} rx={4} fill={C.keyDeep} />
          ))}
          <g className="f1-barrelglow" opacity={0.4}>
            <rect x={960} y={442} width={350} height={76} fill={C.key} opacity={0.35} filter="url(#cn-bloom)" />
          </g>
          <path d="M1250 448 L1210 300 L1390 300 L1350 448 Z" fill={C.ink3} />
          {Array.from({ length: 18 }, (_, i) => (
            <circle key={i} cx={1226 + (i % 6) * 28} cy={312 + Math.floor(i / 6) * 14} r={7} fill={C.shellMid} opacity={0.7} />
          ))}
          {/* the moving half: ram, platen, mould half B */}
          <g className="f1-moving">
            <rect x={310} y={460} width={140} height={40} fill="url(#cn-metal)" />
            <rect x={440} y={300} width={70} height={340} fill={C.ink4} />
            <rect x={510} y={360} width={110} height={240} fill="url(#cn-metal)" stroke={C.metalDark} strokeWidth={2} />
            <rect x={610} y={440} width={10} height={80} fill={C.ink2} />
          </g>
          {/* the shot of hot plastic */}
          <g className="f1-shot" opacity={0}>
            <rect x={770} y={438} width={22} height={84} fill={C.keyLight} filter="url(#cn-bloom)" />
            <rect x={930} y={468} width={60} height={24} fill={C.keyLight} filter="url(#cn-bloom)" />
          </g>
          {/* the part that falls out each time */}
          <g className="f1-newpart" opacity={0}>
            <FingerShell x={700} y={480} s={0.42} rot={90} />
          </g>
          {/* counter above the mould */}
          <g className="f1-mcount" opacity={0}>
            <Readout className="f1-mcounttext" x={700} y={210} anchor="middle" color={C.gold} size={64}>
              0:00
            </Readout>
            <text x={700} y={140} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={20} letterSpacing={3}>
              ONE PART
            </text>
          </g>

          <SourceNote className="f1-figure" x={1460} y={860} anchor="end">
            Figure: “over a week on a CNC machine” → “under 20 seconds”
          </SourceNote>
        </g>
        <g className="f1-ghostclock" opacity={0}>
            <text x={1500} y={130} textAnchor="end" fill={C.mist} fontFamily={MONO} fontSize={26} textDecoration="line-through" opacity={0.7}>
              6 days 14 h
            </text>
            <text x={1500} y={162} textAnchor="end" fill={C.fog} fontFamily={SANS} fontSize={18}>
              the same part on the mill
            </text>
          </g>
        <g data-depth="1.25">
          {/* the bin in front, filling up */}
          <path d={`M${BIN.x - 130} ${BIN.y - 30} L${BIN.x + 130} ${BIN.y - 30} L${BIN.x + 110} ${BIN.y + 110} L${BIN.x - 110} ${BIN.y + 110} Z`} fill={C.ink3} />
          <g>
            {STACK.map(([dx, dy, rot], k) => (
              <g key={k} className={`f1-stack-${k}`} opacity={k < 5 ? 1 : 0}>
                <FingerShell x={BIN.x + dx} y={BIN.y + dy - 40} s={0.42} rot={rot} />
              </g>
            ))}
          </g>
          <path d={`M${BIN.x - 150} ${BIN.y - 10} L${BIN.x + 150} ${BIN.y - 10} L${BIN.x + 120} ${BIN.y + 150} L${BIN.x - 120} ${BIN.y + 150} Z`} fill={C.ink2} />
          <rect x={BIN.x - 150} y={BIN.y - 14} width={300} height={8} fill={C.gold} opacity={0.6} />
          <Label className="f1-lab-part2" x={BIN.x + 60} y={BIN.y - 40} tx={BIN.x + 260} ty={BIN.y - 90} text="finished finger shells" color={C.paper} />
        </g>
      </g>

      {/* ---------- the bill of materials ---------- */}
      <g className="f1-bomshot" ref={bomShot} opacity={0}>
        <g data-depth="0.5">
          <Blueprint />
          <Pool x={520} y={500} r={600} color="gold" opacity={0.35} />
        </g>
        <g data-depth="1">
          <g className="f1-seven" opacity={0}>
            <g opacity={0.16}>
              <Robot name="f1-seven-fill" x={S7.x} y={S7.y} s={S7.s} pose={POSES.stand} silhouette={C.gold} />
            </g>
            <g filter="url(#f5-goldline)">
              <Robot name="f1-seven-line" x={S7.x} y={S7.y} s={S7.s} pose={POSES.stand} silhouette={C.ink1} />
            </g>
            <mask id="f1-sevenmask">
              <Robot name="f1-seven-mask" x={S7.x} y={S7.y} s={S7.s} pose={POSES.stand} silhouette="#fff" />
            </mask>
            <g mask="url(#f1-sevenmask)">
              <rect className="f1-scanbar" x={300} y={0} width={440} height={30} fill={C.goldLight} opacity={0.35} transform="translate(0 220)" />
            </g>
          </g>
          <g className="f1-handglow" opacity={0}>
            <g className="f1-handpulse">
              <Pool x={at7(6, -112)[0]} y={at7(6, -112)[1]} r={110} color="gold" />
            </g>
          </g>
          {/* the stacked bar */}
          <g className="f1-barframe" opacity={0}>
            <rect x={BAR.x - 6} y={BAR.y0 - 6} width={BAR.w + 12} height={BAR.y1 - BAR.y0 + 12} fill="none" stroke={C.goldDark} strokeWidth={2} strokeDasharray="6 6" />
            <text x={BAR.x + BAR.w / 2} y={BAR.y1 + 46} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={20} letterSpacing={2}>
              BILL OF MATERIALS
            </text>
          </g>
          <rect className="f1-seg-act" x={BAR.x} y={segY(0, 56)[0]} width={BAR.w} height={segY(0, 56)[1] - segY(0, 56)[0]} fill={C.goldDark} />
          <rect className="f1-seg-hand" x={BAR.x} y={segY(56, 73)[0]} width={BAR.w} height={segY(56, 73)[1] - segY(56, 73)[0] - 3} fill={C.gold} filter="url(#cn-bloom)" />
          <g className="f1-seg-rest">
            {[0, 1, 2].map((k) => {
              const [a, b] = segY(73 + k * 9, 82 + k * 9)
              return <rect key={k} x={BAR.x} y={a + 3} width={BAR.w} height={b - a - 3} fill={C.goldDark} opacity={0.45 - k * 0.08} />
            })}
          </g>
          {PIECES.map((p, i) => (
            <rect key={i} className={`f1-piece-${i}`} x={p.from[0] - 20} y={p.from[1] - 12} width={40} height={24} rx={4} filter="url(#cn-bloom)" fill={p.seg === 'hand' ? C.gold : C.goldDark} opacity={0} />
          ))}
          <Label className="f1-lab-act" x={BAR.x + BAR.w} y={segY(0, 56)[0] + 160} tx={BAR.x + BAR.w + 50} ty={segY(0, 56)[0] + 160} text="actuators, whole body" sub="≈ 56% · motors and gearboxes" color={C.goldDark} size={26} />
          <Label className="f1-lab-hand" x={BAR.x + BAR.w} y={(segY(56, 73)[0] + segY(56, 73)[1]) / 2} tx={BAR.x + BAR.w + 50} ty={(segY(56, 73)[0] + segY(56, 73)[1]) / 2} text="the hands ≈ 17%" color={C.gold} size={32} />
          <Label className="f1-lab-rest" x={BAR.x + BAR.w} y={segY(73, 100)[0] + 70} tx={BAR.x + BAR.w + 50} ty={segY(73, 100)[0] + 70} text="compute, battery, frame" color={C.goldLight} size={24} />
          <SourceNote className="f1-ms" x={BAR.x + BAR.w / 2} y={BAR.y1 + 84} anchor="middle" color={C.goldLight}>
            Morgan Stanley estimate, Optimus
          </SourceNote>
        </g>
      </g>

      {/* ---------- the price line ---------- */}
      <g className="f1-priceshot" ref={priceShot} opacity={0}>
        <g data-depth="0.5">
          <rect x={-600} y={-500} width={2800} height={1900} fill={C.ink1} />
          <Pool x={800} y={420} r={800} color="gold" opacity={0.18} />
          <Dust x={-200} y={0} w={2000} h={900} count={30} seed={77} color={C.goldLight} size={0.6} />
        </g>
        <g data-depth="1">
          <g className="f1-axes" opacity={0}>
            <line x1={220} y1={700} x2={1400} y2={700} stroke={C.fog} strokeWidth={2} />
            <line x1={220} y1={700} x2={220} y2={180} stroke={C.fog} strokeWidth={2} />
            {[5000, 10000, 15000].map((p) => (
              <g key={p}>
                <line x1={220} x2={1400} y1={py(p)} y2={py(p)} stroke={C.ink4} strokeWidth={1} strokeDasharray="4 8" />
                <text x={204} y={py(p) + 7} textAnchor="end" fill={C.mist} fontFamily={MONO} fontSize={20}>
                  ${p / 1000}k
                </text>
              </g>
            ))}
            <text x={220} y={150} fill={C.mist} fontFamily={SANS} fontSize={22}>
              price of one good dexterous hand (China)
            </text>
            <text className="f1-lab-then" x={300} y={745} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={22}>
              a few years ago
            </text>
            <text className="f1-lab-now" x={1300} y={745} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={22}>
              2026
            </text>
          </g>
          <g className="f1-range" opacity={0}>
            <rect x={286} y={py(15000)} width={28} height={py(7000) - py(15000)} rx={6} fill={C.gold} opacity={0.22} />
            <rect x={1286} y={py(5000)} width={28} height={py(3000) - py(5000)} rx={6} fill={C.gold} opacity={0.35} />
          </g>
          <text className="f1-rmb" x={1250} y={py(5000) - 30} textAnchor="end" fill={C.goldLight} opacity={0} fontFamily={MONO} fontSize={20}>
            RMB 50–100k → RMB 20–35k
          </text>
          <path className="f1-line" d={PRICE_PATH} fill="none" stroke={C.gold} strokeWidth={6} strokeLinecap="round" strokeDasharray={1400} strokeDashoffset={1400} filter="url(#cn-bloom)" />
          {[0, 1].map((k) => {
            const [x, y] = bez(k === 0 ? 0 : 0.42)
            const p = ((700 - y) / 480) * 15000
            return (
              <g key={k} className={`f1-ghost-${k}`} opacity={0}>
                <g transform={`translate(${x} ${y}) scale(${1 - (k === 0 ? 0 : 0.42) * 0.3})`}>
                  <FlatHand x={0} y={-96} s={0.28} prefix={`f1-gh${k}`} fill={C.slate} />
                  <PriceTag x={0} y={8} text={money(Math.round(p / 100) * 100)} size={22} len={20} color={C.goldDark} />
                </g>
              </g>
            )
          })}
          <g className="f1-rider" opacity={0} transform={`translate(${P0[0]} ${P0[1]})`}>
            <FlatHand x={0} y={-96} s={0.28} prefix="f1-rh" />
            <PriceTag x={0} y={8} text="$12,000" size={24} len={20} textClass="f1-ridertag" />
          </g>
        </g>
      </g>

      <rect className="f1-flash" x={-100} y={-100} width={1800} height={1100} fill={C.goldLight} opacity={0} pointerEvents="none" />
      <Vignette />
    </g>
  )
}

export const ch1: Chapter = {
  id: 'scale',
  title: 'One versus a million',
  cues: CUES,
  Scene: Ch1Scale,
  deeper: [CostReading],
}
