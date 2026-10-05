import { Glow, Motes, Vignette } from '../../art2/fx'
import { N } from '../../art2/palette'
import { Sack, Scale, Weight, weightSpots } from '../../art2/props'
import { BaghdadCity } from './art'

/** The start screen and library card: Baghdad at night, with the level scale holding the mystery sack. */
export function AlgebraPoster() {
  return (
    <g>
      <BaghdadCity />
      <rect x={0} y={0} width={1600} height={900} fill={N.space} opacity={0.15} />
      <Glow x={1150} y={560} r={420} color="teal" opacity={0.45} />
      <g transform="translate(1150 860) scale(0.92)">
        <Scale
          left={
            <>
              <Sack x={-62} />
              {weightSpots(3, 3).map(([x, y], i) => (
                <Weight key={i} x={x + 62} y={y} s={0.9} />
              ))}
            </>
          }
          right={weightSpots(11, 5).map(([x, y], i) => (
            <Weight key={i} x={x} y={y} s={0.9} />
          ))}
        />
      </g>
      <Motes count={22} seed={5} />
      <Vignette />
    </g>
  )
}
