/*
 * The two "synergies" of the hand, as a tiny model: pattern 1 closes everything together
 * (open -> power grasp); pattern 2 trades the thumb across against the fingers (towards a
 * pinch) or, the other way, spreads the hand flat. Any grasp in the film is a mix of the two.
 */
import { GRASPS, type HandPose } from '../../../cine/hand3d'

type Key = keyof HandPose
const KEYS: Key[] = ['thumb', 'index', 'middle', 'ring', 'little', 'wrist']

function combine(terms: [HandPose, number][]): HandPose {
  const out = {} as Record<Key, number[]>
  for (const k of KEYS) {
    const n = GRASPS.open[k].length
    out[k] = Array.from({ length: n }, (_, i) => terms.reduce((s, [p, w]) => s + (p[k] as number[])[i] * w, 0))
  }
  return out as unknown as HandPose
}

const lerpPose = (a: HandPose, b: HandPose, t: number) => combine([
  [a, 1 - t],
  [b, t],
])

/** Pattern 2 at full strength towards the pinch is anchored at this much of pattern 1. */
const PINCH_AT = 0.7
const SPREAD = 2.2

/** The hand for a mix of the two patterns: s1 in 0..1 (close everything), s2 in -1..1 (spread .. thumb across). */
export function synergyPose(s1: number, s2: number): HandPose {
  const base = lerpPose(GRASPS.open, GRASPS.power, s1)
  if (s2 >= 0) {
    // towards the pinch: thumb across, index meets it, the other fingers tuck
    const anchor = lerpPose(GRASPS.open, GRASPS.power, PINCH_AT)
    return combine([
      [base, 1],
      [GRASPS.pinch, s2],
      [anchor, -s2],
    ])
  }
  // the other way: fingers fan out and the thumb swings wide (spread, exaggerated so it reads)
  return combine([
    [base, 1],
    [GRASPS.spread, -s2 * SPREAD],
    [GRASPS.open, s2 * SPREAD],
  ])
}

/** How far apart two poses are: mean absolute joint difference in degrees. */
export function poseDistance(a: HandPose, b: HandPose) {
  let s = 0
  let n = 0
  for (const k of KEYS) {
    if (k === 'wrist') continue
    ;(a[k] as number[]).forEach((v, i) => {
      s += Math.abs(v - (b[k] as number[])[i])
      n++
    })
  }
  return s / n
}

export const TARGETS: { id: string; name: string; s1: number; s2: number }[] = [
  { id: 'power', name: 'power grasp, round a bottle', s1: 1, s2: 0 },
  { id: 'pinch', name: 'pinch, a bead between two tips', s1: 0.7, s2: 1 },
  { id: 'spread', name: 'flat hand, fingers spread', s1: 0, s2: -1 },
  { id: 'relaxed', name: 'relaxed, half open', s1: 0.4, s2: 0.15 },
]
