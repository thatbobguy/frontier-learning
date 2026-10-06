import { GRASPS, Hand3D, makeHandStore } from '../../../cine/hand3d'
import { C, SANS, SERIF } from '../../../cine/palette'
import { POSES, Robot } from '../../../cine/people'
import { Egg, Pool, Vignette } from '../shared/kit'
import { LabFloor, LabSky, LabWall } from '../shared/sets'

const hand = makeHandStore({ pose: GRASPS.power, view: { yaw: 64, pitch: -8, roll: 180, s: 2.1 } })

/** Start screen: Seven in the dark lab, its hand closing on an egg under the lamp. */
export function WhyPoster() {
  return (
    <g>
      <LabSky />
      <LabWall />
      <LabFloor />
      <Pool x={420} y={540} r={420} color="rim" opacity={0.45} />
      <Robot name="poster-seven" x={360} y={800} s={1.6} pose={POSES.lookDown} light="cool-left" />
      <Pool x={1100} y={640} r={560} color="key" opacity={0.95} />
      <rect x={600} y={760} width={1200} height={200} fill={C.ink2} />
      <rect x={600} y={760} width={1200} height={4} fill={C.keyDeep} opacity={0.6} />
      <Egg x={1080} y={714} s={1.6} />
      <Hand3D store={hand} x={1090} y={260} look="robot" arm={360} light={[0.8, -0.5]} />
      <text className="poster-title" x={110} y={170} fill={C.paper} fontFamily={SERIF} fontSize={92} fontWeight={600} letterSpacing={-1}>
        The Hardest Machine
      </text>
      <text className="poster-title" x={114} y={222} fill={C.mist} fontFamily={SANS} fontSize={26} letterSpacing={6}>
        ROBOT HANDS · FILM 1
      </text>
      <Vignette />
    </g>
  )
}
