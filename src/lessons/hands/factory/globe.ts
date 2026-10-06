/*
 * A night globe for film 5: coarse continents sampled as dots, a graticule, and great-circle
 * arcs, all projected orthographically so a timeline can turn the globe by rewriting paths.
 */
type LL = [number, number]

const NORTH_AMERICA: LL[] = [[-168, 66], [-162, 60], [-150, 61], [-140, 60], [-130, 55], [-125, 49], [-124, 40], [-117, 32], [-110, 23], [-105, 20], [-97, 16], [-92, 15], [-87, 13], [-83, 9], [-80, 8], [-77, 8], [-82, 12], [-87, 21], [-90, 21], [-97, 26], [-97, 28], [-90, 30], [-84, 30], [-81, 25], [-80, 32], [-76, 35], [-74, 40], [-70, 42], [-66, 45], [-60, 47], [-56, 52], [-60, 55], [-64, 60], [-75, 62], [-80, 63], [-85, 67], [-95, 70], [-110, 72], [-125, 70], [-140, 70], [-156, 71], [-166, 68]]
const GREENLAND: LL[] = [[-50, 60], [-42, 60], [-20, 70], [-20, 80], [-40, 83], [-60, 82], [-70, 78], [-55, 68]]
const SOUTH_AMERICA: LL[] = [[-80, 8], [-75, 11], [-62, 11], [-52, 5], [-35, -5], [-38, -13], [-40, -22], [-48, -28], [-53, -34], [-58, -38], [-65, -42], [-68, -50], [-70, -55], [-74, -52], [-73, -40], [-71, -30], [-70, -18], [-76, -14], [-81, -5], [-80, 0], [-78, 3]]
const EURASIA: LL[] = [[-10, 36], [-9, 43], [-2, 44], [-4, 48], [2, 51], [5, 53], [8, 57], [5, 62], [14, 67], [25, 71], [40, 68], [45, 67], [60, 69], [70, 73], [80, 73], [100, 77], [115, 73], [130, 71], [140, 72], [160, 70], [170, 66], [180, 65], [178, 62], [163, 58], [160, 52], [155, 57], [142, 59], [136, 54], [141, 47], [133, 43], [129, 40], [127, 35], [126, 38], [122, 40], [118, 38], [121, 32], [122, 28], [117, 23], [110, 20], [106, 16], [109, 12], [105, 9], [103, 12], [100, 13], [101, 4], [104, 1], [100, 6], [98, 10], [98, 16], [94, 16], [92, 21], [88, 22], [85, 20], [80, 15], [77, 8], [73, 17], [70, 21], [66, 25], [58, 25], [57, 23], [52, 25], [50, 30], [48, 30], [56, 24], [59, 22], [55, 17], [52, 15], [45, 13], [43, 15], [39, 21], [35, 28], [33, 30], [35, 33], [36, 36], [30, 36], [27, 37], [26, 40], [23, 40], [23, 37], [20, 40], [19, 42], [13, 45], [12, 44], [16, 41], [16, 38], [12, 38], [10, 44], [8, 44], [3, 43], [0, 40], [-1, 37], [-5, 36]]
const AFRICA: LL[] = [[-17, 21], [-16, 28], [-10, 30], [-6, 36], [10, 37], [11, 33], [20, 31], [25, 32], [32, 31], [34, 28], [38, 20], [43, 12], [51, 12], [48, 5], [40, -3], [40, -11], [35, -20], [33, -26], [28, -33], [20, -35], [18, -30], [12, -17], [13, -8], [9, -1], [9, 4], [4, 6], [-8, 4], [-13, 8], [-17, 13]]
const AUSTRALIA: LL[] = [[114, -22], [114, -34], [118, -35], [124, -33], [131, -31], [138, -35], [141, -38], [147, -38], [150, -37], [153, -28], [153, -25], [145, -15], [142, -11], [136, -12], [130, -12], [126, -14], [122, -18]]
const JAPAN: LL[] = [[130, 31], [131, 34], [135, 35], [140, 41], [142, 45], [145, 44], [141, 38], [140, 35], [136, 34]]
const UK: LL[] = [[-5, 50], [1, 51], [2, 53], [-1, 55], [-3, 58], [-6, 58], [-5, 55], [-3, 53], [-5, 52]]
const SUMATRA: LL[] = [[95, 5], [98, 4], [104, -2], [106, -6], [101, -3], [96, 2]]
const BORNEO: LL[] = [[109, 1], [111, -3], [116, -4], [119, 1], [117, 7], [113, 4]]
const CHINA: LL[] = [[73, 39], [80, 45], [87, 49], [97, 42], [105, 42], [112, 45], [120, 50], [127, 53], [135, 48], [131, 43], [125, 40], [122, 37], [120, 32], [122, 28], [117, 23], [110, 21], [108, 22], [101, 22], [98, 25], [92, 28], [86, 28], [80, 30], [78, 35], [74, 37]]

const LAND = [NORTH_AMERICA, GREENLAND, SOUTH_AMERICA, EURASIA, AFRICA, AUSTRALIA, JAPAN, UK, SUMATRA, BORNEO]

function inside(p: LL, poly: LL[]) {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

/** Land dots (and which ones are China), sampled once. */
export const DOTS: { ll: LL; china: boolean }[] = (() => {
  const out: { ll: LL; china: boolean }[] = []
  const step = 3.2
  for (let lat = -56; lat <= 82; lat += step) {
    const lstep = step / Math.max(0.25, Math.cos((lat * Math.PI) / 180))
    for (let lon = -180; lon < 180; lon += lstep) {
      const p: LL = [lon, lat]
      if (LAND.some((poly) => inside(p, poly))) out.push({ ll: p, china: inside(p, CHINA) })
    }
  }
  return out
})()

const rad = Math.PI / 180

/** Orthographic projection centred on (lon0, lat0), radius R, at (cx, cy). */
export function project(ll: LL, lon0: number, lat0: number, R: number, cx: number, cy: number, lift = 1) {
  const lat = ll[1] * rad
  const dl = (ll[0] - lon0) * rad
  const p0 = lat0 * rad
  const x = Math.cos(lat) * Math.sin(dl)
  const y = Math.cos(p0) * Math.sin(lat) - Math.sin(p0) * Math.cos(lat) * Math.cos(dl)
  const z = Math.sin(p0) * Math.sin(lat) + Math.cos(p0) * Math.cos(lat) * Math.cos(dl)
  return { x: cx + x * R * lift, y: cy - y * R * lift, z }
}

/** The dots as two path strings (front, near the limb) plus China's. */
export function dotPaths(lon0: number, lat0: number, R: number, cx: number, cy: number) {
  let front = ''
  let limb = ''
  let china = ''
  for (const d of DOTS) {
    const p = project(d.ll, lon0, lat0, R, cx, cy)
    if (p.z <= 0) continue
    const s = `M${p.x.toFixed(1)} ${p.y.toFixed(1)}h0`
    if (d.china) china += s
    else if (p.z > 0.3) front += s
    else limb += s
  }
  return { front, limb, china }
}

/** Meridians and parallels every 30 degrees, front side only. */
export function graticule(lon0: number, lat0: number, R: number, cx: number, cy: number) {
  let d = ''
  const line = (pts: LL[]) => {
    let pen = false
    for (const ll of pts) {
      const p = project(ll, lon0, lat0, R, cx, cy)
      if (p.z <= 0) {
        pen = false
        continue
      }
      d += `${pen ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`
      pen = true
    }
  }
  for (let lon = -180; lon < 180; lon += 30) line(Array.from({ length: 33 }, (_, i) => [lon, -80 + i * 5] as LL))
  for (let lat = -60; lat <= 60; lat += 30) line(Array.from({ length: 73 }, (_, i) => [-180 + i * 5, lat] as LL))
  return d
}

/** A great-circle arc from a to b, lifted off the surface in the middle; hidden where it goes behind. */
export function arcPath(a: LL, b: LL, lon0: number, lat0: number, R: number, cx: number, cy: number) {
  const v = (ll: LL) => [Math.cos(ll[1] * rad) * Math.cos(ll[0] * rad), Math.cos(ll[1] * rad) * Math.sin(ll[0] * rad), Math.sin(ll[1] * rad)]
  const A = v(a)
  const B = v(b)
  const dot = Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]))
  const w = Math.acos(dot)
  let d = ''
  let pen = false
  const n = 40
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const s1 = Math.sin((1 - t) * w) / Math.sin(w)
    const s2 = Math.sin(t * w) / Math.sin(w)
    const P = [A[0] * s1 + B[0] * s2, A[1] * s1 + B[1] * s2, A[2] * s1 + B[2] * s2]
    const ll: LL = [Math.atan2(P[1], P[0]) / rad, Math.asin(Math.max(-1, Math.min(1, P[2]))) / rad]
    const lift = 1 + 0.14 * Math.sin(Math.PI * t) * Math.min(1, w / 1.2)
    const p = project(ll, lon0, lat0, R, cx, cy, lift)
    if (p.z < -0.05 * lift) {
      pen = false
      continue
    }
    d += `${pen ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    pen = true
  }
  return d
}
