import gsap from 'gsap'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { At, Label, Moon, Sky, Stars, Sun } from '../art/kit'
import { C } from '../art/palette'
import { useBeatTimeline } from '../engine/useBeatTimeline'
import type { SceneProps, Stop } from '../engine/types'

/*
 * Teaser: What comes next? (the violet branch)
 * A one-minute sneak peek at patterns. It starts with patterns the student already lives
 * inside (day and night, the seasons), shows that a pattern lets you predict, asks one
 * quick bead puzzle that only works if you find the repeating chunk, and ends with skip
 * counting as a pattern on the number line.
 */

const BEATS = [
  { id: 'everywhere', say: 'Patterns are everywhere. Day, night, day, night. Spring, summer, fall, winter, and around again.' },
  { id: 'predict', say: 'Spotting a pattern lets you say what comes next, before it even happens. That is a superpower farmers, scientists and musicians use.' },
  { id: 'beads', say: 'Your turn! Here is a trickier one. Which bead comes next?', challenge: true, quick: true },
  { id: 'skip-counting', say: 'Counting by twos, fives and tens is a pattern too. This branch of the knowledge tree will grow soon!' },
]

/* ---------------------------------------------------------------- colours and helpers */

type BeadColor = 'red' | 'blue' | 'yellow'
const BEAD: Record<BeadColor, { fill: string; dark: string }> = {
  red: { fill: '#E5484D', dark: '#B9343B' },
  blue: { fill: C.sky, dark: C.skyDark },
  yellow: { fill: C.sun, dark: C.mustardDark },
}
const VIOLET_LIGHT = '#B9ACFF'

/** Milliseconds to let a spoken line finish before moving on (about 2.5 words a second). */
function lineMs(text: string) {
  return Math.max(3000, (text.split(/\s+/).length / 2.5) * 1000 + 900)
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

/** A clockwise arc along a circle with an arrowhead at its end. */
function arrowArc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p0 = polar(cx, cy, r, a0)
  const p1 = polar(cx, cy, r, a1)
  const t = ((a1 + 90) * Math.PI) / 180
  const dir = { x: Math.cos(t), y: Math.sin(t) }
  const perp = { x: -dir.y, y: dir.x }
  const tip = { x: p1.x + dir.x * 14, y: p1.y + dir.y * 14 }
  const base = { x: p1.x - dir.x * 8, y: p1.y - dir.y * 8 }
  const l = { x: base.x + perp.x * 15, y: base.y + perp.y * 15 }
  const rr = { x: base.x - perp.x * 15, y: base.y - perp.y * 15 }
  return {
    arc: `M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A ${r} ${r} 0 0 1 ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`,
    head: `M ${tip.x.toFixed(1)} ${tip.y.toFixed(1)} L ${l.x.toFixed(1)} ${l.y.toFixed(1)} L ${rr.x.toFixed(1)} ${rr.y.toFixed(1)} Z`,
  }
}

/** A hop arch from x0 to x1 that matches a linear x move with a sine-eased bounce in y. */
function archPath(x0: number, x1: number, y: number, h: number) {
  const pts: string[] = []
  for (let i = 0; i <= 24; i++) {
    const u = i / 24
    pts.push(`${(x0 + (x1 - x0) * u).toFixed(1)} ${(y - h * Math.sin(Math.PI * u)).toFixed(1)}`)
  }
  return `M ${pts.join(' L ')}`
}

/* ---------------------------------------------------------------- layout */

const WIN = { x: 80, y: 110, w: 700, h: 590 }
const ORBIT = { cx: 430, cy: 620, r: 345 }
const WORDS = [
  { text: 'day,', x: 170, night: false },
  { text: 'night,', x: 315, night: true },
  { text: 'day,', x: 465, night: false },
  { text: 'night,', x: 610, night: true },
  { text: '...', x: 725, night: true },
]
const WHEEL = { cx: 1190, cy: 440, r: 240 }
const SEASONS = [
  { name: 'spring', bg: '#DFF4D8', a: -90 },
  { name: 'summer', bg: '#D2EEFA', a: 0 },
  { name: 'fall', bg: '#FDE6CC', a: 90 },
  { name: 'winter', bg: '#E8EDF6', a: 180 },
]

const BEAD_Y = 290
const beadX = (i: number) => 290 + i * 170
const INTRO: BeadColor[] = ['red', 'blue', 'red', 'blue', 'red', 'blue']

const NL = { x0: 200, unit: 120, y: 300, ball: 274, hop: 110 }
const nlX = (n: number) => NL.x0 + n * NL.unit

/* ---------------------------------------------------------------- scene */

function Scene(props: SceneProps) {
  const { beatIndex, playing, onAnimDone } = props
  const root = useRef<SVGGElement>(null)

  useBeatTimeline(
    root,
    (tl) => {
      const orb = `${ORBIT.cx} ${ORBIT.cy}`

      // Starting state.
      tl.set(['.g-daynight', '.g-seasons', '.g-words', '.g-beads', '.g-nl', '.end-card'], { opacity: 0 }, 0)
      tl.set('.dn-orbit', { rotation: 0, svgOrigin: orb }, 0)
      tl.set(['.dn-night', '.dn-hills-night'], { opacity: 0 }, 0)
      tl.set('.nl-hopper', { x: 0 }, 0)
      WORDS.forEach((_, i) => tl.set(`.dn-word-${i}`, { opacity: 0, y: 16 }, 0))
      SEASONS.forEach((_, i) => {
        tl.set(`.ss-ring-${i}`, { opacity: 0 }, 0)
        tl.set(`.ss-tile-${i}`, { scale: 1, transformOrigin: '50% 50%' }, 0)
        tl.set(`.ss-arrow-${i}`, { opacity: 0.3 }, 0)
      })

      // b0: day and night take turns, and the seasons go round.
      tl.addLabel('b0', 0.01)
      const at0 = (t: number) => `b0+=${t}`
      tl.fromTo('.g-daynight', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, 'b0')
      tl.fromTo('.g-seasons', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, at0(0.25))
      tl.set('.g-words', { opacity: 1 }, 'b0')
      const word = (i: number, t: number) => tl.to(`.dn-word-${i}`, { opacity: 1, y: 0, duration: 0.35, ease: 'back.out(2)' }, at0(t))
      const turn = (k: number, night: boolean, t: number) => {
        tl.to('.dn-orbit', { rotation: 180 * k, svgOrigin: orb, duration: 0.9, ease: 'power1.inOut' }, at0(t))
        tl.to(['.dn-night', '.dn-hills-night'], { opacity: night ? 1 : 0, duration: 0.7 }, at0(t + 0.15))
      }
      word(0, 1.3)
      turn(1, true, 1.6)
      word(1, 2.2)
      turn(2, false, 2.6)
      word(2, 3.2)
      turn(3, true, 3.6)
      word(3, 4.2)
      word(4, 4.5)
      const highlight = (i: number, t: number) => {
        SEASONS.forEach((_, k) => {
          tl.to(`.ss-ring-${k}`, { opacity: k === i ? 1 : 0, duration: 0.3 }, at0(t))
          tl.to(`.ss-tile-${k}`, { scale: k === i ? 1.08 : 1, duration: 0.35, ease: 'back.out(2)' }, at0(t))
        })
      }
      const arrow = (i: number, t: number) =>
        tl.fromTo(`.ss-arrow-${i}`, { opacity: 0.3 }, { opacity: 1, duration: 0.25, yoyo: true, repeat: 1 }, at0(t))
      highlight(0, 4.8)
      arrow(0, 5.3)
      highlight(1, 5.6)
      arrow(1, 6.1)
      highlight(2, 6.4)
      arrow(2, 6.9)
      highlight(3, 7.2)
      arrow(3, 7.7)
      highlight(0, 8.0)

      // b1: a simple bead pattern, its repeating chunk, and the prediction.
      tl.addLabel('b1', 'b0+=8.8')
      const at1 = (t: number) => `b1+=${t}`
      tl.to(['.g-daynight', '.g-seasons', '.g-words'], { opacity: 0, duration: 0.5 }, 'b1')
      tl.set('.g-beads', { opacity: 1 }, at1(0.4))
      tl.fromTo('.bd-string', { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.6, ease: 'power2.out' }, at1(0.4))
      INTRO.forEach((_, i) => {
        tl.fromTo(`.bd-${i}`, { opacity: 0, y: -70 }, { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(2)' }, at1(0.7 + i * 0.25))
      })
      tl.fromTo('.bd-spot', { opacity: 0, scale: 0.4, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, at1(2.3))
      for (let k = 0; k < 3; k++) {
        tl.fromTo(`.bd-chunk-${k}`, { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }, at1(2.9 + k * 0.45))
      }
      tl.fromTo('.bd-chunk-3', { opacity: 0 }, { opacity: 1, duration: 0.35 }, at1(4.3))
      tl.fromTo('.bd-fill', { opacity: 0, y: -150 }, { opacity: 1, y: 0, duration: 0.6, ease: 'bounce.out' }, at1(4.7))
      tl.to('.bd-spot', { opacity: 0, duration: 0.3 }, at1(5.0))
      tl.fromTo('.bd-check', { opacity: 0, scale: 0.3, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, at1(5.2))
      for (let k = 0; k < 3; k++) {
        tl.fromTo(`.bd-badge-${k}`, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.45, ease: 'back.out(1.6)' }, at1(6.0 + k * 0.8))
      }

      // b2: the quick bead puzzle draws itself on a clear stage.
      tl.addLabel('b2', 'b1+=8.8')
      tl.to('.g-beads', { opacity: 0, duration: 0.5 }, 'b2')

      // b3: skip counting by twos on the number line, then the coming-soon card.
      tl.addLabel('b3', 'b2+=0.6')
      const at3 = (t: number) => `b3+=${t}`
      tl.set('.g-nl', { opacity: 1 }, 'b3')
      tl.fromTo('.nl-axis', { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.7, ease: 'power2.out' }, 'b3')
      tl.fromTo('.nl-nums', { opacity: 0 }, { opacity: 1, duration: 0.4 }, at3(0.3))
      tl.fromTo('.nl-hopper', { opacity: 0, scale: 0.3, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' }, at3(0.6))
      for (let k = 0; k < 5; k++) {
        const t = 1.0 + k * 0.72
        tl.to('.nl-hopper', { x: (k + 1) * 2 * NL.unit, duration: 0.6, ease: 'none' }, at3(t))
        tl.fromTo('.nl-hop-y', { y: 0 }, { y: -NL.hop, duration: 0.3, ease: 'sine.out', yoyo: true, repeat: 1 }, at3(t))
        tl.fromTo(`.nl-arc-${k}`, { attr: { 'stroke-dashoffset': 1 } }, { attr: { 'stroke-dashoffset': 0 }, duration: 0.6, ease: 'none' }, at3(t))
        tl.fromTo(`.nl-plus-${k}`, { opacity: 0 }, { opacity: 1, duration: 0.25 }, at3(t + 0.45))
        tl.fromTo(`.nl-hit-${k}`, { opacity: 0, scale: 0.4, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(3)' }, at3(t + 0.6))
      }
      tl.fromTo('.end-card', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, at3(4.8))
      tl.fromTo('.end-branch', { attr: { 'stroke-dashoffset': 1 } }, { attr: { 'stroke-dashoffset': 0 }, duration: 1.2, ease: 'power1.inOut' }, at3(5.2))
      LEAVES.forEach((_, i) => {
        tl.fromTo(`.end-leaf-${i}`, { scale: 0, svgOrigin: '0 0' }, { scale: 1, svgOrigin: '0 0', duration: 0.35, ease: 'back.out(2.4)' }, at3(5.8 + i * 0.15))
      })
      tl.fromTo('.end-buds', { opacity: 0 }, { opacity: 1, duration: 0.5 }, at3(6.8))
      tl.to({}, { duration: 0.01 }, at3(7.6))
    },
    beatIndex,
    playing,
    onAnimDone,
  )

  const id = BEATS[beatIndex]?.id

  return (
    <g ref={root}>
      <Sky top="#E9E3FF" low={C.cream} />
      <DayNight />
      <SeasonsWheel />
      <IntroBeads />
      <NumberLine />
      <ComingSoonCard />
      {id === 'beads' && <BeadPuzzle {...props} />}
    </g>
  )
}

/* ---------------------------------------------------------------- b0: day and night */

function DayNight() {
  const uid = useId().replace(/:/g, '')
  return (
    <>
      <g className="g-daynight" data-tutor="day and night picture">
        <defs>
          <clipPath id={`win${uid}`}>
            <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} rx={40} />
          </clipPath>
        </defs>
        <rect x={WIN.x} y={WIN.y + 10} width={WIN.w} height={WIN.h} rx={40} fill={C.ink} opacity={0.12} />
        <g clipPath={`url(#win${uid})`}>
          <Sky />
          <g className="dn-night">
            <Sky top={C.skyNight} low={C.skyNightLow} />
            <Stars />
          </g>
          <g className="dn-orbit">
            <At x={ORBIT.cx} y={ORBIT.cy - ORBIT.r}><Sun r={58} /></At>
            <At x={ORBIT.cx} y={ORBIT.cy + ORBIT.r}><Moon r={48} /></At>
          </g>
          <path d="M 80 610 C 200 535 320 540 450 590 C 570 525 690 525 780 565 L 780 700 L 80 700 Z" fill={C.hillFar} />
          <path d="M 80 655 C 300 600 560 605 780 640 L 780 700 L 80 700 Z" fill={C.grass} />
          <g className="dn-hills-night">
            <path d="M 80 610 C 200 535 320 540 450 590 C 570 525 690 525 780 565 L 780 700 L 80 700 Z" fill={C.hillNightFar} />
            <path d="M 80 655 C 300 600 560 605 780 640 L 780 700 L 80 700 Z" fill={C.hillNight} />
          </g>
        </g>
        <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} rx={40} fill="none" stroke={C.white} strokeWidth={10} />
      </g>
      <g className="g-words" data-tutor="day and night words">
        {WORDS.map((w, i) => (
          <g key={i} className={`dn-word-${i}`}>
            <At x={w.x} y={772}>
              <Label text={w.text} size={42} color={w.night ? C.violetDark : C.mustardDark} />
            </At>
          </g>
        ))}
      </g>
    </>
  )
}

/* ---------------------------------------------------------------- b0: the seasons wheel */

function SeasonsWheel() {
  return (
    <g className="g-seasons" data-tutor="the seasons circle">
      {SEASONS.map((s, i) => {
        const { arc, head } = arrowArc(WHEEL.cx, WHEEL.cy, WHEEL.r, s.a + 30, s.a + 60)
        return (
          <g key={`arrow-${i}`} className={`ss-arrow-${i}`}>
            <path d={arc} stroke={C.violet} strokeWidth={9} strokeLinecap="round" fill="none" />
            <path d={head} fill={C.violet} />
          </g>
        )
      })}
      {SEASONS.map((s, i) => {
        const p = polar(WHEEL.cx, WHEEL.cy, WHEEL.r, s.a)
        return (
          <At key={s.name} x={p.x} y={p.y} data-tutor={`${s.name} tree`}>
            <g className={`ss-ring-${i}`}>
              <rect x={-99} y={-109} width={198} height={218} rx={36} fill="none" stroke={C.violet} strokeWidth={8} />
            </g>
            <g className={`ss-tile-${i}`}>
              <rect x={-85} y={-95} width={170} height={190} rx={28} fill={s.bg} stroke={C.white} strokeWidth={6} />
              <At y={30} s={0.85}><SeasonTree season={i} /></At>
              <At y={70}><Label text={s.name} size={30} weight={700} /></At>
            </g>
          </At>
        )
      })}
    </g>
  )
}

/** One small tree, drawn for spring (0), summer (1), fall (2) or winter (3). Base at the origin. */
function SeasonTree({ season }: { season: number }) {
  const canopy = [
    { cx: 0, cy: -92, r: 40 },
    { cx: -32, cy: -68, r: 28 },
    { cx: 32, cy: -68, r: 28 },
  ]
  const fill = season === 0 ? C.grassLight : season === 1 ? C.leaf : '#F28C38'
  const shine = season === 0 ? '#C7EBAE' : season === 1 ? C.grass : C.mustard
  return (
    <g>
      <ellipse cx={0} cy={2} rx={64} ry={10} fill={season === 3 ? C.white : C.grass} />
      <path d="M -9 0 L -6 -60 L 6 -60 L 9 0 Z" fill={C.woodDark} />
      {season === 3 ? (
        <g>
          <path d="M 0 -56 L 0 -110 M 0 -74 L -34 -102 M 0 -66 L 34 -96 M 0 -96 L -18 -120 M 0 -92 L 20 -118" stroke={C.woodDark} strokeWidth={7} strokeLinecap="round" fill="none" />
          {[[-34, -104], [34, -98], [-18, -122], [20, -120], [0, -112]].map(([x, y], k) => (
            <ellipse key={k} cx={x} cy={y} rx={9} ry={5} fill={C.white} />
          ))}
          {[[-52, -60], [46, -40], [-40, -20], [56, -86], [-60, -100]].map(([x, y], k) => (
            <circle key={`f${k}`} cx={x} cy={y} r={4} fill={C.white} />
          ))}
        </g>
      ) : (
        <g>
          {canopy.map((c, k) => (
            <circle key={k} cx={c.cx} cy={c.cy} r={c.r} fill={fill} />
          ))}
          <circle cx={-12} cy={-108} r={18} fill={shine} opacity={0.8} />
          {season === 0 &&
            [[-20, -96], [14, -110], [24, -78], [-36, -66], [6, -72], [38, -62]].map(([x, y], k) => (
              <circle key={k} cx={x} cy={y} r={6} fill="#F7A8C4" />
            ))}
          {season === 1 &&
            [[-22, -78], [20, -92], [30, -62]].map(([x, y], k) => (
              <circle key={k} cx={x} cy={y} r={7} fill={C.coralDark} />
            ))}
          {season === 2 && (
            <g>
              <ellipse cx={52} cy={-30} rx={9} ry={5} fill="#F28C38" transform="rotate(30 52 -30)" />
              <ellipse cx={-50} cy={-14} rx={9} ry={5} fill={C.mustard} transform="rotate(-25 -50 -14)" />
            </g>
          )}
        </g>
      )}
    </g>
  )
}

/* ---------------------------------------------------------------- b1: predicting beads */

function Bead({ color, r = 46 }: { color: BeadColor; r?: number }) {
  const b = BEAD[color]
  return (
    <g>
      <circle r={r} fill={b.fill} />
      <path d={`M ${-r} 0 A ${r} ${r} 0 0 0 ${r} 0 A ${r} ${r * 0.55} 0 0 1 ${-r} 0 Z`} fill={b.dark} opacity={0.35} />
      <ellipse cx={-r * 0.36} cy={-r * 0.42} rx={r * 0.3} ry={r * 0.17} fill={C.white} opacity={0.6} transform={`rotate(-30 ${-r * 0.36} ${-r * 0.42})`} />
    </g>
  )
}

function Bracket({ x0, x1, y, dashed = false }: { x0: number; x1: number; y: number; dashed?: boolean }) {
  return (
    <path
      d={`M ${x0} ${y} L ${x0} ${y + 16} L ${x1} ${y + 16}${dashed ? '' : ` L ${x1} ${y}`}`}
      stroke={C.violet}
      strokeWidth={6}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={dashed ? '4 14' : undefined}
      fill="none"
    />
  )
}

function IntroBeads() {
  return (
    <g className="g-beads">
      <g className="bd-string">
        <line x1={170} y1={BEAD_Y} x2={1440} y2={BEAD_Y} stroke={C.inkSoft} strokeWidth={6} strokeLinecap="round" />
      </g>
      <g data-tutor="the bead pattern">
        {INTRO.map((c, i) => (
          <At key={i} x={beadX(i)} y={BEAD_Y}>
            <g className={`bd-${i}`}><Bead color={c} /></g>
          </At>
        ))}
      </g>
      <At x={beadX(6)} y={BEAD_Y} data-tutor="the empty spot">
        <g className="bd-spot">
          <circle r={62} fill={C.violet} opacity={0.22} className="pulse" />
          <circle r={46} fill={C.white} stroke={C.violet} strokeWidth={5} strokeDasharray="10 10" />
          <Label text="?" size={56} color={C.violetDark} />
        </g>
      </At>
      <At x={beadX(6)} y={BEAD_Y}>
        <g className="bd-fill"><Bead color="red" /></g>
      </At>
      <At x={beadX(6) + 46} y={BEAD_Y - 52}>
        <g className="bd-check">
          <circle r={20} fill={C.violet} stroke={C.white} strokeWidth={4} />
          <path d="M -9 0 l 6 6 l 12 -13" stroke={C.white} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </At>
      {[0, 1, 2].map((k) => (
        <g key={k} className={`bd-chunk-${k}`}>
          <Bracket x0={beadX(2 * k) - 56} x1={beadX(2 * k + 1) + 56} y={354} />
          <At x={(beadX(2 * k) + beadX(2 * k + 1)) / 2} y={420}>
            <Label text="red, blue" size={32} color={C.violetDark} weight={700} />
          </At>
        </g>
      ))}
      <g className="bd-chunk-3">
        <Bracket x0={beadX(6) - 56} x1={1440} y={354} dashed />
      </g>
      {['farmers', 'scientists', 'musicians'].map((name, k) => (
        <At key={name} x={480 + k * 320} y={650} data-tutor={name}>
          <g className={`bd-badge-${k}`}>
            <rect x={-135} y={-107} width={270} height={230} rx={34} fill={C.ink} opacity={0.1} />
            <rect x={-135} y={-115} width={270} height={230} rx={34} fill={C.white} />
            <At y={-28}>{k === 0 ? <Sprout /> : k === 1 ? <Telescope /> : <Notes />}</At>
            <At y={72}><Label text={name} size={34} /></At>
          </g>
        </At>
      ))}
    </g>
  )
}

/** Farmers: plant when the seasons say so. */
function Sprout() {
  return (
    <g>
      <circle cx={52} cy={-46} r={16} fill={C.sun} />
      <path d="M -58 40 Q 0 4 58 40 Z" fill={C.woodDark} />
      <path d="M 0 28 L 0 -22" stroke={C.leaf} strokeWidth={8} strokeLinecap="round" />
      <path d="M 0 -4 C -10 -30 -42 -36 -52 -22 C -38 -2 -12 0 0 -4 Z" fill={C.leaf} />
      <path d="M 0 -16 C 12 -44 46 -50 54 -34 C 40 -14 14 -10 0 -16 Z" fill={C.grass} />
    </g>
  )
}

/** Scientists: predict the moon and the stars. */
function Telescope() {
  return (
    <g>
      <path d="M 40 -58 a 22 22 0 1 0 18 34 a 17 17 0 1 1 -18 -34 Z" fill={C.mustard} />
      <path d="M -2 6 L -30 46 M -2 6 L 26 46 M -2 6 L -2 46" stroke={C.inkSoft} strokeWidth={7} strokeLinecap="round" />
      <g transform="translate(-4 0) rotate(-28)">
        <rect x={-56} y={-15} width={92} height={30} rx={9} fill={C.sky} />
        <rect x={32} y={-21} width={20} height={42} rx={6} fill={C.skyDark} />
        <rect x={-68} y={-9} width={14} height={18} rx={4} fill={C.skyDark} />
      </g>
    </g>
  )
}

/** Musicians: rhythms repeat. */
function Notes() {
  return (
    <g>
      <ellipse cx={-28} cy={30} rx={18} ry={13} fill={C.violet} transform="rotate(-20 -28 30)" />
      <ellipse cx={30} cy={18} rx={18} ry={13} fill={C.violet} transform="rotate(-20 30 18)" />
      <rect x={-14} y={-38} width={8} height={68} rx={3} fill={C.violet} />
      <rect x={44} y={-50} width={8} height={68} rx={3} fill={C.violet} />
      <path d="M -14 -40 L 52 -54 L 52 -36 L -14 -22 Z" fill={C.violet} />
    </g>
  )
}

/* ---------------------------------------------------------------- b3: skip counting */

function NumberLine() {
  return (
    <g className="g-nl" data-tutor="the number line">
      <g className="nl-axis">
        <line x1={150} y1={NL.y} x2={1440} y2={NL.y} stroke={C.ink} strokeWidth={7} strokeLinecap="round" />
        <path d={`M 1428 ${NL.y - 16} L 1456 ${NL.y} L 1428 ${NL.y + 16}`} stroke={C.ink} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {Array.from({ length: 11 }, (_, n) => (
          <line key={n} x1={nlX(n)} y1={NL.y - 16} x2={nlX(n)} y2={NL.y + 16} stroke={C.ink} strokeWidth={5} strokeLinecap="round" />
        ))}
      </g>
      <g className="nl-nums">
        {Array.from({ length: 11 }, (_, n) => (
          <At key={n} x={nlX(n)} y={360}><Label text={String(n)} size={38} weight={700} color={C.inkSoft} /></At>
        ))}
      </g>
      {[0, 1, 2, 3, 4].map((k) => (
        <g key={k}>
          <path className={`nl-arc-${k}`} d={archPath(nlX(2 * k), nlX(2 * k + 2), NL.ball, NL.hop)} pathLength={1} strokeDasharray="1 1" stroke={VIOLET_LIGHT} strokeWidth={6} strokeLinecap="round" fill="none" />
          <g className={`nl-plus-${k}`}>
            <At x={nlX(2 * k + 1)} y={NL.ball - NL.hop - 40}><Label text="+2" size={32} color={C.violetDark} /></At>
          </g>
          <At x={nlX(2 * k + 2)} y={360}>
            <g className={`nl-hit-${k}`}>
              <circle r={32} fill={C.violet} />
              <Label text={String(2 * k + 2)} size={38} color={C.white} />
            </g>
          </At>
        </g>
      ))}
      <At x={nlX(0)} y={NL.ball}>
        <g className="nl-hopper" data-tutor="the hopping counter">
          <g className="nl-hop-y">
            <circle r={24} fill={C.violet} />
            <circle cx={-8} cy={-9} r={7} fill={C.white} opacity={0.5} />
          </g>
        </g>
      </At>
    </g>
  )
}

/* ---------------------------------------------------------------- coming soon */

const LEAVES = [
  { x: 150, y: 192, rot: -150 },
  { x: 196, y: 168, rot: -40 },
  { x: 262, y: 140, rot: -130 },
  { x: 250, y: 104, rot: 20 },
  { x: 316, y: 120, rot: -30 },
  { x: 372, y: 96, rot: -120 },
]

function Leaf() {
  return <path d="M 0 0 C 10 -14 34 -16 46 0 C 34 16 10 14 0 0 Z" fill={VIOLET_LIGHT} stroke={C.violet} strokeWidth={3} />
}

/** The end card: the violet branch of the knowledge tree, still only buds. */
function ComingSoonCard() {
  return (
    <At x={140} y={505}>
      <g className="end-card" data-tutor="coming soon card">
        <rect x={0} y={12} width={1320} height={330} rx={44} fill={C.ink} opacity={0.12} />
        <rect x={0} y={0} width={1320} height={330} rx={44} fill={C.white} stroke={C.violet} strokeWidth={6} />
        <path d="M 72 300 C 78 230 82 150 76 50" stroke={C.woodDark} strokeWidth={34} strokeLinecap="round" fill="none" />
        <path className="end-branch" d="M 84 220 C 160 196 220 150 290 138 C 340 130 370 112 404 84" pathLength={1} strokeDasharray="1 1" stroke={C.violet} strokeWidth={20} strokeLinecap="round" fill="none" />
        <path className="end-branch" d="M 214 158 C 236 128 246 106 240 76" pathLength={1} strokeDasharray="1 1" stroke={C.violet} strokeWidth={12} strokeLinecap="round" fill="none" />
        {LEAVES.map((l, i) => (
          <At key={i} x={l.x} y={l.y} rotate={l.rot}>
            <g className={`end-leaf-${i}`}><Leaf /></g>
          </At>
        ))}
        <g className="end-buds">
          {[[410, 78], [240, 70]].map(([x, y], i) => (
            <At key={i} x={x} y={y}>
              <circle r={26} fill={C.violet} opacity={0.25} className="pulse" />
              <circle r={14} fill={C.violet} />
              <circle cx={-4} cy={-5} r={4} fill={C.white} opacity={0.6} />
            </At>
          ))}
        </g>
        <At x={520} y={100}><Label text="What comes next?" size={56} color={C.violetDark} anchor="start" /></At>
        <At x={520} y={190}><Label text="This branch of the knowledge tree" size={36} weight={700} anchor="start" /></At>
        <At x={520} y={244}><Label text="will grow soon!" size={36} weight={700} anchor="start" /></At>
      </g>
    </At>
  )
}

/* ---------------------------------------------------------------- the quick bead puzzle */

const PUZZLE: BeadColor[] = ['red', 'blue', 'blue', 'red', 'blue', 'blue', 'red']
const ANSWER: BeadColor = 'blue'
const PY = 280
const slotX = (i: number) => 240 + i * 160
const CHOICES: { color: BeadColor; x: number }[] = [
  { color: 'red', x: 560 },
  { color: 'blue', x: 800 },
  { color: 'yellow', x: 1040 },
]

function BeadPuzzle({ onChallengeDone, say, emit, reportState, setHints }: SceneProps) {
  const [tried, setTried] = useState<BeadColor[]>([])
  const [trial, setTrial] = useState<BeadColor | null>(null)
  const [solved, setSolved] = useState(false)
  const timers = useRef<number[]>([])
  const slotRef = useRef<SVGGElement>(null)
  const showChunks = tried.length > 0 || solved

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  useEffect(() => {
    setHints([
      'Look at the beads from the start. Which part keeps coming back?',
      'Say the colours out loud in small chunks, and listen for the chunk that repeats.',
      'Each chunk is three beads long and starts with red. The last chunk has only just started. What is the second bead in every chunk?',
    ])
  }, [setHints])

  useEffect(() => {
    reportState(
      `Quick bead puzzle. The string shows red, blue, blue, red, blue, blue, red, then an empty glowing spot. Choices: red, blue, yellow. ` +
        `The student has tried: ${tried.length ? tried.join(', ') : 'nothing yet'}. ${showChunks ? 'Brackets now mark the chunks "red, blue, blue". ' : ''}` +
        `${solved ? 'Solved: they picked blue. ' : ''}Correct answer: blue, because the chunk red, blue, blue repeats and the last chunk has only its first bead. ` +
        `Likely mix-ups: picking red (not noticing the repeating chunk is three beads long, not two) or yellow (a new colour that is not in the pattern).`,
    )
  }, [tried, showChunks, solved, reportState])

  // A wrong bead wobbles in the spot before it pops back out; the right one settles in.
  useLayoutEffect(() => {
    const el = slotRef.current
    if (!el) return
    const tw = solved
      ? gsap.fromTo(el, { scale: 0.4, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.5, ease: 'back.out(2.5)' })
      : gsap.fromTo(el, { rotation: -10, transformOrigin: '50% 50%' }, { rotation: 10, duration: 0.12, yoyo: true, repeat: 5, ease: 'sine.inOut' })
    return () => {
      tw.kill()
    }
  }, [trial, solved])

  const pick = (c: BeadColor) => {
    if (solved || trial) return
    if (c === ANSWER) {
      setSolved(true)
      emit({ type: 'attempt', correct: true, detail: 'picked blue' })
      const line = 'Yes, blue! Red, blue, blue keeps repeating, so after red comes blue. You found the chunk that repeats.'
      say(line)
      timers.current.push(window.setTimeout(onChallengeDone, lineMs(line)))
      return
    }
    emit({ type: 'attempt', correct: false, detail: `picked ${c}` })
    setTried((t) => [...t, c])
    setTrial(c)
    say(
      c === 'yellow'
        ? 'Hmm, yellow is not in this pattern at all. Try saying it out loud in chunks: red, blue, blue... red, blue, blue... Then try again.'
        : 'Hmm, two reds side by side? Try saying it out loud in chunks: red, blue, blue... red, blue, blue... Then try again.',
    )
    timers.current.push(window.setTimeout(() => setTrial(null), 1900))
  }

  const inSlot = solved ? ANSWER : trial

  return (
    <g>
      <At x={800} y={150}><Label text="Which bead comes next?" size={48} /></At>
      <line x1={150} y1={PY} x2={1450} y2={PY} stroke={C.inkSoft} strokeWidth={6} strokeLinecap="round" />
      <g data-tutor="the bead pattern">
        {PUZZLE.map((c, i) => (
          <At key={i} x={slotX(i)} y={PY}><Bead color={c} r={50} /></At>
        ))}
      </g>
      <At x={slotX(7)} y={PY} data-tutor="the empty spot">
        {!inSlot && (
          <g>
            <circle r={66} fill={C.violet} opacity={0.22} className="pulse" />
            <circle r={50} fill={C.white} stroke={C.violet} strokeWidth={5} strokeDasharray="10 10" />
            <Label text="?" size={58} color={C.violetDark} />
          </g>
        )}
        {inSlot && (
          <g ref={slotRef} key={`${inSlot}-${tried.length}`} opacity={solved ? 1 : 0.85}>
            <Bead color={inSlot} r={50} />
          </g>
        )}
        {solved && (
          <At x={48} y={-56}>
            <circle r={22} fill={C.violet} stroke={C.white} strokeWidth={4} />
            <path d="M -10 0 l 7 7 l 13 -14" stroke={C.white} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </At>
        )}
      </At>
      {showChunks && (
        <g data-tutor="the chunks">
          {[0, 1].map((k) => (
            <g key={k}>
              <Bracket x0={slotX(3 * k) - 60} x1={slotX(3 * k + 2) + 60} y={346} />
              <At x={slotX(3 * k + 1)} y={410}><Label text="red, blue, blue" size={32} color={C.violetDark} weight={700} /></At>
            </g>
          ))}
          <Bracket x0={slotX(6) - 60} x1={1450} y={346} dashed />
          <At x={slotX(6) - 46} y={410}>
            <Label text={solved ? 'red, blue, ...' : 'red, ...'} size={32} color={C.violetDark} weight={700} anchor="start" />
          </At>
        </g>
      )}
      <rect x={380} y={500} width={840} height={290} rx={40} fill={C.white} opacity={0.92} />
      {CHOICES.map((ch) => {
        const off = solved ? ch.color !== ANSWER : tried.includes(ch.color)
        return (
          <g
            key={ch.color}
            transform={`translate(${ch.x} 615)`}
            onClick={() => pick(ch.color)}
            style={{ cursor: solved ? 'default' : 'pointer' }}
            opacity={off ? 0.4 : 1}
            role="button"
            data-tutor={`${ch.color} bead button`}
          >
            <circle r={78} fill="transparent" />
            {solved && ch.color === ANSWER && <circle r={76} fill="none" stroke={C.violet} strokeWidth={7} />}
            <Bead color={ch.color} r={62} />
            <At y={124}><Label text={ch.color} size={36} /></At>
          </g>
        )
      })}
    </g>
  )
}

export const teaserNext: Stop = {
  id: 'next',
  title: 'What comes next?',
  branch: 'next',
  teaser: true,
  beats: BEATS,
  Scene,
}
