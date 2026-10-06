import gsap from 'gsap'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { camera } from '../../../cine/camera'
import { GRASPS, Hand3D, makeHandStore, useHandStore, type HandPose, type HandView } from '../../../cine/hand3d'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { Profile } from '../../../cine/people'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Blueprint, Dust, FiveMap, Pool, QUESTIONS, Vignette, fade, useAmbient } from '../shared/kit'
import { HandOverlay, dragIn, resetHand } from './fx'
import { FrameworkReading } from './readings'

export const CUES: Cue[] = [
  { id: 'map', say: 'So here’s the map for this whole course. Every robot hand ever built is a set of answers to five questions.' },
  { id: 'q1', say: 'One: shape. How many joints, and where do they go?' },
  { id: 'q2', say: 'Two: muscle. What makes the force? Almost always, electric motors.' },
  { id: 'q3', say: 'Three: tendons. How does the force get from the motor to the joint?' },
  { id: 'q4', say: 'Four: touch. How does the hand know what it’s holding?' },
  { id: 'q5', say: 'Five: brain. Who decides how every joint should move, and what did it learn from?' },
  { id: 'wall', say: 'And around all five stands a wall. Can you build a million of them, cheaply, that keep working for years?' },
  { id: 'triangle', say: 'Every answer has a price. More joints buy dexterity, but cost money and add things that break. Engineers call it a triangle: dexterity, robustness, cost. You can usually pick two.' },
  { id: 'pick', say: 'Let’s test it. Three real hands, three customers. Match each hand to the customer it suits best.', play: true },
  { id: 'ahead', say: 'Over the next films, we’ll take each question in turn: how the best engineers answer it, what they give up, and where the answers are still missing.' },
  { id: 'branch', say: 'And when you’re ready, a branch splits off into the deepest question of all: where a robot’s brain gets its data.' },
]

const STATE = [
  'A white robot hand, palm towards us, floats at the centre of a dark blueprint grid. Five tilted orbit rings circle it, still dim and unlabelled. This is the course map: every robot hand is a set of answers to five questions.',
  'Ring 1 lights bone-white, labelled "1. Shape, kinematics". The hand’s joints glow with dashed rods showing each rotation axis. Question: how many joints, and where?',
  'Ring 2 lights amber, "2. Muscle, actuation". Motors glow amber inside the robot’s forearm. Question: what makes the force? Almost always electric motors.',
  'Ring 3 lights cyan, "3. Tendons, transmission". Cyan cables run from the forearm motors to the finger joints and tighten as the fingers close. Question: how does force reach the joint?',
  'Ring 4 lights magenta, "4. Touch, sensing". The fingertip pads glow magenta. Question: how does the hand know what it is holding?',
  'Ring 5 lights lime, "5. Brain, control + data". A branching lime network grows from the wrist to a distant controller node. Question: who decides how each joint moves, and what did it learn from?',
  'A heavy gold ring slams shut around all five rings with a camera shake: the wall. Small gold icons sit on it: a mould (tooling), a dollar sign (cost), a stopwatch counting cycles (durability). Question: can you build a million, cheaply, that keep working for years?',
  'The map dims and a triangle draws itself with corners dexterity (top), robustness (bottom left) and cost (bottom right). A marker dot slides to each edge in turn, and the corner it moves away from dims: dexterous + cheap gives up robustness, robust + cheap gives up dexterity, dexterous + robust gives up cost. You can usually pick two.',
  '',
  'The map tilts back like a floor, and a glowing trunk grows up out of the hand: the knowledge tree. Five nodes up the trunk are the next films (Joints and Freedom, Muscles of Metal, The Sense of Touch, The Wall, The Frontier). A dim lime branch splits off from this first node.',
  'The lime branch lights up and runs to a node labelled "The data problem": the data branch of the course, about where a robot’s brain gets its data. The camera rises up the trunk.',
]

const HINTS = [
  'Which customer can afford a hand that costs as much as a car?',
  'Which job needs fingers moving independently?',
  'Which one does the same simple grip ten thousand times a day?',
]

const CX = 800
const CY = 470
/** The robot hand at the centre of the map. */
const HX = 800
const HY = 610
const ARM = 240
const VIEW: HandView = { yaw: -12, pitch: 6, roll: 0, s: 1.22 }

/** Ring geometry, the same as FiveMap draws. */
const RINGS = QUESTIONS.filter((q) => q.id !== 'wall').map((q, i) => ({ ...q, rx: 250 + i * 62, ry: (250 + i * 62) * 0.34, tilt: -14 + i * 7 }))

/** The triangle (stage coordinates). */
const TRI = { d: { x: 800, y: 175 }, r: { x: 470, y: 715 }, c: { x: 1130, y: 715 } }

/** The knowledge tree: the trunk's nodes, from this film up. */
const TRUNK = [
  { y: 520, name: 'The Hardest Machine', sub: 'you are here', color: C.paper },
  { y: 250, name: 'Joints and Freedom', sub: '1 · shape', color: C.bone },
  { y: -20, name: 'Muscles of Metal', sub: '2 + 3 · muscle and tendons', color: C.amber },
  { y: -290, name: 'The Sense of Touch', sub: '4 · touch', color: C.magenta },
  { y: -560, name: 'The Wall', sub: 'manufacturing', color: C.gold },
  { y: -830, name: 'The Frontier', sub: '5 · brain, and your own hand', color: C.paper },
]
const DATA = { x: 1330, y: 120 }

/* ---------------- the play: three hands, three customers ---------------- */
type HandId = 'A' | 'B' | 'C'
type CustId = 'lab' | 'maker' | 'warehouse'
const CARDS: { id: HandId; name: string; specs: string[]; price: string }[] = [
  { id: 'A', name: 'Research hand', specs: ['20 motors · tendons', 'rich touch', '4.3 kg with forearm'], price: 'over $100,000' },
  { id: 'B', name: 'Workhorse', specs: ['6 motors drive 12 joints', 'linkages · self-locking', '540 g'], price: 'about $5,000' },
  { id: 'C', name: 'Gripper', specs: ['1 motor · two fingers', 'almost unbreakable', ''], price: 'about $1,000' },
]
const CUSTOMERS: { id: CustId; need: string[]; match: HandId; skin: string; skinDark: string; hair: string }[] = [
  { id: 'lab', need: ['A lab teaching a hand', 'to spin a Rubik’s cube'], match: 'A', skin: C.skinC, skinDark: C.skinCDark, hair: C.hairDark },
  { id: 'maker', need: ['A humanoid maker who needs', 'thousands of hands that can', 'grasp most household objects'], match: 'B', skin: C.skinA, skinDark: C.skinADark, hair: C.hairBrown },
  { id: 'warehouse', need: ['A warehouse picking', '10,000 boxes a day'], match: 'C', skin: C.skinB, skinDark: C.skinBDark, hair: C.hairGrey },
]
const RIGHT: Record<HandId, [string, string]> = {
  A: ['dexterity + robustness, gives up cost', 'only a research lab pays for every finger'],
  B: ['robustness + cost, gives up some dexterity', 'grasps most things, can’t spin a pen'],
  C: ['cost + robustness, no dexterity at all', 'one grip, ten thousand times a day'],
}
const WRONG: Record<HandId, Partial<Record<CustId, string>>> = {
  A: { maker: 'costs more than the robot it sits on', warehouse: 'too costly and delicate for one simple grip' },
  B: { lab: 'can’t turn the cube’s faces: its fingers are coupled', warehouse: 'a gripper does this for a fifth of the price' },
  C: { lab: 'can’t turn the cube’s faces', maker: 'two fingers can’t grasp most household things' },
}
const COLX = [290, 800, 1310]
/** Where the cards start (shuffled so nothing lines up), the customers' row, and the docking slots. */
const START: Record<HandId, number> = { C: 0, A: 1, B: 2 }
const CARD_Y = 715
const CUST_Y = 140
const SLOT_Y = 385
const CW = 440
const CH = 200

const cardHands = {
  A: makeHandStore({ pose: GRASPS.spread as HandPose, view: { yaw: -16, pitch: 4, roll: 0, s: 0.58 } }),
  B: makeHandStore({ pose: GRASPS.power as HandPose, view: { yaw: 50, pitch: 4, roll: 0, s: 0.6 } }),
}
cardHands.A.state.touch = { thumb: 0.8, index: 0.9, middle: 0.9, ring: 0.8, little: 0.7 }

function CardArt({ id }: { id: HandId }) {
  if (id === 'C')
    return (
      <g>
        <rect x={-36} y={-70} width={72} height={34} rx={6} fill={C.metalDark} />
        <rect x={-46} y={-38} width={92} height={22} rx={4} fill={C.metal} />
        <rect x={-44} y={-16} width={18} height={72} rx={4} fill={C.shell} />
        <rect x={26} y={-16} width={18} height={72} rx={4} fill={C.shell} />
        <rect x={-44} y={36} width={18} height={20} fill={C.rubber} />
        <rect x={26} y={36} width={18} height={20} fill={C.rubber} />
        <path d="M-16 20 L16 20" stroke={C.cyan} strokeWidth={2} markerStart="url(#cn-arrow)" markerEnd="url(#cn-arrow)" />
      </g>
    )
  return <Hand3D store={cardHands[id]} x={id === 'A' ? 0 : -14} y={id === 'A' ? 58 : 40} look="robot" arm={0} light={[-0.6, -0.8]} />
}

function Card({ id, x, y, s = 1, glow, dragProps }: { id: HandId; x: number; y: number; s?: number; glow?: string; dragProps?: object }) {
  const c = CARDS.find((k) => k.id === id)!
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} {...dragProps} data-tutor={`hand-${c.name.toLowerCase()}`}>
      <rect x={-CW / 2} y={-CH / 2} width={CW} height={CH} rx={20} fill={C.ink1} fillOpacity={0.92} stroke={glow ?? C.slate} strokeWidth={glow ? 3 : 2} />
      <circle cx={-CW / 2 + 92} cy={0} r={78} fill={C.ink3} />
      <g transform={`translate(${-CW / 2 + 92} 0)`}>
        <CardArt id={id} />
      </g>
      <text x={-CW / 2 + 190} y={-48} fill={C.paper} fontFamily={SANS} fontSize={28} fontWeight={600}>
        {c.name}
      </text>
      {c.specs.map((t, i) => (
        <text key={i} x={-CW / 2 + 190} y={-14 + i * 24} fill={C.mist} fontFamily={MONO} fontSize={16}>
          {t}
        </text>
      ))}
      <text x={-CW / 2 + 190} y={72} fill={C.gold} fontFamily={MONO} fontSize={19} fontWeight={600}>
        {c.price}
      </text>
    </g>
  )
}

export function Ch4Framework({ cueIndex, playing, onAnimDone, onPlayDone, say, emit, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const world = useRef<SVGGElement>(null)
  const stage = useRef<SVGGElement>(null)
  const hand = useHandStore({ pose: GRASPS.relaxed, view: VIEW })

  const build = useCallback(
    (tl: gsap.core.Timeline) => {
      resetHand(tl, hand, { pose: GRASPS.relaxed as HandPose, view: VIEW })
      const cam = camera(world.current, { x: HX, y: 470, zoom: 2.3 })
      const q = (s: string) => root.current?.querySelector(s)

      /* b0: out from the hand: the blueprint, five blank rings. */
      tl.addLabel('b0', 0)
      tl.fromTo('.fm [class*="fm-lab-"]', { opacity: 0 }, { opacity: 0, duration: 0.01, immediateRender: false }, 0)
      tl.fromTo('.fm [class*="fm-ring-"]', { opacity: 0 }, { opacity: 0.22, duration: 2, stagger: 0.25, immediateRender: false }, 1.2)
      fade(tl, '.c4-blue', 1, 0.2, 2.4)
      cam.to(tl, { x: 800, y: 470, zoom: 0.98 }, 0.2, 4.6, 'power2.inOut')
      fade(tl, '.c4-orbit', 1, 2.4, 1.6)
      hand.to(tl, { view: { yaw: 8 } }, 0, 4.6, 'sine.inOut')
      hand.to(tl, { view: { yaw: -12 }, pose: GRASPS.open }, 4.8, 3.6, 'sine.inOut')
      cam.to(tl, { x: 800, y: 470, zoom: 0.94 }, 4.8, 4, 'sine.inOut')

      const light = (id: string, at: number) => {
        fade(tl, `.fm-ring-${id}`, 1, at, 0.6, 0.22)
        fade(tl, `.fm-lab-${id}`, 1, at + 0.1, 0.6, 0)
        fade(tl, `.c4-glow-${id}`, 1, at, 0.4)
        tl.fromTo(`.c4-glow-${id}`, { strokeWidth: 14 }, { strokeWidth: 4, duration: 1.2, ease: 'power2.out', immediateRender: false }, at)
      }

      /* b1: shape. Joints and their axes. */
      const b1 = 9
      tl.addLabel('b1', b1)
      light('shape', b1 + 0.1)
      fade(tl, '.c4-axes', 1, b1 + 0.6, 0.6)
      hand.to(tl, { pose: GRASPS.spread }, b1 + 0.4, 1.4)
      hand.to(tl, { pose: GRASPS.relaxed }, b1 + 2.2, 2)
      cam.to(tl, { x: 760, y: 450, zoom: 1.0 }, b1, 4.5, 'sine.inOut')

      /* b2: muscle. Motors in the forearm. */
      const b2 = b1 + 4.5
      tl.addLabel('b2', b2)
      fade(tl, '.c4-axes', 0.25, b2, 0.6, 1)
      light('muscle', b2 + 0.1)
      hand.to(tl, { xray: 0.28 }, b2 + 0.2, 0.8)
      fade(tl, '.c4-motors', 1, b2 + 0.5, 0.6)
      tl.fromTo('.c4-motors', { scale: 0.96 }, { scale: 1.04, duration: 0.25, yoyo: true, repeat: 5, transformOrigin: '50% 50%', immediateRender: false }, b2 + 1.2)
      cam.to(tl, { x: 820, y: 520, zoom: 1.04 }, b2, 5, 'sine.inOut')

      /* b3: tendons. Cables from motor to joint; they tighten as the fingers close. */
      const b3 = b2 + 5
      tl.addLabel('b3', b3)
      fade(tl, '.c4-motors', 0.4, b3 + 1.2, 0.6, 1)
      light('tendons', b3 + 0.1)
      fade(tl, '.c4-cables', 1, b3 + 0.4, 0.8)
      hand.to(tl, { pose: GRASPS.power, pull: { thumb: 1, index: 1, middle: 1, ring: 1, little: 1 } }, b3 + 1.2, 1.6)
      hand.to(tl, { pose: GRASPS.relaxed, pull: { thumb: 0, index: 0, middle: 0, ring: 0, little: 0 } }, b3 + 3.4, 1.6)
      cam.to(tl, { x: 840, y: 470, zoom: 1.0 }, b3, 5.5, 'sine.inOut')

      /* b4: touch. Fingertip pads light. */
      const b4 = b3 + 5.5
      tl.addLabel('b4', b4)
      fade(tl, '.c4-cables', 0.35, b4, 0.6, 1)
      light('touch', b4 + 0.1)
      hand.to(tl, { pose: GRASPS.tripod, touch: { thumb: 1, index: 1, middle: 1 } }, b4 + 0.3, 1.2)
      hand.to(tl, { touch: { thumb: 0.5, index: 0.6, middle: 0.5, ring: 0.3, little: 0.3 }, pose: GRASPS.relaxed }, b4 + 2.6, 1.4)
      cam.to(tl, { x: 800, y: 420, zoom: 1.06 }, b4, 4.5, 'sine.inOut')

      /* b5: brain. A lime network grows out of the wrist to a far controller. */
      const b5 = b4 + 4.5
      tl.addLabel('b5', b5)
      light('brain', b5 + 0.1)
      cam.to(tl, { x: 960, y: 380, zoom: 0.96 }, b5, 3, 'power2.inOut')
      tl.fromTo('.c4-net', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 2.4, stagger: 0.18, ease: 'power1.inOut', immediateRender: false }, b5 + 0.5)
      fade(tl, '.c4-brain', 1, b5 + 2.4, 0.8)
      tl.fromTo('.c4-spark', { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.4, immediateRender: false }, b5 + 3)
      cam.to(tl, { x: 900, y: 420, zoom: 0.92 }, b5 + 3, 4, 'sine.inOut')

      /* b6: the wall slams shut around everything. */
      const b6 = b5 + 7
      tl.addLabel('b6', b6)
      cam.to(tl, { x: 800, y: 470, zoom: 0.6 }, b6, 2.2, 'power2.inOut')
      tl.fromTo('.fm-ring-wall', { opacity: 0, scale: 1.5 }, { opacity: 1, scale: 1, duration: 1.3, ease: 'power4.in', svgOrigin: '0 0', immediateRender: false }, b6 + 1.4)
      cam.shake(tl, b6 + 2.7, 1.6, 0.6)
      fade(tl, '.c4-clank', 0.5, b6 + 2.7, 0.06)
      fade(tl, '.c4-clank', 0, b6 + 2.8, 0.7, 0.5)
      tl.fromTo('.c4-wallicon', { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.5, stagger: 0.35, ease: 'back.out(2)', transformOrigin: '50% 50%', immediateRender: false }, b6 + 3.3)
      cam.to(tl, { x: 800, y: 470, zoom: 0.63 }, b6 + 3, 5, 'sine.inOut')

      /* b7: the triangle. The dot slides to each edge; the corner it leaves dims. */
      const b7 = b6 + 8
      tl.addLabel('b7', b7)
      fade(tl, '.c4-mapall', 0.18, b7, 1, 1)
      fade(tl, '.c4-tri', 1, b7 + 0.3, 0.6)
      tl.fromTo('.c4-tri-edge', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut', immediateRender: false }, b7 + 0.4)
      tl.fromTo('.c4-corner', { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: 0.4, immediateRender: false }, b7 + 1.2)
      const dot = { u: 1 / 3, v: 1 / 3 }
      const dotEl = q('.c4-dot')
      const corners = ['d', 'r', 'c'].map((k) => q(`.c4-corner-${k}`))
      const draw = () => {
        const w = 1 - dot.u - dot.v
        const x = TRI.d.x * dot.u + TRI.r.x * dot.v + TRI.c.x * w
        const y = TRI.d.y * dot.u + TRI.r.y * dot.v + TRI.c.y * w
        dotEl?.setAttribute('transform', `translate(${x} ${y})`)
        ;[dot.u, dot.v, w].forEach((k, i) => {
          const el = corners[i] as SVGGElement | null
          if (el) el.style.filter = k < 0.12 ? 'grayscale(1) brightness(0.45)' : ''
        })
      }
      draw()
      const go = (u: number, v: number, at: number) => tl.to(dot, { u, v, duration: 1.1, ease: 'power2.inOut', onUpdate: draw }, at)
      tl.fromTo(dot, { u: 1 / 3, v: 1 / 3 }, { u: 1 / 3, v: 1 / 3, duration: 0.01, onUpdate: draw, immediateRender: false }, b7)
      fade(tl, '.c4-dot', 1, b7 + 2.4, 0.4)
      go(0.5, 0.02, b7 + 3.6)
      fade(tl, '.c4-pair-0', 1, b7 + 4.5, 0.4)
      fade(tl, '.c4-pair-0', 0, b7 + 6.6, 0.3, 1)
      go(0.02, 0.5, b7 + 6.8)
      fade(tl, '.c4-pair-1', 1, b7 + 7.7, 0.4)
      fade(tl, '.c4-pair-1', 0, b7 + 9.6, 0.3, 1)
      go(0.5, 0.5, b7 + 9.8)
      fade(tl, '.c4-pair-2', 1, b7 + 10.7, 0.4)
      tl.to({}, { duration: 0.1 }, b7 + 14)

      /* b8: the play. The triangle shrinks out of the way; the cards come in (React). */
      const b8 = b7 + 14.2
      tl.addLabel('b8', b8)
      fade(tl, '.c4-pair-2', 0, b8, 0.3, 1)
      fade(tl, '.c4-tri', 0, b8, 0.6, 1)
      fade(tl, '.c4-mapall', 0.1, b8, 0.6, 0.18)
      fade(tl, '.c4-playwrap', 1, b8 + 0.3, 0.8)
      tl.to({}, { duration: 2 }, b8 + 1)

      /* b9: the map tilts back into a floor; the knowledge tree grows from the hand. */
      const b9 = b8 + 3.2
      tl.addLabel('b9', b9)
      fade(tl, '.c4-playwrap', 0, b9, 0.6, 1)
      fade(tl, '.c4-mapall', 1, b9 + 0.2, 1, 0.1)
      cam.to(tl, { x: 860, y: 330, zoom: 0.78 }, b9, 3.4, 'power2.inOut')
      tl.fromTo('.c4-map', { scaleY: 1, y: 0 }, { scaleY: 0.26, y: 330, duration: 2.6, ease: 'power2.inOut', svgOrigin: `${CX} ${CY}`, immediateRender: false }, b9 + 0.6)
      fade(tl, '.c4-handwrap', 0, b9 + 1.0, 1.2, 1)
      fade(tl, '.c4-brainwrap', 0, b9 + 0.4, 1, 1)
      fade(tl, '.c4-node-0', 1, b9 + 1.6, 0.6)
      tl.fromTo('.c4-trunk', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 3.2, ease: 'power1.inOut', immediateRender: false }, b9 + 1.8)
      tl.fromTo('.c4-node', { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.5, stagger: 0.55, ease: 'back.out(2)', transformOrigin: '50% 50%', immediateRender: false }, b9 + 2.4)
      fade(tl, '.c4-branch-dim', 1, b9 + 6, 1)
      cam.to(tl, { x: 900, y: 160, zoom: 0.76 }, b9 + 3.4, 7, 'sine.inOut')

      /* b10: the lime branch lights to the data problem; the camera rises up the trunk. */
      const b10 = b9 + 10.8
      tl.addLabel('b10', b10)
      tl.fromTo('.c4-branch', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 2.6, ease: 'power2.inOut', immediateRender: false }, b10 + 0.2)
      fade(tl, '.c4-datanode', 1, b10 + 2.4, 0.6)
      tl.fromTo('.c4-datanode', { scale: 0.4 }, { scale: 1, duration: 0.8, ease: 'back.out(2)', transformOrigin: '50% 50%', immediateRender: false }, b10 + 2.4)
      cam.to(tl, { x: 960, y: -330, zoom: 0.8 }, b10, 8.4, 'sine.inOut')
    },
    [hand],
  )
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    // each ring has a bead that keeps orbiting, so the map never stands still
    RINGS.forEach((r, i) => {
      const p = { a: i * 1.3 }
      const el = root.current?.querySelector(`.c4-bead-${i}`)
      const t = (r.tilt * Math.PI) / 180
      gsap.to(p, {
        a: p.a + Math.PI * 2,
        duration: 9 + i * 3,
        repeat: -1,
        ease: 'none',
        onUpdate: () => {
          const x = Math.cos(p.a) * r.rx
          const y = Math.sin(p.a) * r.ry
          el?.setAttribute('transform', `translate(${CX + x * Math.cos(t) - y * Math.sin(t)} ${CY + x * Math.sin(t) + y * Math.cos(t)})`)
        },
      })
    })
    gsap.to('.c4-pulse', { opacity: 0.35, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.fromTo('.c4-flow', { strokeDashoffset: 0 }, { strokeDashoffset: -40, duration: 1.6, repeat: -1, ease: 'none' })
  })

  /* ---------------- the play ---------------- */
  const PLAY = 8
  const active = cueIndex === PLAY
  const [docked, setDocked] = useState<Partial<Record<CustId, HandId>>>({})
  const [drag, setDrag] = useState<{ id: HandId; x: number; y: number } | null>(null)
  const [wrong, setWrong] = useState<{ cust: CustId; text: string; n: number } | null>(null)
  const [won, setWon] = useState(false)
  const wonRef = useRef(false)
  const grab = useRef({ dx: 0, dy: 0 })

  useEffect(() => {
    if (!active) return
    setDocked({})
    setWrong(null)
    setWon(false)
    wonRef.current = false
  }, [active])

  const isDocked = (id: HandId) => Object.values(docked).includes(id)
  const drop = (id: HandId, x: number, y: number) => {
    setDrag(null)
    let best: CustId | null = null
    let bd = 330
    CUSTOMERS.forEach((c, i) => {
      const d = Math.hypot(x - COLX[i], (y - (CUST_Y + SLOT_Y) / 2) * 0.8)
      if (d < bd && !docked[c.id]) {
        bd = d
        best = c.id
      }
    })
    if (!best) return
    const cust = CUSTOMERS.find((c) => c.id === best)!
    if (cust.match === id) {
      const next = { ...docked, [cust.id]: id }
      setDocked(next)
      setWrong(null)
      emit({ type: 'attempt', correct: true, detail: `matched the ${CARDS.find((k) => k.id === id)?.name} to the ${cust.id}` })
      if (Object.keys(next).length === 3 && !wonRef.current) {
        wonRef.current = true
        setWon(true)
        void say('Each hand picked two corners of the triangle. None of them got all three.').then(() => onPlayDone())
      }
    } else {
      const text = WRONG[id][cust.id] ?? ''
      setWrong({ cust: cust.id, text, n: Date.now() })
      emit({ type: 'attempt', correct: false, detail: `tried the ${CARDS.find((k) => k.id === id)?.name} for the ${cust.id}: ${text}` })
    }
  }
  useEffect(() => {
    if (!wrong) return
    const t = window.setTimeout(() => setWrong(null), 3200)
    return () => window.clearTimeout(t)
  }, [wrong])

  const cardDrag = (id: HandId) =>
    dragIn(() => stage.current, {
      start: (p) => {
        if (!active || isDocked(id) || wonRef.current) return
        const x0 = COLX[START[id]]
        grab.current = { dx: x0 - p.x, dy: CARD_Y - p.y }
        setDrag({ id, x: x0, y: CARD_Y })
      },
      move: (p) => setDrag((d) => (d && d.id === id ? { id, x: p.x + grab.current.dx, y: p.y + grab.current.dy } : d)),
      end: (p) => {
        if (!active || isDocked(id) || wonRef.current) return setDrag(null)
        drop(id, p.x + grab.current.dx, p.y + grab.current.dy)
      },
    })

  useEffect(() => {
    if (cueIndex === PLAY) {
      const m = (Object.keys(docked) as CustId[]).map((c) => `${CARDS.find((k) => k.id === docked[c])?.name} → ${c}`)
      reportState(
        'Three hand cards sit along the bottom: "Research hand" (20 motors, tendons, rich touch, 4.3 kg with forearm, over $100,000), "Workhorse" (6 motors drive 12 joints through linkages, self-locking, 540 g, about $5,000) and "Gripper" (1 motor, two fingers, almost unbreakable, about $1,000). ' +
          'Along the top are three customers with an empty slot under each: a lab teaching a hand to spin a Rubik’s cube; a humanoid maker who needs thousands of hands that can grasp most household objects; a warehouse picking 10,000 boxes a day. The learner drags each card into a customer’s slot. ' +
          `Matched so far: ${m.length ? m.join(', ') : 'none'}. ${wrong ? `Last try was wrong: ${wrong.text}.` : ''} ${won ? 'All three matched: done.' : ''} ` +
          'Correct: Research hand → the Rubik’s cube lab (needs independent fingers, can afford it; gives up cost); Workhorse → the humanoid maker (cheap and tough enough to make thousands, grasps most objects; gives up some dexterity); Gripper → the warehouse (one simple grip, cheapest and toughest; gives up dexterity). ' +
          'Likely mix-ups: giving the humanoid maker the research hand because it is the most capable (it costs more than the robot), or giving the warehouse the workhorse (works, but a gripper is cheaper and tougher for boxes).',
      )
      setHints(HINTS)
    } else {
      reportState(STATE[cueIndex] ?? '')
      setHints([])
    }
  }, [cueIndex, docked, wrong, won, reportState, setHints])

  /* ---------------- picture ---------------- */
  const wallIcons = [
    { a: 205, kind: 'mould', text: 'tooling' },
    { a: 335, kind: 'cost', text: 'cost' },
    { a: 90, kind: 'cycles', text: 'cycles' },
  ]
  const ringPt = (a: number, r = 620) => ({ x: CX + Math.cos((a * Math.PI) / 180) * r, y: CY + Math.sin((a * Math.PI) / 180) * r })

  return (
    <g ref={root}>
      <g ref={world}>
        <g data-depth="0.35">
          <rect x={-1500} y={-1500} width={4600} height={4000} fill={C.ink} />
          <g className="c4-blue" opacity={0}>
            <Blueprint />
            <g transform="translate(0 -900)">
              <Blueprint opacity={0.8} />
            </g>
          </g>
          <Dust x={-600} y={-900} w={2800} h={2200} count={50} seed={44} color={C.rim} size={0.8} />
        </g>
        <g data-depth="1">
          <g className="c4-mapall">
            <g className="c4-map">
              <Pool x={CX} y={CY} r={560} color="rim" opacity={0.25} />
              {/* soft glows behind each ring, lit one by one */}
              {RINGS.map((r) => (
                <ellipse key={r.id} className={`c4-glow-${r.id}`} cx={CX} cy={CY} rx={r.rx} ry={r.ry} transform={`rotate(${r.tilt} ${CX} ${CY})`} fill="none" stroke={r.color} strokeWidth={4} opacity={0} filter="url(#cn-bloom)" />
              ))}
              <FiveMap cx={CX} cy={CY} />
              <g className="c4-orbit" opacity={0}>
                {RINGS.map((r, i) => (
                  <g key={r.id} className={`c4-bead-${i}`} transform={`translate(${CX + r.rx} ${CY})`}>
                    <circle r={12} fill={r.color} opacity={0.25} filter="url(#cn-bloom)" />
                    <circle r={4.5} fill={r.color} />
                  </g>
                ))}
              </g>
              <rect className="c4-clank" x={-800} y={-800} width={3200} height={2600} fill={C.gold} opacity={0} pointerEvents="none" />
              {wallIcons.map((w) => {
                const p = ringPt(w.a)
                return (
                  <g key={w.kind} className="c4-wallicon" opacity={0} transform={`translate(${p.x} ${p.y})`}>
                    <circle r={44} fill={C.ink1} stroke={C.gold} strokeWidth={3} />
                    {w.kind === 'mould' && (
                      <g fill="none" stroke={C.gold} strokeWidth={3}>
                        <path d="M-24 -20 h48 v14 h-18 v-6 h-12 v6 h-18 Z" />
                        <path d="M-24 20 h48 v-14 h-18 v6 h-12 v-6 h-18 Z" />
                      </g>
                    )}
                    {w.kind === 'cost' && (
                      <text y={14} textAnchor="middle" fill={C.gold} fontFamily={SERIF} fontSize={44} fontWeight={600}>
                        $
                      </text>
                    )}
                    {w.kind === 'cycles' && (
                      <g fill="none" stroke={C.gold} strokeWidth={3}>
                        <circle cy={4} r={20} />
                        <path d="M0 4 L0 -8 M0 4 L10 10 M-6 -22 h12" strokeLinecap="round" />
                      </g>
                    )}
                    <text y={76} textAnchor="middle" fill={C.gold} fontFamily={SANS} fontSize={30} fontWeight={600} stroke={C.ink} strokeWidth={6} strokeOpacity={0.6} style={{ paintOrder: 'stroke' }}>
                      {w.text}
                    </text>
                  </g>
                )
              })}
            </g>

            {/* the brain: a lime network from the wrist to a far controller */}
            <g className="c4-brainwrap">
              {[
                `M${HX} ${HY + 10} C ${HX + 120} ${HY + 40}, ${HX + 230} ${HY - 120}, ${HX + 330} ${HY - 220} S ${DATA.x - 200} ${DATA.y + 120}, ${DATA.x - 70} ${DATA.y + 20}`,
                `M${HX + 230} ${HY - 120} C ${HX + 330} ${HY - 90}, ${HX + 420} ${HY - 160}, ${DATA.x - 60} ${DATA.y + 70}`,
                `M${HX + 330} ${HY - 220} C ${HX + 330} ${HY - 330}, ${HX + 430} ${HY - 420}, ${DATA.x - 50} ${DATA.y - 30}`,
                `M${HX + 60} ${HY + 30} C ${HX + 200} ${HY + 90}, ${HX + 380} ${HY - 40}, ${HX + 460} ${HY - 140}`,
                `M${HX + 460} ${HY - 140} L ${HX + 520} ${HY - 120} M${HX + 460} ${HY - 140} L ${HX + 470} ${HY - 220}`,
              ].map((d, i) => (
                <g key={i}>
                  <path className="c4-net" d={d} pathLength={1} fill="none" stroke={C.lime} strokeWidth={i === 0 ? 3.5 : 2} strokeDasharray="1" strokeDashoffset="1" opacity={0.9} />
                  <path className="c4-net c4-net-glow" d={d} pathLength={1} fill="none" stroke={C.lime} strokeWidth={10} strokeDasharray="1" strokeDashoffset="1" opacity={0.18} filter="url(#cn-bloom)" />
                </g>
              ))}
              {[0, 1, 2, 3].map((i) => (
                <circle key={i} className="c4-spark" cx={[HX + 230, HX + 330, HX + 460, DATA.x - 200][i]} cy={[HY - 120, HY - 220, HY - 140, DATA.y + 100][i]} r={7} fill={C.limeLight} opacity={0} filter="url(#cn-bloom)" />
              ))}
              <g className="c4-brain" opacity={0}>
                <circle cx={DATA.x} cy={DATA.y} r={80} fill={C.lime} opacity={0.12} filter="url(#cn-bloom)" />
                <circle className="c4-pulse" cx={DATA.x} cy={DATA.y} r={56} fill="none" stroke={C.lime} strokeWidth={3} />
                {Array.from({ length: 7 }, (_, i) => {
                  const a = (i / 7) * Math.PI * 2
                  return <line key={i} x1={DATA.x} y1={DATA.y} x2={DATA.x + Math.cos(a) * 40} y2={DATA.y + Math.sin(a) * 40} stroke={C.lime} strokeWidth={2} opacity={0.7} />
                })}
                <circle cx={DATA.x} cy={DATA.y} r={14} fill={C.limeLight} />
                <text x={DATA.x} y={DATA.y - 76} fill={C.lime} fontFamily={SANS} fontSize={28} fontWeight={600} textAnchor="middle">
                  controller
                </text>
              </g>
            </g>

            {/* the hand at the centre of it all */}
            <g className="c4-handwrap">
              <Pool x={HX} y={HY - 140} r={260} color="key" opacity={0.55} />
              <Hand3D store={hand} x={HX} y={HY} look="robot" arm={ARM} light={[-0.6, -0.8]} tutor="robot hand" />
              <HandOverlay store={hand} x={HX} y={HY} arm={ARM} cls="c4" show={{ axes: true, motors: true, cables: true }} />
            </g>
          </g>

          {/* the knowledge tree */}
          <g className="c4-tree">
            <path className="c4-trunk" d={`M${CX} ${TRUNK[0].y} L${CX} ${TRUNK[TRUNK.length - 1].y}`} pathLength={1} stroke={C.paper} strokeWidth={6} strokeDasharray="1" strokeDashoffset="1" opacity={0.85} />
            <path className="c4-trunk" d={`M${CX} ${TRUNK[0].y} L${CX} ${TRUNK[TRUNK.length - 1].y}`} pathLength={1} stroke={C.key} strokeWidth={22} strokeDasharray="1" strokeDashoffset="1" opacity={0.25} filter="url(#cn-bloom)" />
            {/* the data branch: dim first, then lit */}
            {(() => {
              const d = `M${CX} ${TRUNK[0].y} C ${CX + 220} ${TRUNK[0].y - 40}, ${DATA.x - 260} ${TRUNK[1].y + 40}, ${DATA.x - 120} ${-120} S ${DATA.x} ${-330}, ${DATA.x + 20} ${-420}`
              return (
                <g>
                  <path className="c4-branch-dim" d={d} fill="none" stroke={C.lime} strokeWidth={4} opacity={0} strokeDasharray="4 10" />
                  <path className="c4-branch" d={d} pathLength={1} fill="none" stroke={C.lime} strokeWidth={6} strokeDasharray="1" strokeDashoffset="1" />
                  <path className="c4-branch" d={d} pathLength={1} fill="none" stroke={C.lime} strokeWidth={20} strokeDasharray="1" strokeDashoffset="1" opacity={0.3} filter="url(#cn-bloom)" />
                </g>
              )
            })()}
            <g className="c4-datanode" opacity={0}>
              <circle cx={DATA.x + 20} cy={-420} r={60} fill={C.lime} opacity={0.2} filter="url(#cn-bloom)" />
              <circle className="c4-pulse" cx={DATA.x + 20} cy={-420} r={30} fill={C.ink1} stroke={C.lime} strokeWidth={5} />
              <circle cx={DATA.x + 20} cy={-420} r={11} fill={C.lime} />
              <text x={DATA.x + 20} y={-490} fill={C.lime} fontFamily={SERIF} fontSize={58} fontWeight={600} textAnchor="middle">
                The data problem
              </text>
              <text x={DATA.x + 20} y={-340} fill={C.limeLight} opacity={0.8} fontFamily={MONO} fontSize={26} textAnchor="middle">
                where a robot’s brain gets its data
              </text>
            </g>
            {TRUNK.map((n, i) => (
              <g key={n.name} className={i === 0 ? 'c4-node-0' : 'c4-node'} opacity={0}>
                <circle cx={CX} cy={n.y} r={i === 0 ? 46 : 34} fill={n.color} opacity={0.2} filter="url(#cn-bloom)" />
                <circle cx={CX} cy={n.y} r={i === 0 ? 24 : 18} fill={C.ink1} stroke={n.color} strokeWidth={5} />
                <circle cx={CX} cy={n.y} r={i === 0 ? 9 : 6} fill={n.color} />
                <text x={CX - 52} y={n.y + 4} fill={n.color} fontFamily={SERIF} fontSize={i === 0 ? 50 : 44} fontWeight={600} textAnchor="end">
                  {n.name}
                </text>
                <text x={CX - 52} y={n.y + 44} fill={n.color} opacity={0.7} fontFamily={MONO} fontSize={26} textAnchor="end">
                  {n.sub}
                </text>
              </g>
            ))}
          </g>
        </g>
      </g>

      {/* ---------- on the stage, not in the world: the triangle and the play ---------- */}
      <g ref={stage}>
        <g className="c4-tri" opacity={0} pointerEvents="none">
          <path className="c4-tri-edge" d={`M${TRI.d.x} ${TRI.d.y} L${TRI.c.x} ${TRI.c.y} L${TRI.r.x} ${TRI.r.y} Z`} pathLength={1} fill={C.ink} fillOpacity={0.55} stroke={C.paper} strokeWidth={3} strokeDasharray="1" strokeDashoffset="1" strokeLinejoin="round" />
          {(
            [
              ['d', 'dexterity', TRI.d.x, TRI.d.y - 34, C.cyan],
              ['r', 'robustness', TRI.r.x - 20, TRI.r.y + 60, C.bone],
              ['c', 'cost', TRI.c.x + 20, TRI.c.y + 60, C.gold],
            ] as const
          ).map(([k, t, x, y, col]) => (
            <g key={k} className={`c4-corner c4-corner-${k}`} opacity={0}>
              <circle cx={k === 'd' ? TRI.d.x : k === 'r' ? TRI.r.x : TRI.c.x} cy={k === 'd' ? TRI.d.y : k === 'r' ? TRI.r.y : TRI.c.y} r={22} fill={col} opacity={0.35} filter="url(#cn-bloom)" />
              <circle cx={k === 'd' ? TRI.d.x : k === 'r' ? TRI.r.x : TRI.c.x} cy={k === 'd' ? TRI.d.y : k === 'r' ? TRI.r.y : TRI.c.y} r={11} fill={col} />
              <text x={x} y={y} fill={col} fontFamily={SERIF} fontSize={46} fontWeight={600} textAnchor="middle">
                {t}
              </text>
            </g>
          ))}
          <g className="c4-dot" opacity={0}>
            <circle r={26} fill={C.paper} opacity={0.25} filter="url(#cn-bloom)" />
            <circle r={12} fill={C.paper} />
          </g>
          {(
            [
              ['dexterous + cheap', 'gives up robustness: fragile', (TRI.d.x + TRI.c.x) / 2 + 60, (TRI.d.y + TRI.c.y) / 2 - 20, 'start'],
              ['robust + cheap', 'gives up dexterity: simple', 800, TRI.r.y + 130, 'middle'],
              ['dexterous + robust', 'gives up cost: very expensive', (TRI.d.x + TRI.r.x) / 2 - 60, (TRI.d.y + TRI.r.y) / 2 - 20, 'end'],
            ] as const
          ).map(([a, b, x, y, anchor], i) => (
            <g key={a} className={`c4-pair-${i}`} opacity={0}>
              <text x={x} y={y} fill={C.paper} fontFamily={SANS} fontSize={30} fontWeight={600} textAnchor={anchor}>
                {a}
              </text>
              <text x={x} y={y + 34} fill={C.mist} fontFamily={MONO} fontSize={20} textAnchor={anchor}>
                {b}
              </text>
            </g>
          ))}
        </g>

        <g className="c4-playwrap" opacity={0}>
          {(cueIndex === PLAY || cueIndex === PLAY + 1) && (
            <g>
              {CUSTOMERS.map((c, i) => {
                const x = COLX[i]
                const dk = docked[c.id]
                const bad = wrong?.cust === c.id
                return (
                  <g key={c.id} data-tutor={`customer-${c.id}`}>
                    <Pool x={x} y={CUST_Y} r={200} color={dk ? 'lime' : 'key'} opacity={dk ? 0.35 : 0.3} />
                    <g transform={`translate(${x - 205} ${CUST_Y - 85})`}>
                      <Profile s={0.27} skin={c.skin} skinDark={c.skinDark} hair={c.hair} light="key-right" half={0.5} />
                    </g>
                    {c.need.map((t, k) => (
                      <text key={k} x={x - 70} y={CUST_Y - 30 + k * 30 - (c.need.length - 2) * 14} fill={C.paper} fontFamily={SANS} fontSize={23} fontWeight={500}>
                        {t}
                      </text>
                    ))}
                    {!dk && (
                      <g>
                        <rect x={x - CW * 0.4} y={SLOT_Y - CH * 0.4} width={CW * 0.8} height={CH * 0.8} rx={18} fill="none" stroke={bad ? C.danger : C.slate} strokeWidth={2.5} strokeDasharray="10 8" />
                        <text x={x} y={SLOT_Y + 8} fill={bad ? C.danger : C.fog} fontFamily={SANS} fontSize={bad ? 21 : 22} textAnchor="middle">
                          {bad ? wrong.text : 'drop a hand here'}
                        </text>
                      </g>
                    )}
                    {dk && (
                      <g>
                        <Card id={dk} x={x} y={SLOT_Y - 10} s={0.8} glow={C.lime} />
                        <text x={x} y={SLOT_Y + 108} fill={C.lime} fontFamily={SANS} fontSize={21} fontWeight={600} textAnchor="middle">
                          {RIGHT[dk][0]}
                        </text>
                        <text x={x} y={SLOT_Y + 134} fill={C.mist} fontFamily={MONO} fontSize={16} textAnchor="middle">
                          {RIGHT[dk][1]}
                        </text>
                      </g>
                    )}
                  </g>
                )
              })}
              {CARDS.map((k) => {
                if (isDocked(k.id)) return null
                const d = drag?.id === k.id ? drag : null
                return (
                  <g key={k.id} className={d ? undefined : 'hd-drift'} style={{ animationDelay: `${-START[k.id] * 2.3}s` }}>
                    <Card id={k.id} x={d ? d.x : COLX[START[k.id]]} y={d ? d.y : CARD_Y} s={d ? 1.04 : 1} glow={d ? C.paper : undefined} dragProps={cardDrag(k.id)} />
                  </g>
                )
              })}
              {won && (
                <text x={800} y={CARD_Y} fill={C.lime} fontFamily={SERIF} fontSize={40} fontWeight={600} textAnchor="middle">
                  two corners each, never three
                </text>
              )}
            </g>
          )}
        </g>
      </g>
      <Vignette />
    </g>
  )
}

export const ch4: Chapter = {
  id: 'framework',
  title: 'Five questions',
  cues: CUES,
  Scene: Ch4Framework,
  enter: { type: 'zoom', x: 820, y: 420 },
  deeper: [FrameworkReading],
}
