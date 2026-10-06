import type { FlowLesson } from '../../flow/types'
import { ch1 } from './Ch1Pebbles'
import { ch2 } from './Ch2Questions'
import { ch3 } from './Ch3Names'
import { ch4 } from './Ch4Bundles'
import { ch5 } from './Ch5Change'
import { ch6 } from './Ch6Tree'
import { FrameworksPoster } from './Poster'

export const frameworks: FlowLesson = {
  id: 'frameworks',
  title: 'The Frameworks of Mathematics',
  tagline: 'Why people invented math at all, and the first big ideas that grew out of counting.',
  age: 'Ages 7 to 8',
  minutes: 15,
  chapters: [ch1, ch2, ch3, ch4, ch5, ch6],
  Poster: FrameworksPoster,
  next: [
    { title: 'What comes next?', blurb: 'Patterns, from day and night to counting by twos.' },
    { title: 'How big? What shape?', blurb: 'Measuring with paper clips, footsteps and rulers.' },
    { title: 'Solving for x', blurb: 'Lesson 2: a balance scale that finds a secret number.', href: '#/lesson/algebra' },
  ],
}
