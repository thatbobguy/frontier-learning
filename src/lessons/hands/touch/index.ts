import { CineDefs } from '../../../cine/defs'
import type { FlowLesson } from '../../../flow/types'
import { AUDIENCE } from '../shared/meta'
import { ch1 } from './Ch1Numb'
import { ch2 } from './Ch2Proprio'
import { ch3 } from './Ch3Skins'
import { ch4 } from './Ch4Egg'
import { Poster } from './Poster'

export const handsTouch: FlowLesson = {
  id: 'hands-touch',
  title: 'The Sense of Touch',
  tagline: 'What happens to a hand that can’t feel, the four kinds of touch in your skin, the ways engineers fake them, and why robot skin wears out.',
  age: 'Teens and adults',
  minutes: 9,
  chapters: [ch1, ch2, ch3, ch4],
  Poster,
  Defs: CineDefs,
  look: 'cine',
  audience: AUDIENCE,
  course: 'robot-hands',
}
