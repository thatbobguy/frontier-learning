/*
 * The five robot fingertip skins of film 4, drawn as display modules standing on a shelf,
 * and the facts the choose play needs about them.
 */
import { C, MONO, SANS } from '../../../cine/palette'

export type Kind = 'res' | 'cap' | 'piezo' | 'mag' | 'gel'
export const KINDS: Kind[] = ['res', 'cap', 'piezo', 'mag', 'gel']

export const SKIN: Record<Kind, { name: string; plus: string[]; minus: string[] }> = {
  res: { name: 'resistive', plus: ['cheap', 'covers big areas'], minus: ['no shear', 'drifts and wears'] },
  cap: { name: 'capacitive', plus: ['sensitive', 'fast'], minus: ['electrical noise', 'water fools it'] },
  piezo: { name: 'piezo film', plus: ['very fast: kHz', 'cheap'], minus: ['no steady push'] },
  mag: { name: 'magnetic', plus: ['feels shear', 'fast enough', 'skin swaps in 12 s'], minus: ['stray magnets fool it'] },
  gel: { name: 'camera gel', plus: ['finest detail'], minus: ['slow: 30-60 fps', 'bulky', 'gel tears'] },
}

export type Job = 'slip' | 'key' | 'palm'
export const JOB_LIST: Job[] = ['slip', 'key', 'palm']

export const JOBS: Record<Job, { title: [string, string]; ok: Kind[]; verdict: Record<Kind, string> }> = {
  slip: {
    title: ['Catch a glass the instant', 'it starts to slip'],
    ok: ['piezo', 'mag'],
    verdict: {
      res: 'no shear sense: felt it too late',
      cap: 'motor noise hid the slip',
      piezo: 'caught it within milliseconds',
      mag: 'felt the shear, squeezed in time',
      gel: '30 frames a second: saw it too late',
    },
  },
  key: {
    title: ['Read the shape of a key', 'by feel'],
    ok: ['gel'],
    verdict: {
      res: 'a blurry blob',
      cap: 'a few fuzzy blobs',
      piezo: 'felt the tap, then nothing',
      mag: 'knows where, not the teeth',
      gel: 'every tooth, crisp',
    },
  },
  palm: {
    title: ['Cover a whole palm cheaply,', 'and survive scrubbing dishes'],
    ok: ['res', 'mag'],
    verdict: {
      res: 'cheap grid, easy to replace',
      cap: 'water and noise confuse it',
      piezo: 'can’t feel a resting plate',
      mag: 'worn skin swaps in 12 s',
      gel: 'too bulky, and the gel tears',
    },
  },
}

/**
 * A fingertip module standing on a little plinth, tip up, base centre at (0, 0), about
 * 180 wide and 320 tall. The dome is cut away to show the sensing trick inside. Classes on
 * the moving parts (prefix `sk-`) let a timeline animate them.
 */
export function SensorTip({ kind, lit = false }: { kind: Kind; lit?: boolean }) {
  const body = 'M-90 0 V-230 A90 90 0 0 1 90 -230 V0 Z'
  return (
    <g>
      <ellipse cx={0} cy={6} rx={110} ry={12} fill="#000" opacity={0.5} filter="url(#cn-dof-1)" />
      <rect x={-74} y={-14} width={148} height={20} rx={4} fill={C.ink3} />
      <path d={body} fill="url(#cn-shell)" />
      <rect x={-76} y={-220} width={22} height={200} rx={10} fill={C.white} opacity={0.5} />
      <path d="M90 -230 V0 H60 V-230 A60 60 0 0 0 60 -235 Z" fill={C.shellDark} opacity={0.35} />
      {/* the cutaway window in the dome */}
      <path d="M-78 -228 A78 78 0 0 1 78 -228 V-160 H-78 Z" fill={C.ink1} stroke={C.cyan} strokeWidth={2} strokeOpacity={0.7} />
      <g opacity={lit ? 1 : 0.85}>{inner(kind)}</g>
      {/* a joint line */}
      <rect x={-90} y={-120} width={180} height={8} fill={C.carbon} opacity={0.8} />
      <circle cx={0} cy={-60} r={14} fill={C.carbon} />
      <circle cx={0} cy={-60} r={5} fill={C.metal} />
    </g>
  )
}

function inner(kind: Kind) {
  if (kind === 'res') {
    return (
      <g>
        {/* a squishy layer with a row-and-column grid */}
        <path d="M-70 -232 A70 70 0 0 1 70 -232 V-200 H-70 Z" fill={C.magentaDark} opacity={0.25} />
        {[-56, -28, 0, 28, 56].map((x) => (
          <line key={`c${x}`} x1={x} x2={x} y1={x === 0 ? -296 : Math.abs(x) > 40 ? -254 : -284} y2={-176} stroke={C.mist} strokeWidth={1.6} opacity={0.6} />
        ))}
        {[-270, -244, -218, -192].map((y) => (
          <line key={`r${y}`} x1={-70} x2={70} y1={y} y2={y} stroke={C.mist} strokeWidth={1.6} opacity={0.6} />
        ))}
        <g className="sk-res-spot" opacity={0}>
          <rect x={-28} y={-244} width={28} height={26} fill={C.magenta} opacity={0.85} filter="url(#cn-bloom)" />
        </g>
        <g className="sk-res-press">
          <rect x={-24} y={-350} width={20} height={36} rx={6} fill={C.metal} />
          <rect x={-34} y={-322} width={40} height={10} rx={3} fill={C.metalDark} />
        </g>
      </g>
    )
  }
  if (kind === 'cap') {
    return (
      <g>
        <g className="sk-cap-field">
          {[-48, -24, 0, 24, 48].map((x) => (
            <line key={x} x1={x} x2={x} y1={-262} y2={-196} stroke={C.magentaLight} strokeWidth={1.6} strokeDasharray="4 4" opacity={0.7} />
          ))}
        </g>
        <g className="sk-cap-top">
          <rect x={-62} y={-272} width={124} height={8} rx={2} fill="url(#cn-copper)" />
        </g>
        <rect x={-62} y={-196} width={124} height={8} rx={2} fill="url(#cn-copper)" />
        <text x={0} y={-176} textAnchor="middle" fill={C.mist} fontFamily={MONO} fontSize={14}>
          gap
        </text>
        <g className="sk-cap-noise" opacity={0}>
          <path d="M-70 -232 l10 -10 l10 14 l10 -16 l10 12 l10 -14 l10 16 l10 -10 l10 12 l10 -12 l10 10 l10 -8 l10 10 l10 -6" fill="none" stroke={C.danger} strokeWidth={2} />
        </g>
      </g>
    )
  }
  if (kind === 'piezo') {
    return (
      <g>
        <path className="sk-piezo-film" d="M-70 -244 Q-35 -252 0 -244 T70 -244" fill="none" stroke={C.gold} strokeWidth={6} />
        <path d="M-70 -236 Q-35 -244 0 -236 T70 -236" fill="none" stroke={C.goldDark} strokeWidth={3} />
        <text x={-50} y={-262} fill={C.goldLight} fontFamily={MONO} fontSize={16}>
          +
        </text>
        <text x={40} y={-212} fill={C.goldLight} fontFamily={MONO} fontSize={16}>
          −
        </text>
        <g className="sk-piezo-tap">
          <circle cx={0} cy={-330} r={14} fill={C.metal} />
          <rect x={-4} y={-380} width={8} height={40} fill={C.metalDark} />
        </g>
      </g>
    )
  }
  if (kind === 'mag') {
    return (
      <g>
        <rect x={-64} y={-206} width={128} height={20} rx={3} fill={C.ink} stroke={C.magentaLight} strokeWidth={1.5} />
        <text x={0} y={-191} textAnchor="middle" fill={C.magentaLight} fontFamily={MONO} fontSize={12}>
          magnetometer chip
        </text>
        <g className="sk-mag-field">
          {[-40, -14, 14, 40].map((x) => (
            <path key={x} d={`M${x * 0.6} -250 Q${x} -228 ${x * 1.1} -208`} fill="none" stroke={C.magentaLight} strokeWidth={1.6} opacity={0.75} />
          ))}
        </g>
        <g className="sk-mag-cap">
          <g className="sk-mag-skew">
            <path d="M-78 -228 A78 78 0 0 1 78 -228 V-214 H-78 Z" fill={C.magentaDark} opacity={0.55} />
            <path d="M-78 -228 A78 78 0 0 1 78 -228" fill="none" stroke={C.magentaLight} strokeWidth={3} />
            <rect x={-16} y={-262} width={32} height={16} rx={2} fill={C.danger} />
            <rect x={-16} y={-262} width={16} height={16} rx={2} fill={C.rimDeep} />
          </g>
        </g>
      </g>
    )
  }
  return (
    <g>
      {/* a soft gel dome, lit from inside, a tiny camera looking up into it */}
      <path d="M-74 -232 A74 74 0 0 1 74 -232 V-224 H-74 Z" fill={C.magenta} opacity={0.18} />
      <path className="sk-gel-dent" d="M-74 -232 A74 74 0 0 1 74 -232" fill="none" stroke={C.magentaLight} strokeWidth={4} />
      <path d="M-14 -176 L-60 -280 M14 -176 L60 -280 M0 -176 V-298" stroke={C.cyanLight} strokeWidth={1.2} opacity={0.5} strokeDasharray="3 4" />
      <rect x={-22} y={-178} width={44} height={20} rx={4} fill={C.ink} stroke={C.cyan} strokeWidth={1.5} />
      <circle cx={0} cy={-178} r={8} fill={C.rimDeep} stroke={C.cyanLight} strokeWidth={1.5} />
      <g className="sk-gel-key" opacity={0}>
        <path d="M-60 -332 H40 V-322 L32 -312 L24 -322 L16 -310 L8 -322 L0 -314 L-8 -322 H-60 Z" fill={C.metal} stroke={C.metalDark} strokeWidth={1.5} />
      </g>
    </g>
  )
}

/** The magenta height map a camera skin "sees" when a key is pressed into it. */
export function KeyPrint({ x, y, w = 240, h = 120, crisp = true }: { x: number; y: number; w?: number; h?: number; crisp?: boolean }) {
  const teeth = [0, 1, 2, 3, 4, 5, 6]
  return (
    <g transform={`translate(${x} ${y})`} filter={crisp ? undefined : 'url(#cn-dof-2)'}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#14060f" />
      <path d={`M${-w * 0.42} ${-h * 0.12} H${w * 0.3} ${teeth.map((i) => `L${w * 0.3 - i * w * 0.1} ${h * (i % 2 ? 0.14 : 0.3)}`).join(' ')} L${-w * 0.42} ${h * 0.14} Z`} fill={C.magentaDark} />
      <path d={`M${-w * 0.42} ${-h * 0.12} H${w * 0.3} ${teeth.map((i) => `L${w * 0.3 - i * w * 0.1} ${h * (i % 2 ? 0.14 : 0.3)}`).join(' ')}`} fill="none" stroke={C.magentaLight} strokeWidth={2.5} />
      <circle cx={-w * 0.32} cy={0} r={h * 0.1} fill="#14060f" stroke={C.magentaLight} strokeWidth={2} />
      <text x={-w / 2 + 8} y={-h / 2 + 18} fill={C.magentaLight} fontFamily={SANS} fontSize={14} opacity={0.8}>
        height map
      </text>
    </g>
  )
}
