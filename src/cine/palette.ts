/**
 * The cinema palette for the robot hands course: inky night interiors lit by one warm key
 * light and one cool rim light, like a film shot after dark.
 *
 * Colours carry meaning across every film in the course and never swap roles:
 * - amber: force and actuation (motors, torque, muscle)
 * - cyan: motion and transmission (tendons, linkages, kinematics)
 * - magenta: touch and sensing
 * - lime: data, learning and control
 * - gold: cost and manufacturing
 * - bone: structure (bones, links, the frame itself)
 */
export const C = {
  // Darks, deepest first
  ink: '#05070d',
  ink1: '#0a0f1a',
  ink2: '#101827',
  ink3: '#172235',
  ink4: '#22304a',
  slate: '#34445f',
  fog: '#5b6b88',
  mist: '#9fb0cc',
  paper: '#e8ecf3',
  white: '#ffffff',

  // Key light (warm) and rim light (cool)
  key: '#ffb35c',
  keyLight: '#ffd9a0',
  keyDeep: '#d9772b',
  rim: '#7fe7ff',
  rimDeep: '#2aa9d6',

  // Meaning colours
  amber: '#ff9a3c',
  amberLight: '#ffc98f',
  amberDark: '#c4621a',
  cyan: '#3fd8ff',
  cyanLight: '#a6efff',
  cyanDark: '#1690c0',
  magenta: '#ff4fb0',
  magentaLight: '#ff9ed3',
  magentaDark: '#c2237f',
  lime: '#b6f03c',
  limeLight: '#dcff95',
  limeDark: '#76b015',
  gold: '#ffd24a',
  goldLight: '#ffe9a3',
  goldDark: '#c99a17',
  bone: '#efe6d6',
  boneDark: '#b9ab95',
  danger: '#ff5a4f',

  // Materials
  shell: '#e9edf2',
  shellMid: '#c3cbd6',
  shellDark: '#7d889a',
  metal: '#a9b4c4',
  metalDark: '#4d586b',
  rubber: '#1b2230',
  carbon: '#262c38',

  // People
  skinA: '#e8b48f',
  skinADark: '#b47a5a',
  skinB: '#b97c55',
  skinBDark: '#86512f',
  skinC: '#7a4a2e',
  skinCDark: '#4f2c18',
  hairDark: '#16110f',
  hairBrown: '#4a2c1c',
  hairGrey: '#8d8a87',
} as const

export type CineColor = keyof typeof C

/** Display type for titles, and a clean technical face for labels and numbers. */
export const SERIF = "'Fraunces', 'Georgia', serif"
export const SANS = "'Space Grotesk', 'Inter', system-ui, sans-serif"
export const MONO = "'JetBrains Mono', ui-monospace, monospace"
