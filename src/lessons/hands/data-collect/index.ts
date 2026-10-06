import { CineDefs } from '../../../cine/defs'
import type { FlowLesson } from '../../../flow/types'
import { AUDIENCE } from '../shared/meta'
import { placeholder } from './Placeholder'
import { Poster } from './Poster'

export const dataCollect: FlowLesson = {
  id: 'data-collect',
  title: 'Ways to Get Data',
  tagline: 'Puppets, gloves, head cameras, simulators and fleets: how each one works, what it costs, and what it gets wrong.',
  age: 'Teens and adults',
  minutes: 10,
  chapters: [placeholder],
  Poster,
  Defs: CineDefs,
  look: 'cine',
  audience: AUDIENCE,
  course: 'robot-hands',
}
