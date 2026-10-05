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
  down: [[-58, -62], [58, -62]],
  wave: [[-58, -62], [78, -232]],
  point: [[-58, -62], [118, -150]],
  hold: [[-56, -112], [56, -112]],
  think: [[-58, -62], [22, -172]],
  cheer: [[-80, -232], [80, -232]],
}

/**
 * A round, friendly person, about 250 tall with feet at the origin.
 * Flat shapes, no outlines: a lit side and a shaded side on the robe and head.
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
  const robePath = 'M-46 -158 Q0 -172 46 -158 Q62 -80 68 -6 Q0 8 -68 -6 Q-62 -80 -46 -158 Z'
  const arm = (hx: number, hy: number, side: -1 | 1) => {
    const sx = side * 42
    const sy = -146
    const mx = (sx + hx) / 2 + side * 14
    const my = (sy + hy) / 2 + 10
    return (
      <g>
        <path d={`M${sx} ${sy} Q${mx} ${my} ${hx} ${hy}`} stroke={side < 0 ? robe : robeDark} strokeWidth={22} strokeLinecap="round" fill="none" />
        <circle cx={hx} cy={hy} r={12} fill={skin} />
      </g>
    )
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <Shadow y={2} w={150} />
      <clipPath id={`robe-${id}`}>
        <path d={robePath} />
      </clipPath>
      <path d={robePath} fill={robe} />
      <g clipPath={`url(#robe-${id})`}>
        <path d="M18 -180 Q40 -80 34 20 L90 20 L90 -180 Z" fill={robeDark} />
        <path d="M-70 -180 Q-46 -90 -52 20 L-90 20 L-90 -180 Z" fill={robeLight} opacity={0.55} />
        <rect x={-70} y={-40} width={140} height={10} fill={robeDark} opacity={0.35} />
      </g>
      {arm(l[0], l[1], -1)}
      {arm(r[0], r[1], 1)}
      {holding}
      {/* head */}
      <g transform="translate(0 -206)">
        {head === 'hijab' && <path d="M-50 4 Q-54 -54 0 -56 Q54 -54 50 4 Q56 52 30 62 L-30 62 Q-56 52 -50 4 Z" fill={headColor} />}
        <circle r={40} fill={skin} />
        <path d="M14 -36 A40 40 0 0 1 14 36 A46 46 0 0 0 14 -36 Z" fill={skinDark} opacity={0.6} />
        {head === 'hijab' && (
          <>
            <path d="M-50 4 Q-54 -54 0 -56 Q54 -54 50 4 Q46 -30 0 -36 Q-46 -30 -50 4 Z" fill={headColor} />
            <path d="M22 -50 Q54 -40 50 4 Q56 52 30 62 L18 62 Q44 30 34 -10 Z" fill={headDark} opacity={0.7} />
          </>
        )}
        {head === 'turban' && (
          <g>
            <ellipse cx={0} cy={-34} rx={48} ry={30} fill={headColor} />
            <path d="M-46 -30 Q0 -6 46 -30 Q40 -14 0 -8 Q-40 -14 -46 -30 Z" fill={headDark} />
            <path d="M-30 -56 Q0 -40 34 -58" stroke={headDark} strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.7} />
            <circle cx={0} cy={-26} r={7} fill={N.gold} />
          </g>
        )}
        {head === 'cap' && (
          <path d="M-38 -14 Q-38 -46 0 -46 Q38 -46 38 -14 Z" fill={headColor} />
        )}
        {head === 'hair' && <path d="M-40 -4 Q-46 -50 0 -48 Q44 -48 40 -6 Q30 -30 0 -32 Q-26 -30 -40 -4 Z" fill={headColor} />}
        {beard && <path d="M-34 6 Q-30 52 0 56 Q30 52 34 6 Q20 22 0 22 Q-20 22 -34 6 Z" fill={beard} />}
        {/* face */}
        <g className="blink2">
          <ellipse cx={-14} cy={-2} rx={face === 'wow' ? 6 : 5} ry={face === 'think' ? 3 : 6.5} fill={N.shadow} />
          <ellipse cx={14} cy={-2} rx={face === 'wow' ? 6 : 5} ry={face === 'think' ? 3 : 6.5} fill={N.shadow} />
          <circle cx={-12} cy={-5} r={1.8} fill={N.white} />
          <circle cx={16} cy={-5} r={1.8} fill={N.white} />
        </g>
        <circle cx={-24} cy={12} r={7} fill={N.coral} opacity={0.3} />
        <circle cx={24} cy={12} r={7} fill={N.coral} opacity={0.3} />
        {!beard && face === 'smile' && <path d="M-9 16 Q0 24 9 16" stroke={N.shadow} strokeWidth={3.5} fill="none" strokeLinecap="round" />}
        {!beard && face === 'calm' && <path d="M-6 18 H6" stroke={N.shadow} strokeWidth={3.5} strokeLinecap="round" />}
        {face === 'wow' && <ellipse cx={0} cy={beard ? 30 : 20} rx={6} ry={8} fill={N.shadow} />}
        {beard && face !== 'wow' && <path d="M-8 30 Q0 35 8 30" stroke={N.shadow} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.7} />}
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
