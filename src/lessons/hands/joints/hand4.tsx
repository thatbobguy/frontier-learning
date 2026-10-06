/**
 * A copy of the cine kit's Hand3D renderer (src/cine/hand3d.tsx) with one addition this film
 * needs: `hide` leaves whole fingers out (Atlas's hand has no pinky). Also exports the
 * projector so scenes can pin things (motors, a saddle, tape) to points on the hand.
 * Uses the kit's stores, poses and skeleton, so it animates exactly like Hand3D.
 */
import { useEffect, useReducer } from 'react'
import { C } from '../../../cine/palette'
import { FINGERS, handSegments, type FingerName, type HandLook, type HandStore, type HandView } from '../../../cine/hand3d'

type V3 = [number, number, number]
type M3 = [number, number, number, number, number, number, number, number, number]

const rad = (d: number) => (d * Math.PI) / 180
const mul = (a: M3, b: M3): M3 => [
  a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
  a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
  a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
  a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
  a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
  a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
  a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
  a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
  a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
]
const app = (m: M3, v: V3): V3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scl = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const Rx = (d: number): M3 => {
  const c = Math.cos(rad(d))
  const s = Math.sin(rad(d))
  return [1, 0, 0, 0, c, -s, 0, s, c]
}
const Ry = (d: number): M3 => {
  const c = Math.cos(rad(d))
  const s = Math.sin(rad(d))
  return [c, 0, s, 0, 1, 0, -s, 0, c]
}
const Rz = (d: number): M3 => {
  const c = Math.cos(rad(d))
  const s = Math.sin(rad(d))
  return [c, -s, 0, s, c, 0, 0, 0, 1]
}


const GEO: Record<Exclude<FingerName, 'thumb'>, { base: V3; lens: number[]; radii: number[]; spreadSign: number }> = {
  index: { base: [27, 92, 0], lens: [44, 26, 20], radii: [10, 9, 8, 7], spreadSign: 1 },
  middle: { base: [8.5, 96, 0], lens: [48, 30, 22], radii: [10.5, 9.5, 8.4, 7.2], spreadSign: 0.2 },
  ring: { base: [-10, 93, 0], lens: [45, 28, 21], radii: [10, 9, 8, 7], spreadSign: -1 },
  little: { base: [-27, 86, 0], lens: [36, 21, 18], radii: [9, 8, 7, 6], spreadSign: -1 },
}

// ---------------------------------------------------------------- drawing

function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ch = (p: number, s: number) => (p >> s) & 255
  const m = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * Math.max(0, Math.min(1, t)))
  return `rgb(${m(16)},${m(8)},${m(0)})`
}

/** The outline of a tapered capsule between two screen circles. */
function capsule(ax: number, ay: number, ra: number, bx: number, by: number, rb: number) {
  const dx = bx - ax
  const dy = by - ay
  const d = Math.hypot(dx, dy)
  if (d < Math.abs(ra - rb) + 0.5) {
    const r = Math.max(ra, rb)
    const cx = ra > rb ? ax : bx
    const cy = ra > rb ? ay : by
    return `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`
  }
  const ux = dx / d
  const uy = dy / d
  const a = Math.acos(Math.max(-1, Math.min(1, (ra - rb) / d)))
  const base = Math.atan2(uy, ux)
  const p = (cx: number, cy: number, r: number, t: number) => `${(cx + r * Math.cos(t)).toFixed(1)} ${(cy + r * Math.sin(t)).toFixed(1)}`
  const t1 = base + a
  const t2 = base - a
  return `M${p(ax, ay, ra, t1)} L${p(bx, by, rb, t1)} A${rb} ${rb} 0 0 0 ${p(bx, by, rb, t2)} L${p(ax, ay, ra, t2)} A${ra} ${ra} 0 1 0 ${p(ax, ay, ra, t1)} Z`
}


interface Hand3DProps {
  store: HandStore
  x?: number
  y?: number
  look?: HandLook
  /** Mirror for a left hand. */
  left?: boolean
  /** Draw the forearm, this long (0 = none). */
  arm?: number
  /** Show the tendons running from the forearm to each fingertip. */
  tendons?: boolean
  /** Colour of the robot's shells. */
  shell?: string
  /** Light direction in screen space (from the light). */
  light?: [number, number]
  /** Called each frame with the projected fingertip positions (stage coordinates). */
  onTips?: (tips: Record<FingerName, { x: number; y: number; z: number }>) => void
  className?: string
  /** Data name for Pip to point at. */
  tutor?: string
}

/** Turns hand-space points into stage points: view rotation, then a gentle perspective. */
export function projector(view: HandView, x0: number, y0: number) {
  const V = mul(Rz(view.roll), mul(Rx(view.pitch), Ry(view.yaw)))
  const f = 900
  return (v: V3) => {
    const r = app(V, v)
    const k = (f / (f - r[2] * view.s)) * view.s
    return { x: x0 + r[0] * k, y: y0 - r[1] * k, z: r[2], k, r }
  }
}

export function Hand3DX({ store, x = 800, y = 600, look = 'robot', left = false, arm = 150, tendons = false, shell = C.shell, light = [-0.6, -0.8], onTips, className, tutor, hide = [] }: Hand3DProps & { hide?: FingerName[] }) {
  const [, force] = useReducer((n: number) => n + 1, 0)
  useEffect(() => store.subscribe(force), [store])
  const st = store.state
  const proj = projector(st.view, x, y)
  const { segs: allSegs, palm, H, tips } = handSegments(st.pose, left)
  const segs = allSegs.filter((s) => !hide.includes(s.finger as FingerName))
  const [lx, ly] = light
  const ll = Math.hypot(lx, ly) || 1
  const L = { x: lx / ll, y: ly / ll }

  useEffect(() => {
    if (!onTips) return
    const out = {} as Record<FingerName, { x: number; y: number; z: number }>
    for (const f of FINGERS) {
      const q = proj(tips[f])
      out[f] = { x: q.x, y: q.y, z: q.z }
    }
    onTips(out)
  })

  const els: { z: number; el: React.ReactNode }[] = []
  const xr = st.xray
  const isRobot = look === 'robot'
  const isHuman = look === 'human'
  const line = look === 'xray' || look === 'bones'
  const skin = C.skinB
  const skinDark = C.skinBDark

  // ---- forearm
  if (arm > 0) {
    const a = proj(app(H, [0, 0, 0]))
    const elbow: V3 = [0, -arm, -4]
    const b = proj(elbow)
    const ra = 30 * a.k
    const rb = 34 * b.k
    const d = capsule(b.x, b.y, rb, a.x, a.y, ra)
    els.push({
      z: -999,
      el: (
        <g key="arm">
          {line ? (
            <path d={d} fill={C.ink1} fillOpacity={0.6} stroke={C.cyan} strokeWidth={1.5} strokeOpacity={0.6} />
          ) : (
            <>
              <path d={d} fill={isHuman ? skin : look === 'silhouette' ? C.ink : C.carbon} />
              {isRobot && <path d={capsule(b.x, b.y, rb * 0.92, a.x, a.y, ra * 0.92)} fill="url(#cn-shell)" opacity={0.92 * (1 - xr)} />}
              {isHuman && <path d={capsule(b.x - L.x * rb * 0.35, b.y - L.y * rb * 0.35, rb * 0.5, a.x - L.x * ra * 0.35, a.y - L.y * ra * 0.35, ra * 0.5)} fill={C.skinA} opacity={0.35} />}
            </>
          )}
          {isRobot && xr > 0.01 && (
            // actuators packed in the forearm
            <g opacity={xr}>
              {[0, 1, 2].map((i) => {
                const t = 0.18 + i * 0.26
                const p1 = proj([-14, -arm * (1 - t), 4])
                const p2 = proj([14, -arm * (1 - t) + 16, 4])
                return <rect key={i} x={Math.min(p1.x, p2.x) - 6} y={Math.min(p1.y, p2.y)} width={Math.abs(p2.x - p1.x) + 12} height={Math.abs(p2.y - p1.y) + 4} rx={4} fill={C.amberDark} stroke={C.amber} strokeWidth={1.5} />
              })}
            </g>
          )}
        </g>
      ),
    })
  }

  // ---- palm: a rounded box, faces shaded by which way they point
  const P2 = palm.map(proj)
  const faces: [number[], string][] = [
    [[4, 5, 6, 7], 'front'], // palm side (+z)
    [[0, 3, 2, 1], 'back'],
    [[0, 1, 5, 4], 'bottom'],
    [[1, 2, 6, 5], 'thumbside'],
    [[2, 3, 7, 6], 'top'],
    [[3, 0, 4, 7], 'outside'],
  ]
  const palmZ = P2.reduce((n, q) => n + q.z, 0) / 8
  const palmEls: React.ReactNode[] = []
  for (const [idx, name] of faces) {
    const pts = idx.map((i) => P2[i])
    const cross = (pts[1].x - pts[0].x) * (pts[2].y - pts[0].y) - (pts[1].y - pts[0].y) * (pts[2].x - pts[0].x)
    const visible = left ? cross > 0 : cross < 0
    if (!visible) continue
    const d = `M${pts.map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' L')} Z`
    // light from the upper left: faces whose screen normal points that way are brighter
    const cx = pts.reduce((n, q) => n + q.x, 0) / 4
    const cy = pts.reduce((n, q) => n + q.y, 0) / 4
    const pc = P2.reduce((n, q) => n + q.x, 0) / 8
    const pcy = P2.reduce((n, q) => n + q.y, 0) / 8
    const nl = Math.hypot(cx - pc, cy - pcy) || 1
    const facing = name === 'front' || name === 'back' ? 0.25 : -((cx - pc) * L.x + (cy - pcy) * L.y) / nl
    let fill: string
    if (line) fill = C.ink1
    else if (look === 'silhouette') fill = C.ink
    else if (isHuman) fill = mix(skinDark, skin, 0.55 + facing * 0.45)
    else if (name === 'front') fill = mix(C.ink1, C.rubber, 0.8 + facing * 0.2)
    else if (name === 'back') fill = shell
    else fill = mix(C.shellDark, shell, 0.5 + facing * 0.5)
    const r = isHuman ? 10 : 6
    palmEls.push(
      <path
        key={name}
        d={d}
        fill={fill}
        stroke={line ? C.cyan : fill}
        strokeWidth={line ? 1.5 : r * 2 * st.view.s}
        strokeLinejoin="round"
        strokeOpacity={line ? 0.8 : 1}
      />,
    )
    if (isRobot && name === 'front') {
      // the palm's grip pad and two screws
      palmEls.push(<path key="pad" d={d} fill="none" stroke={C.slate} strokeWidth={2} transform={`translate(${(cx * 0.1).toFixed(1)} ${(cy * 0.1).toFixed(1)}) scale(0.9)`} opacity={0.6} />)
    }
  }
  els.push({ z: palmZ, el: <g key="palm">{palmEls}</g> })

  // ---- finger segments
  segs.forEach((sg, i) => {
    const a = proj(sg.a)
    const b = proj(sg.b)
    const ra = sg.ra * a.k * (isHuman ? 1 : 0.92)
    const rb = sg.rb * b.k * (isHuman ? 1 : 0.92)
    const d = capsule(a.x, a.y, ra, b.x, b.y, rb)
    const z = (a.z + b.z) / 2
    const ax = b.x - a.x
    const ay = b.y - a.y
    const al = Math.hypot(ax, ay) || 1
    // a cylinder is brightest on the side that faces the light
    const side = { x: -ay / al, y: ax / al }
    const lit = side.x * L.x + side.y * L.y
    const off = lit > 0 ? -1 : 1
    const hx = side.x * off * Math.min(ra, rb) * 0.42
    const hy = side.y * off * Math.min(ra, rb) * 0.42
    const isTip = sg.k === 2
    const touch = st.touch[sg.finger as FingerName] ?? 0
    const parts: React.ReactNode[] = []
    if (line) {
      parts.push(<path key="o" d={d} fill={C.ink1} fillOpacity={0.55} stroke={look === 'bones' ? C.bone : C.cyan} strokeWidth={1.6} />)
      parts.push(<circle key="j" cx={a.x} cy={a.y} r={ra * 0.42} fill="none" stroke={C.cyanLight} strokeWidth={1.6} />)
      if (look === 'bones') parts.push(<line key="bone" x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.bone} strokeWidth={ra * 0.6} strokeLinecap="round" opacity={0.85} />)
    } else if (look === 'silhouette') {
      parts.push(<path key="o" d={d} fill={C.ink} />)
    } else if (isHuman) {
      parts.push(<path key="o" d={d} fill={skin} />)
      parts.push(<path key="h" d={capsule(a.x + hx, a.y + hy, ra * 0.45, b.x + hx, b.y + hy, rb * 0.45)} fill={C.skinA} opacity={0.45} />)
      parts.push(<path key="s" d={capsule(a.x - hx * 1.2, a.y - hy * 1.2, ra * 0.5, b.x - hx * 1.2, b.y - hy * 1.2, rb * 0.5)} fill={skinDark} opacity={0.45} />)
      parts.push(<path key="c" d={`M${(a.x - side.x * ra * 0.5).toFixed(1)} ${(a.y - side.y * ra * 0.5).toFixed(1)} L${(a.x + side.x * ra * 0.5).toFixed(1)} ${(a.y + side.y * ra * 0.5).toFixed(1)}`} stroke={skinDark} strokeWidth={1.4} opacity={0.6} />)
    } else {
      // robot: dark joint, white shell, rubber fingertip pad
      parts.push(<circle key="j" cx={a.x} cy={a.y} r={ra * 0.98} fill={C.carbon} />)
      parts.push(<path key="o" d={capsule(a.x + (ax / al) * ra * 0.55, a.y + (ay / al) * ra * 0.55, ra * 0.92, b.x - (ax / al) * rb * (isTip ? 0 : 0.4), b.y - (ay / al) * rb * (isTip ? 0 : 0.4), rb * 0.92)} fill={shell} opacity={1 - xr * 0.8} />)
      parts.push(<path key="h" d={capsule(a.x + hx * 1.1 + (ax / al) * ra * 0.6, a.y + hy * 1.1 + (ay / al) * ra * 0.6, ra * 0.32, b.x + hx * 1.1, b.y + hy * 1.1, rb * 0.32)} fill={C.white} opacity={0.7 * (1 - xr)} />)
      parts.push(<path key="s" d={capsule(a.x - hx * 1.3, a.y - hy * 1.3, ra * 0.45, b.x - hx * 1.3, b.y - hy * 1.3, rb * 0.45)} fill={C.shellDark} opacity={0.5 * (1 - xr)} />)
      parts.push(<circle key="ax" cx={a.x} cy={a.y} r={ra * 0.36} fill={C.metal} stroke={C.ink} strokeWidth={1} />)
      if (isTip) parts.push(<circle key="pad" cx={b.x - (ax / al) * rb * 0.2} cy={b.y - (ay / al) * rb * 0.2} r={rb * 0.75} fill={C.rubber} opacity={0.9 * (1 - xr)} />)
      if (xr > 0.01) {
        parts.push(<path key="xo" d={d} fill="none" stroke={C.cyan} strokeWidth={1.4} opacity={xr} />)
        parts.push(<line key="xb" x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.cyanLight} strokeWidth={1.2} strokeDasharray="4 4" opacity={xr * 0.8} />)
      }
    }
    if (isTip && touch > 0.01) {
      parts.push(
        <g key="t" filter="url(#cn-bloom)">
          <circle cx={b.x} cy={b.y} r={rb * (0.9 + touch * 0.5)} fill={C.magenta} opacity={0.25 + touch * 0.55} />
          <circle cx={b.x} cy={b.y} r={rb * 0.45} fill={C.magentaLight} opacity={touch} />
        </g>,
      )
    }
    els.push({ z, el: <g key={`s${i}`}>{parts}</g> })
  })

  els.sort((p, q) => p.z - q.z)

  // ---- tendons, drawn on top: from the forearm, along the palm side, to each fingertip
  const tendonEls: React.ReactNode[] = []
  if (tendons || st.xray > 0.3) {
    for (const f of FINGERS.filter((n) => !hide.includes(n))) {
      const fs = segs.filter((s) => s.finger === f)
      const pull = st.pull[f]
      const pts = [proj(app(H, [f === 'thumb' ? 16 : (GEO[f as 'index'].base[0] * 0.5), -arm * 0.7, 6])), proj(app(H, [f === 'thumb' ? 18 : GEO[f as 'index'].base[0] * 0.7, 8, 10]))]
      fs.forEach((s) => pts.push(proj(s.a), proj(add(s.a, scl(add(s.b, scl(s.a, -1)), 0.5)))))
      pts.push(proj(fs[fs.length - 1].b))
      const d = `M${pts.map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' L')}`
      tendonEls.push(
        <path key={f} d={d} fill="none" stroke={pull > 0.05 ? C.cyanLight : C.cyan} strokeWidth={1.6 + pull * 2.4} strokeOpacity={0.55 + pull * 0.45} strokeLinejoin="round" filter={pull > 0.05 ? 'url(#cn-bloom)' : undefined} />,
      )
    }
  }

  return (
    <g className={className} data-tutor={tutor}>
      {els.map((e) => e.el)}
      {tendonEls}
    </g>
  )
}

