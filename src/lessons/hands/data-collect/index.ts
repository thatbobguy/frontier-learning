import { CineDefs } from '../../../cine/defs'
import type { FlowLesson } from '../../../flow/types'
import { AUDIENCE } from '../shared/meta'
import { ch1 } from './Ch1Teleop'
import { ch2 } from './Ch2Wearables'
import { ch3 } from './Ch3VideoSim'
import { ch4 } from './Ch4Budget'
import { Poster } from './Poster'

export const dataCollect: FlowLesson = {
  id: 'data-collect',
  title: 'Ways to Get Data',
  tagline: 'Puppets, gloves, head cameras, simulators and fleets: how each one works, what it costs, and what it gets wrong.',
  age: 'Teens and adults',
  minutes: 10,
  chapters: [ch1, ch2, ch3, ch4],
  Poster,
  Defs: CineDefs,
  look: 'cine',
  audience: AUDIENCE,
  course: 'robot-hands',
}
