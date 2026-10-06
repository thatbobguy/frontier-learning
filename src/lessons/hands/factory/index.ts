import { CineDefs } from '../../../cine/defs'
import type { FlowLesson } from '../../../flow/types'
import { AUDIENCE } from '../shared/meta'
import { ch1 } from './Ch1Scale'
import { ch2 } from './Ch2Tooling'
import { ch3 } from './Ch3Durability'
import { ch4 } from './Ch4Supply'
import { Poster } from './Poster'

export const handsFactory: FlowLesson = {
  id: 'hands-factory',
  title: 'A Million Hands',
  tagline: 'Why building one hand is easy and building a million is the hard part: tooling, part count, durability, and a supply chain that runs through China.',
  age: 'Teens and adults',
  minutes: 10,
  chapters: [ch1, ch2, ch3, ch4],
  Poster,
  Defs: CineDefs,
  look: 'cine',
  audience: AUDIENCE,
  course: 'robot-hands',
}
