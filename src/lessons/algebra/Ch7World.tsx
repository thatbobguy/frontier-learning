import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react'
import { Person } from '../../art2/characters'
import { Glow, Motes, Stars, Vignette, rng } from '../../art2/fx'
import { FONT2, N } from '../../art2/palette'
import { Equation, Title, type TermKind } from '../../art2/props'
import { Moon, River } from '../../art2/scenery'
import { useBeatTimeline } from '../../engine/useBeatTimeline'
import type { Chapter, ChapterProps, Cue } from '../../flow/types'

export const CUES: Cue[] = [
  { id: 'everywhere', say: 'Keep it balanced, then undo, step by step. That one idea is everywhere.' },
  { id: 'game', say: 'A game designer knows how high a jump has to reach, and solves for how fast the character must leap.' },
  { id: 'bridge', say: 'An engineer knows how much weight a bridge must hold, and solves for how thick its beams need to be.' },
  { id: 'mars', say: 'A space agency knows where Mars will be next year, and solves for the day to launch.' },
  { id: 'backwards', say: 'Whenever you know the result but not the cause, algebra lets you run the world backwards.' },
  { id: 'next', say: "And this is just one branch. What happens when x isn't one secret number, but can be any number at all? That's where graphs and functions begin." },
]

/*
 * The whole chapter lives high above the world at night. The recipe (keep it balanced, then undo)
 * bursts into three lights that open three windows in the sky: a video game, a bridge and the
 * solar system. The camera dives into each window in turn, pulls back to rewind all three, and
 * ends on a knowledge tree growing on top of the world.
 *
 * Each window holds a full 1600 x 900 scene, drawn at 0.3 scale; the camera fills the stage with
 * one by zooming in by S_IN.
 */

type P = [number, number]

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const rad = (deg: number) => (deg * Math.PI) / 180
const quad = (a: P, c: P, b: P, t: number): P => {
  const u = 1 - t
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]
}
const cubic = (p: P[], t: number): P => {
  const u = 1 - t
  const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]
  return [k[0] * p[0][0] + k[1] * p[1][0] + k[2] * p[2][0] + k[3] * p[3][0], k[0] * p[0][1] + k[1] * p[1][1] + k[2] * p[2][1] + k[3] * p[3][1]]
}

/** The three windows in the sky (world coordinates): the game, the bridge, the solar system. */
const WINS: P[] = [
  [290, 420],
  [800, 420],
  [1310, 420],
]
const WW = 480
const WH = 270
const WS = WW / 1600
/** Corner radius of a window, in scene units (18 on stage). */
const WRX = 60
/** Camera zoom that fills the stage with one window, corners and frame just off-stage. */
const S_IN = 3.48
const LN_IN = Math.log(S_IN)

/** The curve of the world along the bottom of the sky. */
const PLANET = { cx: 800, cy: 2570, r: 1800 }
const rimY = (x: number) => PLANET.cy - Math.sqrt(PLANET.r ** 2 - (x - PLANET.cx) ** 2)

/* ---------- The game (scene units) ---------- */
const GAME = {
  screen: { x: 342, y: 74, w: 1158, h: 632 },
  ground: 612,
  ledge: { x0: 1130, top: 332 },
  /** The hero's middle: on the ground, the top of the arc's pull, and on the ledge. */
  from: [560, 576] as P,
  ctrl: [900, 60] as P,
  to: [1215, 296] as P,
}
/** How far the hero's middle sits above its feet. */
const HERO_H = 36
const ARC_DOTS = Array.from({ length: 13 }, (_, i) => quad(GAME.from, GAME.ctrl, GAME.to, (i + 2) / 15))

/* ---------- The bridge (scene units) ---------- */
const BR = { x0: 300, x1: 1300, T0: 14, T1: 64, sag: 28 }
const TRUCKS = [
  { x: 590, cab: N.sand, cabDark: N.sandDark, box: N.stoneLight, boxDark: N.stone },
  { x: 800, cab: N.violet, cabDark: N.violetDark, box: N.cream, boxDark: N.sandLight },
  { x: 1010, cab: N.leaf, cabDark: N.leafDark, box: N.skyLight, boxDark: N.sky },
]
/** Where the convoy waits before it rolls in, off the left of the picture. */
const CONVOY_OFF = -1150
const sagAt = (x: number, sag: number) => {
  if (x <= BR.x0 || x >= BR.x1) return 0
  const u = (x - BR.x0) / (BR.x1 - BR.x0)
  return sag * 4 * u * (1 - u)
}

/* ---------- The solar system (scene units) ---------- */
/**
 * Orbits are tilted circles (y squashed by k). Earth turns 360 degrees a year, Mars 191. The rocket
 * leaves Earth at angle thE at time 0 and meets Mars half an orbit later, at time tA (about 259 days).
 */
const SP = { cx: 800, cy: 450, rE: 330, rM: 540, k: 0.45, thE: 160, tA: 0.71, wM: 191, t0: -0.45 }
const orbitPt = (r: number, deg: number): P => [SP.cx + r * Math.cos(rad(deg)), SP.cy + r * SP.k * Math.sin(rad(deg))]
const transferPt = (p: number): P => {
  const a = (SP.rE + SP.rM) / 2
  const e = (SP.rM - SP.rE) / (SP.rM + SP.rE)
  const d = 180 * p
  return orbitPt((a * (1 - e * e)) / (1 + e * Math.cos(rad(d))), SP.thE + d)
}
const LAUNCH = orbitPt(SP.rE, SP.thE)
const MEET = orbitPt(SP.rM, SP.thE + 180)
const TRAIL = Array.from({ length: 30 }, (_, i) => transferPt((i + 0.5) / 30))

/* ---------- The knowledge tree (world) ---------- */
const LANTERN: P = [562, 542]
const SHOOTS: { p: P[]; label: string; lbl: P; petal: string; petalDark: string }[] = [
  { p: [[792, 492], [730, 430], [620, 330], [520, 292]], label: 'Graphs', lbl: [496, 236], petal: N.skyLight, petalDark: N.sky },
  { p: [[800, 478], [804, 390], [812, 290], [830, 192]], label: 'Functions', lbl: [830, 132], petal: N.violetLight, petalDark: N.violet },
  { p: [[808, 498], [880, 440], [990, 368], [1092, 334]], label: 'Inequalities', lbl: [1112, 280], petal: N.leafLight, petalDark: N.leaf },
]
const shootD = (p: P[]) => `M${p[0][0]} ${p[0][1]} C${p[1][0]} ${p[1][1]} ${p[2][0]} ${p[2][1]} ${p[3][0]} ${p[3][1]}`
const tipAngle = (p: P[]) => (Math.atan2(p[3][1] - p[2][1], p[3][0] - p[2][0]) * 180) / Math.PI

/** A tiny Baghdad on the rim of the world, where the tree takes root. */
const TINY_CITY = (() => {
  const r = rng(91)
  const out: { x: number; w: number; h: number; kind: 'dome' | 'minaret' | 'flat'; lit: number }[] = []
  for (let x = 560; x < 1050; ) {
    const roll = r()
    const kind = roll < 0.3 ? 'dome' : roll < 0.45 ? 'minaret' : 'flat'
    const w = kind === 'minaret' ? 7 : 16 + r() * 18
    const h = kind === 'minaret' ? 34 + r() * 14 : 12 + r() * 16
    out.push({ x: x + w / 2, w, h, kind, lit: r() })
    x += w + (r() < 0.3 ? 4 : -1)
  }
  return out
})()

/** What Pip sees on each cue. */
const STATE: string[] = [
  'High above the world at night. The recipe for solving appears as two glowing icons: a teal balance scale ("keep it balanced") and a gold undo arrow that curls backwards in three steps ("undo, step by step"). They rise and burst into three lights, which open three windows in the sky: a video game, a bridge over a river, and the solar system.',
  "Inside the first window: a game designer's screen with a bright platformer level. The ledge is 4 blocks high (gold 4, the known result). The pink x next to the character is the leap speed (the unknown cause). A dotted arc grows from the character and settles exactly on the ledge; the character jumps along it and lands, and a teal equals sign glints.",
  'Inside the second window: three trucks roll onto a bridge across a river, with a total load of 30 tonnes (gold, the known). The thin beam under the deck bends a little. The beam thickness is the pink x (the unknown). The beam thickens to just the right size, the bridge is level again, and a teal equals sign glints.',
  "Inside the third window: Earth and Mars orbit the sun. A gold ring marks where Mars will be next year (the known result). A pink x marks the launch day on Earth's orbit (the unknown). When Earth reaches the x, a rocket launches and arcs out to meet Mars exactly at the gold ring, and a teal equals sign glints.",
  'The camera pulls back to show all three windows side by side. The gold knowns glow, then the pink unknowns. A gold rewind symbol appears and every scene plays backwards: the rocket returns to Earth, the trucks reverse off the bridge, the character drops back down to the ground. The caption reads "Know the result? Run it backwards." The idea: start from the known result and undo it step by step to find the unknown cause.',
  'A knowledge tree grows on top of the world, rooted in a tiny Baghdad. A glowing lantern on one branch is labelled "Solving for x": what the learner has just finished. Three new branches sprout with buds that blossom into Graphs, Functions and Inequalities. A pink x slides back and forth along each new branch, because there x can be any number at all. This is the last picture of the lesson; the end screen follows.',
]

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function Tile({ x, y, t, k, size = 54, tutor }: { x: number; y: number; t: string; k: TermKind; size?: number; tutor?: string }) {
  return <Equation terms={[{ t, k }]} x={x} y={y} size={size} tutor={tutor} />
}

function Label({ x, y, children, anchor = 'middle', size = 30 }: { x: number; y: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end'; size?: number }) {
  return (
    <Title x={x} y={y} size={size} weight={800} anchor={anchor}>
      {children}
    </Title>
  )
}

/** A teal ring and sparkle: "it matches". `cls` names the parts for the timeline. */
function Glint({ x, y, cls }: { x: number; y: number; cls: string }) {
  return (
    <g pointerEvents="none">
      <circle className={`${cls}-ring`} cx={x} cy={y} r={70} fill="none" stroke={N.teal} strokeWidth={7} />
      <g transform={`translate(${x} ${y})`}>
        <path className={`${cls}-star`} d="M0 -34 L7 -7 L34 0 L7 7 L0 34 L-7 7 L-34 0 L-7 -7 Z" fill={N.tealLight} />
      </g>
    </g>
  )
}

/** A soft pulse of light behind a known (gold) or unknown (pink) mark, for the rewind. */
function Pulse({ x, y, kind, r = 120 }: { x: number; y: number; kind: 'gold' | 'pink'; r?: number }) {
  return (
    <g className={kind === 'gold' ? 'k-gold-pulse' : 'k-pink-pulse'}>
      <Glow x={x} y={y} r={r} color={kind === 'gold' ? 'warm' : 'pink'} />
    </g>
  )
}

/* ---------- The recipe ---------- */

const UNDO = { x: 1040, y: 380, r: 86 }
const undoPt = (deg: number): P => [UNDO.x + UNDO.r * Math.cos(rad(deg)), UNDO.y + UNDO.r * Math.sin(rad(deg))]
const UNDO_SEGS: [number, number][] = [
  [40, -40],
  [-52, -132],
  [-144, -212],
]
const undoHead = (() => {
  const end = -212
  const b = undoPt(end)
  const d: P = [Math.sin(rad(end)), -Math.cos(rad(end))]
  const n: P = [-d[1], d[0]]
  const tip: P = [b[0] + d[0] * 34, b[1] + d[1] * 34]
  return `M${tip[0]} ${tip[1]} L${b[0] + n[0] * 22} ${b[1] + n[1] * 22} L${b[0] - n[0] * 22} ${b[1] - n[1] * 22} Z`
})()

function ScaleIcon() {
  return (
    <g data-tutor="the balance icon: keep it balanced">
      <Glow x={560} y={390} r={210} color="teal" opacity={0.45} />
      <g stroke={N.teal} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#fx-glow)">
        <path d="M500 470 H620" />
        <path d="M560 470 V312" />
        <path d="M534 470 L560 444 L586 470" />
      </g>
      <g className="r-beam">
        <path d="M440 312 H680" stroke={N.teal} strokeWidth={10} strokeLinecap="round" filter="url(#fx-glow)" />
        {[450, 670].map((px, i) => (
          <g key={px} className={i ? 'r-panR' : 'r-panL'}>
            <path d={`M${px} 312 L${px - 38} 392 M${px} 312 L${px + 38} 392`} stroke={N.tealLight} strokeWidth={4} opacity={0.8} />
            <path d={`M${px - 50} 392 Q${px} 440 ${px + 50} 392 Z`} fill={N.teal} filter="url(#fx-glow)" />
          </g>
        ))}
      </g>
      <circle cx={560} cy={312} r={11} fill={N.tealLight} />
    </g>
  )
}

function UndoIcon() {
  return (
    <g data-tutor="the undo arrow: undo, step by step">
      <Glow x={UNDO.x} y={UNDO.y} r={200} color="warm" opacity={0.35} />
      <g stroke={N.gold} strokeWidth={14} strokeLinecap="round" fill="none" filter="url(#fx-glow)">
        {UNDO_SEGS.map(([a, b], i) => {
          const p = undoPt(a)
          const q = undoPt(b)
          return <path key={i} className={`r-seg r-seg${i}`} d={`M${p[0]} ${p[1]} A${UNDO.r} ${UNDO.r} 0 0 0 ${q[0]} ${q[1]}`} pathLength={1} strokeDasharray="1 2" />
        })}
      </g>
      <path className="r-head" d={undoHead} fill={N.gold} filter="url(#fx-glow)" />
    </g>
  )
}

/* ---------- The game ---------- */

function Cloud({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-80 24 Q-92 -6 -54 -14 Q-48 -52 -8 -46 Q18 -70 50 -36 Q90 -38 84 2 Q92 24 60 24 Z" fill={N.white} />
      <path d="M-80 24 Q-84 10 -70 6 Q-20 18 84 6 Q92 24 60 24 Z" fill={N.skyLight} opacity={0.6} />
    </g>
  )
}

function Hero() {
  return (
    <g className="g-hero-body">
      <g className="breathe">
        <ellipse cx={-16} cy={-4} rx={13} ry={8} fill={N.violetDark} />
        <ellipse cx={16} cy={-4} rx={13} ry={8} fill={N.violetDark} />
        <path d="M-36 -26 Q-38 -76 0 -78 Q38 -76 36 -26 Q34 -4 0 -4 Q-34 -4 -36 -26 Z" fill={N.violet} />
        <path d="M14 -76 Q38 -70 36 -26 Q34 -4 0 -4 Q28 -14 26 -40 Q24 -64 14 -76 Z" fill={N.violetDark} />
        <path d="M-26 -60 Q-30 -46 -28 -34" stroke={N.violetLight} strokeWidth={6} strokeLinecap="round" fill="none" />
        <path d="M2 -78 Q4 -92 12 -100" stroke={N.violetDark} strokeWidth={4} fill="none" strokeLinecap="round" />
        <circle cx={13} cy={-102} r={7} fill={N.leafLight} />
        <ellipse cx={-8} cy={-48} rx={10} ry={13} fill={N.white} />
        <ellipse cx={16} cy={-48} rx={10} ry={13} fill={N.white} />
        <circle cx={-4} cy={-51} r={5.5} fill={N.night0} />
        <circle cx={20} cy={-51} r={5.5} fill={N.night0} />
        <path d="M0 -26 Q6 -21 12 -26" stroke={N.night0} strokeWidth={3} fill="none" strokeLinecap="round" />
      </g>
    </g>
  )
}

function GameScene({ uid }: { uid: string }) {
  const { x: sx, y: sy, w: sw, h: sh } = GAME.screen
  const L = GAME.ledge
  const dir: P = [GAME.ctrl[0] - GAME.from[0], GAME.ctrl[1] - GAME.from[1]]
  const len = Math.hypot(dir[0], dir[1])
  const d: P = [dir[0] / len, dir[1] / len]
  const at = (k: number): P => [GAME.from[0] + d[0] * k, GAME.from[1] + d[1] * k]
  const tip = at(104)
  const hb = at(80)
  const head = `M${tip[0]} ${tip[1]} L${hb[0] + d[1] * 16} ${hb[1] - d[0] * 16} L${hb[0] - d[1] * 16} ${hb[1] + d[0] * 16} Z`
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-gsky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={N.sky} />
          <stop offset="1" stopColor={N.skyLight} />
        </linearGradient>
        <clipPath id={`${uid}-screen`}>
          <rect x={sx} y={sy} width={sw} height={sh} rx={12} />
        </clipPath>
      </defs>
      {/* The designer's room, lit by the screen */}
      <rect x={-50} y={-50} width={1700} height={1000} fill={N.night1} />
      <Glow x={920} y={400} r={980} color="cool" opacity={0.55} />
      <g opacity={0.55}>
        <rect x={60} y={120} width={176} height={124} rx={10} fill={N.night2} />
        <path d="M82 214 h40 v-30 h40 v-30 h52" stroke={N.mist} strokeWidth={5} fill="none" strokeLinejoin="round" />
        <rect x={84} y={282} width={152} height={112} rx={10} fill={N.night2} />
        <path d="M100 372 q30 -64 62 -22 t58 -12" stroke={N.mist} strokeWidth={5} fill="none" strokeDasharray="7 9" />
      </g>

      <g className="g-cam">
        {/* The monitor */}
        <rect x={312} y={44} width={1218} height={714} rx={34} fill={N.night0} />
        <rect x={312} y={44} width={1218} height={714} rx={34} fill="none" stroke={N.night3} strokeWidth={4} />
        <g clipPath={`url(#${uid}-screen)`}>
          <rect x={sx} y={sy} width={sw} height={sh} fill={`url(#${uid}-gsky)`} />
          {(
            [
              [560, 190, 1],
              [930, 140, 0.8],
              [1330, 214, 1.1],
            ] as const
          ).map(([x, y, s], i) => (
            <g key={i} className="float" style={{ animationDelay: `${-i * 1.7}s`, animationDuration: '7s' }}>
              <Cloud x={x} y={y} s={s} />
            </g>
          ))}
          <path d={`M${sx} 612 Q470 470 640 600 Q760 500 900 600 Q1040 520 1200 612 Z`} fill={N.leafLight} opacity={0.5} />
          {/* the ground */}
          <rect x={sx} y={GAME.ground} width={sw} height={110} fill={N.sandDark} />
          {Array.from({ length: 15 }, (_, i) => (
            <rect key={i} x={sx + i * 80 + (i % 2) * 20} y={650} width={70} height={24} rx={5} fill={N.sand} opacity={0.4} />
          ))}
          <rect x={sx} y={GAME.ground} width={sw} height={22} fill={N.leaf} />
          <rect x={sx} y={GAME.ground} width={sw} height={7} fill={N.leafLight} />
          {/* the high ledge: four blocks */}
          <g data-tutor="the high ledge">
            {[0, 1, 2, 3].map((r) =>
              [0, 1].map((c) => (
                <g key={`${r}-${c}`}>
                  <rect x={L.x0 + c * 100} y={L.top + r * 70} width={100} height={70} fill={N.sand} stroke={N.sandDark} strokeWidth={4} />
                  <rect x={L.x0 + c * 100 + 6} y={L.top + r * 70 + 6} width={88} height={9} rx={4} fill={N.sandLight} opacity={0.8} />
                  <rect x={L.x0 + c * 100 + 6} y={L.top + r * 70 + 52} width={88} height={10} rx={4} fill={N.sandDark} opacity={0.45} />
                </g>
              )),
            )}
            <rect x={L.x0 - 8} y={L.top} width={216} height={22} rx={9} fill={N.leaf} />
            <rect x={L.x0 - 8} y={L.top} width={216} height={7} rx={3} fill={N.leafLight} />
            <path d={`M1300 ${L.top} V${L.top - 104}`} stroke={N.stoneLight} strokeWidth={6} strokeLinecap="round" />
            <path d={`M1303 ${L.top - 100} L1362 ${L.top - 84} L1303 ${L.top - 66} Z`} fill={N.violet} />
          </g>
          {/* how high the jump must reach: a known number */}
          <g className="g-bracket" data-tutor="the ledge height, 4 blocks">
            <path d={`M1342 ${GAME.ground} H1370 M1356 ${GAME.ground} V${L.top} M1342 ${L.top} H1370`} stroke={N.gold} strokeWidth={7} strokeLinecap="round" fill="none" />
            {[1, 2, 3].map((i) => (
              <path key={i} d={`M1348 ${L.top + i * 70} H1364`} stroke={N.goldLight} strokeWidth={4} strokeLinecap="round" />
            ))}
          </g>
          <g className="g-four">
            <Pulse x={1432} y={472} kind="gold" r={100} />
            <Tile x={1432} y={472} t="4" k="num" tutor="the ledge height, 4 blocks" />
          </g>
          <g className="w-lbl">
            <g className="g-four-lbl">
              <Label x={1432} y={420}>
                height
              </Label>
            </g>
          </g>
          {/* the leap: speed x, then the dotted arc */}
          <g className="g-arrow">
            <path d={`M${at(40)[0]} ${at(40)[1]} L${hb[0]} ${hb[1]}`} stroke={N.pink} strokeWidth={9} strokeLinecap="round" />
            <path d={head} fill={N.pink} />
          </g>
          {ARC_DOTS.map(([x, y], i) => (
            <circle key={i} className="g-dot" cx={x} cy={y} r={8} fill={N.white} stroke={N.skyDark} strokeWidth={2} />
          ))}
          <ellipse className="g-target" cx={GAME.to[0]} cy={L.top + 2} rx={48} ry={12} fill="none" stroke={N.white} strokeWidth={4} strokeDasharray="9 8" />
          <ellipse className="g-target-teal" cx={GAME.to[0]} cy={L.top + 2} rx={48} ry={12} fill="none" stroke={N.teal} strokeWidth={7} />
          <g className="g-hero" data-tutor="the game character">
            <Hero />
          </g>
          <g className="g-x">
            <Pulse x={466} y={500} kind="pink" r={100} />
            <Tile x={466} y={500} t="x" k="x" tutor="the leap speed x" />
          </g>
          <g className="w-lbl">
            <g className="g-x-lbl">
              <Label x={466} y={448}>
                speed
              </Label>
            </g>
          </g>
          <Glint x={GAME.to[0]} y={L.top} cls="g-glint" />
          <g className="g-eq">
            <Tile x={GAME.to[0]} y={160} t="=" k="eq" size={44} />
          </g>
          {/* screen glare */}
          <path d={`M${sx + 700} ${sy} L${sx + 860} ${sy} L${sx + 560} ${sy + sh} L${sx + 400} ${sy + sh} Z`} fill={N.white} opacity={0.06} />
        </g>
        {/* stand, desk and the designer */}
        <path d="M872 758 H970 L1000 820 H842 Z" fill={N.night0} />
        <rect x={-50} y={816} width={1700} height={140} fill={N.woodDark} />
        <rect x={-50} y={816} width={1700} height={12} fill={N.wood} />
        <rect x={700} y={830} width={380} height={26} rx={8} fill={N.night2} />
        <rect x={712} y={834} width={356} height={6} rx={3} fill={N.stoneDark} opacity={0.7} />
        <g transform="translate(1310 822)">
          <path d="M-26 0 V-52 H26 V0 Z" fill={N.stone} />
          <path d="M26 -42 Q46 -42 46 -26 Q46 -12 26 -12" stroke={N.stone} strokeWidth={7} fill="none" />
          <rect x={-26} y={-52} width={52} height={10} fill={N.stoneLight} />
        </g>
      </g>
      <Person x={168} y={905} s={1.15} pose="point" face="smile" head="hair" headColor={N.woodDark} headDark={N.shadow} robe={N.leaf} robeLight={N.leafLight} robeDark={N.leafDark} skin={N.skin3} skinDark={N.skin3Dark} />
    </g>
  )
}

/* ---------- The bridge ---------- */

function Truck({ cab, cabDark, box, boxDark }: { cab: string; cabDark: string; box: string; boxDark: string }) {
  return (
    <g>
      <ellipse cx={0} cy={2} rx={96} ry={8} fill={N.shadow} opacity={0.3} />
      <rect x={-94} y={-108} width={124} height={80} rx={8} fill={box} />
      <rect x={-94} y={-48} width={124} height={20} rx={4} fill={boxDark} opacity={0.7} />
      <rect x={-86} y={-100} width={108} height={8} rx={4} fill={N.white} opacity={0.35} />
      <path d="M34 -28 V-82 Q34 -90 42 -90 H68 Q76 -90 80 -82 L94 -56 V-28 Z" fill={cab} />
      <path d="M44 -82 H66 L78 -60 H44 Z" fill={N.night2} />
      <path d="M48 -78 H58 L52 -64 H48 Z" fill={N.skyLight} opacity={0.5} />
      <rect x={34} y={-46} width={60} height={18} fill={cabDark} opacity={0.6} />
      <rect x={-98} y={-34} width={196} height={12} rx={5} fill={N.night0} />
      <circle cx={92} cy={-40} r={5} fill={N.cream} />
      <path d="M96 -40 L176 -62 L176 -18 Z" fill={N.cream} opacity={0.12} />
      {[-62, -30, 62].map((wx) => (
        <g key={wx} transform={`translate(${wx} -14)`}>
          <g className="b-spin">
            <circle r={15} fill={N.night0} />
            <circle r={6} fill={N.stone} />
            <rect x={-2} y={-13} width={4} height={8} fill={N.stone} />
          </g>
        </g>
      ))}
    </g>
  )
}

function BridgeScene() {
  return (
    <g>
      <rect x={-50} y={-50} width={1700} height={1000} fill="url(#fx-sky-dusk)" />
      <Stars h={300} count={40} seed={31} />
      <Moon x={1250} y={150} r={44} />
      <path d="M-50 600 Q200 470 420 560 Q640 430 900 540 Q1150 450 1380 550 Q1520 500 1650 540 V700 H-50 Z" fill={N.dusk} opacity={0.8} />
      <path d="M-50 640 Q300 560 600 630 Q900 570 1200 630 Q1450 590 1650 620 V720 H-50 Z" fill={N.night3} opacity={0.85} />
      <River y={650} h={260} />
      {/* the cliffs and the road */}
      <path d="M-60 520 H312 L326 548 Q296 700 338 920 H-60 Z" fill={N.night3} />
      <path d="M200 548 H326 Q296 700 338 920 H232 Q262 720 200 548 Z" fill={N.night2} opacity={0.8} />
      <path d="M1660 520 H1288 L1274 548 Q1304 700 1262 920 H1660 Z" fill={N.night3} />
      <path d="M1400 548 H1274 Q1304 700 1262 920 H1368 Q1338 720 1400 548 Z" fill={N.night2} opacity={0.8} />
      <rect x={-60} y={520} width={372} height={22} fill={N.stone} />
      <rect x={1288} y={520} width={372} height={22} fill={N.stone} />
      <rect x={-60} y={519} width={372} height={4} fill={N.stoneLight} />
      <rect x={1288} y={519} width={372} height={4} fill={N.stoneLight} />
      {/* the bridge: girder, railing and deck follow the load */}
      <g data-tutor="the bridge beam">
        <path className="b-girder" stroke={N.stoneLight} fill="none" />
        <path className="b-stiff" stroke={N.stone} strokeDasharray="6 44" opacity={0.8} fill="none" />
      </g>
      <path className="b-posts" stroke={N.stoneLight} strokeWidth={32} strokeDasharray="5 55" fill="none" opacity={0.8} />
      <path className="b-rail" stroke={N.stoneLight} strokeWidth={6} fill="none" strokeLinecap="round" />
      <path className="b-deck" stroke={N.stoneDark} strokeWidth={22} fill="none" />
      <path className="b-deck-top" stroke={N.stoneLight} strokeWidth={4} fill="none" />
      <path className="b-level" d={`M${BR.x0} 518 H${BR.x1}`} stroke={N.teal} strokeWidth={8} strokeLinecap="round" />
      {TRUCKS.map((t, i) => (
        <g key={i} className="b-truck" data-tutor="the trucks">
          <Truck cab={t.cab} cabDark={t.cabDark} box={t.box} boxDark={t.boxDark} />
        </g>
      ))}
      {/* the beam's thickness: the unknown */}
      <path className="b-th" stroke={N.pink} strokeWidth={6} strokeLinecap="round" fill="none" />
      <g className="b-xtag">
        <g className="b-x">
          <Pulse x={380} y={652} kind="pink" r={100} />
          <Tile x={380} y={652} t="x" k="x" tutor="the beam thickness x" />
        </g>
        <g className="w-lbl">
          <g className="b-x-lbl">
            <Label x={420} y={664} anchor="start">
              thickness
            </Label>
          </g>
        </g>
      </g>
      {/* the load: a known number */}
      <g className="b-load">
        <path d="M494 396 V380 H1106 V396 M800 380 V362" stroke={N.gold} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g className="b-load-tile">
        <Pulse x={800} y={326} kind="gold" r={130} />
        <Tile x={800} y={326} t="30 t" k="num" tutor="the total load, 30 tonnes" />
      </g>
      <g className="w-lbl">
        <g className="b-load-lbl">
          <Label x={800} y={272}>
            total load
          </Label>
        </g>
      </g>
      <Glint x={1205} y={440} cls="b-glint" />
      <g className="b-eq">
        <Tile x={1205} y={440} t="=" k="eq" size={44} />
      </g>
      <Person x={1460} y={520} s={0.82} flip pose="point" face="smile" head="cap" headColor={N.sand} headDark={N.sandDark} robe={N.sky} robeLight={N.skyLight} robeDark={N.skyDark} skin={N.skin1} skinDark={N.skin1Dark} />
    </g>
  )
}

/* ---------- The solar system ---------- */

function Earth() {
  return (
    <g>
      <Glow r={64} color="cool" opacity={0.7} />
      <circle r={28} fill={N.sky} />
      <path d="M-18 -16 Q-6 -24 4 -14 Q-2 -6 -10 -8 Q-18 -2 -22 -10 Z" fill={N.leaf} />
      <path d="M2 4 Q16 -2 22 10 Q12 22 0 16 Z" fill={N.leaf} />
      <path d="M8 -27 A28 28 0 0 1 8 27 A34 34 0 0 0 8 -27 Z" fill={N.skyDark} opacity={0.55} />
      <circle r={31} fill="none" stroke={N.skyLight} strokeOpacity={0.5} strokeWidth={3} />
    </g>
  )
}

function Mars() {
  return (
    <g>
      <Glow r={50} color="violet" opacity={0.5} />
      <circle r={22} fill={N.woodLight} />
      <path d="M-14 -4 Q-4 -10 6 -2 Q0 6 -10 4 Z" fill={N.woodDark} opacity={0.6} />
      <path d="M4 8 Q12 6 16 12 Q8 18 2 14 Z" fill={N.woodDark} opacity={0.5} />
      <path d="M-10 -19 Q0 -24 10 -19 Q0 -16 -10 -19 Z" fill={N.cream} />
      <path d="M6 -21 A22 22 0 0 1 6 21 A26 26 0 0 0 6 -21 Z" fill={N.wood} opacity={0.6} />
    </g>
  )
}

function Rocket() {
  return (
    <g>
      <Glow r={44} color="cool" opacity={0.6} />
      <g className="blink-light">
        <path d="M-7 18 Q0 52 7 18 Z" fill={N.sandLight} />
        <path d="M-4 18 Q0 36 4 18 Z" fill={N.cream} />
      </g>
      <path d="M-12 4 L-22 22 L-11 18 Z" fill={N.violet} />
      <path d="M12 4 L22 22 L11 18 Z" fill={N.violet} />
      <path d="M0 -34 Q15 -18 12 18 H-12 Q-15 -18 0 -34 Z" fill={N.cream} />
      <path d="M0 -34 Q15 -18 12 18 H4 Q8 -14 0 -34 Z" fill={N.stoneLight} />
      <circle cy={-6} r={6} fill={N.skyDark} stroke={N.stone} strokeWidth={3} />
    </g>
  )
}

function SpaceScene() {
  return (
    <g>
      <rect x={-50} y={-50} width={1700} height={1000} fill={N.space} />
      <Glow x={180} y={140} r={520} color="violet" opacity={0.35} />
      <Glow x={1430} y={790} r={520} color="violet" opacity={0.28} />
      <Stars w={1600} h={900} count={150} seed={77} />
      <ellipse cx={SP.cx} cy={SP.cy} rx={SP.rM} ry={SP.rM * SP.k} fill="none" stroke={N.mist} strokeOpacity={0.3} strokeWidth={3} strokeDasharray="12 10" />
      <ellipse cx={SP.cx} cy={SP.cy} rx={SP.rE} ry={SP.rE * SP.k} fill="none" stroke={N.mist} strokeOpacity={0.35} strokeWidth={3} />
      {/* the sun */}
      <Glow x={SP.cx} y={SP.cy} r={320} color="warm" opacity={0.3} />
      <Glow x={SP.cx} y={SP.cy} r={140} color="warm" opacity={0.6} />
      <circle cx={SP.cx} cy={SP.cy} r={58} fill={N.sandLight} />
      <circle cx={SP.cx} cy={SP.cy} r={46} fill={N.cream} />
      {TRAIL.map(([x, y], i) => (
        <circle key={i} className="s-trail-dot" cx={x} cy={y} r={5} fill={N.cream} opacity={0} />
      ))}
      {/* where Mars will be next year: known */}
      <g className="s-gold" data-tutor="where Mars will be next year">
        <Pulse x={MEET[0]} y={MEET[1]} kind="gold" r={110} />
        <Glow x={MEET[0]} y={MEET[1]} r={80} color="warm" opacity={0.6} />
        <circle cx={MEET[0]} cy={MEET[1]} r={38} fill="none" stroke={N.gold} strokeWidth={6} strokeDasharray="11 7" />
        <circle cx={MEET[0]} cy={MEET[1]} r={8} fill={N.gold} />
      </g>
      <g className="w-lbl">
        <g className="s-gold-lbl">
          <Label x={MEET[0]} y={MEET[1] - 62}>
            next year
          </Label>
        </g>
      </g>
      {/* the launch day: unknown */}
      <g className="s-launch" data-tutor="the launch day x">
        <circle cx={LAUNCH[0]} cy={LAUNCH[1]} r={42} fill="none" stroke={N.pink} strokeWidth={6} strokeDasharray="11 7" />
        <Pulse x={400} y={568} kind="pink" r={100} />
        <Tile x={400} y={568} t="x" k="x" />
      </g>
      <g className="w-lbl">
        <g className="s-launch-lbl">
          <Label x={400} y={636}>
            launch day
          </Label>
        </g>
      </g>
      <g className="s-mars" data-tutor="Mars">
        <Mars />
        <g className="w-lbl">
          <Label x={-34} y={10} anchor="end">
            Mars
          </Label>
        </g>
      </g>
      <g className="s-earth" data-tutor="Earth">
        <Earth />
        <g className="w-lbl">
          <Label x={0} y={-46}>
            Earth
          </Label>
        </g>
      </g>
      <g className="s-rocket" data-tutor="the rocket">
        <Rocket />
      </g>
      <Glint x={MEET[0]} y={MEET[1]} cls="s-glint" />
      <g className="s-eq">
        <Tile x={MEET[0] + 100} y={MEET[1]} t="=" k="eq" size={44} />
      </g>
    </g>
  )
}

/** One window in the sky, holding a full-stage scene at 0.3 scale. */
function SkyWindow({ i, uid, children }: { i: number; uid: string; children: ReactNode }) {
  const [x, y] = WINS[i]
  return (
    <g className={`w-win w-win${i}`}>
      <Glow x={x} y={y} r={330} color="cool" opacity={0.4} />
      <g transform={`translate(${x - WW / 2} ${y - WH / 2}) scale(${WS})`}>
        <defs>
          <clipPath id={`${uid}-win${i}`}>
            <rect width={1600} height={900} rx={WRX} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${uid}-win${i})`}>
          <rect x={-10} y={-10} width={1620} height={920} fill={N.night0} />
          {children}
          {/* rewind streaks */}
          <g className="w-vhs" pointerEvents="none">
            <rect className="w-vhs-bar" x={0} y={-80} width={1600} height={46} fill={N.white} opacity={0.16} />
            <rect className="w-vhs-bar2" x={0} y={-80} width={1600} height={18} fill={N.white} opacity={0.12} />
          </g>
        </g>
        <rect width={1600} height={900} rx={WRX} fill="none" stroke={N.mist} strokeOpacity={0.75} strokeWidth={10} />
      </g>
    </g>
  )
}

/* ---------- The world below ---------- */

function Planet({ uid }: { uid: string }) {
  const { cx, cy, r } = PLANET
  const lights = rng(17)
  return (
    <g>
      <defs>
        <radialGradient id={`${uid}-planet`} cx="0.5" cy="0" r="0.5">
          <stop offset="0" stopColor={N.night3} />
          <stop offset="0.35" stopColor={N.night1} />
          <stop offset="1" stopColor={N.night0} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r + 70} fill="none" stroke={N.sky} strokeOpacity={0.05} strokeWidth={80} />
      <circle cx={cx} cy={cy} r={r + 30} fill="none" stroke={N.sky} strokeOpacity={0.1} strokeWidth={40} />
      <circle cx={cx} cy={cy} r={r + 8} fill="none" stroke={N.skyLight} strokeOpacity={0.18} strokeWidth={14} />
      <circle cx={cx} cy={cy} r={r} fill={`url(#${uid}-planet)`} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={N.skyLight} strokeOpacity={0.55} strokeWidth={3} />
      <circle cx={cx} cy={cy} r={r - 46} fill="none" stroke={N.night3} strokeOpacity={0.4} strokeWidth={2} />
      <circle cx={cx} cy={cy} r={r - 110} fill="none" stroke={N.night3} strokeOpacity={0.25} strokeWidth={2} />
      {/* faint town lights across the night side */}
      {Array.from({ length: 34 }, (_, i) => {
        const x = 80 + lights() * 1440
        const y = rimY(x) + 14 + lights() * 90
        return <circle key={i} cx={x} cy={y} r={1.5 + lights() * 2} fill={N.sandLight} opacity={0.35 + lights() * 0.4} />
      })}
      {/* a tiny Baghdad on the rim */}
      <g>
        {TINY_CITY.map((b, i) => {
          const ang = (Math.asin((b.x - cx) / r) * 180) / Math.PI
          return (
            <g key={i} transform={`translate(${b.x} ${rimY(b.x) + 4}) rotate(${ang})`} fill={N.night0}>
              {b.kind === 'minaret' ? (
                <>
                  <rect x={-b.w / 2} y={-b.h} width={b.w} height={b.h + 4} />
                  <path d={`M${-b.w / 2} ${-b.h} L0 ${-b.h - 10} L${b.w / 2} ${-b.h} Z`} />
                </>
              ) : (
                <rect x={-b.w / 2} y={-b.h} width={b.w} height={b.h + 4} />
              )}
              {b.kind === 'dome' && <path d={`M${-b.w * 0.4} ${-b.h} A${b.w * 0.4} ${b.w * 0.45} 0 0 1 ${b.w * 0.4} ${-b.h} Z`} />}
              {b.lit > 0.35 && b.kind !== 'minaret' && <rect x={-2} y={-b.h * 0.6} width={4} height={5} fill={N.sandLight} />}
            </g>
          )
        })}
      </g>
    </g>
  )
}

/* ---------- The knowledge tree ---------- */

/** Leaves on the old wood: along the lantern branch and around the crown. */
const OLD_LEAVES: [number, number, number, boolean][] = (() => {
  const r = rng(23)
  const out: [number, number, number, boolean][] = []
  for (let i = 0; i < 9; i++) {
    const t = 0.25 + i * 0.085
    const [x, y] = cubic([[792, 640], [740, 610], [660, 560], LANTERN], t)
    out.push([x, y, (i % 2 ? 1 : -1) * (40 + r() * 40) - 90, r() > 0.5])
  }
  for (let i = 0; i < 10; i++) {
    const a = -180 + i * 20 + r() * 10
    out.push([800 + Math.cos(rad(a)) * (28 + r() * 16), 482 + Math.sin(rad(a)) * (20 + r() * 14), a, r() > 0.4])
  }
  return out
})()

function Tree() {
  return (
    <g data-tutor="the knowledge tree">
      <g className="t-halo">
        <Glow x={800} y={330} r={560} color="violet" opacity={0.55} />
        <Glow x={800} y={260} r={330} color="cool" opacity={0.35} />
        <g transform="translate(380 80)">
          <Motes w={840} h={520} count={16} seed={61} color={N.violetLight} />
        </g>
      </g>
      {/* trunk and the old branch */}
      <g className="t-trunk">
        <path d="M736 792 Q768 772 774 730 L826 730 Q832 772 864 792 Z" fill={N.woodDark} />
        <path d="M760 806 C766 730 778 650 784 560 C787 520 786 495 783 470 L817 470 C814 495 813 520 816 560 C822 650 834 730 840 806 Z" fill={N.woodDark} />
        <path d="M800 806 C804 730 810 650 812 560 C814 520 813 495 812 472 L817 470 C814 495 813 520 816 560 C822 650 834 730 840 806 Z" fill={N.shadow} opacity={0.25} />
        <path d="M772 806 C776 730 784 650 789 560 C791 520 790 495 788 472" stroke={N.woodLight} strokeWidth={5} fill="none" opacity={0.55} />
        <path d="M796 760 C798 700 800 650 801 600 M808 700 C810 660 811 620 810 590" stroke={N.shadow} strokeWidth={3} fill="none" opacity={0.3} strokeLinecap="round" />
        <circle cx={800} cy={478} r={21} fill={N.woodDark} />
      </g>
      <path className="t-branchA" d={`M792 640 C740 610 660 560 ${LANTERN[0]} ${LANTERN[1]}`} stroke={N.woodDark} strokeWidth={16} strokeLinecap="round" fill="none" pathLength={1} strokeDasharray="1 2" />
      {OLD_LEAVES.map(([x, y, a, light], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${a})`}>
          <path className="t-leaf" d="M0 0 Q16 -12 36 0 Q16 12 0 0 Z" fill={light ? N.leaf : N.leafDark} />
        </g>
      ))}
      {/* the new branches, each a number line with an x that can be anything */}
      {SHOOTS.map((s, i) => {
        const d = shootD(s.p)
        const ticks = Array.from({ length: 8 }, (_, k) => {
          const t = 0.2 + k * 0.1
          const a = cubic(s.p, t)
          const b = cubic(s.p, t + 0.01)
          const len = Math.hypot(b[0] - a[0], b[1] - a[1])
          const n: P = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len]
          return `M${a[0] - n[0] * 13} ${a[1] - n[1] * 13} L${a[0] + n[0] * 13} ${a[1] + n[1] * 13}`
        }).join(' ')
        const leaves = [0.38, 0.62].map((t, k) => {
          const a = cubic(s.p, t)
          const b = cubic(s.p, t + 0.01)
          const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI + (k ? 55 : -55)
          return { x: a[0], y: a[1], ang }
        })
        const [tx, ty] = s.p[3]
        return (
          <g key={i} data-tutor={`the ${s.label} branch`}>
            {leaves.map((l, k) => (
              <g key={k} transform={`translate(${l.x} ${l.y}) rotate(${l.ang})`}>
                <path className={`t-sleaf t-sleaf${i}`} d="M0 0 Q14 -10 32 0 Q14 10 0 0 Z" fill={k ? N.leafLight : N.leaf} />
              </g>
            ))}
            <path className={`t-new t-new${i}`} d={d} stroke={N.leafDark} strokeWidth={14} strokeLinecap="round" fill="none" pathLength={1} strokeDasharray="1 2" />
            <path className={`t-new t-new${i}`} d={d} stroke={N.leaf} strokeWidth={5} strokeLinecap="round" fill="none" pathLength={1} strokeDasharray="1 2" opacity={0.8} />
            <path className={`t-ticks t-ticks${i}`} d={ticks} stroke={N.leafLight} strokeWidth={4} strokeLinecap="round" />
            <g transform={`translate(${tx} ${ty})`}>
              <g className={`t-bud t-bud${i}`}>
                <g transform={`rotate(${tipAngle(s.p)})`}>
                  <path d="M-6 0 Q8 -18 34 0 Q8 18 -6 0 Z" fill={s.petalDark} />
                  <path d="M2 -3 Q12 -11 26 -2" stroke={s.petal} strokeWidth={3} fill="none" strokeLinecap="round" />
                </g>
              </g>
              <g className={`t-bloom t-bloom${i}`}>
                <Glow r={120} color={i === 1 ? 'violet' : 'cool'} opacity={0.95} />
                {[0, 1, 2, 3, 4].map((k) => (
                  <ellipse key={k} cx={0} cy={-23} rx={14} ry={23} fill={k % 2 ? s.petal : N.white} opacity={k % 2 ? 1 : 0.92} transform={`rotate(${k * 72 + 10})`} />
                ))}
                <circle r={12} fill={s.petalDark} />
                <circle r={5} fill={N.cream} />
              </g>
            </g>
            <g className={`t-spark t-spark${i}`} pointerEvents="none">
              <g>
                <animateMotion dur={`${4.4 + i * 0.6}s`} begin={`${-i * 1.4}s`} repeatCount="indefinite" path={d} keyPoints="0.14;0.88;0.14" keyTimes="0;0.5;1" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" />
                <Glow r={50} color="pink" opacity={0.9} />
                <circle r={23} fill={N.pink} />
                <text y={10} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={33} fill={N.white}>
                  x
                </text>
              </g>
            </g>
          </g>
        )
      })}
      {/* the lantern of what you have learned */}
      <g transform={`translate(${LANTERN[0]} ${LANTERN[1]})`}>
        <g className="t-lantern" data-tutor="the Solving for x lantern">
          <g className="sway" style={{ animationDuration: '5s' }}>
            <g className="t-lantern-glow">
              <Glow y={74} r={210} color="warm" opacity={0.85} />
            </g>
            <line x1={0} y1={0} x2={0} y2={32} stroke={N.woodDark} strokeWidth={4} />
            <path d="M-14 30 H14 L18 40 H-18 Z" fill={N.woodDark} />
            <path d="M-23 40 Q-36 70 -19 102 H19 Q36 70 23 40 Z" fill={N.stoneDark} />
            <g className="t-lantern-lit">
              <path d="M-23 40 Q-36 70 -19 102 H19 Q36 70 23 40 Z" fill={N.cream} />
              <path d="M-23 40 Q-36 70 -19 102 H-8 Q-20 70 -10 40 Z" fill={N.white} opacity={0.8} />
              <path d="M8 40 Q20 70 10 102 H19 Q36 70 23 40 Z" fill={N.sandLight} opacity={0.8} />
              <path d="M-27 71 H27" stroke={N.sand} strokeWidth={3} opacity={0.6} />
            </g>
            <path d="M-19 102 H19 L13 112 H-13 Z" fill={N.woodDark} />
          </g>
        </g>
      </g>
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* The chapter                                                          */
/* ------------------------------------------------------------------ */

export function Ch7World({ cueIndex, playing, onAnimDone, reportState, setHints }: ChapterProps) {
  const root = useRef<SVGGElement>(null)
  const uid = 'c7' + useId().replace(/[^a-zA-Z0-9_-]/g, '')

  const build = useCallback((tl: gsap.core.Timeline) => {
    const el = root.current
    if (!el) return
    const one = (sel: string) => el.querySelector(sel)
    const all = (sel: string) => Array.from(el.querySelectorAll(sel))
    const attr = (node: Element | null, name: string, value: string | number) => node?.setAttribute(name, String(value))
    const later = { immediateRender: false }

    /* --- Numbers the timeline drives; each apply() redraws from them. --- */
    const cam = { cx: 800, cy: 450, z: 0 }
    const game = { jump: 0 }
    const bridge = { T: BR.T0, convoy: CONVOY_OFF }
    const space = { t: SP.t0 }
    const last = new Map<Record<string, number>, Record<string, number>>([
      [cam, { ...cam }],
      [game, { ...game }],
      [bridge, { ...bridge }],
      [space, { ...space }],
    ])
    /** Tweens one number from wherever the previous tween left it, so seeking any way redraws correctly. */
    const tw = (obj: Record<string, number>, key: string, v: number, at: number, dur: number, ease: string, apply: () => void) => {
      const prev = last.get(obj)!
      tl.fromTo(obj, { [key]: prev[key] }, { [key]: v, duration: dur, ease, immediateRender: false, onUpdate: apply }, at)
      prev[key] = v
    }

    const camEl = one('.w-cam')
    const starEl = one('.w-starcam')
    const lbls = all('.w-lbl')
    const applyCam = () => {
      const s = Math.exp(cam.z)
      attr(camEl, 'transform', `translate(800 450) scale(${s}) translate(${-cam.cx} ${-cam.cy})`)
      // The stars sit much further away, so they barely move.
      const k = 0.2
      attr(starEl, 'transform', `translate(800 450) scale(${Math.exp(cam.z * k)}) translate(${-(800 + (cam.cx - 800) * k)} ${-(450 + (cam.cy - 450) * k)})`)
      // Small labels inside the windows only show once a window fills the stage.
      const o = clamp((s - 2) / 1.2)
      lbls.forEach((l) => attr(l, 'opacity', o.toFixed(3)))
    }

    const heroEl = one('.g-hero')
    const applyGame = () => {
      const [x, y] = quad(GAME.from, GAME.ctrl, GAME.to, game.jump)
      attr(heroEl, 'transform', `translate(${x} ${y + HERO_H})`)
    }

    const deck = one('.b-deck')
    const deckTop = one('.b-deck-top')
    const girder = one('.b-girder')
    const stiff = one('.b-stiff')
    const rail = one('.b-rail')
    const posts = one('.b-posts')
    const th = one('.b-th')
    const xtag = one('.b-xtag')
    const truckEls = all('.b-truck')
    const wheelEls = all('.b-spin')
    const applyBridge = () => {
      const { T, convoy } = bridge
      // The thinner the beam and the more trucks on the deck, the more the bridge bends.
      let load = 0
      for (const t of TRUCKS) load += clamp((t.x + convoy + 96 - BR.x0) / 192) / TRUCKS.length
      const sag = BR.sag * load * clamp((BR.T1 - T) / (BR.T1 - BR.T0))
      const bow = (y: number) => `M${BR.x0} ${y} Q800 ${y + 2 * sag} ${BR.x1} ${y}`
      attr(deck, 'd', bow(531))
      attr(deckTop, 'd', bow(521))
      attr(girder, 'd', bow(542 + T / 2))
      attr(girder, 'stroke-width', T)
      attr(stiff, 'd', bow(542 + T / 2))
      attr(stiff, 'stroke-width', Math.max(2, T - 14))
      attr(rail, 'd', bow(486))
      attr(posts, 'd', bow(504))
      truckEls.forEach((t, i) => {
        const x = TRUCKS[i].x + convoy
        attr(t, 'transform', `translate(${x} ${520 + sagAt(x, sag)})`)
      })
      const spin = ((convoy / 15) * 180) / Math.PI
      wheelEls.forEach((w) => attr(w, 'transform', `rotate(${spin})`))
      const y1 = 542 + sagAt(380, sag)
      const y2 = y1 + T
      attr(th, 'd', `M366 ${y1} H394 M380 ${y1} V${y2} M366 ${y2} H394`)
      attr(xtag, 'transform', `translate(0 ${y2 - 606})`)
    }

    const earthEl = one('.s-earth')
    const marsEl = one('.s-mars')
    const rocketEl = one('.s-rocket')
    const trailEls = all('.s-trail-dot')
    const applySpace = () => {
      const t = space.t
      const e = orbitPt(SP.rE, SP.thE + 360 * t)
      attr(earthEl, 'transform', `translate(${e[0]} ${e[1]})`)
      const m = orbitPt(SP.rM, SP.thE + 180 - SP.wM * (SP.tA - t))
      attr(marsEl, 'transform', `translate(${m[0]} ${m[1]})`)
      const p = t / SP.tA
      if (p <= 0 || p >= 1) {
        attr(rocketEl, 'opacity', 0)
      } else {
        const [rx, ry] = transferPt(p)
        const a = transferPt(Math.max(0, p - 0.005))
        const b = transferPt(Math.min(1, p + 0.005))
        const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI + 90
        const s = Math.max(0.25, Math.min(1, p * 12, (1 - p) * 12)) * 1.25
        attr(rocketEl, 'opacity', 1)
        attr(rocketEl, 'transform', `translate(${rx} ${ry}) rotate(${ang}) scale(${s})`)
      }
      trailEls.forEach((d, i) => attr(d, 'opacity', p >= (i + 0.5) / trailEls.length ? 0.85 : 0))
    }

    const pop = (sel: string, at: number, origin: string, dur = 0.55, ease = 'back.out(2)') =>
      tl.fromTo(sel, { opacity: 0, scale: 0.3, svgOrigin: origin }, { opacity: 1, scale: 1, duration: dur, ease }, at)
    const fadeUp = (sel: string, at: number, dur = 0.5, dy = 14) => tl.fromTo(sel, { opacity: 0, y: dy }, { opacity: 1, y: 0, duration: dur, ease: 'power2.out' }, at)
    const glint = (cls: string, x: number, y: number, at: number) => {
      tl.fromTo(`.${cls}-ring`, { opacity: 0, scale: 0.2, svgOrigin: `${x} ${y}` }, { opacity: 1, scale: 1, duration: 0.25, ease: 'power2.out' }, at)
      tl.to(`.${cls}-ring`, { opacity: 0, scale: 1.7, duration: 0.7, ease: 'power1.out' }, at + 0.25)
      tl.fromTo(`.${cls}-star`, { opacity: 0, scale: 0, svgOrigin: '0 0', rotation: -45 }, { opacity: 1, scale: 1.2, rotation: 0, duration: 0.3, ease: 'back.out(3)' }, at + 0.05)
      tl.to(`.${cls}-star`, { opacity: 0, scale: 0.4, duration: 0.5, ease: 'power2.in' }, at + 0.55)
    }

    /* --- Start: high in the night sky. Everything that arrives later is hidden. --- */
    tl.set(['.r-light', '.r-flare', '.t-seed', '.k-gold-pulse', '.k-pink-pulse', '.w-vhs', '.b-level', '.b-th'], { opacity: 0 })
    tl.set('.r-seg', { strokeDashoffset: 1.02 })
    tl.set(['.t-branchA', '.t-new'], { strokeDashoffset: 1.02 })
    tl.set('.g-target-teal', { opacity: 0 })
    WINS.forEach(([x, y], i) => tl.set(`.w-win${i}`, { opacity: 0, scale: 0.15, svgOrigin: `${x} ${y}` }))

    /* 0. The recipe appears in the sky, then bursts into three lights that open three windows. */
    tl.addLabel('b0', 0)
    tl.fromTo('.w-drift', { y: -50 }, { y: 0, duration: 5.5, ease: 'power2.out' }, 0)
    tl.fromTo('.w-stardrift', { y: -16 }, { y: 0, duration: 5.5, ease: 'power2.out' }, 0)
    pop('.r-scale-g', 0.8, '560 400', 0.7, 'back.out(1.8)')
    tl.fromTo('.r-beam', { rotation: -16, svgOrigin: '560 312' }, { rotation: 0, duration: 1.8, ease: 'elastic.out(1, 0.35)' }, 0.95)
    tl.fromTo('.r-panL', { rotation: 16, svgOrigin: '450 312' }, { rotation: 0, duration: 1.8, ease: 'elastic.out(1, 0.35)' }, 0.95)
    tl.fromTo('.r-panR', { rotation: 16, svgOrigin: '670 312' }, { rotation: 0, duration: 1.8, ease: 'elastic.out(1, 0.35)' }, 0.95)
    fadeUp('.r-lbl0', 1.2)
    tl.fromTo('.r-then', { opacity: 0, x: -30 }, { opacity: 0.7, x: 0, duration: 0.5, ease: 'power2.out' }, 1.5)
    pop('.r-undo-g', 1.7, `${UNDO.x} ${UNDO.y}`, 0.5, 'back.out(1.6)')
    fadeUp('.r-lbl1', 1.9)
    UNDO_SEGS.forEach((_, i) => tl.fromTo(`.r-seg${i}`, { strokeDashoffset: 1.02 }, { strokeDashoffset: 0, duration: 0.3, ease: 'power1.inOut', immediateRender: false }, 2.0 + i * 0.36))
    pop('.r-head', 3.05, `${undoPt(-212)[0]} ${undoPt(-212)[1]}`, 0.35, 'back.out(3)')
    tl.to('.r-all', { y: -150, scale: 0.12, opacity: 0, svgOrigin: '800 400', duration: 0.8, ease: 'power2.in' }, 3.5)
    tl.fromTo('.r-flare', { opacity: 0, scale: 0.2, svgOrigin: '800 230' }, { opacity: 1, scale: 1, duration: 0.25, ease: 'power2.out', ...later }, 4.15)
    tl.to('.r-flare', { opacity: 0, scale: 1.8, duration: 0.6, ease: 'power1.out' }, 4.4)
    WINS.forEach(([x, y], i) => {
      tl.fromTo(`.r-light${i}`, { x: 800, y: 230, opacity: 0 }, { opacity: 1, duration: 0.15, ...later }, 4.2)
      tl.to(`.r-light${i}`, { x, duration: 0.75, ease: 'power1.out' }, 4.25)
      tl.to(`.r-light${i}`, { y, duration: 0.75, ease: 'power2.in' }, 4.25)
      tl.to(`.r-light${i}`, { opacity: 0, scale: 3, duration: 0.4, ease: 'power1.out' }, 4.95)
      tl.fromTo(`.w-win${i}`, { opacity: 0, scale: 0.15 }, { opacity: 1, scale: 1, duration: 0.7, ease: 'back.out(1.5)', ...later }, 4.9 + i * 0.06)
    })

    /* 1. Dive into the game: the gold height, the pink speed, the arc settles onto the ledge, the jump. */
    const b1 = 5.8
    tl.addLabel('b1', b1)
    tw(cam, 'cx', WINS[0][0], b1, 1.6, 'power2.inOut', applyCam)
    tw(cam, 'cy', WINS[0][1], b1, 1.6, 'power2.inOut', applyCam)
    tw(cam, 'z', LN_IN, b1, 1.75, 'power3.inOut', applyCam)
    tl.fromTo('.g-cam', { scale: 1, svgOrigin: '900 420' }, { scale: 1.05, duration: 6, ease: 'sine.inOut' }, b1 + 1.4)
    tl.fromTo('.g-bracket', { scaleY: 0, opacity: 0, svgOrigin: `1356 ${GAME.ground}` }, { scaleY: 1, opacity: 1, duration: 0.7, ease: 'power2.out' }, b1 + 1.5)
    pop('.g-four', b1 + 2.0, '1432 472')
    fadeUp('.g-four-lbl', b1 + 2.2)
    pop('.g-x', b1 + 3.6, '466 500')
    fadeUp('.g-x-lbl', b1 + 3.8)
    tl.fromTo('.g-arrow', { opacity: 0, scale: 0, svgOrigin: `${GAME.from[0]} ${GAME.from[1]}` }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, b1 + 4.0)
    tl.fromTo('.g-dot', { opacity: 0, scale: 0.2, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.25, stagger: 0.06, ease: 'back.out(3)' }, b1 + 4.4)
    tl.fromTo('.g-target', { opacity: 0 }, { opacity: 1, duration: 0.3 }, b1 + 4.9)
    tl.fromTo('.g-target-teal', { opacity: 0, scale: 0.5, svgOrigin: `${GAME.to[0]} ${GAME.ledge.top + 2}` }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2.5)', ...later }, b1 + 5.3)
    tl.to('.g-arrow', { opacity: 0.35, duration: 0.4 }, b1 + 5.6)
    tl.fromTo('.g-hero-body', { scaleX: 1, scaleY: 1, svgOrigin: '0 0' }, { scaleX: 1.14, scaleY: 0.8, duration: 0.18, ease: 'power2.out' }, b1 + 5.4)
    tl.to('.g-hero-body', { scaleX: 0.9, scaleY: 1.14, duration: 0.2, ease: 'power2.out' }, b1 + 5.58)
    tw(game, 'jump', 1, b1 + 5.6, 0.95, 'none', applyGame)
    tl.to('.g-hero-body', { scaleX: 1, scaleY: 1, duration: 0.5, ease: 'sine.inOut' }, b1 + 5.85)
    tl.to('.g-hero-body', { scaleX: 1.16, scaleY: 0.8, duration: 0.1, ease: 'power2.out' }, b1 + 6.55)
    tl.to('.g-hero-body', { scaleX: 1, scaleY: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' }, b1 + 6.65)
    tl.to(['.g-target', '.g-target-teal'], { opacity: 0, duration: 0.3 }, b1 + 6.55)
    glint('g-glint', GAME.to[0], GAME.ledge.top, b1 + 6.6)
    pop('.g-eq', b1 + 6.75, `${GAME.to[0]} 160`)

    /* 2. Hop to the bridge: trucks roll on, the thin beam bends, the beam thickens until it is level. */
    const b2 = b1 + 7.5
    tl.addLabel('b2', b2)
    tw(cam, 'cx', WINS[1][0], b2, 1.8, 'sine.inOut', applyCam)
    tw(cam, 'z', Math.log(1.3), b2, 0.9, 'power2.inOut', applyCam)
    tw(cam, 'z', LN_IN, b2 + 0.9, 0.9, 'power2.inOut', applyCam)
    tw(bridge, 'convoy', 0, b2 + 0.3, 2.7, 'power2.out', applyBridge)
    tl.fromTo('.b-load', { scaleX: 0, opacity: 0, svgOrigin: '800 380' }, { scaleX: 1, opacity: 1, duration: 0.5, ease: 'power2.out' }, b2 + 2.7)
    pop('.b-load-tile', b2 + 3.0, '800 326')
    fadeUp('.b-load-lbl', b2 + 3.2)
    tl.to('.b-th', { opacity: 1, duration: 0.3 }, b2 + 4.2)
    pop('.b-x', b2 + 4.3, '380 652')
    fadeUp('.b-x-lbl', b2 + 4.5)
    tw(bridge, 'T', BR.T1, b2 + 4.9, 1.3, 'back.out(1.4)', applyBridge)
    tl.fromTo('.b-level', { opacity: 0, scaleX: 0, svgOrigin: `${BR.x0} 518` }, { opacity: 1, scaleX: 1, duration: 0.6, ease: 'power2.out', ...later }, b2 + 6.1)
    tl.to('.b-level', { opacity: 0.45, duration: 0.6 }, b2 + 6.8)
    glint('b-glint', 1205, 440, b2 + 6.4)
    pop('.b-eq', b2 + 6.55, '1205 440')

    /* 3. Hop to the solar system: gold where Mars will be, pink launch day, the rocket meets Mars. */
    const b3 = b2 + 7.5
    tl.addLabel('b3', b3)
    tw(cam, 'cx', WINS[2][0], b3, 1.8, 'sine.inOut', applyCam)
    tw(cam, 'z', Math.log(1.3), b3, 0.9, 'power2.inOut', applyCam)
    tw(cam, 'z', LN_IN, b3 + 0.9, 0.9, 'power2.inOut', applyCam)
    // Time runs from before launch to the meeting: launch (t = 0) lands at b3 + 4.4, the meeting at b3 + 6.6.
    tw(space, 't', SP.tA, b3 + 0.8, 5.8, 'power1.in', applySpace)
    pop('.s-gold', b3 + 1.8, `${MEET[0]} ${MEET[1]}`)
    fadeUp('.s-gold-lbl', b3 + 2.0)
    pop('.s-launch', b3 + 3.6, `${LAUNCH[0]} ${LAUNCH[1]}`)
    fadeUp('.s-launch-lbl', b3 + 3.8)
    glint('s-glint', MEET[0], MEET[1], b3 + 6.6)
    pop('.s-eq', b3 + 6.75, `${MEET[0] + 100} ${MEET[1]}`)

    /* 4. Pull back to all three windows and run them backwards. */
    const b4 = b3 + 7.3
    tl.addLabel('b4', b4)
    tw(cam, 'cx', 800, b4, 1.7, 'power2.inOut', applyCam)
    tw(cam, 'cy', 450, b4, 1.7, 'power2.inOut', applyCam)
    tw(cam, 'z', 0, b4, 1.7, 'power3.inOut', applyCam)
    tl.fromTo('.k-gold-pulse', { opacity: 0 }, { opacity: 1, duration: 0.4, ...later }, b4 + 1.1)
    tl.to('.k-gold-pulse', { opacity: 0.35, duration: 0.8 }, b4 + 1.5)
    tl.fromTo('.k-pink-pulse', { opacity: 0 }, { opacity: 1, duration: 0.4, ...later }, b4 + 2.1)
    tl.to('.k-pink-pulse', { opacity: 0.2, duration: 0.8 }, b4 + 2.5)
    pop('.rw-sym', b4 + 3.0, '800 175', 0.5, 'back.out(2.2)')
    tl.fromTo('.rw-tri', { x: 0 }, { x: -10, duration: 0.25, ease: 'sine.inOut', yoyo: true, repeat: 7 }, b4 + 3.4)
    tl.to('.w-vhs', { opacity: 1, duration: 0.2 }, b4 + 3.2)
    tl.fromTo('.w-vhs-bar', { y: 0 }, { y: 1000, duration: 0.9, ease: 'none', repeat: 1 }, b4 + 3.2)
    tl.fromTo('.w-vhs-bar2', { y: 300 }, { y: 1000, duration: 0.6, ease: 'none', repeat: 2 }, b4 + 3.2)
    tl.to('.w-vhs', { opacity: 0, duration: 0.3 }, b4 + 5.0)
    tw(game, 'jump', 0, b4 + 3.3, 1.3, 'power1.inOut', applyGame)
    tw(bridge, 'convoy', CONVOY_OFF, b4 + 3.3, 1.9, 'power2.in', applyBridge)
    tw(space, 't', -0.08, b4 + 3.3, 1.9, 'power2.inOut', applySpace)
    tl.to('.k-pink-pulse', { opacity: 1, duration: 0.35 }, b4 + 5.2)
    tl.to('.k-pink-pulse', { opacity: 0.5, duration: 0.6 }, b4 + 5.55)
    fadeUp('.rw-title', b4 + 5.4, 0.7, 24)

    /* 5. The knowledge tree grows on the world: one lit lantern, three new branches. */
    const b5 = b4 + 6.6
    tl.addLabel('b5', b5)
    tl.to(['.rw-title', '.rw-sym'], { opacity: 0, duration: 0.5 }, b5)
    WINS.forEach(([x, y], i) => {
      tl.to(`.w-win${i}`, { opacity: 0, scale: 0.05, duration: 0.7, ease: 'power2.in' }, b5 + 0.1 + i * 0.05)
      tl.fromTo(`.t-seed${i}`, { x, y, opacity: 0 }, { opacity: 1, duration: 0.2, ...later }, b5 + 0.6)
      tl.to(`.t-seed${i}`, { x: LANTERN[0], duration: 1.3, ease: 'power1.inOut' }, b5 + 0.7 + i * 0.08)
      tl.to(`.t-seed${i}`, { y: LANTERN[1] + 74, duration: 1.3, ease: 'power2.in' }, b5 + 0.7 + i * 0.08)
      tl.to(`.t-seed${i}`, { opacity: 0, duration: 0.25 }, b5 + 2.0 + i * 0.08)
    })
    tw(cam, 'cx', 660, b5 + 0.2, 2.2, 'sine.inOut', applyCam)
    tw(cam, 'cy', 600, b5 + 0.2, 2.2, 'sine.inOut', applyCam)
    tw(cam, 'z', Math.log(1.3), b5 + 0.2, 2.2, 'sine.inOut', applyCam)
    tl.fromTo('.t-trunk', { scaleY: 0, svgOrigin: '800 806' }, { scaleY: 1, duration: 1.4, ease: 'power2.out' }, b5 + 0.5)
    tl.fromTo('.t-branchA', { strokeDashoffset: 1.02 }, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.out', ...later }, b5 + 1.1)
    tl.fromTo('.t-leaf', { scale: 0, transformOrigin: '0% 50%' }, { scale: 1, duration: 0.4, stagger: 0.05, ease: 'back.out(2.5)' }, b5 + 1.4)
    tl.fromTo('.t-lantern', { opacity: 0, scale: 0.4, svgOrigin: '0 0' }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' }, b5 + 1.6)
    tl.fromTo('.t-lantern-lit', { opacity: 0 }, { opacity: 1, duration: 0.4 }, b5 + 2.05)
    tl.fromTo('.t-lantern-glow', { opacity: 0, scale: 0.3, svgOrigin: '0 74' }, { opacity: 1, scale: 1, duration: 0.8, ease: 'power2.out' }, b5 + 2.05)
    fadeUp('.t-lbl-solve', b5 + 2.3)
    tl.fromTo('.t-halo', { opacity: 0 }, { opacity: 0.6, duration: 2, ease: 'sine.inOut' }, b5 + 2.6)
    tl.to('.t-halo', { opacity: 1, duration: 1.4, ease: 'sine.inOut' }, b5 + 7.8)
    tw(cam, 'cx', 800, b5 + 2.6, 7.4, 'sine.inOut', applyCam)
    tw(cam, 'cy', 440, b5 + 2.6, 7.4, 'sine.inOut', applyCam)
    tw(cam, 'z', Math.log(0.94), b5 + 2.6, 7.4, 'sine.inOut', applyCam)
    SHOOTS.forEach((_, i) => {
      const at = b5 + 2.9 + i * 0.35
      tl.fromTo(`.t-new${i}`, { strokeDashoffset: 1.02 }, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.out', ...later }, at)
      tl.fromTo(`.t-ticks${i}`, { opacity: 0 }, { opacity: 0.85, duration: 0.6 }, at + 0.7)
      tl.fromTo(`.t-sleaf${i}`, { scale: 0, transformOrigin: '0% 50%' }, { scale: 1, duration: 0.45, stagger: 0.15, ease: 'back.out(2.5)' }, at + 0.5)
      tl.fromTo(`.t-bud${i}`, { scale: 0, opacity: 0, svgOrigin: '0 0' }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2.5)' }, at + 0.9)
      tl.fromTo(`.t-spark${i}`, { opacity: 0 }, { opacity: 1, duration: 0.5 }, b5 + 5.2 + i * 0.3)
      tl.fromTo(`.t-bloom${i}`, { scale: 0, opacity: 0, rotation: -40, svgOrigin: '0 0' }, { scale: 1, opacity: 1, rotation: 0, duration: 0.9, ease: 'back.out(1.8)' }, b5 + 7.8 + i * 0.3)
      tl.to(`.t-bud${i}`, { opacity: 0, duration: 0.3 }, b5 + 7.9 + i * 0.3)
      fadeUp(`.t-lbl${i}`, b5 + 8.0 + i * 0.3, 0.6, 16)
    })
    tl.addLabel('b6', b5 + 10.2)

    applyCam()
    applyGame()
    applyBridge()
    applySpace()
  }, [])

  useBeatTimeline(root, build, cueIndex, playing, onAnimDone)

  useEffect(() => {
    reportState(STATE[cueIndex] ?? '')
    setHints([])
  }, [cueIndex, reportState, setHints])

  return (
    <g ref={root}>
      {/* The sky, far away: it barely moves with the camera */}
      <rect x={-400} y={-300} width={2400} height={1500} fill="url(#fx-sky-deep)" />
      <g className="w-starcam">
        <g className="w-stardrift">
          <circle cx={300} cy={180} r={420} fill={N.violet} opacity={0.12} filter="url(#fx-blur-big)" />
          <circle cx={1300} cy={300} r={380} fill={N.sky} opacity={0.07} filter="url(#fx-blur-big)" />
          <g transform="translate(-250 -120)">
            <Stars w={2100} h={1000} count={190} seed={57} />
          </g>
          <Moon x={1380} y={120} r={38} />
        </g>
      </g>

      {/* The world, which the camera moves through */}
      <g className="w-cam">
        <g className="w-drift">
          <Tree />
          <Planet uid={uid} />
          <Motes count={18} seed={44} color={N.skyLight} />

          {/* The recipe */}
          <g className="r-all">
            <g className="r-scale-g">
              <ScaleIcon />
            </g>
            <g className="r-then">
              <path d="M738 380 H872" stroke={N.mist} strokeWidth={5} strokeLinecap="round" />
              <path d="M862 366 L882 380 L862 394" stroke={N.mist} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>
            <g className="r-undo-g">
              <UndoIcon />
            </g>
            <g className="r-lbl0">
              <Title x={560} y={548} size={40}>
                Keep it balanced
              </Title>
            </g>
            <g className="r-lbl1">
              <Title x={UNDO.x} y={548} size={40}>
                Undo, step by step
              </Title>
            </g>
          </g>
          <g className="r-flare">
            <Glow x={800} y={230} r={220} color="cool" />
            <circle cx={800} cy={230} r={18} fill={N.white} />
          </g>
          {WINS.map((_, i) => (
            <g key={i} className={`r-light r-light${i}`}>
              <Glow r={70} color="cool" />
              <circle r={10} fill={N.white} />
            </g>
          ))}

          {/* Three windows in the sky */}
          <SkyWindow i={0} uid={uid}>
            <GameScene uid={uid} />
          </SkyWindow>
          <SkyWindow i={1} uid={uid}>
            <BridgeScene />
          </SkyWindow>
          <SkyWindow i={2} uid={uid}>
            <SpaceScene />
          </SkyWindow>

          {/* Run it backwards */}
          <g className="rw-sym" data-tutor="the rewind symbol">
            <Glow x={800} y={175} r={150} color="warm" opacity={0.5} />
            <circle cx={800} cy={175} r={64} fill={N.night0} fillOpacity={0.75} stroke={N.gold} strokeWidth={6} />
            <g className="rw-tri">
              <path d="M802 145 L758 175 L802 205 Z" fill={N.gold} />
              <path d="M846 145 L802 175 L846 205 Z" fill={N.gold} />
            </g>
          </g>
          <g className="rw-title">
            <Title y={718} size={60}>
              Know the result? Run it backwards.
            </Title>
          </g>

          {/* Labels on the tree, and the lights that fly into its lantern */}
          <g className="t-lbl-solve">
            <Title x={LANTERN[0]} y={724} size={40}>
              Solving for x
            </Title>
          </g>
          {SHOOTS.map((s, i) => (
            <g key={i} className={`t-lbl t-lbl${i}`}>
              <Title x={s.lbl[0]} y={s.lbl[1]} size={40}>
                {s.label}
              </Title>
            </g>
          ))}
          {WINS.map((_, i) => (
            <g key={i} className={`t-seed t-seed${i}`}>
              <Glow r={60} color="cool" />
              <circle r={9} fill={N.white} />
            </g>
          ))}
        </g>
      </g>

      <Vignette />
    </g>
  )
}

export const ch7: Chapter = {
  id: 'world',
  title: 'Running the world backwards',
  cues: CUES,
  Scene: Ch7World,
  enter: { type: 'pan', dir: 'up' },
}
