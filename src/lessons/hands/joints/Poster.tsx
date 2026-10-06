import { makeHandStore } from '../../../cine/hand3d'
import { C, MONO, SANS, SERIF } from '../../../cine/palette'
import { Blueprint, Dust, Pool, Vignette } from '../shared/kit'
import { BIG_POSE, BIG_VIEW, motorSpots } from './Ch1Dof'
import { Hand3DX } from './hand4'
import { Finger2D, arc, chain } from './parts'

const hand = makeHandStore({ pose: BIG_POSE, view: BIG_VIEW, xray: 1 })
const F = { x: 640, y: 900, a0: -90, lens: [230, 150, 110], q: [24, 38, 28] }
const pts = chain(F.x, F.y, F.a0, F.lens, F.q)
const motors = motorSpots()
const heads = F.q.map((_, i) => F.a0 + F.q.slice(0, i).reduce((a, b) => a + b, 0))

/** Start screen: a blueprint finger with its joint arcs, and an x-ray hand with twenty amber motors. */
export function Poster() {
  return (
    <g>
      <Blueprint />
      <Dust x={-100} y={-100} w={1800} h={1100} count={30} seed={22} color={C.cyan} size={0.6} />
      <Pool x={1120} y={520} r={560} color="amber" opacity={0.22} />
      {/* the x-ray hand, crowded with motors */}
      <g transform="translate(320 70)">
        <Hand3DX store={hand} x={800} y={780} look="robot" arm={200} light={[0.6, -0.7]} />
        {motors.map((m, i) => (
          <g key={i}>
            <circle cx={m.x} cy={m.y} r={17} fill={C.amber} opacity={0.22} />
            <circle cx={m.x} cy={m.y} r={9} fill={C.amber} stroke={C.amberLight} strokeWidth={2} />
          </g>
        ))}
      </g>
      <text x={1490} y={250} textAnchor="end" fill={C.amberLight} fontFamily={MONO} fontSize={22}>
        20 motors?
      </text>
      {/* the finger, as a blueprint, each joint with its arc of motion */}
      <Finger2D x={F.x} y={F.y} a0={F.a0} lens={F.lens} q={F.q} look="bone" w={34} />
      {pts.slice(0, 3).map((p, i) => {
        const a1 = heads[i]
        const r = 80 - i * 14
        return <path key={i} d={arc(p.x, p.y, r, a1 - 30, a1 + F.q[i] + 40)} stroke={C.cyan} strokeWidth={4} fill="none" strokeLinecap="round" markerEnd="url(#cn-arrow)" />
      })}
      <text x={110} y={170} fill={C.paper} fontFamily={SERIF} fontSize={92} fontWeight={600} letterSpacing={-1}>
        Joints and Freedom
      </text>
      <text x={114} y={222} fill={C.mist} fontFamily={SANS} fontSize={26} letterSpacing={6}>
        ROBOT HANDS · FILM 2
      </text>
      <Vignette />
    </g>
  )
}
