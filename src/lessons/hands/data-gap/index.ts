import { CineDefs } from '../../../cine/defs'
import type { FlowLesson } from '../../../flow/types'
import { AUDIENCE } from '../shared/meta'
import { ch1 } from './Ch1Policy'
import { ch2 } from './Ch2Scale'
import { ch3 } from './Ch3Hour'
import { ch4 } from './Ch4Map'
import { Poster } from './Poster'

export const dataGap: FlowLesson = {
  id: 'data-gap',
  title: 'The Missing Internet',
  tagline: 'Language models learned from trillions of words people had already written down. Robots have nothing like that. Why, and how big the gap really is.',
  age: 'Teens and adults',
  minutes: 8,
  chapters: [ch1, ch2, ch3, ch4],
  Poster,
  Defs: CineDefs,
  look: 'cine',
  audience: AUDIENCE,
  course: 'robot-hands',
}
