/* Geometry for the film's planar fingers: forward kinematics and the adaptive-finger solver. */

export type Pt = { x: number; y: number }
const rad = (d: number) => (d * Math.PI) / 180

/**
 * Joint and tip positions of a planar chain: base (x, y), base direction a0 (degrees, 0 points
 * right), link lengths, joint bends in degrees. Positive bends curl clockwise on screen
 * (downward when the finger points right); dir = -1 curls the other way.
 */
export function chain(x: number, y: number, a0: number, lens: number[], q: number[], dir = 1): Pt[] {
  const pts: Pt[] = [{ x, y }]
  let a = a0
  for (let i = 0; i < lens.length; i++) {
    a += dir * (q[i] ?? 0)
    const p = pts[i]
    pts.push({ x: p.x + Math.cos(rad(a)) * lens[i], y: p.y + Math.sin(rad(a)) * lens[i] })
  }
  return pts
}


/* ------------------------------------------------------------------ */
/* The adaptive finger: one tendon, springs, links that stop on contact */
/* ------------------------------------------------------------------ */

export type Obstacle = { kind: 'circle'; x: number; y: number; r: number; id: string } | { kind: 'poly'; pts: Pt[]; id: string } | { kind: 'floor'; y: number; id: string }

function segDist(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l2 = dx * dx + dy * dy || 1
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2))
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t))
}
function segSeg(a: Pt, b: Pt, c: Pt, d: Pt) {
  const cross = (o: Pt, p: Pt, q: Pt) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x)
  const d1 = cross(a, b, c)
  const d2 = cross(a, b, d)
  const d3 = cross(c, d, a)
  const d4 = cross(c, d, b)
  if (d1 * d2 < 0 && d3 * d4 < 0) return 0
  return Math.min(segDist(c, a, b), segDist(d, a, b), segDist(a, c, d), segDist(b, c, d))
}
function inside(p: Pt, poly: Pt[]) {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c
  }
  return c
}
/** How far the link a-b (a bar of half-width w) is from touching the obstacle; negative when it overlaps. */
export function gap(a: Pt, b: Pt, w: number, o: Obstacle) {
  if (o.kind === 'circle') return segDist({ x: o.x, y: o.y }, a, b) - o.r - w
  if (o.kind === 'floor') return o.y - Math.max(a.y, b.y) - w
  if (inside(a, o.pts) || inside(b, o.pts)) return -w
  let m = Infinity
  for (let i = 0; i < o.pts.length; i++) m = Math.min(m, segSeg(a, b, o.pts[i], o.pts[(i + 1) % o.pts.length]))
  return m - w
}

export interface AdaptiveFinger {
  x: number
  y: number
  a0: number
  lens: number[]
  qmax: number[]
  w: number
  dir?: number
  /** How readily each joint gives (spring softness): proximal joints usually close first. */
  give?: number[]
}

/**
 * Where an adaptive finger ends up for a given tendon pull. The tendon's excursion is shared
 * equally among the joints that are still free (equal springs); when a link touches
 * something it stops, and so does every joint before it, and the rest keep wrapping.
 */
export function solveAdaptive(f: AdaptiveFinger, pull: number, obstacles: Obstacle[]) {
  const n = f.lens.length
  const q = Array(n).fill(0) as number[]
  const contact: (string | null)[] = Array(n).fill(null)
  let remaining = Math.max(0, pull) * f.qmax.reduce((s, v) => s + v, 0)
  let first = 0
  const hit = (qq: number[]) => {
    const pts = chain(f.x, f.y, f.a0, f.lens, qq, f.dir ?? 1)
    for (let k = n - 1; k >= first; k--) {
      for (const o of obstacles) if (gap(pts[k], pts[k + 1], f.w * (1 - k * 0.1), o) < 0) return { k, id: o.id }
    }
    return null
  }
  let guard = 0
  while (remaining > 0.01 && first < n && guard++ < 600) {
    const free = []
    for (let i = first; i < n; i++) if (q[i] < f.qmax[i] - 0.01) free.push(i)
    if (!free.length) break
    const d = Math.min(1.5, remaining)
    const trial = [...q]
    const give = f.give ?? f.lens.map(() => 1)
    const tot = free.reduce((s, i) => s + give[i], 0) || 1
    for (const i of free) trial[i] = Math.min(f.qmax[i], q[i] + (d * give[i]) / tot)
    const h = hit(trial)
    if (h) {
      // this link is touching: it and every joint before it stop; the rest wrap on
      contact[h.k] = h.id
      first = h.k + 1
      continue
    }
    for (let i = 0; i < n; i++) q[i] = trial[i]
    remaining -= d
  }
  return { q, contact, pts: chain(f.x, f.y, f.a0, f.lens, q, f.dir ?? 1) }
}

