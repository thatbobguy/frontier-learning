import { CineDefs } from '../../../cine/defs'
import type { FlowLesson } from '../../../flow/types'
import { AUDIENCE } from '../shared/meta'
import { placeholder } from './Placeholder'
import { Poster } from './Poster'

export const handsMuscle: FlowLesson = {
  id: 'hands-muscle',
  title: 'Muscles of Metal',
  tagline: 'Why small motors are weak, the bargain every gearbox makes, the friction that eats tendons, and the three camps of hand design.',
  age: 'Teens and adults',
  minutes: 10,
  chapters: [placeholder],
  Poster,
  Defs: CineDefs,
  look: 'cine',
  audience: AUDIENCE,
  course: 'robot-hands',
}
