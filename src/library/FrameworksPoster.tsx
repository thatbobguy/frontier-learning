import { Person } from '../art2/characters'
import { Backdrop, Glow, Motes, Stars, Vignette } from '../art2/fx'
import { FONT2, N } from '../art2/palette'
import { Ground } from '../art2/scenery'

function Sheep({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cy={4} rx={50} ry={9} fill={N.shadow} opacity={0.3} />
      <rect x={-28} y={-26} width={9} height={28} rx={4} fill={N.night0} />
      <rect x={18} y={-26} width={9} height={28} rx={4} fill={N.night0} />
      {[-30, -10, 10, 30].map((cx, i) => (
        <circle key={i} cx={cx} cy={-46 + (i % 2) * -8} r={26} fill={N.cream} />
      ))}
      <ellipse cx={0} cy={-38} rx={48} ry={26} fill={N.cream} />
      <ellipse cx={8} cy={-30} rx={38} ry={16} fill={N.sandLight} opacity={0.6} />
      <ellipse cx={-52} cy={-48} rx={16} ry={20} fill={N.night1} />
      <circle cx={-56} cy={-52} r={3} fill={N.white} />
    </g>
  )
}

/** Library card picture for the first lesson: a shepherd counting sheep with tally marks under the stars. */
export function FrameworksPoster() {
  return (
    <g>
      <Backdrop kind="dusk">
        <Stars h={520} count={90} seed={4} />
      </Backdrop>
      <Ground y={700} color={N.night1} rim={N.night2} />
      <Glow x={1080} y={480} r={360} color="warm" opacity={0.5} />
      {/* a standing stone with glowing tally marks */}
      <g transform="translate(1080 700)">
        <path d="M-120 0 Q-130 -230 -40 -280 Q60 -300 110 -220 Q140 -120 120 0 Z" fill={N.stone} />
        <path d="M40 -290 Q120 -260 130 -160 Q140 -80 120 0 H60 Q90 -150 40 -290 Z" fill={N.stoneDark} />
        {[-70, -40, -10, 20].map((tx) => (
          <rect key={tx} x={tx} y={-210} width={12} height={110} rx={6} fill={N.goldLight} />
        ))}
        <rect x={-92} y={-162} width={140} height={12} rx={6} transform="rotate(-24 -22 -156)" fill={N.goldLight} />
      </g>
      {/* numbers rising like sparks */}
      {[
        ['1', 980, 250, 64],
        ['2', 1110, 190, 72],
        ['3', 1240, 260, 60],
        ['10', 1360, 170, 54],
      ].map(([t, x, y, size]) => (
        <text key={t} x={x} y={y} textAnchor="middle" fontFamily={FONT2} fontWeight={800} fontSize={size} fill={N.gold} filter="url(#fx-glow)">
          {t}
        </text>
      ))}
      <Person x={760} y={760} s={1.25} head="hair" headColor={N.night0} robe={N.sky} robeLight={N.skyLight} robeDark={N.skyDark} pose="point" />
      <Sheep x={420} y={760} />
      <Sheep x={250} y={800} s={0.9} />
      <Sheep x={560} y={830} s={1.05} />
      <Motes count={18} seed={9} />
      <Vignette />
    </g>
  )
}
