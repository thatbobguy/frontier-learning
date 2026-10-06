import type { FlowLesson } from '../../flow/types'
import { ch1 } from './Ch1Riddle'
import { ch2 } from './Ch2Wisdom'
import { ch3 } from './Ch3Unknown'
import { ch4 } from './Ch4Balance'
import { ch5 } from './Ch5TwoSteps'
import { ch6 } from './Ch6Challenge'
import { ch7 } from './Ch7World'
import { AlgebraPoster } from './Poster'

export const algebra: FlowLesson = {
  id: 'algebra',
  title: 'Solving for x',
  tagline: 'A riddle in a Baghdad night market, the scholar who turned it into a method, and the one rule that lets you run the world backwards.',
  age: 'Ages 10 to 12',
  minutes: 10,
  chapters: [ch1, ch2, ch3, ch4, ch5, ch6, ch7],
  Poster: AlgebraPoster,
  next: [
    { title: 'Graphs', blurb: 'Draw an equation as a picture, and watch x move.' },
    { title: 'Functions', blurb: 'Number machines that turn any input into an output.' },
    { title: 'Inequalities', blurb: 'What happens when the scale is allowed to tip.' },
  ],
}
