import { Glow, Motes, Vignette } from '../../art2/fx'
import { FONT2, N } from '../../art2/palette'
import { Ama, Bag, GROUND_Y, Pebble, Pen, Sheep, Valley } from './art'

/** Start screen and library card: Ama at dusk, a pebble for every sheep coming home, and the first numbers rising like sparks. */
export function FrameworksPoster() {
  return (
    <g>
      <Valley time="dusk" />
      <Pen x={1420} y={GROUND_Y + 6} w={420} />
      <Glow x={1180} y={540} r={380} color="warm" opacity={0.45} />
      {/* numbers rising like sparks */}
      {[
        ['1', 1230, 320, 64],
        ['2', 1330, 240, 72],
        ['3', 1430, 310, 60],
        ['10', 1520, 210, 54],
      ].map(([t, x, y, size]) => (
        <text key={t} x={x} y={y} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={size} fill={N.gold} filter="url(#fx-glow)">
          {t}
        </text>
      ))}
      <Sheep x={640} y={GROUND_Y + 60} s={1.05} flip />
      <Sheep x={810} y={GROUND_Y + 100} s={1.15} flip />
      <Sheep x={500} y={GROUND_Y + 110} s={0.95} flip />
      <Ama x={1040} y={GROUND_Y + 70} s={1.15} />
      <Bag x={1200} y={GROUND_Y + 80} open />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <Glow x={1280 + i * 52} y={GROUND_Y + 66} r={36} color="warm" opacity={0.6} />
          <Pebble x={1280 + i * 52} y={GROUND_Y + 66} seed={i} s={1.2} />
        </g>
      ))}
      <Motes count={14} seed={9} />
      <Vignette />
    </g>
  )
}
