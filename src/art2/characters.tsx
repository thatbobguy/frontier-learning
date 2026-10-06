import { useId } from 'react'
import { Shadow } from './fx'
import { N } from './palette'

export type Headwear = 'hijab' | 'turban' | 'cap' | 'hair' | 'none'
export type ArmPose = 'down' | 'wave' | 'point' | 'hold' | 'think' | 'cheer'
export type Face = 'smile' | 'calm' | 'wow' | 'think'

export interface PersonProps {
  x?: number
  y?: number
  s?: number
  /** Face the other way. */
  flip?: boolean
  skin?: string
  skinDark?: string
  robe?: string
  robeLight?: string
  robeDark?: string
  head?: Headwear
  headColor?: string
  headDark?: string
  beard?: string
  pose?: ArmPose
  face?: Face
  /** Extra things in the hands (drawn after the arms), in body coordinates. */
  holding?: React.ReactNode
}

const HAND: Record<ArmPose, [[number, number], [number, number]]> = {
  down: [[-46, -72], [50, -72]],
  wave: [[-46, -72], [78, -232]],
  point: [[-46, -72], [118, -150]],
  hold: [[-56, -112], [56, -112]],
  think: [[-46, -72], [22, -172]],
  cheer: [[-80, -232], [80, -232]],
}

/** Where the elbow goes for a shoulder and a hand, bending outwards and down like a real arm. */
function elbowFor(sx: number, sy: number, hx: number, hy: number, side: -1 | 1): [number, number] {
  const dx = hx - sx
  const dy = hy - sy
  // a hanging arm stays nearly straight; a raised or reaching one bends at the elbow
  const L1 = Math.max(48, Math.hypot(dx, dy) / 2 + 0.8)
  const L2 = L1 - 1
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(L1 - L2) + 2), L1 + L2 - 0.5)
  const a = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))
  const base = Math.atan2(dy, dx)
  const cands = [base + a, base - a].map((t) => [sx + Math.cos(t) * L1, sy + Math.sin(t) * L1] as [number, number])
  const score = ([ex, ey]: [number, number]) => side * ex * 0.4 + ey
  return score(cands[0]) >= score(cands[1]) ? cands[0] : cands[1]
}

/** A watercolour wash: a see-through fill whose pigment pools a little darker at the edge. */
function Wash({ d, fill, o = 0.55, edge = 0.5, w = 1.6 }: { d: string; fill: string; o?: number; edge?: number; w?: number }) {
  return <path d={d} fill={fill} fillOpacity={o} stroke={fill} strokeOpacity={edge} strokeWidth={w} strokeLinejoin="round" />
}

const IRIS = '#3b2214'
const LIP = '#a8464a'

/**
 * A person, about 255 tall with feet at the origin, seen a little from the side (facing right;
 * flip to face left). Painted in watercolour layers: flat base colours, then see-through washes
 * of shade with darker pooled edges, warm light from the upper left and cool shadow on the right.
 */
export function Person({
  x = 0,
  y = 0,
  s = 1,
  flip = false,
  skin = N.skin2,
  skinDark = N.skin2Dark,
  robe = N.sky,
  robeLight = N.skyLight,
  robeDark = N.skyDark,
  head = 'none',
  headColor = N.coral,
  headDark = N.coralDark,
  beard,
  pose = 'down',
  face = 'smile',
  holding,
}: PersonProps) {
  const id = useId().replace(/:/g, '')
  const [l, r] = HAND[pose]
  const robePath = 'M-14 -182 Q2 -172 18 -182 Q36 -181 43 -171 Q49 -160 46 -138 Q41 -122 35 -112 Q44 -62 50 -12 Q24 -2 0 -2 Q-24 -2 -48 -12 Q-42 -62 -33 -112 Q-39 -122 -44 -138 Q-47 -160 -41 -171 Q-34 -181 -14 -182 Z'
  const shoulder: Record<-1 | 1, [number, number]> = { [-1]: [-35, -166], [1]: [38, -166] }

  const sleeve = (hx: number, hy: number, side: -1 | 1) => {
    const [sx, sy] = shoulder[side]
    const [ex, ey] = elbowFor(sx, sy, hx, hy, side)
    // stop the sleeve short of the hand, so the wrist shows
    const fx = hx - ex
    const fy = hy - ey
    const fl = Math.hypot(fx, fy) || 1
    const cx = hx - (fx / fl) * 9
    const cy = hy - (fy / fl) * 9
    const base = side < 0 ? robe : robeDark
    // a tapered sleeve in two rounded pieces, wide at the shoulder and narrowing to the cuff
    const seg = (ax: number, ay: number, wa: number, bx: number, by: number, wb: number) => {
      const l = Math.hypot(bx - ax, by - ay) || 1
      const nx = -(by - ay) / l
      const ny = (bx - ax) / l
      return (
        `M${ax + nx * wa} ${ay + ny * wa} L${bx + nx * wb} ${by + ny * wb} ` +
        `A${wb} ${wb} 0 0 0 ${bx - nx * wb} ${by - ny * wb} L${ax - nx * wa} ${ay - ny * wa} ` +
        `A${wa} ${wa} 0 0 0 ${ax + nx * wa} ${ay + ny * wa} Z`
      )
    }
    const upper = seg(sx, sy, 11, ex, ey, 8.6)
    const lower = seg(ex, ey, 8.6, cx, cy, 7.4)
    const sleevePath = `${upper} ${lower}`
    const [n2x, n2y] = [-(cy - ey) / fl, (cx - ex) / fl]
    const pt = (px: number, py: number, nx: number, ny: number, w: number) => `${px + nx * w} ${py + ny * w}`
    const cid = `arm-${id}-${side < 0 ? 'l' : 'r'}`
    return (
      <g>
        <path d={`M${cx} ${cy} L${hx} ${hy}`} stroke={skinDark} strokeWidth={10} strokeLinecap="round" />
        <clipPath id={cid}>
          <path d={upper} />
          <path d={lower} />
        </clipPath>
        <path d={sleevePath} fill={base} />
        <g clipPath={`url(#${cid})`}>
          {/* shade on the side away from the light, a crease at the elbow, a darker cuff */}
          <path d={sleevePath} fill={robeDark} opacity={side < 0 ? 0.55 : 0.75} transform="translate(6 3)" />
          <path d={sleevePath} fill={robeLight} opacity={side < 0 ? 0.35 : 0.15} transform="translate(-7 -3)" />
          <path d={`M${pt(cx, cy, n2x, n2y, 12)} L${pt(cx, cy, n2x, n2y, -12)}`} stroke={robeDark} strokeWidth={6} opacity={0.45} transform={`translate(${(fx / fl) * -1} ${(fy / fl) * -1})`} />
        </g>
      </g>
    )
  }
  const hand = (hx: number, hy: number, side: -1 | 1) => {
    const [sx, sy] = shoulder[side]
    const [ex, ey] = elbowFor(sx, sy, hx, hy, side)
    const ang = (Math.atan2(hy - ey, hx - ex) * 180) / Math.PI
    return (
      <g transform={`translate(${hx} ${hy}) rotate(${ang})`}>
        {/* palm and fingers along the forearm, thumb on top */}
        <path d="M-2 -7 Q8 -10 15 -6 Q19 -1 15 5 Q8 9 -2 7 Q-5 0 -2 -7 Z" fill={skin} />
        <path d="M3 -8 Q9 -15 13 -12 Q14 -9 8 -5 Z" fill={skin} transform={side < 0 ? 'scale(1 -1)' : undefined} />
        <Wash d="M2 2 Q9 6 15 4 Q12 8 4 7 Z" fill={skinDark} o={0.7} edge={0.4} w={1} />
        <path d="M10 -3 Q13 0 10 3" stroke={skinDark} strokeWidth={1} strokeOpacity={0.6} fill="none" />
      </g>
    )
  }

  // the head, drawn about 1.18x bigger than it ends up (scaled to 0.85)
  const skull = 'M-24 -4 C-26 -24 -14 -33 2 -33 C18 -33 28 -22 27 -4 C27 9 22 22 10 30 C3 34 -6 32 -13 26 C-21 19 -24 8 -24 -4 Z'
  const eye = (ex: number, ey: number, w: number, far: boolean) => {
    const open = face === 'wow' ? 1.35 : face === 'calm' ? 0.75 : 1
    const look = face === 'think' ? [1.6, -2] : [1.6, 0]
    const top = ey - 5.6 * open
    const bot = ey + 3.6 * (face === 'smile' ? 0.75 : 1)
    const white = `M${ex - w} ${ey} Q${ex - w * 0.2} ${top - 1} ${ex + w} ${ey - 0.6} Q${ex + w * 0.1} ${bot + 1} ${ex - w} ${ey} Z`
    return (
      <g>
        <clipPath id={`eye-${id}-${far ? 'f' : 'n'}`}>
          <path d={white} />
        </clipPath>
        <path d={white} fill={N.cream} />
        <g clipPath={`url(#eye-${id}-${far ? 'f' : 'n'})`}>
          <circle cx={ex + look[0]} cy={ey + look[1] - 0.6} r={w * 0.52} fill={IRIS} />
          <circle cx={ex + look[0]} cy={ey + look[1] - 0.6} r={w * 0.27} fill={N.shadow} />
          {/* the upper lid casts a little shadow on the eye */}
          <path d={`M${ex - w} ${ey - 7} H${ex + w} V${top + 2.4} Q${ex} ${top + 0.6} ${ex - w} ${ey - 1} Z`} fill={skinDark} opacity={0.45} />
        </g>
        <circle cx={ex + look[0] - 1} cy={ey + look[1] - 2.2} r={1.3} fill={N.white} />
        {/* lash line, thick and dark on the top lid */}
        <path d={`M${ex - w - 0.8} ${ey + 0.6} Q${ex - w * 0.2} ${top - 1.4} ${ex + w + 0.6} ${ey - 0.8}`} stroke={N.shadow} strokeWidth={2.6} fill="none" strokeLinecap="round" />
        {/* the crease above and a soft lower lid */}
        <path d={`M${ex - w * 0.8} ${top - 2.6} Q${ex} ${top - 5} ${ex + w * 0.9} ${top - 2}`} stroke={skinDark} strokeWidth={1.4} fill="none" strokeLinecap="round" opacity={0.8} />
        <path d={`M${ex - w * 0.6} ${bot + 1.6} Q${ex} ${bot + 3} ${ex + w * 0.7} ${bot + 0.8}`} stroke={skinDark} strokeWidth={1.2} fill="none" strokeLinecap="round" opacity={0.6} />
      </g>
    )
  }
  const browLift = face === 'wow' ? -4 : face === 'think' ? -2 : 0
  const browColor = head === 'hair' || beard ? (beard ?? headColor) : N.shadow

  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <Shadow y={2} w={150} />
      <clipPath id={`robe-${id}`}>
        <path d={robePath} />
      </clipPath>
      <clipPath id={`skull-${id}`}>
        <path d={skull} />
      </clipPath>
      {/* feet in leather sandals */}
      {[-15, 19].map((fx) => (
        <g key={fx}>
          <ellipse cx={fx} cy={-4} rx={13} ry={5.5} fill={N.woodDark} />
          <ellipse cx={fx - 3} cy={-6} rx={7} ry={2} fill={N.woodLight} opacity={0.45} />
        </g>
      ))}
      {/* neck */}
      <path d="M-10 -206 L-10 -177 Q3 -170 16 -177 L16 -206 Z" fill={skin} />
      <Wash d="M-10 -206 L16 -206 L16 -177 Q6 -186 -10 -192 Z" fill={skinDark} o={0.8} edge={0.4} />
      {head === 'hijab' && <path d="M-34 -232 Q-40 -270 2 -272 Q42 -270 40 -232 Q46 -190 38 -176 Q2 -164 -36 -176 Q-44 -196 -34 -232 Z" fill={headDark} />}
      {/* the robe: base colour, warm light down the left, shade and folds on the right */}
      <path d={robePath} fill={robe} />
      <g clipPath={`url(#robe-${id})`}>
        <g filter="url(#fx-wet)">
        <Wash d="M-48 -170 Q-34 -140 -31 -112 Q-34 -60 -38 0 L-70 0 L-70 -170 Z" fill={robeLight} o={0.45} edge={0.3} w={2.4} />
        <Wash d="M14 -184 Q36 -152 30 -112 Q24 -60 32 -2 L70 -2 L70 -184 Z" fill={robeDark} o={0.72} edge={0.6} w={2.4} />
        <Wash d="M-10 -104 Q-14 -60 -22 -4 L-12 -4 Q-6 -56 -10 -104 Z" fill={robeDark} o={0.4} edge={0.4} w={1.2} />
        <Wash d="M10 -104 Q12 -60 8 -3 L18 -3 Q18 -60 10 -104 Z" fill={robeDark} o={0.45} edge={0.4} w={1.2} />
        <Wash d="M-26 -100 Q-28 -50 -34 -6 L-27 -5 Q-22 -50 -26 -100 Z" fill={robeLight} o={0.4} edge={0.2} w={1} />
        <Wash d="M-40 -168 Q-20 -150 -6 -146 Q-24 -140 -38 -150 Z" fill={robeDark} o={0.3} edge={0.3} w={1} />
        {/* a cloth belt */}
        <path d="M-70 -114 Q0 -100 70 -114 L70 -100 Q0 -86 -70 -100 Z" fill={robeDark} opacity={0.75} />
        <path d="M-70 -113 Q0 -99 70 -113" stroke={robeLight} strokeWidth={2} fill="none" opacity={0.4} />
        {/* the neckline folds and the shade under the chin */}
        <Wash d="M-20 -182 Q2 -164 24 -182 Q16 -168 2 -164 Q-12 -166 -20 -182 Z" fill={robeDark} o={0.6} edge={0.5} />
        </g>
        <rect x={-70} y={-60} width={140} height={60} fill="url(#fx-cloth-ao)" />
      </g>
      {sleeve(l[0], l[1], -1)}
      {sleeve(r[0], r[1], 1)}
      {holding}
      {hand(l[0], l[1], -1)}
      {hand(r[0], r[1], 1)}
      {/* head */}
      <g transform="translate(3 -228) scale(0.85)">
        {head === 'hair' && <path d="M-26 -8 Q-32 -38 -6 -40 Q24 -44 30 -16 Q32 4 26 10 L-20 18 Q-30 8 -26 -8 Z" fill={headDark} />}
        {/* ear on the far side */}
        <ellipse cx={-22} cy={2} rx={6} ry={9} fill={skin} />
        <path d="M-22 -3 Q-26 2 -22 7" stroke={skinDark} strokeWidth={2} fill="none" strokeLinecap="round" />
        <path d={skull} fill={skin} />
        <g clipPath={`url(#skull-${id})`}>
          <g filter="url(#fx-wet)">
          {/* cool shade on the cheek turned away from the light, warm bounce near the jaw */}
          <Wash d="M17 -34 C30 -24 32 -6 30 6 C28 18 20 30 4 36 L40 36 L40 -34 Z" fill={skinDark} o={0.8} edge={0.5} w={2} />
          <Wash d="M24 -12 C28 0 26 14 16 26 C24 18 26 4 24 -12 Z" fill={N.plum} o={0.14} edge={0.1} />
          <Wash d="M-26 10 C-20 24 -6 34 8 32 C-4 28 -16 22 -26 10 Z" fill={skinDark} o={0.55} edge={0.35} />
          {/* cheeks */}
          <ellipse cx={20} cy={11} rx={8} ry={6} fill="url(#fx-blush)" />
          <ellipse cx={-5} cy={11} rx={9} ry={6.5} fill="url(#fx-blush)" />
          {/* nose: shade on its far flank, a lit tip, a nostril */}
          <Wash d="M9 -6 Q13 3 17 9 Q15 13 10 12 Q13 7 9 -6 Z" fill={skinDark} o={0.85} edge={0.55} w={1.2} />
          <path d="M5 -4 Q6 4 7 9" stroke={N.cream} strokeOpacity={0.22} strokeWidth={2} fill="none" strokeLinecap="round" />
          <path d="M7 12 Q10 14.5 15 12.5 Q17 11 16 9" stroke={N.shadow} strokeOpacity={0.45} strokeWidth={1.5} fill="none" strokeLinecap="round" />
          {/* warm light along the lit edge of the head */}
          <path d="M-23 10 C-25 -6 -24 -22 -12 -30" stroke={N.goldLight} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.35} />
          </g>
        </g>
        {beard && (
          <g>
            <path d="M-21 8 Q-20 30 -4 40 Q8 46 18 38 Q28 30 28 8 Q22 22 16 22 Q10 17 4 18 Q-6 20 -12 14 Q-18 10 -21 8 Z" fill={beard} />
            <path d="M0 18 Q8 14 18 18 Q12 22 8 21 Q4 22 0 18 Z" fill={beard} />
            <path d="M-12 22 Q-8 32 -2 38 M4 26 Q6 34 6 42 M16 26 Q18 32 16 38" stroke={N.white} strokeOpacity={0.14} strokeWidth={1.4} fill="none" strokeLinecap="round" />
          </g>
        )}
        {/* eyes and brows */}
        <g className="blink2">
          {eye(-5, -2, 5.6, true)}
          {eye(17, -2, 6.4, false)}
        </g>
        {/* brows: thick at the inner end, tapering out */}
        <g transform={`translate(0 ${browLift})`} fill={browColor}>
          <path d="M1 -11 Q-5 -15.5 -12 -12 Q-6 -14 0.5 -9.4 Z" />
          <path d={`M9.5 -10.5 Q17 ${face === 'think' ? -19 : -17} 26 -12 Q17 ${face === 'think' ? -15.6 : -14} 10 -8.6 Z`} />
        </g>
        {/* mouth */}
        {face === 'smile' && (
          <g>
            <path d="M3 18 Q10 24 18 17 Q12 27 4 20 Z" fill={LIP} opacity={0.75} />
            <path d="M2 18 Q10 22.5 19 16" stroke={N.shadow} strokeWidth={1.8} fill="none" strokeLinecap="round" opacity={0.85} />
          </g>
        )}
        {face === 'calm' && (
          <g>
            <path d="M4 19.5 Q10 23 16 19 Q11 25 4 19.5 Z" fill={LIP} opacity={0.6} />
            <path d="M3 19 Q10 20 17 18.5" stroke={N.shadow} strokeWidth={1.7} fill="none" strokeLinecap="round" opacity={0.8} />
          </g>
        )}
        {face === 'wow' && (
          <g>
            <ellipse cx={10} cy={21} rx={4.6} ry={6} fill="#3a1418" />
            <path d="M6 18 Q10 15.5 14 18" stroke={LIP} strokeWidth={1.6} fill="none" opacity={0.7} />
          </g>
        )}
        {face === 'think' && <path d="M4 20 Q10 19 17 16" stroke={N.shadow} strokeWidth={1.8} fill="none" strokeLinecap="round" opacity={0.85} />}
        {/* headwear on top */}
        {head === 'hair' && (
          <g>
            <path d="M-26 -2 Q-30 -34 -2 -38 Q26 -40 30 -12 Q24 -24 12 -26 Q14 -18 4 -14 Q6 -22 -4 -24 Q-10 -14 -20 -8 Q-24 -4 -26 -2 Z" fill={headColor} />
            <Wash d="M8 -36 Q26 -34 30 -12 Q24 -24 12 -26 Z" fill={headDark} o={0.7} edge={0.4} />
            <path d="M-20 -26 Q-10 -36 6 -35" stroke={N.white} strokeOpacity={0.1} strokeWidth={4} fill="none" strokeLinecap="round" />
            <path d="M-14 -16 Q-6 -26 4 -28 M12 -30 Q20 -28 24 -20" stroke={headDark} strokeOpacity={0.6} strokeWidth={1.4} fill="none" strokeLinecap="round" />
          </g>
        )}
        {head === 'cap' && (
          <g>
            <path d="M-26 -10 Q-28 -40 2 -41 Q30 -40 29 -12 Q2 -20 -26 -10 Z" fill={headColor} />
            <Wash d="M10 -40 Q30 -36 29 -12 Q20 -15 14 -16 Q16 -30 10 -40 Z" fill={headDark} o={0.75} edge={0.45} />
            <path d="M-26 -10 Q2 -20 29 -12" stroke={headDark} strokeWidth={3} fill="none" />
            <path d="M-14 -34 Q-4 -38 8 -37" stroke={N.white} strokeOpacity={0.25} strokeWidth={2.4} fill="none" strokeLinecap="round" />
          </g>
        )}
        {head === 'turban' && (
          <g>
            <path d="M-30 -6 Q-36 -46 0 -50 Q36 -48 32 -8 Q2 -18 -30 -6 Z" fill={headColor} />
            <Wash d="M-29 -12 Q4 -40 32 -20 L32 -10 Q4 -28 -30 -4 Z" fill={headDark} o={0.75} edge={0.5} w={1.4} />
            <Wash d="M-24 -30 Q6 -52 28 -32 Q6 -40 -24 -24 Z" fill={headDark} o={0.6} edge={0.5} w={1.2} />
            <Wash d="M12 -48 Q34 -44 32 -8 Q24 -14 20 -14 Q24 -34 12 -48 Z" fill={headDark} o={0.6} edge={0.4} />
            <path d="M-26 -34 Q-12 -46 4 -48" stroke={N.white} strokeOpacity={0.35} strokeWidth={3} fill="none" strokeLinecap="round" />
            <circle cx={4} cy={-22} r={4} fill={N.gold} />
            <circle cx={3} cy={-23} r={1.5} fill={N.goldLight} />
          </g>
        )}
        {head === 'hijab' && (
          <g>
            <path d="M-34 -2 Q-38 -46 2 -48 Q40 -46 38 -2 Q38 22 28 34 Q34 12 30 -8 Q26 -32 2 -34 Q-24 -32 -26 -6 Q-28 18 -16 34 Q-34 20 -34 -2 Z" fill={headColor} />
            <Wash d="M14 -46 Q40 -40 38 -2 Q38 22 28 34 Q34 12 30 -8 Q28 -26 14 -34 Z" fill={headDark} o={0.7} edge={0.5} />
            <path d="M-28 -24 Q-16 -42 4 -44" stroke={N.white} strokeOpacity={0.3} strokeWidth={3} fill="none" strokeLinecap="round" />
            <path d="M-30 4 Q-28 22 -16 34" stroke={headDark} strokeOpacity={0.5} strokeWidth={1.6} fill="none" />
          </g>
        )}
      </g>
    </g>
  )
}

export type PipMood = 'idle' | 'talking' | 'listening' | 'thinking'

/** Pip the owl, in the night style. Centred near the origin, about 150 tall. */
export function Pip2({ mood = 'idle' }: { mood?: PipMood }) {
  return (
    <g className={`pip pip-${mood}`}>
      <ellipse cx={0} cy={68} rx={40} ry={6} fill={N.shadow} opacity={0.35} />
      {/* ear tufts */}
      <path d="M-36 -42 Q-50 -76 -40 -86 Q-24 -66 -14 -54 Z" fill={N.violetDark} />
      <path d="M36 -42 Q50 -76 40 -86 Q24 -66 14 -54 Z" fill={N.violetDark} />
      {/* body */}
      <path d="M0 -62 C44 -62 58 -24 56 14 C54 52 32 66 0 66 C-32 66 -54 52 -56 14 C-58 -24 -44 -62 0 -62 Z" fill={N.violet} />
      <path d="M20 -58 C50 -44 60 -10 56 18 C52 52 30 66 0 66 C30 52 40 20 36 -10 C34 -34 26 -50 20 -58 Z" fill={N.violetDark} opacity={0.7} />
      <path d="M-20 -58 C-40 -50 -50 -30 -52 -8 C-44 -30 -34 -46 -20 -58 Z" fill={N.violetLight} opacity={0.8} />
      {/* wings */}
      <path className="pip-wing-l" d="M-50 -4 Q-70 24 -52 50 Q-40 30 -42 2 Z" fill={N.violetDark} />
      <path className="pip-wing-r" d="M50 -4 Q70 24 52 50 Q40 30 42 2 Z" fill={N.violetDark} />
      {/* belly */}
      <path d="M0 2 C24 2 34 22 32 40 C30 56 16 62 0 62 C-16 62 -30 56 -32 40 C-34 22 -24 2 0 2 Z" fill={N.violetLight} />
      <path d="M-12 22 q4 5 8 0 M4 22 q4 5 8 0 M-4 36 q4 5 8 0" stroke={N.violet} strokeWidth={3} fill="none" strokeLinecap="round" />
      {/* eyes */}
      <g className="pip-eyes">
        <circle cx={-19} cy={-20} r={20} fill={N.white} />
        <circle cx={19} cy={-20} r={20} fill={N.white} />
        <circle cx={-16} cy={-18} r={10} fill={N.night0} className="pip-pupil" />
        <circle cx={22} cy={-18} r={10} fill={N.night0} className="pip-pupil" />
        <circle cx={-12} cy={-23} r={3.5} fill={N.white} />
        <circle cx={26} cy={-23} r={3.5} fill={N.white} />
      </g>
      {/* beak */}
      <g className="pip-beak">
        <path d="M-8 -4 Q0 -8 8 -4 L0 9 Z" fill={N.gold} />
        <path d="M-6 3 L6 3 L0 12 Z" fill={N.goldDark} className="pip-beak-low" />
      </g>
      {/* feet */}
      <path d="M-18 62 l-5 8 M-12 62 v9 M-6 62 l5 8 M6 62 l-5 8 M12 62 v9 M18 62 l5 8" stroke={N.gold} strokeWidth={4} strokeLinecap="round" />
    </g>
  )
}
