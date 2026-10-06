import { CineDefs } from '../../../cine/defs'
import type { FlowLesson } from '../../../flow/types'
import { AUDIENCE } from '../shared/meta'
import { ch1 } from './Ch1Motors'
import { ch2 } from './Ch2Gears'
import { ch3 } from './Ch3Placement'
import { ch4 } from './Ch4Camps'
import { Poster } from './Poster'

export const handsMuscle: FlowLesson = {
  id: 'hands-muscle',
  title: 'Muscles of Metal',
  tagline: 'Why small motors are weak, the bargain every gearbox makes, the friction that eats tendons, and the three camps of hand design.',
  age: 'Teens and adults',
  minutes: 10,
  chapters: [ch1, ch2, ch3, ch4],
  Poster,
  Defs: CineDefs,
  look: 'cine',
  audience: AUDIENCE,
  course: 'robot-hands',
}
