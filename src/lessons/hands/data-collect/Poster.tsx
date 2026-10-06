import { C, SANS, SERIF } from '../../../cine/palette'
import { POSES, Person, Robot } from '../../../cine/people'
import { Dust, Pool, Vignette } from '../shared/kit'
import { LabFloor, LabSky, LabWall } from '../shared/sets'
import { KOFI, SourceIcon } from './common'

/** Start screen: Kofi in his headset raises a hand, and across the room Seven copies him; the lime line between them is the data. */
export function Poster() {
  return (
    <g>
      <LabSky />
      <LabWall />
      <LabFloor />
      <Pool x={820} y={560} r={420} color="key" opacity={0.8} />
      <Pool x={1360} y={560} r={420} color="rim" opacity={0.55} />
      <Person name="poster-kofi" x={830} y={880} s={1.55} pose={POSES.present} light="key-right" {...KOFI} />
      <circle cx={830 + 66 * (1.55 / 2.3)} cy={880 - 288 * 1.55} r={14} fill={C.cyan} opacity={0.5} filter="url(#cn-bloom-big)" />
      <Robot name="poster-seven" x={1400} y={880} s={1.55} flip pose={POSES.present} light="cool-left" />
      <path d="M985 560 C 1060 500, 1180 500, 1250 560" fill="none" stroke={C.lime} strokeWidth={4} strokeDasharray="2 12" strokeLinecap="round" filter="url(#cn-bloom)" />
      {(['teleop', 'glove', 'video', 'sim', 'fleet'] as const).map((k, i) => (
        <g key={k} transform={`translate(${970 + i * 74} ${420 - Math.sin((i / 4) * Math.PI) * 30}) scale(0.62)`}>
          <SourceIcon kind={k} />
        </g>
      ))}
      <Dust x={0} y={0} w={1600} h={900} count={30} seed={3} color={C.keyLight} size={0.7} />
      <text x={110} y={170} fill={C.paper} fontFamily={SERIF} fontSize={92} fontWeight={600} letterSpacing={-1}>
        Ways to Get Data
      </text>
      <text x={114} y={222} fill={C.mist} fontFamily={SANS} fontSize={26} letterSpacing={6}>
        ROBOT HANDS · DATA 2
      </text>
      <Vignette />
    </g>
  )
}
