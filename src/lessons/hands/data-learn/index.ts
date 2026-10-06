import { CineDefs } from '../../../cine/defs'
import type { FlowLesson } from '../../../flow/types'
import { AUDIENCE } from '../shared/meta'
import { placeholder } from './Placeholder'
import { Poster } from './Poster'

export const dataLearn: FlowLesson = {
  id: 'data-learn',
  title: 'How Robots Learn',
  tagline: 'How a robot actually learns from demonstrations: copying and drifting, averaging into walls, many rooms versus many repetitions, and the giant models that read, see and act.',
  age: 'Teens and adults',
  minutes: 10,
  chapters: [placeholder],
  Poster,
  Defs: CineDefs,
  look: 'cine',
  audience: AUDIENCE,
  course: 'robot-hands',
}
