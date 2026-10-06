import { CineDefs } from '../../../cine/defs'
import type { FlowLesson } from '../../../flow/types'
import { AUDIENCE } from '../shared/meta'
import { placeholder } from './Placeholder'
import { Poster } from './Poster'

export const handsTouch: FlowLesson = {
  id: 'hands-touch',
  title: 'The Sense of Touch',
  tagline: 'What happens to a hand that can’t feel, the four kinds of touch in your skin, the ways engineers fake them, and why robot skin wears out.',
  age: 'Teens and adults',
  minutes: 9,
  chapters: [placeholder],
  Poster,
  Defs: CineDefs,
  look: 'cine',
  audience: AUDIENCE,
  course: 'robot-hands',
}
