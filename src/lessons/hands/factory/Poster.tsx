import { GRASPS, Hand3D, makeHandStore } from '../../../cine/hand3d'
import { C, SANS, SERIF } from '../../../cine/palette'
import { Pool, Vignette } from '../shared/kit'
import { FactoryBack, FactoryFloor, FactoryRows, FlatHand, MouldBlock } from './factoryKit'

const hand = makeHandStore({ pose: GRASPS.relaxed, view: { yaw: -30, pitch: 12, roll: 0, s: 1.7 } })

/* A belt of identical hands running from the mould into the depth of the hall. */
const VX = 800
const VY = 470
const BELT = Array.from({ length: 14 }, (_, i) => {
  const t = Math.pow(0.8, i)
  return { x: VX + (560 - VX) * t, y: VY + (800 - VY) * t, s: 0.62 * t, k: i }
}).reverse()

/** Start screen: a steel mould, and a belt of identical hands vanishing into the factory. */
export function Poster() {
  return (
    <g>
      <FactoryBack seed={5} />
      <FactoryFloor y={560} />
      <FactoryRows seed={11} />
      <Pool x={VX} y={VY} r={520} color="gold" opacity={0.5} />
      <path d={`M300 860 L${VX - 6} ${VY} L${VX + 6} ${VY} L820 860 Z`} fill={C.ink2} opacity={0.92} />
      <path d={`M300 860 L${VX - 6} ${VY}`} stroke={C.gold} strokeWidth={3} opacity={0.6} />
      <path d={`M820 860 L${VX + 6} ${VY}`} stroke={C.gold} strokeWidth={3} opacity={0.6} />
      {BELT.map((b) => (
        <g key={b.k} opacity={0.35 + 0.65 * (b.s / 0.62)}>
          <FlatHand x={b.x} y={b.y} s={b.s} prefix={`f5p-h${b.k}`} />
        </g>
      ))}
      <Pool x={260} y={700} r={360} color="gold" opacity={0.55} />
      <MouldBlock x={250} y={640} s={0.95} />
      <Pool x={1240} y={460} r={480} color="key" opacity={0.6} />
      <Hand3D store={hand} x={1220} y={560} look="robot" arm={200} light={[0.7, -0.6]} />
      <text x={110} y={170} fill={C.paper} fontFamily={SERIF} fontSize={92} fontWeight={600} letterSpacing={-1}>
        A Million Hands
      </text>
      <text x={114} y={222} fill={C.mist} fontFamily={SANS} fontSize={26} letterSpacing={6}>
        ROBOT HANDS · FILM 5
      </text>
      <Vignette />
    </g>
  )
}
