import gsap from 'gsap'
import { useCallback, useEffect, useRef } from 'react'
import { useBeatTimeline } from '../../../engine/useBeatTimeline'
import { camera } from '../../../cine/camera'
import { GRASPS, Hand3D, useHandStore } from '../../../cine/hand3d'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { POSES, Person, Robot } from '../../../cine/people'
import type { Chapter, ChapterProps, Cue } from '../../../flow/types'
import { Blueprint, Dust, Pool, Vignette, fade, useAmbient } from '../shared/kit'
import { CourseTree, DgDefs, KOFI, TREE_NODES } from './parts'
import { SourcesReading } from './readings'

export const CUES: Cue[] = [
  { id: 'five', say: 'There are five ways to make robot data, and every one trades three things: cost, how close it is to the robot’s real body, and how many different places it covers.' },
  { id: 'teleop', say: 'One: puppet the robot. Perfectly true to its body, but slow, costly and stuck in a few rooms.' },
  { id: 'wear', say: 'Two: give people a cheap glove or handheld gripper and record them doing the task themselves, in any home.' },
  { id: 'watch', say: 'Three: learn from ordinary video of people. Nearly free, endlessly varied, but with no forces and the wrong body.' },
  { id: 'sim', say: 'Four: simulate it. Infinite and free once built, but physics in a computer is never quite real, especially for touch.' },
  { id: 'practice', say: 'And five: let robots practise and learn from their own mistakes, once they’re good enough to be trusted with the job.' },
  { id: 'branch', say: 'Next, we’ll get our hands on each one, and find out what the best labs mix together.' },
]

const STATE = [
  'A new lime map glows in the dark: a triangle whose corners read "cheap" (bottom left), "true to the robot" (top) and "diverse" (bottom right). Five round icons bob in a row under it, one per way of making robot data, each waiting to be placed. Point: every data source trades cost, fidelity to the robot’s body, and diversity of places, like the hardware iron triangle (dexterity, robustness, cost).',
  'Icon 1 (Kofi in a VR headset driving Seven: teleoperation) slides up to the "true to the robot" corner. Caption: about $90–150 per collected hour in the US, zero body gap, but only a few staged rooms.',
  'Icon 2 (a sensor glove and a handheld gripper with a camera, like UMI) slides down between "cheap" and "diverse". Caption: a ~$200 glove versus a ~$20,000 teleop rig; record people doing the task themselves in any home. The device must match the robot’s hand.',
  'Icon 3 (a head camera and a few video tiles: human video) settles on the bottom edge, cheap and diverse, far from "true to the robot". Caption: nearly free (internet) to $25–60 per hour (egocentric rigs); no forces, wrong body.',
  'Icon 4 (a wireframe hand in a glowing grid: simulation) sits in the middle with a red crack labelled "reality gap". Caption: nearly free per hour once built, but contact, cloth and touch are hard to simulate.',
  'Icon 5 (a fleet of robots with lime data trails flowing back to a server: the robot’s own practice, fleets and corrections) sits near "true to the robot" with a lock: "needs a decent robot first".',
  'The map tilts away and shrinks into the course tree: the lime branch’s next node, "Ways to Get Data", lights up, and the camera rises toward it.',
]

/* the triangle */
const TRUE = { x: 800, y: 160 }
const CHEAP = { x: 290, y: 770 }
const DIVERSE = { x: 1310, y: 770 }
/* where the five sources wait, in a row under the triangle, until each is called */
const DECK = { x: 800, y: 836, gap: 130, s: 0.5 }
const R = 72
const ICONS = [
  { x: 800, y: 310, name: '1 · puppet the robot', sub: 'teleoperation · $90–150 per hour · a few staged rooms', lx: -84, anchor: 'end' as const },
  { x: 650, y: 610, name: '2 · gloves and handheld grippers', sub: '$200 glove vs $20,000 rig · any home', lx: -84, anchor: 'end' as const },
  { x: 1040, y: 708, name: '3 · ordinary video of people', sub: '~free · no forces, wrong body', lx: 84, anchor: 'start' as const },
  { x: 820, y: 492, name: '4 · simulation', sub: 'free per hour once built · reality gap', lx: 84, anchor: 'start' as const },
  { x: 985, y: 352, name: '5 · the robot’s own practice', sub: 'exact body · needs a decent robot first', lx: 84, anchor: 'start' as const },
]

function Medallion({ i, children }: { i: number; children: React.ReactNode }) {
  return (
    <g>
      <circle r={R + 10} fill={C.lime} opacity={0.12} />
      <circle r={R} fill={C.ink1} stroke={C.lime} strokeWidth={3} />
      <clipPath id={`c4-med-${i}`}>
        <circle r={R - 3} />
      </clipPath>
      <g clipPath={`url(#c4-med-${i})`}>{children}</g>
    </g>
  )
}

export function Ch4Map({ cueIndex, playing, onAnimDone, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const mapRef = useRef<SVGGElement>(null)
  const treeRef = useRef<SVGGElement>(null)
  const sim = useHandStore({ pose: GRASPS.relaxed, view: { yaw: -20, pitch: 10, roll: 0, s: 0.42 } })

  const build = useCallback((tl: gsap.core.Timeline) => {
    const el = root.current
    const mapCam = camera(mapRef.current, { x: 800, y: 470, zoom: 0.92 })
    const treeCam = camera(treeRef.current, { x: TREE_NODES[0].x, y: TREE_NODES[0].y, zoom: 2.4 })
    // the five icons: each orbits until it is called, then slides to its place
    const st = ICONS.map((_, i) => ({ a: (i / 5) * Math.PI * 2, k: 0, s: 0 }))
    const nodes = el ? ICONS.map((_, i) => el.querySelector(`.c4-icon-${i}`)) : []
    const apply = () =>
      st.forEach((o, i) => {
        const ox = DECK.x + (i - 2) * DECK.gap
        const oy = DECK.y + Math.sin(o.a * 3 + i * 1.3) * 5
        const x = ox + (ICONS[i].x - ox) * o.k
        const y = oy + (ICONS[i].y - oy) * o.k
        nodes[i]?.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${o.s.toFixed(3)})`)
      })
    apply()
    // planned values, so each tween starts where the last one on that key ended
    const plan = st.map((o) => ({ ...o }))
    const iconTo = (i: number, v: Partial<{ a: number; k: number; s: number }>, at: number, dur: number, ease = 'power2.inOut') => {
      const keys = Object.keys(v) as ('a' | 'k' | 's')[]
      const from: Record<string, number> = {}
      for (const key of keys) from[key] = plan[i][key]
      tl.fromTo(st[i], from, { ...v, duration: dur, ease, immediateRender: false, onUpdate: apply }, at)
      Object.assign(plan[i], v)
    }
    const END = 64

    /* b0: the triangle, and the five orbiting sources. */
    tl.addLabel('b0', 0)
    tl.set('.c4-tree', { opacity: 0 }, 0)
    tl.fromTo('.c4-tri', { strokeDashoffset: 3000 }, { strokeDashoffset: 0, duration: 2.4, ease: 'power2.inOut', immediateRender: false }, 0.3)
    fade(tl, '.c4-trifill', 1, 1.2, 1.4)
    tl.fromTo('.c4-corner', { opacity: 0 }, { opacity: 1, duration: 0.6, stagger: 1.4, immediateRender: false }, 5.0)
    ICONS.forEach((_, i) => {
      // the whole orbit, start to finish, as one slow turn
      iconTo(i, { s: DECK.s }, 1.6 + i * 0.4, 0.8, 'back.out(2)')
    })
    ICONS.forEach((_, i) => iconTo(i, { a: plan[i].a + Math.PI * 2.2 }, 0.2, END, 'none'))
    mapCam.to(tl, { x: 800, y: 480, zoom: 1 }, 0, 12, 'sine.inOut')

    /* b1-b5: each source slides to its place on the triangle. */
    const beats = [13.4, 20.6, 30, 38.6, 47.6]
    beats.forEach((b, i) => {
      tl.addLabel(`b${i + 1}`, b)
      iconTo(i, { k: 1, s: 1.25 }, b + 0.3, 1.4, 'power3.inOut')
      iconTo(i, { s: 1 }, b + 2.2, 0.8, 'power2.out')
      fade(tl, `.c4-lab-${i}`, 1, b + 1.4, 0.6)
      mapCam.to(tl, { x: (ICONS[i].x + 1600) / 3, y: 470, zoom: 1.06 }, b + 0.2, 2.4, 'power2.inOut')
      fade(tl, `.c4-glow-${i}`, 1, b + 1.4, 0.6)
      fade(tl, `.c4-glow-${i}`, 0, b + 5.4, 1, 1)
    })
    fade(tl, '.c4-crack', 1, beats[3] + 2.4, 0.4)
    tl.fromTo('.c4-crackline', { strokeDashoffset: 200 }, { strokeDashoffset: 0, duration: 0.5, ease: 'power3.out', immediateRender: false }, beats[3] + 2.4)
    fade(tl, '.c4-lock', 1, beats[4] + 2.6, 0.5)
    tl.fromTo('.c4-lock', { scale: 1.6, transformOrigin: '50% 50%' }, { scale: 1, transformOrigin: '50% 50%', duration: 0.5, ease: 'back.out(2)', immediateRender: false }, beats[4] + 2.6)

    /* b6: the map folds into the course tree; the next node lights. */
    const b6 = 56.6
    tl.addLabel('b6', b6)
    mapCam.to(tl, { x: 800, y: 470, zoom: 0.92 }, b6, 1.2, 'power2.inOut')
    tl.fromTo('.c4-map', { scale: 1, rotation: 0, x: 0, y: 0, svgOrigin: '800 470' }, { scale: 0.06, rotation: -14, x: TREE_NODES[0].x - 800, y: TREE_NODES[0].y - 470, svgOrigin: '800 470', duration: 1.8, ease: 'power3.inOut', immediateRender: false }, b6 + 0.6)
    fade(tl, '.c4-map', 0, b6 + 2.0, 0.4, 1)
    fade(tl, '.c4-tree', 1, b6 + 0.8, 1.0)
    treeCam.to(tl, { x: (TREE_NODES[0].x + TREE_NODES[1].x) / 2 - 60, y: (TREE_NODES[0].y + TREE_NODES[1].y) / 2 - 40, zoom: 1.5 }, b6 + 1.0, 3.6, 'power2.inOut')
    tl.fromTo('.c4-tree .ct-node-1', { opacity: 0.55 }, { opacity: 1, duration: 0.6, immediateRender: false }, b6 + 2.8)
    tl.fromTo('.c4-tree .ct-dot-1', { opacity: 0.3 }, { opacity: 1, duration: 0.6, immediateRender: false }, b6 + 2.8)
    fade(tl, '.c4-nextglow', 1, b6 + 2.8, 0.8)
    tl.to({}, { duration: 0.5 }, b6 + 5.8)
  }, [])
  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useAmbient(root, playing, () => {
    gsap.to('.c4-trifill', { opacity: 0.6, duration: 3, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    gsap.to('.c4-nextglow', { scale: 1.3, transformOrigin: '50% 50%', duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' })
  })

  useEffect(() => {
    reportState(STATE[cueIndex] ?? '')
    setHints([])
  }, [cueIndex, reportState, setHints])

  const tri = `M${TRUE.x} ${TRUE.y} L${DIVERSE.x} ${DIVERSE.y} L${CHEAP.x} ${CHEAP.y} Z`

  return (
    <g ref={root}>
      <DgDefs />
      {/* ---------- the map ---------- */}
      <g className="c4-mapcam" ref={mapRef}>
        <g data-depth="0.4">
          <rect x={-800} y={-600} width={3200} height={2100} fill={C.ink} />
          <Pool x={800} y={500} r={900} color="lime" opacity={0.12} />
        </g>
        <g data-depth="1">
          <g className="c4-map">
            <path className="c4-trifill" d={tri} fill={C.lime} opacity={0} fillOpacity={0.05} />
            <path className="c4-tri" d={tri} fill="none" stroke={C.lime} strokeWidth={4} strokeLinejoin="round" strokeDasharray={3000} strokeDashoffset={3000} filter="url(#cn-bloom)" />
            {/* the corners */}
            <g className="c4-corner" opacity={0}>
              <circle cx={CHEAP.x} cy={CHEAP.y} r={12} fill={C.gold} />
              <text x={CHEAP.x - 10} y={CHEAP.y + 52} textAnchor="middle" fill={C.gold} fontFamily={SERIF} fontSize={40} fontWeight={600}>
                cheap
              </text>
            </g>
            <g className="c4-corner" opacity={0}>
              <circle cx={TRUE.x} cy={TRUE.y} r={12} fill={C.lime} />
              <text x={TRUE.x} y={TRUE.y - 28} textAnchor="middle" fill={C.limeLight} fontFamily={SERIF} fontSize={40} fontWeight={600}>
                true to the robot
              </text>
            </g>
            <g className="c4-corner" opacity={0}>
              <circle cx={DIVERSE.x} cy={DIVERSE.y} r={12} fill={C.cyan} />
              <text x={DIVERSE.x + 10} y={DIVERSE.y + 52} textAnchor="middle" fill={C.cyanLight} fontFamily={SERIF} fontSize={40} fontWeight={600}>
                diverse
              </text>
            </g>

            {/* 1: Kofi in a headset, driving Seven */}
            <g className="c4-icon-0" transform={`translate(${DECK.x} ${DECK.y}) scale(0)`}>
              <g className="c4-glow-0" opacity={0}>
                <circle r={R + 30} fill="url(#cn-pool-lime)" />
              </g>
              <Medallion i={0}>
                <rect x={-R} y={-R} width={2 * R} height={2 * R} fill={C.ink2} />
                <Person name="c4-kofi" x={-24} y={50} s={0.3} pose={{ ...POSES.stand, armN: 62, elbowN: 64, armF: 50, elbowF: 74 }} light="none" {...KOFI} />
                <Robot name="c4-seven" x={22} y={50} s={0.3} pose={{ ...POSES.stand, armN: 62, elbowN: 64, armF: 50, elbowF: 74 }} light="none" />
                <path className="dg-flow" d="M-8 -36 Q 6 -48 24 -36" stroke={C.cyan} strokeWidth={2.5} fill="none" strokeDasharray="4 4" />
              </Medallion>
            </g>
            {/* 2: a glove and a handheld gripper with a camera */}
            <g className="c4-icon-1" transform={`translate(${DECK.x} ${DECK.y}) scale(0)`}>
              <g className="c4-glow-1" opacity={0}>
                <circle r={R + 30} fill="url(#cn-pool-lime)" />
              </g>
              <Medallion i={1}>
                <g transform="translate(-22 4)">
                  <path d="M-16 30 L-18 -4 L-24 -26 Q-20 -32 -14 -24 L-8 -8 L-8 -36 Q-2 -42 2 -36 L4 -10 L8 -38 Q14 -42 16 -36 L14 -8 L22 -32 Q28 -34 28 -26 L20 0 L22 30 Z" fill={C.slate} stroke={C.mist} strokeWidth={2} />
                  {[[-12, -22], [-2, -32], [12, -30], [24, -24], [-4, 6], [12, 8]].map(([x, y], k) => (
                    <circle key={k} cx={x} cy={y} r={2.6} fill={C.lime} />
                  ))}
                </g>
                <g transform="translate(26 6) rotate(-10)">
                  <rect x={-6} y={0} width={12} height={36} rx={4} fill={C.mist} />
                  <rect x={-16} y={-10} width={32} height={14} rx={3} fill={C.slate} />
                  <rect x={-16} y={-34} width={6} height={26} rx={2} fill={C.mist} />
                  <rect x={10} y={-34} width={6} height={26} rx={2} fill={C.mist} />
                  <rect x={-8} y={-22} width={16} height={12} rx={2} fill={C.ink} stroke={C.lime} strokeWidth={1.5} />
                  <circle cx={0} cy={-16} r={3} fill={C.lime} />
                </g>
              </Medallion>
            </g>
            {/* 3: a head camera and video of people */}
            <g className="c4-icon-2" transform={`translate(${DECK.x} ${DECK.y}) scale(0)`}>
              <g className="c4-glow-2" opacity={0}>
                <circle r={R + 30} fill="url(#cn-pool-lime)" />
              </g>
              <Medallion i={2}>
                <rect x={-R} y={-R} width={2 * R} height={2 * R} fill="url(#dg-kitchen2)" opacity={0.5} />
                <path d="M-40 40 Q-46 -6 -20 -22 Q4 -34 18 -14 L22 -4 L16 0 L18 10 Q10 18 0 18 L-4 40 Z" fill={C.ink} />
                <rect x={6} y={-30} width={18} height={12} rx={2} fill={C.slate} />
                <circle cx={22} cy={-24} r={4} fill={C.lime} />
                {[0, 1, 2].map((k) => (
                  <rect key={k} x={10 + k * 10} y={18 + k * 10} width={34} height={22} rx={2} fill="url(#dg-kitchen)" stroke={C.keyLight} strokeOpacity={0.5} />
                ))}
              </Medallion>
            </g>
            {/* 4: a wireframe hand in a glowing grid */}
            <g className="c4-icon-3" transform={`translate(${DECK.x} ${DECK.y}) scale(0)`}>
              <g className="c4-glow-3" opacity={0}>
                <circle r={R + 30} fill="url(#cn-pool-lime)" />
              </g>
              <Medallion i={3}>
                <rect x={-R} y={-R} width={2 * R} height={2 * R} fill="url(#cn-grid)" />
                <path d="M-62 30 L62 30 M-62 10 L62 10 M-40 -62 L-40 62 M0 -62 L0 62 M40 -62 L40 62" stroke={C.cyan} strokeOpacity={0.3} />
                <Hand3D store={sim} x={0} y={34} look="xray" arm={0} />
              </Medallion>
              <g className="c4-crack" opacity={0}>
                <path className="c4-crackline" d="M-30 -66 L-12 -30 L-26 -6 L4 12 L-10 34 L14 70" fill="none" stroke={C.danger} strokeWidth={4} strokeLinejoin="round" strokeDasharray={200} strokeDashoffset={200} />
                <text x={0} y={R + 34} textAnchor="middle" fill={C.danger} fontFamily={SANS} fontSize={22} fontWeight={600} stroke={C.ink} strokeWidth={5} style={{ paintOrder: 'stroke' }}>
                  reality gap
                </text>
              </g>
            </g>
            {/* 5: a fleet, its data flowing home */}
            <g className="c4-icon-4" transform={`translate(${DECK.x} ${DECK.y}) scale(0)`}>
              <g className="c4-glow-4" opacity={0}>
                <circle r={R + 30} fill="url(#cn-pool-lime)" />
              </g>
              <Medallion i={4}>
                <rect x={-14} y={-48} width={28} height={40} rx={4} fill={C.ink3} stroke={C.lime} strokeWidth={2} />
                {[0, 1, 2].map((k) => (
                  <rect key={k} x={-8} y={-42 + k * 12} width={16} height={4} fill={C.lime} opacity={0.7} />
                ))}
                {[-38, 0, 38].map((x, k) => (
                  <g key={k}>
                    <path className="dg-flow" d={`M${x} 24 Q ${x / 2} 0 0 -8`} stroke={C.lime} strokeWidth={2.5} fill="none" strokeDasharray="3 5" />
                    <path d={`M${x - 10} 30 Q${x - 10} 16 ${x} 16 Q${x + 10} 16 ${x + 10} 30 L${x + 10} 44 L${x - 10} 44 Z`} fill={C.shell} />
                    <path d={`M${x - 4} 24 H${x + 8}`} stroke={C.cyan} strokeWidth={3} strokeLinecap="round" />
                  </g>
                ))}
              </Medallion>
              <g className="c4-lock" opacity={0} transform={`translate(${R * 0.72} ${-R * 0.72})`}>
                <circle r={20} fill={C.ink} stroke={C.gold} strokeWidth={2} />
                <rect x={-9} y={-3} width={18} height={14} rx={2} fill={C.gold} />
                <path d="M-6 -3 V-8 Q0 -16 6 -8 V-3" stroke={C.gold} strokeWidth={3} fill="none" />
              </g>
            </g>

            {/* the labels, once each source lands */}
            {ICONS.map((ic, i) => (
              <g key={i} className={`c4-lab-${i}`} opacity={0} pointerEvents="none">
                <text x={ic.x + ic.lx} y={ic.y - 4} textAnchor={ic.anchor} fill={C.paper} fontFamily={SANS} fontSize={24} fontWeight={600} stroke={C.ink} strokeWidth={8} strokeLinejoin="round" style={{ paintOrder: 'stroke' }}>
                  {ic.name}
                </text>
                <text x={ic.x + ic.lx} y={ic.y + 22} textAnchor={ic.anchor} fill={C.lime} opacity={0.85} fontFamily={MONO} fontSize={16} stroke={C.ink} strokeWidth={7} strokeLinejoin="round" style={{ paintOrder: 'stroke' }}>
                  {ic.sub}
                </text>
              </g>
            ))}
            <g className="c4-lab-4" opacity={0} pointerEvents="none">
              <text x={ICONS[4].x + 84} y={ICONS[4].y + 46} fill={C.gold} fontFamily={MONO} fontSize={16} stroke={C.ink} strokeWidth={7} strokeLinejoin="round" style={{ paintOrder: 'stroke' }}>
                locked until it works well enough to deploy
              </text>
            </g>
          </g>
          <Dust x={0} y={0} w={1600} h={900} count={30} seed={41} color={C.lime} size={0.6} />
        </g>
      </g>

      {/* ---------- the course tree ---------- */}
      <g className="c4-tree" ref={treeRef} opacity={0}>
        <g data-depth="0.4">
          <Blueprint />
        </g>
        <g data-depth="1">
          <g className="c4-nextglow" opacity={0}>
            <circle cx={TREE_NODES[1].x} cy={TREE_NODES[1].y} r={60} fill="url(#cn-pool-lime)" />
          </g>
          <CourseTree p="ct" here={0} />
          <text x={TREE_NODES[1].x + 36} y={TREE_NODES[1].y + 40} fill={C.lime} fontFamily={MONO} fontSize={16} opacity={0.8}>
            next: making data
          </text>
        </g>
      </g>
      <Vignette />
    </g>
  )
}

export const ch4: Chapter = {
  id: 'map',
  title: 'Five ways to make data',
  cues: CUES,
  Scene: Ch4Map,
  enter: { type: 'zoom', x: 1132, y: 402 },
  deeper: [SourcesReading],
}
