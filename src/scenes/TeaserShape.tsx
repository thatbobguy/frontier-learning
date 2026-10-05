import gsap from 'gsap'
import { useEffect, useRef, useState } from 'react'
import { At, Cloud, Label, Sky } from '../art/kit'
import { C } from '../art/palette'
import { useBeatTimeline } from '../engine/useBeatTimeline'
import type { SceneProps, Stop } from '../engine/types'

/*
 * Teaser: How big? What shape? (the mustard branch)
 * A one-minute sneak peek at measuring and shapes. The same dragon measures 12 paper clips
 * or 4 footsteps, which is why people agreed on shared units like a ruler's. One quick
 * ribbon puzzle shows you measure the whole length, not just end to end. Then a peek at
 * shapes: every triangle has three sides and three corners, whatever its size or turn.
 */

const BEATS = [
  { id: 'measure', say: 'How long is this friendly dragon? We could measure it with paper clips, or with footsteps.' },
  { id: 'units', say: 'Different units give different numbers. Twelve paper clips, or four footsteps, for the very same dragon! That is why people agreed on shared units, like inches and centimetres.' },
  { id: 'ribbons', say: 'Your turn! Which ribbon is longer? Tap it.', challenge: true, quick: true },
  { id: 'shapes', say: 'Shapes have rules too. A triangle always has three sides and three corners, no matter how big or small. This branch of the knowledge tree will grow soon!' },
]

/* ---------------------------------------------------------------- layout */

/** The dragon lies with its tail tip at x, its nose at x + L, its belly on y. */
const DRAGON = { x: 140, y: 470, L: 1020 }
const CLIPS = 12
const FEET = 4
const CLIP_W = DRAGON.L / CLIPS
const FOOT_W = DRAGON.L / FEET
const ROW = { clipNums: 532, clips: 578, feet: 690, ruler: 788 }
const LABEL_X = 1215
const LABELS = [
  { text: '12 paper clips', y: ROW.clips },
  { text: '4 footsteps', y: ROW.feet },
  { text: '60 cm', y: ROW.ruler + 36 },
]
const CM = DRAGON.L / 60
const MUSTARD_PALE = '#FBE3A6'

/** Milliseconds to let a spoken line finish before moving on (about 2.5 words a second). */
function lineMs(text: string) {
  return Math.max(3000, (text.split(/\s+/).length / 2.5) * 1000 + 900)
}

type P = [number, number]

function cubicAt(p0: P, p1: P, p2: P, p3: P, t: number) {
  const u = 1 - t
  const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0]
  const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
  const dx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0])
  const dy = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1])
  return { x, y, dx, dy }
}

/** Triangular spikes standing out from a cubic curve; side flips which way is "out". */
function spikes(curve: [P, P, P, P], ts: number[], sizes: number[], side: 1 | -1) {
  return ts.map((t, i) => {
    const { x, y, dx, dy } = cubicAt(...curve, t)
    const len = Math.hypot(dx, dy) || 1
    const tx = dx / len
    const ty = dy / len
    const nx = (side * ty)
    const ny = (side * -tx)
    const s = sizes[i]
    const bx = x - nx * s * 0.35
    const by = y - ny * s * 0.35
    return `M ${(bx - tx * s * 0.6).toFixed(1)} ${(by - ty * s * 0.6).toFixed(1)} L ${(x + nx * s).toFixed(1)} ${(y + ny * s).toFixed(1)} L ${(bx + tx * s * 0.6).toFixed(1)} ${(by + ty * s * 0.6).toFixed(1)} Z`
  })
}

/* ---------------------------------------------------------------- scene */

function Scene(props: SceneProps) {
  const { beatIndex, playing, onAnimDone } = props
  const root = useRef<SVGGElement>(null)

  useBeatTimeline(
    root,
    (tl) => {
      // Starting state.
      tl.set(['.g-plain', '.g-tri', '.end-card', '.guides', '.ruler'], { opacity: 0 }, 0)
      tl.set('.world', { opacity: 1 }, 0)
      for (let i = 0; i < CLIPS; i++) {
        tl.set(`.clip-${i}`, { opacity: 0, y: -40 }, 0)
        tl.set(`.clipn-${i}`, { opacity: 0 }, 0)
      }
      for (let k = 0; k < FEET; k++) tl.set(`.foot-${k}`, { opacity: 0, scale: 0.6, transformOrigin: '50% 50%' }, 0)
      LABELS.forEach((_, k) => {
        tl.set(`.lbl-${k}`, { opacity: 0, x: -20, scale: 1, transformOrigin: '0% 50%' }, 0)
        tl.set(`.lbl-glow-${k}`, { opacity: 0 }, 0)
      })
      tl.set(['.band-0', '.band-1'], { opacity: 0 }, 0)
      tl.set('.dragon-hop', { y: 0 }, 0)

      // b0: the dragon, then a row of paper clips and a row of footsteps.
      tl.addLabel('b0', 0.01)
      const at0 = (t: number) => `b0+=${t}`
      tl.fromTo('.dragon', { opacity: 0, x: 80 }, { opacity: 1, x: 0, duration: 1, ease: 'power2.out' }, 'b0')
      tl.to('.guides', { opacity: 1, duration: 0.5 }, at0(1.3))
      for (let i = 0; i < CLIPS; i++) {
        tl.to(`.clip-${i}`, { opacity: 1, y: 0, duration: 0.25, ease: 'back.out(2)' }, at0(2.0 + i * 0.2))
        tl.to(`.clipn-${i}`, { opacity: 1, duration: 0.2 }, at0(2.1 + i * 0.2))
      }
      tl.to('.lbl-0', { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out' }, at0(4.6))
      for (let k = 0; k < FEET; k++) {
        tl.to(`.foot-${k}`, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' }, at0(5.0 + k * 0.45))
      }
      tl.to('.lbl-1', { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out' }, at0(6.9))

      // b1: two different numbers for one dragon, then a shared ruler.
      tl.addLabel('b1', 'b0+=7.6')
      const at1 = (t: number) => `b1+=${t}`
      tl.to(['.lbl-glow-0', '.lbl-glow-1'], { opacity: 1, duration: 0.4 }, at1(0.3))
      tl.to('.band-0', { opacity: 1, duration: 0.3 }, at1(2.0))
      tl.to('.lbl-0', { scale: 1.12, duration: 0.3, yoyo: true, repeat: 1, ease: 'sine.inOut' }, at1(2.1))
      tl.to('.band-0', { opacity: 0, duration: 0.3 }, at1(3.3))
      tl.to('.band-1', { opacity: 1, duration: 0.3 }, at1(3.4))
      tl.to('.lbl-1', { scale: 1.12, duration: 0.3, yoyo: true, repeat: 1, ease: 'sine.inOut' }, at1(3.5))
      tl.to('.band-1', { opacity: 0, duration: 0.3 }, at1(4.6))
      tl.to('.dragon-hop', { y: -18, duration: 0.22, yoyo: true, repeat: 3, ease: 'sine.inOut' }, at1(4.8))
      tl.fromTo('.ruler', { opacity: 0, x: -1300 }, { opacity: 1, x: 0, duration: 1.3, ease: 'power3.out' }, at1(6.4))
      tl.to('.lbl-2', { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out' }, at1(8.4))
      tl.to('.lbl-glow-2', { opacity: 1, duration: 0.4 }, at1(8.4))
      tl.to({}, { duration: 0.01 }, at1(10.4))

      // b2: a clean table for the ribbon puzzle.
      tl.addLabel('b2', 'b1+=10.8')
      tl.to('.g-plain', { opacity: 1, duration: 0.5 }, 'b2')
      tl.to('.world', { opacity: 0, duration: 0.01 }, 'b2+=0.5')

      // b3: triangles of every size and turn, sides and corners counted, then the card.
      tl.addLabel('b3', 'b2+=0.6')
      const at3 = (t: number) => `b3+=${t}`
      tl.set('.g-plain', { opacity: 1 }, 'b3')
      tl.set('.world', { opacity: 0 }, 'b3')
      tl.set('.g-tri', { opacity: 1 }, 'b3')
      tl.fromTo('.tri-outline', { attr: { 'stroke-dashoffset': 1 } }, { attr: { 'stroke-dashoffset': 0 }, duration: 1.1, ease: 'power1.inOut' }, at3(0.2))
      tl.fromTo('.tri-fill', { opacity: 0 }, { opacity: 1, duration: 0.5 }, at3(1.0))
      for (let k = 0; k < 3; k++) {
        tl.fromTo(`.tri-side-${k}`, { attr: { 'stroke-dashoffset': 1 } }, { attr: { 'stroke-dashoffset': 0 }, duration: 0.4, ease: 'power1.out' }, at3(2.4 + k * 0.6))
        tl.fromTo(`.tri-num-${k}`, { opacity: 0, scale: 0.3, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2.5)' }, at3(2.6 + k * 0.6))
      }
      for (let k = 0; k < 3; k++) {
        tl.fromTo(`.tri-corner-${k}`, { opacity: 0, scale: 0.2, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(3)' }, at3(4.4 + k * 0.35))
      }
      tl.fromTo('.tri-rule', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4 }, at3(5.6))
      OTHERS.forEach((_, k) => {
        tl.fromTo(`.tri-other-${k}`, { opacity: 0, scale: 0.3, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(1.8)' }, at3(6.1 + k * 0.45))
        tl.fromTo(`.tri-three-${k}`, { opacity: 0, scale: 0.3, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2.5)' }, at3(6.4 + k * 0.45))
      })
      tl.fromTo('.end-card', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, at3(8.4))
      tl.fromTo('.end-branch', { attr: { 'stroke-dashoffset': 1 } }, { attr: { 'stroke-dashoffset': 0 }, duration: 1.2, ease: 'power1.inOut' }, at3(8.8))
      LEAVES.forEach((_, i) => {
        tl.fromTo(`.end-leaf-${i}`, { scale: 0, svgOrigin: '0 0' }, { scale: 1, svgOrigin: '0 0', duration: 0.35, ease: 'back.out(2.4)' }, at3(9.4 + i * 0.15))
      })
      tl.fromTo('.end-buds', { opacity: 0 }, { opacity: 1, duration: 0.5 }, at3(10.3))
      tl.to({}, { duration: 0.01 }, at3(11.2))
    },
    beatIndex,
    playing,
    onAnimDone,
  )

  const id = BEATS[beatIndex]?.id

  return (
    <g ref={root}>
      <g className="world">
        <Sky />
        <At x={330} y={110} s={0.75}><Cloud /></At>
        <At x={1380} y={140} s={0.6}><Cloud opacity={0.85} /></At>
        <rect x={0} y={DRAGON.y - 8} width={1600} height={900 - DRAGON.y + 8} fill={C.grassLight} />
        <rect x={0} y={DRAGON.y - 8} width={1600} height={16} fill={C.grass} />
        <Guides />
        <At x={DRAGON.x} y={DRAGON.y} data-tutor="the dragon">
          <g className="dragon">
            <g className="dragon-hop"><Dragon /></g>
          </g>
        </At>
        <MeasureRows />
        <Ruler />
        <RowLabels />
      </g>
      <g className="g-plain">
        <Sky top="#FFF1CF" low={C.cream} />
      </g>
      <Triangles />
      <ComingSoonCard />
      {id === 'ribbons' && <RibbonPuzzle {...props} />}
    </g>
  )
}

/* ---------------------------------------------------------------- b0: the dragon */

const TAIL: [P, P, P, P] = [[340, -122], [250, -72], [150, -32], [44, -26]]
const BACK_A: [P, P, P, P] = [[300, 0], [290, -140], [420, -205], [560, -205]]
const BACK_B: [P, P, P, P] = [[560, -205], [700, -205], [800, -150], [840, -80]]

/** A friendly dragon of our own, lying flat. Tail tip at x = 0, nose tip at x = 1020, belly on y = 0. */
function Dragon() {
  const body = C.coral
  const dark = C.coralDark
  const spikePaths = [
    ...spikes(TAIL, [0.12, 0.34, 0.56, 0.76], [34, 30, 25, 20], -1),
    ...spikes(BACK_A, [0.45, 0.62, 0.8, 0.96], [30, 36, 40, 42], 1),
    ...spikes(BACK_B, [0.14, 0.32, 0.5, 0.68], [42, 40, 36, 30], 1),
  ]
  return (
    <g>
      <ellipse cx={540} cy={4} rx={520} ry={14} fill={C.shadow} />
      {spikePaths.map((d, i) => (
        <path key={i} d={d} fill={C.mustard} stroke={C.mustardDark} strokeWidth={3} strokeLinejoin="round" />
      ))}
      {/* tail */}
      <path d="M 44 -8 C 140 -4 240 -2 360 0 L 340 -122 C 250 -72 150 -32 44 -26 Z" fill={body} />
      <path d="M 0 -17 L 56 -46 Q 44 -17 56 12 Z" fill={C.mustard} stroke={C.mustardDark} strokeWidth={3} strokeLinejoin="round" />
      {/* back paw */}
      <ellipse cx={380} cy={-12} rx={44} ry={16} fill={dark} />
      {/* body */}
      <path d="M 300 0 C 290 -140 420 -205 560 -205 C 700 -205 800 -150 840 -80 L 870 0 Z" fill={body} />
      <path d="M 330 0 C 380 -46 760 -56 846 -4 L 846 0 Z" fill={C.cream} />
      {[420, 500, 580, 660, 740].map((x) => (
        <path key={x} d={`M ${x} -4 Q ${x + 6} -22 ${x + 2} -38`} stroke={C.boneDark} strokeWidth={4} fill="none" strokeLinecap="round" />
      ))}
      {/* folded wing */}
      <path
        d="M 470 -150 C 520 -238 662 -248 724 -172 C 694 -166 676 -154 664 -136 C 642 -150 612 -148 596 -128 C 576 -144 548 -144 530 -124 C 514 -138 490 -142 470 -150 Z"
        fill={dark}
      />
      <path d="M 540 -196 L 600 -134 M 620 -212 L 630 -138" stroke={body} strokeWidth={5} strokeLinecap="round" opacity={0.5} />
      {/* head */}
      <path d="M 842 -152 Q 820 -206 784 -214 Q 822 -184 864 -150 Z" fill={C.bone} />
      <path d="M 880 -158 Q 870 -222 834 -238 Q 876 -206 902 -160 Z" fill={C.bone} />
      <ellipse cx={905} cy={-86} rx={84} ry={74} fill={body} />
      <ellipse cx={962} cy={-46} rx={58} ry={44} fill={body} />
      <ellipse cx={968} cy={-24} rx={44} ry={16} fill={C.cream} opacity={0.9} />
      <circle cx={922} cy={-56} r={13} fill={C.berry} opacity={0.35} />
      <g className="blink">
        <circle cx={918} cy={-110} r={22} fill={C.white} />
        <circle cx={924} cy={-107} r={12} fill={C.ink} />
        <circle cx={928} cy={-112} r={4.5} fill={C.white} />
      </g>
      <path d="M 896 -140 Q 916 -150 938 -142" stroke={dark} strokeWidth={5} fill="none" strokeLinecap="round" />
      <ellipse cx={1000} cy={-64} rx={5} ry={7} fill={dark} />
      <path d="M 936 -38 Q 972 -22 1006 -40" stroke={C.ink} strokeWidth={5} fill="none" strokeLinecap="round" />
      {/* front paws */}
      <ellipse cx={826} cy={-12} rx={40} ry={16} fill={dark} />
      <ellipse cx={872} cy={-10} rx={36} ry={14} fill={body} />
      <path d="M 864 -2 l 0 -10 M 878 -2 l 0 -10 M 892 -4 l 0 -9" stroke={dark} strokeWidth={4} strokeLinecap="round" />
    </g>
  )
}

/** Dashed lines up from the tail tip and the nose, so every row is measured between the same ends. */
function Guides() {
  const xs = [DRAGON.x, DRAGON.x + DRAGON.L]
  return (
    <g className="guides">
      {xs.map((x, i) => (
        <g key={i}>
          <line x1={x} y1={255} x2={x} y2={872} stroke={C.inkSoft} strokeWidth={4} strokeDasharray="10 12" strokeLinecap="round" opacity={0.6} />
          <At x={x} y={228}><Label text={i === 0 ? 'tail' : 'nose'} size={30} weight={700} color={C.inkSoft} /></At>
        </g>
      ))}
    </g>
  )
}

/** A classic paper clip, lying flat, about 82 long and 28 tall. Left end at the origin. */
function PaperClip() {
  return (
    <path
      d="M 20 14 L 68 14 A 14 14 0 0 0 68 -14 L 14 -14 A 10 10 0 0 0 14 6 L 60 6 A 4 4 0 0 0 60 -2 L 24 -2"
      stroke={C.skyDark}
      strokeWidth={4.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  )
}

/** One bare footprint, heel at the origin and toes pointing right, about 255 long. */
function Footprint({ left, n }: { left: boolean; n: number }) {
  return (
    <g>
      <g transform={left ? 'scale(1 -1)' : undefined} fill={C.inkSoft} opacity={0.82}>
        <path d="M 16 -28 C 56 -42 104 -30 142 -36 C 184 -44 212 -34 212 -6 C 212 22 186 36 146 32 C 108 28 62 38 18 28 C -6 22 -6 -22 16 -28 Z" />
        {[[236, -28, 15], [245, -4, 10.5], [241, 15, 9], [231, 30, 8], [218, 41, 7]].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} />
        ))}
      </g>
      <At x={106} y={2}><Label text={String(n)} size={40} color={C.white} /></At>
    </g>
  )
}

function MeasureRows() {
  return (
    <g>
      <g className="band-0">
        <rect x={DRAGON.x - 14} y={ROW.clipNums - 30} width={DRAGON.L + 28} height={ROW.clips - ROW.clipNums + 56} rx={22} fill={C.white} opacity={0.6} />
        <rect x={DRAGON.x - 14} y={ROW.clipNums - 30} width={DRAGON.L + 28} height={ROW.clips - ROW.clipNums + 56} rx={22} fill="none" stroke={C.mustardDark} strokeWidth={5} />
      </g>
      <g className="band-1">
        <rect x={DRAGON.x - 14} y={ROW.feet - 58} width={DRAGON.L + 28} height={116} rx={22} fill={C.white} opacity={0.6} />
        <rect x={DRAGON.x - 14} y={ROW.feet - 58} width={DRAGON.L + 28} height={116} rx={22} fill="none" stroke={C.mustardDark} strokeWidth={5} />
      </g>
      <g data-tutor="the paper clips">
        {Array.from({ length: CLIPS }, (_, i) => (
          <g key={i}>
            <At x={DRAGON.x + i * CLIP_W + 1.5} y={ROW.clips}>
              <g className={`clip-${i}`}><PaperClip /></g>
            </At>
            <At x={DRAGON.x + (i + 0.5) * CLIP_W} y={ROW.clipNums}>
              <g className={`clipn-${i}`}><Label text={String(i + 1)} size={30} weight={700} color={C.inkSoft} /></g>
            </At>
          </g>
        ))}
      </g>
      <g data-tutor="the footsteps">
        {Array.from({ length: FEET }, (_, k) => (
          <At key={k} x={DRAGON.x + k * FOOT_W} y={ROW.feet + (k % 2 ? 6 : -6)}>
            <g className={`foot-${k}`}><Footprint left={k % 2 === 1} n={k + 1} /></g>
          </At>
        ))}
      </g>
    </g>
  )
}

/** A centimetre ruler: zero at the tail tip, 60 at the nose. */
function Ruler() {
  return (
    <At x={DRAGON.x} y={ROW.ruler}>
      <g className="ruler" data-tutor="the ruler">
        <rect x={-24} y={6} width={DRAGON.L + 48} height={72} rx={12} fill={C.ink} opacity={0.15} />
        <rect x={-24} y={0} width={DRAGON.L + 48} height={72} rx={12} fill={C.mustard} stroke={C.mustardDark} strokeWidth={4} />
        {Array.from({ length: 61 }, (_, cm) => {
          const h = cm % 10 === 0 ? 30 : cm % 5 === 0 ? 20 : 11
          return <line key={cm} x1={cm * CM} y1={2} x2={cm * CM} y2={h} stroke={C.ink} strokeWidth={cm % 10 === 0 ? 4 : 2.5} strokeLinecap="round" />
        })}
        {[0, 10, 20, 30, 40, 50, 60].map((cm) => (
          <At key={cm} x={cm * CM} y={52}><Label text={String(cm)} size={30} weight={800} /></At>
        ))}
        <At x={5 * CM} y={54}><Label text="cm" size={30} weight={700} color={C.inkSoft} /></At>
      </g>
    </At>
  )
}

function RowLabels() {
  return (
    <g>
      {LABELS.map((l, k) => {
        const w = l.text.length * 0.62 * 36 + 44
        return (
          <At key={k} x={LABEL_X} y={l.y}>
            <g className={`lbl-${k}`} data-tutor={l.text}>
              <rect x={-20} y={-34} width={w} height={68} rx={34} fill={C.white} opacity={0.92} />
              <g className={`lbl-glow-${k}`}>
                <rect x={-20} y={-34} width={w} height={68} rx={34} fill="none" stroke={C.mustardDark} strokeWidth={5} />
              </g>
              <At x={2} y={2}><Label text={l.text} size={36} anchor="start" /></At>
            </g>
          </At>
        )
      })}
    </g>
  )
}

/* ---------------------------------------------------------------- b3: triangles */

const MAIN: P[] = [[130, 410], [520, 410], [290, 92]]
const MAIN_C: P = [(MAIN[0][0] + MAIN[1][0] + MAIN[2][0]) / 3, (MAIN[0][1] + MAIN[1][1] + MAIN[2][1]) / 3]

function equilateral(cx: number, cy: number, side: number, rot: number): P[] {
  const R = side / Math.sqrt(3)
  return [0, 1, 2].map((k) => {
    const a = ((rot - 90 + k * 120) * Math.PI) / 180
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)] as P
  })
}

const OTHERS: P[][] = [
  equilateral(700, 420, 120, 0),
  equilateral(960, 300, 280, 25),
  [[1196, 120], [1150, 460], [1252, 460]],
  [[1300, 190], [1530, 216], [1392, 430]],
]

const centroid = (pts: P[]): P => [(pts[0][0] + pts[1][0] + pts[2][0]) / 3, (pts[0][1] + pts[1][1] + pts[2][1]) / 3]
const ptsAttr = (pts: P[]) => pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')

function Triangles() {
  const sides = [0, 1, 2].map((k) => {
    const a = MAIN[k]
    const b = MAIN[(k + 1) % 3]
    const mx = (a[0] + b[0]) / 2
    const my = (a[1] + b[1]) / 2
    let nx = -(b[1] - a[1])
    let ny = b[0] - a[0]
    const len = Math.hypot(nx, ny)
    nx /= len
    ny /= len
    if (nx * (mx - MAIN_C[0]) + ny * (my - MAIN_C[1]) < 0) {
      nx = -nx
      ny = -ny
    }
    return { a, b, num: [mx + nx * 50, my + ny * 50] as P }
  })
  return (
    <g className="g-tri">
      <g data-tutor="the big triangle">
        <polygon className="tri-fill" points={ptsAttr(MAIN)} fill={MUSTARD_PALE} />
        <path className="tri-outline" d={`M ${MAIN.map((p) => p.join(' ')).join(' L ')} Z`} pathLength={1} strokeDasharray="1 1" stroke={C.mustardDark} strokeWidth={7} strokeLinejoin="round" fill="none" />
        {sides.map((s, k) => (
          <g key={k}>
            <path className={`tri-side-${k}`} d={`M ${s.a.join(' ')} L ${s.b.join(' ')}`} pathLength={1} strokeDasharray="1 1" stroke={C.mustardDark} strokeWidth={16} strokeLinecap="round" fill="none" />
            <At x={s.num[0]} y={s.num[1]}>
              <g className={`tri-num-${k}`}>
                <circle r={27} fill={C.mustardDark} />
                <Label text={String(k + 1)} size={34} color={C.white} />
              </g>
            </At>
          </g>
        ))}
        {MAIN.map((p, k) => (
          <At key={k} x={p[0]} y={p[1]}>
            <g className={`tri-corner-${k}`}>
              <circle r={17} fill={C.coral} stroke={C.white} strokeWidth={4} />
            </g>
          </At>
        ))}
      </g>
      <At x={MAIN_C[0] + 5} y={532}>
        <g className="tri-rule"><Label text="3 sides, 3 corners" size={38} /></g>
      </At>
      {OTHERS.map((pts, k) => {
        const c = centroid(pts)
        return (
          <g key={k} data-tutor={`triangle ${k + 2}`}>
            <g className={`tri-other-${k}`}>
              <polygon points={ptsAttr(pts)} fill={MUSTARD_PALE} stroke={C.mustardDark} strokeWidth={6} strokeLinejoin="round" />
            </g>
            <At x={c[0]} y={c[1] + 4}>
              <g className={`tri-three-${k}`}>
                <circle r={24} fill={C.mustardDark} />
                <Label text="3" size={32} color={C.white} />
              </g>
            </At>
          </g>
        )
      })}
    </g>
  )
}

/* ---------------------------------------------------------------- coming soon */

const LEAVES = [
  { x: 140, y: 188, rot: 120 },
  { x: 180, y: 168, rot: -60 },
  { x: 300, y: 126, rot: 110 },
  { x: 234, y: 102, rot: 200 },
  { x: 336, y: 114, rot: -50 },
]

function Leaf() {
  return <path d="M 0 0 C 14 -20 46 -22 62 0 C 46 22 14 20 0 0 Z" fill={MUSTARD_PALE} stroke={C.mustardDark} strokeWidth={3.5} />
}

/** The end card: the mustard branch of the knowledge tree, still only buds. */
function ComingSoonCard() {
  return (
    <At x={140} y={572}>
      <g className="end-card" data-tutor="coming soon card">
        <rect x={0} y={12} width={1320} height={300} rx={44} fill={C.ink} opacity={0.12} />
        <rect x={0} y={0} width={1320} height={300} rx={44} fill={C.white} stroke={C.mustard} strokeWidth={6} />
        <path d="M 72 274 C 78 210 82 140 76 46" stroke={C.woodDark} strokeWidth={34} strokeLinecap="round" fill="none" />
        <path className="end-branch" d="M 84 210 C 160 186 220 140 290 128 C 340 120 370 102 404 74" pathLength={1} strokeDasharray="1 1" stroke={C.mustard} strokeWidth={20} strokeLinecap="round" fill="none" />
        <path className="end-branch" d="M 214 148 C 236 118 246 96 240 66" pathLength={1} strokeDasharray="1 1" stroke={C.mustard} strokeWidth={12} strokeLinecap="round" fill="none" />
        {LEAVES.map((l, i) => (
          <At key={i} x={l.x} y={l.y} rotate={l.rot}>
            <g className={`end-leaf-${i}`}><Leaf /></g>
          </At>
        ))}
        <g className="end-buds">
          {[[410, 68], [240, 60]].map(([x, y], i) => (
            <At key={i} x={x} y={y}>
              <circle r={26} fill={C.mustard} opacity={0.3} className="pulse" />
              <circle r={14} fill={C.mustardDark} />
              <circle cx={-4} cy={-5} r={4} fill={C.white} opacity={0.6} />
            </At>
          ))}
        </g>
        <At x={520} y={92}><Label text="How big? What shape?" size={54} color={C.mustardDark} anchor="start" /></At>
        <At x={520} y={176}><Label text="This branch of the knowledge tree" size={36} weight={700} anchor="start" /></At>
        <At x={520} y={228}><Label text="will grow soon!" size={36} weight={700} anchor="start" /></At>
      </g>
    </At>
  )
}

/* ---------------------------------------------------------------- the quick ribbon puzzle */

/**
 * The wiggly ribbon is a chain of tiny segments. Straightening scales every segment's angle
 * toward zero, so its length never changes: only its shape does. That is the whole point.
 */
const WIGGLE = (() => {
  const span = 460
  const amp = 62
  const waves = 3
  const n = 180
  const pts: P[] = Array.from({ length: n + 1 }, (_, i) => [(span * i) / n, amp * Math.sin((2 * Math.PI * waves * i) / n)])
  const segs = pts.slice(1).map((p, i) => {
    const dx = p[0] - pts[i][0]
    const dy = p[1] - pts[i][1]
    return { len: Math.hypot(dx, dy), ang: Math.atan2(dy, dx) }
  })
  return { span, segs, total: segs.reduce((s, g) => s + g.len, 0) }
})()

const STRAIGHT_LEN = 620
const START = { wiggly: { x: 570, y: 330 }, straight: { x: 490, y: 560 } }
const END = { wiggly: { x: 290, y: 330 }, straight: { x: 290, y: 470 } }

function wigglePath(t: number, x0: number, y0: number) {
  let x = x0
  let y = y0
  const out = [`M ${x.toFixed(1)} ${y.toFixed(1)}`]
  for (const s of WIGGLE.segs) {
    const a = s.ang * (1 - t)
    x += s.len * Math.cos(a)
    y += s.len * Math.sin(a)
    out.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  return out.join(' ')
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function Ribbon({ d, color, halo, onTap, tutor }: { d: string; color: string; halo: boolean; onTap?: () => void; tutor: string }) {
  return (
    <g data-tutor={tutor} onClick={onTap} style={{ cursor: onTap ? 'pointer' : 'default' }} role={onTap ? 'button' : undefined}>
      {halo && <path d={d} stroke={C.mustard} strokeWidth={54} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.5} />}
      <path d={d} stroke={C.ink} strokeWidth={30} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.12} transform="translate(0 6)" />
      <path d={d} stroke={color} strokeWidth={30} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={d} stroke={C.white} strokeWidth={3} strokeDasharray="8 10" strokeLinecap="round" fill="none" opacity={0.7} />
      {onTap && <path d={d} stroke="transparent" strokeWidth={110} strokeLinecap="round" strokeLinejoin="round" fill="none" />}
    </g>
  )
}

function RibbonPuzzle({ onChallengeDone, say, emit, reportState, setHints }: SceneProps) {
  const [picked, setPicked] = useState<'wiggly' | 'straight' | null>(null)
  const [t, setT] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const timers = useRef<number[]>([])
  const tween = useRef<gsap.core.Tween | null>(null)

  useEffect(
    () => () => {
      timers.current.forEach((h) => window.clearTimeout(h))
      tween.current?.kill()
    },
    [],
  )

  useEffect(() => {
    setHints([
      'Imagine pulling each ribbon tight, like a shoelace.',
      'The bends in a ribbon still count. Every bit of ribbon adds to its length.',
      'Picture the wiggly ribbon pulled straight. Would its ends stay close together, or move far apart?',
    ])
  }, [setHints])

  useEffect(() => {
    const straightened = Math.round(WIGGLE.total)
    reportState(
      `Quick ribbon puzzle. Two ribbons: a wiggly pink ribbon whose ends are only ${WIGGLE.span} apart, and a straight blue ribbon ${STRAIGHT_LEN} long (stage units). ` +
        `The student is asked which is longer and taps one. ${picked ? `They tapped the ${picked} ribbon. ` : 'They have not tapped yet. '}` +
        `${revealed ? 'Both ribbons have now been pulled straight side by side, and the wiggly one is clearly longer. ' : ''}` +
        `Correct answer: the wiggly pink ribbon, about ${straightened} long once straightened. Any tap is fine: this is a quick guess, then the reveal explains. ` +
        `Likely mix-up: judging length by how far apart the ends are, so picking the straight ribbon.`,
    )
  }, [picked, revealed, reportState])

  const tap = (which: 'wiggly' | 'straight') => {
    if (picked) return
    setPicked(which)
    emit({ type: 'attempt', correct: which === 'wiggly', detail: `tapped the ${which} ribbon` })
    const line =
      (which === 'wiggly' ? 'Good thinking! ' : 'It does look longer! ') +
      "Let's pull them straight and see. The wiggly ribbon is longer! Its bends were hiding extra ribbon. You measure the whole length, not just end to end."
    say(line)
    timers.current.push(
      window.setTimeout(() => {
        const o = { t: 0 }
        tween.current = gsap.to(o, { t: 1, duration: 2.6, ease: 'power2.inOut', onUpdate: () => setT(o.t) })
      }, 1100),
    )
    timers.current.push(window.setTimeout(() => setRevealed(true), 3900))
    timers.current.push(window.setTimeout(onChallengeDone, lineMs(line)))
  }

  const w0 = { x: lerp(START.wiggly.x, END.wiggly.x, t), y: lerp(START.wiggly.y, END.wiggly.y, t) }
  const s0 = { x: lerp(START.straight.x, END.straight.x, t), y: lerp(START.straight.y, END.straight.y, t) }
  const wEnd = END.wiggly.x + WIGGLE.total
  const sEnd = END.straight.x + STRAIGHT_LEN

  return (
    <g>
      {!picked && <At x={800} y={170}><Label text="Which ribbon is longer?" size={48} /></At>}
      {revealed && (
        <g>
          <line x1={END.wiggly.x} y1={270} x2={END.wiggly.x} y2={530} stroke={C.inkSoft} strokeWidth={5} strokeDasharray="10 10" strokeLinecap="round" />
          <line x1={sEnd} y1={270} x2={sEnd} y2={530} stroke={C.inkSoft} strokeWidth={4} strokeDasharray="10 10" strokeLinecap="round" opacity={0.6} />
          <path d={`M ${sEnd} 280 L ${wEnd} 280`} stroke={C.mustardDark} strokeWidth={6} strokeLinecap="round" />
          <path d={`M ${sEnd} 268 L ${sEnd} 292 M ${wEnd} 268 L ${wEnd} 292`} stroke={C.mustardDark} strokeWidth={6} strokeLinecap="round" />
          <At x={(sEnd + wEnd) / 2} y={240}><Label text="extra!" size={34} color={C.mustardDark} /></At>
        </g>
      )}
      <Ribbon
        d={`M ${s0.x} ${s0.y} L ${s0.x + STRAIGHT_LEN} ${s0.y}`}
        color={C.sky}
        halo={picked === 'straight'}
        onTap={picked ? undefined : () => tap('straight')}
        tutor="straight blue ribbon"
      />
      <Ribbon d={wigglePath(t, w0.x, w0.y)} color={C.berry} halo={picked === 'wiggly'} onTap={picked ? undefined : () => tap('wiggly')} tutor="wiggly pink ribbon" />
      {revealed && (
        <g>
          <At x={wEnd + 40} y={END.wiggly.y}><Label text="longer" size={36} color={C.berry} anchor="start" /></At>
          <rect x={290} y={600} width={1020} height={170} rx={40} fill={C.white} opacity={0.94} />
          <At x={800} y={655}><Label text="The wiggly ribbon is longer!" size={46} /></At>
          <At x={800} y={725}><Label text="Measure the whole length, not just end to end." size={34} weight={700} color={C.inkSoft} /></At>
        </g>
      )}
    </g>
  )
}

export const teaserShape: Stop = {
  id: 'shape',
  title: 'How big? What shape?',
  branch: 'shape',
  teaser: true,
  beats: BEATS,
  Scene,
}
