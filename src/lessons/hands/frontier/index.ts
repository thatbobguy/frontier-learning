import { CineDefs } from '../../../cine/defs'
import type { FlowLesson } from '../../../flow/types'
import { AUDIENCE } from '../shared/meta'
import { ch1 } from './Ch1Control'
import { ch2 } from './Ch2Industry'
import { ch3 } from './Ch3Design'
import { ch4 } from './Ch4Open'
import { Poster } from './Poster'

export const handsFrontier: FlowLesson = {
  id: 'hands-frontier',
  title: 'Build Your Own Hand',
  tagline: 'How a hand is controlled, who is building what in 2026, the problems nobody has solved, and your turn to design a hand for a real customer.',
  age: 'Teens and adults',
  minutes: 11,
  chapters: [ch1, ch2, ch3, ch4],
  Poster,
  Defs: CineDefs,
  look: 'cine',
  audience: AUDIENCE,
  course: 'robot-hands',
}
