import { C, SANS, SERIF } from '../../../cine/palette'
import { POSES, Robot } from '../../../cine/people'
import { Dust, Pool, Vignette } from '../shared/kit'
import { Cat, HomeSky, KitchenWall, MoonStripes, RingToy } from './props'

const ISLAND = { x: 1040, y: 640 }

/** Start screen: Seven in a family kitchen at two in the morning, moonlight in stripes, a cat watching. */
export function Poster() {
  return (
    <g>
      <HomeSky />
      <KitchenWall />
      <rect x={-600} y={760} width={2800} height={700} fill="#141b26" />
      {Array.from({ length: 16 }, (_, i) => (
        <line key={i} x1={-600 + i * 190} y1={760} x2={-900 + i * 260} y2={1100} stroke={C.ink} strokeWidth={3} opacity={0.6} />
      ))}
      <rect x={-600} y={760} width={2800} height={3} fill={C.rim} opacity={0.12} />
      <MoonStripes />
      <Pool x={1100} y={320} r={600} color="rim" opacity={0.3} />
      <RingToy x={880} y={808} s={0.7} />
      {/* the island, and the cat on it */}
      <rect x={ISLAND.x} y={ISLAND.y + 10} width={700} height={400} fill="#111824" />
      <rect x={ISLAND.x - 16} y={ISLAND.y - 6} width={720} height={18} fill="#222c3e" />
      <rect x={ISLAND.x - 16} y={ISLAND.y - 6} width={720} height={3} fill={C.rim} opacity={0.5} />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={ISLAND.x + 20 + i * 180} y={ISLAND.y + 40} width={160} height={220} fill="none" stroke="#1b2434" strokeWidth={3} />
      ))}
      <Cat name="poster-cat" x={1250} y={ISLAND.y - 6} s={1.05} />
      {/* Seven, alone in the moonlight */}
      <ellipse cx={590} cy={804} rx={120} ry={13} fill="#000" opacity={0.55} filter="url(#cn-dof-1)" />
      <Robot name="poster-seven" x={580} y={800} s={1.1} pose={{ ...POSES.stand, head: 10, torso: 2 }} light="cool-right" />
      <g style={{ mixBlendMode: 'screen' }} opacity={0.6}>
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M540 ${560 + i * 64} l120 -40 l0 18 l-120 40 Z`} fill={C.rim} opacity={0.12} />
        ))}
      </g>
      <Dust x={-200} y={0} w={2000} h={800} count={34} seed={31} color={C.rim} size={0.8} />
      <rect x={0} y={0} width={1600} height={300} fill="url(#cn-fade-down)" opacity={0.6} />
      <text className="poster-title" x={110} y={170} fill={C.paper} fontFamily={SERIF} fontSize={92} fontWeight={600} letterSpacing={-1}>
        The Home Robot Frontier
      </text>
      <text className="poster-title" x={114} y={222} fill={C.mist} fontFamily={SANS} fontSize={26} letterSpacing={6}>
        ROBOT HANDS · DATA 4
      </text>
      <Vignette />
    </g>
  )
}
