import type { Chapter, Cue } from '../../flow/types'
import { placeholderScene } from '../algebra/placeholder'

export const CUES: Cue[] = [
  { id: 'look-back', say: "Look how far you've come. You matched like Ama, gave amounts their names, bundled by ten, and put amounts together and took them apart." },
  { id: 'tree', say: 'Every idea you learned today is a branch on a giant tree: the tree of math. And it keeps on growing.' },
  { id: 'patterns', say: "The 'What comes next?' branch is all about patterns, like day, night, day, night. It will grow soon." },
  { id: 'shapes', say: "The 'How big, and what shape?' branch measures things, from paper clips to planets." },
  { id: 'algebra', say: "And the 'How do amounts change?' branch grows all the way up to algebra, where you find a secret number called x." },
  { id: 'end', say: 'Every big idea starts small. Yours started with a pebble.' },
]

export const ch6: Chapter = {
  id: 'tree',
  title: 'Your knowledge tree',
  cues: CUES,
  Scene: placeholderScene('Your knowledge tree', CUES),
  enter: { type: 'dissolve' },
}
