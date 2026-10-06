import { CineDefs } from '../../../cine/defs'
import type { FlowLesson } from '../../../flow/types'
import { AUDIENCE } from '../shared/meta'
import { placeholder } from './Placeholder'
import { Poster } from './Poster'

export const handsFrontier: FlowLesson = {
  id: 'hands-frontier',
  title: 'Build Your Own Hand',
  tagline: 'How a hand is controlled, who is building what in 2026, the problems nobody has solved, and your turn to design a hand for a real customer.',
  age: 'Teens and adults',
  minutes: 11,
  chapters: [placeholder],
  Poster,
  Defs: CineDefs,
  look: 'cine',
  audience: AUDIENCE,
  course: 'robot-hands',
}
