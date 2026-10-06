import type { ReactElement } from 'react'
import { GRASPS, Hand3D, makeHandStore } from '../../../cine/hand3d'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { rng } from '../../../art2/fx'
import { Dust, Pool, Vignette } from '../shared/kit'

const hand = makeHandStore({ pose: GRASPS.open, view: { yaw: 74, pitch: -10, roll: 180, s: 1.9 } })

/** Vanishing point of the library. */
const VP = { x: 1120, y: 470 }

/** The shelves of text: tall walls of glowing spines receding to a point. */
function Library() {
  const r = rng(41)
  const walls: ReactElement[] = []
  for (const side of [-1, 1]) {
    for (let col = 0; col < 26; col++) {
      // columns get thinner and closer together as they recede
      const t0 = Math.pow(col / 26, 0.62)
      const t1 = Math.pow((col + 1) / 26, 0.62)
      const xA = side < 0 ? -40 + (VP.x - 40 - -40) * t0 : 1640 - (1640 - (VP.x + 40)) * t0
      const xB = side < 0 ? -40 + (VP.x - 40 - -40) * t1 : 1640 - (1640 - (VP.x + 40)) * t1
      const k = 1 - t0
      const top = VP.y - 560 * k - 30
      const bot = VP.y + 520 * k + 30
      for (let shelf = 0; shelf < 7; shelf++) {
        const y0 = top + ((bot - top) * shelf) / 7
        const h = (bot - top) / 7 - 6 * k
        const a = 0.12 + r() * 0.3 * (0.4 + k)
        walls.push(<rect key={`${side}-${col}-${shelf}`} x={Math.min(xA, xB)} y={y0} width={Math.max(1, Math.abs(xB - xA) - 2)} height={Math.max(1, h)} fill={r() < 0.2 ? C.keyLight : C.paper} opacity={a} />)
      }
    }
  }
  return <g>{walls}</g>
}

/** Start screen: an endless library of text, and one robot hand reaching for the single lime tile of robot data. */
export function Poster() {
  return (
    <g>
      <rect width={1600} height={900} fill={C.ink} />
      <Pool x={VP.x} y={VP.y} r={520} color="key" opacity={0.5} />
      <Library />
      <rect width={1600} height={900} fill={C.ink} opacity={0.38} />
      {/* the floor */}
      <path d={`M0 900 L${VP.x - 40} ${VP.y + 60} L${VP.x + 40} ${VP.y + 60} L1600 900 Z`} fill={C.ink1} />
      <path d={`M0 900 L${VP.x - 40} ${VP.y + 60} M1600 900 L${VP.x + 40} ${VP.y + 60}`} stroke={C.slate} strokeWidth={2} opacity={0.6} />
      <text x={VP.x + 120} y={VP.y + 30} fill={C.keyLight} fontFamily={MONO} fontSize={18} opacity={0.8}>
        ~15–36 trillion tokens
      </text>
      {/* the one tile */}
      <Pool x={1080} y={760} r={190} color="lime" opacity={0.8} />
      <g transform="translate(1080 760) skewX(-14)">
        <rect x={-46} y={-30} width={92} height={60} rx={6} fill={C.ink2} stroke={C.lime} strokeWidth={4} />
        <path d="M-30 12 L-12 -6 L4 6 L30 -18" stroke={C.limeLight} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <text x={1180} y={835} fill={C.lime} fontFamily={MONO} fontSize={18}>
        robot data
      </text>
      <path d="M1176 828 L1130 790" stroke={C.lime} strokeWidth={2} opacity={0.7} />
      <Hand3D store={hand} x={1090} y={300} look="robot" arm={380} light={[0.7, -0.6]} />
      <Dust />
      <text className="poster-title" x={110} y={170} fill={C.paper} fontFamily={SERIF} fontSize={92} fontWeight={600} letterSpacing={-1}>
        The Missing Internet
      </text>
      <text className="poster-title" x={114} y={222} fill={C.mist} fontFamily={SANS} fontSize={26} letterSpacing={6}>
        ROBOT HANDS · DATA 1
      </text>
      <Vignette />
    </g>
  )
}
