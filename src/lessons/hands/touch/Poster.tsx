import { GRASPS, Hand3D, makeHandStore, type HandPose } from '../../../cine/hand3d'
import { C, SANS, SERIF } from '../../../cine/palette'
import { Dust, Egg, Pool, Vignette } from '../shared/kit'

/** The hold from chapter 4: fingertips just touching the egg, glowing where they feel it. */
const HOLD: HandPose = { ...GRASPS.claw, index: [33, 32, 21, 0], middle: [33, 32, 21, 0], ring: [32, 31, 21, 0], little: [32, 31, 21, 0] }
const hand = makeHandStore({ pose: HOLD, view: { yaw: 82, pitch: -6, roll: 180, s: 2.05 } })
Object.assign(hand.state.touch, { thumb: 0.8, index: 0.8, middle: 0.7, ring: 0.5, little: 0.4 })

const EGG = { x: 1110, y: 640 }

/** Start screen: the robot hand from film 1 holding the egg, its fingertips lit magenta. */
export function Poster() {
  return (
    <g>
      <rect x={0} y={0} width={1600} height={900} fill={C.ink1} />
      <g filter="url(#cn-dof-3)" opacity={0.7}>
        <rect x={-60} y={300} width={300} height={500} fill={C.ink3} />
        <circle cx={1480} cy={180} r={40} fill={C.rim} opacity={0.35} />
        <circle cx={420} cy={420} r={30} fill={C.key} opacity={0.25} />
      </g>
      <Pool x={EGG.x} y={600} r={620} color="key" opacity={0.95} />
      <rect x={0} y={730} width={1600} height={170} fill={C.ink2} />
      <rect x={0} y={730} width={1600} height={5} fill={C.keyDeep} opacity={0.6} />
      <ellipse cx={EGG.x} cy={740} rx={520} ry={44} fill={C.key} opacity={0.18} filter="url(#cn-dof-2)" />
      <Pool x={EGG.x - 40} y={EGG.y - 10} r={240} color="magenta" opacity={0.35} />
      <Egg x={EGG.x} y={EGG.y + 4} s={2.3} />
      <Hand3D store={hand} x={EGG.x + 40} y={190 + 200 - 60} look="robot" arm={460} light={[0.8, -0.5]} />
      <Dust x={600} y={80} w={1000} h={600} count={18} seed={4} />
      <text className="poster-title" x={110} y={170} fill={C.paper} fontFamily={SERIF} fontSize={92} fontWeight={600} letterSpacing={-1}>
        The Sense of Touch
      </text>
      <text className="poster-title" x={114} y={222} fill={C.mist} fontFamily={SANS} fontSize={26} letterSpacing={6}>
        ROBOT HANDS · FILM 4
      </text>
      <Vignette />
    </g>
  )
}
