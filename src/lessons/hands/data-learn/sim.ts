/*
 * The small, real simulations behind this film's plays. Nothing here is faked for the
 * picture: the drift play runs a nearest-neighbour behaviour-cloning policy on recorded
 * demonstrations; the vase play really averages (or samples) the learner's own paths; the
 * rooms play evaluates a fitted scaling model in 20 sampled kitchens.
 *
 * Pure functions and plain classes, no React, so the numbers can be checked in node.
 */

export interface Pt {
  x: number
  y: number
}

/** A small seeded random generator (LCG), plus a normal sample. */
export function rand(seed: number) {
  let s = seed >>> 0 || 1
  const u = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
  const n = () => {
    const a = Math.max(1e-9, u())
    const b = u()
    return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b)
  }
  return { u, n }
}

/* ------------------------------------------------------------------ */
/* Paths                                                               */
/* ------------------------------------------------------------------ */

/** A Catmull-Rom spline through the points, sampled densely. */
export function spline(pts: Pt[], per = 40): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    for (let k = 0; k < per; k++) {
      const t = k / per
      const t2 = t * t
      const t3 = t2 * t
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) })
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

/** Points resampled at equal arc length (n points). */
export function resample(pts: Pt[], n: number): Pt[] {
  if (pts.length < 2) return Array.from({ length: n }, () => ({ ...pts[0] }))
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  const L = cum[cum.length - 1] || 1
  const out: Pt[] = []
  let j = 1
  for (let k = 0; k < n; k++) {
    const d = (k / (n - 1)) * L
    while (j < pts.length - 1 && cum[j] < d) j++
    const seg = cum[j] - cum[j - 1] || 1
    const t = Math.max(0, Math.min(1, (d - cum[j - 1]) / seg))
    out.push({ x: pts[j - 1].x + (pts[j].x - pts[j - 1].x) * t, y: pts[j - 1].y + (pts[j].y - pts[j - 1].y) * t })
  }
  return out
}

export const pathD = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

/** A centre line with arc length, for nearest-point queries. */
export class Track {
  pts: Pt[]
  cum: number[]
  length: number
  constructor(control: Pt[]) {
    this.pts = resample(spline(control, 60), 480)
    this.cum = [0]
    for (let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(this.pts[i].x - this.pts[i - 1].x, this.pts[i].y - this.pts[i - 1].y))
    this.length = this.cum[this.cum.length - 1]
  }
  /** Nearest point: arc length s, unsigned distance, signed lateral offset (left of travel is negative). */
  nearest(p: Pt) {
    let best = 0
    let bd = Infinity
    for (let i = 0; i < this.pts.length; i++) {
      const d = (this.pts[i].x - p.x) ** 2 + (this.pts[i].y - p.y) ** 2
      if (d < bd) {
        bd = d
        best = i
      }
    }
    const a = this.pts[Math.max(0, best - 1)]
    const b = this.pts[Math.min(this.pts.length - 1, best + 1)]
    const tx = b.x - a.x
    const ty = b.y - a.y
    const tl = Math.hypot(tx, ty) || 1
    const lat = ((p.x - this.pts[best].x) * -ty + (p.y - this.pts[best].y) * tx) / tl
    return { i: best, s: this.cum[best], dist: Math.sqrt(bd), lat, tan: { x: tx / tl, y: ty / tl } }
  }
  at(s: number): Pt {
    const c = Math.max(0, Math.min(this.length, s))
    let i = 1
    while (i < this.cum.length - 1 && this.cum[i] < c) i++
    const t = (c - this.cum[i - 1]) / (this.cum[i] - this.cum[i - 1] || 1)
    return { x: this.pts[i - 1].x + (this.pts[i].x - this.pts[i - 1].x) * t, y: this.pts[i - 1].y + (this.pts[i].y - this.pts[i - 1].y) * t }
  }
  /** A point offset sideways from the centre line at arc length s (lateral sign as in `nearest`). */
  offset(s: number, lat: number): Pt {
    const p = this.at(s)
    const q = this.at(s + 2)
    const o = this.at(s - 2)
    const tx = q.x - o.x
    const ty = q.y - o.y
    const tl = Math.hypot(tx, ty) || 1
    return { x: p.x + (-ty / tl) * lat, y: p.y + (tx / tl) * lat }
  }
}

/* ------------------------------------------------------------------ */
/* Chapter 1: behaviour cloning, drift, and three fixes                */
/* ------------------------------------------------------------------ */

/** The tabletop course: from the dock on the left, between obstacles, to the shelf. */
export const DRIFT_TRACK = new Track([
  { x: 190, y: 650 },
  { x: 370, y: 590 },
  { x: 520, y: 430 },
  { x: 720, y: 375 },
  { x: 875, y: 500 },
  { x: 1035, y: 612 },
  { x: 1225, y: 565 },
  { x: 1395, y: 470 },
])
/** Half the width of the free lane between the obstacles. */
export const LANE = 44
/** How far the gripper moves per control step (stage px). */
export const SPEED = 4.5
/** Steps per action chunk when chunking is on. */
export const CHUNK = 10

export interface Sample {
  p: Pt
  /** The next CHUNK actions from this state (the first one is the single-step action). */
  seq: Pt[]
  kind: 'demo' | 'recovery' | 'dagger'
}

/** The expert (Kofi): head for a point a little further along the centre line. */
export function expertAction(track: Track, p: Pt): Pt {
  const n = track.nearest(p)
  const look = track.at(n.s + 34)
  const dx = look.x - p.x
  const dy = look.y - p.y
  const l = Math.hypot(dx, dy) || 1
  return { x: (dx / l) * SPEED, y: (dy / l) * SPEED }
}

/** Roll the expert forward from p for n steps; returns the states visited and actions taken. */
export function expertRollout(track: Track, p0: Pt, n: number, jitter = 0, seed = 1) {
  const r = rand(seed)
  const states: Pt[] = []
  const actions: Pt[] = []
  let p = { ...p0 }
  for (let i = 0; i < n; i++) {
    const a = expertAction(track, p)
    const ax = a.x + r.n() * jitter
    const ay = a.y + r.n() * jitter
    states.push(p)
    actions.push({ x: ax, y: ay })
    p = { x: p.x + ax, y: p.y + ay }
    if (track.nearest(p).s > track.length - 4) break
  }
  states.push(p)
  return { states, actions }
}

function toSamples(states: Pt[], actions: Pt[], kind: Sample['kind'], every = 1): Sample[] {
  const out: Sample[] = []
  for (let i = 0; i < actions.length; i += every) {
    const seq: Pt[] = []
    for (let k = 0; k < CHUNK; k++) seq.push(actions[Math.min(actions.length - 1, i + k)])
    out.push({ p: states[i], seq, kind })
  }
  return out
}

/** Five smooth expert demonstrations from the dock (tiny start jitter only). */
export function expertDemos(track = DRIFT_TRACK) {
  const demos = []
  for (let d = 0; d < 5; d++) {
    const r = rand(100 + d)
    const start = track.offset(0, (r.u() - 0.5) * 6)
    demos.push(expertRollout(track, start, 600, 0.12, 200 + d))
  }
  return demos
}

/** Recovery demonstrations: the expert starts off the path (as if it had drifted) and steers back. */
export function recoveryDemos(track = DRIFT_TRACK) {
  const demos = []
  const n = 64
  for (let d = 0; d < n; d++) {
    const r = rand(300 + d)
    const s = track.length * (0.05 + (0.88 * d) / (n - 1))
    const side = d % 2 ? 1 : -1
    const start = track.offset(s, side * (10 + r.u() * 30))
    demos.push(expertRollout(track, start, 32, 0.12, 400 + d))
  }
  return demos
}

export interface DriftOptions {
  recovery: boolean
  dagger: boolean
  chunk: boolean
}

/** A trained policy: k-nearest-neighbour regression on (state, action-sequence) samples. */
export class Policy {
  data: Sample[] = []
  add(states: Pt[], actions: Pt[], kind: Sample['kind'], every = 1) {
    this.data.push(...toSamples(states, actions, kind, every))
  }
  /** The k nearest samples and the distance to the closest (how unfamiliar this state is). */
  query(p: Pt, k = 4) {
    const best: { d: number; s: Sample }[] = []
    for (const s of this.data) {
      const d = Math.hypot(s.p.x - p.x, s.p.y - p.y)
      if (best.length < k || d < best[best.length - 1].d) {
        best.push({ d, s })
        best.sort((a, b) => a.d - b.d)
        if (best.length > k) best.pop()
      }
    }
    const seq: Pt[] = []
    for (let t = 0; t < CHUNK; t++) {
      let x = 0
      let y = 0
      let w = 0
      for (const b of best) {
        const wt = 1 / (b.d + 2)
        x += b.s.seq[t].x * wt
        y += b.s.seq[t].y * wt
        w += wt
      }
      const l = Math.hypot(x, y) || 1
      seq.push({ x: (x / l) * SPEED, y: (y / l) * SPEED })
      void w
    }
    return { seq, unfamiliar: best.length ? best[0].d : 99 }
  }
}

/** Model error per decision: small on familiar states, growing with distance from the data. */
const EPS = 0.34
const UNFAMILIAR = 4
const RHO = 0.9
const POW = 2

export type RunStatus = 'running' | 'success' | 'crash' | 'needs-help'

/**
 * One run of the trained policy. Call step() repeatedly. Each policy decision adds a small
 * random slip (the copy is never perfect), larger in states far from any training sample.
 */
export class Runner {
  track: Track
  policy: Policy
  opts: DriftOptions
  p: Pt
  t = 0
  /** Lateral offset from the expert line at each step (for the error plot). */
  errs: number[] = []
  trail: Pt[] = []
  status: RunStatus = 'running'
  assisted = false
  private queue: Pt[] = []
  private r: ReturnType<typeof rand>
  private visited: Pt[] = []
  private helping = 0
  decisions = 0
  private slip = 0
  constructor(track: Track, policy: Policy, opts: DriftOptions, seed: number) {
    this.track = track
    this.policy = policy
    this.opts = opts
    this.r = rand(seed)
    this.p = { ...track.at(0) }
    this.trail.push({ ...this.p })
  }
  step(): RunStatus {
    if (this.status !== 'running') return this.status
    let a: Pt
    if (this.helping > 0) {
      // the expert has the controls
      a = expertAction(this.track, this.p)
      this.helping--
    } else {
      if (!this.queue.length) {
        const q = this.policy.query(this.p)
        const sd = EPS * (1 + Math.pow(q.unfamiliar / UNFAMILIAR, POW))
        this.decisions++
        // the slip: the copy lands a little to one side, more so in unfamiliar states
        this.slip = RHO * this.slip + Math.sqrt(1 - RHO * RHO) * this.r.n() * sd
        const slip = this.slip
        const n = this.track.nearest(this.p)
        const nx = -n.tan.y
        const ny = n.tan.x
        const seq = this.opts.chunk ? q.seq : q.seq.slice(0, 1)
        this.queue = seq.map((s, i) => (i === 0 ? { x: s.x + nx * slip * 1.0, y: s.y + ny * slip * 1.0 } : { ...s }))
      }
      a = this.queue.shift() as Pt
    }
    this.visited.push({ ...this.p })
    this.p = { x: this.p.x + a.x, y: this.p.y + a.y }
    this.t++
    this.trail.push({ ...this.p })
    const n = this.track.nearest(this.p)
    this.errs.push(Math.abs(n.lat))
    if (n.dist > LANE) this.status = 'crash'
    else if (n.s > this.track.length - 6) this.status = 'success'
    else if (this.t > 900) this.status = 'crash'
    else if (this.opts.dagger && this.helping === 0 && n.dist > LANE * 0.55) this.status = 'needs-help'
    return this.status
  }
  /**
   * DAgger: the expert labels the states this run actually visited (what *should* it have
   * done there?), those labels join the data, and the expert steers it back.
   */
  stepIn() {
    if (this.status !== 'needs-help') return 0
    const added: Pt[] = []
    const from = 0
    for (let i = from; i < this.visited.length; i += 2) {
      const ro = expertRollout(this.track, this.visited[i], CHUNK + 1, 0, 7 + i)
      this.policy.add([ro.states[0]], [ro.actions[0]], 'dagger')
      // keep the whole label sequence for chunked policies
      this.policy.data[this.policy.data.length - 1].seq = Array.from({ length: CHUNK }, (_, k) => ro.actions[Math.min(ro.actions.length - 1, k)])
      added.push(this.visited[i])
    }
    // and the way back, from where it is now
    const back = expertRollout(this.track, this.p, 26, 0, 99)
    this.policy.add(back.states, back.actions, 'dagger', 2)
    added.push(...back.states.filter((_, i) => i % 2 === 0))
    this.assisted = true
    this.helping = 26
    this.queue = []
    this.status = 'running'
    return added
  }
}

/** Build a policy from the current data choices. */
export function trainPolicy(opts: DriftOptions, extra: Sample[] = []) {
  const pol = new Policy()
  for (const d of expertDemos()) pol.add(d.states, d.actions, 'demo')
  if (opts.recovery) for (const d of recoveryDemos()) pol.add(d.states, d.actions, 'recovery')
  pol.data.push(...extra)
  return pol
}

/** Run a whole episode without interaction (for testing and for the scripted cue). */
export function runEpisode(opts: DriftOptions, seed: number, pol = trainPolicy(opts)) {
  const r = new Runner(DRIFT_TRACK, pol, { ...opts, dagger: false }, seed)
  while (r.step() === 'running') {
    /* keep going */
  }
  return r
}

/* ------------------------------------------------------------------ */
/* Chapter 2: averaging versus sampling around a vase                  */
/* ------------------------------------------------------------------ */

export interface P3 extends Pt {
  z: number
}

/** The top-down table: the gripper starts near you, the cup is beyond the vase. */
export const VASE = { x: 800, y: 455, r: 62, h: 1 }
export const START = { x: 800, y: 790 }
export const GOAL = { x: 800, y: 150 }
/** How close the gripper's centre may come to the vase's centre without a hit. */
export const CLEAR = VASE.r + 22
export const NPATH = 48

export type Mode = 'left' | 'right' | 'over'

/** Resample a drawn stroke into a demonstration from START to GOAL (endpoints pulled in). */
export function strokeToPath(stroke: Pt[], lift: boolean): P3[] {
  const rs = resample(stroke, NPATH)
  const a = rs[0]
  const b = rs[NPATH - 1]
  const out: P3[] = rs.map((p, i) => {
    const t = i / (NPATH - 1)
    // pull the ends onto the start and the cup, spreading the correction along the path
    const x = p.x + (START.x - a.x) * (1 - t) + (GOAL.x - b.x) * t
    const y = p.y + (START.y - a.y) * (1 - t) + (GOAL.y - b.y) * t
    return { x, y, z: 0 }
  })
  if (lift) {
    // lifted over: height peaks as the path passes the vase
    for (const p of out) {
      const d = Math.abs(p.y - VASE.y)
      p.z = Math.max(0, 1.6 * Math.cos(Math.min(Math.PI / 2, (d / 260) * (Math.PI / 2))))
    }
  }
  return out
}

/** Which way round the vase a path goes (by where it passes the vase). */
export function modeOf(path: P3[]): Mode {
  if (path.some((p) => p.z > 0.5)) return 'over'
  let best = path[0]
  for (const p of path) if (Math.abs(p.y - VASE.y) < Math.abs(best.y - VASE.y)) best = p
  return best.x < VASE.x ? 'left' : 'right'
}

/** Does a path hit the vase? Returns the index of the first hit, or -1. */
export function hitIndex(path: P3[]) {
  for (let i = 0; i < path.length; i++) {
    const p = path[i]
    if (Math.hypot(p.x - VASE.x, p.y - VASE.y) < CLEAR && p.z < VASE.h) return i
  }
  return -1
}

/** The averager: the mean of every demonstration, point by point (what a mean-squared-error regressor learns). */
export function averagePath(paths: P3[][]): P3[] {
  return Array.from({ length: NPATH }, (_, i) => {
    let x = 0
    let y = 0
    let z = 0
    for (const p of paths) {
      x += p[i].x
      y += p[i].y
      z += p[i].z
    }
    const n = paths.length || 1
    return { x: x / n, y: y / n, z: z / n }
  })
}

/** The sampler: pick one cluster of demonstrations with probability in proportion to its size, follow its mean. */
export function samplePath(paths: P3[][], u: number) {
  const groups = new Map<Mode, P3[][]>()
  for (const p of paths) {
    const m = modeOf(p)
    groups.set(m, [...(groups.get(m) ?? []), p])
  }
  let acc = 0
  const total = paths.length
  for (const [m, g] of groups) {
    acc += g.length / total
    if (u <= acc + 1e-9) return { mode: m, path: averagePath(g), share: g.length / total }
  }
  const [m, g] = [...groups.entries()].pop() as [Mode, P3[][]]
  return { mode: m, path: averagePath(g), share: g.length / total }
}

/** Ten demonstrations for the watched cues: five round each side, a little messy. */
export function tenDemos(): P3[][] {
  const out: P3[][] = []
  for (let k = 0; k < 10; k++) {
    const r = rand(500 + k)
    const side = k % 2 ? 1 : -1
    const amp = 175 + r.u() * 70
    const ctrl = [
      START,
      { x: START.x + side * (40 + r.u() * 40), y: 680 + r.u() * 30 },
      { x: VASE.x + side * amp, y: VASE.y + 40 + r.u() * 40 },
      { x: VASE.x + side * (amp - 20), y: VASE.y - 90 - r.u() * 40 },
      { x: GOAL.x + side * (30 + r.u() * 40), y: 230 + r.u() * 20 },
      GOAL,
    ]
    out.push(strokeToPath(spline(ctrl, 16), false))
  }
  return out
}

/**
 * A toy diffusion sampler: start from noise and denoise step by step with the score of the
 * demonstrations' distribution (a mixture of the two modes, blurred by the current noise
 * level). Early on both modes pull equally; as the noise shrinks the path commits to one.
 * Returns every intermediate path, for the animation.
 */
export function denoise(modes: P3[][], seed: number, steps = 28): P3[][] {
  const r = rand(seed)
  const frames: P3[][] = []
  const sig0 = 220
  let x = modes[0].map((p) => ({ x: VASE.x + r.n() * sig0, y: p.y + r.n() * sig0 * 0.5, z: 0 }))
  frames.push(x.map((p) => ({ ...p })))
  for (let k = 0; k < steps; k++) {
    const sig = sig0 * Math.pow(0.012 / 1, k / (steps - 1)) + 4
    // responsibilities: how close is the whole path to each mode, at this noise level?
    const logw = modes.map((m) => -m.reduce((s, p, i) => s + ((p.x - x[i].x) ** 2 + (p.y - x[i].y) ** 2), 0) / (2 * sig * sig * NPATH) * 6)
    const mx = Math.max(...logw)
    const w = logw.map((l) => Math.exp(l - mx))
    const ws = w.reduce((a, b) => a + b, 0)
    const target = modes[0].map((_, i) => ({
      x: modes.reduce((s, m, j) => s + m[i].x * w[j], 0) / ws,
      y: modes.reduce((s, m, j) => s + m[i].y * w[j], 0) / ws,
    }))
    const a = 0.22
    const ns = sig * 0.18
    x = x.map((p, i) => ({ x: p.x + (target[i].x - p.x) * a + r.n() * ns, y: p.y + (target[i].y - p.y) * a + r.n() * ns * 0.5, z: 0 }))
    frames.push(x.map((p) => ({ ...p })))
  }
  return frames
}

/** Seeds whose denoising commits left and right (found by running it, so the animation is real). */
export function seedsForSides(modes: P3[][]) {
  let left = 0
  let right = 0
  for (let s = 1; s < 400 && (!left || !right); s++) {
    const f = denoise(modes, s)
    const m = modeOf(f[f.length - 1])
    if (m === 'left' && !left) left = s
    if (m === 'right' && !right) right = s
  }
  return { left: left || 1, right: right || 2 }
}

/* ------------------------------------------------------------------ */
/* Chapter 3: many rooms or many reps                                  */
/* ------------------------------------------------------------------ */

export const BUDGET = 1600
/** Room counts that split 1,600 demonstrations evenly. */
export const SPLITS = [1, 2, 4, 5, 8, 10, 16, 20, 25, 32, 40, 50, 64]

/**
 * Expected success in unseen rooms, from a simple model shaped like Lin et al. (2024):
 * a power law in the number of distinct environments, times a factor that saturates in
 * demonstrations per environment (and bites below about twenty).
 */
export function successRate(rooms: number) {
  const per = BUDGET / rooms
  const envTerm = 1 - 0.9 * Math.pow(rooms, -0.65)
  const repTerm = 1 - Math.exp(-per / 12)
  return envTerm * repTerm
}

/** Test in 20 unseen kitchens: each one passes or fails with the model's probability. */
export function testKitchens(rooms: number, seed: number) {
  const r = rand(seed * 7919 + rooms * 31)
  const p = successRate(rooms)
  return Array.from({ length: 20 }, () => r.u() < p)
}
