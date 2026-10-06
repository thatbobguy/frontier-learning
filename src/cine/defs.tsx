import { C } from './palette'

/**
 * A light rig as an SVG filter. Applied to a flat-coloured group (a person, a robot hand,
 * a machine), it adds a crisp rim of light on the side facing the light and a soft core
 * shadow on the far side, so flat shapes read as solid, lit objects.
 *
 * `dx, dy` point FROM the light (e.g. light at the upper left: dx > 0, dy > 0).
 * Offsets are in the user space of the element the filter is on, so put the filter on a
 * group drawn at its natural size and scale the group's parent, not the group itself.
 */
function LightFilter({ id, dx, dy, rim, rimWidth = 3, rimOpacity = 1, shade = 0.6, shadeReach = 16, shadeSoft = 8, shadeColor = C.ink }: {
  id: string
  dx: number
  dy: number
  rim: string
  rimWidth?: number
  rimOpacity?: number
  shade?: number
  shadeReach?: number
  shadeSoft?: number
  shadeColor?: string
}) {
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  return (
    <filter id={id} x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
      {/* rim: the part of the shape that is not covered by itself shifted away from the light */}
      <feOffset in="SourceAlpha" dx={ux * rimWidth} dy={uy * rimWidth} result="rimOff" />
      <feComposite in="SourceAlpha" in2="rimOff" operator="out" result="rimEdge" />
      <feGaussianBlur in="rimEdge" stdDeviation={0.7} result="rimSoft" />
      <feFlood floodColor={rim} floodOpacity={rimOpacity} result="rimInk" />
      <feComposite in="rimInk" in2="rimSoft" operator="in" result="rimLit" />
      {/* core shadow: the far side, softened and kept inside the shape */}
      <feOffset in="SourceAlpha" dx={-ux * shadeReach} dy={-uy * shadeReach} result="shOff" />
      <feComposite in="SourceAlpha" in2="shOff" operator="out" result="shEdge" />
      <feGaussianBlur in="shEdge" stdDeviation={shadeSoft} result="shSoft" />
      <feComposite in="shSoft" in2="SourceAlpha" operator="in" result="shIn" />
      <feFlood floodColor={shadeColor} floodOpacity={shade} result="shInk" />
      <feComposite in="shInk" in2="shIn" operator="in" result="shade" />
      <feMerge>
        <feMergeNode in="SourceGraphic" />
        <feMergeNode in="shade" />
        <feMergeNode in="rimLit" />
      </feMerge>
    </filter>
  )
}

/** Names of the light rigs, for `filter={lit('key-left')}`. */
export type Light = 'key-left' | 'key-right' | 'cool-left' | 'cool-right' | 'top' | 'back' | 'screen' | 'soft-left' | 'soft-right'

export const lit = (l: Light) => `url(#cn-lit-${l})`

/**
 * Shared filters and gradients for the course. Rendered once per stage (each lesson's
 * `Defs`), so scenes can use them by id.
 */
export function CineDefs() {
  return (
    <defs>
      <LightFilter id="cn-lit-key-left" dx={1} dy={0.7} rim={C.keyLight} />
      <LightFilter id="cn-lit-key-right" dx={-1} dy={0.7} rim={C.keyLight} />
      <LightFilter id="cn-lit-cool-left" dx={1} dy={0.5} rim={C.rim} />
      <LightFilter id="cn-lit-cool-right" dx={-1} dy={0.5} rim={C.rim} />
      <LightFilter id="cn-lit-top" dx={0} dy={1} rim={C.keyLight} shade={0.5} />
      <LightFilter id="cn-lit-back" dx={0} dy={0.25} rim={C.rim} rimWidth={4} shade={0.75} shadeReach={30} shadeSoft={14} />
      <LightFilter id="cn-lit-screen" dx={-1} dy={0.1} rim={C.cyanLight} rimWidth={2.5} shade={0.65} />
      <LightFilter id="cn-lit-soft-left" dx={1} dy={0.7} rim={C.keyLight} rimWidth={2} rimOpacity={0.7} shade={0.35} />
      <LightFilter id="cn-lit-soft-right" dx={-1} dy={0.7} rim={C.rim} rimWidth={2} rimOpacity={0.7} shade={0.35} />

      {/* Depth of field: things far behind or right in front of the lens go soft. */}
      <filter id="cn-dof-1" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation={2.5} />
      </filter>
      <filter id="cn-dof-2" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation={6} />
      </filter>
      <filter id="cn-dof-3" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation={14} />
      </filter>
      {/* Light that blooms past its edges: screens, LEDs, hot wires. */}
      <filter id="cn-bloom" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation={6} result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="cn-bloom-big" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur in="SourceGraphic" stdDeviation={16} result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Pools of light and dark */}
      <radialGradient id="cn-pool-key">
        <stop offset="0" stopColor={C.key} stopOpacity="0.55" />
        <stop offset="0.45" stopColor={C.key} stopOpacity="0.16" />
        <stop offset="1" stopColor={C.key} stopOpacity="0" />
      </radialGradient>
      <radialGradient id="cn-pool-rim">
        <stop offset="0" stopColor={C.rim} stopOpacity="0.45" />
        <stop offset="0.5" stopColor={C.rim} stopOpacity="0.12" />
        <stop offset="1" stopColor={C.rim} stopOpacity="0" />
      </radialGradient>
      {(['amber', 'cyan', 'magenta', 'lime', 'gold', 'danger', 'paper'] as const).map((c) => (
        <radialGradient key={c} id={`cn-pool-${c}`}>
          <stop offset="0" stopColor={C[c]} stopOpacity="0.6" />
          <stop offset="0.4" stopColor={C[c]} stopOpacity="0.18" />
          <stop offset="1" stopColor={C[c]} stopOpacity="0" />
        </radialGradient>
      ))}
      <radialGradient id="cn-pool-dark">
        <stop offset="0" stopColor={C.ink} stopOpacity="0.7" />
        <stop offset="1" stopColor={C.ink} stopOpacity="0" />
      </radialGradient>
      {/* A cone of light from a lamp: bright at the top, fading down. */}
      <linearGradient id="cn-beam-key" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={C.keyLight} stopOpacity="0.5" />
        <stop offset="0.6" stopColor={C.key} stopOpacity="0.12" />
        <stop offset="1" stopColor={C.key} stopOpacity="0" />
      </linearGradient>
      <linearGradient id="cn-beam-rim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={C.cyanLight} stopOpacity="0.4" />
        <stop offset="0.6" stopColor={C.rim} stopOpacity="0.1" />
        <stop offset="1" stopColor={C.rim} stopOpacity="0" />
      </linearGradient>
      <linearGradient id="cn-beam-white" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={C.white} stopOpacity="0.35" />
        <stop offset="1" stopColor={C.white} stopOpacity="0" />
      </linearGradient>
      {/* Rooms: a dark wall that is a little lighter where the key light falls */}
      <linearGradient id="cn-wall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={C.ink} />
        <stop offset="0.7" stopColor={C.ink2} />
        <stop offset="1" stopColor={C.ink3} />
      </linearGradient>
      <linearGradient id="cn-floor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={C.ink3} />
        <stop offset="1" stopColor={C.ink} />
      </linearGradient>
      <linearGradient id="cn-sky-night" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#03050b" />
        <stop offset="0.6" stopColor="#0d1830" />
        <stop offset="1" stopColor="#1d2f4f" />
      </linearGradient>
      <linearGradient id="cn-sky-dawn" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#0b1222" />
        <stop offset="0.55" stopColor="#3a3150" />
        <stop offset="0.85" stopColor="#c46a4a" />
        <stop offset="1" stopColor="#f2a65e" />
      </linearGradient>
      <radialGradient id="cn-vignette" cx="0.5" cy="0.5" r="0.72">
        <stop offset="0.55" stopColor={C.ink} stopOpacity="0" />
        <stop offset="1" stopColor={C.ink} stopOpacity="0.8" />
      </radialGradient>
      <linearGradient id="cn-fade-up" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor={C.ink} stopOpacity="0.95" />
        <stop offset="1" stopColor={C.ink} stopOpacity="0" />
      </linearGradient>
      <linearGradient id="cn-fade-down" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={C.ink} stopOpacity="0.95" />
        <stop offset="1" stopColor={C.ink} stopOpacity="0" />
      </linearGradient>
      {/* Shells and metal: a soft sheen from the upper left */}
      <linearGradient id="cn-shell" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={C.white} />
        <stop offset="0.5" stopColor={C.shell} />
        <stop offset="1" stopColor={C.shellMid} />
      </linearGradient>
      <linearGradient id="cn-metal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#dfe6ef" />
        <stop offset="0.45" stopColor={C.metal} />
        <stop offset="0.55" stopColor="#8592a6" />
        <stop offset="1" stopColor={C.metalDark} />
      </linearGradient>
      <linearGradient id="cn-copper" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffd2a1" />
        <stop offset="0.5" stopColor="#d2843f" />
        <stop offset="1" stopColor="#7a3d14" />
      </linearGradient>
      {/* Blueprint grid for diagrams and the design lab */}
      <pattern id="cn-grid" width={40} height={40} patternUnits="userSpaceOnUse">
        <path d="M40 0 H0 V40" fill="none" stroke={C.cyan} strokeOpacity={0.09} strokeWidth={1} />
      </pattern>
      <pattern id="cn-grid-big" width={200} height={200} patternUnits="userSpaceOnUse">
        <rect width={200} height={200} fill="url(#cn-grid)" />
        <path d="M200 0 H0 V200" fill="none" stroke={C.cyan} strokeOpacity={0.18} strokeWidth={1.2} />
      </pattern>
      <pattern id="cn-hatch" width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <path d="M0 0 V8" stroke={C.mist} strokeOpacity={0.35} strokeWidth={1.5} />
      </pattern>
      <marker id="cn-arrow" viewBox="0 0 10 10" refX={7} refY={5} markerWidth={5} markerHeight={5} orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 Z" fill="context-stroke" />
      </marker>
    </defs>
  )
}
