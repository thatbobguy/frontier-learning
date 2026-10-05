/**
 * The lesson's own colour set: warm, flat and friendly. Art uses these as inline
 * SVG attributes (never CSS classes) so the tutor's snapshot of the stage keeps its colours.
 */
export const C = {
  ink: '#2B2D42',
  inkSoft: '#4A4E69',
  cream: '#FFF6E5',
  paper: '#FDF1DC',
  white: '#FFFFFF',

  skyDay: '#8ED3EE',
  skyDayLow: '#D3F0F7',
  skyDusk: '#F7A86B',
  skyDuskLow: '#FCD7A1',
  skyNight: '#1D2552',
  skyNightLow: '#39407A',
  star: '#FFF3B0',
  moon: '#FFF1C9',

  sun: '#FFC94A',
  sunGlow: '#FFE39A',

  grass: '#7CC36E',
  grassDark: '#55A25E',
  grassLight: '#A6DB8A',
  hillFar: '#9FD38C',
  hillNight: '#2F5E5A',
  hillNightFar: '#2A4A63',

  stone: '#A9ADBC',
  stoneDark: '#7D8293',
  stoneLight: '#CDD0DA',

  wood: '#C08347',
  woodDark: '#8F5A2B',
  woodLight: '#DCA66B',

  wool: '#FBFAF5',
  woolShade: '#E4E1D6',
  sheepFace: '#3E3F55',

  coral: '#FF7A5C',
  coralDark: '#E0563A',
  berry: '#E84A72',
  teal: '#2BB3A3',
  tealDark: '#1E8C80',
  violet: '#7B61FF',
  violetDark: '#5A43D6',
  mustard: '#F2B134',
  mustardDark: '#D0901A',
  sky: '#4AA8E8',
  skyDark: '#2F86C4',
  leaf: '#3FAE6A',

  clay: '#D98E5F',
  clayDark: '#B06A3F',
  bone: '#F1E6CF',
  boneDark: '#D6C6A5',

  shadow: 'rgba(43, 45, 66, 0.18)',
} as const

/** The four big questions each get one colour, used everywhere that branch appears. */
export const BRANCH_COLORS = {
  howMany: C.coral,
  change: C.teal,
  next: C.violet,
  shape: C.mustard,
} as const

export const FONT = "'Baloo 2', 'Nunito', system-ui, sans-serif"
