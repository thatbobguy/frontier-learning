import { GRASPS, Hand3D, makeHandStore } from '../../../cine/hand3d'
import { C, SANS, SERIF } from '../../../cine/palette'
import { Dust, Pool, Vignette } from '../shared/kit'
import { LabFloor, LabSky, LabWall } from '../shared/sets'
import { Gear, MotorSide, Shimmer } from './parts'

const hand = makeHandStore({ pose: GRASPS.claw, view: { yaw: -28, pitch: 6, roll: 0, s: 1.75 }, xray: 1 })

/** Start screen: an x-ray robot hand under the lamp, its tendons lit, with an exploded motor and gear pair hanging in the air beside it. */
export function Poster() {
  return (
    <g>
      <LabSky />
      <LabWall />
      <LabFloor />
      <Pool x={1060} y={430} r={620} color="key" opacity={0.7} />
      <Pool x={1330} y={660} r={300} color="amber" opacity={0.45} />
      <Dust x={500} y={60} w={1000} h={760} count={30} seed={77} color={C.paper} size={0.8} />

      {/* the gear bargain, floating behind the hand */}
      <g opacity={0.9}>
        <Gear x={1400} y={250} r={115} n={48} />
        <Gear x={1262} y={188} r={30} n={12} />
      </g>

      {/* an exploded motor, glowing amber */}
      <g transform="translate(1330 650) rotate(-18)">
        <MotorSide x={0} y={0} s={0.8} cls="pmu" glow={1} />
      </g>
      <Shimmer x={1330} y={560} n={4} spread={70} />

      {/* the hand, its tendons lit */}
      <Hand3D store={hand} x={980} y={660} look="xray" arm={220} light={[0.7, -0.6]} />

      <text className="poster-title" x={110} y={170} fill={C.paper} fontFamily={SERIF} fontSize={92} fontWeight={600} letterSpacing={-1}>
        Muscles of Metal
      </text>
      <text className="poster-title" x={114} y={222} fill={C.mist} fontFamily={SANS} fontSize={26} letterSpacing={6}>
        ROBOT HANDS · FILM 3
      </text>
      <Vignette />
    </g>
  )
}
