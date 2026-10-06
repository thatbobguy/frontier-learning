import { CineDefs } from '../../../cine/defs'
import type { FlowLesson } from '../../../flow/types'
import { AUDIENCE } from '../shared/meta'
import { placeholder } from './Placeholder'
import { Poster } from './Poster'

export const dataGap: FlowLesson = {
  id: 'data-gap',
  title: 'The Missing Internet',
  tagline: 'Language models learned from trillions of words people had already written down. Robots have nothing like that. Why, and how big the gap really is.',
  age: 'Teens and adults',
  minutes: 8,
  chapters: [placeholder],
  Poster,
  Defs: CineDefs,
  look: 'cine',
  audience: AUDIENCE,
  course: 'robot-hands',
}
