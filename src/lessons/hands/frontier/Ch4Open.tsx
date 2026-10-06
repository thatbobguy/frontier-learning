import gsap from 'gsap'
import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { camera } from '../../../cine/camera'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Beam, Dust, Pool, Vignette, fade, useAmbient } from '../shared/kit'
import { IndustryChart, MiniHand } from './industry'
import { OpenReading } from './readings'

export const CUES: Cue[] = [
  { id: 'open', say: 'Here’s what is still unsolved. These are the problems the best engineers in the world are working on right now.' },
  { id: 'corner', say: 'One: the empty corner. A hand that’s dexterous, cheap and tough at the same time.' },
  { id: 'skin', say: 'Two: skin that is cheap, covers the whole hand, survives scrubbing, and can be swapped without retraining the robot.' },
  { id: 'bench', say: 'Three: an honest test. There’s no agreed way to measure a hand’s durability or dexterity, so every claim is a different experiment.' },
  { id: 'safe', say: 'Four: safety. What should a hand do when the power cuts out: hold on, or let go? The rules for humanoids are still being written.' },
  { id: 'heat', say: 'Five: heat and weight. Strong fingers want big motors, and every gram at the wrist is paid for at the shoulder.' },
  {
    id: 'data',
    say: 'And six, the biggest of all: data. Hands are getting good faster than robots are learning to use them. Engineers at China’s biggest robot fair said the same thing this year: the hardware is improving fast; the data is the gap.',
  },
  { id: 'branch', say: 'That’s where the data branch begins. You know the machine now. Next: how it learns.' },
]

const STATE = [
  'The camera rises off the industry map from chapter 2 into a dark night sky. Six unlit glass lanterns hang in a row in the dark, waiting to be named: the open problems of robot hands.',
  'Lantern 1 lights gold: inside, a triangle with corners dexterous, cheap and tough; all three corners light up at once around a small gold hand. That is the empty corner of the industry map: no hand today is all three at once.',
  'Lantern 2 lights magenta: a robot fingertip covered in tactile dots (taxels) is scrubbed by a sponge; the dots in the middle wear away and a crack appears. The open problem: skin that is cheap, covers the whole hand, survives scrubbing, and can be replaced without retraining the robot (a new skin reads slightly differently, which can break a learned policy).',
  'Lantern 3 lights gold with a red not-equal sign: two spec sheets both say "1,000,000 cycles", but one was tested squeezing a soft foam block and the other lifting a 5 kg box. There is no agreed benchmark for hand durability or dexterity, so companies’ claims cannot be compared.',
  'Lantern 4: a robot hand holds a hot pan with steam rising; the lights flicker and the power cuts; two possible outcomes branch off with question marks: the grip holds (but the robot cannot be pushed away) or it lets go (and drops the pan). A stamp reads "ISO 25785-1: draft": the safety standard for humanoid and dynamically stable robots is still being written (ISO 10218 covers industrial arms).',
  'Lantern 5 lights amber: a palm full of motors shimmers with heat; below it, an arm held out with an amber torque arc at the shoulder. Big motors give strong fingers but get hot and heavy, and every gram at the wrist multiplies into torque the shoulder must hold (torque = weight × arm length).',
  'Lantern 6 glows lime, far brighter than the others: inside, a chart where the hardware line climbs steeply while the data line lags behind, the gap between them shaded. Its light pulls the camera in, then spills down onto the course’s knowledge tree: the amber trunk of six films all lit, and the lime data branch blazing. Practitioners at WAIC 2026 in Shanghai (July 2026) said the same: the hardware is “rapidly improving”, while data and algorithms are the major gap.',
  'The camera flies along the lime data branch of the course tree toward its first node, under the branch title "The data problem": The Missing Internet, then Ways to Get Data, How Robots Learn and The Home Robot Frontier. The robot hands trunk is complete. Next: how robots learn.',
]

/* ---------------------------------------------------------------- the lanterns */

const LY = 420
const LX = (i: number) => 400 + i * 560
const R = 150

const LANTERNS: { color: string; title: string; sub: string }[] = [
  { color: C.gold, title: 'the empty corner', sub: 'dexterous · cheap · tough' },
  { color: C.magenta, title: 'skin', sub: 'cheap · whole hand · scrub-proof · swappable' },
  { color: C.gold, title: 'an honest test', sub: 'no agreed benchmark yet' },
  { color: C.danger, title: 'safety', sub: 'power cut: hold on, or let go?' },
  { color: C.amber, title: 'heat and weight', sub: 'every gram at the wrist costs at the shoulder' },
  { color: C.lime, title: 'data', sub: 'the hardware is improving fast; the data is the gap' },
]
const POOL: ('gold' | 'magenta' | 'danger' | 'amber' | 'lime')[] = ['gold', 'magenta', 'gold', 'danger', 'amber', 'lime']

function Lantern({ i, children }: { i: number; children: ReactNode }) {
  const x = LX(i)
  const l = LANTERNS[i]
  const big = i === 5
  return (
    <g className={`c4-lan c4-lan-${i}`}>
      <line x1={x} y1={-900} x2={x} y2={LY - R - 34} stroke={C.slate} strokeWidth={3} />
      <g className={`c4-lit-${i}`} opacity={0}>
        <g className="c4-glow">
          <Pool x={x} y={LY} r={big ? 560 : 340} color={POOL[i]} opacity={big ? 0.9 : 0.6} />
        </g>
      </g>
      <path d={`M${x - 46} ${LY - R - 6} L${x - 30} ${LY - R - 36} L${x + 30} ${LY - R - 36} L${x + 46} ${LY - R - 6} Z`} fill={C.ink3} stroke={C.slate} strokeWidth={2} />
      <circle cx={x} cy={LY} r={R} fill={C.ink1} fillOpacity={0.92} stroke={C.slate} strokeWidth={3} />
      <clipPath id={`c4-clip-${i}`}>
        <circle cx={x} cy={LY} r={R - 8} />
      </clipPath>
      <g clipPath={`url(#c4-clip-${i})`}>
        <g className={`c4-v-${i}`} opacity={0} transform={`translate(${x} ${LY})`}>
          {children}
        </g>
      </g>
      <g className={`c4-lit-${i}`} opacity={0}>
        <circle cx={x} cy={LY} r={R} fill="none" stroke={l.color} strokeWidth={big ? 6 : 4} filter="url(#cn-bloom)" />
      </g>
      <path d={`M${x - 20} ${LY + R - 2} L${x + 20} ${LY + R - 2} L${x} ${LY + R + 26} Z`} fill={C.ink3} stroke={C.slate} strokeWidth={2} />
      <g className={`c4-cap-${i}`} opacity={0.35}>
        <text x={x} y={LY + R + 72} textAnchor="middle" fill={l.color} fontFamily={MONO} fontSize={22}>
          {i + 1}
        </text>
        <text x={x} y={LY + R + 108} textAnchor="middle" fill={C.paper} fontFamily={SERIF} fontSize={34} fontWeight={600}>
          {l.title}
        </text>
        <text className={`c4-sub-${i}`} x={x} y={LY + R + 140} textAnchor="middle" fill={C.mist} fontFamily={SANS} fontSize={19} opacity={0}>
          {l.sub}
        </text>
      </g>
    </g>
  )
}

/* ---------------------------------------------------------------- the course tree */

const TREE = { x: 3000, y: 2050, col: 220, row: 150 }
const node = (c: number, r: number) => ({ x: TREE.x + c * TREE.col, y: TREE.y - r * TREE.row })
const TRUNK = ['The Hardest Machine', 'Joints and Freedom', 'Muscles of Metal', 'The Sense of Touch', 'A Million Hands', 'Build Your Own Hand']
const DATA: { t: string; at: [number, number] }[] = [
  { t: 'The Missing Internet', at: [1.4, 1.2] },
  { t: 'Ways to Get Data', at: [1.9, 2.2] },
  { t: 'How Robots Learn', at: [2.2, 3.2] },
  { t: 'The Home Robot Frontier', at: [2.3, 4.2] },
]
const dataPath = (() => {
  const pts = [node(0, 0), ...DATA.map((d) => node(d.at[0], d.at[1]))]
  let d = `M${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    d += ` C${a.x + (b.x - a.x) * 0.1} ${a.y - 70} ${b.x - (b.x - a.x) * 0.3} ${b.y + 70} ${b.x} ${b.y}`
  }
  return d
})()

function CourseTree() {
  const top = node(0, 5)
  const g = node(DATA[0].at[0], DATA[0].at[1])
  return (
    <g className="c4-tree" opacity={0}>
      <Pool x={TREE.x + 200} y={TREE.y - 380} r={700} color="lime" opacity={0.25} />
      {/* the trunk */}
      <path d={`M${TREE.x} ${TREE.y + 120} L${top.x} ${top.y}`} stroke={C.amberDark} strokeWidth={14} strokeLinecap="round" />
      <path d={`M${TREE.x} ${TREE.y + 120} L${top.x} ${top.y}`} stroke={C.amber} strokeWidth={5} strokeLinecap="round" opacity={0.8} />
      {/* the data branch, blazing */}
      <path className="c4-branch" d={dataPath} stroke={C.lime} strokeWidth={16} fill="none" strokeLinecap="round" filter="url(#cn-bloom)" opacity={0.6} strokeDasharray="1400" strokeDashoffset={1400} />
      <path className="c4-branch" d={dataPath} stroke={C.limeLight} strokeWidth={5} fill="none" strokeLinecap="round" strokeDasharray="1400" strokeDashoffset={1400} />
      <circle className="c4-spark" r={10} fill={C.limeLight} filter="url(#cn-bloom)" style={{ offsetPath: `path('${dataPath}')`, offsetDistance: '0%' }} opacity={0} />
      {TRUNK.map((t, r) => {
        const p = node(0, r)
        return (
          <g key={t}>
            <circle cx={p.x} cy={p.y} r={r === 5 ? 26 : 20} fill={C.ink1} stroke={C.amber} strokeWidth={4} />
            <circle cx={p.x} cy={p.y} r={r === 5 ? 13 : 9} fill={C.amberLight} />
            {r === 5 && <circle className="c4-here" cx={p.x} cy={p.y} r={36} fill="none" stroke={C.amberLight} strokeWidth={2.5} />}
            <text x={p.x - 42} y={p.y + 8} textAnchor="end" fill={r === 5 ? C.amberLight : C.paper} fontFamily={SANS} fontSize={26} fontWeight={r === 5 ? 700 : 500}>
              {t}
            </text>
            <text x={p.x - 42} y={p.y + 32} textAnchor="end" fill={C.fog} fontFamily={MONO} fontSize={15}>
              {r === 5 ? 'film 6 · you are here' : `film ${r + 1}`}
            </text>
          </g>
        )
      })}
      {DATA.map((d, k) => {
        const p = node(d.at[0], d.at[1])
        return (
          <g key={d.t} className="c4-dnode">
            <circle cx={p.x} cy={p.y} r={k === 0 ? 24 : 18} fill={C.ink1} stroke={C.lime} strokeWidth={4} />
            <circle className={k === 0 ? 'c4-first' : undefined} cx={p.x} cy={p.y} r={k === 0 ? 11 : 7} fill={C.limeLight} />
            <text x={p.x + 40} y={p.y + 8} fill={C.limeLight} fontFamily={SANS} fontSize={k === 0 ? 28 : 24} fontWeight={600}>
              {d.t}
            </text>
          </g>
        )
      })}
      <g className="c4-btitle" opacity={0}>
        <text x={g.x + 40} y={g.y - 52} fill={C.lime} fontFamily={SERIF} fontSize={44} fontWeight={600}>
          The data problem
        </text>
        <text x={g.x + 42} y={g.y - 24} fill={C.mist} fontFamily={MONO} fontSize={17}>
          next branch · how robots learn
        </text>
      </g>
    </g>
  )
}

/* ---------------------------------------------------------------- the scene */

export function Ch4Open({ cueIndex, playing, onAnimDone, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)

  const build = useCallback((tl: gsap.core.Timeline) => {
    const cam = camera(root.current, { x: 1930, y: 1560, zoom: 1.3 })
    const light = (i: number, at: number) => {
      tl.fromTo(`.c4-lit-${i}`, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'none', immediateRender: false }, at)
      tl.fromTo(`.c4-lit-${i}`, { opacity: 1 }, { opacity: 0.3, duration: 0.08, yoyo: true, repeat: 3, immediateRender: false }, at + 0.25)
      tl.fromTo(`.c4-v-${i}`, { opacity: 0 }, { opacity: 1, duration: 0.6, immediateRender: false }, at + 0.3)
      tl.fromTo(`.c4-cap-${i}`, { opacity: 0.35 }, { opacity: 1, duration: 0.5, immediateRender: false }, at + 0.3)
      tl.fromTo(`.c4-sub-${i}`, { opacity: 0 }, { opacity: 1, duration: 0.5, immediateRender: false }, at + 1)
    }
    const visit = (i: number, at: number) => cam.to(tl, { x: LX(i), y: LY + 85, zoom: 1.9, rot: 0 }, at, 1.6, 'power2.inOut')

    /* b0: off the map, up into the dark, six unlit lanterns. */
    tl.addLabel('b0', 0)
    tl.set('.c4-map', { opacity: 1 }, 0)
    cam.to(tl, { x: 1800, y: 470, zoom: 0.47, rot: 0 }, 0.4, 5.2, 'power2.inOut')
    fade(tl, '.c4-map', 0.12, 1.2, 3)
    tl.fromTo('.c4-lan', { y: -60 }, { y: 0, duration: 3.2, stagger: 0.25, ease: 'sine.out', immediateRender: false }, 1.6)
    tl.fromTo('.c4-head', { opacity: 0 }, { opacity: 1, duration: 1, immediateRender: false }, 5.4)
    tl.to({}, { duration: 0.1 }, 8.2)

    /* b1: one, the empty corner. */
    let t = 8.4
    tl.addLabel('b1', t)
    fade(tl, '.c4-head', 0, t, 0.6)
    visit(0, t)
    light(0, t + 1.0)
    tl.fromTo('.c4-tri', { strokeDashoffset: 620 }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut', immediateRender: false }, t + 1.2)
    tl.fromTo('.c4-cnr', { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, transformOrigin: '50% 50%', duration: 0.4, stagger: 0.35, ease: 'back.out(2)', immediateRender: false }, t + 2.2)
    tl.fromTo('.c4-cnrt', { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.35, immediateRender: false }, t + 2.3)
    tl.fromTo('.c4-q1', { scale: 0.4, opacity: 0, transformOrigin: '50% 50%' }, { scale: 1, opacity: 1, transformOrigin: '50% 50%', duration: 0.8, ease: 'back.out(1.6)', immediateRender: false }, t + 3.4)
    tl.to({}, { duration: 0.1 }, t + 5.9)

    /* b2: two, skin. */
    t += 6.1
    tl.addLabel('b2', t)
    visit(1, t)
    light(1, t + 1.0)
    for (let k = 0; k < 6; k++) {
      tl.fromTo('.c4-sponge', { x: k % 2 ? 46 : -46 }, { x: k % 2 ? -46 : 46, duration: 0.55, ease: 'sine.inOut', immediateRender: false }, t + 1.6 + k * 0.55)
    }
    tl.fromTo('.c4-taxel-w', { opacity: 1 }, { opacity: 0.08, duration: 0.5, stagger: { each: 0.12, from: 'center' }, immediateRender: false }, t + 2.4)
    tl.fromTo('.c4-crack', { strokeDashoffset: 120 }, { strokeDashoffset: 0, duration: 0.8, immediateRender: false }, t + 4.0)
    fade(tl, '.c4-sponge', 0, t + 4.9, 0.4)
    tl.fromTo('.c4-swap', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, immediateRender: false }, t + 5.6)
    tl.to({}, { duration: 0.1 }, t + 7.8)

    /* b3: three, an honest test. */
    t += 8.0
    tl.addLabel('b3', t)
    visit(2, t)
    light(2, t + 1.0)
    tl.fromTo('.c4-card', { y: -40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.3, ease: 'power2.out', immediateRender: false }, t + 1.4)
    tl.fromTo('.c4-test', { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: 0.4, immediateRender: false }, t + 3.0)
    for (let k = 0; k < 4; k++) {
      tl.fromTo('.c4-foam', { scaleY: 1, svgOrigin: '-62 112' }, { scaleY: 0.62, svgOrigin: '-62 112', duration: 0.4, yoyo: true, repeat: 1, ease: 'sine.inOut', immediateRender: false }, t + 3.6 + k * 0.9)
      tl.fromTo('.c4-box', { y: 0 }, { y: -16, duration: 0.4, yoyo: true, repeat: 1, ease: 'power2.inOut', immediateRender: false }, t + 3.6 + k * 0.9)
    }
    tl.fromTo('.c4-neq', { scale: 0, opacity: 0, svgOrigin: '0 40' }, { scale: 1, opacity: 1, svgOrigin: '0 40', duration: 0.5, ease: 'back.out(2.5)', immediateRender: false }, t + 5.4)
    tl.to({}, { duration: 0.1 }, t + 8.6)

    /* b4: four, safety. */
    t += 8.8
    tl.addLabel('b4', t)
    visit(3, t)
    light(3, t + 1.0)
    tl.fromTo('.c4-pan', { opacity: 0 }, { opacity: 1, duration: 0.6, immediateRender: false }, t + 1.5)
    tl.fromTo('.c4-dark', { opacity: 0 }, { opacity: 0.75, duration: 0.07, yoyo: true, repeat: 5, immediateRender: false }, t + 3.6)
    tl.fromTo('.c4-dark', { opacity: 0 }, { opacity: 0.6, duration: 0.2, immediateRender: false }, t + 4.1)
    tl.fromTo('.c4-fork', { strokeDashoffset: 120 }, { strokeDashoffset: 0, duration: 0.6, stagger: 0.2, immediateRender: false }, t + 4.6)
    tl.fromTo('.c4-out', { opacity: 0, scale: 0.6, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, transformOrigin: '50% 50%', duration: 0.5, stagger: 0.3, ease: 'back.out(2)', immediateRender: false }, t + 5.1)
    tl.fromTo('.c4-drop', { y: 0, rotation: 0, svgOrigin: '48 76' }, { y: 22, rotation: 24, svgOrigin: '48 76', duration: 0.6, ease: 'power2.in', immediateRender: false }, t + 5.8)
    tl.fromTo('.c4-iso', { opacity: 0, scale: 1.6, svgOrigin: '0 -58' }, { opacity: 1, scale: 1, svgOrigin: '0 -58', duration: 0.35, ease: 'power3.in', immediateRender: false }, t + 7.0)
    tl.to({}, { duration: 0.1 }, t + 9.8)

    /* b5: five, heat and weight. */
    t += 10
    tl.addLabel('b5', t)
    visit(4, t)
    light(4, t + 1.0)
    tl.fromTo('.c4-motor', { fill: C.ink3 }, { fill: C.amber, duration: 0.5, stagger: 0.12, immediateRender: false }, t + 1.6)
    tl.fromTo('.c4-heat', { opacity: 0 }, { opacity: 1, duration: 0.8, immediateRender: false }, t + 2.6)
    tl.fromTo('.c4-arm', { rotation: -6, svgOrigin: '-86 52' }, { rotation: 4, svgOrigin: '-86 52', duration: 0.9, ease: 'power2.inOut', immediateRender: false }, t + 4.0)
    tl.fromTo('.c4-tau', { strokeDashoffset: 160 }, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.out', immediateRender: false }, t + 4.6)
    tl.fromTo('.c4-taut', { opacity: 0 }, { opacity: 1, duration: 0.5, immediateRender: false }, t + 5.2)
    tl.to({}, { duration: 0.1 }, t + 8.2)

    /* b6: six, data: the brightest lantern pulls the camera in, then its light falls on the tree. */
    t += 8.4
    tl.addLabel('b6', t)
    cam.to(tl, { x: LX(5), y: LY + 40, zoom: 1.4, rot: 0 }, t, 2, 'power2.inOut')
    light(5, t + 1.4)
    tl.fromTo('.c4-hw', { strokeDashoffset: 300 }, { strokeDashoffset: 0, duration: 1.4, ease: 'power1.in', immediateRender: false }, t + 2.2)
    tl.fromTo('.c4-dt', { strokeDashoffset: 300 }, { strokeDashoffset: 0, duration: 1.4, ease: 'power1.out', immediateRender: false }, t + 2.4)
    tl.fromTo('.c4-gap', { opacity: 0 }, { opacity: 1, duration: 0.8, immediateRender: false }, t + 3.8)
    cam.to(tl, { x: LX(5), y: LY + 40, zoom: 2.15, rot: 0 }, t + 3.4, 4, 'sine.inOut')
    fade(tl, '.c4-others', 0.35, t + 5.6, 1.5)
    // the light spills down onto the course tree
    cam.to(tl, { x: 3170, y: 1530, zoom: 0.92, rot: 0 }, t + 7.8, 3.2, 'power2.inOut')
    fade(tl, '.c4-tree', 1, t + 8.0, 1.2)
    fade(tl, '.c4-spill', 1, t + 8.2, 1.6)
    tl.fromTo('.c4-branch', { strokeDashoffset: 1400 }, { strokeDashoffset: 0, duration: 2.4, ease: 'power2.inOut', immediateRender: false }, t + 9.4)
    tl.fromTo('.c4-dnode', { opacity: 0, scale: 0.5, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, transformOrigin: '50% 50%', duration: 0.5, stagger: 0.4, ease: 'back.out(2)', immediateRender: false }, t + 10.4)
    tl.to({}, { duration: 0.1 }, t + 15.8)

    /* b7: along the lime branch to "The data problem". */
    t += 16
    tl.addLabel('b7', t)
    const g = node(DATA[0].at[0], DATA[0].at[1])
    tl.fromTo('.c4-spark', { opacity: 1, offsetDistance: '0%' }, { opacity: 1, offsetDistance: '100%', duration: 3.2, ease: 'power1.inOut', immediateRender: false }, t)
    cam.to(tl, { x: node(0, 0).x + 80, y: node(0, 0).y - 30, zoom: 1.6, rot: 0 }, t, 1.2, 'power2.inOut')
    cam.to(tl, { x: g.x + 180, y: g.y - 30, zoom: 1.9, rot: 0 }, t + 1.2, 1.6, 'sine.inOut')
    fade(tl, '.c4-btitle', 1, t + 2.0, 0.8)
    cam.to(tl, { x: 3230, y: 1600, zoom: 0.98, rot: 0 }, t + 3.6, 2.4, 'power2.inOut')
    tl.to({}, { duration: 0.1 }, t + 6.1)
  }, [])
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.c4-glow', { opacity: 0.75, duration: 1.7, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.4 })
    gsap.to('.c4-star', { opacity: 0.25, duration: 1.3, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: { each: 0.15, from: 'random' } })
    gsap.fromTo('.c4-shimmer', { y: 8, opacity: 0.2 }, { y: -18, opacity: 0.9, duration: 1.1, repeat: -1, ease: 'sine.in', stagger: 0.3 })
    gsap.fromTo('.c4-steam', { y: 6, opacity: 0.1 }, { y: -26, opacity: 0.8, duration: 1.6, repeat: -1, ease: 'sine.out', stagger: 0.5 })
    gsap.to('.c4-q1, .c4-qm', { scale: 1.1, transformOrigin: '50% 50%', duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.c4-here, .c4-first', { scale: 1.3, opacity: 0.4, transformOrigin: '50% 50%', duration: 1, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.c4-sway', { rotation: 1.2, svgOrigin: '1800 -900', duration: 3.4, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  useEffect(() => {
    reportState(STATE[cueIndex] ?? STATE[0])
    setHints([])
  }, [cueIndex, reportState, setHints])

  return (
    <g ref={root}>
      <rect x={-2000} y={-2000} width={8000} height={6000} fill={C.ink} />
      <g data-depth="0.35">
        <rect x={-600} y={-600} width={4000} height={1400} fill="url(#cn-pool-dark)" opacity={0.4} />
        {STARS.map((s, k) => (
          <circle key={k} className={k % 3 === 0 ? 'c4-star' : undefined} cx={s[0]} cy={s[1]} r={s[2]} fill={C.paper} opacity={0.6} />
        ))}
      </g>
      <g data-depth="1">
        {/* the map we rose from */}
        <g className="c4-map" transform="translate(1100 1120)">
          <IndustryChart p="c4" />
        </g>
        <CourseTree />
        <g className="c4-spill" opacity={0}>
          <Beam x={LX(5)} y={LY + R} w1={120} w2={1100} len={1500} angle={0} fill="url(#cn-pool-lime)" opacity={0.25} />
        </g>
        <text className="c4-head" x={1800} y={-80} textAnchor="middle" fill={C.paper} fontFamily={SERIF} fontSize={92} fontWeight={600} opacity={0}>
          six unsolved problems
        </text>
        <g className="c4-sway">
          <g className="c4-others">
            {[0, 1, 2, 3, 4].map((i) => (
              <Lantern key={i} i={i}>
                {VIGNETTES[i]}
              </Lantern>
            ))}
          </g>
          <Lantern i={5}>{VIGNETTES[5]}</Lantern>
        </g>
        <Dust x={0} y={-200} w={3600} h={1200} count={40} seed={61} color={C.mist} />
      </g>
      <Vignette strength={0.9} />
    </g>
  )
}

/** Fixed, seeded stars for the night sky. */
const STARS: [number, number, number][] = (() => {
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  return Array.from({ length: 160 }, () => [-400 + rnd() * 4200, -700 + rnd() * 1500, 0.8 + rnd() * 2.2] as [number, number, number])
})()

/* ---------------------------------------------------------------- what each lantern shows (local coordinates, lantern centre at 0,0) */

const TAXELS: [number, number][] = []
for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) TAXELS.push([-48 + c * 24, -64 + r * 24])

const VIGNETTES: ReactNode[] = [
  // 1: the iron triangle, all three corners lit
  <g key="v1">
    <path className="c4-tri" d="M0 -92 L-96 70 L96 70 Z" fill={C.gold} fillOpacity={0.08} stroke={C.gold} strokeWidth={4} strokeDasharray="620" strokeDashoffset={620} strokeLinejoin="round" />
    {(
      [
        [0, -92, 'dexterous', 0, -108],
        [-96, 70, 'cheap', -40, 104],
        [96, 70, 'tough', 40, 104],
      ] as const
    ).map(([x, y, t, tx, ty]) => (
      <g key={t}>
        <circle className="c4-cnr" cx={x} cy={y} r={13} fill={C.goldLight} filter="url(#cn-bloom)" />
        <text className="c4-cnrt" x={x + (tx > 0 ? -6 : tx < 0 ? 6 : 0)} y={ty} textAnchor={tx > 0 ? 'end' : tx < 0 ? 'start' : 'middle'} fill={C.goldLight} fontFamily={SANS} fontSize={19} fontWeight={600} opacity={0}>
          {t}
        </text>
      </g>
    ))}
    <g className="c4-q1" opacity={0}>
      <MiniHand x={0} y={20} s={1.3} fingers={5} color={C.goldLight} />
      <text x={0} y={-22} textAnchor="middle" fill={C.goldLight} fontFamily={SERIF} fontSize={30} fontWeight={700}>
        ?
      </text>
    </g>
  </g>,
  // 2: a fingertip's skin wearing through under a scrubbing sponge
  <g key="v2">
    <path d="M-62 150 L-62 -40 A62 62 0 0 1 62 -40 L62 150 Z" fill={C.shellDark} />
    <path d="M-56 150 L-56 -40 A56 56 0 0 1 56 -40 L56 150 Z" fill={C.ink3} />
    {TAXELS.map(([x, y], k) => {
      const worn = Math.abs(x) <= 24 && y >= -40 && y <= 32
      return <circle key={k} className={worn ? 'c4-taxel-w' : undefined} cx={x} cy={y} r={6} fill={C.magenta} filter={worn ? undefined : undefined} />
    })}
    <path className="c4-crack" d="M-6 -46 L6 -24 L-4 -8 L8 10 L-2 30" stroke={C.danger} strokeWidth={3.5} fill="none" strokeDasharray="120" strokeDashoffset={120} strokeLinejoin="round" />
    <g className="c4-sponge">
      <rect x={-42} y={-30} width={84} height={44} rx={10} fill="#d9c45a" />
      <rect x={-42} y={4} width={84} height={12} rx={5} fill="#3f7d4f" />
      {[[-26, -18], [-6, -12], [16, -20], [28, -6], [-18, -2]].map(([x, y], k) => (
        <circle key={k} cx={x} cy={y} r={3.5} fill="#a8923a" />
      ))}
    </g>
    <text className="c4-swap" x={0} y={110} textAnchor="middle" fill={C.magentaLight} fontFamily={MONO} fontSize={16} opacity={0}>
      swap it → retrain?
    </text>
  </g>,
  // 3: two spec sheets with the same number and very different tests
  <g key="v3">
    {[-62, 62].map((x) => (
      <g key={x} className="c4-card" opacity={0}>
        <rect x={x - 54} y={-112} width={108} height={104} rx={8} fill={C.paper} />
        <text x={x} y={-88} textAnchor="middle" fill={C.slate} fontFamily={MONO} fontSize={11}>
          SPEC SHEET
        </text>
        <text x={x} y={-56} textAnchor="middle" fill={C.ink} fontFamily={SANS} fontSize={21} fontWeight={700}>
          1,000,000
        </text>
        <text x={x} y={-34} textAnchor="middle" fill={C.goldDark} fontFamily={MONO} fontSize={15}>
          cycles
        </text>
        <path d={`M${x - 38} -22 h76`} stroke={C.mist} strokeWidth={2} />
      </g>
    ))}
    <g className="c4-test" opacity={0}>
      <rect className="c4-foam" x={-96} y={64} width={68} height={48} rx={14} fill={C.cyanLight} fillOpacity={0.55} />
      {[[-82, 78], [-60, 92], [-44, 74]].map(([x, y], k) => (
        <circle key={k} cx={x} cy={y} r={3} fill={C.cyan} opacity={0.6} />
      ))}
      <text x={-62} y={52} textAnchor="middle" fill={C.mist} fontFamily={MONO} fontSize={13}>
        foam
      </text>
    </g>
    <g className="c4-test" opacity={0}>
      <g className="c4-box">
        <rect x={30} y={60} width={64} height={52} rx={4} fill={C.amberDark} />
        <path d="M30 76 h64" stroke={C.amber} strokeWidth={2} />
        <text x={62} y={102} textAnchor="middle" fill={C.ink} fontFamily={SANS} fontSize={18} fontWeight={700}>
          5 kg
        </text>
      </g>
    </g>
    <g className="c4-neq" opacity={0}>
      <text x={0} y={60} textAnchor="middle" fill={C.danger} fontFamily={SANS} fontSize={56} fontWeight={700}>
        ≠
      </text>
    </g>
  </g>,
  // 4: power cut while holding a hot pan
  <g key="v4">
    <g className="c4-pan" opacity={0}>
      {[-24, 0, 24].map((x) => (
        <path key={x} className="c4-steam" d={`M${x} -30 q8 -12 0 -24 q-8 -12 0 -24`} stroke={C.mist} strokeWidth={3} fill="none" strokeLinecap="round" />
      ))}
      <ellipse cx={0} cy={-4} rx={58} ry={16} fill={C.metalDark} stroke={C.metal} strokeWidth={3} />
      <path d="M56 -4 L92 2" stroke={C.carbon} strokeWidth={10} strokeLinecap="round" />
      <MiniHand x={98} y={14} s={1.1} fingers={5} color={C.shell} />
    </g>
    <rect className="c4-dark" x={-160} y={-160} width={320} height={320} fill={C.ink} opacity={0} />
    <path className="c4-fork" d="M0 22 Q-24 44 -48 66" stroke={C.paper} strokeWidth={2.5} fill="none" strokeDasharray="120" strokeDashoffset={120} />
    <path className="c4-fork" d="M0 22 Q24 44 48 66" stroke={C.paper} strokeWidth={2.5} fill="none" strokeDasharray="120" strokeDashoffset={120} />
    <g className="c4-out" opacity={0}>
      <ellipse cx={-48} cy={80} rx={20} ry={6} fill={C.metal} />
      <text x={-48} y={110} textAnchor="middle" fill={C.paper} fontFamily={SANS} fontSize={16}>
        hold on?
      </text>
    </g>
    <g className="c4-out" opacity={0}>
      <g className="c4-drop">
        <ellipse cx={48} cy={80} rx={20} ry={6} fill={C.metal} />
      </g>
      <text x={48} y={110} textAnchor="middle" fill={C.paper} fontFamily={SANS} fontSize={16}>
        let go?
      </text>
    </g>
    <g className="c4-iso" opacity={0}>
      <g transform="rotate(-6 0 -58)">
        <rect x={-92} y={-76} width={184} height={36} rx={6} fill={C.ink} fillOpacity={0.7} stroke={C.gold} strokeWidth={2.5} />
        <text x={0} y={-51} textAnchor="middle" fill={C.gold} fontFamily={MONO} fontSize={16} fontWeight={700}>
          ISO 25785-1: draft
        </text>
      </g>
    </g>
  </g>,
  // 5: a hot palm of motors, and the shoulder paying for it
  <g key="v5">
    <rect x={-70} y={-112} width={140} height={84} rx={18} fill={C.ink3} stroke={C.shellDark} strokeWidth={3} />
    {[0, 1, 2].flatMap((r) => [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} className="c4-motor" x={-58 + c * 30} y={-102 + r * 22} width={24} height={16} rx={4} fill={C.ink3} />))}
    <g className="c4-heat" opacity={0}>
      {[-40, -10, 20, 50].map((x) => (
        <path key={x} className="c4-shimmer" d={`M${x - 8} -118 q8 -10 0 -18 q-8 -10 0 -18`} stroke={C.amber} strokeWidth={3} fill="none" strokeLinecap="round" />
      ))}
    </g>
    <circle cx={-86} cy={52} r={12} fill={C.boneDark} />
    <g className="c4-arm">
      <path d="M-86 52 L70 52" stroke={C.bone} strokeWidth={14} strokeLinecap="round" />
      <MiniHand x={92} y={62} s={0.9} fingers={5} color={C.shell} />
      <path d="M92 74 v34" stroke={C.amber} strokeWidth={3} markerEnd="url(#cn-arrow)" />
    </g>
    <path className="c4-tau" d="M-86 6 A46 46 0 1 0 -40 52" stroke={C.amber} strokeWidth={5} fill="none" strokeDasharray="160" strokeDashoffset={160} markerEnd="url(#cn-arrow)" />
    <text className="c4-taut" x={-24} y={112} textAnchor="middle" fill={C.amberLight} fontFamily={MONO} fontSize={17} opacity={0}>
      τ = m·g·L
    </text>
  </g>,
  // 6: hardware climbing fast, data lagging: the gap
  <g key="v6">
    <path d="M-100 80 L104 80 M-100 80 L-100 -100" stroke={C.fog} strokeWidth={2.5} />
    <path className="c4-gap" d="M-96 76 C-20 60 30 -10 96 -90 L96 40 C40 58 -20 70 -96 76 Z" fill={C.lime} fillOpacity={0.14} opacity={0} />
    <path className="c4-hw" d="M-96 76 C-20 60 30 -10 96 -90" stroke={C.bone} strokeWidth={4.5} fill="none" strokeDasharray="300" strokeDashoffset={300} />
    <path className="c4-dt" d="M-96 76 C-20 70 40 58 96 40" stroke={C.lime} strokeWidth={4.5} fill="none" strokeDasharray="300" strokeDashoffset={300} />
    <g className="c4-gap" opacity={0}>
      <text x={-56} y={-44} fill={C.bone} fontFamily={SANS} fontSize={17}>
        hardware
      </text>
      <text x={20} y={68} fill={C.lime} fontFamily={SANS} fontSize={17}>
        data
      </text>
      <text className="c4-qm" x={60} y={-8} textAnchor="middle" fill={C.limeLight} fontFamily={SERIF} fontSize={30} fontWeight={700}>
        gap
      </text>
    </g>
  </g>,
]

export const ch4: Chapter = {
  id: 'open',
  title: 'What nobody has solved',
  cues: CUES,
  Scene: Ch4Open,
  enter: { type: 'pan', dir: 'up' },
  deeper: [OpenReading],
}
