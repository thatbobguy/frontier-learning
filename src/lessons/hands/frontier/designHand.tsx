/*
 * The design lab's live hand. It is the course's Hand3D model (same skeleton from
 * `handSegments`, same camera, same capsule shading), redrawn so it can show a DESIGN:
 * three, four or five fingers, motors where you put them, the transmission you chose,
 * the skin you chose and the material it is built from, in a robot look or an x-ray.
 *
 * (Hand3D always draws five fingers and one kind of insides, so the lab needs its own
 * painter; everything else, poses and the store that animates them, is shared.)
 */
import { useEffect, useReducer } from 'react'
import { FINGERS, handSegments, type FingerName, type HandPose, type HandStore } from '../../../cine/hand3d'
import { C } from '../../../cine/palette'
import type { Design } from './design'

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
const Rx = (d: number): M3 => [1, 0, 0, 0, Math.cos(rad(d)), -Math.sin(rad(d)), 0, Math.sin(rad(d)), Math.cos(rad(d))]
const Ry = (d: number): M3 => [Math.cos(rad(d)), 0, Math.sin(rad(d)), 0, 1, 0, -Math.sin(rad(d)), 0, Math.cos(rad(d))]
const Rz = (d: number): M3 => [Math.cos(rad(d)), -Math.sin(rad(d)), 0, Math.sin(rad(d)), Math.cos(rad(d)), 0, 0, 0, 1]

/** The same gentle perspective camera as Hand3D. */
export function projector(view: { yaw: number; pitch: number; roll: number; s: number }, x0: number, y0: number) {
  const V = mul(Rz(view.roll), mul(Rx(view.pitch), Ry(view.yaw)))
  const f = 900
  return (v: V3) => {
    const r = app(V, v)
    const k = (f / (f - r[2] * view.s)) * view.s
    return { x: x0 + r[0] * k, y: y0 - r[1] * k, z: r[2], k }
  }
}

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
  const a = Math.acos(Math.max(-1, Math.min(1, (ra - rb) / d)))
  const base = Math.atan2(dy / d, dx / d)
  const p = (cx: number, cy: number, r: number, t: number) => `${(cx + r * Math.cos(t)).toFixed(1)} ${(cy + r * Math.sin(t)).toFixed(1)}`
  const t1 = base + a
  const t2 = base - a
  return `M${p(ax, ay, ra, t1)} L${p(bx, by, rb, t1)} A${rb} ${rb} 0 0 0 ${p(bx, by, rb, t2)} L${p(ax, ay, ra, t2)} A${ra} ${ra} 0 1 0 ${p(ax, ay, ra, t1)} Z`
}

export const fingersOf = (n: number): FingerName[] => FINGERS.slice(0, n)

/** The shell colours of each way of building it. */
const BUILD_LOOK = {
  print: { fill: '#d8cfba', side: '#9e937c', hi: '#f1ead8', joint: '#3a3a40' },
  cnc: { fill: '#aeb8c8', side: '#5d687b', hi: '#eef3f9', joint: '#2a303c' },
  mould: { fill: C.shell, side: C.shellDark, hi: C.white, joint: C.carbon },
} as const

/**
 * A hand built to a design. `xray` 0..1 fades the shells to line work and shows the motors
 * (amber), the transmission (cyan) and the skin's sensors (magenta).
 */
export function DesignHand({ store, design, x, y, xray: xrayProp, arm = 300, light = [-0.6, -0.8] as [number, number], grip: gripProp }: {
  store: HandStore
  design: Design
  x: number
  y: number
  xray?: number
  arm?: number
  light?: [number, number]
  /** 0..1: fingertips pressing on something (lights the skin). Defaults to the store's index-finger touch. */
  grip?: number
}) {
  const [, force] = useReducer((n: number) => n + 1, 0)
  useEffect(() => store.subscribe(force), [store])
  const st = store.state
  const xray = xrayProp ?? st.xray
  const grip = gripProp ?? st.touch.index
  const proj = projector(st.view, x, y)
  const { segs, H } = handSegments(st.pose as HandPose)
  const present = new Set(fingersOf(design.fingers))
  const look = BUILD_LOOK[design.build]
  const L = (() => {
    const l = Math.hypot(light[0], light[1]) || 1
    return { x: light[0] / l, y: light[1] / l }
  })()
  const active = Math.min(design.motors, 4 * design.fingers)
  const shellOp = 1 - xray * 0.85
  const fatJoint = design.place === 'joints' ? 1.22 : 1
  const fatArm = design.place === 'forearm' ? 1.25 : 1
  const palmDepth = design.place === 'palm' ? 36 : 26
  const els: { z: number; el: React.ReactNode }[] = []
  const over: React.ReactNode[] = []

  // ---- forearm
  const wrist = proj(app(H, [0, 0, 0]))
  const elbow = proj([0, -arm, -4])
  {
    const ra = 30 * wrist.k * fatArm
    const rb = 36 * elbow.k * fatArm
    const d = capsule(elbow.x, elbow.y, rb, wrist.x, wrist.y, ra)
    els.push({
      z: -999,
      el: (
        <g key="arm">
          <path d={d} fill={C.carbon} />
          <path d={capsule(elbow.x, elbow.y, rb * 0.9, wrist.x, wrist.y, ra * 0.9)} fill={look.fill} opacity={0.95 * shellOp} />
          <path d={capsule(elbow.x - L.x * rb * 0.4, elbow.y - L.y * rb * 0.4, rb * 0.35, wrist.x - L.x * ra * 0.4, wrist.y - L.y * ra * 0.4, ra * 0.35)} fill={look.hi} opacity={0.5 * shellOp} />
          {xray > 0.01 && <path d={d} fill={C.ink1} fillOpacity={0.5 * xray} stroke={C.cyan} strokeWidth={1.5} strokeOpacity={xray} />}
        </g>
      ),
    })
  }

  // ---- palm, narrower when fingers are left off
  const w = 72
  const left = design.fingers === 5 ? -w / 2 : design.fingers === 4 ? -24 : -6
  const corners: V3[] = []
  for (const z of [-palmDepth / 2, palmDepth / 2])
    for (const [px, py] of [
      [left + 2, 6],
      [w / 2 - 2, 6],
      [w / 2 + 2, 88],
      [left, 80],
    ])
      corners.push(app(H, [px, py, z]))
  const P2 = corners.map(proj)
  const faces: [number[], string][] = [
    [[4, 5, 6, 7], 'front'],
    [[0, 3, 2, 1], 'back'],
    [[0, 1, 5, 4], 'bottom'],
    [[1, 2, 6, 5], 'thumbside'],
    [[2, 3, 7, 6], 'top'],
    [[3, 0, 4, 7], 'outside'],
  ]
  const palmZ = P2.reduce((n, q) => n + q.z, 0) / 8
  const pcx = P2.reduce((n, q) => n + q.x, 0) / 8
  const pcy = P2.reduce((n, q) => n + q.y, 0) / 8
  const palmEls: React.ReactNode[] = []
  for (const [idx, name] of faces) {
    const pts = idx.map((i) => P2[i])
    const cross = (pts[1].x - pts[0].x) * (pts[2].y - pts[0].y) - (pts[1].y - pts[0].y) * (pts[2].x - pts[0].x)
    if (cross >= 0) continue
    const d = `M${pts.map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' L')} Z`
    const cx = pts.reduce((n, q) => n + q.x, 0) / 4
    const cy = pts.reduce((n, q) => n + q.y, 0) / 4
    const nl = Math.hypot(cx - pcx, cy - pcy) || 1
    const facing = name === 'front' || name === 'back' ? 0.3 : -((cx - pcx) * L.x + (cy - pcy) * L.y) / nl
    const fill = name === 'front' ? C.rubber : facing > 0.2 ? look.fill : look.side
    palmEls.push(
      <g key={name}>
        <path d={d} fill={fill} stroke={fill} strokeWidth={12 * st.view.s} strokeLinejoin="round" opacity={name === 'front' ? 1 - xray * 0.6 : shellOp} />
        {xray > 0.01 && <path d={d} fill="none" stroke={C.cyan} strokeWidth={1.5} strokeOpacity={xray * 0.9} strokeLinejoin="round" />}
        {design.build === 'print' && name !== 'front' && <path d={d} fill="url(#fr-layers)" opacity={0.5 * shellOp} />}
      </g>,
    )
  }
  els.push({ z: palmZ, el: <g key="palm">{palmEls}</g> })

  // ---- fingers
  const fingerSegs = segs.filter((s) => s.finger !== 'arm' && present.has(s.finger as FingerName))
  fingerSegs.forEach((sg, i) => {
    const a = proj(sg.a)
    const b = proj(sg.b)
    const ra = sg.ra * a.k * 0.92
    const rb = sg.rb * b.k * 0.92
    const ax = b.x - a.x
    const ay = b.y - a.y
    const al = Math.hypot(ax, ay) || 1
    const side = { x: -ay / al, y: ax / al }
    const off = side.x * L.x + side.y * L.y > 0 ? -1 : 1
    const hx = side.x * off * Math.min(ra, rb) * 0.42
    const hy = side.y * off * Math.min(ra, rb) * 0.42
    const isTip = sg.k === 2
    const parts: React.ReactNode[] = []
    parts.push(<circle key="j" cx={a.x} cy={a.y} r={ra * fatJoint} fill={look.joint} />)
    const sa = { x: a.x + (ax / al) * ra * 0.55, y: a.y + (ay / al) * ra * 0.55 }
    const sb = { x: b.x - (ax / al) * rb * (isTip ? 0 : 0.4), y: b.y - (ay / al) * rb * (isTip ? 0 : 0.4) }
    parts.push(<path key="o" d={capsule(sa.x, sa.y, ra * 0.92, sb.x, sb.y, rb * 0.92)} fill={look.fill} opacity={shellOp} />)
    parts.push(<path key="h" d={capsule(sa.x + hx * 1.1, sa.y + hy * 1.1, ra * 0.3, sb.x + hx * 1.1, sb.y + hy * 1.1, rb * 0.3)} fill={look.hi} opacity={(design.build === 'print' ? 0.35 : 0.75) * shellOp} />)
    parts.push(<path key="s" d={capsule(sa.x - hx * 1.3, sa.y - hy * 1.3, ra * 0.45, sb.x - hx * 1.3, sb.y - hy * 1.3, rb * 0.45)} fill={look.side} opacity={0.55 * shellOp} />)
    if (design.build === 'print') parts.push(<path key="l" d={capsule(sa.x, sa.y, ra * 0.92, sb.x, sb.y, rb * 0.92)} fill="url(#fr-layers)" opacity={0.6 * shellOp} />)
    parts.push(<circle key="ax" cx={a.x} cy={a.y} r={ra * (design.place === 'joints' ? 0.55 : 0.34)} fill={design.build === 'cnc' ? C.metalDark : C.metal} stroke={C.ink} strokeWidth={1} />)
    // the skin
    if (isTip && design.skin === 'pads') parts.push(<circle key="pad" cx={b.x - (ax / al) * rb * 0.2} cy={b.y - (ay / al) * rb * 0.2} r={rb * 0.78} fill={C.magentaDark} opacity={0.85} />)
    if (isTip && design.skin === 'gel') {
      parts.push(<circle key="gel" cx={b.x} cy={b.y} r={rb * 1.15} fill="#cfe7ff" opacity={0.55} stroke={C.magenta} strokeWidth={1.4} />)
      parts.push(<circle key="cam" cx={b.x - (ax / al) * rb * 0.5} cy={b.y - (ay / al) * rb * 0.5} r={rb * 0.28} fill={C.ink} />)
    }
    if (design.skin === 'arrays' && sg.k >= 1) {
      for (let t = 0.25; t < 1; t += 0.25) {
        for (const s of [-0.45, 0, 0.45]) {
          const r = ra + (rb - ra) * t
          parts.push(<circle key={`ar${t}${s}`} cx={a.x + ax * t + side.x * r * s} cy={a.y + ay * t + side.y * r * s} r={Math.max(1.2, r * 0.13)} fill={C.magenta} opacity={0.75} />)
        }
      }
    }
    if (isTip && grip > 0.01 && design.skin !== 'none') {
      parts.push(<circle key="t" cx={b.x} cy={b.y} r={rb * (1 + grip * 0.6)} fill={C.magenta} opacity={0.2 + grip * 0.5} filter="url(#cn-bloom)" />)
    }
    if (xray > 0.01) {
      parts.push(<path key="xo" d={capsule(a.x, a.y, ra, b.x, b.y, rb)} fill="none" stroke={C.cyan} strokeWidth={1.4} opacity={xray} />)
      parts.push(<line key="xb" x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.bone} strokeWidth={Math.max(1.5, ra * 0.35)} strokeLinecap="round" opacity={xray * 0.45} />)
    }
    els.push({ z: (a.z + b.z) / 2, el: <g key={`s${i}`}>{parts}</g> })
  })
  els.sort((p, q) => p.z - q.z)

  // ---- insides (drawn over everything, fading in with the x-ray)
  const tipOf = (f: FingerName) => fingerSegs.filter((s) => s.finger === f)
  const motorPts: { x: number; y: number; r: number }[] = []
  if (design.place === 'joints') {
    const joints: V3[] = []
    for (let k = 0; k < 3; k++) for (const f of FINGERS) if (present.has(f)) joints.push(tipOf(f)[k].a)
    for (const f of FINGERS) if (present.has(f)) joints.push([tipOf(f)[0].a[0] - 6, tipOf(f)[0].a[1] - 10, tipOf(f)[0].a[2] + 4])
    joints.slice(0, active).forEach((v) => {
      const q = proj(v)
      motorPts.push({ x: q.x, y: q.y, r: 7 * q.k })
    })
  } else if (design.place === 'palm') {
    const cols = Math.min(4, active)
    const rows = Math.ceil(active / cols)
    for (let i = 0; i < active; i++) {
      const cx = left + 12 + ((i % cols) + 0.5) * ((w / 2 - 10 - (left + 12)) / cols)
      const cy = 18 + (Math.floor(i / cols) + 0.5) * (62 / Math.max(rows, 1))
      const q = proj(app(H, [cx, cy, 0]))
      motorPts.push({ x: q.x, y: q.y, r: Math.min(9, 40 / Math.max(rows, cols)) * q.k })
    }
  } else {
    const cols = Math.min(3, active)
    const rows = Math.ceil(active / cols)
    for (let i = 0; i < active; i++) {
      const cx = -18 + ((i % cols) + 0.5) * (36 / cols)
      const cy = -arm * 0.88 + (Math.floor(i / cols) + 0.5) * ((arm * 0.62) / rows)
      const q = proj([cx, cy, 2])
      motorPts.push({ x: q.x, y: q.y, r: Math.min(10, 90 / rows) * q.k })
    }
  }
  if (xray > 0.01) {
    const ins: React.ReactNode[] = []
    // transmission first, so the motors sit on top of their cables and rods
    const fingersList = FINGERS.filter((f) => present.has(f))
    fingersList.forEach((f, fi) => {
      const fs = tipOf(f)
      if (fs.length < 3) return
      if (design.drive === 'tendon') {
        const m = motorPts[fi % Math.max(1, motorPts.length)]
        const pts = [m, proj(app(H, [0, 4, 6])), proj(app(H, [fs[0].a[0] * 0.7, 40, 8]))]
        fs.forEach((s) => pts.push(proj(s.a), proj([(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2, (s.a[2] + s.b[2]) / 2])))
        pts.push(proj(fs[2].b))
        ins.push(<path key={`t${f}`} d={`M${pts.map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' L')}`} fill="none" stroke={C.cyanLight} strokeWidth={2} strokeLinejoin="round" filter="url(#cn-bloom)" />)
      } else if (design.drive === 'linkage') {
        const base = proj(app(H, [fs[0].a[0] * 0.8, 50, -8]))
        const mid = proj([(fs[0].a[0] + fs[0].b[0]) / 2, (fs[0].a[1] + fs[0].b[1]) / 2, (fs[0].a[2] + fs[0].b[2]) / 2 - 8])
        const pip = proj([fs[1].a[0], fs[1].a[1], fs[1].a[2] - 8])
        const dip = proj([fs[2].a[0], fs[2].a[1], fs[2].a[2] - 7])
        ins.push(
          <g key={`l${f}`} stroke={C.cyan} strokeLinecap="round" fill="none">
            <path d={`M${base.x} ${base.y} L${mid.x} ${mid.y}`} strokeWidth={4} />
            <path d={`M${mid.x} ${mid.y} L${pip.x} ${pip.y} L${dip.x} ${dip.y}`} strokeWidth={2.6} />
            <circle cx={mid.x} cy={mid.y} r={3} fill={C.cyanLight} />
            <circle cx={pip.x} cy={pip.y} r={3} fill={C.cyanLight} />
          </g>,
        )
      } else {
        fs.forEach((s, k) => {
          const q = proj(s.a)
          const r = s.ra * q.k * 0.75
          ins.push(<circle key={`g${f}${k}`} cx={q.x} cy={q.y} r={r} fill="none" stroke={C.cyan} strokeWidth={r * 0.35} strokeDasharray={`${(r * 0.45).toFixed(1)} ${(r * 0.45).toFixed(1)}`} />)
        })
      }
    })
    motorPts.forEach((m, i) => {
      ins.push(
        <g key={`m${i}`}>
          <rect x={m.x - m.r} y={m.y - m.r * 1.25} width={m.r * 2} height={m.r * 2.5} rx={m.r * 0.5} fill={C.amberDark} stroke={C.amber} strokeWidth={1.4} />
          <rect x={m.x - m.r * 0.6} y={m.y - m.r * 1.25} width={m.r * 1.2} height={m.r * 0.5} fill={C.amberLight} opacity={0.8} />
        </g>,
      )
      if (design.drive === 'linkage' && design.place !== 'joints') ins.push(<path key={`sc${i}`} d={`M${m.x} ${m.y - m.r * 1.3} l3 -3 l-6 -3 l6 -3 l-6 -3 l3 -3`} stroke={C.cyanLight} strokeWidth={1.4} fill="none" />)
    })
    over.push(
      <g key="ins" opacity={xray}>
        <g filter="url(#cn-bloom)" opacity={0.45}>
          {motorPts.map((m, i) => (
            <circle key={i} cx={m.x} cy={m.y} r={m.r * 1.8} fill={C.amber} />
          ))}
        </g>
        {ins}
      </g>,
    )
  }

  return (
    <g>
      <defs>
        <pattern id="fr-layers" width={6} height={3} patternUnits="userSpaceOnUse">
          <path d="M0 0.5 H6" stroke="#6e6553" strokeWidth={0.8} />
        </pattern>
      </defs>
      {els.map((e) => e.el)}
      {over}
    </g>
  )
}
