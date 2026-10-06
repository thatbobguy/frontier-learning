/*
 * Pieces the data-gap film reuses across its chapters: the course tree the branch grows from,
 * Ada's office and her face in the monitor light, video tiles of hands doing chores, and a few
 * timeline helpers (counters that redraw when the film seeks).
 */
import type { ReactNode } from 'react'
import { rng } from '../../../art2/fx'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { Person, Profile } from '../../../cine/people'
import { Dust, Pool } from '../shared/kit'
import './dg.css'

/* ------------------------------------------------------------------ */
/* Timeline helpers                                                     */
/* ------------------------------------------------------------------ */

/**
 * A number that counts from `from` to `to`, written into every element matching `sel`.
 * A fromTo on a proxy, so seeking back and forth redraws the right value.
 */
export function counter(tl: gsap.core.Timeline, root: Element | null, sel: string, from: number, to: number, at: number, dur: number, fmt: (v: number) => string, ease = 'power1.inOut') {
  const els = root ? [...root.querySelectorAll(sel)] : []
  const o = { v: from }
  const write = () => els.forEach((e) => (e.textContent = fmt(o.v)))
  tl.fromTo(o, { v: from }, { v: to, duration: dur, ease, immediateRender: false, onUpdate: write }, at)
}

/** Thousands separators, the way George would say it. */
export const commas = (v: number) => Math.round(v).toLocaleString('en-US')

/** Film-only filters (a sideways motion blur, a lime glow). Identical in every chapter, so duplicates are harmless. */
export function DgDefs() {
  return (
    <defs>
      <filter id="dg-mblur" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="18 0" />
      </filter>
      <filter id="dg-mblur-s" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="6 0" />
      </filter>
      <linearGradient id="dg-screen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#0f2a2c" />
        <stop offset="1" stopColor="#081416" />
      </linearGradient>
      <linearGradient id="dg-kitchen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#5a3418" />
        <stop offset="0.6" stopColor="#a5642c" />
        <stop offset="1" stopColor="#e3a35a" />
      </linearGradient>
      <linearGradient id="dg-kitchen2" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#3b2414" />
        <stop offset="1" stopColor="#c27a3a" />
      </linearGradient>
      <linearGradient id="dg-sodium" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffb347" stopOpacity="0.45" />
        <stop offset="0.6" stopColor="#ff9a3c" stopOpacity="0.1" />
        <stop offset="1" stopColor="#ff9a3c" stopOpacity="0" />
      </linearGradient>
    </defs>
  )
}

/* ------------------------------------------------------------------ */
/* The course tree                                                      */
/* ------------------------------------------------------------------ */

const TRUNK = ['The Hardest Machine', 'Joints and Freedom', 'Muscles of Metal', 'The Sense of Touch', 'A Million Hands', 'Build Your Own Hand']
const DATA = [
  { t: 'The Missing Internet', at: [1.4, 1.2] },
  { t: 'Ways to Get Data', at: [1.9, 2.2] },
  { t: 'How Robots Learn', at: [2.2, 3.2] },
  { t: 'The Home Robot Frontier', at: [2.3, 4.2] },
]
const treeXY = (a: number, b: number) => ({ x: 560 + a * 300, y: 800 - b * 125 })
/** Where the data branch's nodes sit on stage. */
export const TREE_NODES = DATA.map((d) => treeXY(d.at[0], d.at[1]))

/**
 * The course as a tree: the amber trunk of how hands work, and the lime data branch splitting
 * off after the first film. Node groups are `${p}-node-${i}` (data branch) for lighting up.
 */
export function CourseTree({ p = 'ct', here = 0 }: { p?: string; here?: number }) {
  const trunk = TRUNK.map((_, i) => treeXY(0, i))
  const data = TREE_NODES
  const branch = `M${trunk[0].x} ${trunk[0].y} C ${trunk[0].x + 160} ${trunk[0].y - 10} ${data[0].x - 160} ${data[0].y + 80} ${data[0].x} ${data[0].y} ` + data.slice(1).map((d, i) => `S ${(data[i].x + d.x) / 2 + 30} ${(data[i].y + d.y) / 2 + 30} ${d.x} ${d.y}`).join(' ')
  return (
    <g className={p} pointerEvents="none">
      <path d={`M${trunk[0].x} ${trunk[0].y + 120} L${trunk[5].x} ${trunk[5].y - 40}`} stroke={C.amberDark} strokeWidth={10} strokeLinecap="round" opacity={0.6} />
      {trunk.map((n, i) => (
        <g key={i} opacity={0.75}>
          <circle cx={n.x} cy={n.y} r={16} fill={C.ink1} stroke={C.amber} strokeWidth={4} />
          <text x={n.x - 30} y={n.y + 8} textAnchor="end" fill={C.amberLight} fontFamily={SANS} fontSize={24} opacity={0.75}>
            {TRUNK[i]}
          </text>
        </g>
      ))}
      <path className={`${p}-branch`} d={branch} stroke={C.lime} strokeWidth={8} fill="none" strokeLinecap="round" filter="url(#cn-bloom)" />
      {data.map((n, i) => (
        <g key={i} className={`${p}-node-${i}`} opacity={i === here ? 1 : 0.55}>
          <circle cx={n.x} cy={n.y} r={22} fill={C.ink1} stroke={C.lime} strokeWidth={5} filter={i === here ? 'url(#cn-bloom)' : undefined} />
          <circle className={`${p}-dot-${i}`} cx={n.x} cy={n.y} r={9} fill={C.lime} opacity={i === here ? 1 : 0.3} />
          <text x={n.x + 36} y={n.y + 9} fill={C.limeLight} fontFamily={SANS} fontSize={26} fontWeight={600}>
            {DATA[i].t}
          </text>
        </g>
      ))}
      <text x={trunk[0].x - 30} y={trunk[0].y + 80} textAnchor="end" fill={C.amber} fontFamily={MONO} fontSize={18} letterSpacing={3} opacity={0.6}>
        HOW HANDS WORK
      </text>
      <text x={data[0].x + 40} y={data[0].y + 60} fill={C.lime} fontFamily={MONO} fontSize={18} letterSpacing={3} opacity={0.7}>
        THE DATA PROBLEM
      </text>
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Screens and clips                                                    */
/* ------------------------------------------------------------------ */

/** A tiny robot-hand clip for a monitor wall: a hand silhouette over a cup, in screen colours. */
export function HandClip({ x, y, w, h, seed = 1, tint = C.rim }: { x: number; y: number; w: number; h: number; seed?: number; tint?: string }) {
  const r = rng(seed)
  const cx = x + w * (0.35 + r() * 0.3)
  const reach = r() * 0.3
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#0b1c22" />
      <rect x={x} y={y + h * 0.72} width={w} height={h * 0.28} fill="#12303a" />
      <rect x={cx - w * 0.07} y={y + h * 0.5} width={w * 0.14} height={h * 0.24} rx={3} fill={tint} opacity={0.45} />
      {/* a hand coming down from the top: forearm, palm, three fingers */}
      <g opacity={0.85} fill={C.shell}>
        <rect x={cx - w * 0.05 - w * 0.12} y={y} width={w * 0.1} height={h * (0.25 + reach)} rx={4} />
        <rect x={cx - w * 0.2} y={y + h * (0.22 + reach)} width={w * 0.16} height={h * 0.13} rx={4} />
        {[0, 1, 2].map((k) => (
          <rect key={k} x={cx - w * 0.19 + k * w * 0.05} y={y + h * (0.33 + reach)} width={w * 0.035} height={h * 0.12} rx={2} />
        ))}
      </g>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={tint} strokeOpacity={0.35} strokeWidth={1.5} />
    </g>
  )
}

/** A desk monitor on a stand with a glowing face; children draw on the screen (clipped). */
export function Monitor({ x, y, w, h, id, children, glow = C.rim }: { x: number; y: number; w: number; h: number; id: string; children?: ReactNode; glow?: string }) {
  return (
    <g>
      <Pool x={x + w / 2} y={y + h / 2} r={Math.max(w, h) * 1.1} color={glow === C.lime ? 'lime' : 'rim'} opacity={0.5} />
      <rect x={x + w / 2 - 8} y={y + h} width={16} height={60} fill={C.ink2} />
      <rect x={x + w / 2 - 50} y={y + h + 56} width={100} height={8} rx={3} fill={C.ink2} />
      <rect x={x - 8} y={y - 8} width={w + 16} height={h + 16} rx={6} fill={C.ink} />
      <clipPath id={id}>
        <rect x={x} y={y} width={w} height={h} />
      </clipPath>
      <rect x={x} y={y} width={w} height={h} fill="url(#dg-screen)" />
      <g clipPath={`url(#${id})`}>{children}</g>
      <g className="hd-flicker">
        <rect x={x} y={y} width={w} height={h} fill={glow} opacity={0.05} />
      </g>
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Ada                                                                  */
/* ------------------------------------------------------------------ */

export const ADA = { hair: 'curls' as const, glasses: true, top: '#2f5d62', topDark: '#1c3a3e', skin: C.skinC, skinDark: C.skinCDark }
export const KOFI = { headset: true, outfit: 'tee' as const, top: '#3a6ea5', topDark: '#244a73', skin: C.skinC }

/** Ada at her desk, side-on, facing right toward her monitors. */
export function AdaAtDesk({ name = 'ada', x, y, s = 1, pose, light = 'screen' }: { name?: string; x: number; y: number; s?: number; pose?: Parameters<typeof Person>[0]['pose']; light?: Parameters<typeof Person>[0]['light'] }) {
  return (
    <g>
      {/* the chair */}
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <rect x={-46} y={-96} width={70} height={12} rx={4} fill={C.ink2} />
        <rect x={-58} y={-210} width={14} height={124} rx={6} fill={C.ink2} />
        <rect x={-14} y={-84} width={8} height={70} fill={C.ink2} />
        <path d="M-50 -10 L36 -10" stroke={C.ink2} strokeWidth={8} strokeLinecap="round" />
      </g>
      <Person name={name} x={x} y={y} s={s} pose={pose} light={light} {...ADA} />
    </g>
  )
}

/** Ada's face in close-up, in profile: curls, glasses, monitor light on her face. */
export function AdaFace({ x, y, s = 1, reflect = C.lime, half = 0.6 }: { x: number; y: number; s?: number; reflect?: string; half?: number }) {
  return (
    <g>
      <Profile x={x} y={y} s={s} skin={C.skinC} skinDark={C.skinCDark} light="screen" half={half} reflect={reflect} />
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        {/* curls over the top and back of the head */}
        <g fill={C.hairDark}>
          {[
            [120, 120, 70],
            [200, 70, 66],
            [290, 60, 56],
            [70, 220, 64],
            [356, 92, 34],
          ].map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} />
          ))}
        </g>
        {/* glasses: a lens catching the screen, and the arm back to the ear */}
        <path d="M318 222 L392 222 Q398 252 386 274 L326 274 Q314 252 318 222 Z" fill={C.cyanLight} fillOpacity={0.1} stroke={C.ink} strokeWidth={7} />
        <path d="M322 230 L214 246" stroke={C.ink} strokeWidth={7} strokeLinecap="round" />
        <path d="M330 232 L360 228" stroke={reflect} strokeWidth={3} opacity={0.6} strokeLinecap="round" />
      </g>
    </g>
  )
}

/** Ada's office at night: a window, a desk, three monitors full of robot-hand clips. */
export function Office({ p = 'of' }: { p?: string }) {
  const r = rng(31)
  return (
    <g pointerEvents="none">
      <rect x={-600} y={-500} width={2800} height={1900} fill="url(#cn-wall)" />
      {/* window, city beyond */}
      <rect x={120} y={110} width={420} height={470} fill="url(#cn-sky-night)" />
      <g filter="url(#cn-dof-2)">
        {Array.from({ length: 9 }, (_, i) => (
          <rect key={i} x={130 + i * 46} y={380 - r() * 160} width={36} height={400} fill={C.ink2} />
        ))}
        {Array.from({ length: 14 }, (_, i) => (
          <circle key={i} className="hd-bokeh" style={{ animationDelay: `${-r() * 6}s` }} cx={140 + r() * 380} cy={330 + r() * 220} r={6 + r() * 10} fill={r() > 0.5 ? C.key : C.rim} opacity={0.5} />
        ))}
      </g>
      <rect x={110} y={100} width={440} height={12} fill={C.ink1} />
      <rect x={110} y={576} width={440} height={14} fill={C.ink1} />
      <rect x={322} y={110} width={8} height={470} fill={C.ink1} />
      <rect x={110} y={100} width={12} height={490} fill={C.ink1} />
      <rect x={540} y={100} width={12} height={490} fill={C.ink1} />
      {/* floor */}
      <rect x={-600} y={790} width={2800} height={700} fill="url(#cn-floor)" />
      {/* desk */}
      <rect x={760} y={640} width={820} height={18} fill={C.ink3} />
      <rect x={780} y={658} width={16} height={140} fill={C.ink1} />
      <rect x={1540} y={658} width={16} height={140} fill={C.ink1} />
      {/* monitors */}
      {[0, 1, 2].map((i) => {
        const mx = 900 + i * 230
        const my = i === 1 ? 440 : 460
        return (
          <g key={i} className={`${p}-mon-${i}`}>
            <Monitor x={mx} y={my} w={210} h={130} id={`${p}-clip-${i}`}>
              <g className="dg-scroll">
                {Array.from({ length: 6 }, (_, k) => (
                  <HandClip key={k} x={mx + 6} y={my + 6 + k * 64} w={198} h={58} seed={i * 10 + k + 3} tint={k % 3 === 0 ? C.lime : C.rim} />
                ))}
              </g>
            </Monitor>
          </g>
        )
      })}
      <rect x={1000} y={626} width={180} height={12} rx={3} fill={C.ink2} />
      <rect x={1004} y={628} width={172} height={3} fill={C.rim} opacity={0.3} />
      {/* a mug and a robot finger on the desk */}
      <rect x={1390} y={604} width={34} height={38} rx={4} fill={C.ink2} />
      <path d="M1424 612 q16 4 0 20" stroke={C.ink2} strokeWidth={6} fill="none" />
      <Dust x={600} y={250} w={900} h={450} count={22} seed={7} color={C.rim} size={0.7} />
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Video tiles of hands doing chores                                    */
/* ------------------------------------------------------------------ */

export type Chore = 'stir' | 'fold' | 'chop' | 'pour' | 'wipe' | 'jar' | 'wash' | 'peel'

/** A warm, softly lit video tile: a silhouetted hand doing a chore. The hand bobs in its own loop. */
export function ChoreTile({ x, y, w = 240, h = 150, chore, k = 0, label = true }: { x: number; y: number; w?: number; h?: number; chore: Chore; k?: number; label?: boolean }) {
  const ink = '#1a0d06'
  const prop = (() => {
    switch (chore) {
      case 'stir':
        return (
          <>
            <path d="M50 110 L190 110 L176 146 L64 146 Z" fill={ink} />
            <ellipse cx={120} cy={110} rx={70} ry={10} fill="#3a1d0c" />
          </>
        )
      case 'fold':
        return <path d="M40 120 L200 112 L210 140 L30 146 Z" fill="#e8d4b0" opacity={0.85} />
      case 'chop':
        return (
          <>
            <rect x={30} y={126} width={180} height={14} rx={3} fill="#4a2a12" />
            <ellipse cx={150} cy={118} rx={26} ry={12} fill="#c94a2c" />
          </>
        )
      case 'pour':
        return <rect x={130} y={96} width={40} height={50} rx={6} fill={C.rim} opacity={0.35} />
      case 'wipe':
        return <rect x={20} y={130} width={200} height={10} fill="#2a1408" />
      case 'jar':
        return (
          <>
            <rect x={96} y={84} width={60} height={64} rx={10} fill="#e6c27a" opacity={0.5} />
            <rect x={92} y={76} width={68} height={14} rx={4} fill={ink} />
          </>
        )
      case 'wash':
        return <ellipse cx={120} cy={130} rx={80} ry={16} fill="#6aa4b8" opacity={0.4} />
      default:
        return <ellipse cx={120} cy={120} rx={22} ry={16} fill="#d98f2b" />
    }
  })()
  // the hand: forearm from the side, palm, fingers, all one dark silhouette
  const angle = { stir: -10, fold: 6, chop: -20, pour: 30, wipe: 0, jar: -4, wash: 10, peel: -14 }[chore]
  return (
    <g transform={`translate(${x} ${y}) scale(${w / 240} ${h / 150})`}>
      <rect width={240} height={150} fill={k % 2 ? 'url(#dg-kitchen2)' : 'url(#dg-kitchen)'} />
      <circle cx={190} cy={30} r={60} fill={C.keyLight} opacity={0.25} filter="url(#cn-dof-2)" />
      {prop}
      <g className="dg-bob" style={{ animationDelay: `${-k * 0.37}s` }}>
        <g transform={`rotate(${angle} 120 96)`} stroke={ink} strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* forearm in from the edge, the back of the hand, four curled fingers and a thumb */}
          <path d="M-30 40 L104 86" strokeWidth={34} />
          <path d="M100 82 L136 92" strokeWidth={30} />
          {[0, 1, 2, 3].map((f) => (
            <path key={f} d={`M${140 - f * 3} ${80 + f * 8} q 20 ${2 + f} 24 ${14 - f} q 2 6 -6 10`} strokeWidth={9 - f * 0.8} />
          ))}
          <path d="M112 76 q 14 -14 30 -12" strokeWidth={11} />
        </g>
      </g>
      {label && (
        <g>
          <circle cx={14} cy={14} r={5} fill={C.danger} className="hd-blink" />
          <text x={24} y={19} fill={C.white} opacity={0.7} fontFamily={MONO} fontSize={12}>
            {['0:42', '1:07', '3:15', '0:09', '2:31', '0:58', '4:02', '1:44'][k % 8]}
          </text>
        </g>
      )}
      <rect width={240} height={150} fill="none" stroke={C.keyLight} strokeOpacity={0.25} />
    </g>
  )
}

/** An empty action row under a video: dashed lime lines and question marks. */
export function EmptyActions({ x, y, w, className }: { x: number; y: number; w: number; className?: string }) {
  return (
    <g className={className} pointerEvents="none">
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M${x} ${y + i * 12} H${x + w}`} stroke={C.lime} strokeOpacity={0.45} strokeWidth={2} strokeDasharray="6 7" />
      ))}
      <text x={x + w / 2} y={y + 20} textAnchor="middle" fill={C.lime} fontFamily={SERIF} fontSize={30} fontWeight={600} stroke={C.ink} strokeWidth={6} style={{ paintOrder: 'stroke' }}>
        ? ? ?
      </text>
    </g>
  )
}
