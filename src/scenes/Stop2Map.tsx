import gsap from 'gsap'
import { useEffect, useLayoutEffect, useRef, useState, type FC, type ReactNode } from 'react'
import { At, Cloud, Hills, Label, Pebble, Pen, Sheep, Shepherd, Sky, Sun, Tree } from '../art/kit'
import { C, FONT } from '../art/palette'
import { useBeatTimeline } from '../engine/useBeatTimeline'
import { useDrag } from '../engine/svg'
import type { SceneProps, Stop } from '../engine/types'

/*
 * Stop 2: The map of math.
 * The big picture before any detail. Ama's hillside opens out to a busy village whose people
 * keep running into questions. Every question lands on one of four islands, the four big
 * questions of math. Each island gets a tiny real example, then grown-up jobs tie onto the map,
 * and finally the student sorts real-life puzzle cards onto the islands.
 *
 * The four islands keep the same place and colour from beat 2 to the end, so the map becomes
 * familiar: How many? top left (coral), change top right (teal), what comes next bottom left
 * (violet), size and shape bottom right (mustard).
 */

const BEATS = [
  { id: 'more-questions', say: 'Matching pebbles worked. But as people built villages and markets, they kept running into new questions.' },
  { id: 'four-questions', say: 'Almost every question they asked was one of four big ones.' },
  { id: 'how-many', say: "How many? Counting things, like Ama's sheep." },
  { id: 'change', say: 'How do amounts change? Like when you get more apples, or give some away.' },
  { id: 'next', say: 'What comes next? Like day, night, day, night, or the seasons.' },
  { id: 'shape', say: 'How big, and what shape? Like whether a couch will fit through the door.' },
  {
    id: 'everywhere',
    say: 'Bakers, builders, astronauts and game makers use these four questions every day. Every bit of math you will ever learn helps answer one of them.',
  },
  {
    id: 'which-question',
    say: 'Now you try! Each card is a real-life puzzle. Drag it to the big question that helps solve it.',
    challenge: true,
  },
]

/* ---------------------------------------------------------------- the four islands */

type RegionId = 'howMany' | 'change' | 'next' | 'shape'

interface Island {
  id: RegionId
  name: string
  title: string[]
  color: string
  dark: string
  tint: string
  cx: number
  cy: number
  wob: number[]
  where: string
  icon: string
}

const RX = 220
const RY = 190
const SEA = '#BFE4F2'

const ISLANDS: Island[] = [
  {
    id: 'howMany',
    name: 'How many?',
    title: ['How many?'],
    color: C.coral,
    dark: C.coralDark,
    tint: '#FFDED6',
    cx: 290,
    cy: 235,
    wob: [0.02, -0.03, 0.04, 0.0, 0.03, -0.04, 0.02, 0.05, -0.02, 0.03, -0.03, 0.04],
    where: 'top left',
    icon: 'three pebbles',
  },
  {
    id: 'change',
    name: 'How do amounts change?',
    title: ['How do amounts', 'change?'],
    color: C.teal,
    dark: C.tealDark,
    tint: '#CAECE8',
    cx: 1310,
    cy: 235,
    wob: [0.0, 0.04, -0.02, 0.01, -0.03, 0.03, 0.03, -0.03, 0.04, -0.02, 0.02, -0.04],
    where: 'top right',
    icon: 'a basket of apples with a plus sign and a minus sign',
  },
  {
    id: 'next',
    name: 'What comes next?',
    title: ['What comes', 'next?'],
    color: C.violet,
    dark: C.violetDark,
    tint: '#DED8FF',
    cx: 290,
    cy: 665,
    wob: [0.03, -0.02, 0.02, 0.02, -0.04, 0.04, -0.02, 0.03, -0.03, 0.04, 0.0, -0.03],
    where: 'bottom left',
    icon: 'the sun and moon taking turns',
  },
  {
    id: 'shape',
    name: 'How big, and what shape?',
    title: ['How big, and', 'what shape?'],
    color: C.mustard,
    dark: C.mustardDark,
    tint: '#FCECCC',
    cx: 1310,
    cy: 665,
    wob: [-0.02, 0.03, -0.03, 0.01, 0.04, -0.02, 0.03, -0.04, 0.02, 0.03, -0.03, 0.02],
    where: 'bottom right',
    icon: 'a ruler and a triangle',
  },
]

const ISL = Object.fromEntries(ISLANDS.map((i) => [i.id, i])) as Record<RegionId, Island>

/** A smooth, slightly wobbly island outline through points around an ellipse. */
function blobPath(isl: Island, grow = 0) {
  const n = isl.wob.length
  const pts = isl.wob.map((w, i) => {
    const a = (i / n) * Math.PI * 2
    return [isl.cx + (RX * (1 + w) + grow) * Math.cos(a), isl.cy + (RY * (1 + w) + grow) * Math.sin(a)]
  })
  const f = (p: number[]) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`
  let d = `M ${f(pts[0])}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C ${f(c1)} ${f(c2)} ${f(p2)}`
  }
  return `${d} Z`
}

/** Which island (if any) a stage point is over. A little generous at the edges. */
function regionAt(p: { x: number; y: number }): RegionId | null {
  for (const isl of ISLANDS) {
    const dx = (p.x - isl.cx) / (RX + 30)
    const dy = (p.y - isl.cy) / (RY + 30)
    if (dx * dx + dy * dy <= 1) return isl.id
  }
  return null
}

/** Where placed cards sit on an island: one in the middle, two side by side. */
function chipSpot(isl: Island, k: number, count: number) {
  const x = count === 1 ? isl.cx : isl.cx + (k === 0 ? -72 : 72)
  return { x, y: isl.cy + 116 }
}

const PANEL = { x: 560, y: 130, w: 480, h: 640 }

/* ---------------------------------------------------------------- village layout */

/** The camera starts close on Ama's hillside and pulls back to show the whole village. */
const WORLD_START = { x: -24, y: -1032, scale: 2.4 }
const WORLD_END = { x: -40, y: -110, scale: 1.14 }
/** Where each "?" bubble's tail points, in island order: baker, fruit seller, farmer, builder. */
const QB_WORLD = [
  { x: 930, y: 560 },
  { x: 1140, y: 560 },
  { x: 760, y: 526 },
  { x: 1290, y: 646 },
]
const QB = QB_WORLD.map((p) => ({ x: WORLD_END.x + WORLD_END.scale * p.x, y: WORLD_END.y + WORLD_END.scale * p.y }))

/* ---------------------------------------------------------------- mini scenes */

const APPLE_START = [
  { x: 630, y: 290 },
  { x: 690, y: 290 },
  { x: 660, y: 242 },
  { x: 910, y: 290 },
  { x: 970, y: 290 },
]
const BASKET = { x: 800, y: 620 }
const APPLE_SLOT = [
  { x: 752, y: 488 },
  { x: 800, y: 484 },
  { x: 848, y: 488 },
  { x: 776, y: 462 },
  { x: 824, y: 462 },
]
const FRIEND = { x: 972, y: 740 }
const FRIEND_HAND = { x: 947, y: 694 }

/* ---------------------------------------------------------------- jobs on the map */

const ROLES: { name: string; kind: 'baker' | 'builder' | 'astronaut' | 'gamer'; target: RegionId; x: number; y: number; uses: string }[] = [
  { name: 'Baker', kind: 'baker', target: 'howMany', x: 680, y: 205, uses: 'counts loaves and cookies' },
  { name: 'Builder', kind: 'builder', target: 'shape', x: 920, y: 630, uses: 'measures walls and doors' },
  { name: 'Astronaut', kind: 'astronaut', target: 'next', x: 680, y: 630, uses: 'knows where the planets go next' },
  { name: 'Game maker', kind: 'gamer', target: 'change', x: 920, y: 205, uses: 'makes points go up and down' },
]

/* ================================================================ scene */

function Scene(props: SceneProps) {
  const { beatIndex, playing, onAnimDone } = props
  const root = useRef<SVGGElement>(null)

  useBeatTimeline(
    root,
    (tl) => {
      const highlight = (id: RegionId | null, at: string) => {
        ISLANDS.forEach((isl) => {
          const on = isl.id === id
          tl.to(`.isl-${isl.id}`, { opacity: on || id === null ? 1 : 0.35, scale: on ? 1.03 : 1, duration: 0.5 }, at)
          tl.to(`.glow-${isl.id}`, { opacity: on ? 1 : 0, duration: 0.5 }, at)
        })
      }

      // Starting state.
      tl.set('.world', { ...WORLD_START, svgOrigin: '0 0' }, 0)
      tl.set('.village', { opacity: 1 }, 0)
      tl.set(['.mapboard', '.ribbon', '.compass'], { opacity: 0 }, 0)
      ISLANDS.forEach((isl) => {
        tl.set(`.isl-${isl.id}`, { scale: 0, opacity: 1, svgOrigin: `${isl.cx} ${isl.cy}` }, 0)
        tl.set(`.glow-${isl.id}`, { opacity: 0 }, 0)
        tl.set(`.pn-${isl.id}`, { opacity: 0, y: 24 }, 0)
      })
      QB.forEach((q, i) => tl.set(`.qb-${i}`, { x: q.x, y: q.y, scale: 0, opacity: 1, transformOrigin: '50% 100%' }, 0))
      for (let i = 0; i < 3; i++) {
        tl.set([`.hm-s-${i}`, `.hm-l-${i}`], { opacity: 0 }, 0)
        tl.set(`.hm-p-${i}`, { opacity: 0, scale: 0.3, transformOrigin: '50% 50%' }, 0)
      }
      APPLE_START.forEach((p, i) => tl.set(`.ap-${i}`, { x: p.x, y: p.y, opacity: 0 }, 0))
      tl.set(['.ch-plus', '.ch-minus'], { opacity: 0, scale: 0.4, transformOrigin: '50% 50%' }, 0)
      for (let i = 0; i < 5; i++) tl.set([`.nx-a-${i}`, `.nx-b-${i}`], { opacity: 0, scale: 0.6, transformOrigin: '50% 50%' }, 0)
      tl.set(['.sh-m1', '.sh-m2'], { scaleX: 0, transformOrigin: '0% 50%' }, 0)
      tl.set('.sh-q', { opacity: 0, scale: 0.3, transformOrigin: '50% 50%' }, 0)
      tl.set('.roles', { opacity: 1 }, 0)
      ROLES.forEach((r, i) => {
        tl.set(`.role-${i}`, { opacity: 0, scale: 0.4, svgOrigin: `${r.x} ${r.y}` }, 0)
        tl.set(`.rline-${i}`, { opacity: 0 }, 0)
      })

      // b0: Ama's hillside opens out to the village, and questions pop up.
      tl.addLabel('b0', 0.01)
      tl.to('.world', { ...WORLD_END, duration: 3.4, ease: 'power2.inOut' }, 'b0+=0.8')
      QB.forEach((_, i) => tl.to(`.qb-${i}`, { scale: 1, duration: 0.5, ease: 'back.out(2.2)' }, `b0+=${4.3 + i * 0.55}`))

      // b1: each question flies to one of four islands on the map.
      tl.addLabel('b1', '+=0.5')
      ISLANDS.forEach((isl, i) => tl.to(`.qb-${i}`, { x: isl.cx, y: isl.cy + 20, duration: 1.1, ease: 'power2.inOut' }, 'b1'))
      tl.to('.village', { opacity: 0, duration: 0.8 }, 'b1+=0.3')
      tl.to('.mapboard', { opacity: 1, duration: 0.8 }, 'b1+=0.3')
      ISLANDS.forEach((isl, i) => {
        const at = `b1+=${1.2 + i * 0.6}`
        tl.to(`.qb-${i}`, { scale: 0, opacity: 0, duration: 0.3 }, at)
        tl.to(`.isl-${isl.id}`, { scale: 1, duration: 0.6, ease: 'back.out(1.6)' }, at)
      })
      tl.to(['.ribbon', '.compass'], { opacity: 1, duration: 0.5 }, 'b1+=3.6')

      // b2: How many? Sheep matched to pebbles.
      tl.addLabel('b2', '+=0.4')
      highlight('howMany', 'b2')
      tl.to('.pn-howMany', { opacity: 1, y: 0, duration: 0.5 }, 'b2+=0.3')
      for (let i = 0; i < 3; i++) tl.to(`.hm-s-${i}`, { opacity: 1, duration: 0.3 }, `b2+=${0.7 + i * 0.3}`)
      for (let i = 0; i < 3; i++) {
        tl.to(`.hm-l-${i}`, { opacity: 1, duration: 0.3 }, `b2+=${1.9 + i * 0.6}`)
        tl.to(`.hm-p-${i}`, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' }, '<0.15')
      }

      // b3: How do amounts change? 3 apples and 2 apples join, then 1 is given away.
      tl.addLabel('b3', '+=0.5')
      tl.to('.pn-howMany', { opacity: 0, duration: 0.4 }, 'b3')
      highlight('change', 'b3')
      tl.to('.pn-change', { opacity: 1, y: 0, duration: 0.5 }, 'b3+=0.3')
      for (let i = 0; i < 3; i++) tl.to(`.ap-${i}`, { opacity: 1, duration: 0.3 }, `b3+=${0.7 + i * 0.15}`)
      tl.to('.ch-plus', { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' }, 'b3+=1.4')
      for (let i = 3; i < 5; i++) tl.to(`.ap-${i}`, { opacity: 1, duration: 0.3 }, `b3+=${1.6 + (i - 3) * 0.15}`)
      APPLE_SLOT.forEach((s, i) => tl.to(`.ap-${i}`, { x: s.x, y: s.y, duration: 0.7, ease: 'power2.inOut' }, `b3+=${2.4 + i * 0.12}`))
      tl.to('.ch-plus', { opacity: 0, duration: 0.3 }, 'b3+=2.6')
      tl.to('.ap-4', { x: 912, y: 400, duration: 0.45, ease: 'power2.out' }, 'b3+=4.0')
      tl.to('.ap-4', { x: FRIEND_HAND.x, y: FRIEND_HAND.y, duration: 0.5, ease: 'power2.in' }, '>')
      tl.to('.ch-minus', { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' }, 'b3+=4.0')

      // b4: What comes next? Day, night, day, night, ?, then the seasons.
      tl.addLabel('b4', '+=0.5')
      tl.to('.pn-change', { opacity: 0, duration: 0.4 }, 'b4')
      highlight('next', 'b4')
      tl.to('.pn-next', { opacity: 1, y: 0, duration: 0.5 }, 'b4+=0.3')
      for (let i = 0; i < 5; i++) tl.to(`.nx-a-${i}`, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' }, `b4+=${1.3 + i * 0.42}`)
      for (let i = 0; i < 5; i++) tl.to(`.nx-b-${i}`, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' }, `b4+=${3.6 + i * 0.32}`)

      // b5: How big, and what shape? A couch, a door, and two measuring lines.
      tl.addLabel('b5', '+=0.5')
      tl.to('.pn-next', { opacity: 0, duration: 0.4 }, 'b5')
      highlight('shape', 'b5')
      tl.to('.pn-shape', { opacity: 1, y: 0, duration: 0.5 }, 'b5+=0.3')
      tl.to('.sh-m1', { scaleX: 1, duration: 0.8, ease: 'power1.inOut' }, 'b5+=2.6')
      tl.to('.sh-m2', { scaleX: 1, duration: 0.6, ease: 'power1.inOut' }, 'b5+=3.6')
      tl.to('.sh-q', { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, 'b5+=4.4')

      // b6: jobs that use each question tie onto the map.
      tl.addLabel('b6', '+=0.5')
      tl.to('.pn-shape', { opacity: 0, duration: 0.4 }, 'b6')
      highlight(null, 'b6')
      ROLES.forEach((_, i) => {
        tl.to(`.role-${i}`, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, `b6+=${0.4 + i * 0.55}`)
        tl.to(`.rline-${i}`, { opacity: 1, duration: 0.4 }, '>-0.1')
      })
      ISLANDS.forEach((isl, i) => tl.to(`.isl-${isl.id}`, { scale: 1.06, duration: 0.35, yoyo: true, repeat: 1 }, `b6+=${5 + i * 0.45}`))

      // b7: the sorting game. Jobs step aside so the cards have room.
      tl.addLabel('b7', '+=0.6')
      tl.to(['.roles', '.ribbon'], { opacity: 0, duration: 0.5 }, 'b7')
      tl.addLabel('end', '+=0.3')
    },
    beatIndex,
    playing,
    onAnimDone,
  )

  const id = BEATS[beatIndex]?.id

  return (
    <g ref={root}>
      <g className="village">
        <Sky />
        <At x={1380} y={150}><Sun r={60} /></At>
        <At x={420} y={130}><Cloud s={0.8} /></At>
        <At x={980} y={95}><Cloud s={0.6} opacity={0.85} /></At>
        <g className="world">
          <Village active={id === 'more-questions'} />
        </g>
      </g>

      <g className="mapboard">
        <MapBackground />
        <g className="compass"><At x={800} y={450}><Compass /></At></g>
        {ISLANDS.map((isl) => (
          <g key={isl.id} className={`isl-${isl.id}`} data-tutor={beatIndex >= 1 ? `${isl.name} island` : undefined}>
            <path className={`glow-${isl.id}`} d={blobPath(isl, 17)} fill="none" stroke={isl.color} strokeWidth={14} opacity={0.45} />
            <IslandArt isl={isl} />
          </g>
        ))}
        <g className="ribbon">
          <rect x={560} y={34} width={480} height={76} rx={38} fill={C.ink} opacity={0.15} transform="translate(0 6)" />
          <rect x={560} y={34} width={480} height={76} rx={38} fill={C.white} />
          <At x={800} y={74}><Label text="The map of math" size={46} /></At>
        </g>
        <HowManyPanel active={id === 'how-many'} />
        <ChangePanel active={id === 'change'} />
        <NextPanel active={id === 'next'} />
        <ShapePanel active={id === 'shape'} />
        <Roles active={id === 'everywhere'} />
      </g>

      {/* The villagers' questions, which fly to their islands. Above the map so they stay visible. */}
      {QB.map((_, i) => (
        <g key={i} className={`qb-${i}`}>
          <QBubble color={ISLANDS[i].color} />
        </g>
      ))}

      {id === 'which-question' && <WhichQuestion {...props} />}
    </g>
  )
}

/* ================================================================ village art */

/** The village, drawn at final-view size. Names are only offered to Pip while it is on screen. */
function Village({ active }: { active: boolean }) {
  const t = (name: string) => (active ? name : undefined)
  return (
    <g>
      <Hills />
      {/* far houses */}
      <At x={880} y={562} s={0.72}><House wall={C.cream} roof={C.clayDark} /></At>
      <At x={1030} y={530} s={0.78}><House wall={C.bone} roof={C.woodDark} /></At>
      <At x={1200} y={512} s={0.72}><House wall={C.cream} roof={C.clay} /></At>
      <At x={1390} y={534} s={0.78}><House wall={C.bone} roof={C.clayDark} /></At>
      <At x={590} y={660} s={0.5}><Tree /></At>

      {/* Ama's hillside */}
      <At x={70} y={760}><Pen w={300} /></At>
      <At x={150} y={705} s={0.52}><Sheep /></At>
      <At x={260} y={700} s={0.52} flip><Sheep /></At>
      <At x={205} y={738} s={0.52}><Sheep /></At>
      <At x={455} y={790} s={0.62} data-tutor={t('Ama the shepherd')}><Shepherd holdingBag /></At>

      {/* the farmer and her field */}
      <At x={760} y={680}><Field /></At>
      <At x={760} y={662} s={0.5} data-tutor={t('the farmer')}><Person kind="farmer" robe={C.leaf} skin="#8D5A3B" /></At>

      {/* the market */}
      <At x={930} y={800} s={0.85} data-tutor={t('the baker at the bread stall')}>
        <Stall awning={C.sky} goods="bread">
          <At x={0} y={-30} s={0.72}><Person kind="baker" robe={C.skyDark} skin="#E0AC7E" /></At>
        </Stall>
      </At>
      <At x={1140} y={800} s={0.85} data-tutor={t('the fruit seller')}>
        <Stall awning={C.berry} goods="apples">
          <At x={0} y={-30} s={0.72}><Person kind="seller" robe={C.clay} skin="#A0663F" /></At>
        </Stall>
      </At>

      {/* the builder */}
      <At x={1322} y={812}><BrickWall /></At>
      <At x={1290} y={812} s={0.62} data-tutor={t('the builder')}><Person kind="builder" robe={C.skyDark} skin="#C68B59" /></At>
    </g>
  )
}

function House({ wall, roof }: { wall: string; roof: string }) {
  return (
    <g>
      <rect x={-50} y={-80} width={100} height={80} fill={wall} />
      <path d="M -62 -78 L 0 -132 L 62 -78 Z" fill={roof} />
      <rect x={-14} y={-44} width={28} height={44} rx={4} fill={C.woodDark} />
      <rect x={20} y={-64} width={20} height={20} rx={3} fill={C.skyDark} opacity={0.55} />
    </g>
  )
}

function Field() {
  return (
    <g>
      <ellipse rx={100} ry={22} fill={C.woodLight} opacity={0.75} />
      {[-10, 2, 14].map((y, r) =>
        Array.from({ length: 6 }, (_, c) => (
          <g key={`${r}-${c}`} transform={`translate(${-72 + c * 29 + (r % 2) * 8} ${y})`}>
            <ellipse cx={-4} cy={-5} rx={5} ry={3} fill={C.leaf} transform="rotate(-30 -4 -5)" />
            <ellipse cx={4} cy={-5} rx={5} ry={3} fill={C.leaf} transform="rotate(30 4 -5)" />
          </g>
        )),
      )}
    </g>
  )
}

/** A market stall. Children (the seller) stand behind the counter. Origin bottom centre. */
function Stall({ awning, goods, children }: { awning: string; goods: 'bread' | 'apples'; children?: ReactNode }) {
  const w = 230
  const n = 6
  return (
    <g>
      <ellipse cx={0} cy={2} rx={124} ry={10} fill={C.shadow} />
      <rect x={-108} y={-262} width={12} height={262} rx={5} fill={C.woodDark} />
      <rect x={96} y={-262} width={12} height={262} rx={5} fill={C.woodDark} />
      {children}
      {Array.from({ length: n }, (_, i) => {
        const x0 = -w / 2 + i * (w / n)
        const x1 = x0 + w / n
        return <path key={i} d={`M ${x0} -268 L ${x1} -268 L ${x1} -226 Q ${(x0 + x1) / 2} -206 ${x0} -226 Z`} fill={i % 2 ? C.white : awning} />
      })}
      <rect x={-w / 2 - 6} y={-276} width={w + 12} height={14} rx={7} fill={awning} />
      <rect x={-112} y={-92} width={224} height={92} rx={8} fill={C.wood} />
      <rect x={-112} y={-92} width={224} height={16} rx={6} fill={C.woodLight} />
      <line x1={-100} y1={-46} x2={100} y2={-46} stroke={C.woodDark} strokeWidth={3} opacity={0.4} />
      {goods === 'bread' ? (
        <g>
          {[-62, 0, 62].map((x) => (
            <g key={x} transform={`translate(${x} -104)`}>
              <ellipse rx={28} ry={15} fill={C.woodLight} />
              <path d="M -12 -6 l 6 10 M 0 -8 l 6 10 M 12 -6 l 6 10" stroke={C.wood} strokeWidth={3} strokeLinecap="round" />
            </g>
          ))}
        </g>
      ) : (
        <g>
          {[-56, 56].map((x) => (
            <g key={x} transform={`translate(${x} -92)`}>
              {[-26, -8, 10, 28, -17, 1, 19].map((ax, k) => (
                <circle key={k} cx={ax} cy={k < 4 ? -14 : -30} r={10} fill={C.berry} />
              ))}
              <rect x={-42} y={-12} width={84} height={14} rx={3} fill={C.woodDark} />
            </g>
          ))}
        </g>
      )}
    </g>
  )
}

function BrickWall() {
  const rows = [3, 3, 2, 2, 1]
  return (
    <g>
      {rows.map((count, r) =>
        Array.from({ length: count }, (_, k) => (
          <rect key={`${r}-${k}`} x={k * 30 + (r % 2) * 15} y={-(r + 1) * 18} width={28} height={16} rx={2} fill={C.clay} stroke={C.clayDark} strokeWidth={2} />
        )),
      )}
    </g>
  )
}

type PersonKind = 'baker' | 'seller' | 'farmer' | 'builder' | 'kid'

/** A villager, feet at the origin, about 230 tall. */
function Person({ kind, robe, skin }: { kind: PersonKind; robe: string; skin: string }) {
  return (
    <g>
      <ellipse cx={0} cy={2} rx={50} ry={9} fill={C.shadow} />
      {kind === 'farmer' && (
        <g>
          <line x1={58} y1={0} x2={50} y2={-196} stroke={C.woodDark} strokeWidth={7} strokeLinecap="round" />
          <path d="M 44 -4 L 76 -2 L 70 12 L 46 10 Z" fill={C.stoneDark} />
        </g>
      )}
      <path d="M -32 -146 Q 0 -158 32 -146 L 48 -6 Q 0 6 -48 -6 Z" fill={robe} />
      {kind === 'baker' && <path d="M -22 -118 L 22 -118 L 32 -10 Q 0 -2 -32 -10 Z" fill={C.white} />}
      <path d="M -28 -138 Q -54 -100 -46 -64" stroke={robe} strokeWidth={20} fill="none" strokeLinecap="round" />
      <path d="M 28 -138 Q 54 -100 46 -64" stroke={robe} strokeWidth={20} fill="none" strokeLinecap="round" />
      <circle cx={-46} cy={-60} r={11} fill={skin} />
      <circle cx={46} cy={-60} r={11} fill={skin} />
      {kind === 'builder' && <rect x={30} y={-66} width={36} height={20} rx={3} fill={C.clay} stroke={C.clayDark} strokeWidth={2} />}
      <rect x={-10} y={-166} width={20} height={22} fill={skin} />
      <circle cx={0} cy={-190} r={32} fill={skin} />
      {kind === 'baker' && (
        <g>
          <circle cx={-18} cy={-240} r={17} fill={C.white} />
          <circle cx={0} cy={-250} r={21} fill={C.white} />
          <circle cx={18} cy={-240} r={17} fill={C.white} />
          <rect x={-29} y={-238} width={58} height={22} rx={6} fill={C.white} />
          <rect x={-29} y={-222} width={58} height={6} fill={C.woolShade} />
        </g>
      )}
      {kind === 'seller' && (
        <g>
          <path d="M -35 -194 C -38 -238 38 -238 35 -194 C 24 -214 -24 -214 -35 -194 Z" fill={C.berry} />
          <path d="M 30 -206 C 46 -200 48 -182 40 -170" stroke={C.berry} strokeWidth={9} fill="none" strokeLinecap="round" />
        </g>
      )}
      {kind === 'farmer' && (
        <g>
          <path d="M -28 -212 C -28 -252 28 -252 28 -212 Z" fill={C.woodLight} />
          <ellipse cx={0} cy={-212} rx={56} ry={11} fill={C.woodLight} />
          <rect x={-28} y={-224} width={56} height={8} fill={C.wood} />
        </g>
      )}
      {kind === 'builder' && (
        <g>
          <path d="M -34 -206 C -34 -254 34 -254 34 -206 Z" fill={C.mustard} />
          <rect x={-44} y={-212} width={88} height={11} rx={5} fill={C.mustardDark} />
          <rect x={-4} y={-246} width={8} height={36} rx={3} fill={C.mustardDark} />
        </g>
      )}
      {kind === 'kid' && <path d="M -33 -192 C -34 -234 34 -234 33 -192 C 20 -208 -20 -208 -33 -192 Z" fill={C.woodDark} />}
      <g className="blink">
        <ellipse cx={-11} cy={-188} rx={4} ry={5.5} fill={C.ink} />
        <ellipse cx={11} cy={-188} rx={4} ry={5.5} fill={C.ink} />
      </g>
      <circle cx={-20} cy={-176} r={5} fill={C.coral} opacity={0.35} />
      <circle cx={20} cy={-176} r={5} fill={C.coral} opacity={0.35} />
      <path d="M -8 -172 Q 0 -165 8 -172" stroke={C.ink} strokeWidth={3} fill="none" strokeLinecap="round" />
    </g>
  )
}

/** A "?" thought bubble in a branch colour. Origin at the tail tip. */
function QBubble({ color }: { color: string }) {
  return (
    <g>
      <path d="M 0 0 L -14 -38 L 14 -38 Z" fill={color} />
      <circle cx={0} cy={-74} r={42} fill={color} stroke={C.white} strokeWidth={5} />
      <text x={0} y={-56} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={60} fill={C.white}>?</text>
    </g>
  )
}

/* ================================================================ the map */

const WAVES = [
  [700, 330], [880, 300], [760, 590], [900, 620], [620, 460], [990, 470], [120, 452], [470, 450], [1150, 452], [1480, 448],
  [800, 820], [800, 160],
]

function MapBackground() {
  return (
    <g>
      <rect x={0} y={0} width={1600} height={900} fill={C.paper} />
      <rect x={14} y={14} width={1572} height={872} rx={30} fill={SEA} />
      {WAVES.map(([x, y], i) => (
        <path key={i} d={`M ${x - 22} ${y} q 11 -10 22 0 q 11 10 22 0`} stroke={C.white} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.7} />
      ))}
    </g>
  )
}

function Compass() {
  return (
    <g opacity={0.8}>
      <circle r={62} fill={C.white} opacity={0.55} />
      <path d="M 0 -56 L 12 -12 L 56 0 L 12 12 L 0 56 L -12 12 L -56 0 L -12 -12 Z" fill={C.stoneLight} />
      <path d="M 0 -56 L 12 -12 L 0 0 Z M 56 0 L 12 12 L 0 0 Z M 0 56 L -12 12 L 0 0 Z M -56 0 L -12 -12 L 0 0 Z" fill={C.inkSoft} />
      <circle r={7} fill={C.white} />
    </g>
  )
}

function IslandArt({ isl }: { isl: Island }) {
  const lines = isl.title
  const ys = lines.length === 1 ? [isl.cy + 18] : [isl.cy - 6, isl.cy + 43]
  return (
    <g>
      <path d={blobPath(isl, 26)} fill={C.white} opacity={0.45} />
      <path d={blobPath(isl)} fill={isl.tint} stroke={isl.color} strokeWidth={10} strokeLinejoin="round" />
      <At x={isl.cx} y={isl.cy - 98}><IslandIcon id={isl.id} /></At>
      {lines.map((t, k) => (
        <At key={k} x={isl.cx} y={ys[k]}><Label text={t} size={44} /></At>
      ))}
    </g>
  )
}

function IslandIcon({ id }: { id: RegionId }) {
  if (id === 'howMany') {
    return (
      <g>
        <At x={-48} y={12} s={1.7}><Pebble seed={0} /></At>
        <At x={0} y={-10} s={1.7}><Pebble seed={1} /></At>
        <At x={48} y={12} s={1.7}><Pebble seed={2} /></At>
      </g>
    )
  }
  if (id === 'change') {
    return (
      <g>
        <At x={0} y={44} s={0.8}>
          <BasketBack />
          <At x={-24} y={-78}><Apple /></At>
          <At x={24} y={-78}><Apple /></At>
          <At x={0} y={-96}><Apple /></At>
          <BasketFront />
        </At>
        <At x={-92} y={-6}><SignBadge sign="+" color={C.teal} /></At>
        <At x={92} y={-6}><SignBadge sign="-" color={C.teal} /></At>
      </g>
    )
  }
  if (id === 'next') {
    return (
      <g>
        {[0, 1, 2, 3].map((k) => (
          <At key={k} x={-81 + k * 54} y={0}><SkyTile night={k % 2 === 1} size={48} /></At>
        ))}
      </g>
    )
  }
  return (
    <g>
      <g transform="translate(-34 6) rotate(-14)">
        <rect x={-78} y={-17} width={156} height={34} rx={5} fill={C.white} stroke={C.mustardDark} strokeWidth={4} />
        {Array.from({ length: 11 }, (_, k) => (
          <line key={k} x1={-66 + k * 13.2} y1={-17} x2={-66 + k * 13.2} y2={k % 2 ? -8 : -1} stroke={C.ink} strokeWidth={3} strokeLinecap="round" />
        ))}
      </g>
      <path d="M 52 44 L 118 44 L 52 -40 Z" fill={C.white} stroke={C.mustardDark} strokeWidth={5} strokeLinejoin="round" />
      <path d="M 64 32 L 92 32 L 64 -4 Z" fill={ISL.shape.tint} stroke={C.mustardDark} strokeWidth={3} strokeLinejoin="round" />
    </g>
  )
}

function SignBadge({ sign, color, r = 24 }: { sign: '+' | '-'; color: string; r?: number }) {
  const a = r * 0.5
  return (
    <g>
      <circle r={r} fill={color} />
      <line x1={-a} y1={0} x2={a} y2={0} stroke={C.white} strokeWidth={r * 0.28} strokeLinecap="round" />
      {sign === '+' && <line x1={0} y1={-a} x2={0} y2={a} stroke={C.white} strokeWidth={r * 0.28} strokeLinecap="round" />}
    </g>
  )
}

/** A small square of day sky (with the sun) or night sky (with the moon). Centred. */
function SkyTile({ night, size }: { night: boolean; size: number }) {
  const h = size / 2
  return (
    <g>
      <rect x={-h} y={-h} width={size} height={size} rx={size * 0.2} fill={night ? C.skyNight : C.skyDay} />
      {night ? (
        <g>
          <circle r={size * 0.26} fill={C.moon} />
          <circle cx={size * 0.12} cy={-size * 0.06} r={size * 0.22} fill={C.skyNight} />
        </g>
      ) : (
        <g>
          <circle r={size * 0.34} fill={C.sunGlow} opacity={0.6} />
          <circle r={size * 0.24} fill={C.sun} />
        </g>
      )}
    </g>
  )
}

/* ---------------------------------------------------------------- small props */

function Apple() {
  return (
    <g>
      <circle r={22} fill={C.berry} />
      <path d="M 0 -20 Q 2 -30 6 -34" stroke={C.woodDark} strokeWidth={4} fill="none" strokeLinecap="round" />
      <ellipse cx={13} cy={-28} rx={9} ry={5} fill={C.leaf} transform="rotate(-25 13 -28)" />
      <ellipse cx={-8} cy={-8} rx={6} ry={4} fill={C.white} opacity={0.4} />
    </g>
  )
}

/** The back rim of a basket. Draw apples after it and BasketFront last. Origin bottom centre. */
function BasketBack() {
  return <ellipse cx={0} cy={-70} rx={62} ry={14} fill={C.woodDark} />
}

function BasketFront() {
  return (
    <g>
      <ellipse cx={0} cy={2} rx={54} ry={8} fill={C.shadow} />
      <path d="M -62 -70 L -46 -4 Q 0 6 46 -4 L 62 -70 Q 0 -54 -62 -70 Z" fill={C.wood} />
      <path d="M -56 -44 Q 0 -30 56 -44 M -50 -22 Q 0 -10 50 -22" stroke={C.woodDark} strokeWidth={3} fill="none" opacity={0.5} />
      <path d="M -24 -60 L -20 -2 M 0 -58 L 0 0 M 24 -60 L 20 -2" stroke={C.woodDark} strokeWidth={3} opacity={0.35} />
      <path d="M -62 -70 Q 0 -54 62 -70" stroke={C.woodLight} strokeWidth={8} fill="none" strokeLinecap="round" />
    </g>
  )
}

function Couch() {
  return (
    <g>
      <ellipse cx={0} cy={4} rx={134} ry={10} fill={C.shadow} />
      <rect x={-112} y={-14} width={12} height={16} rx={3} fill={C.woodDark} />
      <rect x={100} y={-14} width={12} height={16} rx={3} fill={C.woodDark} />
      <rect x={-110} y={-112} width={220} height={70} rx={22} fill={C.skyDark} />
      <rect x={-124} y={-62} width={248} height={50} rx={16} fill={C.sky} />
      <rect x={-130} y={-88} width={40} height={78} rx={16} fill={C.skyDark} />
      <rect x={90} y={-88} width={40} height={78} rx={16} fill={C.skyDark} />
      <line x1={0} y1={-60} x2={0} y2={-16} stroke={C.skyDark} strokeWidth={3} opacity={0.5} />
    </g>
  )
}

/** A bit of wall with an open doorway. Origin at the bottom-left of the wall. */
function DoorWall() {
  return (
    <g>
      <rect x={0} y={-420} width={130} height={420} fill={C.cream} stroke={C.stone} strokeWidth={4} />
      <rect x={28} y={-300} width={74} height={300} fill={C.inkSoft} />
      <path d="M 28 -300 L 102 -300 L 102 0 M 28 0 L 28 -300" stroke={C.woodDark} strokeWidth={8} fill="none" strokeLinejoin="round" />
      <path d="M 28 -300 L 6 -280 L 6 14 L 28 0 Z" fill={C.wood} />
      <circle cx={13} cy={-140} r={4} fill={C.mustardDark} />
    </g>
  )
}

/** A measuring line with end ticks, from x=0 to x=len. */
function Measure({ len, color }: { len: number; color: string }) {
  return (
    <g>
      <line x1={0} y1={0} x2={len} y2={0} stroke={color} strokeWidth={6} strokeLinecap="round" />
      <line x1={0} y1={-16} x2={0} y2={16} stroke={color} strokeWidth={6} strokeLinecap="round" />
      <line x1={len} y1={-16} x2={len} y2={16} stroke={color} strokeWidth={6} strokeLinecap="round" />
    </g>
  )
}

function star(r: number, ri = r * 0.45) {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rad = i % 2 === 0 ? r : ri
    pts.push(`${(rad * Math.cos(a)).toFixed(1)} ${(rad * Math.sin(a)).toFixed(1)}`)
  }
  return `M ${pts.join(' L ')} Z`
}

/* ---------------------------------------------------------------- the four mini scenes */

function PanelFrame({ color, tutor, children }: { color: string; tutor?: string; children: ReactNode }) {
  return (
    <g data-tutor={tutor}>
      <rect x={PANEL.x} y={PANEL.y + 8} width={PANEL.w} height={PANEL.h} rx={36} fill={C.ink} opacity={0.12} />
      <rect x={PANEL.x} y={PANEL.y} width={PANEL.w} height={PANEL.h} rx={36} fill={C.white} stroke={color} strokeWidth={8} />
      {children}
    </g>
  )
}

function HowManyPanel({ active }: { active: boolean }) {
  return (
    <g className="pn-howMany">
      <PanelFrame color={C.coral} tutor={active ? 'the sheep and pebbles' : undefined}>
        {[0, 1, 2].map((i) => {
          const x = 670 + 130 * i
          return (
            <g key={i}>
              <g className={`hm-s-${i}`}><At x={x - 8} y={290} s={0.78}><Sheep blink={false} /></At></g>
              <g className={`hm-l-${i}`}>
                <line x1={x} y1={386} x2={x} y2={560} stroke={C.coral} strokeWidth={6} strokeDasharray="2 14" strokeLinecap="round" />
              </g>
              <g className={`hm-p-${i}`}><At x={x} y={612} s={2}><Pebble seed={i} /></At></g>
            </g>
          )
        })}
      </PanelFrame>
    </g>
  )
}

function ChangePanel({ active }: { active: boolean }) {
  return (
    <g className="pn-change">
      <PanelFrame color={C.teal} tutor={active ? 'the apple basket' : undefined}>
        <At x={800} y={280}><g className="ch-plus"><SignBadge sign="+" color={C.teal} r={30} /></g></At>
        <At x={940} y={470}><g className="ch-minus"><SignBadge sign="-" color={C.teal} r={30} /></g></At>
        <At x={FRIEND.x} y={FRIEND.y} s={0.55}><Person kind="kid" robe={C.leaf} skin="#C68B59" /></At>
        <At x={BASKET.x} y={BASKET.y} s={1.5}><BasketBack /></At>
        {/* the back-row apples go in first so the front row sits in front of them */}
        {[3, 4, 0, 1, 2].map((i) => (
          <g key={i} className={`ap-${i}`}><Apple /></g>
        ))}
        <At x={BASKET.x} y={BASKET.y} s={1.5}><BasketFront /></At>
      </PanelFrame>
    </g>
  )
}

const SEASONS = [
  { crown: '#F7B9CB', bg: C.skyDayLow, name: 'spring' },
  { crown: C.leaf, bg: C.skyDayLow, name: 'summer' },
  { crown: C.clay, bg: C.skyDuskLow, name: 'autumn' },
  { crown: null, bg: C.stoneLight, name: 'winter' },
]

function NextPanel({ active }: { active: boolean }) {
  const xs = [624, 712, 800, 888, 976]
  return (
    <g className="pn-next">
      <PanelFrame color={C.violet} tutor={active ? 'day and night, and the seasons' : undefined}>
        {xs.map((x, i) => (
          <g key={`a${i}`} className={`nx-a-${i}`}>
            {i < 4 ? <At x={x} y={320}><SkyTile night={i % 2 === 1} size={80} /></At> : <At x={x} y={320}><QTile w={80} h={80} /></At>}
          </g>
        ))}
        {xs.map((x, i) => (
          <g key={`b${i}`} className={`nx-b-${i}`}>
            {i < 4 ? <At x={x} y={560}><SeasonTile {...SEASONS[i]} /></At> : <At x={x} y={560}><QTile w={80} h={110} /></At>}
          </g>
        ))}
      </PanelFrame>
    </g>
  )
}

function QTile({ w, h }: { w: number; h: number }) {
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={16} fill={C.white} stroke={C.violet} strokeWidth={5} strokeDasharray="10 8" />
      <At y={4}><Label text="?" size={60} color={C.violet} /></At>
    </g>
  )
}

function SeasonTile({ crown, bg }: { crown: string | null; bg: string }) {
  return (
    <g>
      <rect x={-40} y={-55} width={80} height={110} rx={16} fill={bg} />
      <rect x={-5} y={-4} width={10} height={44} rx={4} fill={C.woodDark} />
      {crown ? (
        <g>
          <circle cx={0} cy={-18} r={26} fill={crown} />
          {crown === '#F7B9CB' && [[-10, -26], [8, -12], [10, -30], [-8, -8]].map(([x, y], k) => <circle key={k} cx={x} cy={y} r={4} fill={C.white} />)}
        </g>
      ) : (
        <g>
          <path d="M 0 -4 L -16 -30 M 0 -14 L 14 -36 M -8 -18 L -2 -40" stroke={C.woodDark} strokeWidth={5} strokeLinecap="round" />
          <rect x={-40} y={36} width={80} height={19} rx={8} fill={C.white} />
        </g>
      )}
      <rect x={-40} y={40} width={80} height={15} rx={6} fill={crown ? C.grass : C.white} />
    </g>
  )
}

function ShapePanel({ active }: { active: boolean }) {
  return (
    <g className="pn-shape">
      <PanelFrame color={C.mustard} tutor={active ? 'the couch and the door' : undefined}>
        <At x={716} y={720}><Couch /></At>
        <At x={892} y={720}><DoorWall /></At>
        <g transform="translate(586 568)"><g className="sh-m1"><Measure len={260} color={C.mustardDark} /></g></g>
        <g transform="translate(920 382)"><g className="sh-m2"><Measure len={74} color={C.mustardDark} /></g></g>
        <At x={716} y={430}>
          <g className="sh-q">
            <circle r={46} fill={C.mustard} />
            <text y={21} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={64} fill={C.white}>?</text>
          </g>
        </At>
      </PanelFrame>
    </g>
  )
}

/* ---------------------------------------------------------------- jobs */

function Roles({ active }: { active: boolean }) {
  return (
    <g className="roles">
      {ROLES.map((r, i) => {
        const isl = ISL[r.target]
        const left = isl.cx < 800
        const x1 = left ? r.x - 64 : r.x + 64
        const x2 = left ? isl.cx + RX - 6 : isl.cx - RX + 6
        const y2 = r.y + (isl.cy - r.y) * 0.4
        return (
          <g key={r.name}>
            <g className={`rline-${i}`}>
              <line x1={x1} y1={r.y} x2={x2} y2={y2} stroke={isl.dark} strokeWidth={6} strokeDasharray="4 12" strokeLinecap="round" />
              <circle cx={x2} cy={y2} r={9} fill={isl.dark} />
            </g>
            <g className={`role-${i}`} data-tutor={active ? `the ${r.name.toLowerCase()}` : undefined}>
              <circle cx={r.x} cy={r.y + 6} r={60} fill={C.ink} opacity={0.12} />
              <circle cx={r.x} cy={r.y} r={60} fill={C.white} stroke={isl.color} strokeWidth={7} />
              <At x={r.x} y={r.y}><RoleFace kind={r.kind} /></At>
              <At x={r.x} y={r.y + 92}><Label text={r.name} size={32} /></At>
            </g>
          </g>
        )
      })}
    </g>
  )
}

function RoleFace({ kind }: { kind: 'baker' | 'builder' | 'astronaut' | 'gamer' }) {
  const face = (skin: string) => (
    <g>
      <circle cx={0} cy={8} r={28} fill={skin} />
      <ellipse cx={-10} cy={6} rx={3.5} ry={5} fill={C.ink} />
      <ellipse cx={10} cy={6} rx={3.5} ry={5} fill={C.ink} />
      <path d="M -8 20 Q 0 27 8 20" stroke={C.ink} strokeWidth={3} fill="none" strokeLinecap="round" />
    </g>
  )
  if (kind === 'baker') {
    return (
      <g>
        {face('#E0AC7E')}
        <circle cx={-15} cy={-30} r={14} fill={C.white} stroke={C.woolShade} strokeWidth={3} />
        <circle cx={0} cy={-38} r={17} fill={C.white} stroke={C.woolShade} strokeWidth={3} />
        <circle cx={15} cy={-30} r={14} fill={C.white} stroke={C.woolShade} strokeWidth={3} />
        <rect x={-24} y={-28} width={48} height={16} rx={4} fill={C.white} stroke={C.woolShade} strokeWidth={3} />
      </g>
    )
  }
  if (kind === 'builder') {
    return (
      <g>
        {face('#8D5A3B')}
        <path d="M -30 -6 C -30 -46 30 -46 30 -6 Z" fill={C.mustard} />
        <rect x={-38} y={-10} width={76} height={10} rx={5} fill={C.mustardDark} />
      </g>
    )
  }
  if (kind === 'astronaut') {
    return (
      <g>
        <circle r={44} fill={C.white} stroke={C.stone} strokeWidth={5} />
        <ellipse cx={0} cy={2} rx={30} ry={24} fill={C.skyNight} />
        <ellipse cx={-10} cy={-6} rx={8} ry={5} fill={C.white} opacity={0.6} />
        <circle cx={38} cy={-24} r={6} fill={C.coral} />
      </g>
    )
  }
  return (
    <g>
      <g transform="translate(0 -10)">{face('#C68B59')}</g>
      <path d="M -28 -10 C -30 -44 30 -44 28 -10 C 18 -26 -18 -26 -28 -10 Z" fill={C.ink} />
      <rect x={-30} y={26} width={60} height={26} rx={12} fill={C.inkSoft} />
      <rect x={-20} y={36} width={12} height={4} rx={2} fill={C.white} />
      <rect x={-16} y={32} width={4} height={12} rx={2} fill={C.white} />
      <circle cx={13} cy={34} r={3.5} fill={C.berry} />
      <circle cx={20} cy={42} r={3.5} fill={C.sky} />
    </g>
  )
}

/* ================================================================ the sorting game */

interface Card {
  text: string
  lines: string[]
  answer: RegionId
  short: string
  Pic: FC
  right: string
  wrong: Partial<Record<RegionId, string>>
  hints: string[]
  mixup: string
}

const CARDS: Card[] = [
  {
    text: 'Is there a cookie for every kid at the party?',
    lines: ['Is there a cookie', 'for every kid', 'at the party?'],
    answer: 'howMany',
    short: 'a cookie for every kid',
    Pic: PicCookies,
    right: 'Yes! To check there is a cookie for every kid, you match and count, just like Ama with her pebbles. That is a how many question.',
    wrong: {
      change: 'Hmm, no cookies are being added or taken away here. Listen again. What do we want to know about the cookies and the kids?',
      next: 'Hmm, there is no pattern that repeats here. Listen again. What do we want to know about the cookies and the kids?',
      shape: 'Hmm, the size of the cookies does not matter here. Listen again. What do we want to know about the cookies and the kids?',
    },
    hints: [
      'Listen to the card again. What do we need to find out about the cookies and the kids?',
      'Is anything being added or taken away, repeating, or measured here? Or are we checking that there are enough?',
      'Remember how Ama gave one pebble to each sheep. Which island has pebbles on it?',
    ],
    mixup: 'may choose How do amounts change? because cookies get handed out, but the puzzle only asks if there is one cookie for each kid, which is matching and counting',
  },
  {
    text: 'You had 5 marbles and won 3 more.',
    lines: ['You had 5 marbles', 'and won 3 more.'],
    answer: 'change',
    short: '5 marbles and won 3 more',
    Pic: PicMarbles,
    right: 'Yes! Winning 3 more changes how many marbles you have. That is a change question.',
    wrong: {
      howMany: 'Good thinking, you do count marbles. But something happens to your pile of marbles in this puzzle. Listen to the card again.',
      next: 'There is no pattern that repeats here. Think about what happens to your pile of marbles.',
      shape: 'The size of the marbles does not matter here. Think about what happens to your pile of marbles.',
    },
    hints: [
      'Listen to the card again. What happens to your marbles?',
      'Does your pile of marbles stay the same, or does it get bigger?',
      'Look for the island with a basket and a plus and a minus sign. What does it show happening?',
    ],
    mixup: 'often chooses How many? because the card has numbers in it, but the amount is changing (getting bigger)',
  },
  {
    text: "Red bead, blue bead, red bead, blue bead... what's next?",
    lines: ['Red bead, blue bead,', 'red bead, blue bead...', "what's next?"],
    answer: 'next',
    short: 'red and blue beads',
    Pic: PicBeads,
    right: 'Yes! Red, blue, red, blue is a pattern. Spotting the pattern tells you what comes next.',
    wrong: {
      howMany: 'We do not need to count the beads. Look at the order of the colours instead.',
      change: 'This puzzle is not about having more or fewer beads. Look at the order of the colours instead.',
      shape: 'All the beads are the same size and shape. Look at the order of the colours instead.',
    },
    hints: [
      'Listen to the card again, and look at the colours of the beads in order.',
      'Red, blue, red, blue. Do the colours make a pattern?',
      'Which island shows something that takes turns, over and over, like day and night?',
    ],
    mixup: 'may choose How many? or How do amounts change? because beads are being added to the string, but the puzzle is about a repeating pattern',
  },
  {
    text: 'Will this couch fit through the door?',
    lines: ['Will this couch fit', 'through the door?'],
    answer: 'shape',
    short: 'the couch and the door',
    Pic: PicCouch,
    right: 'Yes! To know if the couch fits, you think about how big it is and what shape the doorway is. That is a size and shape question.',
    wrong: {
      howMany: 'There is only one couch, so there is nothing to count. Picture carrying it to the door. What could make it get stuck?',
      change: 'Nothing is being added or taken away. Picture carrying the couch to the door. What could make it get stuck?',
      next: 'There is no pattern here. Picture carrying the couch to the door. What could make it get stuck?',
    },
    hints: [
      'Listen to the card again. Picture carrying the couch to the door.',
      'What could make a couch get stuck in a doorway?',
      'Which island has a ruler on it? What do you use a ruler for?',
    ],
    mixup: 'may not see this as a math question at all; it is about size and shape',
  },
  {
    text: 'You gave 2 of your 6 stickers to a friend.',
    lines: ['You gave 2 of your', '6 stickers to a friend.'],
    answer: 'change',
    short: 'gave 2 of 6 stickers away',
    Pic: PicStickers,
    right: 'Right! Giving stickers away changes how many you have. Another change question.',
    wrong: {
      howMany: 'Good thinking, you could count the stickers. But your sticker pile does not stay the same here. Listen to the card again.',
      next: 'There is no pattern that repeats here. Think about what happens to your sticker pile.',
      shape: 'The size of the stickers does not matter here. Think about what happens to your sticker pile.',
    },
    hints: [
      'Listen to the card again. What happens to your stickers?',
      'After you give some away, do you still have the same number of stickers?',
      'Which island shows a basket with a plus and a minus sign?',
    ],
    mixup: 'often chooses How many? because of the numbers, but the amount changes (some are given away)',
  },
  {
    text: 'The moon is full, then thin, then full again. When is it full next?',
    lines: ['The moon is full,', 'then thin, then full', 'again. When is it', 'full next?'],
    answer: 'next',
    short: 'when the moon is full next',
    Pic: PicMoon,
    right: 'Yes! Full, thin, full again is a pattern that repeats, so you can work out what comes next.',
    wrong: {
      howMany: 'There is only one moon, so we are not counting. Notice that it goes full, thin, full, again and again.',
      change: 'Nothing is being added or taken away. Notice that the moon goes full, thin, full, again and again.',
      shape: 'The moon does look like different shapes, but the card asks when. Notice that it goes full, thin, full, again and again.',
    },
    hints: [
      'Listen to the card again. It asks when the moon will be full next.',
      'Full, thin, full again. Does that remind you of something that repeats?',
      'Which island has the sun and moon taking turns?',
    ],
    mixup: 'may choose How big, and what shape? because the moon looks like different shapes, but the card asks when, and the answer comes from a repeating pattern',
  },
]

const DOCK = { x: 800, y: 470 }
const CARD_W = 480
const CARD_H = 340
const HELD = 0.55
const CHIP = 0.28

function WhichQuestion({ onChallengeDone, say, emit, reportState, setHints }: SceneProps) {
  const [idx, setIdx] = useState(0)
  const [tries, setTries] = useState<RegionId[][]>(() => CARDS.map(() => []))
  const [hover, setHover] = useState<RegionId | null>(null)
  const [held, setHeld] = useState(false)
  const outer = useRef<SVGGElement>(null)
  const inner = useRef<SVGGElement>(null)
  const pos = useRef({ ...DOCK })
  const dragging = useRef(false)
  const busy = useRef(false)
  const hoverRef = useRef<RegionId | null>(null)
  const lastRead = useRef({ idx: -1, at: 0 })
  const timers = useRef<number[]>([])
  const done = idx >= CARDS.length
  const card = CARDS[Math.min(idx, CARDS.length - 1)]

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  useEffect(() => {
    if (!done) setHints(CARDS[idx].hints)
  }, [idx, done, setHints])

  useEffect(() => {
    const q = (r: RegionId) => `"${ISL[r].name}"`
    const islands = ISLANDS.map((i) => `${q(i.id)} (${i.where}, ${i.icon})`).join('; ')
    const list = CARDS.map((c, k) => {
      const tried = tries[k].map(q).join(', then ')
      const status =
        k < idx
          ? `placed correctly${tried ? `, after the student first tried ${tried} (it slid back)` : ' on the first try'}`
          : k === idx
            ? `the card in the middle right now, not sorted yet${tried ? `; the student already tried ${tried} (it slid back)` : ''}`
            : 'not shown yet'
      return `${k + 1}) "${c.text}" belongs on the ${q(c.answer)} island. Status: ${status}.`
    }).join(' ')
    const now = done
      ? 'All six cards are sorted onto the right islands. The game is finished.'
      : `Card ${idx + 1} of 6 is in the middle. Likely mix-up for this card: the student ${CARDS[idx].mixup}. Do not tell the student the island; ask what the puzzle wants to find out.`
    const full =
      `Sorting game on the map of math. Four islands: ${islands}. The student drags one picture card at a time from the middle of the map onto the island whose big question helps solve it. A right card shrinks onto that island; a wrong one slides back to the middle. Cards and the correct island for each: ${list} ${now}`
    reportState(full)
  }, [idx, tries, done, reportState])

  // Each new card pops in at the middle of the map.
  useLayoutEffect(() => {
    if (done) return
    const o = outer.current
    const n = inner.current
    if (!o || !n) return
    pos.current = { ...DOCK }
    busy.current = false
    const ctx = gsap.context(() => {
      gsap.set(o, { x: DOCK.x, y: DOCK.y })
      gsap.fromTo(n, { scale: 0.6, opacity: 0, transformOrigin: '50% 50%' }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(1.8)' })
    })
    return () => ctx.revert()
  }, [idx, done])

  const moveCard = (x: number, y: number, scale: number, duration: number, ease = 'power2.out') => {
    pos.current = { x, y }
    gsap.killTweensOf(outer.current)
    gsap.killTweensOf(inner.current)
    if (duration === 0) {
      gsap.set(outer.current, { x, y })
      gsap.set(inner.current, { scale })
    } else {
      gsap.to(outer.current, { x, y, duration, ease })
      gsap.to(inner.current, { scale, opacity: 1, duration, ease })
    }
  }

  const readCard = () => {
    const now = Date.now()
    if (lastRead.current.idx === idx && now - lastRead.current.at < 7000) return
    lastRead.current = { idx, at: now }
    say(card.text)
  }

  const slideBack = () => {
    busy.current = true
    moveCard(DOCK.x, DOCK.y, 1, 0.5, 'back.out(1.3)')
    later(() => (busy.current = false), 520)
  }

  const drop = (p: { x: number; y: number }) => {
    const region = regionAt(p) ?? regionAt(pos.current)
    if (!region) {
      const far = Math.hypot(pos.current.x - DOCK.x, pos.current.y - DOCK.y) > 90
      slideBack()
      if (far) say('Drop the card right onto one of the four islands.')
      return
    }
    const right = region === card.answer
    emit({ type: 'attempt', correct: right, detail: `put "${card.short}" on ${ISL[region].name}` })
    if (!right) {
      setTries((t) => t.map((a, k) => (k === idx ? [...a, region] : a)))
      lastRead.current = { idx: -1, at: 0 }
      slideBack()
      say(card.wrong[region] ?? 'Not quite. Listen to the card again.')
      return
    }
    busy.current = true
    emit({ type: 'progress', detail: `sorted card ${idx + 1} of 6` })
    const isl = ISL[region]
    const before = CARDS.slice(0, idx).filter((c) => c.answer === region).length
    const spot = chipSpot(isl, before, before + 1)
    moveCard(spot.x, spot.y, CHIP, 0.5, 'power2.inOut')
    const last = idx === CARDS.length - 1
    say(last ? `${card.right} You sorted every card onto the map!` : card.right)
    later(() => setIdx((i) => i + 1), 560)
    if (last) later(onChallengeDone, 4200)
  }

  const drag = useDrag({
    onStart: (p) => {
      if (busy.current || done) return
      dragging.current = true
      setHeld(true)
      moveCard(p.x, p.y, HELD, 0.15)
      readCard()
    },
    onMove: (p) => {
      if (!dragging.current) return
      pos.current = { x: p.x, y: p.y }
      gsap.killTweensOf(outer.current)
      gsap.set(outer.current, { x: p.x, y: p.y })
      const h = regionAt(p)
      if (h !== hoverRef.current) {
        hoverRef.current = h
        setHover(h)
      }
    },
    onEnd: (p) => {
      if (!dragging.current) return
      dragging.current = false
      hoverRef.current = null
      setHover(null)
      setHeld(false)
      pos.current = { x: p.x, y: p.y }
      drop(p)
    },
  })

  const placed = CARDS.slice(0, idx)
  const left = CARDS.length - idx - 1

  return (
    <g>
      {hover && <path d={blobPath(ISL[hover], 18)} fill="none" stroke={C.white} strokeWidth={10} strokeDasharray="22 14" strokeLinecap="round" />}

      {ISLANDS.map((isl) => {
        const mine = placed.filter((c) => c.answer === isl.id)
        return mine.map((c, k) => {
          const s = chipSpot(isl, k, mine.length)
          return (
            <g key={c.text} transform={`translate(${s.x} ${s.y})`} data-tutor={`card on ${isl.name}: ${c.short}`}>
              <CardChip card={c} color={isl.color} />
            </g>
          )
        })
      })}

      {!done && (
        <g>
          {Array.from({ length: Math.min(left, 3) }, (_, k) => {
            const o = (Math.min(left, 3) - k) * 10
            return (
              <rect
                key={k}
                x={DOCK.x - CARD_W / 2 + o}
                y={DOCK.y - CARD_H / 2 + o}
                width={CARD_W}
                height={CARD_H}
                rx={30}
                fill={C.cream}
                stroke={C.stone}
                strokeWidth={4}
              />
            )
          })}
          <g ref={outer} {...drag} data-tutor="the puzzle card">
            <g ref={inner}>
              <PuzzleCard card={card} lifted={held} />
            </g>
          </g>
        </g>
      )}
    </g>
  )
}

function PuzzleCard({ card, lifted }: { card: Card; lifted: boolean }) {
  const n = card.lines.length
  const Pic = card.Pic
  return (
    <g>
      <rect x={-CARD_W / 2} y={-CARD_H / 2 + (lifted ? 16 : 8)} width={CARD_W} height={CARD_H} rx={30} fill={C.ink} opacity={lifted ? 0.22 : 0.15} />
      <rect x={-CARD_W / 2} y={-CARD_H / 2} width={CARD_W} height={CARD_H} rx={30} fill={C.white} stroke={C.inkSoft} strokeWidth={4} />
      <rect x={-200} y={-150} width={400} height={128} rx={20} fill={C.paper} />
      <At y={-86}><Pic /></At>
      {card.lines.map((t, k) => (
        <At key={k} y={68 + (k - (n - 1) / 2) * 38}>
          <Label text={t} size={30} weight={700} />
        </At>
      ))}
    </g>
  )
}

/** A sorted card, shrunk to a little picture chip sitting on its island. */
function CardChip({ card, color }: { card: Card; color: string }) {
  const Pic = card.Pic
  return (
    <g>
      <rect x={-66} y={-34} width={132} height={76} rx={16} fill={C.ink} opacity={0.15} />
      <rect x={-66} y={-38} width={132} height={76} rx={16} fill={C.white} stroke={color} strokeWidth={5} />
      <g transform="scale(0.5)"><Pic /></g>
    </g>
  )
}

/* ---------------------------------------------------------------- card pictures (about 220 x 110, centred) */

function PicCookies() {
  const kids = [
    { x: -72, skin: '#C68B59', hair: C.woodDark },
    { x: 0, skin: '#E0AC7E', hair: C.ink },
    { x: 72, skin: '#8D5A3B', hair: C.clayDark },
  ]
  return (
    <g>
      {kids.map((k) => (
        <g key={k.x} transform={`translate(${k.x} -20)`}>
          <circle r={22} fill={k.skin} />
          <path d="M -22 -2 C -24 -30 24 -30 22 -2 C 14 -14 -14 -14 -22 -2 Z" fill={k.hair} />
          <circle cx={-8} cy={2} r={3} fill={C.ink} />
          <circle cx={8} cy={2} r={3} fill={C.ink} />
          <path d="M -7 10 Q 0 15 7 10" stroke={C.ink} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        </g>
      ))}
      {[-72, 0, 72].map((x) => (
        <g key={x} transform={`translate(${x} 36)`}>
          <circle r={17} fill={C.woodLight} stroke={C.wood} strokeWidth={3} />
          <circle cx={-6} cy={-4} r={3} fill={C.woodDark} />
          <circle cx={6} cy={-6} r={3} fill={C.woodDark} />
          <circle cx={2} cy={6} r={3} fill={C.woodDark} />
        </g>
      ))}
    </g>
  )
}

function Marble({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={14} fill={color} />
      <circle cx={x - 4} cy={y - 5} r={4} fill={C.white} opacity={0.6} />
    </g>
  )
}

function PicMarbles() {
  const leftSpots = [[-110, -14], [-80, -14], [-50, -14], [-95, 14], [-65, 14]]
  const rightSpots = [[48, -14], [78, -14], [63, 14]]
  const colors = [C.sky, C.berry, C.leaf, C.skyDark, C.clay]
  return (
    <g>
      {leftSpots.map(([x, y], k) => <Marble key={k} x={x} y={y} color={colors[k]} />)}
      <line x1={-12} y1={0} x2={12} y2={0} stroke={C.ink} strokeWidth={6} strokeLinecap="round" />
      <line x1={0} y1={-12} x2={0} y2={12} stroke={C.ink} strokeWidth={6} strokeLinecap="round" />
      {rightSpots.map(([x, y], k) => <Marble key={k} x={x} y={y} color={colors[(k + 2) % 5]} />)}
    </g>
  )
}

function PicBeads() {
  const beads = [C.berry, C.skyDark, C.berry, C.skyDark]
  const y = (x: number) => 4 + (x * x) / 1600
  return (
    <g>
      <path d="M -120 13 Q 0 -5 120 13" stroke={C.inkSoft} strokeWidth={3} fill="none" />
      {beads.map((c, k) => {
        const x = -90 + k * 44
        return (
          <g key={k}>
            <circle cx={x} cy={y(x) - 4} r={19} fill={c} />
            <circle cx={x - 6} cy={y(x) - 10} r={5} fill={C.white} opacity={0.5} />
          </g>
        )
      })}
      <circle cx={88} cy={y(88) - 4} r={19} fill={C.white} stroke={C.inkSoft} strokeWidth={3} strokeDasharray="5 5" />
      <text x={88} y={y(88) + 6} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={30} fill={C.inkSoft}>?</text>
    </g>
  )
}

function PicCouch() {
  return (
    <g>
      <At x={-46} y={42} s={0.48}><Couch /></At>
      <g transform="translate(62 46)">
        <rect x={0} y={-104} width={70} height={104} fill={C.cream} stroke={C.stone} strokeWidth={3} />
        <rect x={16} y={-80} width={38} height={80} fill={C.inkSoft} />
        <path d="M 16 0 L 16 -80 L 54 -80 L 54 0" stroke={C.woodDark} strokeWidth={5} fill="none" />
      </g>
    </g>
  )
}

function PicStickers() {
  const stay = [[-104, -18], [-70, -18], [-104, 18], [-70, 18]]
  const gone = [[22, -18], [22, 18]]
  const col = (k: number) => (k % 2 ? C.sky : C.berry)
  return (
    <g>
      {stay.map(([x, y], k) => <path key={k} d={star(16)} transform={`translate(${x} ${y})`} fill={col(k)} />)}
      <path d="M -44 0 L -6 0 M -16 -10 L -4 0 L -16 10" stroke={C.ink} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {gone.map(([x, y], k) => <path key={k} d={star(16)} transform={`translate(${x} ${y})`} fill={col(k)} />)}
      <g transform="translate(84 4)">
        <circle r={24} fill="#A0663F" />
        <path d="M -24 -2 C -26 -32 26 -32 24 -2 C 16 -16 -16 -16 -24 -2 Z" fill={C.ink} />
        <circle cx={-8} cy={2} r={3} fill={C.ink} />
        <circle cx={8} cy={2} r={3} fill={C.ink} />
        <path d="M -7 11 Q 0 16 7 11" stroke={C.ink} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      </g>
    </g>
  )
}

function PicMoon() {
  return (
    <g>
      <rect x={-118} y={-46} width={236} height={92} rx={20} fill={C.skyNight} />
      <circle cx={-78} cy={0} r={22} fill={C.moon} />
      <circle cx={-26} cy={0} r={22} fill={C.moon} />
      <circle cx={-16} cy={-3} r={21} fill={C.skyNight} />
      <circle cx={26} cy={0} r={22} fill={C.moon} />
      <circle cx={78} cy={0} r={22} fill="none" stroke={C.moon} strokeWidth={3} strokeDasharray="5 5" />
      <text x={78} y={11} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={30} fill={C.moon}>?</text>
    </g>
  )
}

export const stop2: Stop = {
  id: 'map',
  title: 'The map of math',
  branch: 'map',
  beats: BEATS,
  Scene,
}
