/**
 * People for the robot hands course: tall, graphic, film-lit figures in the spirit of
 * indie animation. Each person is a jointed puppet (a rig) drawn in flat shapes; the light
 * filter (`light` prop) adds the rim of light and the core shadow, so the same figure can be
 * a warm-lit hero, a cool silhouette against a window, or a shape in the dark.
 *
 * Seen side-on, facing right (flip to face left), feet at the origin, about 310 tall.
 *
 * Animate with `rig()`:
 *   const mira = rig(root.current, 'mira')
 *   mira.to(tl, POSES.reach, 'b2', 0.8)
 *   mira.walk(tl, tl.labels.b3, { steps: 4, dx: 360 })
 */
import type { ReactNode } from 'react'
import { lit, type Light } from './defs'
import { C } from './palette'

// ---------------------------------------------------------------- the skeleton

/** Rest-pose pivots (figure coordinates). Every joint rotates about its pivot. */
const P = {
  hip: [0, -150],
  neck: [10, -252],
  shoulderN: [6, -238],
  shoulderF: [-2, -240],
  elbowN: [6, -172],
  elbowF: [-2, -174],
  wristN: [6, -112],
  wristF: [-2, -114],
  hipN: [4, -150],
  hipF: [-4, -150],
  kneeN: [4, -76],
  kneeF: [-4, -76],
  ankleN: [4, -6],
  ankleF: [-4, -6],
} as const

/**
 * Joint angles in degrees. For arms and legs, positive swings the limb forward (toward the
 * way the person faces). Elbows: positive bends the forearm up and forward. Knees: positive
 * bends the shin back. Torso and head: positive leans forward. Wrists: positive tips the hand
 * up. `x, y` move the whole body; `lean` tips it at the hips.
 */
export interface Pose {
  x: number
  y: number
  lean: number
  torso: number
  head: number
  armN: number
  elbowN: number
  wristN: number
  armF: number
  elbowF: number
  wristF: number
  legN: number
  kneeN: number
  legF: number
  kneeF: number
}

const REST: Pose = { x: 0, y: 0, lean: 0, torso: 0, head: 0, armN: 0, elbowN: 0, wristN: 0, armF: 0, elbowF: 0, wristF: 0, legN: 0, kneeN: 0, legF: 0, kneeF: 0 }

const pose = (p: Partial<Pose>): Pose => ({ ...REST, ...p })

/** A small library of poses to start from. Mix with `{ ...POSES.stand, armN: 70 }`. */
export const POSES = {
  stand: pose({ armN: 4, elbowN: 8, armF: -4, elbowF: 8, legN: 2, legF: -2 }),
  relaxed: pose({ torso: -2, head: -4, armN: 8, elbowN: 14, armF: -6, elbowF: 10, legN: 6, kneeN: 4, legF: -4 }),
  think: pose({ head: 8, armN: 30, elbowN: 128, wristN: 20, armF: 12, elbowF: 70, legN: 3, legF: -3 }),
  reach: pose({ torso: 10, head: 6, armN: 82, elbowN: 10, wristN: 10, armF: 10, elbowF: 20, legN: 10, kneeN: 6, legF: -8 }),
  reachHigh: pose({ torso: -4, head: -18, armN: 150, elbowN: 10, wristN: 10, armF: 20, elbowF: 30 }),
  present: pose({ torso: 2, head: -4, armN: 55, elbowN: 40, wristN: 30, armF: -10, elbowF: 10, legN: 4, legF: -4 }),
  hold: pose({ torso: 4, head: 14, armN: 30, elbowN: 70, wristN: 0, armF: 26, elbowF: 74, wristF: 0 }),
  lookDown: pose({ torso: 8, head: 26, armN: 10, elbowN: 30, armF: 4, elbowF: 30 }),
  lookUp: pose({ torso: -6, head: -24, armN: 0, elbowN: 6, armF: -2, elbowF: 6 }),
  workbench: pose({ torso: 26, head: 18, armN: 60, elbowN: 46, wristN: -10, armF: 48, elbowF: 60, legN: 6, kneeN: 4, legF: -10 }),
  type: pose({ torso: 14, head: 6, armN: 48, elbowN: 64, wristN: -14, armF: 40, elbowF: 70, wristF: -14 }),
  sit: pose({ y: 64, torso: -4, armN: 40, elbowN: 50, armF: 34, elbowF: 54, legN: 86, kneeN: 92, legF: 82, kneeF: 92 }),
  sitForward: pose({ y: 64, torso: 18, head: 8, armN: 52, elbowN: 54, armF: 46, elbowF: 58, legN: 86, kneeN: 92, legF: 82, kneeF: 92 }),
  shrug: pose({ head: -6, armN: 20, elbowN: 96, wristN: 40, armF: -14, elbowF: 96, wristF: 40 }),
  point: pose({ torso: 2, armN: 88, elbowN: 4, wristN: 0, armF: -6, elbowF: 12 }),
  // Walk keys: contact with the near foot forward, passing, contact with the far foot forward.
  walkA: pose({ y: 0, torso: 4, armN: -24, elbowN: 16, armF: 24, elbowF: 22, legN: 24, kneeN: 4, legF: -22, kneeF: 18 }),
  walkPass: pose({ y: -6, torso: 4, armN: 0, elbowN: 14, armF: 0, elbowF: 14, legN: -4, kneeN: 34, legF: 6, kneeF: 4 }),
  walkB: pose({ y: 0, torso: 4, armN: 24, elbowN: 22, armF: -24, elbowF: 16, legN: -22, kneeN: 18, legF: 24, kneeF: 4 }),
} satisfies Record<string, Pose>

/** How each angle is applied to the drawing: [joint, pivot, sign]. */
const JOINTS: [keyof Pose, readonly [number, number], number][] = [
  ['torso', P.hip, 1],
  ['head', P.neck, 1],
  ['armN', P.shoulderN, -1],
  ['elbowN', P.elbowN, -1],
  ['wristN', P.wristN, -1],
  ['armF', P.shoulderF, -1],
  ['elbowF', P.elbowF, -1],
  ['wristF', P.wristF, -1],
  ['legN', P.hipN, -1],
  ['kneeN', P.kneeN, 1],
  ['legF', P.hipF, -1],
  ['kneeF', P.kneeF, 1],
]

const jointTransform = (p: Pose, j: keyof Pose) => {
  const row = JOINTS.find((r) => r[0] === j)
  if (!row) return undefined
  const [, [px, py], sign] = row
  return `rotate(${(p[j] * sign).toFixed(2)} ${px} ${py})`
}
const rootTransform = (p: Pose) => `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${p.lean.toFixed(2)} 0 -150)`

// ---------------------------------------------------------------- shapes

/** A tapered limb from (ax, ay) to (bx, by), widths wa and wb, with round ends. */
function limb(ax: number, ay: number, wa: number, bx: number, by: number, wb: number) {
  const l = Math.hypot(bx - ax, by - ay) || 1
  const nx = (-(by - ay) / l) * 0.5
  const ny = ((bx - ax) / l) * 0.5
  return (
    `M${ax + nx * wa} ${ay + ny * wa} L${bx + nx * wb} ${by + ny * wb} ` +
    `A${wb / 2} ${wb / 2} 0 0 0 ${bx - nx * wb} ${by - ny * wb} L${ax - nx * wa} ${ay - ny * wa} ` +
    `A${wa / 2} ${wa / 2} 0 0 0 ${ax + nx * wa} ${ay + ny * wa} Z`
  )
}

export type Hair = 'bun' | 'short' | 'curls' | 'long' | 'bob' | 'buzz' | 'beanie' | 'bald' | 'ponytail'
export type Outfit = 'jacket' | 'hoodie' | 'coat' | 'overalls' | 'tee'

export interface PersonProps {
  /** Class name for the rig to find this person by, e.g. "mira". */
  name: string
  x?: number
  y?: number
  s?: number
  flip?: boolean
  pose?: Partial<Pose>
  light?: Light | 'none'
  skin?: string
  skinDark?: string
  hair?: Hair
  hairColor?: string
  top?: string
  topDark?: string
  pants?: string
  shoes?: string
  outfit?: Outfit
  glasses?: boolean
  /** A VR headset (teleoperation). */
  headset?: boolean
  /** Eyes closed or open. */
  eyes?: 'open' | 'closed' | 'none'
  /** Something held in the near hand, drawn in the hand's frame (wrist at 0,0, fingers pointing down). */
  holdN?: ReactNode
  holdF?: ReactNode
  /** Silhouette only: one flat colour, for figures far away or in the dark. */
  silhouette?: string
}

/**
 * A person. The rig finds the joints by `name`, so give each person on stage its own name.
 */
export function Person({
  name,
  x = 0,
  y = 0,
  s = 1,
  flip = false,
  pose: poseIn,
  light = 'key-left',
  skin = C.skinB,
  skinDark = C.skinBDark,
  hair = 'short',
  hairColor = C.hairDark,
  top = '#9c4a2c',
  topDark = '#6a2e1a',
  pants = '#1f2738',
  shoes = '#11151f',
  outfit = 'jacket',
  glasses = false,
  headset = false,
  eyes = 'open',
  holdN,
  holdF,
  silhouette,
}: PersonProps) {
  const p = { ...POSES.stand, ...poseIn }
  const sil = silhouette
  const f = (c: string) => sil ?? c
  const shade = sil ? 'transparent' : C.ink

  const leg = (side: 'N' | 'F') => {
    const [hx, hy] = side === 'N' ? P.hipN : P.hipF
    const [kx, ky] = side === 'N' ? P.kneeN : P.kneeF
    const [ax, ay] = side === 'N' ? P.ankleN : P.ankleF
    const far = side === 'F'
    return (
      <g data-j={`leg${side}`} transform={jointTransform(p, `leg${side}`)}>
        <path d={limb(hx, hy, 30, kx, ky, 21)} fill={f(pants)} />
        <g data-j={`knee${side}`} transform={jointTransform(p, `knee${side}`)}>
          <path d={limb(kx, ky, 20, ax, ay, 13)} fill={f(pants)} />
          {/* shoe */}
          <path d={`M${ax - 10} ${ay - 8} Q${ax - 4} ${ay - 14} ${ax + 8} ${ay - 9} L${ax + 30} ${ay - 2} Q${ax + 34} ${ay + 4} ${ax + 26} ${ay + 6} L${ax - 10} ${ay + 6} Q${ax - 14} ${ay} ${ax - 10} ${ay - 8} Z`} fill={f(shoes)} />
          {!sil && <path d={`M${ax - 11} ${ay + 3} H${ax + 28}`} stroke={C.mist} strokeOpacity={0.25} strokeWidth={2} />}
        </g>
        {far && !sil && <path d={limb(hx, hy, 30, kx, ky, 21)} fill={shade} opacity={0.35} />}
      </g>
    )
  }

  const hand = (hold: ReactNode, wx: number, wy: number) => (
    <g>
      {/* a relaxed hand, fingers pointing down along the forearm, thumb forward */}
      <path d={`M${wx - 7} ${wy - 2} Q${wx - 9} ${wy + 12} ${wx - 6} ${wy + 22} Q${wx} ${wy + 28} ${wx + 6} ${wy + 22} Q${wx + 9} ${wy + 10} ${wx + 7} ${wy - 2} Z`} fill={f(skin)} />
      <path d={`M${wx + 5} ${wy + 2} Q${wx + 13} ${wy + 8} ${wx + 12} ${wy + 16} Q${wx + 9} ${wy + 17} ${wx + 6} ${wy + 12} Z`} fill={f(skin)} />
      {!sil && <path d={`M${wx - 5} ${wy + 6} Q${wx - 6} ${wy + 16} ${wx - 3} ${wy + 22}`} stroke={skinDark} strokeWidth={2} fill="none" opacity={0.6} />}
      {hold && <g transform={`translate(${wx} ${wy + 14})`}>{hold}</g>}
    </g>
  )

  const arm = (side: 'N' | 'F', hold: ReactNode) => {
    const [sx, sy] = side === 'N' ? P.shoulderN : P.shoulderF
    const [ex, ey] = side === 'N' ? P.elbowN : P.elbowF
    const [wx, wy] = side === 'N' ? P.wristN : P.wristF
    const sleeve = side === 'F' ? topDark : top
    const sleeveLen = outfit === 'tee' ? 0.45 : 1
    const cuffY = ey + (wy - ey) * 0.92
    return (
      <g data-j={`arm${side}`} transform={jointTransform(p, `arm${side}`)}>
        {outfit === 'tee' ? (
          <>
            <path d={limb(sx, sy, 18, ex, ey, 13)} fill={f(skin)} />
            <path d={limb(sx, sy, 24, sx + (ex - sx) * sleeveLen, sy + (ey - sy) * sleeveLen, 20)} fill={f(sleeve)} />
          </>
        ) : (
          <path d={limb(sx, sy, 24, ex, ey, 18)} fill={f(sleeve)} />
        )}
        <g data-j={`elbow${side}`} transform={jointTransform(p, `elbow${side}`)}>
          <g data-j={`wrist${side}`} transform={jointTransform(p, `wrist${side}`)}>{hand(hold, wx, wy)}</g>
          {outfit === 'tee' ? <path d={limb(ex, ey, 13, wx, wy, 10)} fill={f(skin)} /> : <path d={limb(ex, ey, 17, ex, cuffY, 14)} fill={f(sleeve)} />}
          {!sil && outfit !== 'tee' && <path d={`M${ex - 7} ${cuffY} H${ex + 7}`} stroke={C.ink} strokeOpacity={0.35} strokeWidth={3} strokeLinecap="round" />}
        </g>
        {side === 'F' && !sil && <path d={limb(sx, sy, 24, ex, ey, 18)} fill={shade} opacity={0.2} />}
      </g>
    )
  }

  const torsoPath =
    outfit === 'coat'
      ? 'M-14 -246 Q8 -256 26 -245 Q35 -230 31 -200 Q29 -160 30 -96 L-22 -96 Q-24 -160 -23 -200 Q-25 -234 -14 -246 Z'
      : outfit === 'hoodie'
        ? 'M-16 -246 Q8 -258 28 -244 Q36 -228 32 -198 Q29 -168 24 -134 L-20 -132 Q-24 -168 -24 -200 Q-26 -234 -16 -246 Z'
        : 'M-14 -246 Q8 -255 26 -245 Q35 -230 31 -200 Q28 -170 22 -136 L-19 -134 Q-23 -170 -23 -200 Q-25 -234 -14 -246 Z'

  const headPath = 'M14 -254 Q2 -256 -4 -268 Q-10 -284 -4 -298 Q4 -311 19 -310 Q33 -308 35 -293 L36 -286 Q41 -279 40 -276 Q38 -273 34 -273 L35 -269 Q33 -267 34 -264 Q33 -259 30 -257 Q24 -254 14 -254 Z'

  const hairShape = (() => {
    switch (hair) {
      case 'bun':
        return (
          <>
            <circle cx={-6} cy={-312} r={13} fill={f(hairColor)} />
            <path d="M-6 -276 Q-12 -300 2 -310 Q18 -318 32 -304 Q36 -296 34 -292 Q22 -298 12 -294 Q6 -284 4 -270 Q-2 -268 -6 -276 Z" fill={f(hairColor)} />
          </>
        )
      case 'curls':
        return (
          <g fill={f(hairColor)}>
            {[
              [-6, -300, 16],
              [6, -312, 16],
              [22, -312, 14],
              [-12, -284, 14],
              [-4, -270, 11],
              [32, -302, 9],
            ].map(([cx, cy, r], i) => (
              <circle key={i} cx={cx} cy={cy} r={r} />
            ))}
          </g>
        )
      case 'long':
        return <path d="M-8 -270 Q-14 -300 2 -312 Q20 -320 34 -302 Q36 -296 33 -292 Q22 -298 14 -294 Q8 -286 8 -270 Q8 -246 -2 -226 Q-14 -230 -16 -246 Q-14 -258 -8 -270 Z" fill={f(hairColor)} />
      case 'ponytail':
        return (
          <>
            <path d="M-6 -300 Q-22 -296 -26 -276 Q-28 -258 -20 -246 Q-16 -262 -10 -276 Z" fill={f(hairColor)} />
            <path d="M-6 -276 Q-12 -300 2 -310 Q18 -318 33 -303 Q35 -297 33 -292 Q22 -298 12 -294 Q6 -284 4 -272 Q-2 -270 -6 -276 Z" fill={f(hairColor)} />
          </>
        )
      case 'bob':
        return <path d="M-8 -262 Q-14 -300 4 -312 Q22 -318 35 -300 Q36 -294 33 -290 Q24 -296 16 -292 Q10 -282 12 -262 Q2 -256 -8 -262 Z" fill={f(hairColor)} />
      case 'buzz':
        return <path d="M-5 -282 Q-8 -300 4 -309 Q20 -315 32 -301 Q30 -298 22 -299 Q8 -298 2 -282 Z" fill={f(hairColor)} opacity={sil ? 1 : 0.85} />
      case 'beanie':
        return (
          <>
            <path d="M-8 -282 Q-12 -312 12 -320 Q32 -322 36 -298 L34 -290 Q14 -294 -8 -282 Z" fill={f(top)} />
            <path d="M-9 -288 Q14 -300 36 -296 L36 -288 Q14 -292 -8 -280 Z" fill={f(topDark)} />
          </>
        )
      case 'bald':
        return null
      default:
        return <path d="M-6 -278 Q-12 -302 4 -311 Q22 -318 34 -302 Q35 -297 33 -293 Q22 -300 12 -296 Q6 -290 4 -278 Q-2 -274 -6 -278 Z" fill={f(hairColor)} />
    }
  })()

  const head = (
    <g data-j="head" transform={jointTransform(p, 'head')}>
      <path d="M6 -262 L18 -262 L20 -240 L4 -240 Z" fill={f(skinDark)} />
      <path d={headPath} fill={f(skin)} />
      {!sil && (
        <>
          {/* ear, eye, brow, lips: a few marks, the light does the rest */}
          <path d="M10 -284 Q4 -284 4 -276 Q5 -270 11 -271" stroke={skinDark} strokeWidth={2.4} fill="none" strokeLinecap="round" />
          {eyes === 'open' && <path d="M26 -288 Q30 -290 33 -287 Q30 -285 26 -288 Z" fill={C.ink} />}
          {eyes === 'closed' && <path d="M26 -287 Q29.5 -285 33 -287" stroke={C.ink} strokeWidth={1.6} fill="none" strokeLinecap="round" />}
          <path d="M24 -294 Q30 -297 35 -294" stroke={hair === 'bald' ? skinDark : hairColor} strokeWidth={2.6} fill="none" strokeLinecap="round" />
          <path d="M33 -266.5 Q34.5 -266 35.5 -266.6" stroke={skinDark} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        </>
      )}
      {hairShape}
      {glasses && !sil && (
        <g fill="none" stroke={C.ink} strokeWidth={2}>
          <path d="M23 -292 H36 V-284 H23 Z" fill={C.cyanLight} fillOpacity={0.12} />
          <path d="M23 -289 L8 -286" />
        </g>
      )}
      {headset && (
        <g>
          <path d="M18 -300 L40 -296 Q44 -286 41 -276 L18 -278 Z" fill={f(C.carbon)} />
          <path d="M40 -295 Q44 -286 41 -277" stroke={sil ? 'none' : C.cyan} strokeWidth={2} fill="none" filter={sil ? undefined : 'url(#cn-bloom)'} />
          <path d="M18 -298 Q2 -300 -6 -290" stroke={f(C.carbon)} strokeWidth={5} fill="none" />
        </g>
      )}
    </g>
  )

  const torsoBack = (
    <g data-j="torso" transform={jointTransform(p, 'torso')}>
      {arm('F', holdF)}
    </g>
  )
  const torso = (
    <g data-j="torso2" transform={jointTransform(p, 'torso')}>
      <path d={torsoPath} fill={f(top)} />
      {!sil && outfit === 'jacket' && (
        <>
          <path d="M24 -242 L14 -214 L22 -140" stroke={topDark} strokeWidth={3} fill="none" opacity={0.8} />
          <path d="M4 -250 L14 -238 L22 -248" stroke={topDark} strokeWidth={4} fill="none" strokeLinejoin="round" />
        </>
      )}
      {!sil && outfit === 'hoodie' && <path d="M-14 -246 Q-20 -262 -4 -262 Q8 -258 6 -246" fill={topDark} />}
      {!sil && outfit === 'coat' && <path d="M24 -244 L12 -210 L16 -100" stroke={topDark} strokeWidth={3} fill="none" />}
      {!sil && outfit === 'overalls' && <path d="M8 -232 L24 -232 L22 -136 L-18 -134 L-16 -180 L8 -186 Z" fill={pants} opacity={0.9} />}
      {!sil && <path d="M-6 -230 Q-12 -196 -8 -150" stroke={topDark} strokeWidth={2.5} fill="none" opacity={0.5} />}
      {!sil && outfit !== 'coat' && <path d="M-19 -150 H23" stroke={C.ink} strokeOpacity={0.35} strokeWidth={4} />}
      {head}
      {arm('N', holdN)}
    </g>
  )

  return (
    <g className={`person ${name}`} filter={light === 'none' || sil ? undefined : lit(light)}>
      <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
        <g data-j="root" transform={rootTransform(p)}>
          {torsoBack}
          {leg('F')}
          {leg('N')}
          {torso}
        </g>
      </g>
    </g>
  )
}

// ---------------------------------------------------------------- the rig

export interface Rig {
  /** Move into a pose. Unlisted joints keep their angle. */
  to: (tl: gsap.core.Timeline, pose: Partial<Pose>, at: gsap.Position, dur?: number, ease?: string) => void
  /** Walk: cycles the walk keys while sliding the body by dx over the steps. */
  walk: (tl: gsap.core.Timeline, at: number, opts: { steps: number; dx: number; stepDur?: number; end?: Partial<Pose> }) => number
  /** A breath or an idle sway, looping softly for `dur` seconds. */
  idle: (tl: gsap.core.Timeline, at: number, dur: number) => void
  state: Pose
}

/**
 * Animates a Person (found inside `scope` by its class name). Every move is a fromTo from
 * the pose the person was in, so seeking to any beat redraws correctly.
 */
export function rig(scope: Element | null, name: string, start: Partial<Pose> = POSES.stand): Rig {
  const el = scope?.querySelector(`.person.${name}`) ?? null
  const state: Pose = { ...POSES.stand, ...start }
  let planned: Pose = { ...state }
  const nodes = new Map<string, Element>()
  el?.querySelectorAll('[data-j]').forEach((n) => nodes.set(n.getAttribute('data-j') ?? '', n))

  const apply = () => {
    nodes.get('root')?.setAttribute('transform', rootTransform(state))
    for (const [j] of JOINTS) {
      const t = jointTransform(state, j)
      if (!t) continue
      nodes.get(j)?.setAttribute('transform', t)
      // The torso is drawn in two layers (behind and in front of the legs).
      if (j === 'torso') nodes.get('torso2')?.setAttribute('transform', t)
    }
  }
  apply()

  const to: Rig['to'] = (tl, pose, at, dur = 0.7, ease = 'power2.inOut') => {
    const from = { ...planned }
    const next = { ...planned, ...pose }
    planned = next
    tl.fromTo(state, { ...from }, { ...next, duration: dur, ease, immediateRender: false, onUpdate: apply }, at)
  }

  const walk: Rig['walk'] = (tl, at, { steps, dx, stepDur = 0.42, end }) => {
    const x0 = planned.x
    let t = at
    for (let i = 0; i < steps; i++) {
      const k = (i + 0.5) / steps
      to(tl, { ...POSES.walkPass, x: x0 + dx * k - dx / steps / 4 }, t, stepDur / 2, 'sine.in')
      to(tl, { ...(i % 2 ? POSES.walkB : POSES.walkA), x: x0 + dx * ((i + 1) / steps) }, t + stepDur / 2, stepDur / 2, 'sine.out')
      t += stepDur
    }
    to(tl, { ...POSES.stand, ...end, x: x0 + dx }, t, 0.35, 'power2.out')
    return t + 0.35
  }

  const idle: Rig['idle'] = (tl, at, dur) => {
    const base = { ...planned }
    const n = Math.max(1, Math.round(dur / 2.4))
    for (let i = 0; i < n; i++) {
      to(tl, { torso: base.torso + 1.5, head: base.head - 2, y: base.y - 1 }, at + i * 2.4, 1.2, 'sine.inOut')
      to(tl, { torso: base.torso, head: base.head, y: base.y }, at + i * 2.4 + 1.2, 1.2, 'sine.inOut')
    }
  }

  return { to, walk, idle, state }
}

// ---------------------------------------------------------------- a big profile for close-ups

/**
 * A close-up of a face in profile, facing right, filling a box about 600 tall with the
 * eye near (330, 250). Lit like a film still: the `light` filter gives the rim, and `half`
 * sinks the back of the head into shadow.
 */
export function Profile({ x = 0, y = 0, s = 1, flip = false, skin = C.skinB, skinDark = C.skinBDark, hair = C.hairDark, light = 'key-right', half = 0.55, eyes = 'open', reflect }: {
  x?: number
  y?: number
  s?: number
  flip?: boolean
  skin?: string
  skinDark?: string
  hair?: string
  light?: Light
  /** How much of the face sinks into shadow, 0 to 1. */
  half?: number
  eyes?: 'open' | 'closed' | 'down'
  /** A small coloured light caught in the eye (a screen, a spark). */
  reflect?: string
}) {
  const face =
    'M120 640 Q140 520 120 460 Q70 380 80 250 Q92 120 210 70 Q320 30 380 110 Q410 150 402 200 L404 236 Q440 300 452 330 Q456 348 432 352 L418 356 Q424 372 414 384 Q428 400 420 418 Q426 430 414 444 Q408 470 370 480 Q340 486 320 500 L300 640 Z'
  const eyeD = eyes === 'open' ? 'M332 250 Q356 238 380 248 Q360 262 332 250 Z' : 'M332 252 Q356 262 380 250'
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <g filter={lit(light)}>
        <path d={face} fill={skin} />
        {/* the ear and jaw, and a shadow plane down the cheek */}
        <path d="M212 236 Q178 230 176 276 Q178 320 214 318 Q228 300 222 276 Q228 252 212 236 Z" fill={skinDark} opacity={0.9} />
        <path d="M262 470 Q300 420 316 360 Q300 330 262 320 Q236 360 230 420 Z" fill={skinDark} opacity={0.35} />
        {/* hair, sweeping back over the ear */}
        <path d="M78 300 Q60 140 170 70 Q280 10 372 82 Q402 108 404 150 Q350 120 300 140 Q246 160 230 230 Q200 210 170 226 Q150 290 160 360 Q110 380 78 300 Z" fill={hair} />
      </g>
      {/* the half of the face turned from the light, sinking into the dark */}
      <clipPath id="cn-profile-clip">
        <path d={face} />
      </clipPath>
      <g clipPath="url(#cn-profile-clip)">
        <path d="M0 0 H330 Q300 200 340 300 Q300 420 310 700 H0 Z" fill={C.ink} opacity={half} transform="translate(-40 0)" />
      </g>
      {/* the eye */}
      {eyes === 'open' ? (
        <g>
          <path d={eyeD} fill={C.ink} />
          <circle cx={366} cy={248} r={3.4} fill={reflect ?? C.keyLight} />
        </g>
      ) : (
        <path d={eyeD} stroke={C.ink} strokeWidth={4} fill="none" strokeLinecap="round" />
      )}
      <path d="M322 228 Q356 210 392 222" stroke={hair} strokeWidth={9} fill="none" strokeLinecap="round" />
      <path d="M420 418 Q410 414 404 418" stroke={skinDark} strokeWidth={4} fill="none" strokeLinecap="round" />
    </g>
  )
}

// ---------------------------------------------------------------- a humanoid robot on the same rig

/**
 * A humanoid robot built on the same skeleton as Person, so `rig()` and every pose work on it.
 * White shells over dark joints, a visor that glows. Give it a `name` like a person.
 */
export function Robot({ name, x = 0, y = 0, s = 1, flip = false, pose: poseIn, light = 'cool-left', shell = C.shell, joint = C.carbon, visor = C.cyan, silhouette }: {
  name: string
  x?: number
  y?: number
  s?: number
  flip?: boolean
  pose?: Partial<Pose>
  light?: Light | 'none'
  shell?: string
  joint?: string
  visor?: string
  silhouette?: string
}) {
  const p = { ...POSES.stand, ...poseIn }
  const f = (c: string) => silhouette ?? c
  const seg = (ax: number, ay: number, wa: number, bx: number, by: number, wb: number, far: boolean) => (
    <>
      <path d={limb(ax, ay, wa, bx, by, wb)} fill={f(far ? C.shellMid : shell)} />
      {!silhouette && <path d={limb(ax + 3, ay + 4, wa * 0.35, bx + 3, by - 4, wb * 0.35)} fill={far ? C.shellDark : C.shellMid} opacity={0.5} />}
    </>
  )
  const disc = (cx: number, cy: number, r: number) => (
    <>
      <circle cx={cx} cy={cy} r={r} fill={f(joint)} />
      {!silhouette && <circle cx={cx} cy={cy} r={r * 0.45} fill={C.metal} opacity={0.7} />}
    </>
  )
  const leg = (side: 'N' | 'F') => {
    const far = side === 'F'
    const [hx, hy] = far ? P.hipF : P.hipN
    const [kx, ky] = far ? P.kneeF : P.kneeN
    const [ax, ay] = far ? P.ankleF : P.ankleN
    return (
      <g data-j={`leg${side}`} transform={jointTransform(p, `leg${side}`)}>
        {disc(hx, hy, 15)}
        {seg(hx, hy + 8, 30, kx, ky - 8, 22, far)}
        <g data-j={`knee${side}`} transform={jointTransform(p, `knee${side}`)}>
          {disc(kx, ky, 12)}
          {seg(kx, ky + 8, 20, ax, ay - 8, 14, far)}
          <path d={`M${ax - 12} ${ay - 6} L${ax + 24} ${ay - 6} Q${ax + 32} ${ay} ${ax + 28} ${ay + 6} L${ax - 12} ${ay + 6} Z`} fill={f(joint)} />
        </g>
      </g>
    )
  }
  const arm = (side: 'N' | 'F') => {
    const far = side === 'F'
    const [sx, sy] = far ? P.shoulderF : P.shoulderN
    const [ex, ey] = far ? P.elbowF : P.elbowN
    const [wx, wy] = far ? P.wristF : P.wristN
    return (
      <g data-j={`arm${side}`} transform={jointTransform(p, `arm${side}`)}>
        {seg(sx, sy + 6, 24, ex, ey - 6, 18, far)}
        {disc(sx, sy, 15)}
        <g data-j={`elbow${side}`} transform={jointTransform(p, `elbow${side}`)}>
          {disc(ex, ey, 10)}
          {seg(ex, ey + 6, 17, wx, wy - 4, 13, far)}
          <g data-j={`wrist${side}`} transform={jointTransform(p, `wrist${side}`)}>
            {/* a hand: palm and a hint of fingers */}
            <path d={`M${wx - 8} ${wy} L${wx + 8} ${wy} L${wx + 9} ${wy + 16} Q${wx + 6} ${wy + 30} ${wx} ${wy + 30} Q${wx - 7} ${wy + 28} ${wx - 9} ${wy + 16} Z`} fill={f(far ? C.shellMid : shell)} />
            <path d={`M${wx + 7} ${wy + 4} Q${wx + 16} ${wy + 10} ${wx + 14} ${wy + 18}`} stroke={f(far ? C.shellMid : shell)} strokeWidth={6} strokeLinecap="round" fill="none" />
            {!silhouette && <path d={`M${wx - 6} ${wy + 14} H${wx + 7} M${wx - 6} ${wy + 20} H${wx + 6}`} stroke={joint} strokeWidth={1.4} opacity={0.6} />}
          </g>
        </g>
      </g>
    )
  }
  return (
    <g className={`person ${name}`} filter={light === 'none' || silhouette ? undefined : lit(light)}>
      <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
        <g data-j="root" transform={rootTransform(p)}>
          <g data-j="torso" transform={jointTransform(p, 'torso')}>
            {arm('F')}
          </g>
          {leg('F')}
          {leg('N')}
          <g data-j="torso2" transform={jointTransform(p, 'torso')}>
            {/* pelvis, abdomen and chest plates */}
            <path d="M-20 -164 L24 -164 L22 -138 L-18 -138 Z" fill={f(joint)} />
            <path d="M-14 -200 L20 -200 L18 -166 L-12 -166 Z" fill={f(joint)} />
            {!silhouette && <path d="M-12 -196 H18 M-11 -186 H17 M-11 -176 H16" stroke={C.slate} strokeWidth={2} />}
            <path d="M-20 -248 Q8 -258 30 -246 Q36 -226 30 -204 L-18 -202 Q-26 -226 -20 -248 Z" fill={f(shell)} />
            {!silhouette && <path d="M-16 -244 Q6 -252 26 -242 L24 -236 Q6 -244 -14 -238 Z" fill={C.white} opacity={0.6} />}
            {!silhouette && <circle cx={12} cy={-224} r={5} fill={visor} opacity={0.9} filter="url(#cn-bloom)" />}
            <g data-j="head" transform={jointTransform(p, 'head')}>
              <rect x={5} y={-262} width={12} height={16} rx={3} fill={f(joint)} />
              <path d="M-6 -290 Q-4 -312 16 -314 Q36 -314 38 -292 Q40 -270 30 -262 Q14 -256 0 -262 Q-8 -272 -6 -290 Z" fill={f(shell)} />
              {!silhouette && (
                <>
                  <path d="M18 -298 Q34 -300 38 -290 Q38 -282 34 -278 Q22 -278 16 -284 Z" fill={C.ink} />
                  <path d="M22 -292 Q30 -294 35 -289" stroke={visor} strokeWidth={3} strokeLinecap="round" fill="none" filter="url(#cn-bloom)" />
                </>
              )}
            </g>
            {arm('N')}
          </g>
        </g>
      </g>
    </g>
  )
}
