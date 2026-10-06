import type { Chapter, Cue } from '../../flow/types'
import { placeholderScene } from '../algebra/placeholder'

export const CUES: Cue[] = [
  { id: 'more-questions', say: 'Matching pebbles worked. But as people built villages and markets, they kept running into new questions.' },
  { id: 'four-questions', say: 'Almost every question they asked was one of four big ones.' },
  { id: 'how-many', say: "How many? Counting things, like Ama's sheep." },
  { id: 'change', say: 'How do amounts change? Like when you get more apples, or give some away.' },
  { id: 'next', say: 'What comes next? Like day, night, day, night, or the seasons.' },
  { id: 'shape', say: 'How big, and what shape? Like whether a couch will fit through the door.' },
  {
    id: 'everywhere',
    say: 'Bakers, builders, astronauts and game makers use these four questions every day. Every bit of math you will ever learn helps answer one of them.',
  },
  {
    id: 'which-question',
    say: 'Now you try! Each card is a real-life puzzle. Drag it to the big question that helps solve it.',
    play: true,
  },
]

export const ch2: Chapter = {
  id: 'map',
  title: 'The map of math',
  cues: CUES,
  Scene: placeholderScene('The map of math', CUES),
  enter: { type: 'pan', dir: 'left' },
}
