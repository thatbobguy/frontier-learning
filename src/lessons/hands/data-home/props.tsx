/*
 * Sets and props for "The Home Robot Frontier": a kitchen at night (the callback to film 1's
 * lab, now inside a home), a montage of kitchens, a living room at dusk, a simple robot arm
 * with its own rig (for test bays and simulated tabletops), and the course tree.
 *
 * Everything is drawn in stage units (1600 x 900) and split into layers where a scene puts
 * it at a camera depth.
 */
import type { ReactNode } from 'react'
import { rng } from '../../../art2/fx'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { Robot, Person, POSES, type Pose } from '../../../cine/people'
import { Pool } from '../shared/kit'

/* ------------------------------------------------------------------ */
/* The kitchen at night                                                 */
/* ------------------------------------------------------------------ */

/** The night outside a home window: sky, a big moon, rooftops with a few lit windows, a tree. */
export function HomeSky({ seed = 3 }: { seed?: number }) {
  const r = rng(seed)
  const roofs = Array.from({ length: 12 }, (_, i) => ({ x: -200 + i * 190 + r() * 40, w: 150 + r() * 60, h: 90 + r() * 120 }))
  return (
    <g pointerEvents="none">
      <rect x={-600} y={-500} width={2800} height={1900} fill="url(#cn-sky-night)" />
      {Array.from({ length: 40 }, (_, i) => (
        <circle key={i} className={i % 3 === 0 ? 'hd-bokeh' : undefined} cx={r() * 1800 - 100} cy={r() * 420 - 40} r={0.8 + r() * 1.4} fill={C.paper} opacity={0.3 + r() * 0.5} />
      ))}
      <circle cx={1170} cy={210} r={260} fill="url(#cn-pool-rim)" opacity={0.6} />
      <circle cx={1170} cy={210} r={46} fill="#eef6ff" />
      <circle cx={1184} cy={200} r={46} fill="#cfe2f5" opacity={0.35} />
      <circle cx={1158} cy={222} r={8} fill="#b9cde3" opacity={0.6} />
      <circle cx={1186} cy={196} r={5} fill="#b9cde3" opacity={0.5} />
      {/* rooftops across the street */}
      <g filter="url(#cn-dof-1)">
        {roofs.map((t, i) => (
          <g key={i}>
            <path d={`M${t.x} ${620 - t.h} l${t.w / 2} -50 l${t.w / 2} 50 V900 H${t.x} Z`} fill={C.ink1} />
            {r() > 0.45 && <rect x={t.x + t.w * 0.3} y={640 - t.h} width={26} height={30} fill={r() > 0.5 ? C.keyLight : C.key} opacity={0.55} />}
          </g>
        ))}
        {/* a tree */}
        <path d="M640 640 L652 470 Q600 450 590 400 Q600 340 660 340 Q690 290 750 320 Q810 320 800 390 Q820 440 760 460 L700 470 L708 640 Z" fill="#060a12" />
      </g>
    </g>
  )
}

/** The back wall of the kitchen: a window with blinds, upper cabinets, a fridge, a clock, the counter. */
export function KitchenWall({ clockClass = 'kw-sec' }: { clockClass?: string }) {
  const win = { x: 900, y: 110, w: 440, h: 410 }
  const slats = Array.from({ length: 17 }, (_, i) => win.y + 8 + i * 24)
  return (
    <g pointerEvents="none">
      <path d={`M-600 -500 H2200 V1400 H-600 Z M${win.x} ${win.y} h${win.w} v${win.h} h${-win.w} Z`} fill="#0c111c" fillRule="evenodd" />
      <rect x={-600} y={-500} width={2800} height={1900} fill="url(#cn-wall)" opacity={0.55} style={{ mixBlendMode: 'multiply' }} />
      {/* blinds: tilted slats with moonlight between them */}
      {slats.map((y, i) => (
        <g key={i}>
          <rect x={win.x} y={y} width={win.w} height={13} fill="#1b2434" />
          <rect x={win.x} y={y + 11} width={win.w} height={2} fill={C.rim} opacity={0.25} />
        </g>
      ))}
      <rect x={win.x + 60} y={win.y} width={2} height={win.h} fill="#2a3446" />
      <rect x={win.x + win.w - 62} y={win.y} width={2} height={win.h} fill="#2a3446" />
      <rect x={win.x - 14} y={win.y - 14} width={win.w + 28} height={18} fill={C.ink2} />
      <rect x={win.x - 24} y={win.y + win.h} width={win.w + 48} height={14} fill={C.ink3} />
      <rect x={win.x - 14} y={win.y - 4} width={14} height={win.h + 4} fill={C.ink1} />
      <rect x={win.x + win.w} y={win.y - 4} width={14} height={win.h + 4} fill={C.ink1} />
      {/* a plant on the sill */}
      <path d={`M${win.x + 360} ${win.y + win.h} l6 -34 h22 l6 34 Z`} fill="#3a2a22" />
      <path d={`M${win.x + 377} ${win.y + win.h - 34} q-30 -30 -18 -64 M${win.x + 377} ${win.y + win.h - 34} q10 -40 34 -52 M${win.x + 377} ${win.y + win.h - 34} q-4 -46 4 -70`} stroke="#1f3a2a" strokeWidth={8} fill="none" strokeLinecap="round" />

      {/* upper cabinets */}
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} transform={`translate(${120 + i * 150} 110)`}>
          <rect width={142} height={200} fill="#151d2b" />
          <rect x={6} y={6} width={130} height={188} fill="none" stroke="#202a3c" strokeWidth={3} />
          <rect x={i % 2 ? 14 : 118} y={150} width={8} height={34} rx={3} fill={C.slate} />
        </g>
      ))}
      {/* range hood over the hob */}
      <path d="M430 310 L590 310 L620 360 L400 360 Z" fill="#1a2232" />
      <rect x={480} y={110} width={60} height={200} fill="#141b28" />
      {/* the clock: two in the morning */}
      <g transform="translate(1480 170)">
        <circle r={46} fill="#141b28" stroke="#2a3446" strokeWidth={5} />
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={-1.5} y={-40} width={3} height={8} fill={C.mist} opacity={0.6} transform={`rotate(${i * 30})`} />
        ))}
        <line x1={0} y1={0} x2={0} y2={-30} stroke={C.paper} strokeWidth={4} strokeLinecap="round" transform="rotate(0)" />
        <line x1={0} y1={0} x2={0} y2={-20} stroke={C.paper} strokeWidth={5} strokeLinecap="round" transform="rotate(60)" />
        <g className={clockClass}>
          <line x1={0} y1={6} x2={0} y2={-36} stroke={C.danger} strokeWidth={1.6} />
        </g>
        <circle r={4} fill={C.paper} />
      </g>
      {/* the fridge, with its little standby light */}
      <rect x={-80} y={130} width={190} height={640} rx={8} fill="#18202f" />
      <rect x={-80} y={360} width={190} height={4} fill={C.ink} />
      <rect x={80} y={180} width={8} height={120} rx={3} fill={C.slate} />
      <rect x={80} y={400} width={8} height={160} rx={3} fill={C.slate} />
      <circle className="hd-blink" cx={20} cy={330} r={4} fill={C.cyan} />
      {/* the back counter, sink under the window */}
      <rect x={120} y={560} width={1700} height={210} fill="#121a28" />
      <rect x={110} y={548} width={1720} height={16} fill="#232e42" />
      <rect x={110} y={548} width={1720} height={3} fill={C.rim} opacity={0.25} />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <g key={i}>
          <rect x={136 + i * 160} y={580} width={146} height={176} fill="none" stroke="#1d2738" strokeWidth={3} />
          <rect x={196 + i * 160} y={596} width={26} height={6} rx={3} fill={C.slate} />
        </g>
      ))}
      {/* hob, kettle, dish rack, fruit bowl */}
      <rect x={430} y={540} width={160} height={10} fill={C.ink} />
      <path d="M1040 548 q0 -70 40 -70 q24 0 24 24" stroke={C.metal} strokeWidth={6} fill="none" />
      <path d="M690 548 l10 -54 h60 l10 54 Z" fill="#2a3446" />
      <path d="M760 510 q22 4 18 26" stroke="#2a3446" strokeWidth={6} fill="none" />
      {[0, 1, 2, 3, 4].map((i) => (
        <ellipse key={i} cx={1200 + i * 16} cy={510} rx={6} ry={36} fill="#cfd8e6" opacity={0.25 + i * 0.05} />
      ))}
      <rect x={1180} y={540} width={110} height={8} fill="#2a3446" />
      <path d="M260 548 q40 -36 80 0 Z" fill="#2a3446" />
      <circle cx={285} cy={526} r={11} fill="#8a3a2c" opacity={0.8} />
      <circle cx={308} cy={522} r={10} fill="#7b8a2c" opacity={0.7} />
    </g>
  )
}

/** Moonlight through the blinds, lying across the floor and the robot: slanted bars of cool light. */
export function MoonStripes({ className, opacity = 1 }: { className?: string; opacity?: number }) {
  return (
    <g className={className} opacity={opacity} pointerEvents="none" style={{ mixBlendMode: 'screen' }} filter="url(#cn-dof-1)">
      {Array.from({ length: 9 }, (_, i) => {
        const y0 = 150 + i * 46
        return <path key={i} d={`M1120 ${y0} L1150 ${y0} L${520 + i * 34} ${y0 + 700} L${470 + i * 34} ${y0 + 700} Z`} fill={C.rim} opacity={0.075} />
      })}
    </g>
  )
}

/** A cat sitting, side-on, facing left. The tail swishes (class `${name}-tail`), the eyes catch light. */
export function Cat({ x, y, s = 1, name = 'cat' }: { x: number; y: number; s?: number; name?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} pointerEvents="none">
      <ellipse cx={0} cy={2} rx={60} ry={8} fill="#000" opacity={0.4} />
      <g className={`${name}-tail`}>
        <path d="M34 -6 Q86 -4 90 -40 Q92 -70 74 -84" stroke="#0b0f17" strokeWidth={11} fill="none" strokeLinecap="round" />
      </g>
      <path d="M-30 0 Q-40 -50 -20 -80 Q0 -100 24 -84 Q46 -60 42 0 Z" fill="#0b0f17" />
      <path d="M-24 -76 Q-46 -84 -46 -108 Q-44 -130 -22 -132 Q0 -130 2 -108 Q2 -88 -24 -76 Z" fill="#0b0f17" />
      <path d="M-40 -122 l-4 -26 l18 16 Z M-12 -126 l6 -24 l8 22 Z" fill="#0b0f17" />
      {/* the rim of moonlight along the back */}
      <path d="M24 -84 Q46 -60 42 0" stroke={C.rim} strokeWidth={2} fill="none" opacity={0.6} />
      <path d="M2 -108 Q2 -88 -24 -76" stroke={C.rim} strokeWidth={1.6} fill="none" opacity={0.4} />
      <g className={`${name}-eyes`}>
        <ellipse cx={-34} cy={-110} rx={5} ry={3.6} fill={C.lime} opacity={0.9} />
        <ellipse cx={-34} cy={-110} rx={1.3} ry={3.2} fill={C.ink} />
      </g>
    </g>
  )
}

/** A stacking-rings toy: the kind of thing a toddler leaves on the floor. */
export function RingToy({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  const cols = ['#e2483d', '#f2a516', '#3fb36b', '#3a8fe0']
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} pointerEvents="none">
      <ellipse cx={0} cy={2} rx={44} ry={7} fill="#000" opacity={0.4} />
      <rect x={-4} y={-110} width={8} height={100} fill="#d9c49a" />
      {cols.map((c, i) => (
        <ellipse key={i} cx={0} cy={-14 - i * 20} rx={40 - i * 7} ry={11} fill={c} />
      ))}
      <circle cx={0} cy={-114} r={9} fill="#e2483d" />
    </g>
  )
}

/** A frying pan, side-on; the grip point of its handle is at (0, 0) and the pan lies to the right. */
export function Pan({ className }: { className?: string }) {
  return (
    <g className={className} pointerEvents="none">
      <rect x={-150} y={-9} width={170} height={18} rx={9} fill="#1a1d24" />
      <rect x={-150} y={-9} width={170} height={4} rx={2} fill={C.slate} opacity={0.7} />
      <path d="M20 -16 L60 -22 L360 -22 L340 34 Q330 46 300 46 L100 46 Q70 46 64 34 Z" fill="#2b2f38" />
      <path d="M60 -22 L360 -22 L356 -12 L64 -12 Z" fill="#4a5060" />
      <path d="M80 30 Q200 42 330 30" stroke={C.key} strokeWidth={2} fill="none" opacity={0.4} />
      {/* steam off the pan */}
      {[0, 1, 2].map((i) => (
        <path key={i} className="hd-drift" d={`M${150 + i * 60} -30 q-14 -30 4 -60 q16 -30 -2 -60`} stroke={C.paper} strokeWidth={3} fill="none" opacity={0.18} />
      ))}
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* A montage kitchen: every home is different                           */
/* ------------------------------------------------------------------ */

const WALLS = ['#1b2333', '#2a2027', '#1d2a26', '#2b2a22', '#202436', '#2d2321', '#182630', '#262434', '#2a2a2a', '#1e2b33']
const FRONTS = ['#3a4a5e', '#6b4a32', '#2f4a3c', '#8a7a5a', '#4a3a5e', '#7a3a32', '#2c3e50', '#5a5a52', '#a08a6a', '#355a5a']

/** One kitchen for the montage, 1600 x 900, all its differences drawn from `seed`. */
export function MiniKitchen({ seed, extra }: { seed: number; extra?: 'dog' | 'toys' | 'sock' | 'cat' | 'laundry' | 'kid' }) {
  const r = rng(seed * 7 + 3)
  const wall = WALLS[seed % WALLS.length]
  const front = FRONTS[(seed * 3) % FRONTS.length]
  const warm = r() > 0.3
  const counterY = 470 + Math.floor(r() * 4) * 22
  const floorY = counterY + 230
  const winX = 200 + r() * 900
  const winW = 260 + r() * 220
  const island = r() > 0.55
  const handle = Math.floor(r() * 3)
  const upper = Math.floor(r() * 3)
  const fridgeLeft = r() > 0.5
  const tile = r() > 0.5
  const doors = Math.floor(5 + r() * 4)
  const dw = 1600 / doors
  const floorCol = ['#3a2a20', '#2a2d33', '#4a3a2a', '#20262e', '#3a3530'][Math.floor(r() * 5)]
  const checker = r() > 0.6
  const pendants = r() > 0.4
  // a different framing for every home: the camera never lands the same way twice
  const zoom = 1 + r() * 0.28
  const fx = (r() - 0.5) * 240
  const lampX = 300 + r() * 1000
  return (
    <g pointerEvents="none">
      <g transform={`translate(${800 + fx} 450) scale(${zoom}) translate(-800 -450)`}>
        <rect x={-200} y={-100} width={2000} height={1100} fill={wall} />
        {tile &&
          Array.from({ length: 32 }, (_, i) => (
            <rect key={i} x={-40 + (i % 16) * 108} y={counterY - 120 + Math.floor(i / 16) * 54} width={104} height={50} fill="#ffffff" opacity={0.04} />
          ))}
        {/* window and the night outside */}
        <rect x={winX} y={110} width={winW} height={counterY - 200} fill={warm ? '#16223c' : '#22304a'} />
        <circle cx={winX + winW * 0.7} cy={180} r={22} fill={C.paper} opacity={0.65} />
        <rect x={winX + winW / 2 - 4} y={110} width={8} height={counterY - 200} fill={wall} />
        <rect x={winX - 10} y={counterY - 92} width={winW + 20} height={10} fill={front} opacity={0.7} />
        {upper === 0 &&
          [0, 1, 2].map((i) => (
            <g key={i}>
              <rect x={winX + winW + 60} y={170 + i * 80} width={420} height={10} fill={front} />
              {Array.from({ length: 5 }, (_, k) => (
                <rect key={k} x={winX + winW + 80 + k * 70 + r() * 20} y={130 + i * 80} width={30 + r() * 20} height={40} rx={4} fill={['#d9d0c0', '#8aa0b8', '#c06a4a', '#e0c070'][k % 4]} opacity={0.55} />
              ))}
            </g>
          ))}
        {upper === 1 &&
          Array.from({ length: 4 }, (_, i) => (
            <rect key={i} x={(winX > 700 ? 60 : winX + winW + 60) + i * 130} y={100} width={122} height={200} fill={front} stroke={C.ink} strokeOpacity={0.4} strokeWidth={4} />
          ))}
        {/* light switch: toggle, rocker or knob */}
        <g transform={`translate(${winX - 70} ${counterY - 130})`}>
          <rect x={-14} y={-20} width={28} height={40} rx={3} fill="#d8d4cc" opacity={0.8} />
          {handle === 0 && <rect x={-3} y={-12} width={6} height={14} fill="#888" />}
          {handle === 1 && <rect x={-9} y={-14} width={18} height={20} rx={2} fill="#bbb" />}
          {handle === 2 && <circle r={8} fill="#999" />}
        </g>
        {/* floor */}
        <rect x={-200} y={floorY} width={2000} height={400} fill={floorCol} />
        {checker
          ? Array.from({ length: 40 }, (_, i) => (i + Math.floor(i / 20)) % 2 === 0 && <rect key={i} x={-200 + (i % 20) * 100} y={floorY + Math.floor(i / 20) * 100} width={100} height={100} fill="#fff" opacity={0.06} />)
          : Array.from({ length: 12 }, (_, i) => <line key={i} x1={-200 + i * 180} y1={floorY} x2={-400 + i * 240} y2={1000} stroke="#000" strokeOpacity={0.3} strokeWidth={3} />)}
        {/* counter and doors */}
        <rect x={-200} y={counterY} width={2000} height={floorY - counterY} fill={front} />
        <rect x={-200} y={floorY - 14} width={2000} height={14} fill="#000" opacity={0.35} />
        <rect x={-200} y={counterY - 16} width={2000} height={18} fill={warm ? '#d8c8a8' : '#7d8899'} opacity={0.85} />
        {Array.from({ length: doors }, (_, i) => (
          <g key={i}>
            <rect x={i * dw + 8} y={counterY + 14} width={dw - 16} height={floorY - counterY - 40} fill="none" stroke={C.ink} strokeOpacity={0.35} strokeWidth={4} />
            {handle === 0 && <rect x={i * dw + dw / 2 - 30} y={counterY + 30} width={60} height={7} rx={3} fill="#c8c8c8" opacity={0.8} />}
            {handle === 1 && <circle cx={i * dw + (i % 2 ? 26 : dw - 26)} cy={counterY + 60} r={7} fill="#c8a060" />}
          </g>
        ))}
        {/* fridge */}
        <rect x={fridgeLeft ? 40 : 1340} y={90} width={220} height={floorY - 90} rx={10} fill={r() > 0.5 ? '#aeb4bc' : '#3a3f48'} />
        <rect x={fridgeLeft ? 228 : 1356} y={300} width={10} height={180} rx={4} fill={C.ink} opacity={0.5} />
        {/* clutter on the counter */}
        {Array.from({ length: 5 + Math.floor(r() * 4) }, (_, i) => {
          const x = 320 + r() * 1000
          const k = Math.floor(r() * 5)
          const y = counterY - 16
          if (k === 0) return <rect key={i} x={x} y={y - 70} width={44} height={70} fill={['#c0392b', '#e0b020', '#2c7ab0'][i % 3]} />
          if (k === 1) return <path key={i} d={`M${x} ${y} q30 -40 60 0 Z`} fill="#d9d0c0" />
          if (k === 2) return <rect key={i} x={x} y={y - 40} width={30} height={40} rx={6} fill="#e8e4dc" opacity={0.8} />
          if (k === 3) return <path key={i} d={`M${x} ${y} l8 -60 h30 l8 60 Z`} fill="#5a6a7a" />
          return (
            <g key={i}>
              {[0, 1, 2, 3].map((j) => (
                <ellipse key={j} cx={x + j * 12} cy={y - 30} rx={5} ry={30} fill="#e8e8f0" opacity={0.6} />
              ))}
            </g>
          )
        })}
        {/* an island with stools */}
        {island && (
          <g>
            <rect x={420} y={floorY - 40} width={760} height={300} fill={front} />
            <rect x={400} y={floorY - 56} width={800} height={20} fill={warm ? '#e0d0b0' : '#9aa4b4'} />
            {[520, 760, 1000].map((sx) => (
              <g key={sx}>
                <rect x={sx} y={floorY + 30} width={70} height={14} rx={6} fill="#20252e" />
                <rect x={sx + 30} y={floorY + 44} width={8} height={160} fill="#20252e" />
              </g>
            ))}
          </g>
        )}
        {/* the things that make every home its own */}
        {extra === 'dog' && (
          <g transform={`translate(${island ? 1240 : 900} ${floorY + 150})`}>
            <ellipse cx={0} cy={-4} rx={110} ry={10} fill="#000" opacity={0.35} />
            <path d="M-90 -10 L-86 -80 Q-80 -120 -20 -120 L60 -120 Q90 -124 100 -150 L110 -190 Q130 -210 150 -190 L170 -160 Q176 -140 150 -134 L120 -110 L110 -10 L90 -10 L86 -80 L-40 -80 L-60 -10 Z" fill="#7a5530" />
            <path d="M-86 -100 Q-120 -120 -130 -150" stroke="#7a5530" strokeWidth={14} fill="none" strokeLinecap="round" />
            <path d="M120 -196 l-6 40 l20 -6 Z" fill="#4a3018" />
            <circle cx={152} cy={-172} r={4} fill={C.ink} />
          </g>
        )}
        {extra === 'toys' && (
          <g transform={`translate(0 ${floorY - 760})`}>
            <RingToy x={300} y={890} s={1.2} />
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x={560 + i * 60 + (i % 2) * 20} y={850 - (i === 3 ? 50 : 0)} width={48} height={48} fill={['#e2483d', '#3a8fe0', '#f2a516', '#3fb36b'][i]} transform={`rotate(${i * 9 - 10} ${584 + i * 60} ${874})`} />
            ))}
            <circle cx={1050} cy={866} r={30} fill="#e2483d" />
            <path d="M1020 866 q30 -12 60 0" stroke="#fff" strokeWidth={4} fill="none" />
          </g>
        )}
        {extra === 'sock' && (
          <g transform={`translate(0 ${floorY + 140 - 900})`}>
            <rect x={900} y={640} width={160} height={16} fill="#3a2a20" />
            <rect x={906} y={656} width={12} height={244} fill="#3a2a20" />
            <rect x={1042} y={656} width={12} height={244} fill="#3a2a20" />
            <rect x={1000} y={460} width={14} height={196} fill="#3a2a20" />
            <path d="M940 890 q-10 -30 10 -36 l36 -4 q8 20 -6 30 l-20 14 q-14 6 -20 -4 Z" fill="#e8e0d0" />
            <path d="M946 856 l36 -4" stroke={C.danger} strokeWidth={4} />
          </g>
        )}
        {extra === 'cat' && <Cat x={1100} y={counterY - 16} s={1.1} name={`mk${seed}`} />}
        {extra === 'laundry' && (
          <g transform={`translate(0 ${floorY + 150 - 900})`}>
            <path d="M620 900 q-40 -80 40 -120 q60 -30 120 10 q80 -20 110 40 q20 50 -10 70 Z" fill="#5a6a9a" />
            <path d="M680 820 q40 -30 90 -6 q40 10 60 40" stroke="#c8b8e8" strokeWidth={14} fill="none" opacity={0.7} />
          </g>
        )}
        {extra === 'kid' && (
          <g>
            {[0, 1, 2].map((i) => (
              <g key={i} transform={`translate(${380 + i * 120} ${180 + (i % 2) * 30}) rotate(${i * 5 - 5})`}>
                <rect width={96} height={120} fill="#f0ece0" />
                <circle cx={48} cy={50} r={24} fill="none" stroke={['#e2483d', '#3a8fe0', '#3fb36b'][i]} strokeWidth={5} />
                <path d="M20 100 l20 -20 l20 20 l20 -20" stroke="#f2a516" strokeWidth={4} fill="none" />
              </g>
            ))}
          </g>
        )}
        {/* pendant lamps, or one lamp somewhere */}
        {pendants ? (
          [0, 1, 2].map((i) => (
            <g key={i}>
              <line x1={500 + i * 300} y1={-100} x2={500 + i * 300} y2={60} stroke="#000" strokeWidth={3} />
              <path d={`M${470 + i * 300} 90 L${530 + i * 300} 90 L${515 + i * 300} 60 L${485 + i * 300} 60 Z`} fill={warm ? '#e0a050' : '#9ab0c8'} />
              <path d={`M${470 + i * 300} 90 L${530 + i * 300} 90 L${640 + i * 300} ${counterY} L${360 + i * 300} ${counterY} Z`} fill={warm ? 'url(#cn-beam-key)' : 'url(#cn-beam-rim)'} opacity={0.5} />
            </g>
          ))
        ) : (
          <Pool x={lampX} y={counterY - 60} r={520} color={warm ? 'key' : 'rim'} opacity={0.8} />
        )}
        <Pool x={warm ? 600 + r() * 400 : 800} y={warm ? 420 : 300} r={warm ? 760 : 820} color={warm ? 'key' : 'rim'} opacity={warm ? 0.5 : 0.35} />
      </g>
      <rect x={0} y={0} width={1600} height={900} fill={C.ink} opacity={0.22} />
    </g>
  )
}

/** The contrast: a factory line where everything is in neat rows. 1600 x 900. */
export function FactoryLine() {
  return (
    <g pointerEvents="none">
      <rect x={-200} y={-200} width={2000} height={1300} fill="#0d141f" />
      {/* lights in a row */}
      {[200, 500, 800, 1100, 1400].map((x) => (
        <g key={x}>
          <rect x={x - 60} y={60} width={120} height={10} fill={C.paper} opacity={0.8} />
          <path d={`M${x - 60} 70 L${x + 60} 70 L${x + 160} 600 L${x - 160} 600 Z`} fill="url(#cn-beam-white)" opacity={0.25} />
        </g>
      ))}
      {/* floor grid in perspective */}
      <rect x={-200} y={640} width={2000} height={600} fill="#121b29" />
      {Array.from({ length: 13 }, (_, i) => (
        <line key={i} x1={800 + (i - 6) * 140} y1={640} x2={800 + (i - 6) * 420} y2={900} stroke={C.gold} strokeOpacity={0.18} strokeWidth={2} />
      ))}
      {[680, 740, 820].map((y) => (
        <line key={y} x1={-200} y1={y} x2={1800} y2={y} stroke={C.gold} strokeOpacity={0.12} strokeWidth={2} />
      ))}
      {/* the belt */}
      <rect x={-200} y={560} width={2000} height={40} fill="#202a3a" />
      <rect x={-200} y={560} width={2000} height={4} fill={C.metal} opacity={0.5} />
      {Array.from({ length: 22 }, (_, i) => (
        <circle key={i} cx={-180 + i * 90} cy={596} r={10} fill="#2c3a50" />
      ))}
      <g className="fl-boxes">
        {Array.from({ length: 12 }, (_, i) => (
          <g key={i} transform={`translate(${-60 + i * 160} 500)`}>
            <rect width={70} height={60} fill="#b88a50" />
            <rect y={24} width={70} height={10} fill="#8a6430" />
          </g>
        ))}
      </g>
      {/* identical arms, evenly spaced */}
      {[260, 660, 1060, 1460].map((x) => (
        <Arm key={x} name={`fl${x}`} x={x} y={480} s={0.75} flip a1={-150} a2={95} a3={145} grip={0.5} shell={C.gold} />
      ))}
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* A simple robot arm with its own rig                                  */
/* ------------------------------------------------------------------ */

/** Lengths of the arm's links, in its own units. The shoulder sits SH above the base. */
export const ARM = { L1: 150, L2: 130, G: 44, SH: 40 }

export interface ArmState {
  a1: number
  a2: number
  a3: number
  /** 0 closed, 1 open. */
  grip: number
  /** 1 while the arm carries its object. */
  carry: number
  /** Where the object rests when not carried (arm units). */
  ox: number
  oy: number
}

const rad = (d: number) => (d * Math.PI) / 180

/** Where the fingertips are for joint angles a1, a2, a3 (arm units, y down). */
export function armTip(s: Pick<ArmState, 'a1' | 'a2' | 'a3'>) {
  const t1 = rad(s.a1)
  const t2 = rad(s.a1 + s.a2)
  const t3 = rad(s.a1 + s.a2 + s.a3)
  return {
    x: ARM.L1 * Math.cos(t1) + ARM.L2 * Math.cos(t2) + ARM.G * Math.cos(t3),
    y: -ARM.SH + ARM.L1 * Math.sin(t1) + ARM.L2 * Math.sin(t2) + ARM.G * Math.sin(t3),
  }
}

/** Joint angles that put the fingertips at (x, y) with the gripper pointing at `th` degrees (90 = straight down), elbow up. */
export function armIK(x: number, y: number, th = 90) {
  const wx = x - ARM.G * Math.cos(rad(th))
  const wy = y - ARM.G * Math.sin(rad(th)) + ARM.SH
  const d = Math.min(ARM.L1 + ARM.L2 - 0.5, Math.hypot(wx, wy))
  const c2 = Math.max(-1, Math.min(1, (d * d - ARM.L1 * ARM.L1 - ARM.L2 * ARM.L2) / (2 * ARM.L1 * ARM.L2)))
  const best = [1, -1]
    .map((sg) => {
      const a2 = sg * Math.acos(c2)
      const a1 = Math.atan2(wy, wx) - Math.atan2(ARM.L2 * Math.sin(a2), ARM.L1 + ARM.L2 * Math.cos(a2))
      const ey = ARM.L1 * Math.sin(a1)
      return { a1: (a1 * 180) / Math.PI, a2: (a2 * 180) / Math.PI, ey }
    })
    .sort((p, q) => p.ey - q.ey)[0]
  const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180
  return { a1: best.a1, a2: best.a2, a3: wrap(th - best.a1 - best.a2) }
}

/**
 * A two-link robot arm on a pedestal with a parallel gripper, seen side-on. (x, y) is the
 * foot of the base. Its object (`obj`, drawn around its grip point) rides in the gripper while
 * `carry` is 1. Animate with `armRig(scope, name)`.
 */
export function Arm({ name, x, y, s = 1, flip = false, a1 = -70, a2 = 110, a3 = 50, grip = 1, carry = 0, ox = 0, oy = 0, shell = C.shell, obj, light = true }: {
  name: string
  x: number
  y: number
  s?: number
  flip?: boolean
  a1?: number
  a2?: number
  a3?: number
  grip?: number
  carry?: number
  ox?: number
  oy?: number
  shell?: string
  obj?: ReactNode
  light?: boolean
}) {
  const tip = armTip({ a1, a2, a3 })
  const o = carry ? tip : { x: ox, y: oy }
  const g = 3 + grip * 11
  return (
    <g className={`arm arm-${name}`} transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} pointerEvents="none">
      <ellipse cx={0} cy={2} rx={60} ry={8} fill="#000" opacity={0.4} />
      <path d="M-44 0 L-34 -30 L34 -30 L44 0 Z" fill={C.carbon} />
      <rect x={-20} y={-44} width={40} height={16} fill={C.metalDark} />
      {obj && (
        <g data-a="obj" transform={`translate(${o.x.toFixed(1)} ${o.y.toFixed(1)})`}>
          {obj}
        </g>
      )}
      <g data-a="1" transform={`translate(0 ${-ARM.SH}) rotate(${a1})`}>
        <path d={`M0 -14 L${ARM.L1} -10 L${ARM.L1} 10 L0 14 Z`} fill={shell} />
        <path d={`M6 4 L${ARM.L1 - 6} 4 L${ARM.L1 - 6} 9 L6 11 Z`} fill={C.shellDark} opacity={0.5} />
        <g data-a="2" transform={`translate(${ARM.L1} 0) rotate(${a2})`}>
          <path d={`M0 -10 L${ARM.L2} -7 L${ARM.L2} 7 L0 10 Z`} fill={shell} />
          <path d={`M6 3 L${ARM.L2 - 6} 3 L${ARM.L2 - 6} 7 L6 8 Z`} fill={C.shellDark} opacity={0.5} />
          <g data-a="3" transform={`translate(${ARM.L2} 0) rotate(${a3})`}>
            <rect x={0} y={-15} width={20} height={30} rx={3} fill={C.carbon} />
            <g data-a="f1" transform={`translate(0 ${-g})`}>
              <rect x={18} y={-4} width={30} height={7} rx={2} fill={C.metal} />
            </g>
            <g data-a="f2" transform={`translate(0 ${g})`}>
              <rect x={18} y={-3} width={30} height={7} rx={2} fill={C.metal} />
            </g>
            {light && <circle cx={10} cy={0} r={3} fill={C.lime} opacity={0.9} />}
          </g>
          <circle r={11} fill={C.carbon} />
          <circle r={4.5} fill={C.metal} />
        </g>
        <circle cx={ARM.L1} cy={0} r={13} fill={C.carbon} />
        <circle cx={ARM.L1} cy={0} r={5} fill={C.metal} />
      </g>
      <circle cx={0} cy={-ARM.SH} r={17} fill={C.carbon} />
      <circle cx={0} cy={-ARM.SH} r={6} fill={C.metal} />
    </g>
  )
}

export interface ArmRig {
  to: (tl: gsap.core.Timeline, next: Partial<ArmState>, at: gsap.Position, dur?: number, ease?: string) => void
  /** Move the fingertips to (x, y) in arm units, gripper at `th` degrees. */
  reach: (tl: gsap.core.Timeline, x: number, y: number, at: gsap.Position, dur?: number, opts?: { th?: number; grip?: number; ease?: string }) => void
  grab: (tl: gsap.core.Timeline, at: gsap.Position) => void
  release: (tl: gsap.core.Timeline, at: gsap.Position) => void
  state: ArmState
  apply: () => void
}

/** Animates an Arm found inside `scope` by name. Every move is a fromTo, so seeking redraws. */
export function armRig(scope: Element | null, name: string, start: Partial<ArmState> = {}): ArmRig {
  const el = scope?.querySelector(`.arm-${name}`) ?? null
  const nodes = new Map<string, Element>()
  el?.querySelectorAll('[data-a]').forEach((n) => nodes.set(n.getAttribute('data-a') ?? '', n))
  const state: ArmState = { a1: -70, a2: 110, a3: 50, grip: 1, carry: 0, ox: 0, oy: 0, ...start }
  let planned: ArmState = { ...state }
  const apply = () => {
    nodes.get('1')?.setAttribute('transform', `translate(0 ${-ARM.SH}) rotate(${state.a1.toFixed(2)})`)
    nodes.get('2')?.setAttribute('transform', `translate(${ARM.L1} 0) rotate(${state.a2.toFixed(2)})`)
    nodes.get('3')?.setAttribute('transform', `translate(${ARM.L2} 0) rotate(${state.a3.toFixed(2)})`)
    const g = 3 + state.grip * 11
    nodes.get('f1')?.setAttribute('transform', `translate(0 ${(-g).toFixed(2)})`)
    nodes.get('f2')?.setAttribute('transform', `translate(0 ${g.toFixed(2)})`)
    const o = state.carry >= 0.5 ? armTip(state) : { x: state.ox, y: state.oy }
    nodes.get('obj')?.setAttribute('transform', `translate(${o.x.toFixed(1)} ${o.y.toFixed(1)})`)
  }
  apply()
  const to: ArmRig['to'] = (tl, next, at, dur = 0.8, ease = 'power2.inOut') => {
    const from = { ...planned }
    planned = { ...planned, ...next }
    tl.fromTo(state, { ...from }, { ...planned, duration: dur, ease, immediateRender: false, onUpdate: apply }, at)
  }
  const reach: ArmRig['reach'] = (tl, x, y, at, dur = 0.8, opts = {}) => {
    const a = armIK(x, y, opts.th ?? 90)
    to(tl, { ...a, ...(opts.grip !== undefined ? { grip: opts.grip } : {}) }, at, dur, opts.ease)
  }
  const grab: ArmRig['grab'] = (tl, at) => to(tl, { carry: 1 }, at, 0.01, 'none')
  const release: ArmRig['release'] = (tl, at) => {
    const t = armTip(planned)
    to(tl, { carry: 0, ox: t.x, oy: t.y }, at, 0.01, 'none')
  }
  return { to, reach, grab, release, state, apply }
}

/** A mug, drawn around its grip point (the middle of its body). */
export function Mug({ color = '#e8e4dc', s = 1 }: { color?: string; s?: number }) {
  return (
    <g transform={`scale(${s})`}>
      <path d="M-18 -20 L18 -20 L16 24 Q16 28 12 28 L-12 28 Q-16 28 -16 24 Z" fill={color} />
      <path d="M17 -10 q16 0 14 14 q-2 12 -15 10" stroke={color} strokeWidth={5} fill="none" />
      <ellipse cx={0} cy={-20} rx={18} ry={4} fill="#000" opacity={0.25} />
    </g>
  )
}

/** A block, drawn around its grip point. */
export function Block({ color = C.cyan, s = 1 }: { color?: string; s?: number }) {
  return (
    <g transform={`scale(${s})`}>
      <rect x={-18} y={-18} width={36} height={36} rx={3} fill={color} />
      <rect x={-18} y={-18} width={36} height={8} rx={3} fill="#fff" opacity={0.25} />
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* The living room at dusk                                              */
/* ------------------------------------------------------------------ */

/** NEO-like colours for the home humanoid: a soft knit shell, warm grey joints. */
export const HOMEBOT = { shell: '#d6cdbf', joint: '#4b4540', visor: '#fff4e0' }

/** Where a robot's ear sits for a person-rig figure at (x, y) scale s with head and torso level. */
export const earAt = (x: number, y: number, s: number, flip = false) => ({ x: x + (flip ? -8 : 8) * s, y: y - 284 * s })

/**
 * A cosy living room at dusk, 1600 x 900: window with the last of the light, sofa, floor lamp,
 * bookcase, a family photo, a child's drawing, an open letter on the coffee table, a laundry
 * basket. `guest` seats a visitor on the sofa. Classes on the private things let a scene
 * outline them: `${p}-photo`, `${p}-letter`, `${p}-drawing`, `${p}-guest`.
 */
export function LivingRoom({ p = 'lr', guest = false, lampClass }: { p?: string; guest?: boolean; lampClass?: string }) {
  return (
    <g pointerEvents="none">
      <rect x={-600} y={-400} width={2800} height={1700} fill="#1c1820" />
      {/* the window at dusk */}
      <rect x={980} y={120} width={420} height={440} fill="url(#cn-sky-dawn)" />
      <circle cx={1300} cy={520} r={160} fill="url(#cn-pool-key)" opacity={0.7} />
      <path d="M980 520 q60 -40 120 -10 q80 -50 160 0 q80 -30 140 10 V560 H980 Z" fill="#1a1520" opacity={0.9} />
      <rect x={1186} y={120} width={8} height={440} fill="#2a2228" />
      <rect x={980} y={330} width={420} height={8} fill="#2a2228" />
      <rect x={960} y={100} width={460} height={20} fill="#2a2228" />
      <rect x={960} y={560} width={460} height={18} fill="#3a2e30" />
      {/* curtains */}
      <path d="M930 90 q30 240 0 520 h60 q-20 -260 0 -520 Z" fill="#5a2e30" />
      <path d="M1390 90 q30 240 0 520 h60 q-20 -260 0 -520 Z" fill="#5a2e30" />
      {/* bookcase */}
      <rect x={60} y={140} width={300} height={640} fill="#2a2025" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={70} y={290 + i * 150} width={280} height={10} fill="#3a2e32" />
          {Array.from({ length: 9 }, (_, k) => (
            <rect key={k} x={80 + k * 29} y={196 + i * 150 + (k % 3) * 6} width={22} height={94 - (k % 3) * 6} fill={['#7a3a32', '#2c4a6a', '#8a7a4a', '#3a5a4a', '#6a4a6a'][(k + i) % 5]} opacity={0.75} />
          ))}
        </g>
      ))}
      {/* the family photo on the wall */}
      <g className={`${p}-photo`}>
        <rect x={470} y={170} width={200} height={150} fill="#c8b48a" />
        <rect x={482} y={182} width={176} height={126} fill="#3a4a5a" />
        <rect x={482} y={262} width={176} height={46} fill="#5a6a4a" />
        {[530, 580, 620].map((fx, i) => (
          <g key={fx}>
            <circle cx={fx} cy={232 - (i === 2 ? -14 : 0)} r={i === 2 ? 11 : 15} fill={['#e8b48f', '#7a4a2e', '#b97c55'][i]} />
            <path d={`M${fx - (i === 2 ? 14 : 20)} 308 q${i === 2 ? 14 : 20} -60 ${i === 2 ? 28 : 40} 0 Z`} fill={['#9c4a2c', '#2f5d62', '#e0b040'][i]} />
          </g>
        ))}
      </g>
      {/* a child's drawing taped up */}
      <g className={`${p}-drawing`} transform="translate(730 210) rotate(4)">
        <rect width={130} height={100} fill="#f2ede2" />
        <path d="M20 80 L50 40 L80 80 Z" fill="none" stroke="#e2483d" strokeWidth={4} />
        <circle cx={100} cy={28} r={14} fill="none" stroke="#f2a516" strokeWidth={4} />
        <path d="M10 90 H120" stroke="#3fb36b" strokeWidth={4} />
        <path d="M44 62 v18 M56 62 v18" stroke="#3a8fe0" strokeWidth={3} />
        <rect x={50} y={-8} width={30} height={14} fill="#f0e0a0" opacity={0.7} />
      </g>
      {/* floor and rug */}
      <rect x={-600} y={760} width={2800} height={700} fill="#241c1c" />
      <rect x={-600} y={760} width={2800} height={4} fill={C.key} opacity={0.15} />
      <ellipse cx={720} cy={850} rx={520} ry={70} fill="#4a2e2a" opacity={0.85} />
      <ellipse cx={720} cy={850} rx={480} ry={58} fill="none" stroke="#7a4a3a" strokeWidth={4} opacity={0.6} />
      {/* the floor lamp */}
      <g className={lampClass}>
        <Pool x={880} y={420} r={620} color="key" opacity={0.95} />
      </g>
      <rect x={876} y={330} width={8} height={430} fill="#2a2228" />
      <ellipse cx={880} cy={762} rx={40} ry={8} fill="#2a2228" />
      <path d="M836 330 L924 330 L904 270 L856 270 Z" fill="#f2c890" />
      <path d="M840 330 L920 330" stroke={C.keyLight} strokeWidth={4} />
      {/* sofa */}
      <g>
        <rect x={380} y={560} width={460} height={110} rx={30} fill="#3a4a6a" />
        <rect x={360} y={640} width={500} height={110} rx={24} fill="#43557a" />
        <rect x={340} y={600} width={60} height={160} rx={24} fill="#3a4a6a" />
        <rect x={820} y={600} width={60} height={160} rx={24} fill="#3a4a6a" />
        <rect x={380} y={750} width={14} height={20} fill="#1a1414" />
        <rect x={826} y={750} width={14} height={20} fill="#1a1414" />
        <rect x={420} y={590} width={110} height={70} rx={20} fill="#c06a4a" opacity={0.85} transform="rotate(-8 475 625)" />
      </g>
      {guest && (
        <g className={`${p}-guest`}>
          <Person name={`${p}-guestp`} x={700} y={720} s={0.92} pose={{ ...POSES.sit, armN: 30, elbowN: 60 }} hair="long" hairColor="#5a3a22" top="#7a5a8a" topDark="#4a3a5a" skin={C.skinA} skinDark={C.skinADark} light="key-left" />
        </g>
      )}
      {/* coffee table with the open letter */}
      <rect x={540} y={790} width={300} height={16} rx={4} fill="#5a3e2e" />
      <rect x={560} y={806} width={12} height={50} fill="#3a2a20" />
      <rect x={808} y={806} width={12} height={50} fill="#3a2a20" />
      <g className={`${p}-letter`} transform="translate(600 776) rotate(-6)">
        <path d="M0 0 L120 0 L120 14 L0 14 Z" fill="#f2ede2" />
        <path d="M0 0 L60 -10 L120 0" fill="#e6dfd0" />
        {[3, 7, 11].map((y) => (
          <rect key={y} x={10} y={y} width={90} height={1.6} fill="#5a5a6a" />
        ))}
      </g>
      <rect x={760} y={770} width={30} height={20} rx={4} fill="#c8c0b0" />
    </g>
  )
}

/** The laundry basket, with a folded stack beside it. */
export function Laundry({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} pointerEvents="none">
      <path d="M-70 0 L-60 -80 L60 -80 L70 0 Z" fill="#8a7a62" />
      {[-60, -40, -20].map((yy) => (
        <path key={yy} d={`M-62 ${yy} H62`} stroke="#6a5a44" strokeWidth={3} />
      ))}
      <path d="M-60 -80 q20 -30 50 -14 q30 -24 60 2 q10 10 10 12 Z" fill="#c8b8e8" />
      <path d="M-30 -96 q20 -10 40 4" stroke="#e8e0f0" strokeWidth={8} fill="none" />
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* The course tree                                                      */
/* ------------------------------------------------------------------ */

/** The films, as nodes of the tree: trunk (amber) and the data branch (lime). Stage coordinates. */
export const TREE = {
  trunk: [
    { t: 'The Hardest Machine', x: 800, y: 780 },
    { t: 'Joints and Freedom', x: 784, y: 660 },
    { t: 'Muscles of Metal', x: 800, y: 540 },
    { t: 'The Sense of Touch', x: 790, y: 420 },
    { t: 'A Million Hands', x: 806, y: 300 },
    { t: 'Build Your Own Hand', x: 800, y: 170 },
  ],
  data: [
    { t: 'The Missing Internet', x: 990, y: 640 },
    { t: 'Ways to Get Data', x: 1110, y: 520 },
    { t: 'How Robots Learn', x: 1150, y: 390 },
    { t: 'The Home Robot Frontier', x: 1090, y: 270 },
  ],
}

/** The path of the data branch, from the first film up to the home film. */
export const BRANCH_D = 'M800 780 C 880 740 950 690 990 640 C 1040 590 1090 570 1110 520 C 1140 460 1160 430 1150 390 C 1140 340 1120 300 1090 270'
/** The curl from the home film back to the trunk's frontier node. */
export const CURL_D = 'M1090 270 C 1050 230 1000 150 930 140 C 880 134 840 150 812 166'
export const TRUNK_D = 'M800 860 C 790 780 780 720 784 660 C 790 600 806 580 800 540 C 794 480 784 460 790 420 C 798 370 810 340 806 300 C 802 250 796 210 800 170'

export function CourseTree({ p = 'ct', lit = true }: { p?: string; lit?: boolean }) {
  return (
    <g pointerEvents="none">
      <path className={`${p}-trunk`} d={TRUNK_D} stroke={C.amber} strokeWidth={12} fill="none" strokeLinecap="round" opacity={0.9} filter="url(#cn-bloom)" />
      <path className={`${p}-branch`} d={BRANCH_D} stroke={C.lime} strokeWidth={8} fill="none" strokeLinecap="round" filter="url(#cn-bloom)" />
      <path className={`${p}-curl`} d={CURL_D} stroke={C.lime} strokeWidth={5} fill="none" strokeLinecap="round" strokeDasharray="420" strokeDashoffset="420" filter="url(#cn-bloom)" />
      {TREE.trunk.map((n, i) => (
        <g key={n.t} className={`${p}-node ${p}-tn${i}`}>
          <circle cx={n.x} cy={n.y} r={i === 5 ? 22 : 16} fill={lit ? C.amber : C.ink3} stroke={C.amberLight} strokeWidth={3} />
          <circle cx={n.x} cy={n.y} r={40} fill="url(#cn-pool-amber)" />
          <text x={n.x - 34} y={n.y + 8} textAnchor="end" fill={C.amberLight} fontFamily={SANS} fontSize={22} fontWeight={500}>
            {n.t}
          </text>
        </g>
      ))}
      {TREE.data.map((n, i) => (
        <g key={n.t} className={`${p}-node ${p}-dn${i}`}>
          <circle cx={n.x} cy={n.y} r={i === 3 ? 20 : 14} fill={lit ? C.lime : C.ink3} stroke={C.limeLight} strokeWidth={3} />
          <circle cx={n.x} cy={n.y} r={40} fill="url(#cn-pool-lime)" />
          <text x={n.x + 30} y={n.y + 8} fill={C.limeLight} fontFamily={SANS} fontSize={22} fontWeight={500}>
            {n.t}
          </text>
        </g>
      ))}
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Small things                                                         */
/* ------------------------------------------------------------------ */

/** A little house icon, lit by `fill`. (x, y) is the middle of its floor. */
export function HouseIcon({ x, y, s = 1, fill = C.ink3, stroke = C.slate, className, glow = false }: { x: number; y: number; s?: number; fill?: string; stroke?: string; className?: string; glow?: boolean }) {
  return (
    <g className={className} transform={`translate(${x} ${y}) scale(${s})`} pointerEvents="none">
      {glow && <circle cx={0} cy={-22} r={40} fill={fill} opacity={0.18} />}
      <path d="M-22 0 V-26 L0 -44 L22 -26 V0 Z" fill={fill} stroke={stroke} strokeWidth={2.5} strokeLinejoin="round" style={{ transition: 'fill 0.35s, stroke 0.35s' }} />
      <rect x={-6} y={-16} width={12} height={16} fill={C.ink} opacity={0.55} />
    </g>
  )
}

/** "0.99^20 ≈ 82%" set with a proper superscript. */
export function PowerText({ x, y, base, exp, rest, size = 64, color = C.lime, className, anchor = 'middle' }: { x: number; y: number; base: string; exp: string; rest: string; size?: number; color?: string; className?: string; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <text className={className} x={x} y={y} fill={color} fontFamily={MONO} fontSize={size} textAnchor={anchor} pointerEvents="none" style={{ fontVariantNumeric: 'tabular-nums' }}>
      {base}
      <tspan dy={-size * 0.42} fontSize={size * 0.6}>
        {exp}
      </tspan>
      <tspan dy={size * 0.42}>{rest}</tspan>
    </text>
  )
}

/** A short serif caption for a scene (used sparingly). */
export function Caption({ x, y, children, size = 34, color = C.paper, className, anchor = 'middle' }: { x: number; y: number; children: ReactNode; size?: number; color?: string; className?: string; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <text className={className} x={x} y={y} fill={color} fontFamily={SERIF} fontSize={size} fontWeight={500} textAnchor={anchor} opacity={0} pointerEvents="none">
      {children}
    </text>
  )
}

/** A home humanoid (NEO-like colours) on the person rig. */
export function HomeBot({ name, x, y, s = 1, flip = false, pose, light = 'key-left', silhouette }: { name: string; x: number; y: number; s?: number; flip?: boolean; pose?: Partial<Pose>; light?: 'key-left' | 'key-right' | 'soft-left' | 'soft-right' | 'cool-left' | 'cool-right' | 'back' | 'none'; silhouette?: string }) {
  return <Robot name={name} x={x} y={y} s={s} flip={flip} pose={pose} light={light} shell={HOMEBOT.shell} joint={HOMEBOT.joint} visor={HOMEBOT.visor} silhouette={silhouette} />
}
