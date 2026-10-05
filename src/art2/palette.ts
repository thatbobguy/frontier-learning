/**
 * The night palette: deep blue-violet backgrounds with bright, saturated subjects,
 * each colour in three tones (light for the lit side, base, dark for the shaded side).
 *
 * In the algebra lesson the colours carry meaning and never swap roles:
 * pink is the unknown (x), gold is a known number, teal is balance and the equals sign.
 */

export const N = {
  // Backgrounds, darkest to lightest
  space: '#070b24',
  night0: '#0c1235',
  night1: '#141d52',
  night2: '#1f2a6e',
  night3: '#2d3a8c',
  dusk: '#53398f',
  plum: '#7a3d8e',
  haze: '#b05a9b',

  white: '#ffffff',
  cream: '#fff4de',
  mist: '#c9d3ff',
  shadow: '#050820',

  gold: '#ffc23d',
  goldLight: '#ffe38f',
  goldDark: '#e0901c',

  pink: '#ff4f9a',
  pinkLight: '#ff93c4',
  pinkDark: '#c4246c',

  teal: '#2fe0c0',
  tealLight: '#9af7e4',
  tealDark: '#139e86',

  coral: '#ff6b57',
  coralLight: '#ffa08f',
  coralDark: '#cf4330',

  sky: '#4fa8ff',
  skyLight: '#a3d3ff',
  skyDark: '#2667cc',

  violet: '#8f6bff',
  violetLight: '#bfaaff',
  violetDark: '#5a3cd0',

  leaf: '#46d17c',
  leafLight: '#97f0b5',
  leafDark: '#1f9a54',

  sand: '#e9b872',
  sandLight: '#f8d9a2',
  sandDark: '#b98543',

  stone: '#8e86b8',
  stoneLight: '#bdb6e0',
  stoneDark: '#5c5590',

  wood: '#a8653b',
  woodLight: '#cf8a57',
  woodDark: '#734024',

  brass: '#f0b43c',
  brassLight: '#ffe08a',
  brassDark: '#b9771b',

  skin1: '#f3c39a',
  skin1Dark: '#d9a173',
  skin2: '#c98b5e',
  skin2Dark: '#a96d43',
  skin3: '#8d5a3b',
  skin3Dark: '#6c4129',
} as const

/** Light, base and dark tones of one colour. */
export interface Tones {
  light: string
  base: string
  dark: string
}

export const tones = (name: 'gold' | 'pink' | 'teal' | 'coral' | 'sky' | 'violet' | 'leaf' | 'sand' | 'stone' | 'wood' | 'brass'): Tones => ({
  light: N[`${name}Light`],
  base: N[name],
  dark: N[`${name}Dark`],
})

export const FONT2 = "'Baloo 2', 'Nunito', system-ui, sans-serif"
