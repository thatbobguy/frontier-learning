import { C, SANS, SERIF } from '../../../cine/palette'
import { Blueprint, Vignette } from '../shared/kit'

/** Start screen. (A placeholder until the film's own poster is drawn.) */
export function Poster() {
  return (
    <g>
      <Blueprint />
      <text x={110} y={170} fill={C.paper} fontFamily={SERIF} fontSize={92} fontWeight={600} letterSpacing={-1}>
        The Sense of Touch
      </text>
      <text x={114} y={222} fill={C.mist} fontFamily={SANS} fontSize={26} letterSpacing={6}>
        ROBOT HANDS · FILM 4
      </text>
      <Vignette />
    </g>
  )
}
